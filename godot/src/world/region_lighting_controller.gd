class_name RegionLightingController
extends Node
## Drives the single WorldEnvironment + Sun (owned by world_root) from the
## game clock and the current location context (M2.2_LIGHTING_DESIGN.md).
##
## One controller for the whole game (the world has one global environment,
## not one per region). It re-reads the active scene's `lighting_category`
## tag on region/location changes, resolves a LightingProfile for the current
## minute, and writes ONLY the mood properties — never the GraphicsManager-
## owned cost knobs (shadows / fog-density / glow / ssao / scale / msaa), so
## LOW stays LOW (design §7).
##
## Event-driven: applies on minute_passed (~1 Hz), on context changes, and on
## game_loaded. No _process, no per-frame cost. Lighting keeps no saved state
## — it is a pure function of TimeManager (already saved) + context (design §9).

var _sun: DirectionalLight3D
var _environment: Environment
var _region_loader: RegionLoader
var _location_loader: LocationLoader

var _interior: bool = false
var _category: StringName = &""
var _mystery: float = 0.0

## Called by world_root before add_child, so refs exist when _ready runs.
func setup(sun: DirectionalLight3D, env: Environment,
		region_loader: RegionLoader, location_loader: LocationLoader) -> void:
	_sun = sun
	_environment = env
	_region_loader = region_loader
	_location_loader = location_loader

func _ready() -> void:
	WorldEvents.minute_passed.connect(_on_minute_passed)
	WorldEvents.region_loaded.connect(_on_region_loaded)
	WorldEvents.location_entered.connect(_on_location_entered)
	WorldEvents.location_exited.connect(_on_location_exited)
	WorldEvents.game_loaded.connect(_on_game_loaded)
	_refresh()

func _on_minute_passed(_day: int, _minutes: int) -> void:
	_apply_current()

func _on_region_loaded(_path: String) -> void:
	_interior = false
	_read_context_from(_region_loader.active() if _region_loader != null else null)
	_apply_current()

func _on_location_entered(_path: String) -> void:
	_interior = true
	_read_context_from(_location_loader.active() if _location_loader != null else null)
	_apply_current()

func _on_location_exited() -> void:
	_interior = false
	_read_context_from(_region_loader.active() if _region_loader != null else null)
	_apply_current()

func _on_game_loaded() -> void:
	_refresh()

## Re-derive context from whichever scene is currently active, then apply.
func _refresh() -> void:
	if _location_loader != null and _location_loader.active() != null:
		_interior = true
		_read_context_from(_location_loader.active())
	else:
		_interior = false
		_read_context_from(_region_loader.active() if _region_loader != null else null)
	_apply_current()

## Read the optional per-scene data tags (no error if absent).
func _read_context_from(node: Node) -> void:
	_category = _tag_string(node, "lighting_category")
	_mystery = _tag_float(node, "lighting_mystery")

static func _tag_string(node: Node, prop: String) -> StringName:
	if node == null:
		return &""
	var v: Variant = node.get(prop)
	if v is StringName:
		return v
	if v is String and not (v as String).is_empty():
		return StringName(v)
	return &""

static func _tag_float(node: Node, prop: String) -> float:
	if node == null:
		return 0.0
	var v: Variant = node.get(prop)
	if v is float or v is int:
		return float(v)
	return 0.0

func _apply_current() -> void:
	var minute := TimeManager.minutes_into_day if TimeManager != null else 480
	apply_for_minute(minute)

## Public for tests: resolve + apply for an explicit minute using the current
## context (_interior / _category / _mystery).
func apply_for_minute(minute: int) -> void:
	if _sun == null or _environment == null:
		return
	var p := LightingProfile.resolve(minute, _interior, _category, _mystery)
	# Mood-only writes. GraphicsManager owns shadows/fog-density/glow/ssao/etc.
	_sun.rotation_degrees = Vector3(p.sun_pitch_deg, p.sun_yaw_deg, 0.0)
	_sun.light_energy = p.sun_energy
	_sun.light_color = p.sun_color
	_environment.ambient_light_color = p.ambient_color
	_environment.ambient_light_energy = p.ambient_energy
	_environment.background_color = p.bg_color
	_environment.fog_light_color = p.fog_color
