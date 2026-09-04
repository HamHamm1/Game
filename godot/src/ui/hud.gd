class_name Hud
extends CanvasLayer
## Minimal placeholder HUD (ART_DIRECTION.md §8 — stays quiet, real UI
## treatment is a later pass). Listens to WorldEvents; never polls
## (AI_RULES.md Rule 5, the gdquest-tps-demo signal-driven-UI pattern).
## `player` is set by the world root before this enters the tree.

var player: Player

var _crosshair: Label
var _prompt: Label
var _info: Label
var _toast: Label
var _toast_time: float = 0.0

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_crosshair = _make_label(root, "+", Control.PRESET_CENTER)
	_crosshair.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_crosshair.grow_vertical = Control.GROW_DIRECTION_BOTH

	_prompt = _make_label(root, "", Control.PRESET_CENTER)
	_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_prompt.grow_vertical = Control.GROW_DIRECTION_BOTH
	_prompt.position.y += 42.0

	_info = _make_label(root, "", Control.PRESET_TOP_LEFT)
	_info.position = Vector2(14.0, 10.0)

	_toast = _make_label(root, "", Control.PRESET_CENTER_BOTTOM)
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.position.y -= 70.0

	WorldEvents.interaction_target_changed.connect(_on_target_changed)
	WorldEvents.inventory_changed.connect(_refresh_info)
	WorldEvents.minute_passed.connect(_on_minute)
	WorldEvents.game_saved.connect(_on_saved)
	WorldEvents.game_loaded.connect(_on_loaded)

	_refresh_info()

func _make_label(parent: Control, text: String, preset: int) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	label.set_anchors_preset(preset)
	return label

func _process(delta: float) -> void:
	if _toast_time > 0.0:
		_toast_time -= delta
		if _toast_time <= 0.0:
			_toast.text = ""

func _on_target_changed(interactable: Node) -> void:
	if interactable is Interactable:
		_prompt.text = "[E]  " + (interactable as Interactable).get_interaction_prompt(player)
	else:
		_prompt.text = ""

func _on_minute(_day: int, _minute: int) -> void:
	_refresh_info()

func _on_saved() -> void:
	_show_toast("Saved  [F5]")

func _on_loaded() -> void:
	_show_toast("Loaded  [F9]")
	_refresh_info()

func _refresh_info() -> void:
	var clock := TimeManager.clock_string()
	var block := TimeManager.block_name(TimeManager.current_block())
	var items := player.inventory.slot_count() if (player != null and player.inventory != null) else 0
	_info.text = "Day %d   %s  (%s)\nItems: %d\n[F5] save   [F9] load" % [
		TimeManager.day_index, clock, block, items]

func _show_toast(text: String) -> void:
	_toast.text = text
	_toast_time = 2.0
