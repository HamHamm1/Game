# ARCHITECTURE.md

> Status: **Foundational architecture document — Phase 0 (Research)
> deliverable.** Describes the *intended* technical shape of the project.
> No gameplay systems described here have been implemented yet (Phase 1
> begins after this document and DESIGN.md are accepted). Where this
> document says a folder or class "will" exist, it does not exist yet —
> read TECHNICAL_ROADMAP.md (a later deliverable) for the implementation
> order.

## 0. Originality & Provenance Rule

Every pattern below is our own implementation, informed by — never copied
from — the repositories analyzed in `reference_analysis/`. Where a pattern
below is directly inspired by a specific reference, the reference is
named inline so a future contributor can go read the rationale, not the
source. See DESIGN.md §8 for the summary table and AI_RULES.md for the
standing rule.

---

## 1. Engine & Target Versions

**Engine: Godot 4, GDScript, Forward+ renderer.**

Rationale: every relevant reference project we have access to (except two
intentionally-superseded Godot 3 tech demos, see below) already targets
Godot 4.3–4.7 with Forward+, and Godot 4's typed GDScript, `Resource`
system, `NavigationAgent3D`/`NavigationServer3D`, `SpringArm3D`, signals,
and `AnimationTree` state-machine tooling map directly onto every pattern
this document proposes (interaction contracts, NPC schedules, camera
rigs, animation façades). There is no reason to target Godot 3.

**Minimum/target version:** build against the newest stable **Godot 4.x**
release available at project start, and pin the exact `config/features`
version in `project.godot` once the project is initialized (do not leave
it ambiguous — every reference repo studied pins one explicitly). Do not
target a specific point release in this document; TECHNICAL_ROADMAP.md
records the actual pinned version once Phase 1 begins.

**Rendering:** Forward+ by default (matches `openacre`,
`godot-4-3d-characters`, `godot-demo-projects`, `gdquest-tps-demo`). GL
Compatibility is a fallback only if a target platform requires it (decide
in TECHNICAL_ROADMAP.md, not here).

**Superseded references:** `godot-open-world-demo` and
`3d-fpp-interaction-demo` are Godot 3.x. Their *concepts* (shadow-caster
proxy meshes; Yaw/Pitch camera split) are still valid and are folded into
this document; their *code* is not portable and was not used.

---

## 2. Top-Level Repository Layout

```
/
├── project.godot
├── DESIGN.md                  Game design — vision, systems, tone
├── ARCHITECTURE.md            This document
├── AI_RULES.md                Rules for any AI/human contributor
├── GAME_SYSTEMS.md            \
├── WORLD_DESIGN.md             |  Granular design docs
├── NPC_DESIGN.md                > (written in a later documentation
├── DIALOGUE_DESIGN.md          |   pass, once this foundation is
├── COOKING_DESIGN.md           |   accepted — see TECHNICAL_ROADMAP.md)
├── QUEST_DESIGN.md             |
├── ART_DIRECTION.md            |
├── AUDIO_DIRECTION.md         /
├── TECHNICAL_ROADMAP.md       Phase plan, MVP definition, task breakdown
├── CHANGELOG.md                Running log of architectural changes
├── reference_analysis/        Per-repo study notes (this Phase 0 pass)
│   ├── godot-open-rpg.md
│   ├── openacre.md
│   ├── 3d-fpp-interaction-demo.md
│   ├── gdquest-tps-demo.md
│   ├── godot-4-3d-characters.md
│   ├── godot-open-world-demo.md
│   ├── godot-demo-projects.md
│   └── skelerealms.md
│
├── src/                        Reusable, engine-agnostic-in-spirit
│   │                           GAME LOGIC classes (autoloads + core
│   │                           class_name scripts). Mirrors the
│   │                           code/content split learned from
│   │                           godot-open-rpg §src/.
│   ├── autoload/                Narrow, single-purpose autoload
│   │   ├── time_manager.gd        singletons (never one god-object —
│   │   ├── weather_manager.gd     see §5).
│   │   ├── world_events.gd        (pure signal bus)
│   │   ├── save_manager.gd
│   │   ├── item_registry.gd
│   │   ├── recipe_registry.gd
│   │   ├── quest_registry.gd
│   │   └── dialogue_registry.gd
│   ├── player/                  Player controller components (§4)
│   ├── interaction/              Interactable interface + concrete
│   │                              interactables (§6)
│   ├── npc/                     NPC entity, components, schedule
│   │                              runner, AI (§7)
│   ├── relationship/             Relationship state + event resolvers
│   ├── dialogue/                 Dialogue graph runtime
│   ├── cooking/                  Recipe/CookingProcess/Dish runtime
│   ├── inventory/                Item definition vs. instance runtime
│   ├── quest/                    Quest state machine runtime
│   └── save/                     Save/load serialization contracts
│
├── data/                       DATA, not code — see §9
│   ├── items/*.tres (or .json — decided in §9)
│   ├── recipes/*
│   ├── npcs/*
│   ├── schedules/*
│   ├── dialogue/*
│   ├── quests/*
│   ├── relationships/*          (per-NPC relationship curve config)
│   └── events/*
│
├── world/                      SCENE CONTENT — never one monolithic
│   │                           world scene (§3)
│   ├── world_root.tscn          Persistent root: player, camera,
│   │                            HUD, loaded-region container
│   ├── regions/
│   │   ├── town/
│   │   ├── residential/
│   │   ├── forest/
│   │   ├── river/
│   │   └── mystery_area/
│   ├── locations/
│   │   ├── player_home/
│   │   ├── restaurant/
│   │   ├── shop/
│   │   ├── workshop/
│   │   ├── bathhouse_landmark/
│   │   └── npc_houses/
│   └── interiors/
│
├── entities/                   NPC body/rig packages (one folder per
│                                NPC archetype — pattern from
│                                godot-4-3d-characters' per-character
│                                addon layout)
│
├── assets/                     Original art/audio only (see LICENSE
│                                rule in AI_RULES.md — no third-party
│                                assets from any studied reference)
│   ├── materials/
│   ├── models/
│   ├── textures/
│   ├── audio/
│   └── ui/
│
└── addons/                     Third-party addons we deliberately
                                 choose to depend on, evaluated one at a
                                 time in TECHNICAL_ROADMAP.md — empty
                                 until a specific need is justified.
```

This layout is the direct synthesis of three studied patterns: the
code/content split from `godot-open-rpg`, the data/logic/view three-way
split from `openacre`, and the per-archetype entity packaging from
`godot-4-3d-characters`.

---

## 3. World & Scene Architecture

**Rule: no single scene may contain "the whole world."** This is a hard
requirement, not a style preference — `godot-open-world-demo` is kept in
`reference_analysis/` specifically as a documented cautionary example of
what happens without it (one static mesh, nothing loads or unloads, no
NPCs, doesn't scale).

```
world_root.tscn  (persistent — never unloaded)
 ├── Player                       (see §4)
 ├── CameraRig                    (child of Player)
 ├── HUD / UI layer
 ├── RegionLoader (Node)          Instances/frees region sub-scenes
 │                                 based on player position + explicit
 │                                 region-transition triggers
 └── ActiveRegion (Node, mutable) Current region.tscn is instanced here
      └── region/town/town.tscn
           ├── Terrain / streets
           ├── Static props (batched where possible)
           ├── LocationEntryPoint × N   (door/threshold triggers that
           │                             ask RegionLoader/LocationLoader
           │                             to swap in an interior)
           ├── NPCSpawnPoint × N
           └── NavigationRegion3D      (baked per-region — pattern
                                         from godot-demo-projects'
                                         navigation_mesh_chunks/)
```

**Region vs. Location:** a *region* is an outdoor area (town, forest,
river); a *location* is an interior (a house, the restaurant, the
workshop). Both are separately loadable scenes. Entering a location swaps
it in as a child of `ActiveLocation` without unloading the region behind
it (so exiting is instant); crossing a region boundary swaps
`ActiveRegion` itself.

**MVP scope (Phase 1–2, see TECHNICAL_ROADMAP.md):** the loader above can
be implemented initially as simple synchronous
`PackedScene.instantiate()`/`queue_free()` calls — no streaming is
required until the world is larger than "one always-resident hub."
**Do not build OpenAcre-grade time-sliced chunk streaming for the MVP.**
The `RegionLoader`/`LocationLoader` interface should nonetheless be
written so that swapping the synchronous implementation for a threaded
one later (`ResourceLoader.load_threaded_request`, the pattern used by
`skelerealms`' `WorldLoader`) does not require changing any calling code
— i.e., design the seam now, fill it in only when profiling says to
(master-prompt §35: "อย่าทำ optimization ก่อนมี profiling").

**NPC persistence while off-screen** (needed as soon as schedules exist,
Phase 3): NPCs are logical entities first, visual puppets second — the
Logic/View separation documented in `reference_analysis/openacre.md`.
An NPC's schedule/needs/relationship state lives in a plain data object
owned by a registry (not by the scene tree), and is only given a visual
body (an instanced entity scene) while its region is loaded. This is also
the shape `skelerealms` calls Entities vs. Worlds, independently arriving
at the same split — see `reference_analysis/skelerealms.md`. Full
tiered simulation (FULL/GRANULAR/NONE, per `skelerealms`) is a
Phase 3+/polish concern, not MVP.

---

## 4. Player Controller

Modular, component-based — never one monolithic script. This directly
avoids the documented failure mode in `reference_analysis/
3d-fpp-interaction-demo.md` (a single ~365-line script mixing movement,
camera, inventory, interaction, and UI text) and directly follows the
"Player as orchestrator delegating to typed sibling components" pattern
observed independently in both `gdquest-tps-demo` and `godot-4-3d-
characters`.

```
Player (CharacterBody3D, class_name Player)
 ├── MovementController (Node, class_name PlayerMovement)
 │     walk / sprint / crouch / jump(if enabled) / interact-lock state.
 │     Movement "mode" is resolved fresh each physics frame from input +
 │     context (boolean/reference style, per gdquest-tps-demo's finding
 │     that stored enum state can go stale) rather than a heavyweight FSM
 │     — revisit only if the movement set grows enough to need one.
 ├── CameraRig (Node3D, class_name PlayerCamera)
 │     ├── Yaw (Node3D)            two-node mouse-look split, the one
 │     │    └── Pitch (Node3D)     concept worth keeping from
 │     │         └── Camera3D      3d-fpp-interaction-demo
 │     Independent, individually toggleable effect modules (never one
 │     hardcoded camera_process()):
 │       - head_bob.gd
 │       - breathing_sway.gd
 │       - footstep_camera_sync.gd
 │       - camera_collision.gd      (SpringArm3D-style clearance check,
 │                                    concept from gdquest-tps-demo,
 │                                    even though that demo is 3rd-person)
 │       - contextual_lean.gd        (peek/lean when near a wall/prompt)
 ├── InteractionController (Node, class_name PlayerInteraction)
 │     Forward raycast from camera center, checks the target against the
 │     typed Interactable contract (§6) — never has_method() duck-typing
 │     (explicit improvement over both openacre's and
 │     3d-fpp-interaction-demo's untyped approach, per their documented
 │     caveats).
 ├── CharacterSkin (Node, class_name PlayerSkin)
 │     Animation façade exposing intent verbs (idle/walk/sprint/crouch/
 │     sit/sleep/cook/interact-reach), never raw AnimationTree access to
 │     gameplay code — pattern independently confirmed by both
 │     gdquest-tps-demo (CharacterSkin) and godot-4-3d-characters
 │     (per-character _skin.gd).
 ├── Inventory (Node, class_name PlayerInventory)       — see §8
 ├── PlayerStats (Node, class_name PlayerStats)          hunger/energy/
 │                                                        money/skills
 ├── FootstepAudio (Node)
 └── PlayerUIBridge (Node)         Emits signals only; UI listens, never
                                    polls (pattern from gdquest-tps-demo).
```

**Explicit rule:** `Player.gd` itself must never grow per-object-type
interaction logic, per-NPC dialogue logic, or per-recipe cooking logic.
If a change to Player.gd is required to add a new interactable/recipe/
NPC type, that is an architecture violation — see AI_RULES.md.

---

## 5. Autoload / Signal-Bus Architecture

**Rule: many narrow autoloads, never one `GameManager` god-object.**
Directly confirmed as the right shape by *two independent* references
(`godot-open-rpg`'s `FieldEvents`/`CombatEvents`/`Gameboard`/
`GamepieceRegistry`/`Camera`/`Music`/`Transition` split, and `openacre`'s
5-autoload minimal surface: `GameManager`, `EventBus`, `ItemRegistry`,
`EntityRegistry`, `SaveManager`).

Planned autoloads for this project (final list confirmed in
TECHNICAL_ROADMAP.md as systems are actually built):

| Autoload | Responsibility | Holds state? |
|---|---|---|
| `WorldEvents` | Pure signal bus — the only cross-system communication channel for gameplay events (time changed, weather changed, region entered, relationship changed, quest state changed, dialogue started/ended, item given, dish cooked, …) | No |
| `TimeManager` | Current day/time-of-day block; advances the clock; emits on `WorldEvents` | Yes (current time) |
| `WeatherManager` | Current weather state; emits on `WorldEvents` | Yes (current weather) |
| `ItemRegistry` | Loads item *definitions* from `data/items/`; item instance factory | Yes (definition cache) |
| `RecipeRegistry` | Loads recipe definitions from `data/recipes/` | Yes (definition cache) |
| `QuestRegistry` | Loads quest definitions; tracks active/completed quest *state* | Yes (quest state) |
| `DialogueRegistry` | Loads dialogue graphs from `data/dialogue/` | Yes (definition cache) |
| `NPCDirectory` | Registry of all NPC logical entities (loaded or not) — the Logic-layer half of §3's Logic/View split | Yes (NPC state) |
| `SaveManager` | Serializes/deserializes every other autoload + the player + `NPCDirectory` (see §11) | No persistent state of its own |

Systems talk to each other **only** through `WorldEvents` signals or by
reading another registry's public query methods — never by reaching into
another system's private state, and never by the Player node holding
direct references to NPC internals or vice versa. This is what makes
"add an NPC / recipe / quest without touching core code" (DESIGN.md §7)
actually true rather than aspirational.

---

## 6. Interaction System

A single shared contract, informed by three independent references
(`godot-open-rpg`'s `Interaction`/`Cutscene` base class,
`3d-fpp-interaction-demo`'s forward-raycast targeting, `openacre`'s
duck-typed `interact()`/`get_interaction_prompt()` convention) — but
implemented as a real typed interface rather than duck-typing, per the
caveat both `openacre.md` and `3d-fpp-interaction-demo.md` explicitly
flag:

```gdscript
# src/interaction/interactable.gd
class_name Interactable
extends Node

func can_interact(player: Player) -> bool:
    return true

func get_interaction_prompt(player: Player) -> String:
    return ""

func interact(player: Player) -> void:
    pass

func get_interaction_priority() -> int:
    return 0
```

Concrete interactables (`Door`, `NPCInteractable`, `Chair`, `Kitchen
Station`, `Chest`, `Plant`, `PickupItem`, `Bed`) extend `Interactable` and
override only what differs — mirroring the polymorphic-`_execute()`
shape of `godot-open-rpg`'s `Interaction` subclasses, adapted from 2D
proximity/Area detection to first-person camera-raycast targeting (the
approach used by `openacre` and `3d-fpp-interaction-demo`).
`PlayerInteraction` (§4) is the only script that ever calls these methods;
it holds no per-type branching.

---

## 7. NPC Architecture

```
NPC entity (logical, owned by NPCDirectory — exists whether or not
            visually loaded, per §3)
 ├── Identity          (data: name, role, portrait ref, ...)
 ├── Stats
 ├── Needs
 ├── Schedule           data-driven: ordered list of
 │                        {time, location_id, activity} entries
 │                        (closest real-world reference:
 │                        skelerealms' Schedule/ScheduleEvent/
 │                        ScheduleCondition — see
 │                        reference_analysis/skelerealms.md — scoped
 │                        down; we do not need GOAP-grade planning for
 │                        a conversation/cooking-focused life-sim NPC)
 ├── Relationship       multi-dimensional state (DESIGN.md §4.3)
 ├── Dialogue           reference into data/dialogue/
 ├── Quest ties
 ├── Inventory
 ├── Memory             log of past interaction events, queryable by
 │                        dialogue conditions
 └── EventReactions     subscribes to WorldEvents

NPC visual puppet (only instanced while the NPC's region is loaded)
 ├── Navigation (NavigationAgent3D)   pattern from godot-demo-projects'
 │                                     3d/navigation/: get_next_path_
 │                                     position() → move_toward() →
 │                                     upright-clamped look_at()
 ├── CharacterSkin                    same animation-façade pattern as
 │                                     the player (§4), verb-based API
 │                                     over an AnimationTree
 └── Interactable (NPCInteractable)   see §6 — talk prompt
```

**Schedule runner:** a per-NPC (or shared, batched) process compares
`TimeManager`'s current time block against the NPC's schedule data and
issues a "go to `location_id`, do `activity`" instruction to the visual
puppet's `NavigationAgent3D` when loaded, or updates the logical entity's
recorded location directly when not loaded (no puppet to move) — this is
the concrete mechanism behind "NPCs live their lives whether or not the
player is watching" (master-prompt §12, DESIGN.md §1).

**Explicit non-goal for MVP:** full GOAP planning, perception/stealth
FSMs, and tiered tick-rate simulation (all present in `skelerealms`) are
**not** required for a life-sim whose NPCs mostly cook, chat, and follow
a fixed daily schedule. They are noted here as a scaling path (§3's
"tiered simulation" note) only if profiling later shows a need, not as a
Phase 3 deliverable.

---

## 8. Data-Driven Systems (Inventory, Cooking, Quests, Dialogue)

All content data lives under `data/`, never embedded in scripts:

- **Item definitions vs. instances**: `ItemRegistry` loads static
  definitions (name, stack size, category, base value, tags); a
  `PlayerInventory`/`Chest` holds *instances* (definition ref + mutable
  state such as quantity, freshness for ingredients, or unique-item
  overrides).
- **Recipes**: `Ingredient[] + required_station + cook_time + difficulty
  → Dish`, resolved by a `CookingProcess` runtime class that computes a
  quality tier from ingredient quality + timing input + player skill +
  equipment (DESIGN.md §4.5).
- **Quests**: definitions carry conditions/objectives/rewards/
  consequences as data; `QuestRegistry` owns the *runtime* state machine
  (Locked/Available/Active/Completed/Failed) per quest instance.
- **Dialogue**: a branching graph resource per NPC/conversation, with
  condition nodes evaluated against `Relationship`, `QuestRegistry`,
  `TimeManager`, current location, and event flags. (Whether this is
  authored as custom Godot `Resource`/`.tres` files, following
  `godot-open-rpg`'s data-driven-`Resource` pattern for combat data, or as
  schema-validated JSON, following `openacre`'s `EntityRegistry` JSON
  approach, is a concrete Phase 1 decision — see §9 below. Either choice
  satisfies the "add content without touching engine code" requirement;
  neither is dictated by this document.)

---

## 9. Data Format Decision (Resources vs. JSON) — Open Question

Two valid patterns were found in the reference study, and this document
deliberately does **not** pick one yet, since it's a Phase 1 decision best
made once the actual authoring/tooling needs (e.g. hot-reloading NPC
data at runtime, per the old MMORPG's admin-panel hot-reload feature
which is worth preserving as a *capability*, not as legacy code) are
scoped in TECHNICAL_ROADMAP.md:

- **Custom `Resource` subclasses (`.tres`)** — `godot-open-rpg`'s
  approach for combat data. Pro: native editor integration, type safety,
  no custom parser. Con: less trivial to hot-reload/hand-edit outside the
  Godot editor.
- **Schema-driven JSON**, parsed into typed data classes by a registry —
  `openacre`'s `EntityRegistry` approach. Pro: easy external tooling,
  hot-reload, and diffing; matches the old MMORPG's proven
  `content/*.json` + hot-reload admin workflow the team already likes.
  Con: no compile-time safety, needs a validation layer (openacre's own
  documented caveat: untyped `Variant`/duck-typing risk — see
  `reference_analysis/openacre.md`).

Recommendation to revisit in TECHNICAL_ROADMAP.md: **JSON with a strict
typed-parsing layer** (typed data classes constructed from validated JSON,
not raw `Dictionary` passed around) captures the hot-reload/tooling
benefit the team has already validated works for this kind of content
(per the old MMORPG's admin panel) while avoiding openacre's
documented untyped-`Variant` pitfall. This is a recommendation, not a
final decision — record the actual choice and rationale in
TECHNICAL_ROADMAP.md when Phase 1 starts.

> **RESOLVED (TECHNICAL_ROADMAP.md §2.1):** JSON with a strict
> typed-parsing layer — content data is JSON on disk, loaded through a
> registry that constructs validated, typed data classes (never raw
> `Dictionary` in gameplay code). Godot `Resource`/`.tres` remains the
> tool for engine-facing assets (materials, scenes, animation libraries),
> not game content data. `data/` therefore uses `.json`.

---

## 10. Time, Weather, Lighting Zones

`TimeManager` owns a single authoritative clock (day count + time-of-day
block: Night/Morning/Afternoon/Evening/Night, per DESIGN.md §4.6) and
emits on `WorldEvents` whenever the block changes. Every subscriber reacts
independently — `WeatherManager` may pick a new weather state on a day
boundary, a `RegionLightingController` (one per loaded region) swaps its
`WorldEnvironment`/light-energy targets toward the current
time-of-day × location-category (safe/mystery) lighting profile (DESIGN.md
§2), `NPCDirectory` triggers schedule re-evaluation, shops open/close.
No system polls `TimeManager` every frame; everything is signal-driven.

Here "location-category" is a **lighting-profile tag on a spectrum whose
default is the beautiful, readable, peaceful village look**; "mystery" is
an *occasional, local* profile applied to a minority of spaces, not a
global horror mode. The category set is expected to broaden (e.g.
residential / commercial / natural / water / landmark / threshold) when
M2.2 lighting is designed; the signal-driven `RegionLightingController`
mechanism itself is unchanged. (Naming of code symbols is an M2.2 design
decision — deliberately not changed here.)

---

## 11. Save/Load Architecture

Designed from Phase 1, not appended later (master-prompt §23/§38).
`SaveManager` does not own game state itself — it asks every other
autoload (and the player, and `NPCDirectory`) for a serializable snapshot
via a shared contract:

```gdscript
# implemented by every autoload/system that has persistent state
func get_save_data() -> Dictionary: ...
func load_save_data(data: Dictionary) -> void: ...
```

`SaveManager` assembles these into one versioned save file (a version
field from day one, so future field additions don't break old saves —
this is the concrete mechanism behind DESIGN.md §7's "a new save-able
field can be added without rewriting the save system"). Must round-trip
everything listed in DESIGN.md §4.6: player position/inventory/money/
stats, relationship values, quest states, dialogue flags, world flags,
NPC states (including off-screen/logical-only NPCs, per §3/§7), time,
weather, discovered locations, known recipes, unlocked content.

---

## 12. Communication / Data Flow Diagram

```
                     ┌───────────────┐
                     │  WorldEvents  │  (pure signal bus)
                     └───────▲───────┘
        emits/listens        │ emits/listens
   ┌─────────┬────────┬──────┼──────┬─────────┬───────────┐
   │         │        │      │      │         │           │
┌──▼──┐  ┌───▼───┐ ┌──▼───┐┌─▼───┐┌─▼──────┐┌─▼────────┐┌─▼─────────┐
│Player│ │NPCDir. │ │Time  ││Wthr ││Quest   ││Dialogue  ││ItemRecipe │
│      │ │ectory  │ │Mgr   ││Mgr  ││Registry││Registry  ││Registries │
└──┬───┘  └───┬────┘ └──────┘└─────┘└────────┘└──────────┘└───────────┘
   │          │
   │  reads   │  reads/spawns puppet
   ▼          ▼
World scenes (regions/locations) — instanced/freed by RegionLoader/
LocationLoader, never all resident at once (§3)

SaveManager ──(pulls get_save_data() from every box above)──> save file
```

No arrow in this diagram may become a direct method call between two
gameplay systems that bypasses `WorldEvents` for cross-cutting concerns
(a quest reacting to a relationship change, an NPC reacting to weather,
etc.) — direct calls are reserved for a system querying its own
registry's data (e.g. dialogue conditions reading `Relationship` state),
not for triggering side effects in another system.

---

## 13. Success Criteria (Technical)

Mirrors DESIGN.md §7. This architecture is validated once:

1. A new NPC ships as a `data/npcs/*` entry + a schedule file + an entity
   package under `entities/`, with zero edits to `src/npc/`.
2. A new recipe ships as a `data/recipes/*` entry, zero edits to
   `src/cooking/`.
3. A new quest ships as a `data/quests/*` entry, zero edits to
   `src/quest/`.
4. A new location ships as a scene under `world/locations/` plus one
   `LocationEntryPoint` in its parent region, zero edits to the
   `RegionLoader`/`LocationLoader` core.
5. A new dialogue branch ships as a `data/dialogue/*` edit, zero edits to
   `src/npc/` or `src/dialogue/`.
6. A new persistent field ships as one new key in some system's
   `get_save_data()`/`load_save_data()`, with `SaveManager`'s own code
   unchanged.
7. `reference_analysis/` + this document + DESIGN.md are sufficient for a
   new AI agent or developer to correctly predict where a given new
   feature's code and data should live, without reading the rest of the
   codebase first.

---

## 14. Explicit Non-Goals for the Foundation Phase

To keep Phase 0/1 honest about scope (master-prompt §41 MVP rule, §38
"don't fake completion"):

- No multiplayer/networking (the old MMORPG had a WebSocket server; the
  new project is **single-player only** unless a future design doc
  explicitly revisits this — nothing in this architecture assumes or
  blocks networking, but nothing is built for it either).
- No terrain/chunk streaming beyond synchronous region/location swapping
  until profiling justifies it (§3).
- No GOAP/perception-FSM-grade NPC AI (§7).
- No farming, fishing, or combat systems at the architecture level yet —
  DESIGN.md §1 lists them as future scope; this document leaves their
  systems undesigned rather than guessing prematurely.
