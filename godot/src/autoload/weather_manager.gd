extends Node
## WeatherManager — authority for weather state (GAME_SYSTEMS.md §2, M2.3).
## Subset: CLEAR / OVERCAST / LIGHT_RAIN / MIST + a wind scalar. Deterministic:
## boots CLEAR (preserving the M2.2 look), rolls a new state on each day
## boundary from a seeded RNG, and may schedule at most ONE optional intra-day
## transition. It publishes state + typed modifiers as DATA only — it NEVER
## writes Environment, DirectionalLight3D, fog_density, or any GraphicsManager-
## owned property (M2.3_WEATHER_DESIGN.md §1). Subscribers (lighting, FX) react.

const BASE_SEED_DEFAULT := 0x5EED
const INTRADAY_CHANCE := 0.4          # chance of one optional intra-day change
const PRIME := 2654435761             # seed mixer (Knuth)

var state: int = WeatherTypes.State.CLEAR
var wind: float = 0.0
var base_seed: int = BASE_SEED_DEFAULT

var _pending_at: int = -1             # minute-of-day for the optional change, -1 = none
var _pending_state: int = WeatherTypes.State.CLEAR

func _ready() -> void:
	SaveManager.register_savable("weather", self)
	WorldEvents.day_started.connect(_on_day_started)
	WorldEvents.minute_passed.connect(_on_minute_passed)
	# Boot CLEAR so the M2.2 look is preserved, then schedule one optional
	# deterministic intra-day transition for the current day.
	state = WeatherTypes.State.CLEAR
	wind = _wind_for(state)
	_schedule_intraday(_day())

func _day() -> int:
	return TimeManager.day_index if TimeManager != null else 0

func _now() -> int:
	return TimeManager.minutes_into_day if TimeManager != null else 0

func _rng_for_day(day: int) -> RandomNumberGenerator:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(base_seed) ^ (int(day) * PRIME)
	return rng

func _on_day_started(day: int) -> void:
	var rng := _rng_for_day(day)
	_set_state(WeatherTypes.roll(rng), "day_roll")
	_schedule_intraday(day, rng)

## At most one optional intra-day change, at a deterministic later minute.
func _schedule_intraday(day: int, rng: RandomNumberGenerator = null) -> void:
	if rng == null:
		rng = _rng_for_day(day)
	_pending_at = -1
	if rng.randf() < INTRADAY_CHANCE:
		var at := _now() + rng.randi_range(180, 480)  # 3–8 game-hours later
		if at < 1440:
			_pending_at = at
			_pending_state = WeatherTypes.roll(rng)

func _on_minute_passed(_day: int, minutes: int) -> void:
	if _pending_at >= 0 and minutes >= _pending_at:
		_pending_at = -1
		_set_state(_pending_state, "intraday")

func _set_state(s: int, _reason: String) -> void:
	if s == state:
		return
	var old := state
	state = s
	wind = _wind_for(s)
	WorldEvents.weather_changed.emit(old, s)

func _wind_for(s: int) -> float:
	match s:
		WeatherTypes.State.LIGHT_RAIN: return 0.5
		WeatherTypes.State.OVERCAST: return 0.35
		WeatherTypes.State.MIST: return 0.1
	return 0.2

# --- Public data API (no side effects) ---
func current_state() -> int:
	return state

func current_wind() -> float:
	return wind

func light_mod() -> WeatherTypes.LightMod:
	return WeatherTypes.light_mod(state)

func fx_spec() -> WeatherTypes.FxSpec:
	return WeatherTypes.fx_spec(state)

# --- Save/load (backward compatible: old saves without "weather" -> CLEAR) ---
func get_save_data() -> Dictionary:
	return {
		"state": state,
		"wind": wind,
		"base_seed": base_seed,
		"pending_at": _pending_at,
		"pending_state": _pending_state,
	}

func load_save_data(data: Dictionary) -> void:
	state = int(data.get("state", WeatherTypes.State.CLEAR))
	wind = float(data.get("wind", 0.0))
	base_seed = int(data.get("base_seed", BASE_SEED_DEFAULT))
	_pending_at = int(data.get("pending_at", -1))
	_pending_state = int(data.get("pending_state", WeatherTypes.State.CLEAR))
	# Subscribers resync from current state on WorldEvents.game_loaded, which
	# SaveManager emits after every system has loaded.
