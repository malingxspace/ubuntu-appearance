import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {getDesktopImage} from '../background/desktopBackground.js';
import {getImages} from '../background/imageCatalog.js';
import {setDesktopImage} from '../appearance/desktopService.js';

export const LOGIN_BACKGROUND_INDICATOR_NAME = 'LoginBackgroundIndicator';

export const LoginBackgroundIndicator = GObject.registerClass(
class LoginBackgroundIndicator extends Button {
    _init(settings, openPreferences) {
        super._init(0, LOGIN_BACKGROUND_INDICATOR_NAME, false);
        this.add_style_class_name('background-quick-entry-button');
        this.add_child(new St.Icon({
            icon_name: 'preferences-desktop-wallpaper-symbolic',
            style_class: 'background-quick-entry-icon',
        }));

        const preferencesItem = new PopupMenu.PopupMenuItem(
            _('Open background settings'));
        preferencesItem.connect('activate', () => openPreferences());
        this.menu.addMenuItem(preferencesItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const randomDesktopItem = new PopupMenu.PopupMenuItem(
            _('Random desktop wallpaper'));
        randomDesktopItem.connect('activate', () =>
            this._setRandomDesktopImage(settings));
        this.menu.addMenuItem(randomDesktopItem);
    }

    _setRandomDesktopImage(settings) {
        let images;
        try {
            images = getImages(settings);
        } catch (error) {
            Main.notifyError(_('Ubuntu Appearance'), error.message);
            return;
        }

        const current = getDesktopImage();
        const choices = images.filter(image => image.path !== current);
        const image = choices[Math.floor(Math.random() * choices.length)];
        if (!image) {
            Main.notifyError(_('Ubuntu Appearance'),
                _('No other image is available in the selected folder.'));
            return;
        }

        try {
            setDesktopImage(image.path);
            Main.notify(_('Ubuntu Appearance'), _('Desktop wallpaper updated.'));
        } catch (error) {
            Main.notifyError(_('Ubuntu Appearance'), error.message);
        }
    }

});
