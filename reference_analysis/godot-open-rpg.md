# Reference Analysis — godot-open-rpg

- **Source:** `hamhamm1/godot-open-rpg` (upstream: GDQuest "Godot Open RPG")
- **Purpose:** community reference project for a 2D field-exploration +
  turn-based-combat RPG.
- **Engine:** Godot **4.6**, GL Compatibility renderer.
- **License:** Code is **MIT** (safe to study and adapt patterns from
  freely). Third-party art/audio credited separately in `CREDITS.md`,
  mostly CC0/CC-BY (Kenney "Tiny Town" tileset, Zane Little Music) — do not
  copy those assets verbatim without checking individual attribution
  terms, but there is no copyleft risk in the code.

## Structure
- `src/` — reusable class code, split by gameplay mode: `field/`
  (overworld exploration), `combat/` (turn-based battle), `common/`
  (screen transitions, music).
- `overworld/`, `combat/` (repo root) — the *scene instances/content*
  (maps, battler scenes, tilesets) that consume the `src/` classes.
- `assets/` — GUI, icons, music, sfx.
- `addons/dialogic` — vendored third-party dialogue-system plugin.

This is a clean **code vs. content** split: reusable logic lives under
`src/`, concrete levels/instances live at the repo root. Worth adopting
directly as an organizing principle.

## Architecture patterns
- **Narrow, single-purpose autoloads** instead of one god-object manager:
  `FieldEvents` / `CombatEvents` are pure signal buses (no state, only
  `signal` declarations) scoped to their gameplay mode; `Gameboard` (grid
  math), `GamepieceRegistry` (actor lookup table), `Camera`, `Music`,
  `Transition`, `Player` are each single-responsibility singletons.
- **Signal-bus-driven communication**: systems never call each other
  directly — they emit on the relevant event bus and listeners subscribe.
  This is the same shape we want for our own systems (time, weather,
  schedule, relationship, quest) talking to each other.
- **Generic interaction pattern** (`src/field/cutscenes/interaction.gd`):
  an `Interaction` class extends a base `Cutscene`, is attached to any
  node with an `Area2D`, tracks overlapping player-interaction-hitbox
  areas via signals, gates input processing to "player is adjacent", and
  supports both keyboard and mouse-click resolution (topmost-only).
  Concrete interactions (`door_unlock_interaction.gd`,
  `treasure_chest_interaction.gd`) subclass it and override `_execute()`.
  **This decoupled proximity-detection + input-gating + polymorphic
  `_execute()` shape is a strong template for our own `Interactable`
  contract**, even though our game is first-person/raycast-based rather
  than 2D-proximity-based.
- **Data-driven combat data**: actions/stats/elements are custom
  `Resource` subclasses (`.tres`), not JSON — idiomatic Godot approach we
  intend to follow for items/recipes/dialogue definitions.
- Dialogue is fully delegated to the third-party **Dialogic** addon
  (timeline resources); no custom dialogue engine is visible to learn
  from. No custom quest system is present either.
- Combat is an explicit two-phase (select → execute) round loop driven by
  `await`/coroutines rather than a formal state-machine node — simple, but
  state is implicit in control flow rather than introspectable.

## What NOT to copy
- Do not vendor the Dialogic addon or its dialogue content — we may adopt
  a data-driven dialogue *pattern* inspired by it, or select our own
  dialogue tooling, but this is a build decision for a later phase, not
  something to import wholesale now.
- Do not reuse tileset/sprite/audio assets — genre and camera differ (2D
  top-down vs. our first-person 3D), and license attribution would need
  separate verification per asset regardless.

## Reusable concepts for our project
1. Split reusable systems code from concrete world content, mirrored in
   our own `src/` (or `systems/`) vs. `world/`/`locations/` split.
2. Prefer several narrow signal-bus autoloads over one monolithic
   game-manager singleton.
3. Model our `Interactable` contract on the proximity/gating/polymorphic-
   execute shape here, adapted to first-person raycast interaction.
