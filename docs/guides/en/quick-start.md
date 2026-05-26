# HappyImage Quick Start

Go from zero to first image in under 2 minutes.

## 1. Install and Launch

Choose the path that matches how you received HappyImage.

### Option A: Desktop Installer (recommended for most users)

If you have a macOS/Windows/Linux installer, install and open **HappyImage** directly. The desktop app starts the local Web UI and uses your local Chrome profile for platform login and auto-fill publishing.

After launch, open **Settings** and configure your API keys.

### Option B: npm / npx CLI (recommended for command-line users)

If the npm package is available, use the `happyimage` CLI to launch the Web UI or desktop-style window:

```bash
# One-off run
npx @happyimage/cli init
npx @happyimage/cli web --open

# Or install globally
npm install -g @happyimage/cli
happyimage init
happyimage web --open
```

Supported launch and management commands:

| Mode | npx | Global install | Purpose |
|---|---|---|---|
| Web UI | `npx @happyimage/cli web --open` | `happyimage web --open` | Start the local API + production Web UI and open a browser |
| Web UI with port | `npx @happyimage/cli web --port 3200 --open` | `happyimage web --port 3200 --open` | Use another port when the default is busy |
| Desktop-style window | `npx @happyimage/cli desktop` | `happyimage desktop` | Open HappyImage in a Chrome app window; requires local Chrome |
| Init config | `npx @happyimage/cli init` | `happyimage init` | Check environment and generate an `.env` template |
| Build Web UI | `npx @happyimage/cli build` | `happyimage build` | Manually build Web UI assets; `web` auto-builds when assets are missing |
| Doctor | `npx @happyimage/cli doctor` | `happyimage doctor` | Check Bun, Chrome, API keys, skills root, and output directory |
| Config paths | `npx @happyimage/cli config` | `happyimage config` | Show config, skills root, and output paths |
| Projects | `npx @happyimage/cli projects` | `happyimage projects` | List generated projects |

Shortest startup flow:

```bash
npx @happyimage/cli init
npx @happyimage/cli web --open
```

### Option C: Source Build (for developers)

```bash
git clone https://github.com/happy-token/HappyImage.git
cd HappyImage
bun install
bun run build
bun run dev:web
```

Open `http://localhost:3200` in your browser.

## 2. Configure API Keys

Open **Settings** → **AI Models**:

- **Execution**: Fill in `ANTHROPIC_API_KEY` (required for copywriting)
- **Image Gen**: Configure at least one image backend (OpenAI, Google Gemini, etc.)

> See [Settings Guide](settings-guide.md) for detailed configuration.

## 3. Generate Your First Image

1. Enter a topic in the input box, e.g. "HappyImage promo card"
2. Pick a style, layout, palette, and aspect ratio
3. Click generate
4. AI shows a plan for confirmation, then starts generating
5. Images appear in the project panel

## 4. Publish to Platforms

1. Switch to the "Publish" tab in the project page
2. Select target platform (Xiaohongshu / Weibo / X / WeChat)
3. Click "Generate Caption" — AI creates platform-formatted copy
4. Preview the mockup and confirm
5. Click "Auto-Fill & Publish"

> First-time use requires session setup. See [Publishing Guide](publish-guide.md).

## Next Steps

- [Settings Guide](settings-guide.md) — API keys, providers, preferences, appearance
- [Publishing Guide](publish-guide.md) — Platform rules, session management, troubleshooting
