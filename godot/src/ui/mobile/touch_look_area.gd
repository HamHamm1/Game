class_name TouchLookArea
extends Control
## Camera look-drag area (MOBILE_FIRST.md §2/§3). A drag anywhere in this
## control feeds GameInput.add_touch_look() (camera applies sensitivity).
## It sits BEHIND the joystick/buttons, so a touch on a control routes to
## that control, never here — no accidental camera movement while using UI
## (MOBILE_FIRST.md §2).

var _finger: int = -1

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed and _finger == -1:
			_finger = t.index
			accept_event()
		elif not t.pressed and t.index == _finger:
			_finger = -1
			accept_event()
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if d.index == _finger:
			GameInput.add_touch_look(d.relative)
			accept_event()
