class_name TerrainField
extends RefCounted
## M2.4-C — the deterministic height field for the hero village terrain. This is
## the single source of ground height: it is registered with GroundSampler so the
## existing chunked vegetation (and anything else that samples the ground) follows
## the terrain with no other change (GroundSampler documents this exact seam).
##
## Shape (gentle rural valley, comfortable for first-person walking):
##  - low-frequency rolling undulation, small in the village core, rising toward
##    the forest edge — never sharp steps or extreme hills inside the village;
##  - FLAT building pads: a level disc under each house (blended smoothly into the
##    surrounding roll) so every approved House A–H stays perfectly grounded;
##  - a carved STREAM channel following a curve, deepest at its centreline and
##    easing up to the banks — a real depression, not a plane on flat ground.
##
## Pure + deterministic (no RNG, no nodes) so it is headless-testable and both
## the terrain mesh and its heightmap collider are built from the same function.

const WATER_Y := -0.55            # stream surface height (below banks, above bed)

# M2.4-D.2 — FLOATING SKY-TOWN island. The ground is a finite plateau: gentle
# roll out to ISLAND_CORE, then a steep cliff dropping ISLAND_DROP metres into
# open sky by ISLAND_EDGE (no surrounding hills — the horizon is void/sky). The
# terrain mesh bounds are set just past ISLAND_EDGE so the island ends and you
# see sky beyond it.
const ISLAND_CORE := 95.0         # radius (from village centre) of the walkable top (village + forest)
const ISLAND_EDGE := 125.0        # radius by which the cliff has fully fallen away
const ISLAND_DROP := 160.0        # a tall, dramatic floating-mountain cliff into the void
const VILLAGE_RADIUS := 42.0      # inner radius kept for the hand-placed village; forest rings beyond

var _pads: Array = []             # [{c:Vector2, r:float, blend:float, h:float}]
var _stream: PackedVector2Array = PackedVector2Array()
var _stream_half := 2.6           # stream half-width (bank to centre) baseline
var _stream_bank := 2.2           # extra distance the channel eases up over (steeper, defined banks)
var _stream_depth := 1.35         # channel depth below the local bank (a real carved channel)
var _village_center := Vector2(0.0, -14.0)

## Configure the field. `pads` is an array of {center:Vector2, radius:float};
## `stream` is the stream centreline polyline (Vector2 XZ). Pad heights are baked
## from the base roll so each disc sits naturally in the terrain, just levelled.
func configure(pads: Array, stream: PackedVector2Array) -> void:
	_stream = stream
	_pads.clear()
	for p in pads:
		var c: Vector2 = p["center"]
		_pads.append({
			"c": c,
			"r": float(p["radius"]),
			"blend": 5.0,
			"h": _base(c.x, c.y),
		})

## Ground height at world XZ (metres). Base roll, stream carve, then pad levelling
## (pads win, so houses never sit on a slope or in the channel).
func height_at(x: float, z: float) -> float:
	var h := _base(x, z)
	h = _carve_stream(x, z, h)
	for pad in _pads:
		var d := Vector2(x, z).distance_to(pad["c"])
		var t := smoothstep(float(pad["r"]), float(pad["r"]) + float(pad["blend"]), d)
		h = lerpf(float(pad["h"]), h, t)
	return h

## Distance (XZ) from a point to the stream centreline, for shoreline dressing +
## exclusions. Large value when there is no stream configured.
func stream_distance(x: float, z: float) -> float:
	if _stream.size() < 2:
		return 1.0e9
	return _dist_to_polyline(Vector2(x, z))

func stream_points() -> PackedVector2Array:
	return _stream

func stream_half_width() -> float:
	return _stream_half

## Village centre (island centre) and the walkable-top radius — for placing the
## floating-island edge barrier + rim planting relative to the plateau.
func village_center() -> Vector2:
	return _village_center

func island_core_radius() -> float:
	return ISLAND_CORE

func village_radius() -> float:
	return VILLAGE_RADIUS

# --- internals --------------------------------------------------------------

func _base(x: float, z: float) -> float:
	var d := Vector2(x, z).distance_to(_village_center)
	# Gentle rolling; amplitude small in the core, larger toward the edges.
	var roll := sin(x * 0.055) * cos(z * 0.048) * 0.5 \
		+ sin((x - z) * 0.032) * 0.34 \
		+ sin(x * 0.09 + z * 0.061) * 0.18
	# Calm near the village, a little more rolling out under the forest (gentle,
	# never big hills), so the big island top reads as walkable ground.
	var amp := lerpf(0.45, 1.5, smoothstep(20.0, 90.0, d))
	# Floating island: past the flat core the ground falls away in a steep cliff
	# into open sky (replaces the old surrounding hills). Beyond ISLAND_EDGE the
	# mesh simply ends, so the village reads as a town floating in the sky.
	var drop := smoothstep(ISLAND_CORE, ISLAND_EDGE, d) * ISLAND_DROP
	return roll * amp - drop

func _carve_stream(x: float, z: float, h: float) -> float:
	if _stream.size() < 2:
		return h
	var d := _dist_to_polyline(Vector2(x, z))
	var reach := _stream_half + _stream_bank
	if d >= reach:
		return h
	# Deepest (bed) at the centreline, easing up to 0 at the bank reach.
	var t := smoothstep(0.0, 1.0, d / reach)
	var carve := lerpf(-_stream_depth, 0.0, t)
	return minf(h, carve)

func _dist_to_polyline(p: Vector2) -> float:
	var best := 1.0e9
	for i in _stream.size() - 1:
		best = minf(best, _dist_to_seg(p, _stream[i], _stream[i + 1]))
	return best

func _dist_to_seg(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len2 := ab.length_squared()
	if len2 < 0.0001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / len2, 0.0, 1.0)
	return p.distance_to(a + ab * t)
