shader_type spatial;
// M2.4-D.4 — 8-texture ground blend for the hero-village terrain. Each vertex
// carries eight normalized zone weights (COLOR.rgba = grass/dry/gravel/moist,
// CUSTOM0.rgba = farming/leaves/river-rock/path-rock). The fragment blends the
// eight world-planar-tiled albedos by those weights, so natural material zones
// (paths, riverbanks, gardens, forest edge…) melt into each other with no hard
// square patches. Mobile-friendly: plain albedo blend, world-planar UVs baked in
// the vertex stage, no triplanar.
render_mode diffuse_burley, specular_disabled;

uniform sampler2D tex_grass : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_dry : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_gravel : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_moist : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_farming : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_leaves : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_river : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_path : source_color, filter_linear_mipmap, repeat_enable;

varying vec2 world_uv;   // world XZ, for planar tiling
varying vec4 w_hi;       // CUSTOM0: farming, leaves, river, path

void vertex() {
	world_uv = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
	w_hi = CUSTOM0;
}

// tiles (metres per texture repeat) per slot — finer for grass/soil, coarser for
// the rocky/leaf textures so they don't look busy.
void fragment() {
	vec4 wl = COLOR;                 // grass, dry, gravel, moist
	vec4 wh = w_hi;                  // farming, leaves, river, path
	float total = wl.r + wl.g + wl.b + wl.a + wh.r + wh.g + wh.b + wh.a;
	if (total < 0.0001) { wl.r = 1.0; total = 1.0; }
	float inv = 1.0 / total;

	vec3 c = vec3(0.0);
	c += texture(tex_grass,   world_uv * 0.42).rgb * (wl.r * inv);
	c += texture(tex_dry,     world_uv * 0.34).rgb * (wl.g * inv);
	c += texture(tex_gravel,  world_uv * 0.34).rgb * (wl.b * inv);
	c += texture(tex_moist,   world_uv * 0.34).rgb * (wl.a * inv);
	c += texture(tex_farming, world_uv * 0.40).rgb * (wh.r * inv);
	c += texture(tex_leaves,  world_uv * 0.30).rgb * (wh.g * inv);
	c += texture(tex_river,   world_uv * 0.28).rgb * (wh.b * inv);
	c += texture(tex_path,    world_uv * 0.26).rgb * (wh.a * inv);

	ALBEDO = c;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
}
