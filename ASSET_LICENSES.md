# Asset Licenses & Provenance

Every external or imported binary asset used in the game is recorded here with
its source and license. No asset enters the build without a row in this file.
(Policy expanded per the owner's M2.4 direction: original / owner-created /
AI-generated / CC0 / properly-licensed assets are permitted; ripped, extracted,
unclear-license, or non-redistributable assets are not.)

## Meshes — Architecture (hero)

| Asset | Path | Kind | Source | License / rights | Format | Textures | Notes |
|---|---|---|---|---|---|---|---|
| Japanese rural house A | `godot/assets/meshes/houses/house_a.glb` | Hero architecture | **Original**, created by the project owner with **Meshy AI** | Owner-created original asset (owner holds rights to use in this game) | glTF 2.0 (.glb) | 2048² base_color + metallic_roughness + normal (embedded; Godot extracts siblings on import) | ~407k tris; scaled ~×3.7 in-engine to ~7.6 m; box collision; LODs generated on import |
| Japanese rural house B | `godot/assets/meshes/houses/house_b.glb` | Hero architecture | **Original**, created by the project owner with **Meshy AI** | Owner-created original asset (owner holds rights to use in this game) | glTF 2.0 (.glb) | 2048² base_color + metallic_roughness + normal | ~443k tris; scaled to ~6.8 m; box collision; LODs on import |

**Provenance note:** both houses are original assets the owner generated with
Meshy AI specifically for this project. They are NOT extracted or copied from
any third-party game or pack. (This is distinct from the earlier Astra Unity
pack, which was NOT imported due to redistribution/EULA concerns.)

**Runtime handling:** high-poly (≈0.4M tris each) — used only as a small number
of near-camera hero buildings, with import-generated LODs and simple box
collision (never the full mesh as a collider). 2K PBR textures preserved at
source quality; VRAM compression (ETC2/ASTC) + mipmaps applied on import.

## Meshes — Village architecture (imported GLB)

Three additional high-quality Japanese rural house models, provided by the
project owner and used as the reachable village architecture (staged around the
hero pair). Same provenance basis as House A/B (owner-provided originals). Not
extracted or copied from any third-party game/pack.

| Asset | Path | Kind | Source | License / rights | Format | Textures | In-engine size | Notes |
|---|---|---|---|---|---|---|---|---|
| Village house 3 | `godot/assets/meshes/houses/village_house3.glb` | Village architecture | **Owner-provided** original | Owner holds rights to use in this game | glTF 2.0 (.glb) | 2048² base_color + metallic_roughness + normal (extracted on import) | ~9.0 m W × 7.3 m D × 6.8 m H | two-storey gabled farmhouse; ~266k tris; uniform scale ×4.74; import LODs; simple compound box collision |
| Village house 4 | `godot/assets/meshes/houses/village_house4.glb` | Village architecture | **Owner-provided** original | Owner holds rights to use in this game | glTF 2.0 (.glb) | 2048² base_color + metallic_roughness + normal | ~10.0 m W × 10.0 m D × 4.5 m H | large low manor/hall, wrap-around engawa; ~230k tris; ×5.26; import LODs; box collision |
| Village house 7 | `godot/assets/meshes/houses/village_house7.glb` | Village architecture | **Owner-provided** original | Owner holds rights to use in this game | glTF 2.0 (.glb) | 2048² base_color + metallic_roughness + normal | ~8.5 m W × 7.1 m D × 4.3 m H | two-storey minka + side wing; ~281k tris; ×4.48; import LODs; box collision |

**Runtime handling:** as with the hero houses — uniform scale to a believable
real-world width, base grounded at y=0, 2K PBR preserved (VRAM compression +
mipmaps + import-generated LODs), and **simple compound box collision** derived
from the mesh (never the full render mesh). GLBs are used unmodified.

## Meshes — Dressing props (M2.4-C)

Sixteen owner-provided Japanese-village dressing GLBs, imported to
`godot/assets/meshes/props/prop01..16.glb` (2K PBR, single material each, import
LODs). Instanced via `PropKit` (shared through the resource cache — no mesh/
material duplication); original materials preserved. Named mapping:

| File | Prop | File | Prop |
|---|---|---|---|
| prop01 | arched bridge | prop09 | hanging lantern |
| prop02 | tall fence panel | prop10 | low picket fence |
| prop03 | firewood rack | prop11 | signpost |
| prop04 | woven baskets | prop12 | stone paving |
| prop05 | planter pot | prop13 | bench |
| prop06 | farming tools | prop14 | pine tree |
| prop07 | drying rack | prop15 | rock cluster |
| prop08 | storage shed | prop16 | flower shrub |

Source: **owner-provided** originals; owner holds rights to use in this game.
Runtime: uniformly scaled to believable size, base grounded to the terrain,
simple box/post collision only where it matters (bridge deck, sheds, racks,
benches, fences, rocks, tree trunks); decorative props (tools, baskets, flowers,
paving) have none. No dedicated sakura-tree asset was in this set — the pink
flower shrub is used for blossom accents and the pine for trees.

## Meshes — Vegetation & rocks (M2.4-D)

Seven owner-provided Japanese-village vegetation and rock GLBs, imported to
`godot/assets/meshes/veg/` (2K PBR, single material each, import LODs). These are
now the **only** source of visible vegetation and rocks in `hero_village` — all
previous procedural/primitive vegetation and rocks (VegetationField MultiMesh
grass/fern/flower/shrub fields, BlockoutUtil sphere-blob trees, and the
`SphereMesh` bank rocks) were removed. Instanced via `PropKit` (shared through
the resource cache — no mesh/material duplication); original materials preserved.

| File | Asset | In-engine use |
|---|---|---|
| `veg/sakura_large.glb` | Mature cherry (dense canopy) | Landmark cherries at the entrance, stream banks, manor forecourt (~3× → ~5.7 m) |
| `veg/sakura_small.glb` | Young cherry (trunk + soil base) | Yard / forecourt accent cherries (~1.4–1.5×) |
| `veg/pine.glb` | Japanese pine / cedar | Framing pines + mid-distance forest-edge ring (LOD-faded) |
| `veg/grass_clump.glb` | Single grass tuft | Selective grass clusters along paths / yards / stream banks (small) |
| `veg/flowers.glb` | Pink/white flowering plant | Small flower clusters in gardens, by the bench, at the entrance |
| `veg/river_rocks.glb` | Flat spread of water-worn pebbles | Rock spreads lining the stream banks |
| `veg/path_rocks.glb` | Flat angular flagstones | Stone edging beside the lanes |

Source: **owner-provided** originals; owner holds rights to use in this game.
Runtime: uniformly scaled to believable size, base grounded to the terrain via
`PropKit`, trunk (`post`) collision on trees and simple `box` collision on the
larger river-rock spreads only; grass, flowers, and flagstones are decorative
(no collision). Large vegetation fades with a `visibility_range` LOD.

M2.4-D.2: the same GLB meshes also fill the big floating-island top as a forest
+ meadow via **`GlbScatter`** — chunked MultiMesh GPU-instancing that shares the
one imported mesh + material per species (no duplication) and culls distant
chunks for mobile. Still the owner-supplied GLBs only; no primitive placeholders.

## Textures — Terrain ground set (M2.4-D.4)

Eight owner-provided ground textures used by the hero-village terrain, blended by
natural zones in `src/world/shaders/terrain_splat.gdshader` (per-vertex weights
baked by `TerrainBuilder` from `hero_village._zone_weights`). All owner-provided;
owner holds rights to use in this game.

| Asset | Path | Zone use |
|---|---|---|
| Short grass | `godot/assets/textures/terrain/grd_grass.png` | default open ground |
| Dry soil | `godot/assets/textures/terrain/grd_dry_soil.png` | maintained/worn house yards |
| Gravel mix | `godot/assets/textures/terrain/grd_gravel.png` | worn walking paths |
| Moist soil | `godot/assets/textures/terrain/grd_moist_soil.png` | wet ground just off the stream |
| Farming soil | `godot/assets/textures/terrain/grd_farming_soil.png` | cultivated garden plots |
| Fallen leaves | `godot/assets/textures/terrain/grd_leaves.png` | forest-edge leaf litter |
| River rock | `godot/assets/textures/terrain/grd_river_rock.png` | the stream channel / waterline |
| Path-edge rock | `godot/assets/textures/terrain/grd_path_rock.png` | irregular path edging |

(The earlier single `ground_grass.png` + normal are superseded by this 8-texture
splat and are no longer referenced by the terrain material.)

## Textures — Terrain (M2.4-C)

Owner-provided ground textures for the hero-village terrain. Applied via a
world-planar-UV StandardMaterial3D on the terrain mesh (VRAM compression +
mipmaps on import).

| Asset | Path | Kind | Source | License / rights | Notes |
|---|---|---|---|---|---|
| Ground grass/soil (albedo) | `godot/assets/textures/terrain/ground_grass.png` | Terrain albedo | **Owner-provided** | Owner holds rights to use in this game | 1024² seamless grass + dirt; ~5 m world tile |
| Ground grass/soil (normal) | `godot/assets/textures/terrain/ground_grass_normal.png` | Terrain normal map | **Owner-provided** | Owner holds rights to use in this game | tangent-space normal for the above |
| Dust motes (sprite) | `godot/assets/textures/fx/dust_motes.png` | Atmosphere sprite | **Owner-provided** | Owner holds rights to use in this game | saved for a future ambience pass; **not yet used** |

Not usable (Unity-only, reference-only): the uploaded `.terrainlayer` files
(Bark/Forest_Ground/Grass/Mud) and `Forest.asset` are Unity YAML metadata that
reference textures by GUID and contain no pixel data — the actual image files
would be needed to use those layers. Not added to the project.

## Meshes — Village architecture (modular kit)

The M2.4-B village houses (archetypes **C / D / E / F** and the background
backdrop houses) are **not imported binary assets** — they are **original
geometry generated in code** at runtime by
`godot/src/world/japanese_house_kit.gd` from Godot primitive meshes
(`BoxMesh`, `PrismMesh`) and the shared, texture-free `MaterialLibrary`. There
is no third-party mesh, texture, or pack behind them, so there is nothing to
license: they are owner-authored project source. The same applies to the shared
interior `house_interior_wood.gd` and all environmental dressing (fences,
firewood, lanterns, pots) — all code-built primitives.
