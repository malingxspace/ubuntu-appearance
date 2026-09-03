import St from 'gi://St';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Utils from './utils.js';

const IndicatorName = 'LoginBackgroundIndicator';

const LoginBackgroundIndicator = GObject.registerClass(
class LoginBackgroundIndicator extends Button {
    _init(settings) {
        super._init(0, IndicatorName, false);
        this._settings = settings;

        this.add_child(new St.Icon({
            icon_name: 'preferences-desktop-wallpaper-symbolic',
            style_class: 'system-status-icon',
        }));

        const selectItem = new PopupMenu.PopupMenuItem(_('Choose background…'));
        selectItem.connect('activate', () => this._chooseImage());
        this.menu.addMenuItem(selectItem);

        const currentItem = new PopupMenu.PopupMenuItem(_('Use desktop background'));
        currentItem.connect('activate', () => this._applyDesktopImage());
        this.menu.addMenuItem(currentItem);
    }

    _applyDesktopImage() {
        const image = Utils.getDesktopImage();
        if (!image) {
            Main.notifyError(_('Ubuntu Appearance'),
                _('The current desktop background could not be found.'));
            return;
        }
        this._applyImage(image);
    }

    _chooseImage() {
        Utils.chooseImage((image, error) => {
            if (error) {
                Main.notifyError(_('Ubuntu Appearance'), error);
                return;
            }
            if (image)
                this._applyImage(image);
        });
    }

    _applyImage(image) {
        Utils.applyImage(
            image,
            this._settings.get_boolean('customize-plymouth'),
            this._settings.get_boolean('hide-firmware-logo'),
            (success, message) => {
                if (success) {
                    this._settings.set_string('selected-image', image);
                    Main.notify(_('Ubuntu Appearance'), _('Login background updated.'));
                } else {
                    Main.notifyError(_('Ubuntu Appearance'), message || _('Update failed.'));
                }
            });
    }

    stop() {
        this.menu.removeAll();
    }
});

export default class LoginBackgroundExtension extends Extension {
    enable() {
        this._settings = this.getSettings(Utils.EXTENSION_SCHEMA);
        this._visibilityChangedId = this._settings.connect(
            'changed::show-panel-icon', () => this._syncIndicator());
        this._syncIndicator();
    }

    disable() {
        if (this._visibilityChangedId) {
            this._settings.disconnect(this._visibilityChangedId);
            this._visibilityChangedId = null;
        }
        this._destroyIndicator();
        this._settings = null;
    }

    _syncIndicator() {
        if (this._settings.get_boolean('show-panel-icon')) {
            if (!this._indicator) {
                this._indicator = new LoginBackgroundIndicator(this._settings);
                Main.panel.addToStatusArea(IndicatorName, this._indicator);
            }
            return;
        }

        this._destroyIndicator();
    }

    _destroyIndicator() {
        this._indicator?.stop();
        this._indicator?.destroy();
        this._indicator = null;
    }
}
