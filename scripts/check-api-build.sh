#!/bin/bash
# Build the API from exactly the files it is built from, in a clean copy of them, and nothing
# else: the proof that this list (also in CLAUDE.md, "Building the API") is complete.
#
#   backend/ (every tracked file: Cargo.toml, Cargo.lock, rust-toolchain.toml, src/, data/,
#             migrations/, tests/)
#   src/lib/verse/pron-en.ts       the pronunciation table, compiled in (verse/pronounce.rs)
#   src/lib/verse/confusables.ts   Unicode's confusable letters, compiled in (verse/text.rs)
#
# The browser imports the same two files, which is why the API is built inside the whole
# repository and not from backend/ alone. The binary reads migrations/ from its working
# directory at start-up, so a deploy copies that folder beside it.
#
# On the build host (never on the dev Mac):
#   ~/kani-logs/remote/rb . -- 'export PATH=$HOME/.cargo/bin:$PATH; scripts/check-api-build.sh'
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
{ git ls-files -z backend; printf '%s\0' src/lib/verse/pron-en.ts src/lib/verse/confusables.ts; } | tar --null -T - -cf - | tar -xf - -C "$tmp"
echo "check-api-build: building in $tmp from $(find "$tmp" -type f | wc -l | tr -d ' ') files"
# A shared target dir (CARGO_TARGET_DIR, as rb sets) keeps the dependencies; the API itself is
# cleaned first, so it is compiled again from the copy, not taken from an earlier build.
(cd "$tmp/backend" && cargo clean --release -p inspired-mile-api && cargo build --release --locked)
test -x "${CARGO_TARGET_DIR:-$tmp/backend/target}/release/inspired-mile-api"
echo "check-api-build: ok"
