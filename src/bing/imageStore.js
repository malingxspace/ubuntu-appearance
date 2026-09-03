import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {getBingDownloadDirectory} from '../background/imageCatalog.js';
import {SETTINGS_KEYS} from '../config/constants.js';
import {BING_ORIGIN, RESOLUTIONS} from './config.js';
import {chooseAutoResolution, imageId, mergeDownloadHistory} from './logic.js';

const OWNED_IMAGE_PATTERN = /^\d{8}-.+_(?:UHD|\d+x\d+)\.jpg$/;

export function getDownloadHistory(settings) {
    try {
        const history = JSON.parse(settings.get_string(
            SETTINGS_KEYS.bingDownloadHistory));
        return Array.isArray(history)
            ? history.filter(item => item?.id && item?.startdate)
            : [];
    } catch (error) {
        console.warn(`Invalid Bing download history: ${error.message}`);
        return [];
    }
}

export function getFavoriteImageIds(settings) {
    return settings.get_strv(SETTINGS_KEYS.bingFavoriteImages);
}

export function setImageFavorite(settings, id, favorite) {
    const favorites = new Set(getFavoriteImageIds(settings));
    if (favorite)
        favorites.add(id);
    else
        favorites.delete(id);
    settings.set_strv(
        SETTINGS_KEYS.bingFavoriteImages, [...favorites].sort());
}

export function recordDownload(settings, image, resolution, filename) {
    const history = mergeDownloadHistory(getDownloadHistory(settings), {
        id: imageId(image),
        startdate: image.startdate,
        fullstartdate: image.fullstartdate,
        copyright: image.copyright ?? '',
        resolution,
        filename,
    });
    settings.set_string(
        SETTINGS_KEYS.bingDownloadHistory, JSON.stringify(history));
}

export function chooseResolution(settings, displaySize) {
    const configured = settings.get_string(SETTINGS_KEYS.bingResolution);
    if (configured !== 'auto' && RESOLUTIONS.includes(configured))
        return configured;
    return chooseAutoResolution(displaySize.width, displaySize.height);
}

export function imageTarget(settings, image, resolution) {
    const filename = `${image.startdate}-${imageId(image)}_${resolution}.jpg`;
    return Gio.File.new_for_path(GLib.build_filenamev([
        getBingDownloadDirectory(settings), filename,
    ]));
}

export function imageUrl(image, resolution) {
    return `${BING_ORIGIN}${image.urlbase}_${resolution}.jpg&qlt=100`;
}

export function fileHasContent(file) {
    try {
        const info = file.query_info(
            'standard::type,standard::size', Gio.FileQueryInfoFlags.NONE, null);
        return info.get_file_type() === Gio.FileType.REGULAR &&
            info.get_size() > 0;
    } catch (error) {
        return false;
    }
}

export function writeImage(file, bytes, cancellable) {
    return new Promise((resolve, reject) => {
        file.replace_contents_bytes_async(
            bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION,
            cancellable, (_file, result) => {
                try {
                    file.replace_contents_finish(result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
    });
}

function recordTimestamp(record) {
    const match = String(record.startdate).match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match)
        return null;
    return GLib.DateTime.new_utc(
        Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0)
        .to_unix();
}

export function cleanOldImages(settings) {
    if (!settings.get_boolean(SETTINGS_KEYS.bingDeleteOld))
        return;

    const directory = Gio.File.new_for_path(getBingDownloadDirectory(settings));
    const favorites = new Set(getFavoriteImageIds(settings));
    const cutoff = GLib.DateTime.new_now_utc().add_days(
        -settings.get_int(SETTINGS_KEYS.bingRetentionDays)).to_unix();
    const kept = [];
    for (const record of getDownloadHistory(settings)) {
        if (favorites.has(record.id)) {
            kept.push(record);
            continue;
        }
        const timestamp = recordTimestamp(record);
        if (timestamp === null || timestamp >= cutoff) {
            kept.push(record);
            continue;
        }

        const file = typeof record.filename === 'string' && record.filename
            ? Gio.File.new_for_path(record.filename)
            : null;
        const owned = file?.get_parent()?.equal(directory) &&
            OWNED_IMAGE_PATTERN.test(file.get_basename());
        if (!owned)
            continue;
        try {
            if (file.query_exists(null))
                file.delete(null);
        } catch (error) {
            console.warn(`Cannot delete old Bing image: ${error.message}`);
            kept.push(record);
        }
    }
    settings.set_string(
        SETTINGS_KEYS.bingDownloadHistory, JSON.stringify(kept));
}
