class_name PlayerInventory
extends Node
## The player's item container. GAME_SYSTEMS.md §9. Holds ItemInstance
## objects and stacks them per the item's ItemDefinition.stack_size. Other
## container types (chests, shop stock) will speak the same instance API
## rather than being new inventory systems (AI_RULES.md Rule 3).

var _slots: Array[ItemInstance] = []

func add_item(id: StringName, qty: int = 1) -> void:
	if qty <= 0:
		return
	if not ItemRegistry.has_definition(id):
		push_warning("PlayerInventory: adding unknown item '%s'." % id)
	var def := ItemRegistry.get_definition(id)
	var stack := def.stack_size if def != null else 1
	var remaining := qty

	if stack > 1:
		for inst in _slots:
			if inst.definition_id == id and inst.quantity < stack:
				var add := mini(stack - inst.quantity, remaining)
				inst.quantity += add
				remaining -= add
				if remaining <= 0:
					break

	while remaining > 0:
		var chunk := mini(stack, remaining) if stack > 1 else 1
		_slots.append(ItemInstance.new(id, chunk))
		remaining -= chunk

	WorldEvents.inventory_changed.emit()

func remove_item(id: StringName, qty: int = 1) -> bool:
	var remaining := qty
	for i in range(_slots.size() - 1, -1, -1):
		var inst := _slots[i]
		if inst.definition_id == id:
			var take := mini(inst.quantity, remaining)
			inst.quantity -= take
			remaining -= take
			if inst.quantity <= 0:
				_slots.remove_at(i)
			if remaining <= 0:
				break
	if remaining < qty:
		WorldEvents.inventory_changed.emit()
	return remaining <= 0

func total_of(id: StringName) -> int:
	var sum := 0
	for inst in _slots:
		if inst.definition_id == id:
			sum += inst.quantity
	return sum

func slot_count() -> int:
	return _slots.size()

func slots() -> Array[ItemInstance]:
	return _slots

func get_save_data() -> Dictionary:
	var arr: Array = []
	for inst in _slots:
		arr.append(inst.to_dict())
	return {"slots": arr}

func load_save_data(data: Dictionary) -> void:
	_slots.clear()
	for entry in data.get("slots", []):
		if entry is Dictionary:
			_slots.append(ItemInstance.from_dict(entry))
	WorldEvents.inventory_changed.emit()
