#!/bin/bash
# Build, sign (ad-hoc), and install to /Applications
set -e
APP="dist/mac-arm64/Screen Studio.app"

echo "==> Signing (ad-hoc)..."
xattr -cr "$APP"
codesign --sign - --force --deep "$APP"

echo "==> Installing to /Applications..."
pkill -f "Screen Studio.app" 2>/dev/null || true
sleep 1
rm -rf "/Applications/Screen Studio.app"
cp -R "$APP" "/Applications/"

echo ""
echo "✓ Screen Studio installed!"
echo ""
echo "Launch with:"
echo "  bash scripts/launch.sh"
echo "  — or —"
echo "  open '/Applications/Screen Studio.app'  (right-click → Open first time)"
