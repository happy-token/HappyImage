# HappyImage Web UI — PRD

## 产品概述

HappyImage 是 baoyu-skills（AI 内容生成技能集）的 Web UI 封装。用户在可视化界面中浏览风格、输入内容、配置参数，获得可执行的 Claude Code 斜杠命令或直接触发生成。

## 核心问题

baoyu-skills 有 20+ 个技能，每个技能有复杂的风格/布局/配色参数系统。用户通过 CLI 使用技能时，需要记住参数名称、风格选项、布局类型，体验门槛高。Web UI 解决：**看不懂参数 → 可视化浏览 → 引导式选择 → 一键出命令**。

## 功能范围

### P0：画廊浏览 + 向导 + 命令导出

| 功能 | 说明 |
|------|------|
| 技能画廊 | 按技能/维度筛选浏览 100+ 风格、布局、配色，含 124 张 WebP 预览图 |
| 风格详情 | 每个技能的完整参数系统、预设、推荐组合、适用场景 |
| 五步向导 | 选技能 → 输入内容 → 智能推荐 → 确认/自定义 → 导出命令 |
| 智能推荐 | 根据输入内容的关键词匹配推荐风格组合 |
| 三路确认 | 一键确认推荐 / 逐维度自定义 / 浏览全部选项 |
| 命令导出 | 生成标准 `/baoyu-xxx` 斜杠命令，复制或下载 JSON/Markdown |

### P1：Claude Code CLI 集成

| 功能 | 说明 |
|------|------|
| 一键生成 | 后端调用 `claude -p` 执行技能，完整分析+prompt+生成流程 |
| 结果展示 | 解析输出中的图片路径，在前端展示 |

### Out of Scope

- 不实现自定义 prompt 工程（由 Claude Code SKILL.md 驱动）
- 不替代 baoyu-imagine 后端
- 不支持发布到社交平台

## 技术架构

```
浏览器 (React 19 + Vite + Tailwind CSS 4)
    │
    ├── /api/skills      → 技能数据
    ├── /api/generate    → spawn claude -p 执行技能
    ├── /api/export      → 生成导出配置
    ├── /api/images/*    → 生成图片文件
    └── /*               → 静态文件 (dist/)
```

| 层 | 技术 | 理由 |
|----|------|------|
| 前端 | React 19 + TypeScript + Vite 6 | 已有项目标准 |
| 样式 | Tailwind CSS 4 + 自定义 @theme | 设计 token 管理 |
| 后端 | Hono 4 (Bun) | 轻量 HTTP，Bun 原生 |
| 数据 | TypeScript 模块 | 从 SKILL.md 提取，无数据库 |

## 技能覆盖

| 技能 ID | 名称 | 参数系统 |
|---------|------|---------|
| `image-cards` | 图文卡片 | 12 styles × 8 layouts × 3 palettes × 24 presets |
| `xhs-images` | 小红书图片 | 同上（已弃用，功能保留） |
| `infographic` | 信息图 | 22 styles × 21 layouts × 18 recommended combos |
| `cover-image` | 封面图 | 5D: type × palette × rendering × text × mood |
| `slide-deck` | 幻灯片 | 17 presets (texture × mood × typo × density) |
| `comic` | 知识漫画 | 6 art × 7 tones × 7 layouts × 5 presets |
| `article-illustrator` | 文章插图 | 6 types × 8 styles × 3 palettes |
| `diagram` | 技术图表 | 9 diagram types (SVG) |

## 向导流程

```
Step 1: Skill  ──→ Step 2: Content ──→ Step 3: Style ──→ Step 4: Review ──→ Step 5: Execute
                        │                      │
                        │ 输入内容              │ 三路选择：
                        │ 关键词匹配推荐        │ ✅ 确认推荐
                        │                      │ 🎛️ 自定义调整
                        │                      │ 📋 浏览全部
```

## 视觉设计

- 配色：暖奶油基底 `#F5F0E8` + 深蓝灰文字 `#1e293b`
- 字体：Playfair Display (标题) + Inter (正文) + JetBrains Mono (代码)
- 布局：bento-grid 不对称卡片 + 画廊网格
- 动效：卡片 stagger 入场、向导步骤过渡、选中态 ring 高亮

## 启动方式

```bash
cd web-ui
bun run build   # 构建前端
bun run server  # 启动 http://localhost:3100
```
