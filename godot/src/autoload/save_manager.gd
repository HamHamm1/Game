extends Node
## SaveManager — coordinates save/load across every system that has
## persistent state. See ARCHITECTURE.md §11, GAME_SYSTEMS.md §13.
##
## It owns no game state of its own. Each system registers itself and
## implements the contract:
##     func get_save_data() -> Dictionary
##     func load_save_data(data: Dictionary) -> void
## Adding a new persistent system = registering it + implementing the two
## methods; SaveManager's own code never changes (ARCHITECTURE.md §13.6).

const SAVE_PATH := "user://savegame.json"
## Bumped when the save schema changes. Old saves are migrated/handled by
## version, never silently broken (ARCHITECTURE.md §11).
const SAVE_VERSION := 1

## key(String) -> Object implementing get_save_data / load_save_data.
var _savables: Dictionary = {}

func register_savable(key: String, obj: Object) -> void:
	if not obj.has_method("get_save_data") or not obj.has_method("load_save_data"):
		push_error("SaveManager: '%s' does not implement the save contract." % key)
		return
	_savables[key] = obj

func unregister_savable(key: String) -> void:
	_savables.erase(key)

func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)

func save_game() -> bool:
	var systems := {}
	for key in _savables:
		var obj: Object = _savables[key]
		if is_instance_valid(obj):
			systems[key] = obj.get_save_data()
	var payload := {
		"version": SAVE_VERSION,
		"systems": systems,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_error("SaveManager: could not open save file for writing: %s" % SAVE_PATH)
		return false
	file.store_string(JSON.stringify(payload, "\t"))
	file.close()
	WorldEvents.game_saved.emit()
	return true

func load_game() -> bool:
	if not has_save():
		push_warning("SaveManager: no save file to load.")
		return false
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_error("SaveManager: could not open save file for reading.")
		return false
	var text := file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("SaveManager: save file is not a valid object.")
		return false
	var data: Dictionary = parsed

	var version: int = int(data.get("version", 0))
	if version != SAVE_VERSION:
		# Phase 1: single version. Future versions migrate here rather than
		# fail (ARCHITECTURE.md §11).
		push_warning("SaveManager: save version %d != current %d." % [version, SAVE_VERSION])

	var systems: Dictionary = data.get("systems", {})
	for key in _savables:
		var obj: Object = _savables[key]
		if is_instance_valid(obj) and systems.has(key):
			obj.load_save_data(systems[key])
	WorldEvents.game_loaded.emit()
	return true
