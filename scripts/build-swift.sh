#!/bin/bash
# Build all Swift helper binaries and copy to resources/bin/
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SWIFT_DIR="$PROJECT_DIR/swift"
BIN_DIR="$PROJECT_DIR/resources/bin"

mkdir -p "$BIN_DIR"

echo "==> Building Swift binaries..."

# Build each package
for pkg in capture cursor-tracker face-detector transcriber; do
  PKG_DIR="$SWIFT_DIR/$pkg"
  if [ ! -f "$PKG_DIR/Package.swift" ]; then
    echo "  [skip] $pkg — no Package.swift found"
    continue
  fi

  echo "  Building $pkg..."
  cd "$PKG_DIR"

  # Build for both arm64 and x86_64 then lipo into a universal binary
  swift build -c release --arch arm64 2>&1 | grep -E "error:|warning:|Build complete" | head -20
  swift build -c release --arch x86_64 2>&1 | grep -E "error:|warning:|Build complete" | head -20

  # Find built binaries
  ARM64_BIN=".build/arm64-apple-macosx/release/$pkg"
  X86_BIN=".build/x86_64-apple-macosx/release/$pkg"

  if [ -f "$ARM64_BIN" ] && [ -f "$X86_BIN" ]; then
    echo "  Creating universal binary for $pkg..."
    lipo -create "$ARM64_BIN" "$X86_BIN" -output "$BIN_DIR/$pkg"
  elif [ -f "$ARM64_BIN" ]; then
    echo "  Copying arm64-only binary for $pkg..."
    cp "$ARM64_BIN" "$BIN_DIR/$pkg"
  elif [ -f "$X86_BIN" ]; then
    echo "  Copying x86_64-only binary for $pkg..."
    cp "$X86_BIN" "$BIN_DIR/$pkg"
  else
    echo "  [error] Could not find built binary for $pkg"
    exit 1
  fi

  chmod +x "$BIN_DIR/$pkg"
  echo "  ✓ $pkg -> resources/bin/$pkg"
done

echo ""
echo "==> Signing binaries (ad-hoc for development)..."
for bin in "$BIN_DIR"/*; do
  [ -f "$bin" ] || continue
  codesign --sign - --force "$bin" 2>/dev/null && echo "  ✓ signed $(basename $bin)" || echo "  [warn] signing failed for $(basename $bin)"
done

echo ""
echo "==> Done! Binaries in resources/bin/:"
ls -lh "$BIN_DIR"
