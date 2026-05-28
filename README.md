# HappyImage

English | [中文](./README.zh.md)

HappyImage is a local AI visual content studio for creators and teams. Turn an idea, article, URL, or draft into image cards, infographics, comics, cover images, slide decks, and platform-ready publishing copy.

It brings the full `baoyu-skills` content workflow into three interfaces:

| Interface | Best for | Start with |
|-----------|----------|------------|
| Desktop App | A focused local workspace with native app behavior | `bun run dev:gui` |
| Web UI | Visual generation, previews, settings, and project history | `bun run dev:web` |
| CLI | Automation, scripting, diagnostics, and repeatable jobs | `bun run cli -- doctor` |

![HappyImage gallery preview](./screenshots/gallery-types/image-cards.png)

---

## Highlights

<table>
<tr>
<td width="50%" valign="top">

<h3>Visual workflow, not guesswork</h3>

<p>Create from a topic, article, URL, or local file. HappyImage plans the content, proposes a visual direction, generates prompts, renders images, and keeps the full project history together.</p>

<p><strong>Outputs:</strong> <code>analysis.md</code>, <code>outline.md</code>, <code>prompts/*.md</code>, <code>copy.md</code>, and final images.</p>

</td>
<td width="50%" valign="top">

<h3>Style controls that are easy to scan</h3>

<p>Pick styles visually instead of memorizing option names. The gallery covers card, infographic, diagram, cover, comic, slide, and article illustration workflows.</p>

<p><strong>Examples:</strong> fresh, warm, bold, minimal, retro, notion, chalkboard, screen-print, sketch-notes.</p>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<h3>Platform-aware publishing</h3>

<p>Generate copy and drafts for Xiaohongshu, WeChat, Weibo, and X. Each platform uses its own limits, hashtag rules, title format, and image constraints.</p>

<p><strong>Safety:</strong> HappyImage fills forms for review, but it never clicks "Publish" for you.</p>

</td>
<td width="50%" valign="top">

<h3>One engine, three ways to work</h3>

<p>Use the desktop app for daily creation, the Web UI for visual workflows, or the CLI for automation. They share the same local runtime, settings, skills, and output folders.</p>

<p><strong>Local-first:</strong> API keys, Chrome profile, generated projects, and settings stay on your machine.</p>

</td>
</tr>
</table>

---

## What You Can Create

| Skill | Use it for | Example |
|-------|------------|---------|
| `baoyu-image-cards` | Xiaohongshu-style image cards and carousels | `/baoyu-image-cards article.md --style fresh --layout balanced` |
| `baoyu-infographic` | Structured visual explainers and data/story infographics | `/baoyu-infographic content.md --layout pyramid --style technical-schematic` |
| `baoyu-diagram` | Flowcharts, sequence diagrams, ER diagrams, architecture diagrams, timelines | `/baoyu-diagram architecture.md --type flowchart` |
| `baoyu-cover-image` | Article, blog, podcast, and newsletter covers | `/baoyu-cover-image article.md --palette corporate-tech` |
| `baoyu-slide-deck` | Presentation decks with consistent visual direction | `/baoyu-slide-deck talk.md --aspect 16:9` |
| `baoyu-comic` | Multi-panel comics with character sheets and dialogue | `/baoyu-comic story.md` |
| `baoyu-article-illustrator` | Header images, section visuals, diagrams, and editorial illustrations | `/baoyu-article-illustrator article.md` |

---

## Core Features

### AI generation pipeline

HappyImage turns source material into a reproducible project folder:

- `analysis.md` - content analysis and style recommendations
- `outline.md` - page-by-page storyboard or structure
- `prompts/*.md` - complete image prompts with frontmatter
- `copy.md` - editable publishing copy
- `NN-image.png` - rendered image outputs

The pipeline supports batch generation, dependency-aware ordering, parallel backend calls, retries, and persistent project state.

### Multi-platform publishing

| Platform | Images | Title | Body | Hashtags | Method |
|----------|--------|-------|------|----------|--------|
| Xiaohongshu | Up to 18 | 20 chars | 1000 chars | Up to 10, separate lines | Chrome CDP |
| WeChat | Unlimited | 64 chars | 20000 chars | None | API or Chrome |
| Weibo | Up to 18 | Inline `【】` | 2000 chars | Inline `#topic#` | Chrome CDP |
| X | Up to 4 | Inline | 280 chars | Inline `#tag` | Chrome CDP |

Publishing skills automate draft creation and form filling only. You always review and confirm manually.

### Session chat

Generations are tied to persistent chat sessions with SSE streaming. A session tracks messages, plans, artifacts, images, output files, and project history so you can close the browser and continue later.

### Watermark and brand protection

Configure per-skill watermarks through `EXTEND.md`. You can customize text, position, and opacity for generated images.

---

## AI Backends

| Skill | Description |
|-------|-------------|
| `baoyu-imagine` | Primary image generation backend. Supports OpenAI, Azure OpenAI, Google Gemini, OpenRouter, DashScope, Replicate, Z.AI, MiniMax, Jimeng, and Seedream. |
| `baoyu-danger-gemini-web` | Gemini Web image generation through browser cookies. Useful for experimentation, but web-interface behavior can change. |

At least one image backend API key is required for normal image generation.

---

## Utility Skills

| Skill | Description |
|-------|-------------|
| `baoyu-youtube-transcript` | Download YouTube transcripts/subtitles and cover images. |
| `baoyu-url-to-markdown` | Convert URLs to clean Markdown via Chrome CDP. |
| `baoyu-danger-x-to-markdown` | Convert X/Twitter threads to Markdown through a reverse-engineered API. |
| `baoyu-compress-image` | Compress and optimize images for publishing. |
| `baoyu-format-markdown` | Format Markdown with CJK typography support. |
| `baoyu-markdown-to-html` | Convert Markdown to WeChat-compatible HTML. |
| `baoyu-translate` | Translate articles in quick, normal, or refined modes. |
| `baoyu-wechat-summary` | Summarize WeChat group chats into structured digests. |

Deprecated but still functional: `baoyu-image-gen` (use `baoyu-imagine`) and `baoyu-xhs-images` (use `baoyu-image-cards`).

---

## Getting Started

### 1. Install requirements

- [Bun](https://bun.sh) runtime: `brew install oven-sh/bun/bun` or `npm install -g bun`
- Node.js 18+
- Google Chrome for CDP-based publishing and browser automation
- An Anthropic-compatible key for planning, captions, and iterative chat
- At least one image generation backend key

### 2. Clone and build

```bash
git clone https://github.com/happy-token/HappyImage.git
cd HappyImage
bun install
bun run build
```

### 3. Start an interface

```bash
# Desktop app
bun run dev:gui

# Web UI
bun run dev:web
# open http://localhost:3200

# CLI diagnostics
bun run cli -- doctor
```

For the full root-level command matrix for CLI, Web UI, and GUI/Desktop development, builds, packaging, and release, see [Development, Build, and Release](docs/development-release.md).

### 4. Install as an agent plugin

```bash
/plugin marketplace add happy-token/HappyImage
/plugin install baoyu-skills@happyimage-skills
```

You can also tell your agent: "Please install Skills from github.com/happy-token/HappyImage".

---

## Environment Configuration

Add keys to `.env` in the project or to `~/.baoyu-skills/.env` globally:

```bash
# Planning, captions, and chat
ANTHROPIC_API_KEY=sk-ant-...

# Image generation - choose at least one
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DASHSCOPE_API_KEY=sk-...
ARK_API_KEY=...

# WeChat API publishing only. Other platforms use Chrome login.
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
```

Supported image backends include OpenAI, Azure OpenAI, Google Gemini, OpenRouter, DashScope, Replicate, Z.AI, MiniMax, Jimeng, and Seedream.

---

## Customization

All skills support project-level and user-level customization through `EXTEND.md`:

```text
.baoyu-skills/<skill-name>/EXTEND.md
~/.baoyu-skills/<skill-name>/EXTEND.md
```

Use it for default styles, palettes, watermarks, Chrome profiles, publishing preferences, and other skill-specific settings. Each skill documents its supported options in its own `SKILL.md`.

---

## Repository Structure

```text
HappyImage/
├── skills/          # Self-contained baoyu-* skills
├── packages/
│   ├── core/        # Shared runtime, settings, orchestration, AI pipeline
│   ├── web-ui/      # React + Vite frontend and Hono API server
│   ├── cli/         # happyimage CLI
│   └── desktop/     # Electron desktop wrapper
├── docs/            # Author-facing reference documentation
├── scripts/         # Repo maintenance, packaging, publishing
└── screenshots/     # Preview assets used by the gallery and docs
```

---

## Notes

- `baoyu-danger-gemini-web` and `baoyu-danger-x-to-markdown` depend on unofficial web/API behavior and may break when upstream platforms change.
- Publishing skills automate form filling only. They do not click "Publish"; you retain final control.
- Chrome-based skills share a local browser profile. See [docs/chrome-profile.md](./docs/chrome-profile.md) for platform paths and overrides.

---

## Credits

HappyImage is built on top of [baoyu-skills](https://github.com/JimLiu/baoyu-skills) by [JimLiu](https://github.com/JimLiu). The core AI pipeline, skill definitions, and multi-platform publishing engine are adapted from the baoyu-skills ecosystem.

Maintained by [happy-token](https://github.com/happy-token) and contributors.

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=happy-token/HappyImage&type=Date)](https://star-history.com/#happy-token/HappyImage&Date)
