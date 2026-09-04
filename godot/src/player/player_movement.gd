class_name PlayerMovement
extends Node
## Player movement component (ARCHITECTURE.md §4). Walk / sprint / crouch /
## jump, resolved fresh each physics frame from input + context (the
## boolean-state style from reference_analysis/gdquest-tps-demo, avoiding
## stale stored enum state). `player` is set by Player before use.

@export var walk_speed: float = 4.0
@export var sprint_speed: float = 6.5
@export var crouch_speed: float = 2.0
@export var acceleration: float = 50.0
@export var gravity: float = 18.0
@export var jump_velocity: float = 5.0

var player: CharacterBody3D

## Called from Player._physics_process. `yaw` is the camera yaw pivot, so
## movement is relative to where the player is looking.
func physics_step(delta: float, yaw: Node3D) -> void:
	if player == null:
		return

	if not player.is_on_floor():
		player.velocity.y -= gravity * delta
	elif Input.is_action_just_pressed("jump"):
		player.velocity.y = jump_velocity

	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := yaw.global_transform.basis * Vector3(input.x, 0.0, input.y)
	dir.y = 0.0
	if dir.length() > 0.001:
		dir = dir.normalized()

	var is_crouching := Input.is_action_pressed("crouch")
	(player as Player).is_crouching = is_crouching
	var speed := walk_speed
	if is_crouching:
		speed = crouch_speed
	elif Input.is_action_pressed("sprint"):
		speed = sprint_speed

	var target := dir * speed
	player.velocity.x = move_toward(player.velocity.x, target.x, acceleration * delta)
	player.velocity.z = move_toward(player.velocity.z, target.z, acceleration * delta)

	player.move_and_slide()
