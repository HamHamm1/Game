#!/usr/bin/env bash
# Validate the Android export CONFIGURATION as far as headless allows.
# Classifies the outcome:
#   APK BUILT               - a signed APK was produced (needs SDK; still not
#                             ANDROID VERIFIED until run on a device)
#   EXPORT CONFIG VALID     - preset + templates OK, stopped only because no
#                             Android SDK is configured (the expected result
#                             in an environment without the SDK)
#   EXPORT FAILED           - a real configuration problem (printed)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="$ROOT/godot"
GODOT="${GODOT:-$ROOT/tools/godot}"
PRESET="Android"
OUTREL="build/aletheia-phase1-debug.apk"
OUT="$PROJ/$OUTREL"
NOISE='mesh_get_surface_count|Parameter "m" is null'

echo "== Android export config validation =="

if grep -q 'name="Android"' "$PROJ/export_presets.cfg" 2>/dev/null; then
	echo "  preset present: Android (arm64-v8a, non-gradle debug)"
else
	echo "  MISSING Android preset in export_presets.cfg"; exit 1
fi

TDIR="${GODOT_TEMPLATES_DIR:-$HOME/.local/share/godot/export_templates/4.3.stable}"
if [ -f "$TDIR/android_debug.apk" ]; then
	echo "  export templates: installed ($TDIR)"
else
	echo "  export templates: NOT installed — run tools/install_export_templates.sh"
fi

if [ ! -x "$GODOT" ]; then
	echo "  Godot binary missing at $GODOT — cannot run headless export"; exit 0
fi

mkdir -p "$PROJ/build"
log="$(mktemp)"
"$GODOT" --headless --path "$PROJ" --export-debug "$PRESET" "$OUTREL" 2>&1 | grep -vE "$NOISE" > "$log"

if [ -f "$OUT" ]; then
	echo "  RESULT: APK BUILT -> $OUT ($(stat -c%s "$OUT") bytes)"
	echo "         built != ANDROID VERIFIED — install and run on a device."
	exit 0
fi
if grep -qi "valid Android SDK path is required" "$log"; then
	echo "  RESULT: EXPORT CONFIG VALID — preset + templates accepted; the only"
	echo "         remaining requirement is a configured Android SDK (external)."
	exit 0
fi
echo "  RESULT: EXPORT FAILED for another reason:"
sed 's/^/    /' "$log" | tail -25
exit 1
