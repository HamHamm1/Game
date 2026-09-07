extends Node3D
## M2.4 hero test village — stages the two ORIGINAL Meshy-authored Japanese
## rural houses (hero architecture) in a small, deliberately composed scene, so
## the owner can judge the high-fidelity look on a real Android device. NOT the
## full village (blockout_town is preserved); this is the focused hero area.
##
## Composition: houses at irregular positions/rotations (never side-by-side),
## a curved stone path leading the eye between them, framing trees, foreground
## ferns/flowers/rocks, a broad grass lawn carved by exclusions, and a low
## background mound for depth. Uses M2.2 lighting + M2.3 weather unchanged (they
## attach at world_root); this region only supplies geometry + a lighting tag.

const HOUSE_A := "res://assets/meshes/houses/house_a.glb"
const HOUSE_B := "res://assets/meshes/houses/house_b.glb"

## Lighting-profile tag read by RegionLightingController (M2.2). Residential.
@export var lighting_category: StringName = &"residential"

var _excl: Array[Rect2] = []

func _ready() -> void:
	_build_ground()
	# Player starts to the south, looking north up the path toward the houses.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 15.0))
	_place_houses()
	_build_path()
	_build_vegetation()

func _build_ground() -> void:
	# Broad walkable ground.
	add_child(BlockoutUtil.static_box_mat(
		Vector3(90.0, 0.4, 90.0), Vector3(0.0, -0.2, 0.0), MaterialLibrary.get_mat(&"ground")))
	# A low grassy mound behind the houses for background depth (off the path).
	add_child(BlockoutUtil.visual_box_mat(
		Vector3(26.0, 1.4, 10.0), Vector3(-1.0, 0.4, -27.0), MaterialLibrary.get_mat(&"grass_bright")))

## Place one hero house: grounded, rotated, on a stone foundation slab, and
## register a vegetation-exclusion around its footprint.
func _house(path: String, pos: Vector3, yaw_deg: float, width: float) -> void:
	var h := HeroAsset.make_house(path, width, true)
	h.position = pos
	h.rotation_degrees = Vector3(0.0, yaw_deg, 0.0)
	add_child(h)
	var fp := HeroAsset.footprint_of(h)
	# Stone foundation slab so the house sits naturally on the ground.
	add_child(BlockoutUtil.static_box_mat(
		Vector3(fp.x + 1.2, 0.3, fp.y + 1.2), pos + Vector3(0.0, 0.15, 0.0),
		MaterialLibrary.get_mat(&"stone")))
	var pad := maxf(fp.x, fp.y) + 2.0
	_excl.append(Rect2(pos.x - pad * 0.5, pos.z - pad * 0.5, pad, pad))

func _place_houses() -> void:
	# Irregular placement + rotation — never side-by-side.
	_house(HOUSE_A, Vector3(-7.5, 0.0, -3.0), 22.0, 7.6)
	_house(HOUSE_B, Vector3(8.0, 0.0, -13.0), -38.0, 6.8)

func _build_path() -> void:
	# A gently curving stone path from the spawn up between the houses.
	var pts := [
		Vector3(0.0, 0.0, 13.0), Vector3(-1.2, 0.0, 8.0), Vector3(1.0, 0.0, 3.0),
		Vector3(0.4, 0.0, -2.0), Vector3(-1.5, 0.0, -7.0), Vector3(0.0, 0.0, -12.0),
	]
	for p in pts:
		add_child(BlockoutUtil.visual_box_mat(
			Vector3(2.6, 0.06, 2.6), p + Vector3(0.0, 0.03, 0.0), MaterialLibrary.get_mat(&"path")))
		_excl.append(Rect2(p.x - 1.5, p.z - 1.5, 3.0, 3.0))

func _veg(species: StringName, mat: StringName, center: Vector3, hx: float, hz: float,
		base: int, seed: int, smin: float, smax: float, end_dist: float) -> void:
	add_child(VegetationField.scatter(species, mat, center, hx, hz, base, seed, smin, smax,
		end_dist, _excl))

func _build_vegetation() -> void:
	# Broad grass lawn — exclusions carve out the houses + path.
	_veg(&"grass", &"grass_blade", Vector3(0.0, 0.0, -3.0), 22.0, 22.0, 950, 3001, 0.8, 1.35, 42.0)
	# Framing trees (varied silhouette/scale), beside the composition, not on it.
	BlockoutUtil.add_tree(self, Vector3(-16.0, 0.0, -8.0), 1.5, 0)
	BlockoutUtil.add_tree(self, Vector3(15.0, 0.0, -2.0), 1.6, 2)
	BlockoutUtil.add_tree(self, Vector3(-12.0, 0.0, 7.0), 1.2, 1)
	BlockoutUtil.add_tree(self, Vector3(13.0, 0.0, -22.0), 1.7, 0)
	# Foreground detail near the path: ferns, blooms, a few rocks.
	_veg(&"fern", &"fern", Vector3(4.5, 0.0, 5.0), 3.0, 4.0, 24, 3002, 0.8, 1.2, 55.0)
	_veg(&"flower", &"flower_vcol", Vector3(-5.5, 0.0, 3.0), 3.0, 3.0, 26, 3003, 0.8, 1.2, 40.0)
	_veg(&"rock", &"rock", Vector3(-4.0, 0.0, 8.0), 3.5, 3.0, 9, 3004, 0.7, 1.6, 95.0)
	_veg(&"shrub", &"shrub", Vector3(6.0, 0.0, -6.0), 4.0, 3.0, 10, 3005, 0.8, 1.2, 80.0)
