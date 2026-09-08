extends Node3D
## M2.4-B hero village — a small, deliberately composed Japanese mountain
## village staged for on-device visual review. Two fidelity tiers, one art
## direction (ARCHITECTURE.md fidelity hierarchy):
##
##   HERO       — the two original Meshy houses (House A / House B). Highest
##                fidelity, fully PLAYABLE.
##   VILLAGE    — the three imported GLB village houses (House 3 / 4 / 7):
##                real high-quality Japanese rural models, normalised to
##                believable size, staged around the hero pair. Some enterable,
##                some solid — all with mesh-derived compound box collision.
##
## M2.4-D.2 — FLOATING SKY-TOWN: the ground is a finite island (TerrainField
## drops it into open sky past its core radius), so there is no BACKGROUND
## silhouette tier any more (a distant backdrop would float in the void) — the
## horizon is open sky. A ring of invisible collision panels (`_island_barrier`)
## sits on the cliff shoulder so the player stays on the plateau, and pines edge
## the rim so the drop-off reads as a forested island edge.
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
##
## M2.4-D vegetation rule: ALL visible plants and rocks are owner-supplied GLBs
## (see PropKit's SAKURA_*/PINE/GRASS_CLUMP/FLOWERS/RIVER_ROCKS/PATH_ROCKS),
## staged intentionally in _place_vegetation. NO procedural/primitive vegetation
## or rocks are created here any more — no VegetationField MultiMesh grass, no
## BlockoutUtil sphere-blob trees, no SphereMesh bank rocks. The broad lawn is
## the textured terrain itself; the BACKGROUND house silhouettes remain as the
## cheap distant horizon.

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
# M2.4-D.2 — FLOATING SKY-TOWN: the terrain is a finite island around the village
# (TerrainField drops it into open sky past its core radius), so the bounds are
# pulled in tight to the village — just past the cliff — and the horizon is sky,
# not distant hills. Centred on the village centre (0,-14).
const TERR_MIN := Vector2(-134.0, -148.0)
const TERR_MAX := Vector2(134.0, 120.0)
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
	_build_lanes()
	_place_props()      # M2.4-C dressing: real GLB structure props staged by area
	_place_vegetation() # M2.4-D: ONLY owner-supplied vegetation + rock GLBs
	_island_barrier()   # M2.4-D.2: invisible rim wall so nobody walks off into the sky

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

# --- STREAM (M2.4-C) --------------------------------------------------------

## A curved stream following STREAM: a water ribbon at WATER_Y (mobile water
## shader) + channel exclusions so nothing sits in the water. The banks are
## dressed with the real river-rock GLB in _place_vegetation (ZONE-STREAM), and
## the crossing is the real bridge (placed in _place_props) — no procedural bank
## rocks or reeds any more.
func _build_stream() -> void:
	_build_water_ribbon()
	_add_stream_exclusions()

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

# --- FLOATING-ISLAND EDGE BARRIER -------------------------------------------
#
# The village now sits on a finite island that falls into open sky (see
# TerrainField). A ring of INVISIBLE collision panels just inside the cliff rim
# keeps the player on the plateau — a natural island edge, not an arbitrary
# mid-field wall. (The old BACKGROUND house-silhouette tier was removed: on a
# sky-town the horizon is open sky, so distant backdrop houses would float in
# the void.)
func _island_barrier() -> void:
	var c := _terrain.village_center()
	var r := _terrain.island_core_radius() + 6.0   # just out on the cliff shoulder
	var body := StaticBody3D.new()
	body.name = "IslandEdge"
	var segs := 72
	for i in segs:
		var ang := TAU * float(i) / float(segs)
		var p := c + Vector2(cos(ang), sin(ang)) * r
		var y := _g(p.x, p.y)
		var cs := CollisionShape3D.new()
		var box := BoxShape3D.new()
		var chord := TAU * r / float(segs) + 0.6   # overlap so there are no gaps
		box.size = Vector3(chord, 6.0, 1.2)
		cs.shape = box
		cs.position = Vector3(p.x, y + 2.5, p.y)
		cs.rotation = Vector3(0.0, -ang, 0.0)       # face the panel tangent to the ring
		body.add_child(cs)
	add_child(body)

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

# --- M2.4-C dressing props (real GLB assets, staged by area) ----------------
#
# Every prop is a reusable PropKit instance (shared mesh/material via the
# resource cache), grounded onto the terrain (base at the terrain height) with
# simple collision only where it matters. Placed in intentional AREAS, not
# scattered uniformly; larger props register a vegetation exclusion so grass
# doesn't grow through them.

## Place one grounded prop. `s` uniform scale; `collide`/`cap` per PropKit;
## `y_off` raises it (e.g. a hung lantern); `lod` fades big vegetation; `excl`
## carves a grass-exclusion square of that size.
func _prop(path: String, x: float, z: float, yaw: float, s: float,
		collide: String = "", cap: float = 0.0, y_off: float = 0.0,
		lod: float = 0.0, excl: float = 0.0) -> void:
	var n := PropKit.make(path, s, collide, cap, lod)
	n.position = Vector3(x, _g(x, z) + y_off, z)
	n.rotation_degrees = Vector3(0.0, yaw, 0.0)
	add_child(n)
	if excl > 0.0:
		_excl.append(Rect2(x - excl * 0.5, z - excl * 0.5, excl, excl))

## A CONTIGUOUS fence run from (x0,z0) to (x1,z1): panels are stepped by their
## own width so they join edge-to-edge (no gaps) and face along the run.
func _fence(path: String, x0: float, z0: float, x1: float, z1: float, s: float) -> void:
	var pw := maxf(PropKit.footprint(path, s).x, 0.2)
	var run := Vector2(x1 - x0, z1 - z0)
	var total := run.length()
	var dir := run / maxf(total, 0.001)
	var yaw := rad_to_deg(atan2(-dir.y, dir.x))
	var n := maxi(int(round(total / pw)), 1)
	for i in n:
		var c := Vector2(x0, z0) + dir * (pw * (float(i) + 0.5))
		_prop(path, c.x, c.y, yaw, s, "box", 0.0, 0.0, 0.0, 1.0)

## A hung lantern on a simple wooden lamp-post (so it never floats).
func _lamp(x: float, z: float) -> void:
	var y := _g(x, z)
	add_child(BlockoutUtil.static_box_mat(
		Vector3(0.12, 2.4, 0.12), Vector3(x, y + 1.2, z), MaterialLibrary.get_mat(&"wood_dark")))
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(0.5, 0.1, 0.12), Vector3(x + 0.18, y + 2.3, z), MaterialLibrary.get_mat(&"wood_dark")))
	_prop(PropKit.LANTERN, x + 0.3, z, 0.0, 0.5, "", 0.0, 1.95)

func _place_props() -> void:
	# ZONE 1 — VILLAGE ENTRANCE (south bank, by the spawn) ------------------
	_prop(PropKit.SIGNPOST, 2.6, 18.2, -20.0, 0.85, "post", 0.0, 0.0, 0.0, 1.0)
	_lamp(-2.2, 17.4)
	_lamp(3.0, 16.2)
	# (Entrance trees + blossoms are vegetation — see _place_vegetation ZONE-A.)

	# ZONE 2 — STREAM / BRIDGE ---------------------------------------------
	# Bridge across the crossing (span along Z, the path direction).
	_prop(PropKit.BRIDGE, 0.0, 13.5, 90.0, 2.6, "deck", 0.15, 0.0, 0.0, 3.0)
	_prop(PropKit.BENCH, 6.0, 15.4, 200.0, 0.85, "box", 0.5, 0.0, 0.0, 1.6)
	_prop(PropKit.BENCH, -6.2, 15.8, 150.0, 0.85, "box", 0.5, 0.0, 0.0, 1.6)
	_lamp(2.0, 15.6)
	# (River rocks + bankside blossoms are vegetation — see _place_vegetation.)

	# ZONE 3 — RESIDENTIAL LANE + GARDENS (around the houses) --------------
	# House E (east, ~ x23,z-1): garden with fence, planters, tools.
	_fence(PropKit.FENCE_LOW, 18.0, 4.0, 26.0, 4.0, 0.85)
	_prop(PropKit.PLANTER, 19.0, 3.0, 0.0, 0.35)
	_prop(PropKit.PLANTER, 20.2, 3.0, 0.0, 0.35)
	_prop(PropKit.FARM_TOOLS, 21.5, 3.2, 30.0, 0.30)
	_prop(PropKit.DRYING_RACK, 26.5, -1.0, -80.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)

	# House B area (~ x11,z-8): storage shed + baskets + firewood.
	_prop(PropKit.STORAGE_SHED, 15.5, -2.0, -110.0, 1.5, "box", 0.0, 0.0, 0.0, 3.4)
	_prop(PropKit.BASKETS, 13.0, -3.5, 0.0, 0.55, "", 0.0, 0.0, 0.0, 1.2)
	_prop(PropKit.FIREWOOD_RACK, 14.0, -12.5, 20.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)

	# House A area (~ x-3,z-1) central: a lived-in yard.
	_prop(PropKit.BASKETS, -4.5, 2.2, 40.0, 0.5)
	_prop(PropKit.PLANTER, -1.6, 2.6, 0.0, 0.35)
	_lamp(2.4, 3.2)

	# Houses D/F (west, ~ x-22..-26): fenced gardens, firewood, drying, tools.
	_fence(PropKit.FENCE_TALL, -18.0, 8.0, -25.0, 8.0, 0.8)
	_prop(PropKit.FIREWOOD_RACK, -18.5, -12.0, -30.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)
	_prop(PropKit.DRYING_RACK, -21.0, 3.5, 15.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)
	_prop(PropKit.PLANTER, -24.0, 8.8, 0.0, 0.35)
	_prop(PropKit.FARM_TOOLS, -19.5, 5.0, -20.0, 0.30)

	# Houses G/H (north-west, ~ x21/-23, z-23..-28): farm props.
	_prop(PropKit.STORAGE_SHED, 22.0, -22.0, 120.0, 1.5, "box", 0.0, 0.0, 0.0, 3.4)
	_prop(PropKit.DRYING_RACK, -24.0, -22.0, 40.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)
	_prop(PropKit.FIREWOOD_RACK, -26.0, -30.0, 50.0, 1.0, "box", 0.0, 0.0, 0.0, 2.4)
	_prop(PropKit.BASKETS, 20.0, -25.0, 10.0, 0.55)

	# Lane lanterns + stone paving at intersections + a fork signpost.
	_lamp(-1.0, -6.0)
	_lamp(1.0, -18.0)
	_prop(PropKit.STONE_PAVING, 1.0, -1.0, 0.0, 1.15)
	_prop(PropKit.STONE_PAVING, -1.2, -7.0, 20.0, 1.15)
	_prop(PropKit.STONE_PAVING, 0.8, -13.0, -15.0, 1.15)
	_prop(PropKit.SIGNPOST, 2.4, -1.6, 30.0, 0.85, "post", 0.0, 0.0, 0.0, 1.0)

	# ZONE 4 — MANOR FORECOURT (~ x0,z-35): a small civic space.
	_prop(PropKit.STONE_PAVING, -3.0, -30.0, 0.0, 1.2)
	_lamp(-5.5, -29.0)
	_lamp(5.5, -29.0)
	# (Forecourt cherry + blossoms are vegetation — see _place_vegetation ZONE-D.)

# --- Vegetation (M2.4-D) ----------------------------------------------------
#
# EVERY visible plant and rock in the region is one of SEVEN owner-supplied GLBs
# (PropKit.SAKURA_*/PINE/GRASS_CLUMP/FLOWERS/RIVER_ROCKS/PATH_ROCKS). There is NO
# procedural/primitive vegetation, no MultiMesh grass field, no sphere-blob trees
# or rocks any more — the broad lawn is the textured terrain itself; plants are
# placed intentionally as landmarks, framing and selective accents. Each is a
# shared PropKit instance (no mesh/material duplication), grounded to the terrain
# and given trunk/box collision only where a body would actually block it. Big
# vegetation fades with a visibility_range LOD; import LODs keep distant copies
# cheap.

## A small natural cluster of `path` around (cx,cz): `count` copies within
## `radius`, jittered in position/scale/yaw off `seed`. For selective grass +
## flower tufts (never a uniform field). `y_off` lets a base disc sink slightly.
func _cluster(path: String, cx: float, cz: float, count: int, radius: float,
		smin: float, smax: float, lod: float, seed: int, y_off: float = 0.0) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	for i in count:
		var a := rng.randf() * TAU
		var r := radius * sqrt(rng.randf())
		var x := cx + cos(a) * r
		var z := cz + sin(a) * r
		_prop(path, x, z, rng.randf_range(0.0, 360.0), rng.randf_range(smin, smax),
			"", 0.0, y_off, lod, 0.0)

## True if (x,z) falls inside any registered exclusion (a house pad, a lane, the
## stream channel, or a placed prop) — so scattered ground cover never grows on a
## path, in a building, or in the water.
func _in_excl(x: float, z: float) -> bool:
	var p := Vector2(x, z)
	for r in _excl:
		if r.has_point(p):
			return true
	return false

## Fill the village-bounded rect [x0..x1, z0..z1] with `count` naturally jittered
## copies of `path` (grounded, LOD-faded), skipping any that land on an exclusion.
## This is how the lush countryside ground cover (grass tufts + field stones) gets
## its density WITHOUT a uniform primitive field and WITHOUT overrunning paths,
## houses or the stream. `collide`/`cap` add simple collision (used for stones).
func _scatter_field(path: String, x0: float, z0: float, x1: float, z1: float,
		count: int, smin: float, smax: float, lod: float, seed: int,
		y_off: float = 0.0, collide: String = "", cap: float = 0.0) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var placed := 0
	var tries := 0
	while placed < count and tries < count * 8:
		tries += 1
		var x := rng.randf_range(x0, x1)
		var z := rng.randf_range(z0, z1)
		if _in_excl(x, z):
			continue
		_prop(path, x, z, rng.randf_range(0.0, 360.0), rng.randf_range(smin, smax),
			collide, cap, y_off, lod, 0.0)
		placed += 1

func _place_vegetation() -> void:
	# ZONE-A — ENTRANCE: a hero cherry landmark + framing pines + welcome blossoms.
	_prop(PropKit.SAKURA_LARGE, -7.5, 20.5, 20.0, 3.0, "post", 0.0, 0.0, 170.0, 3.0)
	_prop(PropKit.PINE, 9.5, 20.5, -30.0, 3.6, "post", 0.0, 0.0, 160.0, 2.5)
	_prop(PropKit.PINE, -12.0, 18.0, 15.0, 3.3, "post", 0.0, 0.0, 160.0, 2.5)
	_cluster(PropKit.FLOWERS, -4.5, 18.0, 2, 1.0, 0.32, 0.42, 45.0, 6001)
	_cluster(PropKit.FLOWERS, 5.0, 18.6, 2, 1.0, 0.32, 0.42, 45.0, 6002)
	_cluster(PropKit.GRASS_CLUMP, 2.6, 16.4, 3, 1.2, 0.26, 0.36, 42.0, 6003, -0.12)
	_cluster(PropKit.GRASS_CLUMP, -2.6, 15.6, 3, 1.2, 0.26, 0.36, 42.0, 6004, -0.12)

	# ZONE-STREAM — cherries by the water + river rocks lining the banks + tufts.
	_prop(PropKit.SAKURA_LARGE, 11.0, 10.5, -25.0, 2.8, "post", 0.0, 0.0, 170.0, 3.0)
	_prop(PropKit.SAKURA_LARGE, -11.5, 15.0, 30.0, 2.7, "post", 0.0, 0.0, 170.0, 3.0)
	_prop(PropKit.SAKURA_SMALL, 6.5, 16.6, 60.0, 1.5, "post", 0.0, 0.0, 150.0, 2.0)
	# River-rock GLB spreads set along the banks (following the stream centreline).
	_rocks(PropKit.RIVER_ROCKS, 8.5, 12.2, 20.0, 1.3, "box", 0.35, 2.4)
	_rocks(PropKit.RIVER_ROCKS, -8.5, 14.6, -40.0, 1.35, "box", 0.35, 2.5)
	_rocks(PropKit.RIVER_ROCKS, 15.0, 9.2, 60.0, 1.0, "", 0.0, 2.0)
	_rocks(PropKit.RIVER_ROCKS, -16.5, 15.6, 10.0, 1.1, "", 0.0, 2.1)
	_rocks(PropKit.RIVER_ROCKS, 22.5, 6.0, -20.0, 1.2, "box", 0.3, 2.3)
	_rocks(PropKit.RIVER_ROCKS, -22.0, 16.6, 45.0, 1.0, "", 0.0, 2.0)
	_cluster(PropKit.GRASS_CLUMP, 12.0, 12.0, 4, 2.0, 0.24, 0.34, 45.0, 6011, -0.12)
	_cluster(PropKit.GRASS_CLUMP, -12.0, 15.5, 4, 2.0, 0.24, 0.34, 45.0, 6012, -0.12)
	_cluster(PropKit.FLOWERS, 7.5, 15.4, 2, 1.2, 0.30, 0.40, 42.0, 6013)

	# ZONE-GARDENS — selective grass + flowers inside the fenced house yards.
	_cluster(PropKit.FLOWERS, 24.0, 3.6, 3, 1.2, 0.30, 0.42, 42.0, 6021)   # east garden
	_cluster(PropKit.GRASS_CLUMP, 17.5, 3.0, 3, 1.4, 0.24, 0.34, 42.0, 6022, -0.12)
	_cluster(PropKit.FLOWERS, -20.0, 9.4, 3, 1.4, 0.30, 0.42, 42.0, 6023)  # west garden
	_cluster(PropKit.GRASS_CLUMP, -18.5, 6.5, 3, 1.4, 0.24, 0.34, 42.0, 6024, -0.12)
	_prop(PropKit.SAKURA_SMALL, 22.8, 6.2, 40.0, 1.4, "post", 0.0, 0.0, 150.0, 2.0)
	_prop(PropKit.SAKURA_SMALL, -23.0, 10.2, -20.0, 1.4, "post", 0.0, 0.0, 150.0, 2.0)
	_cluster(PropKit.GRASS_CLUMP, -3.5, 1.2, 3, 1.4, 0.24, 0.34, 42.0, 6025, -0.12)  # central yard
	_prop(PropKit.SAKURA_SMALL, -4.0, 4.2, 15.0, 1.4, "post", 0.0, 0.0, 150.0, 2.0)

	# ZONE-D — MANOR FORECOURT: a big cherry landmark + flanking blossoms.
	_prop(PropKit.SAKURA_LARGE, 5.5, -34.0, -10.0, 3.0, "post", 0.0, 0.0, 170.0, 3.0)
	_prop(PropKit.SAKURA_SMALL, -6.0, -33.0, 25.0, 1.5, "post", 0.0, 0.0, 150.0, 2.0)
	_cluster(PropKit.FLOWERS, -7.0, -28.0, 2, 1.2, 0.30, 0.42, 42.0, 6031)
	_cluster(PropKit.FLOWERS, 7.0, -28.0, 2, 1.2, 0.30, 0.42, 42.0, 6032)

	# ZONE-PATHS — flat flagstone edging set beside the lanes (decorative, no coll).
	for e in [[2.4, -1.0, 0.0], [-2.6, -7.0, 20.0], [2.0, -13.0, -15.0],
			[-2.6, -19.0, 10.0], [1.8, -25.0, -20.0], [10.0, -3.2, 40.0],
			[-13.0, -11.0, -30.0], [2.6, 17.4, 0.0], [-2.6, 17.4, 12.0]]:
		_prop(PropKit.PATH_ROCKS, e[0], e[1], e[2], 0.85)

	# ZONE-GROUND — LUSH COUNTRYSIDE COVER (kept AROUND the village, not the whole
	# map): dense grass tufts + plenty of natural field stones, scattered with
	# jitter over the reachable valley and automatically skipping houses, lanes,
	# the stream and placed props (via _in_excl). Everything is a shared GLB
	# instance with a tight LOD so the density stays cheap on mobile.
	# Flowers — colour accents sprinkled through the grass.
	_scatter_field(PropKit.FLOWERS, -40.0, -50.0, 40.0, 22.0, 34, 0.26, 0.42, 40.0, 7110)
	# Natural field stones — LOTS, mostly small + decorative, worked across the
	# whole island floor, a few larger with simple box collision.
	_scatter_field(PropKit.RIVER_ROCKS, -46.0, -60.0, 46.0, 34.0, 34, 0.45, 0.9, 65.0, 7120)
	_scatter_field(PropKit.PATH_ROCKS, -46.0, -60.0, 46.0, 34.0, 26, 0.5, 0.95, 60.0, 7122)
	_scatter_field(PropKit.RIVER_ROCKS, -20.0, -4.0, 24.0, 20.0, 14, 0.5, 0.9, 65.0, 7121)
	# A few larger river-boulder spreads as landmarks in the open ground.
	_rocks(PropKit.RIVER_ROCKS, -14.0, -2.0, 25.0, 1.2, "box", 0.35, 2.3)
	_rocks(PropKit.RIVER_ROCKS, 19.0, -16.0, -35.0, 1.15, "box", 0.35, 2.2)
	_rocks(PropKit.RIVER_ROCKS, -9.0, -30.0, 60.0, 1.1, "box", 0.3, 2.1)
	_rocks(PropKit.RIVER_ROCKS, 30.0, 4.0, 15.0, 1.15, "box", 0.3, 2.2)
	_rocks(PropKit.RIVER_ROCKS, -34.0, -10.0, -50.0, 1.1, "box", 0.3, 2.1)

	# ZONE-FOREST — the big island top is FORESTED with the supplied tree + grass
	# GLBs, GPU-instanced (GlbScatter chunked MultiMesh) so a phone can draw a
	# large dense-looking woodland: only near chunks render, distant ones cull, and
	# the grass-textured terrain greens everything in between. The hand-placed
	# village core (inside VILLAGE_RADIUS) is kept clear of the auto-forest.
	var vc := _terrain.village_center()
	var vr := _terrain.village_radius()
	var core := _terrain.island_core_radius()
	# Six framing pines (WITH trunk collision) right at the village edge.
	for f in [[-20.0, -6.0, 3.4], [22.0, -10.0, 3.6], [-26.0, -24.0, 3.8],
			[26.0, -26.0, 3.8], [-16.0, 9.0, 3.0], [18.0, 12.0, 3.0]]:
		_prop(PropKit.PINE, f[0], f[1], 0.0, f[2], "post", 0.0, 0.0, 160.0, 2.5)
	var box := Rect2(vc - Vector2(core, core), Vector2(core * 2.0, core * 2.0))
	# Pine woodland ringing the village out to the rim (decorative MultiMesh, no
	# per-tree collision — the edge barrier keeps the player in).
	add_child(GlbScatter.scatter(PropKit.PINE, box.position.x, box.position.y,
		box.end.x, box.end.y, 30.0, 3, 3.0, 4.8, 78.0, 5201, _excl,
		vc, vr + 2.0, core - 3.0))
	# Sakura sprinkled lightly through the woodland for colour.
	add_child(GlbScatter.scatter(PropKit.SAKURA_SMALL, box.position.x, box.position.y,
		box.end.x, box.end.y, 46.0, 1, 1.8, 2.8, 95.0, 5202, _excl,
		vc, vr + 8.0, core - 8.0))
	# Grass tufts across the WHOLE island top (village included), tight LOD so the
	# heavy clumps only render near the player; the terrain texture covers the rest.
	add_child(GlbScatter.scatter(PropKit.GRASS_CLUMP, box.position.x, box.position.y,
		box.end.x, box.end.y, 15.0, 4, 0.22, 0.42, 26.0, 5203, _excl,
		vc, 0.0, core - 2.0, 0.12))

## A river/path rock GLB spread grounded on the terrain (box collision optional).
func _rocks(path: String, x: float, z: float, yaw: float, s: float,
		collide: String, cap: float, excl: float) -> void:
	_prop(path, x, z, yaw, s, collide, cap, 0.0, 110.0, excl)
