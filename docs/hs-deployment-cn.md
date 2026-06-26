# HS 服务器 HappyImage 部署简版

统一目录：

```text
/opt/happytoken/happyimage/
  happyimage-api/          后端仓库代码
  happyimage-web/          前端仓库代码
  data/api/                后端运行数据、用户数据、图片任务、日志
  data/config.json         后端运行时配置文件
  data/seed-gallery/       前端官方图库静态包，约 1.4G，迁移开发服务器前要预留空间
  deploy/hs/docker-compose.yml  组合部署容器编排
```

运行服务：

```text
happytoken-api  -> 127.0.0.1:8001
happytoken-web  -> 0.0.0.0:3000
caddy           -> 对外 80/443，转发到前端
```

测试环境原则：

- 后端用 Docker 容器部署测试，优先拉取或加载已构建镜像，不在 hs 上临时构建。
- 前端后续发布到 Cloudflare；hs 上的前端只作临时联调入口。前端改动用本地/CI 编译验证后走前端发布流程，不把 hs 当作前端构建机。
- 官方图库 `data/seed-gallery/` 是运行时静态数据，不打进前端镜像。

## 请求链路

Web middleware 只把以下产品路径转发到 `BACKEND_URL=http://happytoken-api:80`：

```text
/api/*
/health
/images/*
/image-thumbnails/*
```

Web 和 API 不再提供 HappyImage-owned 外部模型兼容入口，也不再配置 Web 模型代理。图片工作台统一调用 `/api/image-tasks/*`；API 创建任务、保存历史和私有图片后，再使用当前用户选中的供应商/NewAPI Base URL 调用上游模型网关。上游网关地址（例如 `https://gateway.happy-token.cn/v1`）在 API 运行时设置中维护。

## 环境变量与运行时设置

默认组合部署不需要 `.env`。只有要覆盖存储、数据库、端口或镜像名时，才在工作区根目录创建 `.env`；这些变量只属于基础设施层。`deploy/hs/docker-compose.yml` 不读取 `happyimage-api/.env`，只显式传递基础设施环境变量：

```bash
STORAGE_BACKEND=json
DATABASE_URL=
HAPPYTOKEN_API_PORT=127.0.0.1:8001
HAPPYTOKEN_WEB_PORT=3000
HAPPYTOKEN_API_IMAGE=ghcr.io/happy-token/happyimage-api:latest
HAPPYTOKEN_WEB_IMAGE=ghcr.io/happy-token/happyimage-web:latest
```

也可以临时写在命令前传递给 Compose：

```bash
STORAGE_BACKEND=postgres \
DATABASE_URL=postgresql://user:password@postgres.example.com:5432/happyimage \
docker compose -f deploy/hs/docker-compose.yml up -d
```

不要继续使用旧私有文件承载运行时设置：

```text
/opt/happytoken/happyimage/happyimage-api/.env
```

如果该文件仍存在，请手动把其中的旧运行时设置迁移到首次 `/setup`、管理员 `/settings` 或 `data/config.json`，然后从 compose 注入路径中移除。不要提交或分享这个文件。

迁移到运行时设置的内容包括：

- public app URL 和可选 API public URL；
- session/cookie 设置；
- OAuth/OIDC 设置；
- model gateway/NewAPI binding，包括 `model_gateway.sql_dsn`；
- proxy、image storage 和 safety settings。

测试环境临时入口使用 `http://101.96.195.224:3000` 时，在 `/setup` 或管理员 `/settings` 中保持前端公开地址、API 公开地址和 Casdoor callback 为同一个浏览器 origin，避免 callback 写入的 `happytoken_session` cookie 回到另一个 host 后丢失。

Casdoor 应用里也需要允许这个回调地址：

```text
http://101.96.195.224:3000/api/auth/oidc/callback
```

NewAPI SQL provisioning 在容器内不能使用宿主机本地回环地址，例如 `127.0.0.1:15433`。Docker 容器里的 `127.0.0.1` 是 `happytoken-api` 容器自身。请在 `/setup` 或管理员 `/settings` 的 `model_gateway.sql_dsn` 中使用同一个 Docker 网络内的数据库服务名。

## 验证命令

```bash
cd /opt/happytoken/happyimage
mkdir -p data/api data/seed-gallery
test -f data/config.json || cp happyimage-api/config.example.json data/config.json

# API 和 Web 默认镜像都从 GHCR 拉取。
docker compose -f deploy/hs/docker-compose.yml pull
docker compose -f deploy/hs/docker-compose.yml up -d
docker compose -f deploy/hs/docker-compose.yml ps
curl -fsS 'http://127.0.0.1:8001/health?format=json'
curl -I -fsS 'http://127.0.0.1:3000/login'
curl -I -fsS 'http://127.0.0.1:3000/settings/newapi'
```

注意：首次启动前必须创建 `data/` 父目录并把 `happyimage-api/config.example.json` 复制为 `data/config.json`。不要让 Docker 把 `data/config.json` 自动创建成目录。

说明：compose 使用 `HAPPYTOKEN_API_IMAGE`、`HAPPYTOKEN_WEB_IMAGE` 指定镜像；不需要覆盖时不用创建 `.env`。测试服务器如果要从 GHCR 拉私有镜像，需要先配置 `docker login ghcr.io`。
