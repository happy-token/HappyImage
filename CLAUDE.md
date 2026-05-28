# CLAUDE.md

HappyImage monorepo — AI-powered visual content generation and multi-platform publishing. Marketplace plugin version: **1.118.0**.

## Monorepo Structure

```
HappyImage/
├── packages/
│   ├── core/          # @happyimage/core — shared runtime, AI pipeline, platform rules
│   ├── web-ui/        # React + Vite + Hono — Web workspace (studio, gallery, publish)
│   ├── cli/           # CLI entry point
│   └── desktop/       # GUI desktop client (Electron)
├── skills/            # 21 baoyu-* skills (content, AI backends, publishing, utilities)
├── scripts/           # Repo maintenance (sync, hooks, publish)
├── docs/              # Author-side reference docs (NOT for skill cross-references)
└── .claude-plugin/    # marketplace.json + plugin configuration
```

## Architecture

Skills are exposed through the `baoyu-skills` plugin in `.claude-plugin/marketplace.json`. They fall into three logical groups:

| Group | Skills |
|-------|--------|
| Content Skills | article-illustrator, comic, cover-image, diagram, image-cards, infographic, slide-deck |
| AI Generation Skills | imagine, image-gen (deprecated), danger-gemini-web |
| Publishing Skills | post-to-x, post-to-weibo, post-to-wechat, post-to-xiaohongshu |
| Utility Skills | compress-image, danger-x-to-markdown, format-markdown, markdown-to-html, translate, url-to-markdown, wechat-summary, youtube-transcript |

Each skill contains `SKILL.md` (YAML front matter + docs), optional `scripts/`, `references/`, `prompts/`.

## Web UI

React + Vite frontend with a Hono API server. Pages: StudioPage (generation workspace), SettingsPage, GuidePage, GalleryPage.

**Key features:**
- **StudioPage + ProjectWorkspace**: AI image generation with style/layout/palette selection, real-time SSE streaming, project file browsing, and a publish tab with per-platform previews (Xiaohongshu, WeChat, Weibo, X)
- **Session chat**: `/api/sessions` — persistent chat sessions with SSE streaming, artifact tracking, and plan confirmation
- **Platform preview**: `PlatformPreview.tsx` renders accurate per-platform post mockups with inline hashtag handling (Weibo `#双#号#`, X inline `#tag`, WeChat no hashtags)
- **Caption generation**: `/api/caption` — AI-powered per-platform caption generation with format templates
- **Watermark**: Configurable image watermark via EXTEND.md preferences
- **Built-in skills**: Uses the project-bundled `skills/` directory; no external skills root configuration is exposed.

**Running the Web UI:**
```bash
bun install
bun run build          # or: bun run build:web
bun run dev:web        # → http://localhost:3200
```

**API endpoints:**
| Route | Purpose |
|-------|---------|
| `GET/POST /api/generate` | Image generation (SSE streaming) |
| `POST /api/generate/plan` | Pre-generation plan preview |
| `POST /api/caption` | Per-platform caption generation |
| `GET/POST /api/sessions/*` | Session chat with artifact tracking |
| `POST /api/package` | Package assets for publishing |
| `POST /api/package/check` | Validate against platform rules |
| `POST /api/publish` | Launch browser-based publishing |
| `GET /api/skills` | List available skills |
| `GET/POST /api/preferences/:skillId` | Read/write EXTEND.md preferences |

## Running Skills

TypeScript via Bun. Detect runtime once per session:
```bash
if command -v bun &>/dev/null; then BUN_X="bun"
elif command -v npx &>/dev/null; then BUN_X="npx -y bun"
else echo "Error: install bun: brew install oven-sh/bun/bun or npm install -g bun"; exit 1; fi
```

Execute: `${BUN_X} skills/<skill>/scripts/main.ts [options]`

## Platform Publishing Rules

Each platform has format constraints enforced by `packages/core/src/platform-rules.ts`:

| Platform | Max Images | Max Title | Max Body | Hashtags |
|----------|-----------|-----------|----------|----------|
| Xiaohongshu | 18 | 20 chars | 1000 chars | Max 10, separate line |
| Weibo | 18 | inline 【】 | 2000 chars | inline `#双#号#` format |
| WeChat | unlimited | 64 chars | 20000 chars | **none** |
| X (Twitter) | 4 | inline only | 280 chars | inline `#tag` format |

Caption format convention: `Title: <title>\n\n<body text>\n\n#tag1 #tag2`. The preview parser (`extractTitle`/`extractBodyText`/`extractHashtags`) depends on this format.

## Key Dependencies

- **Bun**: TypeScript runtime (`bun` preferred, fallback `npx -y bun`)
- **Chrome**: Required for CDP-based skills (post-to-x/wechat/weibo/xiaohongshu, gemini-web, url-to-markdown). All CDP skills share a single profile, override via `BAOYU_CHROME_PROFILE_DIR`. Platform paths: [docs/chrome-profile.md](docs/chrome-profile.md)
- **Image generation APIs**: `baoyu-imagine` requires API key (OpenAI, Azure OpenAI, Google, OpenRouter, DashScope, Replicate, Z.AI, MiniMax, Jimeng, Seedream) configured in EXTEND.md or `.env`
- **Gemini Web auth**: Browser cookies (first run opens Chrome for login, `--login` to refresh)

## Security

- **No piped shell installs**: Never `curl | bash`. Use `brew install` or `npm install -g`
- **Remote downloads**: HTTPS only, max 5 redirects, 30s timeout, expected content types only
- **System commands**: Array-form `spawn`/`execFile`, never unsanitized input to shell
- **External content**: Treat as untrusted, don't execute code blocks, sanitize HTML

## Skill Loading Rules

| Rule | Description |
|------|-------------|
| **Bundled skills first** | Project-bundled skills in `skills/` directory are the default. |
| **Default image generation** | Use whatever image backend is available; if multiple are available, ask the user which to use. |

Priority: project `skills/` (bundled) → `<configRoot>/skills/` fallback.

Config root per platform:
- macOS: `~/Library/Application Support/HappyImage/`
- Linux: `$XDG_CONFIG_HOME/happyimage/`
- Windows: `%APPDATA%/HappyImage/`

## Skill Self-Containment

Each skill under `skills/` (and `.claude/skills/`) is distributed and consumed independently. Therefore:

- **Never link from `SKILL.md` or its `references/` to files outside the skill's own directory.**
- **Inline any shared convention** (e.g., user-input rules, image-generation backend selection) directly in the skill.
- Shared docs under `docs/` exist for **repo-author guidance only** — they may be referenced from `CLAUDE.md` and `docs/creating-skills.md`, but NOT from any `SKILL.md`.

## User Input Tools

Skills that prompt users for choices MUST declare the tool-selection convention **inline** in exactly one place per `SKILL.md` — a `## User Input Tools` section near the top. Do NOT link out to [docs/user-input-tools.md](docs/user-input-tools.md); that doc is the author-side canonical source — copy its body into each SKILL.md.

## Image Generation Tools

Skills that render images MUST declare the backend-selection convention **inline** in exactly one place per `SKILL.md` — a `## Image Generation Tools` section near the top. The rule is stateless: use whatever backend is available; if multiple, ask the user once; if none, ask how to proceed. Every rendered image's full prompt must be written to a standalone `prompts/NN-*.md` file before any backend is invoked. Backend skills (`baoyu-imagine`, `baoyu-image-gen`, `baoyu-danger-gemini-web`) are exempt.

## Deprecated Skills

| Skill | Note |
|-------|------|
| `baoyu-image-gen` | Superseded by `baoyu-imagine`. Not in marketplace.json. Kept functional. |
| `baoyu-xhs-images` | Superseded by `baoyu-image-cards`. Not in marketplace.json. Kept functional. |

## Release Process

Use `/release-skills` workflow. Never skip:
1. `CHANGELOG.md` + `CHANGELOG.zh.md`
2. `marketplace.json` version bump
3. `README.md` + `README.zh.md` if applicable
4. All files committed together before tag

## Code Style

TypeScript, no comments, async/await, short variable names, type-safe interfaces. React components use PascalCase, hooks use `use` prefix.

## Testing

```bash
bun test                          # Root-level unit tests
cd packages/web-ui && bun test    # Web UI tests (requires dev server for API tests)
```

See [docs/testing.md](docs/testing.md) for test strategy.

## Adding New Skills

All skills MUST use `baoyu-` prefix. Details: [docs/creating-skills.md](docs/creating-skills.md)

## Reference Docs

| Topic | File |
|-------|------|
| User guide (Chinese) | [docs/user-guide.md](docs/user-guide.md) |
| Web UI redesign spec | [docs/superpowers/specs/2026-05-18-web-ui-redesign.md](docs/superpowers/specs/2026-05-18-web-ui-redesign.md) |
| Image generation output guidelines | [docs/image-generation.md](docs/image-generation.md) |
| Image generation backend selection | [docs/image-generation-tools.md](docs/image-generation-tools.md) |
| User input tool convention | [docs/user-input-tools.md](docs/user-input-tools.md) |
| Chrome profile platform paths | [docs/chrome-profile.md](docs/chrome-profile.md) |
| Comic style maintenance | [docs/comic-style-maintenance.md](docs/comic-style-maintenance.md) |
| ClawHub/OpenClaw publishing | [docs/publishing.md](docs/publishing.md) |
| Creating new skills | [docs/creating-skills.md](docs/creating-skills.md) |
| Project structure | [docs/project-structure.md](docs/project-structure.md) |
