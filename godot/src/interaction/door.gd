class_name Door
extends Interactable
## A door that toggles open/closed by rotating an assigned leaf node.
## GAME_SYSTEMS.md §3. Blockout-friendly: the leaf is any Node3D.

@export var locked: bool = false
@export var is_open: bool = false
## The pivoting part of the door (set in code by the blockout builder, or
## in the editor). If null, the door still toggles state silently.
var leaf: Node3D
@export var open_angle_degrees: float = 90.0

var _closed_rotation_y: float = 0.0

func _ready() -> void:
	if leaf != null:
		_closed_rotation_y = leaf.rotation.y
		_apply()

func can_interact(_player: Player) -> bool:
	return true

func get_interaction_prompt(_player: Player) -> String:
	if locked:
		return "Locked"
	return "Close door" if is_open else "Open door"

func interact(_player: Player) -> void:
	if locked:
		return
	is_open = not is_open
	_apply()
	WorldEvents.interacted.emit(self)

func _apply() -> void:
	if leaf == null:
		return
	var target := _closed_rotation_y + (deg_to_rad(open_angle_degrees) if is_open else 0.0)
	leaf.rotation.y = target
