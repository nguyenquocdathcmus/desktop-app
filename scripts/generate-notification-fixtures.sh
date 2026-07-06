#!/bin/bash
# Sprint 22 US-172 — synthetic notification fixtures for measuring the
# NotificationDetector heuristic without needing to trigger real macOS
# notifications on demand. Each fixture is a 20s 1280x720 clip with a
# base layer (static color or moving gradient, to test both "quiet" and
# "busy" backgrounds) and an overlaid rectangle mimicking a macOS
# notification banner: appears top-right, holds for N seconds, disappears.
set -euo pipefail

FFMPEG="${FFMPEG_BIN:-resources/bin/ffmpeg}"
OUT_DIR="test/fixtures/notifications"
mkdir -p "$OUT_DIR"

# Args: name, background filter, banner start, banner duration
make_fixture() {
  local name="$1"
  local bg_filter="$2"
  local start="$3"
  local dur="$4"
  local end
  end=$(echo "$start + $dur" | bc)
  echo "Generating $name.mov (banner ${start}s-${end}s)..."
  # High-contrast near-white banner on a dark background — real macOS
  # notification banners are a light frosted-glass panel, so the luma jump
  # against typical app content is large, not subtle. crf 18 keeps the box
  # edges crisp (crf 20 with libx264 blurs sharp edges enough to blunt the diff).
  "$FFMPEG" -y -f lavfi -i "$bg_filter" -t 20 -filter_complex \
    "[0:v]drawbox=x=iw-380:y=20:w=360:h=80:color=0xf2f2f7:t=fill:enable='between(t,${start},${end})'[v]" \
    -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT_DIR/$name.mov" -loglevel error
}

# Positive cases: banner present, varying background motion and timing.
make_fixture "notif_static_bg_4s"   "color=c=0x2c2c2e:s=1280x720:r=30" 5 4
make_fixture "notif_static_bg_3s"   "color=c=0x2c2c2e:s=1280x720:r=30" 8 3
make_fixture "notif_busy_bg_5s"     "testsrc2=s=1280x720:r=30" 6 5
make_fixture "notif_early_2_5s"     "color=c=0x1a1a1a:s=1280x720:r=30" 1 2.5

# Negative cases: no banner at all, just background motion — used to measure
# false-positive rate. testsrc2 has constant motion across the whole frame
# including the top-right corner, the hardest case for a naive diff heuristic.
echo "Generating negative fixtures (no banner)..."
"$FFMPEG" -y -f lavfi -i "color=c=0x2c2c2e:s=1280x720:r=30" -t 20 -c:v libx264 -pix_fmt yuv420p -crf 20 \
  "$OUT_DIR/negative_static.mov" -loglevel error
"$FFMPEG" -y -f lavfi -i "testsrc2=s=1280x720:r=30" -t 20 -c:v libx264 -pix_fmt yuv420p -crf 20 \
  "$OUT_DIR/negative_busy.mov" -loglevel error
# A window/menu genuinely opening in the top-right corner and staying — this
# should ideally NOT be flagged as a notification since it doesn't disappear
# within the expected window; included to test that boundary.
"$FFMPEG" -y -f lavfi -i "color=c=0x2c2c2e:s=1280x720:r=30" -t 20 -filter_complex \
  "[0:v]drawbox=x=iw-380:y=20:w=360:h=80:color=0xf2f2f7:t=fill:enable='gte(t,5)'[v]" \
  -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT_DIR/negative_persistent_ui.mov" -loglevel error

echo "Done. Fixtures written to $OUT_DIR/"
