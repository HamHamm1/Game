extends Node3D
## M2.1 blockout interior — Restaurant. Grey-box primitives only
## (ART_DIRECTION.md §6 step 1, MOBILE_ART_DIRECTION.md §57/§58). A slightly
## larger room than the player home with a couple of table blockouts, a
## counter, a PlayerSpawn, and a LocationExitPoint back outside. No cooking
## system, NPCs, or menu — those are Phase 3+/4.

func _ready() -> void:
	var wall := Color(0.58, 0.48, 0.38)
	var floor_col := Color(0.36, 0.30, 0.24)
	# Floor.
	add_child(BlockoutUtil.static_box(Vector3(10.0, 0.4, 8.0), Vector3(0.0, -0.2, 0.0), floor_col))
	# Walls.
	add_child(BlockoutUtil.static_box(Vector3(10.0, 3.0, 0.3), Vector3(0.0, 1.5, -4.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(10.0, 3.0, 0.3), Vector3(0.0, 1.5, 4.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 8.0), Vector3(-5.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 8.0), Vector3(5.0, 1.5, 0.0), wall))
	# Ceiling (visual only — player can't reach it).
	add_child(BlockoutUtil.visual_box(Vector3(10.0, 0.3, 8.0), Vector3(0.0, 3.15, 0.0), Color(0.42, 0.38, 0.32)))

	# Spawn just inside the exit.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 2.5))

	# Counter along the back wall.
	add_child(BlockoutUtil.static_box(Vector3(6.0, 1.0, 0.8), Vector3(0.0, 0.5, -3.2), Color(0.52, 0.40, 0.28)))
	# Two tables.
	add_child(BlockoutUtil.static_box(Vector3(1.8, 0.8, 1.2), Vector3(-2.5, 0.4, 0.5), Color(0.60, 0.46, 0.32)))
	add_child(BlockoutUtil.static_box(Vector3(1.8, 0.8, 1.2), Vector3(2.5, 0.4, 0.5), Color(0.60, 0.46, 0.32)))

	# Exit back to the region.
	var exit_body := BlockoutUtil.static_box(
		Vector3(1.2, 2.4, 0.2), Vector3(0.0, 1.2, 3.9), Color(0.5, 0.35, 0.2))
	add_child(exit_body)
	var exit := LocationExitPoint.new()
	exit.prompt = "Exit restaurant"
	exit_body.add_child(exit)
