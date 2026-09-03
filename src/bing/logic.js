const FIXED_RESOLUTIONS = Object.freeze([
    ['800x600', 800, 600],
    ['1024x768', 1024, 768],
    ['1280x720', 1280, 720],
    ['1366x768', 1366, 768],
    ['1920x1080', 1920, 1080],
    ['1920x1200', 1920, 1200],
]);

export function chooseAutoResolution(width, height) {
    const match = FIXED_RESOLUTIONS.find(
        ([, candidateWidth, candidateHeight]) =>
            candidateWidth >= width && candidateHeight >= height);
    return match?.[0] ?? 'UHD';
}

export function imageId(image) {
    return image.urlbase.replace(/^.*OHR\./, '').replace(/[^\w.-]/g, '_');
}

export function mergeDownloadHistory(history, record) {
    return [record, ...history.filter(item => item.id !== record.id)]
        .sort((a, b) => String(b.fullstartdate).localeCompare(
            String(a.fullstartdate)));
}
