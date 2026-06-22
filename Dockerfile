ARG BUILDPLATFORM
ARG NODE_IMAGE=node:22-alpine

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps

WORKDIR /app/web

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm@10.33.2

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm config set registry https://registry.npmmirror.com \
    && pnpm install --frozen-lockfile

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build

WORKDIR /app/web

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm@10.33.2

COPY --from=deps /app/web/node_modules ./node_modules
COPY . ./

ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_APP_VERSION=0.0.0
ARG NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=false
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_SUPPORT_WECHAT=

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION} \
    NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN=${NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN} \
    NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL} \
    NEXT_PUBLIC_SUPPORT_WECHAT=${NEXT_PUBLIC_SUPPORT_WECHAT}

RUN pnpm run build

FROM ${NODE_IMAGE} AS runner

WORKDIR /app/web

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL="" \
    BACKEND_URL=http://happytoken-api:80 \
    MODEL_BACKEND_URL=http://happytoken-api:80

COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static
COPY --from=build /app/web/public ./public

RUN mkdir -p /app/web/public/seed-gallery

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
