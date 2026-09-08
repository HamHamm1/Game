class_name GlbScatter
extends RefCounted
## M2.4-D.3 — mobile-scale forest/meadow scatter of a real GLB's mesh via chunked
## MultiMesh (GPU instancing). This is how the big floating island gets DENSE
## trees + grass on a phone: one shared imported mesh + material per species,
## GPU-instanced into per-tile MultiMeshInstance3D chunks, each with a
## visibility_range so distant chunks stop rendering entirely. It is NOT a
## primitive/placeholder — the instanced mesh is the owner-supplied GLB itself.
## Instances are grounded on the current GroundSampler height and skip an
## exclusion list + a central keep-out (the village core is planted by hand).

static var _cache: Dictionary = {}   # path -> {mesh, mat, aabb}

static func _extract(path: String) -> Dictionary:
	if _cache.has(path):
		return _cache[path]
	var data: Dictionary = {}
	var packed := load(path) as PackedScene
	if packed != null:
		var inst := packed.instantiate()
		var mi := _find_mesh(inst)
		if mi != null:
			data = {"mesh": mi.mesh, "mat": mi.get_active_material(0), "aabb": mi.get_aabb()}
		inst.queue_free()
	_cache[path] = data
	return data

static func _find_mesh(n: Node) -> MeshInstance3D:
	if n is MeshInstance3D:
		return n
	for c in n.get_children():
		var r := _find_mesh(c)
		if r != null:
			return r
	return null

## Scatter `path` over the rect [x0,z0]..[x1,z1] as chunked MultiMesh tiles.
## `tile` metres per chunk; `per_tile` attempts per chunk; scale in [smin,smax];
## `lod_end` culls a whole tile past that distance; `excl` rects + a `keep_*`
## central disc are skipped. Returns a Node3D holding the MultiMeshInstance3D
## tiles (add it to the scene). Grounded on GroundSampler (must be active).
static func scatter(path: String, x0: float, z0: float, x1: float, z1: float,
		tile: float, per_tile: int, smin: float, smax: float, lod_end: float,
		seed: int, excl: Array, keep_c: Vector2, keep_r: float,
		max_r: float = 0.0, y_sink: float = 0.0) -> Node3D:
	var root := Node3D.new()
	root.name = "GlbScatter"
	var d := _extract(path)
	if d.is_empty():
		push_error("GlbScatter: no mesh in '%s'" % path)
		return root
	var aabb: AABB = d["aabb"]
	# Lift base to y=0 + centre on XZ (same convention as PropKit), in mesh units.
	var base := Vector3(
		-(aabb.position.x + aabb.size.x * 0.5),
		-aabb.position.y - y_sink,   # sink the base slightly (buries a grass soil disc)
		-(aabb.position.z + aabb.size.z * 0.5))
	var rng := RandomNumberGenerator.new()
	var nx := int(ceil((x1 - x0) / tile))
	var nz := int(ceil((z1 - z0) / tile))
	for tj in nz:
		for ti in nx:
			var tx0 := x0 + float(ti) * tile
			var tz0 := z0 + float(tj) * tile
			var cx := tx0 + tile * 0.5
			var cz := tz0 + tile * 0.5
			rng.seed = seed + ti * 73856093 + tj * 19349663
			var xforms: Array[Transform3D] = []
			for _k in per_tile:
				var x := rng.randf_range(tx0, minf(tx0 + tile, x1))
				var z := rng.randf_range(tz0, minf(tz0 + tile, z1))
				var dc := Vector2(x, z).distance_to(keep_c)
				if keep_r > 0.0 and dc < keep_r:
					continue
				if max_r > 0.0 and dc > max_r:
					continue   # keep off the cliff / out of the void
				if _blocked(excl, x, z):
					continue
				var s := rng.randf_range(smin, smax)
				var b := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(Vector3(s, s, s))
				var gy := GroundSampler.height_at(x, z)
				var world_origin := Vector3(x, gy, z) + b * base
				# Store transforms RELATIVE to the tile centre so visibility_range
				# is measured per tile (the node sits at the tile centre).
				xforms.append(Transform3D(b, world_origin - Vector3(cx, 0.0, cz)))
			if xforms.is_empty():
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = d["mesh"]
			mm.instance_count = xforms.size()
			for idx in xforms.size():
				mm.set_instance_transform(idx, xforms[idx])
			var mmi := MultiMeshInstance3D.new()
			mmi.multimesh = mm
			mmi.position = Vector3(cx, 0.0, cz)
			if d["mat"] != null:
				mmi.material_override = d["mat"]
			mmi.visibility_range_end = lod_end
			mmi.visibility_range_end_margin = lod_end * 0.2
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			root.add_child(mmi)
	return root

static func _blocked(excl: Array, x: float, z: float) -> bool:
	var p := Vector2(x, z)
	for r in excl:
		if (r as Rect2).has_point(p):
			return true
	return false
