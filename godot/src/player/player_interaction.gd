class_name PlayerInteraction
extends Node
## First-person interaction controller (ARCHITECTURE.md §4 / §6,
## GAME_SYSTEMS.md §3). Raycasts forward from the camera; resolves the hit
## collider to an Interactable; shows its prompt (via WorldEvents) and runs
## interact() on input. It holds NO per-type branching — it only ever calls
## the Interactable contract (AI_RULES.md Rule 4/5).

var player: Player
var ray: RayCast3D

var _current: Interactable

func _physics_process(_delta: float) -> void:
	if ray == null:
		return

	# Drop a target that was freed (e.g. an item that was just picked up).
	if _current != null and not is_instance_valid(_current):
		_current = null
		WorldEvents.interaction_target_changed.emit(null)

	var found := _get_target()
	if found != _current:
		_current = found
		WorldEvents.interaction_target_changed.emit(_current)

	# Interact comes through the abstraction: keyboard E OR the mobile
	# interact button both latch this action (MOBILE_FIRST.md §13).
	if _current != null and GameInput.consume_action("interact"):
		if _current.can_interact(player):
			_current.interact(player)

func current() -> Interactable:
	return _current

func _get_target() -> Interactable:
	ray.force_raycast_update()
	if not ray.is_colliding():
		return null
	return _resolve(ray.get_collider())

## Map a hit collider to its Interactable. Convention (ARCHITECTURE.md §6):
## the Interactable is a child of the collider body, or of one of its
## ancestors. Typed check, never has_method() duck-typing (AI_RULES.md §7).
func _resolve(collider: Object) -> Interactable:
	var node := collider as Node
	if node == null:
		return null
	var found := _find_interactable_child(node)
	if found != null:
		return found
	var ancestor := node.get_parent()
	while ancestor != null:
		if ancestor is Interactable:
			return ancestor
		found = _find_interactable_child(ancestor)
		if found != null:
			return found
		ancestor = ancestor.get_parent()
	return null

func _find_interactable_child(n: Node) -> Interactable:
	for c in n.get_children():
		if c is Interactable:
			return c
	return null
