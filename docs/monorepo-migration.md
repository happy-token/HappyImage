# HappyImage Monorepo Migration

HappyImage is now a single monorepo with separate service directories:

```text
api/  former happyimage-api repository
web/  former happyimage-web repository
```

Both service histories were imported with `git subtree add`, so service history remains in the repository graph. Useful checks:

```bash
git log --oneline --graph --all
git log --oneline happyimage-api-local/main
git log --oneline happyimage-web-local/main
```

The runtime boundary did not change:

```text
/api/*, /images/*, /image-thumbnails/*, /health -> api
/seed-gallery/*                                  -> web static assets
```

Use root commands for local development:

```bash
make api-dev
make web-dev
make dev
make test
make typecheck
make compose-config
```

Service-native commands still work:

```bash
cd api && uv run python main.py
cd web && pnpm run dev
```

Large gallery source data is not committed to Git. Keep local gallery source under `data/gallery-source` or pass an explicit path:

```bash
cd web
pnpm run gallery:build -- --source-dir=/path/to/happyimage-gallery-source --api-dir=../api
```
