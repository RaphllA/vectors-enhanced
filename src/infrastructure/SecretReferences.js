import { readSecretState, SECRET_KEYS, secret_state } from '../../../../../secrets.js';

export const CUSTOM_SECRET_KEY = SECRET_KEYS.CUSTOM;

export async function refreshSecretReferences() {
    await readSecretState();
}

export function getSecretReferences(key) {
    const secrets = secret_state[key];
    return Array.isArray(secrets) ? secrets : [];
}

export function formatSecretReference(secret) {
    const label = secret.label || '[无标签]';
    const active = secret.active ? ' · active' : '';
    return `${label}${active}`;
}
