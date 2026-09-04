class_name PlayerCamera
extends Node3D
## First-person camera rig (ARCHITECTURE.md §4). This node is the YAW pivot;
## it builds a child PITCH pivot and the Camera3D, the two-node mouse-look
## split (the one idea kept from reference_analysis/3d-fpp-interaction-demo).
## Crouch lowers the eye height; HeadBob (a separate effect module) offsets
## the camera on top. `player` must be set before this node enters the tree.

@export var mouse_sensitivity: float = 0.0025
@export var pitch_min_degrees: float = -85.0
@export var pitch_max_degrees: float = 85.0
@export var eye_height: float = 1.6
@export var crouch_eye_height: float = 1.05
@export var crouch_lerp_speed: float = 10.0

var player: Player
var pitch_node: Node3D
var camera: Camera3D
var head_bob: HeadBob

func _ready() -> void:
	position.y = eye_height

	pitch_node = Node3D.new()
	pitch_node.name = "Pitch"
	add_child(pitch_node)

	camera = Camera3D.new()
	camera.name = "Camera3D"
	camera.current = true
	pitch_node.add_child(camera)

	head_bob = HeadBob.new()
	head_bob.name = "HeadBob"
	head_bob.player = player
	head_bob.camera = camera
	add_child(head_bob)

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var mm := event as InputEventMouseMotion
		rotation.y -= mm.relative.x * mouse_sensitivity
		var new_pitch := pitch_node.rotation.x - mm.relative.y * mouse_sensitivity
		pitch_node.rotation.x = clampf(
			new_pitch, deg_to_rad(pitch_min_degrees), deg_to_rad(pitch_max_degrees))
	elif event.is_action_pressed("ui_cancel"):
		# Toggle mouse capture so the player can free the cursor.
		Input.mouse_mode = (Input.MOUSE_MODE_VISIBLE
			if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
			else Input.MOUSE_MODE_CAPTURED)

func _process(delta: float) -> void:
	var target_h := crouch_eye_height if (player != null and player.is_crouching) else eye_height
	position.y = lerpf(position.y, target_h, clampf(crouch_lerp_speed * delta, 0.0, 1.0))

func get_look() -> Dictionary:
	return {"yaw": rotation.y, "pitch": pitch_node.rotation.x}

func set_look(yaw: float, pitch: float) -> void:
	rotation.y = yaw
	if pitch_node != null:
		pitch_node.rotation.x = pitch
