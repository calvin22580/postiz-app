# OURS: production image for the Cloudflare Containers deployment.
# Based on upstream's Dockerfile.dev (same Node, pnpm, build and nginx + pm2
# start), plus a local Redis. Only the folders the build needs are copied, so
# a developer's .env (API keys) can never end up in an image layer.
# Build context is the repo root (see wrangler.jsonc). Details: README.md here.
FROM node:22.23.4-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    python3-pip \
    bash \
    nginx \
    redis-server \
    ca-certificates \
&& rm -rf /var/lib/apt/lists/*

RUN addgroup --system www \
 && adduser --system --ingroup www --home /www --shell /usr/sbin/nologin www \
 && mkdir -p /www /uploads \
 && chown -R www:www /www /var/lib/nginx

RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1 pm2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json tsconfig.json version.txt i18n.json i18n.lock /app/
COPY apps /app/apps
COPY libraries /app/libraries
COPY var /app/var
COPY var/docker/nginx.conf /etc/nginx/nginx.conf
# Cloudflare terminates HTTPS and our Worker sends X-Forwarded-Proto: https.
# Pass that on instead of nginx's own scheme (http), so app redirects stay on https.
RUN sed -i 's/X-Forwarded-Proto \$scheme/X-Forwarded-Proto $http_x_forwarded_proto/' /etc/nginx/nginx.conf \
 && grep -q 'X-Forwarded-Proto $http_x_forwarded_proto' /etc/nginx/nginx.conf
COPY ours/deploy/cloudflare/start.sh /app/ours/deploy/cloudflare/start.sh

# Cloudflare rejects image layers with more than 100,000 hard links, and pnpm
# hard-links every package from its store. Install by copying, drop the store
# in the same layer, and break any hard links the build leaves behind.
RUN pnpm install --package-import-method=copy \
 && rm -rf "$(pnpm store path)" /root/.cache/pnpm \
 && echo "hard-linked files after install: $(find /app /usr/local -xdev -type f -links +1 | wc -l)"
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build \
 && find /app -xdev -type f -links +1 -exec sh -c 'for f; do cp -p "$f" "$f.unlink" && mv -f "$f.unlink" "$f"; done' sh {} + \
 && echo "hard-linked files after build: $(find /app /usr/local -xdev -type f -links +1 | wc -l)"

ENV NODE_ENV=production
EXPOSE 5000
CMD ["bash", "/app/ours/deploy/cloudflare/start.sh"]
