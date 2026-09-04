class_name LocationEntryPoint
extends Interactable
## A doorway/threshold that requests loading an interior location.
## ARCHITECTURE.md §3, GAME_SYSTEMS.md §3. It does not load anything itself
## — it emits a request on WorldEvents that the world root fulfils, keeping
## interactables decoupled from the scene-loading machinery (AI_RULES.md
## Rule 5).

## res:// path to the location scene to load.
@export var location_scene: String = ""
## Name of the Marker3D inside that scene to place the player at.
@export var spawn_name: String = "PlayerSpawn"
@export var prompt: String = "Enter"

func get_interaction_prompt(_player: Player) -> String:
	return prompt

func can_interact(_player: Player) -> bool:
	return not location_scene.is_empty()

func interact(_player: Player) -> void:
	WorldEvents.location_transition_requested.emit(location_scene, spawn_name)
