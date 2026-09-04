# CHANGELOG

All notable architectural and implementation changes to Project Aletheia
(the original first-person open-world life-sim RPG that replaces the retired
Spirit World MMORPG). Newest first. See AI_RULES.md — every change that
touches architecture appends here.

Status labels follow AI_RULES.md Rule 11:
`IMPLEMENTED` · `PARTIALLY IMPLEMENTED` · `BLOCKED` · `NOT IMPLEMENTED` ·
`NEEDS ART` · `NEEDS TESTING`.

---

## [Unreleased]

### Diagnosed real-device install failure — root cause was DELIVERY, not the APK

- Symptom: phone shows "The file has a problem" when installing.
- Added a temporary CI diagnostic (aapt2 badging + apksigner verify) and
  read the real numbers. **The built APK is valid and installable:**
  apksigner verify exit 0, signed **v1+v2+v3** (RSA 2048, CN=Android Debug),
  `minSdk 21 / targetSdk 34 / compileSdk 34`, `native-code arm64-v8a`,
  zip OK, launcher activity exported. Nothing about the build is wrong.
- **Root cause:** GitHub *Actions artifacts* download as a **ZIP** wrapper,
  not the bare `.apk`; installing the zip (or a partial/corrupted
  extraction) is what triggers "The file has a problem."
- **Fix (delivery):** the workflow now also **publishes the `.apk` as a
  GitHub Release asset** (tag `phase1-debug`), which downloads as the raw
  `.apk` with no zip — a clean phone install path. Added a permanent
  **apksigner signature-verify gate** (fails the build if the APK isn't
  v1+v2 signed) and prints the APK **SHA-256** in the run summary + Release
  notes. Replaced the temporary verbose diagnostic with this lean gate.
  `permissions: contents: write` added for the Release. No game/architecture
  changes; export preset unchanged.

### ✅ Cloud build SUCCEEDED — APK produced

- GitHub Actions run #2 finished **`success`** and produced the artifact
  **`aletheia-phase1-debug-apk`** (24,071,337 bytes, ~24 MB, sha256
  `1cb6cb2b…`). The "GitHub repo → cloud build → APK artifact" goal is met.
- Still **not** `ANDROID VERIFIED`: the APK must be installed and pass the
  on-device A–T checklist (`godot/ANDROID_VERIFICATION.md`). Phase 2 remains
  BLOCKED.

### Fix — Android export blocked by missing ETC2/ASTC setting

- The first CI run got through SDK install, Godot, templates, keystore,
  editor settings, and import, then failed at export with Godot's
  unhelpful **empty** "configuration errors:" message. Root-caused locally
  (by stubbing a complete SDK so the export advanced past the SDK checks):
  Godot 4.3 **requires** `rendering/textures/vram_compression/import_etc2_astc`
  for Android export. Added `textures/vram_compression/import_etc2_astc=true`
  to `godot/project.godot` — a required build-config setting, not a gameplay
  change. With it, the headless export runs to completion (add → align →
  sign → verify → end) and produces a ~24 MB APK. Export preset unchanged.

### Android APK via cloud CI — GitHub Actions workflow (no PC required)

Solves "build the APK without a PC": GitHub's Linux runners can install the
Android SDK (they are not behind this container's egress block), so the APK
is built in the cloud and downloaded to the phone as an artifact.

- **Added** `.github/workflows/android-build.yml` — on `ubuntu-latest`:
  JDK 17 + Android SDK (`platform-tools`, `build-tools;34.0.0`,
  `platforms;android-34`) + Godot 4.3 headless + export templates + debug
  keystore; injects SDK path/keystore via `editor_settings-4.3.tres`;
  imports `godot/` headlessly; runs the **unchanged** `Android` preset;
  uploads `aletheia-phase1-debug.apk` as an artifact. Triggers:
  `workflow_dispatch` (phone-runnable) + push to the dev branch under
  `godot/**`.
- **Validated locally** (the parts not needing the real SDK): injecting the
  SDK path via `editor_settings-4.3.tres` makes the export advance past
  "SDK path required" to the apksigner/adb stage (proving the mechanism +
  filename + format); export from a **fresh checkout** (no `.godot`)
  self-imports and reaches the same point. Only the real SDK install (CI's
  job) remains unproven here.
- **Docs:** ANDROID_BUILD.md §0b (phone-only operation guide). Export config
  and game architecture unchanged.
- Still **not** an APK in this environment and **not** ANDROID VERIFIED —
  the APK is produced by the CI run; verification is the on-device A–T gate.
  Phase 2 remains BLOCKED.

### Android export path — configured & validated to the SDK boundary

Set up a reproducible Godot 4.3 Android debug export. **No APK was built
here** — the Android SDK cannot be installed in this container
(`dl.google.com` blocked by egress policy, HTTP 403), and that is reported,
not pretended.

- **Added** `godot/export_presets.cfg` (Android, arm64-v8a, non-gradle
  debug; offline — no permissions; immersive; Mobile renderer),
  `tools/make_debug_keystore.sh`, `tools/install_export_templates.sh`,
  `tools/validate_android_export.sh` (classifies export outcome), and wired
  the export-config check into `tools/run_validation.sh` (step 5).
- **Did in-container:** JDK 21 + debug keystore ✅ · Godot 4.3 export
  templates downloaded + installed ✅ · headless `--export-debug` **loads
  the preset and accepts the templates**, stopping only at *"A valid
  Android SDK path is required"* → classified **EXPORT CONFIG VALID**.
- **Docs:** `ANDROID_BUILD.md` (prereqs, SDK/keystore setup, build/install
  steps, container status, troubleshooting), `godot/ANDROID_VERIFICATION.md`
  (on-device checklist A–T), VALIDATION.md/README updated.
- **Phase 2 remains BLOCKED** until the A–T Android verification gate passes
  on a real device.

### Automated validation — `STATICALLY VALIDATED` + `HEADLESS TESTED`

Project is Android-first, developed without a desktop. Added an automated
validation ladder (VALIDATION.md defines the 5 levels: IMPLEMENTED →
STATICALLY VALIDATED → HEADLESS TESTED → RUNTIME TESTED → ANDROID VERIFIED).

- **Added** `tools/static_validate.py` (no-Godot static checks: paths,
  JSON, dead refs, Godot-3 API), `tools/run_validation.sh` (static +
  headless import + boot + logic tests), `tools/fetch_godot.sh` (grabs
  Godot 4.3 headless; binary git-ignored), `godot/tests/headless_test.gd` +
  `.tscn` (42-check logic suite), `VALIDATION.md`.
- **Ran** all gates with Godot 4.3.stable headless in-container:
  static **61/61**, headless import clean, main-scene boot clean, logic
  suite **42/42 PASS**.
- **Fixed** (found by the headless run): input actions were registered in
  `world_root` (main-scene only) → moved to the `GameInput` autoload so
  they exist for every scene; removes `InputMap action "…" doesn't exist`
  errors and fixes movement in non-main scenes.
- Status labels across README / test plans / AI_RULES updated to the ladder.
  RUNTIME TESTED and ANDROID VERIFIED remain `REQUIRES EXTERNAL DEVICE`.

### Phase 1b — Mobile Foundation (`IMPLEMENTED`, not yet `TESTED`/`VERIFIED`)

Folded the mobile-first foundation into Phase 1 (Android is the primary
platform). Keyboard/mouse gameplay preserved; smallest clean changes.
State legend: `IMPLEMENTED` = code exists + reviewed · `TESTED` = tried in
target env · `VERIFIED` = confirmed by its test. Everything below is
`IMPLEMENTED` only — authored without a running editor/device. Mobile
performance is `UNVERIFIED` until an Android run.

**Added (autoloads)**
- `GameInput` — input abstraction (MOBILE_FIRST.md §13): gameplay reads
  abstract actions; keyboard/mouse and touch both feed them.
- `Settings` — persisted (`user://settings.json`): graphics preset, look
  sensitivity X/Y, FOV, camera smoothing, head-bob strength, camera-shake
  strength (stored; no shake system yet), move sensitivity.
- `GraphicsManager` — LOW/MEDIUM/HIGH/ULTRA presets → shadows, shadow/view
  distance, fog, glow, SSAO, 3D resolution scale, MSAA.
- `AutosaveManager` — debounced autosave on location transitions, inventory
  changes, and a periodic interval (never every frame).
- `AppLifecycle` — pause/resume/focus-out/close → forced autosave
  (MOBILE_FIRST.md §22/§23).

**Added (UI)**
- `MobileHud` — touch layer: dynamic virtual joystick, look-drag area,
  contextual interact button (shows the action verb, appears only on a
  target), SPRINT/CROUCH/JUMP buttons, ☰ menu, safe-area inset, center kept
  clear.
- `VirtualJoystick`, `TouchLookArea`, `TouchActionButton` widgets.
- `PauseMenu` — pause + settings (graphics preset, sliders), a
  "Touch controls (preview)" toggle for desktop, Quit; pauses the tree,
  runs while paused.

**Changed**
- `Interactable` contract gains `get_interaction_verb()` (short verb for the
  mobile button); Door/PickupItem/entry/exit override it.
- `PlayerMovement`, `PlayerCamera`, `PlayerInteraction`, `HeadBob` now read
  input via `GameInput` and comfort/sensitivity/FOV/bob via `Settings`.
  Camera supports smoothing and captures the mouse only on desktop.
- `Hud` suppresses the text prompt on touch (the interact button covers it).
- `world_root` wires the mobile HUD, pause menu, and applies graphics
  presets to the sun/environment/camera/viewport.
- `SaveManager.can_autosave()` guards autosave before the player exists.
- `project.godot`: new autoloads; Mobile renderer override for Android;
  expand-aspect stretch; sensor orientation; touch emulation for desktop
  preview; `pause` input action.

**Docs**
- `godot/PHASE1B_TEST_PLAN.md` (M1–M10). README, MOBILE_FIRST,
  MOBILE_ART_DIRECTION, DESIGN updated with accurate implementation states.

**Behavior note:** `Esc` now opens the pause menu (frees the cursor while
open) instead of the old capture toggle.

### Platform requirement — MOBILE-FIRST (Android/touch is primary)

- Added `MOBILE_FIRST.md` (primary-platform requirement: touch input,
  input abstraction, streaming, tiered NPC sim, mobile performance/memory,
  app lifecycle, AI-API cost/offline fallback, priority order) and
  `MOBILE_ART_DIRECTION.md` (mobile-first visual/technical-art bible).
- `ART_DIRECTION.md` now defers to those two where they conflict (note
  added at its top); a fuller mobile-first reconciliation of ARCHITECTURE
  (input), ART_DIRECTION, DIALOGUE UI, and TECHNICAL_ROADMAP happens after
  the Phase 1 core is validated.
- **Identified foundation gap:** Phase 1 controls are keyboard/mouse only
  (LOOK is mouse-only, no touch). A "Phase 1b" mobile input/settings/
  lifecycle layer is required **before Phase 2**. Not yet built (Phase 2 is
  on hold pending Phase 1 validation).
- Added `godot/PHASE1_TEST_PLAN.md` — the in-editor manual validation
  checklist for the current core (still `NEEDS TESTING`; nothing marked
  `IMPLEMENTED`/`VERIFIED` until the user runs it in Godot 4).

### Phase 1 — Foundation (`NEEDS TESTING` in-editor)

First gameplay code. Built under `godot/` to stay cleanly separated from
the retired Node.js MMORPG at the repo root (DESIGN.md §0,
TECHNICAL_ROADMAP.md §2.4); the retirement commit will move it to root and
delete the old code once validated in-engine.

> Authored without a running Godot editor — **not yet launched/verified
> in-engine.** Correctness was reviewed by inspection; see
> `godot/README.md` for the manual test checklist. Nothing here is marked
> `IMPLEMENTED` until it actually runs.

**Added**
- Godot 4 project scaffold: `project.godot` (Forward+, code-registered
  input map, main scene), `.gitignore`, placeholder icon, `main.tscn`.
- Autoloads (ARCHITECTURE.md §5): `WorldEvents` (pure signal bus),
  `SaveManager` (versioned save file + register/pull `get_save_data`/
  `load_save_data` contract), `ItemRegistry` (JSON→typed `ItemDefinition`
  loader — the reference implementation of the data pattern,
  TECHNICAL_ROADMAP.md §2.1), `TimeManager` (authoritative clock + time
  blocks).
- Typed data classes: `ItemDefinition`, `ItemInstance` (definition-vs-
  instance split, GAME_SYSTEMS.md §9).
- Modular first-person player (ARCHITECTURE.md §4): `Player` orchestrator
  delegating to `PlayerMovement` (walk/sprint/crouch/jump), `PlayerCamera`
  (Yaw/Pitch rig + crouch height), `HeadBob` (toggleable camera-effect
  module), `PlayerInteraction` (forward raycast), `PlayerInventory`.
- Typed `Interactable` contract + `Door`, `PickupItem`,
  `LocationEntryPoint`, `LocationExitPoint` (ARCHITECTURE.md §6,
  GAME_SYSTEMS.md §3).
- Scene management (ARCHITECTURE.md §3): `RegionLoader` / `LocationLoader`
  (synchronous now, interface shaped for a later threaded swap), a
  `world_root` persistent root that fulfils transition requests via
  WorldEvents, and code-built primitive blockout region + interior
  (ART_DIRECTION.md §6 step 1) via a shared `BlockoutUtil`.
- Placeholder `Hud` (crosshair, interaction prompt, clock/inventory info,
  save/load toast) — signal-driven, never polling.
- Content data: `data/items/{fish,rice,egg}.json`.
- Docs: `DIALOGUE_DESIGN.md` (AI-powered hybrid dialogue architecture;
  implementation deferred to Phase 3+), `godot/README.md`.

**Decisions**
- Data format resolved to **JSON + strict typed-parsing layer**
  (TECHNICAL_ROADMAP.md §2.1, ARCHITECTURE.md §9); `ItemRegistry` is the
  reference implementation.
- New project lives under `godot/` during Phase 1 to avoid mixing with /
  being `.gitignore`-swallowed by the retired root code.

**Not in this phase** (per TECHNICAL_ROADMAP.md): NPCs, schedules,
dialogue runtime, relationships, cooking, quests, weather, real art,
automated test harness, streaming.

---

## [Phase 0] — Research & foundation docs

- Analyzed 8 reference repositories (`reference_analysis/`) for
  architecture patterns and licenses — no code/assets copied.
- Wrote `DESIGN.md`, `ARCHITECTURE.md`, `AI_RULES.md`, `GAME_SYSTEMS.md`,
  `ART_DIRECTION.md`, `TECHNICAL_ROADMAP.md`.
- Chose engine: Godot 4, GDScript, Forward+.
