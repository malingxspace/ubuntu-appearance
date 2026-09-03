import {validateImage} from '../background/imageCatalog.js';
import {runPrivileged} from '../privileged/runner.js';
import {
    createFirmwareLogoImage,
    createPlymouthImage,
    deleteTemporaryFile,
} from './imageProcessor.js';
import {resetSessionAppearance, setSessionAppearance} from './sessionAppearance.js';

export async function applyLoginImage(path, callback) {
    const validationError = validateImage(path);
    if (validationError) {
        callback(false, validationError);
        return;
    }

    try {
        await runPrivileged({operation: 'set-login', sourceImage: path});
        setSessionAppearance();
        callback(true, '');
    } catch (error) {
        callback(false, error.message);
    }
}

export async function clearLoginBackground(callback) {
    try {
        await runPrivileged({operation: 'clear-login'});
        resetSessionAppearance();
        callback(true, '');
    } catch (error) {
        callback(false, error.message);
    }
}

export async function applyPlymouthImage(path, hideFirmwareLogo, callback) {
    const validationError = validateImage(path);
    if (validationError) {
        callback(false, validationError);
        return;
    }

    let plymouthImage = '';
    let firmwareLogo = '';
    try {
        plymouthImage = createPlymouthImage(path);
        if (!hideFirmwareLogo)
            firmwareLogo = createFirmwareLogoImage();
        await runPrivileged({
            operation: 'set-plymouth',
            plymouthImage,
            hideFirmwareLogo,
            firmwareLogo,
        });
        callback(true, '');
    } catch (error) {
        callback(false, error.message);
    } finally {
        deleteTemporaryFile(plymouthImage);
        deleteTemporaryFile(firmwareLogo);
    }
}

export async function clearPlymouthBackground(callback) {
    try {
        await runPrivileged({operation: 'clear-plymouth'});
        callback(true, '');
    } catch (error) {
        callback(false, error.message);
    }
}

export async function setFirmwareLogoHidden(hidden, callback) {
    let firmwareLogo = '';
    try {
        if (!hidden) {
            firmwareLogo = createFirmwareLogoImage();
            if (!firmwareLogo)
                throw new Error('系统未提供可用的厂商 Logo。');
        }
        await runPrivileged({
            operation: 'set-firmware-logo',
            hideFirmwareLogo: hidden,
            firmwareLogo,
        });
        callback(true, '');
    } catch (error) {
        callback(false, error.message);
    } finally {
        deleteTemporaryFile(firmwareLogo);
    }
}
