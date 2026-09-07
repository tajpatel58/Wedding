#!/bin/bash
# Downscales/recompresses assets/pictures in place using macOS sips.
# Originals must already be backed up before running this — it overwrites files.
set -euo pipefail

SRC_DIR="assets/pictures"
MAX_DIM=2400
QUALITY=90

# Full-bleed images (hero/break/closing render at up to 100vw/100vh via
# object-fit: cover) are left untouched at full resolution/quality.
FULL_BLEED_FILES=(
  "assets/pictures/Wedding/1018-RT-Wedding-MSP-2026.jpg"
  "assets/pictures/Wedding/1072-RT-Wedding-MSP-2026.jpg"
  "assets/pictures/Wedding/1031-RT-Wedding-MSP-2026.jpg"
)
is_full_bleed() {
  local candidate="$1"
  for full_bleed in "${FULL_BLEED_FILES[@]}"; do
    [ "$candidate" = "$full_bleed" ] && return 0
  done
  return 1
}

find "$SRC_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) | while IFS= read -r f; do
  if is_full_bleed "$f"; then
    echo "skipped (full-res): $f"
    continue
  fi

  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
  max=$(( w > h ? w : h ))

  if [ "$max" -gt "$MAX_DIM" ]; then
    sips -Z "$MAX_DIM" --setProperty formatOptions "$QUALITY" "$f" >/dev/null
  else
    sips --setProperty formatOptions "$QUALITY" "$f" >/dev/null
  fi
  echo "optimized: $f"
done
