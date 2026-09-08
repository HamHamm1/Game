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
	_test_vegetation()
	_test_house_kit()
	_test_glb_houses()
	_test_grass_chunked()
	_test_terrain()
	_test_props()
	_test_only_glb_vegetation()

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

## M2.4-B — vegetation: density scaling, deterministic placement, LOD, shared
## meshes/materials, ownership. On-device is the real gate for composition.
func _test_vegetation() -> void:
	# Density math scales with the vegetation intent.
	_check(VegetationField.target_count(100, 1.0) == 100, "veg count full at intent 1.0")
	_check(VegetationField.target_count(100, 0.4) == 40, "veg count scaled at LOW intent")
	_check(VegetationField.target_count(100, 0.0) == 0, "veg count zero at intent 0")

	# Shared species mesh (one Mesh reused across fields).
	_check(VegetationKit.mesh(&"grass") == VegetationKit.mesh(&"grass"), "veg mesh shared per species")

	# Grass is a base-anchored low-poly tuft (custom ArrayMesh), not a spike.
	var gmesh := VegetationKit.mesh(&"grass")
	_check(gmesh is ArrayMesh, "grass mesh is a custom tuft (ArrayMesh)")
	_check(gmesh.get_surface_count() >= 1 and gmesh.surface_get_array_len(0) >= 30,
		"grass tuft has multiple blades")

	# GROUNDING — Y is derived from the ground representation, never floated.
	_check(GroundSampler.height_at(12.3, -4.5) == GroundSampler.GROUND_Y, "ground sampler returns the flat ground height")
	var no_excl: Array[Rect2] = []
	# Base-anchored species (grass, offset 0) sit exactly on the ground (y≈0).
	var g := VegetationField.compute_transforms(Vector3.ZERO, 5.0, 5.0, 60, 4242, 0.9, 1.3, 0.0, no_excl)
	var grounded := true
	for t in g:
		if absf(t.origin.y - GroundSampler.height_at(t.origin.x, t.origin.z)) > 0.001:
			grounded = false
	_check(grounded, "base-anchored vegetation rests on the ground (no float/sink)")
	# Centre-origin species rest on the surface by their ground_offset*scale.
	var sh := VegetationField.compute_transforms(Vector3.ZERO, 5.0, 5.0, 40, 55, 1.0, 1.0, 0.40, no_excl)
	_check(sh.size() > 0 and absf(sh[0].origin.y - 0.40) < 0.001, "offset species rest on the surface, not sunk")
	_check(VegetationKit.ground_offset(&"grass") == 0.0 and VegetationKit.ground_offset(&"shrub") > 0.0,
		"ground offsets: grass base-anchored, shrub lifted")

	# Deterministic placement: same params -> identical.
	var p1 := VegetationField.compute_transforms(Vector3.ZERO, 5.0, 5.0, 80, 4242, 0.8, 1.2, 0.0, no_excl)
	var p2 := VegetationField.compute_transforms(Vector3.ZERO, 5.0, 5.0, 80, 4242, 0.8, 1.2, 0.0, no_excl)
	_check(p1.size() == 80, "veg fills all candidates when unmasked")
	_check(p1.size() == p2.size() and p1[0].origin.is_equal_approx(p2[0].origin), "veg placement deterministic")

	# Exclusion masking: nothing is PLACED in water/road/doorway/building zones.
	var excl: Array[Rect2] = [Rect2(-3.0, -3.0, 6.0, 6.0)]
	var masked := VegetationField.compute_transforms(Vector3.ZERO, 6.0, 6.0, 220, 7777, 0.8, 1.2, 0.0, excl)
	var inside := 0
	for t in masked:
		if excl[0].has_point(Vector2(t.origin.x, t.origin.z)):
			inside += 1
	_check(inside == 0, "no vegetation placed inside an exclusion zone")
	var full := VegetationField.compute_transforms(Vector3.ZERO, 6.0, 6.0, 220, 7777, 0.8, 1.2, 0.0, no_excl)
	_check(masked.size() > 0 and masked.size() < full.size(), "exclusion removes some placements, keeps the rest")
	var masked2 := VegetationField.compute_transforms(Vector3.ZERO, 6.0, 6.0, 220, 7777, 0.8, 1.2, 0.0, excl)
	_check(masked.size() == masked2.size(), "excluded placement remains deterministic")

	# Vegetation materials carry per-instance/vertex colour variation.
	_check(MaterialLibrary.get_mat(&"grass_blade").vertex_color_use_as_albedo, "grass material accepts colour variation")
	_check(MaterialLibrary.get_mat(&"flower_vcol").vertex_color_use_as_albedo, "flower material uses vertex colours")

	# LOD tiering via view distance: LOW < HIGH < ULTRA (ULTRA shows veg farther).
	Settings.graphics_preset = "LOW"
	var lod_low := VegetationField.lod_scale()
	Settings.graphics_preset = "HIGH"
	var lod_high := VegetationField.lod_scale()
	Settings.graphics_preset = "ULTRA"
	var lod_ultra := VegetationField.lod_scale()
	_check(lod_low < lod_high and lod_high < lod_ultra, "LOD range scales LOW < HIGH < ULTRA")

	# Field node: density responds to preset; LOD range + shared material + colours.
	Settings.graphics_preset = "HIGH"
	var high_field := VegetationField.scatter(&"grass", &"grass_blade", Vector3.ZERO, 5.0, 5.0, 80, 4242, 0.9, 1.3, 45.0)
	_check(high_field.multimesh.instance_count > 0, "veg field populated at HIGH")
	_check(high_field.multimesh.use_colors, "veg field enables per-instance colour")
	_check(high_field.visibility_range_end > 0.0, "veg field has an LOD cull range")
	_check(high_field.material_override == MaterialLibrary.get_mat(&"grass_blade"), "veg field uses the shared material")
	Settings.graphics_preset = "LOW"
	var low_field := VegetationField.scatter(&"grass", &"grass_blade", Vector3.ZERO, 5.0, 5.0, 80, 4242, 0.9, 1.3, 45.0)
	_check(low_field.multimesh.instance_count < high_field.multimesh.instance_count, "LOW preset thins vegetation")

	high_field.free()
	low_field.free()
	Settings.graphics_preset = "MEDIUM"

## M2.4-B — modular Japanese house kit: controlled variation, simple (box)
## collision never the render mesh, the EXISTING entry system wired for
## enterable houses, and a cheaper collision-free LOD background tier.
## On-device is the real gate for how the houses LOOK.
func _test_house_kit() -> void:
	var c := JapaneseHouseKit.house_c()
	var d := JapaneseHouseKit.house_d()
	var e := JapaneseHouseKit.house_e()
	var f := JapaneseHouseKit.house_f()
	# Archetypes are genuinely distinct architecture, not one mesh rescaled.
	_check(c.roof == &"hipped" and e.roof == &"gable" and d.roof == &"shallow",
		"archetypes vary roof type (hipped/gable/shallow)")
	_check(d.width > f.width and f.width > e.width and e.width >= c.width - 0.1,
		"archetypes vary footprint width")
	_check(e.roof_key == &"roof_thatch" and c.roof_key == &"roof_tile",
		"archetypes vary roof material (thatch vs tile)")
	_check(d.engawa and not c.engawa and f.side_ext,
		"archetypes vary features (engawa / side extension)")

	# Enterable build: ONE box collider (never the render mesh) + a wired entry.
	var enter := JapaneseHouseKit.build(c, "res://src/world/locations/house_interior_wood.tscn", "Enter")
	var bodies := _nodes_of(enter, "StaticBody3D")
	var box_cols := 0
	for b in bodies:
		for cs in _nodes_of(b, "CollisionShape3D"):
			if (cs as CollisionShape3D).shape is BoxShape3D:
				box_cols += 1
	_check(box_cols >= 1, "kit house uses simple BoxShape3D collision")
	var main := enter.get_node_or_null("Collision")
	_check(main != null and main is StaticBody3D, "kit house has one dedicated body-collider")
	var entries := _find_entries(enter)
	_check(entries.size() == 1, "enterable kit house wires exactly one LocationEntryPoint")
	if entries.size() == 1:
		var ep := entries[0] as LocationEntryPoint
		_check(ep.location_scene.ends_with("house_interior_wood.tscn"), "entry points at the interior scene")
		_check(ep.spawn_name == "PlayerSpawn", "entry targets the PlayerSpawn marker")
		_check(ep.get_parent() is StaticBody3D, "entry sits on a collidable door (raycast-reachable)")
	enter.free()

	# Optional (non-enterable) build: collidable, but NO entry point.
	var solid := JapaneseHouseKit.build(c, "")
	_check(_find_entries(solid).size() == 0, "optional kit house has no entry point")
	_check(_nodes_of(solid, "StaticBody3D").size() >= 1, "optional kit house still collides")
	solid.free()

	# Background tier: NO collision, meshes carry a visibility-range LOD.
	var bg := JapaneseHouseKit.background_house(e, 300.0)
	_check(_nodes_of(bg, "StaticBody3D").is_empty(), "background house has no collision")
	var meshes := _nodes_of(bg, "MeshInstance3D")
	var lodded := meshes.size() > 0
	for m in meshes:
		if (m as MeshInstance3D).visibility_range_end <= 0.0:
			lodded = false
	_check(lodded, "background house meshes have a visibility-range LOD")
	bg.free()

	# The interior it enters into exposes a spawn + an exit (round trip closes).
	var interior := (load("res://src/world/locations/house_interior_wood.tscn") as PackedScene).instantiate()
	add_child(interior)
	_check(interior.find_child("PlayerSpawn", true, false) != null, "interior has a PlayerSpawn")
	_check(_nodes_of(interior, "LocationExitPoint").size() == 1, "interior has one LocationExitPoint")
	interior.free()

## M2.4-B — the real GLB houses (2 hero + 3 imported village models, staged as 9
## instances): each must use mesh-derived COMPOUND box collision (never one
## sealing box, never the render mesh), and every enterable one wires exactly one
## INVISIBLE entry point (no door-slab mesh) through the existing entry system.
## Guards the device-reported "floating door slab" regression. Visual door-vs-
## mesh alignment is confirmed separately by the offscreen debug-overlay render.
func _test_glb_houses() -> void:
	var region := (load("res://src/world/regions/hero_village.tscn") as PackedScene).instantiate()
	add_child(region)
	# M2.4-C: the terrain provider must be active while the region is loaded so the
	# vegetation grounds on the terrain.
	_check(GroundSampler.has_height_provider(), "terrain ground provider active while region loaded")
	# Houses are the region children carrying an entry point (terrain + water are
	# also non-primitive meshes, so detect by the entry, not by mesh type).
	var houses: Array = []
	for child in region.get_children():
		if child is Node3D and _find_entries(child).size() > 0:
			houses.append(child)
	_check(houses.size() == 8, "region stages 8 real GLB houses (A-H)")
	var enterable := 0
	for house in houses:
		var entries := _find_entries(house)
		_check(entries.size() == 1, "every GLB house has exactly one entry point")
		if entries.size() == 1:
			enterable += 1
			var ep := entries[0] as LocationEntryPoint
			var trigger := (ep as Node).get_parent()
			_check(trigger is StaticBody3D, "GLB entry sits on a collidable (raycast-reachable) body")
			_check(_nodes_of(trigger, "MeshInstance3D").is_empty(),
				"GLB entry trigger is INVISIBLE (no door-slab mesh)")
			_check(ep.location_scene.ends_with("house_interior_wood.tscn"), "entry points at the shared interior")
		# Compound collision: several simple box bodies, never a single sealing box.
		var bodies := _nodes_of(house, "StaticBody3D")
		var box_bodies := 0
		for b in bodies:
			for cs in _nodes_of(b, "CollisionShape3D"):
				if (cs as CollisionShape3D).shape is BoxShape3D:
					box_bodies += 1
		_check(box_bodies >= 5, "GLB house has a compound wall collider (>=5 simple boxes)")
		# The render mesh itself carries no collision.
		for mi in _nodes_of(house, "MeshInstance3D"):
			_check(_nodes_of(mi, "StaticBody3D").is_empty(), "GLB render mesh is not used as collision")
	_check(enterable == 8, "EVERY GLB house (A-H) is enterable")
	# Grounding: each house sits exactly on its levelled terrain pad (no float/sink).
	var grounded := true
	for e in region.HOUSE_LAYOUT:
		var center: Vector3 = region._house_center(e[0], e[1], e[2])
		var expected := GroundSampler.height_at(center.x, center.z)
		var best := 999.0
		for house in houses:
			var hp: Vector3 = (house as Node3D).position
			if Vector2(hp.x, hp.z).distance_to(Vector2((e[1] as Vector3).x, (e[1] as Vector3).z)) < 0.5:
				best = minf(best, absf(hp.y - expected))
		if best > 0.02:
			grounded = false
	_check(grounded, "every house is grounded on its terrain pad")
	region.free()
	_check(not GroundSampler.has_height_provider(), "terrain provider cleared when region unloads")

## M2.4-B — grass is CHUNKED (many tiles), not one big field, so it can't pop in
## and out as a unit; each tile carries an overlapping visibility-range fade.
func _test_grass_chunked() -> void:
	var excl: Array[Rect2] = []
	var tiles := VegetationField.scatter_tiled(&"grass", &"grass_blade",
		-20.0, -20.0, 20.0, 20.0, 12.0, 0.4, 99, 0.8, 1.3, 60.0, excl)
	add_child(tiles)
	var mmis := _nodes_of(tiles, "MultiMeshInstance3D")
	_check(mmis.size() >= 4, "grass is split into multiple chunk tiles")
	var faded := mmis.size() > 0
	for m in mmis:
		var mmi := m as MultiMeshInstance3D
		if mmi.visibility_range_end <= 0.0 or mmi.visibility_range_end_margin < mmi.visibility_range_end * 0.4:
			faded = false
	_check(faded, "each grass tile has a large overlapping fade margin")
	tiles.free()

## M2.4-C — terrain height field: deterministic, level building pads (so houses
## stay grounded), a carved stream channel, and the GroundSampler provider seam.
func _test_terrain() -> void:
	var t := TerrainField.new()
	var pads := [{"center": Vector2(5.0, 5.0), "radius": 6.0}]
	var stream := PackedVector2Array([Vector2(-24.0, 0.0), Vector2(-4.0, 2.0), Vector2(16.0, 0.0)])
	t.configure(pads, stream)
	_check(t.height_at(3.1, 2.2) == t.height_at(3.1, 2.2), "terrain height is deterministic")
	# Building pad is flat/level within its radius (no tilt under a house).
	var pc := t.height_at(5.0, 5.0)
	_check(absf(t.height_at(6.4, 4.6) - pc) < 0.0005, "building pad is flat/level")
	# The stream carves a real channel: its bed sits below the water surface and
	# below the nearby banks.
	var bed := t.height_at(-4.0, 2.0)      # a point on the stream centreline
	var bank := t.height_at(-4.0, 12.0)    # ~10 m off the stream
	_check(bed < TerrainField.WATER_Y - 0.2, "stream bed sits below the water surface")
	_check(bank > bed + 0.3, "stream is a depression below the surrounding banks")
	_check(TerrainField.WATER_Y < 0.0, "water surface sits below the bank height")
	# GroundSampler provider round-trips and reverts to flat.
	GroundSampler.set_height_provider(t.height_at)
	_check(absf(GroundSampler.height_at(5.0, 5.0) - pc) < 0.0005, "GroundSampler uses the terrain provider")
	GroundSampler.clear_height_provider()
	_check(GroundSampler.height_at(5.0, 5.0) == GroundSampler.GROUND_Y, "GroundSampler reverts to flat when cleared")

	# TerrainBuilder output guards (would have caught the device bugs):
	var body := TerrainBuilder.build(t, -10.0, -10.0, 10.0, 10.0, 2.0)
	var mesh: MeshInstance3D = null
	var heightmap := false
	for c in body.get_children():
		if c is MeshInstance3D:
			mesh = c
		if c is CollisionShape3D and (c as CollisionShape3D).shape is HeightMapShape3D:
			heightmap = true
	_check(mesh != null, "terrain builder produces a visual mesh")
	_check(heightmap, "terrain has a HeightMapShape3D collider")
	if mesh != null:
		var sm := mesh.material_override as StandardMaterial3D
		# The ground must be TEXTURED, never a bare white/near-white albedo (the
		# device "white ground" regression).
		_check(sm != null and sm.albedo_texture != null, "terrain ground is textured (not a flat white material)")
		# Triangles must present their front face UPWARD, or the terrain is
		# back-face culled and the player sees the sky through it (the real cause of
		# the device "white ground"). Godot front faces are CLOCKWISE, so a
		# front-face-up triangle's CCW-order cross product points DOWN (-Y).
		var arr := (mesh.mesh as ArrayMesh).surface_get_arrays(0)
		var vs := arr[Mesh.ARRAY_VERTEX] as PackedVector3Array
		var idx := arr[Mesh.ARRAY_INDEX] as PackedInt32Array
		var geo_n := (vs[idx[1]] - vs[idx[0]]).cross(vs[idx[2]] - vs[idx[0]])
		_check(geo_n.y < 0.0, "terrain front face points up (not back-face culled)")
		# Shading normals also point up (correct lighting).
		var ns := arr[Mesh.ARRAY_NORMAL] as PackedVector3Array
		var up := ns.size() > 0
		for n in ns:
			if n.y <= 0.0:
				up = false
		_check(up, "terrain shading normals point up")
	body.free()

## M2.4-C dressing — PropKit grounds a prop's base to local y=0 (so the caller
## drops it onto the terrain, no floating/sinking), shares mesh data via the
## resource cache, and adds simple collision only when asked.
func _test_props() -> void:
	var n := PropKit.make(PropKit.BENCH, 0.85, "box")
	add_child(n)
	var min_y := 1.0e9
	for m in _nodes_of(n, "MeshInstance3D"):
		var a: AABB = (m as MeshInstance3D).global_transform * (m as MeshInstance3D).get_aabb()
		min_y = minf(min_y, a.position.y)
	_check(absf(min_y) < 0.05, "prop base sits at local y=0 (ready to ground)")
	_check(_nodes_of(n, "StaticBody3D").size() >= 1, "prop 'box' collision adds a static body")
	n.free()
	var deco := PropKit.make(PropKit.FLOWER_SHRUB, 0.6, "")
	add_child(deco)
	_check(_nodes_of(deco, "StaticBody3D").is_empty(), "decorative prop has no collision")
	deco.free()
	# Shared source: two instances of the same prop reference the same PackedScene.
	_check(load(PropKit.BENCH) == load(PropKit.BENCH), "prop GLB is shared via the resource cache")
	_check(PropKit.footprint(PropKit.BRIDGE, 2.6).x > 3.0, "prop footprint scales with the size")

## M2.4-D — hero_village must dress its vegetation + rocks with ONLY the seven
## owner-supplied GLBs. Guards the "randomly-scattered primitive placeholder"
## regression: the booted region must contain NO SphereMesh (the old sphere-blob
## trees + bank rocks) and NO MultiMeshInstance3D (the old VegetationField grass/
## fern/flower/shrub fields), while the real vegetation GLBs are all present.
func _test_only_glb_vegetation() -> void:
	# Every approved vegetation/rock GLB imports and carries a real (imported,
	# non-primitive) mesh.
	var veg := [PropKit.SAKURA_LARGE, PropKit.SAKURA_SMALL, PropKit.GRASS_CLUMP,
		PropKit.FLOWERS, PropKit.RIVER_ROCKS, PropKit.PINE, PropKit.PATH_ROCKS]
	for path in veg:
		var packed := load(path) as PackedScene
		_check(packed != null, "veg GLB loads: %s" % path.get_file())
		if packed != null:
			var inst := packed.instantiate()
			_check(_has_complex_mesh(inst), "veg GLB has an imported mesh: %s" % path.get_file())
			inst.free()
	var region := (load("res://src/world/regions/hero_village.tscn") as PackedScene).instantiate()
	add_child(region)
	var spheres := 0
	var multimeshes := 0
	for d in _descendants(region):
		if d is MeshInstance3D and (d as MeshInstance3D).mesh is SphereMesh:
			spheres += 1
		if d is MultiMeshInstance3D:
			multimeshes += 1
	_check(spheres == 0, "no SphereMesh primitives (old blob trees / bank rocks) in the region")
	_check(multimeshes == 0, "no MultiMeshInstance3D (old procedural vegetation field) in the region")
	# The real vegetation is actually placed: plenty of imported meshes beyond the
	# eight houses (trees, grass, flowers, rocks are all imported GLB instances).
	var complex := 0
	for d in _descendants(region):
		if d is MeshInstance3D:
			var m := (d as MeshInstance3D).mesh
			if m != null and not (m is PrimitiveMesh):
				complex += 1
	_check(complex >= 30, "region stages many imported vegetation/prop GLB instances (>=30)")
	region.free()

## True if the subtree holds a MeshInstance3D with a non-primitive (imported)
## mesh — i.e. a hero GLB, as opposed to the kit's BoxMesh/PrismMesh primitives.
func _has_complex_mesh(n: Node) -> bool:
	for d in _descendants(n):
		if d is MeshInstance3D:
			var mesh := (d as MeshInstance3D).mesh
			if mesh != null and not (mesh is PrimitiveMesh):
				return true
	return false

## Recursively collect descendants whose class matches `type_name` (built-in or
## a project class_name).
func _nodes_of(root: Node, type_name: String) -> Array:
	var out: Array = []
	for n in _descendants(root):
		if n.is_class(type_name) or (n.get_script() != null and _script_is(n, type_name)):
			out.append(n)
	return out

func _script_is(n: Node, type_name: String) -> bool:
	var s := n.get_script() as Script
	return s != null and s.get_global_name() == StringName(type_name)

func _find_entries(root: Node) -> Array:
	var out: Array = []
	for n in _descendants(root):
		if n is LocationEntryPoint:
			out.append(n)
	return out

func _descendants(n: Node) -> Array:
	var out: Array = [n]
	for c in n.get_children():
		out.append_array(_descendants(c))
	return out
