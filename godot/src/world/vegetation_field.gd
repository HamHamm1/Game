class_name VegetationField
extends RefCounted
## M2.4-B — builds one MultiMeshInstance3D of a vegetation species over a
## rectangular zone, for composition (framing paths/water/buildings, village↔
## forest transitions), not blanket greening (M2.4_ART_DESIGN.md §M2.4-B).
##
## Placement is a DETERMINISTIC jittered grid (seeded): the middle ground
## between perfectly uniform spacing and excessive randomness the owner asked
## for. Density scales with GraphicsManager's `vegetation` intent (LOW sparse,
## ULTRA full). Distance is culled with visibility_range (LOD). No collision,
## no wind, one shared material (M2.4-A). Reads GraphicsManager only; writes no
## environment/lights.

## Instance count for a base count under a vegetation intent (0..1).
static func target_count(base_count: int, intent: float) -> int:
	return int(round(float(base_count) * clampf(intent, 0.0, 1.0)))

static func _intent() -> float:
	if GraphicsManager != null:
		return float(GraphicsManager.get_params().get("vegetation", 1.0))
	return 1.0

## True if the XZ point falls inside any exclusion Rect2 (water/road/building/
## doorway footprints, in world XZ). Used to keep vegetation off those surfaces.
static func _excluded(x: float, z: float, exclusions: Array[Rect2]) -> bool:
	var p := Vector2(x, z)
	for r in exclusions:
		if r.has_point(p):
			return true
	return false

## Pure, deterministic placement: the jittered grid minus any candidate inside
## an exclusion zone. Exposed so tests can verify placement directly (a
## MultiMesh's transforms don't read back reliably headless). The RNG is
## advanced once per CANDIDATE regardless of exclusion, so the surviving layout
## is identical for a given seed + zones (and identical to no-exclusion when the
## list is empty). Placement itself is excluded — nothing is merely hidden.
static func compute_transforms(center: Vector3, half_x: float, half_z: float,
		count: int, rng_seed: int, y_base: float, s_min: float, s_max: float,
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
		var px := corner.x + (float(col) + 0.5) * cell_w + (rng.randf() - 0.5) * cell_w * 0.8
		var pz := corner.z + (float(row) + 0.5) * cell_d + (rng.randf() - 0.5) * cell_d * 0.8
		var yaw := rng.randf() * TAU
		var s := lerpf(s_min, s_max, rng.randf())
		if _excluded(px, pz, exclusions):
			continue
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3(s, s, s))
		kept.append(Transform3D(basis, Vector3(px, y_base, pz)))
	return kept

## Build a field. `center` is world-space; `half_x`/`half_z` are the zone's half
## extents; `y_base` lifts instances so they sit on the ground. Returns a
## MultiMeshInstance3D (instance_count may be 0 at very low density).
static func scatter(species: StringName, material_key: StringName, center: Vector3,
		half_x: float, half_z: float, base_count: int, rng_seed: int,
		y_base: float, s_min: float, s_max: float, end_dist: float,
		exclusions: Array[Rect2] = []) -> MultiMeshInstance3D:
	var count := target_count(base_count, _intent())
	var kept := compute_transforms(center, half_x, half_z, count, rng_seed,
		y_base, s_min, s_max, exclusions)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = VegetationKit.mesh(species)
	mm.instance_count = kept.size()
	for i in kept.size():
		mm.set_instance_transform(i, kept[i])

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = MaterialLibrary.get_mat(material_key)
	# LOD: cull the field past its range with a soft fade (cheap on mobile).
	mmi.visibility_range_end = end_dist
	mmi.visibility_range_end_margin = end_dist * 0.12
	mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	return mmi
