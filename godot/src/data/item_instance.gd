class_name ItemInstance
extends RefCounted
## Mutable per-object item state (GAME_SYSTEMS.md §9). References a static
## ItemDefinition by id and carries state that varies per instance.
##
## Phase 1 only uses definition_id + quantity. Fields for quality/freshness/
## recipe_ref are intentionally reserved by the design (GAME_SYSTEMS.md §9)
## and will be added here without reshaping the save format (AI_RULES.md
## Rule 10). They are not implemented yet — do not fake them.

var definition_id: StringName
var quantity: int = 1

func _init(id: StringName = &"", qty: int = 1) -> void:
	definition_id = id
	quantity = qty

func definition() -> ItemDefinition:
	return ItemRegistry.get_definition(definition_id)

func to_dict() -> Dictionary:
	return {
		"id": String(definition_id),
		"qty": quantity,
	}

static func from_dict(d: Dictionary) -> ItemInstance:
	return ItemInstance.new(StringName(String(d.get("id", ""))), int(d.get("qty", 1)))
