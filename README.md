# cem-master-frontend

The **public map page** — the read-only catalogue of monitoring spots, species
and analysis jobs. No login.

Plain HTML/JS/CSS plus Leaflet, served by nginx. No build step.

## This repo does not start itself

There is no `compose.yaml` here. It was removed deliberately.

The master stack is started from **[cem-master-backend](../cem-master-backend)**,
which owns every service in it — PostgreSQL, the API, the indexer, and this page:

```bash
cd ../cem-master-backend
./scripts/dev-up.sh -d
```

Then open <http://localhost:8000>.

**Why one owner.** This repo used to define a `backend` service as well, and the
problems were concrete: both files published port 8001, so running both failed —
or worse, left you talking to a backend you did not think you were talking to;
the two definitions drifted; and the backend defined here had no database, so it
failed its health check and the frontend, gated on `service_healthy`, never
started at all. The fix was one owner per service. Moving the frontend service
into `cem-master-backend` finishes that job: one compose file per stack.

The two repos must be checked out **side by side**, because the compose file
builds this one at `../cem-master-frontend`:

```text
your-workspace/
├── cem-master-backend/     <- start here
└── cem-master-frontend/    <- this repo
```

Set `MASTER_FRONTEND_CONTEXT` in `cem-master-backend/.env` if your layout
differs.

## How API calls reach the backend

The browser only ever talks to its own origin:

```text
http://localhost:8000/api/v1/spots
```

nginx forwards `/api/*` across the Docker network:

```text
http://backend:8001/api/v1/spots
```

`backend` is a Docker DNS name on `cem_master_network`, resolvable only inside
it. The browser never needs to know it exists, and there is no CORS to configure
because everything is same-origin.

`GET /backend-health` proxies the API's health check, which queries PostgreSQL —
it returns 503 when the API is up but the database is not.

**The page deliberately does not wait for the API.** There is no
`depends_on: service_healthy` on this service. If the backend is down the page
still loads and its calls return 502, because a visible error is easier to
diagnose than a container that silently refuses to start.

## Editing

`index.html`, `js/`, `styles/` and `leaflet/` are bind-mounted read-only, so
source edits need a restart, not a rebuild:

```bash
cd ../cem-master-backend && docker compose restart frontend
```

Changes to `nginx.conf` or `Dockerfile` do need `--build`.

## What the page shows

- Leaflet map with marker clustering, sized and coloured by detection count
- Search by common or scientific name; only spots with that bird stay lit
- Date-range filtering
- Per-spot: species inventory, threatened-species richness, activity rank
- Per-species-at-spot: hourly / daily / monthly activity, confidence, first and
  last detection, migration class, seasonality
- Acoustic indices, and solar/weather analysis fields where present
- Analysis jobs, with input and output filenames and download links

Analysis job **Output URL** links are FileBrowser share links. They appear only
when `FILEBROWSER_PUBLIC_URL` is set on the indexer — blank means outputs are
named but not linked, which is the safe default. See
`cem-master-backend/INDEXING-PLAN.md` §4.3a. **Input URL is always empty**: the
compute app shares results only, never inputs.

## Layout

```
index.html              single page
js/main.js              rendering, map, tables
js/services/            DashboardService — the API client
js/features/            map and panel features
nginx.conf              static serving + /api/ proxy to backend:8001
```

## Related

- [cem-master-backend](../cem-master-backend) — API, indexer, and the compose file that starts this
- [cem-backend](../cem-backend) — compute API that produces the data
- [cem-frontend](../cem-frontend) — the compute page
