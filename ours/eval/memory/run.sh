#!/usr/bin/env bash
# OURS: content engine E4. Bundles the Memory keeper test runner with our path
# aliases and runs it. From the repo root:
#   ours/eval/memory/run.sh --keepers demo
#   ANTHROPIC_API_KEY=… ours/eval/memory/run.sh --keepers memory-tool,plain --reps 3
# Details and costs: ours/eval/README.md
set -euo pipefail
cd "$(dirname "$0")/../../.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
node_modules/.bin/esbuild ours/eval/memory/run.ts --bundle --platform=node --format=cjs \
  --packages=external --tsconfig=tsconfig.base.json --outfile="$out/run.cjs" --log-level=warning
NODE_PATH="$PWD/node_modules" node "$out/run.cjs" "$@"
