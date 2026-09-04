class_name RegionLoader
extends Node
## Loads/unloads outdoor region scenes (ARCHITECTURE.md §3). Phase 1:
## synchronous instantiate/free. The interface is deliberately shaped so a
## threaded implementation (ResourceLoader.load_threaded_request, the
## skelerealms WorldLoader pattern) can replace the body later WITHOUT
## changing any caller — "design the seam now, fill it in when profiling
## says to" (ARCHITECTURE.md §3, §14).

var _active: Node3D

func load_region(path: String) -> Node3D:
	unload()
	var packed := load(path) as PackedScene
	if packed == null:
		push_error("RegionLoader: could not load region scene '%s'." % path)
		return null
	_active = packed.instantiate() as Node3D
	add_child(_active)
	WorldEvents.region_loaded.emit(path)
	return _active

func unload() -> void:
	if is_instance_valid(_active):
		_active.queue_free()
	_active = null

func active() -> Node3D:
	return _active
