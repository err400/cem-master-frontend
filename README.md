# cem-master-frontend

The **public interactive map & dashboard** for the Continuous Ecological Monitoring (CEM) network.

A lightweight, plain HTML/JS/CSS client using Leaflet for spatial visualization, served via Nginx. It provides a read-only catalogue of monitoring spots, species search, 24-hour diurnal activity heatmaps, soundscape indices, raw audio recording playback, and an instant 9-second bird call audio snippet player.

---

## This repo does not start itself

There is no `compose.yaml` in this repository. The entire master stack (PostgreSQL, FastAPI backend, indexer, and this frontend) is started and owned by **[cem-master-backend](../cem-master-backend)**:

```bash
cd ../cem-master-backend
./scripts/dev-up.sh -d
```

Then open <http://localhost:8000> in your browser.

> **Why one owner**: Having one compose file in `cem-master-backend` prevents configuration drift and port conflicts. The two repositories must be checked out **side by side**:
> ```text
> your-workspace/
> ├── cem-master-backend/     <- start here
> └── cem-master-frontend/    <- this repo
> ```

---

## How API Calls Reach the Backend

The browser only ever talks to its own origin (`http://localhost:8000`):

```text
Browser (http://localhost:8000/api/v1/spots)
   │
   ▼
Nginx (:8000)
   │  (internal Docker network proxy)
   ▼
Backend (http://backend:8001/api/v1/spots)
```

- Nginx reverse-proxies all `/api/*` calls directly to `backend:8001` over the internal Docker network.
- `GET /backend-health` proxies the API database health check.
- Because everything is same-origin, no CORS configuration is needed by default.
- If pointing the frontend to an external backend, `API_BASE_URL` in `js/config.js` or `.env` can be configured.

---

## Directory Mounts & Editing

`index.html`, `js/`, `styles/`, and `leaflet/` are bind-mounted into the Nginx container read-only:

| Host Folder | Container Path | Purpose & Lifecycle |
| :--- | :--- | :--- |
| `index.html`, `js/`, `styles/`, `leaflet/` | `/usr/share/nginx/html:ro` | Frontend assets. Live-edited on host. |

- **Live edits**: HTML, CSS, and JS edits take effect immediately upon browser refresh (or `docker compose restart frontend`).
- Rebuild is only necessary if `Dockerfile` or `nginx.conf` is modified.

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
│   ├── config.js           Runtime API configuration (CEM_MASTER_CONFIG)
│   ├── main.js             Core UI rendering, event handling, and audio player
│   ├── features/
│   │   └── MapManager.js   Leaflet map setup, custom markers, and spiderfy clustering
│   └── services/
│       ├── DashboardService.js  REST client for /api/v1/species, /spots, /recordings
│       └── SpotsService.js      REST client for GeoJSON spot features
├── styles/
│   └── style.css           Vanilla CSS design system (earth tones, glassmorphism, responsive)
├── leaflet/                Local Leaflet map library and assets
└── nginx.conf              Nginx web server configuration & /api/ proxy
```

---

## Logging & DevTools Diagnostics

Set `LOG_LEVEL=debug` (or `DEBUG=true`) in `cem-master-backend/.env` and recreate the stack (`./scripts/dev-up.sh -d`) to enable verbose frontend diagnostics.

- **Console Diagnostics**: Docker generates `/runtime-debug.js` on startup. Opening browser DevTools Console (with the *Verbose* level enabled) outputs request timing, API status codes, missing snippet alerts, and audio playback stalls.
- **Client-Side Overrides**:
  - Temporary (tab-only): `globalThis.DEBUG = true`
  - Persistent (local storage): `localStorage.setItem('DEBUG', 'true')`
  - Reset to environment: `delete globalThis.DEBUG; localStorage.removeItem('DEBUG')`
- See [`DEBUGGING.md`](DEBUGGING.md) for detailed frontend tracing tips.

---

## Output Retention (`outputs.yaml`)

- **`data/projects/`** (`mode: public`): Public map assets, detection summaries, and 9s audio clips.
- **`data/logs/cem-master-frontend/`** (`mode: private_persistent`): Nginx access and error logs.
- **`data/scratch/`** (`mode: delete`, `ttl_days: 7`): Ephemeral build files deleted after 7 days.
