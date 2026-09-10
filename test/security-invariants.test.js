import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('summary code never writes, rotates, deletes, or forwards a Custom key', async () => {
    const source = await readSource('../src/core/memory/MemoryService.js');

    assert.doesNotMatch(source, /\/api\/secrets\/(?:write|rotate|delete)/);
    assert.doesNotMatch(source, /proxy_password/);
});

test('browser rerank code never calls the configured upstream URL or attaches authorization', async () => {
    const source = await readSource('../src/services/rerank/RerankService.js');

    assert.doesNotMatch(source, /fetch\s*\(\s*config\.url/);
    assert.doesNotMatch(source, /Authorization/);
    assert.match(source, /fetch\s*\(\s*['"]\/api\/plugins\/vectors-enhanced\/rerank['"]/);
});

test('secret picker labels never include secret values', async () => {
    const source = await readSource('../src/infrastructure/SecretReferences.js');

    assert.doesNotMatch(source, /secret\.value/);
});
