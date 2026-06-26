# HappyImage Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/Users/forever/workspace/HappyImage` into the single `HappyImage` monorepo, preserving `happyimage-api` and `happyimage-web` Git histories under `api/` and `web/`.

**Architecture:** Use root Git history for shared workspace files, then import both existing repositories with `git subtree add --prefix`. Keep runtime services separate, with root-level scripts, ignore rules, docs, CI, and compose files updated for `api/` and `web/` paths.

**Tech Stack:** Git subtree, FastAPI with `uv`, Next.js with `pnpm`, Docker Compose, GitHub Actions, Makefile.

---

## File Structure

Create or modify these files:

- Create: `/Users/forever/workspace/HappyImage/.gitignore`  
  Responsibility: root ignore rules for monorepo runtime data, temp backups, env files, and Python/Node build output.
- Create: `/Users/forever/workspace/HappyImage/Makefile`  
  Responsibility: root developer commands for starting and validating API/Web.
- Modify: `/Users/forever/workspace/HappyImage/README.md`  
  Responsibility: describe final monorepo layout and root development commands.
- Modify: `/Users/forever/workspace/HappyImage/deploy/hs/docker-compose.yml`  
  Responsibility: keep combined deployment root-relative after import.
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/api-docker-publish.yml`  
  Responsibility: publish API image from `api/` paths.
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/web-docker-publish.yml`  
  Responsibility: publish Web image from `web/` paths.
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/web-cloudflare-deploy.yml`  
  Responsibility: deploy Web from `web/` working directory.
- Modify: `/Users/forever/workspace/HappyImage/web/scripts/build-seed-gallery.mjs`  
  Responsibility: update default gallery source and API script paths after moving Web to `web/`.
- Modify: `/Users/forever/workspace/HappyImage/web/README.md`  
  Responsibility: update examples that reference `../happyimage-api` to `../api`.
- Modify: `/Users/forever/workspace/HappyImage/api/README.md`  
  Responsibility: update repository references from separate repo to monorepo path.
- Create: `/Users/forever/workspace/HappyImage/docs/monorepo-migration.md`  
  Responsibility: record what was migrated, how history was preserved, and how to verify.

Temporary files/directories during migration:

- Create: `/Users/forever/workspace/HappyImage/tmp/monorepo-migration-YYYYMMDD-HHMMSS/`  
  Responsibility: backup current root contents before moving them out of the way.
- Remove before final commit if empty: `/Users/forever/workspace/HappyImage/tmp/monorepo-migration-YYYYMMDD-HHMMSS/`  
  If it contains local-only runtime data or dirty work, keep it ignored and mention it in the handoff.

---

### Task 1: Preflight State Capture

**Files:**
- Read: `/Users/forever/workspace/HappyImage/docs/superpowers/specs/2026-06-26-happyimage-monorepo-design.md`
- Read: `/Users/forever/workspace/HappyImage/happyimage-api`
- Read: `/Users/forever/workspace/HappyImage/happyimage-web`

- [ ] **Step 1: Confirm root, API, and Web Git state**

Run:

```bash
cd /Users/forever/workspace/HappyImage
pwd
git status --short
git -C happyimage-api status --short
git -C happyimage-web status --short
git -C happyimage-api branch --show-current
git -C happyimage-web branch --show-current
```

Expected:

```text
/Users/forever/workspace/HappyImage
```

Root may show untracked workspace files because the root repository is new. API and Web should be clean or their dirty files must be listed for preservation before continuing.

- [ ] **Step 2: Record current HEADs and remotes**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git rev-parse HEAD
git -C happyimage-api rev-parse HEAD
git -C happyimage-web rev-parse HEAD
git -C happyimage-api remote -v
git -C happyimage-web remote -v
```

Expected: one root commit SHA for the spec commit, one API SHA, one Web SHA, and remote URLs for the child repositories.

- [ ] **Step 3: Stop if API or Web has uncommitted work**

Run:

```bash
cd /Users/forever/workspace/HappyImage
test -z "$(git -C happyimage-api status --porcelain)" || {
  echo "happyimage-api has uncommitted changes. Commit or preserve them before subtree import." >&2
  git -C happyimage-api status --short >&2
  exit 1
}
test -z "$(git -C happyimage-web status --porcelain)" || {
  echo "happyimage-web has uncommitted changes. Commit or preserve them before subtree import." >&2
  git -C happyimage-web status --short >&2
  exit 1
}
```

Expected: command exits successfully with no output. If it fails, do not continue until the dirty child repository state is intentionally handled.

- [ ] **Step 4: Commit plan document**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add docs/superpowers/plans/2026-06-26-happyimage-monorepo-migration.md
git commit -m "docs: plan happyimage monorepo migration"
```

Expected: a commit that adds this implementation plan.

---

### Task 2: Backup Current Workspace And Clear Import Paths

**Files:**
- Move: `/Users/forever/workspace/HappyImage/happyimage-api`
- Move: `/Users/forever/workspace/HappyImage/happyimage-web`
- Move: `/Users/forever/workspace/HappyImage/README.md`
- Move: `/Users/forever/workspace/HappyImage/deploy`
- Move: `/Users/forever/workspace/HappyImage/prompts`
- Move: `/Users/forever/workspace/HappyImage/happyimage-gallery-source`
- Move: `/Users/forever/workspace/HappyImage/arch.png`
- Keep: `/Users/forever/workspace/HappyImage/.git`
- Keep: `/Users/forever/workspace/HappyImage/docs/superpowers`

- [ ] **Step 1: Create migration backup directory**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="tmp/monorepo-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
printf '%s\n' "$BACKUP_DIR" > /tmp/happyimage-monorepo-backup-dir
```

Expected: `/tmp/happyimage-monorepo-backup-dir` contains a path like `tmp/monorepo-migration-20260626-223000`.

- [ ] **Step 2: Move current workspace contents into backup**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
for path in README.md arch.png deploy prompts happyimage-gallery-source happyimage-api happyimage-web; do
  if [ -e "$path" ]; then
    mkdir -p "$BACKUP_DIR"
    mv "$path" "$BACKUP_DIR/"
  fi
done
```

Expected: the old workspace contents are under the backup directory, and root import paths `api/` and `web/` are still free.

- [ ] **Step 3: Restore shared docs needed by current root history**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
mkdir -p docs
if [ -d "$BACKUP_DIR/docs" ]; then
  cp -R "$BACKUP_DIR/docs/." docs/
fi
```

Expected: `docs/superpowers/specs/2026-06-26-happyimage-monorepo-design.md` and this plan still exist in root.

- [ ] **Step 4: Verify backup and clean import paths**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
test -d "$BACKUP_DIR/happyimage-api"
test -d "$BACKUP_DIR/happyimage-web"
test ! -e api
test ! -e web
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -print | sort
```

Expected: backup contains the old directories, and `api/` and `web/` do not yet exist.

- [ ] **Step 5: Commit backup-prep root state**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git status --short
git add docs
git commit -m "chore: prepare workspace for subtree imports"
```

Expected: either a commit with restored docs, or Git reports nothing to commit. If Git reports nothing to commit, continue.

---

### Task 3: Import API History Under `api/`

**Files:**
- Create: `/Users/forever/workspace/HappyImage/api/`

- [ ] **Step 1: Add local API backup as remote**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
git remote remove happyimage-api-local 2>/dev/null || true
git remote add happyimage-api-local "$BACKUP_DIR/happyimage-api"
git fetch happyimage-api-local
```

Expected: fetch succeeds and shows branches from the backed-up API repository.

- [ ] **Step 2: Detect API branch to import**

Run:

```bash
cd /Users/forever/workspace/HappyImage
API_BRANCH="$(git -C "$(cat /tmp/happyimage-monorepo-backup-dir)/happyimage-api" branch --show-current)"
test -n "$API_BRANCH"
printf '%s\n' "$API_BRANCH" > /tmp/happyimage-api-branch
```

Expected: `/tmp/happyimage-api-branch` contains the API branch name, normally `main` or `dev`.

- [ ] **Step 3: Import API with subtree**

Run:

```bash
cd /Users/forever/workspace/HappyImage
API_BRANCH="$(cat /tmp/happyimage-api-branch)"
git subtree add --prefix=api happyimage-api-local "$API_BRANCH" -m "chore: import happyimage-api history"
```

Expected: `api/` is created and the commit message says API history was imported.

- [ ] **Step 4: Verify API history and files**

Run:

```bash
cd /Users/forever/workspace/HappyImage
test -f api/main.py
test -f api/pyproject.toml
git log --oneline -- api | head -10
```

Expected: API files exist and `git log -- api` includes old API commits.

---

### Task 4: Import Web History Under `web/`

**Files:**
- Create: `/Users/forever/workspace/HappyImage/web/`

- [ ] **Step 1: Add local Web backup as remote**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
git remote remove happyimage-web-local 2>/dev/null || true
git remote add happyimage-web-local "$BACKUP_DIR/happyimage-web"
git fetch happyimage-web-local
```

Expected: fetch succeeds and shows branches from the backed-up Web repository.

- [ ] **Step 2: Detect Web branch to import**

Run:

```bash
cd /Users/forever/workspace/HappyImage
WEB_BRANCH="$(git -C "$(cat /tmp/happyimage-monorepo-backup-dir)/happyimage-web" branch --show-current)"
test -n "$WEB_BRANCH"
printf '%s\n' "$WEB_BRANCH" > /tmp/happyimage-web-branch
```

Expected: `/tmp/happyimage-web-branch` contains the Web branch name, normally `main` or `dev`.

- [ ] **Step 3: Import Web with subtree**

Run:

```bash
cd /Users/forever/workspace/HappyImage
WEB_BRANCH="$(cat /tmp/happyimage-web-branch)"
git subtree add --prefix=web happyimage-web-local "$WEB_BRANCH" -m "chore: import happyimage-web history"
```

Expected: `web/` is created and the commit message says Web history was imported.

- [ ] **Step 4: Verify Web history and files**

Run:

```bash
cd /Users/forever/workspace/HappyImage
test -f web/package.json
test -f web/src/app/page.tsx
git log --oneline -- web | head -10
```

Expected: Web files exist and `git log -- web` includes old Web commits.

---

### Task 5: Restore Shared Root Files

**Files:**
- Restore: `/Users/forever/workspace/HappyImage/README.md`
- Restore: `/Users/forever/workspace/HappyImage/deploy/`
- Restore: `/Users/forever/workspace/HappyImage/prompts/`
- Restore optional local-only: `/Users/forever/workspace/HappyImage/arch.png`

- [ ] **Step 1: Restore root README, deploy, prompts, and arch image from backup**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
for path in README.md deploy prompts arch.png; do
  if [ -e "$BACKUP_DIR/$path" ]; then
    cp -R "$BACKUP_DIR/$path" .
  fi
done
```

Expected: root README and deployment files are back in the monorepo root.

- [ ] **Step 2: Do not restore generated gallery source into Git**

Run:

```bash
cd /Users/forever/workspace/HappyImage
BACKUP_DIR="$(cat /tmp/happyimage-monorepo-backup-dir)"
if [ -d "$BACKUP_DIR/happyimage-gallery-source" ]; then
  mkdir -p data
  printf '%s\n' "$BACKUP_DIR/happyimage-gallery-source" > data/gallery-source-location.txt
fi
```

Expected: the large gallery source remains in the ignored backup location, and the root records its local path in `data/gallery-source-location.txt`.

- [ ] **Step 3: Verify restored root files**

Run:

```bash
cd /Users/forever/workspace/HappyImage
test -f README.md
test -f deploy/hs/docker-compose.yml
find prompts -maxdepth 2 -type f | head
```

Expected: root README, compose file, and prompt files exist.

---

### Task 6: Add Root Ignore Rules And Developer Commands

**Files:**
- Create: `/Users/forever/workspace/HappyImage/.gitignore`
- Create: `/Users/forever/workspace/HappyImage/Makefile`

- [ ] **Step 1: Create root `.gitignore`**

Write `/Users/forever/workspace/HappyImage/.gitignore` with this exact content:

```gitignore
# Runtime data and local migration backups
/data/
/tmp/

# Environment and secrets
.env
.env.*
!.env.example
.dev.vars
.dev.vars.*
!.dev.vars.example

# Python
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.venv/
build/
dist/
*.egg-info/
*.db
*.sqlite
*.sqlite3

# Node and frontend build output
node_modules/
.pnp
.pnp.*
.next/
out/
coverage/
*.tsbuildinfo
next-env.d.ts
.open-next/
.wrangler/

# Generated gallery packages
/web/public/seed-gallery/*
!/web/public/seed-gallery/README.md

# Local tool state
.DS_Store
.idea/
.gstack/
.superpowers/
.claude/settings.local.json
```

- [ ] **Step 2: Create root `Makefile`**

Write `/Users/forever/workspace/HappyImage/Makefile` with this exact content:

```makefile
.PHONY: api-dev web-dev dev test typecheck compose-config

api-dev:
	cd api && uv run python main.py

web-dev:
	cd web && BACKEND_URL=$${BACKEND_URL:-http://127.0.0.1:8000} pnpm run dev

dev:
	@printf '%s\n' 'Starting API on http://127.0.0.1:8000 and Web on http://127.0.0.1:3000'
	@trap 'kill 0' INT TERM EXIT; \
	(cd api && uv run python main.py) & \
	(cd web && BACKEND_URL=$${BACKEND_URL:-http://127.0.0.1:8000} pnpm run dev) & \
	wait

test:
	cd api && uv run python -m pytest -q
	cd web && pnpm run test:unit

typecheck:
	cd web && pnpm exec tsc --noEmit

compose-config:
	docker compose -f deploy/hs/docker-compose.yml config
```

- [ ] **Step 3: Verify Makefile targets parse**

Run:

```bash
cd /Users/forever/workspace/HappyImage
make -n api-dev
make -n web-dev
make -n dev
make -n test
make -n typecheck
make -n compose-config
```

Expected: each command prints the shell commands it would run without executing service startup.

- [ ] **Step 4: Commit root tooling**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add .gitignore Makefile
git commit -m "chore: add monorepo root tooling"
```

Expected: commit adds root ignore rules and developer commands.

---

### Task 7: Update Root Docs And Deployment Paths

**Files:**
- Modify: `/Users/forever/workspace/HappyImage/README.md`
- Modify: `/Users/forever/workspace/HappyImage/deploy/hs/docker-compose.yml`
- Modify: `/Users/forever/workspace/HappyImage/docs/hs-deployment.md`
- Modify: `/Users/forever/workspace/HappyImage/docs/hs-deployment-cn.md`

- [ ] **Step 1: Replace old service directory names in root docs**

Run:

```bash
cd /Users/forever/workspace/HappyImage
perl -0pi -e 's/happyimage-api\\//api\\//g; s/happyimage-web\\//web\\//g; s/`happyimage-api`/`api`/g; s/`happyimage-web`/`web`/g; s/happyimage-api/api/g; s/happyimage-web/web/g' README.md docs/hs-deployment.md docs/hs-deployment-cn.md
```

Expected: references in shared docs point to `api/` and `web/` where they refer to local source paths. Service names in prose may need manual review in the next step.

- [ ] **Step 2: Manually set README repository layout section**

Edit the top of `/Users/forever/workspace/HappyImage/README.md` so the layout block reads exactly like this indented snippet:

    # Happy Token

    Happy Token / HappyImage 统一 monorepo。

    ```text
    api/                         后端：登录、用户、历史、私有图片、设置、API
    web/                         前端：页面、同源产品 middleware、官方图库静态包
    deploy/                      组合部署编排
    docs/                        产品、部署和迁移文档
    data/                        本地运行数据，不提交 Git
    ```

- [ ] **Step 3: Confirm compose paths are already root-relative**

Run:

```bash
cd /Users/forever/workspace/HappyImage
sed -n '1,120p' deploy/hs/docker-compose.yml
```

Expected: the compose file contains these root-relative mounts:

```text
../../data/api:/app/data
../../data/config.json:/app/config.json:rw
../../data/seed-gallery:/app/web/public/seed-gallery:ro
```

If the compose file is run from `deploy/hs`, these paths remain correct. Do not change them to `./data/...` inside this file.

- [ ] **Step 4: Verify shared docs no longer point to old source directories**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n 'happyimage-api/|happyimage-web/' README.md docs deploy
```

Expected: no matches for old slash-suffixed source directory names.

- [ ] **Step 5: Commit root docs and deployment references**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add README.md deploy docs/hs-deployment.md docs/hs-deployment-cn.md
git commit -m "docs: update workspace paths for monorepo"
```

Expected: commit updates shared docs and deployment references.

---

### Task 8: Update Service-Local Cross-References

**Files:**
- Modify: `/Users/forever/workspace/HappyImage/web/scripts/build-seed-gallery.mjs`
- Modify: `/Users/forever/workspace/HappyImage/web/README.md`
- Modify: `/Users/forever/workspace/HappyImage/api/README.md`
- Modify: `/Users/forever/workspace/HappyImage/api/AGENTS.md`
- Modify: `/Users/forever/workspace/HappyImage/api/CLAUDE.md`

- [ ] **Step 1: Inspect gallery build path defaults**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n 'happyimage-api|happyimage-web|gallery-source|\\.\\./happyimage|api-dir|source-dir' web/scripts/build-seed-gallery.mjs web/README.md api/README.md api/AGENTS.md api/CLAUDE.md
```

Expected: matches identify old cross-repository paths and docs references.

- [ ] **Step 2: Update Web gallery script defaults**

In `/Users/forever/workspace/HappyImage/web/scripts/build-seed-gallery.mjs`, replace default local paths so they resolve from `web/` to monorepo siblings:

```javascript
const defaultSourceDir = path.resolve(projectRoot, "../data/gallery-source");
const defaultApiDir = path.resolve(projectRoot, "../api");
```

If the file currently computes these names differently, keep its existing option parsing and only change the default values for source data and API directory. The command-line flags `--source-dir`, `--api-dir`, and `--output` must continue to override these defaults.

- [ ] **Step 3: Update Web README gallery examples**

In `/Users/forever/workspace/HappyImage/web/README.md`, make the local gallery build paragraph say exactly like this indented snippet:

    默认读取 `../data/gallery-source`，调用 `../api` 中的图库归一化脚本，输出到 `public/seed-gallery`。如需覆盖路径：

    ```bash
    pnpm run gallery:build -- \
      --source-dir=/srv/happyimage-gallery-source \
      --api-dir=/srv/happyimage/api \
      --output=/srv/happyimage/seed-gallery
    ```

- [ ] **Step 4: Update service README repository references**

Run:

```bash
cd /Users/forever/workspace/HappyImage
perl -0pi -e 's/\\[happyimage-api\\]\\(https:\\/\\/github\\.com\\/happy-token\\/happyimage-api\\)/`..\\/api`/g; s/`\\.\\.\\/happyimage-api`/`..\\/api`/g; s/`\\.\\.\\/happyimage-web`/`..\\/web`/g; s/happyimage-api\\/docker-compose\\.yml/api\\/docker-compose.yml/g; s/happyimage-web/web/g; s/happyimage-api/api/g' web/README.md api/README.md api/AGENTS.md api/CLAUDE.md
```

Expected: local docs refer to monorepo paths where they mean local source directories.

- [ ] **Step 5: Verify old cross-repo path references**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rg -n 'happyimage-api/|happyimage-web/|\\.\\./happyimage-api|\\.\\./happyimage-web' api web README.md docs deploy
```

Expected: no matches where the text means local source paths. If matches remain as historical repository names in changelog-like prose, leave them only if they are not instructions.

- [ ] **Step 6: Commit service-local reference updates**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add api/README.md api/AGENTS.md api/CLAUDE.md web/README.md web/scripts/build-seed-gallery.mjs
git commit -m "docs: update service references for monorepo"
```

Expected: commit updates path references without changing runtime service behavior.

---

### Task 9: Add Root CI Workflows

**Files:**
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/api-docker-publish.yml`
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/web-docker-publish.yml`
- Create: `/Users/forever/workspace/HappyImage/.github/workflows/web-cloudflare-deploy.yml`

- [ ] **Step 1: Create API Docker workflow**

Write `/Users/forever/workspace/HappyImage/.github/workflows/api-docker-publish.yml`:

```yaml
name: Publish API Docker Image

on:
  push:
    branches: [main, dev]
    paths:
      - "api/**"
      - "deploy/**"
      - ".github/workflows/api-docker-publish.yml"
    tags:
      - "v*"
  workflow_dispatch: {}

env:
  IMAGE_NAME: happyimage-api

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        with:
          platforms: arm64

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
            type=raw,value=dev,enable=${{ github.ref == 'refs/heads/dev' }}
            type=sha,prefix=sha-
            type=ref,event=branch
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: ./api
          file: ./api/Dockerfile
          target: app
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Create Web Docker workflow**

Write `/Users/forever/workspace/HappyImage/.github/workflows/web-docker-publish.yml`:

```yaml
name: Publish Web Docker Image

on:
  push:
    branches: [main, dev]
    paths:
      - "web/**"
      - "deploy/**"
      - ".github/workflows/web-docker-publish.yml"
    tags:
      - "v*"
  workflow_dispatch: {}

env:
  IMAGE_NAME: happyimage-web

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        with:
          platforms: arm64

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
            type=raw,value=dev,enable=${{ github.ref == 'refs/heads/dev' }}
            type=sha,prefix=sha-
            type=ref,event=branch
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: ./web
          file: ./web/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: Create Web Cloudflare workflow**

Write `/Users/forever/workspace/HappyImage/.github/workflows/web-cloudflare-deploy.yml`:

```yaml
name: Deploy Web to Cloudflare Workers

on:
  push:
    branches: [main]
    paths:
      - "web/**"
      - ".github/workflows/web-cloudflare-deploy.yml"
  workflow_dispatch: {}

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    environment:
      name: production
      url: https://happyimage-web.happytoken.workers.dev

    defaults:
      run:
        working-directory: ./web

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
          cache-dependency-path: web/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and Deploy
        env:
          NEXT_PUBLIC_APP_VERSION: ${{ github.sha }}
          BACKEND_URL: ${{ vars.BACKEND_URL }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          test -n "$BACKEND_URL" || {
            echo "GitHub variable BACKEND_URL is required for production deploys" >&2
            exit 1
          }
          node -e '
            const fs = require("fs");
            const path = "wrangler.jsonc";
            const backendUrl = process.env.BACKEND_URL;
            const text = fs.readFileSync(path, "utf8");
            const next = text.replace(
              /"BACKEND_URL":\s*"[^"]*"/,
              `"BACKEND_URL": ${JSON.stringify(backendUrl)}`,
            );
            if (next === text) {
              throw new Error("BACKEND_URL entry not found in wrangler.jsonc");
            }
            fs.writeFileSync(path, next);
          '
          pnpm run deploy
```

- [ ] **Step 4: Remove imported service-local workflow files**

Run:

```bash
cd /Users/forever/workspace/HappyImage
rm -rf api/.github web/.github
```

Expected: only root `.github/workflows` remains.

- [ ] **Step 5: Verify workflow YAML parses structurally**

Run:

```bash
cd /Users/forever/workspace/HappyImage
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f); puts f }' .github/workflows/*.yml
```

Expected: each workflow filename is printed with no parser error.

- [ ] **Step 6: Commit root CI workflows**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add .github api/.github web/.github
git commit -m "ci: add monorepo workflows"
```

Expected: commit adds root workflows and removes imported child workflow directories.

---

### Task 10: Add Migration Record

**Files:**
- Create: `/Users/forever/workspace/HappyImage/docs/monorepo-migration.md`

- [ ] **Step 1: Create migration record**

Write `/Users/forever/workspace/HappyImage/docs/monorepo-migration.md` with this exact content:

    # HappyImage Monorepo Migration

    HappyImage is now a single monorepo with separate service directories:

    ```text
    api/  former happyimage-api repository
    web/  former happyimage-web repository
    ```

    Both service histories were imported with `git subtree add`, so service history remains visible with:

    ```bash
    git log --oneline -- api
    git log --oneline -- web
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

- [ ] **Step 2: Commit migration record**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git add docs/monorepo-migration.md
git commit -m "docs: record monorepo migration"
```

Expected: commit adds the migration record.

---

### Task 11: Verification

**Files:**
- Read: `/Users/forever/workspace/HappyImage/api`
- Read: `/Users/forever/workspace/HappyImage/web`
- Read: `/Users/forever/workspace/HappyImage/deploy/hs/docker-compose.yml`
- Read: `/Users/forever/workspace/HappyImage/.github/workflows`

- [ ] **Step 1: Verify subtree history**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git log --oneline -- api | head -10
git log --oneline -- web | head -10
```

Expected: both commands show imported service history, not only the final monorepo commits.

- [ ] **Step 2: Verify backend tests**

Run:

```bash
cd /Users/forever/workspace/HappyImage/api
uv run python -m pytest -q
```

Expected: pytest passes, with live tests skipped according to `pyproject.toml`.

- [ ] **Step 3: Verify frontend typecheck**

Run:

```bash
cd /Users/forever/workspace/HappyImage/web
pnpm exec tsc --noEmit
```

Expected: TypeScript completes without errors.

- [ ] **Step 4: Verify compose config**

Run:

```bash
cd /Users/forever/workspace/HappyImage
docker compose -f deploy/hs/docker-compose.yml config
```

Expected: Docker Compose renders the configuration without path or syntax errors.

- [ ] **Step 5: Verify no old source directories remain at root**

Run:

```bash
cd /Users/forever/workspace/HappyImage
test ! -e happyimage-api
test ! -e happyimage-web
test -d api
test -d web
```

Expected: old source directory names are absent from root; `api/` and `web/` exist.

- [ ] **Step 6: Verify root status**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git status --short
```

Expected: clean working tree, or only ignored local runtime/backup files under `data/` and `tmp/`.

---

### Task 12: Final Cleanup And Handoff

**Files:**
- Modify if needed: `/Users/forever/workspace/HappyImage/README.md`
- Keep ignored if needed: `/Users/forever/workspace/HappyImage/tmp/`
- Keep ignored if needed: `/Users/forever/workspace/HappyImage/data/`

- [ ] **Step 1: Remove local subtree remotes**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git remote remove happyimage-api-local 2>/dev/null || true
git remote remove happyimage-web-local 2>/dev/null || true
git remote -v
```

Expected: local backup remotes are gone. Any real `origin` remote remains if it was configured.

- [ ] **Step 2: Record final verification output**

Run:

```bash
cd /Users/forever/workspace/HappyImage
{
  echo "Root HEAD: $(git rev-parse --short HEAD)"
  echo "API history sample:"
  git log --oneline -- api | head -3
  echo "Web history sample:"
  git log --oneline -- web | head -3
} > /tmp/happyimage-monorepo-verification.txt
cat /tmp/happyimage-monorepo-verification.txt
```

Expected: output includes root HEAD and sample API/Web history.

- [ ] **Step 3: Commit final cleanup if any tracked files changed**

Run:

```bash
cd /Users/forever/workspace/HappyImage
git status --short
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "chore: finalize monorepo migration"
fi
```

Expected: final tracked changes are committed, or no commit is created because the tree is already clean.

- [ ] **Step 4: Report final state**

Include these details in the final response:

```text
- Root repository path: /Users/forever/workspace/HappyImage
- API path: /Users/forever/workspace/HappyImage/api
- Web path: /Users/forever/workspace/HappyImage/web
- Verification commands run and whether they passed
- Backup directory path from /tmp/happyimage-monorepo-backup-dir
- Any skipped verification and the reason
```
