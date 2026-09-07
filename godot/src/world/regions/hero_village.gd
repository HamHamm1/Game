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

## Place one hero house: grounded, rotated, on a centred stone plinth, with a
## front-door LocationEntryPoint (the EXISTING entry system) if `interior` is
## given. The Meshy house extends +x/+z from its local origin, so the footprint
## centre and the +z front face are computed from the collider footprint.
func _hero_house(path: String, pos: Vector3, yaw_deg: float, width: float,
		interior: String, prompt: String) -> void:
	var h := HeroAsset.make_house(path, width, true)
	h.position = pos
	h.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(h)
	var fp := HeroAsset.footprint_of(h)

	# Front door slab on the +z face (proud of the box collider so the
	# interaction raycast reaches it), carried by the house so it rotates with
	# the yaw. NOTE: which painted facade this lands on is asset-dependent and
	# wants on-device confirmation; functionally the door is reachable + enters.
	var door := BlockoutUtil.static_box_mat(
		Vector3(1.2, 2.3, 0.18), Vector3(fp.x * 0.5, 1.15, fp.y + 0.12),
		MaterialLibrary.get_mat(&"wood_door"))
	h.add_child(door)
	if not interior.is_empty():
		var entry := LocationEntryPoint.new()
		entry.location_scene = interior
		entry.spawn_name = "PlayerSpawn"
		entry.prompt = prompt
		door.add_child(entry)

	# Stone plinth centred under the house footprint (rotated to match).
	var basis := Basis(Vector3.UP, deg_to_rad(yaw_deg))
	var center := pos + basis * Vector3(fp.x * 0.5, 0.0, fp.y * 0.5)
	var plinth := BlockoutUtil.static_box_mat(
		Vector3(fp.x + 1.2, 0.3, fp.y + 1.2), center + Vector3(0.0, 0.15, 0.0),
		MaterialLibrary.get_mat(&"stone"))
	plinth.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(plinth)

	var pad := maxf(fp.x, fp.y) + 2.5
	_excl.append(Rect2(center.x - pad * 0.5, center.z - pad * 0.5, pad, pad))

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
