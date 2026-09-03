import Gio from 'gi://Gio';

import {DESKTOP_SCHEMA} from '../config/constants.js';

export function setDesktopImage(path) {
    const settings = new Gio.Settings({schema: DESKTOP_SCHEMA});
    const uri = Gio.File.new_for_path(path).get_uri();
    settings.set_string('picture-uri', uri);
    if (settings.settings_schema.has_key('picture-uri-dark'))
        settings.set_string('picture-uri-dark', uri);
    if (settings.settings_schema.has_key('picture-options'))
        settings.set_string('picture-options', 'zoom');
    Gio.Settings.sync();
}
