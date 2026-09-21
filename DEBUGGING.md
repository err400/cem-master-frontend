# Logging & Diagnostics

## Enabling Frontend Diagnostics

Set `LOG_LEVEL=debug` (or `DEBUG=true`) in the sibling `cem-master-backend/.env`, then recreate the containers with `docker compose up -d`.

This frontend is started by `cem-master-backend`'s Compose configuration.
Docker generates `/runtime-debug.js` at container startup with a boolean switch. Refresh the browser page after changing the environment setting. `LOG_LEVEL=info` (`DEBUG=false`) is the default.

## Browser Console Diagnostics

When enabled, diagnostics appear in the browser DevTools Console (ensure the **Verbose** level is enabled in DevTools):
- **API Request Tracing**: Request ID, method, path, response status, and round-trip milliseconds (`http.start`, `http.finish`, `http.error`). Request diagnostics omit sensitive payloads and query strings.
- **9-Second Audio Snippet Player**: Traces snippet audio availability, format validation, playback state transitions, stalls, and buffer errors (`snippet.loaded`, `snippet.play`, `snippet.pause`, `snippet.error`).
- **Map & Spatial Events**: Spot clustering, spiderfy expansion, and species selection state.

## Client-Side Overrides (DevTools)

For a temporary per-tab override directly in DevTools console:
```js
globalThis.DEBUG = true;   // or false
```

For a persistent override across page refreshes:
```js
localStorage.setItem('DEBUG', 'true');
```

To clear client overrides and follow the server `LOG_LEVEL` environment variable again:
```js
delete globalThis.DEBUG;
localStorage.removeItem('DEBUG');
localStorage.removeItem('debug');
```

### Precedence:
1. Per-tab override (`globalThis.DEBUG`)
2. Local storage override (`localStorage.DEBUG`)
3. Server environment (`LOG_LEVEL=debug` or `DEBUG=true` via `/runtime-debug.js`)


