import {parseDefaultInterfaces, parseNetworkTotals} from
    '../src/network/procNetParser.js';
import {formatRate} from '../src/network/rateFormatter.js';

function assertEqual(actual, expected) {
    if (actual !== expected)
        throw new Error(`Expected ${expected}, got ${actual}`);
}

assertEqual(formatRate(0), '0 B/s');
assertEqual(formatRate(876), '876 B/s');
assertEqual(formatRate(1700), '1.7 KB/s');
assertEqual(formatRate(19_200), '19 KB/s');
assertEqual(formatRate(1_900_000), '1.9 MB/s');
assertEqual(formatRate(1_200_000_000), '1.2 GB/s');
assertEqual(formatRate(125_000, 'bits'), '1.0 Mb/s');

const routes = `Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT
wlan0 00000000 0101A8C0 0003 0 0 600 00000000 0 0 0
eth0 00000000 0101A8C0 0003 0 0 100 00000000 0 0 0`;
const interfaces = parseDefaultInterfaces(routes, '');
assertEqual(interfaces.join(','), 'eth0');

const totals = parseNetworkTotals(
    'eth0: 100 0 0 0 0 0 0 0 40 0 0 0 0 0 0 0\n' +
    'wlan0: 900 0 0 0 0 0 0 0 800 0 0 0 0 0 0 0', interfaces);
assertEqual(totals.download, 100);
assertEqual(totals.upload, 40);
