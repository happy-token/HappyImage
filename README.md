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

常用公开配置：

| 变量 | 说明 |
|:--|:--|
| `NEXT_PUBLIC_API_BASE_URL` | 后端 API 地址 |
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
