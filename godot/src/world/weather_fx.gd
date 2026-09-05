class_name WeatherFX
extends Node3D
## Exterior weather visuals for M2.3 (M2.3_WEATHER_DESIGN.md §5/§6): one
## player-following rain emitter and a few localized mist planes. Preset- and
## interior-gated — LOW spawns nothing. Contains NO Environment or light writes
## and NO per-object rain; it only reads WeatherManager/GraphicsManager data.

const RAIN_MAX := 300
const RAIN_HEIGHT := 7.0
const MIST_MAX_ALPHA := 0.22

var _player: Node3D
var _rain: CPUParticles3D
var _mist_root: Node3D
var _interior: bool = false

func setup(player: Node3D) -> void:
	_player = player

func _ready() -> void:
	_build_rain()
	_build_mist()
	WorldEvents.weather_changed.connect(_on_weather_changed)
	WorldEvents.location_entered.connect(_on_location_entered)
	WorldEvents.location_exited.connect(_on_location_exited)
	WorldEvents.game_loaded.connect(_on_game_loaded)
	if GraphicsManager != null:
		GraphicsManager.changed.connect(_on_graphics_changed)
	_refresh()

## FX are allowed only outdoors and above the LOW effects tier (LOW=0.4).
static func allow_fx(effects: float, interior: bool) -> bool:
	return (not interior) and effects > 0.5

func _build_rain() -> void:
	_rain = CPUParticles3D.new()
	_rain.name = "Rain"
	_rain.emitting = false
	_rain.amount = RAIN_MAX
	_rain.lifetime = 1.0
	_rain.local_coords = false
	_rain.direction = Vector3(0.0, -1.0, 0.0)
	_rain.spread = 0.0
	_rain.gravity = Vector3(0.0, -40.0, 0.0)
	_rain.initial_velocity_min = 12.0
	_rain.initial_velocity_max = 16.0
	_rain.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_rain.emission_box_extents = Vector3(7.0, 0.5, 7.0)
	var mesh := QuadMesh.new()
	mesh.size = Vector2(0.02, 0.5)
	_rain.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(0.75, 0.80, 0.88, 0.35)
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_rain.material_override = mat
	# Parent to the player so rain surrounds the camera with zero per-frame code.
	var parent := _player if _player != null else self
	parent.add_child(_rain)
	_rain.position = Vector3(0.0, RAIN_HEIGHT, 0.0)

func _build_mist() -> void:
	_mist_root = Node3D.new()
	_mist_root.name = "Mist"
	add_child(_mist_root)
	# Localized patches near water/park (blockout_town layout, approximate;
	# tunable). Never a global fog volume.
	var spots := [Vector3(-8.0, 0.4, 8.0), Vector3(10.0, 0.4, 2.0), Vector3(-4.0, 0.4, -6.0)]
	for i in spots.size():
		var plane := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(10.0, 10.0)
		plane.mesh = pm
		plane.position = spots[i]
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(0.86, 0.89, 0.93, 0.0)
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		plane.material_override = mat
		plane.visible = false
		_mist_root.add_child(plane)

func _on_weather_changed(_old: int, _new_state: int) -> void:
	_refresh()

func _on_location_entered(_path: String) -> void:
	_interior = true
	_refresh()

func _on_location_exited() -> void:
	_interior = false
	_refresh()

func _on_game_loaded() -> void:
	_refresh()

func _on_graphics_changed() -> void:
	_refresh()

func _refresh() -> void:
	var effects := 1.0
	if GraphicsManager != null:
		effects = float(GraphicsManager.get_params().get("effects", 1.0))
	var allow := allow_fx(effects, _interior)
	var fx: WeatherTypes.FxSpec = WeatherManager.fx_spec() if WeatherManager != null else WeatherTypes.FxSpec.new()
	_apply_rain((fx.rain if allow else 0.0), effects)
	_apply_mist(fx.mist if allow else 0.0)

func _apply_rain(intensity: float, effects: float) -> void:
	if _rain == null:
		return
	if intensity <= 0.0:
		_rain.emitting = false
		return
	_rain.amount = int(clampf(float(RAIN_MAX) * intensity * effects, 1.0, float(RAIN_MAX)))
	_rain.emitting = true

func _apply_mist(intensity: float) -> void:
	if _mist_root == null:
		return
	var alpha := clampf(intensity, 0.0, 1.0) * MIST_MAX_ALPHA
	for child in _mist_root.get_children():
		var mi := child as MeshInstance3D
		if mi == null:
			continue
		mi.visible = intensity > 0.0
		var mat := mi.material_override as StandardMaterial3D
		if mat != null:
			var c := mat.albedo_color
			c.a = alpha
			mat.albedo_color = c
