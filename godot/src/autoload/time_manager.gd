extends Node
## TimeManager — the single authoritative game clock. GAME_SYSTEMS.md §1,
## ARCHITECTURE.md §10. Everything else subscribes via WorldEvents; nothing
## else counts time on its own.
##
## Phase 1: a functional but minimal clock — enough to prove the
## subscribe-to-time and the multi-system save patterns. Weather, lighting
## profiles, and schedule reactions subscribe in later phases.

enum TimeBlock { NIGHT_EARLY, MORNING, AFTERNOON, EVENING, NIGHT_LATE }

const MINUTES_PER_DAY := 1440

## Real seconds per in-game minute (tunable). Lower = faster days.
@export var real_seconds_per_game_minute: float = 1.0

var day_index: int = 0
var minutes_into_day: int = 480  # start at 08:00 (Morning)

var _accum: float = 0.0
var _current_block: int = TimeBlock.MORNING

func _ready() -> void:
	_current_block = block_for_minute(minutes_into_day)
	SaveManager.register_savable("time", self)

func _process(delta: float) -> void:
	if real_seconds_per_game_minute <= 0.0:
		return
	_accum += delta
	while _accum >= real_seconds_per_game_minute:
		_accum -= real_seconds_per_game_minute
		_advance_minute()

func _advance_minute() -> void:
	minutes_into_day += 1
	if minutes_into_day >= MINUTES_PER_DAY:
		minutes_into_day = 0
		day_index += 1
		WorldEvents.day_started.emit(day_index)
	WorldEvents.minute_passed.emit(day_index, minutes_into_day)

	var block := block_for_minute(minutes_into_day)
	if block != _current_block:
		var old := _current_block
		_current_block = block
		WorldEvents.time_block_changed.emit(old, block)

static func block_for_minute(m: int) -> int:
	# 00:00-05:59 night, 06:00-11:59 morning, 12:00-17:59 afternoon,
	# 18:00-21:59 evening, 22:00-23:59 night (GAME_SYSTEMS.md §1).
	var hour := m / 60
	if hour < 6:
		return TimeBlock.NIGHT_EARLY
	elif hour < 12:
		return TimeBlock.MORNING
	elif hour < 18:
		return TimeBlock.AFTERNOON
	elif hour < 22:
		return TimeBlock.EVENING
	return TimeBlock.NIGHT_LATE

func current_block() -> int:
	return _current_block

static func block_name(block: int) -> String:
	match block:
		TimeBlock.NIGHT_EARLY, TimeBlock.NIGHT_LATE: return "Night"
		TimeBlock.MORNING: return "Morning"
		TimeBlock.AFTERNOON: return "Afternoon"
		TimeBlock.EVENING: return "Evening"
	return "?"

func clock_string() -> String:
	var hour := minutes_into_day / 60
	var minute := minutes_into_day % 60
	return "%02d:%02d" % [hour, minute]

func get_save_data() -> Dictionary:
	return {
		"day_index": day_index,
		"minutes_into_day": minutes_into_day,
	}

func load_save_data(data: Dictionary) -> void:
	day_index = int(data.get("day_index", 0))
	minutes_into_day = int(data.get("minutes_into_day", 480))
	_accum = 0.0
	_current_block = block_for_minute(minutes_into_day)
