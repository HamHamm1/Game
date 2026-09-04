extends Node
## GraphicsManager — resolves a quality preset (LOW/MEDIUM/HIGH/ULTRA) into
## concrete rendering parameters (MOBILE_FIRST.md §5, MOBILE_ART_DIRECTION.md
## §50). It does NOT hold scene references; it emits `changed` and exposes
## get_params(), and the world root applies them to its environment / sun /
## camera / viewport. Systems that don't exist yet (vegetation, reflections,
## particles) read their intent value here when they are built — no
## expensive effect is created just to have a toggle (MOBILE_ART_DIRECTION.md
## §31, the user's "do not implement expensive effects for the sake of it").

signal changed()

const PRESETS: Dictionary = {
	"LOW": {
		"shadows": false, "shadow_max_distance": 20.0, "view_distance": 90.0,
		"fog": true, "fog_density": 0.020, "glow": false, "ssao": false,
		"scale_3d": 0.7, "msaa": 0,
		"reflections": false, "vegetation": 0.4, "effects": 0.4,
	},
	"MEDIUM": {
		"shadows": true, "shadow_max_distance": 40.0, "view_distance": 160.0,
		"fog": true, "fog_density": 0.012, "glow": false, "ssao": false,
		"scale_3d": 0.85, "msaa": 0,
		"reflections": false, "vegetation": 0.7, "effects": 0.7,
	},
	"HIGH": {
		"shadows": true, "shadow_max_distance": 80.0, "view_distance": 300.0,
		"fog": true, "fog_density": 0.008, "glow": true, "ssao": true,
		"scale_3d": 1.0, "msaa": 1,
		"reflections": true, "vegetation": 1.0, "effects": 1.0,
	},
	"ULTRA": {
		"shadows": true, "shadow_max_distance": 150.0, "view_distance": 500.0,
		"fog": true, "fog_density": 0.006, "glow": true, "ssao": true,
		"scale_3d": 1.0, "msaa": 2,
		"reflections": true, "vegetation": 1.0, "effects": 1.0,
	},
}

func _ready() -> void:
	Settings.changed.connect(_on_settings_changed)

func _on_settings_changed(key: String) -> void:
	if key == "graphics_preset":
		changed.emit()

func preset_name() -> String:
	var p := Settings.graphics_preset
	return p if PRESETS.has(p) else "MEDIUM"

func get_params() -> Dictionary:
	return PRESETS[preset_name()]

func preset_names() -> Array:
	return PRESETS.keys()
