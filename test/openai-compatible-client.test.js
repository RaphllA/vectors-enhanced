import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCustomConnection, normalizeOpenAIBaseUrl } from '../src/core/memory/OpenAICompatibleClient.js';

test('normalizes compatible API URLs without duplicating v1', () => {
    assert.equal(normalizeOpenAIBaseUrl('http://mac.local:8025/v1/chat/completions'), 'http://mac.local:8025/v1');
    assert.equal(normalizeOpenAIBaseUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
});

test('selects a saved Custom key without proxy credentials', () => {
    const connection = buildCustomConnection('https://api.example.com/v1', 'summary-key-uuid');

    assert.deepEqual(connection, {
        chat_completion_source: 'custom',
        custom_url: 'https://api.example.com/v1',
        secret_id: 'summary-key-uuid',
        custom_include_headers: '',
    });
    assert.equal('proxy_password' in connection, false);
    assert.equal('reverse_proxy' in connection, false);
});

test('an empty UUID intentionally falls back to the active Custom key', () => {
    const connection = buildCustomConnection('https://api.example.com', '');
    assert.equal(connection.secret_id, undefined);
});
