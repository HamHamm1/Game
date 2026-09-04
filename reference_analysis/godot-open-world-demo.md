# Reference Analysis — Godot-Open-World-Demo

- **Source:** `hamhamm1/godot-open-world-demo` (upstream: redhoot-dev
  "Open World Terrain Demo")
- **Purpose:** a minimal tech demo testing how large a landscape mesh can
  be rendered/shaded in Godot at once. **Despite the name, there is no
  chunking, streaming, or LOD system present at all** — important to flag
  explicitly since this is exactly the naive approach our own world
  streaming design (ARCHITECTURE.md §3, §8) must avoid.
- **Engine:** Godot **3.x** (config_version=4 — pre-Godot-4; APIs like
  `Spatial`, `PoolByteArray`, `yield` don't port to Godot 4's `Node3D`,
  `PackedByteArray`, `await`, so only concepts transfer, not syntax).
- **License:** entire repo (code + assets) is **CC-BY 4.0** per README —
  permissive, attribution required if ever reused; little here is worth
  reusing beyond one idea (below).

## Structure
- `Main.tscn`/`Main.gd` — root scene; a ~10-line debug input script that
  rotates the environment and time-scales an `AnimationPlayer` for
  day/night testing. No world-organization logic of any kind.
- `Terrain/` — a single large `.dae` terrain mesh + hand-authored
  `SpatialMaterial`/shader (albedo+normal+roughness) and a **separate
  low-poly `TerrainShadowCaster.obj`** used only for the shadow pass.
- `Environment/` — sky sphere mesh + skybox texture + rain particle scene.
- `CameraRig/` — a free-look/orbit camera with its own environment
  resource for post-processing, decoupled from gameplay tuning.

## Architecture patterns
- **Separate shadow-caster mesh**: using a decimated/low-poly proxy mesh
  purely for the shadow pass while the visual mesh stays high-detail is a
  legitimate, still-relevant Godot 4 optimization (a form of shadow LOD)
  — the one idea from this repo worth carrying forward.
- Decoupled camera-rig environment resource for fog/exposure tuning,
  separate from gameplay code.

## What NOT to copy / explicit anti-pattern
- **One giant static terrain mesh with no chunking, streaming, LOD
  paging, or proximity-based scene loading at all.** This does not scale
  past a tech-demo and must not be the model for our hub/regions world
  structure (ARCHITECTURE.md §3). No entity/world-organization system, no
  NPCs, no navmesh exist here either — there is nothing else to learn
  from architecturally.

## Reusable concepts for our project
1. Low-poly shadow-caster proxy meshes for expensive hero geometry
   (buildings, terrain) as a rendering-cost optimization, once we reach
   the performance-tuning phase (DESIGN.md/master-prompt §35).
2. A cautionary data point: naive single-mesh open worlds are the failure
   mode our modular region/location scene structure (ARCHITECTURE.md §3)
   and OpenAcre-inspired streaming approach (see `openacre.md`) are
   explicitly designed to avoid.
