# HappyImage Settings Guide

The Settings page has 5 sections.

## 1. Runtime

Checks whether system dependencies are installed (Bun, Git, Chrome, baoyu-skills directory).

- **Green dot** = installed and ready
- **Red dot** = required but missing
- **Amber dot** = optional dependency

### Skills Directory

HappyImage needs a directory containing baoyu-* skills:

- **Built-in**: Uses the project `skills/` directory by default — no config needed
- **config/skills/**: Recommended install path (default)
- **Custom**: Enter a path and click "Use Directory"

To install skills from GitHub: click "Install from GitHub".

## 2. AI Models

Two tabs:

### Execution

Model used for planning, copywriting, and multi-turn editing. Supports Anthropic/Claude-compatible APIs.

Required fields:
- **API Key**: Anthropic API Key (`sk-ant-...`)
- **Base URL**: Default `https://api.anthropic.com`. Change when using a proxy or compatible gateway.
- **Model**: Default `claude-sonnet-4-6`

### Image Gen

Backends used by baoyu-imagine. Supports OpenAI, Google Gemini, OpenRouter, DashScope, Azure OpenAI, Replicate, Z.AI, MiniMax, Jimeng, Seedream.

Each provider card shows:
- Status (default / saved / empty)
- Base URL and Model
- API Key status (set / not set)

Actions:
- **Edit Config**: Open dialog to fill in API Key, Base URL, Model, etc.
- **Set Default**: Make this provider the default image backend

Dialog buttons:
- **Save Config**: Save without changing the default provider
- **Save & Set Default**: Save and set as default simultaneously

## 3. Preferences

### Appearance

- **Theme Mode**: Dark / Light / System
- **Theme Color**: Indigo / Emerald / Rose / Amber / Cyan / Violet
- **Language**: 中文 / English / 日本語

### Defaults

- **Output Directory**: Where generated images and project files are saved
- **Default Aspect Ratio**: 1:1 / 16:9 / 9:16 / 4:3 / 3:4
- **Skip Plan Confirmation**: Generate directly without showing the plan step

### Skill Preferences

Select a Skill → edit defaults → click "Save Skill Preferences". Different skills have different configurable fields (style, layout, palette, watermark, etc.).

## 4. Publishing

### Platform Sessions

Open browser login pages for each platform. Scan QR once — session is saved for future publishing.

- WeChat QR Login / Weibo QR Login / X QR Login / Xiaohongshu QR Login

### WeChat Official Account Setup

Configure WeChat Official Account API parameters (App ID, App Secret, default formatting, comment settings).

### Advanced Browser Config

Collapsible section for Chrome Profile paths and per-platform Chrome executable paths. Auto-detected — usually no changes needed.

## 5. Backup

- **Export JSON**: Download all API keys and settings as a JSON file
- **Import JSON**: Restore all settings from a backup file
