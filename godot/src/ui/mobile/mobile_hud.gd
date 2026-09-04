class_name MobileHud
extends CanvasLayer
## Touch controls layer (MOBILE_FIRST.md §2/§4). Assembles the look-drag
## area, virtual joystick, contextual interact button, action buttons, and a
## menu button — inside the device safe area, with the screen center kept
## clear. Shown only when GameInput.touch_ui_enabled. `player` is set by the
## world root. The status HUD (clock/inventory/crosshair) stays in Hud.

var player: Player

var _safe: Control
var _look_area: TouchLookArea
var _joystick: VirtualJoystick
var _interact_button: Button
var _menu_button: Button

func _ready() -> void:
	layer = 1  # above the status HUD

	_safe = Control.new()
	_safe.set_anchors_preset(Control.PRESET_FULL_RECT)
	_safe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_safe)

	# Look area first = behind everything else.
	_look_area = TouchLookArea.new()
	_look_area.set_anchors_preset(Control.PRESET_FULL_RECT)
	_safe.add_child(_look_area)

	# Movement joystick, bottom-left.
	_joystick = VirtualJoystick.new()
	_joystick.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_joystick.custom_minimum_size = Vector2(320, 320)
	_joystick.size = Vector2(320, 320)
	_joystick.position = Vector2(20, -340)
	_safe.add_child(_joystick)

	# Contextual interact button, right side — hidden until a target exists.
	_interact_button = _make_button("USE", Vector2(200, 108))
	_interact_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_interact_button.position = Vector2(-220, -420)
	_interact_button.button_down.connect(func(): GameInput.latch_action("interact"))
	_interact_button.visible = false
	_safe.add_child(_interact_button)

	# Action buttons, bottom-right cluster.
	_add_action_button("SPRINT", "sprint", true, Vector2(-220, -180))
	_add_action_button("CROUCH", "crouch", true, Vector2(-220, -300))
	_add_action_button("JUMP", "jump", false, Vector2(-410, -180))

	# Menu button, top-right → latches pause (PauseMenu handles it).
	_menu_button = _make_button("☰", Vector2(96, 96))
	_menu_button.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_menu_button.position = Vector2(-116, 20)
	_menu_button.button_down.connect(func(): GameInput.latch_action("pause"))
	_safe.add_child(_menu_button)

	visible = GameInput.touch_ui_enabled
	GameInput.touch_ui_changed.connect(func(on): visible = on)
	WorldEvents.interaction_target_changed.connect(_on_target_changed)

	_apply_safe_area()
	get_viewport().size_changed.connect(_apply_safe_area)

func _make_button(text: String, min_size: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.size = min_size
	b.focus_mode = Control.FOCUS_NONE
	return b

func _add_action_button(text: String, action: String, hold: bool, pos: Vector2) -> void:
	var b := TouchActionButton.new()
	b.action = action
	b.hold = hold
	b.text = text
	b.custom_minimum_size = Vector2(170, 108)
	b.size = Vector2(170, 108)
	b.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	b.position = pos
	_safe.add_child(b)

func _on_target_changed(interactable: Node) -> void:
	if interactable is Interactable:
		_interact_button.text = (interactable as Interactable).get_interaction_verb(player)
		_interact_button.visible = true
	else:
		_interact_button.visible = false

## Inset the whole control tree into the device safe area (notches, rounded
## corners, gesture bars — MOBILE_FIRST.md §4). Screen-pixel safe area is
## mapped into viewport units, with a comfortable minimum margin.
func _apply_safe_area() -> void:
	var vp := get_viewport().get_visible_rect().size
	var win := Vector2(DisplayServer.window_get_size())
	var sx := vp.x / maxf(win.x, 1.0)
	var sy := vp.y / maxf(win.y, 1.0)
	var safe := DisplayServer.get_display_safe_area()
	var min_margin := 24.0
	var left := maxf(min_margin, float(safe.position.x) * sx)
	var top := maxf(min_margin, float(safe.position.y) * sy)
	var right := maxf(min_margin, float(win.x - safe.position.x - safe.size.x) * sx)
	var bottom := maxf(min_margin, float(win.y - safe.position.y - safe.size.y) * sy)
	_safe.offset_left = left
	_safe.offset_top = top
	_safe.offset_right = -right
	_safe.offset_bottom = -bottom
