class_name PlayerCamera
extends Node3D
## First-person camera rig (ARCHITECTURE.md §4). This node is the YAW pivot;
## it builds a child PITCH pivot and the Camera3D (two-node mouse-look split).
## Look input comes through GameInput (mouse OR touch drag, MOBILE_FIRST.md
## §13); sensitivity, smoothing, FOV, and pitch clamp are read live from
## Settings (MOBILE_FIRST.md §3). Crouch lowers the eye height; HeadBob (a
## separate module) offsets the camera on top. `player` must be set before
## this node enters the tree.

@export var pitch_min_degrees: float = -85.0
@export var pitch_max_degrees: float = 85.0
@export var eye_height: float = 1.6
@export var crouch_eye_height: float = 1.05
@export var crouch_lerp_speed: float = 10.0

var player: Player
var pitch_node: Node3D
var camera: Camera3D
var head_bob: HeadBob

var _target_yaw: float = 0.0
var _target_pitch: float = 0.0

func _ready() -> void:
	position.y = eye_height

	pitch_node = Node3D.new()
	pitch_node.name = "Pitch"
	add_child(pitch_node)

	camera = Camera3D.new()
	camera.name = "Camera3D"
	camera.current = true
	camera.fov = Settings.fov
	pitch_node.add_child(camera)

	head_bob = HeadBob.new()
	head_bob.name = "HeadBob"
	head_bob.player = player
	head_bob.camera = camera
	add_child(head_bob)

	_target_yaw = rotation.y
	_target_pitch = pitch_node.rotation.x

	# Capture the mouse only on desktop (KB/mouse). On touch, the look-drag
	# area feeds GameInput instead.
	if not GameInput.touch_ui_enabled:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _process(delta: float) -> void:
	var look := GameInput.get_look_delta()
	_target_yaw -= look.x * Settings.look_sensitivity_x
	_target_pitch = clampf(
		_target_pitch - look.y * Settings.look_sensitivity_y,
		deg_to_rad(pitch_min_degrees), deg_to_rad(pitch_max_degrees))

	var smoothing := clampf(Settings.camera_smoothing, 0.0, 1.0)
	if smoothing > 0.0:
		# Higher smoothing = lower follow rate (more lag).
		var rate := lerpf(24.0, 5.0, smoothing)
		var t := clampf(delta * rate, 0.0, 1.0)
		rotation.y = lerp_angle(rotation.y, _target_yaw, t)
		pitch_node.rotation.x = lerpf(pitch_node.rotation.x, _target_pitch, t)
	else:
		rotation.y = _target_yaw
		pitch_node.rotation.x = _target_pitch

	# Keep FOV live so the settings menu updates immediately.
	if camera != null and not is_equal_approx(camera.fov, Settings.fov):
		camera.fov = Settings.fov

	var target_h := crouch_eye_height if (player != null and player.is_crouching) else eye_height
	position.y = lerpf(position.y, target_h, clampf(crouch_lerp_speed * delta, 0.0, 1.0))

func get_look() -> Dictionary:
	return {"yaw": rotation.y, "pitch": pitch_node.rotation.x}

func set_look(yaw: float, pitch: float) -> void:
	_target_yaw = yaw
	_target_pitch = pitch
	rotation.y = yaw
	if pitch_node != null:
		pitch_node.rotation.x = pitch
