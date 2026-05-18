# HappyImage Web UI 重设计规格

**日期**: 2026-05-18  
**状态**: 待实现  
**范围**: 全面重设计，用 Anthropic SDK 替换 `claude -p`，新增 Settings 系统

---

## 背景与目标

当前 Web UI 存在四个核心问题：
1. **执行质量差**：用 `claude -p` 发纯文本 prompt，没有走技能逻辑（SKILL.md 未加载，AskUserQuestion 无法工作）
2. **无配置系统**：API Key 和偏好只能改 .env 文件，无法通过 UI 配置
3. **向导繁琐**：5 步向导步骤过多，体验沉重
4. **技能覆盖不全**：只有 8 个技能，22 个中有 14 个未覆盖

**目标**：重设计后，生成质量与直接使用 Claude CLI 一致，用户可通过 Web UI 完整配置 API Key 和偏好。

---

## 架构设计

### 执行引擎替换（核心）

**旧方案**：`spawn('claude', ['-p', prompt])` — 没有加载技能上下文

**新方案**：Anthropic SDK `client.messages.stream()`

```
POST /api/generate (SSE 流式)
├── 从 skills/<id>/SKILL.md 读取内容，作为 system prompt 注入
├── 从 .env 动态读取 ANTHROPIC_API_KEY（每次请求时读，无需重启）
├── 注册 generate_image tool（调用 baoyu-imagine）
├── stream() 流式返回 Claude 输出
├── 当 tool_use 事件触发：执行 bun skills/baoyu-imagine/scripts/main.ts
└── 图片路径通过 SSE event 推回前端
```

### generate_image Tool 参数

```typescript
// Claude 调用此 tool 来生成图片
{
  name: "generate_image",
  input: {
    prompt: string,          // 图片生成 prompt（由 Claude 根据 SKILL.md 规范撰写）
    aspect_ratio?: string,   // 默认读 DEFAULT_ASPECT_RATIO
    backend?: string,        // 默认读 IMAGE_BACKEND（auto 时由 baoyu-imagine 自动选供应商）
    output_dir?: string,     // 默认读 OUTPUT_DIR
  }
}
// tool_result 返回: { image_path: string }
```

### 配置存储

- 存储位置：项目根目录 `.env`
- 读取方式：每次 API 请求时动态 `fs.readFileSync('.env')`，解析后注入，无需重启
- 安全：首次写入 .env 时，自动检查 `.gitignore`，若不含 `.env` 则追加一行（`.gitignore` 不存在则创建）
- 前端展示：Key 值脱敏为 `••••••••` + 末4位

### 后端路由总览

```
GET  /api/settings          → 读取 .env，返回脱敏配置
POST /api/settings          → 写入单个 key-value 到 .env
GET  /api/skills            → 技能元数据（不变）
POST /api/generate          → SSE 流式生成（核心改动）
GET  /api/generate/:id      → 查询生成会话状态（兼容现有轮询）
GET  /api/images/*          → 图片静态文件（不变）
GET  /api/health            → 健康检查（不变）
```

---

## 页面结构

### 导航：左侧边栏（240px 固定）

```
✦ HappyImage
──────────────
🎨 Gallery
🪄 Wizard
📋 History
──────────────
⚙️ Settings     ← 底部固定
```

### 路由

```
/                   → Gallery（默认页）
/wizard             → Wizard Step 1（选技能）
/wizard/:skillId    → Wizard Step 2（填内容 + 参数）
/generate/:id       → Step 3 生成页（流式日志 + 图片）
/history            → 生成历史
/settings           → Settings（默认打开 API Keys 子页）
/settings/:section  → API Keys / 输出目录 / 语言格式 / 默认偏好
```

---

## Settings 系统

### .env 配置结构

```bash
# Anthropic（执行技能必需）
ANTHROPIC_API_KEY=

# 图片生成供应商（baoyu-imagine 使用）
OPENAI_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
GOOGLE_API_KEY=
OPENROUTER_API_KEY=
DASHSCOPE_API_KEY=
REPLICATE_API_TOKEN=

# 输出目录
OUTPUT_DIR=~/output/happyimage

# 语言 & 格式偏好
DEFAULT_LANGUAGE=zh
DEFAULT_ASPECT_RATIO=1:1

# 默认偏好
DEFAULT_SKILL=image-cards
IMAGE_BACKEND=auto
```

### Settings 页面（VS Code 风格）

左侧子分类导航 + 右侧内容区：

| 子分类 | 内容 |
|--------|------|
| 🔑 API Keys | Anthropic + 7个图片生成供应商，每项独立 Save |
| 📁 输出目录 | OUTPUT_DIR，支持路径手填或选择 |
| 🌐 语言 & 格式 | DEFAULT_LANGUAGE（zh/en）、DEFAULT_ASPECT_RATIO |
| 🎨 默认偏好 | DEFAULT_SKILL（下拉选技能）、IMAGE_BACKEND（auto/openai/dashscope/...） |

**交互规则：**
- 每个字段独立 Save，不是整页提交
- 已设置的 Key 显示 `••••••••[末4位]`，点击 Edit 可修改
- 保存后提示"已保存，立即生效"（无需重启）
- 未设置必需 Key 时，在 Wizard 页面显示 Banner 引导进入 Settings

---

## Wizard 流程（3 步）

### Step 1：选技能

22 个技能的卡片网格，按类别分组（内容生成 / 工具类）。点击卡片直接进入 Step 2。

### Step 2：填内容 + 参数

- **内容输入框**：支持 Markdown，最多 4000 字
- **快速参数**：每个技能在 `src/data/<skill>.ts` 中声明 `quickParams` 字段（2-3 项，如风格 / 布局 / 配色），以下拉框展示；未声明则跳过快速参数区
- **高级参数**：可折叠区域，展示该技能的完整维度系统
- **Generate 按钮**：点击跳转 Step 3，触发 SSE 生成

若 `ANTHROPIC_API_KEY` 未设置，Generate 按钮禁用并显示"请先在 Settings 配置 API Key"。

### Step 3：生成页

```
左侧（流式日志）                右侧（图片区域）
─────────────────────────       ──────────────────
✓ 加载技能上下文...             图片生成完立即显示
✓ 分析内容结构...               每张独立显示，不等全部
✓ 选择布局方案...               ┌───────────────┐
⟳ 生成视觉 prompt...            │    图片 1     │
  调用 baoyu-imagine...         └───────────────┘
  ...                           ┌───────────────┐
                                │  图片 2 生成中│
                                └───────────────┘
                                [⬇ 全部下载]
```

- 日志只显示关键步骤节点，过滤原始 token 流
- 生成完毕：显示参数摘要 + "重新生成" + "调整参数"按钮
- 自动写入 History（localStorage，最多保留 50 条）

---

## 技能覆盖

### P0 — 内容生成类（向导 + Anthropic SDK）

| 技能 ID | 技能名 | 参数维度数 |
|---------|--------|-----------|
| image-cards | 图文卡片 | 12 styles × 8 layouts × 3 palettes |
| infographic | 信息图 | 22 styles × 21 layouts |
| cover-image | 封面图 | 5 维度 |
| slide-deck | 幻灯片 | 17 presets |
| comic | 知识漫画 | 6 art × 7 tones × 7 layouts |
| article-illustrator | 文章插图 | 6 × 8 × 3 |
| diagram | 技术图表 | 9 diagram types（有 main.ts，可直接调用） |

### P1 — 工具类（直接调用 Bun，无需 SDK）

P1 工具类有独立的简化流程（不走向导 Step 1-3），在 Gallery 中独立展示，点击后进入简单表单页：

| 技能 ID | 调用方式 | 简化流程 |
|---------|---------|---------|
| imagine | `bun scripts/main.ts`（图片生成后端，P0 依赖它） | 不直接在 UI 暴露，作为 P0 内部工具 |
| translate | `bun scripts/main.ts` | 输入文本 → 选目标语言 → 翻译结果展示 |
| compress-image | `bun scripts/main.ts` | 上传图片 → 选压缩质量 → 下载 |
| markdown-to-html | `bun scripts/main.ts` | 输入 Markdown → HTML 预览 + 下载 |
| format-markdown | `bun scripts/main.ts` | 输入 Markdown → 格式化后展示 |

工具类页面路由：`/tools/:skillId`，结果同步返回（非 SSE）。

### Out of Scope（依赖 Chrome CDP）

- post-to-x / post-to-wechat / post-to-weibo
- danger-gemini-web、danger-x-to-markdown

---

## History 页

- 存储：localStorage，key `happyimage-history`，最多 50 条
- 每条记录：`{ id, skillId, content(前100字), params, images[], timestamp }`
- 操作：查看图片、"用此配置重新生成"（预填 Step 2）、删除单条、清空全部

---

## 非功能需求

| 项目 | 要求 |
|------|------|
| 首屏加载 | FCP < 1.5s（Vite 代码分割，按页懒加载） |
| 流式响应 | SSE，首个 token < 2s |
| API Key 安全 | 前端只显示脱敏值，原始值只在后端 .env 中 |
| .gitignore | 首次写入 .env 时自动检查并追加 |
| 错误处理 | API Key 无效 / 余额不足 / 网络超时均有明确错误提示 |
| 响应式 | 最小宽度 1024px（本地工具，不需要移动端） |

---

## 不在范围内

- 用户账号 / 多用户支持
- 发布到社交平台（post-to-x / wechat 等 CDP 技能）
- 自定义 prompt 工程（由 SKILL.md 驱动）
- 数据库（纯文件 + localStorage）
