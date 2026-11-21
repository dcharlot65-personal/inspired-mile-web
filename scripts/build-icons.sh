#!/usr/bin/env bash
# Render the game's icons from the master drawings in design/icon/ and point the site at them.
#
#   bash scripts/build-icons.sh [INDEX]
#
# INDEX defaults to the UTC time, yyyymmddhhmmss. The owner's rule (2026-11-17): a changed file
# ships under a new name from a large, ever-increasing index, never under its old name, so a
# browser or Cloudflare that cached the old icon cannot mix it with a new page. Every size goes
# into public/icons/<INDEX>/, and every reference moves there in one step: the <link>s in
# src/layouts/BaseLayout.astro, the icons in public/manifest.json, the service worker's precache
# list in public/sw.js, and the paths the two service-worker tests name. The two previous
# folders are kept, so a page already open still finds its icons; older ones are removed.
# public/favicon.ico and public/apple-touch-icon.png stay at their fixed names as well, with the
# new art: browsers and iOS ask for those two paths by default when a page names no icon.
#
# The masters (design/icon/, 64-unit SVG, no text, no outside source):
#   mark-small.svg     tabs and the .ico: the crossed quill and microphone, drawn larger, no frame
#   mark-full.svg      app icons (192, 512): the same on a rounded card with its gold frame
#   mark-apple.svg     the iOS home-screen icon (180): square and opaque; iOS rounds the corners
#   mark-maskable.svg  Android's maskable icon (512): full bleed, the drawing inside the safe circle
#
# Needs rsvg-convert (librsvg) and python3. Light work: it may run on the dev Mac.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v rsvg-convert >/dev/null || { echo "build-icons: rsvg-convert (librsvg) is needed" >&2; exit 1; }

INDEX=${1:-$(date -u +%Y%m%d%H%M%S)}
[[ $INDEX =~ ^[0-9]{14}$ ]] || { echo "build-icons: INDEX must be 14 digits (yyyymmddhhmmss)" >&2; exit 1; }
LATEST=$(ls public/icons 2>/dev/null | grep -E '^[0-9]{14}$' | sort | tail -1 || true)
if [ -n "$LATEST" ] && [ "$INDEX" -le "$LATEST" ]; then
  echo "build-icons: INDEX $INDEX is not newer than the newest folder, $LATEST" >&2; exit 1
fi

OUT=public/icons/$INDEX
mkdir -p "$OUT"
D=design/icon
render() { rsvg-convert -w "$2" -h "$2" "$D/$1" -o "$3"; }

cp "$D/mark-small.svg" "$OUT/favicon.svg"
render mark-full.svg 192 "$OUT/icon-192.png"
render mark-full.svg 512 "$OUT/icon-512.png"
render mark-maskable.svg 512 "$OUT/icon-maskable-512.png"
render mark-apple.svg 180 "$OUT/apple-touch-icon.png"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for s in 16 32 48; do render mark-small.svg "$s" "$TMP/ico-$s.png"; done

# An .ico that holds the three PNGs as they are (Windows Vista and later, and every browser, read PNG entries).
python3 - "$OUT/favicon.ico" "$TMP/ico-16.png" "$TMP/ico-32.png" "$TMP/ico-48.png" <<'PY'
import struct, sys
out, pngs = sys.argv[1], sys.argv[2:]
blobs = [open(p, 'rb').read() for p in pngs]
head = struct.pack('<HHH', 0, 1, len(blobs))
offset = 6 + 16 * len(blobs)
entries = b''
for b in blobs:
    w, h = struct.unpack('>II', b[16:24])
    entries += struct.pack('<BBBBHHII', w % 256, h % 256, 0, 0, 1, 32, len(b), offset)
    offset += len(b)
open(out, 'wb').write(head + entries + b''.join(blobs))
PY

cp "$OUT/favicon.ico" public/favicon.ico
cp "$OUT/apple-touch-icon.png" public/apple-touch-icon.png

# Point every reference at the new folder. The first run moves them from the old root names.
for f in src/layouts/BaseLayout.astro public/manifest.json public/sw.js src/lib/pwa.test.ts src/lib/sw.test.ts; do
  INDEX="$INDEX" perl -pi -e 's#/icons/[0-9]{14}/#/icons/$ENV{INDEX}/#g' "$f"
done

# Keep the newest three folders (this one and the two before it); remove older ones.
FOLDERS=$(ls public/icons | grep -E '^[0-9]{14}$' | sort)
COUNT=$(printf '%s\n' "$FOLDERS" | grep -c . || true)
printf '%s\n' "$FOLDERS" | awk -v keep=3 -v n="$COUNT" 'NR <= n - keep' | while read -r old; do
  [ -n "$old" ] && rm -r "public/icons/${old:?}"
done

echo "build-icons: public/icons/$INDEX"
ls -l "$OUT"
