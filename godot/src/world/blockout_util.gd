class_name BlockoutUtil
extends RefCounted
## Shared helpers for building primitive blockout geometry in code
## (ART_DIRECTION.md §6 step 1: grey-box with primitives to test layout,
## scale, and interaction before any real art). Kept in one place so region
## and interior blockouts don't duplicate construction logic (AI_RULES.md
## Rule 3/9).

## A solid, collidable box with a shared, tuned material (M2.4-A). The colour
## resolves to a cached MaterialLibrary material, so identical colours share
## one material instance (batching) and get the tuned roughness/metallic.
static func static_box(size: Vector3, pos: Vector3, color: Color) -> StaticBody3D:
	return static_box_mat(size, pos, MaterialLibrary.tuned_color(color))

## A solid, collidable box using an explicit shared material (M2.4-A) — pass
## MaterialLibrary.get_mat(&"key") for a named village surface.
static func static_box_mat(size: Vector3, pos: Vector3, material: Material) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = pos

	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = material
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

## A mesh-only coloured box (no collision, no StaticBody). For decorative
## geometry the player can't reach or interact with — roofs, tree canopies,
## water surfaces, painted street stripes. Keeps node count down vs.
## static_box when collision would be wasted (MOBILE_FIRST.md §6/§10).
static func visual_box(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	return visual_box_mat(size, pos, MaterialLibrary.tuned_color(color))

## Mesh-only box using an explicit shared material (M2.4-A).
static func visual_box_mat(size: Vector3, pos: Vector3, material: Material) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	mesh.position = pos
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = material
	return mesh

## A simple blockout tree: a collidable trunk plus a mesh-only canopy.
## Trees are obstacles the player bumps into (trunk collides), but the
## canopy above head height is visual only.
static func add_tree(parent: Node, pos: Vector3) -> void:
	parent.add_child(static_box_mat(
		Vector3(0.4, 3.0, 0.4), pos + Vector3(0.0, 1.5, 0.0), MaterialLibrary.get_mat(&"wood_dark")))
	parent.add_child(visual_box_mat(
		Vector3(2.2, 2.2, 2.2), pos + Vector3(0.0, 3.8, 0.0), MaterialLibrary.get_mat(&"foliage")))
