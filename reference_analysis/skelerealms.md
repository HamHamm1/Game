# Reference Analysis — Skelerealms

- **Source:** `hamhamm1/skelerealms` (upstream: SlashScreen/skelerealms)
- **Purpose:** the single most architecturally relevant reference. A
  low-level **systems framework** for Godot 4, explicitly modeled on
  Bethesda's Creation Engine (Skyrim/Fallout-style open-world RPGs),
  covering cross-scene persistence, inter-scene navigation, GOAP-based NPC
  AI, schedules, factions, loot/inventory/equipment, bartering, crime, and
  spells/status effects. It **explicitly excludes** gameplay, terrain,
  LOD/chunk streaming, UI, dialogue, quests, and combat — it is a
  substrate to design *against* (learn from), not a dependency to import
  wholesale, and it is beta software (0.6) with self-documented rough
  edges (see Caveats).
- **Engine:** Godot 4 addon (`plugin.cfg`), no bundled demo project.
- **License:** `LICENSE` at repo root is **MIT** (© 2024 Slashscreen) —
  code is fully permissive to reference/adapt conceptually. No separate
  art-asset license found (the addon ships essentially no art), so no
  CC/NC concerns.

## Core architecture (a pseudo-ECS layered on Godot's node tree)

Three documented concepts (`docs/concepts/`):

- **Entities** (`SKEntity`, `scripts/entities/entity.gd`) — anything
  needing cross-scene persistence (Creation Engine's "Actors"). An entity
  is a node tree rooted at `SKEntity`, tracked by a central
  `SKEntityManager` singleton. Tracks `world`, `position`, `rotation`,
  `unique`, and an `in_scene` bool firing `entered_scene`/`left_scene`
  signals — the mechanism letting objects "exist" while their scene isn't
  loaded. A `stale_timer` counts up while out-of-scene so the manager can
  eventually garbage-collect unreferenced entities after a save.
- **Worlds** (Creation Engine's "Cells") — a scene becomes a World simply
  by its root node's name matching the world ID, under a configured
  `worlds_path` (default `res://worlds`). `WorldLoader`
  (`scripts/system/world_loader.gd`) manages threaded loading/unloading
  via `ResourceLoader.load_threaded_request`, with
  `begin_world_loading`/`world_loading_ready`/`load_scene_progress_updated`
  signals for a loading-screen UX. **This is whole-scene swapping, not
  seamless streaming/chunking** — confirms the framework deliberately does
  not solve terrain/chunk streaming (that's on us, informed instead by
  `openacre.md`'s UESS pattern).
- **Components** (`SKEntityComponent`, `scripts/components/`) — ~22
  built-in components (Attributes, Inventory, Equipment, GOAP, NPC,
  Player, Navigator, Vitals, Skills, Covens/factions, Interactive,
  Damageable, Effects, Chest, Shop, Teleport, PuppetSpawner, …), each a
  node attachable under an entity, discovered by class name via
  `get_component()` (name-based lookup, since GDScript lacks generics).
  Components declare dependencies (in-editor warning if missing) and
  expose virtual hooks for generation/spawn/despawn/save/load/debug.

## NPC AI stack (the most valuable part of this reference)

Two decoupled layers on `NPCComponent`:
- **AI Modules** (`scripts/ai/Modules/`, base `AIModule`) decide *what* an
  NPC wants (goal selection), reacting to NPC signals — e.g.
  `default_threat_response.gd`, `default_movement.gd`,
  `default_stealth_detection.gd`, `default_crime_report.gd`.
- **GOAP Actions** (`scripts/ai/goap_action.gd`, under a `GOAPComponent`)
  decide *how*: each action declares `get_prerequisites()`/
  `get_effects()` for planning, then runs a
  `pre_perform() → target_reached() → post_perform()` lifecycle with an
  `interrupt()` hook for replanning; `GOAPComponent`'s planner attempts to
  build a plan every frame it lacks one.
- A separate **Perception FSM** (`scripts/ai/PerceptionFSM/`: unaware →
  aware_visible/aware_invisible → lost) plus `perception_eyes.gd` /
  `perception_ears.gd` and a `light_estimation_provider.gd` handle
  stealth/sight detection, feeding threat-response AI Modules.
- **Schedules** (`scripts/schedules/`: `Schedule`, `ScheduleEvent`,
  `ScheduleCondition`, `SandboxSchedule` for idle "milling about")
  attach under `NPCComponent`, gating behavior by time-of-day windows plus
  arbitrary conditions — directly analogous to Creation Engine's AI
  Packages and to **our own DESIGN.md §4.2 data-driven NPC schedule
  requirement**. This is the closest existing reference to what our
  NPC-schedule system needs to become.
- A documented **3-tier NPC simulation level (FULL / GRANULAR / NONE)**
  scales AI cost with distance from the player — directly relevant to a
  life-sim with a full town of scheduled NPCs; we should adopt an
  equivalent tiering rather than fully simulating every NPC at all times.

## Inter-scene navigation
A custom **Granular Navigation System** (`scripts/granular_navigation/`:
`NavMaster` singleton, `NavWorld`, `NavNode`, `NavPoint`) — a
low-resolution, hand-authored graph (not a navmesh) per world, so
off-screen NPCs can keep "walking" toward destinations across unloaded
scenes; `navigation_master.gd` runs an A*-style search (open/closed
lists, g/f scores) over this graph. Explicitly a performance-driven
simplification with a configurable sim-distance cutoff. The docs
(`navigation.md`) admit this area is WIP/partially reworked.

## Good patterns to adopt conceptually
- Entity/Component separation with explicit in-scene vs.
  persisted-out-of-scene state, and a stale-timer GC for out-of-scene
  entities — pairs naturally with OpenAcre's Logic/View split
  (`openacre.md`) for our own NPC persistence.
- Decoupling "what to do" (goal selection) from "how to do it" (GOAP
  planning/execution) for NPC behavior.
- Time-gated + conditioned Schedules for NPC routines — this is the
  closest available real-world reference for our own data-driven NPC
  schedule requirement (DESIGN.md §4.2, master-prompt §12).
- Tiered NPC simulation LOD (FULL/GRANULAR/NONE) for crowd scalability.
- A dedicated coarse graph for cross-cell/off-screen pathfinding instead
  of relying on live navmeshes everywhere a schedule-driven NPC might
  need to walk.

## Caveats / what NOT to port verbatim
- Docs candidly flag unfinished areas: the save system "needs to be
  rethought," navigation is memory-inefficient and may be rewritten,
  `navigation.md` is literally marked "TODO," and `NavigatorComponent` is
  noted as possibly broken.
- Some code shows rough edges (typos in comments, commented-out dead code
  in `entity_manager.gd`, `_init()` calling `_entity_ready()` on children
  before they're actually in the tree) — scrutinize, don't mirror
  uncritically.
- As a solo-developer beta (0.6) project with "breaking changes can and
  will happen often" per its own README, treat this as a **conceptual**
  reference for our NPC/schedule/entity-persistence architecture, not a
  dependency to add to our project or a pattern to copy line-for-line.

## Reusable concepts for our project
1. Model our NPC schedule system's shape (time-windowed
   `ScheduleEvent`/`ScheduleCondition` entries) after this framework's
   Schedule concept, married to plain data (JSON/Resource) per
   DESIGN.md §4.2 — never hard-coded branching in NPC scripts.
2. Split NPC "goal selection" from "action execution" the way AI
   Modules/GOAP Actions do here, scoped down to what our life-sim actually
   needs (we do not need full GOAP/combat-grade AI planning for a
   cooking/relationship/conversation-focused NPC).
3. Adopt a simulation-tier concept (full detail near the player, coarse
   simulation far away, none beyond a cutoff) for NPC schedules once more
   than a handful of NPCs exist in the hub.
4. Entity persistence pattern (in-scene/out-of-scene signals + eventual
   cleanup) as one input, alongside OpenAcre's Logic/View split, when we
   design how NPCs keep "existing" (advancing their schedule) while their
   location isn't currently loaded.
