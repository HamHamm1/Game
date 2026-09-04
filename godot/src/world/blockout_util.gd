class_name BlockoutUtil
extends RefCounted
## Shared helpers for building primitive blockout geometry in code
## (ART_DIRECTION.md §6 step 1: grey-box with primitives to test layout,
## scale, and interaction before any real art). Kept in one place so region
## and interior blockouts don't duplicate construction logic (AI_RULES.md
## Rule 3/9).

## A solid, collidable, coloured box (mesh + StaticBody3D + collision).
static func static_box(size: Vector3, pos: Vector3, color: Color) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = pos

	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh.material_override = mat
	body.add_child(mesh)

	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)

	return body

## A pickup: a small collidable box carrying a PickupItem interactable.
static func add_pickup(parent: Node, pos: Vector3, item_id: StringName, qty: int) -> StaticBody3D:
	var body := static_box(Vector3(0.4, 0.4, 0.4), pos, Color(0.85, 0.72, 0.30))
	parent.add_child(body)
	var pickup := PickupItem.new()
	pickup.item_id = item_id
	pickup.quantity = qty
	pickup.world_body = body
	body.add_child(pickup)
	return body

## A named spawn marker the world root can teleport the player to.
static func add_spawn(parent: Node, spawn_name: String, pos: Vector3) -> Marker3D:
	var marker := Marker3D.new()
	marker.name = spawn_name
	marker.position = pos
	parent.add_child(marker)
	return marker
