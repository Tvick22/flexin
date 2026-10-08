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

## Auth (email + password)

| Endpoint | |
| --- | --- |
| `POST /auth/signup` | `{ email, password }` → 201, tokens + user (`isNewUser: true`); 409 if the email exists |
| `POST /auth/login` | `{ email, password }` → tokens + user; 401 "Incorrect email or password." |
| `POST /auth/refresh` | `{ refreshToken }` → new pair (the old refresh token is spent) |
| `POST /auth/logout` | `{ refreshToken }` → 204 |
| `GET` / `PATCH /me` | Profile; onboarding sets `name` + `handle` (`onboarded` turns true) |
| `GET /handles/{handle}` | Availability check while picking a handle |

- Passwords: 8–128 characters, no other composition rules (NIST 800-63B). Stored as
  Argon2id hashes; old hashes are upgraded on the next successful login.
- Emails are unique ignoring case. Login gives the same error (and takes the same time)
  for an unknown email and a wrong password, so it can't be used to find accounts.
- Send the access token as `Authorization: Bearer <accessToken>`. Access tokens last
  15 minutes; refresh before `expiresIn` runs out. Reusing a spent refresh token signs
  the user out everywhere (it means the token was copied).
- Not built yet: password reset (needs an email service), change password, and rate
  limiting on login.

Config (`backend/.env`): `JWT_SECRET`. With `ENVIRONMENT=production` the server refuses
to start with the development `JWT_SECRET`.

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
  models/        ORM models: users, sessions
  routers/       HTTP endpoints: health, auth, me
  services/      business logic (sign-in, session rotation)
  schemas.py     request/response models (camelCase JSON)
  deps.py        CurrentUser (bearer auth)
  passwords.py   Argon2id password hashing
  security.py    access tokens and refresh token hashing
  codes.py       friend code alphabet/generator (matches the app)
migrations/      Alembic (async)
tests/
```
