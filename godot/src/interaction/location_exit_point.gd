class_name LocationExitPoint
extends Interactable
## A threshold inside an interior that requests returning to the region the
## player came from. Counterpart to LocationEntryPoint. ARCHITECTURE.md §3.

@export var prompt: String = "Exit"

func get_interaction_prompt(_player: Player) -> String:
	return prompt

func get_interaction_verb(_player: Player) -> String:
	return "EXIT"

func interact(_player: Player) -> void:
	WorldEvents.location_exit_requested.emit()
