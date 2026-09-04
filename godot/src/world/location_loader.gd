class_name LocationLoader
extends Node
## Loads/unloads interior location scenes (ARCHITECTURE.md §3), keeping the
## region loaded underneath. Same synchronous-now / threaded-later seam as
## RegionLoader.
##
## Phase-1 shortcut: interiors are instantiated at a large spatial OFFSET so
## they never overlap the region's geometry, and the player is teleported in
## and out. Proper region hide / occlusion / streaming replaces this later
## (ARCHITECTURE.md §3, §14) — the caller-facing API does not change when it
## does.

const OFFSET := Vector3(1000.0, 0.0, 0.0)

var _active: Node3D

func load_location(path: String) -> Node3D:
	unload()
	var packed := load(path) as PackedScene
	if packed == null:
		push_error("LocationLoader: could not load location scene '%s'." % path)
		return null
	_active = packed.instantiate() as Node3D
	_active.position = OFFSET
	add_child(_active)
	WorldEvents.location_entered.emit(path)
	return _active

func unload() -> void:
	if is_instance_valid(_active):
		_active.queue_free()
		_active = null
		WorldEvents.location_exited.emit()
	else:
		_active = null

func active() -> Node3D:
	return _active

func offset() -> Vector3:
	return OFFSET
