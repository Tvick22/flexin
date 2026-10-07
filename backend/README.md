# Flexin' API

FastAPI + PostgreSQL backend for the Flexin' app (the Expo app lives at the repo root).
REST for friends and challenges; a WebSocket per live challenge (planned).

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python + dependency manager; installs Python 3.12 for you)
- Docker Desktop (for local Postgres)

## First-time setup

From the repo root:

```bash
cp backend/.env.example backend/.env
cd backend && uv sync
```

## Run it

```bash
npm run db        # start Postgres in Docker (backend/docker-compose.yml)
npm run api       # FastAPI with auto-reload on http://localhost:8000
```

Then open http://localhost:8000/docs for the interactive API docs.
`/health` checks the process; `/health/db` checks the database connection.

To reach the API from a phone on the same Wi-Fi, use `npm run api:lan` (binds to
`0.0.0.0`) and point the app at your Mac's IP (see "Connecting the app").

## Tests and linting

```bash
npm run api:test
cd backend && uv run ruff check . && uv run ruff format .
```

## Database migrations (Alembic)

Models go in `app/models/` and must be imported in `app/models/__init__.py`.

```bash
cd backend
uv run alembic revision --autogenerate -m "create users"   # after changing models
uv run alembic upgrade head                                  # apply
```

## Connecting the app

The app reads `EXPO_PUBLIC_API_URL` (see `.env.example` at the repo root). Put your
value in `.env.local` (gitignored), since it differs per machine:

| Where the app runs  | EXPO_PUBLIC_API_URL            |
| ------------------- | ------------------------------ |
| Web, iOS simulator  | `http://localhost:8000`        |
| Android emulator    | `http://10.0.2.2:8000`         |
| Your phone          | `http://<your-mac-ip>:8000`    |

## Layout

```
app/
  main.py        FastAPI app, CORS, routers
  config.py      settings from env vars / backend/.env
  db.py          async SQLAlchemy engine, session dependency, Base
  models/        ORM models (none yet)
  routers/       one module per area (health so far)
migrations/      Alembic (async)
tests/
```
