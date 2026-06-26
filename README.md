# Happy Token

Happy Token 统一工作区。

```text
happyimage-api/              后端：登录、用户、历史、私有图片、设置、API
happyimage-web/              前端：页面、同源产品 middleware、官方图库静态包
happyimage-gallery-source/   官方图库源数据和候选池，不提交 GitHub
```

请求边界：

```text
/api/*, /images/*, /image-thumbnails/*, /health  -> happyimage-api
/seed-gallery/*                                  -> happyimage-web/public/seed-gallery
```

HappyImage Web 只代理产品路径到 `BACKEND_URL`，不代理或暴露 `/v1/*`。外部 OpenAI-compatible 客户端应直接使用 NewAPI / 模型网关，例如 `gateway.happy-token.cn/v1/*`。

统一登录与 NewAPI 绑定：

```text
auth.happy-token.cn                    -> Casdoor 统一登录
image.happy-token.cn                   -> HappyImage 产品入口
image.happy-token.cn/settings/newapi   -> HappyImage 原生 HappyToken 管理页
gateway.happy-token.cn                 -> NewAPI 管理 UI 与模型网关
gateway.happy-token.cn/v1/*            -> NewAPI OpenAI-compatible 模型接口
```

HappyImage 普通用户登录只走 Casdoor OIDC。用户登录后，后端用 Casdoor `sub` 作为稳定身份，创建或复用 NewAPI 用户和 `HappyImage Default` 令牌，并写入当前用户的默认 HappyToken 供应商配置。额度、计费、令牌管理和用量审计由 NewAPI 负责，HappyImage 不做本地账本。

`/settings/newapi` 是 HappyImage 自己的 HappyToken 管理页，展示绑定状态、NewAPI 用户 ID、默认 API Key 和 token 列表。它不依赖 iframe 自动登录 NewAPI：后端 SQL/provisioning 能创建 NewAPI 用户和 token，但不会给浏览器写入 NewAPI `session` cookie；直接打开 `gateway.happy-token.cn` 可能仍显示未登录，这是独立网关后台的浏览器会话问题，不影响 HappyImage 已绑定的默认 API Key。

线上 HappyImage 当前整理到 `/opt/happytoken/happyimage`，组合部署使用工作区根目录的 `deploy/hs/docker-compose.yml`，Caddy 是统一入口。旧的 `/data/HappyServices` 顶层 compose 形态属于历史部署记录。当前服务边界：

| 服务 | 公网入口 | 内部职责 |
|:--|:--|:--|
| Caddy | 80/443 | TLS、反代、跨域策略 |
| Casdoor | `auth.happy-token.cn` | 统一用户登录和 OIDC issuer |
| NewAPI | `gateway.happy-token.cn` | 模型网关、用户 token、额度和审计 |
| HappyImage Web | `image.happy-token.cn` | 图片产品前端 |
| HappyImage API | `image.happy-token.cn/api/*` | 图片任务、历史、用户资料 |
| PostgreSQL | 内网 Docker 网络 | 平台基础数据库 |
| Redis | 内网 Docker 网络 | NewAPI/sub2api 缓存 |
| sub2api/chatgpt2api | 子域名入口 | 基础模型服务层 |
| Umami | 子域名入口 | 访问统计 |
| Mihomo | 内网 Docker 网络 | 出站代理 |

图片生成类型与接口：

| 类型 | 使用方式 | Happy Token 产品接口 |
|:--|:--|:--|
| 文生图 | 只输入提示词，不上传参考图 | `POST /api/image-tasks/generations`，由 `happyimage-api` 保存任务、历史和用户图库 |
| 图生图 / 图片编辑 | 上传一张或多张参考图，并输入编辑或生成要求 | `POST /api/image-tasks/edits`，multipart 上传图片，由 `happyimage-api` 保存任务、历史和用户图库 |

前端工作台只使用 `/api/image-tasks/*`，这样可以保留登录态、历史 session、私有图片和下载管理。外部 OpenAI-compatible 客户端应直接调用 NewAPI / 模型网关，不经过 HappyImage Web 或 API。

供应商与额度：

- HappyToken 是默认供应商，登录后自动绑定，不可删除，默认选中；用户可在卡片内进入 HappyToken 管理页查看默认 API Key。
- 添加其他供应商时先选择预设供应商或自定义供应商。预设供应商只填写 API Key；自定义供应商填写名称、Base URL、模型列表和 API Key。协议目前在内部按 OpenAI-compatible 保存，界面暂不暴露选择项。
- 当前预设包含 OpenAI、Gemini / Nano Banana、火山方舟、BytePlus ModelArk、阿里云百炼和自定义供应商。Gemini 图片模型在界面备注为 `gemini-3.1-flash-image（Nano Banana 2）`、`gemini-3-pro-image（Nano Banana Pro）`、`gemini-2.5-flash-image（Nano Banana）`。
- 图片生成不会使用旧 `.env` 模型网关密钥作为用户兜底；后端只使用当前用户选中的供应商。非 OpenAI-compatible 图片接口的供应商后续需要独立 adapter。
- Happy Token 不维护本地 image quota。充值、余额、额度和计费由 NewAPI 或外部模型供应商负责。
- 如果上游返回 quota / credit / balance / billing / 余额 / 额度不足，页面会提示“模型供应商额度不足，请先充值或更换供应商后再试。”
- curl/TLS/OpenSSL/连接中断、API Key 失效、模型不可用等错误会转换成中文可操作提示，并写入图片任务历史。

稳定性验证：

```bash
cd happyimage-api && uv run python -m pytest -q
cd happyimage-web && pnpm exec tsc --noEmit
```

常用入口：

```bash
cd happyimage-api && uv run python main.py
cd happyimage-web && pnpm run dev
cd happyimage-web && pnpm run gallery:build
```
