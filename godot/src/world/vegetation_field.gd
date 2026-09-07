class_name VegetationField
extends RefCounted
## M2.4 (rebuild) — one MultiMeshInstance3D of a vegetation species over a zone,
## used for COMPOSITION (ecological zones: lawns, path edges, forest transition,
## banks, gardens), not blanket greening (M2.4_ART_DESIGN.md). Key properties:
##
## - GROUNDED: every instance's Y comes from GroundSampler.height_at (the real
##   ground representation) plus the species' ground_offset*scale, so nothing
##   floats or sinks. Meshes are base-anchored (see VegetationKit).
## - EXCLUDED: candidates inside a water/road/building/doorway Rect2 are dropped
##   from PLACEMENT (not hidden).
## - DETERMINISTIC: seeded jittered grid -> reproducible builds.
## - VARIED: per-instance scale, rotation, and colour (MultiMesh instance
##   colour) so a field never reads as a repeated stamp.
## - MOBILE: GPU-instanced, shared material, density from GraphicsManager's
##   `vegetation` intent, distance culled with visibility_range scaled by the
##   `view_distance` intent (ULTRA shows vegetation farther than HIGH/MED).
##
## Reads GraphicsManager only; writes no environment/lights/collision.

const LOD_BASELINE_VIEW := 300.0   # HIGH preset view distance = 1.0x LOD

## Instance count for a base count under a vegetation intent (0..1).
static func target_count(base_count: int, intent: float) -> int:
	return int(round(float(base_count) * clampf(intent, 0.0, 1.0)))

static func _intent() -> float:
	if GraphicsManager != null:
		return float(GraphicsManager.get_params().get("vegetation", 1.0))
	return 1.0

## visibility_range scale from the preset view distance (LOW ~0.5x .. ULTRA ~1.7x).
static func lod_scale() -> float:
	if GraphicsManager == null:
		return 1.0
	var vd := float(GraphicsManager.get_params().get("view_distance", LOD_BASELINE_VIEW))
	return clampf(vd / LOD_BASELINE_VIEW, 0.5, 2.0)

static func _excluded(x: float, z: float, exclusions: Array[Rect2]) -> bool:
	var p := Vector2(x, z)
	for r in exclusions:
		if r.has_point(p):
			return true
	return false

## Pure, deterministic, GROUNDED placement — the jittered grid minus exclusions,
## with Y derived from the ground. Exposed so tests verify placement directly
## (a MultiMesh's transforms don't read back reliably headless).
static func compute_transforms(center: Vector3, half_x: float, half_z: float,
		count: int, rng_seed: int, s_min: float, s_max: float, ground_offset: float,
		exclusions: Array[Rect2]) -> Array[Transform3D]:
	var kept: Array[Transform3D] = []
	if count <= 0:
		return kept
	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed
	var aspect := half_x / maxf(half_z, 0.001)
	var cols := maxi(1, int(ceil(sqrt(float(count) * aspect))))
	var rows := maxi(1, int(ceil(float(count) / float(cols))))
	var cell_w := (2.0 * half_x) / float(cols)
	var cell_d := (2.0 * half_z) / float(rows)
	var corner := center - Vector3(half_x, 0.0, half_z)
	for i in count:
		var col := i % cols
		var row := i / cols
		var px := corner.x + (float(col) + 0.5) * cell_w + (rng.randf() - 0.5) * cell_w * 0.85
		var pz := corner.z + (float(row) + 0.5) * cell_d + (rng.randf() - 0.5) * cell_d * 0.85
		var yaw := rng.randf() * TAU
		var s := lerpf(s_min, s_max, rng.randf())
		if _excluded(px, pz, exclusions):
			continue
		var y := GroundSampler.height_at(px, pz) + ground_offset * s
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3(s, s, s))
		kept.append(Transform3D(basis, Vector3(px, y, pz)))
	return kept

## Build a grounded, composed field node. `base_end_dist` is the species' base
## LOD cull distance (scaled by the preset). Returns a MultiMeshInstance3D.
static func scatter(species: StringName, material_key: StringName, center: Vector3,
		half_x: float, half_z: float, base_count: int, rng_seed: int,
		s_min: float, s_max: float, base_end_dist: float,
		exclusions: Array[Rect2] = []) -> MultiMeshInstance3D:
	var count := target_count(base_count, _intent())
	var offset := VegetationKit.ground_offset(species)
	var kept := compute_transforms(center, half_x, half_z, count, rng_seed,
		s_min, s_max, offset, exclusions)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = VegetationKit.mesh(species)
	mm.instance_count = kept.size()
	var crng := RandomNumberGenerator.new()
	crng.seed = rng_seed + 1
	for i in kept.size():
		mm.set_instance_transform(i, kept[i])
		var v := crng.randf_range(0.82, 1.0)     # subtle value variation
		mm.set_instance_color(i, Color(v, v * 1.02, v * 0.96))

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = MaterialLibrary.get_mat(material_key)
	var end_dist := base_end_dist * lod_scale()
	mmi.visibility_range_end = end_dist
	mmi.visibility_range_end_margin = end_dist * 0.12
	mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	return mmi

## CHUNKED ground cover over a whole area — the robust fix for grass "pop-in".
## Instead of ONE big MultiMesh (whose single visibility_range makes the entire
## field fade in/out as a unit as the camera moves), the area is split into a
## grid of independent chunk tiles. Each tile is its own MultiMeshInstance3D
## whose visibility_range is measured to THAT tile, so near tiles are always
## solid and only genuinely distant tiles fade — with a large fade margin and
## end distances set so neighbouring tiles' fade bands OVERLAP, the cover stays
## visually continuous around the player and never abruptly vanishes on the
## sides. Deterministic (per-tile seed), grounded + exclusion-masked like scatter.
## Returns a parent Node3D holding the tile instances.
static func scatter_tiled(species: StringName, material_key: StringName,
		min_x: float, min_z: float, max_x: float, max_z: float, tile: float,
		density_per_m2: float, rng_seed: int, s_min: float, s_max: float,
		base_end_dist: float, exclusions: Array[Rect2] = []) -> Node3D:
	var root := Node3D.new()
	root.name = "GrassTiles_" + String(species)
	var intent := _intent()
	if intent <= 0.0:
		return root
	var mat := MaterialLibrary.get_mat(material_key)
	var mesh := VegetationKit.mesh(species)
	var offset := VegetationKit.ground_offset(species)
	var per_tile := int(round(density_per_m2 * tile * tile * intent))
	# Generous, overlapping fade so tiles blend rather than pop.
	var end_dist := base_end_dist * lod_scale()
	var margin := end_dist * 0.6
	var cols := int(ceil((max_x - min_x) / tile))
	var rows := int(ceil((max_z - min_z) / tile))
	var cell := 0
	for r in rows:
		for c in cols:
			var cx := min_x + (float(c) + 0.5) * tile
			var cz := min_z + (float(r) + 0.5) * tile
			cell += 1
			var kept := compute_transforms(Vector3(cx, 0.0, cz), tile * 0.5, tile * 0.5,
				per_tile, rng_seed + cell * 131, s_min, s_max, offset, exclusions)
			if kept.is_empty():
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = mesh
			mm.instance_count = kept.size()
			var crng := RandomNumberGenerator.new()
			crng.seed = rng_seed + cell * 131 + 7
			for i in kept.size():
				mm.set_instance_transform(i, kept[i])
				var v := crng.randf_range(0.82, 1.0)
				mm.set_instance_color(i, Color(v, v * 1.02, v * 0.96))
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.material_override = mat
			mmi.visibility_range_end = end_dist
			mmi.visibility_range_end_margin = margin
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			root.add_child(mmi)
	return root
