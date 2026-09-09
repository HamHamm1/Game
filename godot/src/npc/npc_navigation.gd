class_name NpcNavigation
extends Node3D
## M2.5.1 — reusable village navigation service. Builds ONE NavigationRegion3D for
## the whole safe village area from the existing terrain + collision structure, so
## any number of NPCs can path around it. The walkable surface is a terrain-
## conforming grid navmesh that EXCLUDES: the stream channel, every house
## footprint (so no walkable surface is ever created inside a building — the real
## doorways stay physically reachable by the player, the NPC just isn't routed
## through the sub-body-width gap), the play-area edge, and every solid prop
## (sheds, fences, racks, benches, big rocks, tree trunks, lamp/sign posts). The
## NPC's own physics capsule is the second safety net against clipping geometry.
##
## Configuration is passed in (not hard-coded) so this stays region-agnostic:
##   ground(x,z)->float, stream_dist(x,z)->float, plus the play disc, house pads,
##   solid-prop blocker rects and a set of safe destination anchors.

const CELL := 1.25           # navmesh grid resolution (m)
const EDGE_MARGIN := 1.0     # keep the walkable edge in from the play boundary
const STREAM_MARGIN := 1.2   # keep off the water + wet edge

var _ground: Callable
var _stream_dist: Callable
var _stream_half: float = 2.6
var _center: Vector2 = Vector2.ZERO
var _radius: float = 40.0
var _pads: Array = []         # [{c:Vector2, r:float}] — house no-go discs
var _blockers: Array = []     # [Rect2] — solid-prop XZ footprints
var _anchors: Array = []      # [Vector2] — safe destination seeds
var _region: NavigationRegion3D

func configure(ground: Callable, stream_dist: Callable, stream_half: float,
		center: Vector2, radius: float, pads: Array, blockers: Array, anchors: Array) -> void:
	_ground = ground
	_stream_dist = stream_dist
	_stream_half = stream_half
	_center = center
	_radius = radius
	_pads = pads
	_blockers = blockers
	_anchors = anchors

## Build the NavigationRegion3D + terrain-conforming grid navmesh (once).
func build() -> void:
	var nm := NavigationMesh.new()
	nm.agent_radius = 0.35
	nm.agent_height = 1.6
	nm.cell_size = 0.25
	var min_x := _center.x - _radius - CELL
	var min_z := _center.y - _radius - CELL
	var cols := int(ceil((_radius * 2.0 + CELL * 2.0) / CELL)) + 1
	var rows := cols
	var verts := PackedVector3Array()
	verts.resize(cols * rows)
	for j in rows:
		for i in cols:
			var x := min_x + float(i) * CELL
			var z := min_z + float(j) * CELL
			verts[j * cols + i] = Vector3(x, _ground.call(x, z), z)
	nm.vertices = verts
	for j in rows - 1:
		for i in cols - 1:
			var cx := min_x + (float(i) + 0.5) * CELL
			var cz := min_z + (float(j) + 0.5) * CELL
			if not is_walkable(cx, cz):
				continue
			var a := j * cols + i
			var b := (j + 1) * cols + i
			var c := (j + 1) * cols + (i + 1)
			var d := j * cols + (i + 1)
			nm.add_polygon(PackedInt32Array([a, b, c, d]))   # CCW from above (up normal)
	_region = NavigationRegion3D.new()
	_region.name = "VillageNav"
	_region.navigation_mesh = nm
	add_child(_region)

## Pure geometric walkability test (also used to pre-filter destinations + tests):
## inside the play disc, clear of the stream, houses and solid props.
func is_walkable(x: float, z: float) -> bool:
	var p := Vector2(x, z)
	if p.distance_to(_center) > _radius - EDGE_MARGIN:
		return false
	if _stream_dist.is_valid() and float(_stream_dist.call(x, z)) < _stream_half + STREAM_MARGIN:
		return false
	for pad in _pads:
		if p.distance_to(pad["center"]) < float(pad["radius"]):
			return false
	for b in _blockers:
		if (b as Rect2).has_point(p):
			return false
	return true

## A grounded, walkable destination near a randomly chosen safe anchor (with
## jitter so routes vary), avoiding a point too close to `last`. Never returns a
## point in water / a house / a blocked area.
func random_destination(rng: RandomNumberGenerator, last: Vector3 = Vector3.INF) -> Vector3:
	for _try in 28:
		var a: Vector2 = _anchors[rng.randi() % _anchors.size()]
		var ang := rng.randf() * TAU
		var off := Vector2(cos(ang), sin(ang)) * rng.randf_range(2.0, 7.5)
		var p := a + off
		if not is_walkable(p.x, p.y):
			continue
		var w := Vector3(p.x, _ground.call(p.x, p.y), p.y)
		if last == Vector3.INF or Vector2(w.x, w.z).distance_to(Vector2(last.x, last.z)) > 4.0:
			return w
	var f: Vector2 = _anchors[0]
	return Vector3(f.x, _ground.call(f.x, f.y), f.y)

func has_region() -> bool:
	return _region != null and _region.navigation_mesh != null \
		and _region.navigation_mesh.get_polygon_count() > 0
