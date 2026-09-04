class_name PauseMenu
extends CanvasLayer
## Pause + settings menu (MOBILE_FIRST.md §5/§23, MOBILE_ART_DIRECTION.md
## §51). Opens on the abstract "pause" action (Esc, or the mobile menu
## button). Pauses the tree while open; runs with PROCESS_MODE_ALWAYS so it
## keeps working while paused. Settings changes commit + persist immediately.

var _open: bool = false
var _dim: ColorRect
var _panel: Control
var _preset_option: OptionButton

func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
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
	_panel.visible = value
	get_tree().paused = value
	if not GameInput.touch_ui_enabled:
		Input.mouse_mode = (Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_CAPTURED)

func _build() -> void:
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.6)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_panel = center

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	box.custom_minimum_size = Vector2(460, 0)
	center.add_child(box)

	var title := Label.new()
	title.text = "Paused"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	var resume := _big_button("Resume")
	resume.pressed.connect(func(): _set_open(false))
	box.add_child(resume)

	# Graphics preset.
	var gfx_label := Label.new()
	gfx_label.text = "Graphics quality"
	box.add_child(gfx_label)
	_preset_option = OptionButton.new()
	_preset_option.custom_minimum_size = Vector2(0, 44)
	var names := GraphicsManager.preset_names()
	for i in names.size():
		_preset_option.add_item(String(names[i]))
		if String(names[i]) == Settings.graphics_preset:
			_preset_option.select(i)
	_preset_option.item_selected.connect(_on_preset_selected)
	box.add_child(_preset_option)

	_add_slider(box, "Look sensitivity X", 0.0005, 0.012, 0.0005, "look_sensitivity_x")
	_add_slider(box, "Look sensitivity Y", 0.0005, 0.012, 0.0005, "look_sensitivity_y")
	_add_slider(box, "Field of view", 60.0, 100.0, 1.0, "fov")
	_add_slider(box, "Camera smoothing", 0.0, 1.0, 0.05, "camera_smoothing")
	_add_slider(box, "Head bob strength", 0.0, 2.0, 0.1, "head_bob_strength")
	_add_slider(box, "Camera shake strength", 0.0, 2.0, 0.1, "camera_shake_strength")

	# Desktop preview of the touch UI (drive the widgets with the mouse via
	# emulate_touch_from_mouse). On a phone the touch UI is on automatically.
	var touch_toggle := CheckButton.new()
	touch_toggle.text = "Touch controls (preview)"
	touch_toggle.button_pressed = GameInput.touch_ui_enabled
	touch_toggle.focus_mode = Control.FOCUS_NONE
	touch_toggle.toggled.connect(_on_touch_toggle)
	box.add_child(touch_toggle)

	var quit := _big_button("Quit")
	quit.pressed.connect(_on_quit_pressed)
	box.add_child(quit)

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

func _big_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 52)
	b.focus_mode = Control.FOCUS_NONE
	return b

func _add_slider(parent: Node, label_text: String, min_v: float, max_v: float,
		step: float, key: String) -> void:
	var label := Label.new()
	label.text = label_text
	parent.add_child(label)
	var slider := HSlider.new()
	slider.min_value = min_v
	slider.max_value = max_v
	slider.step = step
	slider.value = float(Settings.get(key))
	slider.custom_minimum_size = Vector2(0, 40)
	slider.value_changed.connect(_on_slider_changed.bind(key))
	parent.add_child(slider)
