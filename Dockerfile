ARG BUILDPLATFORM
ARG NODE_IMAGE=node:22-alpine

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS web-build

WORKDIR /app/web

RUN npm config set registry https://registry.npmmirror.com
RUN npm install -g pnpm@10.33.2
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm config set registry https://registry.npmmirror.com \
    && pnpm install --frozen-lockfile

COPY . ./
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_APP_VERSION=0.0.0
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
RUN pnpm run build

# ── Serve with nginx ──────────────────────────────────────────────
FROM nginx:alpine AS serve

COPY --from=web-build /app/web/out /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    # HTML must revalidate so browser always gets the latest JS references\n\
    location / {\n\
        try_files $uri $uri.html $uri/ /index.html;\n\
        add_header Cache-Control "no-cache";\n\
        add_header Pragma "no-cache";\n\
    }\n\
    # JS/CSS are hashed — immutable cache is safe\n\
    location /_next/static/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
