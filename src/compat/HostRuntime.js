const TAURI_HOST_MARKERS = [
    '__TAURI_RUNNING__',
    '__TAURITAVERN__',
    '__TAURITAVERN_MAIN_READY__',
    '__TAURI_INTERNALS__',
];

/**
 * Detects the current host without relying on the user agent.
 * Capability checks are intentionally kept separate from host detection so
 * future SillyTavern-compatible hosts can reuse the same code paths.
 *
 * @param {typeof globalThis} [scope]
 */
export function detectHostRuntime(scope = globalThis) {
    const windowLike = scope.window ?? scope;
    const isTauriTavern = TAURI_HOST_MARKERS.some(key => windowLike?.[key] !== undefined)
        || typeof windowLike?.__TAURI__?.core?.invoke === 'function';

    const runtime = {
        host: isTauriTavern ? 'tauritavern' : 'sillytavern',
        isTauriTavern,
        isSillyTavern: !isTauriTavern,
        // Current TauriTavern releases expose /api/vector/* but return 501.
        // StorageAdapter probes the route and only activates this fallback when
        // the host confirms that the native vector backend is unavailable.
        canFallbackToBrowserVectors: isTauriTavern,
        capabilities: {
            indexedDb: typeof windowLike?.indexedDB !== 'undefined',
            moduleWorker: typeof windowLike?.Worker === 'function',
            webGpu: Boolean(windowLike?.navigator?.gpu),
            webLlm: typeof windowLike?.SillyTavern?.llm?.getEngine === 'function',
            tauriExtensionStore: Boolean(windowLike?.__TAURITAVERN__?.api?.extension?.store),
        },
    };

    return Object.freeze({
        ...runtime,
        capabilities: Object.freeze(runtime.capabilities),
    });
}

/**
 * Emits one compact startup diagnostic without exposing secrets or user data.
 *
 * @param {ReturnType<typeof detectHostRuntime>} runtime
 * @param {Pick<Console, 'info'>} [logger]
 */
export function logHostRuntime(runtime, logger = console) {
    logger.info('[Vectors Enhanced] Host compatibility:', {
        host: runtime.host,
        browserVectorFallback: runtime.canFallbackToBrowserVectors,
        capabilities: runtime.capabilities,
    });
}
