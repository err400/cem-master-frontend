# CEM Master Web Application

Public bioacoustic dashboard for clustered monitoring spots, species discovery,
date filtering, spot exploration, ecological summaries, and analysis job links.

## Architecture

```text
Browser
  -> frontend container (Nginx)
       -> /api proxy
            -> backend container (FastAPI)
                 -> cem-database container (PostgreSQL)
```

The frontend and backend repositories must be beside one another:

```text
main-website/
├── cem-master/
└── cem-master-backend/
```

PostgreSQL is separately managed. Its Docker service must be named
`cem-database`, contain the schema expected by the backend, and join the shared
network `cem_master_network`.

## Configure and run

Create the shared network once if it does not already exist:

```bash
docker network create cem_master_network
```

Copy the environment template:

```bash
cp .env.example .env
```

Set the real PostgreSQL credentials in `.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://cem_user:strong-password@cem-database:5432/cem_master
```

Start `cem-database` first, then run from this repository:

```bash
docker compose up --build -d
```

Open:

- Dashboard: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8001/docs`
- Proxied health: `http://127.0.0.1:8000/backend-health`

Verify the complete connection:

```bash
docker network inspect cem_master_network
docker compose ps
docker compose logs -f backend
curl http://127.0.0.1:8000/backend-health
curl http://127.0.0.1:8000/api/v1/spots
```

The health endpoint queries PostgreSQL. It returns HTTP 503 when the backend is
running but `cem-database` is unavailable.

## How API forwarding works

The browser requests the frontend origin:

```text
http://127.0.0.1:8000/api/v1/spots
```

Nginx forwards `/api/*` through the Docker network to:

```text
http://backend:8001/api/v1/spots
```

The backend queries `cem-database` and sends JSON back along the same path. The
browser never needs to resolve Docker hostnames.

## Mounted frontend source

Compose bind-mounts `index.html`, `js/`, `styles/`, and `leaflet/` read-only
into Nginx. It also bind-mounts the backend `app/` directory and runs Uvicorn
reload. Source edits appear without rebuilding; dependency, Dockerfile, Compose,
or Nginx changes require a rebuild.

PostgreSQL persistence belongs to the independently managed `cem-database`
deployment. Stopping or removing these application containers does not remove
its data volume.

## Commands

```bash
docker compose stop
docker compose start
docker compose down
docker compose up --build -d
docker compose logs -f
```

Do not use `docker compose down -v` in the database project unless you intend to
delete its PostgreSQL volume.

## Main capabilities

- Clustered Leaflet spots
- Search by common or scientific bird name
- Exact daily date filters
- Detection-scaled map markers and active-spot rankings
- Spot bird inventory and threatened-species richness
- Migration class, activity hours, and seasonality
- Hourly, daily, and monthly activity data
- Acoustic, habitat, solar, and weather analysis fields
- Analysis-job input/output filenames and public URLs
