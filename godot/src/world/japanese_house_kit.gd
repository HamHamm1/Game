class_name JapaneseHouseKit
extends RefCounted
## M2.4-B — a reusable, grid-friendly modular kit that assembles Japanese rural
## houses from code primitives + the shared MaterialLibrary. ONE art direction
## (weathered cedar / timber / tile-or-thatch, deep eaves, stone plinth), MANY
## architectures: the same components snap together at different width / depth /
## height / roof / eave / engawa / porch / extension to make visually distinct
## houses that are NOT scaled copies of each other and NOT the hero Meshy houses.
##
## Fidelity tier VILLAGE (below the hero Meshy houses, above background): honest
## blockout-grade geometry with tuned shared materials, cheap enough for the
## Mobile renderer (visual walls, ONE box collider per house, MultiMesh-free).
## `background_house()` drops to the cheapest tier (a single clad volume + roof,
## no collision, visibility-range LOD) for the unreachable backdrop.
##
## Playability: pass a non-empty `interior_path` to `build()` and the front door
## becomes a StaticBody carrying a LocationEntryPoint (the EXISTING building
## entry system — world_root handles the teleport + return). Leave it empty for
## an "optional / not-yet-enterable" house (solid door, still collidable).

const POST := 0.18          # corner post half-thickness-ish
const WALL_T := 0.2         # wall thickness

## A controlled bundle of architectural parameters. Presets below vary these to
## produce the C/D/E/F archetypes; nothing here is random — a caller can also
## nudge one field for a one-off house without breaking the art direction.
class Spec:
	var name := "House"
	var width := 6.0
	var depth := 5.0
	var wall_height := 2.6
	var roof := &"gable"        # "gable" | "hipped" | "shallow"
	var roof_height := 2.0
	var overhang := 0.8          # deep Japanese eaves
	var wall_key: StringName = &"cedar_aged"
	var trim_key: StringName = &"wood_dark"
	var roof_key: StringName = &"roof_tile"
	var foundation := true
	var engawa := false          # front veranda deck (long homes)
	var porch := false           # small pitched entry hood over the door
	var side_ext := false        # a lower attached wing (genkan / storage)
	var windows := 2             # window pairs on the flanks

# --- Archetype presets ------------------------------------------------------
# SAME palette + construction, DIFFERENT massing. Each reads as its own house.

## HOUSE C — small compact rural home: near-square, hipped tile roof, tidy.
static func house_c() -> Spec:
	var s := Spec.new()
	s.name = "HouseC"
	s.width = 5.4; s.depth = 5.0; s.wall_height = 2.5
	s.roof = &"hipped"; s.roof_height = 1.9; s.overhang = 0.7
	s.wall_key = &"timber_light"; s.roof_key = &"roof_tile"
	s.windows = 2; s.porch = true
	return s

## HOUSE D — long engawa home: wide + shallow, low sweeping roof, full veranda.
static func house_d() -> Spec:
	var s := Spec.new()
	s.name = "HouseD"
	s.width = 9.5; s.depth = 4.6; s.wall_height = 2.4
	s.roof = &"shallow"; s.roof_height = 1.4; s.overhang = 1.1
	s.wall_key = &"cedar_aged"; s.roof_key = &"roof_tile"
	s.windows = 3; s.engawa = true
	return s

## HOUSE E — gabled mountain home: tall, steep thatched gable, small footprint.
static func house_e() -> Spec:
	var s := Spec.new()
	s.name = "HouseE"
	s.width = 6.0; s.depth = 5.4; s.wall_height = 3.0
	s.roof = &"gable"; s.roof_height = 3.2; s.overhang = 1.0
	s.wall_key = &"cedar_aged"; s.roof_key = &"roof_thatch"
	s.windows = 2
	return s

## HOUSE F — farmer family home: larger, gable tile roof + a lower side wing.
static func house_f() -> Spec:
	var s := Spec.new()
	s.name = "HouseF"
	s.width = 7.8; s.depth = 6.0; s.wall_height = 2.8
	s.roof = &"gable"; s.roof_height = 2.6; s.overhang = 0.9
	s.wall_key = &"wall_wood_sage"; s.roof_key = &"roof_tile"
	s.windows = 3; s.side_ext = true; s.engawa = true
	return s

# --- Full VILLAGE-tier build ------------------------------------------------

## Assemble a full house from a Spec. If `interior_path` is non-empty the front
## door is an ENTERABLE LocationEntryPoint into that scene; otherwise it is a
## solid (optional) door. The returned node is grounded at local y=0.
static func build(spec: Spec, interior_path: String = "", prompt: String = "Enter") -> Node3D:
	var root := Node3D.new()
	root.name = spec.name
	var w := spec.width
	var d := spec.depth
	var h := spec.wall_height
	var wall := MaterialLibrary.get_mat(spec.wall_key)
	var trim := MaterialLibrary.get_mat(spec.trim_key)

	if spec.foundation:
		root.add_child(BlockoutUtil.visual_box_mat(
			Vector3(w + 0.7, 0.4, d + 0.7), Vector3(0.0, -0.1, 0.0),
			MaterialLibrary.get_mat(&"stone")))

	# Corner posts (dark timber) read the frame of the house.
	for sx: float in [-1.0, 1.0]:
		for sz: float in [-1.0, 1.0]:
			root.add_child(BlockoutUtil.visual_box_mat(
				Vector3(POST * 2.0, h + 0.1, POST * 2.0),
				Vector3(sx * (w * 0.5 - POST), h * 0.5, sz * (d * 0.5 - POST)), trim))

	# Walls (visual only — one box collider is added at the end). Front (+z) is
	# split around a central doorway gap; the door itself is added below.
	var door_gap := 1.4
	root.add_child(BlockoutUtil.visual_box_mat(Vector3(w, h, WALL_T), Vector3(0.0, h * 0.5, -d * 0.5), wall))     # back
	root.add_child(BlockoutUtil.visual_box_mat(Vector3(WALL_T, h, d), Vector3(-w * 0.5, h * 0.5, 0.0), wall))     # left
	root.add_child(BlockoutUtil.visual_box_mat(Vector3(WALL_T, h, d), Vector3(w * 0.5, h * 0.5, 0.0), wall))      # right
	var side := (w - door_gap) * 0.5
	root.add_child(BlockoutUtil.visual_box_mat(
		Vector3(side, h, WALL_T), Vector3(-(door_gap * 0.5 + side * 0.5), h * 0.5, d * 0.5), wall))               # front L
	root.add_child(BlockoutUtil.visual_box_mat(
		Vector3(side, h, WALL_T), Vector3(door_gap * 0.5 + side * 0.5, h * 0.5, d * 0.5), wall))                  # front R
	# Lintel over the doorway.
	root.add_child(BlockoutUtil.visual_box_mat(
		Vector3(door_gap + 0.3, h - 2.2, WALL_T), Vector3(0.0, h - (h - 2.2) * 0.5, d * 0.5), trim))

	# Eave band (dark) at the top of the walls — the strong horizontal line.
	root.add_child(BlockoutUtil.visual_box_mat(Vector3(w + 0.2, 0.22, d + 0.2), Vector3(0.0, h + 0.02, 0.0), trim))

	_add_windows(root, spec)
	_add_roof(root, spec)

	if spec.engawa:
		_add_engawa(root, spec)
	if spec.porch:
		_add_porch(root, spec)
	if spec.side_ext:
		_add_side_ext(root, spec)

	# --- Front door: enterable or solid -------------------------------------
	var door_body := BlockoutUtil.static_box_mat(
		Vector3(door_gap, 2.2, 0.16), Vector3(0.0, 1.1, d * 0.5 + 0.08),
		MaterialLibrary.get_mat(&"wood_door"))
	root.add_child(door_body)
	if not interior_path.is_empty():
		var entry := LocationEntryPoint.new()
		entry.location_scene = interior_path
		entry.spawn_name = "PlayerSpawn"
		entry.prompt = prompt
		door_body.add_child(entry)

	# --- ONE simple box collider for the whole house (never per-wall / mesh) --
	var body := StaticBody3D.new()
	body.name = "Collision"
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(w, h, d)
	col.shape = box
	col.position = Vector3(0.0, h * 0.5, 0.0)
	body.add_child(col)
	root.add_child(body)
	return root

## Footprint (x/z) of a Spec, for laying out vegetation exclusions / spacing.
static func footprint_of(spec: Spec) -> Vector2:
	return Vector2(spec.width + 0.7, spec.depth + 0.7)

# --- Cheapest BACKGROUND tier ----------------------------------------------

## A far-backdrop house: a single clad volume + one roof, NO collision, with a
## visibility-range LOD so distant silhouettes stay cheap. Never enterable.
static func background_house(spec: Spec, cull_end: float = 300.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Bg" + spec.name
	var w := spec.width
	var d := spec.depth
	var h := spec.wall_height
	var walls := BlockoutUtil.visual_box_mat(
		Vector3(w, h, d), Vector3(0.0, h * 0.5, 0.0), MaterialLibrary.get_mat(spec.wall_key))
	_lod(walls, cull_end)
	root.add_child(walls)
	for m in _roof_meshes(spec):
		_lod(m, cull_end)
		root.add_child(m)
	return root

# --- Internal component builders -------------------------------------------

static func _add_windows(root: Node3D, spec: Spec) -> void:
	var n := maxi(spec.windows, 0)
	if n == 0:
		return
	var d := spec.depth
	var h := spec.wall_height
	var glass := MaterialLibrary.get_mat(&"glass_dark")
	var trim := MaterialLibrary.get_mat(spec.trim_key)
	var wy := h * 0.55
	# Spread windows along the two flanks (±x walls).
	for i in n:
		var t := (float(i) + 1.0) / (float(n) + 1.0)
		var z := lerpf(-d * 0.5 + 0.6, d * 0.5 - 0.6, t)
		for sx: float in [-1.0, 1.0]:
			var x: float = sx * (spec.width * 0.5 + 0.02)
			root.add_child(BlockoutUtil.visual_box_mat(
				Vector3(0.1, 1.05, 1.0), Vector3(x, wy, z), trim))         # frame
			root.add_child(BlockoutUtil.visual_box_mat(
				Vector3(0.14, 0.85, 0.8), Vector3(x, wy, z), glass))       # glazing

static func _add_roof(root: Node3D, spec: Spec) -> void:
	for m in _roof_meshes(spec):
		root.add_child(m)

## Build the roof mesh(es) for a Spec, positioned in the house's local space.
## gable -> triangular PrismMesh (ridge along depth); hipped -> eave slab + a
## short prism cap; shallow -> a low, wide prism. All get deep eaves via overhang.
static func _roof_meshes(spec: Spec) -> Array:
	var out := []
	var w := spec.width
	var d := spec.depth
	var h := spec.wall_height
	var ov := spec.overhang
	var rh := spec.roof_height
	var mat := MaterialLibrary.get_mat(spec.roof_key)
	match spec.roof:
		&"hipped":
			# Low eave slab.
			out.append(BlockoutUtil.visual_box_mat(
				Vector3(w + 2.0 * ov, 0.2, d + 2.0 * ov), Vector3(0.0, h + 0.15, 0.0), mat))
			# Short ridge cap (hips faked by a prism narrower in Z than the eave).
			var cap := MeshInstance3D.new()
			var pm := PrismMesh.new()
			pm.size = Vector3(w + ov, rh, maxf(d - w * 0.5, 1.0))
			cap.mesh = pm
			cap.material_override = mat
			cap.position = Vector3(0.0, h + 0.15 + rh * 0.5, 0.0)
			out.append(cap)
		&"shallow":
			out.append(_prism(Vector3(w + 2.0 * ov, rh, d + 2.0 * ov),
				Vector3(0.0, h + rh * 0.5, 0.0), mat))
		_:  # gable (default)
			out.append(_prism(Vector3(w + 2.0 * ov, rh, d + 2.0 * ov),
				Vector3(0.0, h + rh * 0.5, 0.0), mat))
			# Gable end-caps (fill the triangular timber tympanum under the ridge).
			for sz: float in [-1.0, 1.0]:
				out.append(_prism(Vector3(w, rh * 0.98, 0.12),
					Vector3(0.0, h + rh * 0.5, sz * d * 0.5), MaterialLibrary.get_mat(spec.wall_key)))
	return out

static func _prism(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.material_override = mat
	mi.position = pos
	return mi

## Front veranda deck (engawa) running the width of the house, a step above the
## ground, with a couple of support posts. Collidable so the player stands on it.
static func _add_engawa(root: Node3D, spec: Spec) -> void:
	var w := spec.width
	var d := spec.depth
	var deck := MaterialLibrary.get_mat(&"deck_wood")
	var trim := MaterialLibrary.get_mat(spec.trim_key)
	var dz := d * 0.5 + 0.85
	root.add_child(BlockoutUtil.static_box_mat(
		Vector3(w + 0.4, 0.18, 1.5), Vector3(0.0, 0.35, dz), deck))
	for sx: float in [-1.0, 1.0]:
		root.add_child(BlockoutUtil.visual_box_mat(
			Vector3(0.14, 0.42, 0.14), Vector3(sx * (w * 0.5 - 0.1), 0.2, dz + 0.6), trim))

## A small pitched hood over the front door, on two thin posts.
static func _add_porch(root: Node3D, spec: Spec) -> void:
	var d := spec.depth
	var h := spec.wall_height
	var trim := MaterialLibrary.get_mat(spec.trim_key)
	root.add_child(_prism(Vector3(2.2, 0.7, 1.4), Vector3(0.0, h - 0.4, d * 0.5 + 0.7),
		MaterialLibrary.get_mat(spec.roof_key)))
	for sx: float in [-1.0, 1.0]:
		root.add_child(BlockoutUtil.visual_box_mat(
			Vector3(0.12, h - 0.5, 0.12), Vector3(sx * 0.9, (h - 0.5) * 0.5, d * 0.5 + 1.2), trim))

## A lower attached wing on the +x flank (genkan / storage), with its own low
## shallow roof — breaks the silhouette so the house reads as bigger/older.
static func _add_side_ext(root: Node3D, spec: Spec) -> void:
	var w := spec.width
	var d := spec.depth
	var eh := spec.wall_height - 0.7
	var ex := w * 0.5 + 1.1
	var wall := MaterialLibrary.get_mat(spec.wall_key)
	root.add_child(BlockoutUtil.visual_box_mat(
		Vector3(2.2, eh, d * 0.7), Vector3(ex, eh * 0.5, 0.0), wall))
	root.add_child(_prism(Vector3(2.6, 0.9, d * 0.7 + 0.4), Vector3(ex, eh + 0.45, 0.0),
		MaterialLibrary.get_mat(spec.roof_key)))

static func _lod(mi: MeshInstance3D, end_dist: float) -> void:
	if end_dist <= 0.0:
		return
	mi.visibility_range_end = end_dist
	mi.visibility_range_end_margin = end_dist * 0.12
	mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
