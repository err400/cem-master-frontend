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

The frontend fetches only `${API_BASE_URL}/api/v1/spots`.

## Render

This is a static site. Suggested Render settings:

- Build command: none
- Publish directory: `.`
- Add/update `js/config.js` with the deployed backend URL before deployment.

## Phase 1 Features

- Header with `CEM Master`
- `Do Your Own CEM` button linking to `https://cem-cloud.onrender.com/`
- Leaflet map with OpenStreetMap tiles
- Markers and popups for backend GeoJSON spot features
- Loading, empty, and error states

## Leaflet Assets

Leaflet JavaScript, CSS, and marker images are stored locally under `leaflet/`. They were copied from the existing CEM compute frontend so this static site can deploy independently without runtime imports from another repository.
