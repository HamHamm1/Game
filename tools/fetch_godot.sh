#!/usr/bin/env bash
# Fetch the Godot 4.3 headless-capable Linux editor binary into tools/godot.
# Used by the container to run automated headless validation. The binary is
# git-ignored (see tools/.gitignore) — do not commit it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${GODOT_VERSION:-4.3-stable}"
URL="https://github.com/godotengine/godot/releases/download/${VER}/Godot_v${VER}_linux.x86_64.zip"

cd "$ROOT/tools"
if [ -x ./godot ]; then
	echo "tools/godot already present: $(./godot --version 2>/dev/null | head -1)"
	exit 0
fi
echo "Downloading $URL"
curl -fsSL -o godot.zip "$URL"
unzip -o godot.zip >/dev/null
mv "Godot_v${VER}_linux.x86_64" godot
chmod +x godot
rm -f godot.zip
echo "Installed: $(./godot --version | head -1)"
