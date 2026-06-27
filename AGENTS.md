# HappyImage

HappyImage is a monorepo with separate backend and frontend services.

## Layout

- `api/`: FastAPI backend for auth, OIDC, image tasks, user data, private images, settings, logs, and NewAPI/HappyToken binding.
- `web/`: Next.js frontend, same-origin middleware, image workspace, settings, gallery, and static seed gallery host.
- `deploy/`: combined deployment files.
- `docs/`: product, deployment, and migration documentation.
- `data/`: local runtime data, ignored by Git.

## Local Commands

Use the local helper script for the combined dev workflow:

```bash
scripts/dev-local.sh
```

Service-native commands remain valid for focused work:

```bash
cd api && uv run python main.py
cd web && pnpm run dev
cd api && uv run python -m pytest -q
cd web && pnpm exec tsc --noEmit
docker compose -f deploy/hs/docker-compose.yml config
```

## Boundaries

Keep API and Web code separated. Do not move backend persistence or auth logic into `web/`, and do not move page rendering or Next.js middleware into `api/`.

Request routing remains:

```text
/api/*, /images/*, /image-thumbnails/*, /health -> api
/seed-gallery/*                                  -> web static assets
```

Keep runtime secrets, generated data, image stores, and migration backups out of Git.
