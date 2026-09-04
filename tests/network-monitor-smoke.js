import {parseDefaultInterfaces, parseNetworkTotals} from
    '../src/network/procNetParser.js';
import {
    formatRate,
    isDisplayedRateZero,
} from '../src/network/rateFormatter.js';
import {
    calculateApplicationRates,
    parseApplicationSocketTotals,
} from '../src/network/applicationRate.js';

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
assertEqual(isDisplayedRateZero(0.4), true);
assertEqual(isDisplayedRateZero(0.5), false);
assertEqual(isDisplayedRateZero(0.06, 'bits'), true);
assertEqual(isDisplayedRateZero(0.07, 'bits'), false);

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

const socketOutput = `ESTAB 0 0 127.0.0.1:40000 127.0.0.1:7897 users:(("firefox",pid=42,fd=10))
 cubic bytes_sent:1200 bytes_acked:1201 bytes_received:3400
ESTAB 0 0 10.0.0.2:50000 1.1.1.1:443 users:(("code",pid=77,fd=20))
 cubic bytes_sent:900 bytes_acked:901 bytes_received:1800
ESTAB 0 0 10.0.0.2:51000 1.0.0.1:443 users:(("gnome-shell",pid=88,fd=30))
 cubic bytes_sent:100 bytes_acked:101 bytes_received:200`;
const nextSocketOutput = `ESTAB 0 0 127.0.0.1:40000 127.0.0.1:7897 users:(("firefox",pid=42,fd=10))
 cubic bytes_sent:1500 bytes_acked:1501 bytes_received:4000
ESTAB 0 0 10.0.0.2:50000 1.1.1.1:443 users:(("code",pid=77,fd=20))
 cubic bytes_sent:1100 bytes_acked:1101 bytes_received:2000
ESTAB 0 0 10.0.0.2:51000 1.0.0.1:443 users:(("gnome-shell",pid=88,fd=30))
 cubic bytes_sent:100 bytes_acked:101 bytes_received:200`;
const applicationRates = calculateApplicationRates(
    parseApplicationSocketTotals(socketOutput),
    parseApplicationSocketTotals(nextSocketOutput), 2);
assertEqual(applicationRates.length, 2);
assertEqual(applicationRates[0].name, 'firefox');
assertEqual(applicationRates[0].download, 300);
assertEqual(applicationRates[0].upload, 150);
assertEqual(applicationRates[1].name, 'code');
assertEqual(applicationRates[1].download, 100);
assertEqual(applicationRates[1].upload, 100);
