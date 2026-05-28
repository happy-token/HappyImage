# HappyImage

[English](./README.md) | 中文

HappyImage 是一个本地优先的 AI 视觉内容工作台。把一个想法、文章、URL 或草稿变成图片卡片、信息图、漫画、封面图、幻灯片和平台适配文案。

它把完整的 `baoyu-skills` 内容生成流程整合到三种入口：

| 入口 | 适合场景 | 启动方式 |
|------|----------|----------|
| 桌面应用 | 日常创作，本地原生体验 | `bun run dev:gui` |
| Web UI | 可视化生成、预览、设置和项目历史 | `bun run dev:web` |
| CLI | 自动化、脚本、诊断和批量任务 | `bun run cli -- doctor` |

![HappyImage gallery preview](./screenshots/gallery-types/image-cards.png)

---

## 产品亮点

<table>
<tr>
<td width="50%" valign="top">

<h3>可视化流程，不靠猜</h3>

<p>从主题、文章、URL 或本地文件开始。HappyImage 会分析内容、建议视觉方向、生成提示词、渲染图片，并把完整项目历史保存在一起。</p>

<p><strong>产物：</strong> <code>analysis.md</code>、<code>outline.md</code>、<code>prompts/*.md</code>、<code>copy.md</code> 和最终图片。</p>

</td>
<td width="50%" valign="top">

<h3>风格选择更容易浏览</h3>

<p>不用记参数名，直接通过图库选择视觉风格。覆盖图片卡片、信息图、图表、封面、漫画、幻灯片和文章插图等工作流。</p>

<p><strong>示例：</strong> fresh、warm、bold、minimal、retro、notion、chalkboard、screen-print、sketch-notes。</p>

</td>
</tr>
<tr>
<td width="50%" valign="top">

<h3>平台规则自动适配</h3>

<p>为小红书、微信公众号、微博和 X 生成平台适配文案与草稿。每个平台都有自己的字数限制、话题标签规则、标题格式和图片约束。</p>

<p><strong>安全机制：</strong> HappyImage 只负责填入草稿供你检查，不会替你点击“发布”。</p>

</td>
<td width="50%" valign="top">

<h3>一套引擎，三种工作方式</h3>

<p>日常创作用桌面应用，可视化配置用 Web UI，自动化流程用 CLI。三者共享同一套本地运行时、设置、技能和输出目录。</p>

<p><strong>本地优先：</strong> API Key、Chrome Profile、生成项目和设置都保存在你的机器上。</p>

</td>
</tr>
</table>

---

## 可以创作什么

| 技能 | 用途 | 示例 |
|------|------|------|
| `baoyu-image-cards` | 小红书风格图片卡片和轮播图 | `/baoyu-image-cards article.md --style fresh --layout balanced` |
| `baoyu-infographic` | 结构化视觉解释、数据/观点信息图 | `/baoyu-infographic content.md --layout pyramid --style technical-schematic` |
| `baoyu-diagram` | 流程图、时序图、ER 图、架构图、时间线 | `/baoyu-diagram architecture.md --type flowchart` |
| `baoyu-cover-image` | 文章、博客、播客、Newsletter 封面图 | `/baoyu-cover-image article.md --palette corporate-tech` |
| `baoyu-slide-deck` | 风格统一的演示幻灯片 | `/baoyu-slide-deck talk.md --aspect 16:9` |
| `baoyu-comic` | 多格漫画、角色设定和对白 | `/baoyu-comic story.md` |
| `baoyu-article-illustrator` | 头图、章节配图、示意图和编辑插画 | `/baoyu-article-illustrator article.md` |

---

## 核心功能

### AI 生成流水线

HappyImage 会把源材料整理成可复现的项目目录：

- `analysis.md` - 内容分析与风格建议
- `outline.md` - 逐页分镜或结构规划
- `prompts/*.md` - 带 frontmatter 的完整图片提示词
- `copy.md` - 可编辑的发布文案
- `NN-image.png` - 最终渲染图片

流水线支持批量生成、依赖感知排序、并行后端调用、自动重试和持久化项目状态。

### 多平台发布

| 平台 | 图片 | 标题 | 正文 | 话题标签 | 方式 |
|------|------|------|------|----------|------|
| 小红书 | 最多 18 张 | 20 字 | 1000 字 | 最多 10 个，独立行 | Chrome CDP |
| 微信公众号 | 不限 | 64 字 | 20000 字 | 无 | API 或 Chrome |
| 微博 | 最多 18 张 | 内联 `【】` | 2000 字 | 内联 `#话题#` | Chrome CDP |
| X | 最多 4 张 | 内联 | 280 字符 | 内联 `#tag` | Chrome CDP |

发布技能只自动创建草稿和填写表单。你始终需要自己检查并确认发布。

### 会话聊天

生成过程绑定到持久化聊天会话，并支持 SSE 流式输出。会话会追踪消息、计划、产物、图片、输出文件和项目历史，关闭浏览器后也可以继续。

### 水印与品牌保护

通过 `EXTEND.md` 为每个技能配置水印。可自定义文字、位置和透明度，用于保护生成图片。

---

## AI 后端

| 技能 | 说明 |
|------|------|
| `baoyu-imagine` | 主图片生成后端。支持 OpenAI、Azure OpenAI、Google Gemini、OpenRouter、DashScope、Replicate、Z.AI、MiniMax、Jimeng 和 Seedream。 |
| `baoyu-danger-gemini-web` | 通过浏览器 Cookie 使用 Gemini Web 图片生成。适合实验，但网页端行为可能变化。 |

正常图片生成至少需要配置一个图片后端 API Key。

---

## 工具技能

| 技能 | 说明 |
|------|------|
| `baoyu-youtube-transcript` | 下载 YouTube 字幕和封面图。 |
| `baoyu-url-to-markdown` | 通过 Chrome CDP 将 URL 转为干净 Markdown。 |
| `baoyu-danger-x-to-markdown` | 通过逆向 API 将 X/Twitter 线程转 Markdown。 |
| `baoyu-compress-image` | 压缩和优化发布图片。 |
| `baoyu-format-markdown` | 支持 CJK 排版的 Markdown 格式化。 |
| `baoyu-markdown-to-html` | Markdown 转微信公众号兼容 HTML。 |
| `baoyu-translate` | 文章翻译，支持快速、标准、精修模式。 |
| `baoyu-wechat-summary` | 将微信群聊总结为结构化摘要。 |

仍可用但已弃用：`baoyu-image-gen`（请用 `baoyu-imagine`）和 `baoyu-xhs-images`（请用 `baoyu-image-cards`）。

---

## 快速开始

### 1. 安装依赖

- [Bun](https://bun.sh) 运行时：`brew install oven-sh/bun/bun` 或 `npm install -g bun`
- Node.js 18+
- Google Chrome，用于 CDP 发布和浏览器自动化
- Anthropic 兼容 Key，用于规划、文案和多轮聊天
- 至少一个图片生成后端 Key

### 2. 克隆并构建

```bash
git clone https://github.com/happy-token/HappyImage.git
cd HappyImage
bun install
bun run build
```

### 3. 启动一个入口

```bash
# 桌面应用
bun run dev:gui

# Web UI
bun run dev:web
# 打开 http://localhost:3200

# CLI 诊断
bun run cli -- doctor
```

CLI、Web UI、GUI/Desktop 的根目录开发、构建、打包和发布命令见 [Development, Build, and Release](docs/development-release.md)。

### 4. 作为 Agent 插件安装

```bash
/plugin marketplace add happy-token/HappyImage
/plugin install baoyu-skills@happyimage-skills
```

也可以直接告诉 Agent：“请从 github.com/happy-token/HappyImage 安装 Skills”。

---

## 环境变量配置

将密钥添加到项目 `.env` 或全局 `~/.baoyu-skills/.env`：

```bash
# 规划、文案和聊天
ANTHROPIC_API_KEY=sk-ant-...

# 图片生成 - 至少选择一个
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DASHSCOPE_API_KEY=sk-...
ARK_API_KEY=...

# 仅微信公众号 API 发布需要。其他平台使用 Chrome 登录态。
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
```

支持的图片后端包括 OpenAI、Azure OpenAI、Google Gemini、OpenRouter、DashScope、Replicate、Z.AI、MiniMax、Jimeng 和 Seedream。

---

## 自定义

所有技能都支持通过 `EXTEND.md` 做项目级和用户级自定义：

```text
.baoyu-skills/<skill-name>/EXTEND.md
~/.baoyu-skills/<skill-name>/EXTEND.md
```

可用于配置默认风格、配色、水印、Chrome Profile、发布偏好和其他技能专属设置。每个技能会在自己的 `SKILL.md` 中说明支持的选项。

---

## 仓库结构

```text
HappyImage/
├── skills/          # 自包含的 baoyu-* 技能
├── packages/
│   ├── core/        # 共享运行时、设置、编排和 AI 流水线
│   ├── web-ui/      # React + Vite 前端与 Hono API 服务
│   ├── cli/         # happyimage CLI
│   └── desktop/     # Electron 桌面封装
├── docs/            # 作者侧参考文档
├── scripts/         # 仓库维护、打包、发布脚本
└── screenshots/     # 图库和文档预览素材
```

---

## 注意事项

- `baoyu-danger-gemini-web` 和 `baoyu-danger-x-to-markdown` 依赖非官方网页/API 行为，上游平台变化时可能失效。
- 发布技能只自动填写表单，不会点击“发布”；最终控制权始终在你手里。
- Chrome 系技能共享本地浏览器 Profile。平台路径和覆盖方式见 [docs/chrome-profile.md](./docs/chrome-profile.md)。

---

## 致谢

HappyImage 基于 [JimLiu](https://github.com/JimLiu) 的 [baoyu-skills](https://github.com/JimLiu/baoyu-skills) 构建。核心 AI 流水线、技能定义和多平台发布能力来自 baoyu-skills 生态。

由 [happy-token](https://github.com/happy-token) 和贡献者维护。

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=happy-token/HappyImage&type=Date)](https://star-history.com/#happy-token/HappyImage&Date)
