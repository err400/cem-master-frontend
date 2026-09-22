# cem-master-frontend

The **public interactive map & dashboard** for the Continuous Ecological Monitoring (CEM) network.

A lightweight, plain HTML/JS/CSS client using Leaflet for spatial visualization. It provides a read-only catalogue of monitoring spots, species search, 24-hour diurnal activity heatmaps, soundscape indices, raw audio recording playback, and an instant 9-second bird call audio snippet player.

---

## This repo does not start itself

There is no `compose.yaml` in this repository. In alignment with cluster service standards (CoreStack Item #6), the entire master stack (PostgreSQL, FastAPI unified app, and background indexer) is started and owned by **[cem-master-backend](../cem-master-backend)**:

```bash
cd ../cem-master-backend
./scripts/dev-up.sh -d
```

Then open <http://localhost:8000> in your browser.

> **Single Web Container**: The backend container mounts this directory to `/app/frontend:ro` and serves both the frontend HTML/JS/CSS on `/` and the REST API on `/api/v1/` from the same origin on port `8000`.

---

## Same-Origin Architecture

The browser talks directly to `http://localhost:8000`:

```text
Browser (http://localhost:8000)
   │
   ▼
Unified App (FastAPI :8000)
   ├── Serves index.html, /styles, /js, /leaflet
   ├── Handles REST API (/api/v1/spots, /api/v1/species, etc.)
   ├── Serves dynamic /runtime-debug.js
   └── Streams 9-second WAV audio clips
```

- Because the UI and API are served from the same container and origin, no CORS proxying or separate web server container is required.
- `GET /health` and `GET /backend-health` report service and database health.
- If pointing the frontend to an external backend, `API_BASE_URL` in `js/config.js` can be overridden.

---

## Directory Mounts & Editing

`index.html`, `js/`, `styles/`, and `leaflet/` are mounted into the unified application container read-only:

| Host Folder | Container Path | Purpose & Lifecycle |
| :--- | :--- | :--- |
| `index.html`, `js/`, `styles/`, `leaflet/` | `/app/frontend:ro` | Frontend assets, served directly by FastAPI on `/`. |

- **Live edits**: HTML, CSS, and JS edits take effect immediately upon browser refresh (or `docker compose restart backend`).


---

## What the Dashboard Shows

1. **Interactive Leaflet Map**:
   - Spot markers clustered and color-coded by detection intensity.
   - **Spiderweb Expansion**: Spots from multiple projects sharing the same GPS coordinates spiderfy into separate project pins on click/zoom.
2. **Species Search & Discovery**:
   - Search by common or scientific bird name with instant autocomplete suggestions.
   - Unveils spots where that bird was detected.
3. **9-Second Audio Snippet Player**:
   - **Global Showcase**: Left sidebar plays the network-wide highest confidence 9s focal call clip for the selected species.
   - **Spot Inventory Table**: Every bird row in the spot inventory has a `[ 9s ]` play button for auditioning calls recorded at that spot.
   - **Spot Observation Banner**: Representative focal call clip in the spot species view.
4. **Bioacoustic & Temporal Analytics**:
   - **Species Diurnal Activity**: 24-hour bar chart displaying calling activity across the day (00:00 to 23:00).
   - **24-Hour Species Heatmap Matrix**: Normalized hourly activity for the top 20 most active birds at a spot.
   - **Occurrence Time Series**: Daily detection timeline graph.
   - **Soundscape Indices**: ACI (Acoustic Complexity), ADI (Diversity), AEI (Evenness), NDSI, Bioacoustic Index.
   - **Seasonal & Solar Metrics**: SCI (Seasonal Concentration), PMR (Peak-to-Median Ratio), Kurtosis, sunrise correlation.
5. **Raw Audio Recordings Browser**:
   - Paginated list of full audio recordings with visual sound wave progress and playback.
6. **Analysis Jobs & Provocative Provenance**:
   - Lists completed analysis runs with downloadable results via FileBrowser share links (`FILEBROWSER_PUBLIC_URL`).

---

## Code Structure

```text
cem-master-frontend/
├── index.html              Single-page application layout
├── js/
│   ├── config.js           Fallback API configuration (CEM_MASTER_CONFIG)
│   ├── main.js             Core UI rendering, event handling, and audio player
│   ├── features/
│   │   └── MapManager.js   Leaflet map setup, custom markers, and spiderfy clustering
│   └── services/
│       ├── DashboardService.js  REST client for /api/v1/species, /spots, /recordings
│       └── SpotsService.js      REST client for GeoJSON spot features
├── styles/
│   └── style.css           Vanilla CSS design system (earth tones, glassmorphism, responsive)
└── leaflet/                Local Leaflet map library and assets
```

---

## Logging & DevTools Diagnostics

Set `LOG_LEVEL=debug` (or `DEBUG=true`) in `cem-master-backend/.env` and recreate the stack (`./scripts/dev-up.sh -d`) to enable verbose frontend diagnostics.

- **Console Diagnostics**: FastAPI dynamically serves `/runtime-debug.js` and `/js/config.js` at runtime. Opening browser DevTools Console (with the *Verbose* level enabled) outputs request timing, API status codes, missing snippet alerts, and audio playback stalls.
- **Client-Side Overrides**:
  - Temporary (tab-only): `globalThis.DEBUG = true`
  - Persistent (local storage): `localStorage.setItem('DEBUG', 'true')`
  - Reset to environment: `delete globalThis.DEBUG; localStorage.removeItem('DEBUG')`
- See [`DEBUGGING.md`](DEBUGGING.md) for detailed frontend tracing tips.

---

## Output Retention Policy

Because the frontend is a pure static asset client served by the unified backend container, compute outputs and log retention policies under `data/` are centrally defined and owned in **[`cem-master-backend/outputs.yaml`](../cem-master-backend/outputs.yaml)**.



