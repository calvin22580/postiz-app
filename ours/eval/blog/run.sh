#!/usr/bin/env bash
# OURS: blog posts B1. Bundles the long-post Checker test runner with our
# path aliases and runs it, like ours/eval/checker/run.sh. From the repo root:
#   ours/eval/blog/run.sh --set long --models demo
#   ANTHROPIC_API_KEY=… ours/eval/blog/run.sh --set long --models claude-sonnet-5-5 --reps 2
# Details and costs: ours/eval/README.md
set -euo pipefail
cd "$(dirname "$0")/../../.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
node_modules/.bin/esbuild ours/eval/blog/run.ts --bundle --platform=node --format=cjs \
  --packages=external --tsconfig=tsconfig.base.json --outfile="$out/run.cjs" --log-level=warning
NODE_PATH="$PWD/node_modules" node "$out/run.cjs" "$@"
