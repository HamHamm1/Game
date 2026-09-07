class_name TerrainBuilder
extends RefCounted
## M2.4-C — builds the walkable terrain from a TerrainField: a vertex-coloured
## ArrayMesh (subtle soil/grass/wet variation, no flat single colour) plus a
## matching HeightMapShape3D collider sampled from the SAME height function on the
## SAME grid, so the player can never fall through or float. Cheap for the Mobile
## renderer: one mesh, one heightmap body, no per-frame work.

## Build the terrain as a StaticBody3D (heightmap collider) with the visual mesh
## as a child. `res` is the grid spacing in metres (2 m = gentle + light).
static func build(field: TerrainField, min_x: float, min_z: float,
		max_x: float, max_z: float, res: float = 2.0) -> StaticBody3D:
	var w := int(round((max_x - min_x) / res)) + 1
	var d := int(round((max_z - min_z) / res)) + 1

	# Sample the height field once per grid point (shared by mesh + collider).
	var heights := PackedFloat32Array()
	heights.resize(w * d)
	for j in d:
		for i in w:
			heights[j * w + i] = field.height_at(min_x + i * res, min_z + j * res)

	var body := StaticBody3D.new()
	body.name = "Terrain"
	body.add_child(_build_mesh(field, heights, w, d, min_x, min_z, res))
	body.add_child(_build_collider(heights, w, d, min_x, min_z, max_x, max_z, res))
	return body

static func _h(heights: PackedFloat32Array, w: int, d: int, i: int, j: int) -> float:
	return heights[clampi(j, 0, d - 1) * w + clampi(i, 0, w - 1)]

static func _build_mesh(field: TerrainField, heights: PackedFloat32Array,
		w: int, d: int, min_x: float, min_z: float, res: float) -> MeshInstance3D:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	const UV_TILE := 0.2   # texture tiles every ~5 m of world space
	# Vertex colours MULTIPLY the ground texture (near-white = show the texture as
	# authored; darker only where wet/steep). This is why the ground reads as the
	# real grass/soil texture, not a flat colour — and never white.
	var grass := Color(0.98, 1.0, 0.94)
	var grass_dry := Color(1.0, 0.98, 0.86)
	var soil := Color(0.86, 0.74, 0.60)
	var wet := Color(0.58, 0.60, 0.56)
	var bank := Color(0.80, 0.78, 0.72)
	for j in d:
		for i in w:
			var x := min_x + i * res
			var z := min_z + j * res
			var y := heights[j * w + i]
			verts.append(Vector3(x, y, z))
			uvs.append(Vector2(x * UV_TILE, z * UV_TILE))   # world-planar UV (no triplanar)
			# Normal from central differences on the sampled grid.
			var hl := _h(heights, w, d, i - 1, j)
			var hr := _h(heights, w, d, i + 1, j)
			var hdn := _h(heights, w, d, i, j - 1)
			var hup := _h(heights, w, d, i, j + 1)
			var n := Vector3(hl - hr, 2.0 * res, hdn - hup).normalized()
			normals.append(n)
			# Colour by wetness (near the stream), height and slope.
			var sd := field.stream_distance(x, z)
			var slope := 1.0 - n.y            # 0 flat .. up to ~1 steep
			var col := grass
			if sd < field.stream_half_width() + 1.2:
				col = wet.lerp(bank, clampf(sd / (field.stream_half_width() + 1.2), 0.0, 1.0))
			elif y > 1.6:
				col = grass.lerp(grass_dry, clampf((y - 1.6) / 4.0, 0.0, 1.0))
			if slope > 0.22:
				col = col.lerp(soil, clampf((slope - 0.22) / 0.5, 0.0, 1.0))
			# Subtle deterministic mottle so it never reads as a flat fill.
			var mottle := 0.94 + 0.06 * (sin(x * 0.7) * sin(z * 0.7) * 0.5 + 0.5)
			colors.append(Color(col.r * mottle, col.g * mottle, col.b * mottle))
	for j in d - 1:
		for i in w - 1:
			var a := j * w + i
			var b := a + 1
			var c := a + w
			var e := c + 1
			# Wind so the front face points UP (CCW from above) — otherwise the
			# terrain is back-face culled and the player sees the sky through it.
			indices.append_array([a, b, c, b, e, c])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = normals
	arr[Mesh.ARRAY_COLOR] = colors
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.name = "TerrainMesh"
	mi.mesh = mesh
	mi.material_override = _terrain_material()
	return mi

## Textured ground material: a real grass/soil PBR albedo, TRIPLANAR-mapped in
## world space (so it tiles naturally across the terrain and doesn't stretch on
## slopes, with no per-vertex UVs). Vertex colours multiply it for wet/dry/slope
## variation. Never white. Cached so the whole terrain shares one material.
static var _terrain_mat: StandardMaterial3D
static func _terrain_material() -> StandardMaterial3D:
	if _terrain_mat != null:
		return _terrain_mat
	var m := StandardMaterial3D.new()
	m.albedo_texture = load("res://assets/textures/terrain/ground_grass.png") as Texture2D
	# World-planar UVs are baked into the mesh (universally supported on Mobile),
	# so no triplanar (which failed to sample and left the ground white).
	var nrm := load("res://assets/textures/terrain/ground_grass_normal.png") as Texture2D
	if nrm != null:
		m.normal_enabled = true
		m.normal_texture = nrm
		m.normal_scale = 0.8
	m.vertex_color_use_as_albedo = true         # multiplies the texture (wet/dry)
	m.roughness = 1.0
	m.metallic = 0.0
	_terrain_mat = m
	return m

static func _build_collider(heights: PackedFloat32Array, w: int, d: int,
		min_x: float, min_z: float, max_x: float, max_z: float, res: float) -> CollisionShape3D:
	var shape := HeightMapShape3D.new()
	shape.map_width = w
	shape.map_depth = d
	shape.map_data = heights
	var cs := CollisionShape3D.new()
	cs.name = "TerrainCollision"
	cs.shape = shape
	# HeightMapShape spans local ±(w-1)/2 in X and ±(d-1)/2 in Z at unit spacing;
	# scale to `res` and centre on the sampled area so it matches the mesh exactly.
	cs.scale = Vector3(res, 1.0, res)
	cs.position = Vector3((min_x + max_x) * 0.5, 0.0, (min_z + max_z) * 0.5)
	return cs
