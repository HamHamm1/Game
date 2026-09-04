extends Node
## ItemRegistry — loads item *definitions* from data/items/*.json and serves
## them as typed ItemDefinition objects. GAME_SYSTEMS.md §9, ARCHITECTURE.md
## §8. This is the reference implementation of the data pattern every other
## content domain (recipes, npcs, quests, dialogue) will follow
## (TECHNICAL_ROADMAP.md §2.1): JSON on disk, validated + typed at load,
## errors reported with the offending file.

const ITEMS_DIR := "res://data/items"

var _defs: Dictionary = {}  # StringName -> ItemDefinition

func _ready() -> void:
	_load_all()

func _load_all() -> void:
	_defs.clear()
	var dir := DirAccess.open(ITEMS_DIR)
	if dir == null:
		push_warning("ItemRegistry: no items directory at %s (0 items)." % ITEMS_DIR)
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.get_extension() == "json":
			_load_file(ITEMS_DIR.path_join(file_name))
		file_name = dir.get_next()
	dir.list_dir_end()
	print("ItemRegistry: loaded %d item definition(s)." % _defs.size())

func _load_file(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("ItemRegistry: cannot open %s" % path)
		return
	var text := file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("ItemRegistry: %s is not a JSON object." % path)
		return
	var d: Dictionary = parsed

	# id comes from the "id" field, falling back to the file name.
	var item_id := String(d.get("id", path.get_file().get_basename()))
	var def := ItemDefinition.from_dict(item_id, d)
	if def == null:
		return  # from_dict already reported the error
	if _defs.has(def.id):
		push_warning("ItemRegistry: duplicate item id '%s' (%s overrides)." % [def.id, path])
	_defs[def.id] = def

func get_definition(id: StringName) -> ItemDefinition:
	return _defs.get(id, null)

func has_definition(id: StringName) -> bool:
	return _defs.has(id)

func all_ids() -> Array:
	return _defs.keys()

## Dev/test convenience — reload from disk (the hot-reload seam from
## TECHNICAL_ROADMAP.md §2.1; not wired to a file watcher yet).
func reload() -> void:
	_load_all()
