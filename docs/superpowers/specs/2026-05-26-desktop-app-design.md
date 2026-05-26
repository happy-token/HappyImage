# HappyImage Desktop App Design Spec

## 背景

HappyImage 已有 `packages/desktop/` 基础 Electron 壳（120 行），spawn web server 作为 sidecar，在 BrowserWindow 加载 Web UI。目标是在此基础上构建完整的 macOS 桌面应用，提供深度原生集成体验。

## 技术方案

**Enhanced Electron** — 在现有 Electron 代码上增强，利用内置的原生 API 覆盖所有需求。

| 能力 | 实现方式 |
|------|---------|
| 原生文件操作 | `dialog.showOpenDialog` + `shell.openPath`（内置） |
| 系统通知 | `Notification` API（内置） |
| 全局快捷键 | `globalShortcut`（内置） |
| 自动更新 | `electron-updater` |
| 签名/公证/打包 | `electron-builder` |
| 原生菜单/Tray | `Menu` / `Tray`（内置） |

## 目标平台

macOS 优先，Windows 后续。

## 架构

```
+--------------------------------------------------+
|              Electron Main Process                |
|                                                  |
| lifecycle.ts    sidecar.ts     native/           |
| (app ready,     (spawn bun,    (notifications,  |
|  single lock,    health poll,   shortcuts,      |
|  quit cleanup)   auto-restart)  file dialogs,   |
|                                  updater, tray)  |
|        |              |              |            |
|        +--------------+--------------+            |
|                       | IPC (invoke/handle)       |
+-----------------------|---------------------------+
|             Renderer Process                      |
|  +---------------------------------------------+ |
|  |   window.happyDesktop (contextBridge)       | |
|  |   openProject / revealInFinder / notify     | |
|  |   onShortcut / checkUpdate / getAppInfo     | |
|  +---------------------------------------------+ |
|  +---------------------------------------------+ |
|  |          Existing React Web UI              | |
|  |   StudioPage / SettingsPage / GalleryPage   | |
|  +---------------------------------------------+ |
+--------------------------------------------------+
```

核心原则：Main process 只管原生能力，业务逻辑全在 Web UI 侧。Renderer 通过 `contextBridge` 暴露的 `window.happyDesktop` 调用原生功能，不直接访问 Node.js。

## 文件结构

```
packages/desktop/
├── src/
│   ├── main.ts              # 入口，拼装所有模块
│   ├── lifecycle.ts         # app ready / single lock / quit cleanup / activate
│   ├── sidecar.ts           # spawn bun server，健康检查，带退避自动重启
│   ├── window.ts            # BrowserWindow 创建、loadURL、错误页
│   ├── native/
│   │   ├── notifications.ts # 系统通知
│   │   ├── shortcuts.ts     # 全局快捷键注册/注销
│   │   ├── files.ts         # 文件对话框、拖拽打开、Finder 定位
│   │   ├── updater.ts       # electron-updater 检查/下载/安装
│   │   ├── tray.ts          # 系统托盘图标+菜单
│   │   └── menu.ts          # 原生菜单栏 (File/Edit/View/Help)
│   ├── ipc.ts               # 集中注册所有 ipcMain.handle
│   ├── preload.ts           # contextBridge 暴露 window.happyDesktop
│   └── paths.ts             # 资源路径解析（dev vs packaged）
├── tests/
│   ├── preload.test.ts
│   ├── lifecycle.test.ts
│   ├── sidecar.test.ts
│   ├── paths.test.ts
│   ├── ipc.test.ts
│   └── e2e/
│       └── desktop.e2e.ts
├── electron-builder.yml
├── entitlements.mac.plist
├── build/
│   ├── icon.icns
│   └── background.png
├── scripts/
│   ├── notarize.sh
│   └── sign-check.sh
├── dev-app-update.yml
├── package.json
└── tsconfig.json
```

## Preload API

```typescript
interface HappyDesktop {
  // 项目操作
  openProjectDialog(): Promise<string | null>
  revealInFinder(path: string): Promise<void>
  getRecentProjects(): Promise<string[]>

  // 系统通知
  notify(title: string, body: string): void

  // 应用信息
  getAppInfo(): { version: string; platform: string }

  // 更新
  checkUpdate(): Promise<UpdateInfo | null>
  downloadUpdate(): Promise<void>
  installUpdate(): void

  // 快捷键事件订阅（返回取消函数）
  onShortcut(action: string, callback: () => void): () => void
}
```

## 数据流

- **配置和项目产物**：Web UI 通过 Hono server 读写文件系统（保持现状），不走 IPC。Web 模式、CLI 模式、桌面模式共用同一套后端逻辑。
- **原生能力**：仅文件对话框、通知、快捷键、更新、Finder 定位走 IPC bridge。
- **Sidecar 端口**：默认 `3100`，冲突时递增尝试 3 次（3101, 3102），都不行则报错退出。
- **Server 崩溃恢复**：指数退避重试 5 次（1s → 2s → 4s → 8s → 16s），5 次后显示错误页面并提供"重启服务"按钮。

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| Server 启动失败（端口占用） | 端口递增重试 3 次 → 弹原生 dialog 报错退出 |
| Server 运行时崩溃 | 带退避自动重启（最多 5 次），tray 图标变红指示异常 |
| Server 超时无响应 | 30s 健康检查超时 → 视为崩溃走重启流程 |
| 文件对话框用户取消 | 返回 `null`，不做任何操作 |
| Auto-update 下载失败 | 静默记录，下次启动重试 |
| IPC 通信异常 | Renderer 侧 catch，降级为 web 行为 |

## 安全

- `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true`
- Preload 只暴露声明式 API，不暴露 `ipcRenderer` 原始对象
- 文件路径参数在 main process 侧做校验（`path.resolve` + 必须在 `app.getPath('home')` 子树内）
- Server 启动时端口随机分配（默认 3100）
- `shell.openExternal` 只允许 `https:` 协议

## 测试

| 层级 | 工具 | 覆盖面 |
|------|------|--------|
| Preload API 单元测试 | `bun test` | 每个方法的参数校验、返回类型 |
| 主进程模块测试 | `bun test` | 路径解析、端口递增、退避重试 |
| IPC 集成测试 | `bun test` + electron-mock | handler 注册/调用流程 |
| E2E 测试 | Playwright + `electron.launch()` | 窗口创建、文件对话框、通知触发、更新流程 |
| 打包烟雾测试 | 手动脚本 | `.dmg` 安装 → 启动 → 验证 |

## 打包分发

**electron-builder.yml 关键配置：**

```yaml
appId: com.happyimage.desktop
productName: HappyImage
mac:
  target: [dmg, zip]
  entitlements: entitlements.mac.plist
  hardenedRuntime: true
  notarize: true
  icon: build/icon.icns
  category: public.app-category.graphics-design
dmg:
  background: build/background.png
  window: { width: 480, height: 400 }
publish:
  provider: generic
  url: https://releases.happyimage.app
```

**entitlements 最小权限：**

- `com.apple.security.cs.allow-unsigned-executable-memory` — Electron 必需
- `com.apple.security.network.client` — 访问本地 API
- `com.apple.security.files.user-selected.read-write` — 文件对话框

**npm scripts：**

```json
{
  "dev": "tsc -w & electron .",
  "build": "tsc && electron-builder build --mac",
  "build:dir": "tsc && electron-builder build --mac --dir",
  "release": "tsc && electron-builder build --mac --publish always",
  "sign:check": "sh scripts/sign-check.sh"
}
```

**自动更新流程：** GitHub Release → `latest-mac.yml` → `electron-updater` 拉取 → 后台下载 → 下次启动安装。更新进度通过 IPC 推到 renderer。

## 验收标准

1. `bun run build` 通过，Electron 应用启动并加载 Web UI
2. `bun run dev` 支持热重载开发
3. 文件对话框可打开项目目录，Web UI 响应打开的项目
4. 系统通知在图片生成完成时触发
5. 全局快捷键可注册并在 Web UI 响应
6. `.dmg` 签名打包通过 `spctl -a -v` 验证
7. 自动更新拉取、下载、安装流程可用
8. Server sidecar 崩溃后自动重启
9. 关闭窗口时清理 sidecar 进程，不留僵尸进程
