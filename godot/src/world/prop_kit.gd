class_name PropKit
extends RefCounted
## M2.4-C dressing — instantiates an imported dressing GLB as a reusable, grounded
## node with optional SIMPLE collision. GLBs are loaded through Godot's resource
## cache (load() returns the same PackedScene per path), so every instance shares
## the same mesh + PBR material data — no duplication. Meshy exports are
## centre-origin; make() centres the prop on XZ and lifts its base to local y=0 so
## the caller can drop it straight onto the terrain height. Preserves the original
## imported PBR materials (no overrides).

# Category paths (props were imported as prop01..16; named here for clarity).
const BRIDGE := "res://assets/meshes/props/prop01.glb"        # arched wooden footbridge
const FENCE_TALL := "res://assets/meshes/props/prop02.glb"    # tall slat/bamboo fence panel
const FIREWOOD_RACK := "res://assets/meshes/props/prop03.glb" # log store / woodshed
const BASKETS := "res://assets/meshes/props/prop04.glb"       # woven basket cluster
const PLANTER := "res://assets/meshes/props/prop05.glb"       # terracotta planter pot
const FARM_TOOLS := "res://assets/meshes/props/prop06.glb"    # trowel / fork / rake (flat)
const DRYING_RACK := "res://assets/meshes/props/prop07.glb"   # crop drying frame
const STORAGE_SHED := "res://assets/meshes/props/prop08.glb"  # small tiled-roof storehouse
const LANTERN := "res://assets/meshes/props/prop09.glb"       # hanging lantern
const FENCE_LOW := "res://assets/meshes/props/prop10.glb"     # low garden picket fence
const SIGNPOST := "res://assets/meshes/props/prop11.glb"      # wooden signpost
const STONE_PAVING := "res://assets/meshes/props/prop12.glb"  # flat cobble patch
const BENCH := "res://assets/meshes/props/prop13.glb"         # wooden bench
const PINE_TREE := "res://assets/meshes/props/prop14.glb"     # pine / cedar tree
const ROCK_CLUSTER := "res://assets/meshes/props/prop15.glb"  # river-stone pile
const FLOWER_SHRUB := "res://assets/meshes/props/prop16.glb"  # pink flowering shrub

# M2.4-D — the ONLY approved vegetation + rock GLBs (owner-supplied). All visible
# greenery and stone in hero_village comes from these; no procedural/primitive
# vegetation or rocks are used anywhere in the region any more.
const SAKURA_LARGE := "res://assets/meshes/veg/sakura_large.glb"  # mature cherry, dense canopy
const SAKURA_SMALL := "res://assets/meshes/veg/sakura_small.glb"  # young cherry (trunk + soil base)
const GRASS_CLUMP := "res://assets/meshes/veg/grass_clump.glb"    # single grass tuft
const FLOWERS := "res://assets/meshes/veg/flowers.glb"            # pink/white flowering plant
const RIVER_ROCKS := "res://assets/meshes/veg/river_rocks.glb"    # flat spread of water-worn pebbles
const PINE := "res://assets/meshes/veg/pine.glb"                  # Japanese pine / cedar
const PATH_ROCKS := "res://assets/meshes/veg/path_rocks.glb"      # flat angular flagstone edging

static var _aabb_cache: Dictionary = {}   # path -> AABB (raw, unscaled)

## Instantiate `path` uniformly scaled by `s`, centred on XZ with its base at
## local y=0. `collide` adds a simple collider: "box" (footprint box up to
## `col_cap` metres, else full height), "deck" (a flat walkway at y=`col_cap`),
## "post" (thin central post), or "" for none. `lod_end` (>0) fades the visual at
## distance (for trees). The returned node is positioned/rotated by the caller.
static func make(path: String, s: float, collide: String = "", col_cap: float = 0.0,
		lod_end: float = 0.0) -> Node3D:
	var root := Node3D.new()
	var packed := load(path) as PackedScene
	if packed == null:
		push_error("PropKit: could not load '%s'" % path)
		return root
	var inst := packed.instantiate() as Node3D
	root.add_child(inst)
	var aabb := _raw_aabb(path, inst)
	inst.scale = Vector3(s, s, s)
	inst.position = Vector3(
		-(aabb.position.x + aabb.size.x * 0.5) * s,
		-aabb.position.y * s,
		-(aabb.position.z + aabb.size.z * 0.5) * s)
	if lod_end > 0.0:
		for mi in _all_meshes(inst):
			mi.visibility_range_end = lod_end
			mi.visibility_range_end_margin = lod_end * 0.15
			mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	if not collide.is_empty():
		_add_collider(root, aabb, s, collide, col_cap)
	return root

## Footprint (x,z metres) of a prop at scale `s` — for spacing + exclusions.
static func footprint(path: String, s: float) -> Vector2:
	var a := _cached(path)
	return Vector2(a.size.x * s, a.size.z * s)

static func height(path: String, s: float) -> float:
	return _cached(path).size.y * s

# --- internals --------------------------------------------------------------

static func _add_collider(root: Node3D, aabb: AABB, s: float, kind: String, cap: float) -> void:
	var fw := aabb.size.x * s
	var fh := aabb.size.y * s
	var fd := aabb.size.z * s
	var body := StaticBody3D.new()
	body.name = "PropCollision"
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	match kind:
		"deck":
			box.size = Vector3(fw, 0.5, fd * 0.82)
			cs.position = Vector3(0.0, (cap if cap > 0.0 else 0.25), 0.0)
		"post":
			box.size = Vector3(minf(fw, 0.35), fh * 0.95, minf(fd, 0.35))
			cs.position = Vector3(0.0, fh * 0.475, 0.0)
		_:  # "box"
			var h := (cap if cap > 0.0 else fh)
			box.size = Vector3(fw * 0.85, h, fd * 0.85)
			cs.position = Vector3(0.0, h * 0.5, 0.0)
	cs.shape = box
	body.add_child(cs)
	root.add_child(body)

static func _raw_aabb(path: String, inst: Node3D) -> AABB:
	if _aabb_cache.has(path):
		return _aabb_cache[path]
	var a := _merged_aabb(inst)
	_aabb_cache[path] = a
	return a

static func _cached(path: String) -> AABB:
	if _aabb_cache.has(path):
		return _aabb_cache[path]
	var packed := load(path) as PackedScene
	if packed == null:
		return AABB(Vector3(-0.95, -0.95, -0.95), Vector3(1.9, 1.9, 1.9))
	var inst := packed.instantiate() as Node3D
	var a := _merged_aabb(inst)
	inst.queue_free()
	_aabb_cache[path] = a
	return a

static func _merged_aabb(inst: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi in _all_meshes(inst):
		var a: AABB = mi.transform * mi.get_aabb()
		if first:
			out = a
			first = false
		else:
			out = out.merge(a)
	return out

static func _all_meshes(n: Node) -> Array:
	var out: Array = []
	if n is MeshInstance3D:
		out.append(n)
	for c in n.get_children():
		out.append_array(_all_meshes(c))
	return out
