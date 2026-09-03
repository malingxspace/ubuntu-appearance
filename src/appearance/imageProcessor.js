import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

const MAX_PLYMOUTH_IMAGE_SIZE = 50 * 1024 * 1024;
const PLYMOUTH_MAX_WIDTH = 3840;
const PLYMOUTH_MAX_HEIGHT = 2160;
const MIN_DISPLAY_SIZE = 320;
const MAX_DISPLAY_SIZE = 16384;
const FIRMWARE_LOGO_PATH = '/sys/firmware/acpi/bgrt/image';
const FIRMWARE_BLACK_LEVEL = 16;

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

export function createPlymouthImage(path) {
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

export function createFirmwareLogoImage() {
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

export function deleteTemporaryFile(path) {
    if (!path)
        return;
    try {
        Gio.File.new_for_path(path).delete(null);
    } catch (error) {
        console.warn('无法删除临时文件 ' + path + '：' + error.message);
    }
}
