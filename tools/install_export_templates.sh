#!/usr/bin/env bash
# Install the Godot 4.3 Android/desktop export templates from the .tpz into
# the user templates dir so headless `--export-*` can find them. The .tpz is
# large and git-ignored; download it with:
#   curl -fsSL -o tools/godot-export-templates.tpz \
#     https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_export_templates.tpz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TPZ="$ROOT/tools/godot-export-templates.tpz"
DEST="${GODOT_TEMPLATES_DIR:-$HOME/.local/share/godot/export_templates/4.3.stable}"

[ -f "$TPZ" ] || { echo "Missing $TPZ"; exit 1; }
mkdir -p "$DEST"
tmp="$(mktemp -d)"
unzip -oq "$TPZ" -d "$tmp"
cp -r "$tmp/templates/." "$DEST/"
rm -rf "$tmp"
echo "installed export templates -> $DEST"
ls "$DEST" | grep -i android || true
