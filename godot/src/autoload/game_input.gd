extends Node
## GameInput — the input abstraction layer (MOBILE_FIRST.md §13). Gameplay
## systems read ONLY from here; they never touch keyboard/mouse/touch APIs
## directly. Both keyboard/mouse (always, for development) and the on-screen
## touch widgets feed the same abstract actions:
##
##     abstract action  ←  keyboard/mouse  OR  touch  OR  (future) controller
##
## This preserves the existing keyboard/mouse gameplay (AI_RULES.md Rule 10)
## while adding touch as a first-class, co-equal source.

signal touch_ui_changed(enabled: bool)

## True when touch controls should be shown/active (mobile, or forced for
## dev preview). Set at boot from platform detection; overridable.
var touch_ui_enabled: bool = false

# --- Touch-fed state (written by the mobile HUD widgets) ---
var _touch_move: Vector2 = Vector2.ZERO       # virtual joystick, ~[-1,1]
var _touch_look_accum: Vector2 = Vector2.ZERO # look-drag area, pixels this frame
var _touch_held: Dictionary = {}              # action -> bool (sprint/crouch)
var _latched: Dictionary = {}                 # action -> bool (edge: interact/jump/pause)

# --- Mouse look accumulation (desktop, only while captured) ---
var _mouse_look_accum: Vector2 = Vector2.ZERO

func _ready() -> void:
	touch_ui_enabled = _detect_touch_primary()

func _detect_touch_primary() -> bool:
	if OS.has_feature("mobile"):
		return true
	# A desktop with a touchscreen still defaults to KB/mouse; only treat
	# touch as primary on an actual handheld OS.
	var name := OS.get_name()
	return name == "Android" or name == "iOS"

func set_touch_ui_enabled(value: bool) -> void:
	if value == touch_ui_enabled:
		return
	touch_ui_enabled = value
	touch_ui_changed.emit(value)

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_mouse_look_accum += (event as InputEventMouseMotion).relative

# --- Feeds from the touch widgets ---

func set_touch_move(v: Vector2) -> void:
	_touch_move = v

func add_touch_look(delta: Vector2) -> void:
	_touch_look_accum += delta

func set_touch_held(action: String, held: bool) -> void:
	_touch_held[action] = held

## Latch an edge-triggered action (interact/jump/pause) from a touch button.
func latch_action(action: String) -> void:
	_latched[action] = true

# --- Reads consumed by gameplay ---

## Combined movement intent, camera-relative resolution done by the caller.
func get_move_vector() -> Vector2:
	var kb := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	return (kb + _touch_move).limit_length(1.0)

## Combined look delta in pixels since last call; caller applies sensitivity.
## Consumes (resets) the accumulators.
func get_look_delta() -> Vector2:
	var d := _mouse_look_accum + _touch_look_accum
	_mouse_look_accum = Vector2.ZERO
	_touch_look_accum = Vector2.ZERO
	return d

## Held state for continuous actions (sprint, crouch).
func is_held(action: String) -> bool:
	if InputMap.has_action(action) and Input.is_action_pressed(action):
		return true
	return _touch_held.get(action, false)

## One-shot consume for edge actions (interact, jump, pause). Returns true
## once per press from either keyboard or a touch latch, then clears.
func consume_action(action: String) -> bool:
	var kb := InputMap.has_action(action) and Input.is_action_just_pressed(action)
	var touched: bool = _latched.get(action, false)
	_latched[action] = false
	return kb or touched
