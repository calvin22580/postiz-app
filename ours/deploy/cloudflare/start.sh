#!/usr/bin/env bash
# OURS: container start for the Cloudflare deployment.
# Redis here holds a cache and short-lived upload sessions, in memory only. A restart
# only interrupts uploads that are in progress.
set -e
redis-server --daemonize yes --save '' --appendonly no --bind 127.0.0.1 --port 6379
nginx
exec pnpm run pm2
