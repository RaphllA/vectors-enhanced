import assert from 'node:assert/strict';
import test from 'node:test';

import { detectHostRuntime } from '../src/compat/HostRuntime.js';
import {
    BrowserVectorBackend,
    buildVllmEmbeddingsUrl,
    cosineSimilarity,
    decodeStoredText,
} from '../src/infrastructure/storage/BrowserVectorBackend.js';
import { StorageAdapter } from '../src/infrastructure/storage/StorageAdapter.js';

test('detectHostRuntime defaults to SillyTavern-compatible web host', () => {
    const runtime = detectHostRuntime({ window: {}, navigator: {} });
    assert.equal(runtime.host, 'sillytavern');
    assert.equal(runtime.isTauriTavern, false);
    assert.equal(runtime.canFallbackToBrowserVectors, false);
});

test('detectHostRuntime recognizes stable Tauri markers', () => {
    const runtime = detectHostRuntime({
        window: {
            __TAURI_RUNNING__: true,
            indexedDB: {},
            navigator: { gpu: {} },
        },
    });
    assert.equal(runtime.host, 'tauritavern');
    assert.equal(runtime.isTauriTavern, true);
    assert.equal(runtime.canFallbackToBrowserVectors, true);
    assert.equal(runtime.capabilities.indexedDb, true);
    assert.equal(runtime.capabilities.webGpu, true);
});

test('buildVllmEmbeddingsUrl accepts server roots and /v1 roots', () => {
    assert.equal(buildVllmEmbeddingsUrl('http://127.0.0.1:8000'), 'http://127.0.0.1:8000/v1/embeddings');
    assert.equal(buildVllmEmbeddingsUrl('http://127.0.0.1:8000/v1/'), 'http://127.0.0.1:8000/v1/embeddings');
    assert.throws(() => buildVllmEmbeddingsUrl(''), /not configured/);
});

test('browser backend reads Ollama batch embeddings', async (context) => {
    const originalFetch = globalThis.fetch;
    context.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async (url, init) => {
        assert.equal(url, 'http://localhost:11434/api/embed');
        assert.deepEqual(JSON.parse(init.body), {
            model: 'test-model',
            input: ['one', 'two'],
        });
        return new Response(JSON.stringify({ embeddings: [[1, 0], [0, 1]] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    const backend = new BrowserVectorBackend({
        settings: { source: 'ollama', ollama_model: 'test-model', ollama_url: 'http://localhost:11434' },
        indexedDB: {},
    });
    assert.deepEqual(await backend.embedTexts(['one', 'two']), [[1, 0], [0, 1]]);
});

test('browser backend falls back to the legacy Ollama embeddings endpoint', async (context) => {
    const originalFetch = globalThis.fetch;
    context.after(() => { globalThis.fetch = originalFetch; });
    const urls = [];
    globalThis.fetch = async (url) => {
        urls.push(url);
        if (url.endsWith('/api/embed')) {
            return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ embedding: [0.5, 0.5] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    const backend = new BrowserVectorBackend({
        settings: { source: 'ollama', ollama_model: 'test-model' },
        indexedDB: {},
    });
    assert.deepEqual(await backend.embedTexts(['one']), [[0.5, 0.5]]);
    assert.deepEqual(urls, [
        'http://localhost:11434/api/embed',
        'http://localhost:11434/api/embeddings',
    ]);
});

test('browser backend reads ordered OpenAI-compatible vLLM embeddings', async (context) => {
    const originalFetch = globalThis.fetch;
    context.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async (url, init) => {
        assert.equal(url, 'http://localhost:8000/v1/embeddings');
        assert.equal(init.headers.Authorization, 'Bearer secret');
        return new Response(JSON.stringify({
            data: [
                { index: 1, embedding: [0, 1] },
                { index: 0, embedding: [1, 0] },
            ],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    const backend = new BrowserVectorBackend({
        settings: {
            source: 'vllm',
            vllm_model: 'test-model',
            vllm_url: 'http://localhost:8000',
            vllm_api_key: 'secret',
        },
        indexedDB: {},
    });
    assert.deepEqual(await backend.embedTexts(['one', 'two']), [[1, 0], [0, 1]]);
});

test('decodeStoredText removes plugin metadata prefixes for query results', () => {
    assert.deepEqual(
        decodeStoredText('[META:type=chat,originalIndex=12]hello'),
        { text: 'hello', metadata: { type: 'chat', originalIndex: 12 } },
    );
    assert.deepEqual(decodeStoredText('plain'), { text: 'plain', metadata: {} });
});

test('cosineSimilarity handles matching, orthogonal, and invalid vectors', () => {
    assert.ok(Math.abs(cosineSimilarity([1, 2], [1, 2]) - 1) < Number.EPSILON * 2);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    assert.equal(cosineSimilarity([], []), -1);
    assert.equal(cosineSimilarity([1], [1, 2]), -1);
});

test('StorageAdapter activates browser fallback only for unavailable route statuses', () => {
    const backend = {
        isSupported: () => true,
    };
    const adapter = new StorageAdapter({ browserVectorBackend: backend });

    assert.equal(adapter.activateBrowserFallback({ status: 500 }, 'test'), false);
    assert.equal(adapter.useBrowserVectorBackend, false);
    assert.equal(adapter.activateBrowserFallback({ status: 501 }, 'test'), true);
    assert.equal(adapter.useBrowserVectorBackend, true);
});

test('StorageAdapter does not activate fallback when IndexedDB backend is unavailable', () => {
    const adapter = new StorageAdapter({
        browserVectorBackend: { isSupported: () => false },
    });
    assert.equal(adapter.activateBrowserFallback({ status: 501 }, 'test'), false);
});
