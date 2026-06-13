#!/bin/bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  kill 0
}
trap cleanup EXIT

cd "$ROOT/artifacts/api-server"
PORT=8080 pnpm run dev &

cd "$ROOT/artifacts/pharma-pos"
PORT=20635 BASE_PATH="/" pnpm run dev &

sleep 3

cd "$ROOT"
node dev-proxy.mjs
