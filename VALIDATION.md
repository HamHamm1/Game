# VALIDATION.md — validation levels & current status

This project is developed **Android-first, without a desktop**. To keep
status claims honest, every system is tracked against an explicit ladder.
Never skip a rung: a system at `HEADLESS TESTED` is **not** `ANDROID
VERIFIED`, and code that merely looks right is **not** `HEADLESS TESTED`.

## The five levels

| Level | Meaning | How it's proven here |
|---|---|---|
| **IMPLEMENTED** | Code exists and has been reviewed by inspection. | Written + read. |
| **STATICALLY VALIDATED** | Passes automated static checks (paths exist, JSON valid, no dead refs, no Godot-3 API). | `tools/static_validate.py` (no Godot needed). |
| **HEADLESS TESTED** | Compiles and runs under `godot --headless`: project imports with no script errors, the main scene boots, and the logic test suite passes. | `tools/run_validation.sh` with a Godot binary. |
| **RUNTIME TESTED** | Actually exercised with real input/physics/rendering (a person drives it). | **Requires the Godot editor or a device — not done here.** |
| **ANDROID VERIFIED** | Confirmed working on a real Android device per the test plan. | **Requires a physical Android device — not done here.** |

**Never claim ANDROID VERIFIED without running the game on Android.**
Anything that fundamentally needs the editor or a device is marked
**REQUIRES EXTERNAL DEVICE**, not handed back as a desktop-only task.

## How to run the automated validation

```bash
tools/fetch_godot.sh        # one-time: download Godot 4.3 headless (git-ignored)
tools/run_validation.sh     # static + headless import + boot + logic tests
```
`run_validation.sh` runs the static checks even if no Godot binary is
present (STATICALLY VALIDATED), and adds the headless gates when one is
(HEADLESS TESTED). Set `GODOT=/path/to/godot` to use a specific binary.

## Current status (Phase 1 + 1b)

Validated in this environment with **Godot 4.3.stable headless**:

- **STATICALLY VALIDATED** ✅ — `static_validate.py`: 61 checks, 0 problems.
- **HEADLESS TESTED** ✅ — import: no script/parse errors · main scene boots
  clean (autoloads load, `ItemRegistry: loaded 3 item definitions`) · logic
  suite: **42/42 checks pass** (`tests/headless_test.gd`).

The headless logic suite covers, without a GPU/window:

- item data loading + validation, unknown-id rejection
- inventory add/stack/remove + inventory save/load round-trip
- `ItemInstance` dict round-trip
- time-of-day block boundaries + clock string
- graphics presets (params present, LOW disables / HIGH enables shadows,
  invalid preset → MEDIUM fallback)
- settings persistence (write to disk, reload restores)
- `SaveManager` full save→load round-trip via the savable contract
- interactable contextual verbs (PICK UP / OPEN / CLOSE / ENTER)
- **GameInput abstraction**: latch/consume edge actions, touch held
  state, touch move vector — i.e. the touch→gameplay path is exercised
  even though no touch hardware is present.

## Android export status

Attempted in-container with Godot 4.3.stable headless (ANDROID_BUILD.md §0):

- **Export preset** (`godot/export_presets.cfg`, arm64-v8a, non-gradle
  debug) — **loads and is accepted** by Godot.
- **Export templates** — downloaded + installed.
- **Debug keystore** — generated (`tools/make_debug_keystore.sh`).
- **`--export-debug "Android"`** stops at exactly one error: *"A valid
  Android SDK path is required."* → **EXPORT CONFIG VALID**; the only
  missing piece is the Android SDK, which **cannot be installed here**
  (`dl.google.com` blocked by egress policy, HTTP 403).
- **APK: NOT built** in this environment, and not claimed. Re-check the
  classification any time with `tools/validate_android_export.sh`.

So the Android export path is proven correct up to the SDK boundary; an
actual APK requires a machine that can reach the Android SDK (see
ANDROID_BUILD.md §1–§3), and running it requires a device.

## What is NOT yet validated — REQUIRES EXTERNAL DEVICE

These need real input/physics/rendering or an actual phone; they are the
content of `godot/PHASE1_TEST_PLAN.md` and `godot/PHASE1B_TEST_PLAN.md`:

- **RUNTIME TESTED** (editor or device): first-person mouse/touch look feel,
  physical walking/collision/jump, head-bob, raycast interaction against
  real colliders, region↔interior transitions in-world, live HUD, the
  pause menu and settings sliders visually, graphics presets' visual
  effect, mesh rendering (the headless dummy renderer can't render our
  `BoxMesh` blockout — a headless-only limitation, not a code bug).
- **ANDROID VERIFIED** (physical device): install + launch, touch
  joystick/look/buttons on a real screen, safe-area/notch behavior,
  orientation changes, app pause/resume autosave, and **all mobile
  performance** (FPS, memory, thermal) — the full A–T checklist in
  `godot/ANDROID_VERIFICATION.md`. `UNVERIFIED` until run on a mid-range
  Android device (MOBILE_FIRST.md §24/§25). **Phase 2 stays BLOCKED until
  this gate passes.**

## Note on headless render noise

A headless run prints repeated `mesh_get_surface_count / Parameter "m" is
null` errors. These come from Godot's **dummy** rendering backend when it
encounters the real `BoxMesh` surfaces built by the blockout — there is no
GPU in headless mode. They are filtered out by `run_validation.sh` and do
not occur on a real device. They are not script errors.
