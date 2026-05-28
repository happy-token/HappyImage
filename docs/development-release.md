# HappyImage Development, Build, and Release

Run product commands from the repository root. The root `package.json` is the command surface for CLI, Web UI, and GUI/Desktop work.

## Product Surfaces

| Surface | Package | Purpose | Root command prefix |
| --- | --- | --- | --- |
| CLI | `packages/cli` | `happyimage` command, diagnostics, local server launcher | `bun run cli ...`, `bun run build:cli` |
| Web UI | `packages/web-ui` | Hono API server + React/Vite UI | `bun run dev:web`, `bun run build:web` |
| GUI/Desktop | `packages/desktop` | Electron app wrapping the shared Web UI runtime | `bun run dev:gui`, `bun run build:gui` |
| Core | `packages/core` | Shared runtime used by all surfaces | `bun run build:core` |

## Prerequisites

```bash
bun install
bun run doctor
```

`doctor` checks Bun, Git, Chrome, built Web UI assets, built-in skills, and model keys.

## Development

| Goal | Command | Notes |
| --- | --- | --- |
| Start the Electron GUI | `bun run dev` | Alias for `bun run dev:gui`. |
| Start the Electron GUI explicitly | `bun run dev:gui` | Compiles desktop TS, watches it, then opens Electron. |
| Start Web UI dev server | `bun run dev:web` | Starts Hono API + Vite dev UI from `packages/web-ui`. |
| Run CLI from source | `bun run cli -- doctor` | Pass any CLI args after `--`. |
| Open production Web UI locally | `bun run web -- --port 3100` | Uses the CLI source entry and opens the browser. |
| Open Chrome app-mode desktop | `bun run gui -- --port 3100` | Lightweight desktop mode via Chrome, not Electron. |

## Build

| Goal | Command | Output |
| --- | --- | --- |
| Build everything | `bun run build` | Core, Web UI, CLI, and Electron desktop. |
| Build core only | `bun run build:core` | `packages/core/dist/` |
| Build CLI only | `bun run build:cli` | `packages/cli/dist/` |
| Build Web UI only | `bun run build:web` | `packages/web-ui/dist/` |
| Build GUI/Desktop only | `bun run build:gui` | `packages/desktop/release/` |
| Build unsigned desktop app | `bun run build:desktop:unsigned` | Unsigned macOS dmg/zip. |
| Build unpacked desktop app | `bun run build:desktop:dir:unsigned` | Fast local smoke-test build. |

For most local verification, run:

```bash
bun run build:core
bun run build:web
bun run build:cli
```

Run the full `bun run build` before release work because the desktop package bundles the CLI, Web UI, core runtime, skills, and docs.

## Package

Packaging creates distributable artifacts without publishing them.

| Goal | Command | Output |
| --- | --- | --- |
| Pack npm packages | `bun run pack:npm` | Tarballs in `dist/npm/` for core, web, and CLI. |
| Pack GUI/Desktop | `bun run pack:gui` | macOS dmg/zip in `packages/desktop/release/`. |
| Pack both npm and GUI | `bun run pack` | Runs both package flows. |

## Publish / Release

| Goal | Command | Requirements |
| --- | --- | --- |
| Dry-run npm publish | `bun run publish:npm:dry` | npm CLI available. |
| Publish npm packages | `bun run publish:npm` | `npm whoami` must pass; set `NPM_OTP` for 2FA if needed. |
| Release npm packages | `bun run release:npm` | Alias for `publish:npm`. |
| Local desktop release build | `bun run release:desktop` | Signing/notarization environment if enabled. |
| Desktop release test build | `bun run release:desktop:test` | Creates an unpacked local build with signing disabled. |
| Upload desktop artifacts to GitHub Release | `bun run release:desktop:github` | `gh` CLI auth and `GITHUB_REPOSITORY`/tag defaults. |

Desktop release modes are implemented by `scripts/desktop-release.sh`:

| Mode | Root command | Behavior |
| --- | --- | --- |
| `test` | `bun run release:desktop:test` | Typecheck, desktop tests, unsigned unpacked build. |
| `package` | `bun run pack:gui` | Typecheck, desktop tests, unsigned dmg/zip. |
| `release` | `bun run release:desktop` | Typecheck, desktop tests, signed/publish-capable Electron build. |
| `github-release` | `bun run release:desktop:github` | Build artifacts and upload to GitHub Release. |

## Recommended Flows

### CLI change

```bash
bun run build:core
bun run build:cli
bun run cli -- doctor
bun run pack:npm
```

### Web UI change

```bash
bun run dev:web
bun run build:web
bun run test:web
```

Run API tests separately when needed:

```bash
cd packages/web-ui
bun test tests/api.test.ts
```

### GUI/Desktop change

```bash
bun run dev:gui
bun run build:core
bun run build:web
bun run build:cli
bun run release:desktop:test
```

### Full release checklist

```bash
bun install
bun run doctor
bun run build
bun run test
bun run pack:npm
bun run pack:gui
```

Then publish the relevant channel:

```bash
bun run publish:npm
bun run release:desktop:github
```

## Naming Rules

- Use `cli`, `web`, and `gui` for product surfaces.
- Use `desktop` only as the compatibility name for the Electron GUI package.
- Use `dev:*` for local development.
- Use `build:*` for compiled outputs.
- Use `pack:*` for local distributable artifacts.
- Use `publish:*` or `release:*` only for commands that can publish externally or prepare release-grade artifacts.
