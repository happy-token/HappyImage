# Project Structure

This repository contains two product surfaces:

- `skills/`: standalone baoyu skills consumed by agent runtimes.
- `packages/`: shared libraries and HappyImage applications that provide CLI, Web UI, and desktop access to those skills.

## Root

| Path | Purpose |
| --- | --- |
| `skills/` | Canonical baoyu skill directories. Each skill remains self-contained with its own `SKILL.md`, scripts, prompts, and references. |
| `packages/core/` | Shared HappyImage runtime: settings, skill metadata, preference handling, source context loading, generation orchestration, and project chat logic. |
| `packages/web-ui/` | Hono API server plus React/Vite chat-first Web UI. This is the main interactive user surface. |
| `packages/cli/` | `happyimage` CLI. Starts Web UI/desktop mode, runs doctor/config/projects/init commands. |
| `packages/desktop/` | Electron wrapper that starts the CLI/Web server as a sidecar and opens the local UI. |
| `packages/baoyu-*` | Shared utility packages used by skills, such as Markdown rendering, fetching, and Chrome CDP helpers. |
| `screenshots/` | Skill/style preview assets used by README and Web UI. `packages/web-ui/public/screenshots` points here. |
| `docs/` | Author-facing documentation for skill creation, publishing, image generation, Chrome profile setup, and project structure. |
| `scripts/` | Repository maintenance scripts for building shared packages, testing, publishing, and sync workflows. |
| `tmp/` | Local generated samples, review artifacts, and transient outputs. Ignored by git. |

## Generated Artifacts

Do not commit local runtime or build artifacts:

- `node_modules/`
- `packages/*/dist/`
- `packages/*/test-results/`
- `packages/*/playwright-report/`
- `tmp/`
- `output/`
- `.baoyu-skills/`
- `.env`

If a generated file is useful as documentation, move it into a deliberate docs or fixture location and name it accordingly.

## Package Boundaries

`@happyimage/core` should not import from Web UI, CLI, or desktop packages.

`@happyimage/web` may import from `@happyimage/core`, but should not depend on CLI or desktop.

`@happyimage/cli` may import from `@happyimage/core` and `@happyimage/web` to start the shared server.

`@happyimage/desktop` should shell out to the CLI/Web server instead of reimplementing server logic.

## Common Commands

```bash
npm run build
npm run build:web
npm run test:web
npm run test:web:e2e
bun packages/cli/src/bin.ts doctor
bun packages/cli/src/bin.ts web --port 3200
```
