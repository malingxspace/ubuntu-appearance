import {
    chooseAutoResolution,
    imageId,
    mergeDownloadHistory,
} from '../src/bing/logic.js';

function assertEqual(actual, expected) {
    if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
}

assertEqual(chooseAutoResolution(1366, 768), '1366x768');
assertEqual(chooseAutoResolution(1920, 1080), '1920x1080');
assertEqual(chooseAutoResolution(2560, 1440), 'UHD');
assertEqual(imageId({urlbase: '/th?id=OHR.Example_ZH-CN'}), 'Example_ZH-CN');

const history = mergeDownloadHistory([
    {id: 'old', fullstartdate: '202609010000'},
    {id: 'same', fullstartdate: '202609020000'},
], {id: 'same', fullstartdate: '202609030000'});
assertEqual(history.length, 2);
assertEqual(history[0].id, 'same');
assertEqual(history[0].fullstartdate, '202609030000');
