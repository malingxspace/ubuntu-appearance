export function parseApplicationSocketTotals(output) {
    const sockets = new Map();
    let socket = null;

    for (const line of output.split('\n')) {
        if (!/^\s/.test(line)) {
            const owner = line.match(
                /users:\(\(\"((?:\\.|[^"])*)\",pid=(\d+),fd=\d+\)/);
            const columns = line.trim().split(/\s+/);
            socket = owner && columns.length >= 5
                ? {
                    key: `${owner[2]}\0${columns[3]}\0${columns[4]}`,
                    name: owner[1]
                        .replace(/\\\"/g, '"')
                        .replace(/\\\\/g, '\\'),
                }
                : null;
            continue;
        }

        if (!socket)
            continue;
        const sent = line.match(/\bbytes_sent:(\d+)/);
        const received = line.match(/\bbytes_received:(\d+)/);
        if (!sent || !received)
            continue;
        sockets.set(socket.key, {
            name: socket.name,
            upload: Number(sent[1]),
            download: Number(received[1]),
        });
        socket = null;
    }

    return sockets;
}

export function calculateApplicationRates(previous, current, elapsed) {
    if (!previous || elapsed <= 0)
        return [];

    const applications = new Map();
    for (const [key, sample] of current) {
        const prior = previous.get(key);
        const download = prior ? sample.download - prior.download : 0;
        const upload = prior ? sample.upload - prior.upload : 0;
        const rate = applications.get(sample.name) || {download: 0, upload: 0};
        if (download >= 0)
            rate.download += download / elapsed;
        if (upload >= 0)
            rate.upload += upload / elapsed;
        applications.set(sample.name, rate);
    }

    return [...applications]
        .map(([name, rate]) => ({name, ...rate}))
        .filter(rate => rate.download > 0 || rate.upload > 0)
        .sort((left, right) =>
            right.download + right.upload - left.download - left.upload ||
            left.name.localeCompare(right.name));
}
