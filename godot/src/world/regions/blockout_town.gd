extends Node3D
## Phase-1 blockout region (ART_DIRECTION.md §6 step 1 — primitives only).
## Builds a small outdoor space with: a ground plane, a house with an
## enterable doorway (LocationEntryPoint), a freestanding openable Door, two
## pickups, and a PlayerSpawn marker. Everything is grey-box on purpose; it
## exists to test movement / camera / interaction / scene-transition, not to
## look good yet.

func _ready() -> void:
	# Ground.
	add_child(BlockoutUtil.static_box(
		Vector3(40.0, 0.4, 40.0), Vector3(0.0, -0.2, 0.0), Color(0.42, 0.46, 0.40)))

	# Player start.
	BlockoutUtil.add_spawn(self, "PlayerSpawn", Vector3(0.0, 0.05, 0.0))

	# A house with a doorway you can enter.
	_build_house(Vector3(0.0, 0.0, -8.0))

	# A freestanding door you can open/close.
	_build_door(Vector3(5.0, 0.0, -3.0))

	# Pickups.
	BlockoutUtil.add_pickup(self, Vector3(2.0, 0.3, -2.0), &"fish", 2)
	BlockoutUtil.add_pickup(self, Vector3(-2.5, 0.3, -3.0), &"rice", 5)

func _build_house(center: Vector3) -> void:
	var wall := Color(0.66, 0.62, 0.55)
	# Back and side walls.
	add_child(BlockoutUtil.static_box(Vector3(6.0, 3.0, 0.3), center + Vector3(0.0, 1.5, -2.5), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 5.0), center + Vector3(-3.0, 1.5, 0.0), wall))
	add_child(BlockoutUtil.static_box(Vector3(0.3, 3.0, 5.0), center + Vector3(3.0, 1.5, 0.0), wall))
	# Front wall in two pieces, leaving a doorway gap in the middle.
	add_child(BlockoutUtil.static_box(Vector3(2.4, 3.0, 0.3), center + Vector3(-1.8, 1.5, 2.5), wall))
	add_child(BlockoutUtil.static_box(Vector3(2.4, 3.0, 0.3), center + Vector3(1.8, 1.5, 2.5), wall))
	# Roof.
	add_child(BlockoutUtil.static_box(Vector3(6.3, 0.3, 5.3), center + Vector3(0.0, 3.15, 0.0), Color(0.5, 0.4, 0.35)))

	# The door slab in the doorway: an interactable that loads the interior.
	var entry_body := BlockoutUtil.static_box(
		Vector3(1.2, 2.4, 0.2), center + Vector3(0.0, 1.2, 2.5), Color(0.5, 0.35, 0.2))
	add_child(entry_body)
	var entry := LocationEntryPoint.new()
	entry.location_scene = "res://src/world/locations/blockout_interior.tscn"
	entry.spawn_name = "PlayerSpawn"
	entry.prompt = "Enter house"
	entry_body.add_child(entry)

func _build_door(pos: Vector3) -> void:
	var post := Color(0.4, 0.32, 0.24)
	add_child(BlockoutUtil.static_box(Vector3(0.2, 2.4, 0.2), pos + Vector3(-0.7, 1.2, 0.0), post))
	add_child(BlockoutUtil.static_box(Vector3(0.2, 2.4, 0.2), pos + Vector3(0.7, 1.2, 0.0), post))

	# Hinge pivot at the left post; leaf extends to the right of it.
	var pivot := Node3D.new()
	pivot.name = "DoorPivot"
	pivot.position = pos + Vector3(-0.6, 1.2, 0.0)
	add_child(pivot)

	var leaf := BlockoutUtil.static_box(Vector3(1.2, 2.2, 0.1), Vector3(0.6, 0.0, 0.0), Color(0.56, 0.42, 0.26))
	pivot.add_child(leaf)

	var door := Door.new()
	door.leaf = pivot
	leaf.add_child(door)
