# Phase 1 — Manual Test Plan (Godot 4)

> Purpose: the **RUNTIME TESTED / ANDROID VERIFIED** gate for the Phase 1
> core — the parts that need real input, physics, and rendering. The code is
> already `STATICALLY VALIDATED` + `HEADLESS TESTED` in the container (see
> VALIDATION.md: import clean, boot clean, 42/42 logic tests), so the boot
> path and logic units are proven; what remains is the *felt* behavior that
> only a running window/device can confirm. Each test below is
> **REQUIRES EXTERNAL DEVICE** (Godot editor or Android). **If a test fails:
> report it (per its "Report back"), I fix it, you re-test.**
>
> Scope note (mobile-first): these tests validate the **core architecture**
> using PC keyboard/mouse. That is a legitimate development step
> (MOBILE_ART_DIRECTION.md §25: "PC preview is useful for development… NOT
> proof of mobile performance"). Touch controls, graphics presets, and
> on-device profiling are a **separate, required** foundation addition
> tracked after this core passes — see MOBILE_FIRST.md and the note at the
> end of this file. Do not treat "passes on PC" as "mobile-ready."

---

## Pre-flight

**P0. Open the project.**
- **Action:** Launch Godot 4 (a recent stable 4.x). In the Project Manager
  → Import → select `godot/project.godot` → Import & Edit.
- **Expected:** The editor opens. The **Output** panel (bottom) and
  **Debugger** panel show no red script errors. Godot may reimport assets
  and regenerate `.tscn`/`.godot` files on first open — that is normal.
- **Failure:** Any red "Parse Error", "Invalid Casting", "Identifier not
  found", or "Autoload not found" message; or the editor refuses to open
  the project.
- **Report back:** Your exact **Godot version** (Help → About, e.g.
  4.3.stable). Copy the **full text** of any error in Output/Debugger,
  including the script name and line number. This is the single most
  useful thing you can send me.

> How to read errors throughout: keep the **Output** panel open while
> playing (it captures `print`, `push_warning` in yellow, `push_error` and
> script errors in red). When something breaks, the Debugger panel shows a
> stack trace — copy it verbatim.

---

## Group A — Boot & data

### Test A1 — Autoloads & item data load
- **Action:** With the project open, look at the **Output** panel right
  after opening (or press Play once and watch the first lines).
- **Expected:** A line `ItemRegistry: loaded 3 item definition(s).` No
  errors from `WorldEvents`, `SaveManager`, `ItemRegistry`, or
  `TimeManager`.
- **Failure:** "loaded 0 item definition(s)", a "no items directory"
  warning, JSON parse errors, or any autoload error. (0 items likely means
  the `res://data/items` path or the JSON is not found/valid.)
- **Report back:** The exact ItemRegistry line and any autoload errors.

### Test A2 — Main scene launches
- **Action:** Press **Play** (F5 in the editor / the ▶ button). Click the
  game window once so it has focus.
- **Expected:** A 3D scene appears: a grey ground plane, a small
  house-shaped structure ahead, a freestanding door to the right, two
  small boxes (pickups) on the ground, a "+" crosshair in the center, and
  a top-left HUD reading roughly `Day 0  08:00 (Morning) / Items: 0 /
  [F5] save [F9] load`. The mouse cursor is hidden (captured).
- **Failure:** Black screen, no crosshair, no HUD, the camera is at a wrong
  height/orientation (e.g. under the floor, looking straight down), or the
  game crashes on launch.
- **Report back:** Does it launch? A screenshot of what you see. Any errors
  printed at startup.

---

## Group B — Player movement & camera

### Test B1 — Mouse look + capture toggle
- **Action:** With the game focused, move the mouse. Then press **Esc**.
  Move the mouse again. Press **Esc** again.
- **Expected:** Moving the mouse rotates the view (left/right = turn,
  up/down = look up/down). Looking up/down **stops** at roughly straight
  up / straight down (it does not flip over). First **Esc** frees the
  cursor (arrow reappears, view stops following the mouse); second **Esc**
  re-captures it.
- **Failure:** View doesn't rotate; inverted or wildly over-sensitive;
  pitch flips past vertical; Esc doesn't free/recapture the cursor.
- **Report back:** Which parts work. Is sensitivity usable, too fast, or
  too slow? (This directly feeds the mobile sensitivity settings later.)

### Test B2 — Walk & sprint
- **Action:** Hold **W** (or ↑) to walk forward; strafe with **A/D**; walk
  backward with **S**. Then hold **Shift** while moving.
- **Expected:** You move in the direction you're facing; strafing is
  relative to the camera. Holding Shift is noticeably faster.
- **Failure:** No movement; moves in the wrong direction relative to
  where you look; sprint has no effect; movement is jittery/stuttering.
- **Report back:** Do all four directions work relative to the camera?
  Does sprint change speed?

### Test B3 — Crouch
- **Action:** Hold **Ctrl** while standing still, then while moving.
- **Expected:** The camera lowers smoothly (eye height drops) and movement
  is slower while held; releasing raises it back.
- **Failure:** No height change; snaps instantly instead of smoothly; can't
  move while crouched; camera never returns to standing height.
- **Report back:** Does the camera lower/raise smoothly? Is movement slower
  while crouched?

### Test B4 — Jump, gravity & collision
- **Action:** Press **Space** to jump. Walk into a house wall. Walk to the
  edge of the ground plane. Walk off it (if you can reach the edge).
- **Expected:** You hop up and fall back down (gravity). You **cannot** pass
  through walls. You stand on the ground without sinking or falling through.
- **Failure:** No jump; float/never fall; fall through the ground; pass
  through walls; get stuck on flat ground.
- **Report back:** Jump works? Gravity returns you to the ground? Walls
  block you? Do you ever fall through the floor?

### Test B5 — Head bob
- **Action:** Walk forward on flat ground and watch the view; then stand
  still.
- **Expected:** A gentle up/down (and slight side) bob while walking that
  settles to still when you stop. Subtle, not nauseating.
- **Failure:** No bob at all; violent/large bob; bob continues while
  standing still; view drifts and never re-centers.
- **Report back:** Is there a bob? Is it subtle or too strong? (Mobile
  needs this to default subtle/adjustable — MOBILE_ART_DIRECTION.md §5.)

---

## Group C — Interaction

### Test C1 — Prompt appears and clears
- **Action:** Walk up to a pickup box and point the crosshair at it (get
  within ~2.5 m). Then look away.
- **Expected:** A prompt like `[E]  Pick up Fish x2` appears near the
  center-bottom when aimed at it; it disappears when you look away or step
  out of range.
- **Failure:** No prompt ever appears; prompt shows the wrong item/text;
  prompt never clears when you look away.
- **Report back:** Does the prompt appear/clear correctly? What exact text
  do you see for each box?

### Test C2 — Pick up items (inventory + stacking)
- **Action:** Aim at the **Fish** box (near the house) and press **E**.
  Watch the HUD "Items" count. Then pick up the **Rice** box.
- **Expected:** On each pickup, the box disappears, and the HUD "Items"
  count increases (each new item type = a new slot, so it should read
  `Items: 1` after the first, `Items: 2` after the second). The prompt
  clears once the object is gone.
- **Failure:** Pressing E does nothing; the box doesn't disappear; the
  count doesn't change; an error is printed; the count jumps oddly.
- **Report back:** Does the count go 0 → 1 → 2 as you pick up each? Any
  errors on pickup?

### Test C3 — Door open / close
- **Action:** Walk to the freestanding door (to the right of spawn), aim at
  the door leaf, press **E**. Aim and press **E** again.
- **Expected:** Prompt reads `[E]  Open door`; pressing E swings the leaf
  open (rotates ~90°) and the prompt becomes `[E]  Close door`; pressing E
  again closes it.
- **Failure:** No prompt; E does nothing; the whole door/frame moves
  instead of just the leaf; it opens but never closes; it rotates around
  the wrong point.
- **Report back:** Does it open and close? Does only the leaf swing (not
  the posts)?

---

## Group D — Scene transitions

### Test D1 — Enter the house
- **Action:** Walk to the house's front doorway (the brown slab in the gap
  in the front wall), aim at it (prompt `[E]  Enter house`), press **E**.
- **Expected:** The view changes to an enclosed interior room; you are
  standing just inside it (not floating, not stuck in a wall). There is an
  egg pickup and an exit slab.
- **Failure:** Nothing happens; you fall through the floor of the interior;
  you spawn inside a wall or in darkness with no floor; an error prints
  ("could not load location scene"); the interior overlaps the exterior
  visually.
- **Report back:** Do you get placed correctly inside a room? Screenshot of
  the interior. Any load errors.

### Test D2 — Pick up inside, then exit
- **Action:** Inside, pick up the **Egg** (aim, E). Then aim at the exit
  slab (prompt `[E]  Exit house`) and press **E**.
- **Expected:** Egg pickup increments the item count; exiting returns you
  **outside**, at the spot where you entered (facing the house), not at the
  world origin or inside the wall.
- **Failure:** Egg won't pick up; exit does nothing; you return to the
  wrong place (origin, floating, or inside geometry); the interior stays
  loaded/visible after exit.
- **Report back:** Does exit return you to where you entered? Item count
  after egg?

---

## Group E — Time & save/load

### Test E1 — Clock advances
- **Action:** Stand still ~30–60 seconds and watch the HUD top-left clock.
- **Expected:** The time (`08:00`, `08:01`, …) advances (default ≈ 1 game
  minute per real second). The "Day" and block label (Morning/Afternoon/…)
  are shown; the block label changes if you wait long enough to cross a
  boundary (e.g. into Afternoon at 12:00 — not required to wait that long).
- **Failure:** Clock frozen; time jumps erratically; block label wrong for
  the time shown; errors from TimeManager.
- **Report back:** Does the clock tick up second by second?

### Test E2 — Save writes a file
- **Action:** Press **F5**.
- **Expected:** A `Saved [F5]` toast appears briefly (center-bottom). A file
  is written to the user data dir. (To confirm the file: editor menu
  **Project → Open User Data Folder**, look for `savegame.json`; opening it
  shows JSON with `version`, `systems.player`, `systems.time`.)
- **Failure:** No toast; an error on F5; no file created; the JSON is empty
  or malformed.
- **Report back:** Toast shown? Does `savegame.json` exist and contain
  `player` (with position + inventory) and `time`? Paste its contents if
  unsure.

### Test E3 — Load restores state (the key round-trip test)
- **Action:** After saving (E2), **move** to a clearly different spot,
  **look** in a different direction, **pick up** another item (count goes
  up), and let the **clock** advance a bit. Then press **F9**.
- **Expected:** A `Loaded [F9]` toast; you are **teleported back** to the
  saved position and camera orientation; the HUD "Items" count reverts to
  what it was at save time; the clock resets to the saved time.
- **Failure:** F9 does nothing; position/orientation not restored;
  inventory count wrong after load; time not restored; an error prints;
  the player ends up underground/in a wall.
- **Report back:** Which of {position, look direction, item count, time}
  correctly revert, and which do not. Any errors.

---

## Group F — Robustness (quick)

### Test F1 — Rapid interaction / freed target
- **Action:** Pick up an item while the prompt is showing; immediately look
  around.
- **Expected:** The prompt for the just-taken item clears immediately (no
  lingering "Pick up …" for an object that no longer exists); no error
  about a freed instance.
- **Failure:** Prompt sticks after the object is gone; "Attempt to call …
  on a previously freed instance" error in Output.
- **Report back:** Any freed-instance errors? Does the prompt clear cleanly?

---

## What to send me back

For the fastest fix cycle, reply with:

1. **Godot version** (e.g. `4.3.stable`).
2. A **per-test result line**: `A1 PASS`, `A2 PASS`, `B4 FAIL`, … for each
   test above.
3. For every **FAIL**, the **exact error text** from the Output/Debugger
   panel (script name + line + message + stack trace), and one line on what
   you observed vs. expected.
4. A **screenshot** for anything visual (A2, D1) — very helpful.
5. Anything that "works but feels wrong" (sensitivity, bob strength,
   speeds) — I'll note it for the mobile tuning pass.

I'll fix each failure, tell you exactly what changed, and you re-run the
affected tests. We repeat until every test is PASS. **Only then** do we
talk Phase 2.

---

## After the core passes: the mobile-first foundation gap

This plan validates the **core** on PC. Before Phase 2, the foundation
still needs the **primary-platform (Android/touch) layer** now required by
MOBILE_FIRST.md — notably:

- **Touch input** (virtual joystick, look-drag area, contextual interact
  button) behind the existing abstract input actions — the current build
  is keyboard/mouse only.
- **Graphics quality presets** (LOW/MED/HIGH) + a settings surface
  (sensitivity, FOV, head-bob/shake, camera smoothing).
- **App-lifecycle handling** (pause/resume/background, autosave at safe
  moments) and **safe-area** UI.

These are foundation-level (input abstraction is Phase 1 territory), so I
recommend: **validate this core first → add the mobile input/settings/
lifecycle layer as "Phase 1b" → then Phase 2.** I have not built any of it
yet, per your hold on Phase 2. See MOBILE_FIRST.md for the full standing
requirement.
