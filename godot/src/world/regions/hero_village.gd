extends Node3D
## M2.4-B hero village — a small, deliberately composed Japanese mountain
## village staged for on-device visual review. Three fidelity tiers, one art
## direction (ARCHITECTURE.md fidelity hierarchy):
##
##   HERO       — the two original Meshy houses (House A / House B). Highest
##                fidelity, fully PLAYABLE.
##   VILLAGE    — the three imported GLB village houses (House 3 / 4 / 7):
##                real high-quality Japanese rural models, normalised to
##                believable size, staged around the hero pair. Some enterable,
##                some solid — all with mesh-derived compound box collision.
##   BACKGROUND — cheapest tier: JapaneseHouseKit primitive silhouettes (no
##                collision, visibility-range LOD) on raised mounds far behind
##                the village, kept as cheap distant geometry for mobile perf.
##
## EVERY hero + village house is a real GLB placed through one code path
## (`_glb_house`): grounded, uniformly scaled to a target width, with the
## entrance + collision DERIVED FROM THE ACTUAL MESH (GLB_PROFILES — real
## door/wall lines measured off offscreen orthographic renders), never guessed
## from the bounding box. The entry point is an INVISIBLE trigger at the real
## doorway (the EXISTING LocationEntryPoint → world_root → house_interior_wood
## system); collision is a simple compound of invisible boxes leaving the
## doorway clear; the render mesh is never used as collision.
##
## Composition: curved stone lanes, clustered houses at varied setbacks/facing,
## foreground gardens, mounds for depth, and SELECTIVE dressing (fences,
## firewood, lanterns, pots — not prop spam). Uses M2.2 lighting + M2.3 weather
## unchanged (they attach at world_root); this region supplies geometry + a tag.

const HOUSE_A := "res://assets/meshes/houses/house_a.glb"
const HOUSE_B := "res://assets/meshes/houses/house_b.glb"
const HOUSE_3 := "res://assets/meshes/houses/village_house3.glb"
const HOUSE_4 := "res://assets/meshes/houses/village_house4.glb"
const HOUSE_7 := "res://assets/meshes/houses/village_house7.glb"
const INTERIOR := "res://src/world/locations/house_interior_wood.tscn"

## Lighting-profile tag read by RegionLightingController (M2.2). Residential.
@export var lighting_category: StringName = &"residential"

# M2.4-C — terrain area (metres) + the stream centreline (curved, threaded
# through the open foreground between the spawn and the houses so it never
# crosses a building pad). Water surface sits at TerrainField.WATER_Y.
const TERR_MIN := Vector2(-130.0, -150.0)
const TERR_MAX := Vector2(130.0, 70.0)
const TERR_RES := 3.0
static var STREAM := PackedVector2Array([
	Vector2(40.0, -12.0), Vector2(34.0, -6.0), Vector2(28.0, 1.0), Vector2(21.0, 7.0),
	Vector2(12.0, 11.0), Vector2(1.0, 13.5), Vector2(-11.0, 14.5), Vector2(-18.0, 15.5),
	Vector2(-29.0, 16.5),
])

## The 8 approved houses (A–H), every one enterable. [path, pos, yaw, prompt].
const HOUSE_LAYOUT := [
	[HOUSE_A, Vector3(-7.5, 0.0, -3.0), 22.0, "Enter house"],
	[HOUSE_B, Vector3(8.0, 0.0, -13.0), -38.0, "Enter house"],
	[HOUSE_4, Vector3(-6.5, 0.0, -42.0), 5.0, "Enter hall"],
	[HOUSE_3, Vector3(-28.0, 0.0, -16.0), 32.0, "Enter house"],
	[HOUSE_3, Vector3(18.0, 0.0, -6.0), -40.0, "Enter house"],
	[HOUSE_3, Vector3(-26.0, 0.0, 6.0), 10.0, "Enter house"],
	[HOUSE_7, Vector3(15.0, 0.0, -28.0), -28.0, "Enter house"],
	[HOUSE_7, Vector3(-30.0, 0.0, -34.0), 48.0, "Enter house"],
]

var _excl: Array[Rect2] = []
var _terrain: TerrainField

func _ready() -> void:
	# Terrain first: configure the height field with a flat, levelled pad under
	# each house (so every approved house stays grounded) + the carved stream,
	# then register it as the ground provider so the chunked vegetation follows.
	_terrain = TerrainField.new()
	_terrain.configure(_house_pads(), STREAM)
	GroundSampler.set_height_provider(_terrain.height_at)
	add_child(TerrainBuilder.build(_terrain, TERR_MIN.x, TERR_MIN.y, TERR_MAX.x, TERR_MAX.y, TERR_RES))

	# Player starts to the south, looking north across the stream to the village.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, _g(0.0, 17.0) + 0.2, 17.0))
	_place_glb_houses()
	_build_stream()
	_build_background()
	_build_lanes()
	_build_dressing()
	_build_vegetation()

## Clear the global ground provider when this region leaves the tree, so nothing
## keeps sampling this terrain after it is unloaded (and headless tests stay flat).
func _exit_tree() -> void:
	if GroundSampler.has_height_provider():
		GroundSampler.clear_height_provider()

## Terrain height at world XZ (convenience for grounding props/paths/dressing).
func _g(x: float, z: float) -> float:
	return _terrain.height_at(x, z) if _terrain != null else 0.0

## Compute a flat levelling pad {center, radius} under each house from its real
## footprint, so the terrain is level where houses stand (no tilt/sink/float).
func _house_pads() -> Array:
	var pads: Array = []
	for e in HOUSE_LAYOUT:
		var c := _house_center(e[0], e[1], e[2])
		var fp := _house_footprint(e[0])
		pads.append({"center": Vector2(c.x, c.z), "radius": 0.5 * maxf(fp.x, fp.y) + 2.5})
	return pads

func _house_center(path: String, pos: Vector3, yaw_deg: float) -> Vector3:
	var fp := _house_footprint(path)
	var basis := Basis(Vector3.UP, deg_to_rad(yaw_deg))
	return pos + basis * Vector3(fp.x * 0.5, 0.0, fp.y * 0.5)

func _house_footprint(path: String) -> Vector2:
	var m := HeroAsset.aabb_and_scale(path, float(GLB_PROFILES[path]["width"]))
	var aabb: AABB = m["aabb"]
	var s: float = m["scale"]
	return Vector2(aabb.size.x * s, aabb.size.z * s)

# --- HERO + VILLAGE tier (real GLB houses) ---------------------------------
#
# Every hero + village house is a real imported GLB, placed through ONE builder.
# The entrance + collision are DERIVED FROM THE ACTUAL MESH, not the bounding
# box: these houses have deep eaves + a recessed veranda, so the AABB front face
# is up to ~1.5 m proud of the true door (a slab there floats). Each house has a
# measured profile of real wall/door lines in RAW mesh space (read off rendered
# orthographic elevations), mapped into built node space via
# HeroAsset.aabb_and_scale (node = (raw - aabb.position) * scale). From it we
# build an INVISIBLE entry trigger AT the real doorway (no visible slab) + a
# simple compound of INVISIBLE box colliders (back + 2 sides + 2 front pieces)
# leaving the doorway gap + veranda clear so the player reaches the actual door.
# The render mesh is never used as collision. Front is local +z for all of them.

## Measured real-geometry profile per GLB house, in RAW mesh coordinates (metres,
## before scaling). width = target real-world width (uniform scale to it).
## x_min/x_max = enclosed wall span; z_back = rear wall; z_front = the true front
## wall / doorway line (well inside the eave); y_top = top of the collided walls
## (roof above is not collided); door_x = doorway centre in x; door_gap = clear
## doorway width. All read off orthographic elevations rendered from the GLBs.
const GLB_PROFILES := {
	HOUSE_A: {   # hero: open engawa house, wide central veranda opening
		"width": 7.6, "x_min": -0.68, "x_max": 0.68, "z_back": -0.34, "z_front": 0.47,
		"y_top": 0.11, "door_x": 0.0, "door_gap": 0.5,
	},
	HOUSE_B: {   # hero: gabled entry, door on the main block (left of +x wing)
		"width": 6.8, "x_min": -0.85, "x_max": 0.90, "z_back": -0.45, "z_front": 0.45,
		"y_top": 0.055, "door_x": -0.25, "door_gap": 0.42,
	},
	# Village widths are chosen from DOOR HEIGHT for believable human scale
	# (validated against a 1.75 m reference): a person matches the doorway, so the
	# houses no longer read as short. x_min/x_max/z_back/z_front are the real wall
	# lines, so the compound collider matches the visible walls (no walk-through).
	HOUSE_3: {   # two-storey gabled farmhouse, stepped central door
		"width": 9.0, "x_min": -0.73, "x_max": 0.75, "z_back": -0.63, "z_front": 0.49,
		"y_top": 0.45, "door_x": 0.18, "door_gap": 0.34,
	},
	HOUSE_4: {   # large manor/hall, wrap-around engawa, genkan on -x (landmark)
		"width": 13.0, "x_min": -0.80, "x_max": 0.80, "z_back": -0.60, "z_front": 0.45,
		"y_top": -0.04, "door_x": -0.17, "door_gap": 0.30,
	},
	HOUSE_7: {   # two-storey minka, -x side wing, veranda doors centre
		"width": 12.5, "x_min": -0.80, "x_max": 0.82, "z_back": -0.60, "z_front": 0.40,
		"y_top": -0.05, "door_x": 0.10, "door_gap": 0.34,
	},
}

## Place one real GLB house: grounded, rotated, on a stone plinth under the walls,
## with mesh-derived compound collision + an invisible entry trigger at the real
## doorway (the EXISTING entry system) when `interior` is given.
func _glb_house(path: String, pos: Vector3, yaw_deg: float,
		interior: String, prompt: String = "Enter house") -> void:
	var p: Dictionary = GLB_PROFILES[path]
	var width: float = p["width"]
	# collide=false: we build our own mesh-derived collider, never the AABB box.
	var h := HeroAsset.make_house(path, width, false)
	h.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	# Ground the house onto the terrain: its pad is levelled to the terrain height
	# at its centre, so the base sits flat on the pad (no tilt/sink/float).
	var center := _house_center(path, pos, yaw_deg)
	h.position = Vector3(pos.x, _g(center.x, center.z), pos.z)
	add_child(h)

	var m := HeroAsset.aabb_and_scale(path, width)
	var aabb: AABB = m["aabb"]
	var s: float = m["scale"]

	# Map the raw wall/door lines into the built house's local node space.
	var lo := (Vector3(p["x_min"], aabb.position.y, p["z_back"]) - aabb.position) * s
	var hi := (Vector3(p["x_max"], p["y_top"], p["z_front"]) - aabb.position) * s
	var doorx := (float(p["door_x"]) - aabb.position.x) * s
	var half := float(p["door_gap"]) * s * 0.5
	var mid_y := (lo.y + hi.y) * 0.5
	var mid_z := (lo.z + hi.z) * 0.5
	var wall_h := hi.y - lo.y
	const T := 0.4   # thick enough that the player can never tunnel a wall

	# Compound INVISIBLE collision (children of the house so they rotate with it).
	# Back + two sides fully enclose; two front pieces flank a clear doorway gap.
	h.add_child(_col(Vector3(hi.x - lo.x, wall_h, T), Vector3((lo.x + hi.x) * 0.5, mid_y, lo.z)))       # back
	h.add_child(_col(Vector3(T, wall_h, hi.z - lo.z), Vector3(lo.x, mid_y, mid_z)))                     # left
	h.add_child(_col(Vector3(T, wall_h, hi.z - lo.z), Vector3(hi.x, mid_y, mid_z)))                     # right
	var fl_w := maxf((doorx - half) - lo.x, 0.0)
	if fl_w > 0.05:
		h.add_child(_col(Vector3(fl_w, wall_h, T), Vector3((lo.x + (doorx - half)) * 0.5, mid_y, hi.z)))  # front-left
	var fr_w := maxf(hi.x - (doorx + half), 0.0)
	if fr_w > 0.05:
		h.add_child(_col(Vector3(fr_w, wall_h, T), Vector3(((doorx + half) + hi.x) * 0.5, mid_y, hi.z)))  # front-right

	# Invisible entry trigger sitting IN the doorway gap, slightly proud of the
	# wall line so the interaction raycast resolves it (not the flanking walls).
	if not interior.is_empty():
		var trigger := _col(Vector3(half * 2.0, wall_h, T), Vector3(doorx, mid_y, hi.z + 0.06))
		h.add_child(trigger)
		var entry := LocationEntryPoint.new()
		entry.location_scene = interior
		entry.spawn_name = "PlayerSpawn"
		entry.prompt = prompt
		trigger.add_child(entry)

	# Stone plinth under the walls (not out to the eaves), rotates with the house.
	var pc := Vector3((lo.x + hi.x) * 0.5, 0.0, (lo.z + hi.z) * 0.5)
	h.add_child(BlockoutUtil.visual_box_mat(
		Vector3((hi.x - lo.x) + 0.8, 0.3, (hi.z - lo.z) + 0.8), pc + Vector3(0.0, 0.15, 0.0),
		MaterialLibrary.get_mat(&"stone")))

	# Vegetation exclusion around the real footprint (world space).
	var world_c := h.to_global(pc)
	var pad := maxf(hi.x - lo.x, hi.z - lo.z) + 3.0
	_excl.append(Rect2(world_c.x - pad * 0.5, world_c.z - pad * 0.5, pad, pad))

## An invisible collision-only box (StaticBody3D + CollisionShape3D, no mesh).
func _col(size: Vector3, pos: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	return body

func _place_glb_houses() -> void:
	# EIGHT real houses (A–H), EVERY one enterable via the existing entry system,
	# each grounded onto its levelled terrain pad. Layout in HOUSE_LAYOUT.
	for e in HOUSE_LAYOUT:
		_glb_house(e[0], e[1], e[2], INTERIOR, e[3])

func _ground_pos(x: float, z: float, lift: float = 0.0) -> Vector3:
	return Vector3(x, _g(x, z) + lift, z)

# --- STREAM (M2.4-C) --------------------------------------------------------

## A curved stream following STREAM: a water ribbon at WATER_Y (mobile water
## shader), bank rocks + shoreline reeds, and stepping stones across the crossing.
## Adds channel exclusions so vegetation never grows in the water.
func _build_stream() -> void:
	_build_water_ribbon()
	_add_stream_exclusions()
	_build_shoreline()
	_build_stepping_stones()

func _water_material() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load("res://src/world/shaders/stream_water.gdshader")
	return m

func _stream_tangent(i: int) -> Vector2:
	if i == 0:
		return (STREAM[1] - STREAM[0]).normalized()
	if i == STREAM.size() - 1:
		return (STREAM[i] - STREAM[i - 1]).normalized()
	return (STREAM[i + 1] - STREAM[i - 1]).normalized()

func _build_water_ribbon() -> void:
	var half := _terrain.stream_half_width()
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var idx := PackedInt32Array()
	var run := 0.0
	for i in STREAM.size():
		var c := STREAM[i]
		var nrm := Vector2(-_stream_tangent(i).y, _stream_tangent(i).x)
		# Independent, varying left/right widths -> irregular natural shoreline.
		var wl := half * (0.95 + 0.35 * sin(float(i) * 1.3) + 0.18 * sin(float(i) * 2.7))
		var wr := half * (0.95 + 0.32 * cos(float(i) * 1.1) + 0.18 * sin(float(i) * 3.1))
		var lp := c + nrm * wl
		var rp := c - nrm * wr
		verts.append(Vector3(lp.x, TerrainField.WATER_Y, lp.y))
		verts.append(Vector3(rp.x, TerrainField.WATER_Y, rp.y))
		normals.append(Vector3.UP)
		normals.append(Vector3.UP)
		uvs.append(Vector2(0.0, run * 0.12))
		uvs.append(Vector2(1.0, run * 0.12))
		if i > 0:
			var b := (i - 1) * 2
			idx.append_array([b, b + 2, b + 1, b + 1, b + 2, b + 3])
		if i < STREAM.size() - 1:
			run += c.distance_to(STREAM[i + 1])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = normals
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.name = "StreamWater"
	mi.mesh = mesh
	mi.material_override = _water_material()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

## Exclude the water channel from vegetation placement (reeds still grow on the
## banks, just outside this radius).
func _add_stream_exclusions() -> void:
	var r := _terrain.stream_half_width() + 0.6
	for c in STREAM:
		_excl.append(Rect2(c.x - r, c.y - r, r * 2.0, r * 2.0))

## Bank rocks (wet near the water, drier higher) + shoreline reeds/wet grass.
func _build_shoreline() -> void:
	var half := _terrain.stream_half_width()
	var rng := RandomNumberGenerator.new()
	rng.seed = 8801
	for i in STREAM.size():
		var c := STREAM[i]
		var nrm := Vector2(-_stream_tangent(i).y, _stream_tangent(i).x)
		for sgn: float in [-1.0, 1.0]:
			# a wet stone at the waterline + a drier rock a little up the bank
			var wet_p := c + nrm * (sgn * (half + rng.randf_range(-0.2, 0.4)))
			_bank_rock(wet_p, rng.randf_range(0.5, 0.95), true)
			if rng.randf() < 0.6:
				var dry_p := c + nrm * (sgn * (half + rng.randf_range(1.4, 2.4)))
				_bank_rock(dry_p, rng.randf_range(0.4, 0.7), false)
			# reeds / wet grass just beyond the waterline (deterministic field)
			var reed_c := c + nrm * (sgn * (half + 1.3))
			add_child(VegetationField.scatter(&"grass", &"reed",
				Vector3(reed_c.x, 0.0, reed_c.y), 2.0, 2.0, 26, 5100 + i * 7 + int(sgn),
				1.1, 2.0, 55.0, _excl))
			add_child(VegetationField.scatter(&"shrub", &"shrub",
				Vector3(reed_c.x, 0.0, reed_c.y), 2.2, 2.2, 5, 5300 + i * 7 + int(sgn),
				0.8, 1.2, 70.0, _excl))

## A river rock: a flattened low-poly sphere grounded on the terrain, wet (sheened,
## dark, near the water) or dry. Larger ones get a simple box collider.
func _bank_rock(p: Vector2, scale: float, wet: bool) -> void:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = scale
	sm.height = scale * 1.3
	sm.radial_segments = 7
	sm.rings = 4
	mi.mesh = sm
	mi.material_override = MaterialLibrary.get_mat(&"wet_stone" if wet else &"river_rock")
	var y := _g(p.x, p.y)
	mi.position = Vector3(p.x, y + scale * 0.25, p.y)
	mi.scale = Vector3(1.15, 0.7, 1.15)
	add_child(mi)
	if scale > 0.7:
		var body := _col(Vector3(scale * 2.0, scale * 1.0, scale * 2.0),
			Vector3(p.x, y + scale * 0.35, p.y))
		add_child(body)
	_excl.append(Rect2(p.x - scale, p.y - scale, scale * 2.0, scale * 2.0))

## Stepping stones across the crossing near x≈0 (level, walkable, simple boxes).
func _build_stepping_stones() -> void:
	var pts := [
		Vector2(0.0, 16.4), Vector2(-0.5, 14.9), Vector2(0.5, 13.4),
		Vector2(-0.3, 11.9), Vector2(0.2, 10.4),
	]
	for p in pts:
		# Top a touch above the bank so the crossing stays dry; tall enough to reach
		# down into the (now deeper) channel bed rather than float over the water.
		var top := 0.14
		var stone := BlockoutUtil.static_box_mat(
			Vector3(1.35, 1.8, 1.35), Vector3(p.x, top - 0.9, p.y),
			MaterialLibrary.get_mat(&"wet_stone"))
		add_child(stone)
		_excl.append(Rect2(p.x - 0.9, p.y - 0.9, 1.8, 1.8))

# --- BACKGROUND tier (cheap, unreachable, on the mounds) --------------------

func _build_background() -> void:
	# A seeded arc of backdrop houses on the rear + flanking mounds. Cheap
	# geometry, no collision, visibility-range LOD. Varied archetype + yaw so
	# the silhouette never repeats obviously.
	var rng := RandomNumberGenerator.new()
	rng.seed = 20456
	var specs := [
		JapaneseHouseKit.house_c(), JapaneseHouseKit.house_e(),
		JapaneseHouseKit.house_f(), JapaneseHouseKit.house_d(),
	]
	# Rear ridge line — out on the distant rising terrain, grounded to it.
	for i in 11:
		var t := float(i) / 10.0
		var x := lerpf(-40.0, 40.0, t) + rng.randf_range(-3.0, 3.0)
		var z := -58.0 - rng.randf_range(0.0, 9.0)
		var spec: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		_bg_house(spec, Vector2(x, z), rng.randf_range(-40.0, 40.0))
	# Left + right flank hills, angled inward.
	for i in 5:
		var z := lerpf(-42.0, 2.0, float(i) / 4.0) + rng.randf_range(-2.0, 2.0)
		var spec_l: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		var spec_r: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		_bg_house(spec_l, Vector2(-52.0 + rng.randf_range(-3.0, 3.0), z), rng.randf_range(50.0, 90.0))
		_bg_house(spec_r, Vector2(52.0 + rng.randf_range(-3.0, 3.0), z), rng.randf_range(-90.0, -50.0))

func _bg_house(spec: JapaneseHouseKit.Spec, xz: Vector2, yaw_deg: float) -> void:
	var node := JapaneseHouseKit.background_house(spec, 340.0)
	node.position = Vector3(xz.x, _g(xz.x, xz.y), xz.y)
	node.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(node)

# --- Lanes ------------------------------------------------------------------

func _build_lanes() -> void:
	# A rural circulation network conforming to the terrain: from the entrance to
	# the stream crossing (the stepping stones bridge the channel), on through the
	# village with branches to the house clusters and up to the manor. Curved,
	# never a straight ribbon; stones are visual-only and grounded to the terrain.
	_lane([Vector2(0, 17.6), Vector2(0, 16.0)], 2.6)                                  # entrance -> crossing
	_lane([Vector2(0.5, 9.4), Vector2(-1.5, 4.0), Vector2(1.0, -1.0), Vector2(-1.2, -7.0),
		Vector2(0.8, -13.0), Vector2(1.6, -19.0), Vector2(-0.6, -25.0), Vector2(-4.0, -32.0)], 2.6)  # crossing -> manor
	_lane([Vector2(1.0, -1.0), Vector2(7.0, -2.0), Vector2(13.0, -3.5)], 2.0)         # branch east (House E)
	_lane([Vector2(-1.2, -7.0), Vector2(-9.0, -9.0), Vector2(-17.0, -12.0)], 2.0)     # branch west (Houses D/F)
	_lane([Vector2(-0.6, -25.0), Vector2(-6.0, -29.0)], 2.0)                          # manor forecourt

func _lane(pts: Array, w: float) -> void:
	for p in pts:
		var xz := p as Vector2
		add_child(BlockoutUtil.visual_box_mat(
			Vector3(w, 0.06, w), Vector3(xz.x, _g(xz.x, xz.y) + 0.04, xz.y),
			MaterialLibrary.get_mat(&"path")))
		_excl.append(Rect2(xz.x - w * 0.5, xz.y - w * 0.5, w, w))

# --- Selective dressing -----------------------------------------------------

func _build_dressing() -> void:
	# A firewood stack + a stone lantern by the lower cluster; a low fence run
	# edging the lane; a couple of flower pots + a water bucket at doorsteps.
	_firewood(_ground_pos(-10.5, 6.0))
	_firewood(_ground_pos(12.5, -1.5))
	_lantern(_ground_pos(2.6, 3.0))
	_lantern(_ground_pos(-2.4, -9.0))
	_lantern(_ground_pos(5.0, -17.0))
	_fence_run(_ground_pos(-6.0, -20.0), Vector3(1.0, 0.0, 0.0), 6, 1.1)
	_fence_run(_ground_pos(6.0, -24.0), Vector3(0.0, 0.0, -1.0), 5, 1.1)
	_pot(_ground_pos(-12.6, 8.4))
	_pot(_ground_pos(15.6, 0.6))
	_pot(_ground_pos(7.4, -25.6))
	_bucket(_ground_pos(-15.4, -9.6))

func _firewood(pos: Vector3) -> void:
	var wood := MaterialLibrary.get_mat(&"wood_door")
	for row in 3:
		for col in 4:
			add_child(BlockoutUtil.visual_box_mat(
				Vector3(0.9, 0.16, 0.16),
				pos + Vector3(0.0, 0.12 + row * 0.17, -0.5 + col * 0.18), wood))

func _lantern(pos: Vector3) -> void:
	var stone := MaterialLibrary.get_mat(&"stone")
	add_child(BlockoutUtil.static_box_mat(Vector3(0.32, 0.4, 0.32), pos + Vector3(0.0, 0.2, 0.0), stone))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.16, 0.5, 0.16), pos + Vector3(0.0, 0.65, 0.0), stone))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.44, 0.34, 0.44), pos + Vector3(0.0, 1.05, 0.0), stone))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.5, 0.14, 0.5), pos + Vector3(0.0, 1.28, 0.0),
		MaterialLibrary.get_mat(&"roof_dark")))

func _fence_run(start: Vector3, dir: Vector3, count: int, gap: float) -> void:
	var trim := MaterialLibrary.get_mat(&"wood_dark")
	var d := dir.normalized()
	for i in count:
		var p := start + d * (i * gap)
		add_child(BlockoutUtil.visual_box_mat(Vector3(0.1, 1.0, 0.1), p + Vector3(0.0, 0.5, 0.0), trim))
	# Two horizontal rails between the posts.
	var mid := start + d * ((count - 1) * gap * 0.5)
	var length := (count - 1) * gap
	var horiz := Vector3(absf(d.x) * length + 0.1, 0.08, absf(d.z) * length + 0.1)
	add_child(BlockoutUtil.visual_box_mat(horiz, mid + Vector3(0.0, 0.75, 0.0), trim))
	add_child(BlockoutUtil.visual_box_mat(horiz, mid + Vector3(0.0, 0.4, 0.0), trim))

func _pot(pos: Vector3) -> void:
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.34, 0.34, 0.34), pos + Vector3(0.0, 0.17, 0.0),
		MaterialLibrary.get_mat(&"roof_warm")))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.4, 0.16, 0.4), pos + Vector3(0.0, 0.42, 0.0),
		MaterialLibrary.get_mat(&"foliage")))

func _bucket(pos: Vector3) -> void:
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.3, 0.3, 0.3), pos + Vector3(0.0, 0.15, 0.0),
		MaterialLibrary.get_mat(&"wood_dark")))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.26, 0.04, 0.26), pos + Vector3(0.0, 0.3, 0.0),
		MaterialLibrary.get_mat(&"water")))

# --- Vegetation -------------------------------------------------------------

func _veg(species: StringName, mat: StringName, center: Vector3, hx: float, hz: float,
		base: int, seed: int, smin: float, smax: float, end_dist: float) -> void:
	add_child(VegetationField.scatter(species, mat, center, hx, hz, base, seed, smin, smax,
		end_dist, _excl))

func _build_vegetation() -> void:
	# Broad grass lawn across the reachable valley — CHUNKED into tiles with
	# overlapping fade so the cover stays continuous around the player and never
	# pops on the sides while walking (the previous single-field pop-in bug).
	# Exclusions carve houses, lanes + dressing out of it.
	add_child(VegetationField.scatter_tiled(&"grass", &"grass_blade",
		-46.0, -52.0, 46.0, 20.0, 12.0, 0.42, 3001, 0.8, 1.35, 80.0, _excl))
	# Framing + hillside trees (varied silhouette/scale) for the mountain feel,
	# each grounded to the terrain.
	var trees := [
		[-20.0, -6.0, 1.6, 0], [20.0, 0.0, 1.7, 2], [-15.0, 9.0, 1.2, 1],
		[16.0, -24.0, 1.8, 0], [-23.0, -20.0, 2.0, 1], [24.0, -12.0, 1.9, 1],
		[-28.0, -30.0, 2.4, 1], [28.0, -30.0, 2.4, 1], [-9.0, 13.0, 1.3, 2],
		[10.0, 14.0, 1.4, 0],
	]
	for t in trees:
		BlockoutUtil.add_tree(self, _ground_pos(t[0], t[1]), t[2], t[3])
	# Forest edge: denser conifers on the rising rear + flank terrain, grounded.
	for i in 11:
		var x := lerpf(-42.0, 42.0, float(i) / 10.0)
		BlockoutUtil.add_tree(self, _ground_pos(x, -66.0 - float(i % 3) * 3.0), 2.6, 1)
	for i in 6:
		var z := lerpf(-44.0, 4.0, float(i) / 5.0)
		BlockoutUtil.add_tree(self, _ground_pos(-50.0, z), 2.4, 1)
		BlockoutUtil.add_tree(self, _ground_pos(50.0, z), 2.4, 1)
	# Distant forest silhouettes on the surrounding hills — big conifers ringing
	# the valley so the horizon reads as forest/hills, not a bright empty void.
	var vc := Vector2(0.0, -14.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9137
	for i in 40:
		var ang := TAU * float(i) / 40.0
		var rad := rng.randf_range(82.0, 116.0)
		var x := vc.x + cos(ang) * rad
		var z := vc.y + sin(ang) * rad
		if x < TERR_MIN.x + 6.0 or x > TERR_MAX.x - 6.0 or z < TERR_MIN.y + 6.0 or z > TERR_MAX.y - 6.0:
			continue
		BlockoutUtil.add_tree(self, _ground_pos(x, z), rng.randf_range(3.0, 4.6), 1, 600.0)
	# Foreground garden detail near the lanes: ferns, blooms, rocks, shrubs.
	_veg(&"fern", &"fern", Vector3(4.5, 0.0, 6.0), 3.5, 4.0, 30, 3002, 0.8, 1.2, 55.0)
	_veg(&"flower", &"flower_vcol", Vector3(-5.5, 0.0, 4.0), 3.5, 3.0, 34, 3003, 0.8, 1.2, 40.0)
	_veg(&"flower", &"flower_vcol", Vector3(6.0, 0.0, -20.0), 3.0, 3.0, 22, 3006, 0.8, 1.2, 40.0)
	_veg(&"rock", &"rock", Vector3(-4.0, 0.0, 9.0), 4.0, 3.0, 12, 3004, 0.7, 1.6, 95.0)
	_veg(&"shrub", &"shrub", Vector3(6.0, 0.0, -7.0), 4.5, 3.5, 14, 3005, 0.8, 1.2, 80.0)
	_veg(&"shrub", &"shrub", Vector3(-16.0, 0.0, -16.0), 3.5, 3.5, 10, 3007, 0.8, 1.2, 80.0)
