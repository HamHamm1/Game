class_name VegetationKit
extends RefCounted
## M2.4-B — cheap, cached, low-poly meshes for instanced vegetation. One shared
## Mesh per species (a MultiMesh reuses it across all its instances, and all
## fields of a species share this one). No textures, no alpha shaders — solid
## low-poly geometry that reads as ground cover at density under M2.2 lighting
## (M2.4_ART_DESIGN.md §M2.4-B). Owns mesh data only; no scene/environment access.

static var _cache: Dictionary = {}   # StringName -> Mesh

static func mesh(species: StringName) -> Mesh:
	if _cache.has(species):
		return _cache[species]
	var m := _build(species)
	_cache[species] = m
	return m

static func _build(species: StringName) -> Mesh:
	match species:
		&"grass":
			# A small low-poly tuft of 5 angled blades (B.1 fix): reads as a
			# grass clump at first-person distance, not a triangular spike.
			# Double-sided geometry (~20 tris) so it lights correctly from any
			# angle without a special shader.
			return _grass_tuft()
		&"fern":
			# A wider, lower frond clump.
			var p := PrismMesh.new()
			p.size = Vector3(0.5, 0.5, 0.05)
			return p
		&"shrub":
			# A small rounded bush blob (low sphere).
			var s := SphereMesh.new()
			s.radius = 0.45
			s.height = 0.8
			s.radial_segments = 6
			s.rings = 3
			return s
		&"flower":
			# A tiny bloom (small low sphere) sat on a short stem look via scale.
			var s := SphereMesh.new()
			s.radius = 0.12
			s.height = 0.24
			s.radial_segments = 5
			s.rings = 2
			return s
		&"rock":
			# A faceted low rock.
			var s := SphereMesh.new()
			s.radius = 0.5
			s.height = 0.7
			s.radial_segments = 5
			s.rings = 3
			return s
		_:
			var b := BoxMesh.new()
			b.size = Vector3(0.2, 0.2, 0.2)
			return b

## A small tuft of 5 angled tapered blades fanned around a common base. Each
## blade is a double-sided quad so it lights from any angle without a shader.
## ~20 tris — extremely cheap, and reads as a grass clump, not a spike.
static func _grass_tuft() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var blades := 5
	for i in blades:
		var yaw := TAU * float(i) / float(blades) + 0.35
		var dir := Vector3(sin(yaw), 0.0, cos(yaw))
		var side := Vector3(cos(yaw), 0.0, -sin(yaw))
		var h := 0.36 + 0.05 * float(i % 2)     # slight height variety
		var lean := 0.14                         # outward lean at the tip
		var base := dir * 0.02
		var tip := base + Vector3(0.0, h, 0.0) + dir * lean
		var b0 := base - side * 0.045
		var b1 := base + side * 0.045
		var t0 := tip - side * 0.012
		var t1 := tip + side * 0.012
		_quad(st, b0, b1, t1, t0)
	st.generate_normals()
	return st.commit()

## Two triangles for a quad, added twice with opposite winding (double-sided).
static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> void:
	st.add_vertex(a); st.add_vertex(b); st.add_vertex(c)
	st.add_vertex(a); st.add_vertex(c); st.add_vertex(d)
	st.add_vertex(a); st.add_vertex(c); st.add_vertex(b)
	st.add_vertex(a); st.add_vertex(d); st.add_vertex(c)
