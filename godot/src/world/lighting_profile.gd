class_name LightingProfile
extends RefCounted
## Typed value object for the *mood* half of lighting — sun angle/energy/color,
## ambient color/energy, background + fog tint. The RegionLightingController
## applies these to the single WorldEnvironment + Sun owned by world_root.
## GraphicsManager owns the cost knobs (shadows / fog-density / glow / ssao /
## scale / msaa) and is NEVER written here (M2.2_LIGHTING_DESIGN.md §7).
##
## All values are continuous functions of the game clock (minutes_into_day),
## interpolated between a small keyframe table so the day reads smoothly with
## no per-block switch. Values are deliberately restrained and natural — this
## is light in a real Japanese rural village, never a gamey color filter
## (M2.2_LIGHTING_DESIGN.md §0). Beauty is confirmed only on-device.

# --- Readability floors (tunable; the on-device test is the real gate) ---
const EXTERIOR_MIN_AMBIENT := 0.30   # night is never black; paths stay readable
const INTERIOR_MIN_AMBIENT := 0.55   # interiors are always warm + readable

var sun_pitch_deg: float = -50.0
var sun_yaw_deg: float = -35.0
var sun_energy: float = 1.2
var sun_color: Color = Color(1.0, 1.0, 1.0)
var ambient_color: Color = Color(0.62, 0.62, 0.66)
var ambient_energy: float = 0.45
var bg_color: Color = Color(0.52, 0.62, 0.72)
var fog_color: Color = Color(0.62, 0.68, 0.74)

func copy() -> LightingProfile:
	var p := LightingProfile.new()
	p.sun_pitch_deg = sun_pitch_deg
	p.sun_yaw_deg = sun_yaw_deg
	p.sun_energy = sun_energy
	p.sun_color = sun_color
	p.ambient_color = ambient_color
	p.ambient_energy = ambient_energy
	p.bg_color = bg_color
	p.fog_color = fog_color
	return p

static func blend(a: LightingProfile, b: LightingProfile, t: float) -> LightingProfile:
	var p := LightingProfile.new()
	p.sun_pitch_deg = lerpf(a.sun_pitch_deg, b.sun_pitch_deg, t)
	p.sun_yaw_deg = lerpf(a.sun_yaw_deg, b.sun_yaw_deg, t)
	p.sun_energy = lerpf(a.sun_energy, b.sun_energy, t)
	p.sun_color = a.sun_color.lerp(b.sun_color, t)
	p.ambient_color = a.ambient_color.lerp(b.ambient_color, t)
	p.ambient_energy = lerpf(a.ambient_energy, b.ambient_energy, t)
	p.bg_color = a.bg_color.lerp(b.bg_color, t)
	p.fog_color = a.fog_color.lerp(b.fog_color, t)
	return p

# --- Exterior keyframe table (minute-of-day -> profile), sorted, wrapping ---
static var _ext_min: Array[int] = []
static var _ext_prof: Array = []

static func _mk(pitch: float, energy: float, sun_c: Color, amb_c: Color,
		amb_e: float, bg: Color, fog: Color) -> LightingProfile:
	var p := LightingProfile.new()
	p.sun_pitch_deg = pitch
	p.sun_energy = energy
	p.sun_color = sun_c
	p.ambient_color = amb_c
	p.ambient_energy = amb_e
	p.bg_color = bg
	p.fog_color = fog
	return p

static func _build_ext() -> void:
	if not _ext_min.is_empty():
		return
	_ext_min = [150, 330, 420, 720, 1020, 1110, 1215, 1350]
	_ext_prof = [
		# 02:30 deep night — cool moon fill, ambient at floor, still navigable
		_mk(-58.0, 0.16, Color(0.58, 0.63, 0.74), Color(0.34, 0.38, 0.46), 0.30,
			Color(0.06, 0.08, 0.13), Color(0.10, 0.13, 0.20)),
		# 05:30 first light — soft cool->warm dawn
		_mk(-8.0, 0.55, Color(0.98, 0.86, 0.78), Color(0.46, 0.48, 0.54), 0.42,
			Color(0.40, 0.46, 0.56), Color(0.56, 0.57, 0.60)),
		# 07:00 morning — fresh, cool-neutral, gentle shadows
		_mk(-26.0, 1.00, Color(0.99, 0.97, 0.94), Color(0.56, 0.58, 0.62), 0.48,
			Color(0.56, 0.66, 0.78), Color(0.66, 0.72, 0.78)),
		# 12:00 day — neutral-bright, readable
		_mk(-62.0, 1.25, Color(1.00, 0.99, 0.96), Color(0.60, 0.61, 0.63), 0.55,
			Color(0.53, 0.64, 0.80), Color(0.68, 0.74, 0.82)),
		# 17:00 late afternoon — warming, longer shadows
		_mk(-30.0, 1.15, Color(1.00, 0.95, 0.86), Color(0.60, 0.57, 0.54), 0.52,
			Color(0.60, 0.63, 0.71), Color(0.72, 0.71, 0.70)),
		# 18:30 evening HERO — golden, warm directional, long shadows
		_mk(-10.0, 1.20, Color(1.00, 0.84, 0.64), Color(0.56, 0.51, 0.48), 0.48,
			Color(0.66, 0.56, 0.50), Color(0.74, 0.64, 0.56)),
		# 20:15 dusk — dimming warm->cool
		_mk(-2.0, 0.50, Color(0.80, 0.68, 0.66), Color(0.44, 0.44, 0.50), 0.40,
			Color(0.30, 0.32, 0.42), Color(0.42, 0.42, 0.50)),
		# 22:30 night — cool moonlight, warm-window-ready, ambient at floor
		_mk(-55.0, 0.17, Color(0.60, 0.64, 0.75), Color(0.36, 0.40, 0.48), 0.32,
			Color(0.08, 0.10, 0.16), Color(0.12, 0.15, 0.22)),
	]

## Continuous exterior look for a minute-of-day, wrapping across midnight.
static func exterior_at(minute: int) -> LightingProfile:
	_build_ext()
	var m := wrapi(minute, 0, 1440)
	var n := _ext_min.size()
	for i in n:
		var a_min: int = _ext_min[i]
		var b_min: int = _ext_min[(i + 1) % n]
		var span := b_min - a_min
		if span <= 0:
			span += 1440
		var rel := m - a_min
		if rel < 0:
			rel += 1440
		if rel <= span:
			var t := 0.0 if span == 0 else float(rel) / float(span)
			return blend(_ext_prof[i], _ext_prof[(i + 1) % n], t)
	return (_ext_prof[0] as LightingProfile).copy()

## 0.0 at deep night -> 1.0 around midday. Used to modulate interiors subtly
## so they feel connected to the outside without ever going dark.
static func daylight_factor(minute: int) -> float:
	var m := float(wrapi(minute, 0, 1440))
	var x := (m - 720.0) / 720.0   # -1 at midnight, 0 at noon, +1 at midnight
	return clampf(1.0 - absf(x), 0.0, 1.0)

## Interior baseline — warm, inviting, always readable. A SEPARATE context:
## this is applied only while a location is loaded, so it never brightens the
## outdoor world (M2.2_LIGHTING_DESIGN.md §5). No extra dynamic lights.
static func interior_at(minute: int) -> LightingProfile:
	var day := daylight_factor(minute)
	var p := LightingProfile.new()
	p.sun_pitch_deg = -45.0
	p.sun_yaw_deg = -35.0
	p.sun_energy = lerpf(0.15, 0.35, day)          # soft fill; ceiling occludes
	p.sun_color = Color(1.0, 0.90, 0.78)           # warm window light
	p.ambient_color = Color(0.66, 0.58, 0.50).lerp(Color(0.66, 0.63, 0.58), day)
	p.ambient_energy = lerpf(0.60, 0.78, day)      # >= INTERIOR_MIN_AMBIENT
	p.bg_color = Color(0.14, 0.12, 0.10).lerp(Color(0.30, 0.30, 0.30), day)
	p.fog_color = Color(0.30, 0.26, 0.22)
	return p

# --- Category modifiers: subtle character, NOT a color grade (design §6) ---
static func _warm(p: LightingProfile, amt: float) -> void:
	var w := Color(1.0, 0.85, 0.65)
	p.sun_color = p.sun_color.lerp(w, amt)
	p.ambient_color = p.ambient_color.lerp(w, amt * 0.7)

static func _cool(p: LightingProfile, amt: float) -> void:
	var c := Color(0.70, 0.80, 1.0)
	p.sun_color = p.sun_color.lerp(c, amt)
	p.ambient_color = p.ambient_color.lerp(c, amt * 0.7)

## Apply a restrained per-location modifier. Deltas are tiny (small warmth
## bias and <= ~4% ambient nudge) so locations gain character without each
## looking like a different game (design §6).
static func apply_category(p: LightingProfile, category: StringName) -> LightingProfile:
	var r := p.copy()
	match category:
		&"residential":
			_warm(r, 0.02)
		&"commercial":
			_warm(r, 0.04)
			r.ambient_energy *= 1.04
		&"natural":
			_cool(r, 0.02)
			r.ambient_energy *= 1.03
		&"water":
			_cool(r, 0.03)
			r.ambient_energy *= 1.02
			r.bg_color = r.bg_color.lerp(Color(0.50, 0.60, 0.70), 0.05)
		&"landmark":
			_warm(r, 0.03)
			r.ambient_energy *= 1.02
		&"threshold":
			r.ambient_energy *= 1.03
		&"interior":
			pass  # interior-ness is driven by context, not this tag
		_:
			pass  # unknown/empty -> neutral
	return r

## Sparse, LOCAL mystery modifier layered on top of normal beautiful lighting.
## NOT a category and NOT a global mode: a small cool shift + small dim (still
## clamped above the floor) + slight cool fog. No red, no horror grading, no
## map-wide darkening (design §6). Default 0 everywhere.
static func apply_mystery(p: LightingProfile, strength: float) -> LightingProfile:
	var s := clampf(strength, 0.0, 1.0)
	if s <= 0.0:
		return p
	var r := p.copy()
	var cool := Color(0.62, 0.70, 0.85)
	r.ambient_color = r.ambient_color.lerp(cool, 0.15 * s)
	r.sun_color = r.sun_color.lerp(cool, 0.10 * s)
	r.ambient_energy *= lerpf(1.0, 0.90, s)   # at most ~10% dimmer
	r.fog_color = r.fog_color.lerp(cool, 0.12 * s)
	return r

static func _desaturate(c: Color, amt: float) -> Color:
	var g := c.get_luminance()
	return c.lerp(Color(g, g, g), clampf(amt, 0.0, 1.0))

## Fold a weather LightMod into the profile (M2.3). Subtle: desaturate +
## slight darken + small cool tint + fog-tint bias. `blend` scales the whole
## effect for smooth transitions. A null mod, blend <= 0, or the CLEAR all-zero
## mod all return the profile unchanged — so the M2.2 look is preserved exactly.
static func apply_weather(p: LightingProfile, mod: WeatherTypes.LightMod,
		blend: float) -> LightingProfile:
	if mod == null:
		return p
	var b := clampf(blend, 0.0, 1.0)
	var desat := mod.desaturation * b
	var darken := mod.darken * b
	var tint_s := mod.tint_strength * b
	var fog_s := mod.fog_tint_strength * b
	if desat <= 0.0 and darken <= 0.0 and tint_s <= 0.0 and fog_s <= 0.0:
		return p
	var r := p.copy()
	if desat > 0.0:
		r.sun_color = _desaturate(r.sun_color, desat)
		r.ambient_color = _desaturate(r.ambient_color, desat)
	if darken > 0.0:
		r.sun_energy *= (1.0 - darken)
		r.ambient_energy *= (1.0 - darken)
	if tint_s > 0.0:
		r.ambient_color = r.ambient_color.lerp(mod.tint, tint_s)
		r.bg_color = r.bg_color.lerp(mod.tint, tint_s * 0.6)
	if fog_s > 0.0:
		r.fog_color = r.fog_color.lerp(mod.fog_tint, fog_s)
	return r

## Enforce the readability floor. Interiors and exteriors have separate floors
## so interior readability never forces the outdoor world brighter.
static func clamp_readability(p: LightingProfile, interior: bool) -> LightingProfile:
	var floor_e := INTERIOR_MIN_AMBIENT if interior else EXTERIOR_MIN_AMBIENT
	if p.ambient_energy < floor_e:
		p.ambient_energy = floor_e
	return p

## The full resolve: base (context) -> category -> weather -> mystery ->
## readability clamp (M2.2_LIGHTING_DESIGN.md + M2.3 §3). The weather args are
## optional and default to the identity, so callers that pass none (and CLEAR
## weather) get exactly the M2.2 result.
static func resolve(minute: int, interior: bool, category: StringName,
		mystery: float, weather_mod: WeatherTypes.LightMod = null,
		weather_blend: float = 0.0) -> LightingProfile:
	var base := interior_at(minute) if interior else exterior_at(minute)
	base = apply_category(base, category)
	base = apply_weather(base, weather_mod, weather_blend)
	base = apply_mystery(base, mystery)
	base = clamp_readability(base, interior)
	return base
