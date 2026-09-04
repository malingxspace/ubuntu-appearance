export function formatRate(bytesPerSecond, unit = 'bytes') {
    const isBits = unit === 'bits';
    let value = Math.max(0, bytesPerSecond) * (isBits ? 8 : 1);
    const units = isBits
        ? ['b/s', 'Kb/s', 'Mb/s', 'Gb/s']
        : ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let index = 0;
    while (value >= 1000 && index < units.length - 1) {
        value /= 1000;
        index++;
    }
    const digits = index === 0 ? 0 : (index === 1 && value >= 10 ? 0 : 1);
    return `${value.toFixed(digits)} ${units[index]}`;
}

export function isDisplayedRateZero(bytesPerSecond, unit = 'bytes') {
    return formatRate(bytesPerSecond, unit) === formatRate(0, unit);
}
