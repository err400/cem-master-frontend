# CEM Master Frontend

The public CEM map and biodiversity dashboard, built with HTML, JavaScript, CSS,
and Leaflet. It displays monitoring spots, species search, detection summaries,
activity charts, acoustic indices, raw recording playback, and available bird
call snippets and analysis links.

## Local setup links

- [Local setup guide](https://github.com/err400/cem-master-backend/blob/main/docs/local-setup.md)
- [Full setup and environment guide](https://github.com/err400/cem-master-backend/blob/main/CEM_SETUP_GUIDE.md)


## Run the website

Follow the [complete setup guide](https://github.com/err400/cem-master-backend/blob/main/CEM_SETUP_GUIDE.md)
in `cem-master-backend`. The backend's Compose stack mounts this checkout at
`/frontend` and serves both the website and API on **http://localhost:8000**.
This repository has no standalone Compose stack. Its legacy `FRONTEND_PORT`
example is not used by the unified master deployment.

## Architecture

```mermaid
flowchart LR
    Browser["User browser<br/>http://localhost:8000"]

    subgraph Runtime["Docker runtime"]
        App["backend service<br/>FastAPI on port 8000<br/>serves UI and API<br/>no separate frontend container"]
        Indexer["indexer service<br/>watch mode<br/>builds catalog rollups"]
    end

    subgraph MountedCode["Mounted code"]
        BackendCode["cem-master-backend<br/>mounted at /app<br/>read only"]
        FrontendCode["cem-master-frontend<br/>mounted at /frontend<br/>read only"]
    end

    subgraph HostData["Host data"]
        Projects["data/projects<br/>shared compute projects<br/>original WAVs, outputs and snippets<br/>master reads at /data"]
        Logs["data/logs/cem-master-backend<br/>app.log<br/>LOG_LEVEL: debug / info / error"]
        Retention["outputs.yaml<br/>public: projects, no TTL<br/>private_persistent: logs, no TTL<br/>delete: scratch, 7 days"]
    end

    subgraph SharedServices["Shared services"]
        Compute["compute service<br/>analysis and Make Public"]
        DB[("central PostgreSQL<br/>cem_master")]
        FileBrowser["optional FileBrowser<br/>download UI"]
        DataService["external host data service<br/>not started by Compose"]
    end

    Compute -->|"write results and project visibility"| Projects

    Browser -->|"same origin UI"| App
    Browser -->|"same origin API"| App

    BackendCode -->|"application code"| App
    BackendCode -->|"indexer code"| Indexer
    FrontendCode -->|"static assets"| App

    App -->|"read audio and job metadata"| Projects
    App -->|"write application logs"| Logs
    App -->|"query catalog"| DB

    Indexer -->|"read public projects"| Projects
    Indexer -->|"write rollup tables"| DB
    Indexer -->|"write indexer logs"| Logs

    Browser -.->|"download links"| FileBrowser
    FileBrowser -->|"serves project outputs"| Projects

    Retention -.->|"policy file: requires host integration"| DataService
    DataService -.->|"publish or keep or delete"| Projects
    DataService -.->|"preserve logs"| Logs

    classDef client fill:#f5f7ff,stroke:#6d77c8,color:#1f2555
    classDef container fill:#e8f2ff,stroke:#2f6fed,color:#10233f
    classDef code fill:#f3ecff,stroke:#7d4cc2,color:#291642
    classDef storage fill:#edf7ed,stroke:#4d9f4d,color:#173817
    classDef service fill:#fff4df,stroke:#c47f00,color:#3f2a00

    class Browser client
    class App,Indexer container
    class BackendCode,FrontendCode code
    class Projects,Logs,Retention storage
    class DB,FileBrowser,DataService,Compute service
```

The API serves the master UI and catalogue on one port; the separate indexer
reads public compute projects and writes PostgreSQL rollups. Both master services
mount the shared data read-only, with a writable nested log directory. Original
WAVs must remain available in that mount for recording playback.

The diagram shows central PostgreSQL for cluster deployment; the local overlay
supplies a development database. FileBrowser is optional. The external host data
service must be provisioned separately: `outputs.yaml` declares policy but
Compose does not enforce it. Master uses no model weights. Compute's execution
branches, model-mount gap and optional Drive/GEE integrations are described in
[its architecture](https://github.com/err400/cem-backend/blob/master/README.md#architecture).

## Directory Mounts & Editing

`index.html`, `js/`, `styles/`, and `leaflet/` are mounted into the unified application container read-only:

| Host Folder | Container Path | Purpose & Lifecycle |
| :--- | :--- | :--- |
| `index.html`, `js/`, `styles/`, `leaflet/` | `/frontend:ro` | Frontend assets, served directly by FastAPI on `/`. |

- **Live edits**: HTML, CSS, and JS edits take effect immediately upon browser refresh .

## What the Dashboard Shows

1. **Interactive Leaflet Map**:
   - Spot markers clustered and color-coded by detection intensity.
   - **Spiderweb Expansion**: Spots from multiple projects sharing the same GPS coordinates spiderfy into separate project pins on click/zoom.
2. **Species Search & Discovery**:
   - Search by common or scientific bird name with instant autocomplete suggestions.
   - Unveils spots where that bird was detected.
3. **9-Second Audio Snippet Player**:
   - **Global Showcase**: Left sidebar plays the network-wide highest confidence 9s focal call clip for the selected species.
   - **Spot Inventory Table**: Bird rows with an available snippet have a `[ 9s ]` play button for auditioning calls recorded at that spot.
   - **Spot Observation Banner**: Representative focal call clip in the spot species view.
4. **Bioacoustic & Temporal Analytics**:
   - **Species Diurnal Activity**: 24-hour bar chart displaying calling activity across the day (00:00 to 23:00).
   - **24-Hour Species Heatmap Matrix**: Normalized hourly activity for the top 20 most active birds at a spot.
   - **Occurrence Time Series**: Daily detection timeline graph.
   - **Soundscape Indices**: ACI (Acoustic Complexity), ADI (Diversity), AEI (Evenness), NDSI, Bioacoustic Index.
   - **Seasonal & Solar Metrics**: SCI (Seasonal Concentration), PMR (Peak-to-Median Ratio), Kurtosis, sunrise correlation.
5. **Raw Audio Recordings Browser**:
   - Paginated list of full audio recordings with visual sound wave progress and playback.
6. **Analysis Jobs & Provenance**:
   - Lists completed analysis runs with downloadable results via FileBrowser share links (`FILEBROWSER_PUBLIC_URL`).

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

## Deployment configuration

Website: https://www.cse.iitd.ernet.in/act4dws5/bio-master/

Set these in the master backend's private `.env` for the current deployed proxy:

```dotenv
API_BASE_URL=https://www.cse.iitd.ernet.in/act4dws5/bio-master/api
COMPUTE_FRONTEND_URL=https://www.cse.iitd.ernet.in/act4dws5/bio/
BACKEND_CORS_ORIGINS=https://www.cse.iitd.ernet.in
```

FastAPI serves runtime browser configuration at `/js/config.js`, overriding the
checked-in fallback. The proxy must expose that route under the website prefix.
API JSON requests and audio URLs must preserve the configured API base; a leading
`/api/v1/...` media path must not discard the deployment prefix.

## Editing and tests

`index.html` contains the layout, `js/main.js` renders the dashboard and players,
`js/services/` calls the API, `js/features/MapManager.js` manages the map, and
`styles/style.css` supplies styles. The bundled Leaflet assets are in `leaflet/`.

With the current bind mount, asset changes appear after browser refresh. An
image-based release must package the assets. No database migration is needed
for frontend-only edits.

With Node.js installed:

```bash
node --test tests/*.test.mjs
```

## Troubleshooting

Use [DEBUGGING.md](https://github.com/err400/cem-master-frontend/blob/main/DEBUGGING.md) for browser diagnostics. If recordings are listed
but do not play, inspect the actual audio request in DevTools Network: confirm
the deployment prefix and an audio response. `Audio file not found` means the
backend could not locate the WAV in its data mount; metadata alone is not enough.
Download links require both compute-created shares and master
`FILEBROWSER_PUBLIC_URL`; blank configuration means output names without links.

Compute owns original recordings and job-output retention. The master frontend
does not implement its own output retention policy.

## Logging & DevTools Diagnostics

Set `LOG_LEVEL=debug` or `DEBUG=true` in the master backend's `.env`, recreate
its configured stack, and refresh the browser. FastAPI serves runtime flags and
browser configuration dynamically. In DevTools Console, enable Verbose output.

Temporary override: `globalThis.DEBUG = true`. Persistent override:
`localStorage.setItem('DEBUG', 'true')`. Reset with
`delete globalThis.DEBUG; localStorage.removeItem('DEBUG')`.
See [DEBUGGING.md](https://github.com/err400/cem-master-frontend/blob/main/DEBUGGING.md) for request and audio diagnostics.

## Output Retention Policy

The frontend is a static client; storage policies are owned by backend/compute.
[Master outputs.yaml](https://github.com/err400/cem-master-backend/blob/main/outputs.yaml) declares lifecycle
policies for a separately configured cluster host data service. Local Compose
does not enforce that file. Compute's retention worker manages its job outputs.
