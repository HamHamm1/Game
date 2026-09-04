#!/usr/bin/env bash
# Automated validation for the Godot project (Android-first, developed
# without a desktop editor). Runs, in order:
#   1. static validation  (no Godot needed)           -> STATICALLY VALIDATED
#   2. headless import / script-parse (needs Godot)    -> HEADLESS TESTED
#   3. headless main-scene boot (needs Godot)          -> HEADLESS TESTED
#   4. headless logic test suite (needs Godot)         -> HEADLESS TESTED
#
# RUNTIME TESTED (real input/physics/render) and ANDROID VERIFIED require a
# physical device and are NOT covered here — see godot/PHASE1*_TEST_PLAN.md.
#
# Godot binary: set GODOT=/path/to/godot, or place it at tools/godot.
# To fetch 4.3 headless: run tools/fetch_godot.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="$ROOT/godot"
GODOT="${GODOT:-$ROOT/tools/godot}"
NOISE='mesh_get_surface_count|Parameter "m" is null'
fail=0

echo "=================== 1. STATIC VALIDATION ==================="
python3 "$ROOT/tools/static_validate.py" "$PROJ" || fail=1
echo

if [ ! -x "$GODOT" ]; then
	echo "Godot binary not found/executable at: $GODOT"
	echo "  -> STATICALLY VALIDATED only. For headless tests, run tools/fetch_godot.sh"
	echo "     or set GODOT=/path/to/godot and re-run."
	exit $fail
fi

echo "=================== 2. HEADLESS IMPORT ===================="
imp="$("$GODOT" --headless --path "$PROJ" --editor --quit 2>&1)"
if echo "$imp" | grep -iE "SCRIPT ERROR|Parse Error|Invalid" | grep -v "ItemRegistry"; then
	echo "  import reported errors above"; fail=1
else
	echo "  no parse/script errors on import"
fi
echo

echo "=================== 3. HEADLESS BOOT ======================"
boot="$("$GODOT" --headless --path "$PROJ" --quit-after 60 2>&1 | grep -vE "$NOISE")"
echo "$boot" | grep -iE "SCRIPT ERROR|Parse Error|Invalid|doesn't exist" && { echo "  boot reported errors"; fail=1; } || echo "  boot clean (autoloads + main scene)"
echo

echo "=================== 4. HEADLESS TESTS ====================="
"$GODOT" --headless --path "$PROJ" res://tests/headless_test.tscn > "$ROOT/tools/.headless_test.log" 2>&1
tcode=$?
grep -E "RESULT:|checks:|FAIL:" "$ROOT/tools/.headless_test.log" | grep -vE "$NOISE"
if [ $tcode -ne 0 ]; then echo "  HEADLESS TESTS FAILED (exit $tcode)"; fail=1; else echo "  HEADLESS TESTS PASS"; fi
echo

echo "=================== SUMMARY ==============================="
[ $fail -eq 0 ] && echo "ALL AUTOMATED VALIDATION PASSED (static + headless)." \
	|| echo "VALIDATION FAILURES — see above."
echo "Note: RUNTIME TESTED and ANDROID VERIFIED still require a device."
exit $fail
