extends Node3D
## M2.1 blockout interior — Shop. Grey-box primitives only. A small room
## with a shop counter, a couple of shelf blockouts, a PlayerSpawn, and a
## LocationExitPoint. No shop/economy system yet (Phase 4).

## Lighting category tag read by RegionLightingController (M2.2).
@export var lighting_category: StringName = &"commercial"

func _ready() -> void:
	var wall := Color(0.54, 0.50, 0.44)
	var floor_col := Color(0.30, 0.28, 0.24)
	# Floor.
	add_child(BlockoutUtil.static_box(Vector3(8.0, 0.4, 7.0), Vector3(0.0, -0.2, 0.0), floor_col))
	# Walls.
	add_child(BlockoutUtil.static_box(Vector3(8.0, 3.0, 0.3), Vector3(0.0, 1.5, -3.5), wall))
	add_child(BlockoutUtil.static_box(Vector3(8.0, 3.0, 0.3), Vector3(0.0, 1.5, 3.5), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 7.0), Vector3(-4.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 7.0), Vector3(4.0, 1.5, 0.0), wall))
	# Ceiling (visual only).
	add_child(BlockoutUtil.visual_box(Vector3(8.0, 0.3, 7.0), Vector3(0.0, 3.15, 0.0), Color(0.40, 0.38, 0.34)))

	# Spawn just inside the exit.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 2.0))

	# Shop counter across the back.
	add_child(BlockoutUtil.static_box(Vector3(5.0, 1.0, 0.6), Vector3(0.0, 0.5, -2.8), Color(0.48, 0.36, 0.24)))
	# Two shelves against the side walls.
	add_child(BlockoutUtil.static_box(Vector3(0.5, 2.0, 3.0), Vector3(-3.5, 1.0, 0.0), Color(0.50, 0.42, 0.32)))
	add_child(BlockoutUtil.static_box(Vector3(0.5, 2.0, 3.0), Vector3(3.5, 1.0, 0.0), Color(0.50, 0.42, 0.32)))

	# Exit back to the region.
	var exit_body := BlockoutUtil.static_box(
		Vector3(1.2, 2.4, 0.2), Vector3(0.0, 1.2, 3.4), Color(0.5, 0.35, 0.2))
	add_child(exit_body)
	var exit := LocationExitPoint.new()
	exit.prompt = "Exit shop"
	exit_body.add_child(exit)
