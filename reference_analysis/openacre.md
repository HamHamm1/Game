# Reference Analysis — OpenAcre

- **Source:** `hamhamm1/openacre` (upstream: OpenAcre-Project/OpenAcre)
- **Purpose:** a hardcore, systems-first agricultural life-simulator with
  dual-view (2D map / 3D first-third-person) gameplay, vehicle physics, and
  a documented background-simulation architecture ("Universal Entity
  Streaming System", UESS). Genre-adjacent to us (life-sim, first/third
  person), even though the subject matter (farming/vehicles) differs.
- **Engine:** Godot **4.6**, Forward+ renderer.
- **License — ⚠️ COPYLEFT, do not copy code or assets:**
  - All code (`Scripts/`, `Scenes/`, `Singletons/`, `Data/`, modified
    `addons/`) is **GPLv3**. Server/backend code is AGPLv3.
  - All art/audio/models (`Assets/`) are **CC BY-SA 4.0**.
  - Both are copyleft/share-alike licenses: using this code or these
    assets in our project — even partially — would legally obligate our
    project to adopt GPLv3 (code) or CC BY-SA 4.0 share-alike terms
    (assets). **We do not want that.** This repo is studied for
    architecture ideas only; every line of our implementation must be
    independently written.

## Structure
- `Scripts/simulation/` — pure data/logic: `components/`, `core/`,
  `systems/`, `resources/` (the headless "Logic Layer").
- `Scripts/streaming/` — chunk streaming (`StreamSpooler`, `CatchUpEngine`).
- `Scripts/views/` — 3D scene-tree "puppet" layer (`EntityView3D`,
  `Vehicle3D`, `Implement3D`) that renders logic-layer data.
- `Scripts/core/`, `world/`, `farm/`, `vehicles/`, `interactables/`,
  `player/`, `camera/`, `ui/`, `debug/`, `tests/`.
- `Singletons/` — only **3** autoload scripts (see below).
- `Data/Entities/*.json` — data-driven entity definitions.
- `docs/` — an mkdocs architecture site (`docs/architecture/*.md`) —
  itself a good example of "documentation as part of the repo," worth
  emulating structurally (not content) for our own docs.

## Architecture patterns
- **Logic/Visual separation ("Data/View split")**: an authoritative
  headless Logic Layer (`EntityManager`, `EntityData`, `PlayerData`,
  `CatchUpEngine`, `StreamSpooler`) is fully decoupled from a disposable
  Visual Layer (`EntityView3D`/`Vehicle3D`/`Implement3D` scene-tree nodes),
  connected only through one-directional sync contracts
  (`apply_data()` reads logic → view, `extract_data()` writes view → logic,
  and view code must call `EntityManager.update_entity_transform()` rather
  than mutate components directly). This is effectively an ECS-lite layered
  onto Godot's node tree, and it is the single most valuable architectural
  idea in this repo for us: it is exactly the discipline that lets a world
  keep simulating (NPC schedules, crop/food state, weather effects)
  whether or not the relevant scene is currently loaded.
- **Minimal autoload surface**: only `GameManager` (session), `EventBus`
  (pure signal bus, ~15 signals grouped by concern), `ItemRegistry`,
  `EntityRegistry` (JSON-driven entity factories), `SaveManager`. Confirms
  the "few narrow autoloads, not one god object" lesson from
  godot-open-rpg.
- **Time-sliced chunk streaming**: `StreamSpooler` polls player position
  and loads/unloads entities against explicit **microsecond time budgets**
  per frame to avoid stutter; a `CatchUpEngine` fast-forwards elapsed
  simulated time (e.g. decay, growth) when an entity re-enters range
  instead of simulating it every frame while off-screen; `StreamingGroup`
  IDs keep composite/linked objects (e.g. a towed vehicle chain) loading
  and unloading atomically together.
- **Dual-view switching is a simple container-visibility toggle**, not a
  complex scene-swap state machine: a `View_Manager` node holds sibling
  `3D_World` / `2D_Map` containers; switching view instantiates/frees the
  3D scene and toggles the 2D container's `visible` flag. Reassuring data
  point: this kind of large structural feature does not need to be
  over-engineered.
- **Generic interaction via duck-typing**: `PlayerInteractionController`
  (a `RefCounted`, not a scene node) raycasts from screen center and
  checks `obj.has_method("interact")` /
  `obj.has_method("get_interaction_prompt")` — works uniformly against a
  full `EntityView3D` or any bare `CollisionObject3D`. This is a
  first-person raycast-interact pattern (contrast with godot-open-rpg's
  2D-proximity/Area pattern) and is architecturally closer to what our
  first-person game needs, though we should use an actual typed interface
  (e.g. a script interface / `class_name Interactable`) rather than
  `has_method()` duck-typing for compile-time safety.
- **Data-driven entities as JSON**: `id → view_scene path → components
  dict`, parsed by `EntityRegistry`. A clean schema-driven alternative to
  Godot `Resource`/`.tres` files; worth weighing against `.tres` for our
  own item/recipe/NPC data (see ARCHITECTURE.md's data-format decision).

## Anti-patterns / cautions
- Heavy reliance on untyped `Variant`/duck-typing (`has_method`,
  dictionary-style `"key" in obj` component checks) trades compile-time
  safety for flexibility — the project's own settings even disable typed
  declarations (`untyped_declaration=1`). We should prefer typed
  GDScript (`class_name`, typed exports) where the equivalent flexibility
  isn't strictly required.
- Some view code directly string-references specific component keys
  (e.g. `&"stackable"`, `&"item"`), coupling the view layer to logic-layer
  internals more tightly than the stated "separation" principle implies.

## Reusable concepts for our project
1. **Logic/View separation** for NPCs and world entities — a background
   NPC's schedule, needs, and relationship state should be able to keep
   advancing whether or not their scene is currently loaded, synced
   through an explicit one-directional contract when it re-enters range.
2. Time-sliced streaming with an explicit per-frame budget, if/when our
   world grows past a single always-loaded hub.
3. Minimal, narrow autoload surface (event bus + a couple of registries +
   save manager) rather than a god singleton.
4. A typed (not duck-typed) `Interactable` contract for first-person
   raycast interaction, learning from this repo's raycast approach but
   avoiding its untyped-Variant weakness.
