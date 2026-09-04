# Reference Analysis — 3D-FPP-Interaction-Demo

- **Source:** `hamhamm1/3d-fpp-interaction-demo`
- **Purpose:** small first-person interaction demo (door, ladder, pickup,
  drawer, light switch).
- **Engine:** Godot **3.x** (config_version=4) — an older engine major
  version than our Godot 4 target; syntax does not port directly, only
  concepts.
- **License:** Code is **MIT** (© 2018 TheRadMatt). Textures/meshes
  (`.obj`/`.dae`, brick/wood/basketball textures) have **no stated
  license or attribution** anywhere in the repo — treat as unknown/unsafe,
  reference-only, never to be imported into our asset pipeline.

## Structure
- `addons/RadMatt.3DFPP/` — `Player.gd`/`Player.tscn` (controller) plus
  `Test_Objects/` (`door/`, `ladder/`, `pickable/`), each a standalone
  interactable prefab.
- `entities/` — level furniture (desk+drawer, light switch, basketball
  hoop) built from raw meshes.
- `Room_01.tscn` — the single test level.
- No `resources/`, no data folder, no state-machine class.

## Architecture patterns
- **Camera rig**: a `Yaw` (Spatial) node holds mouse-look yaw, its child
  `Camera` holds pitch — the standard two-node FPS camera split. This is
  a solid, reusable shape for our own first-person camera root.
- **Interaction**: the player's `InteractionRay` (parented directly under
  the camera) checks `get_collider().has_method("pick_up")` /
  `has_method("interact")` — GDScript duck-typing, no shared base
  class/interface. Prompt text is a plain on-screen `Label`, updated every
  `_process()` frame, with hardcoded strings living in `Player.gd` (e.g.
  `"[F]  Pick up: "`) rather than on the interactable itself.
- Movement "states" (`IDLE/RUN/SPRINT/WALK`, `STAND/CROUCH`) are plain
  integer constants set imperatively inside one large
  `_process_movements()` function — not a real state machine. Ladder
  climbing is a parallel branch (`_process_on_ladder`) toggled by an
  `Area` signal, duplicating most of the ground-movement logic rather than
  sharing it.
- Crouch height transitions are driven by an `AnimationPlayer` clip
  (posture changes on an animation-finished callback) rather than
  code-interpolated capsule height — a fragile choice that can make
  posture lag player input; worth avoiding.

## What NOT to copy
- The unattributed texture/mesh assets (bricks, wood floor, basketball
  textures, `.obj`/`.dae` models) — provenance unknown, do not import.
- The monolithic Player.gd approach (movement + camera + inventory +
  interaction + UI text all in one ~365-line script) — explicitly an
  anti-pattern for our RPG-scope player controller, which needs to stay
  modular per ARCHITECTURE.md.

## Reusable concepts for our project
1. Yaw/Pitch two-node first-person camera rig as a starting shape (to be
   extended with head-bob, sway, and FOV modulation per DESIGN.md §2).
2. A forward raycast from the camera for interaction targeting is the
   right general approach for first-person interact — but we will
   formalize it with a typed `Interactable` interface (see
   ARCHITECTURE.md) instead of `has_method()` duck-typing, and put prompt
   text as data on the interactable, not hardcoded in the player script.
3. Explicit lesson: avoid parallel/duplicated movement-mode branches
   (e.g. ladder vs. ground) — model movement modes so they share the
   common physics step and only vary constraints/inputs.
