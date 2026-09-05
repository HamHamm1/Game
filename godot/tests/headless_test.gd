extends Node
## Headless logic test suite. Runs under `godot --headless` with no
## rendering — validates the parts that don't need a GPU/window: data
## loading, inventory, save/load round-trip, time blocks, settings
## persistence, graphics presets, interactable verbs, and the GameInput
## abstraction (touch/latch paths). Exits 0 if all checks pass, 1 otherwise.
##
## Run: tools/run_validation.sh  (or)
##   <godot> --headless --path godot res://tests/headless_test.tscn

var _count: int = 0
var _failures: Array[String] = []

class DummySavable:
	var value: int = 0
	func get_save_data() -> Dictionary:
		return {"value": value}
	func load_save_data(d: Dictionary) -> void:
		value = int(d.get("value", 0))

func _ready() -> void:
	_run()
	print("\n==== HEADLESS TEST SUMMARY ====")
	print("checks: %d   failures: %d" % [_count, _failures.size()])
	for f in _failures:
		print("  FAIL: ", f)
	var code := 0 if _failures.is_empty() else 1
	print("RESULT: %s" % ("PASS" if code == 0 else "FAIL"))
	get_tree().quit(code)

func _check(cond: bool, label: String) -> void:
	_count += 1
	if cond:
		print("  ok   ", label)
	else:
		_failures.append(label)
		print("  FAIL ", label)

func _run() -> void:
	_test_item_registry()
	_test_inventory()
	_test_item_instance_roundtrip()
	_test_time_blocks()
	_test_graphics_presets()
	_test_settings_persistence()
	_test_save_roundtrip()
	_test_interactable_verbs()
	_test_game_input()
	_test_lighting_profiles()
	_test_lighting_controller()
	_test_weather()
	_test_materials()

func _test_item_registry() -> void:
	_check(ItemRegistry.has_definition(&"fish"), "ItemRegistry has fish")
	_check(ItemRegistry.has_definition(&"rice"), "ItemRegistry has rice")
	_check(ItemRegistry.has_definition(&"egg"), "ItemRegistry has egg")
	var rice := ItemRegistry.get_definition(&"rice")
	_check(rice != null and rice.display_name == "Rice", "rice display name")
	_check(rice != null and rice.stack_size == 50, "rice stack size 50")
	_check(not ItemRegistry.has_definition(&"nonexistent"), "unknown id rejected")

func _test_inventory() -> void:
	var inv := PlayerInventory.new()
	add_child(inv)
	inv.add_item(&"rice", 30)
	inv.add_item(&"rice", 40)  # 70 total, stack 50 -> 50 + 20
	_check(inv.total_of(&"rice") == 70, "inventory rice total 70")
	_check(inv.slot_count() == 2, "inventory rice in 2 stacks")
	inv.add_item(&"fish", 2)
	_check(inv.slot_count() == 3, "inventory fish adds a slot")
	var removed := inv.remove_item(&"rice", 65)
	_check(removed, "remove_item reports success")
	_check(inv.total_of(&"rice") == 5, "inventory rice 5 after remove")
	# save/restore inventory
	var data := inv.get_save_data()
	var inv2 := PlayerInventory.new()
	add_child(inv2)
	inv2.load_save_data(data)
	_check(inv2.total_of(&"rice") == 5 and inv2.total_of(&"fish") == 2, "inventory save/load roundtrip")
	inv.queue_free()
	inv2.queue_free()

func _test_item_instance_roundtrip() -> void:
	var a := ItemInstance.new(&"egg", 7)
	var b := ItemInstance.from_dict(a.to_dict())
	_check(b.definition_id == &"egg" and b.quantity == 7, "ItemInstance dict roundtrip")

func _test_time_blocks() -> void:
	_check(TimeManager.block_name(TimeManager.block_for_minute(0)) == "Night", "00:00 -> Night")
	_check(TimeManager.block_name(TimeManager.block_for_minute(8 * 60)) == "Morning", "08:00 -> Morning")
	_check(TimeManager.block_name(TimeManager.block_for_minute(13 * 60)) == "Afternoon", "13:00 -> Afternoon")
	_check(TimeManager.block_name(TimeManager.block_for_minute(19 * 60)) == "Evening", "19:00 -> Evening")
	_check(TimeManager.block_name(TimeManager.block_for_minute(23 * 60)) == "Night", "23:00 -> Night")
	_check(TimeManager.clock_string() != "", "clock string non-empty")

func _test_graphics_presets() -> void:
	for preset in ["LOW", "MEDIUM", "HIGH", "ULTRA"]:
		Settings.graphics_preset = preset
		var p := GraphicsManager.get_params()
		_check(p.has("shadows") and p.has("view_distance") and p.has("scale_3d"),
			"%s preset has expected params" % preset)
	Settings.graphics_preset = "LOW"
	_check(GraphicsManager.get_params()["shadows"] == false, "LOW disables shadows")
	Settings.graphics_preset = "HIGH"
	_check(GraphicsManager.get_params()["shadows"] == true, "HIGH enables shadows")
	Settings.graphics_preset = "bogus"
	_check(GraphicsManager.preset_name() == "MEDIUM", "invalid preset falls back to MEDIUM")
	Settings.graphics_preset = "MEDIUM"

func _test_settings_persistence() -> void:
	Settings.fov = 88.0
	Settings.save_settings()
	_check(FileAccess.file_exists(Settings.PATH), "settings file written")
	var file := FileAccess.open(Settings.PATH, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_check(typeof(parsed) == TYPE_DICTIONARY and absf(float(parsed["fov"]) - 88.0) < 0.01,
		"fov persisted to disk")
	Settings.fov = 10.0
	Settings.load_settings()
	_check(absf(Settings.fov - 88.0) < 0.01, "load_settings restores fov")

func _test_save_roundtrip() -> void:
	var dummy := DummySavable.new()
	SaveManager.register_savable("dummy_test", dummy)
	dummy.value = 42
	_check(SaveManager.save_game(), "SaveManager.save_game succeeds")
	dummy.value = 0
	_check(SaveManager.load_game(), "SaveManager.load_game succeeds")
	_check(dummy.value == 42, "save/load roundtrip restores value")
	SaveManager.unregister_savable("dummy_test")

func _test_interactable_verbs() -> void:
	var pk := PickupItem.new()
	pk.item_id = &"fish"
	_check(pk.get_interaction_verb(null) == "PICK UP", "pickup verb")
	var dr := Door.new()
	_check(dr.get_interaction_verb(null) == "OPEN", "door verb (closed)")
	dr.is_open = true
	_check(dr.get_interaction_verb(null) == "CLOSE", "door verb (open)")
	var entry := LocationEntryPoint.new()
	_check(entry.get_interaction_verb(null) == "ENTER", "entry verb")
	pk.free()
	dr.free()
	entry.free()

func _test_game_input() -> void:
	# latch / consume edge action (the touch interact-button path)
	GameInput.latch_action("interact")
	_check(GameInput.consume_action("interact") == true, "latched action consumed once")
	_check(GameInput.consume_action("interact") == false, "latch cleared after consume")
	# held action (touch sprint button)
	GameInput.set_touch_held("sprint", true)
	_check(GameInput.is_held("sprint") == true, "touch held sprint on")
	GameInput.set_touch_held("sprint", false)
	_check(GameInput.is_held("sprint") == false, "touch held sprint off")
	# touch move feeds the abstract move vector (forward = -y)
	GameInput.set_touch_move(Vector2(0.0, -1.0))
	_check(GameInput.get_move_vector().y < -0.5, "touch move forward")
	GameInput.set_touch_move(Vector2.ZERO)
	_check(GameInput.get_move_vector().length() < 0.01, "touch move cleared")

## M2.2 — the pure lighting-profile logic (no GPU needed). Proves resolution
## and the readability/restraint invariants; it CANNOT prove beauty — that is
## the on-device test (M2.2_LIGHTING_DESIGN.md §0/§13).
func _test_lighting_profiles() -> void:
	var ext_floor := LightingProfile.EXTERIOR_MIN_AMBIENT
	var int_floor := LightingProfile.INTERIOR_MIN_AMBIENT

	# Night is never black, but the sun is a low non-zero moon fill.
	var night := LightingProfile.exterior_at(1350)
	_check(night.ambient_energy >= ext_floor, "exterior night ambient >= floor")
	_check(night.sun_energy > 0.0 and night.sun_energy < 0.4, "night sun is a low non-zero fill")
	var deep := LightingProfile.exterior_at(150)
	_check(deep.ambient_energy >= ext_floor, "deep-night ambient >= floor")

	# Evening reads warmer than midday (warmth = red - blue in the sun color).
	var evening := LightingProfile.exterior_at(1110)
	var midday := LightingProfile.exterior_at(720)
	_check((evening.sun_color.r - evening.sun_color.b) > (midday.sun_color.r - midday.sun_color.b),
		"evening sun warmer than midday")

	# Continuity across a keyframe boundary (no abrupt jump).
	var a := LightingProfile.exterior_at(715)
	var b := LightingProfile.exterior_at(725)
	_check(absf(a.ambient_energy - b.ambient_energy) < 0.05, "exterior lighting continuous near midday")

	# Interior baseline: readable and warmer than the exterior night.
	var inight := LightingProfile.interior_at(1350)
	_check(inight.ambient_energy >= int_floor, "interior night ambient >= interior floor")
	_check(inight.ambient_color.r > night.ambient_color.r, "interior warmer than exterior at night")
	var iday := LightingProfile.interior_at(720)
	_check(iday.ambient_energy >= int_floor, "interior day ambient >= interior floor")

	# Category modifiers are restrained (character, not a color grade): the
	# ambient nudge stays within ~10% and never drops below the floor.
	var base_day := LightingProfile.resolve(720, false, &"", 0.0)
	for cat in ["residential", "commercial", "natural", "water", "landmark", "threshold", "interior"]:
		var r := LightingProfile.resolve(720, false, StringName(cat), 0.0)
		var delta := absf(r.ambient_energy - base_day.ambient_energy) / base_day.ambient_energy
		_check(delta <= 0.10, "category '%s' ambient nudge <= 10%%" % cat)
		_check(r.ambient_energy >= ext_floor, "category '%s' still >= floor" % cat)

	# Mystery is a sparse local modifier: slightly cooler + slightly dimmer,
	# but still clamped above the readability floor. Never darkens to black.
	var m0 := LightingProfile.resolve(720, false, &"", 0.0)
	var m1 := LightingProfile.resolve(720, false, &"", 1.0)
	_check(m1.ambient_energy <= m0.ambient_energy, "mystery dims slightly")
	_check(m1.ambient_energy >= ext_floor, "mystery still >= floor")
	_check((m1.ambient_color.b - m1.ambient_color.r) > (m0.ambient_color.b - m0.ambient_color.r),
		"mystery shifts cooler, not warmer/red")

## M2.2 — the controller applies the resolved profile to a sun + environment
## and, crucially, leaves every GraphicsManager-owned property untouched
## (M2.2_LIGHTING_DESIGN.md §7).
func _test_lighting_controller() -> void:
	var sun := DirectionalLight3D.new()
	var env := Environment.new()
	var ctrl := RegionLightingController.new()
	ctrl.setup(sun, env, null, null)
	add_child(ctrl)  # _ready connects signals + applies once

	# Sentinels on the GraphicsManager-owned properties — must survive apply.
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 42.0
	env.fog_enabled = true
	env.fog_density = 0.5
	env.glow_enabled = true
	env.ssao_enabled = true

	# Exterior night: readable ambient, low non-zero sun.
	ctrl._interior = false
	ctrl._category = &""
	ctrl._mystery = 0.0
	ctrl.apply_for_minute(1350)
	var ext_energy := env.ambient_light_energy
	_check(ext_energy >= LightingProfile.EXTERIOR_MIN_AMBIENT, "controller exterior night readable")
	_check(sun.light_energy > 0.0, "controller sets a non-zero sun fill")

	# Interior context uses its own, higher floor — independent of exterior.
	ctrl._interior = true
	ctrl.apply_for_minute(1350)
	_check(env.ambient_light_energy >= LightingProfile.INTERIOR_MIN_AMBIENT,
		"controller interior night warm/readable")
	_check(env.ambient_light_energy > ext_energy, "interior brighter than exterior night")

	# Graphics-owned properties were NOT touched by the controller.
	_check(sun.shadow_enabled == true, "controller leaves shadow_enabled alone")
	_check(absf(sun.directional_shadow_max_distance - 42.0) < 0.01, "controller leaves shadow distance alone")
	_check(env.fog_enabled == true, "controller leaves fog_enabled alone")
	_check(absf(env.fog_density - 0.5) < 0.01, "controller leaves fog_density alone")
	_check(env.glow_enabled == true, "controller leaves glow_enabled alone")
	_check(env.ssao_enabled == true, "controller leaves ssao_enabled alone")

	ctrl.queue_free()
	sun.free()

## M2.3 — weather data, determinism, save/load, the lighting fold (CLEAR is
## identity; rain/mist stay readable), FX gating, and ownership (weather never
## touches GraphicsManager-owned properties). On-device is still the real gate.
func _test_weather() -> void:
	# Deterministic rolls: identical seed -> identical sequence.
	var r1 := RandomNumberGenerator.new()
	r1.seed = 12345
	var r2 := RandomNumberGenerator.new()
	r2.seed = 12345
	var seq1: Array = []
	var seq2: Array = []
	for i in 20:
		seq1.append(WeatherTypes.roll(r1))
		seq2.append(WeatherTypes.roll(r2))
	_check(seq1 == seq2, "weather roll deterministic for same seed")

	# Clear-dominant distribution (~55%).
	var rng := RandomNumberGenerator.new()
	rng.seed = 999
	var clear := 0
	for i in 400:
		if WeatherTypes.roll(rng) == WeatherTypes.State.CLEAR:
			clear += 1
	_check(clear > 160, "weather is clear-dominant")
	_check(WeatherTypes.state_name(WeatherTypes.State.LIGHT_RAIN) == "Light Rain", "weather state name")

	# CLEAR weather is identity — the M2.2 look is preserved exactly.
	var base := LightingProfile.resolve(720, false, &"", 0.0)
	var clear_mod := WeatherTypes.light_mod(WeatherTypes.State.CLEAR)
	var withclear := LightingProfile.resolve(720, false, &"", 0.0, clear_mod, 1.0)
	_check(absf(base.ambient_energy - withclear.ambient_energy) < 0.0001
		and base.sun_color.is_equal_approx(withclear.sun_color), "CLEAR weather is identity")

	# Rain desaturates + darkens, but stays >= readability floor (day AND night).
	var rain_mod := WeatherTypes.light_mod(WeatherTypes.State.LIGHT_RAIN)
	var rainy := LightingProfile.resolve(720, false, &"", 0.0, rain_mod, 1.0)
	_check(rainy.ambient_energy <= base.ambient_energy, "rain darkens vs clear day")
	_check(rainy.ambient_energy >= LightingProfile.EXTERIOR_MIN_AMBIENT, "rain day still >= floor")
	_check(absf(rainy.sun_color.r - rainy.sun_color.b) <= absf(base.sun_color.r - base.sun_color.b),
		"rain desaturates")
	var rainy_night := LightingProfile.resolve(1350, false, &"", 0.0, rain_mod, 1.0)
	_check(rainy_night.ambient_energy >= LightingProfile.EXTERIOR_MIN_AMBIENT, "rain night still navigable")

	# Modifier blend interpolates.
	var mid := WeatherTypes.blend_mod(clear_mod, rain_mod, 0.5)
	_check(absf(mid.darken - rain_mod.darken * 0.5) < 0.0001, "blend_mod interpolates")

	# FX gating: on outdoors above LOW; off on LOW; off indoors.
	_check(WeatherFX.allow_fx(1.0, false) == true, "FX allowed HIGH exterior")
	_check(WeatherFX.allow_fx(0.4, false) == false, "FX off on LOW effects tier")
	_check(WeatherFX.allow_fx(1.0, true) == false, "FX off indoors")
	_check(WeatherTypes.fx_spec(WeatherTypes.State.LIGHT_RAIN).rain > 0.0, "rain state emits rain FX")
	_check(WeatherTypes.fx_spec(WeatherTypes.State.CLEAR).rain == 0.0, "clear state has no rain FX")

	# WeatherManager save/load round-trip + backward-compatible default.
	var wsave := WeatherManager.get_save_data()
	WeatherManager.state = WeatherTypes.State.MIST
	WeatherManager.wind = 0.9
	var saved := WeatherManager.get_save_data()
	WeatherManager.load_save_data(saved)
	_check(WeatherManager.state == WeatherTypes.State.MIST and absf(WeatherManager.wind - 0.9) < 0.01,
		"weather save/load roundtrip")
	WeatherManager.load_save_data({})
	_check(WeatherManager.state == WeatherTypes.State.CLEAR, "empty save -> CLEAR default")

	# Ownership: the controller applies weather but leaves GraphicsManager-owned
	# properties (fog_density, shadows) untouched, and stays readable.
	var sun := DirectionalLight3D.new()
	var env := Environment.new()
	var ctrl := RegionLightingController.new()
	ctrl.setup(sun, env, null, null)
	add_child(ctrl)
	env.fog_density = 0.5
	sun.shadow_enabled = true
	WeatherManager.state = WeatherTypes.State.LIGHT_RAIN
	ctrl._snap_weather()
	ctrl._interior = false
	ctrl.apply_for_minute(720)
	_check(absf(env.fog_density - 0.5) < 0.01, "weather does not touch fog_density")
	_check(sun.shadow_enabled == true, "weather does not touch shadow_enabled")
	_check(env.ambient_light_energy >= LightingProfile.EXTERIOR_MIN_AMBIENT, "rainy day readable via controller")
	ctrl.queue_free()
	sun.free()

	WeatherManager.load_save_data(wsave)  # restore

## M2.4-A — the shared material library: sharing/identity, tuning, and the
## arbitrary-colour cache. On-device is the real gate for whether the tuned
## materials + M2.2 lighting make the greybox beautiful.
func _test_materials() -> void:
	var a := MaterialLibrary.get_mat(&"wall_wood_warm")
	var b := MaterialLibrary.get_mat(&"wall_wood_warm")
	_check(a == b, "material library shares one instance per key")
	_check(a != null and a is StandardMaterial3D, "named material is a StandardMaterial3D")

	var water := MaterialLibrary.get_mat(&"water")
	var ground := MaterialLibrary.get_mat(&"ground")
	_check(water.roughness < ground.roughness, "water glossier than ground")
	_check(water.roughness < 0.3, "water roughness tuned low for sun sparkle")

	var wood := MaterialLibrary.get_mat(&"wood_dark")
	_check(wood.metallic == 0.0, "village wood is non-metallic")

	var fallback := MaterialLibrary.get_mat(&"does_not_exist")
	_check(fallback != null and fallback is StandardMaterial3D, "unknown key returns a safe fallback")

	# Arbitrary-colour cache: shared per colour, distinct across colours, tuned.
	var c1 := MaterialLibrary.tuned_color(Color(0.40, 0.32, 0.24))
	var c2 := MaterialLibrary.tuned_color(Color(0.40, 0.32, 0.24))
	_check(c1 == c2, "tuned_color shares one instance per colour")
	var c3 := MaterialLibrary.tuned_color(Color(0.10, 0.20, 0.30))
	_check(c1 != c3, "tuned_color distinguishes colours")
	_check(absf(c1.roughness - 0.9) < 0.001 and c1.metallic == 0.0, "tuned_color applies tuning")
