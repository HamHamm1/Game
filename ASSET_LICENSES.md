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
