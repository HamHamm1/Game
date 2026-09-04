extends Node3D
## The persistent root of the game (ARCHITECTURE.md §3). Never unloaded.
## Owns the player, the region/location loaders, the HUD, and the single
## lighting environment; fulfils location transition requests that
## interactables emit on WorldEvents (keeping interactables decoupled from
## the loading machinery). This is the script attached to main.tscn.

const START_REGION := "res://src/world/regions/blockout_town.tscn"

var player: Player
var region_loader: RegionLoader
var location_loader: LocationLoader
var hud: Hud

var _in_location: bool = false
var _return_position: Vector3 = Vector3.ZERO

func _ready() -> void:
	_setup_input()
	_setup_environment()

	region_loader = RegionLoader.new()
	region_loader.name = "RegionLoader"
	add_child(region_loader)

	location_loader = LocationLoader.new()
	location_loader.name = "LocationLoader"
	add_child(location_loader)

	player = Player.new()
	player.name = "Player"
	add_child(player)

	hud = Hud.new()
	hud.name = "HUD"
	hud.player = player
	add_child(hud)

	WorldEvents.location_transition_requested.connect(_on_enter_location)
	WorldEvents.location_exit_requested.connect(_on_exit_location)

	var region := region_loader.load_region(START_REGION)
	_place_player_at_spawn(region, "PlayerSpawn")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("quicksave"):
		SaveManager.save_game()
	elif event.is_action_pressed("quickload"):
		SaveManager.load_game()

func _on_enter_location(scene_path: String, spawn_name: String) -> void:
	if _in_location:
		return
	_return_position = player.global_position
	_in_location = true
	var loc := location_loader.load_location(scene_path)
	_place_player_at_spawn(loc, spawn_name)

func _on_exit_location() -> void:
	if not _in_location:
		return
	location_loader.unload()
	_in_location = false
	player.teleport_to(_return_position)

func _place_player_at_spawn(root: Node3D, spawn_name: String) -> void:
	if root == null:
		return
	var marker := root.find_child(spawn_name, true, false)
	if marker is Node3D:
		player.teleport_to((marker as Node3D).global_position)

## Input actions are registered in code so the project has no fragile
## hand-authored input-map encoding (they can be migrated to the editor's
## Input Map panel later). Physical keycodes = keyboard-layout independent.
func _setup_input() -> void:
	_bind("move_forward", [KEY_W, KEY_UP])
	_bind("move_back", [KEY_S, KEY_DOWN])
	_bind("move_left", [KEY_A, KEY_LEFT])
	_bind("move_right", [KEY_D, KEY_RIGHT])
	_bind("sprint", [KEY_SHIFT])
	_bind("crouch", [KEY_CTRL])
	_bind("jump", [KEY_SPACE])
	_bind("interact", [KEY_E])
	_bind("quicksave", [KEY_F5])
	_bind("quickload", [KEY_F9])

func _bind(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)

## One lighting environment + sun for the whole game (avoids multiple
## WorldEnvironment conflicts). Real time-of-day × location lighting
## profiles arrive in Phase 2 (ART_DIRECTION.md §3).
func _setup_environment() -> void:
	var world_env := WorldEnvironment.new()
	world_env.name = "WorldEnvironment"
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.52, 0.62, 0.72)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.62, 0.66)
	env.ambient_light_energy = 0.45
	world_env.environment = env
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-50.0, -35.0, 0.0)
	sun.light_energy = 1.2
	sun.shadow_enabled = true
	add_child(sun)
