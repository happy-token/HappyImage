# Settings 页面 & 用户指南 DX 重构计划

## Summary

重构 Settings 页面信息架构（8→5 分区）、修正按钮措辞、建立完整 i18n 机制、拆分用户指南为三个独立文档。

## Decisions Made

| # | 决策 | 选择 |
|---|------|------|
| D1 | Settings 信息架构 | 5 分区方案 |
| D2 | 技能目录按钮 | "重置为默认" / "从 GitHub 安装" / "查看安装说明" |
| D3 | 平台登录按钮 | 登录态区 → "微信扫码登录"，公众号区 → "打开微信登录页" |
| D4 | Provider 按钮 | "添加模型服务" / "编辑配置" / 弹窗双按钮 |
| D5 | 语言混杂 | 完整 i18n（zh/en 映射表） |
| D6 | 用户指南结构 | 拆分为快速开始 / 设置指南 / 发布指南三个文档 |

## Key Changes

### 1. Settings 页面信息架构重组织 (5 分区)

```
当前 (8)                        →  新 (5)
─────────────────────────────────────────────────────
环境依赖 (依赖检查+技能目录)      →  1. 运行环境
执行模型 (Anthropic provider)    →  2. AI 模型配置
生图模型 (图片 provider)         →     (合并，tab 切换 执行/生图)
Skill 偏好 (EXTEND.md 偏好)     →  3. 偏好设置
默认配置 (OUTPUT_DIR/比例/跳过)  →     (合并外观+输出+Skill偏好)
外观 (主题/语言)                 →
平台发布设置 (登录+公众号+Chrome)→  4. 平台发布
备份导入 (导出/导入)             →  5. 备份与恢复
```

- 删除 `groups` 数组死代码
- 删除 `groupsByTitle` 查找逻辑
- `settingSections` 精简为 5 项
- provider section 用 tab 切换执行模型/生图模型

### 2. 按钮措辞修正

| 位置 | 当前 | 改为 |
|------|------|------|
| 技能目录 — 默认 | "使用默认目录" | "重置为默认" |
| 技能目录 — 安装 | "安装到当前目录" | "从 GitHub 安装" |
| 平台登录态 — 微信 | "打开微信登录" | "微信扫码登录" |
| 平台登录态 — 微博 | "打开微博登录" | "微博扫码登录" |
| 平台登录态 — X | "打开 X 登录" | "X 扫码登录" |
| 平台登录态 — 小红书 | "打开小红书登录" | "小红书扫码登录" |
| 公众号向导 — 微信 | "打开微信登录" | "打开微信登录页" |
| Provider dropdown | "添加供应商" | "添加模型服务" |
| Provider 卡片 | "配置" | "编辑配置" |
| Provider 弹窗 | "保存并设为默认" | "保存配置"（主）+ "保存并设为默认"（次） |

### 3. i18n 机制

- 建立 `packages/web-ui/src/i18n/settings.ts` — Settings 页面所有 UI 字符串的 zh/en 映射表
- 读取 `DEFAULT_LANGUAGE` 设置决定语言
- 覆盖范围：
  - 侧边栏分区标签 + hints
  - 页面标题 + 描述
  - 所有 section eyebrow + 标题
  - 状态标签 (ready/check/ok/required/optional/missing → 就绪/检查/正常/必需/可选/缺失)
  - Provider 卡片状态 (default/saved/empty → 默认/已保存/未配置)
  - 按钮标签
  - 提示文字和说明段落
  - 依赖检查卡片描述

### 4. 用户指南拆分

```
docs/
├── user-guide.md              → docs/guides/zh/quick-start.md
├── (新增)                       → docs/guides/zh/settings-guide.md
├── (新增)                       → docs/guides/zh/publish-guide.md
├── (新增)                       → docs/guides/en/quick-start.md
├── (新增)                       → docs/guides/en/settings-guide.md
└── (新增)                       → docs/guides/en/publish-guide.md
```

**quick-start.md**: 安装 bun、启动项目、打开浏览器、一分钟生成第一张图
**settings-guide.md**: Settings 页面 5 个分区的逐项说明，每项配截图
**publish-guide.md**: 平台登录态、公众号配置、一键发布流程、各平台规则速查、常见排查

原 `docs/user-guide.md` 保留为索引页，链接到三个新文档。

## Implementation Tasks

- [ ] **T1 (P1, human: ~3h / CC: ~30min)** — Settings IA — 8→5 分区重构
  - Files: `packages/web-ui/src/pages/SettingsPage.tsx`
  - 删除 `groups` / `groupsByTitle` / `renderSettingsGroup`
  - 重写 `settingSections` 为 5 项
  - 合并 execution/image provider 为带 tab 的单一 section
  - 合并 默认配置+外观 为 "偏好设置"

- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — 按钮措辞修正
  - Files: `packages/web-ui/src/pages/SettingsPage.tsx`
  - 按决策 D2-D4 修改所有按钮标签

- [ ] **T3 (P1, human: ~4h / CC: ~45min)** — i18n 映射表
  - Files: `packages/web-ui/src/i18n/settings.ts` (新增), `SettingsPage.tsx`
  - 建立 zh/en 字符串映射
  - `useMemo` 根据 `DEFAULT_LANGUAGE` 设置选语言
  - 替换所有硬编码字符串为 i18n key

- [ ] **T4 (P1, human: ~3h / CC: ~30min)** — 用户指南拆分
  - Files: `docs/guides/zh/*.md`, `docs/guides/en/*.md`
  - 写 quick-start.zh.md / settings-guide.zh.md / publish-guide.zh.md
  - 翻译为英文版
  - 更新 `docs/user-guide.md` 为索引页

## Test Plan

- [ ] `bun run build` 通过
- [ ] `bun test packages/web-ui/tests/api.test.ts` 通过
- [ ] 手动验证 Settings 页面 5 个分区切换正常
- [ ] 手动验证 zh/en 语言切换，所有字符串正确翻译
- [ ] 手动验证所有按钮标签与功能一致
- [ ] 英文用户能通过 en guide 完成首次配置

## NOT in scope

- ja 日语翻译（i18n 映射表预留 ja key，翻译后续补）
- 其他页面（StudioPage、GuidePage、GalleryPage）的 i18n
- Settings 页面视觉 redesign
- 用户指南截图/录屏

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | /plan-ceo-review | Scope & strategy | 0 | — | — |
| Codex Review | /codex review | Independent 2nd opinion | 0 | — | — |
| Eng Review | /plan-eng-review | Architecture & tests | 0 | — | — |
| Design Review | /plan-design-review | UI/UX gaps | 0 | — | — |
| DX Review | /plan-devex-review | Developer experience gaps | 1 | CLEAR | Settings IA 5-partition, button labels fixed, full i18n, docs split into 3 guides |

**VERDICT:** DX Review CLEARED — 4 concerns addressed, 6 decisions made, 4 implementation tasks defined.
