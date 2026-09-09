class_name NpcPrototype
extends CharacterBody3D
## First high-fidelity NPC — the owner's rigged Meshy villager, used UNMODIFIED
## (`villager_walk.glb`: one skinned mesh, 24-bone skeleton, a Casual Walk clip).
## This node is the NPC BODY + movement: it wraps the model with a capsule
## collider, drives it along a NavigationAgent3D path (grounded on the terrain via
## physics, never floating/sinking), animates IDLE↔WALK, smoothly faces its
## heading or the player, and exposes the state API the roaming brain
## (`NpcRoaming`) and the future schedule / relationship / dialogue systems drive.
## No dialogue AI/API is implemented here — TALKING only holds the NPC in place
## and faces the player; a future dialogue system calls begin_talk()/end_talk().
##
## Model is authored feet-at-origin, ~1.7 m, so scale = 1 and the feet sit on the
## ground when the node is placed at the terrain height.

const MODEL := "res://assets/npc/villager_walk.glb"

signal talked(npc: NpcPrototype)          # a player interaction began (future: open dialogue)
signal talk_started(npc: NpcPrototype)    # entered TALKING (brain pauses roaming)
signal talk_ended(npc: NpcPrototype)      # left TALKING (brain resumes roaming)
signal reached_destination(npc: NpcPrototype)

## Active states + reserved future states (WORKING…SPECIAL_EVENT are not
## implemented yet — the machine is structured so they can be added later).
enum State { IDLE, ROAMING, RESTING, TALKING, WORKING, EATING, SHOPPING, GOING_HOME, SLEEPING, SPECIAL_EVENT }

@export var display_name: String = "Villager"
@export var interact_verb: String = "TALK"
@export var walk_speed: float = 1.35
## Visual-model forward correction, applied to the ModelRoot container (NOT to the
## navigation/character yaw). The imported GLB's front was verified (offscreen
## render) to face +Z — the same forward the movement yaw uses — so the correction
## is 0°. If a future model faced -Z you'd set 180 here and nothing else changes.
@export var model_yaw_deg: float = 0.0
## Auto-end a conversation after this many seconds when NO dialogue system is
## driving it (0 = never auto-end; a future dialogue system calls end_talk()).
@export var talk_hold_seconds: float = 6.0
## Future schedule — [{time, pos, action}]. Stub, unused for now.
@export var schedule: Array = []
## Future relationship model. Stub, unused for now.
var relationship: Dictionary = {"affinity": 0, "met": false}

const GRAVITY := 18.0
const TURN_RATE := 6.5
const SLOW_RADIUS := 2.2      # start easing speed within this distance of the target

var _model_root: Node3D
var _model: Node3D
var _skeleton: Skeleton3D
var _anim: AnimationPlayer
var _walk_anim: String = ""
var _agent: NavigationAgent3D
var _state: State = State.IDLE
var _face_target: Vector3 = Vector3.INF
var _desired_yaw: float = 0.0
var _walk_playing: bool = false
var _talk_timer: float = 0.0

func _ready() -> void:
	_build_model()
	_build_agent()
	_build_collision()
	_build_interaction()
	_desired_yaw = rotation.y

# --- construction -----------------------------------------------------------

func _build_model() -> void:
	var packed := load(MODEL) as PackedScene
	if packed == null:
		push_error("NpcPrototype: could not load %s" % MODEL)
		return
	# CharacterBody3D → ModelRoot (holds the forward correction) → GLB. The GLB is
	# used unmodified; only this container carries the yaw correction, so the
	# navigation/character forward stays a clean +Z.
	_model_root = Node3D.new()
	_model_root.name = "ModelRoot"
	_model_root.rotation.y = deg_to_rad(model_yaw_deg)
	add_child(_model_root)
	_model = packed.instantiate() as Node3D
	_model_root.add_child(_model)
	_skeleton = _find_type(_model, "Skeleton3D") as Skeleton3D
	_anim = _find_type(_model, "AnimationPlayer") as AnimationPlayer
	if _anim != null:
		for a in _anim.get_animation_list():
			_walk_anim = a
			var res := _anim.get_animation(a)
			if res != null:
				res.loop_mode = Animation.LOOP_LINEAR

func _build_agent() -> void:
	_agent = NavigationAgent3D.new()
	_agent.name = "NavAgent"
	_agent.path_desired_distance = 0.5
	_agent.target_desired_distance = 0.7
	_agent.path_max_distance = 3.0
	_agent.avoidance_enabled = false
	add_child(_agent)

## Simple upright capsule (feet at local y=0) — the render mesh is NEVER a
## collider. This is also the physics safety net that stops the NPC clipping into
## any wall/rock even if navigation ever routed too close.
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

# --- public API (roaming brain + future systems drive these) ----------------

## Honest capability check: usable skeleton + at least one animation clip.
func has_animation() -> bool:
	return _skeleton != null and _anim != null and _walk_anim != ""

func set_agent_navigation_map(map: RID) -> void:
	if _agent != null:
		_agent.set_navigation_map(map)

func state() -> State:
	return _state

func is_busy_talking() -> bool:
	return _state == State.TALKING

## Walk to a world destination (enters ROAMING). Ignored while TALKING so the NPC
## can never wander off mid-conversation.
func go_to(dest: Vector3) -> void:
	if _state == State.TALKING or _agent == null:
		return
	_agent.target_position = dest
	_state = State.ROAMING

## Stop cleanly where it stands (IDLE/RESTING). `rest` marks a longer pause.
func halt(rest: bool = false) -> void:
	if _agent != null:
		_agent.target_position = global_position
	velocity.x = 0.0
	velocity.z = 0.0
	_state = State.RESTING if rest else State.IDLE

## Begin a conversation: stop, cancel roaming, hold in place, face the player.
func begin_talk(player_pos: Vector3) -> void:
	if _agent != null:
		_agent.target_position = global_position
	velocity.x = 0.0
	velocity.z = 0.0
	_state = State.TALKING
	_talk_timer = talk_hold_seconds
	relationship["met"] = true
	look_at_player(player_pos)
	talk_started.emit(self)
	talked.emit(self)

## End the conversation → IDLE (the brain waits briefly then resumes roaming).
func end_talk() -> void:
	if _state != State.TALKING:
		return
	_state = State.IDLE
	_talk_timer = 0.0
	talk_ended.emit(self)

## Yaw that makes the body's forward (+Z) — and thus the model's visible front —
## point along `dir` (XZ). No offset: the model faces +Z, the same as the body.
func heading_yaw(dir: Vector3) -> float:
	return atan2(dir.x, dir.z)

## World-space horizontal direction the VISIBLE model faces (body forward through
## the ModelRoot correction). Used to verify front == movement/look direction.
func model_forward() -> Vector3:
	var b := global_transform.basis
	if _model_root != null:
		b = b * _model_root.transform.basis
	var f := b * Vector3(0.0, 0.0, 1.0)
	return Vector3(f.x, 0.0, f.z).normalized()

## Face a world position (yaw only, smoothed). clear_look() releases it.
func look_at_player(world_pos: Vector3) -> void:
	_face_target = world_pos

func clear_look() -> void:
	_face_target = Vector3.INF

# --- per-frame movement -----------------------------------------------------

func _physics_process(delta: float) -> void:
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta

	var moving := false
	if _state == State.ROAMING and _agent != null:
		if _agent.is_navigation_finished():
			_arrive()
		else:
			var next := _agent.get_next_path_position()
			var to := next - global_position
			to.y = 0.0
			if to.length() > 0.01:
				var tgt := _agent.target_position
				var remain := Vector2(global_position.x - tgt.x, global_position.z - tgt.z).length()
				var spd := walk_speed * clampf(remain / SLOW_RADIUS, 0.3, 1.0)
				var dir := to.normalized()
				velocity.x = dir.x * spd
				velocity.z = dir.z * spd
				_desired_yaw = heading_yaw(dir)
				moving = true
	if not moving:
		velocity.x = 0.0
		velocity.z = 0.0

	move_and_slide()

	# Facing: heading while walking, otherwise the look target (talk / rest turn).
	if not moving and _face_target != Vector3.INF:
		var f := _face_target - global_position
		f.y = 0.0
		if f.length_squared() > 0.0025:
			_desired_yaw = heading_yaw(f)
	rotation.y = lerp_angle(rotation.y, _desired_yaw, clampf(delta * TURN_RATE, 0.0, 1.0))

	_apply_anim(moving)

	# Auto-end a held conversation when no dialogue system is driving it.
	if _state == State.TALKING and talk_hold_seconds > 0.0:
		_talk_timer -= delta
		if _talk_timer <= 0.0:
			end_talk()

func _arrive() -> void:
	velocity.x = 0.0
	velocity.z = 0.0
	if _state == State.ROAMING:
		_state = State.IDLE
		reached_destination.emit(self)

## IDLE stands in the model's natural bind pose (no idle clip shipped); WALK plays
## the Casual Walk. Only toggles on change (no per-frame restart).
func _apply_anim(moving: bool) -> void:
	if _anim == null or _walk_anim == "":
		return
	if moving and not _walk_playing:
		_anim.play(_walk_anim)
		_walk_playing = true
	elif not moving and _walk_playing:
		_anim.stop()
		_walk_playing = false

# --- helpers ----------------------------------------------------------------

func _find_type(n: Node, type_name: String) -> Node:
	if n.is_class(type_name):
		return n
	for c in n.get_children():
		var r := _find_type(c, type_name)
		if r != null:
			return r
	return null
