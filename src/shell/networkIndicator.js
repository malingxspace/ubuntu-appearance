import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {SETTINGS_KEYS} from '../config/constants.js';
import {NetworkMonitor} from '../network/monitor.js';
import {formatRate} from '../network/rateFormatter.js';

export const NETWORK_INDICATOR_NAME = 'NetworkSpeedIndicator';

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
        super._init(0, NETWORK_INDICATOR_NAME, true);
        this._settings = settings;
        this._rate = null;

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
    }

    _render() {
        const rate = this._rate || {download: 0, upload: 0};
        const unit = this._settings.get_string(SETTINGS_KEYS.networkSpeedUnit);
        this._downloadLabel.text = rate.download > 0
            ? formatRate(rate.download, unit) : '0';
        this._uploadLabel.text = rate.upload > 0
            ? formatRate(rate.upload, unit) : '0';
    }

    stop() {
        this._monitor?.stop();
        this._monitor = null;
        this._settings.disconnectObject(this);
    }
});
