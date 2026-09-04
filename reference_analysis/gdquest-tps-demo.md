# Reference Analysis — gdquest-tps-demo

- **Source:** `hamhamm1/gdquest-tps-demo` (upstream: GDQuest third-person
  shooter/controller demo)
- **Purpose:** third-person combat controller demo (movement, camera,
  weapons, simple enemy AI) — not an interaction/adventure demo, but a
  strong reference for clean Godot 4 player-controller composition.
- **Engine:** Godot **4.3**, Forward+ renderer.
- **License:** Code is **MIT** (© 2022 GDQuest); assets are **CC-BY 4.0
  GDQuest** per the README — attribution required if any asset were ever
  reused (we do not intend to reuse any; architecture only).

## Structure
Feature-folder layout (one directory per gameplay concept, not per file
type): `Player/` (controller, camera, weapons, skin/animation, sounds,
model), `Enemies/` (`BeeBot.gd`, `Beetle.gd`, each with their own
skin/model subfolder), `Environment/`, `Box/`, `JumpingPad/`, `Level/`,
`shared/` (shaders/textures reused across features), `DemoPage/`,
`icons/`. This **composition-by-feature-folder** pattern (rather than
composition-by-type, e.g. all scripts together, all scenes together) is
itself a good structural reference.

## Architecture patterns
- **Player as orchestrator delegating to typed sibling components**:
  `Player.gd` (`class_name Player extends CharacterBody3D`) holds
  `@onready` references to `CameraController` (own class), `CharacterSkin`
  (own class, wraps an `AnimationTree` state machine), `GrenadeLauncher`,
  `MeleeAttackArea` — each a separately typed node/script rather than
  logic embedded in Player.gd itself. This composition-of-typed-nodes
  shape is the strongest single takeaway for our own player controller.
- **Movement state as fresh-computed booleans, not stored enums**:
  `is_attacking`, `is_just_jumping`, `is_aiming`, `is_air_boosting`,
  `is_just_on_floor` are recomputed every physics frame rather than
  persisted — avoids a class of stale-state bugs at the cost of being
  less explicit about "current mode" than a formal state machine. Worth
  weighing against an explicit FSM for our more complex movement set
  (walk/sprint/crouch/interact/sit/sleep/cook).
- **Camera**: `CameraController.gd` (`class_name CameraController extends
  Node3D`) is a fully separate, reusable node — owns a `SpringArm3D` for
  collision-avoidance and a raycast for aim-target detection, with two
  swappable "pivot" points (third-person / over-shoulder) rather than
  hardcoded camera lerps. Mouse and gamepad analog-stick input merge into
  the same rotation accumulators, i.e. input-device-agnostic camera code.
  Ground-height tracking is smoothed via `lerp` to avoid clipping on
  slopes. Not first-person, but the spring-arm/raycast/pivot-swap pattern
  directly informs our own first-person camera-collision handling.
- **Skin/visual layer decoupled behind an intent-based API**: both
  `CharacterSkin` (player) and each enemy's skin script expose methods
  like `jump()`, `fall()`, `punch()`, `walk()`, `attack()`, `idle()`
  rather than exposing the underlying `AnimationTree` directly — gameplay
  code never touches animation internals. Directly reusable pattern for
  our player and NPC animation layers.
- **NPCs**: `Beetle.gd` (ground melee) and `BeeBot.gd` (ranged/flying) use
  `NavigationAgent3D`-driven pursuit gated by a nullable `_target`
  reference (set/cleared via an `Area3D` detection zone) rather than a
  formal state machine — simple detect→target→pursue, consistent with the
  "boolean/reference state over enum FSM" style used for the player.
- **Data-driven tunables**: heavy, idiomatic `@export`/`@export_range`
  usage with doc comments (e.g. `## Character maximum run speed...`) on
  every tunable, `class_name` on every major script, and `signal`s
  (`weapon_switched`, `stepped`) for cross-system/UI decoupling (UI
  listens to signals rather than polling state).

## What NOT to copy
- No generic interaction system exists here to learn from at all (this is
  a combat demo) — our first-person `Interactable` design will not be
  informed by this repo.
- Do not reuse the CC-BY-licensed models/animations/audio; architecture
  only.

## Reusable concepts for our project
1. Player-as-orchestrator delegating to typed component nodes
   (CameraController-equivalent, animation/skin wrapper, per-feature
   controllers) instead of one large script.
2. Decoupled "skin" layer exposing intent methods, never the raw
   AnimationTree, to gameplay code — apply this to both the player and
   every NPC.
3. Signals for UI decoupling (inventory/relationship/quest UI should
   listen to signals, never poll).
4. Heavily documented `@export` tunables as the default authoring style
   for anything a designer/AI agent might need to tune later.
