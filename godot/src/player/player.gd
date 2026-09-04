class_name Player
extends CharacterBody3D
## First-person player — an orchestrator that assembles and delegates to
## typed component nodes (ARCHITECTURE.md §4). It builds its own subtree in
## code (collision, camera rig, movement, interaction, inventory) so no
## hand-authored .tscn is required for the controller.
##
## Player.gd must NEVER grow per-object-type interaction logic, per-NPC
## dialogue logic, or per-recipe cooking logic (ARCHITECTURE.md §4,
## AI_RULES.md Rule 4) — that is an architecture violation.

@export var interaction_range: float = 2.5

var inventory: PlayerInventory
var movement: PlayerMovement
var camera_rig: PlayerCamera
var interaction: PlayerInteraction

## Read by PlayerCamera (eye height) and HeadBob; set by PlayerMovement.
var is_crouching: bool = false

func _ready() -> void:
	# Body collision.
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.4
	capsule.height = 1.7
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)

	# Inventory (its state is saved as part of the player's save data).
	inventory = PlayerInventory.new()
	inventory.name = "Inventory"
	add_child(inventory)

	# Camera rig — set `player` before adding so its _ready() sees it.
	camera_rig = PlayerCamera.new()
	camera_rig.name = "CameraRig"
	camera_rig.player = self
	add_child(camera_rig)

	# Movement.
	movement = PlayerMovement.new()
	movement.name = "Movement"
	movement.player = self
	add_child(movement)

	# Interaction — a forward raycast parented under the camera.
	interaction = PlayerInteraction.new()
	interaction.name = "Interaction"
	interaction.player = self
	add_child(interaction)

	var ray := RayCast3D.new()
	ray.name = "InteractionRay"
	ray.target_position = Vector3(0.0, 0.0, -interaction_range)
	ray.collide_with_bodies = true
	ray.collide_with_areas = false
	ray.enabled = true
	camera_rig.camera.add_child(ray)
	interaction.ray = ray

	SaveManager.register_savable("player", self)

func _physics_process(delta: float) -> void:
	movement.physics_step(delta, camera_rig)

func teleport_to(pos: Vector3) -> void:
	global_position = pos
	velocity = Vector3.ZERO

# --- Save contract (ARCHITECTURE.md §11) ---

func get_save_data() -> Dictionary:
	var look := camera_rig.get_look()
	return {
		"position": [global_position.x, global_position.y, global_position.z],
		"yaw": look["yaw"],
		"pitch": look["pitch"],
		"inventory": inventory.get_save_data(),
	}

func load_save_data(data: Dictionary) -> void:
	var p: Variant = data.get("position", [0.0, 1.0, 0.0])
	if p is Array and p.size() == 3:
		global_position = Vector3(float(p[0]), float(p[1]), float(p[2]))
	velocity = Vector3.ZERO
	camera_rig.set_look(float(data.get("yaw", 0.0)), float(data.get("pitch", 0.0)))
	inventory.load_save_data(data.get("inventory", {}))
