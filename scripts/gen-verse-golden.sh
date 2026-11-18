#!/bin/bash
# Rewrite the files the Rust verse engine is checked against, from the TypeScript engine:
#
#   backend/data/cards.json        card data for the server (from src/lib/cards.ts)
#   backend/tests/golden/*.json    cases and the TypeScript engine's answers
#
# Run it after any change to src/lib/verse/, src/lib/cards.ts or src/lib/multiplayer-rules.ts,
# then run the Rust tests (cd backend && cargo test). If those fail, the Rust port in
# backend/src/verse/ no longer agrees with the TypeScript and must be fixed; the comparison
# is never to be loosened.
#
# On the build host (this Mac runs no vitest):
#   ~/kani-logs/remote/rb --pull . -- 'export PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH; npm ci && scripts/gen-verse-golden.sh'
set -euo pipefail
cd "$(dirname "$0")/.."
WRITE_GOLDEN=1 npx vitest run src/lib/multiplayer-golden.test.ts
