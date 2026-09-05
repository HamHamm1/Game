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
			# A thin tall blade; many instances read as a grass field.
			var p := PrismMesh.new()
			p.size = Vector3(0.09, 0.45, 0.02)
			return p
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
