# HappyImage 快速开始

最快 2 分钟从零到生成第一张图。

## 1. 安装与启动

优先选择适合你的方式：

### 方式 A：桌面安装包（推荐给普通用户）

如果你拿到的是 macOS、Windows 或 Linux 安装包，直接安装并打开 **HappyImage**。桌面版会自动启动本地网页界面，并使用本机 Chrome 处理平台登录和自动填写。

打开后进入 **设置** 完成密钥配置。

### 方式 B：npm / npx 启动（推荐给命令行用户）

如果已发布 npm 包，可直接通过 `happyimage` 命令启动网页界面或桌面式窗口：

```bash
# 一次性运行
npx @happyimage/cli init
npx @happyimage/cli web --open

# 或全局安装
npm install -g @happyimage/cli
happyimage init
happyimage web --open
```

支持的启动/管理方式：

| 方式 | npx | 全局安装后 | 用途 |
|---|---|---|---|
| 网页界面 | `npx @happyimage/cli web --open` | `happyimage web --open` | 启动本地服务和生产版网页界面，并打开浏览器 |
| 网页界面指定端口 | `npx @happyimage/cli web --port 3200 --open` | `happyimage web --port 3200 --open` | 端口被占用时切换端口 |
| 桌面式窗口 | `npx @happyimage/cli desktop` | `happyimage desktop` | 用 Chrome 应用窗口打开 HappyImage，需要本机 Chrome |
| 初始化配置 | `npx @happyimage/cli init` | `happyimage init` | 检查环境并生成 `.env` 模板 |
| 构建网页界面 | `npx @happyimage/cli build` | `happyimage build` | 手动构建网页界面；`web` 启动时缺少构建产物会自动构建 |
| 诊断检查 | `npx @happyimage/cli doctor` | `happyimage doctor` | 检查 Bun、Chrome、密钥、技能目录、输出目录 |
| 查看配置路径 | `npx @happyimage/cli config` | `happyimage config` | 查看配置文件、技能目录、输出目录 |
| 查看项目 | `npx @happyimage/cli projects` | `happyimage projects` | 列出已生成项目 |

最短启动流程：

```bash
npx @happyimage/cli init
npx @happyimage/cli web --open
```

### 方式 C：源码运行（开发者）

```bash
# 克隆项目
git clone https://github.com/happy-token/HappyImage.git
cd HappyImage

# 安装依赖
bun install

# 编译
bun run build

# 启动 Web 服务
bun run dev:web
```

浏览器打开 `http://localhost:3200`。

## 2. 配置密钥

打开 **设置** → **AI 模型配置**：

- **执行模型**：填入 `ANTHROPIC_API_KEY`（文案生成必需）
- **生图模型**：至少配置一个图片后端（OpenAI、Google Gemini 等）

> 详细配置说明见 [设置指南](settings-guide.md)。

## 3. 生成第一张图

1. 在左侧输入框输入主题，如 "HappyImage 推广卡片"
2. 选择风格、布局、配色和比例
3. 点击生成
4. AI 先展示计划供确认，确认后开始生图
5. 图片生成后显示在项目面板中

## 4. 发布到平台

1. 在项目页切换到"发布"标签
2. 选择目标平台（小红书 / 微博 / X / 微信公众号）
3. 点击"生成配文"，AI 按平台格式生成文案
4. 预览平台效果并确认
5. 点击"自动填写发布"

> 首次使用需要配置登录态，详见 [发布指南](publish-guide.md)。

## 下一步

- [设置指南](settings-guide.md) — 密钥、模型提供商、偏好、外观配置
- [发布指南](publish-guide.md) — 各平台规则、登录态管理、常见排查
