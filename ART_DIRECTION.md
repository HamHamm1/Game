# ART_DIRECTION.md

> The **visual bible** — the identity, rules, and pipelines that keep the
> game looking like one coherent place. DESIGN.md §2 sets the intent; this
> document turns it into concrete, followable rules for materials,
> lighting, environment art, and the modular kit.
>
> Status: **Phase 0 design deliverable.** No final art exists. Prototyping
> uses primitives/blockouts deliberately (see §6); this document governs
> what replaces them. All shipped art must be **original** to this project
> (AI_RULES.md — Originality & Licensing). Nothing from any
> `reference_analysis/` project's assets is used.

---

## 1. Visual Identity

**One sentence:** *a warm, lived-in small town you could swear is real,
with a cold seam of wrongness running underneath it.*

**Reference for feel, not for copying** (DESIGN.md §2): *The Bathhouse* is
a mood/camera/environmental-storytelling reference only — no models,
textures, layouts, UI, or branding are taken from it. Our town, our
landmark, our lore are original.

**Three words to check every asset against:** **nostalgic ·
mysterious · lived-in.** If a prop, material, or lighting choice serves
none of these, it's decoration for its own sake — cut or rework it.

**The core contrast** the whole look is built around (DESIGN.md §2):

| Cozy / Safe | Mysterious |
|---|---|
| home, café, restaurant, kitchen, residential street, shop | abandoned wing, underground passage, closed-off bathhouse areas, night forest, hidden rooms |
| warm practical light, saturated but soft, readable | controlled contrast, cool ambient, fog/occlusion, unusual light behavior |
| clutter that reads as *someone lives here* | clutter that reads as *someone left in a hurry / something is off* |

The game is **not dark all the time** (DESIGN.md §2). Dread comes from
*wrongness in a place that should be safe*, not from constant darkness or
jump-scares. Most of the player's time is spent in the warm half.

---

## 2. Material System

A shared, reusable material library (DESIGN.md §2) so surfaces read
consistently everywhere and a new location doesn't reinvent "what wood
looks like here."

**Base materials to author (PBR):** wood · stone · ceramic · metal ·
glass · water · **wet floor / wet surface** · cloth · skin · food ·
vegetation.

**Rules:**
- **Imperfect by default.** Every base material carries subtle grunge,
  edge wear, and variation — clean/new is the exception a prop opts into,
  not the default. Perfectly uniform surfaces read as fake and kill the
  lived-in goal.
- **Wet-surface response is a first-class feature**, not an afterthought:
  rain (GAME_SYSTEMS.md §2) and the bathhouse-inspired landmark both need
  believable wet floors, puddles, and the darkened/roughness-shifted look
  of damp materials. Author a dry↔wet control into relevant materials from
  the start.
- **Emissive & local light** materials (signs, lamps, cooktops, screens)
  are part of the set — the world is lit partly by its own objects (§3).
- **Reflection approximation** (reflection probes / screen-space, not
  full mirrors everywhere) for wet floors, glass, ceramic — enough to sell
  the surface, budgeted per §7.
- **Instance variation over unique textures:** tint/roughness/wear
  variation per instance so the same wood plank or ceramic tile doesn't
  visibly repeat. This keeps texture memory down (§7) while defeating the
  "tiled" look.

---

## 3. Lighting & Color

**No single global palette** (DESIGN.md §2). Lighting is organized into
**zones/profiles** driven by two axes:

**Axis A — time of day** (from TimeManager, GAME_SYSTEMS.md §1):

| Time | Character |
|---|---|
| Day | brighter, warm, readable; soft indirect fill |
| Evening | warm practical lights dominate, long shadows, strongest atmosphere |
| Night | low-key, cool ambient, isolated warm pools around practical lights |

**Axis B — location category:**

| Category | Character |
|---|---|
| Safe / cozy | warm, higher ambient floor, gentle contrast, inviting |
| Mystery | controlled contrast, cooler, fog/occlusion, an ambient floor that can behave *wrong* (a light that shouldn't be on, a shadow too deep) |

**A lighting profile = (time block × location category)** → target
ambient color/energy, fog settings, and practical-light behavior. A
`RegionLightingController` (one per loaded region, ARCHITECTURE.md §10)
lerps toward the current profile as time/weather change. **Weather**
(GAME_SYSTEMS.md §2) is a modifier on top: overcast flattens, rain darkens
+ wets, fog raises the ambient floor and cuts distance.

**Why zones, not a hand-lit whole game:** a lighting artist or an AI
contributor can drop in a new interior by tagging it *cozy* or *mystery*
and get a coherent look for free (DESIGN.md §2, AI_RULES.md Rule 4 — this
is the art-side version of "content is data").

**Baked vs. dynamic (DESIGN.md §5 visual quality):**
- **Bake** static indirect lighting where geometry and lights are static
  (most interiors) — cheaper, softer, better GI.
- **Dynamic** for anything that moves or changes: the player's context,
  day/night sun, flickering practicals, mystery events.
- **Volumetric-looking fog** (fog volumes / a fog pass) for steam, mist,
  and the mystery seam — a signature element, especially around water/
  steam in the bathhouse-inspired landmark.

**Color discipline:** warmth vs. coolness is the primary storytelling
lever. Push saturation in cozy zones; pull it and cool it in mystery
zones. Avoid a muddy middle everywhere — contrast *between* zones is what
makes each read.

---

## 4. Environment Art & Set Dressing

**The believability rule (DESIGN.md §2):** *the player should believe real
people live here.* Every location carries small human traces — objects
not quite aligned, used tools, a pair of shoes, folded cloth, a stray box,
signage, containers, stains, water, steam, a bit of litter, personal
décor. A room that is tidy and empty has failed.

**Storytelling through dressing:** cozy clutter says *inhabited and
cared-for*; mystery clutter says *interrupted, abandoned, or wrong*. The
same object language, recomposed, carries the tonal contrast (§1).

**Scale & first-person framing:** everything is authored for an eye-level
first-person camera (DESIGN.md §2, ARCHITECTURE.md §4). Doorways, counters,
seats, and props must feel right at human height and interaction distance
— check assets in first person, not from a top-down editor view.

---

## 5. Modular Kit

Once a space passes prototyping (§6), it is built from a **modular kit**,
not one-off geometry (DESIGN.md §2, master-prompt §34), so new locations
can be assembled quickly and consistently:

- **Architectural modules:** walls, floors, ceilings, doors, windows,
  stairs — on a shared grid so pieces snap and swap.
- **Fixtures:** lighting fixtures, signage, counters, shelving.
- **Furniture & props:** tables, chairs, beds, containers, kitchen
  equipment, decorative props — many reused across locations with
  per-instance material variation (§2).
- **Vegetation & nature:** trees, plants, ground cover, water/river
  pieces for the forest/river/park.

**Why a kit:** it is the environment-art parallel to the code
architecture's "add content without touching core" goal — a new building
is a new *arrangement* of existing, well-lit, well-materialed pieces, not
a from-scratch art task. The bathhouse-inspired landmark and any hero
space may add bespoke hero pieces on top of the kit, but sit on the same
kit foundation.

---

## 6. Prototype → Production Pipeline

Explicit, so "it's just a blockout" never becomes the shipped look, and so
we don't polish art before the space even works (DESIGN.md §2,
master-prompt §33–34):

1. **Blockout (primitives).** Grey-box the space with primitives to test
   layout, scale, first-person movement, camera, sightlines, and
   interaction placement. Ugly on purpose. **Do not build the whole world
   at this stage** — one street + one building + one interior + one
   kitchen + one NPC room + one mystery space first (DESIGN.md §3,
   TECHNICAL_ROADMAP.md Phase 1–2).
2. **Lighting & material pass.** Apply the lighting profile (§3) and base
   materials (§2). If the space doesn't read/feel right *now*, fix it
   before adding detail — **do not expand the world until the vertical
   slice looks right** (master-prompt §33).
3. **Kit replacement.** Swap primitives for modular kit pieces (§5).
4. **Set dressing.** Add the human-trace layer (§4).
5. **Polish.** VFX (steam, fog, particles), audio zone hookup
   (AUDIO_DIRECTION.md), final light tuning, performance pass (§7).

A space is not "art-complete" until step 5; report it honestly with the
status vocabulary — `NEEDS ART`, `NEEDS TESTING`, etc. (AI_RULES.md Rule
11).

---

## 7. Performance-Aware Art (budgets, not premature optimization)

Architecture must not foreclose optimization, but we **don't optimize
before profiling** (master-prompt §35, ARCHITECTURE.md §3). Art-side
practices that are cheap to follow from the start and hard to retrofit:

- **Modular, instanced geometry** (§5) → fewer unique meshes, better
  batching/instancing, lower memory.
- **Per-instance material variation** (§2) instead of many unique textures
  → texture-memory control.
- **Bake static lighting** (§3) → fewer realtime lights.
- **Shadow-caster proxy meshes** for expensive hero geometry — a low-poly
  proxy casts shadows while the detailed mesh renders (the one idea worth
  keeping from `reference_analysis/godot-open-world-demo.md`).
- **LOD & occlusion friendliness:** author hero props with LOD in mind;
  lay out interiors so rooms occlude each other (the region/location split,
  ARCHITECTURE.md §3, already helps — interiors are separate scenes).
- **Fog does double duty:** the atmospheric fog (§3) also limits draw
  distance in mystery zones, which is a performance win, not just a mood
  one.

Actual budgets (tris, texture sizes, light counts, draw calls) are set
against a target platform in TECHNICAL_ROADMAP.md once there's something
to profile — not guessed here.

---

## 8. UI & HUD Look (brief)

Original UI (AI_RULES.md — nothing copied). Minimal, diegetic-leaning,
readable first-person: a subtle crosshair/interaction prompt
(GAME_SYSTEMS.md §3), unobtrusive need/time indicators, clean
inventory/relationship/quest panels. Full UI treatment is its own future
pass; the rule for now is that the HUD must not break the immersive,
lived-in framing — it stays quiet until the player needs it.

---

## 9. Originality checklist (before any art is committed)

- [ ] Is this asset **original** (or separately, explicitly cleared and
      attributed in-repo)? (AI_RULES.md)
- [ ] Does it serve at least one of **nostalgic / mysterious / lived-in**?
- [ ] Does it use the shared material library (§2) and read correctly
      under the relevant lighting profile (§3)?
- [ ] Is it a modular-kit piece or a justified hero piece (§5), not a
      throwaway one-off?
- [ ] Checked at eye level, first person, at interaction distance (§4)?
- [ ] No asset, texture, or design copied from any reference project?
