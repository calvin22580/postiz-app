#!/usr/bin/env bash
# OURS: container start for the Cloudflare deployment.
# Redis here is a cache only (no persistence), so losing it on a restart is harmless.
set -e
redis-server --daemonize yes --save '' --appendonly no --bind 127.0.0.1 --port 6379
nginx
exec pnpm run pm2
