import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {MARKETS} from '../bing/config.js';
import {SETTINGS_KEYS} from '../config/constants.js';

function selectedIndex(values, selected) {
    const index = values.indexOf(selected);
    return index < 0 ? 0 : index;
}

export function createBingDownloadGroups(settings, connectSetting, directoryRow) {
    const downloadGroup = new Adw.PreferencesGroup({
        title: _('Download settings'),
        description: _('Automatic downloads do not change the desktop or login background.'),
    });

    const enabledRow = new Adw.SwitchRow({
        title: _('Automatically download daily image'),
        subtitle: _('Check at startup and again when Bing publishes the next image.'),
    });
    settings.bind(
        SETTINGS_KEYS.bingDownloadEnabled, enabledRow, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    downloadGroup.add(enabledRow);

    const manualDaysRow = new Adw.SpinRow({
        title: _('Recent images'),
        subtitle: _('Bing provides up to the most recent 8 daily images.'),
        adjustment: new Gtk.Adjustment({
            lower: 1,
            upper: 8,
            step_increment: 1,
            page_increment: 1,
            value: settings.get_int(SETTINGS_KEYS.bingManualDownloadDays),
        }),
    });
    settings.bind(
        SETTINGS_KEYS.bingManualDownloadDays, manualDaysRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);
    downloadGroup.add(manualDaysRow);

    const manualRow = new Adw.ActionRow({title: _('Manual download')});
    const downloadButton = new Gtk.Button({
        label: _('Download now'),
        valign: Gtk.Align.CENTER,
    });
    downloadButton.add_css_class('suggested-action');
    manualRow.add_suffix(downloadButton);
    downloadGroup.add(manualRow);

    const updateDownloadStatus = () => {
        const state = settings.get_string(SETTINGS_KEYS.bingDownloadState);
        downloadButton.set_sensitive(!['queued', 'downloading'].includes(state));
        if (state === 'queued')
            manualRow.set_subtitle(_('Waiting for the background service…'));
        else if (state === 'downloading')
            manualRow.set_subtitle(_('Downloading…'));
        else if (state === 'success') {
            const count = settings.get_int(
                SETTINGS_KEYS.bingLastDownloadCount);
            manualRow.set_subtitle(count === 0
                ? _('All requested images have already been downloaded.')
                : _('%d new images downloaded.').format(count));
        } else if (state === 'error') {
            manualRow.set_subtitle(_('Download failed: %s').format(
                settings.get_string(SETTINGS_KEYS.bingDownloadError)));
        } else {
            manualRow.set_subtitle(_('Download recent Bing images immediately.'));
        }
    };
    for (const key of [
        SETTINGS_KEYS.bingDownloadState,
        SETTINGS_KEYS.bingLastDownloadCount,
        SETTINGS_KEYS.bingDownloadError,
    ])
        connectSetting(`changed::${key}`, updateDownloadStatus);
    downloadButton.connect('clicked', () => {
        let serial = (settings.get_uint(
            SETTINGS_KEYS.bingDownloadRequest) + 1) >>> 0;
        if (serial === 0)
            serial = 1;
        settings.set_string(SETTINGS_KEYS.bingDownloadError, '');
        settings.set_string(SETTINGS_KEYS.bingDownloadState, 'queued');
        settings.set_uint(SETTINGS_KEYS.bingDownloadRequest, serial);
    });
    updateDownloadStatus();

    const marketValues = MARKETS.map(([value]) => value);
    const marketRow = new Adw.ComboRow({
        title: _('Market and region'),
        model: Gtk.StringList.new(MARKETS.map(([, name]) => _(name))),
    });
    marketRow.set_selected(selectedIndex(
        marketValues, settings.get_string(SETTINGS_KEYS.bingMarket)));
    marketRow.connect('notify::selected', () => settings.set_string(
        SETTINGS_KEYS.bingMarket, marketValues[marketRow.get_selected()]));
    downloadGroup.add(marketRow);

    const resolutionValues = ['auto', 'UHD'];
    const resolutionRow = new Adw.ComboRow({
        title: _('Download resolution'),
        subtitle: _('Automatic selects a size for the primary display.'),
        model: Gtk.StringList.new([_('Automatic'), 'UHD']),
    });
    resolutionRow.set_selected(selectedIndex(
        resolutionValues,
        settings.get_string(SETTINGS_KEYS.bingResolution)));
    resolutionRow.connect('notify::selected', () => settings.set_string(
        SETTINGS_KEYS.bingResolution,
        resolutionValues[resolutionRow.get_selected()]));
    downloadGroup.add(resolutionRow);

    const storageGroup = new Adw.PreferencesGroup({
        title: _('Storage and cleanup'),
    });
    storageGroup.add(directoryRow);

    const cleanupRow = new Adw.SwitchRow({
        title: _('Automatically delete old images'),
        subtitle: _('Only images downloaded and recorded by this extension are deleted.'),
    });
    settings.bind(
        SETTINGS_KEYS.bingDeleteOld, cleanupRow, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    storageGroup.add(cleanupRow);

    const retentionRow = new Adw.SpinRow({
        title: _('Retention period'),
        subtitle: _('Days to keep downloaded Bing images.'),
        adjustment: new Gtk.Adjustment({
            lower: 1,
            upper: 365,
            step_increment: 1,
            page_increment: 7,
            value: settings.get_int(SETTINGS_KEYS.bingRetentionDays),
        }),
    });
    settings.bind(
        SETTINGS_KEYS.bingRetentionDays, retentionRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);
    storageGroup.add(retentionRow);

    const syncSensitivity = () => {
        retentionRow.set_sensitive(cleanupRow.get_active());
    };
    cleanupRow.connect('notify::active', syncSensitivity);
    syncSensitivity();
    return {downloadGroup, storageGroup};
}
