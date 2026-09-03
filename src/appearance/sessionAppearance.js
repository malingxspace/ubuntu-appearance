import Gio from 'gi://Gio';

import {
    LOGIN_BACKGROUND_SCHEMA,
    LOGIN_SCREEN_SCHEMA,
} from '../config/constants.js';

const INSTALLED_BACKGROUND_URI = 'file:///usr/share/backgrounds/login-background.jpg';

export function setSessionAppearance() {
    const background = new Gio.Settings({schema: LOGIN_BACKGROUND_SCHEMA});
    background.set_string('background-picture-uri', INSTALLED_BACKGROUND_URI);
    background.set_string('background-size', 'cover');
    background.set_string('background-repeat', 'no-repeat');

    const loginScreen = new Gio.Settings({schema: LOGIN_SCREEN_SCHEMA});
    loginScreen.set_string('logo', '');
    loginScreen.set_string('fallback-logo', '');
    Gio.Settings.sync();
}

export function resetSessionAppearance() {
    const background = new Gio.Settings({schema: LOGIN_BACKGROUND_SCHEMA});
    background.reset('background-picture-uri');
    background.reset('background-size');
    background.reset('background-repeat');

    const loginScreen = new Gio.Settings({schema: LOGIN_SCREEN_SCHEMA});
    loginScreen.reset('logo');
    loginScreen.reset('fallback-logo');
    Gio.Settings.sync();
}
