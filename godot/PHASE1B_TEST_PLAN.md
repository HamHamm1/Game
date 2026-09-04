# Phase 1b — Mobile Foundation Manual Test Plan (Godot 4 / Android)

> Validates the mobile-foundation layer added on top of the Phase 1 core.
> **State legend (as defined by the project):** `IMPLEMENTED` = code exists
> and has been reviewed · `TESTED` = manually tried in the target
> environment · `VERIFIED` = confirmed working by the required test. Every
> item below is currently **`IMPLEMENTED` only** — authored without a
> running editor or an Android device. Nothing is `VERIFIED` until you run
> it.
>
> **Two ways to test:**
> - **On desktop (previews M1–M8):** run the project; press **Esc** to open
>   the pause menu; tick **"Touch controls (preview)"**; Resume. The touch
>   HUD appears and the **mouse acts as a finger** (emulated touch). This
>   previews touch logic but is NOT proof of Android behavior.
> - **On Android (required for M9–M10 and real M1–M4):** export/deploy to a
>   device (see godot/README.md). This is the only real proof
>   (MOBILE_FIRST.md §25).
>
> Report format per test: `M1 PASS` / `M4 FAIL`, plus exact Output/Debugger
> errors, a screenshot for HUD/safe-area items, and any "works but feels
> wrong" notes (sensitivity, target size).

---

### M1 — Touch movement
- **Action:** With touch UI on, drag from the **bottom-left** of the screen
  to work the virtual joystick; push in each direction; release.
- **Expected:** The joystick base appears where you first touch; the player
  moves **camera-relative** (up = forward relative to where you look);
  small movements near center do nothing (dead zone); releasing stops
  movement. Keyboard WASD still works simultaneously.
- **Failure:** No joystick appears; no movement; movement ignores camera
  direction; no dead zone (drifts from tiny touches); joystick stuck after
  release; keyboard stops working.
- **Report:** Does the joystick move you camera-relative? Dead zone ok?
  Does keyboard still work?

### M2 — Touch camera
- **Action:** Drag anywhere **not** on a control (the look area) to rotate
  the view. Try horizontal and vertical. Then drag on the joystick and a
  button while looking.
- **Expected:** Dragging looks around; pitch clamps (no flip); H and V feel
  independent; dragging **on** the joystick/buttons does **not** move the
  camera (no accidental look). Sensitivity is adjustable in Settings.
- **Failure:** Look doesn't respond; inverted/uncontrollable; pitch flips;
  touching the joystick also swings the camera; camera jumps when a second
  finger lands.
- **Report:** Does look work? Does using the joystick/buttons avoid moving
  the camera? Is sensitivity comfortable?

### M3 — Contextual interact
- **Action:** Aim the crosshair at a pickup / door / house doorway. Watch
  the right-side interact button. Tap it. Then look at nothing.
- **Expected:** The interact button appears **only** when a target is
  detected and shows the contextual verb — `PICK UP`, `OPEN`/`CLOSE`,
  `ENTER`, `EXIT`. Tapping it performs the interaction (item picked up, door
  opens, etc.). It hides when there is no target. The screen center stays
  clear of buttons.
- **Failure:** Button always visible or never visible; wrong/blank verb;
  tapping does nothing; button covers the crosshair/center.
- **Report:** Does the button appear only on a target, with the right verb,
  and perform the action?

### M4 — Mobile HUD
- **Action:** Look at the whole screen with touch UI on.
- **Expected:** Joystick (bottom-left), action buttons SPRINT/CROUCH/JUMP
  (bottom-right), contextual interact (right), menu ☰ (top-right), and the
  status readout (clock/items, top-left). Center is visually clear. Buttons
  are large enough to tap comfortably.
- **Failure:** Overlapping/off-screen controls; buttons too small; clutter
  in the center; missing controls.
- **Report:** Screenshot. Are targets big enough? Anything overlapping or
  off-screen?

### M5 — Settings persistence
- **Action:** Open pause (Esc / ☰) → change **FOV**, **look sensitivity**,
  **head bob**, and **graphics quality**. Resume and confirm they took
  effect. **Fully close the game and relaunch.** Reopen settings.
- **Expected:** Changes apply immediately (FOV visibly changes, bob
  changes, etc.) and **persist** across a full restart (values are the ones
  you set). A `user://settings.json` file exists.
- **Failure:** Changes don't apply; don't persist after restart; settings
  file missing/corrupt; a slider resets on reopen.
- **Report:** Which settings apply live? Do all persist after a restart?

### M6 — Graphics presets
- **Action:** In settings, switch **LOW → MEDIUM → HIGH** (and ULTRA).
- **Expected:** Visible differences: shadows off on LOW; shadow distance /
  view distance / fog density change; on HIGH glow + SSAO appear; the image
  may get sharper on HIGH (higher 3D resolution scale). No crash on any
  preset.
- **Failure:** No visible change between presets; a preset errors or crashes;
  shadows stay on at LOW.
- **Report:** Do LOW/MEDIUM/HIGH look meaningfully different (shadows, fog,
  sharpness)? Any errors switching?

### M7 — Pause / resume
- **Action:** Press **Esc** (desktop) or tap **☰** (touch) to open the
  menu; confirm the game pauses; press **Resume** (or Esc again).
- **Expected:** Opening pauses the world (the clock stops, movement stops);
  the menu is interactive while paused; Resume unpauses and (desktop)
  recaptures the mouse.
- **Failure:** Game keeps running while menu is open; menu controls don't
  respond while paused; can't resume; mouse not recaptured on desktop.
- **Report:** Does the world pause/resume correctly? Menu usable while
  paused?

### M8 — Autosave
- **Action:** Pick up an item, then enter/exit the house (these are autosave
  triggers). **On desktop**, also alt-tab away from the window (focus-out).
  Then check `user://savegame.json` (Project → Open User Data Folder). To
  confirm restore: relaunch and press **F9** (or trigger a load).
- **Expected:** `savegame.json` updates on those events (its `player`/`time`
  reflect recent state) without you pressing F5; a "Saved" indication may
  appear via the autosave. Loading restores that state. Autosave is
  debounced (not every frame).
- **Failure:** File never updates on triggers; the game hitches/saves every
  frame; save is empty/corrupt; focus-out/quit loses recent progress.
- **Report:** Did the save file update after pickup / area change / focus
  loss? Did a load restore it?

### M9 — Safe-area / aspect-ratio behavior
- **Action:** Run at different window sizes/aspect ratios (desktop: resize
  the window, try a tall/narrow shape). On Android: rotate the device;
  observe a device with a notch/cutout if available.
- **Expected:** HUD controls stay within the visible/safe area (inset from
  edges and any notch), remain readable, and reflow on resize/rotate; no
  control is under a system gesture bar or off-screen; the game view
  fills the screen without stretching UI oddly.
- **Failure:** Controls clipped by edges/notch; UI off-screen at some aspect
  ratio; controls don't move on resize/rotate; UI stretched/distorted.
- **Report:** Do controls stay in the safe area across sizes/rotations?
  Screenshot at a non-16:9 shape.

### M10 — Android launch (the real proof)
- **Action:** Export an Android build (or one-click deploy) and launch on a
  **mid-range** device. Play for a few minutes; background the app (home
  button) and return; lock/unlock the screen.
- **Expected:** The app launches and runs; touch movement/look/interact work
  on the real screen; backgrounding autosaves and returning restores state;
  it stays responsive for an extended session.
- **Failure:** Won't build/install/launch; crashes; controls unusable;
  progress lost on background; severe stutter/overheating.
- **Report:** Device model + Android version. Does it launch and play? Any
  crash logs (adb logcat) or obvious performance problems? **This is the
  only test that proves mobile viability** — until it passes, all mobile
  performance stays `UNVERIFIED`.

---

## Note vs. the Phase 1 core plan

Phase 1b changed one core behavior: **Esc now opens the pause menu** (which
frees the cursor while open) instead of the old capture toggle. When
re-running the Phase 1 core plan (godot/PHASE1_TEST_PLAN.md), treat test B1's
"Esc frees/recaptures cursor" as "Esc opens/closes the pause menu, and the
cursor is free while it's open."

## Phase gate

Do not proceed to Phase 2 until **both** `PHASE1_TEST_PLAN.md` (core) and
this plan (mobile) are all PASS. World-building stays out of scope until
then.
