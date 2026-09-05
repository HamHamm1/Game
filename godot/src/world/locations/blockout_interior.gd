extends Node3D
## Phase-1 blockout interior (ART_DIRECTION.md §6 step 1 — primitives only).
## A small enclosed room with a PlayerSpawn, a pickup, and a LocationExitPoint
## to return outside. Instantiated at LocationLoader.OFFSET by the loader.

## Lighting category tag read by RegionLightingController (M2.2). Also the
## player home — a lived-in residential interior.
@export var lighting_category: StringName = &"residential"

func _ready() -> void:
	var wall := Color(0.5, 0.47, 0.44)
	# Floor.
	add_child(BlockoutUtil.static_box(Vector3(8.0, 0.4, 8.0), Vector3(0.0, -0.2, 0.0), Color(0.32, 0.29, 0.27)))
	# Walls.
	add_child(BlockoutUtil.static_box(Vector3(8.0, 3.0, 0.3), Vector3(0.0, 1.5, -4.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(8.0, 3.0, 0.3), Vector3(0.0, 1.5, 4.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 8.0), Vector3(-4.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 8.0), Vector3(4.0, 1.5, 0.0), wall))
	# Ceiling.
	add_child(BlockoutUtil.static_box(Vector3(8.0, 0.3, 8.0), Vector3(0.0, 3.15, 0.0), Color(0.4, 0.38, 0.36)))

	# Spawn just inside the exit.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 2.5))

	# A pickup inside the house.
	BlockoutUtil.add_pickup(self, Vector3(-1.5, 0.3, -1.5), &"egg", 3)

	# Exit back to the region.
	var exit_body := BlockoutUtil.static_box(
		Vector3(1.2, 2.4, 0.2), Vector3(0.0, 1.2, 3.9), Color(0.5, 0.35, 0.2))
	add_child(exit_body)
	var exit := LocationExitPoint.new()
	exit.prompt = "Exit house"
	exit_body.add_child(exit)
