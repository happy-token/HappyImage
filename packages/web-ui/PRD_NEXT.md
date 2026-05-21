# HappyImage Web UI Next PRD

## 背景

HappyImage 是 baoyu-skills 的图形化工作台。目标不是编辑、管理或测试 skills，而是让用户通过 Web UI 使用 skills：用卡片选择 skill、选择风格/布局/偏好、输入自然语言或项目上下文，生成图片、文案、项目产物，并准备发稿到微信、微博、X、小红书等平台。

当前已经具备基础闭环：

- 创作台选择 skill、风格、比例、语言、张数。
- 支持自然语言输入、本地项目路径、GitHub URL 上下文。
- 生成 baoyu 风格项目产物：`source-*.md`、`analysis.md`、`outline.md`、`copy.md`、`prompts/*.md`、图片。
- 读取并编辑常见 `EXTEND.md` 偏好。
- 生成发布包，打开微信/微博/X 浏览器填稿流程。
- `happyimage web/doctor/build` CLI 雏形。

## 产品目标

1. 降低 baoyu-skills 使用门槛，避免用户记忆大量 slash 命令和参数。
2. 保留 baoyu-skills 原有能力和项目产物结构，而不是重新实现一套独立生成逻辑。
3. 把自然语言交互、固定选项选择、图片修改、文案预览、发稿准备统一在一个 Web 工作流里。
4. 支持其他 agent 并行实现：前端体验、后端 skill runner、发布平台、测试/打包可以拆开推进。

## 产品形态

HappyImage 需要同时提供三种使用方式，三者共享同一套核心服务、配置和项目产物结构。

| 形态 | 目标用户 | 入口 | 必须能力 |
| --- | --- | --- | --- |
| CLI | 开发者、自动化脚本、远程服务器用户 | `happyimage ...` | 启动 Web UI、健康检查、初始化配置、列出项目、触发/恢复任务 |
| Web UI | 主要创作用户 | `happyimage web --open` 或本地 URL | skill 卡片选择、风格选择、自然语言交互、项目预览、图片修改、发稿准备 |
| 桌面端应用 | 非技术用户、重度日常用户 | macOS/Windows App | 内置启动服务、设置 API key/账号、管理 Chrome 登录态、打开本地项目、系统通知 |

### 共享原则

- CLI、Web UI、桌面端都读取同一套 `.env`、`EXTEND.md`、项目输出目录。
- 桌面端不重新实现业务逻辑，只包装本地服务和 Web UI。
- CLI 不只用于启动服务，也要支持脚本化操作。
- 三种形态生成的项目目录必须兼容：`source`、`analysis.md`、`outline.md`、`copy.md`、`prompts/`、图片、发布包。

## 非目标

- 不在 Web UI 里编辑 skill 源码。
- 不替代 baoyu-imagine 或平台发布 skill，只做 UI 编排和运行时适配。
- 不默认自动点击最终发布按钮。真实发布前必须由用户确认。
- 不把 API key 或平台账号上传到远端服务。

## 当前缺口

| 编号 | 缺口 | 影响 |
| --- | --- | --- |
| G1 | 生成后缺少项目级 Chat/修改流 | 用户无法自然地“修改第 3 张图/换风格/调整文案” |
| G2 | baoyu skill 的交互式确认未完全 UI 化 | 自然语言场景仍不够像原 CLI 的完整决策流程 |
| G3 | 发布平台预览弱 | 无法在发布前检查不同平台版式、字数和图片限制 |
| G4 | 偏好 schema 覆盖不完整 | 当前只覆盖常见字段，未覆盖每个 skill 的专属配置 |
| G5 | 小红书真实发稿未接入 | 只能准备素材，不能打开平台自动填稿 |
| G6 | CLI/npm/桌面化不完整 | 只能本地跑，未形成可分发产品 |
| G7 | 自动化测试不足 | 目前主要靠手动 smoke test |

## P0：项目级 Chat 与图片修改

### 用户故事

用户生成一组图片后，可以继续在同一个项目里输入：

- “第 3 张标题太长，改短一点”
- “整体换成更高级的蓝白科技风”
- “保留内容，但把第 1 张重画成封面感”
- “文案更适合小红书一点”

系统应定位到项目、prompt、图片和文案，生成修改计划，并允许用户选择只重生成单张、重生成一组、或只更新文案。

### 功能需求

- 新增项目详情/会话视图，入口来自创作台生成结果和历史页。
- 每个项目维护 `conversation.json` 或 `sessions/*.json`，记录用户指令、系统修改计划、变更文件、重生成图片路径。
- 支持选择目标：全部、单张图片、文案、prompt 文件。
- 支持增量重生成：只重写相关 `prompts/NN-*.md` 和对应图片，保留旧版本。
- 图片版本管理：同一张图可保留 `01-cover.png`、`01-cover.v2.png`，UI 可比较/回退。
- 支持从当前 `analysis.md`、`outline.md`、`copy.md`、目标 prompt 和用户新指令生成修改计划。

### 建议接口

```http
GET /api/projects/:encodedProjectId
POST /api/projects/:encodedProjectId/chat
POST /api/projects/:encodedProjectId/regenerate
```

`POST /chat` 输入：

```json
{
  "message": "第 3 张标题太长，改短一点",
  "target": { "type": "image", "index": 3 }
}
```

输出 SSE 事件：

- `plan`: 修改计划
- `file`: 更新的 prompt/copy 文件
- `image`: 新图片
- `done`
- `error`

### 验收标准

- 用户可以从历史项目进入详情页。
- 用户可以选择某一张图并输入修改要求。
- 只重生成被选中的图片，不影响其他图片。
- UI 展示新旧版本，并能选择当前采用版本。
- `bun run build` 通过。

## P1：交互式 Skill Runner

### 目标

把 baoyu-skills 里原本终端里的确认流程映射成 Web UI，不让模型每次生成固定选项表单，固定选项由代码生成。

### 功能需求

- 从 Web UI skill data 和 `EXTEND.md` 生成确认表单。
- 支持“使用偏好并跳过”与“本次覆盖”两种模式。
- 支持 skill 的用户输入约定：单次展示多个问题，用户一次性确认。
- 自然语言输入后，先输出结构化计划，再让用户确认：内容拆解、页数、风格、比例、平台。
- 确认后才调用生成流程。

### 验收标准

- 对 `image-cards`、`cover-image` 至少完整支持确认流。
- 用户不需要知道 slash 命令。
- 固定选项不由大模型生成。

## P1：平台发布预览与校验

### 功能需求

- 小红书预览：标题、正文、标签、图片顺序。
- 微信预览：标题、作者、正文、封面/正文图片。
- 微博/X 预览：字数、图片数量、长文/短文模式。
- 平台限制校验：
  - X 普通帖图片最多 4 张。
  - 微博普通帖图片最多 18 张。
  - 微信标题长度、作者、图片大小提示。
- 发布前显示发布包路径和将执行的脚本/参数。

### 验收标准

- 不打开平台前，用户可以在 UI 里看见即将发布的内容。
- 超出限制时禁用“打开平台填稿”，并给出明确修复建议。

## P1：偏好 Schema 完整化

### 功能需求

- 为每个主要 skill 建立 UI schema：
  - `image-cards`
  - `cover-image`
  - `infographic`
  - `slide-deck`
  - `comic`
  - `article-illustrator`
  - `diagram`
  - `post-to-wechat`
  - `post-to-weibo`
  - `post-to-x`
- Schema 应描述字段类型、默认值、可选项、保存路径、是否敏感。
- 敏感字段不回显明文。
- 保存前展示将写入的 `EXTEND.md` 预览。

### 验收标准

- UI 不再依赖一组硬编码通用字段。
- 新增 skill schema 不需要改 Settings 页面核心逻辑。

## P2：小红书发稿接入

### 前提

先确认 baoyu-skills 是否已有可用的 `baoyu-post-to-xiaohongshu` 或等价脚本。如果没有，需要另立 skill 或只保留素材准备。

### 功能需求

- 准备小红书发布包：标题、正文、标签、图片。
- 如果有发布 skill，接入 `/api/publish`。
- 如果没有，UI 明确显示“暂仅素材包”，不要假装能发。

### 验收标准

- 小红书平台选择下，按钮状态与真实能力一致。

## P2：npm 与桌面应用

### CLI

现有命令：

```bash
happyimage web --port 3200 --open
happyimage desktop --port 3200
happyimage init
happyimage config
happyimage projects
happyimage doctor
happyimage build
```

当前状态：

- `happyimage web`：已完成，本地 API + production Web UI。
- `happyimage desktop`：已完成第一版，使用 Chrome app-mode 提供桌面式窗口；后续可替换为 Electron/Tauri 原生包。
- `happyimage init`：已完成，检查基础环境、生成 `.env`、创建输出目录。
- `happyimage config`：已完成，打印配置路径。
- `happyimage projects`：已完成，列出历史项目。
- `happyimage doctor`：已完成，检查 Bun、Chrome、API key、skills root、built UI。
- `happyimage build`：已完成，构建 Web UI。

### npm 分发

- package 不应依赖当前仓库相对路径。
- 需要明确 baoyu-skills 查找策略：
  - 当前工作目录
  - `BAOYU_SKILLS_ROOT`
  - `~/.baoyu-skills`
- 发布前跑 `doctor` 和 smoke test。

### 桌面应用

可选路线：

- Tauri：轻量，适合本地文件和进程调用。
- Electron：生态成熟，打包体积更大。

当前实现：

- `happyimage desktop` 使用 Chrome app-mode 启动本地 Web UI，满足“桌面端使用方式”的最小可用版本。
- 后续如果需要分发 `.dmg/.exe`，建议在同一 API/Web 代码基础上加 Electron/Tauri shell，不重复实现业务逻辑。

### 验收标准

- 新机器上按 README 能启动 Web UI。
- `doctor` 能明确指出缺失的 Bun、Chrome、API key、baoyu-skills root。
- `desktop` 能打开独立桌面式窗口。

## P2：测试计划

### 后端 API

- `/api/preferences/:skillId` 读取/保存路径。
- `/api/package` 拒绝非法路径。
- `/api/publish` 拒绝非法路径和不支持平台。
- `/api/accounts/wechat` 解析单账号/多账号。

### 前端 E2E

- Settings 页面保存 skill 偏好。
- Settings 页面保存公众号账号。
- 创作台选择微信后显示账号或配置提示。
- 历史页能列出项目。

### 构建验证

```bash
cd web-ui
bun run build
bun run bin/happyimage.ts doctor
```

## 推荐 Agent 分工

### Agent A：项目 Chat 与重生成

负责：

- 项目详情页。
- `/api/projects/:id`、`/api/projects/:id/chat`。
- 单张/批量重生成。
- 图片版本管理。

主要文件：

- `web-ui/src/pages/HistoryPage.tsx`
- `web-ui/src/pages/StudioPage.tsx`
- `web-ui/server/routes/api.ts`
- `web-ui/server/lib/anthropic.ts`
- 新增 `web-ui/server/routes/projects.ts`

### Agent B：交互式 Skill Runner

负责：

- 根据 skill data + preferences 生成确认表单。
- 自然语言计划确认。
- 将固定选项选择从模型生成转为代码生成。

主要文件：

- `web-ui/src/data/*`
- `web-ui/src/pages/StudioPage.tsx`
- `web-ui/server/lib/preferences.ts`
- 新增 `web-ui/server/lib/skill-schema.ts`

### Agent C：发布预览与平台校验

负责：

- 发布预览组件。
- 平台限制校验。
- 发布脚本参数预览。
- 小红书能力探测。

主要文件：

- `web-ui/src/pages/StudioPage.tsx`
- `web-ui/server/routes/package.ts`
- `web-ui/server/routes/publish.ts`
- 新增 `web-ui/server/lib/platform-rules.ts`

### Agent D：偏好 Schema 与设置页

负责：

- 每个 skill 的 `EXTEND.md` schema。已完成基础 schema 数据。
- Settings 表单 schema 化。已完成，Settings 从 `/api/preferences/:skillId/schema` 渲染字段。
- 敏感字段遮罩和保存预览。

主要文件：

- `web-ui/src/pages/SettingsPage.tsx`
- `web-ui/server/lib/preferences.ts`
- `web-ui/src/data/preference-schemas.ts`

### Agent E：测试与打包

负责：

- Playwright E2E。已完成基础覆盖。
- 后端 API 测试。已完成基础覆盖。
- CLI `init/config/projects/desktop`。已完成基础版本。
- npm 包路径解耦。

主要文件：

- `web-ui/bin/happyimage.ts`
- `web-ui/package.json`
- `web-ui/README.md`
- 新增 `web-ui/tests/*`

## 并行开发注意事项

- 不要改 baoyu skill 源码，除非任务明确要求。
- 不要自动发布真实平台内容。
- 不要把 API key 或 app secret 写入日志。
- 多个 agent 改同一文件前先划清边界，尤其是 `StudioPage.tsx` 和 `SettingsPage.tsx`。
- 每个 agent 完成后至少运行 `bun run build`。
