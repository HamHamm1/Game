# TECHNICAL_ROADMAP.md

> The **build plan**: what order we build in, what the first playable
> target is, and the concrete decisions that DESIGN.md / ARCHITECTURE.md
> deliberately deferred to "Phase 1." Read this to know *what to do next*;
> read the other docs to know *how and why*.
>
> Status update: **Phase 0 done; Phase 1 + Phase 1b (mobile foundation)
> implemented and `STATICALLY VALIDATED` + `HEADLESS TESTED`** (VALIDATION.md).
> **Phase 2 is BLOCKED** until the Phase 1/1b Android verification gate
> (`godot/ANDROID_VERIFICATION.md`, checklist A–T) passes on a real device —
> which requires an APK built where the Android SDK is reachable
> (ANDROID_BUILD.md). No world-building until then. (The prose below is the
> original Phase-0 plan and predates the mobile-first requirement; see
> MOBILE_FIRST.md where they differ.)
>
> Rule of the whole plan (DESIGN.md / master-prompt §43):
> **Small → Stable → Modular → Expandable → Beautiful.** Get the
> architecture and one beautiful, playable vertical slice right before
> expanding the world or piling on content.

---

## 1. Where we are

**Phase 0 — Research: DONE.**

Delivered on branch `claude/rpg-architecture-design-eut455`:
- `reference_analysis/` — 8 reference projects analyzed for architecture
  patterns and licenses (no code/assets copied).
- `DESIGN.md`, `ARCHITECTURE.md`, `AI_RULES.md`, `GAME_SYSTEMS.md`,
  `ART_DIRECTION.md`, and this roadmap.
- Engine decision: **Godot 4, GDScript, Forward+** (ARCHITECTURE.md §1).

Still to write as design matures (not blockers for Phase 1 start):
`WORLD_DESIGN.md`, `NPC_DESIGN.md`, `DIALOGUE_DESIGN.md`,
`COOKING_DESIGN.md`, `QUEST_DESIGN.md`, `AUDIO_DIRECTION.md`, plus
`CHANGELOG.md` (started when code lands) and a project `README.md` rewrite
(currently still the old MMORPG's).

---

## 2. Phase-1 decisions (resolving the open questions)

These were deliberately left open in the design docs to decide here, with
implementation context.

### 2.1 Data format — **DECISION: JSON with a strict typed-parsing layer**

Resolves ARCHITECTURE.md §9's open question.

**Decision:** author content data as **JSON**, loaded through a
**registry that constructs typed data classes** (`class_name` objects with
typed fields) from validated JSON — never raw `Dictionary` passed around
gameplay code.

**Why:**
- Preserves the **hot-reload + external-tooling + easy-diff** workflow the
  team already validated on the old MMORPG (`content/*.json` + live admin
  edits) — a proven capability worth keeping (ARCHITECTURE.md §9).
- Human- and AI-authorable outside the Godot editor, which matters for a
  data-driven, content-heavy life-sim.
- The **typed-parsing layer is mandatory** and directly answers the
  documented weakness in `reference_analysis/openacre.md` (untyped
  `Variant`/duck-typing): JSON is the *storage* format, but the moment it
  enters the game it becomes a typed object with a validation step that
  fails loudly on malformed data (AI_RULES.md Rule 7).

**Consequences / guardrails:**
- Each content domain (items, recipes, npcs, schedules, dialogue, quests)
  gets: a JSON schema (documented fields per GAME_SYSTEMS.md), a typed data
  class, and a registry loader that validates on load and reports errors
  with the offending file/field.
- `data/` uses `.json`. ARCHITECTURE.md §2's `*.tres (or .json)` note and
  §8/§9 resolve to JSON.
- Godot `Resource`/`.tres` is still the right tool for **engine-facing**
  assets (materials, scenes, animation libraries, exported tunables on
  nodes) — the JSON decision is about **game content data**, not about
  banning Resources everywhere.
- **Hot-reload** is designed in as a capability (watch `data/`, re-validate,
  re-emit) but is a convenience feature, not an MVP gate.

### 2.2 Godot version pin

Pin `project.godot` to the newest stable Godot 4.x at Phase-1 start, record
the exact `config/features` string here when done (ARCHITECTURE.md §1).
Renderer: **Forward+**. *(To be filled in when the project is initialized:
`Godot <x.y>` / `config/features = "<x.y>, Forward Plus"`.)*

### 2.3 Addons

`addons/` starts **empty** (ARCHITECTURE.md §2). Each candidate is
evaluated one at a time, here, before adoption — license, maintenance, and
whether it earns the dependency vs. our own small implementation. Likely
future candidates to *evaluate* (not commitments): a dialogue-graph editor,
a debug console. Not before we feel their absence.

### 2.4 Old-code retirement

The old Spirit World MMORPG (`src/`, `public/`, `server.js`, `content/`,
`scripts/`, `package.json`, `data/`) is retired in **its own dedicated
commit** once the new foundation (Phase 1) is validated (DESIGN.md §0) —
never silently, never mixed with new-feature commits. Until then it stays,
inert, so the repo history is clean and the switch is a single reviewable
change. The current `README.md` is rewritten in the same window.

---

## 3. The MVP (first playable target)

The MVP is deliberately **tiny** (master-prompt §41, DESIGN.md §3). The
whole world does not exist yet — a small, believable slice does. **If the
12 loop-points below don't all work, the world does not get bigger.**

**The MVP vertical-slice loop — the player can:**

1. Walk (first person) in a small area.
2. Enter a building (region → location swap, ARCHITECTURE.md §3).
3. Interact with an object (via the `Interactable` contract, §GS 3).
4. Meet an NPC.
5. Talk to them (data-driven dialogue, §GS 6).
6. Receive a quest (§GS 8).
7. Pick up an item (§GS 9).
8. Cook a simple recipe (§GS 7).
9. Give the dish to an NPC (§GS 5 `shared_meal` event).
10. See a relationship value increase (§GS 5).
11. Advance time (TimeManager, §GS 1) — and see something respond (NPC
    schedule or lighting).
12. Save and load — and have all of the above round-trip (§GS 13,
    ARCHITECTURE.md §11).

**MVP scope guardrails:**
- One small region + a couple of interiors. Not the full hub.
- A handful of NPCs (enough to prove schedules + relationships), not 100.
- 2–3 recipes, a few items, one short quest — enough to prove the systems
  interlock, not to be "content-complete."
- Synchronous scene loading, no streaming (ARCHITECTURE.md §3, §14).
- No combat / farming / fishing / romance-completion / weather-gating
  (ARCHITECTURE.md §14) — those are later phases.

**The MVP is "done" only when all 12 work and save/load round-trips.**
Report honestly against this list (AI_RULES.md Rule 11) — a loop point
that half-works is `PARTIALLY IMPLEMENTED`, not done.

---

## 4. Phases

Each phase ends with a **playable, honest deliverable** — not a checklist
of stubs. Later phases assume earlier ones are actually working.

### Phase 0 — Research ✅ (done)
Analyze references; write the foundation docs; choose the engine. *(This
document set.)*

### Phase 1 — Foundation
**Goal:** the skeleton every later system hangs on.
- Initialize the Godot 4 project; pin version (§2.2); set up input map;
  folder scaffold per ARCHITECTURE.md §2.
- `WorldEvents` signal bus; the narrow autoload skeletons (§ARCH 5) as
  thin, real stubs.
- **Player controller** — modular, component-based (ARCHITECTURE.md §4):
  movement (walk/sprint/crouch), first-person camera rig (Yaw/Pitch +
  effect-module seams), `InteractionController` raycast.
- **Interaction system** — the `Interactable` base + 1–2 concrete types
  (Door, PickupItem) to prove the contract.
- **Scene management** — `RegionLoader`/`LocationLoader` (synchronous
  impl behind an interface that a threaded impl can later replace,
  ARCHITECTURE.md §3).
- **Data architecture** — the JSON→typed-registry pattern (§2.1) with one
  domain (items) as the reference implementation.
- **Save/load skeleton** — the `get_save_data`/`load_save_data` contract +
  versioned file, round-tripping player position + inventory (proves the
  pattern before there's much to save; master-prompt §23/§38).

**Deliverable:** walk around a blockout scene, enter a building, interact
with an object, pick up an item, save and load position+inventory.

### Phase 2 — World
**Goal:** a place worth living in (the vertical slice's *space*).
- The MVP region + interiors as blockouts → lighting/material pass
  (ART_DIRECTION.md §6 steps 1–2). **Get the slice looking right before
  expanding** (master-prompt §33).
- `TimeManager` (day/night, time blocks) + `RegionLightingController`
  (lighting profiles, ART §3).
- `WeatherManager` foundation (state + signal; visual hookup light).

**Deliverable:** the player can move through the slice across a day/night
cycle with coherent lighting; it *feels* like the target look, small.
Lighting must prioritize **beauty and readability** (Morning/Day/Evening/
Night all beautiful; evening/golden hour the hero state; night navigable;
interiors warm/legible); the slice must read as a **peaceful place worth
living in**, not a mode-switching horror set. Mystery is a local/occasional
modifier here, never a global lighting mode (DESIGN.md §1.1). Keep M2.2
(lighting) and M2.3 (weather) as separate milestones.

### Phase 3 — NPCs
**Goal:** the world has residents.
- NPC entity (Logic/View split, ARCHITECTURE.md §7); NPCDirectory.
- `NavigationAgent3D` movement (per-region navmesh); animation-façade skin.
- Data-driven **schedules** (§GS 4) + schedule runner (loaded vs.
  off-screen logical update).
- **Dialogue system** (§GS 6) — data-driven graph, conditions,
  consequences.
- **Relationship system** (§GS 5) — multi-axis, events, stages.

**Deliverable:** NPCs follow daily schedules and can be talked to; talking
and giving things changes relationship values.

### Phase 4 — Life systems
**Goal:** things to *do* daily.
- Full **inventory/items** (§GS 9), **money** (§GS 10).
- **Cooking** (§GS 7) — stations, recipes, quality tiers, dish items.
- **Shops** (§GS 11) — buy/sell, schedule-gated hours.
- **Gathering** (harvest/pickup nodes).

**Deliverable:** the full MVP loop (§3) is closed and shippable as a
vertical slice.

### Phase 5 — RPG layer
Quests fully fleshed (types, chains, unlocks, §GS 8); light skill
progression (cooking, §GS 10); rewards/equipment. **Deliverable:** quest
chains that unlock areas/recipes/story and reward progression.

### Phase 6 — Romance
Relationship progression to the upper stages (§GS 5), special events,
dates, personal quests, branching relationship dialogue. **Deliverable:**
a full relationship arc from stranger to partner, earned over time.

### Phase 7 — Mystery
Secrets, environmental clues, unusual/anomalous events, hidden locations,
the narrative seam under the town (DESIGN.md §2, §5). **Deliverable:** a
discoverable mystery thread that advances by observation, not hand-holding.

### Phase 8 — Polish
Lighting, materials, VFX (steam/fog), animation, sound, UI, and the
**profiling-driven** performance pass (ART §7, master-prompt §35).
**Deliverable:** the vertical slice reaches the intended visual/audio bar.

**World expansion** (beyond the hub, toward the full DESIGN.md §3 town and
future farming/fishing) happens **after** the slice is proven — interleaved
with Phases 5–8, never before the MVP loop works (master-prompt §41).

---

## 5. Working method (per task, every phase)

Follow the development loop (AI_RULES.md, master-prompt §37): read DESIGN →
read ARCHITECTURE → search for existing impl/extension point → check
deps/refs → propose a small-task plan → implement → **run/test it** →
inspect errors honestly → update docs on architecture change → append to
`CHANGELOG.md`.

**Definition of done for a system:** it runs in the editor without script
errors, its data-driven extension point works (a new instance of its
content can be added as data with zero core edits — ARCHITECTURE.md §13),
its persistent state round-trips through save/load, and its status is
reported with the honest vocabulary (AI_RULES.md Rule 11), never faked
(master-prompt §38).

**Scope discipline:** each change is the minimum the task needs; don't
widen it or pre-build future phases (AI_RULES.md Rule 12).

---

## 6. Risk register (known hard parts, flagged early)

| Risk | Where | Mitigation |
|---|---|---|
| Off-screen NPC simulation grows complex | §GS 4, ARCH §7 | Logic/View split from day one; keep MVP NPCs simple; tiered sim (skelerealms) only if profiling demands |
| Save/load reshaping late breaks saves | ARCH §11, §GS 13 | Versioned file + per-system `get_save_data` from Phase 1; add *fields* early even if inert (freshness, etc.) |
| Dialogue/quest condition system sprawls | §GS 6, §GS 8 | One shared condition evaluator both read; no bespoke per-NPC/per-quest code (AI_RULES.md Rule 4) |
| Art polished before the space works | ART §6 | Blockout → light/material → **judge** → only then kit/dress; don't expand until the slice reads |
| Streaming built too early | ARCH §3, §14 | Synchronous loader behind a swappable interface; no streaming until profiling says so |
| Old MMORPG code entangles new code | DESIGN §0, §2.4 | Retire it in one dedicated commit; never mix; keep it inert until then |

---

## 7. Immediate next actions (when Phase 1 is greenlit)

1. Initialize the Godot 4 project; pin version; commit the empty scaffold
   (ARCHITECTURE.md §2 folder tree) + input map.
2. Stand up `WorldEvents` + autoload skeletons (§ARCH 5).
3. Build the modular player controller + first-person camera rig
   (ARCHITECTURE.md §4).
4. Implement the `Interactable` contract + Door + PickupItem (§GS 3).
5. Implement the JSON→typed-registry pattern for `items` as the reference
   for all future content domains (§2.1).
6. Implement the synchronous `RegionLoader`/`LocationLoader` + a blockout
   region and interior (ARCHITECTURE.md §3).
7. Implement the save/load skeleton round-tripping position + inventory
   (ARCHITECTURE.md §11).
8. Start `CHANGELOG.md`; report status against the MVP list (§3) honestly.

Do **not** start these until the foundation docs are reviewed/accepted —
Phase 1 begins on that green light, not before.
