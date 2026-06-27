# HappyImage Monorepo Migration

HappyImage is now a single monorepo with separate service directories:

```text
api/  former happyimage-api repository
web/  former happyimage-web repository
```

Both service histories were imported with `git subtree add`, so service history remains in the repository graph. Useful checks:

```bash
git log --oneline --graph --all
git log --oneline --graph --all --max-count=40
```

The runtime boundary did not change:

```text
/api/*, /images/*, /image-thumbnails/*, /health -> api
/seed-gallery/*                                  -> web static assets
```

Use the local helper script for the combined dev workflow:

```bash
scripts/dev-local.sh
```

Service-native commands still work for focused work:

```bash
cd api && uv run python main.py
cd web && pnpm run dev
cd api && uv run python -m pytest -q
cd web && pnpm exec tsc --noEmit
docker compose -f deploy/hs/docker-compose.yml config
```

Large gallery source data is not committed to Git. Keep local gallery source under `data/gallery-source` or pass an explicit path:

```bash
cd web
pnpm run gallery:build -- --source-dir=/path/to/happyimage-gallery-source --api-dir=../api
```
