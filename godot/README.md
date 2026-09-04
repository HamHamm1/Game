# Project Aletheia — Godot 4 project (Phase 1 Foundation)

This directory is the **new** game: an original first-person open-world
life-sim RPG built in Godot 4, per the design docs at the repository root
(`DESIGN.md`, `ARCHITECTURE.md`, `AI_RULES.md`, `GAME_SYSTEMS.md`,
`ART_DIRECTION.md`, `DIALOGUE_DESIGN.md`, `TECHNICAL_ROADMAP.md`).

## Why is it in a `godot/` subdirectory?

The repository root still contains the **retired** Spirit World MMORPG
(Node.js / WebSocket / Canvas). Per DESIGN.md §0 the new codebase must
never be silently mixed with the old one, and the root has colliding
`src/` and `data/` directories plus a `.gitignore` (`data/*.json`) that
would swallow our content data. So Phase 1 lives cleanly under `godot/`.

When the foundation is validated in-editor, a single dedicated
**retirement commit** (TECHNICAL_ROADMAP.md §2.4) deletes the old JS code,
moves `godot/*` to the repository root, and rewrites the root `README.md`.
Until then, this stays self-contained here.

## How to open / run

1. Open **Godot 4** (a recent stable 4.x — this project pins a conservative
   `4.3` floor in `project.godot`; opening in a newer 4.x will upgrade it.
   Bump `config/features` to your installed version).
2. Import `godot/project.godot`.
3. Press **Play** (`main.tscn` is the main scene).

> **Status: `STATICALLY VALIDATED` + `HEADLESS TESTED`** (Godot 4.3
> headless, in this container — see `VALIDATION.md`). The project imports
> with no script errors, the main scene boots clean, and the logic test
> suite passes **42/42** (`tests/headless_test.gd`). **Not yet `RUNTIME
> TESTED` or `ANDROID VERIFIED`** — real input/physics/rendering and all
> mobile performance require the editor or a device (the checklists below,
> `PHASE1_TEST_PLAN.md` / `PHASE1B_TEST_PLAN.md`). Run the automated gates
> with `tools/run_validation.sh`.

## Controls

**Desktop (development):**

| Action | Key |
|---|---|
| Move | `W A S D` / arrows |
| Sprint | `Shift` |
| Crouch | `Ctrl` |
| Jump | `Space` |
| Interact | `E` |
| Pause / Settings menu | `Esc` (frees the cursor while open) |
| Quicksave | `F5` |
| Quickload | `F9` |

**Touch (mobile — primary platform):** virtual joystick (bottom-left) to
move; drag elsewhere to look; SPRINT/CROUCH/JUMP buttons (bottom-right); a
contextual interact button that appears only near a target and shows the
action (`PICK UP`, `OPEN`, `ENTER`, …); ☰ menu button (top-right) for
pause/settings. All input flows through one abstraction layer (`GameInput`),
so keyboard/mouse and touch are co-equal (MOBILE_FIRST.md §13).

> **Preview touch on desktop:** press `Esc` → tick **"Touch controls
> (preview)"** → Resume. The touch HUD appears and the mouse acts as a
> finger. This previews touch logic but is not proof of Android behavior.

## Phase 1 manual test checklist (the foundation deliverable)

Maps to TECHNICAL_ROADMAP.md §3's MVP loop points 1–3, 7, 12. Tick these
in-editor; anything that half-works is `PARTIALLY IMPLEMENTED`, not done.

- [ ] Walk/sprint/crouch/jump around the blockout region; first-person
      camera looks with the mouse; head-bob while walking.
- [ ] Look at a pickup → prompt shows; press `E` → item enters inventory
      (HUD item count rises); the object disappears.
- [ ] Look at the freestanding door → press `E` → it opens/closes.
- [ ] Look at the house doorway → press `E` → interior loads and you are
      placed inside; pick up the egg; look at the exit → press `E` → you
      return outside where you entered.
- [ ] Watch the HUD clock advance (Day / time / block).
- [ ] `F5` to save, move/pick up more, `F9` to load → position, camera
      orientation, inventory count, and time all revert to the saved state.

## Phase 1b — Mobile Foundation (`IMPLEMENTED`, not yet `TESTED`/`VERIFIED`)

Added on top of the core (MOBILE_FIRST.md). State legend: `IMPLEMENTED` =
code exists + reviewed · `TESTED` = tried in target env · `VERIFIED` =
confirmed by its test. **Everything below is `IMPLEMENTED` only** — see
`PHASE1B_TEST_PLAN.md` (M1–M10).

- **Input abstraction** (`GameInput`): gameplay reads abstract actions;
  keyboard/mouse and touch both feed them. Keyboard/mouse gameplay is
  unchanged.
- **Touch movement/camera**: dynamic virtual joystick (dead-zone,
  camera-relative), look-drag area (no accidental look while touching UI).
- **Contextual interact button**: shows only on a valid target, with the
  action verb.
- **Mobile HUD**: joystick + action buttons + interact + menu, safe-area
  inset, center kept clear.
- **Settings** (`Settings`, persisted to `user://settings.json`): graphics
  preset, look sensitivity X/Y, FOV, camera smoothing, head-bob strength,
  camera-shake strength (stored; no shake system yet).
- **Graphics presets** (`GraphicsManager`): LOW/MEDIUM/HIGH/ULTRA driving
  shadows, shadow/view distance, fog, glow, SSAO, 3D resolution scale, MSAA.
- **App lifecycle** (`AppLifecycle`): pause/resume/focus/close → forced
  autosave.
- **Autosave** (`AutosaveManager`): on location transitions, inventory
  changes, and a periodic interval — debounced, never every frame.
- **Android project settings**: Mobile renderer override, expand-aspect
  stretch, sensor orientation, touch emulation for desktop preview.

> **Mobile performance is `UNVERIFIED`** until run on a real Android device
> (M10). PC preview is not proof (MOBILE_FIRST.md §25).

## Structure (mirrors ARCHITECTURE.md §2, rooted here for now)

```
godot/
  project.godot          autoloads, main scene, Forward+
  main.tscn              → src/world/world_root.gd (persistent root)
  src/
    autoload/            world_events, save_manager, item_registry, time_manager
    data/                item_definition, item_instance (typed data classes)
    player/              player + movement/camera/interaction/inventory components
      camera_effects/    head_bob (toggleable effect-module seam)
    interaction/         interactable base + door, pickup_item, entry/exit points
    world/               region_loader, location_loader, blockout_util, world_root
      regions/           blockout_town (.gd + .tscn)
      locations/         blockout_interior (.gd + .tscn)
    ui/                  hud (placeholder)
  data/
    items/               fish / rice / egg (JSON — the data pattern reference)
```

## What is NOT here yet (honest scope)

Per TECHNICAL_ROADMAP.md this is Phase 1 only. No NPCs, dialogue, cooking,
quests, relationships, weather, or real art — those are later phases. The
LLM dialogue system (DIALOGUE_DESIGN.md) is Phase 3+ and deliberately
unimplemented. Automated tests are `NOT IMPLEMENTED` (no test harness yet);
the checklist above is the current in-editor verification.
