import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {SETTINGS_KEYS} from '../config/constants.js';

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

function expandPath(path) {
    const home = GLib.get_home_dir();
    return path.replace(/^\$HOME(?=\/|$)/, home).replace(/^~(?=\/|$)/, home);
}

function picturesDirectory() {
    return GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) ||
        GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) ||
        GLib.get_home_dir();
}

export function validateImage(path) {
    if (!IMAGE_EXTENSION.test(path))
        return '只支持 JPG、PNG 和 WEBP 图片。';
    try {
        const info = Gio.File.new_for_path(path).query_info(
            'standard::type,standard::size', Gio.FileQueryInfoFlags.NONE, null);
        if (info.get_file_type() !== Gio.FileType.REGULAR)
            return '选择的路径不是普通文件。';
        if (info.get_size() > MAX_IMAGE_SIZE)
            return '图片超过 100 MiB，无法应用。';
    } catch (error) {
        return `无法读取图片：${error.message}`;
    }
    return null;
}

export function getImageDirectory(settings) {
    let configured = settings.get_string(SETTINGS_KEYS.imageDirectory).trim();
    if (configured)
        configured = expandPath(configured);
    else {
        const pictures = picturesDirectory();
        const bingDirectory = GLib.build_filenamev([pictures, 'BingWallpaper']);
        configured = bingDirectory;
    }
    return configured.endsWith('/') ? configured : configured + '/';
}

export function getBingDownloadDirectory(settings) {
    const path = getImageDirectory(settings);
    const directory = Gio.File.new_for_path(path);
    if (!directory.query_exists(null))
        directory.make_directory_with_parents(null);
    return path;
}

export function getImages(settings) {
    const directory = Gio.File.new_for_path(getImageDirectory(settings));
    if (!directory.query_exists(null))
        return [];

    const images = [];
    let enumerator;
    try {
        enumerator = directory.enumerate_children(
            'standard::name,standard::type,time::modified',
            Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null))) {
            const name = info.get_name();
            if (info.get_file_type() !== Gio.FileType.REGULAR ||
                !IMAGE_EXTENSION.test(name))
                continue;
            images.push({
                name,
                path: directory.get_child(name).get_path(),
                modified: info.get_attribute_uint64('time::modified'),
            });
        }
    } catch (error) {
        throw new Error(`无法读取图片目录：${error.message}`);
    } finally {
        enumerator?.close(null);
    }
    images.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
    return images;
}
