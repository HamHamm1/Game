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
