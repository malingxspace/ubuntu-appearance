export function parseDefaultInterfaces(ipv4Routes, ipv6Routes) {
    const interfaces = new Set();
    let lowestIpv4Metric = Number.POSITIVE_INFINITY;

    for (const line of ipv4Routes.trim().split('\n').slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 8 || fields[1] !== '00000000')
            continue;
        const flags = Number.parseInt(fields[3], 16);
        const metric = Number.parseInt(fields[6], 10);
        if (!Number.isFinite(flags) || !(flags & 0x1) || !Number.isFinite(metric))
            continue;
        if (metric < lowestIpv4Metric) {
            interfaces.clear();
            lowestIpv4Metric = metric;
        }
        if (metric === lowestIpv4Metric)
            interfaces.add(fields[0]);
    }

    let lowestIpv6Metric = Number.POSITIVE_INFINITY;
    const ipv6Interfaces = new Set();
    for (const line of ipv6Routes.trim().split('\n')) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 10 || !/^0{32}$/.test(fields[0]) || fields[1] !== '00')
            continue;
        const metric = Number.parseInt(fields[5], 16);
        const flags = Number.parseInt(fields[8], 16);
        if (!Number.isFinite(metric) || !Number.isFinite(flags) || !(flags & 0x1))
            continue;
        if (metric < lowestIpv6Metric) {
            ipv6Interfaces.clear();
            lowestIpv6Metric = metric;
        }
        if (metric === lowestIpv6Metric)
            ipv6Interfaces.add(fields[9]);
    }
    for (const name of ipv6Interfaces)
        interfaces.add(name);
    interfaces.delete('lo');
    return [...interfaces].sort();
}

export function parseNetworkTotals(contents, interfaces) {
    const selected = new Set(interfaces);
    let download = 0;
    let upload = 0;
    for (const line of contents.split('\n')) {
        const separator = line.indexOf(':');
        if (separator < 0)
            continue;
        const name = line.slice(0, separator).trim();
        if (!selected.has(name))
            continue;
        const fields = line.slice(separator + 1).trim().split(/\s+/);
        const received = Number.parseInt(fields[0], 10);
        const transmitted = Number.parseInt(fields[8], 10);
        if (!Number.isFinite(received) || !Number.isFinite(transmitted))
            throw new Error(`Invalid network counters for ${name}`);
        download += received;
        upload += transmitted;
    }
    return {download, upload};
}
