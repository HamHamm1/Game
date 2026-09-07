extends Node3D
## M2.4 — a warm wooden interior for the hero houses (House A/B) and enterable
## village houses. Uses the EXISTING building/interior architecture: a
## PlayerSpawn marker + a LocationExitPoint (world_root handles the teleport
## back to the exterior return position). Modest furniture only — this task
## prioritises correct entry/exit + believable proportions over full dressing.
## Lit warm/readable by the M2.2 interior context (RegionLightingController).

## Lighting-profile tag read by RegionLightingController (M2.2).
@export var lighting_category: StringName = &"residential"

func _ready() -> void:
	var floor_m := MaterialLibrary.get_mat(&"floor_wood")
	var wall_m := MaterialLibrary.get_mat(&"wall_interior")
	var ceil_m := MaterialLibrary.get_mat(&"ceiling")
	var beam_m := MaterialLibrary.get_mat(&"wood_dark")
	var w := 7.0
	var d := 6.0
	var h := 2.9

	# Floor.
	add_child(BlockoutUtil.static_box_mat(Vector3(w, 0.3, d), Vector3(0.0, -0.15, 0.0), floor_m))
	# Back + side walls.
	add_child(BlockoutUtil.static_box_mat(Vector3(w, h, 0.3), Vector3(0.0, h * 0.5, -d * 0.5), wall_m))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, h, d), Vector3(-w * 0.5, h * 0.5, 0.0), wall_m))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.3, h, d), Vector3(w * 0.5, h * 0.5, 0.0), wall_m))
	# Front wall in two pieces leaving a central doorway gap.
	add_child(BlockoutUtil.static_box_mat(Vector3(w * 0.5 - 0.7, h, 0.3), Vector3(-(w * 0.25 + 0.35), h * 0.5, d * 0.5), wall_m))
	add_child(BlockoutUtil.static_box_mat(Vector3(w * 0.5 - 0.7, h, 0.3), Vector3(w * 0.25 + 0.35, h * 0.5, d * 0.5), wall_m))
	# Ceiling + a couple of exposed beams.
	add_child(BlockoutUtil.visual_box_mat(Vector3(w, 0.2, d), Vector3(0.0, h, 0.0), ceil_m))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.25, 0.25, d), Vector3(-1.8, h - 0.2, 0.0), beam_m))
	add_child(BlockoutUtil.visual_box_mat(Vector3(0.25, 0.25, d), Vector3(1.8, h - 0.2, 0.0), beam_m))

	# Exit door (collidable slab in the doorway) carrying the LocationExitPoint.
	var exit_body := BlockoutUtil.static_box_mat(
		Vector3(1.3, 2.3, 0.2), Vector3(0.0, 1.15, d * 0.5), MaterialLibrary.get_mat(&"wood_door"))
	add_child(exit_body)
	var exit := LocationExitPoint.new()
	exit.prompt = "Exit house"
	exit_body.add_child(exit)

	# Player spawns just inside, facing the exit (deterministic).
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, d * 0.5 - 1.4))

	# Modest furniture (wood): a low table + a shelf. Blockout only.
	add_child(BlockoutUtil.static_box_mat(Vector3(1.5, 0.4, 0.9), Vector3(-1.6, 0.2, -1.2), beam_m))
	add_child(BlockoutUtil.static_box_mat(Vector3(0.4, 1.5, 2.2), Vector3(w * 0.5 - 0.35, 0.75, -1.0), beam_m))
