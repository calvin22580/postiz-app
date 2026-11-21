#!/usr/bin/env bash
# OURS: content engine E2. Bundles the Checker test runner with our path
# aliases and runs it. From the repo root:
#   ours/eval/checker/run.sh --set sample --models demo
#   ANTHROPIC_API_KEY=… ours/eval/checker/run.sh --set <set> --models claude-haiku-5-5,claude-sonnet-5-5 --reps 2
# Details and costs: ours/eval/README.md
set -euo pipefail
cd "$(dirname "$0")/../../.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
node_modules/.bin/esbuild ours/eval/checker/run.ts --bundle --platform=node --format=cjs \
  --packages=external --tsconfig=tsconfig.base.json --outfile="$out/run.cjs" --log-level=warning
NODE_PATH="$PWD/node_modules" node "$out/run.cjs" "$@"
