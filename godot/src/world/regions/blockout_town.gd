extends Node3D
## M2.1 blockout region — the MVP hub laid out per DESIGN.md §3.
## Grey-box primitives only (ART_DIRECTION.md §6 step 1, MOBILE_ART_DIRECTION.md
## §57 "blockout first"). This exists to test scale, walkability, and the
## LocationEntryPoint pattern for the real MVP slice — not to look good yet.
## Real materials/lighting/atmosphere are Phase 2 M2.2+/M2.4.
##
## The ten pieces called for by DESIGN.md §3 (all present, all grey-box):
##   1. Residential street  — the north/south stripe through the middle
##   2. Player home         — enterable, west side, LocationEntryPoint → blockout_interior
##   3. Restaurant          — enterable, east side, LocationEntryPoint → restaurant_interior
##   4. Shop                — enterable, west side, LocationEntryPoint → shop_interior
##   5. Park                — grass patch with a bench, south-west
##   6. Bathhouse landmark  — hero building at the north end, LocationEntryPoint → bathhouse_interior
##   7. Alley               — narrow gap between two east-side buildings
##   8. Forest edge         — line of tree blockouts east of the river
##   9. River/pond          — visual water strip (river) + pond by the park
##  10. Workshop            — enterable, east side, LocationEntryPoint → workshop_interior
##
## The freestanding openable Door and two exterior pickups from Phase 1 are
## preserved so the existing on-device interaction smoke tests still work.

const HOME_INTERIOR       := "res://src/world/locations/blockout_interior.tscn"
const RESTAURANT_INTERIOR := "res://src/world/locations/restaurant_interior.tscn"
const SHOP_INTERIOR       := "res://src/world/locations/shop_interior.tscn"
const WORKSHOP_INTERIOR   := "res://src/world/locations/workshop_interior.tscn"
const BATHHOUSE_INTERIOR  := "res://src/world/locations/bathhouse_interior.tscn"

## Lighting category tag read by RegionLightingController (M2.2). The town is
## a residential village street; category modifiers are subtle (design §6).
@export var lighting_category: StringName = &"residential"

func _ready() -> void:
	_build_ground()
	_build_street()

	# Player starts at the south end of the street, facing north up the town.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 22.0))

	# 2. Player home (enterable, west side).
	_build_house(Vector3(-14.0, 0.0, 15.0),
		&"wall_wood_warm", &"roof_warm",
		HOME_INTERIOR, "Enter home")

	# 3. Restaurant (enterable, east side).
	_build_house(Vector3(14.0, 0.0, 15.0),
		&"wall_red", &"roof_dark",
		RESTAURANT_INTERIOR, "Enter restaurant")

	# 4. Shop (enterable, west side).
	_build_house(Vector3(-14.0, 0.0, 0.0),
		&"wall_wood_sage", &"roof_warm",
		SHOP_INTERIOR, "Enter shop")

	# 10. Workshop (enterable, east side).
	_build_house(Vector3(14.0, 0.0, -2.0),
		&"wall_wood_grey", &"roof_dark",
		WORKSHOP_INTERIOR, "Enter workshop")

	# A couple of non-enterable NPC houses to make the residential street
	# feel populated — visual blockouts only, no interiors yet.
	_build_blocked_house(Vector3(-14.0, 0.0, -14.0), &"wall_wood_warm")
	_build_blocked_house(Vector3(14.0, 0.0, -14.0), &"wall_wood_sage")

	# 7. Alley — a narrow walled corridor between the workshop area and the
	#    blocked NPC house on the east side. Two low walls implying an alley.
	_build_alley(Vector3(14.0, 0.0, -8.0))

	# 6. Bathhouse landmark — hero building at the north end of the street.
	_build_bathhouse(Vector3(0.0, 0.0, -28.0))

	# 5. Park — a green ground patch with a bench, south-west.
	_build_park(Vector3(-26.0, 0.0, -6.0))

	# 9. Pond — visual water disk near the park.
	_build_pond(Vector3(-30.0, 0.0, -16.0))

	# 9. River — visual water strip along the east side of the town.
	_build_river()

	# 8. Forest edge — a row of tree blockouts east of the river.
	_build_forest_edge()

	# Preserved from Phase 1: freestanding openable Door + two pickups (so the
	# existing interaction smoke tests still exercise on-device).
	_build_door(Vector3(5.0, 0.0, 5.0))
	BlockoutUtil.add_pickup(self, Vector3(2.0, 0.3, 18.0), &"fish", 2)
	BlockoutUtil.add_pickup(self, Vector3(-2.5, 0.3, 17.0), &"rice", 5)

	# M2.4-B: composed vegetation (framing, depth, village<->forest transition).
	_build_vegetation()

# --- Ground / street --------------------------------------------------------

func _build_ground() -> void:
	# 100×100 walkable ground plane, deliberately larger than the built area
	# so the player can wander to the town's edges without hitting an
	# invisible wall in blockout play.
	add_child(BlockoutUtil.static_box_mat(
		Vector3(100.0, 0.4, 100.0), Vector3(0.0, -0.2, 0.0), MaterialLibrary.get_mat(&"ground")))

func _build_street() -> void:
	# 1. A paved stripe down the middle of the town — visual only (the
	#    ground already carries collision). Runs north-south from the
	#    bathhouse to the south spawn.
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(6.0, 0.02, 55.0), Vector3(0.0, 0.01, -3.0), MaterialLibrary.get_mat(&"path")))

# --- Buildings --------------------------------------------------------------

## An enterable blockout house: four walls with a doorway gap, a roof (visual
## only, above head), a coloured door slab that carries a LocationEntryPoint
## into the given interior scene. Footprint ≈ 6×5.
func _build_house(center: Vector3,
		wall_key: StringName, roof_key: StringName,
		interior: String, prompt: String) -> void:
	var wall := MaterialLibrary.get_mat(wall_key)
	var roof := MaterialLibrary.get_mat(roof_key)
	# Back and side walls.
	add_child(BlockoutUtil.static_box_mat(Vector3(6.0, 3.0, 0.3), center + Vector3(0.0, 1.5, -2.5), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 3.0, 5.0), center + Vector3(-3.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 3.0, 5.0), center + Vector3(3.0, 1.5, 0.0), wall))
	# Front wall in two pieces, leaving a doorway gap in the middle.
	add_child(BlockoutUtil.static_box_mat(Vector3(2.4, 3.0, 0.3), center + Vector3(-1.8, 1.5, 2.5), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(2.4, 3.0, 0.3), center + Vector3(1.8, 1.5, 2.5), wall))
	# Roof (visual only, above head — no collision needed).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(6.3, 0.3, 5.3), center + Vector3(0.0, 3.15, 0.0), roof))

	# Door slab as the interactable that loads the interior.
	var entry_body := BlockoutUtil.static_box_mat(
		Vector3(1.2, 2.4, 0.2), center + Vector3(0.0, 1.2, 2.5), MaterialLibrary.get_mat(&"wood_door"))
	add_child(entry_body)
	var entry := LocationEntryPoint.new()
	entry.location_scene = interior
	entry.spawn_name = "PlayerSpawn"
	entry.prompt = prompt
	entry_body.add_child(entry)

## A non-enterable house — same footprint, no doorway gap, no entry point.
## Visual/collision blocker to make the street feel populated.
func _build_blocked_house(center: Vector3, wall_key: StringName) -> void:
	var wall := MaterialLibrary.get_mat(wall_key)
	# Solid four walls.
	add_child(BlockoutUtil.static_box_mat(Vector3(6.0, 3.0, 0.3), center + Vector3(0.0, 1.5, -2.5), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(6.0, 3.0, 0.3), center + Vector3(0.0, 1.5, 2.5), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 3.0, 5.0), center + Vector3(-3.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 3.0, 5.0), center + Vector3(3.0, 1.5, 0.0), wall))
	# Roof (visual only).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(6.3, 0.3, 5.3), center + Vector3(0.0, 3.15, 0.0), MaterialLibrary.get_mat(&"roof_warm")))

## 6. Bathhouse landmark — larger footprint (~14×12), taller (~5m), stepped
##    roof so it reads as the hero building from a distance. Enterable via a
##    central doorway.
func _build_bathhouse(center: Vector3) -> void:
	var wall := MaterialLibrary.get_mat(&"wall_wood_warm")
	var roof := MaterialLibrary.get_mat(&"roof_warm")
	# Back and side walls.
	add_child(BlockoutUtil.static_box_mat(Vector3(14.0, 5.0, 0.3), center + Vector3(0.0, 2.5, -6.0), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 5.0, 12.0), center + Vector3(-7.0, 2.5, 0.0), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, 5.0, 12.0), center + Vector3(7.0, 2.5, 0.0), wall))
	# Front wall in two pieces around a central doorway.
	add_child(BlockoutUtil.static_box_mat(Vector3(6.0, 5.0, 0.3), center + Vector3(-4.0, 2.5, 6.0), wall))
	add_child(BlockoutUtil.static_box_mat(Vector3(6.0, 5.0, 0.3), center + Vector3(4.0, 2.5, 6.0), wall))
	# Stepped roof (three visual tiers, no collision above head).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(14.4, 0.3, 12.4), center + Vector3(0.0, 5.15, 0.0), roof))
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(10.0, 0.6, 8.0), center + Vector3(0.0, 5.6, 0.0), roof))
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(5.0, 0.8, 4.0), center + Vector3(0.0, 6.3, 0.0), roof))

	# Door slab.
	var entry_body := BlockoutUtil.static_box_mat(
		Vector3(1.6, 2.8, 0.2), center + Vector3(0.0, 1.4, 6.0), MaterialLibrary.get_mat(&"wood_door"))
	add_child(entry_body)
	var entry := LocationEntryPoint.new()
	entry.location_scene = BATHHOUSE_INTERIOR
	entry.spawn_name = "PlayerSpawn"
	entry.prompt = "Enter bathhouse"
	entry_body.add_child(entry)

# --- Outdoor spaces ---------------------------------------------------------

func _build_park(center: Vector3) -> void:
	# 5. A grass patch (visual only, sits just above the ground plane) with a
	#    simple bench so the space reads as a park.
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(14.0, 0.04, 12.0), center + Vector3(0.0, 0.02, 0.0), MaterialLibrary.get_mat(&"grass_bright")))
	# Bench: two legs + a seat.
	var bench_col := Color(0.42, 0.32, 0.24)
	add_child(BlockoutUtil.static_box(Vector3(0.3, 0.5, 0.4), center + Vector3(-1.2, 0.25, 0.0), bench_col))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 0.5, 0.4), center + Vector3(1.2, 0.25, 0.0), bench_col))
	add_child(BlockoutUtil.static_box(Vector3(3.0, 0.15, 0.5), center + Vector3(0.0, 0.55, 0.0), bench_col))

func _build_pond(center: Vector3) -> void:
	# 9. Visual pond (no collision — sits above the ground plane which
	#    already carries collision, so the player can safely walk over it
	#    for now; real water/collision refinement is Phase 4 atmosphere).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(8.0, 0.05, 6.0), center + Vector3(0.0, 0.05, 0.0), MaterialLibrary.get_mat(&"water")))

func _build_river() -> void:
	# 9. Long visual water strip running north-south along the east edge of
	#    the town, between the buildings and the forest edge.
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(4.0, 0.05, 60.0), Vector3(30.0, 0.05, 0.0), MaterialLibrary.get_mat(&"water")))

func _build_forest_edge() -> void:
	# 8. A row of tree blockouts east of the river. Not a full forest —
	#    just enough to imply the town has an edge to explore beyond.
	var trunks := [
		Vector3(38.0, 0.0, -22.0),
		Vector3(40.0, 0.0, -14.0),
		Vector3(37.0, 0.0, -6.0),
		Vector3(41.0, 0.0, 2.0),
		Vector3(38.0, 0.0, 10.0),
		Vector3(40.0, 0.0, 18.0),
		Vector3(37.0, 0.0, 24.0),
		Vector3(42.0, 0.0, -30.0),
	]
	var i := 0
	for pos in trunks:
		# Deterministic scale variation so the edge doesn't read as a uniform row.
		var s := 0.9 + float((i * 37) % 5) * 0.12
		BlockoutUtil.add_tree(self, pos, s)
		i += 1

func _build_alley(anchor: Vector3) -> void:
	# 7. Two low walls forming a narrow corridor. The gap is walkable and
	#    reads as an alley between the workshop (at anchor) and the blocked
	#    NPC house to its south — a shortcut path through the row.
	var alley_col := Color(0.40, 0.36, 0.32)
	# Wall on the west side of the alley.
	add_child(BlockoutUtil.static_box(Vector3(0.3, 2.0, 3.0),
		anchor + Vector3(-1.5, 1.0, -3.5), alley_col))
	# Wall on the east side of the alley.
	add_child(BlockoutUtil.static_box(Vector3(0.3, 2.0, 3.0),
		anchor + Vector3(1.5, 1.0, -3.5), alley_col))

# --- Vegetation (M2.4-B) ----------------------------------------------------
## Composed, not blanket: fields frame water/paths/buildings, create the
## village<->forest transition, and add depth — while keeping the street and
## doorways clear (M2.4_ART_DESIGN.md §M2.4-B). Deterministic (seeded);
## density scales with GraphicsManager.vegetation; distance is LOD-culled.

func _veg(species: StringName, mat: StringName, center: Vector3, hx: float, hz: float,
		base: int, seed: int, y: float, smin: float, smax: float, end_dist: float) -> void:
	add_child(VegetationField.scatter(species, mat, center, hx, hz, base, seed, y, smin, smax, end_dist))

func _build_vegetation() -> void:
	# 1. Forest understory east of the river — the village<->forest transition.
	_veg(&"grass", &"grass_blade", Vector3(39.0, 0.0, -3.0), 5.0, 28.0, 260, 1001, 0.22, 0.8, 1.4, 45.0)
	_veg(&"fern", &"fern", Vector3(39.0, 0.0, -3.0), 5.0, 28.0, 44, 1002, 0.24, 0.8, 1.3, 55.0)
	_veg(&"shrub", &"shrub", Vector3(39.0, 0.0, -3.0), 5.0, 28.0, 16, 1003, 0.38, 0.8, 1.3, 75.0)
	_veg(&"rock", &"rock", Vector3(39.0, 0.0, -3.0), 5.0, 28.0, 12, 1004, 0.18, 0.6, 1.6, 90.0)

	# 2. River banks — frame the water on both sides.
	_veg(&"grass", &"grass_blade", Vector3(27.8, 0.0, -2.0), 1.2, 30.0, 90, 1101, 0.22, 0.8, 1.3, 45.0)
	_veg(&"grass", &"grass_blade", Vector3(32.2, 0.0, -2.0), 1.2, 30.0, 90, 1102, 0.22, 0.8, 1.3, 45.0)
	_veg(&"rock", &"rock", Vector3(27.8, 0.0, -2.0), 1.2, 30.0, 10, 1103, 0.18, 0.6, 1.4, 90.0)
	_veg(&"rock", &"rock", Vector3(32.2, 0.0, -2.0), 1.2, 30.0, 10, 1104, 0.18, 0.6, 1.4, 90.0)

	# 3. Pond surround — ferns, blooms and rocks framing the water by the park.
	_veg(&"fern", &"fern", Vector3(-30.0, 0.0, -16.0), 6.5, 5.5, 26, 1201, 0.24, 0.8, 1.2, 55.0)
	_veg(&"flower", &"flower_warm", Vector3(-30.0, 0.0, -16.0), 6.5, 5.5, 16, 1202, 0.12, 0.7, 1.2, 40.0)
	_veg(&"rock", &"rock", Vector3(-30.0, 0.0, -16.0), 6.5, 5.5, 10, 1203, 0.18, 0.6, 1.5, 90.0)
	_veg(&"grass", &"grass_blade", Vector3(-30.0, 0.0, -16.0), 6.5, 5.5, 40, 1204, 0.22, 0.8, 1.3, 45.0)

	# 4. Park — inviting blooms and grass (a "stop and look" corner).
	_veg(&"grass", &"grass_blade", Vector3(-26.0, 0.0, -6.0), 6.5, 5.5, 120, 1301, 0.22, 0.8, 1.3, 45.0)
	_veg(&"flower", &"flower_warm", Vector3(-26.0, 0.0, -6.0), 6.5, 5.5, 22, 1302, 0.12, 0.7, 1.2, 40.0)
	_veg(&"flower", &"flower_pale", Vector3(-26.0, 0.0, -6.0), 6.5, 5.5, 18, 1303, 0.12, 0.7, 1.2, 40.0)

	# 5. West green approach — grass + shrubs framing the west side.
	_veg(&"grass", &"grass_blade", Vector3(-24.0, 0.0, 12.0), 6.0, 12.0, 150, 1401, 0.22, 0.8, 1.3, 45.0)
	_veg(&"shrub", &"shrub", Vector3(-24.0, 0.0, 12.0), 6.0, 12.0, 10, 1402, 0.38, 0.8, 1.2, 75.0)

	# 6. Path-framing clusters flanking the street (clear of the 6m paved stripe
	#    and of doorways) — guide the eye up the town without blocking it.
	var seed := 1500
	for zc in [18.0, 8.0, -2.0]:
		for side in [-5.5, 5.5]:
			seed += 1
			_veg(&"grass", &"grass_blade", Vector3(side, 0.0, zc), 1.2, 2.0, 22, seed, 0.22, 0.8, 1.2, 40.0)
			seed += 1
			_veg(&"flower", &"flower_pale", Vector3(side, 0.0, zc), 1.2, 2.0, 8, seed, 0.12, 0.7, 1.1, 35.0)

	# 7. A few composed trees framing the bathhouse hero and thickening depth
	#    (beside the footprint, not on it). Varied scale, not a uniform row.
	BlockoutUtil.add_tree(self, Vector3(-11.0, 0.0, -30.0), 1.3)
	BlockoutUtil.add_tree(self, Vector3(11.0, 0.0, -31.0), 1.4)
	BlockoutUtil.add_tree(self, Vector3(-9.0, 0.0, -23.0), 1.0)
	BlockoutUtil.add_tree(self, Vector3(9.0, 0.0, -24.0), 1.1)
	BlockoutUtil.add_tree(self, Vector3(-21.0, 0.0, 2.0), 1.2)

# --- Freestanding door (preserved from Phase 1) -----------------------------

func _build_door(pos: Vector3) -> void:
	var post := Color(0.4, 0.32, 0.24)
	add_child(BlockoutUtil.static_box(Vector3(0.2, 2.4, 0.2), pos + Vector3(-0.7, 1.2, 0.0), post))
	add_child(BlockoutUtil.static_box(Vector3(0.2, 2.4, 0.2), pos + Vector3(0.7, 1.2, 0.0), post))

	# Hinge pivot at the left post; leaf extends to the right of it.
	var pivot := Node3D.new()
	pivot.name = "DoorPivot"
	pivot.position = pos + Vector3(-0.6, 1.2, 0.0)
	add_child(pivot)

	var leaf := BlockoutUtil.static_box(Vector3(1.2, 2.2, 0.1), Vector3(0.6, 0.0, 0.0), Color(0.56, 0.42, 0.26))
	pivot.add_child(leaf)

	var door := Door.new()
	door.leaf = pivot
	leaf.add_child(door)
