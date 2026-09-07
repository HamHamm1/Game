class_name GroundSampler
extends RefCounted
## The single source of ground height for placement (M2.4 grounding rule):
## every vegetation instance derives its Y from here, never from a hardcoded
## fixed Y. The blockout world is a flat walkable plane whose top surface is
## y = 0 (a 100x100 StaticBody3D box at y=-0.2, size.y 0.4), so height_at()
## returns GROUND_Y for that reliable height representation.
##
## This is the deliberate SEAM for real terrain: replace the body of
## height_at() with a heightmap lookup (or wire raycast_height() at build time)
## and all callers ground correctly with no other change. height_at() is pure
## and deterministic so grounding is headless-testable without physics or the
## RenderingServer.

const GROUND_Y := 0.0

## Optional terrain height provider (M2.4-C). A region installs one at build time
## (e.g. `GroundSampler.set_height_provider(terrain.height_at)`); every caller —
## including the chunked vegetation — then grounds on the terrain with no other
## change. When none is set the world is the flat blockout plane (GROUND_Y), so
## existing content and headless tests keep the exact flat behaviour.
static var _height_provider: Callable = Callable()

static func set_height_provider(fn: Callable) -> void:
	_height_provider = fn

static func clear_height_provider() -> void:
	_height_provider = Callable()

static func has_height_provider() -> bool:
	return _height_provider.is_valid()

## Ground height at a world XZ. Terrain provider if installed, else flat GROUND_Y.
static func height_at(x: float, z: float) -> float:
	if _height_provider.is_valid():
		return float(_height_provider.call(x, z))
	return GROUND_Y

## Optional runtime backend: raycast straight down against real collision and
## return the hit Y, or NAN on a miss. Not used by the flat blockout (height_at
## is exact there) and not headless-testable; provided for the terrain phase.
static func raycast_height(world: World3D, x: float, z: float,
		top_y: float = 50.0, bottom_y: float = -50.0) -> float:
	if world == null:
		return NAN
	var space := world.direct_space_state
	if space == null:
		return NAN
	var q := PhysicsRayQueryParameters3D.create(Vector3(x, top_y, z), Vector3(x, bottom_y, z))
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return NAN
	return (hit["position"] as Vector3).y
