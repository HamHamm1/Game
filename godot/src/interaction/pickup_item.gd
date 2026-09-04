class_name PickupItem
extends Interactable
## A world item the player can pick up into their inventory.
## GAME_SYSTEMS.md §3 / §9. On pickup it adds to the player's inventory and
## frees the physical object it is attached to.

@export var item_id: StringName = &"fish"
@export var quantity: int = 1
## The spatial/physics node representing this pickup in the world; freed on
## pickup. Set by the blockout builder (usually this node's parent body).
var world_body: Node

func get_interaction_prompt(_player: Player) -> String:
	var def := ItemRegistry.get_definition(item_id)
	var name_str := def.display_name if def != null else String(item_id)
	if quantity > 1:
		return "Pick up %s x%d" % [name_str, quantity]
	return "Pick up %s" % name_str

func get_interaction_verb(_player: Player) -> String:
	return "PICK UP"

func can_interact(_player: Player) -> bool:
	return ItemRegistry.has_definition(item_id)

func interact(player: Player) -> void:
	if player.inventory == null:
		push_error("PickupItem: player has no inventory.")
		return
	player.inventory.add_item(item_id, quantity)
	WorldEvents.interacted.emit(self)
	var to_free: Node = world_body if world_body != null else self
	to_free.queue_free()
