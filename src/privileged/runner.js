import Gio from 'gi://Gio';

import {PRIVILEGED_SCRIPT} from './script.js';

const PKEXEC = '/usr/bin/pkexec';

export function runPrivileged({
    operation,
    sourceImage = '',
    plymouthImage = '',
    hideFirmwareLogo = false,
    firmwareLogo = '',
}) {
    return new Promise((resolve, reject) => {
        let process;
        try {
            process = Gio.Subprocess.new([
                PKEXEC, '/bin/sh', '-c', PRIVILEGED_SCRIPT,
                'login-background', operation, sourceImage, plymouthImage,
                hideFirmwareLogo ? '1' : '0', firmwareLogo,
            ], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (error) {
            reject(new Error(`无法启动系统命令：${error.message}`));
            return;
        }

        process.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                const message = (stderr || stdout || '').trim();
                if (subprocess.get_exit_status() !== 0) {
                    reject(new Error(message ||
                        `操作已取消或认证失败（退出码 ${subprocess.get_exit_status()}）`));
                    return;
                }
                resolve((stdout || '').trim());
            } catch (error) {
                reject(error);
            }
        });
    });
}
