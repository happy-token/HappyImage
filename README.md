<h1 align="center">HappyImage Web</h1>

<p align="center">HappyImage 前端 — Next.js 静态导出，部署到 Cloudflare Pages 或 nginx。</p>

## 本地开发

```bash
pnpm install
pnpm run dev
```

前端开发模式默认连接 `http://127.0.0.1:8000`（本地后端）。如需指向其他后端地址，设置环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com pnpm run dev
```

如果需要让 Web 应用接口走 HappyImage API、模型 `/v1/*` 请求走 NewAPI，本地开发使用同源代理：

```bash
BACKEND_URL=http://127.0.0.1:8000 \
MODEL_BACKEND_URL=http://127.0.0.1:3001 \
MODEL_BACKEND_API_KEY=sk-happyimagetest \
NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true \
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 \
pnpm run dev
```

对应链路：

```text
/api/*, /images/*, /image-thumbnails/* -> BACKEND_URL
/v1/*                                  -> MODEL_BACKEND_URL
```

`MODEL_BACKEND_API_KEY` 只在 Next.js middleware 服务端使用，用于代理 `/v1/*` 时替换成 NewAPI token，不会直接暴露给浏览器。

如果号池管理、模型调试、上游账号配置已经迁移到 NewAPI，设置 `NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=true`。开启后前端会隐藏本地“号池管理”和“调试”入口，管理员登录后默认进入图片管理，系统设置里也不会展示 CPA/Sub2API 账号导入管理。

常用公开配置：

| 变量 | 说明 |
|:--|:--|
| `NEXT_PUBLIC_API_BASE_URL` | 后端 API 地址 |
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

## Docker 部署

```bash
docker build -t happyimage-web .
docker run -p 3000:80 happyimage-web
```

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
