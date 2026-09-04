class_name VirtualJoystick
extends Control
## Dynamic virtual movement joystick (MOBILE_FIRST.md §2). Feeds
## GameInput.set_touch_move() a [-1,1] vector with dead-zone handling. The
## base recenters to wherever the finger first touches inside this control.

@export var max_radius: float = 130.0
@export var deadzone: float = 0.15

var _finger: int = -1
var _active: bool = false
var _origin: Vector2 = Vector2.ZERO
var _knob: Vector2 = Vector2.ZERO

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed and _finger == -1:
			_finger = t.index
			_active = true
			_origin = t.position
			_knob = Vector2.ZERO
			_apply(Vector2.ZERO)
			queue_redraw()
			accept_event()
		elif not t.pressed and t.index == _finger:
			_reset()
			accept_event()
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if d.index == _finger:
			_knob = (d.position - _origin).limit_length(max_radius)
			var v := _knob / max_radius
			if v.length() < deadzone:
				v = Vector2.ZERO
			_apply(v)
			queue_redraw()
			accept_event()

func _reset() -> void:
	_finger = -1
	_active = false
	_knob = Vector2.ZERO
	GameInput.set_touch_move(Vector2.ZERO)
	queue_redraw()

func _apply(v: Vector2) -> void:
	GameInput.set_touch_move(v * Settings.move_sensitivity)

func _draw() -> void:
	var center := _origin if _active else size * 0.5
	draw_circle(center, max_radius, Color(1, 1, 1, 0.12))
	draw_arc(center, max_radius, 0.0, TAU, 48, Color(1, 1, 1, 0.25), 2.0)
	draw_circle(center + _knob, max_radius * 0.4, Color(1, 1, 1, 0.30))
