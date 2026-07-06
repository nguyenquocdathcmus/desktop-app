#!/bin/bash
# Download static FFmpeg universal binary for macOS
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$(dirname "$SCRIPT_DIR")/resources/bin"
mkdir -p "$BIN_DIR"

FFMPEG_BIN="$BIN_DIR/ffmpeg"

if [ -f "$FFMPEG_BIN" ]; then
  echo "FFmpeg already present at $FFMPEG_BIN"
  exit 0
fi

echo "==> Downloading FFmpeg (macOS universal static binary)..."

# Download from evermeet.cx — trusted static FFmpeg builds for macOS
FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/zip"

TMP_ZIP="/tmp/ffmpeg-macos.zip"
curl -L "$FFMPEG_URL" -o "$TMP_ZIP" --progress-bar

echo "==> Extracting..."
unzip -o "$TMP_ZIP" -d /tmp/ffmpeg-extract/
mv /tmp/ffmpeg-extract/ffmpeg "$FFMPEG_BIN"
chmod +x "$FFMPEG_BIN"
rm -f "$TMP_ZIP"
rm -rf /tmp/ffmpeg-extract

echo "==> Signing ffmpeg (ad-hoc)..."
codesign --sign - --force "$FFMPEG_BIN" 2>/dev/null || true

echo "==> Done: $(ls -lh "$FFMPEG_BIN" | awk '{print $5, $9}')"
