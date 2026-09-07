extends Node3D
## M2.4-B hero village — a small, deliberately composed Japanese mountain
## village staged for on-device visual review. Three fidelity tiers, one art
## direction (ARCHITECTURE.md fidelity hierarchy):
##
##   HERO       — the two ORIGINAL Meshy houses (House A / House B). Highest
##                fidelity (2K PBR, import LODs, box collision). BOTH are now
##                fully PLAYABLE: a front-door LocationEntryPoint loads the
##                shared wood interior via the EXISTING building entry system
##                (world_root handles the teleport + return).
##   VILLAGE    — modular JapaneseHouseKit houses (C/D/E/F archetypes) built
##                from primitives + the shared MaterialLibrary. Same palette,
##                different architecture. Some are enterable (optional
##                interior), some solid — all collidable, one box collider each.
##   BACKGROUND — cheapest kit tier: clad volume + roof, no collision,
##                visibility-range LOD, on raised mounds behind the village.
##
## Composition: curved stone lanes, clustered houses at varied setbacks/facing,
## foreground gardens, elevation (mounds), and SELECTIVE dressing (fences,
## firewood, lanterns, pots — not prop spam). Uses M2.2 lighting + M2.3 weather
## unchanged (they attach at world_root); this region supplies geometry + a tag.

const HOUSE_A := "res://assets/meshes/houses/house_a.glb"
const HOUSE_B := "res://assets/meshes/houses/house_b.glb"
const INTERIOR := "res://src/world/locations/house_interior_wood.tscn"

## Lighting-profile tag read by RegionLightingController (M2.2). Residential.
@export var lighting_category: StringName = &"residential"

var _excl: Array[Rect2] = []

func _ready() -> void:
	_build_ground()
	# Player starts to the south, looking north up the lane toward the village.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 17.0))
	_place_hero_houses()
	_place_village_houses()
	_build_background()
	_build_lanes()
	_build_dressing()
	_build_vegetation()

func _build_ground() -> void:
	# Broad walkable valley floor.
	add_child(BlockoutUtil.static_box_mat(
		Vector3(120.0, 0.4, 120.0), Vector3(0.0, -0.2, 0.0), MaterialLibrary.get_mat(&"ground")))
	# Raised mounds behind + flanking the village give the mountain-valley depth
	# the backdrop houses sit on (visual only — the player stays on the floor).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(70.0, 3.0, 16.0), Vector3(0.0, 0.6, -44.0), MaterialLibrary.get_mat(&"grass_bright")))
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(18.0, 4.5, 44.0), Vector3(-40.0, 1.0, -18.0), MaterialLibrary.get_mat(&"grass_bright")))
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(18.0, 4.5, 44.0), Vector3(40.0, 1.0, -18.0), MaterialLibrary.get_mat(&"grass_bright")))

# --- HERO tier (Meshy houses A/B) ------------------------------------------
#
# The entrance + collision for each hero house are DERIVED FROM THE ACTUAL MESH,
# not the bounding box. The real doorway of these Meshy houses sits behind a deep
# eave + veranda, so the AABB front face is ~1.5 m proud of the true door — which
# is why the earlier guessed door slab floated in front of the facade. Each house
# has a measured "profile" of real wall/door lines in RAW mesh space (read off
# rendered orthographic elevations), mapped into the built node space via
# HeroAsset.aabb_and_scale (node = (raw - aabb.position) * scale). From that we
# build: an INVISIBLE entry trigger AT the real doorway (no visible slab), and a
# simple compound of INVISIBLE box colliders (back + 2 sides + 2 front pieces)
# that leaves the doorway gap and the veranda clear so the player walks up to the
# actual door. The render mesh is never used as collision. Front is local +z for
# both houses (confirmed: back/sides are solid walls; the veranda+door is on +z).

## Measured real-geometry profile per hero house, in RAW GLB-local coordinates
## (metres, before scaling). x_min/x_max = enclosed wall span; z_back = rear wall;
## z_front = the true front wall / sliding-door line (well inside the eave);
## y_top = top of the walls (roof above is not collided); door_x = doorway centre
## in x; door_gap = clear doorway width (raw). All read off the orthographic
## elevations rendered from the actual GLBs.
const HERO_PROFILES := {
	HOUSE_A: {   # open engawa house: wide central veranda opening
		"x_min": -0.68, "x_max": 0.68, "z_back": -0.34, "z_front": 0.47,
		"y_top": 0.11, "door_x": 0.0, "door_gap": 0.5,
	},
	HOUSE_B: {   # gabled entry, door on the main block (left of the +x side wing)
		"x_min": -0.85, "x_max": 0.90, "z_back": -0.45, "z_front": 0.45,
		"y_top": 0.055, "door_x": -0.25, "door_gap": 0.42,
	},
}

## Place one hero house: grounded, rotated, on a stone plinth under the walls,
## with mesh-derived compound collision + an invisible entry trigger at the real
## doorway (the EXISTING entry system) when `interior` is given.
func _hero_house(path: String, pos: Vector3, yaw_deg: float, width: float,
		interior: String, prompt: String) -> void:
	# collide=false: we build our own mesh-derived collider, never the AABB box.
	var h := HeroAsset.make_house(path, width, false)
	h.position = pos
	h.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(h)

	var m := HeroAsset.aabb_and_scale(path, width)
	var aabb: AABB = m["aabb"]
	var s: float = m["scale"]
	var p: Dictionary = HERO_PROFILES[path]

	# Map the raw wall/door lines into the built house's local node space.
	var lo := (Vector3(p["x_min"], aabb.position.y, p["z_back"]) - aabb.position) * s
	var hi := (Vector3(p["x_max"], p["y_top"], p["z_front"]) - aabb.position) * s
	var doorx := (float(p["door_x"]) - aabb.position.x) * s
	var half := float(p["door_gap"]) * s * 0.5
	var mid_y := (lo.y + hi.y) * 0.5
	var mid_z := (lo.z + hi.z) * 0.5
	var wall_h := hi.y - lo.y
	const T := 0.3

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

func _place_hero_houses() -> void:
	# Irregular placement + rotation — never side-by-side. BOTH enterable.
	_hero_house(HOUSE_A, Vector3(-7.5, 0.0, -3.0), 22.0, 7.6, INTERIOR, "Enter house")
	_hero_house(HOUSE_B, Vector3(8.0, 0.0, -13.0), -38.0, 6.8, INTERIOR, "Enter house")

# --- VILLAGE tier (modular kit, reachable) ---------------------------------

## Build + place one kit house from a Spec. Enterable when `interior` is given.
func _kit_house(spec: JapaneseHouseKit.Spec, pos: Vector3, yaw_deg: float,
		interior: String = "", prompt: String = "Enter house") -> void:
	var node := JapaneseHouseKit.build(spec, interior, prompt)
	node.position = pos
	node.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(node)
	var fp := JapaneseHouseKit.footprint_of(spec)
	var pad := maxf(fp.x, fp.y) + 2.0
	_excl.append(Rect2(pos.x - pad * 0.5, pos.z - pad * 0.5, pad, pad))

func _place_village_houses() -> void:
	# Lower village (near the spawn) — a small welcoming cluster.
	_kit_house(JapaneseHouseKit.house_c(), Vector3(-14.0, 0.0, 7.0), 34.0, INTERIOR)
	_kit_house(JapaneseHouseKit.house_c(), Vector3(13.0, 0.0, 9.0), -26.0)
	_kit_house(JapaneseHouseKit.house_f(), Vector3(17.0, 0.0, -1.0), -58.0, INTERIOR)

	# Mid village — around the two hero houses, varied setbacks + facing.
	_kit_house(JapaneseHouseKit.house_d(), Vector3(-17.0, 0.0, -11.0), 14.0, INTERIOR)
	_kit_house(JapaneseHouseKit.house_e(), Vector3(0.5, 0.0, -21.0), 4.0)
	_kit_house(JapaneseHouseKit.house_c(), Vector3(19.0, 0.0, -18.0), -32.0)
	_kit_house(JapaneseHouseKit.house_f(), Vector3(-15.0, 0.0, -23.0), 42.0)

	# Upper village — thinning out toward the hills.
	_kit_house(JapaneseHouseKit.house_e(), Vector3(9.0, 0.0, -27.0), -18.0, INTERIOR)
	_kit_house(JapaneseHouseKit.house_c(), Vector3(-6.0, 0.0, -29.0), 16.0)
	_kit_house(JapaneseHouseKit.house_d(), Vector3(17.0, 0.0, -29.0), -36.0)

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
	# Rear ridge line.
	for i in 11:
		var t := float(i) / 10.0
		var x := lerpf(-32.0, 32.0, t) + rng.randf_range(-2.5, 2.5)
		var z := -42.0 - rng.randf_range(0.0, 7.0)
		var spec: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		_bg_house(spec, Vector3(x, 1.6, z), rng.randf_range(-40.0, 40.0))
	# Left + right flank hills, angled inward.
	for i in 5:
		var z := lerpf(-34.0, -2.0, float(i) / 4.0) + rng.randf_range(-2.0, 2.0)
		var spec_l: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		var spec_r: JapaneseHouseKit.Spec = specs[rng.randi() % specs.size()]
		_bg_house(spec_l, Vector3(-36.0 + rng.randf_range(-2.0, 2.0), 2.0, z), rng.randf_range(50.0, 90.0))
		_bg_house(spec_r, Vector3(36.0 + rng.randf_range(-2.0, 2.0), 2.0, z), rng.randf_range(-90.0, -50.0))

func _bg_house(spec: JapaneseHouseKit.Spec, pos: Vector3, yaw_deg: float) -> void:
	var node := JapaneseHouseKit.background_house(spec, 320.0)
	node.position = pos
	node.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(node)

# --- Lanes ------------------------------------------------------------------

func _build_lanes() -> void:
	# A gently curving main lane from the spawn up through the village, with a
	# short branch toward the eastern cluster. Stones are visual-only.
	var main := [
		Vector3(0.0, 0.0, 15.0), Vector3(-1.2, 0.0, 10.0), Vector3(1.0, 0.0, 5.0),
		Vector3(0.4, 0.0, 0.0), Vector3(-1.6, 0.0, -6.0), Vector3(0.2, 0.0, -12.0),
		Vector3(1.4, 0.0, -18.0), Vector3(0.0, 0.0, -24.0),
	]
	_lane(main, 2.6)
	var branch := [
		Vector3(1.0, 0.0, 5.0), Vector3(6.0, 0.0, 4.0), Vector3(11.0, 0.0, 3.5),
	]
	_lane(branch, 2.0)

func _lane(pts: Array, w: float) -> void:
	for p in pts:
		add_child(BlockoutUtil.visual_box_mat(
			Vector3(w, 0.06, w), (p as Vector3) + Vector3(0.0, 0.03, 0.0),
			MaterialLibrary.get_mat(&"path")))
		_excl.append(Rect2((p as Vector3).x - w * 0.5, (p as Vector3).z - w * 0.5, w, w))

# --- Selective dressing -----------------------------------------------------

func _build_dressing() -> void:
	# A firewood stack + a stone lantern by the lower cluster; a low fence run
	# edging the lane; a couple of flower pots + a water bucket at doorsteps.
	_firewood(Vector3(-10.5, 0.0, 6.0))
	_firewood(Vector3(12.5, 0.0, -1.5))
	_lantern(Vector3(2.6, 0.0, 3.0))
	_lantern(Vector3(-2.4, 0.0, -9.0))
	_lantern(Vector3(5.0, 0.0, -17.0))
	_fence_run(Vector3(-4.0, 0.0, 11.0), Vector3(1.0, 0.0, 0.0), 6, 1.1)
	_fence_run(Vector3(6.0, 0.0, -22.0), Vector3(0.0, 0.0, -1.0), 5, 1.1)
	_pot(Vector3(-12.6, 0.0, 8.4))
	_pot(Vector3(15.6, 0.0, 0.6))
	_pot(Vector3(7.4, 0.0, -25.6))
	_bucket(Vector3(-15.4, 0.0, -9.6))

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
	# Broad grass lawn across the reachable valley — exclusions carve houses,
	# lanes + dressing out of it.
	_veg(&"grass", &"grass_blade", Vector3(0.0, 0.0, -8.0), 30.0, 26.0, 1500, 3001, 0.8, 1.35, 46.0)
	# Framing + hillside trees (varied silhouette/scale) for the mountain feel.
	var trees := [
		[Vector3(-20.0, 0.0, -6.0), 1.6, 0], [Vector3(20.0, 0.0, 0.0), 1.7, 2],
		[Vector3(-15.0, 0.0, 9.0), 1.2, 1], [Vector3(16.0, 0.0, -24.0), 1.8, 0],
		[Vector3(-23.0, 0.0, -20.0), 2.0, 1], [Vector3(24.0, 0.0, -12.0), 1.9, 1],
		[Vector3(-28.0, 0.0, -30.0), 2.4, 1], [Vector3(28.0, 0.0, -30.0), 2.4, 1],
		[Vector3(-9.0, 0.0, 13.0), 1.3, 2], [Vector3(10.0, 0.0, 14.0), 1.4, 0],
	]
	for t in trees:
		BlockoutUtil.add_tree(self, t[0], t[1], t[2])
	# Denser conifers on the rear ridge, behind the backdrop houses.
	for i in 9:
		var x := lerpf(-30.0, 30.0, float(i) / 8.0)
		BlockoutUtil.add_tree(self, Vector3(x, 2.4, -50.0), 2.6, 1)
	# Foreground garden detail near the lanes: ferns, blooms, rocks, shrubs.
	_veg(&"fern", &"fern", Vector3(4.5, 0.0, 6.0), 3.5, 4.0, 30, 3002, 0.8, 1.2, 55.0)
	_veg(&"flower", &"flower_vcol", Vector3(-5.5, 0.0, 4.0), 3.5, 3.0, 34, 3003, 0.8, 1.2, 40.0)
	_veg(&"flower", &"flower_vcol", Vector3(6.0, 0.0, -20.0), 3.0, 3.0, 22, 3006, 0.8, 1.2, 40.0)
	_veg(&"rock", &"rock", Vector3(-4.0, 0.0, 9.0), 4.0, 3.0, 12, 3004, 0.7, 1.6, 95.0)
	_veg(&"shrub", &"shrub", Vector3(6.0, 0.0, -7.0), 4.5, 3.5, 14, 3005, 0.8, 1.2, 80.0)
	_veg(&"shrub", &"shrub", Vector3(-16.0, 0.0, -16.0), 3.5, 3.5, 10, 3007, 0.8, 1.2, 80.0)
