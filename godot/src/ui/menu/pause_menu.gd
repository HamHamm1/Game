class_name PauseMenu
extends CanvasLayer
## Pause + settings menu (MOBILE_FIRST.md §5/§23, MOBILE_ART_DIRECTION.md
## §51). Opens on the abstract "pause" action (Esc, or the mobile menu
## button). Pauses the tree while open; runs with PROCESS_MODE_ALWAYS so it
## keeps working while paused. Settings changes commit + persist immediately.
##
## Layout is scroll-safe for small phone screens: the settings live in a
## vertical ScrollContainer (touch-drag scrollable), while Resume/Quit stay
## in a fixed bar that is always visible. Everything is inset to the device
## safe area. Labels ignore touches so a finger-drag over them scrolls;
## sliders/dropdowns/buttons keep consuming their own touches, so adjusting a
## slider never scrolls the menu.

var _open: bool = false
var _dim: ColorRect
var _root: MarginContainer
var _preset_option: OptionButton

func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	_apply_safe_area()
	get_viewport().size_changed.connect(_apply_safe_area)
	_set_open(false)

func _process(_delta: float) -> void:
	# Single owner of the pause toggle (keyboard Esc or touch menu button,
	# both routed through GameInput). Works while paused because ALWAYS.
	if GameInput.consume_action("pause"):
		toggle()

func toggle() -> void:
	_set_open(not _open)

func _set_open(value: bool) -> void:
	_open = value
	_dim.visible = value
	_root.visible = value
	get_tree().paused = value
	if not GameInput.touch_ui_enabled:
		Input.mouse_mode = (Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_CAPTURED)

func _build() -> void:
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.72)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)

	# Safe-area-inset container that holds the whole panel.
	_root = MarginContainer.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_root)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	_root.add_child(col)

	# Title (fixed).
	var title := Label.new()
	title.text = "Paused"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(title)

	# --- Scrollable settings area (fills remaining height) ---
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	col.add_child(scroll)

	var inner := VBoxContainer.new()
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inner.mouse_filter = Control.MOUSE_FILTER_PASS
	inner.add_theme_constant_override("separation", 14)
	scroll.add_child(inner)

	# Graphics preset.
	_add_label(inner, "Graphics quality")
	_preset_option = OptionButton.new()
	_preset_option.custom_minimum_size = Vector2(0, 48)
	_preset_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var names := GraphicsManager.preset_names()
	for i in names.size():
		_preset_option.add_item(String(names[i]))
		if String(names[i]) == Settings.graphics_preset:
			_preset_option.select(i)
	_preset_option.item_selected.connect(_on_preset_selected)
	inner.add_child(_preset_option)

	_add_slider(inner, "Look sensitivity X", 0.0005, 0.012, 0.0005, "look_sensitivity_x")
	_add_slider(inner, "Look sensitivity Y", 0.0005, 0.012, 0.0005, "look_sensitivity_y")
	_add_slider(inner, "Field of view", 60.0, 100.0, 1.0, "fov")
	_add_slider(inner, "Camera smoothing", 0.0, 1.0, 0.05, "camera_smoothing")
	_add_slider(inner, "Head bob strength", 0.0, 2.0, 0.1, "head_bob_strength")
	_add_slider(inner, "Camera shake strength", 0.0, 2.0, 0.1, "camera_shake_strength")

	# Desktop preview of the touch UI (drive the widgets with the mouse via
	# emulate_touch_from_mouse). On a phone the touch UI is on automatically.
	var touch_toggle := CheckButton.new()
	touch_toggle.text = "Touch controls (preview)"
	touch_toggle.button_pressed = GameInput.touch_ui_enabled
	touch_toggle.focus_mode = Control.FOCUS_NONE
	touch_toggle.toggled.connect(_on_touch_toggle)
	inner.add_child(touch_toggle)

	# --- Fixed bottom bar: Resume + Quit always visible ---
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 12)
	col.add_child(bottom)

	var resume := _big_button("Resume")
	resume.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	resume.pressed.connect(func(): _set_open(false))
	bottom.add_child(resume)

	var quit := _big_button("Quit")
	quit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	quit.pressed.connect(_on_quit_pressed)
	bottom.add_child(quit)

func _on_touch_toggle(pressed: bool) -> void:
	GameInput.set_touch_ui_enabled(pressed)

func _on_preset_selected(idx: int) -> void:
	Settings.graphics_preset = _preset_option.get_item_text(idx)
	Settings.commit("graphics_preset")

func _on_quit_pressed() -> void:
	AutosaveManager.request_autosave("quit_button", true)
	get_tree().quit()

func _on_slider_changed(value: float, key: String) -> void:
	Settings.set(key, value)
	Settings.commit(key)

func _add_label(parent: Node, text: String) -> void:
	var label := Label.new()
	label.text = text
	# Ignore touches so a finger-drag over the label scrolls the container
	# instead of being swallowed.
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)

func _big_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 56)
	b.focus_mode = Control.FOCUS_NONE
	return b

func _add_slider(parent: Node, label_text: String, min_v: float, max_v: float,
		step: float, key: String) -> void:
	_add_label(parent, label_text)
	var slider := HSlider.new()
	slider.min_value = min_v
	slider.max_value = max_v
	slider.step = step
	slider.value = float(Settings.get(key))
	slider.custom_minimum_size = Vector2(0, 44)
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(_on_slider_changed.bind(key))
	parent.add_child(slider)

## Inset the panel into the device safe area (notch / rounded corners /
## gesture bar — MOBILE_FIRST.md §4), mapping screen-pixel insets into
## viewport units with a comfortable minimum margin.
func _apply_safe_area() -> void:
	var vp := get_viewport().get_visible_rect().size
	var win := Vector2(DisplayServer.window_get_size())
	var sx := vp.x / maxf(win.x, 1.0)
	var sy := vp.y / maxf(win.y, 1.0)
	var safe := DisplayServer.get_display_safe_area()
	var m := 16.0
	var left := maxf(m, float(safe.position.x) * sx)
	var top := maxf(m, float(safe.position.y) * sy)
	var right := maxf(m, float(win.x - safe.position.x - safe.size.x) * sx)
	var bottom := maxf(m, float(win.y - safe.position.y - safe.size.y) * sy)
	_root.add_theme_constant_override("margin_left", int(left))
	_root.add_theme_constant_override("margin_right", int(right))
	_root.add_theme_constant_override("margin_top", int(top))
	_root.add_theme_constant_override("margin_bottom", int(bottom))
