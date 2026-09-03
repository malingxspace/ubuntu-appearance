import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
    cleanOldImages,
    getDownloadHistory,
} from '../src/bing/imageStore.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

const directory = GLib.dir_make_tmp('ubuntu-appearance-bing-test-XXXXXX');
const favoritePath = GLib.build_filenamev([
    directory, '20000101-favorite_UHD.jpg',
]);
const ordinaryPath = GLib.build_filenamev([
    directory, '20000101-ordinary_UHD.jpg',
]);
GLib.file_set_contents(favoritePath, new TextEncoder().encode('favorite'));
GLib.file_set_contents(ordinaryPath, new TextEncoder().encode('ordinary'));

const settings = new Gio.Settings({
    schema_id: 'org.gnome.shell.extensions.ubuntu-appearance',
});
settings.set_string('image-directory', directory);
settings.set_boolean('bing-delete-old', true);
settings.set_int('bing-retention-days', 1);
settings.set_strv('bing-favorite-images', ['favorite']);
settings.set_string('bing-download-history', JSON.stringify([
    {
        id: 'favorite',
        startdate: '20000101',
        fullstartdate: '200001010000',
        resolution: 'UHD',
        filename: favoritePath,
    },
    {
        id: 'ordinary',
        startdate: '20000101',
        fullstartdate: '200001010000',
        resolution: 'UHD',
        filename: ordinaryPath,
    },
]));

cleanOldImages(settings);
assert(Gio.File.new_for_path(favoritePath).query_exists(null),
    'Favorite image was deleted');
assert(!Gio.File.new_for_path(ordinaryPath).query_exists(null),
    'Expired ordinary image was retained');
assert(getDownloadHistory(settings).length === 1,
    'Cleanup history is incorrect');

Gio.File.new_for_path(favoritePath).delete(null);
Gio.File.new_for_path(directory).delete(null);
