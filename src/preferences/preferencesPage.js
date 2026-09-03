import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences, gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {EXTENSION_SCHEMA, SETTINGS_KEYS} from '../config/constants.js';
import {
    applyLoginImage,
    applyPlymouthImage,
    clearLoginBackground,
    clearPlymouthBackground,
    setFirmwareLogoHidden,
} from '../appearance/backgroundService.js';
import {setDesktopImage} from '../appearance/desktopService.js';
import {getImageDirectory} from '../background/imageCatalog.js';
import {getDesktopImage} from '../background/desktopBackground.js';
import {
    deleteManagedImage,
    isManagedImage,
    storeManagedImage,
} from '../background/managedImageStore.js';
import {createNetworkGroup} from './networkGroup.js';
import {createBingDownloadGroups} from './bingDownloadGroup.js';
import {createBingHistoryGroup} from './bingHistoryGroup.js';

function createImageStatusRow(title) {
    const row = new Adw.ActionRow({title});
    const picture = new Gtk.Picture({
        width_request: 160,
        height_request: 90,
        content_fit: Gtk.ContentFit.COVER,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        hexpand: false,
        vexpand: false,
    });
    row.add_prefix(picture);
    return {row, picture};
}

function updateImageStatus(status, path, fallback, label = '') {
    const exists = path && Gio.File.new_for_path(path).query_exists(null);
    status.picture.set_visible(Boolean(exists));
    status.picture.set_filename(exists ? path : null);
    status.row.set_subtitle(exists
        ? isManagedImage(path)
            ? label
                ? _('%s · Saved copy').format(label)
                : _('Saved copy')
            : Gio.File.new_for_path(path).get_basename()
        : fallback);
    status.row.set_tooltip_text(exists ? path : fallback);
}

function setButtonBusy(button, busy, idleLabel) {
    if (!button)
        return;
    button.set_sensitive(!busy);
    button.set_label(busy ? _('Working…') : idleLabel);
}

function showToast(window, body) {
    window.add_toast(new Adw.Toast({title: body, timeout: 4}));
}

function createRestoreMenu() {
    const menuButton = new Gtk.MenuButton({
        icon_name: 'view-more-symbolic',
        valign: Gtk.Align.CENTER,
        tooltip_text: _('More actions'),
    });
    const resetButton = new Gtk.Button({label: _('Restore default')});
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
    });
    box.append(resetButton);
    const popover = new Gtk.Popover({child: box});
    menuButton.set_popover(popover);
    resetButton.connect('clicked', () => popover.popdown());
    return {menuButton, resetButton};
}

export default class LoginBackgroundPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(EXTENSION_SCHEMA);
        const settingSignalIds = [];
        const connectSetting = (signal, callback) => {
            settingSignalIds.push(settings.connect(signal, callback));
        };
        window.connect('close-request', () => {
            for (const id of settingSignalIds)
                settings.disconnect(id);
            settingSignalIds.length = 0;
            return false;
        });
        window.set_default_size(820, 680);

        const backgroundPage = new Adw.PreferencesPage({
            title: _('Background settings'),
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        const bingPage = new Adw.PreferencesPage({
            title: _('Bing images'),
            icon_name: 'folder-download-symbolic',
        });
        const panelPage = new Adw.PreferencesPage({
            title: _('Top panel'),
            icon_name: 'network-wired-symbolic',
        });
        const currentBackgroundGroup = new Adw.PreferencesGroup({
            title: _('Current backgrounds'),
            description: _('Desktop, login and boot backgrounds are configured independently.'),
        });
        const desktopStatus = createImageStatusRow(_('Desktop wallpaper'));
        const loginStatus = createImageStatusRow(_('Login screen'));
        const bootStatus = createImageStatusRow(_('Boot and shutdown screen'));
        currentBackgroundGroup.add(desktopStatus.row);
        currentBackgroundGroup.add(loginStatus.row);
        currentBackgroundGroup.add(bootStatus.row);
        backgroundPage.add(currentBackgroundGroup);

        const panelRow = new Adw.SwitchRow({
            title: _('Show panel icon'),
            subtitle: _('Show background controls in the top panel.'),
        });
        settings.bind(
            SETTINGS_KEYS.showPanelIcon, panelRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        const backgroundShortcutGroup = new Adw.PreferencesGroup({
            title: _('Background shortcut'),
        });
        backgroundShortcutGroup.add(panelRow);

        const directoryRow = new Adw.ActionRow({title: _('Download folder')});
        const folderButton = new Gtk.Button({label: _('Choose folder…')});
        folderButton.set_valign(Gtk.Align.CENTER);
        directoryRow.add_suffix(folderButton);

        const desktopFileButton = new Gtk.Button({
            label: _('Change…'),
            valign: Gtk.Align.CENTER,
        });
        desktopStatus.row.add_suffix(desktopFileButton);

        const loginFileButton = new Gtk.Button({
            label: _('Change…'),
            valign: Gtk.Align.CENTER,
        });
        const loginRestore = createRestoreMenu();
        loginStatus.row.add_suffix(loginRestore.menuButton);
        loginStatus.row.add_suffix(loginFileButton);

        const plymouthFileButton = new Gtk.Button({
            label: _('Change…'),
            valign: Gtk.Align.CENTER,
        });
        const plymouthRestore = createRestoreMenu();
        bootStatus.row.add_suffix(plymouthRestore.menuButton);
        bootStatus.row.add_suffix(plymouthFileButton);

        const bootOptionsGroup = new Adw.PreferencesGroup({
            title: _('Boot options'),
        });
        const firmwareLogoRow = new Adw.SwitchRow({
            title: _('Show manufacturer logo'),
            subtitle: _('Only affects the boot and shutdown screen. Changes require administrator authentication and update initramfs.'),
        });
        bootOptionsGroup.add(firmwareLogoRow);
        backgroundPage.add(bootOptionsGroup);

        const {downloadGroup, storageGroup} = createBingDownloadGroups(
            settings, connectSetting, directoryRow);
        bingPage.add(downloadGroup);
        bingPage.add(storageGroup);
        bingPage.add(createBingHistoryGroup(settings, connectSetting, {
            setDesktop: (path, label) => applyDesktopPath(path, null, label),
            setLogin: (path, label) => applyLoginPath(path, null, label),
            setPlymouth: (path, label) =>
                applyPlymouthPath(path, null, label),
        }));
        panelPage.add(backgroundShortcutGroup);
        panelPage.add(createNetworkGroup(settings));

        window.add(bingPage);
        window.add(backgroundPage);
        window.add(panelPage);
        const updateCurrentBackgrounds = () => {
            const selected = settings.get_string(SETTINGS_KEYS.selectedImage);
            updateImageStatus(
                desktopStatus,
                getDesktopImage(),
                _('No desktop image found.'),
                settings.get_string(SETTINGS_KEYS.desktopImageLabel));
            updateImageStatus(
                loginStatus,
                selected,
                _('System default background'),
                settings.get_string(SETTINGS_KEYS.loginImageLabel));
            updateImageStatus(
                bootStatus,
                settings.get_string(SETTINGS_KEYS.plymouthImage),
                _('System default boot screen'),
                settings.get_string(SETTINGS_KEYS.plymouthImageLabel));
            loginRestore.menuButton.set_sensitive(
                Boolean(selected) && !loginOperationRunning);
            plymouthRestore.menuButton.set_sensitive(
                Boolean(settings.get_string(SETTINGS_KEYS.plymouthImage)) &&
                !plymouthOperationRunning);
        };
        connectSetting(
            `changed::${SETTINGS_KEYS.selectedImage}`,
            updateCurrentBackgrounds);
        connectSetting(
            `changed::${SETTINGS_KEYS.plymouthImage}`,
            updateCurrentBackgrounds);
        for (const key of [
            SETTINGS_KEYS.desktopImageLabel,
            SETTINGS_KEYS.loginImageLabel,
            SETTINGS_KEYS.plymouthImageLabel,
        ])
            connectSetting(`changed::${key}`, updateCurrentBackgrounds);

        let syncingLogoSwitch = false;
        let logoOperationRunning = false;
        let loginOperationRunning = false;
        let plymouthOperationRunning = false;
        const updateFirmwareLogoAction = () => {
            const hasPlymouth = Boolean(settings.get_string(
                SETTINGS_KEYS.plymouthImage));
            const hidden = settings.get_boolean(
                SETTINGS_KEYS.hideFirmwareLogo);
            syncingLogoSwitch = true;
            firmwareLogoRow.set_active(!hidden);
            syncingLogoSwitch = false;
            firmwareLogoRow.set_subtitle(hasPlymouth
                ? _('Only affects the boot and shutdown screen. Changes require administrator authentication and update initramfs.')
                : _('Set a boot image before changing the manufacturer logo.'));
            firmwareLogoRow.set_sensitive(
                hasPlymouth && !logoOperationRunning &&
                !plymouthOperationRunning);
        };
        connectSetting(
            `changed::${SETTINGS_KEYS.hideFirmwareLogo}`,
            updateFirmwareLogoAction);
        connectSetting(
            `changed::${SETTINGS_KEYS.plymouthImage}`,
            updateFirmwareLogoAction);
        firmwareLogoRow.connect('notify::active', () => {
            if (syncingLogoSwitch || logoOperationRunning)
                return;
            const hidden = !firmwareLogoRow.get_active();
            logoOperationRunning = true;
            firmwareLogoRow.set_sensitive(false);
            setFirmwareLogoHidden(hidden, (success, message) => {
                if (success)
                    settings.set_boolean(SETTINGS_KEYS.hideFirmwareLogo, hidden);
                logoOperationRunning = false;
                updateFirmwareLogoAction();
                const resultMessage = message || (success
                    ? hidden
                        ? _('Manufacturer logo hidden.')
                        : _('Manufacturer logo restored.')
                    : _('Update failed.'));
                showToast(window, resultMessage);
            });
        });

        const setLoginControlsBusy = (busy, showProgress = false) => {
            loginOperationRunning = busy;
            loginFileButton.set_sensitive(!busy);
            loginFileButton.set_label(showProgress && busy
                ? _('Working…')
                : _('Change…'));
            loginRestore.menuButton.set_sensitive(
                !busy && Boolean(settings.get_string(
                    SETTINGS_KEYS.selectedImage)));
        };
        const setPlymouthControlsBusy = (busy, showProgress = false) => {
            plymouthOperationRunning = busy;
            plymouthFileButton.set_sensitive(!busy);
            plymouthFileButton.set_label(showProgress && busy
                ? _('Working…')
                : _('Change…'));
            plymouthRestore.menuButton.set_sensitive(
                !busy && Boolean(settings.get_string(
                    SETTINGS_KEYS.plymouthImage)));
            updateFirmwareLogoAction();
        };

        const applyDesktopPath = async (path, button = null, label = '') => {
            setButtonBusy(desktopFileButton, true, _('Change…'));
            const previous = getDesktopImage();
            let managedPath = '';
            try {
                managedPath = await storeManagedImage(path, 'desktop');
                setDesktopImage(managedPath);
                settings.set_string(
                    SETTINGS_KEYS.desktopImageLabel,
                    label || Gio.File.new_for_path(path).get_basename());
                deleteManagedImage(previous, 'desktop');
                updateCurrentBackgrounds();
                showToast(window, _('Desktop wallpaper updated.'));
                return true;
            } catch (error) {
                deleteManagedImage(managedPath, 'desktop');
                showToast(window, error.message);
                return false;
            } finally {
                setButtonBusy(desktopFileButton, false, _('Change…'));
            }
        };

        const migrateDesktopImage = async () => {
            const source = getDesktopImage();
            if (!source || isManagedImage(source))
                return;
            let managedPath = '';
            try {
                managedPath = await storeManagedImage(source, 'desktop');
                if (getDesktopImage() !== source) {
                    deleteManagedImage(managedPath, 'desktop');
                    return;
                }
                setDesktopImage(managedPath);
                settings.set_string(
                    SETTINGS_KEYS.desktopImageLabel,
                    Gio.File.new_for_path(source).get_basename());
                updateCurrentBackgrounds();
            } catch (error) {
                deleteManagedImage(managedPath, 'desktop');
                console.warn(`Cannot preserve current desktop image: ${error.message}`);
            }
        };

        const applyLoginPath = async (path, button = null, label = '') => {
            setLoginControlsBusy(true, true);
            const previous = settings.get_string(SETTINGS_KEYS.selectedImage);
            let managedPath = '';
            try {
                managedPath = await storeManagedImage(path, 'login');
            } catch (error) {
                setLoginControlsBusy(false);
                showToast(window, error.message);
                return false;
            }
            return new Promise(resolve => applyLoginImage(
                managedPath, (success, message) => {
                    setLoginControlsBusy(false);
                    if (success) {
                        const successMessage = _('Login background updated.');
                        settings.set_string(
                            SETTINGS_KEYS.selectedImage, managedPath);
                        settings.set_string(
                            SETTINGS_KEYS.loginImageLabel,
                            label || Gio.File.new_for_path(path).get_basename());
                        if (previous !== settings.get_string(
                            SETTINGS_KEYS.plymouthImage))
                            deleteManagedImage(previous, 'login');
                        showToast(window, successMessage);
                    } else {
                        deleteManagedImage(managedPath, 'login');
                        const failureMessage = message || _('Update failed.');
                        showToast(window, failureMessage);
                    }
                    resolve(success);
                }));
        };

        const applyPlymouthPath = async (path, button = null, label = '') => {
            setPlymouthControlsBusy(true, true);
            const previous = settings.get_string(SETTINGS_KEYS.plymouthImage);
            let managedPath = '';
            try {
                managedPath = await storeManagedImage(path, 'plymouth');
            } catch (error) {
                setPlymouthControlsBusy(false);
                showToast(window, error.message);
                return false;
            }
            const hideLogo = settings.get_boolean(
                SETTINGS_KEYS.hideFirmwareLogo);
            return new Promise(resolve => applyPlymouthImage(
                managedPath, hideLogo, (success, message) => {
                    setPlymouthControlsBusy(false);
                    if (success) {
                        settings.set_string(
                            SETTINGS_KEYS.plymouthImage, managedPath);
                        settings.set_string(
                            SETTINGS_KEYS.plymouthImageLabel,
                            label || Gio.File.new_for_path(path).get_basename());
                        if (previous !== settings.get_string(
                            SETTINGS_KEYS.selectedImage))
                            deleteManagedImage(previous, 'plymouth');
                        const successMessage = _('Boot and shutdown screen updated.');
                        showToast(window, successMessage);
                    } else {
                        deleteManagedImage(managedPath, 'plymouth');
                        const failureMessage = message || _('Update failed.');
                        showToast(window, failureMessage);
                    }
                    resolve(success);
                }));
        };

        folderButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: _('Choose image folder'),
                modal: true,
            });
            const current = Gio.File.new_for_path(getImageDirectory(settings));
            if (current.query_exists(null))
                dialog.set_initial_folder(current);
            dialog.select_folder(window, null, (self, result) => {
                try {
                    const folder = self.select_folder_finish(result).get_path();
                    settings.set_string(SETTINGS_KEYS.imageDirectory, folder);
                    directoryRow.set_subtitle(getImageDirectory(settings));
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        showToast(window, error.message);
                }
            });
        });

        const chooseImage = (title, button, apply) => {
            const dialog = new Gtk.FileDialog({
                title,
                modal: true,
            });
            const current = Gio.File.new_for_path(getImageDirectory(settings));
            if (current.query_exists(null))
                dialog.set_initial_folder(current);
            dialog.open(window, null, (self, result) => {
                try {
                    const path = self.open_finish(result).get_path();
                    if (!/\.(jpe?g|png|webp)$/i.test(path)) {
                        showToast(
                            window,
                            _('Only JPG, PNG and WEBP images are supported.'));
                        return;
                    }
                    apply(path, button);
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        showToast(window, error.message);
                }
            });
        };
        desktopFileButton.connect('clicked', () => chooseImage(
            _('Choose desktop wallpaper'),
            desktopFileButton,
            applyDesktopPath));
        loginFileButton.connect('clicked', () => chooseImage(
            _('Choose login background'),
            loginFileButton,
            applyLoginPath));
        plymouthFileButton.connect('clicked', () => chooseImage(
            _('Choose boot and shutdown image'),
            plymouthFileButton,
            applyPlymouthPath));

        loginRestore.resetButton.connect('clicked', () => {
            const previousLogin = settings.get_string(
                SETTINGS_KEYS.selectedImage);
            setLoginControlsBusy(true);
            clearLoginBackground((success, message) => {
                setLoginControlsBusy(false);
                if (success) {
                    settings.set_string(SETTINGS_KEYS.selectedImage, '');
                    settings.set_string(SETTINGS_KEYS.loginImageLabel, '');
                    if (previousLogin !== settings.get_string(
                        SETTINGS_KEYS.plymouthImage))
                        deleteManagedImage(previousLogin, 'login');
                }
                const resultMessage = message || (success
                    ? _('Default login background restored.')
                    : _('Update failed.'));
                showToast(window, resultMessage);
            });
        });

        plymouthRestore.resetButton.connect('clicked', () => {
            const previous = settings.get_string(SETTINGS_KEYS.plymouthImage);
            setPlymouthControlsBusy(true);
            clearPlymouthBackground((success, message) => {
                setPlymouthControlsBusy(false);
                if (success) {
                    settings.set_string(SETTINGS_KEYS.plymouthImage, '');
                    settings.set_string(
                        SETTINGS_KEYS.plymouthImageLabel, '');
                    settings.set_boolean(SETTINGS_KEYS.hideFirmwareLogo, false);
                    if (previous !== settings.get_string(
                        SETTINGS_KEYS.selectedImage))
                        deleteManagedImage(previous, 'plymouth');
                }
                const resultMessage = message || (success
                    ? _('Default boot and shutdown screen restored.')
                    : _('Update failed.'));
                showToast(window, resultMessage);
            });
        });

        connectSetting(`changed::${SETTINGS_KEYS.imageDirectory}`, () =>
            directoryRow.set_subtitle(getImageDirectory(settings)));
        directoryRow.set_subtitle(getImageDirectory(settings));
        updateCurrentBackgrounds();
        updateFirmwareLogoAction();
        migrateDesktopImage();
    }
}
