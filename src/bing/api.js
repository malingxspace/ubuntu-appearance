import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {BING_ENDPOINT} from './config.js';

function readResponse(session, message, cancellable) {
    return new Promise((resolve, reject) => {
        session.send_and_read_async(
            message, GLib.PRIORITY_DEFAULT, cancellable, (_session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.get_status();
                    if (status < 200 || status >= 300) {
                        reject(new Error(
                            `HTTP ${status}: ${message.get_reason_phrase()}`));
                        return;
                    }
                    resolve(bytes);
                } catch (error) {
                    reject(error);
                }
            });
    });
}

export async function fetchDailyImages(session, market, count, cancellable) {
    const imageCount = Math.max(1, Math.min(8, Math.trunc(count)));
    const message = Soup.Message.new_from_encoded_form(
        'GET', BING_ENDPOINT, Soup.form_encode_hash({
            format: 'js',
            idx: '0',
            n: String(imageCount),
            mbl: '1',
            mkt: market === 'auto' ? '' : market,
        }));
    message.request_headers.append('Accept', 'application/json');
    const bytes = await readResponse(session, message, cancellable);
    const document = JSON.parse(new TextDecoder().decode(bytes.get_data()));
    if (!Array.isArray(document.images) || document.images.length === 0)
        throw new Error('Bing response contains no daily image');
    return document.images;
}

export function downloadImage(session, url, cancellable) {
    return readResponse(session, Soup.Message.new('GET', url), cancellable);
}
