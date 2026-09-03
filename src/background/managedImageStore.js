import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {validateImage} from './imageCatalog.js';

const MANAGED_DIRECTORY_NAME = 'ubuntu-appearance/backgrounds';
const VALID_ROLES = new Set(['desktop', 'login', 'plymouth']);

function managedDirectory() {
    return Gio.File.new_for_path(GLib.build_filenamev([
        GLib.get_user_data_dir(),
        MANAGED_DIRECTORY_NAME,
    ]));
}

function copyFile(source, target) {
    return new Promise((resolve, reject) => {
        source.copy_async(
            target,
            Gio.FileCopyFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            null,
            (_source, result) => {
                try {
                    source.copy_finish(result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
    });
}

export function isManagedImage(path) {
    if (!path)
        return false;
    const file = Gio.File.new_for_path(path);
    return file.get_parent()?.equal(managedDirectory()) ?? false;
}

export async function storeManagedImage(path, role) {
    if (!VALID_ROLES.has(role))
        throw new Error(`Unsupported managed image role: ${role}`);
    const validationError = validateImage(path);
    if (validationError)
        throw new Error(validationError);

    const directory = managedDirectory();
    if (!directory.query_exists(null))
        directory.make_directory_with_parents(null);
    const extension = path.match(/\.(jpe?g|png|webp)$/i)?.[0].toLowerCase();
    const target = directory.get_child(
        `${role}-${GLib.uuid_string_random()}${extension}`);
    await copyFile(Gio.File.new_for_path(path), target);
    return target.get_path();
}

export function deleteManagedImage(path, role = null) {
    if (!isManagedImage(path))
        return;
    const file = Gio.File.new_for_path(path);
    if (role && !file.get_basename().startsWith(`${role}-`))
        return;
    try {
        if (file.query_exists(null))
            file.delete(null);
    } catch (error) {
        console.warn(`Cannot delete managed background image: ${error.message}`);
    }
}
