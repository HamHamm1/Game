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
var mobile_hud: MobileHud
var pause_menu: PauseMenu

var _sun: DirectionalLight3D
var _environment: Environment
var _in_location: bool = false
var _return_position: Vector3 = Vector3.ZERO

func _ready() -> void:
	# Input actions are registered by the GameInput autoload, so they exist
	# for every scene (not just this one).
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

	mobile_hud = MobileHud.new()
	mobile_hud.name = "MobileHUD"
	mobile_hud.player = player
	add_child(mobile_hud)

	pause_menu = PauseMenu.new()
	pause_menu.name = "PauseMenu"
	add_child(pause_menu)

	# Apply the current graphics preset now, and whenever it changes.
	_apply_graphics()
	GraphicsManager.changed.connect(_apply_graphics)

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

## One lighting environment + sun for the whole game (avoids multiple
## WorldEnvironment conflicts). Real time-of-day × location lighting
## profiles arrive in Phase 2 (ART_DIRECTION.md §3).
func _setup_environment() -> void:
	var world_env := WorldEnvironment.new()
	world_env.name = "WorldEnvironment"
	_environment = Environment.new()
	_environment.background_mode = Environment.BG_COLOR
	_environment.background_color = Color(0.52, 0.62, 0.72)
	_environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	_environment.ambient_light_color = Color(0.62, 0.62, 0.66)
	_environment.ambient_light_energy = 0.45
	_environment.fog_light_color = Color(0.62, 0.68, 0.74)
	world_env.environment = _environment
	add_child(world_env)

	_sun = DirectionalLight3D.new()
	_sun.name = "Sun"
	_sun.rotation_degrees = Vector3(-50.0, -35.0, 0.0)
	_sun.light_energy = 1.2
	add_child(_sun)

## Apply the resolved graphics preset (GraphicsManager) to the scene's sun,
## environment, camera view distance, and 3D resolution scale (MOBILE_FIRST.md
## §5). Future systems (vegetation, reflections) read their intent from
## GraphicsManager when they exist — nothing expensive is created here just to
## have a toggle.
func _apply_graphics() -> void:
	if _sun == null or _environment == null:
		return
	var p := GraphicsManager.get_params()
	_sun.shadow_enabled = bool(p["shadows"])
	_sun.directional_shadow_max_distance = float(p["shadow_max_distance"])
	_environment.fog_enabled = bool(p["fog"])
	_environment.fog_density = float(p["fog_density"])
	_environment.glow_enabled = bool(p["glow"])
	_environment.ssao_enabled = bool(p["ssao"])
	if player != null and player.camera_rig != null and player.camera_rig.camera != null:
		player.camera_rig.camera.far = float(p["view_distance"])
	var vp := get_viewport()
	if vp != null:
		vp.scaling_3d_scale = float(p["scale_3d"])
		vp.msaa_3d = int(p["msaa"])
