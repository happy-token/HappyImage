# HS Deployment Notes

This document records the consolidated HappyImage deployment layout on the `hs` server.

## Directory Layout

All HappyImage runtime files should live under one root:

```text
/opt/happytoken/happyimage/
  happyimage-api/       happyimage-api source and Dockerfile
  happyimage-web/       happyimage-web source and Dockerfile
  data/
    api/                API runtime JSON data, images, thumbnails, logs
    config.json         API config mounted to /app/config.json
    seed-gallery/       Web static gallery package mounted read-only
  docs/                 deployment notes and handoff docs
  deploy/hs/docker-compose.yml  combined deployment container orchestration
```

Older scattered locations that may still exist during migration:

```text
/root/home/happy/happyimage-api/
/root/home/happy/happyimage-web/
/opt/happyimage/
```

Do not delete older locations until the new stack has passed smoke tests and a backup has been kept.

After the 2026-06-23 HS cleanup, the old scattered working directories were removed and the active runtime source is `/opt/happytoken/happyimage`.

## Services

`deploy/hs/docker-compose.yml` starts the runtime containers from configured images:

| Service | Container | Host port | Internal port | Purpose |
|:--|:--|:--|:--|:--|
| API | `happytoken-api` | `127.0.0.1:8001` | `80` | Auth, OIDC, image tasks, private images, settings, admin-managed runtime config |
| Web | `happytoken-web` | `0.0.0.0:3000` | `3000` | Next.js frontend and same-origin middleware |

The Web container proxies only `/api/*`, `/health`, `/images/*`, and `/image-thumbnails/*` to `http://happytoken-api:80` through Next middleware. Model calls go through `/api/image-tasks/*` to HappyImage API, then API uses the current user's selected provider/NewAPI Base URL. Caddy can continue forwarding public HTTP traffic to host port `3000`.

For the test server, do not use `hs` as a frontend image build machine. The backend should be tested as a Docker container from a pulled or loaded image. The frontend is planned for Cloudflare deployment; validate frontend changes with local or CI builds, then publish through the frontend release path. The `happytoken-web` container on `hs` is only a temporary integration entry point.

## Environment And Runtime Settings

The combined deployment does not need a `.env` file by default. Create one in the workspace root only when overriding storage, database, ports, or image names. Those values are infrastructure-only and must not carry moved runtime settings into the API container.

The API no longer reads a private env file from `deploy/hs/docker-compose.yml`; the compose file passes only explicit infrastructure environment values. Runtime application settings are managed in first-run `/setup`, admin `/settings`, or `data/config.json`.

Do not use the old private file:

```text
/opt/happytoken/happyimage/happyimage-api/.env
```

Moved runtime settings include public app/API URLs, session/cookie settings, OIDC, model gateway/NewAPI binding, proxy, image storage, and safety settings. Keep them in setup/admin settings or `data/config.json`, not as `HAPPYTOKEN_*` runtime env.

Allowed infrastructure examples:

```bash
STORAGE_BACKEND=json
DATABASE_URL=
HAPPYTOKEN_API_PORT=127.0.0.1:8001
HAPPYTOKEN_WEB_PORT=3000
HAPPYTOKEN_API_IMAGE=ghcr.io/happy-token/happyimage-api:latest
HAPPYTOKEN_WEB_IMAGE=ghcr.io/happy-token/happyimage-web:latest
```

They can also be passed inline to Compose:

```bash
STORAGE_BACKEND=postgres \
DATABASE_URL=postgresql://user:password@postgres.example.com:5432/happyimage \
docker compose -f deploy/hs/docker-compose.yml up -d
```

For the temporary HS test entry point, configure public app URL, optional public API URL, session secret, OIDC and CORS through `/setup` or admin `/settings`. Keep the frontend URL, API URL, and Casdoor callback on the same browser origin so the callback response stores `happytoken_session` on the origin the frontend will use afterward.

The Casdoor application must allow:

```text
http://101.96.195.224:3000/api/auth/oidc/callback
```

Do not configure NewAPI SQL provisioning with `127.0.0.1:15433` from inside the API container. In Docker, `127.0.0.1` is the `happytoken-api` container itself. In `/setup` or admin `/settings`, use the database service name on the Docker network for `model_gateway.sql_dsn`.

## Data Locations

API data:

```text
/opt/happytoken/happyimage/data/api/
```

This directory contains user/account JSON data, image task history, generated images, thumbnails, logs, and local storage files. Back it up before migration and before destructive cleanup.

API config:

```text
/opt/happytoken/happyimage/data/config.json
```

Mounted into the API container as `/app/config.json`.

Web static gallery:

```text
/opt/happytoken/happyimage/data/seed-gallery/
```

This is mounted into the Web container as `/app/web/public/seed-gallery:ro`. The local development copy is currently about 1.4 GiB and can grow toward 1.8 GiB, so deployment servers need enough free disk before syncing it. The gallery is excluded from the Web Docker build context and should be managed as runtime data, not baked into the image.

## Commands

From the server:

```bash
cd /opt/happytoken/happyimage
mkdir -p data/api data/seed-gallery
test -f data/config.json || cp happyimage-api/config.example.json data/config.json

# The API and Web default images are pullable from GHCR.
docker compose -f deploy/hs/docker-compose.yml pull
docker compose -f deploy/hs/docker-compose.yml up -d
docker compose -f deploy/hs/docker-compose.yml ps
curl -fsS 'http://127.0.0.1:8001/health?format=json'
curl -I -fsS 'http://127.0.0.1:3000/login'
curl -I -fsS 'http://127.0.0.1:3000/settings/newapi'
```

Do not let Docker create `data/config.json` as a directory: create the parent `data/` directories and copy `config.example.json` before the first `up`.

If GHCR images are private, configure `docker login ghcr.io` on the server first.

Temporary test ports can be used before cutting over:

```bash
HAPPYTOKEN_API_PORT=127.0.0.1:18001 HAPPYTOKEN_WEB_PORT=13000 docker compose -f deploy/hs/docker-compose.yml up -d
```

## Operational Notes

- Keep Caddy data and unrelated services outside this directory.
- Do not run `docker system prune --volumes` unless all volume contents have been audited.
- Safe cleanup on the small HS root disk is usually limited to Docker build cache, dangling images, and exited containers.
- The root disk was previously full; check `df -h /` before rebuilding images or syncing the static gallery.

## 2026-06-23 HS Migration Record

Smoke-tested endpoints after cutover:

```bash
curl -fsS 'http://127.0.0.1/health?format=json'
curl -I -fsS 'http://127.0.0.1/login'
curl -I -fsS 'http://127.0.0.1/settings/newapi'
curl -fsS 'http://127.0.0.1/seed-gallery/static/items.json'
```

Expected runtime containers:

```text
happytoken-api  -> 127.0.0.1:8001
happytoken-web  -> 0.0.0.0:3000
caddy           -> public 80/443, forwards to Web
```

The root disk was cleaned from 100% used to about 59% used by removing Docker build cache, stopped legacy containers/images, and old scattered HappyImage directories after the consolidated stack passed smoke tests.
