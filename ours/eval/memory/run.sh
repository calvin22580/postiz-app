#!/usr/bin/env bash
# OURS: content engine E4. Bundles the Memory keeper test runner with our path
# aliases and runs it. From the repo root:
#   ours/eval/memory/run.sh --keepers demo
#   ANTHROPIC_API_KEY=… ours/eval/memory/run.sh --keepers memory-tool,plain --reps 3
# The writer test (with and without brand memory) runs the same way:
#   ours/eval/memory/run.sh writer --writer demo
# Details and costs: ours/eval/README.md
set -euo pipefail
script=run
if [ "${1:-}" = writer ]; then script=writer; shift; fi
cd "$(dirname "$0")/../../.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
node_modules/.bin/esbuild ours/eval/memory/$script.ts --bundle --platform=node --format=cjs \
  --packages=external --tsconfig=tsconfig.base.json --outfile="$out/$script.cjs" --log-level=warning
NODE_PATH="$PWD/node_modules" node "$out/$script.cjs" "$@"
