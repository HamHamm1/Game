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
## M2.4-D.3 — SMALL LOCAL GROUND: the terrain is a compact, gentle, near-flat
## patch covering only the playable village; beyond it is open sky (no island,
## no cliff, no surrounding plane, no distant terrain, no BACKGROUND silhouette
## tier). A ring of invisible collision panels (`_play_boundary`) at the ground
## edge keeps the player in the local area, so the village reads as a small place
## inside a much larger unseen world. All vegetation is the supplied GLBs, kept
## inside the patch.
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
const NPC_PROTO := "res://src/npc/npc_prototype.tscn"   # M2.5 first NPC prototype

## Lighting-profile tag read by RegionLightingController (M2.2). Residential.
@export var lighting_category: StringName = &"residential"

# M2.4-C — terrain area (metres) + the stream centreline (curved, threaded
# through the open foreground between the spawn and the houses so it never
# crosses a building pad). Water surface sits at TerrainField.WATER_Y.
# M2.4-D.3 — SMALL LOCAL GROUND: the terrain is a compact, gentle, near-flat
# patch covering ONLY the playable village (houses, paths, stream). No island,
# no cliff, no surrounding plane, no distant terrain — the mesh just ends at the
# village bounds and everything beyond is open sky. Bounds are pulled in tight
# around the houses + stream (the stream flows off the east edge into the unseen
# world). Centred ~ the village.
const TERR_MIN := Vector2(-42.0, -54.0)
const TERR_MAX := Vector2(44.0, 26.0)
const TERR_RES := 2.5
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
var _house_centers: Array[Vector2] = []
var _nav: NpcNavigation

# M2.4-D.4 — path centrelines (also drive the terrain gravel zone + path-edge
# rocks + vegetation exclusions) and cultivated garden discs (farming-soil zone).
static var LANES := [
	{"pts": [Vector2(0, 17.6), Vector2(0, 13.0), Vector2(0.5, 9.4), Vector2(-1.5, 4.0),
		Vector2(1.0, -1.0), Vector2(-1.2, -7.0), Vector2(0.8, -13.0), Vector2(1.6, -19.0),
		Vector2(-0.6, -25.0), Vector2(-4.0, -32.0)], "w": 2.6},
	{"pts": [Vector2(1.0, -1.0), Vector2(7.0, -2.0), Vector2(13.0, -3.5)], "w": 2.0},
	{"pts": [Vector2(-1.2, -7.0), Vector2(-9.0, -9.0), Vector2(-17.0, -12.0)], "w": 2.0},
	{"pts": [Vector2(-0.6, -25.0), Vector2(-6.0, -29.0)], "w": 2.0},
]
static var GARDENS := [
	{"c": Vector2(22.0, 4.0), "r": 4.2},
	{"c": Vector2(-21.0, 8.0), "r": 4.6},
	{"c": Vector2(-3.5, 2.6), "r": 3.4},
]

func _ready() -> void:
	# Terrain first: configure the height field with a flat, levelled pad under
	# each house (so every approved house stays grounded) + the carved stream,
	# then register it as the ground provider so the chunked vegetation follows.
	_terrain = TerrainField.new()
	var pads := _house_pads()
	for p in pads:
		_house_centers.append(p["center"])
	_terrain.configure(pads, STREAM)
	GroundSampler.set_height_provider(_terrain.height_at)
	add_child(TerrainBuilder.build(_terrain, TERR_MIN.x, TERR_MIN.y, TERR_MAX.x, TERR_MAX.y,
		TERR_RES, _zone_weights))

	# Player starts to the south, looking north across the stream to the village.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, _g(0.0, 17.0) + 0.2, 17.0))
	_place_glb_houses()
	_build_stream()
	_build_lanes()
	_place_props()      # M2.4-C dressing: real GLB structure props staged by area
	_place_vegetation() # M2.4-D: ONLY owner-supplied vegetation + rock GLBs
	_play_boundary()    # M2.4-D.3: invisible edge wall at the small ground's rim
	_build_navigation() # M2.5.1: village navmesh from terrain + collider footprints
	_place_npc()        # M2.5: one high-fidelity NPC prototype (now autonomous)

## Clear the global ground provider when this region leaves the tree, so nothing
## keeps sampling this terrain after it is unloaded (and headless tests stay flat).
func _exit_tree() -> void:
	if GroundSampler.has_height_provider():
		GroundSampler.clear_height_provider()

## Terrain height at world XZ (convenience for grounding props/paths/dressing).
func _g(x: float, z: float) -> float:
	return _terrain.height_at(x, z) if _terrain != null else 0.0

# --- 8-texture ground zones (M2.4-D.4) --------------------------------------
#
# Per-vertex weights for the eight ground textures, blended by terrain_splat.
# Slots: 0 grass · 1 dry soil · 2 gravel · 3 moist soil · 4 farming soil ·
#        5 fallen leaves · 6 river rock · 7 path-edge rock. Natural material
# zones (worn paths, wet riverbanks, cultivated gardens, maintained yards,
# forest-edge leaf litter) melt together; a little value noise breaks the
# boundaries so there are no square patches. Returns raw weights (the shader
# normalizes).
func _dist_to_lanes(x: float, z: float) -> Dictionary:
	var best := 1.0e9
	var wid := 2.4
	var p := Vector2(x, z)
	for lane in LANES:
		var pts: Array = lane["pts"]
		for i in pts.size() - 1:
			var d := _seg_dist(p, pts[i], pts[i + 1])
			if d < best:
				best = d
				wid = float(lane["w"])
	return {"d": best, "w": wid}

func _seg_dist(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.0001:
		return p.distance_to(a)
	return p.distance_to(a + ab * clampf((p - a).dot(ab) / l2, 0.0, 1.0))

func _zone_weights(x: float, z: float) -> PackedFloat32Array:
	var p := Vector2(x, z)
	# deterministic value noise to soften every boundary
	var n := 0.5 + 0.5 * sin(x * 0.7 + z * 0.9) * cos(x * 0.5 - z * 0.6)
	var half := _terrain.stream_half_width()
	var ds := _terrain.stream_distance(x, z)
	var lane := _dist_to_lanes(x, z)
	var dp: float = lane["d"]
	var pw: float = float(lane["w"]) * 0.5

	var w := PackedFloat32Array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
	# 6 river rock — in/at the channel; 3 moist soil — the wet bank just beyond.
	var river := smoothstep(half + 1.4 + n * 0.6, half - 0.4, ds)
	var moist := clampf(smoothstep(half + 5.0, half + 0.8, ds) - river, 0.0, 1.0)
	# 2 gravel — worn path; 7 path-edge rock — a thin irregular band along it.
	var gravel := smoothstep(pw + 0.5 + n * 0.4, pw - 0.5, dp)
	var pathrock := clampf(smoothstep(pw + 1.5 + n * 0.6, pw + 0.3, dp) - gravel, 0.0, 1.0) * 0.7
	# 4 farming soil — cultivated garden discs.
	var farm := 0.0
	for gd in GARDENS:
		farm = maxf(farm, smoothstep(float(gd["r"]) + 1.2, float(gd["r"]) - 0.8, p.distance_to(gd["c"])))
	# 1 dry soil — maintained/worn ground around the houses (yards).
	var dry := 0.0
	for c in _house_centers:
		dry = maxf(dry, smoothstep(9.0, 3.0, p.distance_to(c)))
	dry *= 0.75 * (0.7 + 0.6 * n)
	# 5 fallen leaves — the outer forest-edge ring (under the pines).
	var dc := p.distance_to(_terrain.village_center())
	var leaves := smoothstep(24.0, 34.0, dc) * (0.5 + 0.5 * n)

	w[6] = river * 1.4
	w[3] = moist
	w[2] = gravel * 1.4
	w[7] = pathrock
	w[4] = farm
	w[1] = dry
	w[5] = leaves * 0.7
	# 0 grass — fills whatever the zones above leave, so most open ground reads as
	# short grass with soil showing through (never a bare single fill).
	var taken := w[1] + w[2] + w[3] + w[4] + w[5] + w[6] + w[7]
	w[0] = maxf(0.12, 1.1 - taken) * (0.75 + 0.5 * n)
	return w

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

# --- PLAY-AREA BOUNDARY ------------------------------------------------------
#
# The village sits on a small local ground patch (see TerrainField); beyond it is
# open sky. A ring of INVISIBLE collision panels at the edge of the patch keeps
# the player inside the local area (so nobody walks off the ground into the
# empty surrounding space). No visible geometry — just the boundary.
func _play_boundary() -> void:
	var c := _terrain.village_center()
	var r := _terrain.play_radius()   # the edge of the walkable ground
	var body := StaticBody3D.new()
	body.name = "PlayBoundary"
	var segs := 64
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
	# The paths are now the terrain's GRAVEL texture zone (see _zone_weights /
	# LANES) with path-edge rocks along them — no raised grey slabs. This pass only
	# registers the vegetation exclusions along every lane so grass/flowers never
	# grow in the middle of a walking route (the route stays readable + clear).
	for lane in LANES:
		var pts: Array = lane["pts"]
		var w: float = float(lane["w"])
		for i in pts.size() - 1:
			var a: Vector2 = pts[i]
			var b: Vector2 = pts[i + 1]
			var steps := maxi(int(a.distance_to(b) / (w * 0.5)), 1)
			for s in steps + 1:
				var c := a.lerp(b, float(s) / float(steps))
				_excl.append(Rect2(c.x - w * 0.5, c.y - w * 0.5, w, w))

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

	# Lane lanterns + a fork signpost (the path itself is the terrain gravel zone).
	_lamp(-1.0, -6.0)
	_lamp(1.0, -18.0)
	_prop(PropKit.SIGNPOST, 2.4, -1.6, 30.0, 0.85, "post", 0.0, 0.0, 0.0, 1.0)

	# ZONE 4 — MANOR FORECOURT (~ x0,z-35): a small civic space.
	_lamp(-5.5, -29.0)
	_lamp(5.5, -29.0)
	# (Forecourt cherry + blossoms are vegetation — see _place_vegetation ZONE-D.)

# --- NPC prototype (M2.5) ---------------------------------------------------

# --- NPC navigation + placement (M2.5 / M2.5.1) -----------------------------

## Safe destination anchors the roaming brain seeds from (open village spaces:
## House A yard, central yard, path bends, stream-side, bridge approach, garden
## edges). Each is jittered + validated walkable at runtime, so routes vary.
static var NPC_ANCHORS := [
	Vector2(4.5, 4.0), Vector2(0.0, 1.0), Vector2(-6.0, 7.0), Vector2(9.0, 5.0),
	Vector2(-13.0, 3.0), Vector2(2.0, -8.0), Vector2(-2.0, -18.0), Vector2(12.0, -2.0),
	Vector2(-16.0, -6.0), Vector2(0.0, 12.0),
]

## Build the reusable village NavigationService from the existing terrain + real
## collider footprints (houses via their level pads, solid props via their
## PropCollision bodies), the stream, and the play-area disc. Nothing inside a
## house becomes walkable; the NPC's physics capsule is the second safety net.
func _build_navigation() -> void:
	_nav = NpcNavigation.new()
	_nav.name = "NpcNavigation"
	add_child(_nav)
	_nav.configure(_g, _terrain.stream_distance, _terrain.stream_half_width(),
		_terrain.village_center(), _terrain.play_radius(),
		_house_pads(), _gather_nav_blockers(), NPC_ANCHORS)
	_nav.build()

## Solid-prop footprints (bridge deck, sheds, racks, benches, fences, big rocks,
## tree trunks, signposts) as XZ rects, from their PropKit "PropCollision" bodies,
## expanded by the agent radius so the NPC routes around them.
func _gather_nav_blockers() -> Array:
	var out: Array = []
	for body in _find_all_named(self, "PropCollision"):
		var b := body as StaticBody3D
		if b == null:
			continue
		for cs in b.get_children():
			if cs is CollisionShape3D and (cs as CollisionShape3D).shape is BoxShape3D:
				out.append(_box_world_rect(cs as CollisionShape3D, 0.4))
	return out

## World-space XZ Rect2 of a box collider (accounts for rotation), padded by the
## agent radius so the NPC routes cleanly around the prop.
func _box_world_rect(cs: CollisionShape3D, pad: float) -> Rect2:
	var half := ((cs.shape as BoxShape3D).size) * 0.5
	var xf := cs.global_transform
	var min_x := INF
	var max_x := -INF
	var min_z := INF
	var max_z := -INF
	for sx: float in [-1.0, 1.0]:
		for sy: float in [-1.0, 1.0]:
			for sz: float in [-1.0, 1.0]:
				var p := xf * Vector3(half.x * sx, half.y * sy, half.z * sz)
				min_x = minf(min_x, p.x); max_x = maxf(max_x, p.x)
				min_z = minf(min_z, p.z); max_z = maxf(max_z, p.z)
	return Rect2(min_x - pad, min_z - pad, (max_x - min_x) + pad * 2.0, (max_z - min_z) + pad * 2.0)

func _find_all_named(n: Node, nm: String) -> Array:
	var out: Array = []
	if n.name == nm:
		out.append(n)
	for c in n.get_children():
		out.append_array(_find_all_named(c, nm))
	return out

## Place ONE high-fidelity NPC prototype in the central yard (off the main path,
## not blocking any house entrance), grounded on the terrain, and give it the
## autonomous roaming brain wired to the village navigation. The environment is
## not rearranged for it.
func _place_npc() -> void:
	var packed := load(NPC_PROTO) as PackedScene
	if packed == null:
		return
	var npc := packed.instantiate() as NpcPrototype
	var x := 4.6
	var z := 4.2
	npc.display_name = "Haruki"
	npc.position = Vector3(x, _g(x, z), z)
	npc.rotation_degrees = Vector3(0.0, 0.0, 0.0)   # front (+Z) toward the entrance/bridge
	add_child(npc)
	var brain := NpcRoaming.new()
	brain.name = "NpcRoaming"
	npc.add_child(brain)
	if _nav != null:
		brain.setup(_nav, 91771)
	_excl.append(Rect2(x - 1.3, z - 1.3, 2.6, 2.6))

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

## A loose cluster of SMALL pines (the pine GLB at reduced scale) around (cx,cz):
## irregular spacing/scale/rotation, trunk collision, kept off exclusions.
func _small_pines(cx: float, cz: float, count: int, radius: float, seed: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	for i in count:
		var a := rng.randf() * TAU
		var r := radius * sqrt(rng.randf())
		var x := cx + cos(a) * r
		var z := cz + sin(a) * r
		if _in_excl(x, z):
			continue
		_prop(PropKit.PINE, x, z, rng.randf_range(0.0, 360.0),
			rng.randf_range(1.5, 2.4), "post", 0.0, 0.0, 120.0, 1.6)

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
	# Keep every scattered item inside the small ground patch (never out toward the
	# open-sky edge).
	var pc := _terrain.village_center()
	var pr := _terrain.play_radius() - 1.5
	while placed < count and tries < count * 8:
		tries += 1
		var x := rng.randf_range(x0, x1)
		var z := rng.randf_range(z0, z1)
		if Vector2(x, z).distance_to(pc) > pr:
			continue
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
	# Heavier concentration flanking the bridge approaches (a focal point).
	_rocks(PropKit.RIVER_ROCKS, 3.2, 12.0, 10.0, 1.25, "box", 0.35, 2.3)
	_rocks(PropKit.RIVER_ROCKS, -3.4, 15.4, -30.0, 1.2, "box", 0.35, 2.2)
	_rocks(PropKit.RIVER_ROCKS, 2.2, 16.2, 70.0, 0.85, "", 0.0, 1.6)
	_rocks(PropKit.RIVER_ROCKS, -2.0, 11.6, 120.0, 0.9, "", 0.0, 1.7)
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

	# ZONE-BACKGROUND — a believable village silhouette from LARGE pines massed
	# behind the houses (north edge), asymmetric, varied scale — depth, not a wall.
	# Large sakura are woven in so the far skyline shows blossom too.
	for bp in [[-30.0, -46.0, 4.6], [-22.0, -49.0, 4.2], [-13.0, -47.0, 4.8],
			[6.0, -48.0, 4.4], [16.0, -46.0, 4.9], [27.0, -47.0, 4.3], [33.0, -40.0, 4.0]]:
		_prop(PropKit.PINE, bp[0], bp[1], randf() * 360.0, bp[2], "post", 0.0, 0.0, 150.0, 2.5)
	_prop(PropKit.SAKURA_LARGE, -34.0, -30.0, -20.0, 3.1, "post", 0.0, 0.0, 170.0, 3.0)
	_prop(PropKit.SAKURA_LARGE, 33.0, -22.0, 40.0, 3.0, "post", 0.0, 0.0, 170.0, 3.0)
	# Extra foreground large sakura framing the entrance view (asymmetric pair).
	_prop(PropKit.SAKURA_LARGE, 14.0, 22.0, -35.0, 3.2, "post", 0.0, 0.0, 170.0, 3.0)

	# SMALL PINES — the pine GLB at a smaller scale, in loose 2–4 clusters filling
	# midground/background gaps (varied spacing/rotation, clear of paths/houses).
	_small_pines(-33.0, 2.0, 3, 5.0, 8401)
	_small_pines(29.0, -8.0, 3, 5.5, 8402)
	_small_pines(-30.0, -40.0, 4, 6.0, 8403)
	_small_pines(24.0, -38.0, 3, 5.0, 8404)
	_small_pines(-18.0, 16.0, 2, 4.0, 8405)

	# GROUND FLOWERS — a few extra small natural clusters (not a uniform field);
	# most flowers are the hand-placed clusters by houses/paths/river/sakura above.
	_scatter_field(PropKit.FLOWERS, -34.0, -44.0, 34.0, 20.0, 14, 0.26, 0.42, 40.0, 7110)

	# ZONE-FOREST — LOCAL vegetation only, kept INSIDE the small ground patch (no
	# forest filling the empty surrounding space). Supplied tree + grass GLBs,
	# GPU-instanced (GlbScatter chunked MultiMesh, tight LOD) so it stays cheap on
	# mobile. The grass-textured terrain greens the patch; nothing is placed beyond
	# the play radius (so it can't spill into the open sky around the village).
	var vc := _terrain.village_center()
	var play := _terrain.play_radius()
	# Framing pines (WITH trunk collision) at the village edge.
	for f in [[-20.0, -6.0, 3.4], [22.0, -10.0, 3.6], [-26.0, -24.0, 3.8],
			[26.0, -26.0, 3.8], [-16.0, 9.0, 3.0], [18.0, 12.0, 3.0]]:
		_prop(PropKit.PINE, f[0], f[1], 0.0, f[2], "post", 0.0, 0.0, 140.0, 2.5)
	var box := Rect2(vc - Vector2(play, play), Vector2(play * 2.0, play * 2.0))
	# A light ring of pines just inside the ground edge to frame the village (no
	# per-tree collision — the play boundary keeps the player in).
	add_child(GlbScatter.scatter(PropKit.PINE, box.position.x, box.position.y,
		box.end.x, box.end.y, 26.0, 2, 3.0, 4.4, 90.0, 5201, _excl,
		vc, play - 16.0, play - 1.5))
	# Grass tufts across the patch (village included), tight LOD so the heavy
	# clumps only render near the player; the terrain texture covers the rest.
	add_child(GlbScatter.scatter(PropKit.GRASS_CLUMP, box.position.x, box.position.y,
		box.end.x, box.end.y, 16.0, 3, 0.22, 0.42, 26.0, 5203, _excl,
		vc, 0.0, play - 1.5, 0.12))

## A river/path rock GLB spread grounded on the terrain (box collision optional).
func _rocks(path: String, x: float, z: float, yaw: float, s: float,
		collide: String, cap: float, excl: float) -> void:
	_prop(path, x, z, yaw, s, collide, cap, 0.0, 110.0, excl)
