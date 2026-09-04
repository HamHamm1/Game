# Reference Analysis — godot-demo-projects (3d/ subset)

- **Source:** `hamhamm1/godot-demo-projects` (upstream: the official Godot
  Engine demo-projects mono-repo)
- **Purpose:** a large collection of small, focused official technical
  demos (not a game). Only the `3d/` subfolder was surveyed, targeted at:
  open-world streaming, NPC navigation, first-person controllers, and any
  "town"/open-world demo.
- **Engine:** Godot **4.7**.
- **License:** **MIT** (Godot Engine contributors) — fully safe to
  reference/adapt code patterns conceptually.

## Findings (3d/ subfolder, ~30 topic demos total — most irrelevant to us)

Three demos are directly relevant:

- **`3d/navigation/`** — a clean, minimal `NavigationAgent3D` pathfinding
  example. `character.gd` (a `Marker3D`) drives movement each
  `_physics_process` via `_nav_agent.get_next_path_position()`, moves
  toward it with `move_toward`, orients with `look_at()` (Y-axis clamped
  to stay upright). `set_target_position()` also demonstrates pulling a
  full path via `NavigationServer3D.map_get_path()` for debug-line
  visualization. **A good, idiomatic Godot 4 reference for basic NPC
  "walk to schedule location" navigation.**
- **`3d/navigation_mesh_chunks/`** — demonstrates baking separate
  `NavigationMesh` regions per world "chunk" rather than one monolithic
  navmesh — directly relevant to open-world navmesh streaming/paging as
  regions load/unload.
- **`3d/ik/fps/`** (`fps_example.tscn`/`example_player.gd`) — a
  first-person view+weapon rig using an IK addon (`addons/sade`) for
  arm/weapon look-at and procedural lean, weapon on a
  `PathFollow3D`/animated lean path. A reasonable minimal reference for
  arm/hand-visibility and weapon-sway-style architecture (not a full
  first-person movement controller).

Everything else in `3d/` (physics, decals, GI, voxel, ragdoll, CSG,
`3d/truck_town` vehicle-driving demo, etc.) was correctly judged
irrelevant to our open-world/life-sim/first-person scope and was not
explored further. **No first-person walking controller with full
movement+camera, and no "town"/open-world/life-sim demo exists in this
repo.**

## Reusable concepts for our project
1. `NavigationAgent3D` + `move_toward` + upright-clamped `look_at()` as
   the base pattern for NPC schedule-driven movement (walking to their
   next scheduled location).
2. Per-chunk/per-region `NavigationMesh` baking for our hub/region world
   structure, so navmeshes can load/unload alongside the region scenes
   they belong to (ARCHITECTURE.md §3).
3. The `ik/fps/` demo as a starting reference *only* if/when we decide the
   player needs visible arms/hands (not required for MVP, noted for a
   later phase).
