<h1 align="center">HappyImage Web</h1>

<p align="center">HappyImage Web frontend - Next.js workspace UI, same-origin product proxy, and official gallery static package host.</p>

HappyImage Web 是 HappyImage 的浏览器界面层，负责图片工作台、登录态页面、官方图库静态包、同源 middleware，以及用户设置入口。用户、会话、历史记录、私有图片、系统设置、模型网关绑定和上游供应商配置由 `happyimage-api` 持久化和管理。

## 职责边界

| 模块 | 负责 | 不负责 |
|:--|:--|:--|
| `happyimage-web`（本仓库） | Next.js 页面、用户工作台、同源 middleware、官方图库静态包读取与构建入口 | 用户历史/私有图库持久化、API 数据库、模型账号池管理、模型协议代理 |
| `happyimage-api` | 登录、OIDC、用户、图片任务历史、用户图库、私有图片访问、设置、日志、模型网关绑定 | 前端页面、官方图库静态资源发布、NewAPI 上游账号调试、充值/额度 |
| `happyimage-gallery-source` | 官方图库源数据和候选池，供 `pnpm run gallery:build` 导出 | 运行时服务、GitHub 版本化发布 |
| NewAPI / 模型网关 | 模型渠道、账号池、上游调试、token、额度/计费路由 | HappyImage 用户登录、历史会话、用户图库、私有图片 |

推荐请求分流：

```text
Browser -> happyimage-web
  /api/*, /images/*, /image-thumbnails/*, /health -> BACKEND_URL / happyimage-api
  /seed-gallery/*                                 -> public/seed-gallery static package
```

Web middleware 只代理 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/health` 到 `BACKEND_URL`。Web 不提供模型协议代理；图片工作台通过 `/api/image-tasks/*` 调用 HappyImage API，再由 API 使用当前用户选中的上游供应商或默认 HappyToken 供应商。上游模型网关 Base URL（例如 `https://gateway.happy-token.cn/v1`）在 API 运行时设置中配置。

## 本地开发

```bash
pnpm install
BACKEND_URL=http://127.0.0.1:8000 pnpm run dev
```

前端开发模式默认使用同源请求，由 Next.js middleware 转发产品接口到 `BACKEND_URL`。这是推荐模式，因为登录 Cookie、历史会话同步、私有图片签名链接都会保持在当前浏览器 origin 下。

如需让浏览器直接请求其他 API 地址，才设置：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run dev
```

同源代理模式下不要设置 `NEXT_PUBLIC_API_BASE_URL`。例如页面从 `http://localhost:3000` 打开时，如果把它设置成 `http://127.0.0.1:3000`，浏览器会按跨域请求处理，历史会话恢复、图片访问等接口可能无法同步。

## Web 环境变量

| 变量 | 说明 |
|:--|:--|
| `BACKEND_URL` | Next.js middleware 的服务端转发目标；代理 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/health` |
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器直连 API 地址；同源代理部署保持为空 |
| `NEXT_PUBLIC_APP_VERSION` | 前端展示版本号 |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | “联系我们”里的邮箱 |
| `NEXT_PUBLIC_SUPPORT_WECHAT` | “联系我们”里的微信号 |

## 管理员运行时设置

以下设置不再通过 Web Dockerfile、Web README 启动命令或部署环境变量配置。请在 `api/config.json`、首次 `/setup` 或 Web 管理设置页中维护；密钥类字段会在 API 响应中脱敏。

| 设置 | 位置 / 字段 | 说明 |
|:--|:--|:--|
| Public app URL | `public_app_url` | 用户访问 Web 的公开地址，用于登录跳转和跨站 Cookie 判断 |
| Optional API public URL | `api_public_url` | API 有独立公网域名时填写；为空时可沿用公开应用地址 |
| Session / cookie | `session_secret`、`session_cookie_name`、`session_cookie_domain`、`session_max_age_seconds` | Web 登录会话签名、Cookie 名称、域和有效期 |
| OAuth / OIDC | `oidc.enabled`、`issuer`、`client_id`、`client_secret`、`scopes`、`allowed_email_domains` | 第三方登录配置 |
| Model gateway URLs | `model_gateway.gateway_api_base_url`、`model_gateway.gateway_management_url` | 默认 HappyToken/NewAPI 网关 API 地址和管理入口；API 地址通常形如 `https://gateway.happy-token.cn/v1` |
| NewAPI binding | `model_gateway.provision_url`、`provision_secret`、`sql_dsn`、`token_name` | OIDC 登录后创建/复用 NewAPI 用户和 token 的 provisioning 或 SQL 直连配置 |
| Proxy | `proxy` | API 服务访问上游供应商时使用的代理 |
| Image storage | `image_storage.*`、`image_retention_days`、`image_access_token_ttl_seconds` | 本地/WebDAV 图片存储、公开 CDN 前缀、保留期和签名链接 TTL |
| Safety settings | `sensitive_words`、`ai_review.*`、`global_system_prompt` | 内容安全、AI 审核和全局提示词设置 |

## 构建

```bash
pnpm run build
```

如果要构建浏览器直连 API 的产物：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run build
```

同源 middleware 部署必须在构建时保持 `NEXT_PUBLIC_API_BASE_URL` 为空；这是 Next 客户端构建期值，运行时环境变量不能可靠覆盖已打进 bundle 的值。运行层只设置 `BACKEND_URL`：

```bash
BACKEND_URL=https://api.example.com
```

## Docker 部署

直接使用 GitHub Actions 发布的镜像：

```bash
docker pull ghcr.io/happy-token/happyimage-web:latest

docker run -p 3000:3000 \
  -e BACKEND_URL=http://happyimage-api:80 \
  ghcr.io/happy-token/happyimage-web:latest
```

Web + API 组合部署见工作区根目录 `deploy/hs/docker-compose.yml`：

```bash
docker compose -f deploy/hs/docker-compose.yml pull
docker compose -f deploy/hs/docker-compose.yml up -d
```

如果 GHCR package 不是公开可读，需要先在目标机器登录：

```bash
docker login ghcr.io
```

本地构建镜像：

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL="" \
  -t happyimage-web .

docker run -p 3000:3000 \
  -e BACKEND_URL=http://happyimage-api:80 \
  happyimage-web
```

Docker 镜像运行的是 Next.js server，不是静态 nginx。这样 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/health` 可以继续走 middleware 到 `BACKEND_URL`。如果构建时设置了非空 `NEXT_PUBLIC_API_BASE_URL`，浏览器会直连该地址，不再使用同源代理；运行时再设为空不能可靠撤销这个构建结果。

## 官方图库静态包

官方图库是公开只读静态资源，运行时优先从 `public/seed-gallery` 读取，不需要经过 HappyImage API。该目录已被 `.gitignore` 和 `.dockerignore` 忽略，避免把大体积图片提交到 GitHub 或默认打进 Docker 镜像。

仅生成静态 JSON（图片和缩略图已通过对象存储、CDN 或 volume 另行提供时使用）：

```bash
pnpm run gallery:json
```

生成完整静态包（包含图片和已生成缩略图）：

```bash
pnpm run gallery:build
```

默认读取 `../data/gallery-source`，调用 `../api` 中的图库归一化脚本，输出到 `public/seed-gallery`。如需覆盖路径：

```bash
pnpm run gallery:build -- \
  --source-dir=/srv/happyimage-gallery-source \
  --api-dir=/srv/happyimage/api \
  --output=/srv/happyimage/seed-gallery
```

Docker 部署时建议把图库包作为只读 volume 挂载：

```bash
docker run -p 3000:3000 \
  -v /srv/happyimage/seed-gallery:/app/web/public/seed-gallery:ro \
  -e BACKEND_URL=https://api.example.com \
  happyimage-web
```

如果 `public/seed-gallery/static/items.json` 不存在，前端会自动回退到 HappyImage API 的 `/api/seed-gallery/*` 兼容接口。

## 部署到 Cloudflare Workers

Web 使用 OpenNext / Cloudflare Workers 形态部署，Worker 运行时通过 `BACKEND_URL` 访问 HappyImage API。`wrangler.jsonc` 的 `vars.BACKEND_URL` 是本地占位值；GitHub Actions 部署会要求 `vars.BACKEND_URL` 存在，并在发布前写入 Wrangler 配置，避免生产环境使用仓库里的占位后端。

自动部署由 `.github/workflows/deploy-web.yml` 处理。需要在 GitHub 仓库配置：

| Secrets / Variables | 说明 |
|:--|:--|
| `vars.BACKEND_URL` | Worker 服务端代理目标，供 middleware 转发 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/health` |
| `secrets.CLOUDFLARE_API_TOKEN` | Cloudflare API Token（Workers 编辑/部署权限） |
| `secrets.CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

## 本地清理

可安全删除的生成目录：

```bash
rm -rf .next .open-next out .wrangler tsconfig.tsbuildinfo
```

不要删除 `.dev.vars` 或 `.env*`，除非你明确要重置本地环境变量。

## 关联仓库

| 项目 | 说明 |
|:--|:--|
| [happyimage-api](https://github.com/happy-token/happyimage-api) | 产品后端，负责登录、用户、历史、图库、设置和 `/api/*` |
| `../data/gallery-source` | 本地/服务器官方图库源数据，不提交 GitHub |
| NewAPI / 模型网关 | 外部模型渠道、账号池、上游调试和 token 管理 |

组合 Web/API 部署编排见工作区根目录的 `deploy/hs/docker-compose.yml`；API-only 部署见 `api/docker-compose.yml`。Web Docker 镜像运行 Next.js server，官方图库静态包通过 volume/CDN/对象存储提供。

## NewAPI Management

HappyImage exposes `/settings/newapi` as the product entry for HappyToken/NewAPI management. The page is a native HappyImage page, not an iframe-first NewAPI admin embed.

The page calls `/api/auth/newapi-management` through the authenticated HappyImage session and shows:

- current binding status and message;
- NewAPI user ID;
- default API Key for the HappyToken provider;
- available NewAPI token list;
- an external gateway-admin link for manual fallback.

Do not treat `gateway.happy-token.cn` browser login state as the source of truth. SQL/provisioning creates or reuses the NewAPI user and token, but it does not create the NewAPI browser `session` cookie. Because that cookie belongs to a different origin and may be affected by frame and SameSite policies, the gateway admin page can show “not logged in” even when HappyImage is already bound and generation can use the default HappyToken API Key.
