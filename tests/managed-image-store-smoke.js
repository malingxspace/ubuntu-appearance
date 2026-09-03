import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const dataDirectory = GLib.dir_make_tmp('ubuntu-appearance-data-XXXXXX');
const sourceDirectory = GLib.dir_make_tmp('ubuntu-appearance-source-XXXXXX');
GLib.setenv('XDG_DATA_HOME', dataDirectory, true);

const {isManagedImage, storeManagedImage} = await import(
    '../src/background/managedImageStore.js');
const source = Gio.File.new_for_path(GLib.build_filenamev([
    sourceDirectory,
    'source.jpg',
]));
source.replace_contents(
    new TextEncoder().encode('test image data'),
    null,
    false,
    Gio.FileCreateFlags.NONE,
    null);

const managedPath = await storeManagedImage(source.get_path(), 'desktop');
const managed = Gio.File.new_for_path(managedPath);
if (!isManagedImage(managedPath) || !managed.query_exists(null))
    throw new Error('Managed image was not created');

source.delete(null);
if (!managed.query_exists(null))
    throw new Error('Managed image depends on the downloaded source');

managed.delete(null);
const backgroundsDirectory = managed.get_parent();
const extensionDirectory = backgroundsDirectory.get_parent();
backgroundsDirectory.delete(null);
extensionDirectory.delete(null);
Gio.File.new_for_path(dataDirectory).delete(null);
Gio.File.new_for_path(sourceDirectory).delete(null);
