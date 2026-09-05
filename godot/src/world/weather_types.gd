class_name WeatherTypes
extends RefCounted
## Typed weather data for M2.3 (M2.3_WEATHER_DESIGN.md). Pure data + math:
## the state enum, a lighting modifier and an FX spec per state, a modifier
## blend for smooth transitions, and a deterministic weighted roll. No node
## or Environment access lives here.
##
## Design discipline: the LightMod deltas are SUBTLE — weather must read as
## naturally diffused daylight, not a screen/color filter (design §7).

enum State { CLEAR, OVERCAST, LIGHT_RAIN, MIST }

## Lighting-only modifier consumed by LightingProfile.apply_weather. CLEAR is
## the all-zero identity so the M2.2 look is preserved exactly.
class LightMod:
	extends RefCounted
	var desaturation: float = 0.0        # 0..1 pull sun/ambient toward their luminance
	var darken: float = 0.0              # 0..~0.1 multiply sun/ambient energy down
	var tint: Color = Color(1.0, 1.0, 1.0)
	var tint_strength: float = 0.0       # 0..1 lerp ambient/bg toward tint
	var fog_tint: Color = Color(1.0, 1.0, 1.0)
	var fog_tint_strength: float = 0.0   # 0..1 lerp fog color toward fog_tint

## FX intent consumed by WeatherFX (rain particles / localized mist / wetness).
class FxSpec:
	extends RefCounted
	var rain: float = 0.0     # 0..1 rain particle intensity
	var mist: float = 0.0     # 0..1 localized mist intensity
	var wetness: float = 0.0  # 0..1 wet-surface intent (material response is M2.4)

static func state_name(s: int) -> String:
	match s:
		State.CLEAR: return "Clear"
		State.OVERCAST: return "Overcast"
		State.LIGHT_RAIN: return "Light Rain"
		State.MIST: return "Mist"
	return "?"

## Subtle per-state lighting modifiers (design §7). Darken stays <= ~0.08; the
## readability floors are re-applied by the controller after this, so weather
## can never make night/interiors too dark.
static func light_mod(s: int) -> LightMod:
	var m := LightMod.new()
	match s:
		State.OVERCAST:
			m.desaturation = 0.18
			m.darken = 0.05
			m.tint = Color(0.74, 0.77, 0.82)
			m.tint_strength = 0.10
			m.fog_tint = Color(0.80, 0.82, 0.85)
			m.fog_tint_strength = 0.15
		State.LIGHT_RAIN:
			m.desaturation = 0.22
			m.darken = 0.08
			m.tint = Color(0.68, 0.74, 0.82)
			m.tint_strength = 0.12
			m.fog_tint = Color(0.72, 0.78, 0.85)
			m.fog_tint_strength = 0.18
		State.MIST:
			m.desaturation = 0.10
			m.darken = 0.03
			m.tint = Color(0.80, 0.84, 0.90)
			m.tint_strength = 0.08
			m.fog_tint = Color(0.85, 0.88, 0.92)
			m.fog_tint_strength = 0.12
		_:
			pass  # CLEAR -> identity (all zeros)
	return m

static func fx_spec(s: int) -> FxSpec:
	var f := FxSpec.new()
	match s:
		State.LIGHT_RAIN:
			f.rain = 0.6
			f.mist = 0.1
			f.wetness = 0.5
		State.MIST:
			f.mist = 0.8
			f.wetness = 0.1
		_:
			pass  # CLEAR / OVERCAST -> no FX
	return f

## Linear blend between two modifiers for a smooth transition.
static func blend_mod(a: LightMod, b: LightMod, t: float) -> LightMod:
	var u := clampf(t, 0.0, 1.0)
	var m := LightMod.new()
	m.desaturation = lerpf(a.desaturation, b.desaturation, u)
	m.darken = lerpf(a.darken, b.darken, u)
	m.tint = a.tint.lerp(b.tint, u)
	m.tint_strength = lerpf(a.tint_strength, b.tint_strength, u)
	m.fog_tint = a.fog_tint.lerp(b.fog_tint, u)
	m.fog_tint_strength = lerpf(a.fog_tint_strength, b.fog_tint_strength, u)
	return m

## Deterministic Clear-dominant weighted roll (design §2). The world is
## beautiful by default; rain/mist are the minority.
static func roll(rng: RandomNumberGenerator) -> int:
	# weights: CLEAR 55, OVERCAST 25, LIGHT_RAIN 12, MIST 8  (sum 100)
	var r := rng.randi_range(0, 99)
	if r < 55:
		return State.CLEAR
	elif r < 80:
		return State.OVERCAST
	elif r < 92:
		return State.LIGHT_RAIN
	return State.MIST
