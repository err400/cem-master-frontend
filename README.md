# CEM Master Web Application

Public bioacoustic discovery dashboard for browsing monitoring spots, searching
species, filtering detections by date, and opening spot/species analyses. This
repository contains the static frontend and the combined Docker Compose file;
the FastAPI repository must be beside it.

## Required directory layout

```text
main-website/
├── cem-master/
└── cem-master-backend/
```

## Prerequisites

- Docker Desktop with Compose, or Docker Engine plus the Compose plugin
- Docker Desktop WSL integration enabled when running commands from WSL
- Internet access for the OpenStreetMap tiles and currently CDN-hosted marker
  clustering assets

## Quick start

From `cem-master`:

```bash
docker compose up --build -d
```

The stack starts in this order:

1. `backend` starts FastAPI and creates missing SQLite tables.
2. `seed` idempotently adds four sample spots and their bioacoustic records.
3. `frontend` starts Nginx after seeding succeeds.

Open:

- Dashboard: `http://127.0.0.1:8000`
- Backend API documentation: `http://127.0.0.1:8001/docs`
- Proxied health check: `http://127.0.0.1:8000/backend-health`

The one-shot `seed` container normally appears as `Exited (0)` after startup;
that means it completed successfully.

## Verify frontend-to-backend communication

```bash
docker compose ps -a
docker compose logs seed
curl http://127.0.0.1:8000/backend-health
curl http://127.0.0.1:8000/api/v1/spots
```

The health response should be `{"status":"ok"}`, and the spots endpoint should
return a GeoJSON `FeatureCollection`.

## How the connection works

```text
Browser
  └─ http://host:8000/api/...
       └─ frontend container (Nginx)
            └─ http://backend:8001/api/...
                 └─ backend container (FastAPI)
                      └─ SQLite volume or PostgreSQL container
```

Both application containers join the private Docker bridge named
`cem_master_network`. The browser never resolves the Docker hostname `backend`.
It calls the frontend origin, and Nginx proxies `/api/` internally.

Runtime frontend configuration is in `js/config.js`:

```js
window.CEM_MASTER_CONFIG = {
  API_BASE_URL: window.location.origin,
};
```

There is no frontend demo-data fallback; displayed application data comes from
the backend database.

## Mounted files and persistent data

Compose bind-mounts the frontend `index.html`, `js/`, `styles/`, and `leaflet/`
paths read-only. It also mounts backend `app/` and `scripts/` read-only and runs
Uvicorn with reload enabled. Source edits are therefore visible without an image
rebuild. Dependency or Docker/Nginx configuration changes require a rebuild.

The development SQLite database is stored in the named volume:

```text
cem_master_backend_data
```

It survives container replacement and `docker compose down`.

## Common commands

```bash
# View status and logs
docker compose ps -a
docker compose logs -f

# Stop containers but retain them
docker compose stop

# Start stopped containers
docker compose start

# Remove containers and the bridge, while retaining database data
docker compose down

# Rebuild after Dockerfile, dependency, or nginx.conf changes
docker compose up --build -d

# Rerun the sample seed manually
docker compose run --rm seed
```

To permanently erase the development SQLite volume, first stop the stack and
then remove it explicitly:

```bash
docker compose down
docker volume rm cem_master_backend_data
```

This deletion cannot be undone.

## Configuration

Copy `.env.example` to `.env` to override ports, CORS origins, the write API key,
or the database connection:

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Local `.env` files are ignored by Git.

## Using a separately managed PostgreSQL container

The backend already includes SQLAlchemy PostgreSQL support and the Psycopg
driver. Application queries and API routes do not need to change. The database
container must:

1. Be running before the backend connects.
2. Join the external Docker network `cem_master_network`.
3. Persist `/var/lib/postgresql/data` in its own named volume.
4. Have credentials matching `BACKEND_DATABASE_URL`.

An example separate PostgreSQL Compose file is:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: cem_master
      POSTGRES_USER: cem_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - cem-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cem_user -d cem_master"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:

networks:
  cem-network:
    external: true
    name: cem_master_network
```

Run the application Compose stack once before the separate PostgreSQL Compose
stack so Docker has created `cem_master_network`. The PostgreSQL Compose file
then treats that network as external and joins it.

Set these values in `cem-master/.env`:

```dotenv
POSTGRES_PASSWORD=replace-with-a-strong-password
BACKEND_DATABASE_URL=postgresql+psycopg://cem_user:replace-with-a-strong-password@postgres:5432/cem_master
```

Start PostgreSQL first, then recreate the application stack. Inside Docker the
hostname is the PostgreSQL service name `postgres`, not `localhost`.

The current `seed` service will put sample records into whichever database
`BACKEND_DATABASE_URL` selects. Remove the `seed` service and change the
frontend dependency to the backend health check before a production deployment
that must contain only real data.

For an initially empty PostgreSQL database, SQLAlchemy currently creates the
tables at backend startup. Add Alembic migrations before evolving a populated
production schema.

## Main capabilities

- Clustered Leaflet monitoring spots
- Common/scientific-name species search
- Exact daily date filtering
- Detection-scaled markers and active-spot rankings
- Spot bird inventories and threatened-species richness
- Hourly activity and occurrence time series
- Acoustic, habitat, solar, and weather analysis fields
- Analysis job input/output filenames and URLs
