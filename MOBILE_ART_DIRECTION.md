# MOBILE_ART_DIRECTION.md

# MOBILE-FIRST VISUAL ART DIRECTION

## 0. DOCUMENT PURPOSE

This document defines the visual direction and technical art constraints for the game.

The game is a **first-person open-world RPG designed primarily for Android phones**.

The visual goal is:

> A beautiful, atmospheric, intimate first-person world with the warm, eerie, nostalgic environmental feeling of a Japanese bathhouse/folk-horror game, while remaining technically achievable on mobile.

Do NOT copy any copyrighted game's assets, characters, environments, logos, textures, maps, or exact visual designs.

The target is an original visual identity inspired by the general qualities of:
- Japanese traditional architecture
- quiet rural environments
- bathhouses and inns
- warm interior lighting
- mysterious nighttime atmosphere
- nostalgic low-key horror
- dense environmental storytelling
- cinematic first-person exploration

The art direction must be original.

---

# 1. CORE VISUAL PRINCIPLE

The game should look expensive without being computationally expensive.

Prioritize:

1. Composition
2. Lighting
3. Materials
4. Color harmony
5. Atmosphere
6. Environmental storytelling
7. Selective geometric detail
8. High-quality silhouettes
9. Sound-supported visual mood
10. Performance

Do NOT attempt to achieve visual quality primarily through:

- extreme polygon counts
- excessive texture resolution
- many dynamic lights
- expensive real-time reflections
- heavy post-processing
- unnecessarily complex shaders

The visual identity should come from **art direction**, not brute-force rendering.

---

# 2. TARGET EXPERIENCE

The player should feel:

- physically present inside the environment
- curious about what is around the next corner
- comfortable in warm spaces
- slightly uneasy in empty spaces
- attracted to distant lights
- able to understand locations from visual landmarks
- surrounded by believable everyday objects
- immersed in a lived-in world

The environment should feel like it existed before the player arrived.

Avoid generic "game level" appearance.

---

# 3. VISUAL IDENTITY

The visual identity should combine:

### Warmth

- amber lamps
- warm wood
- soft indirect light
- steam
- paper screens
- warm food
- cozy interiors

### Mystery

- deep shadows
- fog
- silhouettes
- partially obscured paths
- distant lights
- quiet empty spaces
- subtle environmental anomalies

### Nostalgia

- aged wood
- faded paint
- worn stone
- old signage
- traditional furniture
- slightly imperfect materials

### Natural Beauty

- rain
- moss
- wet stone
- trees
- grass
- water
- mountains
- small gardens
- changing sky

---

# 4. CAMERA

The game uses first-person perspective.

## Recommended FOV

Start around:

- 70–80 degrees horizontal-equivalent depending on engine configuration

Expose a player setting for FOV.

Avoid extreme FOV because it can:

- distort environments
- reduce visual quality
- increase perceived motion
- make mobile first-person controls uncomfortable

---

# 5. CAMERA MOVEMENT

First-person camera movement must be comfortable on phones.

Use restrained:

- head bob
- camera sway
- acceleration
- camera shake

Provide settings:

- Camera Sensitivity
- Camera Smoothing
- Head Bob Strength
- Camera Shake Strength
- FOV

Default settings should prioritize comfort.

---

# 6. COMPOSITION

Every important location should have a recognizable visual composition.

Use:

- foreground framing
- midground landmarks
- background silhouettes
- leading lines
- light sources as navigation anchors
- strong vertical elements
- doorways
- bridges
- lanterns
- trees
- rooflines
- mountains

The player should naturally understand:

"That is the inn."

"That light is the restaurant."

"That bridge leads to the village."

without requiring a UI marker for every location.

---

# 7. VISUAL LANDMARKS

Each major area must have one or more visual landmarks.

Examples:

- tall bathhouse roof
- large red bridge
- shrine gate
- glowing restaurant
- waterfall
- old cedar tree
- mountain silhouette
- bell tower
- distinctive lantern line

Landmarks should be visible from multiple locations when appropriate.

---

# 8. ENVIRONMENTAL STORYTELLING

Objects should communicate information.

Instead of:

"NPC works here."

Show:

- tools
- unfinished work
- ingredients
- dirty dishes
- notes
- clothing
- storage boxes
- furniture arrangement
- footprints
- lighting
- personal objects

Instead of:

"This place is abandoned."

Show:

- dust
- weeds
- broken objects
- faded signs
- stopped clocks
- missing furniture
- damaged paper screens
- water stains

---

# 9. MATERIAL LANGUAGE

Materials should be visually distinct.

Important materials:

- wood
- stone
- ceramic
- metal
- paper
- cloth
- glass
- water
- wet surfaces
- moss
- soil
- painted surfaces

Avoid making everything equally shiny.

---

# 10. ROUGHNESS

Use roughness variation to create visual richness.

Examples:

Freshly polished wood:
- moderate roughness

Old wood:
- high roughness
- uneven response

Wet stone:
- lower roughness
- controlled reflection

Ceramic:
- medium/low roughness

Paper:
- high roughness

Metal:
- controlled metallic response

Do not rely on expensive reflections to communicate materials.

---

# 11. WOOD

Wood is a major visual material.

Use:

- simple but believable grain
- color variation
- edge wear
- dirt accumulation
- water staining
- age variation

Do not use a single wood material across the entire game.

Create several material variants:

- new wood
- old wood
- wet wood
- painted wood
- dark interior wood
- sun-faded wood

---

# 12. STONE

Stone should communicate age and environment.

Use:

- moss
- dirt
- cracks
- wetness
- edge wear
- color variation

Avoid excessive geometry for small cracks.

Use normal/detail maps selectively.

---

# 13. WATER

Water is visually important but technically expensive.

Prefer:

- simple materials
- controlled reflections
- scrolling normal/detail effects where affordable
- baked surroundings
- limited real-time reflection

Avoid expensive planar reflections everywhere.

Use special reflection techniques only for hero locations.

---

# 14. STEAM

Steam is a major atmospheric element.

Use lightweight effects.

Possible approaches:

- transparent particle systems
- simple soft sprites
- low-density volumetric-like tricks
- animated planes
- localized fog

Do not cover the entire scene with expensive volumetric fog.

Steam should be concentrated around:

- baths
- hot food
- kitchens
- pipes
- vents
- warm water
- rainy environments

---

# 15. FOG

Fog is an important part of the art direction.

Use fog to:

- hide distant low-detail geometry
- create depth
- improve atmosphere
- reduce visible draw distance
- support mood
- reduce mobile rendering workload

Fog should be art-directed rather than simply maxed out.

Different areas may use:

- clear daytime fog
- humid bathhouse fog
- rainy fog
- night mist
- mountain haze
- mysterious supernatural mist

---

# 16. LIGHTING PHILOSOPHY

Lighting is one of the highest-priority visual systems.

Prefer:

- baked lighting
- static lighting
- carefully selected dynamic lights
- emissive materials
- controlled ambient lighting

Dynamic lights should be reserved for important elements.

Examples:

- lanterns
- candles
- fireplaces
- important NPCs
- interactive objects

Do not place dozens of expensive dynamic lights in every room.

---

# 17. LIGHTING HIERARCHY

Each scene should have:

### Primary Light

Sun, moon, or major artificial source.

### Secondary Light

Interior lamps, lanterns, windows.

### Accent Light

Small lights that attract attention.

### Ambient Light

World/environment illumination.

The player should visually understand what matters.

---

# 18. COLOR PALETTE

Do not use one global color grade for the entire game.

Use location-specific palettes.

Example:

## Village Day

- muted greens
- warm wood
- pale sky
- natural stone

## Village Night

- deep blue environment
- warm amber windows
- dark wood
- subtle moonlight

## Bathhouse

- warm amber
- dark wood
- cream paper
- muted red accents
- blue-green water

## Forest

- deep greens
- cool shadows
- soft mist
- warm distant lights

## Mystery Areas

- reduced saturation
- cool shadows
- selective warm highlights
- deeper contrast

---

# 19. CONTRAST

Use contrast intentionally.

Important objects should be readable.

Examples:

A warm lantern against a dark blue night.

A bright doorway at the end of a dark hallway.

A character silhouette against steam.

A red umbrella in a muted rainy environment.

Do not make every object highly contrasted.

---

# 20. NIGHT SCENES

Night should not simply mean:

"make everything black."

Use:

- moonlight
- ambient sky light
- warm windows
- lantern pools
- reflections on wet surfaces
- silhouettes
- fog

The player must remain able to navigate.

---

# 21. RAIN

Rain is an important atmospheric tool.

Use layered effects:

### Layer 1

Simple rain particles.

### Layer 2

Wet surface material response.

### Layer 3

Puddles in selected areas.

### Layer 4

Mist/atmosphere.

### Layer 5

Sound and environmental animation.

Do not use maximum particle density everywhere.

---

# 22. VEGETATION

Vegetation must be optimized for mobile.

Use:

- low-cost meshes
- cards/impostors where appropriate
- LOD
- grouped instances
- distance-based rendering
- simplified shaders

Use high-detail vegetation only near the player.

Far vegetation should be visually dense but geometrically cheap.

---

# 23. TREES

Hero trees may use higher detail.

Normal trees should use optimized meshes.

Distant trees should use:

- simplified meshes
- billboards
- impostors where appropriate

Avoid rendering hundreds of high-poly trees at full detail.

---

# 24. GRASS

Grass should prioritize visual density over individual blade quality.

Prefer:

- instancing
- grass cards
- clustered meshes
- distance fading

Avoid thousands of individually expensive meshes.

---

# 25. BUILDINGS

Buildings should use modular construction.

Create reusable modules:

- wall
- floor
- roof
- window
- door
- beam
- pillar
- stairs
- balcony
- fence

This allows the world to look rich without creating every building from scratch.

---

# 26. INTERIORS

Interiors should receive more visual detail than distant exteriors.

Priority:

1. Player interaction area
2. Main visual landmarks
3. NPC areas
4. Gameplay objects
5. Background decoration

Do not fully detail rooms the player cannot access.

---

# 27. HERO ASSETS

Hero assets receive the highest quality.

Examples:

- main bathhouse
- player's home
- major restaurant
- important shrine
- romance locations
- major quest locations

Hero assets may use:

- higher texture resolution
- more geometry
- more material variation
- more lighting detail

But they must still respect mobile budgets.

---

# 28. LOD POLICY

Every major 3D asset should consider LOD.

Suggested:

LOD0:
Close range.

LOD1:
Medium range.

LOD2:
Far range.

LOD3:
Very far / impostor where useful.

Do not create LODs blindly.

Profile actual performance.

---

# 29. TEXTURE BUDGET

Use texture resolution based on importance.

Suggested starting point:

Hero assets:
2048 where justified.

Normal gameplay assets:
1024.

Small/background assets:
512 or lower.

Tiny props:
256–512.

These are starting targets, not absolute rules.

Use texture atlases where appropriate.

Avoid unnecessarily unique 2K/4K textures for tiny objects.

---

# 30. TEXTURE REUSE

Use material libraries.

Examples:

Wood library
Stone library
Roof library
Paper library
Metal library
Cloth library
Ceramic library

Reuse materials with controlled variation.

This reduces memory usage and improves consistency.

---

# 31. SHADERS

Prefer simple shaders.

Avoid expensive custom shaders unless they produce significant visual value.

Every custom shader must have a reason.

When possible provide:

HIGH QUALITY
and
MOBILE QUALITY

variants.

---

# 32. POST-PROCESSING

Use post-processing carefully.

Possible effects:

- subtle color grading
- ambient occlusion if affordable
- bloom
- vignette
- subtle depth effects

Avoid stacking many expensive effects.

Disable unnecessary effects on low-end settings.

---

# 33. REFLECTIONS

Reflections should be selective.

Priority:

1. Hero water
2. Important wet surfaces
3. Special cinematic moments

Do not use expensive real-time reflections on every surface.

---

# 34. SHADOWS

Shadows create atmosphere but are expensive.

Prefer:

- baked shadows
- limited dynamic shadows
- appropriate shadow distance
- lower shadow resolution on low settings

Important characters may receive dynamic shadows.

Distant objects should not require expensive shadow rendering.

---

# 35. INTERACTION DISTANCE

Use visual quality based on player distance.

Example:

0–5 m:
Full quality.

5–15 m:
Normal quality.

15–40 m:
Reduced detail.

40 m+:
LOD/fog/background representation.

Actual distances must be tuned through profiling and world scale.

---

# 36. OPEN-WORLD STREAMING

The world should be divided into streaming regions.

Example:

WORLD
├── Village
├── Bathhouse
├── Forest
├── Mountain
├── Shrine
├── River
└── Outskirts

Only relevant regions should be fully loaded.

Streaming must avoid noticeable popping where possible.

Use:

- fog
- occlusion
- terrain
- buildings
- natural barriers
- scene transitions

to hide loading boundaries.

---

# 37. INTERIOR STREAMING

Large interiors should be separate scenes/resources when practical.

Entering a building may:

- load interior
- unload unnecessary exterior detail
- reduce active NPC simulation
- reduce rendering workload

The player should experience this as seamless as practical.

---

# 38. NPC VISUAL QUALITY

NPCs are important because the game is relationship-focused.

Near NPCs should have:

- readable faces
- expressive animation
- good silhouettes
- believable clothing
- appropriate lighting

Far NPCs should use simplified rendering.

---

# 39. NPC CLOTHING

Clothing should communicate:

- occupation
- personality
- social role
- location
- season
- time period/style

Avoid overly complex cloth simulation.

Prefer authored animations and simple secondary motion.

---

# 40. FACE QUALITY

Faces are high-value assets.

Prioritize:

- eyes
- eyebrows
- mouth
- silhouette
- skin material
- lighting

Use lightweight facial animation where possible.

Do not depend on expensive real-time facial simulation.

---

# 41. FIRST-PERSON HANDS

Hands and held objects are high-priority first-person assets.

They should receive:

- clean silhouette
- appropriate lighting
- consistent style
- readable interaction animations

Only the visible first-person assets require the highest quality.

---

# 42. FOOD

Food is a major feature of the game.

Food should be visually appealing.

Prioritize:

- silhouette
- color
- steam
- plating
- ingredient readability
- close-up presentation

Cooking scenes may temporarily increase visual quality around the player.

Use hero food models only for important dishes.

---

# 43. COOKING VISUALS

Cooking stations should contain:

- ingredients
- utensils
- pots
- bowls
- cutting boards
- steam
- fire/heat
- water
- surfaces showing wear

The player should visually understand the cooking process.

---

# 44. UI ART DIRECTION

The UI should complement the world.

Use:

- restrained colors
- soft transparency
- readable typography
- subtle borders
- warm accents
- minimal clutter

Do not make the UI look like a generic mobile application.

The game world remains the primary visual focus.

---

# 45. MOBILE UI

Touch targets must be large enough for comfortable use.

Important actions should be accessible without precision tapping.

Avoid placing critical buttons near areas commonly affected by:

- device navigation gestures
- screen edges
- keyboard
- notches
- camera cutouts

Support safe areas.

---

# 46. UI PERFORMANCE

Avoid excessive animated UI.

Avoid:

- huge blur layers
- multiple translucent full-screen panels
- unnecessary particles
- heavy UI shaders

Keep menus responsive.

---

# 47. AUDIO-VISUAL RELATIONSHIP

Visual atmosphere should work with sound.

Examples:

Rain:
- visible rain
- wet surfaces
- mist
- distant light
- rain sound

Bathhouse:
- steam
- warm light
- water reflections
- wooden surfaces
- water ambience

Forest:
- foliage
- fog
- shafts of light
- insects
- wind

The art team and audio system should coordinate environmental mood.

---

# 48. HORROR / MYSTERY

The game should favor psychological atmosphere over constant visual horror.

Use:

- empty spaces
- unusual silhouettes
- distant movement
- unexpected lights
- environmental inconsistencies
- subtle changes
- sounds without obvious sources
- familiar places becoming slightly unfamiliar

Avoid constant jump scares.

---

# 49. SUPERNATURAL VISUALS

Supernatural effects should be rare and meaningful.

Prefer subtle effects:

- impossible shadows
- distorted reflections
- unusual fog
- objects slightly out of place
- unnatural movement
- strange lighting
- brief environmental changes

Avoid excessive particles and flashy effects.

---

# 50. PERFORMANCE TIERS

Provide at least:

## LOW

- low shadow quality
- reduced vegetation
- reduced particles
- shorter view distance
- reduced reflections
- simplified post-processing

## MEDIUM

Balanced default target.

## HIGH

Higher:

- shadows
- vegetation
- view distance
- particles
- texture quality
- effects

## ULTRA

Optional for high-end devices.

Do not assume ULTRA is necessary.

---

# 51. GRAPHICS SETTINGS

Expose settings for:

- quality preset
- resolution scale if supported
- texture quality
- shadow quality
- view distance
- vegetation density
- effects quality
- reflection quality
- post-processing
- FOV
- camera shake
- head bob

Allow settings to be saved.

---

# 52. PERFORMANCE TEST SCENES

Create dedicated performance test scenes.

Required tests:

### TEST_A_VILLAGE

Many buildings and NPCs.

### TEST_B_FOREST

Vegetation-heavy environment.

### TEST_C_BATHHOUSE

Interior lighting, water, steam.

### TEST_D_RAIN

Particles + wet surfaces + atmosphere.

### TEST_E_NIGHT

Lighting + shadows + fog.

### TEST_F_NPC_CROWD

Multiple NPCs with different simulation levels.

These scenes are for profiling and optimization.

---

# 53. MOBILE PERFORMANCE BUDGET

Treat budgets as targets, not excuses.

Track:

- frame time
- FPS
- CPU time
- GPU time
- draw calls
- visible objects
- triangles
- texture memory
- RAM
- loading time

Set actual budgets after testing representative target devices.

Do not invent a universal polygon or draw-call limit without profiling.

---

# 54. ART REVIEW CHECKLIST

Every major environment should be reviewed for:

### Composition

Does the area have a clear visual identity?

### Lighting

Does light guide attention?

### Materials

Are materials distinguishable?

### Scale

Does the environment feel believable?

### Storytelling

Does the environment communicate history?

### Performance

Can it run on the target Android device?

### Navigation

Can the player understand where to go without excessive markers?

### Mobile Readability

Does it remain visually clear on a small screen?

---

# 55. AI ART / ASSET GENERATION RULES

AI-generated assets may be used during development, but they must be cleaned, optimized, and integrated consistently.

Generated assets must not:

- contain watermarks
- contain accidental text
- contain logos
- contain copyrighted characters
- copy recognizable existing game assets
- introduce inconsistent art styles

AI-generated concept art is not automatically production-ready.

Production assets must be:

- optimized
- correctly scaled
- correctly UV-mapped
- appropriately textured
- LOD-ready
- collision-ready where necessary
- mobile-tested

---

# 56. ORIGINALITY REQUIREMENT

The game may be inspired by broad aesthetic qualities such as:

- Japanese bathhouses
- rural Japan
- folklore
- nostalgic horror
- cozy interiors
- mysterious nighttime exploration

But it must NOT directly reproduce:

- another game's map
- another game's characters
- another game's exact architecture
- another game's UI
- another game's unique props
- another game's textures
- another game's branding
- another game's distinctive compositions

Create an original world and visual identity.

---

# 57. DEVELOPMENT WORKFLOW

For every major location:

1. Block out geometry.
2. Test player scale.
3. Test first-person camera.
4. Establish lighting.
5. Establish color palette.
6. Add major landmarks.
7. Add hero assets.
8. Add medium-detail props.
9. Add environmental storytelling.
10. Add vegetation.
11. Add atmosphere.
12. Add NPCs.
13. Profile performance.
14. Create LODs/optimization.
15. Test on Android.
16. Only then add final polish.

---

# 58. DO NOT POLISH TOO EARLY

Do not spend significant time creating:

- 4K textures
- complex shaders
- expensive effects
- detailed props

before:

- player scale is correct
- lighting direction is correct
- world composition works
- gameplay flow works
- performance is acceptable

Blockout first.

Polish later.

---

# 59. VISUAL PRIORITY

When development time is limited, prioritize:

1. Main locations
2. NPC faces
3. First-person hands
4. Lighting
5. Food
6. Hero props
7. Major landmarks
8. Atmosphere
9. Background detail

Do not spend production time making tiny background objects perfect.

---

# 60. DEFINITION OF DONE

A visual area is NOT considered finished merely because it looks good in the editor.

It must also:

- work in first-person view
- be readable on a phone
- maintain target performance
- use appropriate LOD
- use reasonable texture memory
- have correct collision
- work with lighting
- work with mobile graphics presets
- survive scene loading/streaming
- remain visually coherent at different quality levels

---

# 61. AI DEVELOPER INSTRUCTIONS

When implementing visual systems:

DO NOT assume desktop hardware.

DO NOT add expensive rendering features merely because they look good in an editor screenshot.

Before introducing a visually expensive feature, answer:

1. What visual problem does it solve?
2. Can a cheaper technique achieve the same result?
3. What is the expected GPU cost?
4. What is the expected memory cost?
5. Can it be disabled on LOW settings?
6. Has it been profiled on Android?

If the answer is unknown, implement a simple version first and profile it.

---

# 62. PHASED ART IMPLEMENTATION

## PHASE 1 — Visual Foundation

- first-person camera
- lighting baseline
- material baseline
- fog
- sky
- mobile UI scale
- graphics settings

## PHASE 2 — World

- terrain
- village
- buildings
- vegetation
- water
- streaming

## PHASE 3 — Character

- player hands
- NPC models
- animations
- facial expressions

## PHASE 4 — Atmosphere

- rain
- steam
- environmental effects
- day/night
- weather

## PHASE 5 — Gameplay Presentation

- cooking presentation
- romance locations
- quest locations
- environmental storytelling

## PHASE 6 — Optimization

- profiling
- LOD
- texture optimization
- shader optimization
- streaming optimization
- low-end device testing

---

# 63. FINAL ART DIRECTION

The final game should feel like:

**A beautiful, quiet, mysterious Japanese-inspired world that the player can comfortably explore for hours on a phone.**

The goal is not maximum graphical complexity.

The goal is:

**maximum atmosphere per GPU millisecond.**

Every visual decision should support:

- immersion
- exploration
- character relationships
- cooking
- mystery
- atmosphere
- mobile performance

The game should be visually memorable because of its **lighting, composition, atmosphere, materials, and storytelling**, not because it uses the most expensive rendering technology available.
