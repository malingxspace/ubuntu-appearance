import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {SETTINGS_KEYS} from '../config/constants.js';
import {ApplicationNetworkMonitor} from '../network/applicationMonitor.js';
import {NetworkMonitor} from '../network/monitor.js';
import {formatRate, isDisplayedRateZero} from '../network/rateFormatter.js';

export const NETWORK_INDICATOR_NAME = 'NetworkSpeedIndicator';
const MAX_APPLICATION_ROWS = 8;

function addPanelRate(parent, arrowIcon, colorClass) {
    const group = new St.BoxLayout({
        style_class: 'network-speed-panel-rate',
        orientation: Clutter.Orientation.HORIZONTAL,
        y_align: Clutter.ActorAlign.CENTER,
    });
    const arrow = new St.Icon({
        icon_name: arrowIcon,
        icon_size: 14,
        style_class: `network-speed-panel-arrow ${colorClass}`,
        x_expand: false,
        y_align: Clutter.ActorAlign.CENTER,
    });
    group.add_child(arrow);
    const value = new St.Label({
        text: '0',
        style_class: 'network-speed-panel-value',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    group.add_child(value);
    parent.add_child(group);
    return value;
}

export const NetworkSpeedIndicator = GObject.registerClass(
class NetworkSpeedIndicator extends Button {
    _init(settings) {
        super._init(0, NETWORK_INDICATOR_NAME, false);
        this._settings = settings;
        this._rate = null;
        this._applicationRates = [];
        this._applicationError = null;
        this._applicationReady = false;

        const box = new St.BoxLayout({
            style_class: 'network-speed-indicator',
            orientation: Clutter.Orientation.HORIZONTAL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._downloadLabel = addPanelRate(
            box, 'go-down-symbolic', 'network-speed-download');
        this._uploadLabel = addPanelRate(
            box, 'go-up-symbolic', 'network-speed-upload');
        this.add_child(box);
        this._buildApplicationMenu();

        settings.connectObject(
            `changed::${SETTINGS_KEYS.networkSpeedUnit}`,
            () => this._render(), this);
        this._monitor = new NetworkMonitor(
            rate => {
                this._rate = rate;
                this._render();
            },
            error => console.error(`Network speed monitor failed: ${error.message}`));
        this._monitor.start();

        this._applicationMonitor = new ApplicationNetworkMonitor(
            rates => {
                this._applicationRates = rates;
                this._applicationError = null;
                this._applicationReady = true;
                this._renderApplications();
            },
            error => {
                this._applicationError = error.message;
                this._applicationReady = true;
                this._renderApplications();
                console.error(`Application network monitor failed: ${error.message}`);
            });
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._applicationRates = [];
                this._applicationError = null;
                this._applicationReady = false;
                this._renderApplications();
                this._applicationMonitor?.start();
            } else {
                this._applicationMonitor?.stop();
            }
        });
    }

    _buildApplicationMenu() {
        const header = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'network-speed-app-header',
        });
        for (const [text, styleClass] of [
            [_('Application'), 'network-speed-app-name'],
            [_('Download'), 'network-speed-app-value'],
            [_('Upload'), 'network-speed-app-value'],
        ]) {
            header.add_child(new St.Label({text, style_class: styleClass}));
        }
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._applicationRows = [];
        for (let index = 0; index < MAX_APPLICATION_ROWS; index++) {
            const item = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
                can_focus: false,
                style_class: 'network-speed-app-row',
            });
            const name = new St.Label({style_class: 'network-speed-app-name'});
            const download = new St.Label({style_class: 'network-speed-app-value'});
            const upload = new St.Label({style_class: 'network-speed-app-value'});
            item.add_child(name);
            item.add_child(download);
            item.add_child(upload);
            this.menu.addMenuItem(item);
            this._applicationRows.push({item, name, download, upload});
        }

        this._applicationEmpty = new PopupMenu.PopupMenuItem(
            _('Collecting application network rates…'), {
                reactive: false,
                can_focus: false,
                style_class: 'network-speed-app-empty',
            });
        this.menu.addMenuItem(this._applicationEmpty);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            _('Current user TCP connections only'), {
                reactive: false,
                can_focus: false,
                style_class: 'network-speed-app-note',
            }));
        this._renderApplications();
    }

    _render() {
        const rate = this._rate || {download: 0, upload: 0};
        const unit = this._settings.get_string(SETTINGS_KEYS.networkSpeedUnit);
        this._downloadLabel.text = rate.download > 0
            ? formatRate(rate.download, unit) : '0';
        this._uploadLabel.text = rate.upload > 0
            ? formatRate(rate.upload, unit) : '0';
        this._renderApplications();
    }

    _renderApplications() {
        if (!this._applicationRows)
            return;
        const unit = this._settings.get_string(SETTINGS_KEYS.networkSpeedUnit);
        const visibleRates = this._applicationRates
            .filter(rate =>
                !isDisplayedRateZero(rate.download, unit) ||
                !isDisplayedRateZero(rate.upload, unit))
            .slice(0, MAX_APPLICATION_ROWS);
        for (const [index, row] of this._applicationRows.entries()) {
            const rate = visibleRates[index];
            row.item.visible = Boolean(rate);
            if (!rate)
                continue;
            row.name.text = rate.name;
            row.download.text = formatRate(rate.download, unit);
            row.upload.text = formatRate(rate.upload, unit);
        }
        this._applicationEmpty.visible = visibleRates.length === 0;
        this._applicationEmpty.label.text = this._applicationError
            ? _('Unable to read application network rates')
            : this._applicationReady
                ? _('No active application TCP connections')
                : _('Collecting application network rates…');
    }

    stop() {
        this._applicationMonitor?.stop();
        this._applicationMonitor = null;
        this._monitor?.stop();
        this._monitor = null;
        this._settings.disconnectObject(this);
    }
});
