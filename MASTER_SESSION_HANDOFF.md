# MASTER SESSION HANDOFF

    PROJECT STATUS: PHASE 1 ANDROID VERIFIED
    CURRENT PHASE:  PHASE 2 PLANNING
    PLATFORM:       ANDROID ONLY
    PC AVAILABLE:   NO

> This document is the single source of truth for continuing this project
> in a **new AI session** with no access to the previous conversation. Read
> it first, in full, then read the canonical documents in §5, then inspect
> the real repository (§10–§11) before proposing any change.
>
> Evidence rule (applies to this whole document): "ANDROID VERIFIED" items
> were confirmed by the **human developer on their real Android phone**
> (their on-device testing is the evidence). The AI cannot see the device;
> never upgrade a status to ANDROID VERIFIED yourself without a fresh
> human-reported device result.

---

## 1. PROJECT IDENTITY

- **What it is:** an original, single-player **first-person open-world
  RPG / life-sim** built from scratch in **Godot 4**. It replaces a retired
  earlier project ("Spirit World MMORPG", a 2D Node.js/Canvas browser game
  whose code still sits, inert, at the repo root — see §2 "Repository").
- **Game concept (target vision, mostly not built yet):** live as a
  resident of a small, lived-in town — walk, talk to NPCs, build
  relationships (incl. romance), cook, gather/shop, do quests, explore, and
  uncover a light mystery/horror thread. Warm, nostalgic, "someone lives
  here" atmosphere, with a bathhouse/folk-horror *mood reference only*
  (nothing copied). See DESIGN.md.
- **Target platform:** **Android phones (touch), primary and only.** No PC
  is available to the developer. Mobile is not a later port — it drives
  input, UI, rendering, performance, and the (future) AI-dialogue design.
  See MOBILE_FIRST.md.
- **Engine/version:** **Godot 4.3.stable** (GDScript). Desktop preview uses
  the Forward+ renderer; **Android uses the Mobile renderer** (per-platform
  override in `project.godot`).
- **Repository:** GitHub **`HamHamm1/Game`** (owner id `hamhamm1`).
  - **Active working branch: `claude/rpg-architecture-design-eut455`** — all
    Phase 0/1/1b work lives here. Continue on this branch.
  - HEAD at handoff time: **`5849017`** ("scrollable pause menu + cap
    max_fps"). Working tree clean. No pull request has been opened.
  - The repo's *default* branch is the old MMORPG's branch; **do not** work
    there.
  - **The Godot project lives in the `godot/` subdirectory**, i.e.
    `res://` = `godot/`. The repo root still contains the retired Node.js
    MMORPG (`src/`, `public/`, `server.js`, `content/`, `data/`,
    `package.json`, `scripts/`, `docs/`) — this is intentional and its
    removal is a planned, separate commit (see §8/§9). Do not mix the two.
- **Development philosophy:** *Small → Stable → Modular → Expandable →
  Beautiful.* Architecture-first, then a beautiful playable vertical slice,
  then content. Data-driven ("content is data, not code"). Incremental,
  reversible changes. Honest status reporting. See AI_RULES.md and §6.
- **Role of mobile-first:** every system must answer "how does this work
  comfortably on a phone?" Touch is a first-class input; UI must be
  touch-sized and safe-area aware; rendering/perf must suit mid-range
  Android; the AI-dialogue layer (future) must tolerate limited/no network.

---

## 2. CURRENT PROJECT STATE

Status vocabulary (the project's ladder):
`IMPLEMENTED` (code exists, reviewed) → `STATICALLY VALIDATED`
(tools/static_validate.py) → `HEADLESS TESTED` (runs under
`godot --headless`: import + boot + 42-check suite) → `RUNTIME TESTED`
(real input/physics/render, editor or device) → `ANDROID VERIFIED`
(confirmed on a real Android phone). Plus `NOT IMPLEMENTED`, `BLOCKED`,
`DEFERRED`.

| System | Status | Notes |
|---|---|---|
| **Source code** (Phase 1 + 1b, GDScript under `godot/src/`) | IMPLEMENTED · STATICALLY VALIDATED · HEADLESS TESTED | 34 `.gd` files. Core loop also ANDROID VERIFIED (below). |
| **Architecture** (autoloads + signal bus + data-driven registries) | IMPLEMENTED · HEADLESS TESTED | Matches ARCHITECTURE.md. 9 autoloads (order: WorldEvents, Settings, GraphicsManager, GameInput, SaveManager, ItemRegistry, TimeManager, AutosaveManager, AppLifecycle). |
| **Input system** (`GameInput` abstraction: keyboard/mouse OR touch feed abstract actions) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED** | Touch joystick + look confirmed on device. |
| **Player movement** (`PlayerMovement`, walk/sprint/crouch/jump) | IMPLEMENTED · **ANDROID VERIFIED** | Moves on device. Walking-smoothness fix (max_fps=60) applied + reported smooth. |
| **Camera** (`PlayerCamera` Yaw/Pitch rig, smoothing, FOV, crouch height) | IMPLEMENTED · **ANDROID VERIFIED** | Touch look confirmed. |
| **Interaction** (`Interactable` contract + raycast controller) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED** | Works on device. |
| **Pickup** (`PickupItem` → inventory) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED** | Works on device. |
| **Save / autosave** (`SaveManager` versioned file; `AutosaveManager`; `AppLifecycle`) | IMPLEMENTED · HEADLESS TESTED | Save/load round-trip passes headless (42-check suite). **Not yet explicitly ANDROID VERIFIED** (device save/load + lifecycle autosave not individually reported). |
| **Settings** (`Settings`, persisted `user://settings.json`) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED (sliders/dropdown/apply)** | Persistence-across-restart passes headless; device restart-persistence not separately reported. |
| **Graphics system** (`GraphicsManager` LOW/MED/HIGH/ULTRA presets) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED** | Changing quality takes visible effect on device. |
| **Mobile HUD** (`MobileHud`: joystick, look area, contextual interact button, sprint/crouch/jump, menu; safe-area) | IMPLEMENTED · **ANDROID VERIFIED** | Used on device. |
| **Pause menu** (`PauseMenu`: ScrollContainer + fixed Resume/Quit + safe area) | IMPLEMENTED · HEADLESS TESTED · **ANDROID VERIFIED** | Scroll/sliders/dropdown/resume/quit confirmed after the run-#5 fix. |
| **Android export** (`godot/export_presets.cfg`) | IMPLEMENTED · working | Preset unchanged since it worked; builds a valid APK in CI. |
| **CI/CD** (`.github/workflows/android-build.yml`) | IMPLEMENTED · working | Runs #2–#5 succeeded. |
| **APK generation** | working · delivered via **GitHub Release** (raw `.apk`) | See §3, §4. |
| **Testing** (automated) | `tools/run_validation.sh` (static 61 + import + boot + 42 tests + export-config) all PASS | `godot/tests/headless_test.gd`. |
| **Documentation** | extensive & current | See §5. |
| **Blockout world** (code-built primitive town + one interior) | IMPLEMENTED · **ANDROID VERIFIED (walkable)** | Placeholder grey-box only; real art is Phase 2+. |

**Not implemented at all (see §8):** inventory UI, NPCs, dialogue runtime,
cooking, relationships/romance, quests, weather, day/night lighting
profiles, real art/audio, animation, world streaming.

---

## 3. ANDROID VERIFICATION RESULT

The latest APK **was installed and run on the developer's real Android
phone.** Confirmed working (human-reported on-device):

- Game launches
- Touch joystick (movement)
- Player movement
- Camera touch-look
- Interaction
- Pickup
- Pause menu opens
- **Pause menu scrolling** (after fix)
- Sliders (settings)
- Dropdown (graphics preset)
- Resume
- Quit
- Graphics settings change **and take visible effect**
- Walking smoothness (after the FPS fix)

### Problems found on device and their fixes (all shipped)

1. **APK would not install — "The file has a problem."**
   Root cause: the developer had downloaded the **GitHub Actions artifact
   ZIP** (artifacts are always zip-wrapped) instead of the raw `.apk`;
   installing the zip fails. The APK itself was proven valid in CI
   (apksigner verify OK, v1+v2+v3 signed, minSdk21/target34, arm64-v8a).
   **Fix:** the workflow now also **publishes the raw `.apk` as a GitHub
   Release asset** (tag `phase1-debug`) — download that, not the artifact.

2. **Pause menu could not scroll; lower settings off-screen.**
   **Fix:** rebuilt `pause_menu.gd` with a real vertical `ScrollContainer`
   (touch-drag), a **fixed Resume/Quit bar** always visible, safe-area
   insets, and labels set to ignore touches (so a finger-drag scrolls while
   sliders/dropdown/buttons still work and don't cause accidental scroll).

3. **Small walking stutter.**
   Root cause (determined, not assumed — there is **no animation system**):
   the first-person camera is a child of the `CharacterBody3D` moved in
   `_physics_process` at 60 Hz, and **Godot 4.3 has no 3D physics
   interpolation**, so on a high-refresh (90/120 Hz) phone the extra render
   frames beat against the 60 Hz body motion. **Fix:** cap
   `application/run/max_fps = 60` so render aligns 1:1 with physics (also
   saves battery). Reversible; a "keep 120 fps smoothness" alternative
   (per-frame camera interpolation) is DEFERRED.

---

## 4. CURRENT BUILD PIPELINE (how the APK is produced)

The container the AI runs in **cannot** install the Android SDK
(`dl.google.com` is blocked, HTTP 403), so **APKs are built only in the
cloud via GitHub Actions.** Never claim a locally-built APK.

- **Workflow:** `.github/workflows/android-build.yml`, job `build-apk` on
  `ubuntu-latest`. Triggers: **push to `claude/rpg-architecture-design-eut455`
  touching `godot/**`** (or the workflow file), and **`workflow_dispatch`**
  (manual "Run workflow" button — phone-operable).
- **Steps:** checkout → JDK 17 (Temurin) → `android-actions/setup-android`
  → `sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34"`
  → download **Godot 4.3-stable** Linux headless + export templates → make a
  **debug keystore** (`keytool`, password `android`) → write
  `~/.config/godot/editor_settings-4.3.tres` with the **SDK path + debug
  keystore** → `godot --headless --path godot --import` → `godot --headless
  --path godot --export-debug "Android" …` → **apksigner signature gate**
  (fails the build unless v1+v2 signed; prints SHA-256) → upload Actions
  artifact (zip) → **publish the raw `.apk` to the GitHub Release** (tag
  `phase1-debug`, via `softprops/action-gh-release`).
- **Godot version:** 4.3-stable. **Android SDK:** platform-tools,
  build-tools;34.0.0, platforms;android-34 (installed fresh each run).
- **Export preset** (`godot/export_presets.cfg`, unchanged since it worked):
  non-gradle debug; **package `com.aletheia.phase1`**; version code 1 /
  name `0.1.0-phase1`; **ABI arm64-v8a only**; **minSdk 21, targetSdk 34,
  compileSdk 34**; immersive; **no permissions** (offline). Required project
  setting: `rendering/textures/vram_compression/import_etc2_astc=true`
  (Godot 4.3 fails Android export without it).
- **Signing:** debug keystore, **v1+v2+v3** (apksigner-verified). Note: the
  keystore is regenerated each build, so the signing cert changes per build
  — if reinstalling over a previous install fails with a signature
  mismatch, uninstall first. (A stable committed debug key is a possible
  future improvement.)
- **Release artifact:** tag **`phase1-debug`**, asset
  **`aletheia-phase1-debug.apk`**. Latest build = run #5, **APK SHA-256
  `6649f74a108348b6415828cc93113affc77592b3573e412980ce8d903dfbd447`**.

### Correct way to download / install (phone-only)
- **DOWNLOAD FROM RELEASES, NOT ARTIFACTS.** GitHub **Release** →
  `phase1-debug` → tap `aletheia-phase1-debug.apk` = the **raw APK**
  (no unzip). Open it, allow "install from unknown sources", install.
- The **Actions "Artifacts"** download (`aletheia-phase1-debug-apk`) is a
  **ZIP wrapper**; installing that zip causes "The file has a problem."
  Only use it if you extract the `.apk` first.

---

## 5. CANONICAL DOCUMENTS (read before modifying anything)

All at repo root unless noted. **Treat these as the source of truth.** If
code conflicts with a canonical design doc, **STOP and investigate — do not
silently change the design.**

| Document | Purpose |
|---|---|
| **MASTER_SESSION_HANDOFF.md** (this file) | Continuity: read first. |
| **DESIGN.md** | Game vision, player fantasy, gameplay loop, systems intent, tone, success criteria. The "what & why". |
| **ARCHITECTURE.md** | Folder structure, autoloads/signal-bus, interaction contract, NPC/logic-view split, save flow, data-flow diagram, technical success criteria. The "where & how". |
| **GAME_SYSTEMS.md** | Mechanical rules per system (time, weather, interaction, NPC/schedule, multi-axis relationships, dialogue graph, cooking quality, quests, inventory, stats, audio, save ownership table). |
| **MOBILE_FIRST.md** | **Primary-platform requirement** (Android/touch). Input abstraction, streaming, tiered NPC sim, perf/memory, app lifecycle, AI-API cost/offline. Takes precedence over PC-leaning phrasing elsewhere. |
| **MOBILE_ART_DIRECTION.md** | Mobile-first visual/technical-art authority: lighting, LOD, streaming, texture/shader budgets, performance tiers, "maximum atmosphere per GPU millisecond". |
| **ART_DIRECTION.md** | Original visual identity, material library, blockout→production pipeline. Defers to the two MOBILE_* docs where they conflict. |
| **DIALOGUE_DESIGN.md** | AI/LLM-powered hybrid dialogue architecture (engine authoritative, LLM validated). **Design only — implementation deferred to a later phase.** |
| **TECHNICAL_ROADMAP.md** | Phase plan (0–8), the 12-point MVP, the data-format decision (JSON + typed parsing), risk register. Phase 2 is BLOCKED at the top of this file until the human confirms. |
| **AI_RULES.md** | Operating contract for any contributor: read docs first, content-is-data, use existing interfaces, typed GDScript, honest status ladder, originality/licensing (never copy code or assets). |
| **VALIDATION.md** | The 5-level status ladder + how to run automated validation + what REQUIRES EXTERNAL DEVICE. |
| **ANDROID_BUILD.md** | Full build/install guide, the CI path (§0b), export-preset details, container limitations, troubleshooting. |
| **CHANGELOG.md** | Running log of every change, newest first. |
| **README.md** (repo root) | **Still the OLD MMORPG's README** — do not treat as current; rewritten at old-code retirement. |
| **godot/README.md** | The Godot project's own readme + controls + Phase-1/1b status. |
| **godot/ANDROID_VERIFICATION.md** | On-device checklist A–T (the ANDROID VERIFIED gate). |
| **godot/PHASE1_TEST_PLAN.md**, **godot/PHASE1B_TEST_PLAN.md** | Manual in-editor/on-device test plans for the core and mobile layers. |
| **reference_analysis/*.md** (8 files) | Study notes on 8 reference repos (architecture patterns only) with per-repo license + "do NOT copy" lists. |

---

## 6. DESIGN PRINCIPLES (permanent rules)

1. **Android-first; assume NO PC.** Touch controls are the primary input.
2. **Mobile performance is a first-class constraint** (target ~30–60 FPS on
   mid-range; battery/thermal aware; profile before optimizing).
3. **Originality is a hard boundary.** Never copy code, art, models,
   textures, audio, UI, maps, dialogue, characters, or scene compositions
   from any game or reference repo — not even MIT-licensed ones. Copyleft
   assets/code (GPL/CC-BY-SA/CC-BY-NC-SA) are avoided, not cleared. Prefer
   atmosphere/composition/lighting over brute-force geometry.
4. **Content is data, not code.** New NPCs/recipes/quests/dialogue/items are
   data under `godot/data/`, added with zero edits to core `src/` engine
   code. If a content addition seems to need core edits, that's an
   escalation, not a special-case branch.
5. **Preserve the existing architecture.** Reuse the one signal bus
   (`WorldEvents`), the one `Interactable` contract, the one input
   abstraction (`GameInput`), the save contract, the definition-vs-instance
   item split. No parallel mechanisms.
6. **Small, incremental, reversible changes.** No large rewrites of working
   systems.
7. **Data format:** JSON on disk + a strict typed-parsing layer (never raw
   `Dictionary` in gameplay). `ItemRegistry` is the reference implementation.
8. **Test after each meaningful milestone**, using the ladder.
9. **Never claim a feature is VERIFIED without real evidence.** Never claim
   ANDROID VERIFIED without a human on-device result. Use the honest labels.
10. **Single-player only** for now; no networking is assumed or built
    (the future LLM dialogue is the only planned network use).
11. **Typed GDScript** (`class_name`, typed vars/exports); avoid untyped
    `Variant`/duck-typing.
12. **Autoloads stay narrow;** cross-system side effects go through
    `WorldEvents`, never direct pokes into another system's internals.

---

## 7. DEVELOPMENT WORKFLOW (mandatory per session)

```
READ DOCUMENTATION (this handoff → canonical docs)
  → inspect the actual current code + git/branch state
  → understand dependencies (who calls what; which signals)
  → propose a plan (smallest safe change), get approval for anything large
  → implement the smallest safe, reversible change
  → run static validation      (tools/static_validate.py)
  → run automated tests         (tools/run_validation.sh — needs Godot;
                                 tools/fetch_godot.sh installs it)
  → build the Android APK        (push to the branch, or Run workflow)
  → download the RAW .apk from the GitHub Release, install on the phone
  → test on the real device      (godot/ANDROID_VERIFICATION.md as needed)
  → record the result honestly (update CHANGELOG.md + statuses)
  → continue
```

**When to BLOCK instead of guess:** if a change would contradict a
canonical doc; if the cause of a bug can't be determined without on-device
profiling; if a task needs the Android SDK/editor/device the AI doesn't
have (mark REQUIRES EXTERNAL DEVICE); if requirements are ambiguous or
would expand scope (e.g. starting Phase 2 without approval). Stop and ask.

---

## 8. CURRENT KNOWN LIMITATIONS (intentionally incomplete)

"Planned" ≠ "implemented." None of the following exist yet:

- **Inventory UI** (inventory *data* exists; no on-screen inventory panel). NOT IMPLEMENTED.
- **NPCs** (entities, schedules, navigation, AI). NOT IMPLEMENTED.
- **Dialogue runtime** (authored graph + LLM layer). NOT IMPLEMENTED (design only in DIALOGUE_DESIGN.md).
- **Cooking** (ingredients/recipes/stations/quality). NOT IMPLEMENTED.
- **Relationships / romance**. NOT IMPLEMENTED.
- **Quests**. NOT IMPLEMENTED.
- **LLM / AI-API integration** (providers, prompts, memory, fallback). NOT IMPLEMENTED (design only).
- **World-building / real locations** (only a code-built grey-box town + one interior exist). NOT IMPLEMENTED.
- **Real art / models / textures / UI theme**. NOT IMPLEMENTED (blockout primitives only).
- **Animation** (no AnimationPlayer/Tree anywhere). NOT IMPLEMENTED.
- **Audio** (music/SFX/ambience zones). NOT IMPLEMENTED.
- **Weather / day-night lighting profiles** (TimeManager exists and ticks; no lighting/weather reaction wired). NOT IMPLEMENTED.
- **World streaming / LOD / occlusion**. DEFERRED (synchronous region/location swap only).
- **Old MMORPG retirement** (delete root Node.js code, move `godot/`→root, rewrite root README). DEFERRED to its own dedicated commit.
- **Stable/committed debug signing key**; **per-frame camera interpolation for 120 fps**. DEFERRED.
- **Full A–T on-device pass** (only a subset of the checklist was reported PASS). Remaining items (save/load on device, lifecycle autosave, settings-persistence across restart, region↔interior transition, door open/close, safe-area on a notch, orientation change, long-session stability, measured FPS) are NOT yet ANDROID VERIFIED.

---

## 9. PHASE 2 STATUS

**Phase 1 + Phase 1b are complete and (core loop) ANDROID VERIFIED.
Phase 2 is NOT implemented and remains BLOCKED until the developer
approves starting it.**

**What Phase 2 is intended to accomplish** (per TECHNICAL_ROADMAP.md
"Phase 2 — World", reconciled with MOBILE_FIRST.md / MOBILE_ART_DIRECTION.md
— do not exceed this without approval): turn the grey-box slice into a
small, believable *place* —

- the MVP hub region + a few interiors as proper blockout → then a
  lighting + material pass (ART_DIRECTION.md §6 pipeline);
- `TimeManager` day/night wired to **lighting profiles** (time-of-day ×
  location-category), the mobile-first way (baked where possible, few
  dynamic lights, art-directed fog);
- a **weather foundation** (state + signal; light visual hookup).

**Explicitly NOT Phase 2:** the large open world, NPCs, cooking, quests,
dialogue, romance, inventory UI — those are later phases.

**Dependencies & recommended order (proposal, needs approval):**
1. **Housekeeping first (small, safe):** retire the old MMORPG code in one
   dedicated commit and decide whether to move `godot/`→repo root (update
   the CI `PROJECT_DIR`, paths, and root README accordingly). This removes a
   standing source of confusion before world work.
2. Confirm the full **A–T on-device checklist** passes (close the gaps in
   §8) so Phase 1 is fully, not partially, verified.
3. Then Phase 2 world/lighting, built as a vertical slice and validated on
   device at each step (blockout → lighting → judge → kit → dress).

Do not invent requirements that contradict the canonical docs. If Phase 2
seems to need an architecture change, raise it first.

---

## 10. NEXT SESSION RULES (explicit)

The next AI must:

1. **Read this MASTER HANDOFF first**, in full.
2. **Read all canonical documents** (§5) before modifying anything.
3. **Inspect the actual repository** (branch, HEAD, files) before assuming
   anything.
4. **Never assume a feature exists** because a plan mentions it — verify in
   code.
5. **Never claim ANDROID VERIFIED** without a fresh human on-device result.
6. **Never assume the developer has a PC.**
7. **Treat Android as the only development/test device.**
8. **Build Android APKs only via GitHub/cloud CI** (the container can't
   install the Android SDK). Deliver via the GitHub **Release** raw `.apk`.
9. **Never start large-scale implementation without an approved plan.**
10. **Never rewrite working architecture unnecessarily.**
11. **Keep changes incremental and reversible.**
12. **Preserve mobile performance** (touch UX, FPS, battery, memory).
13. **Preserve the existing design direction** (originality; mobile-first;
    atmosphere over geometry).
14. **Stop and ask / flag uncertainty rather than guessing** — especially
    where a real device or SDK is required (mark REQUIRES EXTERNAL DEVICE).
15. **Update documentation** (CHANGELOG + relevant canonical docs) after any
    meaningful architectural change; keep status labels honest.

---

## 11. FIRST TASK OF THE NEXT SESSION

Do **not** start coding immediately. In order:

1. Read this MASTER HANDOFF.
2. Read the canonical documents (§5).
3. Inspect repository state: `git -C <repo> status`, current branch
   (`claude/rpg-architecture-design-eut455`), `git log --oneline -10`,
   `find godot/src -name '*.gd'`, and skim `godot/project.godot`,
   `godot/export_presets.cfg`, `.github/workflows/android-build.yml`.
4. (Optional but recommended) run `tools/run_validation.sh` (it will
   `tools/fetch_godot.sh` if needed) to confirm the project still passes
   static + headless validation before touching anything.
5. **Summarize the current state back to the developer** (what's verified,
   what's incomplete) so both sides agree on the baseline.
6. **Identify the next milestone** (per §9: housekeeping / full A–T close /
   Phase 2 world), and **propose a concrete, minimal implementation plan.**
7. **Wait for the developer's approval** before any large implementation.
   Keep the phase gate: Phase 2 stays BLOCKED until they say go.

---

## 12. QUICK REFERENCE (facts to reuse)

- Repo: `HamHamm1/Game` · branch `claude/rpg-architecture-design-eut455` ·
  HEAD `5849017` · Godot project in `godot/`.
- Engine: Godot **4.3.stable**; Mobile renderer on Android.
- Package `com.aletheia.phase1` · arm64-v8a · minSdk 21 · targetSdk 34 ·
  debug-signed v1+v2+v3.
- CI: `.github/workflows/android-build.yml` (push to branch under `godot/**`
  or Run workflow). APK → GitHub **Release `phase1-debug`** asset
  `aletheia-phase1-debug.apk` (latest run #5, SHA-256
  `6649f74a108348b6415828cc93113affc77592b3573e412980ce8d903dfbd447`).
- Validate locally: `tools/run_validation.sh` (static + headless import +
  boot + 42 tests + export-config). Headless suite:
  `godot/tests/headless_test.gd`.
- Container limitation: **cannot** install Android SDK (`dl.google.com`
  403) → cloud CI only.

END OF MASTER SESSION HANDOFF
