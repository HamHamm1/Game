class_name MaterialLibrary
extends RefCounted
## M2.4-A — a small, shared, TEXTURE-FREE material library for the village
## (M2.4_ART_DESIGN.md §M2.4-A). Every surface of a given kind reuses one
## StandardMaterial3D instance, so the whole town shares a handful of tuned
## materials instead of dozens of one-off flat colors — cheaper to render
## (batching) and visually cohesive. Roughness/metallic are tuned so the M2.2
## sun/ambient read each surface as a material (wood matte, tile a touch
## sheened, water catching the sun), not flat paint.
##
## No textures, no normal/AO maps, no emission — those are later M2.4 tiers.
## This module owns look data only; it never writes the Environment or lights.

static var _named: Dictionary = {}      # StringName -> StandardMaterial3D
static var _by_color: Dictionary = {}   # Color -> StandardMaterial3D

## Named, tuned, shared material for a known surface key. Unknown keys fall
## back to a neutral material so a typo can never crash the build.
static func get_mat(key: StringName) -> StandardMaterial3D:
	if _named.has(key):
		return _named[key]
	var m := _build(key)
	_named[key] = m
	return m

## Shared, tuned material for an arbitrary color (used by the color-based
## BlockoutUtil helpers, so small props are shared + tuned with no edits).
static func tuned_color(color: Color) -> StandardMaterial3D:
	if _by_color.has(color):
		return _by_color[color]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.9
	m.metallic = 0.0
	_by_color[color] = m
	return m

static func _mk(color: Color, roughness: float, metallic: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = clampf(roughness, 0.0, 1.0)
	m.metallic = clampf(metallic, 0.0, 1.0)
	return m

static func _build(key: StringName) -> StandardMaterial3D:
	match key:
		# --- Ground / paths / water ---
		&"ground": return _mk(Color(0.34, 0.44, 0.28), 1.0)          # grassy earth
		&"grass_bright": return _mk(Color(0.36, 0.52, 0.30), 1.0)    # park lawn
		&"path": return _mk(Color(0.54, 0.52, 0.48), 0.85)           # stone/paved street
		&"water": return _mk(Color(0.26, 0.42, 0.55), 0.14)          # low roughness -> sun sparkle
		&"stone": return _mk(Color(0.50, 0.49, 0.46), 0.8)           # foundations / walls
		# --- Building walls (variety, all restrained rural tones) ---
		&"wall_wood_warm": return _mk(Color(0.72, 0.62, 0.48), 0.8)
		&"wall_wood_sage": return _mk(Color(0.58, 0.60, 0.50), 0.82)
		&"wall_wood_grey": return _mk(Color(0.54, 0.52, 0.48), 0.82)
		&"wall_plaster": return _mk(Color(0.82, 0.78, 0.72), 0.9)
		&"wall_red": return _mk(Color(0.60, 0.32, 0.28), 0.8)        # muted restaurant accent
		# --- Roofs ---
		&"roof_dark": return _mk(Color(0.24, 0.23, 0.26), 0.7)       # charcoal tile, slight sheen
		&"roof_warm": return _mk(Color(0.34, 0.26, 0.22), 0.75)
		# --- Structural / trim / doors ---
		&"wood_dark": return _mk(Color(0.30, 0.22, 0.16), 0.7)       # posts/beams/trunks/trim
		&"wood_door": return _mk(Color(0.44, 0.30, 0.20), 0.7)
		# --- Foliage ---
		&"foliage": return _mk(Color(0.26, 0.42, 0.24), 1.0)
		&"foliage_dark": return _mk(Color(0.20, 0.34, 0.20), 1.0)
		# --- Interiors ---
		&"floor_wood": return _mk(Color(0.40, 0.30, 0.22), 0.85)
		&"wall_interior": return _mk(Color(0.62, 0.56, 0.48), 0.9)
		&"ceiling": return _mk(Color(0.40, 0.38, 0.36), 0.95)
		# --- Reserved for future metal props (utility hardware, etc.) ---
		&"metal": return _mk(Color(0.55, 0.56, 0.58), 0.4, 0.9)
		_: return _mk(Color(0.6, 0.6, 0.6), 0.9)                     # neutral fallback
