export function normalizeOpenAIBaseUrl(url) {
    let baseUrl = String(url || '').trim();
    baseUrl = baseUrl.replace(/\/chat\/completions\/?$/, '');
    baseUrl = baseUrl.replace(/\/v1\/?$/, '');
    baseUrl = baseUrl.replace(/\/$/, '');
    return `${baseUrl}/v1`;
}

export function buildCustomConnection(url, secretId = '') {
    return {
        chat_completion_source: 'custom',
        custom_url: normalizeOpenAIBaseUrl(url),
        secret_id: secretId || undefined,
        custom_include_headers: '',
    };
}
