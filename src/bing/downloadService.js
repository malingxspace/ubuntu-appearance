import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {SETTINGS_KEYS} from '../config/constants.js';
import {downloadImage, fetchDailyImages} from './api.js';
import {
    FALLBACK_CHECK_SECONDS,
    RETRY_SECONDS,
    UPDATE_GRACE_SECONDS,
} from './config.js';
import {
    chooseResolution,
    cleanOldImages,
    fileHasContent,
    imageTarget,
    imageUrl,
    recordDownload,
    writeImage,
} from './imageStore.js';

function secondsUntilNextImage(fullStartDate) {
    const match = String(fullStartDate).match(
        /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (!match)
        return FALLBACK_CHECK_SECONDS;
    const published = GLib.DateTime.new_utc(
        Number(match[1]), Number(match[2]), Number(match[3]),
        Number(match[4]), Number(match[5]), 0);
    const due = published.add_days(1).add_seconds(UPDATE_GRACE_SECONDS);
    const seconds = Math.floor(due.difference(
        GLib.DateTime.new_now_utc()) / 1_000_000);
    return Math.min(FALLBACK_CHECK_SECONDS, Math.max(5 * 60, seconds));
}

export class BingDownloadService {
    constructor(settings, getDisplaySize) {
        this._settings = settings;
        this._getDisplaySize = getDisplaySize;
        this._session = new Soup.Session();
        this._session.user_agent = 'Ubuntu Appearance Bing Downloader/48';
        this._timerId = null;
        this._refreshing = false;
        this._cancellable = null;
        this._connectionIds = [];
        this._generation = 0;
        this._pendingManualRequest = null;
        this._stopped = true;
    }

    start() {
        this._stopped = false;
        this._connectionIds.push(this._settings.connect(
            `changed::${SETTINGS_KEYS.bingDownloadEnabled}`,
            () => this._syncEnabled()));
        this._connectionIds.push(this._settings.connect(
            `changed::${SETTINGS_KEYS.bingDownloadRequest}`,
            () => this._requestManualDownload()));
        for (const key of [
            SETTINGS_KEYS.bingMarket,
            SETTINGS_KEYS.bingResolution,
            SETTINGS_KEYS.imageDirectory,
        ]) {
            this._connectionIds.push(this._settings.connect(
                `changed::${key}`, () => this._restartSoon()));
        }
        for (const key of [
            SETTINGS_KEYS.bingDeleteOld,
            SETTINGS_KEYS.bingRetentionDays,
        ]) {
            this._connectionIds.push(this._settings.connect(
                `changed::${key}`, () => cleanOldImages(this._settings)));
        }
        this._syncEnabled();
        this._requestManualDownload();
    }

    stop() {
        this._stopped = true;
        this._clearTimer();
        this._cancellable?.cancel();
        this._cancellable = null;
        for (const id of this._connectionIds)
            this._settings.disconnect(id);
        this._connectionIds = [];
    }

    _syncEnabled() {
        if (!this._settings.get_boolean(SETTINGS_KEYS.bingDownloadEnabled)) {
            this._generation++;
            this._clearTimer();
            this._cancellable?.cancel();
            return;
        }
        this._restartSoon();
    }

    _restartSoon() {
        if (this._pendingManualRequest) {
            this._generation++;
            this._cancellable?.cancel();
            if (!this._refreshing) {
                const {imageCount, serial} = this._pendingManualRequest;
                this._schedule(1, imageCount, true, serial);
            }
            return;
        }
        if (!this._settings.get_boolean(SETTINGS_KEYS.bingDownloadEnabled))
            return;
        this._cancellable?.cancel();
        this._schedule(2);
    }

    _requestManualDownload() {
        const serial = this._settings.get_uint(
            SETTINGS_KEYS.bingDownloadRequest);
        if (serial === this._settings.get_uint(
            SETTINGS_KEYS.bingProcessedDownloadRequest))
            return;
        this._pendingManualRequest = {
            serial,
            imageCount: this._settings.get_int(
                SETTINGS_KEYS.bingManualDownloadDays),
        };
        this._generation++;
        this._cancellable?.cancel();
        if (this._refreshing)
            return;
        this._schedule(
            1, this._pendingManualRequest.imageCount, true, serial);
    }

    _clearTimer() {
        if (!this._timerId)
            return;
        GLib.Source.remove(this._timerId);
        this._timerId = null;
    }

    _schedule(seconds, imageCount = 1, manual = false, requestSerial = 0) {
        this._clearTimer();
        const generation = ++this._generation;
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, seconds, () => {
                this._timerId = null;
                this._refresh(
                    imageCount, manual, generation, requestSerial);
                return GLib.SOURCE_REMOVE;
            });
    }

    async _refresh(imageCount, manual, generation, requestSerial) {
        if (this._refreshing ||
            (!manual &&
                !this._settings.get_boolean(SETTINGS_KEYS.bingDownloadEnabled)))
            return;

        this._refreshing = true;
        this._settings.set_string(
            SETTINGS_KEYS.bingDownloadState, 'downloading');
        this._settings.set_string(SETTINGS_KEYS.bingDownloadError, '');
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const images = await fetchDailyImages(
                this._session,
                this._settings.get_string(SETTINGS_KEYS.bingMarket),
                imageCount,
                cancellable);
            let downloaded = 0;
            for (const image of images) {
                const resolution = chooseResolution(
                    this._settings, this._getDisplaySize());
                const target = imageTarget(this._settings, image, resolution);
                if (!fileHasContent(target)) {
                    const bytes = await downloadImage(
                        this._session, imageUrl(image, resolution), cancellable);
                    await writeImage(target, bytes, cancellable);
                    downloaded++;
                }
                recordDownload(
                    this._settings, image, resolution, target.get_path());
            }
            cleanOldImages(this._settings);
            this._settings.set_int(
                SETTINGS_KEYS.bingLastDownloadCount, downloaded);
            this._settings.set_string(
                SETTINGS_KEYS.bingDownloadState, 'success');
            if (manual) {
                this._settings.set_uint(
                    SETTINGS_KEYS.bingProcessedDownloadRequest,
                    requestSerial);
                if (this._pendingManualRequest?.serial === requestSerial)
                    this._pendingManualRequest = null;
            }
            if (generation === this._generation &&
                this._settings.get_boolean(SETTINGS_KEYS.bingDownloadEnabled)) {
                this._schedule(secondsUntilNextImage(images[0].fullstartdate));
            }
        } catch (error) {
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(`Bing download failed: ${error.message}`);
                this._settings.set_string(
                    SETTINGS_KEYS.bingDownloadError, error.message);
                this._settings.set_string(
                    SETTINGS_KEYS.bingDownloadState, 'error');
                if (generation === this._generation)
                    this._schedule(
                        RETRY_SECONDS, imageCount, manual, requestSerial);
            }
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
            this._refreshing = false;
            if (!this._stopped && this._pendingManualRequest &&
                !this._timerId) {
                const {imageCount: pendingCount, serial} =
                    this._pendingManualRequest;
                this._schedule(1, pendingCount, true, serial);
            }
        }
    }
}
