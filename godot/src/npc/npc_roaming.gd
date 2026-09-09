class_name NpcRoaming
extends Node
## M2.5.1 — the NPC's autonomous "brain": picks safe destinations from the village
## NavigationService and paces the NPC through IDLE → ROAMING → (arrive) → short
## idle or a longer rest → next destination. It never moves the NPC directly (the
## body + NavigationAgent do that); it only chooses destinations and timings, so
## it stays a thin, replaceable decision layer — a future schedule / activity /
## API-driven brain can drop in here. Talking always wins: while the NPC is in a
## conversation the brain is idle and resumes only after it ends.
##
## Cheap for Android: no per-frame navigation rebuild, no raycasts; it just counts
## down a timer and calls go_to() when a new destination is due.

@export var idle_min: float = 3.0
@export var idle_max: float = 10.0
@export var rest_min: float = 15.0
@export var rest_max: float = 40.0
@export var rest_chance: float = 0.28

var _npc: NpcPrototype
var _nav: NpcNavigation
var _rng := RandomNumberGenerator.new()
var _wait: float = 1.5           # short settle before the first walk (nav map sync)
var _rest_turn: float = 0.0
var _last_dest: Vector3 = Vector3.INF

func setup(nav: NpcNavigation, seed: int = 0) -> void:
	_nav = nav
	_rng.seed = seed if seed != 0 else randi()

func _ready() -> void:
	_npc = get_parent() as NpcPrototype
	if _npc != null:
		_npc.reached_destination.connect(_on_arrived)
		_npc.talk_started.connect(_on_talk_started)
		_npc.talk_ended.connect(_on_talk_ended)

func _physics_process(delta: float) -> void:
	if _npc == null or _nav == null or _npc.is_busy_talking():
		return
	if _npc.state() == NpcPrototype.State.ROAMING:
		return   # the body is walking the path; wait for reached_destination
	# IDLE / RESTING: count down, and gently glance around while resting.
	if _npc.state() == NpcPrototype.State.RESTING:
		_rest_turn -= delta
		if _rest_turn <= 0.0:
			_glance()
			_rest_turn = _rng.randf_range(4.0, 8.0)
	_wait -= delta
	if _wait <= 0.0:
		_go_next()

func _go_next() -> void:
	_npc.clear_look()
	var dest := _nav.random_destination(_rng, _last_dest)
	_last_dest = dest
	_npc.go_to(dest)

func _on_arrived(_n: NpcPrototype) -> void:
	_npc.clear_look()
	if _rng.randf() < rest_chance:
		_npc.halt(true)                             # a longer rest
		_wait = _rng.randf_range(rest_min, rest_max)
		_rest_turn = _rng.randf_range(3.0, 6.0)
	else:
		_npc.halt(false)                            # a short idle pause
		_wait = _rng.randf_range(idle_min, idle_max)

func _on_talk_started(_n: NpcPrototype) -> void:
	pass   # the guard in _physics_process pauses roaming while TALKING

func _on_talk_ended(_n: NpcPrototype) -> void:
	# Do NOT walk off immediately after a conversation: idle briefly, then resume.
	_npc.clear_look()
	_wait = _rng.randf_range(2.5, 5.0)

## A subtle look toward a random nearby point (rest ambience) — no sliding.
func _glance() -> void:
	var a := _rng.randf() * TAU
	var p := _npc.global_position + Vector3(cos(a), 0.0, sin(a)) * 4.0
	_npc.look_at_player(p)
