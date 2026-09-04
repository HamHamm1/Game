# Reference Analysis — godot-4-3d-characters

- **Source:** `hamhamm1/godot-4-3d-characters` (upstream: GDQuest "3D
  Characters Repository")
- **Purpose:** a rigged-character showcase, not a game — six pre-rigged
  low-poly characters (GDBot, Sophia, Gobot, Round Bat, Bee Bot, Beetle
  Bot) plus a "Model Viewer 3D" editor plugin for browsing them.
- **Engine:** Godot **4.7**, Forward+ (project at `src/project.godot`).
- **License — split, note carefully:** code (scripts/scenes/shaders) is
  **MIT**, safe to study freely. Art assets (textures, 3D models) are
  **CC-BY-NC-SA 4.0** — non-commercial, share-alike, attribution required.
  Since our project is original and may have commercial intent, **the
  actual character models/textures must not be used** — only the
  MIT-licensed code/architecture pattern below is safe to reference.

## Structure
- `src/addons/` — one folder per character (`gdquest_gobot`,
  `gdquest_sophia`, …), each with `model/` (glb + textures + materials),
  `custom_animations/` (`.res` animation library resources), and a
  top-level `<name>_skin.tscn` + `<name>_skin.gd` entry point meant to be
  instanced into a game.
- `gdquest_models_shared/` — shared shaders/textures.
- `gdquest_model_viewer_3d/` — a separate, larger addon (in-editor 3D
  model browser UI), used only for browsing, not gameplay.

## Architecture patterns
- **Animation façade pattern**: each `_skin.gd` (e.g. `gobot_skin.gd`)
  exposes a small public **verb API** — `idle()`, `move()`, `jump()`,
  `fall()`, `edge_grab()`, `wall_slide()`, `flip()`, `victory_sign()`,
  `hurt()` — that internally drives an `AnimationTree` state machine
  (`AnimationNodeStateMachinePlayback.travel()`), blend spaces
  (walk/run blending via `@export_range`), and one-shot overlay
  animations (`AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE` for hurt/flip,
  so they play in parallel with locomotion). Procedural detail (blinking)
  uses `Timer` nodes + material texture swaps rather than baked
  animation. The skin script knows nothing about physics/input — a
  controller elsewhere is expected to call these verbs.
- Self-contained per-character addon folders, each independently
  drag-in-able — a good organizational model for many NPC body types.

## What NOT to copy
- The actual `.glb` models, textures, and animation `.res` files (CC-BY-
  NC-SA 4.0, non-commercial) — do not import into our project.
- This repo is stylized/low-poly with no IK or skeleton-retargeting
  concerns — don't over-index on it for anything beyond the animation-
  façade idea; it is a browsing tool + assets, not a controller/gameplay
  architecture reference.

## Reusable concepts for our project
1. **Animation-façade pattern**: our player's `CharacterSkin`-equivalent
   and every NPC's animation wrapper should expose intent verbs (`idle()`,
   `walk()`, `sit()`, `cook()`, `talk()`, `hurt()`, …), never raw
   `AnimationTree`/`AnimationPlayer` access, to gameplay code — consistent
   with the same pattern independently observed in gdquest-tps-demo.
2. One-shot overlay animations layered atop a locomotion state machine
   for reactive states (being startled, a relationship "heart" reaction,
   etc.).
3. Per-character self-contained folders as the organizing unit for our
   NPC roster once many NPC body/rig variants exist.
