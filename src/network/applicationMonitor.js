import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
    calculateApplicationRates,
    parseApplicationSocketTotals,
} from './applicationRate.js';

const SAMPLE_INTERVAL_MS = 1000;
const SS_PATH = '/usr/bin/ss';

export class ApplicationNetworkMonitor {
    constructor(onUpdate, onError) {
        this._onUpdate = onUpdate;
        this._onError = onError;
        this._previous = null;
        this._previousTime = null;
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
        this._previousTime = null;
    }

    async _refresh() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const process = Gio.Subprocess.new(
                [SS_PATH, '-tinpH'],
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE);
            const [, stdout, stderr] = await new Promise((resolve, reject) => {
                process.communicate_utf8_async(
                    null, cancellable, (subprocess, result) => {
                        try {
                            resolve(subprocess.communicate_utf8_finish(result));
                        } catch (error) {
                            reject(error);
                        }
                    });
            });
            if (!process.get_successful())
                throw new Error((stderr || '').trim() || `ss exited with ${process.get_exit_status()}`);

            const current = parseApplicationSocketTotals(stdout || '');
            const now = GLib.get_monotonic_time() / 1_000_000;
            const previous = this._previous;
            const previousTime = this._previousTime;
            this._previous = current;
            this._previousTime = now;
            this._lastError = null;
            if (previous) {
                this._onUpdate(calculateApplicationRates(
                    previous, current, now - previousTime));
            }
        } catch (error) {
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) &&
                error.message !== this._lastError) {
                this._lastError = error.message;
                this._onError(error);
            }
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
            this._refreshing = false;
        }
    }
}
