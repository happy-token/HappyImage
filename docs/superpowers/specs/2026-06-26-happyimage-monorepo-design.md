# HappyImage Monorepo Design

## Goal

Merge `api` and `web` into one `HappyImage` repository while keeping backend and frontend code separated. The merged repository must preserve both existing Git histories and make local debugging, cross-service changes, CI, and deployment easier to operate.

## Current State

`/Users/forever/workspace/HappyImage` already acts like a product workspace, but it is not yet a Git repository. It contains:

- `api/`: FastAPI backend repository.
- `web/`: Next.js frontend repository.
- `deploy/hs/docker-compose.yml`: combined Web/API deployment.
- `docs/`: shared deployment and product documentation.
- `README.md`: shared workspace overview.

The root README and deployment compose already describe the services as one product. The main gap is that source control, CI, and local workflow still live across separate repositories.

## Recommended Approach

Create `HappyImage` as the root monorepo and import the two existing repositories with `git subtree add`:

```bash
git subtree add --prefix=api <happyimage-api-repo> <branch>
git subtree add --prefix=web <happyimage-web-repo> <branch>
```

This preserves both histories while moving the code into clear service directories. It avoids submodule friction and avoids the extra risk of rewriting history with `git filter-repo`.

## Repository Layout

The final repository should use this structure:

```text
HappyImage/
  api/                 # former happyimage-api repository
  web/                 # former happyimage-web repository
  deploy/              # combined deployment files
  docs/                # shared product, deployment, and migration docs
  scripts/             # root-level developer workflow scripts
  data/                # local runtime data, ignored by Git
  tmp/                 # temporary migration backup area, ignored by Git
  README.md            # monorepo overview
  Makefile             # root developer commands
```

Before importing, move the current root contents into a timestamped temporary directory such as:

```text
tmp/monorepo-migration-YYYYMMDD-HHMMSS/
```

Then import the API and Web repositories into `api/` and `web/`. Restore shared root files such as `README.md`, `deploy/`, and `docs/` from the temporary backup after the subtree imports.

The official source directories should be `api/` and `web/`, not `api/` and `web/`. This keeps paths short and makes the repository shape read as a single product.

## Service Boundaries

The merge must not blur runtime responsibilities.

`api/` remains responsible for:

- FastAPI product backend.
- Authentication and OIDC.
- User data, image task history, private image storage, logs, setup, and runtime settings.
- NewAPI/HappyToken binding.
- Calling the selected model provider on behalf of the product workflow.

`web/` remains responsible for:

- Next.js UI.
- Same-origin middleware.
- Image workspace, gallery, setup, settings, and admin pages.
- Static official gallery package hosting from `public/seed-gallery`.

The request boundary remains:

```text
/api/*, /images/*, /image-thumbnails/*, /health -> api
/seed-gallery/*                                  -> web static assets
```

## Local Development

The root repository should add lightweight commands instead of introducing a heavy monorepo framework.

Expected commands:

```bash
make api-dev
make web-dev
make dev
make test
make typecheck
```

`api-dev` should run the backend from `api/` with `uv`.

`web-dev` should run the frontend from `web/` with `pnpm`, using:

```bash
BACKEND_URL=http://127.0.0.1:8000
```

`dev` should start both services for local debugging. API defaults to `127.0.0.1:8000`; Web defaults to `0.0.0.0:3000`.

The existing service-native workflows remain valid:

```bash
cd api && uv run python main.py
cd web && pnpm run dev
```

## Deployment And Docker

Keep the two images separate:

- `ghcr.io/happy-token/happyimage-api`
- `ghcr.io/happy-token/happyimage-web`

Keep Dockerfiles inside their service directories:

```text
api/Dockerfile
web/Dockerfile
```

Update combined compose files to use root-relative paths:

```text
./data/api          -> /app/data
./data/config.json  -> /app/config.json
./data/seed-gallery -> /app/web/public/seed-gallery
```

`deploy/hs/docker-compose.yml` should continue to run API and Web as separate services. The monorepo changes paths, not service ownership.

## CI

Move workflows to the root `.github/workflows/` directory and scope them by path.

API image workflow:

- Trigger on `api/**`, shared deployment files that affect API, and the workflow file.
- Use `context: ./api`.
- Use `file: ./api/Dockerfile`.

Web image workflow:

- Trigger on `web/**`, shared deployment files that affect Web, and the workflow file.
- Use `context: ./web`.
- Use `file: ./web/Dockerfile`.

Cloudflare Web deployment workflow:

- Trigger on `web/**`, Cloudflare/OpenNext files, and the workflow file.
- Run `pnpm` commands with `working-directory: ./web`.

This keeps CI fast and prevents unrelated service changes from rebuilding both images.

## Ignore Rules And Runtime Data

Create a root `.gitignore` that ignores:

- `data/`
- `tmp/`
- `.env*`
- Python caches and virtual environments.
- Node dependencies and build output.
- OpenNext and Wrangler output.
- local editor and OS files.

Keep actual runtime config out of Git:

```text
data/config.json
api/config.json
api/.env
web/.env*
```

Keep `api/config.example.json` committed as the template. Keep official gallery generated output and large source data outside normal Git history unless a later design explicitly scopes gallery data migration.

## Migration Safety

The migration should be reversible during the working session:

1. Confirm both child repositories are clean or record their dirty state.
2. Create a timestamped backup under `tmp/`.
3. Initialize or reuse the root `HappyImage` Git repository.
4. Import API history into `api/`.
5. Import Web history into `web/`.
6. Restore shared root files.
7. Add root `.gitignore`, README updates, Makefile, workflow path updates, and compose path updates.
8. Verify history, build commands, tests, and compose config.

If a child repository has uncommitted work, do not discard it. Either commit it in the child repository before import or preserve it in the migration backup and reapply it after import.

## Verification

After migration, run:

```bash
git log --oneline -- api | head
git log --oneline -- web | head
cd api && uv run python -m pytest -q
cd web && pnpm exec tsc --noEmit
docker compose -f deploy/hs/docker-compose.yml config
```

Successful verification means:

- API and Web histories are visible under their new paths.
- Backend tests pass.
- Frontend typecheck passes.
- Combined compose resolves with the new root-relative paths.
- Local commands still allow independent API and Web development.

## Out Of Scope

This migration does not:

- Merge API and Web into one runtime service.
- Move business logic between backend and frontend.
- Replace `uv` or `pnpm`.
- Introduce Turborepo, Nx, or another monorepo framework.
- Move large official gallery source data into Git.
- Change public domains, auth behavior, model gateway behavior, or runtime settings semantics.
