class_name TerrainBuilder
extends RefCounted
## M2.4-C/D — builds the walkable terrain from a TerrainField: a vertex-blended
## ArrayMesh (EIGHT ground textures blended by natural zones — see
## terrain_splat.gdshader) plus a matching HeightMapShape3D collider sampled from
## the SAME height function on the SAME grid, so the player can never fall through
## or float. Cheap for the Mobile renderer: one mesh, one heightmap body.
##
## Each vertex carries eight normalized zone weights, supplied by a caller
## `weight_fn(x, z) -> PackedFloat32Array` of length 8 in this slot order:
##   0 grass · 1 dry soil · 2 gravel · 3 moist soil ·
##   4 farming soil · 5 fallen leaves · 6 river rock · 7 path-edge rock
## (0-3 are baked into ARRAY_COLOR, 4-7 into ARRAY_CUSTOM0). If no weight_fn is
## given every vertex falls back to full grass.

const TEXROOT := "res://assets/textures/terrain/"
const TEX := [
	"grd_grass.png", "grd_dry_soil.png", "grd_gravel.png", "grd_moist_soil.png",
	"grd_farming_soil.png", "grd_leaves.png", "grd_river_rock.png", "grd_path_rock.png",
]

## Build the terrain as a StaticBody3D (heightmap collider) with the visual mesh
## as a child. `res` is the grid spacing in metres. `weight_fn` supplies the
## per-vertex 8-texture zone weights (see class docs).
static func build(field: TerrainField, min_x: float, min_z: float,
		max_x: float, max_z: float, res: float = 2.0, weight_fn: Callable = Callable()) -> StaticBody3D:
	var w := int(round((max_x - min_x) / res)) + 1
	var d := int(round((max_z - min_z) / res)) + 1

	var heights := PackedFloat32Array()
	heights.resize(w * d)
	for j in d:
		for i in w:
			heights[j * w + i] = field.height_at(min_x + i * res, min_z + j * res)

	var body := StaticBody3D.new()
	body.name = "Terrain"
	body.add_child(_build_mesh(field, heights, w, d, min_x, min_z, res, weight_fn))
	body.add_child(_build_collider(heights, w, d, min_x, min_z, max_x, max_z, res))
	return body

static func _h(heights: PackedFloat32Array, w: int, d: int, i: int, j: int) -> float:
	return heights[clampi(j, 0, d - 1) * w + clampi(i, 0, w - 1)]

static func _grass_weights() -> PackedFloat32Array:
	return PackedFloat32Array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])

static func _build_mesh(field: TerrainField, heights: PackedFloat32Array,
		w: int, d: int, min_x: float, min_z: float, res: float, weight_fn: Callable) -> MeshInstance3D:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()       # weights 0-3
	var custom := PackedFloat32Array()     # weights 4-7 (RGBA float)
	var indices := PackedInt32Array()
	for j in d:
		for i in w:
			var x := min_x + i * res
			var z := min_z + j * res
			verts.append(Vector3(x, heights[j * w + i], z))
			var hl := _h(heights, w, d, i - 1, j)
			var hr := _h(heights, w, d, i + 1, j)
			var hdn := _h(heights, w, d, i, j - 1)
			var hup := _h(heights, w, d, i, j + 1)
			normals.append(Vector3(hl - hr, 2.0 * res, hdn - hup).normalized())
			var wv: PackedFloat32Array = weight_fn.call(x, z) if weight_fn.is_valid() else _grass_weights()
			if wv.size() < 8:
				wv = _grass_weights()
			colors.append(Color(wv[0], wv[1], wv[2], wv[3]))
			custom.append_array([wv[4], wv[5], wv[6], wv[7]])
	for j in d - 1:
		for i in w - 1:
			var a := j * w + i
			var b := a + 1
			var c := a + w
			var e := c + 1
			# Wind so the front face points UP (CCW from above), else back-face culled.
			indices.append_array([a, b, c, b, e, c])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = normals
	arr[Mesh.ARRAY_COLOR] = colors
	arr[Mesh.ARRAY_CUSTOM0] = custom
	arr[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	var fmt := Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, fmt)
	var mi := MeshInstance3D.new()
	mi.name = "TerrainMesh"
	mi.mesh = mesh
	mi.material_override = _terrain_material()
	return mi

## 8-texture splat material (terrain_splat.gdshader). Cached so the whole terrain
## shares one material; textures loaded once.
static var _terrain_mat: ShaderMaterial
static func _terrain_material() -> ShaderMaterial:
	if _terrain_mat != null:
		return _terrain_mat
	var m := ShaderMaterial.new()
	m.shader = load("res://src/world/shaders/terrain_splat.gdshader")
	var names := ["tex_grass", "tex_dry", "tex_gravel", "tex_moist",
		"tex_farming", "tex_leaves", "tex_river", "tex_path"]
	for k in TEX.size():
		m.set_shader_parameter(names[k], load(TEXROOT + TEX[k]) as Texture2D)
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
	cs.scale = Vector3(res, 1.0, res)
	cs.position = Vector3((min_x + max_x) * 0.5, 0.0, (min_z + max_z) * 0.5)
	return cs
