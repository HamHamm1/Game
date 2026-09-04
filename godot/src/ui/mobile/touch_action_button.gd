class_name TouchActionButton
extends Button
## A touch button bound to an abstract action (MOBILE_FIRST.md §2/§13).
## `hold` = true feeds a continuous held state (sprint/crouch); `hold` =
## false latches an edge action (jump). It never references gameplay
## directly — it only feeds GameInput.

@export var action: String = "sprint"
@export var hold: bool = true

func _ready() -> void:
	focus_mode = Control.FOCUS_NONE
	button_down.connect(_on_down)
	button_up.connect(_on_up)

func _on_down() -> void:
	if hold:
		GameInput.set_touch_held(action, true)
	else:
		GameInput.latch_action(action)

func _on_up() -> void:
	if hold:
		GameInput.set_touch_held(action, false)
