# CEM Master Frontend

Static public discovery website for CEM Master Phase 1.

## Local Setup

Serve the directory with any static file server:

```bash
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000`.

The backend should be running at `http://127.0.0.1:8001` by default.

## API Configuration

Runtime API configuration lives in `js/config.js`:

```js
window.CEM_MASTER_CONFIG = {
  API_BASE_URL: "http://127.0.0.1:8001",
};
```

For Render deployment, update `API_BASE_URL` to the deployed backend origin, for example:

```js
API_BASE_URL: "https://cem-master-backend.onrender.com"
```

The frontend uses the public spot, species, and dashboard endpoints under
`${API_BASE_URL}/api/v1`.

## Phase 1 Features

- Header with `CEM Master`
- `Do Your Own CEM` button linking to `https://cem-cloud.onrender.com/`
- Leaflet map with OpenStreetMap tiles
- Clustered markers that separate as the user zooms in
- Bird search with common/scientific-name suggestions
- Species metadata and IUCN status panel
- All-spots and species-filtered map modes
- Context-sensitive bird-diversity and species-at-location analysis panels
- Loading, empty, and error states

## Leaflet Assets

Leaflet JavaScript, CSS, and marker images are stored locally under `leaflet/`. They were copied from the existing CEM compute frontend so this static site can deploy independently without runtime imports from another repository.

Marker clustering currently loads Leaflet.markercluster 1.5.3 from unpkg. The
base Leaflet library and marker images remain stored locally.
