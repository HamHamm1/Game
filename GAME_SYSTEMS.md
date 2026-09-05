# GAME_SYSTEMS.md

> The **mechanical rules** of each core system — how it behaves, what data
> shapes it, and how it talks to the rest of the game. DESIGN.md says *what*
> and *why*; ARCHITECTURE.md says *where the code lives and how systems
> communicate*; this document says *how each system actually works as a
> mechanic*, at the level of concrete rules a contributor can implement
> against.
>
> Status: **Phase 0 design deliverable.** None of this is implemented yet.
> Numbers given (ranges, thresholds, tiers) are **design intent to be
> tuned**, not final balance — they exist so systems interlock coherently,
> not to lock in values. When a value is implemented it becomes an
> `@export`ed, documented tunable (AI_RULES.md Rule 6), never a magic
> number.
>
> Data format (custom `Resource`/`.tres` vs. schema-validated JSON) is the
> open decision in ARCHITECTURE.md §9, resolved in TECHNICAL_ROADMAP.md.
> This document describes the *fields* each data object carries; it does
> not assume a serialization format.

---

## 0. How the systems fit together

```
        TimeManager ──"time block changed"──► WorldEvents
                                                  │
        ┌───────────────┬─────────────┬───────────┼───────────┬──────────┐
        ▼               ▼             ▼            ▼           ▼          ▼
   NPC schedules   Shop hours   Lighting zones  Weather roll  Quests   Events
        │
        ▼
   NPC acts (walk / work / cook / idle) ──► Player can interact
        │                                        │
        ▼                                        ▼
   Relationship state ◄── gift / shared meal / dialogue choice / quest
        │                                        │
        ▼                                        ▼
   Dialogue availability                    Cooking → Dish → (eat|gift|sell)
        │                                        │
        └────────────► Quests advance ◄──────────┘
                          │
                          ▼
                   Unlocks (areas, recipes, dialogue, story)

  Everything persistent ──► SaveManager (get_save_data / load_save_data)
```

Every arrow that crosses system boundaries for a *side effect* goes
through `WorldEvents` signals (ARCHITECTURE.md §5, §12). Reads of another
system's public state (e.g. a dialogue condition reading relationship
values) are direct and fine.

---

## 1. Time System

**Authority:** `TimeManager` (autoload) owns the only clock. Everything
else subscribes; nothing else counts time independently (ARCHITECTURE.md
§10).

**Structure of a day** — time-of-day *blocks* (DESIGN.md §4.6):

| Block | In-game hours |
|---|---|
| Night (pre-dawn) | 00:00–05:59 |
| Morning | 06:00–11:59 |
| Afternoon | 12:00–17:59 |
| Evening | 18:00–21:59 |
| Night | 22:00–23:59 |

**Two granularities.** The clock advances continuously (a real-time→
game-time scale, tunable) so a wall clock and smooth lighting
interpolation are possible. Systems that only care about coarse changes
(NPC schedules, shop open/close, weather rolls) subscribe to the
**block-changed** signal, not the per-minute tick, so they run a handful
of times a day, not every frame.

**Signals emitted on `WorldEvents`:** `minute_passed` (fine, for clocks /
lighting lerp), `time_block_changed(old, new)`, `day_started(day_index)`.

**Time passage actions.** Sleeping (a `Bed` interactable) fast-forwards to
a target wake time, running each intervening block change so schedules,
weather, and needs update as if time had passed. Certain activities
(cooking, a job shift) advance the clock by a fixed cost when performed.

**Persistence:** `{ day_index, minutes_into_day }`.

---

## 2. Weather System

**Authority:** `WeatherManager` (autoload). Rolls a new state on a day
boundary (and may schedule intra-day transitions), emits
`weather_changed(old, new)` on `WorldEvents`.

**States:** clear · cloudy · rain · heavy rain · fog · storm (DESIGN.md
§4.6). Rolls are **weighted by season/region later**; for the MVP a simple
weighted table per region is enough.

> **M2.3 implemented subset** (`godot/M2.3_WEATHER_DESIGN.md`): the peaceful
> foundation — `CLEAR`, `OVERCAST` (≈cloudy), `LIGHT_RAIN` (≈rain, gentle),
> `MIST` (≈fog, **localized**, never global) — plus a cross-cutting `wind`
> scalar (not a mutually-exclusive state). **Heavy rain / storm / global fog
> are deferred** (stormy/horror-adjacent). Weather affects the look through a
> subtle **lighting modifier** (folded into the M2.2 lighting resolve), never
> by writing the environment directly and never via heavy global fog or a
> screen filter. `WeatherManager` boots CLEAR (preserving the M2.2 look),
> rolls deterministically on the day boundary, and may schedule at most one
> optional intra-day transition.

**Effects (each subscriber reacts on its own):**
- **Lighting** — weather is one input to the active lighting profile
  (ART_DIRECTION.md §3): overcast desaturates and flattens; rain darkens
  and wets surfaces; fog cuts draw distance and raises ambient floor.
- **Audio** — swaps/layers the ambience bed (rain loop, wind, thunder) per
  AUDIO_DIRECTION.md.
- **NPC behavior** — schedules may carry weather-conditional variants
  (§4): an NPC whose entry says "park bench, leisure" may fall back to an
  indoor activity in heavy rain.
- **Visibility / gameplay** — fog and storm reduce interaction/spot
  distance and can gate mystery events (an area only reachable, or only
  *wrong*, in fog).

**Persistence:** `{ current_state, pending_transition? }`.

---

## 3. Interaction System (mechanics)

Interface and code shape are in ARCHITECTURE.md §6. Behavior rules:

- The player's `InteractionController` raycasts forward from camera center
  each frame up to an **interaction range** (tunable; contextual — reduced
  in fog/storm per §2). Among all `Interactable`s hit within range, it
  selects the one with the highest `get_interaction_priority()`, breaking
  ties by nearest.
- When a target is selected and `can_interact(player)` is true, its
  `get_interaction_prompt(player)` string is shown via the crosshair/HUD
  prompt (the player script does not compose prompt text — the interactable
  owns it, unlike the anti-pattern in
  `reference_analysis/3d-fpp-interaction-demo.md`).
- On the interact input, `interact(player)` runs. What happens next is the
  interactable's business (open a door, start dialogue, sit, open a
  cooking UI, pick up an item, sleep).

**Prompt priority exists** so that when two interactables overlap (an item
resting on a table that is itself a surface), the design decides which
wins, in data, not by raycast luck.

**Standard interactables (each a subclass, ARCHITECTURE.md §6):** Door
(open/close, lockable) · NPCInteractable (talk) · Chair (sit) · Bed
(sleep) · CookingStation (open cooking) · Chest/Container (open inventory
transfer) · Plant/GatherNode (harvest) · PickupItem (add to inventory) ·
Sign/Inspectable (show text).

---

## 4. NPC System (mechanics)

Composition and Logic/View split are in ARCHITECTURE.md §7. Mechanical
rules:

### 4.1 Schedule

A schedule is **data**: an ordered list of entries, each:

```
{ from_block (or time), location_id, activity, [conditions] }
```

- `activity` is a symbolic verb the visual puppet knows how to perform
  (sleep, eat, work, cook, shop, leisure, walk, idle) — mapped to a skin
  verb (ARCHITECTURE.md §7) and, where relevant, a spot in the location
  (a `WorkAnchor`, `SeatAnchor`).
- `conditions` (optional) gate an entry on weather, day-of-week, quest
  flags, or relationship state, so one NPC can have a rainy-day variant or
  a "only after you've met" variant **without branching code**.

**Schedule runner:** on `time_block_changed`, the runner picks the active
entry for each NPC.
- If the NPC's region is loaded → instruct the puppet: navigate to
  `location_id`'s anchor (via `NavigationAgent3D`, the
  `reference_analysis/godot-demo-projects.md` pattern) and play `activity`.
- If not loaded → update the logical entity's `current_location` directly
  (no pathfinding, no puppet). This is the concrete mechanism behind "NPCs
  live their lives whether or not the player is watching" (DESIGN.md §1).

### 4.2 Needs & stats

Lightweight for the life-sim (not survival-grade): e.g. `energy`, `mood`.
Needs drift with time and are nudged by schedule activities (eating
restores, working drains). Needs may bias dialogue tone and schedule
fallback but are **not** a fail-state the player manages for the NPC.

### 4.3 Memory

An append-only log of notable interaction events per NPC
(`first_meeting`, `received_gift:<item>`, `shared_meal:<dish>`,
`quest_done:<id>`, `conflict`, `apology`), queryable by dialogue
conditions (§6) and relationship resolution (§5). Memory is what makes
dialogue able to say "thanks again for the stew yesterday."

### 4.4 Event reactions

NPCs subscribe to `WorldEvents` for world-level beats (a festival, a
weather extreme, a quest milestone) and may swap schedule/dialogue in
response — again via data-conditioned entries, not bespoke code per NPC.

**Persistence per NPC:** `current_location`, needs/stats, relationship
vector (§5), memory log, per-NPC flags, inventory.

---

## 5. Relationship System

**Multi-dimensional** (DESIGN.md §4.3), not a single affection counter.

**Axes (per NPC, toward the player):**
`friendship`, `trust`, `affection`, `respect`, `familiarity`,
`compatibility`. Each is a bounded scalar (design range e.g. 0–100;
`compatibility` may be a mostly-static trait-match value rather than a
grown one).

**Events move axes.** A relationship *event* applies a weighted delta
across several axes at once — data-driven, so a "gift" isn't one number:

```
event: gift(item)
  → affection += w_aff(item, npc_preference)
  → familiarity += small
  → trust += tiny (they learn your taste)
  (a disliked gift can push affection negative)
```

Event types: `first_meeting`, `conversation`, `gift`, `shared_meal`,
`quest_completion`, `conflict`, `apology`, `special_event`, `date`
(DESIGN.md §4.3). Each maps to a data table of per-axis weights, modulated
by context (does the NPC like this item/dish? is it their birthday?). NPC
preferences (loved/liked/neutral/disliked items and dishes) live in the
NPC's data (§4) and are read by cooking (§7) and gifting.

**Stages (romance arc, DESIGN.md §4.3):**
Stranger → Acquaintance → Friend → Close Friend → Romantic Interest →
Relationship. A stage is a **derived** read over the axes **plus gates**,
not just a threshold on one number:

```
stage(npc) = highest stage whose requirements are all met, where a
requirement can demand axis minimums AND history (memory) AND
prerequisites (a personal quest done, N shared meals, a special event
seen).
```

This enforces DESIGN.md's rule that romance is *earned over time*, never
available from the first conversation: the Romantic-Interest gate requires
accumulated shared history, not merely a high affection score reached
quickly.

**Emits** `relationship_changed(npc_id, axis, old, new)` and
`relationship_stage_changed(npc_id, old, new)` on `WorldEvents` — dialogue,
quests, and events react.

**Persistence:** the axis vector + derived stage per NPC (stage can be
recomputed on load, but is stored for event bookkeeping).

---

## 6. Dialogue System

> **See DIALOGUE_DESIGN.md for the full architecture.** This section
> describes the **authored branching graph**, which is the *Level-1
> (authored) tier* of a hybrid system: DIALOGUE_DESIGN.md layers an
> external-LLM conversation tier (Level 2 hybrid, Level 3 fully AI-driven)
> on top for casual/dynamic dialogue, while critical/canon dialogue stays
> in the deterministic graph described here. In both tiers the engine is
> authoritative — the LLM only ever generates *wording* within branches
> and consequences the game has already permitted.

**Data-driven branching graph** (DESIGN.md §4.4, ARCHITECTURE.md §8). Never
strings embedded in scripts.

**A dialogue is a graph of nodes:**
- **Line** — speaker + text (+ optional emotion/portrait cue, animation
  verb).
- **Choice** — player options, each with optional `conditions` and
  `consequences`.
- **Condition/branch** — routes based on evaluated state.
- **Consequence** — a side effect: apply a relationship event (§5), set a
  flag, give/take an item, start/advance a quest, unlock a recipe.

**Conditions can read:** relationship axes/stage (§5), quest state (§8),
time block (§1), current location, event/world flags, NPC memory (§4.3),
player inventory. This is the single mechanism behind "unlock this branch
only if affection ≥ 30 and the quest is done" (DESIGN.md §4.4).

**Availability.** An NPC exposes different *entry points* into its dialogue
depending on state (a first-meeting intro vs. a familiar greeting vs. a
quest-specific conversation), chosen by the same condition system — so a
new conversation is a data addition, not an NPC-code change (AI_RULES.md
Rule 4).

**Consequences route through the owning systems**, never mutate them
directly: a dialogue consequence *emits a relationship event*, it does not
poke the relationship vector; it *asks QuestRegistry to advance a quest*,
it does not hand-edit quest state.

**Persistence:** dialogue/world flags set by consequences (the graphs
themselves are static content).

---

## 7. Cooking System

**Core loop** (DESIGN.md §4.5): `Ingredient(s) → Recipe (at a required
station) → CookingProcess → Dish`.

**Recipe data:**
```
{ id, name, ingredients[ {item_id, qty} ], required_station,
  cook_time, difficulty, base_quality, effects[], sell_price,
  preferred_by[ npc_id ] }
```

**CookingProcess** resolves a produced Dish and, importantly, a **quality
tier**: Poor · Normal · Good · Excellent · Perfect (DESIGN.md §4.5, §4.6).

**Quality inputs** (combine into a score → tier; exact curve is tunable):
- **Ingredient quality** — ingredients carry their own quality/freshness
  (§9); better inputs raise the ceiling.
- **Player cooking skill** — a light skill that rises with practice
  (§10), raising the floor and the ceiling.
- **Timing / minigame input** — an active-cook interaction (hitting the
  right window); optional to fail-soft (no input = Normal-ish, not
  disaster).
- **Recipe familiarity** — repeated cooking of the same recipe improves
  consistency.
- **Equipment / station** — a better station widens the achievable range.

**Dish effects (by quality):** restore energy/hunger, optional temporary
buff (DESIGN.md §4.5), a **relationship bonus when gifted/shared with an
NPC who prefers it** (routes through a `shared_meal` relationship event,
§5 — cooking does not touch relationship state directly), and a sell value
scaled by quality.

**A Dish is an item instance** (§9) carrying its recipe ref, quality tier,
and freshness — so it can sit in inventory, be gifted, eaten, or sold like
any other item.

**Adding a recipe** = one `data/recipes/*` entry, zero `src/cooking/` edits
(ARCHITECTURE.md §13.2). If it can't be, that's an escalation (AI_RULES.md
Rule 4).

**Persistence:** known recipes + per-recipe familiarity live on the
player; cooking-skill level lives in player stats (§10).

---

## 8. Quest System

**State machine per quest** (DESIGN.md §4.6, ARCHITECTURE.md §8): `Locked
→ Available → Active → Completed` (or `→ Failed`). `QuestRegistry` owns
runtime state; definitions are data.

**Quest definition:**
```
{ id, type, unlock_conditions, objectives[], rewards[], consequences[],
  [failure_conditions] }
```
- **type:** main · side · NPC · relationship · cooking · exploration ·
  mystery (DESIGN.md §4.6).
- **unlock_conditions** move it `Locked → Available` (a relationship stage
  reached, an area discovered, a prior quest completed, a time/flag).
- **objectives** are tracked steps (talk to X, cook a Perfect Y, deliver Z,
  reach location W, gather N of item). Objective progress is driven by
  `WorldEvents` the registry listens to (item cooked, item given, location
  entered, dialogue flag set) — the registry never polls.
- **rewards:** items, money, recipes, relationship events, unlocks.
- **consequences:** world/dialogue flags, other quests unlocked, area
  access — the levers by which a quest changes the world (DESIGN.md §1).

**Emits** `quest_state_changed(id, old, new)` and
`quest_objective_updated(id, obj_index)` on `WorldEvents`. UI, NPCs, and
dialogue react.

**Adding a quest** = one `data/quests/*` entry, zero `src/quest/` edits
(ARCHITECTURE.md §13.3).

**Persistence:** per-quest state + per-objective progress + which quests
are known/discovered.

---

## 9. Inventory & Items

**Definition vs. instance** (DESIGN.md §4.6, ARCHITECTURE.md §8) — the rule
that makes items data:

- **Item definition** (static, in `ItemRegistry`): `id`, display name,
  category (ingredient / dish / equipment / gift / quest / material /
  misc), `stack_size`, base value, tags (e.g. `vegetable`, `fish`,
  `gift-loved-by:<npc>`), icon/model refs.
- **Item instance** (mutable, held in a container): a definition ref plus
  per-instance state — `quantity` (for stackables), `quality`/`freshness`
  (ingredients and dishes), `recipe_ref` + `quality_tier` (dishes),
  durability or unique overrides (equipment/uniques).

**Containers** (player inventory, chests, shop stock, NPC inventories) all
speak the same instance API — add / remove / transfer / query — so a new
container type is not a new inventory system (AI_RULES.md Rule 3).

**Categories the design requires:** stackable, unique, equipment,
ingredient, quest item, food/dish, gift, crafting material (DESIGN.md
§4.6).

**Freshness** (ingredients & dishes): a quality that can degrade over game
time (§1), feeding cooking quality (§7) and gift value (§5). MVP may treat
freshness as static and add decay later — the *field* exists from the
start so save data doesn't need reshaping (AI_RULES.md Rule 10).

**Persistence:** every container's instance list. Quest items and unique
items are flagged so they're never silently lost.

---

## 10. Player Stats, Money & Skills

**Owned by `PlayerStats`** (ARCHITECTURE.md §4).

- **Needs:** `energy` (spent by sprinting/working/late hours, restored by
  food/sleep), `hunger` (restored by eating). Reaching empty degrades
  gently (slower movement, worse cook timing) — a nudge, not a
  death-spiral, matching the cozy-leaning tone (DESIGN.md §5).
- **Money:** single currency. Earned by jobs, selling dishes/goods; spent
  at shops. Emits `money_changed` on `WorldEvents`.
- **Skills (light RPG layer, Phase 5):** e.g. `cooking`, plus future
  `farming`/`fishing`. Skills rise with use, gate/improve outcomes (§7),
  and unlock recipes or efficiencies — supporting the other systems rather
  than being an XP grind for its own sake (DESIGN.md §6).

**Persistence:** needs, money, skills, known recipes (§7), unlocked
content.

---

## 11. Shops & Economy (MVP-light)

A shop is a location with a `Shopkeeper` NPC (schedule-gated open hours,
§1/§4) exposing a **shop container** (§9) for buy/sell. Prices derive from
item base value × a per-shop modifier; dish sell price scales with quality
tier (§7). Bartering/haggling is explicitly out of MVP scope
(ARCHITECTURE.md §14) — noted as a later layer, not designed here.

---

## 12. Audio System (mechanics)

Full treatment in AUDIO_DIRECTION.md; the mechanical rule: audio is
organized as **ambience zones** tied to regions/locations (town, kitchen,
forest, mystery landmark), layered under event-driven one-shots
(footsteps synced to movement, interaction sounds, weather from §2, NPC
chatter). Entering a location swaps its ambience bed; weather and time
modulate it. No system hard-codes a sound path in gameplay logic — sounds
are data on the emitting object/zone (mirrors the "no hard-coded prompt
strings" interaction lesson, §3).

---

## 13. Save/Load (what each system contributes)

Mechanism is ARCHITECTURE.md §11 (`get_save_data`/`load_save_data`,
one versioned file). This table is the **checklist** that every item in
DESIGN.md §4.6's round-trip requirement has a documented owner:

| Saved data | Owner |
|---|---|
| Day + minutes-into-day | TimeManager (§1) |
| Weather state | WeatherManager (§2) |
| Player position | Player (§10 / ARCHITECTURE §4) |
| Inventory + money + stats + skills | Player / PlayerStats (§9, §10) |
| Known recipes + familiarity | Player (§7) |
| Relationship vectors + stages | NPCDirectory per NPC (§5) |
| NPC states (location, needs, memory, inventory, flags) | NPCDirectory (§4) |
| Quest states + objective progress | QuestRegistry (§8) |
| Dialogue / world flags | flag store via consequences (§6) |
| Discovered locations | world/region state (§ARCH 3) |
| Unlocked content | relevant registry (§7, §8) |

If a new mechanic adds persistent state, it adds a key to *its own*
`get_save_data()` and a row here — `SaveManager`'s code does not change
(ARCHITECTURE.md §13.6).

---

## 14. Non-goals (mechanics deliberately not designed yet)

Consistent with ARCHITECTURE.md §14: no combat, no farming/fishing
mechanics (systems named as future scope only), no multiplayer economy, no
bartering/crime/faction systems (studied in
`reference_analysis/skelerealms.md` but out of scope for a cozy life-sim
core). These are left undesigned rather than guessed — added in their own
future design docs when their phase arrives (TECHNICAL_ROADMAP.md).
