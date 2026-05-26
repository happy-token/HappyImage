# HappyImage

[English](./README.md) | 中文

AI 驱动的视觉内容创作与多平台一键发布工具集。生成精美图片卡片、信息图、漫画、幻灯片——然后一键发布到小红书、微信公众号、微博和 X。

**三种接口，零摩擦：** CLI 命令行自动化 · Web UI 可视化工作台 · 桌面端双击即用。

---

## 产品亮点

<table>
<tr>
<td width="50%">

### 所见即所得 —— 平台预览

告别盲猜。每条帖子发布前都能看到**真实平台 mockup 预览**。你的图片、标题、正文、话题标签在对应平台上的呈现效果一目了然——包含实时字符统计、图片网格布局和平台规则校验。

</td>
<td width="50%">

### 多种风格 —— 自由搭配

**12 种视觉风格** × **8 种排版密度** × **3 套配色方案** —— 自由组合，打造专属品牌风格。每种风格都有视觉预览图，看图选择，不用靠名字瞎猜。

| 风格 | 配色 | 排版 |
|-------|---------|--------|
| cute · fresh · warm | macaron · warm · neon | sparse → flow |
| bold · minimal · retro | | |
| pop · notion · chalkboard | | |
| study-notes · screen-print · sketch-notes | | |

</td>
</tr>
<tr>
<td width="50%">

### AI 文案 + 一键发布

一点生成平台适配的推广文案。每个平台有独立的格式模板——小红书话题标签在末尾、微博 `#双#号#` 内联、微信无标签、X 内联 `#tag` 不超 280 字符。Chrome 自动化填入草稿，你只需审视确认后手动点击发布。

</td>
<td width="50%">

### CLI · Web UI · GUI 三种接口

```bash
# CLI — 脚本自动化
bun packages/cli/src/bin.ts web --port 3200

# Web UI — 可视化工作台
bun run dev:web
# → http://localhost:3200

# GUI — 桌面双击即用
bun run dev:desktop
```

同一套技能，同一种输出——选择最适合你工作流的界面。

</td>
</tr>
</table>

---

## 核心功能

### AI 生成引擎

输入主题或文章，选择视觉参数，AI 自动完成规划、大纲和每张图片的生成。流水线产出：

- **analysis.md** —— 内容分析和风格推荐
- **outline.md** —— 逐页分镜规划
- **prompts/*.md** —— 详细图片生成提示词（含 frontmatter）
- **copy.md** —— 可直接编辑的发布文案
- **NN-image.png** —— 最终生成的图片

支持**批量生成**，具备依赖感知排序、并行后端调用和自动重试机制。

### 多平台一键发布

| 平台 | 最多图片 | 标题限制 | 正文限制 | 话题标签 | 发布方式 |
|------|---------|---------|---------|---------|---------|
| 小红书 | 18 张 | 20 字 | 1000 字 | 最多 10 个，末尾独立行 | Chrome CDP |
| 微信公众号 | 不限 | 64 字 | 20000 字 | 不支持 | API 或 Chrome |
| 微博 | 18 张 | 内联【】 | 2000 字 | 内联 `#双#号#` | Chrome CDP |
| X (Twitter) | 4 张 | 内联 | 280 字符 | 内联 `#tag` | Chrome CDP |

**安全发布机制：** 浏览器自动填入所有内容，但绝不替你点击"发布"。你手动审视确认后再发布——杜绝机器人行为触发平台风控。

### 会话聊天

持久化聊天会话，支持 SSE 流式传输。每次生成都创建会话，追踪素材（图片、文件、项目），支持计划确认和迭代优化。中途关闭浏览器，回来可以接着聊。

### 水印与品牌保护

通过 EXTEND.md 偏好设置配置每项技能的水印。自定义文字、位置和透明度，保护你的原创内容。

### 技能根目录管理

从 GitHub 或本地路径安装外部 baoyu-skills 技能集。Web UI 设置页面支持浏览、选择和切换技能根目录——保持工作区灵活更新。

---

## 可用技能（21 个）

### 内容生成

| 技能 | 说明 | 快速上手 |
|------|------|---------|
| **baoyu-image-cards** | 小红书信息图卡片。12 风格 × 8 排版 × 3 配色。 | `/baoyu-image-cards article.md --style fresh --layout balanced` |
| **baoyu-infographic** | 专业信息图，18 种布局和 17 种视觉风格。 | `/baoyu-infographic content.md --layout pyramid --style technical-schematic` |
| **baoyu-diagram** | 技术图表——流程图、时序图、ER 图、架构图、甘特图。 | `/baoyu-diagram architecture.md --type flowchart` |
| **baoyu-cover-image** | 文章/博客封面图，支持自定义配色。 | `/baoyu-cover-image article.md --palette corporate-tech` |
| **baoyu-slide-deck** | 演示幻灯片，统一主题风格。 | `/baoyu-slide-deck talk.md --aspect 16:9` |
| **baoyu-comic** | 多格漫画，支持角色设定表和对白。 | `/baoyu-comic story.md` |
| **baoyu-article-illustrator** | 文章插图——头图、示意图、章节配图。 | `/baoyu-article-illustrator article.md` |

### AI 后端

| 技能 | 说明 |
|------|------|
| **baoyu-imagine** | 主图片生成后端。支持 OpenAI (DALL-E / GPT Image)、Azure OpenAI、Google Gemini、OpenRouter、DashScope、Replicate、Z.AI、MiniMax、Jimeng、Seedream。自动检测可用提供商。 |
| **baoyu-danger-gemini-web** | Gemini Web API（浏览器 Cookie 方式）。通过 Google 网页端免费图片生成。使用风险自负。 |

### 发布

| 技能 | 说明 | 快速上手 |
|------|------|---------|
| **baoyu-post-to-xiaohongshu** | 小红书创作者平台发布，Chrome CDP。 | `/baoyu-post-to-xiaohongshu` |
| **baoyu-post-to-wechat** | 微信公众号发布（图文 + 文章），支持 API 或浏览器，多账号。 | `/baoyu-post-to-wechat article.md --theme default` |
| **baoyu-post-to-weibo** | 微博发布（普通微博 + 头条文章）。 | `/baoyu-post-to-weibo article.md` |
| **baoyu-post-to-x** | X/Twitter 发布（推文、引用推文、X Articles 长文）。 | `/baoyu-post-to-x article.md` |

### 工具

| 技能 | 说明 |
|------|------|
| **baoyu-youtube-transcript** | 下载 YouTube 字幕和封面图。 |
| **baoyu-url-to-markdown** | 将任意 URL 转换为干净 Markdown（Chrome CDP）。 |
| **baoyu-danger-x-to-markdown** | X/Twitter 线程转 Markdown。逆向 API，使用风险自负。 |
| **baoyu-compress-image** | 图片压缩优化，适配网页发布。 |
| **baoyu-format-markdown** | Markdown 格式化排版，支持 CJK 字符优化。 |
| **baoyu-markdown-to-html** | Markdown 转微信兼容 HTML。 |
| **baoyu-translate** | 文章翻译，三种模式：快速、标准、精修。 |
| **baoyu-wechat-summary** | 微信群聊总结，生成结构化摘要和排行榜。 |

> **已弃用：** `baoyu-image-gen`（请用 baoyu-imagine）和 `baoyu-xhs-images`（请用 baoyu-image-cards）保持可用，但不在 marketplace 注册中。

---

## 快速开始

### 环境要求

- [Bun](https://bun.sh) 运行时 (`brew install oven-sh/bun/bun` 或 `npm install -g bun`)
- Node.js 18+
- Google Chrome（CDP 发布技能需要）
- Anthropic API Key（AI 文案生成需要）

### 在 AI Agent 中安装技能

```bash
# 注册插件市场
/plugin marketplace add JimLiu/baoyu-skills

# 安装插件
/plugin install baoyu-skills@baoyu-skills
```

或直接告诉 Agent：*"请从 github.com/JimLiu/baoyu-skills 安装 Skills"*

### 启动 Web UI

```bash
git clone https://github.com/JimLiu/baoyu-skills.git
cd baoyu-skills
bun install
bun run build
bun run dev:web
# → 浏览器打开 http://localhost:3200
```

### CLI 命令行

```bash
# 从 CLI 启动 Web UI
bun packages/cli/src/bin.ts web --port 3200

# 诊断检查
bun packages/cli/src/bin.ts doctor

# 列出项目
bun packages/cli/src/bin.ts projects
```

### 桌面应用

```bash
bun run dev:desktop
```

---

## 环境变量配置

至少需要一个图片生成 API 密钥。添加到 `.env`（项目级）或 `~/.baoyu-skills/.env`（全局）：

```bash
# Anthropic（AI 文案和规划必需）
ANTHROPIC_API_KEY=sk-ant-...

# 图片生成——至少选一个：
OPENAI_API_KEY=sk-...                    # OpenAI DALL-E / GPT Image
GOOGLE_API_KEY=...                       # Google Gemini
DASHSCOPE_API_KEY=sk-...                 # 阿里云通义万相
ARK_API_KEY=...                          # 字节豆包 Seedream

# 发布（仅微信公众号 API 需要——其他平台用 Chrome 登录态）
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
```

支持的图片生成后端：OpenAI、Azure OpenAI、Google Gemini、OpenRouter、DashScope、Replicate、Z.AI、MiniMax、Jimeng、Seedream。

---

## 自定义配置（EXTEND.md）

所有技能支持通过 `EXTEND.md` 进行项目级和用户级自定义：

```
.baoyu-skills/<skill-name>/EXTEND.md     # 项目级
~/.baoyu-skills/<skill-name>/EXTEND.md   # 用户级
```

可配置默认风格、自定义配色、水印设置、Chrome 配置文件路径、发布偏好等。每项技能的 SKILL.md 中记录了支持的 EXTEND.md 键值。

---

## 仓库结构

```
HappyImage/
├── skills/          # 21 个 baoyu-* 技能目录（独立自包含）
├── packages/
│   ├── core/        # @happyimage/core —— 共享运行时和 AI 流水线
│   ├── web-ui/      # React + Vite + Hono —— Web 工作台
│   ├── cli/         # happyimage CLI 命令行工具
│   └── desktop/     # Electron 桌面封装
├── docs/            # 面向作者的参考文档
├── scripts/         # 仓库维护脚本
└── screenshots/     # 风格/排版预览图
```

---

## 免责声明

- **baoyu-danger-gemini-web** 和 **baoyu-danger-x-to-markdown** 使用逆向 API。使用风险自负——不保证稳定性和可用性。
- 发布技能仅自动填表，不会替你点击"发布"按钮——最终控制权始终在你手中。

---

## 鸣谢

[JimLiu](https://github.com/JimLiu) 及社区贡献者创建并维护。

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=JimLiu/baoyu-skills&type=Date)](https://star-history.com/#JimLiu/baoyu-skills&Date)
