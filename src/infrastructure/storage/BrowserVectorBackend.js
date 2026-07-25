import { Logger } from '../../utils/Logger.js';

const DB_NAME = 'vectors-enhanced-browser-vectors';
const DB_VERSION = 2;
const STORE_NAME = 'vectors';
const COLLECTION_INDEX = 'collectionKey';
const COLLECTION_ID_INDEX = 'collectionId';
const SUPPORTED_SOURCES = new Set(['ollama', 'vllm', 'webllm', 'koboldcpp']);

const logger = new Logger('BrowserVectorBackend');

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
}

function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
}

function trimTrailingSlash(value) {
    return String(value ?? '').trim().replace(/\/+$/, '');
}

export function buildVllmEmbeddingsUrl(apiUrl) {
    const baseUrl = trimTrailingSlash(apiUrl);
    if (!baseUrl) {
        throw new Error('vLLM URL is not configured');
    }
    return /\/v1$/i.test(baseUrl) ? `${baseUrl}/embeddings` : `${baseUrl}/v1/embeddings`;
}

export function decodeStoredText(encodedText) {
    const text = String(encodedText ?? '');
    const match = text.match(/^\[META:([^\]]+)\]/);
    if (!match) {
        return { text, metadata: {} };
    }

    const metadata = {};
    for (const pair of match[1].split(',')) {
        const separator = pair.indexOf('=');
        if (separator < 0) continue;
        const key = pair.slice(0, separator);
        const rawValue = pair.slice(separator + 1);
        metadata[key] = ['originalIndex', 'floor'].includes(key)
            ? Number.parseInt(rawValue, 10)
            : rawValue;
    }
    return { text: text.slice(match[0].length), metadata };
}

export function cosineSimilarity(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
        return -1;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index++) {
        const leftValue = Number(left[index]);
        const rightValue = Number(right[index]);
        if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
            return -1;
        }
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }

    if (leftNorm === 0 || rightNorm === 0) {
        return -1;
    }
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/**
 * Browser-side vector backend used when TauriTavern reports that its native
 * /api/vector backend is unavailable. Vectors are isolated by source/model so
 * changing the embedding model cannot mix incompatible dimensions.
 */
export class BrowserVectorBackend {
    constructor(dependencies = {}) {
        this.settings = dependencies.settings;
        this.textgenerationwebuiSettings = dependencies.textgenerationwebuiSettings;
        this.textgenTypes = dependencies.textgenTypes;
        this.indexedDB = dependencies.indexedDB ?? globalThis.indexedDB;
        this.scope = dependencies.scope ?? globalThis;
        this.databasePromise = null;
        this.webLlmEngine = null;
        this.webLlmModel = null;
    }

    isSupported() {
        return Boolean(this.indexedDB);
    }

    getSupportedSources() {
        return [...SUPPORTED_SOURCES];
    }

    async getSavedHashes(collectionId) {
        const records = await this.getCollectionRecords(collectionId);
        return records.map(record => record.hash);
    }

    async insertVectorItems(collectionId, items, signal = null, options = {}) {
        this.assertAvailable();
        this.throwIfAborted(signal);

        const collectionKey = this.getCollectionKey(collectionId);
        const existingRecords = options.skipDeduplication
            ? []
            : await this.getCollectionRecords(collectionId);
        const existingHashes = new Set(existingRecords.map(record => record.hash));
        const pendingItems = options.skipDeduplication
            ? items
            : items.filter(item => !existingHashes.has(item.hash));

        if (pendingItems.length === 0) {
            return;
        }

        const embeddings = await this.embedTexts(pendingItems.map(item => item.text), signal);
        if (embeddings.length !== pendingItems.length) {
            throw new Error(`Embedding provider returned ${embeddings.length} vectors for ${pendingItems.length} items`);
        }

        const database = await this.openDatabase();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        pendingItems.forEach((item, index) => {
            const vector = Array.from(embeddings[index] ?? [], Number);
            if (!vector.length || vector.some(value => !Number.isFinite(value))) {
                throw new Error(`Embedding provider returned an invalid vector for item ${index + 1}`);
            }

            store.put({
                id: `${collectionKey}:${item.hash}`,
                collectionKey,
                collectionId,
                hash: item.hash,
                text: item.text,
                metadata: item.metadata ?? {},
                vector,
                updatedAt: Date.now(),
            });
        });

        await transactionToPromise(transaction);
        logger.log(`Stored ${pendingItems.length} browser vectors in ${collectionId}`);
    }

    async queryCollection(collectionId, searchText, topK, threshold = 0.25, signal = null) {
        this.assertAvailable();
        const records = await this.getCollectionRecords(collectionId);
        if (records.length === 0) {
            return { hashes: [], metadata: [], items: [], similarities: [] };
        }

        if (!String(searchText ?? '').trim() || Number(topK) <= 0) {
            return this.formatQueryResult(records.map(record => ({ record, score: 1 })), topK);
        }

        const [queryVector] = await this.embedTexts([String(searchText)], signal);
        const scored = records
            .map(record => ({ record, score: cosineSimilarity(queryVector, record.vector) }))
            .filter(result => result.score >= Number(threshold ?? -1))
            .sort((left, right) => right.score - left.score);

        return this.formatQueryResult(scored, topK);
    }

    async getVectorTexts(collectionId, hashes) {
        const hashSet = new Set(hashes);
        const records = await this.getCollectionRecords(collectionId);
        return records
            .filter(record => hashSet.has(record.hash))
            .map(record => {
                const decoded = decodeStoredText(record.text);
                return {
                    hash: record.hash,
                    text: decoded.text,
                    metadata: {
                        ...(record.metadata ?? {}),
                        ...decoded.metadata,
                    },
                };
            });
    }

    async getAllVectorData(collectionId) {
        const records = await this.getCollectionRecords(collectionId);
        return records.map(record => ({
            hash: record.hash,
            text: record.text,
            metadata: record.metadata ?? {},
            vector: record.vector,
        }));
    }

    async purgeVectorIndex(collectionId) {
        this.assertAvailable();
        // Purge every source/model partition for this logical collection. This
        // prevents orphaned data when a task is deleted after changing models.
        const database = await this.openDatabase();
        const readTransaction = database.transaction(STORE_NAME, 'readonly');
        const records = await requestToPromise(
            readTransaction.objectStore(STORE_NAME).index(COLLECTION_ID_INDEX).getAll(collectionId),
        );
        if (records.length === 0) {
            return true;
        }

        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        records.forEach(record => store.delete(record.id));
        await transactionToPromise(transaction);
        return true;
    }

    formatQueryResult(scoredRecords, topK) {
        const numericTopK = Number(topK);
        const selected = numericTopK > 0 ? scoredRecords.slice(0, numericTopK) : scoredRecords;
        return {
            hashes: selected.map(({ record }) => record.hash),
            similarities: selected.map(({ score }) => score),
            metadata: selected.map(({ record, score }) => {
                const decoded = decodeStoredText(record.text);
                return {
                    ...(record.metadata ?? {}),
                    ...decoded.metadata,
                    decodedType: decoded.metadata.type,
                    decodedOriginalIndex: decoded.metadata.originalIndex,
                    hash: record.hash,
                    text: decoded.text,
                    score,
                };
            }),
            items: selected.map(({ record, score }) => {
                const decoded = decodeStoredText(record.text);
                return {
                    hash: record.hash,
                    text: decoded.text,
                    score,
                    metadata: {
                        ...(record.metadata ?? {}),
                        ...decoded.metadata,
                    },
                };
            }),
        };
    }

    async getCollectionRecords(collectionId) {
        this.assertAvailable();
        const database = await this.openDatabase();
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const index = transaction.objectStore(STORE_NAME).index(COLLECTION_INDEX);
        return requestToPromise(index.getAll(this.getCollectionKey(collectionId)));
    }

    getCollectionKey(collectionId) {
        return `${this.getSourceFingerprint()}::${collectionId}`;
    }

    getSourceFingerprint() {
        const source = this.settings?.source;
        switch (source) {
            case 'ollama':
                return JSON.stringify([source, this.getOllamaUrl(), this.settings?.ollama_model ?? '']);
            case 'vllm':
                return JSON.stringify([source, this.getVllmUrl(), this.settings?.vllm_model ?? '']);
            case 'webllm':
                return JSON.stringify([source, this.settings?.webllm_model ?? 'auto']);
            case 'koboldcpp':
                return JSON.stringify([source, this.getKoboldCppUrl()]);
            default:
                return JSON.stringify([source ?? 'unknown']);
        }
    }

    async embedTexts(texts, signal) {
        this.assertSourceSupported();
        this.throwIfAborted(signal);

        switch (this.settings.source) {
            case 'ollama':
                return this.embedWithOllama(texts, signal);
            case 'vllm':
                return this.embedWithVllm(texts, signal);
            case 'webllm':
                return this.embedWithWebLlm(texts, signal);
            case 'koboldcpp':
                return this.embedWithKoboldCpp(texts, signal);
            default:
                throw new Error(`Unsupported browser embedding source: ${this.settings.source}`);
        }
    }

    async embedWithOllama(texts, signal) {
        const model = String(this.settings?.ollama_model ?? '').trim();
        if (!model) {
            throw new Error('Ollama model is not configured');
        }

        const response = await fetch(`${this.getOllamaUrl()}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                input: texts,
                keep_alive: this.settings?.ollama_keep ? -1 : undefined,
            }),
            signal,
        });
        if ([404, 405].includes(response.status)) {
            return this.embedWithLegacyOllama(texts, signal);
        }

        const payload = await this.readJsonResponse(response, 'Ollama embeddings');
        if (Array.isArray(payload.embeddings)) {
            return payload.embeddings;
        }
        if (Array.isArray(payload.embedding) && texts.length === 1) {
            return [payload.embedding];
        }
        throw new Error('Ollama returned no embeddings');
    }

    async embedWithLegacyOllama(texts, signal) {
        const vectors = [];
        for (const prompt of texts) {
            this.throwIfAborted(signal);
            const response = await fetch(`${this.getOllamaUrl()}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.settings.ollama_model,
                    prompt,
                    keep_alive: this.settings?.ollama_keep ? -1 : undefined,
                }),
                signal,
            });
            const payload = await this.readJsonResponse(response, 'Ollama legacy embeddings');
            if (!Array.isArray(payload.embedding)) {
                throw new Error('Ollama legacy endpoint returned no embedding');
            }
            vectors.push(payload.embedding);
        }
        return vectors;
    }

    async embedWithVllm(texts, signal) {
        const model = String(this.settings?.vllm_model ?? '').trim();
        if (!model) {
            throw new Error('vLLM model is not configured');
        }

        const apiKey = String(this.settings?.vllm_api_key
            || this.textgenerationwebuiSettings?.api_key_vllm
            || '').trim();
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await fetch(buildVllmEmbeddingsUrl(this.getVllmUrl()), {
            method: 'POST',
            headers,
            body: JSON.stringify({ model, input: texts }),
            signal,
        });
        const payload = await this.readJsonResponse(response, 'vLLM embeddings');
        if (!Array.isArray(payload.data)) {
            throw new Error('vLLM returned no embedding data');
        }
        return payload.data
            .slice()
            .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
            .map(item => item.embedding);
    }

    async embedWithWebLlm(texts, signal) {
        this.throwIfAborted(signal);
        const llm = this.scope?.SillyTavern?.llm;
        if (!llm || typeof llm.getEngine !== 'function' || typeof llm.getEmbeddingModels !== 'function') {
            throw new Error('WebLLM embedding extension is not available in this host');
        }

        const models = llm.getEmbeddingModels();
        const configuredModel = String(this.settings?.webllm_model ?? '').trim();
        const model = configuredModel || models?.[0]?.id;
        if (!model) {
            throw new Error('No WebLLM embedding model is available');
        }

        if (!this.webLlmEngine) {
            this.webLlmEngine = llm.getEngine();
        }
        if (this.webLlmModel !== model) {
            await this.webLlmEngine.loadModel(model);
            this.webLlmModel = model;
        }
        this.throwIfAborted(signal);
        return this.webLlmEngine.generateEmbedding(texts);
    }

    async embedWithKoboldCpp(texts, signal) {
        const endpoint = `${this.getKoboldCppUrl()}/api/extra/embeddings`;
        const vectors = [];
        for (const text of texts) {
            this.throwIfAborted(signal);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
                signal,
            });
            const payload = await this.readJsonResponse(response, 'KoboldCpp embeddings');
            const vector = payload.embedding ?? payload.embeddings?.[0];
            if (!Array.isArray(vector)) {
                throw new Error('KoboldCpp returned no embedding');
            }
            vectors.push(vector);
        }
        return vectors;
    }

    getOllamaUrl() {
        return trimTrailingSlash(
            this.settings?.ollama_url
            || this.textgenerationwebuiSettings?.server_urls?.[this.textgenTypes?.OLLAMA]
            || 'http://localhost:11434',
        );
    }

    getVllmUrl() {
        return trimTrailingSlash(
            this.settings?.vllm_url
            || this.textgenerationwebuiSettings?.server_urls?.[this.textgenTypes?.VLLM],
        );
    }

    getKoboldCppUrl() {
        const url = trimTrailingSlash(
            this.textgenerationwebuiSettings?.server_urls?.[this.textgenTypes?.KOBOLDCPP],
        );
        if (!url) {
            throw new Error('KoboldCpp URL is not configured in Text Completion settings');
        }
        return url;
    }

    async readJsonResponse(response, label) {
        let payload = null;
        try {
            payload = await response.json();
        } catch {
            // The status error below remains more useful than a JSON parse error.
        }
        if (!response.ok) {
            const detail = payload?.error?.message || payload?.error || payload?.message || response.statusText;
            throw new Error(`${label} failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
        }
        return payload ?? {};
    }

    assertAvailable() {
        if (!this.indexedDB) {
            throw new Error('Browser vector fallback requires IndexedDB, but IndexedDB is unavailable');
        }
    }

    assertSourceSupported() {
        const source = this.settings?.source;
        if (!SUPPORTED_SOURCES.has(source)) {
            const supported = [...SUPPORTED_SOURCES].join(', ');
            throw new Error(
                `TauriTavern native vector storage is unavailable and source "${source}" cannot run in the browser fallback. `
                + `Choose one of: ${supported}.`,
            );
        }
    }

    throwIfAborted(signal) {
        if (signal?.aborted) {
            throw new DOMException('The operation was aborted', 'AbortError');
        }
    }

    openDatabase() {
        this.assertAvailable();
        if (!this.databasePromise) {
            this.databasePromise = new Promise((resolve, reject) => {
                const request = this.indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    const store = database.objectStoreNames.contains(STORE_NAME)
                        ? request.transaction.objectStore(STORE_NAME)
                        : database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    if (!store.indexNames.contains(COLLECTION_INDEX)) {
                        store.createIndex(COLLECTION_INDEX, COLLECTION_INDEX, { unique: false });
                    }
                    if (!store.indexNames.contains(COLLECTION_ID_INDEX)) {
                        store.createIndex(COLLECTION_ID_INDEX, COLLECTION_ID_INDEX, { unique: false });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    this.databasePromise = null;
                    reject(request.error ?? new Error('Unable to open browser vector database'));
                };
                request.onblocked = () => logger.warn('Browser vector database upgrade is blocked by another window');
            });
        }
        return this.databasePromise;
    }
}
