shader_type spatial;
// M2.4-C stream water — mobile-friendly (MOBILE_ART_DIRECTION §13): a few
// scrolling sine waves drive a procedural ripple normal for gentle movement +
// sun sparkle, with fresnel controlling transparency (clear looking down,
// deeper/reflective-looking at grazing angles). No planar reflection, no SSR, no
// textures — cheap enough for the Godot Mobile renderer.
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec4 shallow_color : source_color = vec4(0.36, 0.50, 0.54, 0.42);
uniform vec4 deep_color : source_color = vec4(0.16, 0.30, 0.36, 0.72);
uniform float flow_speed = 0.35;
uniform float wave_scale = 0.35;
uniform float wave_amp = 0.10;
uniform float water_roughness = 0.06;

void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float t = TIME * flow_speed;
	vec2 p = wp.xz * wave_scale;
	// Analytic gradient of a small sum-of-sines height field -> ripple normal.
	float dx = cos(p.x * 1.3 + t * 2.0) * 1.3 + cos((p.x + p.y) * 0.9 + t) * 0.9;
	float dz = cos(p.y * 1.1 - t * 1.6) * 1.1 + cos((p.x + p.y) * 0.9 + t) * 0.9;
	vec3 wn = normalize(vec3(-dx * wave_amp, 1.0, -dz * wave_amp));
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
	float fres = pow(1.0 - clamp(dot(normalize(-VERTEX), NORMAL), 0.0, 1.0), 3.0);
	ALBEDO = mix(shallow_color.rgb, deep_color.rgb, clamp(fres, 0.0, 1.0));
	ROUGHNESS = water_roughness;
	METALLIC = 0.0;
	SPECULAR = 0.6;
	ALPHA = mix(shallow_color.a, deep_color.a, fres);
}
