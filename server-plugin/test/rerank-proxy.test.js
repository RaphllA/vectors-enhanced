import assert from 'node:assert/strict';
import test from 'node:test';

import { createRerankHandler } from '../rerank-proxy.js';

const allowedSecretKeys = new Set(['api_key_vllm', 'api_key_generic']);

function createResponse() {
    return {
        writableEnded: false,
        statusCode: 200,
        payload: undefined,
        once() {},
        removeListener() {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            this.writableEnded = true;
            return this;
        },
    };
}

function createRequest(overrides = {}) {
    return {
        user: { directories: { root: '/tmp/user' } },
        body: {
            url: 'http://192.168.3.10:8025/v1/rerank',
            secretKey: 'api_key_vllm',
            secretId: '',
            query: 'query',
            documents: ['one', 'two'],
            model: 'reranker',
            top_n: 2,
            ...overrides,
        },
    };
}

test('forwards the old rerank payload with a server-side secret', async () => {
    let captured;
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: (_directories, key, id) => {
            assert.equal(key, 'api_key_vllm');
            assert.equal(id, null);
            return 'server-secret';
        },
        fetchImpl: async (url, options) => {
            captured = { url: url.toString(), options };
            return { ok: true, json: async () => ({ results: [{ index: 0, relevance_score: 0.9 }] }) };
        },
    });
    const response = createResponse();

    await handler(createRequest({ instruct: 'deduplicate' }), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload, { results: [{ index: 0, relevance_score: 0.9 }] });
    assert.equal(captured.options.headers.Authorization, 'Bearer server-secret');
    assert.deepEqual(JSON.parse(captured.options.body), {
        query: 'query',
        documents: ['one', 'two'],
        model: 'reranker',
        top_n: 2,
        instruct: 'deduplicate',
    });
});

test('rejects disallowed secret types before fetching', async () => {
    let fetched = false;
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => {
            fetched = true;
        },
    });
    const response = createResponse();

    await handler(createRequest({ secretKey: 'api_key_custom' }), response);

    assert.equal(fetched, false);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error.code, 'invalid_secret_reference');
});

test('rejects URL credentials', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => assert.fail('fetch should not run'),
    });
    const response = createResponse();

    await handler(createRequest({ url: 'https://user:password@example.com/rerank' }), response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error.code, 'invalid_url');
});

test('does not expose an upstream error body', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => ({ ok: false, status: 401 }),
    });
    const response = createResponse();

    await handler(createRequest(), response);

    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.payload, {
        error: {
            code: 'upstream_error',
            message: 'Rerank API returned an error.',
            upstreamStatus: 401,
        },
    });
});

test('rejects missing server-side secrets', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => '',
        fetchImpl: async () => assert.fail('fetch should not run'),
    });
    const response = createResponse();

    await handler(createRequest({ secretId: 'missing-id' }), response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error.code, 'secret_not_found');
});

test('uses a selected independent secret UUID', async () => {
    let secretReference;
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: (_directories, key, id) => {
            secretReference = { key, id };
            return 'independent-secret';
        },
        fetchImpl: async () => ({ ok: true, json: async () => ({ results: [] }) }),
    });
    const response = createResponse();

    await handler(createRequest({ secretKey: 'api_key_generic', secretId: 'rerank-uuid' }), response);

    assert.deepEqual(secretReference, { key: 'api_key_generic', id: 'rerank-uuid' });
    assert.equal(response.statusCode, 200);
});

test('maps transport failures to a safe gateway error', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => {
            throw new Error('connection details that must not escape');
        },
    });
    const response = createResponse();

    await handler(createRequest(), response);

    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.payload, {
        error: {
            code: 'upstream_unreachable',
            message: 'Rerank API could not be reached.',
        },
    });
});

test('aborts and reports an upstream timeout', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        timeoutMs: 1,
        fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    });
    const response = createResponse();

    await handler(createRequest(), response);

    assert.equal(response.statusCode, 504);
    assert.equal(response.payload.error.code, 'upstream_timeout');
});

test('rejects non-JSON upstream responses', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => ({
            ok: true,
            json: async () => {
                throw new SyntaxError('not JSON');
            },
        }),
    });
    const response = createResponse();

    await handler(createRequest(), response);

    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.error.code, 'invalid_upstream_response');
});

test('rejects JSON responses that are not objects', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => ({ ok: true, json: async () => [] }),
    });
    const response = createResponse();

    await handler(createRequest(), response);

    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.error.code, 'invalid_upstream_response');
});

test('rejects oversized document batches before fetching', async () => {
    const handler = createRerankHandler({
        allowedSecretKeys,
        readSecret: () => 'secret',
        fetchImpl: async () => assert.fail('fetch should not run'),
    });
    const response = createResponse();

    await handler(createRequest({ documents: Array(101).fill('document'), top_n: 1 }), response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error.code, 'invalid_documents');
});
