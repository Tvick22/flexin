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

## Auth (Sign in with Apple / Google)

The app signs in with Apple or Google natively, then sends the provider's ID token here.
The server verifies it against the provider's published keys and returns its own tokens.

| Endpoint | |
| --- | --- |
| `POST /auth/apple` | `{ identityToken, nonce?, givenName?, familyName? }` → tokens + user |
| `POST /auth/google` | `{ idToken, nonce? }` → tokens + user |
| `POST /auth/refresh` | `{ refreshToken }` → new pair (the old refresh token is spent) |
| `POST /auth/logout` | `{ refreshToken }` → 204 |
| `GET` / `PATCH /me` | Profile; onboarding sets `name` + `handle` (`onboarded` turns true) |
| `GET /handles/{handle}` | Availability check while picking a handle |

Send the access token as `Authorization: Bearer <accessToken>`. Access tokens last
15 minutes; refresh before `expiresIn` runs out. Reusing a spent refresh token signs
the user out everywhere (it means the token was copied).

Config (`backend/.env`): `APPLE_CLIENT_IDS` (iOS bundle id), `GOOGLE_CLIENT_IDS`
(OAuth client ids; must include the **web** client ID, which is the audience of the
ID tokens the app gets), `JWT_SECRET`.

`POST /auth/dev { email }` signs in as a test account with no provider. It exists only
when `ENVIRONMENT=development`, so the app can be developed on web/simulators before
Apple/Google credentials are set up. With `ENVIRONMENT=production` the server refuses to
start with the development `JWT_SECRET`.

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
  models/        ORM models: users, auth_identities, sessions
  routers/       HTTP endpoints: health, auth, me
  services/      business logic (sign-in, session rotation)
  schemas.py     request/response models (camelCase JSON)
  deps.py        CurrentUser (bearer auth) and the ID token verifier
  id_tokens.py   Apple/Google ID token verification
  security.py    our access tokens and refresh token hashing
  codes.py       friend code alphabet/generator (matches the app)
migrations/      Alembic (async)
tests/
```
