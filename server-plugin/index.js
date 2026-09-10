import fetch from 'node-fetch';

import { readSecret, SECRET_KEYS } from '../../src/endpoints/secrets.js';
import { createRerankHandler } from './rerank-proxy.js';

export const info = {
    id: 'vectors-enhanced',
    name: 'Vectors Enhanced',
    description: 'Server-side proxy for Vectors Enhanced rerank requests.',
};

export async function init(router) {
    router.post('/rerank', createRerankHandler({
        fetchImpl: fetch,
        readSecret,
        allowedSecretKeys: new Set([
            SECRET_KEYS.VLLM,
            SECRET_KEYS.GENERIC,
            SECRET_KEYS.SILICONFLOW,
            SECRET_KEYS.COHERE,
        ]),
    }));
}
