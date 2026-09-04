# AI_RULES.md

> **Read this file first, every session, before touching anything.**
> It is the operating contract for any contributor — AI agent or human —
> working on this project. It is short on purpose. If a rule here conflicts
> with what you were about to do, the rule wins; if a rule here conflicts
> with DESIGN.md or ARCHITECTURE.md, stop and raise it (Rule 12) rather
> than silently picking one.
>
> Status note: the project is in **Phase 0 → Phase 1** (see
> TECHNICAL_ROADMAP.md). Most systems described in ARCHITECTURE.md do not
> exist yet. "Check the existing implementation before writing" therefore
> often means confirming that something genuinely does *not* exist yet —
> which is itself the answer, not a reason to skip the check.

---

## 0. The one-paragraph version

Read the docs before you write. Prefer data over code. Reuse the existing
interface instead of inventing a parallel one. Never let core engine code
(player, cooking, quest, NPC, save) grow per-content special-cases —
content is data. Don't copy code, assets, or writing from the reference
projects. Don't claim something works until you've actually run it. When
something is bigger than a local fix or the docs don't cover it, stop and
ask instead of guessing.

---

## 1. Read the documentation before changing code

Before writing or modifying anything, read — in this order — the parts of
these that touch your task:

1. **DESIGN.md** — what we're building and why (the intent your change
   must serve).
2. **ARCHITECTURE.md** — where things live and how they communicate (the
   shape your change must fit).
3. The relevant **`reference_analysis/*.md`** — if your task touches a
   system a reference informed (interaction, NPC schedules, camera,
   animation, streaming), the rationale and the "do NOT copy" list are
   there.
4. The granular design doc for your system once it exists (NPC_DESIGN.md,
   COOKING_DESIGN.md, etc.).

If your change would contradict any of these, that is a signal to escalate
(Rule 12), not to quietly diverge.

## 2. Check dependencies before editing a file

Before editing a file, find out who depends on it: search for its
`class_name`, its file path in `preload`/`load`, its autoload name, and
any signals it emits or connects to. A change to a shared class,
interface, autoload, or signal is a change to every one of its callers —
treat it as such. Never edit a signature, a signal payload, or a saved
data field without checking every consumer first.

## 3. Do not build a second way to do something that already exists

Before adding a system, a manager, a signal bus, an interaction path, or a
data loader, confirm the project does not already have one. We deliberately
run **one** signal bus (`WorldEvents`), **one** `Interactable` contract,
**one** save contract (`get_save_data`/`load_save_data`), **one** item
definition-vs-instance split, and so on (ARCHITECTURE.md §5, §6, §8, §11).
A parallel mechanism is a bug even if it works.

## 4. Content is data, not code — this is the core rule

The whole architecture exists to make this true (ARCHITECTURE.md §13,
DESIGN.md §7). Therefore:

- A new NPC, recipe, quest, dialogue branch, item, or schedule is a
  **data** addition under `data/` (plus, for an NPC, an entity package
  under `entities/`). It must require **zero** edits to the corresponding
  `src/` engine code.
- If adding content *seems* to require editing `src/npc/`, `src/cooking/`,
  `src/quest/`, `src/dialogue/`, `src/inventory/`, or `Player.gd`, you are
  either missing an existing extension point or you have found a genuine
  architecture gap. **Stop and escalate (Rule 12).** Do not add a
  special-case branch to core code to ship one piece of content — that is
  precisely the failure mode this project is built to prevent.
- `Player.gd` specifically must never grow per-object-type interaction
  logic, per-NPC dialogue logic, or per-recipe cooking logic
  (ARCHITECTURE.md §4).

## 5. Use the existing interfaces and communication channels

- Interactables extend `Interactable` and override only what differs
  (ARCHITECTURE.md §6). Do not add interaction logic to the player.
- Cross-system, cross-cutting communication goes through `WorldEvents`
  signals (ARCHITECTURE.md §5, §12) — a quest reacting to a relationship
  change, an NPC reacting to weather, UI reacting to inventory. Reading
  another registry's public query methods is fine; reaching into another
  system's private state, or triggering a side effect in another system by
  a direct call, is not.
- Animation is driven through the verb-based skin façade
  (`idle()`/`walk()`/`cook()`/…), never by touching an `AnimationTree`
  from gameplay code (ARCHITECTURE.md §4, §7).
- Anything persistent implements `get_save_data()`/`load_save_data()`
  (ARCHITECTURE.md §11) rather than inventing its own save path.

## 6. Data-driven design is the default

New tunables are `@export`ed (and documented with `##` doc-comments, the
style confirmed good in `reference_analysis/gdquest-tps-demo.md`), not
hard-coded magic numbers. New content is data files. Hard-coded dialogue,
hard-coded NPC schedules, and hard-coded item behavior are explicitly
banned (master-prompt §25). The data format (custom `Resource`/`.tres` vs.
schema-validated JSON) is an open Phase-1 decision recorded in
ARCHITECTURE.md §9 and resolved in TECHNICAL_ROADMAP.md — follow whatever
that decision lands on; do not mix formats ad hoc.

## 7. Prefer typed GDScript

Use `class_name`, typed variables, typed function signatures, and typed
exports. The reference study specifically flagged untyped
`Variant`/`has_method()` duck-typing as a weakness in `openacre` and
`3d-fpp-interaction-demo` (see their `reference_analysis/` files); our
`Interactable` contract is a typed interface *because* of that finding.
Reach for duck-typing only where a typed interface genuinely cannot
express the need, and say why in a comment.

## 8. Write tests for important systems; validate before claiming done

For any non-trivial system (save/load round-trip, cooking quality
resolution, quest state transitions, schedule evaluation, relationship
math), add a test or a runnable in-editor check. Before saying a change is
finished, actually run it: open the project in Godot, exercise the path,
and confirm scenes load, resource paths resolve, and there are no script
errors. See Rule 11 for the honesty requirement around this.

## 9. Keep the codebase AI- and human-navigable

Clear names, single responsibility per script, minimal coupling, no giant
scripts, no duplicated logic, no circular dependencies, no unnecessary
global state (master-prompt §25). The test is ARCHITECTURE.md §13.7: a new
contributor should be able to predict where a given feature's code and
data live from the docs alone. Every change should keep that true.

## 10. Do not break APIs or delete systems blindly

- Do not change a public API (a method signature, a signal, an autoload's
  public surface, a saved data schema) without checking every caller
  (Rule 2) and updating them in the same change.
- Do not delete or replace an existing system without first checking what
  references it. Preserve backward compatibility where reasonable —
  especially the save format, which carries a version field precisely so
  fields can be added without breaking old saves (ARCHITECTURE.md §11).
- The one large, sanctioned deletion is the retirement of the old Spirit
  World MMORPG code, which happens in its own dedicated commit once the
  new foundation is validated (DESIGN.md §0) — never silently, never mixed
  with new-feature work.

## 11. Report real status — never fake completion

Do not say "done" if code doesn't run, a scene reference is missing, a
resource path is wrong, a dependency is absent, a feature is untested, or
save/load doesn't round-trip (master-prompt §38). Report status honestly
using these labels:

`IMPLEMENTED` · `PARTIALLY IMPLEMENTED` · `BLOCKED` · `NOT IMPLEMENTED` ·
`NEEDS ART` · `NEEDS TESTING`

If tests fail, say so and show the output. If a step was skipped, say
which. State something is done only when you have verified it.

**Validation ladder (this project is Android-first, developed without a
desktop — see VALIDATION.md).** For "does it actually work" claims, use the
precise ladder and never skip a rung: `IMPLEMENTED` → `STATICALLY
VALIDATED` (tools/static_validate.py) → `HEADLESS TESTED`
(tools/run_validation.sh) → `RUNTIME TESTED` (editor/device) → `ANDROID
VERIFIED` (real device). Never claim `ANDROID VERIFIED` without an actual
Android run. Anything that fundamentally needs the editor or a device is
`REQUIRES EXTERNAL DEVICE` — do not hand the user a desktop-only test as if
they could run it. Run the automated gates (`tools/run_validation.sh`)
after code changes.

## 12. When it's bigger than a local fix, or you're unsure — stop and raise it

- If you discover an architecture problem, a missing extension point, or a
  contradiction between the docs and the code, **report it before making a
  large change**, don't route around it with a hack.
- Don't guess at important architecture. Check the source, the docs, the
  engine API, and the existing implementation first. If still unsure,
  choose the solution that is **simple, modular, reversible, and
  documented** (master-prompt §39) — and note the uncertainty.
- Scope discipline (from the PR/CI rules and master-prompt §41): keep each
  change minimal — what the task needs, no more. Don't widen a change on
  your own initiative.

---

## Originality & Licensing — a hard boundary, not a guideline

This project is **original**. The repositories in `reference_analysis/`
were studied for architecture and design patterns only.

- **Never copy** source code, models, textures, audio, fonts, animations,
  UI, dialogue, story, level layouts, or branding from any reference
  project into this repository — not even from the MIT-licensed ones. Where
  a permissive license would have allowed reuse, reimplementing
  independently is a deliberate choice in service of originality
  (DESIGN.md §8).
- **Treat source-code licenses and asset licenses separately.** "The repo
  is MIT" never implies its assets are usable. Each reference's
  `reference_analysis/` file records its code license and asset license
  distinctly, with an explicit "do NOT copy" list.
- **Copyleft is a trap to avoid, not a hoop to clear.** `openacre` is
  GPLv3 code + CC BY-SA 4.0 assets; `godot-4-3d-characters` assets are
  CC-BY-NC-SA 4.0. Pulling any of that in would force those terms onto our
  project. Study the pattern, write our own implementation.
- **If a license is unclear, do not use the asset.** Studying it for
  reference is fine; shipping it is not. Create an original replacement.
- Everything under `assets/` must be **original** to this project (or
  something we have separately and explicitly cleared and attributed —
  recorded in the file/commit, not assumed).
- Before adding anything under `addons/`, evaluate its license and justify
  the dependency in TECHNICAL_ROADMAP.md. `addons/` stays empty until a
  specific need is justified (ARCHITECTURE.md §2).

---

## The development loop (follow this per system)

From master-prompt §37, condensed:

1. Read DESIGN.md for the intent.
2. Read ARCHITECTURE.md for the shape.
3. Search for an existing implementation / extension point (Rule 3).
4. Check references and dependencies (Rule 2).
5. Propose an implementation plan, broken into small tasks.
6. Implement, matching surrounding code style.
7. Test / run it (Rule 8).
8. Inspect for errors honestly (Rule 11).
9. Update the relevant documentation when the architecture changes.
10. Append a dated entry to **CHANGELOG.md**.

Small → Stable → Modular → Expandable → Beautiful. Architecture first,
then a real vertical slice, then content — never a throwaway demo that
passes once (master-prompt §43).
