#!/bin/bash
# Launch Screen Studio (bypasses Gatekeeper for unsigned local build)
APP="/Applications/Screen Studio.app"
BINARY="$APP/Contents/MacOS/Screen Studio"

if [ ! -f "$BINARY" ]; then
  echo "Screen Studio not found. Run: npm run package:local"
  exit 1
fi

# Clear quarantine just in case
xattr -cr "$APP" 2>/dev/null

# Launch
exec "$BINARY"
