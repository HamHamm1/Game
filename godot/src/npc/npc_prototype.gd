class_name NpcPrototype
extends CharacterBody3D
## First high-fidelity NPC prototype — IMPORT & INTEGRATION ONLY (no dialogue AI
## yet). Uses the owner-provided rigged Meshy character UNMODIFIED
## (`villager_walk.glb`: one skinned mesh, 24-bone biped skeleton, a Casual Walk
## animation). The mesh is never regenerated/simplified; this node only wraps it
## with body collision, an interaction hook, and an API the future Idle / Walk /
## Talk / LookAtPlayer / schedule / relationship / dialogue systems will drive.
##
## The rigged model is authored feet-at-origin and ~1.7 m tall, so no scaling is
## needed; place the node at the terrain height and the feet sit on the ground.

const MODEL := "res://assets/npc/villager_walk.glb"   # rigged: skeleton + Casual Walk

## Emitted when the player interacts (the future dialogue system listens here).
signal talked(npc: NpcPrototype)

enum State { IDLE, WALK, TALK }

@export var display_name: String = "Villager"
@export var interact_verb: String = "TALK"
@export var walk_speed: float = 1.4
## The model's forward axis offset (radians) so LookAtPlayer faces the target.
@export var facing_offset: float = 0.0
## Future schedule — [{time, pos, action}] entries. Stub only, unused for now.
@export var schedule: Array = []
## Future relationship model. Stub only, unused for now.
var relationship: Dictionary = {"affinity": 0, "met": false}

var _model: Node3D
var _skeleton: Skeleton3D
var _anim: AnimationPlayer
var _walk_anim: String = ""
var _state: State = State.IDLE
var _face_target: Vector3 = Vector3.INF
const GRAVITY := 18.0

func _ready() -> void:
	_build_model()
	_build_collision()
	_build_interaction()
	set_state(State.IDLE)

# --- construction -----------------------------------------------------------

func _build_model() -> void:
	var packed := load(MODEL) as PackedScene
	if packed == null:
		push_error("NpcPrototype: could not load %s" % MODEL)
		return
	_model = packed.instantiate() as Node3D
	add_child(_model)
	_skeleton = _find_type(_model, "Skeleton3D") as Skeleton3D
	_anim = _find_type(_model, "AnimationPlayer") as AnimationPlayer
	if _anim != null:
		for a in _anim.get_animation_list():
			_walk_anim = a
			var res := _anim.get_animation(a)
			if res != null:
				res.loop_mode = Animation.LOOP_LINEAR

## Simple upright capsule so the render mesh is NEVER used as a collider. Sized so
## the capsule bottom sits at local y=0 (the feet), matching the grounded model.
func _build_collision() -> void:
	var cs := CollisionShape3D.new()
	cs.name = "BodyCollision"
	var cap := CapsuleShape3D.new()
	cap.radius = 0.28
	cap.height = 1.6
	cs.shape = cap
	cs.position = Vector3(0.0, 0.8, 0.0)
	add_child(cs)

func _build_interaction() -> void:
	var it := NpcInteractable.new()
	it.name = "NpcInteractable"
	it.npc = self
	add_child(it)

# --- public API (the future systems drive these) ---------------------------

## Has a usable skeleton + at least one animation (honest capability check).
func has_animation() -> bool:
	return _skeleton != null and _anim != null and _walk_anim != ""

func set_state(s: State) -> void:
	_state = s
	if _anim == null:
		return
	match s:
		State.WALK:
			if _walk_anim != "":
				_anim.play(_walk_anim)
		_:
			# IDLE / TALK — the model ships no idle clip, so stand in bind pose.
			_anim.stop()

func state() -> State:
	return _state

## Face a world position (yaw only). The future LookAtPlayer/dialogue turns the
## NPC toward the player; call clear_look() to release.
func look_at_player(world_pos: Vector3) -> void:
	_face_target = world_pos

func clear_look() -> void:
	_face_target = Vector3.INF

func _physics_process(delta: float) -> void:
	# Rest on the ground (no walking logic yet — that is a future system).
	velocity.x = 0.0
	velocity.z = 0.0
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()
	if _face_target != Vector3.INF:
		var to := _face_target - global_position
		to.y = 0.0
		if to.length_squared() > 0.0025:
			var want := atan2(to.x, to.z) + facing_offset
			rotation.y = lerp_angle(rotation.y, want, clampf(delta * 6.0, 0.0, 1.0))

# --- helpers ----------------------------------------------------------------

func _find_type(n: Node, type_name: String) -> Node:
	if n.is_class(type_name):
		return n
	for c in n.get_children():
		var r := _find_type(c, type_name)
		if r != null:
			return r
	return null
