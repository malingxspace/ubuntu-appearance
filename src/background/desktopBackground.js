import Gio from 'gi://Gio';

import {DESKTOP_SCHEMA} from '../config/constants.js';

function pathFromUri(uri) {
    if (!uri || !uri.startsWith('file://'))
        return null;
    try {
        const path = Gio.File.new_for_uri(uri).get_path();
        return path && Gio.File.new_for_path(path).query_exists(null) ? path : null;
    } catch (error) {
        return null;
    }
}

export function getDesktopImage() {
    try {
        const settings = new Gio.Settings({schema: DESKTOP_SCHEMA});
        const regular = pathFromUri(settings.get_string('picture-uri'));
        if (!settings.settings_schema.has_key('picture-uri-dark'))
            return regular;
        const interfaceSettings = new Gio.Settings({
            schema: 'org.gnome.desktop.interface',
        });
        const prefersDark = interfaceSettings.settings_schema.has_key(
            'color-scheme') && interfaceSettings.get_string(
            'color-scheme') === 'prefer-dark';
        const dark = pathFromUri(settings.get_string('picture-uri-dark'));
        return prefersDark ? dark || regular : regular || dark;
    } catch (error) {
        return null;
    }
}
