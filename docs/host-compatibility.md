# Host compatibility

Vectors Enhanced uses one codebase for SillyTavern and TauriTavern. It does not ship a separate TauriTavern entry point.

## Runtime detection

The extension detects TauriTavern through runtime markers exposed by the host (`__TAURI_RUNNING__`, `__TAURITAVERN__`, `__TAURITAVERN_MAIN_READY__`, or the Tauri invoke bridge). It does not inspect the user agent.

Feature code should prefer capability checks over host-name checks. Runtime detection is centralized in `src/compat/HostRuntime.js`.

## Vector storage behavior

### SillyTavern

SillyTavern continues to use its native `/api/vector/*` API. The compatibility work does not change its storage format or normal request path.

### TauriTavern

The current TauriTavern native backend registers `/api/vector/*`, but responds with HTTP 501 and the cause `vector_endpoint_unavailable`. Vectors Enhanced therefore uses this sequence:

1. Call the native vector API normally.
2. Keep using it if the response is supported.
3. If TauriTavern returns HTTP 404, 405, or 501, switch the current session to the browser vector backend.
4. Store and query vectors in IndexedDB.

The fallback is only constructed in TauriTavern. A SillyTavern server error therefore cannot silently move existing users to another storage backend.

Browser vectors are partitioned by embedding source, endpoint, and model. Changing any of these settings intentionally exposes an empty logical collection and requires re-vectorization. This prevents vectors with different dimensions from being mixed.

## Sources in TauriTavern compatibility mode

| Source | Status | Notes |
|---|---|---|
| Ollama | Supported | Calls `/api/embed` directly. The Ollama server must allow the Tauri WebView origin. |
| vLLM | Supported | Calls the OpenAI-compatible `/v1/embeddings` endpoint directly. |
| WebLLM | Supported when installed | Requires a WebLLM extension exposing `SillyTavern.llm`. An empty model field selects the first embedding model. |
| KoboldCpp | Experimental | Calls `/api/extra/embeddings` through the URL configured in Text Completion settings. |
| Transformers | Not supported by fallback | The existing implementation depends on the SillyTavern server vector backend. Select another source in TauriTavern. |

Remote embedding servers may require CORS/origin configuration. This is a provider configuration issue; the extension does not weaken TauriTavern network security.

## Other host contracts

The plugin currently relies on these host features, all present in the checked TauriTavern source baseline:

- third-party manifest, JavaScript, CSS, and relative static resources;
- SillyTavern-compatible frontend module paths;
- extension settings and event APIs;
- chat, attachment, popup, slash command, and world-info frontend exports;
- `/api/secrets/write`;
- `/api/backends/chat-completions/generate` and `/status`;
- `/api/worldinfo/get`, `/edit`, and `/delete`.

TauriTavern does not support extension branch switching. Vectors Enhanced does not depend on that API at runtime.

## Validation

From the plugin repository:

```bash
node --test tests/compat.test.mjs
node scripts/check-host-contract.mjs
```

The contract checker expects sibling repositories by default:

```text
../SillyTavern
../TauriTavern
```

Alternative paths can be supplied explicitly:

```bash
node scripts/check-host-contract.mjs \
  --sillytavern /path/to/SillyTavern \
  --tauritavern /path/to/TauriTavern
```

The checker validates frontend module paths and named exports, required Tauri routes, and the presence of the browser fallback while TauriTavern reports its native vector backend as unavailable.

## Manual test checklist

Static checks cannot validate WebView and provider behavior. Before release, test at least:

1. Install and enable the extension in both hosts.
2. Open the settings panel and switch through every vector source.
3. In SillyTavern, insert and query a small collection through the native vector backend.
4. In TauriTavern, confirm the first vector operation logs the HTTP 501 fallback once.
5. In TauriTavern, insert, query, restart the app, and query again to verify IndexedDB persistence.
6. Change the model and confirm old vectors are not mixed with the new model.
7. Purge and rebuild a collection.
8. Test world-info memory creation and chat saving.
9. Test Windows first, then Android/iOS separately because WebView capabilities differ.
