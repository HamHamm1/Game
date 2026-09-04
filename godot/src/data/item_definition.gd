class_name ItemDefinition
extends RefCounted
## Static, immutable definition of an item type (GAME_SYSTEMS.md §9).
## Distinct from ItemInstance, which is the mutable per-object state.
##
## Built from validated JSON by ItemRegistry — the reference implementation
## of the "JSON on disk → typed object at runtime" data pattern
## (TECHNICAL_ROADMAP.md §2.1). Gameplay code always holds this typed
## object, never a raw Dictionary (AI_RULES.md Rule 7).

const VALID_CATEGORIES: Array[String] = [
	"ingredient", "dish", "equipment", "gift", "quest", "material", "misc",
]

var id: StringName
var display_name: String
var category: StringName
var stack_size: int
var base_value: int
var tags: PackedStringArray

## Returns a validated ItemDefinition, or null if the data is malformed
## (with a pushed error naming the offending id/field).
static func from_dict(item_id: String, d: Dictionary) -> ItemDefinition:
	if item_id.is_empty():
		push_error("ItemDefinition: empty id.")
		return null

	var category_str := String(d.get("category", "misc"))
	if not VALID_CATEGORIES.has(category_str):
		push_error("ItemDefinition '%s': invalid category '%s'." % [item_id, category_str])
		return null

	var def := ItemDefinition.new()
	def.id = StringName(item_id)
	def.display_name = String(d.get("display_name", item_id))
	def.category = StringName(category_str)
	def.stack_size = maxi(1, int(d.get("stack_size", 1)))
	def.base_value = maxi(0, int(d.get("base_value", 0)))

	var tags := PackedStringArray()
	var raw_tags: Variant = d.get("tags", [])
	if raw_tags is Array:
		for t in raw_tags:
			tags.append(String(t))
	def.tags = tags
	return def

func is_stackable() -> bool:
	return stack_size > 1
