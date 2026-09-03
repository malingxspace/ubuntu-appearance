import Gio from 'gi://Gio';

import {PRIVILEGED_SCRIPT} from '../src/privileged/script.js';

for (const operation of [
    'set-login)',
    'clear-login)',
    'set-plymouth)',
    'clear-plymouth)',
    'set-firmware-logo)',
]) {
    if (!PRIVILEGED_SCRIPT.includes(operation))
        throw new Error(`Missing privileged operation: ${operation}`);
}

const process = Gio.Subprocess.new(
    ['/bin/sh', '-n'],
    Gio.SubprocessFlags.STDIN_PIPE |
    Gio.SubprocessFlags.STDOUT_PIPE |
    Gio.SubprocessFlags.STDERR_PIPE);
const [, , stderr] = process.communicate_utf8(PRIVILEGED_SCRIPT, null);
if (!process.get_successful())
    throw new Error(`Invalid privileged shell script: ${stderr}`);
