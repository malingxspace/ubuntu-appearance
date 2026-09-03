import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {validateImage} from './imageCatalog.js';

const BUS_NAME = 'org.freedesktop.portal.Desktop';
const OBJECT_PATH = '/org/freedesktop/portal/desktop';
const FILE_CHOOSER_INTERFACE = 'org.freedesktop.portal.FileChooser';
const REQUEST_INTERFACE = 'org.freedesktop.portal.Request';

export function chooseImage(callback) {
    const connection = Gio.DBus.session;
    const token = `login_background_${GLib.uuid_string_random().replaceAll('-', '_')}`;
    const sender = connection.get_unique_name().slice(1).replaceAll('.', '_');
    let requestPath = `/org/freedesktop/portal/desktop/request/${sender}/${token}`;
    let finished = false;
    let subscriptionId;

    const finish = (path, error = null) => {
        if (finished)
            return;
        finished = true;
        connection.signal_unsubscribe(subscriptionId);
        callback(path, error);
    };

    subscriptionId = connection.signal_subscribe(
        BUS_NAME, REQUEST_INTERFACE, 'Response', null, null,
        Gio.DBusSignalFlags.NONE,
        (_connection, _sender, objectPath, _interface, _signal, parameters) => {
            if (objectPath !== requestPath)
                return;
            const [response, results] = parameters.deepUnpack();
            if (response !== 0) {
                finish(null, response === 1 ? null : '文件选择器返回了错误。');
                return;
            }
            const uris = results.uris?.deepUnpack?.() ?? results.uris ?? [];
            const path = uris[0] ? Gio.File.new_for_uri(uris[0]).get_path() : null;
            if (!path) {
                finish(null, '没有取得所选图片的本地路径。');
                return;
            }
            const error = validateImage(path);
            finish(error ? null : path, error);
        });

    const options = {
        handle_token: new GLib.Variant('s', token),
        modal: new GLib.Variant('b', true),
        multiple: new GLib.Variant('b', false),
    };
    connection.call(
        BUS_NAME, OBJECT_PATH, FILE_CHOOSER_INTERFACE, 'OpenFile',
        new GLib.Variant('(ssa{sv})', ['', '选择 GDM 背景图片', options]),
        new GLib.VariantType('(o)'), Gio.DBusCallFlags.NONE, -1, null,
        (_connection, result) => {
            try {
                [requestPath] = connection.call_finish(result).deepUnpack();
            } catch (error) {
                finish(null, `无法打开文件选择器：${error.message}`);
            }
        });
}
