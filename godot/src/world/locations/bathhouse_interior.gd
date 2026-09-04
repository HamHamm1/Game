extends Node3D
## M2.1 blockout interior — Bathhouse landmark. Grey-box primitives only.
## The hero location (DESIGN.md §3, MOBILE_ART_DIRECTION.md §27) — larger
## than the other interiors, with a raised bath basin blockout and a
## PlayerSpawn/LocationExitPoint. No water surface art, steam, or lighting
## profile yet (Phase 2 M2.2/M2.4 and Phase 4 atmosphere).

func _ready() -> void:
	var wall := Color(0.60, 0.48, 0.36)
	var floor_col := Color(0.34, 0.28, 0.22)
	# Floor.
	add_child(BlockoutUtil.static_box(Vector3(14.0, 0.4, 12.0), Vector3(0.0, -0.2, 0.0), floor_col))
	# Walls.
	add_child(BlockoutUtil.static_box(Vector3(14.0, 4.5, 0.3), Vector3(0.0, 2.25, -6.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(14.0, 4.5, 0.3), Vector3(0.0, 2.25, 6.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 4.5, 12.0), Vector3(-7.0, 2.25, 0.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 4.5, 12.0), Vector3(7.0, 2.25, 0.0), wall))
	# Ceiling (visual only).
	add_child(BlockoutUtil.visual_box(Vector3(14.0, 0.3, 12.0), Vector3(0.0, 4.65, 0.0), Color(0.44, 0.36, 0.28)))

	# Spawn just inside the exit.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 4.0))

	# Central raised bath basin (a low walled rectangle you can walk around).
	var basin_col := Color(0.36, 0.42, 0.50)
	var basin_wall := Color(0.44, 0.40, 0.34)
	# Basin walls (collidable, low).
	add_child(BlockoutUtil.static_box(Vector3(6.0, 0.6, 0.3), Vector3(0.0, 0.3, -2.0), basin_wall))
	add_child(BlockoutUtil.static_box(Vector3(6.0, 0.6, 0.3), Vector3(0.0, 0.3, 1.0), basin_wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 0.6, 3.0), Vector3(-3.0, 0.3, -0.5), basin_wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 0.6, 3.0), Vector3(3.0, 0.3, -0.5), basin_wall))
	# Water surface (visual only, no collision — the low walls stop the player).
	add_child(BlockoutUtil.visual_box(Vector3(5.7, 0.05, 2.7), Vector3(0.0, 0.35, -0.5), basin_col))

	# Exit back to the region.
	var exit_body := BlockoutUtil.static_box(
		Vector3(1.4, 2.6, 0.2), Vector3(0.0, 1.3, 5.9), Color(0.5, 0.35, 0.2))
	add_child(exit_body)
	var exit := LocationExitPoint.new()
	exit.prompt = "Exit bathhouse"
	exit_body.add_child(exit)
