class_name HeadBob
extends Node
## One camera-effect module (ARCHITECTURE.md §4). Independently toggleable
## via `enabled`. Offsets the camera's *local* position (relative to the
## pitch pivot) with a gentle walk bob; other effects (breathing sway,
## footstep sync, contextual lean) plug in the same way in later phases.

@export var enabled: bool = true
@export var frequency: float = 1.9
@export var amplitude: float = 0.045
@export var min_speed: float = 0.5

var player: Player
var camera: Camera3D

var _t: float = 0.0

func _process(delta: float) -> void:
	if not enabled or camera == null or player == null:
		return
	var speed := Vector2(player.velocity.x, player.velocity.z).length()
	if player.is_on_floor() and speed > min_speed:
		_t += delta * frequency * speed
		var y := sin(_t * TAU) * amplitude
		var x := cos(_t * PI) * amplitude * 0.5
		camera.position = Vector3(x, y, 0.0)
	else:
		camera.position = camera.position.lerp(Vector3.ZERO, clampf(delta * 8.0, 0.0, 1.0))
