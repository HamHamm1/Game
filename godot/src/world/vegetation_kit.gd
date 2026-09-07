class_name VegetationKit
extends RefCounted
## M2.4 (rebuild) — cached, shared, low-poly species meshes for instanced
## vegetation. Every mesh is authored BASE-AT-ORIGIN (its ground-contact point
## is local y=0) so a field can ground it by putting the instance origin at the
## ground height — no floating, no guessing. Sphere-based species (shrub/rock)
## instead report a `ground_offset` so their centre sits the right amount above
## the surface. Meshes are texture-free but shaped to read as real plants at
## first-person distance (no triangular spikes). Owns mesh data only.

static var _cache: Dictionary = {}   # StringName -> Mesh

static func mesh(species: StringName) -> Mesh:
	if _cache.has(species):
		return _cache[species]
	var m := _build(species)
	_cache[species] = m
	return m

## How far the mesh's origin sits ABOVE the ground-contact point, in mesh-local
## units (multiplied by the instance scale by the field). 0 for base-anchored
## meshes; positive for centre-origin spheres so they rest on the surface.
static func ground_offset(species: StringName) -> float:
	match species:
		&"shrub": return 0.40   # dome bottom rests on ground
		&"rock": return 0.28    # rock sits slightly sunk into the ground
	return 0.0

static func _build(species: StringName) -> Mesh:
	match species:
		&"grass":
			return _tuft(6, 0.34, 0.42, Color.WHITE)   # upright clump
		&"fern":
			return _tuft(5, 0.30, 0.85, Color.WHITE)   # lower, arched fronds
		&"flower":
			return _flower()
		&"shrub":
			var s := SphereMesh.new()
			s.radius = 0.42
			s.height = 0.80
			s.radial_segments = 7
			s.rings = 4
			return s
		&"rock":
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

## A tuft of `blades` curved, tapered, double-sided blades fanned around the
## base (local y=0). `lean` (0..1) bends the tip outward — low for upright
## grass, high for arched ferns. Reads as a clump, not a spike.
static func _tuft(blades: int, height: float, lean: float, tint: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in blades:
		var yaw := TAU * float(i) / float(blades) + 0.35
		var dir := Vector3(sin(yaw), 0.0, cos(yaw))
		var side := Vector3(cos(yaw), 0.0, -sin(yaw))
		var h := height * (0.85 + 0.3 * float(i % 2))       # height variety
		var out := lean * h
		var base := dir * 0.03
		var mid := base + Vector3(0.0, h * 0.55, 0.0) + dir * (out * 0.35)
		var tip := base + Vector3(0.0, h, 0.0) + dir * out
		var bw := 0.05
		var mw := 0.035
		# base->mid, then mid->tip, each a double-sided quad.
		_quad(st, base - side * bw, base + side * bw, mid + side * mw, mid - side * mw, tint)
		_quad(st, mid - side * mw, mid + side * mw, tip, tip, tint)
	st.generate_normals()
	return st.commit()

## A small flower: a green stem plus a warm bloom, coloured with vertex colours
## (one shared vertex-colour material draws both). Base-anchored.
static func _flower() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var green := Color(0.32, 0.46, 0.26)
	var bloom := Color(0.90, 0.78, 0.42)
	var h := 0.26
	# Stem (a thin double-sided blade).
	var s := Vector3(1, 0, 0)
	_quad(st, Vector3(-0.012, 0, 0), Vector3(0.012, 0, 0),
		Vector3(0.008, h, 0), Vector3(-0.008, h, 0), green)
	# Bloom: two small crossed petals near the top.
	var top := Vector3(0, h, 0)
	for a in [0.0, PI * 0.5]:
		var d := Vector3(sin(a), 0, cos(a))
		var n := Vector3(cos(a), 0, -sin(a))
		_quad(st, top - d * 0.06 - n * 0.02, top - d * 0.06 + n * 0.02,
			top + d * 0.06 + n * 0.02, top + d * 0.06 - n * 0.02, bloom)
	st.generate_normals()
	return st.commit()

## Two triangles for a quad, added with both windings (double-sided), tinted.
static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	for v in [a, b, c, a, c, d, a, c, b, a, d, c]:
		st.set_color(col)
		st.add_vertex(v)
