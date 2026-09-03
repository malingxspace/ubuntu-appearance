import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

export const EXTENSION_SCHEMA = 'org.gnome.shell.extensions.login-background';
export const DESKTOP_SCHEMA = 'org.gnome.desktop.background';
const LOGIN_BACKGROUND_SCHEMA = 'com.ubuntu.login-screen';
const LOGIN_SCREEN_SCHEMA = 'org.gnome.login-screen';
const PKEXEC = '/usr/bin/pkexec';
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_PLYMOUTH_IMAGE_SIZE = 50 * 1024 * 1024;
const PLYMOUTH_MAX_WIDTH = 3840;
const PLYMOUTH_MAX_HEIGHT = 2160;
const MIN_DISPLAY_SIZE = 320;
const MAX_DISPLAY_SIZE = 16384;
const FIRMWARE_LOGO_PATH = '/sys/firmware/acpi/bgrt/image';
const FIRMWARE_BLACK_LEVEL = 16;
const INSTALLED_BACKGROUND_URI = 'file:///usr/share/backgrounds/login-background.jpg';
const PORTAL_BUS_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_OBJECT_PATH = '/org/freedesktop/portal/desktop';
const PORTAL_FILE_CHOOSER_INTERFACE = 'org.freedesktop.portal.FileChooser';
const PORTAL_REQUEST_INTERFACE = 'org.freedesktop.portal.Request';
const PRIVILEGED_SCRIPT = [
    'set -eu',
    'operation=$1',
    'plymouth_image=$3',
    'plymouth_enabled=$4',
    'hide_firmware_logo=$5',
    'firmware_logo=$6',
    'source_image=${2-}',
    'target_image=/usr/share/backgrounds/login-background.jpg',
    'config_file=/usr/share/gdm/dconf/90-login-background',
    'config_tmp=/usr/share/gdm/dconf/.90-login-background.tmp',
    'lock_file=/usr/share/gdm/dconf/locks/90-login-background',
    'lock_tmp=/usr/share/gdm/dconf/locks/.90-login-background.tmp',
    'plymouth_theme_dir=/usr/share/plymouth/themes/login-background',
    'plymouth_theme_file=$plymouth_theme_dir/login-background.plymouth',
    'plymouth_theme_tmp=$plymouth_theme_dir/.login-background.plymouth.tmp',
    'plymouth_state_dir=/var/lib/login-background',
    'plymouth_original_file=$plymouth_state_dir/plymouth-original-theme',
    'case "$hide_firmware_logo" in 0|1) ;; *) echo "厂商 Logo 开关参数无效" >&2; exit 2 ;; esac',
    'trap \'/usr/bin/rm -f -- "$config_tmp" "$lock_tmp" "$plymouth_theme_tmp"\' EXIT',
    'set_plymouth() {',
    '    [ -x /usr/sbin/update-initramfs ] || { echo "系统缺少 update-initramfs" >&2; exit 1; }',
    '    [ -d /usr/share/plymouth/themes/spinner ] || { echo "系统缺少 Plymouth spinner 主题" >&2; exit 1; }',
    '    [ -f "$plymouth_image" ] || { echo "Plymouth 背景图片不存在" >&2; exit 1; }',
    '    [ "$(/usr/bin/file -b --mime-type -- "$plymouth_image")" = image/png ] || { echo "Plymouth 背景必须是 PNG" >&2; exit 1; }',
    '    plymouth_size=$(/usr/bin/stat -Lc %s -- "$plymouth_image")',
    '    [ "$plymouth_size" -le 52428800 ] || { echo "Plymouth 背景超过 50 MiB" >&2; exit 1; }',
    '    /usr/bin/install -d -m 0755 "$plymouth_theme_dir" "$plymouth_state_dir"',
    '    if [ ! -f "$plymouth_original_file" ]; then',
    '        original_theme=$(/usr/bin/readlink -f /etc/alternatives/default.plymouth)',
    '        [ -f "$original_theme" ] || { echo "无法确定原 Plymouth 主题" >&2; exit 1; }',
    '        original_mode=$(/usr/bin/update-alternatives --query default.plymouth | /usr/bin/sed -n "s/^Status: //p")',
    '        case "$original_mode" in auto|manual) ;; *) echo "无法确定 Plymouth 主题模式" >&2; exit 1 ;; esac',
    '        /usr/bin/printf "%s\n%s\n" "$original_theme" "$original_mode" > "$plymouth_original_file"',
    '        /usr/bin/chmod 0644 "$plymouth_original_file"',
    '    fi',
    '    /usr/bin/cp -a /usr/share/plymouth/themes/spinner/. "$plymouth_theme_dir/"',
    '    if [ "$hide_firmware_logo" = 0 ] && [ -n "$firmware_logo" ]; then',
    '        [ -f "$firmware_logo" ] || { echo "厂商 Logo 图片不存在" >&2; exit 1; }',
    '        [ "$(/usr/bin/file -b --mime-type -- "$firmware_logo")" = image/png ] || { echo "厂商 Logo 必须是 PNG" >&2; exit 1; }',
    '        /usr/bin/install -m 0644 -- "$firmware_logo" "$plymouth_theme_dir/watermark.png"',
    '    else',
    '        /usr/bin/rm -f -- "$plymouth_theme_dir/watermark.png"',
    '    fi',
    '    /usr/bin/install -m 0644 -- "$plymouth_image" "$plymouth_theme_dir/background.png"',
    "    /usr/bin/printf '%s\n' \\",
    "        '[Plymouth Theme]' \\",
    "        'Name=Ubuntu Appearance' \\",
    "        'Description=Ubuntu boot wallpaper managed by Ubuntu Appearance' \\",
    "        'ModuleName=two-step' \\",
    "        '' \\",
    "        '[two-step]' \\",
    "        'Font=Ubuntu 12' \\",
    "        'TitleFont=Ubuntu Light 30' \\",
    "        'ImageDir=/usr/share/plymouth/themes/login-background' \\",
    "        'HorizontalAlignment=.5' \\",
    "        'VerticalAlignment=.7' \\",
    "        'WatermarkHorizontalAlignment=.5' \\",
    "        'WatermarkVerticalAlignment=.5' \\",
    "        'Transition=none' \\",
    "        'TransitionDuration=0.0' \\",
    "        'BackgroundStartColor=0x000000' \\",
    "        'BackgroundEndColor=0x000000' \\",
    "        'ProgressBarBackgroundColor=0x606060' \\",
    "        'ProgressBarForegroundColor=0xffffff' \\",
    "        'ScaleBackgroundImage=true' \\",
    "        'DialogClearsFirmwareBackground=true' \\",
    "        'MessageBelowAnimation=true' \\",
    "        '' \\",
    "        '[boot-up]' \\",
    "        'UseEndAnimation=false' \\",
    "        'UseFirmwareBackground=false' \\",
    "        '' \\",
    "        '[shutdown]' \\",
    "        'UseEndAnimation=false' \\",
    "        'UseFirmwareBackground=false' \\",
    "        '' \\",
    "        '[reboot]' \\",
    "        'UseEndAnimation=false' \\",
    "        'UseFirmwareBackground=false' > \"$plymouth_theme_tmp\"",
    '    /usr/bin/chmod 0644 "$plymouth_theme_tmp"',
    '    /usr/bin/mv -f -- "$plymouth_theme_tmp" "$plymouth_theme_file"',
    '    /usr/bin/update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth "$plymouth_theme_file" 200',
    '    /usr/bin/update-alternatives --set default.plymouth "$plymouth_theme_file"',
    '    /usr/sbin/update-initramfs -u',
    '}',
    'restore_plymouth() {',
    '    [ -f "$plymouth_original_file" ] || return 0',
    '    original_theme=$(/usr/bin/sed -n "1p" "$plymouth_original_file")',
    '    original_mode=$(/usr/bin/sed -n "2p" "$plymouth_original_file")',
    '    case "$original_theme" in /usr/share/plymouth/themes/*/*.plymouth) ;; *) echo "保存的 Plymouth 主题路径无效" >&2; exit 1 ;; esac',
    '    case "$original_mode" in auto|manual) ;; *) echo "保存的 Plymouth 主题模式无效" >&2; exit 1 ;; esac',
    '    [ -f "$original_theme" ] || { echo "原 Plymouth 主题不存在" >&2; exit 1; }',
    '    /usr/bin/update-alternatives --set default.plymouth "$original_theme"',
    '    /usr/bin/update-alternatives --remove default.plymouth "$plymouth_theme_file"',
    '    [ "$original_mode" = manual ] || /usr/bin/update-alternatives --auto default.plymouth',
    '    /usr/bin/rm -rf -- "$plymouth_theme_dir"',
    '    /usr/bin/rm -f -- "$plymouth_original_file"',
    '    /usr/bin/rmdir "$plymouth_state_dir" 2>/dev/null || true',
    '    /usr/sbin/update-initramfs -u',
    '}',
    'case "$operation" in',
    '    set)',
    '        [ -f "$source_image" ] || { echo "图片不存在或不是普通文件" >&2; exit 1; }',
    '        case "$source_image" in',
    '            *.[jJ][pP][gG]|*.[jJ][pP][eE][gG]|*.[pP][nN][gG]|*.[wW][eE][bB][pP]) ;;',
    '            *) echo "只支持 JPG、PNG 和 WEBP 图片" >&2; exit 1 ;;',
    '        esac',
    '        image_size=$(/usr/bin/stat -Lc %s -- "$source_image")',
    '        [ "$image_size" -le 104857600 ] || { echo "图片超过 100 MiB" >&2; exit 1; }',
    '        /usr/bin/install -m 0644 -- "$source_image" "$target_image"',
    "        /usr/bin/printf '%s\\n' \\",
    "            '[com/ubuntu/login-screen]' \\",
    "            \"background-picture-uri='file:///usr/share/backgrounds/login-background.jpg'\" \\",
    "            \"background-size='cover'\" \\",
    "            \"background-repeat='no-repeat'\" \\",
    "            '' \\",
    "            '[org/gnome/login-screen]' \\",
    "            \"logo=''\" \\",
    "            \"fallback-logo=''\" > \"$config_tmp\"",
    "        /usr/bin/printf '%s\\n' \\",
    "            '/com/ubuntu/login-screen/background-picture-uri' \\",
    "            '/com/ubuntu/login-screen/background-size' \\",
    "            '/com/ubuntu/login-screen/background-repeat' \\",
    "            '/org/gnome/login-screen/logo' \\",
    "            '/org/gnome/login-screen/fallback-logo' > \"$lock_tmp\"",
    '        /usr/bin/chmod 0644 "$config_tmp"',
    '        /usr/bin/chmod 0644 "$lock_tmp"',
    '        /usr/bin/mv -f -- "$config_tmp" "$config_file"',
    '        /usr/bin/mv -f -- "$lock_tmp" "$lock_file"',
    '        ;;',
    '    clear)',
    '        /usr/bin/rm -f -- "$config_file" "$lock_file"',
    '        ;;',
    '    *) echo "未知操作" >&2; exit 2 ;;',
    'esac',
    '/usr/share/gdm/generate-config',
    'case "$operation:$plymouth_enabled" in',
    '    set:1) set_plymouth ;;',
    '    set:0) : ;;',
    '    clear:*) restore_plymouth ;;',
    '    *) echo "Plymouth 开关参数无效" >&2; exit 2 ;;',
    'esac',
].join('\n');

function setSessionAppearance() {
    const background = new Gio.Settings({schema: LOGIN_BACKGROUND_SCHEMA});
    background.set_string('background-picture-uri', INSTALLED_BACKGROUND_URI);
    background.set_string('background-size', 'cover');
    background.set_string('background-repeat', 'no-repeat');

    const loginScreen = new Gio.Settings({schema: LOGIN_SCREEN_SCHEMA});
    loginScreen.set_string('logo', '');
    loginScreen.set_string('fallback-logo', '');
    Gio.Settings.sync();
}

function resetSessionAppearance() {
    const background = new Gio.Settings({schema: LOGIN_BACKGROUND_SCHEMA});
    background.reset('background-picture-uri');
    background.reset('background-size');
    background.reset('background-repeat');

    const loginScreen = new Gio.Settings({schema: LOGIN_SCREEN_SCHEMA});
    loginScreen.reset('logo');
    loginScreen.reset('fallback-logo');
    Gio.Settings.sync();
}

function exists(path) {
    return Gio.File.new_for_path(path).query_exists(null);
}

function imageValidationError(path) {
    if (!/\.(jpe?g|png|webp)$/i.test(path))
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

function expandPath(path) {
    const home = GLib.get_home_dir();
    return path.replace(/^\$HOME(?=\/|$)/, home)
        .replace(/^~(?=\/|$)/, home);
}

function picturesDirectory() {
    return GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) ||
        GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) ||
        GLib.get_home_dir();
}

export function getImageDirectory(settings) {
    let configured = settings.get_string('image-directory').trim();
    if (configured)
        configured = expandPath(configured);
    else {
        const pictures = picturesDirectory();
        const bingDirectory = GLib.build_filenamev([pictures, 'BingWallpaper']);
        configured = exists(bingDirectory) ? bingDirectory : pictures;
    }
    return configured.endsWith('/') ? configured : configured + '/';
}

function pathFromUri(uri) {
    if (!uri || !uri.startsWith('file://'))
        return null;
    try {
        const path = Gio.File.new_for_uri(uri).get_path();
        return path && exists(path) ? path : null;
    } catch (error) {
        return null;
    }
}

export function getDesktopImage() {
    try {
        const settings = new Gio.Settings({schema: DESKTOP_SCHEMA});
        const dark = settings.settings_schema.has_key('picture-uri-dark')
            ? pathFromUri(settings.get_string('picture-uri-dark'))
            : null;
        return dark || pathFromUri(settings.get_string('picture-uri'));
    } catch (error) {
        return null;
    }
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
            Gio.FileQueryInfoFlags.NONE,
            null);
        let info;
        while ((info = enumerator.next_file(null))) {
            const name = info.get_name();
            if (info.get_file_type() !== Gio.FileType.REGULAR ||
                !/\.(jpe?g|png|webp)$/i.test(name))
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

export function chooseImage(callback) {
    const connection = Gio.DBus.session;
    const token = `login_background_${GLib.uuid_string_random().replaceAll('-', '_')}`;
    const sender = connection.get_unique_name().slice(1).replaceAll('.', '_');
    let requestPath = `/org/freedesktop/portal/desktop/request/${sender}/${token}`;
    let finished = false;

    const finish = (path, error = null) => {
        if (finished)
            return;
        finished = true;
        connection.signal_unsubscribe(subscriptionId);
        callback(path, error);
    };

    const subscriptionId = connection.signal_subscribe(
        PORTAL_BUS_NAME,
        PORTAL_REQUEST_INTERFACE,
        'Response',
        null,
        null,
        Gio.DBusSignalFlags.NONE,
        (_connection, _sender, objectPath, _interface, _signal, parameters) => {
            if (objectPath !== requestPath)
                return;

            const [response, results] = parameters.deepUnpack();
            if (response !== 0) {
                finish(null, response === 1 ? null : '文件选择器返回了错误。');
                return;
            }

            const uris = results.uris?.deepUnpack?.() ?? results.uris ?? [];
            const uri = uris[0];
            const path = uri ? Gio.File.new_for_uri(uri).get_path() : null;
            if (!path) {
                finish(null, '没有取得所选图片的本地路径。');
                return;
            }

            const validationError = imageValidationError(path);
            finish(validationError ? null : path, validationError);
        });

    const options = {
        handle_token: new GLib.Variant('s', token),
        modal: new GLib.Variant('b', true),
        multiple: new GLib.Variant('b', false),
    };
    connection.call(
        PORTAL_BUS_NAME,
        PORTAL_OBJECT_PATH,
        PORTAL_FILE_CHOOSER_INTERFACE,
        'OpenFile',
        new GLib.Variant('(ssa{sv})', ['', '选择 GDM 背景图片', options]),
        new GLib.VariantType('(o)'),
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (_connection, result) => {
            try {
                [requestPath] = connection.call_finish(result).deepUnpack();
            } catch (error) {
                finish(null, `无法打开文件选择器：${error.message}`);
            }
        });
}

function getPrimaryDisplaySize() {
    const monitorsPath = GLib.build_filenamev([
        GLib.get_user_config_dir(), 'monitors.xml',
    ]);
    if (!GLib.file_test(monitorsPath, GLib.FileTest.IS_REGULAR))
        return null;

    try {
        const [, contents] = GLib.file_get_contents(monitorsPath);
        const xml = new TextDecoder().decode(contents);
        const logicalMonitors = xml.matchAll(
            /<logicalmonitor>([\s\S]*?)<\/logicalmonitor>/g);
        for (const [, logicalMonitor] of logicalMonitors) {
            if (!/<primary>\s*yes\s*<\/primary>/.test(logicalMonitor))
                continue;

            const mode = logicalMonitor.match(
                /<mode>[\s\S]*?<width>\s*(\d+)\s*<\/width>[\s\S]*?<height>\s*(\d+)\s*<\/height>/);
            if (!mode)
                continue;

            const width = Number.parseInt(mode[1], 10);
            const height = Number.parseInt(mode[2], 10);
            if (width >= MIN_DISPLAY_SIZE && width <= MAX_DISPLAY_SIZE &&
                height >= MIN_DISPLAY_SIZE && height <= MAX_DISPLAY_SIZE)
                return {width, height};
        }
    } catch (error) {
        console.warn(`无法读取主屏分辨率：${error.message}`);
    }
    return null;
}

function fitPlymouthSize(width, height) {
    const scale = Math.min(
        1,
        PLYMOUTH_MAX_WIDTH / width,
        PLYMOUTH_MAX_HEIGHT / height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function cropToAspectRatio(source, targetWidth, targetHeight) {
    const sourceWidth = source.get_width();
    const sourceHeight = source.get_height();
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = sourceWidth / sourceHeight;

    if (Math.abs(sourceRatio - targetRatio) < 0.0001)
        return source;

    if (sourceRatio > targetRatio) {
        const cropWidth = Math.max(1, Math.round(sourceHeight * targetRatio));
        const cropX = Math.floor((sourceWidth - cropWidth) / 2);
        return source.new_subpixbuf(cropX, 0, cropWidth, sourceHeight);
    }

    const cropHeight = Math.max(1, Math.round(sourceWidth / targetRatio));
    const cropY = Math.floor((sourceHeight - cropHeight) / 2);
    return source.new_subpixbuf(0, cropY, sourceWidth, cropHeight);
}

function getPlymouthCacheDirectory() {
    const cacheDirectory = GLib.build_filenamev([
        GLib.get_user_cache_dir(), 'login-background',
    ]);
    if (GLib.mkdir_with_parents(cacheDirectory, 0o700) !== 0)
        throw new Error('无法创建 Plymouth 临时图片目录。');
    return cacheDirectory;
}

function createPlymouthImage(path) {
    const source = GdkPixbuf.Pixbuf.new_from_file(path);
    const displaySize = getPrimaryDisplaySize();
    const targetSize = displaySize
        ? fitPlymouthSize(displaySize.width, displaySize.height)
        : fitPlymouthSize(source.get_width(), source.get_height());
    const cropped = cropToAspectRatio(
        source, targetSize.width, targetSize.height);
    const output = cropped.get_width() === targetSize.width &&
        cropped.get_height() === targetSize.height
        ? cropped
        : cropped.scale_simple(
            targetSize.width, targetSize.height, GdkPixbuf.InterpType.BILINEAR);
    if (!output)
        throw new Error('无法缩放 Plymouth 背景图片。');

    const outputPath = GLib.build_filenamev([
        getPlymouthCacheDirectory(),
        'plymouth-' + GLib.uuid_string_random() + '.png',
    ]);
    output.savev(outputPath, 'png', [], []);
    const size = Gio.File.new_for_path(outputPath).query_info(
        'standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();
    if (size > MAX_PLYMOUTH_IMAGE_SIZE) {
        Gio.File.new_for_path(outputPath).delete(null);
        throw new Error('转换后的 Plymouth 背景超过 50 MiB。');
    }
    return outputPath;
}

function removeBlackMatte(source) {
    const width = source.get_width();
    const height = source.get_height();
    const sourcePixels = source.get_pixels();
    const sourceChannels = source.get_n_channels();
    const sourceRowStride = source.get_rowstride();
    const outputPixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const sourceOffset = y * sourceRowStride + x * sourceChannels;
            const outputOffset = (y * width + x) * 4;
            const brightness = Math.max(
                sourcePixels[sourceOffset],
                sourcePixels[sourceOffset + 1],
                sourcePixels[sourceOffset + 2]);
            if (brightness <= FIRMWARE_BLACK_LEVEL) {
                outputPixels[outputOffset + 3] = 0;
                continue;
            }

            const matteAlpha = Math.round(
                255 * (brightness - FIRMWARE_BLACK_LEVEL) /
                (255 - FIRMWARE_BLACK_LEVEL));
            const sourceAlpha = sourceChannels === 4
                ? sourcePixels[sourceOffset + 3]
                : 255;
            outputPixels[outputOffset] = Math.min(255, Math.round(
                sourcePixels[sourceOffset] * 255 / brightness));
            outputPixels[outputOffset + 1] = Math.min(255, Math.round(
                sourcePixels[sourceOffset + 1] * 255 / brightness));
            outputPixels[outputOffset + 2] = Math.min(255, Math.round(
                sourcePixels[sourceOffset + 2] * 255 / brightness));
            outputPixels[outputOffset + 3] = Math.round(
                sourceAlpha * matteAlpha / 255);
        }
    }

    return GdkPixbuf.Pixbuf.new_from_bytes(
        GLib.Bytes.new(outputPixels),
        GdkPixbuf.Colorspace.RGB,
        true,
        8,
        width,
        height,
        width * 4);
}

function createFirmwareLogoImage() {
    if (!GLib.file_test(FIRMWARE_LOGO_PATH, GLib.FileTest.IS_REGULAR))
        return '';

    const cacheDirectory = getPlymouthCacheDirectory();
    const token = GLib.uuid_string_random();
    const rawPath = GLib.build_filenamev([
        cacheDirectory, `firmware-logo-${token}.bmp`,
    ]);
    const outputPath = GLib.build_filenamev([
        cacheDirectory, `firmware-logo-${token}.png`,
    ]);
    const rawFile = Gio.File.new_for_path(rawPath);
    try {
        Gio.File.new_for_path(FIRMWARE_LOGO_PATH).copy(
            rawFile, Gio.FileCopyFlags.OVERWRITE, null, null);
        const source = GdkPixbuf.Pixbuf.new_from_file(rawPath);
        const output = removeBlackMatte(source);
        output.savev(outputPath, 'png', [], []);
        return outputPath;
    } finally {
        deleteTemporaryFile(rawPath);
    }
}

function deleteTemporaryFile(path) {
    if (!path)
        return;
    try {
        Gio.File.new_for_path(path).delete(null);
    } catch (error) {
        console.warn('无法删除临时文件 ' + path + '：' + error.message);
    }
}

function runPrivileged(
    operation,
    path = '',
    plymouthImage = '',
    customizePlymouth = false,
    hideFirmwareLogo = false,
    firmwareLogo = ''
) {
    return new Promise((resolve, reject) => {
        let process;
        try {
            const command = [
                PKEXEC, '/bin/sh', '-c', PRIVILEGED_SCRIPT,
                'login-background', operation, path, plymouthImage,
                customizePlymouth ? '1' : '0', hideFirmwareLogo ? '1' : '0',
                firmwareLogo,
            ];
            process = Gio.Subprocess.new(
                command,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (error) {
            reject(new Error(`无法启动系统命令：${error.message}`));
            return;
        }

        process.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                const message = (stderr || stdout || '').trim();
                if (subprocess.get_exit_status() !== 0) {
                    reject(new Error(message ||
                        `操作已取消或认证失败（退出码 ${subprocess.get_exit_status()}）`));
                    return;
                }
                resolve((stdout || '').trim());
            } catch (error) {
                reject(error);
            }
        });
    });
}

export async function applyImage(
    path,
    customizePlymouth,
    hideFirmwareLogo,
    callback
) {
    const validationError = imageValidationError(path);
    if (validationError) {
        callback(false, validationError);
        return;
    }

    let plymouthImage = '';
    let firmwareLogo = '';
    try {
        if (customizePlymouth) {
            plymouthImage = createPlymouthImage(path);
            if (!hideFirmwareLogo)
                firmwareLogo = createFirmwareLogoImage();
        }
        await runPrivileged(
            'set', path, plymouthImage, customizePlymouth, hideFirmwareLogo,
            firmwareLogo);
        setSessionAppearance();
        callback(true, 'GDM 背景已更新。');
    } catch (error) {
        callback(false, error.message);
    } finally {
        deleteTemporaryFile(plymouthImage);
        deleteTemporaryFile(firmwareLogo);
    }
}

export async function clearBackground(callback) {
    try {
        await runPrivileged('clear');
        resetSessionAppearance();
        callback(true, '已恢复 GDM 默认背景。');
    } catch (error) {
        callback(false, error.message);
    }
}
