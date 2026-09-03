import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {gettext as _} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    getDownloadHistory,
    getFavoriteImageIds,
    setImageFavorite,
} from '../bing/imageStore.js';
import {SETTINGS_KEYS} from '../config/constants.js';

function displayDate(value) {
    const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value);
}

function displayName(record) {
    if (record.copyright)
        return record.copyright.replace(/\s*\([^)]*\)\s*$/, '');
    return record.filename
        ? Gio.File.new_for_path(record.filename).get_basename()
        : record.id;
}

function createPreview(record) {
    if (!record.filename)
        return new Gtk.Image({
            icon_name: 'image-missing-symbolic',
            pixel_size: 32,
        });
    const file = Gio.File.new_for_path(record.filename);
    if (!file.query_exists(null)) {
        return new Gtk.Image({
            icon_name: 'image-missing-symbolic',
            pixel_size: 32,
        });
    }
    const picture = Gtk.Picture.new_for_filename(record.filename);
    picture.set_size_request(128, 72);
    picture.set_content_fit(Gtk.ContentFit.COVER);
    picture.set_halign(Gtk.Align.CENTER);
    picture.set_valign(Gtk.Align.CENTER);
    picture.set_hexpand(false);
    picture.set_vexpand(false);
    return picture;
}

function createApplyMenu(record, actions, sensitive) {
    const menuButton = new Gtk.MenuButton({
        label: _('Set as…'),
        valign: Gtk.Align.CENTER,
        sensitive,
    });
    const menuBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
    });
    const popover = new Gtk.Popover({child: menuBox});
    menuButton.set_popover(popover);

    for (const [label, action] of [
        [_('Set desktop'), actions.setDesktop],
        [_('Set login'), actions.setLogin],
        [_('Set boot and shutdown'), actions.setPlymouth],
    ]) {
        const button = new Gtk.Button({label});
        button.connect('clicked', async () => {
            popover.popdown();
            menuButton.set_sensitive(false);
            try {
                await action(record.filename, displayName(record));
            } catch (error) {
                console.error(`Cannot apply Bing image: ${error.message}`);
            } finally {
                menuButton.set_sensitive(sensitive);
            }
        });
        menuBox.append(button);
    }
    return menuButton;
}

export function createBingHistoryGroup(settings, connectSetting, actions) {
    const group = new Adw.PreferencesGroup({title: _('Downloaded images')});
    let rows = [];

    const rebuild = () => {
        for (const row of rows)
            group.remove(row);
        rows = [];

        const history = getDownloadHistory(settings);
        const favorites = new Set(getFavoriteImageIds(settings));
        if (history.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: _('No images downloaded yet.'),
            });
            group.add(emptyRow);
            rows.push(emptyRow);
            return;
        }

        for (const record of history) {
            const favorite = favorites.has(record.id);
            const fileExists = Boolean(record.filename) &&
                Gio.File.new_for_path(record.filename).query_exists(null);
            const row = new Adw.ActionRow({
                title: displayName(record),
                subtitle: fileExists
                    ? `${displayDate(record.startdate)} · ${record.resolution}`
                    : `${displayDate(record.startdate)} · ${record.resolution} · ${_('File missing')}`,
                title_lines: 2,
                subtitle_lines: 1,
            });
            row.set_tooltip_text(
                `${displayName(record)}\n${record.filename ?? _('File path unavailable')}`);
            row.add_prefix(createPreview(record));
            row.add_suffix(createApplyMenu(record, actions, fileExists));
            const favoriteButton = new Gtk.ToggleButton({
                active: favorite,
                icon_name: favorite
                    ? 'starred-symbolic'
                    : 'non-starred-symbolic',
                valign: Gtk.Align.CENTER,
            });
            favoriteButton.set_tooltip_text(favoriteButton.get_active()
                ? _('Remove from favorites')
                : _('Add to favorites'));
            favoriteButton.connect('toggled', button => {
                const favorite = button.get_active();
                setImageFavorite(settings, record.id, favorite);
            });
            row.add_suffix(favoriteButton);
            group.add(row);
            rows.push(row);
        }
    };

    connectSetting(`changed::${SETTINGS_KEYS.bingDownloadHistory}`, rebuild);
    connectSetting(`changed::${SETTINGS_KEYS.bingFavoriteImages}`, rebuild);
    connectSetting(`changed::${SETTINGS_KEYS.selectedImage}`, rebuild);
    rebuild();
    return group;
}
