# HappyImage

English | [中文](./README.zh.md)

AI-powered visual content creation and multi-platform publishing toolkit. Generate stunning image cards, infographics, comics, and slide decks — then publish them to Xiaohongshu, WeChat, Weibo, and X with one click.

**Three interfaces, zero friction:** CLI for automation · Web UI for visual workflow · Desktop app for double-click simplicity.

---

## Highlights

<table>
<tr>
<td width="50%">

### Visual Preview — WYSIWYG

Stop guessing. Every post gets a **live platform mockup** before you publish. See exactly how your images, title, body, and hashtags will look on Xiaohongshu, WeChat, Weibo, or X — with real-time character counts, image grid layouts, and platform rule validation.

![Platform Preview](screenshots/platform-preview.png)

</td>
<td width="50%">

### Style Controls — Your Look, Your Rules

**12 visual styles** × **8 layout densities** × **3 color palettes** — mix and match to match your brand. Every style is previewed visually so you pick what you see, not guess from a name.

| Style | Palette | Layout |
|-------|---------|--------|
| cute · fresh · warm | macaron · warm · neon | sparse → flow |
| bold · minimal · retro | | |
| pop · notion · chalkboard | | |
| study-notes · screen-print · sketch-notes | | |

</td>
</tr>
<tr>
<td width="50%">

### AI Caption + One-Click Publish

Generate platform-optimized copy with one click. Each platform gets its own format template — Xiaohongshu hashtags at the bottom, Weibo `#双#号#` inline, WeChat no hashtags, X inline `#tags` under 280 chars. Then let Chrome automation fill in the draft while you review and click publish.

</td>
<td width="50%">

### CLI · Web UI · GUI

```bash
# CLI — script it
bun packages/cli/src/bin.ts web --port 3200

# Web UI — visual workspace
bun run dev:web
# → http://localhost:3200

# GUI — double-click app
bun run dev:desktop
```

Same skills, same output — pick the interface that fits your workflow.

</td>
</tr>
</table>

---

## Core Features

### AI Generation Engine

Input a topic or article, select visual parameters, and let the AI plan, outline, and generate every image. The pipeline produces:

- **analysis.md** — content analysis and style recommendations
- **outline.md** — page-by-page storyboard plan
- **prompts/*.md** — detailed image generation prompts with frontmatter
- **copy.md** — ready-to-edit publishing copy
- **NN-image.png** — final rendered images

Supports **batch generation** with dependency-aware ordering, parallel backend calls, and retry logic.

### Multi-Platform Publishing

| Platform | Images | Title | Body | Hashtags | Method |
|----------|--------|-------|------|----------|--------|
| 小红书 | Up to 18 | 20 chars | 1000 chars | Max 10, separate | Chrome CDP |
| 微信公众号 | Unlimited | 64 chars | 20000 chars | None | API or Chrome |
| 微博 | Up to 18 | Inline 【】 | 2000 chars | Inline `#双#号#` | Chrome CDP |
| X (Twitter) | Up to 4 | Inline | 280 chars | Inline `#tag` | Chrome CDP |

**Safety-first publishing:** the browser fills in everything but never clicks "Publish." You review and confirm manually — no bot-like behavior to trigger platform anti-spam.

### Session Chat

Persistent chat sessions with SSE streaming. Every generation creates a session that tracks artifacts (images, files, projects), supports plan confirmation, and allows iterative refinement. Close the browser mid-generation and pick up where you left off.

### Watermark & Brand Protection

Configure per-skill watermarks via EXTEND.md preferences. Customize text, position, and opacity to protect your original content across all generated images.

### Skills Root Management

Install external baoyu-skills collections from GitHub or local paths. The Web UI settings page lets you browse, select, and switch between skill roots — keeping your workspace flexible and up to date.

---

## Available Skills (21)

### Content Generation

| Skill | Description | Quick Start |
|-------|-------------|-------------|
| **baoyu-image-cards** | Xiaohongshu infographic cards. 12 styles × 8 layouts × 3 palettes. | `/baoyu-image-cards article.md --style fresh --layout balanced` |
| **baoyu-infographic** | Professional infographics with 18 layouts and 17 visual styles. | `/baoyu-infographic content.md --layout pyramid --style technical-schematic` |
| **baoyu-diagram** | Technical diagrams — flowcharts, sequence, ER, architecture, Gantt. | `/baoyu-diagram architecture.md --type flowchart` |
| **baoyu-cover-image** | Article/blog cover images with customizable palettes. | `/baoyu-cover-image article.md --palette corporate-tech` |
| **baoyu-slide-deck** | Presentation slide decks with consistent theming. | `/baoyu-slide-deck talk.md --aspect 16:9` |
| **baoyu-comic** | Multi-panel comics with character sheet support and dialog. | `/baoyu-comic story.md` |
| **baoyu-article-illustrator** | Article illustrations — header, diagrams, section visuals. | `/baoyu-article-illustrator article.md` |

### AI Backends

| Skill | Description |
|-------|-------------|
| **baoyu-imagine** | Primary image generation backend. Supports OpenAI (DALL-E / GPT Image), Azure OpenAI, Google Gemini, OpenRouter, DashScope, Replicate, Z.AI, MiniMax, Jimeng, and Seedream. Auto-detects available providers. |
| **baoyu-danger-gemini-web** | Gemini Web API via browser cookies. Free-tier image generation through Google's web interface. Use at your own risk. |

### Publishing

| Skill | Description | Quick Start |
|-------|-------------|-------------|
| **baoyu-post-to-xiaohongshu** | Post to Xiaohongshu Creator Platform via Chrome CDP. | `/baoyu-post-to-xiaohongshu` |
| **baoyu-post-to-wechat** | Post to WeChat Official Account (图文 + 文章). API or browser. Multi-account. | `/baoyu-post-to-wechat article.md --theme default` |
| **baoyu-post-to-weibo** | Post to Weibo (regular posts + 头条文章). | `/baoyu-post-to-weibo article.md` |
| **baoyu-post-to-x** | Post to X/Twitter (tweets, quote tweets, X Articles). | `/baoyu-post-to-x article.md` |

### Utilities

| Skill | Description |
|-------|-------------|
| **baoyu-youtube-transcript** | Download YouTube transcripts/subtitles and cover images. |
| **baoyu-url-to-markdown** | Convert any URL to clean Markdown via Chrome CDP. |
| **baoyu-danger-x-to-markdown** | Convert X/Twitter threads to Markdown. Reverse-engineered API. |
| **baoyu-compress-image** | Compress and optimize images for web publishing. |
| **baoyu-format-markdown** | Format and beautify Markdown with CJK typography. |
| **baoyu-markdown-to-html** | Convert Markdown to WeChat-compatible HTML. |
| **baoyu-translate** | Translate articles with three modes: quick, normal, refined. |
| **baoyu-wechat-summary** | Summarize WeChat group chats into structured digests. |

> **Deprecated:** `baoyu-image-gen` (use baoyu-imagine) and `baoyu-xhs-images` (use baoyu-image-cards) are kept functional but not in marketplace registration.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime (`brew install oven-sh/bun/bun` or `npm install -g bun`)
- Node.js 18+
- Google Chrome (for CDP-based publishing skills)
- An Anthropic API key (for AI caption generation)

### Install Skills in Your Agent

```bash
# Register the marketplace
/plugin marketplace add JimLiu/baoyu-skills

# Install the plugin
/plugin install baoyu-skills@baoyu-skills
```

Or tell your agent: *"Please install Skills from github.com/JimLiu/baoyu-skills"*

### Run the Web UI

```bash
git clone https://github.com/JimLiu/baoyu-skills.git
cd baoyu-skills
bun install
bun run build
bun run dev:web
# → Open http://localhost:3200
```

### Run the CLI

```bash
# Start Web UI from CLI
bun packages/cli/src/bin.ts web --port 3200

# Diagnostics
bun packages/cli/src/bin.ts doctor

# List projects
bun packages/cli/src/bin.ts projects
```

### Run the Desktop App

```bash
bun run dev:desktop
```

---

## Environment Configuration

At least one image generation API key is required. Add to `.env` (project) or `~/.baoyu-skills/.env` (global):

```bash
# Anthropic (required for AI captions and planning)
ANTHROPIC_API_KEY=sk-ant-...

# Image generation — pick at least one:
OPENAI_API_KEY=sk-...                    # OpenAI DALL-E / GPT Image
GOOGLE_API_KEY=...                       # Google Gemini
DASHSCOPE_API_KEY=sk-...                 # Aliyun Tongyi Wanxiang
ARK_API_KEY=...                          # ByteDance Seedream (豆包)

# Publishing (WeChat API only — others use Chrome login)
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
```

Supported image backends: OpenAI, Azure OpenAI, Google Gemini, OpenRouter, DashScope, Replicate, Z.AI, MiniMax, Jimeng, Seedream.

---

## Customization (EXTEND.md)

All skills support per-project and per-user customization via `EXTEND.md`:

```
.baoyu-skills/<skill-name>/EXTEND.md     # Project-level
~/.baoyu-skills/<skill-name>/EXTEND.md   # User-level
```

Configure default styles, custom palettes, watermark settings, Chrome profiles, and publishing preferences. Each skill's SKILL.md documents its supported EXTEND.md keys.

---

## Repository Structure

```
HappyImage/
├── skills/          # 21 baoyu-* skill directories (self-contained)
├── packages/
│   ├── core/        # @happyimage/core — shared runtime & AI pipeline
│   ├── web-ui/      # React + Vite + Hono — Web workspace
│   ├── cli/         # happyimage CLI
│   └── desktop/     # Electron desktop wrapper
├── docs/            # Author-facing reference documentation
├── scripts/         # Repo maintenance (sync, hooks, publish)
└── screenshots/     # Style/layout preview assets
```

---

## Disclaimer

- **baoyu-danger-gemini-web** and **baoyu-danger-x-to-markdown** use reverse-engineered APIs. Use at your own risk — no guarantees on stability or availability.
- Publishing skills automate form-filling only. They do not click "Publish" — you always retain final control.

---

## Credits

Created and maintained by [JimLiu](https://github.com/JimLiu) and contributors. Skills built by the baoyu-skills community.

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=JimLiu/baoyu-skills&type=Date)](https://star-history.com/#JimLiu/baoyu-skills&Date)
