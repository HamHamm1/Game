extends Node
## AutosaveManager — triggers safe autosaves (MOBILE_FIRST.md §22). Saves on
## meaningful moments (location transitions, inventory changes) and on a
## periodic interval, debounced so it never saves every frame. Lifecycle
## events (app pause/quit) bypass the debounce because those are the moments
## progress is most likely to be lost.

@export var min_interval_seconds: float = 20.0
@export var periodic_interval_seconds: float = 120.0

var _last_save_time: float = -1000.0
var _periodic_accum: float = 0.0

func _ready() -> void:
	WorldEvents.location_entered.connect(_on_location_changed)
	WorldEvents.location_exited.connect(_on_location_exited)
	WorldEvents.inventory_changed.connect(_on_inventory_changed)

func _process(delta: float) -> void:
	_periodic_accum += delta
	if _periodic_accum >= periodic_interval_seconds:
		_periodic_accum = 0.0
		request_autosave("periodic")

func _on_location_changed(_scene_path: String) -> void:
	request_autosave("location_enter")

func _on_location_exited() -> void:
	request_autosave("location_exit")

func _on_inventory_changed() -> void:
	request_autosave("inventory")

## Attempt an autosave. `force` (used by app-lifecycle events) bypasses the
## debounce. Returns true if a save was written.
func request_autosave(reason: String, force: bool = false) -> bool:
	if not SaveManager.can_autosave():
		return false  # nothing meaningful to save yet (e.g. before player exists)
	var now := Time.get_ticks_msec() / 1000.0
	if not force and (now - _last_save_time) < min_interval_seconds:
		return false
	_last_save_time = now
	if SaveManager.save_game():
		WorldEvents.autosaved.emit(reason)
		return true
	return false
