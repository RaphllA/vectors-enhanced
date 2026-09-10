import assert from 'node:assert/strict';
import test from 'node:test';

import { RerankService } from '../src/services/rerank/RerankService.js';

test('existing rerank tuning and endpoint settings remain unchanged', () => {
    const service = new RerankService({
        rerank_enabled: true,
        rerank_url: 'https://public.example.com/rerank',
        rerank_model: 'existing-model',
        rerank_top_n: 7,
        rerank_hybrid_alpha: 0.35,
        rerank_success_notify: false,
        rerank_deduplication_enabled: true,
        rerank_deduplication_instruction: 'existing instruction',
    });

    assert.deepEqual(service.config.getConfig(), {
        enabled: true,
        url: 'https://public.example.com/rerank',
        secretKey: 'api_key_vllm',
        secretId: '',
        model: 'existing-model',
        top_n: 7,
        hybrid_alpha: 0.35,
        success_notify: false,
        deduplication_enabled: true,
        deduplication_instruction: 'existing instruction',
    });
});

test('rerank responses remain compatible with both relevance_score and score fields', () => {
    const service = new RerankService({});
    const indexedResults = [
        { text: 'first', score: 0.4, _rerank_index: 0 },
        { text: 'second', score: 0.6, _rerank_index: 1 },
    ];

    const result = service._processRerankResponse(indexedResults, {
        results: [
            { index: 0, relevance_score: 0.9 },
            { index: 1, score: 0.2 },
        ],
    }, 1);

    assert.equal(result[0].text, 'first');
    assert.equal(result[0].rerank_score, 0.9);
    assert.equal(result[1].text, 'second');
    assert.equal(result[1].rerank_score, 0.2);
});

test('browser sends rerank data only to the same-origin server plugin', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    let captured;
    globalThis.fetch = async (url, options) => {
        captured = { url, options };
        return {
            ok: true,
            json: async () => ({ results: [] }),
        };
    };

    const service = new RerankService({
        rerank_apiKey: 'legacy-browser-secret-that-must-not-be-sent',
        rerank_secret_key: 'api_key_generic',
        rerank_secret_id: 'rerank-key-uuid',
    }, {
        getRequestHeaders: () => ({ 'X-CSRF-Token': 'csrf' }),
    });

    await service._sendRerankRequest(service.config.getConfig(), {
        query: 'query',
        documents: ['document'],
        model: 'reranker',
        top_n: 1,
    });

    assert.equal(captured.url, '/api/plugins/vectors-enhanced/rerank');
    assert.equal(captured.options.headers.Authorization, undefined);
    assert.equal(captured.options.body.includes('legacy-browser-secret-that-must-not-be-sent'), false);
    assert.equal(captured.options.headers['X-CSRF-Token'], 'csrf');
    assert.deepEqual(JSON.parse(captured.options.body), {
        url: 'https://api.siliconflow.cn/v1/rerank',
        secretKey: 'api_key_generic',
        secretId: 'rerank-key-uuid',
        query: 'query',
        documents: ['document'],
        model: 'reranker',
        top_n: 1,
    });
});

test('proxy errors use the original similarity fallback and expose safe HTTP context', async (t) => {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    t.after(() => {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
    });

    console.error = () => {};
    globalThis.fetch = async () => ({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({
            error: {
                message: 'Rerank API returned an error.',
                upstreamStatus: 401,
            },
        }),
    });

    const notifications = [];
    const service = new RerankService({
        rerank_enabled: true,
        rerank_url: 'https://api.example.com/v1/rerank',
        rerank_secret_key: 'api_key_vllm',
        rerank_model: 'reranker',
        rerank_top_n: 2,
    }, {
        toastr: { error: message => notifications.push(message) },
        getRequestHeaders: () => ({ 'X-CSRF-Token': 'csrf' }),
    });
    const originalResults = [
        { text: 'lower', score: 0.2 },
        { text: 'higher', score: 0.8 },
    ];

    const result = await service.rerankResults('query', originalResults);

    assert.deepEqual(result, [originalResults[1], originalResults[0]]);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0], /HTTP 502/);
    assert.match(notifications[0], /upstream 401/);
});
