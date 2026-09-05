import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {
    LOGIN_BACKGROUND_INDICATOR_NAME,
    LoginBackgroundIndicator,
} from './src/shell/backgroundIndicator.js';
import {
    NETWORK_INDICATOR_NAME,
    NetworkSpeedIndicator,
} from './src/shell/networkIndicator.js';
import {EXTENSION_SCHEMA, SETTINGS_KEYS} from './src/config/constants.js';
import {BingDownloadService} from './src/bing/downloadService.js';

function primaryDisplaySize() {
    const monitor = Main.layoutManager.primaryMonitor;
    return monitor
        ? {width: monitor.width, height: monitor.height}
        : {width: 3840, height: 2160};
}

export default class UbuntuAppearanceExtension extends Extension {
    enable() {
        this._settings = this.getSettings(EXTENSION_SCHEMA);
        this._settings.connectObject(
            `changed::${SETTINGS_KEYS.showPanelIcon}`,
            () => this._syncBackgroundIndicator(),
            `changed::${SETTINGS_KEYS.showNetworkSpeed}`,
            () => this._syncNetworkIndicator(),
            `changed::${SETTINGS_KEYS.networkSpeedPosition}`,
            () => this._syncNetworkIndicator(true),
            this);

        this._syncBackgroundIndicator();
        this._syncNetworkIndicator();
        this._bingDownloader = new BingDownloadService(
            this._settings, primaryDisplaySize);
        this._bingDownloader.start();
    }

    disable() {
        this._settings?.disconnectObject(this);
        this._bingDownloader?.stop();
        this._bingDownloader = null;
        this._destroyBackgroundIndicator();
        this._destroyNetworkIndicator();
        this._settings = null;
    }

    _syncBackgroundIndicator() {
        if (!this._settings.get_boolean(SETTINGS_KEYS.showPanelIcon)) {
            this._destroyBackgroundIndicator();
            return;
        }
        if (this._backgroundIndicator)
            return;

        this._backgroundIndicator = new LoginBackgroundIndicator(
            this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea(
            LOGIN_BACKGROUND_INDICATOR_NAME, this._backgroundIndicator);
    }

    _syncNetworkIndicator(recreate = false) {
        if (!this._settings.get_boolean(SETTINGS_KEYS.showNetworkSpeed)) {
            this._destroyNetworkIndicator();
            return;
        }
        if (this._networkIndicator && !recreate)
            return;

        this._destroyNetworkIndicator();
        this._networkIndicator = new NetworkSpeedIndicator(
            this._settings, this.path);
        Main.panel.addToStatusArea(
            NETWORK_INDICATOR_NAME,
            this._networkIndicator,
            0,
            this._networkPosition());
    }

    _networkPosition() {
        return this._settings.get_string(SETTINGS_KEYS.networkSpeedPosition) === 'left'
            ? 'left' : 'right';
    }

    _destroyBackgroundIndicator() {
        this._backgroundIndicator?.destroy();
        this._backgroundIndicator = null;
    }

    _destroyNetworkIndicator() {
        this._networkIndicator?.stop();
        this._networkIndicator?.destroy();
        this._networkIndicator = null;
    }
}
