import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {SETTINGS_KEYS} from '../config/constants.js';

export function createNetworkGroup(settings) {
    const group = new Adw.PreferencesGroup({
        title: _('Live network speed'),
        description: _('Configure the live network speed indicator.'),
    });
    const enabledRow = new Adw.SwitchRow({
        title: _('Show network speed'),
        subtitle: _('Show live download and upload speeds in the top panel.'),
    });
    settings.bind(
        SETTINGS_KEYS.showNetworkSpeed, enabledRow, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    group.add(enabledRow);

    const unitRow = new Adw.ComboRow({
        title: _('Speed unit'),
        model: Gtk.StringList.new([_('Bytes per second'), _('Bits per second')]),
    });
    unitRow.set_selected(
        settings.get_string(SETTINGS_KEYS.networkSpeedUnit) === 'bits' ? 1 : 0);
    unitRow.connect('notify::selected', () => settings.set_string(
        SETTINGS_KEYS.networkSpeedUnit,
        unitRow.get_selected() === 1 ? 'bits' : 'bytes'));
    group.add(unitRow);

    const positionRow = new Adw.ComboRow({
        title: _('Display position'),
        model: Gtk.StringList.new([_('Right'), _('Left')]),
    });
    positionRow.set_selected(
        settings.get_string(SETTINGS_KEYS.networkSpeedPosition) === 'left' ? 1 : 0);
    positionRow.connect('notify::selected', () => settings.set_string(
        SETTINGS_KEYS.networkSpeedPosition,
        positionRow.get_selected() === 1 ? 'left' : 'right'));
    group.add(positionRow);

    const syncSensitivity = () => {
        const enabled = enabledRow.get_active();
        unitRow.set_sensitive(enabled);
        positionRow.set_sensitive(enabled);
    };
    enabledRow.connect('notify::active', syncSensitivity);
    syncSensitivity();
    return group;
}
