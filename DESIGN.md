# DESIGN.md — Project Aletheia (working title)
*First-Person Open-World RPG / Life Simulation*

> Status: **Foundational design document — Phase 0 (Research) deliverable.**
> No gameplay code has been written yet. This document defines what we are
> building and why, so that ARCHITECTURE.md and every system built afterward
> has a fixed target to build toward.

---

## 0. Relationship to the existing `game` repository

This repository currently contains **Spirit World MMORPG**, a 2D top-down
pixel-art browser MMORPG (Node.js + WebSocket + HTML5 Canvas, see the
previous README). That project is **being fully retired**, not extended.

Nothing in this document or in the eventual implementation reuses its code,
its assets, its server model, or its narrative (isekai academy / villainess
otome). The new project starts from an empty gameplay codebase, in a
different engine (Godot 4, see ARCHITECTURE.md §1), aimed at a different
genre (first-person 3D open-world life-sim, not 2D top-down multiplayer
MMORPG). The old code stays in the repository only until the new
foundation (Phase 1, see TECHNICAL_ROADMAP.md) is validated, at which
point it is removed in its own dedicated commit — never silently mixed
with the new codebase.

*A working title, "Project Aletheia," is used throughout this document
purely as a placeholder identifier — the real name is a future design
decision, not something to bikeshed now.*

> **Primary platform: Android / touch (mobile-first).** This was set as a
> standing requirement after the initial design docs were written — see
> **MOBILE_FIRST.md** (platform requirement) and **MOBILE_ART_DIRECTION.md**
> (visual/technical-art authority). Mobile is not a later port; it shapes
> input, UI, rendering, performance, and the AI-dialogue API design from the
> start. The foundation now includes a Phase 1b mobile layer (touch input
> behind abstract actions, settings, graphics presets, autosave/lifecycle) —
> `IMPLEMENTED`, pending in-editor and on-device validation. Where this
> document's PC-leaning phrasing conflicts with those two, they take
> precedence.

---

## 1. Game Vision

**Genre:** First-Person Open-World RPG + Life Simulation + Social/Romance +
Exploration + Cooking/Crafting + Light Horror/Mystery.

**Player fantasy:** *"I live here."* The player is not a tourist passing
through hand-built dioramas; they are a resident of a small town who works,
eats, cooks, makes friends, falls in love, and slowly uncovers that the
place is not entirely what it appears to be. Every system in this document
exists to reinforce that fantasy — a place that keeps existing whether or
not the player is looking at it.

**Core gameplay loop (early game):**

```
Wake up → check the day's plan (schedule, quests, weather)
   → go outside, walk to town (on foot, first person)
      → run errands: buy ingredients, do a job shift, talk to someone
         → return home / to a kitchen → cook using gathered ingredients
            → give food or gifts to NPCs → relationships shift
               → NPCs react, dialogue unlocks, quests advance
                  → time passes, day ends → sleep → save
```

Longer-arc loops layer on top of this daily loop: relationship progression
(stranger → romantic partner) across weeks of in-game time, quest chains
that unlock new areas, and a mystery thread that only advances through
noticing environmental detail and asking the right people the right
questions at the right time.

**What the player can do (target feature set, not all in the MVP):**
walk/sprint/crouch through an open town, enter buildings, talk to NPCs,
build relationships, complete quests, cook, gather/buy ingredients, collect
items, work a job, farm (future), fish (future), explore restricted/eerie
areas, find secrets, make dialogue choices that affect relationships and
the world state.

---

## 2. Visual Target & Direction

Visual and camera language take inspiration from *The Bathhouse* — mood,
first-person camera behavior, and environmental storytelling — as a
**reference for feel only**. No models, textures, character designs, UI,
level layouts, dialogue, story, sound, or branding are copied. We build an
original visual identity: our own town, our own characters, our own
bathhouse-inspired (not bathhouse-copied) landmark, our own lore.

**Camera:** first-person, eye-level, with subtle head bob, breathing sway,
footstep-synced motion, and contextual camera behavior (leaning to peek,
settling when interacting) — tuned conservatively to avoid motion
sickness. See ARCHITECTURE.md §4 for the technical breakdown into
independent, disable-able camera-effect modules.

**Atmosphere:** nostalgic, mysterious, lived-in. Every location contains
small human traces — misaligned objects, used tools, stains, personal
items — so the world reads as *inhabited*, not decorated. Cozy areas
(home, café, restaurant, residential streets) sit in explicit contrast to
mysterious areas (an abandoned wing, an underground passage, a closed-off
part of the bathhouse-inspired building, night forest). Horror, when it
appears, comes from **wrongness in a place that should be safe**, not from
scripted jump-scares as a default tool.

**Lighting philosophy:** no single global palette. Lighting is organized
into *zones* (see ARCHITECTURE.md §10) driven by time-of-day (day / evening
/ night) and location category (safe / mystery), each with its own target
mood, so a lighting artist or an AI contributor can add a new interior
without re-deriving the whole game's color philosophy from scratch.

**Materials & set dressing:** a shared material system (wood, stone,
ceramic, metal, glass, water/wet-surface, cloth, skin, food, vegetation)
and a modular prop/kit-based approach to environment art (detailed later
in ART_DIRECTION.md) — never one-off, throwaway, purely-primitive
blockouts once a space has passed prototyping.

---

## 3. World Design

The world is **semi-open**, built as a hub first, expanded later — never a
single monolithic scene. See ARCHITECTURE.md §3 for the technical scene
graph. The initial hub contains: a residential street, the player's home,
a restaurant, a small shop/convenience store, a park, one
bathhouse-inspired original landmark, an alley, a small forest edge, a
river/pond, a workshop, and a handful of NPC houses — enough for a
believable, walkable neighborhood, not a full city.

Every location is a separately loadable/unloadable scene (interiors
especially), so the hub can grow — new streets, a second district, farming
plots, a fishing dock — without ever requiring a rewrite of how "world" is
structured. New regions are additive, per ARCHITECTURE.md §3.

---

## 4. Systems Overview (design intent — technical shape lives in ARCHITECTURE.md)

### 4.1 Interaction
Every interactive thing in the world — door, NPC, chair, kitchen, chest,
plant, item, bed — implements one shared interaction contract
(`can_interact`, `get_interaction_prompt`, `interact`,
`get_interaction_priority`). The player controller never contains
per-object-type logic; it only ever calls that contract. This is what lets
new interactable object types be added without touching player code.

### 4.2 NPCs
NPCs are data-driven residents, not dialogue-tree props. Each NPC is
composed of: identity, stats, needs, a daily schedule, a relationship
state (with the player and potentially with each other), dialogue,
optional quest ties, inventory, navigation, animation, memory of past
interactions, and reactions to world events. Schedules are data
(time → location → activity), never hard-coded branching in an NPC
script, so a new NPC with a new daily routine is a data addition, not a
code change.

### 4.3 Relationships
Relationships are **multi-dimensional** (friendship, trust, affection,
respect, familiarity, compatibility), not a single "affection" counter,
and they move through discrete events (first meeting, conversation, gift,
shared meal, quest completion, conflict, apology, special event, date).
Romance is a slow arc — Stranger → Acquaintance → Friend → Close Friend →
Romantic Interest → Relationship — gated by accumulated shared history
(memories, gifts, activities, personal quests), never available on demand
from the first conversation.

### 4.4 Dialogue
Dialogue is data, not embedded strings in scripts. It supports branching,
conditions (relationship thresholds, quest state, time of day, location,
event flags, item possession) and consequences, so new branches are
authored as data and validated, not coded.

### 4.5 Cooking
Cooking is a first-class core system, not a minigame bolted on:
Ingredient → Recipe (with a required station, cook time, difficulty,
effects, sell price, NPC preferences) → CookingProcess → Dish, with a
quality tier (Poor → Perfect) driven by ingredient quality, timing, player
skill, and equipment. Dishes restore energy, can grant temporary buffs,
can move a relationship forward if the NPC likes that dish, and have a
sell value.

### 4.6 Inventory, Quests, Time, Weather, Audio, Save
- **Inventory** distinguishes item *definitions* (data) from item
  *instances* (state), and supports stackables, uniques, equipment,
  ingredients, quest items, gifts, and crafting materials.
- **Quests** carry explicit state (Locked/Available/Active/Completed/
  Failed), conditions, objectives, rewards, and consequences, and come in
  main/side/NPC/relationship/cooking/exploration/mystery flavors.
- **Time** drives a day built from Night/Morning/Afternoon/Evening/Night
  blocks that every other system (schedules, shops, lighting, weather,
  events) subscribes to rather than tracks independently.
- **Weather** (clear/cloudy/rain/heavy rain/fog/storm) affects lighting,
  audio, NPC behavior, visibility, and can gate events.
- **Audio** is organized into location-based ambience zones (town,
  kitchen, forest, mystery landmark, etc.) layered with footsteps,
  weather, and NPC chatter.
- **Save/load** is designed in from day one (not bolted on at the end) and
  must round-trip: player state, inventory, money, stats, relationships,
  quest states, dialogue flags, world flags, NPC states, time, weather,
  discovered locations, known recipes, and unlocked content.

---

## 5. Tone & Content Boundaries

The mystery/horror thread is meant to feel like an intrusion into an
otherwise warm, mundane life — a genre contrast, not a tonal default. It
should be possible to spend an entire play session doing nothing but
cooking, chatting, and exploring the cozy half of the map without ever
touching the unsettling material, and the reverse should also be true for
players who chase the mystery thread first.

---

## 6. Progression Philosophy

Progression is **systemic, not gated by levels-and-XP for its own sake**.
The player's capability grows through: relationships deepening (unlocking
dialogue, favors, companionship), recipes learned (unlocking better food
and NPC-specific gifts), quests completed (unlocking areas and story), and
light skill/equipment progression (RPG layer, Phase 5) that supports those
other systems rather than existing in isolation.

---

## 7. Success Criteria for This Design

This design is considered "foundation-ready" once it is possible to say
yes to all of the following (mirrors ARCHITECTURE.md §13's technical
criteria):

- A new NPC can be added as data without touching NPC core code.
- A new recipe can be added as data without touching the cooking engine.
- A new quest can be added as data without touching the quest engine.
- A new location can be added without touching world-loading core code.
- A new dialogue branch can be added without touching NPC code.
- A new save-able field can be added without rewriting the save system.
- Another developer or AI agent can read DESIGN.md + ARCHITECTURE.md and
  understand the intended shape of the project without reading the whole
  codebase first.

---

## 8. Reference Study — What Informed This Design

Per the project's originality rule (ARCHITECTURE.md §0, AI_RULES.md), the
following repositories were studied **for architecture and design
patterns only** — never for code, art, or content to copy. Full
per-repository findings, including explicit license terms and "do NOT
copy" lists, live in `reference_analysis/`:

| Repo | What it informed |
|---|---|
| `godot-open-rpg` | code/content split; narrow signal-bus autoloads over one god-object; the shape of our `Interactable` contract (proximity/gating/polymorphic execute) |
| `openacre` | Logic/View separation for NPCs & world entities; time-sliced background simulation; minimal autoload surface; a typed alternative to its duck-typed first-person raycast interaction — **GPLv3 code / CC BY-SA 4.0 assets, not reusable, architecture-only** |
| `3d-fpp-interaction-demo` | starting shape for a first-person Yaw/Pitch camera rig and forward-raycast interaction targeting; explicit anti-pattern (monolithic player script) to avoid |
| `gdquest-tps-demo` | player-as-orchestrator delegating to typed component nodes; decoupled "skin" animation layer exposing intent verbs; SpringArm-based camera collision handling |
| `godot-4-3d-characters` | the animation-façade pattern (verb-based API over an AnimationTree) for player and NPC animation — **CC-BY-NC-SA 4.0 assets, code pattern only** |
| `godot-open-world-demo` | a cautionary example (no chunking/streaming at all) confirming why our region/location scene split is necessary; shadow-caster-proxy-mesh optimization idea |
| `godot-demo-projects` (3d/) | `NavigationAgent3D` usage pattern for NPC movement; per-chunk `NavigationMesh` baking |
| `skelerealms` | the closest real-world reference for our data-driven NPC schedule system; Entity/Component separation; tiered NPC simulation LOD (FULL/GRANULAR/NONE); GOAP-inspired goal/action split, scoped down to what a life-sim actually needs — **conceptual reference only, beta software with self-documented rough edges** |

No source code, models, textures, audio, or written content from any of
these repositories is used in this project. Where a license would in any
case have permitted reuse (e.g. the MIT-licensed code in `godot-open-rpg`,
`skelerealms`, `godot-demo-projects`), the decision to reimplement
independently is deliberate, in service of the originality rule.

---

## 9. What This Document Is Not

This is not a moment-to-moment script, not a level layout, not a final
narrative bible, and not an implementation plan. Concrete content (specific
NPC names, specific recipes, specific quest text, specific map layouts)
is deliberately **out of scope here** — it belongs in the more granular
design docs (NPC_DESIGN.md, DIALOGUE_DESIGN.md, COOKING_DESIGN.md,
QUEST_DESIGN.md, WORLD_DESIGN.md, ART_DIRECTION.md, AUDIO_DIRECTION.md)
that follow once this foundation is approved, per TECHNICAL_ROADMAP.md.
