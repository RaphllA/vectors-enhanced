const MAX_DOCUMENTS = 100;
const MAX_QUERY_LENGTH = 32_768;
const MAX_DOCUMENT_LENGTH = 65_536;
const MAX_TOTAL_DOCUMENT_LENGTH = 1_000_000;
const MAX_MODEL_LENGTH = 512;
const MAX_INSTRUCTION_LENGTH = 16_384;
const MAX_URL_LENGTH = 2_048;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 60_000;

class ProxyError extends Error {
    constructor(status, code, message, upstreamStatus) {
        super(message);
        this.status = status;
        this.code = code;
        this.upstreamStatus = upstreamStatus;
    }
}

function assertString(value, name, maxLength) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new ProxyError(400, 'invalid_request', `${name} must be a non-empty string.`);
    }
    if (value.length > maxLength) {
        throw new ProxyError(400, 'request_too_large', `${name} exceeds the allowed length.`);
    }
}

function validateRequest(body, allowedSecretKeys) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ProxyError(400, 'invalid_request', 'A JSON request body is required.');
    }

    assertString(body.url, 'url', MAX_URL_LENGTH);
    let endpoint;
    try {
        endpoint = new URL(body.url);
    } catch {
        throw new ProxyError(400, 'invalid_url', 'Rerank URL is invalid.');
    }
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
        throw new ProxyError(400, 'invalid_url', 'Rerank URL must use HTTP or HTTPS and cannot contain credentials.');
    }

    assertString(body.secretKey, 'secretKey', 128);
    if (!allowedSecretKeys.has(body.secretKey)) {
        throw new ProxyError(400, 'invalid_secret_reference', 'This SillyTavern secret type is not allowed for Rerank.');
    }
    if (body.secretId != null && (typeof body.secretId !== 'string' || body.secretId.length > 128)) {
        throw new ProxyError(400, 'invalid_secret_reference', 'secretId must be a string.');
    }

    assertString(body.query, 'query', MAX_QUERY_LENGTH);
    assertString(body.model, 'model', MAX_MODEL_LENGTH);
    if (!Array.isArray(body.documents) || body.documents.length === 0 || body.documents.length > MAX_DOCUMENTS) {
        throw new ProxyError(400, 'invalid_documents', `documents must contain between 1 and ${MAX_DOCUMENTS} items.`);
    }

    let totalDocumentLength = 0;
    for (const document of body.documents) {
        assertString(document, 'document', MAX_DOCUMENT_LENGTH);
        totalDocumentLength += document.length;
    }
    if (totalDocumentLength > MAX_TOTAL_DOCUMENT_LENGTH) {
        throw new ProxyError(400, 'request_too_large', 'The combined document text exceeds the allowed length.');
    }

    if (!Number.isInteger(body.top_n) || body.top_n < 1 || body.top_n > body.documents.length) {
        throw new ProxyError(400, 'invalid_top_n', 'top_n must be an integer between 1 and the document count.');
    }
    if (body.instruct != null && body.instruct !== '') {
        assertString(body.instruct, 'instruct', MAX_INSTRUCTION_LENGTH);
    }

    return endpoint;
}

function sendError(response, error) {
    const status = error instanceof ProxyError ? error.status : 500;
    const payload = {
        error: {
            code: error instanceof ProxyError ? error.code : 'proxy_error',
            message: error instanceof ProxyError ? error.message : 'Rerank proxy failed.',
        },
    };
    if (error instanceof ProxyError && error.upstreamStatus) {
        payload.error.upstreamStatus = error.upstreamStatus;
    }
    return response.status(status).json(payload);
}

export function createRerankHandler({ fetchImpl, readSecret, allowedSecretKeys, timeoutMs = UPSTREAM_TIMEOUT_MS }) {
    return async function rerankHandler(request, response) {
        let timeoutId;
        let timedOut = false;
        const controller = new AbortController();
        const abortOnClose = () => {
            if (!response.writableEnded) {
                controller.abort();
            }
        };

        try {
            const endpoint = validateRequest(request.body, allowedSecretKeys);
            const secret = readSecret(
                request.user.directories,
                request.body.secretKey,
                request.body.secretId || null,
            );
            if (!secret) {
                throw new ProxyError(400, 'secret_not_found', 'The selected SillyTavern API key was not found.');
            }

            response.once('close', abortOnClose);
            timeoutId = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs);

            const upstreamBody = {
                query: request.body.query,
                documents: request.body.documents,
                model: request.body.model,
                top_n: request.body.top_n,
            };
            if (request.body.instruct) {
                upstreamBody.instruct = request.body.instruct;
            }

            let upstream;
            try {
                upstream = await fetchImpl(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${secret}`,
                    },
                    body: JSON.stringify(upstreamBody),
                    signal: controller.signal,
                    size: MAX_RESPONSE_BYTES,
                });
            } catch (error) {
                if (controller.signal.aborted) {
                    throw error;
                }
                throw new ProxyError(502, 'upstream_unreachable', 'Rerank API could not be reached.');
            }

            if (!upstream.ok) {
                throw new ProxyError(502, 'upstream_error', 'Rerank API returned an error.', upstream.status);
            }

            let data;
            try {
                data = await upstream.json();
            } catch {
                throw new ProxyError(502, 'invalid_upstream_response', 'Rerank API returned invalid JSON.');
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new ProxyError(502, 'invalid_upstream_response', 'Rerank API returned an invalid response.');
            }

            return response.json(data);
        } catch (error) {
            if (timedOut) {
                return sendError(response, new ProxyError(504, 'upstream_timeout', 'Rerank API request timed out.'));
            }
            if (controller.signal.aborted && !response.writableEnded) {
                return;
            }
            if (!(error instanceof ProxyError)) {
                console.error('[Vectors Enhanced] Rerank proxy error:', error?.message || error);
            }
            return sendError(response, error);
        } finally {
            clearTimeout(timeoutId);
            response.removeListener('close', abortOnClose);
        }
    };
}
