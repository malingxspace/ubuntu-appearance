export const BING_ENDPOINT = 'https://www.bing.com/HPImageArchive.aspx';
export const BING_ORIGIN = 'https://www.bing.com';
export const RETRY_SECONDS = 60 * 60;
export const FALLBACK_CHECK_SECONDS = 24 * 60 * 60;
export const UPDATE_GRACE_SECONDS = 5 * 60;

export const RESOLUTIONS = Object.freeze([
    'auto', 'UHD', '1920x1200', '1920x1080', '1366x768',
    '1280x720', '1024x768', '800x600',
]);

export const MARKETS = Object.freeze([
    ['auto', 'Automatic'],
    ['de-DE', 'Deutsch (Deutschland)'],
    ['en-AU', 'English (Australia)'],
    ['en-CA', 'English (Canada)'],
    ['en-GB', 'English (United Kingdom)'],
    ['en-IN', 'English (India)'],
    ['en-US', 'English (United States)'],
    ['en-WW', 'English (International)'],
    ['es-ES', 'español (España)'],
    ['es-MX', 'español (México)'],
    ['fr-CA', 'français (Canada)'],
    ['fr-FR', 'français (France)'],
    ['it-IT', 'italiano (Italia)'],
    ['ja-JP', '日本語 (日本)'],
    ['ko-KR', '한국어 (대한민국)'],
    ['nl-NL', 'Nederlands (Nederland)'],
    ['pl-PL', 'polski (Polska)'],
    ['pt-BR', 'português (Brasil)'],
    ['ru-RU', 'русский (Россия)'],
    ['tr-TR', 'Türkçe (Türkiye)'],
    ['uk-UA', 'українська (Україна)'],
    ['zh-CN', '中文（中国）'],
    ['zh-HK', '中文（香港）'],
    ['zh-TW', '中文（台灣）'],
]);
