import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences, gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Utils from './utils.js';

function sendSystemNotification(window, body) {
    const application = window.get_application();
    if (!application) {
        console.warn('无法发送系统通知：设置窗口没有关联应用。');
        return;
    }

    const notification = new Gio.Notification();
    notification.set_title(_('Ubuntu Appearance'));
    notification.set_body(body);
    notification.set_icon(new Gio.ThemedIcon({
        name: 'preferences-desktop-wallpaper-symbolic',
    }));
    application.send_notification('ubuntu-appearance-result', notification);
}

export default class LoginBackgroundPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(Utils.EXTENSION_SCHEMA);
        window.set_default_size(820, 680);

        const page = new Adw.PreferencesPage();
        const controlGroup = new Adw.PreferencesGroup({
            title: _('Boot and login background'),
            description: _('Choose a local image for the Ubuntu login screen.'),
        });

        const panelRow = new Adw.SwitchRow({
            title: _('Show panel icon'),
            subtitle: _('Show background controls in the top panel.'),
        });
        settings.bind('show-panel-icon', panelRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        controlGroup.add(panelRow);

        const plymouthRow = new Adw.SwitchRow({
            title: _('Customize boot and shutdown'),
            subtitle: _('Apply the selected image to Plymouth when updating the background.'),
        });
        settings.bind(
            'customize-plymouth', plymouthRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        controlGroup.add(plymouthRow);

        const firmwareLogoRow = new Adw.SwitchRow({
            title: _('Hide manufacturer logo'),
            subtitle: _('Hide firmware logos such as HUAWEI on the boot screen.'),
        });
        settings.bind(
            'customize-plymouth', firmwareLogoRow, 'sensitive',
            Gio.SettingsBindFlags.GET);
        settings.bind(
            'hide-firmware-logo', firmwareLogoRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        controlGroup.add(firmwareLogoRow);

        const directoryRow = new Adw.ActionRow({title: _('Image folder')});
        const folderButton = new Gtk.Button({label: _('Choose folder…')});
        folderButton.set_valign(Gtk.Align.CENTER);
        directoryRow.add_suffix(folderButton);
        controlGroup.add(directoryRow);

        const actionsRow = new Adw.ActionRow({title: _('Actions')});
        const fileButton = new Gtk.Button({label: _('Choose image…')});
        fileButton.set_valign(Gtk.Align.CENTER);
        fileButton.add_css_class('suggested-action');
        const refreshButton = new Gtk.Button({label: _('Refresh')});
        refreshButton.set_valign(Gtk.Align.CENTER);
        const resetButton = new Gtk.Button({label: _('Restore default')});
        resetButton.set_valign(Gtk.Align.CENTER);
        actionsRow.add_suffix(fileButton);
        actionsRow.add_suffix(refreshButton);
        actionsRow.add_suffix(resetButton);
        controlGroup.add(actionsRow);

        const statusRow = new Adw.ActionRow({title: _('Status')});
        statusRow.set_subtitle(_('Select an image to begin.'));
        controlGroup.add(statusRow);
        page.add(controlGroup);

        const imageGroup = new Adw.PreferencesGroup({title: _('Available images')});
        page.add(imageGroup);
        window.add(page);
        let imageRows = [];

        const reload = () => {
            for (const row of imageRows)
                imageGroup.remove(row);
            imageRows = [];

            const directory = Utils.getImageDirectory(settings);
            directoryRow.set_subtitle(directory);
            let images;
            try {
                images = Utils.getImages(settings);
            } catch (error) {
                statusRow.set_subtitle(error.message);
                return;
            }
            if (images.length === 0) {
                statusRow.set_subtitle(`${_('No images found.')}\n${directory}`);
                return;
            }

            const selected = settings.get_string('selected-image');
            statusRow.set_subtitle(_('Found %d images.').format(images.length));
            images.forEach(image => {
                const row = new Adw.ActionRow({
                    title: `${image.name}${image.path === selected ? ` — ${_('selected')}` : ''}`,
                    subtitle: image.path,
                });
                const picture = Gtk.Picture.new_for_filename(image.path);
                picture.set_size_request(112, 64);
                picture.set_content_fit(Gtk.ContentFit.COVER);
                row.add_prefix(picture);

                const applyButton = new Gtk.Button({label: _('Apply')});
                applyButton.set_valign(Gtk.Align.CENTER);
                applyButton.connect('clicked', () => applyPath(image.path, applyButton));
                row.add_suffix(applyButton);
                imageGroup.add(row);
                imageRows.push(row);
            });
        };

        const applyPath = (path, button = null) => {
            const customizePlymouth = settings.get_boolean('customize-plymouth');
            const hideFirmwareLogo = settings.get_boolean('hide-firmware-logo');
            button?.set_sensitive(false);
            statusRow.set_subtitle(_('Waiting for administrator authentication…'));
            Utils.applyImage(
                path,
                customizePlymouth,
                hideFirmwareLogo,
                (success, message) => {
                    button?.set_sensitive(true);
                    if (success) {
                        const successMessage = customizePlymouth
                            ? _('Login background and boot theme updated.')
                            : _('Login background updated.');
                        settings.set_string('selected-image', path);
                        reload();
                        statusRow.set_subtitle(successMessage);
                        sendSystemNotification(window, successMessage);
                    } else {
                        const failureMessage = message || _('Update failed.');
                        statusRow.set_subtitle(failureMessage);
                        sendSystemNotification(window, failureMessage);
                    }
                });
        };

        folderButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: _('Choose image folder'),
                modal: true,
            });
            const current = Gio.File.new_for_path(Utils.getImageDirectory(settings));
            if (current.query_exists(null))
                dialog.set_initial_folder(current);
            dialog.select_folder(window, null, (self, result) => {
                try {
                    const folder = self.select_folder_finish(result).get_path();
                    settings.set_string('image-directory', folder);
                    reload();
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        statusRow.set_subtitle(error.message);
                }
            });
        });

        fileButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: _('Choose login background'),
                modal: true,
            });
            const current = Gio.File.new_for_path(Utils.getImageDirectory(settings));
            if (current.query_exists(null))
                dialog.set_initial_folder(current);
            dialog.open(window, null, (self, result) => {
                try {
                    const path = self.open_finish(result).get_path();
                    if (!/\.(jpe?g|png|webp)$/i.test(path)) {
                        statusRow.set_subtitle(_('Only JPG, PNG and WEBP images are supported.'));
                        return;
                    }
                    applyPath(path, fileButton);
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        statusRow.set_subtitle(error.message);
                }
            });
        });

        resetButton.connect('clicked', () => {
            resetButton.set_sensitive(false);
            statusRow.set_subtitle(_('Waiting for administrator authentication…'));
            Utils.clearBackground((success, message) => {
                resetButton.set_sensitive(true);
                if (success) {
                    settings.set_string('selected-image', '');
                    reload();
                }
                const resultMessage = message || (success
                    ? _('Default background and Ubuntu logo restored.')
                    : _('Update failed.'));
                statusRow.set_subtitle(resultMessage);
                sendSystemNotification(window, resultMessage);
            });
        });

        refreshButton.connect('clicked', reload);
        reload();
    }
}
