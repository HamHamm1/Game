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

### Phase 2 M2.4-A — Shared material library (texture-free)

First step of the M2.4 art pass (`godot/M2.4_ART_DESIGN.md`, added here).
Replaces per-primitive flat colors with a small, cohesive, **texture-free**
shared material library, tuned so M2.2 lighting reads each surface as a
material (wood matte, tile lightly sheened, water catching the sun) rather
than flat paint. **Materials-only** — no geometry, vegetation, terrain, or
hero buildings yet (M2.4-B+). `IMPLEMENTED · STATICALLY VALIDATED · HEADLESS
TESTED` — **not** ANDROID VERIFIED.

- **NEW `godot/src/world/material_library.gd`** (`MaterialLibrary`) — a static
  cache of named, shared, tuned `StandardMaterial3D`s (ground/grass/path/
  water/stone, wall tones, roofs, structural wood, foliage, interiors, a
  reserved metal) plus `tuned_color(color)` — a cached tuned material for
  arbitrary-colour props. No textures/normal/AO maps, no emission. Owns look
  data only; writes no environment/lights.
- **`godot/src/world/blockout_util.gd`** — colour `static_box`/`visual_box`
  now route through `MaterialLibrary.tuned_color` (so every existing primitive
  is shared + tuned with no call-site change); added `static_box_mat`/
  `visual_box_mat` taking an explicit shared material; `add_tree` uses named
  foliage/wood.
- **`godot/src/world/regions/blockout_town.gd`** — major surfaces switched to
  named materials (ground, street/path, house walls/roofs with per-building
  variety, bathhouse, park lawn, pond, river); geometry, spawn, entry points,
  door, and pickups unchanged. Interiors improve automatically via the tuned
  colour path (named interior materials are a later pass).
- **`godot/tests/headless_test.gd`** — +material suite (per-key sharing/
  identity; water glossier than ground; wood non-metallic; unknown-key safe
  fallback; `tuned_color` shares per colour, distinguishes colours, applies
  tuning).

Untouched (per M2.4-A constraints): M2.2 lighting, M2.3 weather, player
movement, location entry/exit contracts, save format, interaction systems.

Validated: `tools/run_validation.sh` → static 80/80, headless import clean,
headless boot clean, headless suite **105/105**, Android export config valid.
NOT ANDROID VERIFIED — whether the tuned materials + lighting make the
greybox beautiful requires the on-device test.

### Phase 2 M2.3 — Weather foundation

Implemented the peaceful, Android-first weather foundation per
`godot/M2.3_WEATHER_DESIGN.md`. Subset: `CLEAR` / `OVERCAST` / `LIGHT_RAIN` /
`MIST` (localized) + a `wind` scalar. **CLEAR preserves the M2.2 look
exactly.** No heavy global fog, no screen filters, no storm; heavy rain /
storm / global fog deferred. Deferred to later passes: lanterns/street/window/
practical lights, wet-material response, detailed vegetation-wind response,
advanced weather/audio. `IMPLEMENTED · STATICALLY VALIDATED · HEADLESS
TESTED` — **not** ANDROID VERIFIED.

- **NEW `godot/src/world/weather_types.gd`** (`WeatherTypes`) — typed `State`
  enum, a `LightMod` (lighting) and `FxSpec` (rain/mist/wetness) value object
  per state, `blend_mod()`, and a Clear-dominant weighted `roll()`. LightMod
  deltas are deliberately subtle (naturally diffused daylight, not a filter).
- **NEW `godot/src/autoload/weather_manager.gd`** (autoload, after
  `TimeManager`) — deterministic state machine: boots CLEAR, rolls on
  `day_started` from a seeded RNG, schedules at most one optional intra-day
  transition, emits `weather_changed`. Publishes DATA only (`current_state`,
  `current_wind`, `light_mod`, `fx_spec`); **never writes Environment,
  DirectionalLight3D, fog_density, or any GraphicsManager-owned property.**
  Savable `"weather"`.
- **NEW `godot/src/world/weather_fx.gd`** (`WeatherFX`, world_root child) —
  one player-following `CPUParticles3D` rain emitter + a few localized mist
  planes. Preset-gated (`allow_fx`: LOW/interiors → off) and interior-gated.
  No lights, no per-object rain, no global fog.
- **M2.2 integration hook (approved):** `WorldEvents.weather_changed`;
  `LightingProfile.apply_weather()` (subtle desaturate/darken/tint/fog-tint,
  **CLEAR = identity**) folded into `resolve()` as
  **base → category → weather → mystery → clamp** (weather args optional, so
  M2.2 callers are unchanged); `RegionLightingController` subscribes,
  crossfades between weather looks, and resyncs on load. The readability
  clamp stays last — weather never breaches the night/interior floors. No
  M2.2 keyframes, floors, category logic, or ownership changed.
- **`godot/src/world/world_root.gd`** — instantiates `WeatherFX`.
- **`godot/project.godot`** — registers the `WeatherManager` autoload.
- **`godot/tests/headless_test.gd`** — +weather suite (deterministic +
  Clear-dominant rolls; CLEAR identity; rain desaturates/darkens yet stays ≥
  readability floor day and night; `blend_mod`; FX gating; save/load +
  empty-save→CLEAR; controller applies weather but leaves `fog_density` and
  shadows untouched).
- **`GAME_SYSTEMS.md` §2 / `TECHNICAL_ROADMAP.md` Phase 2** — reconciled to
  record the M2.3 subset and the localized-mist / lighting-mod approach.
- **Save/load:** new savable `"weather"`; **backward compatible** — old saves
  without the key load as `CLEAR` (SaveManager loads only present keys).

Validated: `tools/run_validation.sh` → static 79/79, headless import clean,
headless boot clean, headless suite **96/96**, Android export config valid.
NOT ANDROID VERIFIED — atmosphere/comfort require the on-device test.

### Phase 2 M2.2 — Time-of-day + lighting system

Implemented the time-of-day and location lighting system per
`godot/M2.2_LIGHTING_DESIGN.md` (the canonical M2.2 reference, added in this
commit). Expresses the locked creative direction: a beautiful, peaceful
Japanese-village look that is readable and inviting by default — **not** a
"day = safe / night = horror" switch. **No weather (that's M2.3), no
particles, no new art/materials, no NPCs/cooking/dialogue, no save-format or
`project.godot` change.** `IMPLEMENTED · STATICALLY VALIDATED · HEADLESS
TESTED` — **not** ANDROID VERIFIED (beauty/atmosphere require the developer's
on-device test).

- **NEW `godot/src/world/lighting_profile.gd`** (`class_name LightingProfile`)
  — typed value object + pure resolution logic. A continuous time-of-day
  curve from a keyframe table (deep-night → dawn → morning → **midday** →
  late-afternoon → **evening/golden hero** → dusk → night) interpolated with
  midnight wraparound, so the day reads smoothly with no per-block switch. A
  separate warm **interior baseline** (its own higher readability floor,
  modulated subtly by the outside time). Restrained **category modifiers**
  (residential/commercial/natural/water/landmark/threshold/interior — tiny
  warmth + ≤4% ambient nudges, character not a color grade). A sparse local
  **mystery modifier** (small cool shift + ≤10% dim, never red/horror, never
  map-wide). Readability floors (`EXTERIOR_MIN_AMBIENT`/`INTERIOR_MIN_AMBIENT`)
  guarantee night is navigable and interiors are never dark.
- **NEW `godot/src/world/region_lighting_controller.gd`**
  (`class_name RegionLightingController`) — one controller for the whole
  game's single environment. Subscribes to `minute_passed`,
  `region_loaded`, `location_entered/exited`, `game_loaded`; resolves a
  profile for the current minute + context and writes **only** the mood
  properties (sun rotation/energy/color, ambient color/energy, background +
  fog tint). Event-driven, no `_process`. Reads each scene's optional
  `lighting_category` / `lighting_mystery` data tags.
- **`godot/src/world/world_root.gd`** — instantiates and wires the controller
  (passing the existing `_sun`, `_environment`, and the two loaders) before
  the first region loads. `_apply_graphics` still owns the GraphicsManager
  cost knobs (shadows/fog-density/glow/ssao/scale/msaa/view-distance); the
  two write **disjoint** properties, so LOW stays LOW.
- **Scene data tags** — `@export var lighting_category` added (data only, no
  geometry change): `blockout_town`=residential, `blockout_interior`
  (player home)=residential, `restaurant`/`shop`/`workshop`=commercial,
  `bathhouse`=landmark.
- **`godot/tests/headless_test.gd`** — +2 suites (profile invariants +
  controller). New checks assert: night ambient ≥ floor with a low non-zero
  sun; evening warmer than midday; continuity across a keyframe boundary;
  interior warmer/readable and independent of exterior; category nudges ≤10%
  and above floor; mystery dims slightly + cools (not red) + stays above
  floor; and the controller leaves **every** GraphicsManager-owned property
  untouched.
- **Save/load:** unchanged — lighting is derived from `TimeManager`
  (already saved) + context; no lighting state is persisted.

Validated: `tools/run_validation.sh` → static 75/75, headless import clean,
headless boot clean, headless suite **77/77**, Android export config valid.

### M2.0 — Canonical art-direction reconciliation (documentation only)

Corrected the canonical creative/visual direction after the M2.1 on-device
playtest. **Documentation only** — no gameplay code, no `project.godot`, no
`RegionLightingController`/`WeatherManager`, no assets, no save-format or
architecture change. M2.2/M2.3/M2.4 remain unimplemented and separate.

The primary identity is now stated explicitly: **a beautiful, peaceful
Japanese rural village the player genuinely wants to live in**, with nature
as a *primary character*. Canonical hierarchy — **PRIMARY:** Japanese rural
village + peaceful slow life + nature + beauty + exploration; **SECONDARY:**
relationships + daily activities + small discoveries + belonging;
**TERTIARY:** mystery + supernatural + occasional unease/horror (seasoning,
never the meal). The bathhouse is an architectural/visual reference only,
not a horror mandate. Exploration/adventure/mystery remain part of the
identity; the village must not become a pure life-sim, nor uniformly bright
or sterile — natural variation and beautiful shadows still matter.

- **DESIGN.md** — new §1.1 "Creative Hierarchy" (PRIMARY/SECONDARY/TERTIARY
  + nature-as-primary + bathhouse-as-architecture); §1 genre line reframes
  mystery/horror as a tertiary layer; §2 atmosphere lead now
  "peaceful, beautiful, natural, nostalgic, lived-in"; §5 adds the
  attach-to-the-village-first intent.
- **MOBILE_ART_DIRECTION.md** — §0 visual-goal sentence rewritten (village
  first, mystery as quiet undercurrent) and identity list reordered
  (nature/peace lead, horror demoted/softened); §3 visual identity
  reordered with Natural Beauty (primary character) + a new Peace/Slow Life
  block above Mystery (marked secondary); §16 adds canonical lighting
  readability + time-of-day rules (Morning/Day/Evening/Night all beautiful,
  evening = hero, night navigable, interiors warm/readable, mystery = local
  modifier); §26 adds the "lived-in interiors" recorded direction from the
  M2.1 playtest (art direction, not a prop-placement order).
- **ART_DIRECTION.md** — §1 reframes the safe/mystery "core contrast" as a
  spectrum with a dominant beautiful/peaceful default (not a two-mode
  switch); asset-check words now peaceful · natural · nostalgic · lived-in
  (mysterious secondary).
- **ARCHITECTURE.md** — §10 clarifies (prose only) that the
  `safe/mystery` location-category is a lighting-profile spectrum defaulting
  to the peaceful village look; category set expected to broaden at M2.2;
  the `RegionLightingController` mechanism and code symbols are unchanged.
- **MASTER_SESSION_HANDOFF.md** — §1 identity lead + §9 Phase-2 intent
  aligned to the hierarchy and the beauty/readability lighting rules; notes
  M2.1–M2.4 stay separate milestones.
- **TECHNICAL_ROADMAP.md** — Phase 2 deliverable adds the beauty+readability
  lighting priority and the M2.2/M2.3 separation; Phase 7 "Mystery" remains
  a later additive layer (unchanged).

### Phase 2 M2.1 — Blockout pass on the real MVP region

Expanded the grey-box town from a single-house test scene into the ten-item
MVP hub laid out by DESIGN.md §3 — still primitives-only (ART_DIRECTION.md
§6 step 1, MOBILE_ART_DIRECTION.md §57 "blockout first"). No new autoloads,
no signals, no save-format change, no `RegionLoader`/`LocationLoader` core
change, no lighting profiles (that's M2.2), no weather (M2.3), no
material/lighting pass (M2.4), no NPCs/cooking/quests/dialogue/inventory-UI.

- **`godot/src/world/blockout_util.gd`** — added `visual_box` (mesh-only,
  no collision, for roofs/water/leaves/street stripes — halves node cost
  vs. `static_box` where collision would be wasted, MOBILE_FIRST.md §6/§10)
  and `add_tree` (collidable trunk + visual canopy).
- **`godot/src/world/regions/blockout_town.gd`** — rebuilt as the MVP hub:
  residential street; player home, restaurant, shop, workshop (all
  enterable, each pointing at its own interior via the existing
  `LocationEntryPoint` pattern); a stepped-roof **bathhouse landmark**
  (hero building at the north end, larger footprint, taller, enterable);
  a **park** with a bench; a **pond** by the park; a **river** strip east
  of the buildings; a **forest edge** row of tree blockouts east of the
  river; two non-enterable NPC houses for street density; a narrow-walled
  **alley** between the workshop and one NPC house. Player spawn moved to
  the south end of the street. Phase-1 freestanding openable Door and two
  outdoor pickups preserved so existing interaction smoke tests still fire.
- **New interior scenes** (each a `.gd` + `.tscn` following the exact
  pattern of the existing `blockout_interior.gd`):
  `restaurant_interior`, `shop_interior`, `workshop_interior`,
  `bathhouse_interior`. Player home reuses the existing
  `blockout_interior.tscn` unchanged.

Validated: `tools/run_validation.sh` → static **73/73**, headless import
clean, headless boot clean, headless suite **42/42**, Android export config
valid. Phase 2 M2.2/M2.3/M2.4 remain not started; awaiting on-device
verification of M2.1 before continuing.

### Fix — Pause menu scroll on small screens + walking-stutter mitigation

On-device (real Android): game launches; touch move/look/interact, pickup,
pause, and graphics presets all work. Two issues fixed:

- **Pause menu unscrollable / content off-screen** → rebuilt
  `pause_menu.gd`: settings now live in a vertical **ScrollContainer**
  (touch-drag scrollable), with **Resume/Quit in a fixed bottom bar** that
  is always visible, all inset to the **safe area**. Labels ignore touches
  so a finger-drag over them scrolls, while sliders/dropdown/buttons keep
  consuming their own touches — so adjusting a slider never scrolls the
  menu, and the whole panel is reachable by swipe. No wheel/keyboard
  needed. Visual design preserved (same controls, same order).
- **Walking micro-stutter** → root-caused (not animation — there is no
  animation system): the FP camera is a child of the `CharacterBody3D`
  moved in `_physics_process` (60 Hz), and Godot 4.3 has no 3D physics
  interpolation, so on a 90/120 Hz phone the render frames beat against the
  60 Hz body motion. Smallest safe fix: cap `application/run/max_fps=60` so
  render aligns 1:1 with physics (also saves battery, MOBILE_FIRST §20/§21).
  Reversible; no gameplay/architecture change.

Validated headlessly (static 61 + import + boot + 42 tests + export config
all pass). No inventory / world-building added; Phase 2 stays BLOCKED.

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
