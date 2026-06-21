<h1 align="center">HappyImage Web</h1>

<p align="center">HappyImage 前端 — Next.js 静态导出，部署到 Cloudflare Pages 或 nginx。</p>

## 本地开发

```bash
pnpm install
pnpm run dev
```

前端开发模式默认使用同源请求，由 Next.js middleware 转发 `/api/*`、`/images/*` 到 `BACKEND_URL`。这是推荐模式，因为登录 Cookie、历史会话同步、私有图片签名链接都会保持在当前浏览器 origin 下。如需让浏览器直接请求其他后端地址，才设置环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run dev
```

如果需要让 Web 应用接口走 HappyImage API、模型 `/v1/*` 请求走 NewAPI，本地开发使用同源代理：

```bash
BACKEND_URL=http://127.0.0.1:8000 \
MODEL_BACKEND_URL=http://127.0.0.1:3001 \
MODEL_BACKEND_API_KEY=sk-happyimagetest \
NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true \
pnpm run dev
```

对应链路：

```text
/api/*, /images/*, /image-thumbnails/* -> BACKEND_URL
/v1/*                                  -> MODEL_BACKEND_URL
```

`MODEL_BACKEND_API_KEY` 只在 Next.js middleware 服务端使用，用于代理 `/v1/*` 时替换成 NewAPI token，不会直接暴露给浏览器。

同源代理模式下不要设置 `NEXT_PUBLIC_API_BASE_URL`。例如页面从 `http://localhost:3000` 打开时，如果把它设置成 `http://127.0.0.1:3000`，浏览器会按跨域请求处理，历史会话恢复、图片访问等接口可能无法同步。

如果号池管理、模型调试、上游账号配置已经迁移到 NewAPI，设置 `NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true`。开启后前端会隐藏本地“号池管理”和“调试”入口，管理员登录后默认进入图片管理，系统设置里也不会展示 CPA/Sub2API 账号导入管理。

常用公开配置：

| 变量 | 说明 |
|:--|:--|
| `NEXT_PUBLIC_API_BASE_URL` | 浏览器直连 API 地址；同源代理模式保持为空 |
| `BACKEND_URL` | Next.js middleware 转发 `/api/*`、`/images/*` 的服务端地址 |
| `MODEL_BACKEND_URL` | Next.js middleware 转发 `/v1/*` 的服务端模型网关地址 |
| `MODEL_BACKEND_API_KEY` | 服务端代理 `/v1/*` 使用的模型网关 token |
| `NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN` | 是否使用外部 NewAPI 管理号池和调试，`true` 时隐藏本地逆向管理界面 |
| `NEXT_PUBLIC_APP_VERSION` | 前端展示版本号 |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | “联系我们”里的邮箱 |
| `NEXT_PUBLIC_SUPPORT_WECHAT` | “联系我们”里的微信号 |

## 构建

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run build
# 静态文件输出到 out/
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
  -t happyimage-web .

docker run -p 3000:3000 \
  -e BACKEND_URL=http://happyimage-api:80 \
  -e MODEL_BACKEND_URL=https://newapi.example.com/v1 \
  -e MODEL_BACKEND_API_KEY=<newapi-token> \
  happyimage-web
```

Docker 镜像运行的是 Next.js server，不是静态 nginx。这样 `/api/*`、`/images/*`、`/image-thumbnails/*` 和 `/v1/*` 可以继续走 middleware 分流：

```text
/api/*, /images/*, /image-thumbnails/* -> BACKEND_URL
/v1/*                                  -> MODEL_BACKEND_URL
```

同源代理模式下 `NEXT_PUBLIC_API_BASE_URL` 保持为空；如果构建时设置了它，浏览器会直连该地址，不再使用同源代理。

## 官方图库静态包

官方图库是公开只读静态资源，运行时优先从 `public/seed-gallery` 读取，不需要经过 HappyImage API。该目录已被 `.gitignore` 和 `.dockerignore` 忽略，避免把大体积图片提交到 GitHub 或默认打进 Docker 镜像。

仅生成静态 JSON（图片和缩略图已通过对象存储、CDN 或 volume 另行提供时使用）：

```bash
cd ../happyimage-api
uv run python scripts/export_seed_gallery_static.py --output ../happyimage-web/public/seed-gallery
```

生成完整静态包（包含图片和已生成缩略图）：

```bash
cd ../happyimage-api
uv run python scripts/pregenerate_seed_gallery_thumbnails.py --widths 640 --quiet
uv run python scripts/export_seed_gallery_static.py --output ../happyimage-web/public/seed-gallery --copy-assets
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

如果 `public/seed-gallery/static/items.json` 不存在，前端会自动回退到 HappyImage API 的 `/api/seed-gallery/*` 兼容接口。

## 部署到 Cloudflare Pages

自动部署由 `.github/workflows/deploy-web.yml` 处理。需要在 GitHub 仓库配置：

| Secrets / Variables | 说明 |
|:--|:--|
| `vars.API_BASE_URL` | 后端 API 地址 |
| `secrets.CLOUDFLARE_API_TOKEN` | Cloudflare API Token（Pages 编辑权限） |
| `secrets.CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `vars.CF_PAGES_PROJECT` | Cloudflare Pages 项目名（默认 `happyimage`） |

## 关联仓库

- 后端：[happyimage-api](https://github.com/happy-token/happyimage-api)
- 部署编排：见后端的 `docker-compose.yml`
