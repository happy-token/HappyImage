<h1 align="center">Happy Token Web</h1>

<p align="center">Happy Token Web frontend — Next.js workspace UI, same-origin proxy, and official gallery static package host.</p>

Happy Token Web 是 Happy Token 的用户界面层，负责图片工作台、登录态页面、官方图库静态包、同源 middleware，以及浏览器到 Happy Token API / NewAPI 的请求分流。用户、会话、历史记录、私有图片和系统设置由 `happyimage-api` 持久化；模型账号池、上游调试、额度/计费和 token 路由由 NewAPI 等模型网关管理。

## 职责边界

| 模块 | 负责 | 不负责 |
|:--|:--|:--|
| `happyimage-web`（本仓库） | Next.js 页面、用户工作台、同源 middleware、官方图库静态包读取与构建入口、`/v1/*` 服务端代理 | 用户历史/私有图库持久化、API 数据库、模型账号池管理 |
| `happyimage-api` | 登录、OIDC、用户、图片任务历史、用户图库、私有图片访问、设置、日志、OpenAI-compatible 图片接口 | 前端页面、官方图库静态资源发布、NewAPI 上游账号调试、充值/额度 |
| `happyimage-gallery-source` | 官方图库源数据和候选池，供 `pnpm run gallery:build` 导出 | 运行时服务、GitHub 版本化发布 |
| NewAPI / 模型网关 | 模型渠道、账号池、上游调试、token、额度/计费路由 | Happy Token 用户登录、历史会话、用户图库、私有图片 |

推荐请求分流：

```text
Browser -> happyimage-web
  /api/*, /images/*, /image-thumbnails/* -> BACKEND_URL / happyimage-api
  /seed-gallery/*                       -> public/seed-gallery static package
  /v1/*                                 -> MODEL_BACKEND_URL / NewAPI
```

## 本地开发

```bash
pnpm install
pnpm run dev
```

前端开发模式默认使用同源请求，由 Next.js middleware 转发 `/api/*`、`/images/*` 到 `BACKEND_URL`。这是推荐模式，因为登录 Cookie、历史会话同步、私有图片签名链接都会保持在当前浏览器 origin 下。如需让浏览器直接请求其他后端地址，才设置环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run dev
```

如果需要让 Web 应用接口走 Happy Token API、模型 `/v1/*` 请求走 NewAPI，本地开发使用同源代理：

```bash
BACKEND_URL=http://127.0.0.1:8000 \
MODEL_BACKEND_URL=http://127.0.0.1:3001 \
MODEL_BACKEND_API_KEY=sk-happytokentest \
pnpm run dev
```

对应链路：

```text
/api/*, /images/*, /image-thumbnails/* -> BACKEND_URL
/v1/*                                  -> MODEL_BACKEND_URL
```

图片生成类型与接口分流：

| 类型 | 前端工作台使用方式 | 产品接口 | 外部模型接口 |
|:--|:--|:--|:--|
| 文生图 | 用户只输入提示词，未上传参考图 | `POST /api/image-tasks/generations` -> `BACKEND_URL` | `POST /v1/images/generations` -> `MODEL_BACKEND_URL` |
| 图生图 / 图片编辑 | 用户上传参考图、源图，或提示词要求保持人物脸部/身份参考 | `POST /api/image-tasks/edits` -> `BACKEND_URL` | `POST /v1/images/edits` -> `MODEL_BACKEND_URL` |

Happy Token Web 的图片工作台应优先调用 `/api/image-tasks/*`，因为这些接口会保留登录态、历史 session、用户图库、私有图片和下载状态。`/v1/images/*` 是给 NewAPI、Cherry Studio 或其他 OpenAI-compatible 外部客户端使用的图片接口；在同源代理模式下由 Next.js middleware 转发到 `MODEL_BACKEND_URL`。

`MODEL_BACKEND_API_KEY` 只在 Next.js middleware 服务端使用，用于代理 `/v1/*` 时替换成 NewAPI token，不会直接暴露给浏览器。

### 供应商与错误提示

普通用户需要在“我的 -> 供应商”中添加并选择模型供应商。图片工作台不会使用后端 `.env` 里的模型网关密钥作为用户兜底；提交文生图、图生图或编辑生图时，后端只使用当前用户选中的 Base URL 和 API Key。

前端会把后端或模型网关返回的常见错误转换成可操作提示：

| 场景 | 页面提示 |
|:--|:--|
| 没有配置供应商 | 请先在用户设置中配置模型供应商 Base URL 和 API Key。 |
| 供应商额度、余额或 credit 不足 | 模型供应商额度不足，请先充值或更换供应商后再试。 |
| API Key 无效或过期 | 模型供应商 API Key 无效或已过期，请在用户设置里更新 API Key。 |
| curl/TLS/OpenSSL/连接中断 | 连接模型供应商失败，请稍后重试；如果持续出现，请检查 Base URL 或网络代理。 |
| 模型不可用 | 当前模型不可用，请在生图页面切换可用模型后再试。 |

充值、额度和计费由 NewAPI 或外部模型供应商负责，Happy Token Web 只展示供应商返回的额度不足提示，不维护本地 image quota。

同源代理模式下不要设置 `NEXT_PUBLIC_API_BASE_URL`。例如页面从 `http://localhost:3000` 打开时，如果把它设置成 `http://127.0.0.1:3000`，浏览器会按跨域请求处理，历史会话恢复、图片访问等接口可能无法同步。

常用公开配置：

| 变量 | 说明 |
|:--|:--|
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器直连 API 地址；同源代理模式保持为空 |
| `BACKEND_URL` | Next.js middleware 转发 `/api/*`、`/images/*` 的服务端地址 |
| `MODEL_BACKEND_URL` | Next.js middleware 转发 `/v1/*` 的服务端模型网关地址 |
| `MODEL_BACKEND_API_KEY` | 服务端代理 `/v1/*` 使用的模型网关 token |
| `NEXT_PUBLIC_APP_VERSION` | 前端展示版本号 |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | “联系我们”里的邮箱 |
| `NEXT_PUBLIC_SUPPORT_WECHAT` | “联系我们”里的微信号 |

## 构建

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run build
# Docker 镜像使用 Next standalone 输出，运行层只包含 server.js、必要依赖和静态资源。
```

如果部署环境也运行 Next.js middleware，则可以继续保持 `NEXT_PUBLIC_API_BASE_URL` 为空，并通过服务端环境变量配置：

```bash
BACKEND_URL=https://api.example.com
MODEL_BACKEND_URL=https://newapi.example.com/v1
MODEL_BACKEND_API_KEY=<newapi-token>
NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true
```

## 故障记录

跨仓库技术日志维护在后端仓库：

- `happyimage-api/docs/technical-log.md`
- `happyimage-api/docs/newapi-gateway.md`

排查图片无法加载、历史会话恢复、NewAPI 网关、同源代理配置时，优先阅读这两个文档。

## 本地清理

可安全删除的生成目录：

```bash
rm -rf .next .open-next out .wrangler tsconfig.tsbuildinfo
```

不要删除 `.dev.vars` 或 `.env*`，除非你明确要重置本地环境变量。

## Docker 部署

```bash
docker build \
  --build-arg NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true \
  -t happytoken-web .

docker run -p 3000:3000 \
  -e BACKEND_URL=http://happytoken-api:80 \
  -e MODEL_BACKEND_URL=https://newapi.example.com/v1 \
  -e MODEL_BACKEND_API_KEY=<newapi-token> \
  happytoken-web
```

Docker 镜像运行的是 Next.js server，不是静态 nginx。这样 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/v1/*` 可以继续走 middleware 分流：

```text
/api/*, /images/*, /image-thumbnails/* -> BACKEND_URL
/v1/*                                  -> MODEL_BACKEND_URL
```

同源代理模式下 `NEXT_PUBLIC_API_BASE_URL` 保持为空；如果构建时设置了它，浏览器会直连该地址，不再使用同源代理。

## 官方图库静态包

官方图库是公开只读静态资源，运行时优先从 `public/seed-gallery` 读取，不需要经过 Happy Token API。该目录已被 `.gitignore` 和 `.dockerignore` 忽略，避免把大体积图片提交到 GitHub 或默认打进 Docker 镜像。

仅生成静态 JSON（图片和缩略图已通过对象存储、CDN 或 volume 另行提供时使用）：

```bash
pnpm run gallery:json
```

生成完整静态包（包含图片和已生成缩略图）：

```bash
pnpm run gallery:build
```

默认读取 `../happyimage-gallery-source`，调用 `../happyimage-api` 中的图库归一化脚本，输出到 `public/seed-gallery`。如需覆盖路径：

```bash
pnpm run gallery:build -- \
  --source-dir=/srv/happyimage-gallery-source \
  --api-dir=/srv/happyimage-api \
  --output=/srv/happyimage/seed-gallery
```

Docker 部署时建议把图库包作为只读 volume 挂载：

```bash
docker run -p 3000:3000 \
  -v /srv/happyimage/seed-gallery:/app/web/public/seed-gallery:ro \
  -e BACKEND_URL=https://api.example.com \
  -e MODEL_BACKEND_URL=https://newapi.example.com/v1 \
  -e MODEL_BACKEND_API_KEY=<newapi-token> \
  happyimage-web
```

如果 `public/seed-gallery/static/items.json` 不存在，前端会自动回退到 Happy Token API 的 `/api/seed-gallery/*` 兼容接口。

## 部署到 Cloudflare Pages

自动部署由 `.github/workflows/deploy-web.yml` 处理。需要在 GitHub 仓库配置：

| Secrets / Variables | 说明 |
|:--|:--|
| `vars.API_BASE_URL` | 后端 API 地址 |
| `secrets.CLOUDFLARE_API_TOKEN` | Cloudflare API Token（Pages 编辑权限） |
| `secrets.CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `vars.CF_PAGES_PROJECT` | Cloudflare Pages 项目名（默认 `happyimage`） |

## 关联仓库

| 项目 | 说明 |
|:--|:--|
| [happyimage-api](https://github.com/happy-token/happyimage-api) | 产品后端，负责登录、用户、历史、图库、设置和 `/api/*` |
| `../happyimage-gallery-source` | 本地/服务器官方图库源数据，不提交 GitHub |
| NewAPI / 模型网关 | 外部模型渠道、账号池、上游调试和 token 管理 |

部署编排见后端的 `docker-compose.yml`；Web Docker 镜像运行 Next.js server，官方图库静态包通过 volume/CDN/对象存储提供。

## NewAPI Management

HappyImage exposes `/settings/newapi` as the product entry for NewAPI management. The page embeds `newapiManagementUrl` from the authenticated session, defaulting to `https://gateway.happy-token.cn`.

Browser verification must confirm that the embedded NewAPI page can use Casdoor/NewAPI session cookies in Chrome and Safari. If iframe loading is blocked, users can open NewAPI in a new window from the same page.
