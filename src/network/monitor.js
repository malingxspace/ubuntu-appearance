import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {parseDefaultInterfaces, parseNetworkTotals} from './procNetParser.js';

const SAMPLE_INTERVAL_MS = 1000;
const MAX_SAMPLE_GAP_SECONDS = 5;
const PROC_FILES = Object.freeze({
    counters: Gio.File.new_for_path('/proc/net/dev'),
    ipv4Routes: Gio.File.new_for_path('/proc/net/route'),
    ipv6Routes: Gio.File.new_for_path('/proc/net/ipv6_route'),
});

function loadText(file, cancellable) {
    return new Promise((resolve, reject) => {
        file.load_contents_async(cancellable, (source, result) => {
            try {
                const [, contents] = source.load_contents_finish(result);
                resolve(new TextDecoder().decode(contents));
            } catch (error) {
                reject(error);
            }
        });
    });
}

export class NetworkMonitor {
    constructor(onUpdate, onError) {
        this._onUpdate = onUpdate;
        this._onError = onError;
        this._previous = null;
        this._sourceId = null;
        this._cancellable = null;
        this._refreshing = false;
        this._lastError = null;
    }

    start() {
        if (this._sourceId)
            return;
        this._refresh();
        this._sourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, SAMPLE_INTERVAL_MS, () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    stop() {
        if (this._sourceId) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
        this._cancellable?.cancel();
        this._cancellable = null;
        this._previous = null;
    }

    async _refresh() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const [counters, ipv4Routes, ipv6Routes] = await Promise.all([
                loadText(PROC_FILES.counters, cancellable),
                loadText(PROC_FILES.ipv4Routes, cancellable),
                loadText(PROC_FILES.ipv6Routes, cancellable),
            ]);
            if (cancellable.is_cancelled())
                return;
            const interfaces = parseDefaultInterfaces(ipv4Routes, ipv6Routes);
            if (interfaces.length === 0) {
                this._previous = null;
                this._onUpdate(null);
                return;
            }
            this._updateRate({
                ...parseNetworkTotals(counters, interfaces),
                interfaces: interfaces.join('\n'),
                time: GLib.get_monotonic_time() / 1_000_000,
            });
            this._lastError = null;
        } catch (error) {
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                this._previous = null;
                this._onUpdate(null);
                if (error.message !== this._lastError) {
                    this._lastError = error.message;
                    this._onError(error);
                }
            }
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
            this._refreshing = false;
        }
    }

    _updateRate(sample) {
        const previous = this._previous;
        this._previous = sample;
        if (!previous || previous.interfaces !== sample.interfaces) {
            this._onUpdate({download: 0, upload: 0});
            return;
        }
        const elapsed = sample.time - previous.time;
        const downloaded = sample.download - previous.download;
        const uploaded = sample.upload - previous.upload;
        if (elapsed <= 0 || elapsed > MAX_SAMPLE_GAP_SECONDS ||
            downloaded < 0 || uploaded < 0) {
            this._onUpdate({download: 0, upload: 0});
            return;
        }
        this._onUpdate({
            download: downloaded / elapsed,
            upload: uploaded / elapsed,
        });
    }
}
