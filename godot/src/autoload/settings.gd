extends Node
## Settings — persisted player settings (MOBILE_FIRST.md §3/§5,
## MOBILE_ART_DIRECTION.md §51). Stored in its own file, separate from the
## savegame. Camera and head-bob read these live each frame; GraphicsManager
## reacts to `changed("graphics_preset")`.

signal changed(key: String)

const PATH := "user://settings.json"

# Graphics
var graphics_preset: String = "MEDIUM"   # LOW / MEDIUM / HIGH / ULTRA

# Camera / look
var look_sensitivity_x: float = 0.003
var look_sensitivity_y: float = 0.003
var fov: float = 75.0
var camera_smoothing: float = 0.2        # 0 = snappy, 1 = very smooth
var head_bob_strength: float = 1.0       # multiplier, 0 disables bob
var camera_shake_strength: float = 1.0   # stored; no shake system yet

# Touch
var move_sensitivity: float = 1.0

const _KEYS := [
	"graphics_preset", "look_sensitivity_x", "look_sensitivity_y", "fov",
	"camera_smoothing", "head_bob_strength", "camera_shake_strength",
	"move_sensitivity",
]

func _ready() -> void:
	load_settings()

## Call after changing a field so listeners update and the change persists.
func commit(key: String) -> void:
	changed.emit(key)
	save_settings()

func save_settings() -> void:
	var data := {}
	for k in _KEYS:
		data[k] = get(k)
	var file := FileAccess.open(PATH, FileAccess.WRITE)
	if file == null:
		push_error("Settings: cannot write %s" % PATH)
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()

func load_settings() -> void:
	if not FileAccess.file_exists(PATH):
		return
	var file := FileAccess.open(PATH, FileAccess.READ)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("Settings: %s is not valid; using defaults." % PATH)
		return
	var data: Dictionary = parsed
	for k in _KEYS:
		if data.has(k):
			set(k, data[k])
