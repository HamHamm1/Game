# Android Verification Checklist (A–T)

> The **ANDROID VERIFIED** gate for Phase 1 + Phase 1b. Run every item on a
> **real Android device** (mid-range is the baseline target, MOBILE_FIRST.md
> §25) after installing the debug APK (ANDROID_BUILD.md). Nothing in the
> project is marked `ANDROID VERIFIED` until these pass — and **Phase 2
> stays BLOCKED** until then.
>
> This is the on-device counterpart to `PHASE1_TEST_PLAN.md` (core) and
> `PHASE1B_TEST_PLAN.md` (mobile). The code is already `STATICALLY
> VALIDATED` + `HEADLESS TESTED` (VALIDATION.md); these items cover what
> only a device can prove.
>
> Report per item: `A PASS` / `G FAIL`, plus device model + Android version,
> a screenshot for visual items, and — for failures — anything from
> `adb logcat` (if you have a PC) or the on-screen error. If you have no PC,
> a photo/screen-recording of the failure is enough.

| # | Test | Action | Expected | Failure |
|---|---|---|---|---|
| **A** | APK installation | Install `aletheia-phase1-debug.apk` (adb or file manager). | Installs without a parser/signature error; icon appears. | Won't install; "app not installed"; signature error. |
| **B** | App launch | Tap the icon. | Launches to the 3D blockout scene with the touch HUD and top-left status (Day/clock/items); no crash. | Black screen; immediate crash; ANR. |
| **C** | Touch joystick | Drag from bottom-left. | Player moves camera-relative; dead zone near center; stops on release. | No joystick; no movement; ignores facing. |
| **D** | Touch camera | Drag elsewhere (look area). | View rotates, pitch clamps; H/V independent; dragging on UI does not move the camera. | No look; inverted/uncontrolled; UI touches move camera. |
| **E** | Contextual interaction | Aim at a pickup/door/doorway; tap the interact button. | Button appears only on a target with the right verb (PICK UP/OPEN/ENTER); tapping performs it. | Button always/never shows; wrong verb; no-op. |
| **F** | First-person movement | Walk/sprint/crouch/jump via joystick + buttons. | Smooth movement; sprint faster; crouch lowers view; jump arcs. | Stutter; buttons dead; no crouch/jump. |
| **G** | Physics / collision | Walk into walls; stand on ground; walk off edges. | Walls block; stands on floor; gravity returns you down. | Passes through walls; falls through floor; floats. |
| **H** | Door interaction | Interact with the freestanding door twice. | Leaf swings open ~90°, then closes; only the leaf moves. | No move; whole frame moves; opens-only. |
| **I** | House transition | Enter the house doorway; then the interior exit. | Interior loads, placed inside; exit returns you outside where you entered. | Fall through; spawn in wall; wrong return spot. |
| **J** | Inventory | Pick up fish/rice/egg. | HUD item count rises; objects disappear; stacks behave. | Count wrong; object stays; error. |
| **K** | Dialogue/UI readiness | Confirm HUD text (clock, item count, prompts/verbs) renders crisply. | Text legible at phone DPI; no clipping/overlap; interact verb readable. | Unreadable/clipped text; overlap. (Full dialogue UI is Phase 3 — this checks UI text rendering only.) |
| **L** | Settings persistence | Change FOV/sensitivity/head-bob/graphics; **fully close & relaunch**. | Changes apply live and persist across restart (`settings.json`). | Not applied; reset after restart. |
| **M** | Graphics presets | Switch LOW/MEDIUM/HIGH(/ULTRA). | Visible differences (shadows off on LOW; fog/view distance/sharpness change); no crash. | No difference; crash on a preset. |
| **N** | Safe-area layout | Observe on a device with a notch/cutout; rotate. | Controls inset from edges/notch; nothing under gesture bars/off-screen. | Controls clipped/off-screen/under system bars. |
| **O** | Pause/resume (in-app) | Tap ☰ menu; confirm pause; Resume. | World pauses (clock/movement stop); menu usable; resumes cleanly. | Doesn't pause; menu dead; can't resume. |
| **P** | Autosave (lifecycle) | Pick up an item / change area, then press Home to background the app; reopen. | Progress preserved on return (backgrounding triggered a forced autosave). | Progress lost after backgrounding. |
| **Q** | Save/load | Trigger a load (autosave or a load control). | Position, look, inventory, and time restore to the saved state. | State not restored; corrupt save. |
| **R** | Screen orientation | Rotate the device (portrait↔landscape). | Layout reflows; controls stay usable and in the safe area; no crash. | UI breaks; controls unreachable; crash. |
| **S** | Performance / FPS | Play a few minutes; watch smoothness (enable an FPS overlay if you can). | Holds a playable rate (target ≥30 FPS mid-range, MOBILE_FIRST.md §5). | Sustained low FPS; hitching; input lag. |
| **T** | Long-session stability | Play ~15–30 min continuously. | Stays responsive; no crash; no severe heat/battery spike; memory stable. | Crash/OOM; overheating; degrading performance. |

## After the run

- All A–T PASS → the Phase 1 + 1b foundation is **ANDROID VERIFIED**;
  update VALIDATION.md and unblock Phase 2.
- Any FAIL → report it (per the header); I fix, you rebuild (ANDROID_BUILD.md
  §3) and re-test the affected items. Phase 2 stays BLOCKED until green.
