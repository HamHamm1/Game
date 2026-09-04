# MOBILE_FIRST.md — Primary Platform Requirement

> **Standing requirement, project-wide.** Mobile (Android, touchscreen) is
> the **primary** target platform, not a secondary port. It must influence
> architecture, gameplay, UI, rendering, input, performance, memory,
> networking, and the AI/LLM API design **from the start**. PC support may
> be added later but must never dictate the core design.
>
> This document is canon alongside DESIGN.md / ARCHITECTURE.md /
> GAME_SYSTEMS.md; MOBILE_ART_DIRECTION.md is its visual/technical-art
> companion. Where an earlier doc assumed PC-first defaults (e.g.
> ART_DIRECTION.md, and the keyboard/mouse-only Phase 1 controls), this
> requirement takes precedence and those are reconciled as the affected
> systems are (re)built — see §Reconciliation.

Primary target: **Android phones**, touchscreen, portrait/landscape as
appropriate, **mid-range Android as the baseline** performance target.

---

## 1. Mobile-first design principle
Every major system must answer: *"How will this work comfortably and
efficiently on a phone?"* Do not build PC-first and adapt afterward. Never
assume: a keyboard/mouse, a large screen, unlimited RAM/GPU/CPU, permanent
fast internet, or unlimited API requests.

## 2. Touch controls (first-class input)
Support, as a first-class input method: virtual movement joystick, a
camera/look area, and buttons for interact, sprint, crouch, jump,
inventory, quest, dialogue, and contextual actions. **Contextual
interaction reduces on-screen buttons** — show `[ OPEN ]` near a door,
`[ TALK ]` near an NPC, `[ COOK ]` near a station. Do not fill the screen
with permanent buttons.

## 3. First-person mobile camera
Comfortable for touch: adjustable (separate H/V) sensitivity, touch
acceleration, configurable smoothing, FOV setting, a motion-reduction
option, camera-shake intensity. Minimize motion sickness — restrain head
bob, shake, motion blur, rapid FOV changes, forced camera movement.

## 4. UI scale
Touch-sized targets (no mouse-precision buttons); important UI readable on
small screens; support multiple aspect ratios (16:9, 20:9, others) and
resolutions (low, standard, high-DPI). Do not assume a single resolution.

## 5. Performance target
Prioritize stable frame rate over visual complexity. **30 FPS minimum on
mid-range**, 60 on capable devices. Provide scalable graphics settings
(LOW/MED/HIGH/ULTRA) controlling shadows, shadow distance, texture/view
distance, vegetation/particle density, reflections, ambient/post/volumetric
effects, animation quality.

## 6. Mobile GPU constraints
Avoid expensive shaders, excessive transparency/real-time lights/
reflections, high-res shadow maps, excessive particles, many animated
objects. Prefer baked lighting/lightmaps, LOD, occlusion culling,
impostors, texture atlases, static batching, GPU-friendly materials,
simplified collision, distance-based updates. **Profile before optimizing.**

## 7. Open world on mobile
Never load the whole world into memory. Use streaming/chunks:
`player → streaming manager → visible → active → background → unload
distant`. Only required areas stay fully active. NPC simulation is
distance-aware.

## 8. NPC simulation levels
- **L0 Unloaded** — not in memory.
- **L1 Background** — state advanced abstractly.
- **L2 Nearby** — navigation/behavior active.
- **L3 Full** — near player: full animation, interaction, dialogue, AI.

This is critical for mobile performance. (Extends GAME_SYSTEMS.md §4 and the
skelerealms tiered-sim note in ARCHITECTURE.md §3/§7.)

## 9. Animation LOD
Near = full; medium = reduced update rate; far = simplified/none. Never
animate hundreds of NPCs at full quality at once.

## 10. Mobile memory
Design for limited RAM. Avoid loading duplicate textures/meshes, unused
audio, distant interiors, unnecessary NPC data, unnecessary dialogue
context. Use asset streaming and resource management.

## 11. Asset budget
Every major asset considers polys, texture res, material count, shader
complexity, collision complexity, animation cost. No desktop-quality assets
unchanged. Use LOD variants (characters LOD0–2; environment LOD0–3/impostor).

## 12. World visual quality
Mobile-first ≠ ugly. Get quality from art direction: strong composition,
baked lighting, controlled fog, high-quality textures where visible, careful
lights, atmospheric grading, good materials, detailed foreground, simplified
distance, strong environmental storytelling. Prioritize quality where the
player looks. (See MOBILE_ART_DIRECTION.md.)

## 13. Input abstraction
Gameplay must NOT depend on "keyboard E" or "left mouse". Use abstract
actions — INTERACT, MOVE, LOOK, SPRINT, CROUCH, JUMP, INVENTORY, MENU —
bound per platform (desktop key / touch button / controller button). This
is how future platforms are added. *(Phase 1 already routes through
InputMap actions; the gap is that LOOK is mouse-only and there is no touch
binding yet.)*

## 14. Dialogue UI on mobile
The LLM dialogue UI must be phone-optimized: readable/adjustable text,
scrolling, text streaming, skip, retry/regenerate, history, quick
responses, optional free-text. Offer both **QUICK RESPONSE** (predefined
buttons: *Ask about work / Give a gift / Talk about cooking / Say goodbye*)
and **FREE CHAT** (typed) — because long typing on mobile is inconvenient.
(Extends DIALOGUE_DESIGN.md.)

## 15. Mobile keyboard
When free-form dialogue is on: the on-screen keyboard must not permanently
obscure the UI; dialogue repositions/scrolls; input field stays accessible;
support submit/cancel/retry. Never require long typing for normal play.

## 16. AI API cost on mobile
Assume limited/expensive data, unstable/high-latency or no connection.
Dialogue must support **ONLINE** and **FALLBACK** modes; the game stays
playable if the API is unavailable. (DIALOGUE_DESIGN.md §12/§18.)

## 17. AI request optimization
Never send oversized prompts or the whole world state. Use context
compression, memory retrieval, conversation summarization, caching, short
system prompts, relevant-only context, token budgets. (DIALOGUE_DESIGN.md
§8.)

## 18. Offline fallback
Offline: authored dialogue, basic greetings, and important quests remain
available; essential gameplay works. AI free conversation may be
disabled/replaced by fallback.

## 19. Network failure
Handle timeout, DNS failure, connection loss, server error, rate limit,
quota exhaustion. Never freeze waiting for the AI: `request → timeout →
retry → fallback`.

## 20. Battery
Avoid unnecessary background processing; be event-driven. Do not constantly
poll NPCs/weather/world/network/AI unless required. Reduce simulation
frequency for distant objects. (Reinforces the WorldEvents signal-driven
design, ARCHITECTURE.md §5/§12.)

## 21. Thermal management
Stay playable in long sessions; don't hold max GPU/CPU when unnecessary;
allow quality scaling; leave room for future adaptive quality.

## 22. Mobile save system
Safe local saves; never lose progress on minimize/lock/suspend/OS-kill.
**Autosave at safe moments**; do not save every frame. (SaveManager already
uses a single versioned file — ARCHITECTURE.md §11.)

## 23. App lifecycle
Handle START / PAUSE / RESUME / BACKGROUND / TERMINATION and restore player,
world, dialogue (where appropriate), inventory, relationships, quests, time.

## 24. Performance profiling
Never claim "mobile optimized" without profiling. Maintain a mobile
performance checklist; measure FPS, frame time, CPU/GPU, RAM, VRAM, draw
calls, triangles, shader cost, load time, scene-transition time,
battery/thermal.

## 25. Development device target
At least one **mid-range Android device** is the baseline. Do not develop
solely on a high-end PC and assume it runs on phones. PC preview aids
development; it is **not** proof of mobile performance.

## 26. Mobile-first success criteria
The foundation is successful only when: touch movement works; touch camera
works; interaction works; dialogue works on a phone screen; UI is readable;
loading is acceptable; save/resume works; API failure doesn't break
gameplay; world streaming works; NPC simulation scales with distance;
graphics can be lowered; performance is measurable; the game runs for
extended sessions without obvious instability.

## 27. Priority order
When choosing visual quality vs. performance, do **not** auto-pick max
graphics. Choose the highest visual quality that maintains the target mobile
experience. Priority: **1 Stability · 2 Playability · 3 Input
responsiveness · 4 Loading reliability · 5 Performance · 6 Visual quality ·
7 Advanced effects.** A beautiful game that can't hold a playable frame rate
has failed.

---

## Reconciliation with existing docs (what changes, and when)

This requirement landed mid-Phase-1. Nothing was silently rewritten; the
affected systems adopt it as they are built or revisited. **Phase 1b is now
implemented** (state legend: `IMPLEMENTED` = code exists + reviewed;
`TESTED`/`VERIFIED` require running it — see godot/PHASE1B_TEST_PLAN.md):

| Area | Change required | Status |
|---|---|---|
| **Input** (ARCHITECTURE.md §4) | Touch layer (joystick, look-drag, contextual interact) behind the same abstract actions; keyboard/mouse preserved | ✅ `IMPLEMENTED` (Phase 1b) — `GameInput` |
| **Camera** | Settings for sensitivity (H/V), FOV, smoothing, bob/shake; comfort defaults | ✅ `IMPLEMENTED` (shake stored; no shake system yet) |
| **UI/HUD** (ART_DIRECTION.md §8) | Touch-target sizes, safe areas, aspect-ratio support | ✅ `IMPLEMENTED` — `MobileHud` (safe-area inset) |
| **Graphics** | LOW/MED/HIGH(/ULTRA) presets + settings surface | ✅ `IMPLEMENTED` — `GraphicsManager` + pause menu |
| **Lifecycle/save** (ARCHITECTURE.md §11) | Autosave at safe moments + pause/resume/background handling | ✅ `IMPLEMENTED` — `AppLifecycle`, `AutosaveManager` |
| **World/streaming** (ARCHITECTURE.md §3) | Distance-based streaming + fog/occlusion to hide loads | ⏳ Phase 2+ (seam ready) |
| **NPC sim** (GAME_SYSTEMS.md §4) | L0–L3 tiered simulation from the start | ⏳ Phase 3 |
| **Dialogue UI** (DIALOGUE_DESIGN.md) | Quick-response + free-chat, keyboard handling, online/fallback | ⏳ Phase 3+ |
| **Profiling / on-device perf** | Mobile perf checklist + real-device tests (MOBILE_ART_DIRECTION.md §52) | ⏳ `UNVERIFIED` until Android run (M10) |

**Everything in Phase 1b is `IMPLEMENTED` but not yet `TESTED`/`VERIFIED`**,
and **mobile performance is explicitly `UNVERIFIED`** until it runs on a
real mid-range Android device (§24, §25).

**Plan:** validate the core on PC (godot/PHASE1_TEST_PLAN.md) **and** the
mobile layer (godot/PHASE1B_TEST_PLAN.md, incl. an Android launch) → then
Phase 2 (world). ART_DIRECTION.md and TECHNICAL_ROADMAP.md get a fuller
mobile-first pass during Phase 2; this doc + MOBILE_ART_DIRECTION.md are the
authority in the meantime.
