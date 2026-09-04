extends Node
## WorldEvents — the single, pure signal bus for cross-system communication.
## See ARCHITECTURE.md §5 / §12. No state lives here; only signals.
##
## Rule: cross-cutting side effects between systems travel through these
## signals, never through direct calls into another system's internals
## (AI_RULES.md Rule 5). Reading another system's public query methods is
## fine; this bus is for *events*.
##
## Only signals actually emitted in the current phase are declared here.
## New systems add their own signals as they are built — do not
## speculatively declare unused ones.

# --- Time (TimeManager, GAME_SYSTEMS.md §1) ---
signal minute_passed(day_index: int, minutes_into_day: int)
signal time_block_changed(old_block: int, new_block: int)
signal day_started(day_index: int)

# --- World / scene loading (ARCHITECTURE.md §3) ---
signal region_loaded(scene_path: String)
signal location_entered(scene_path: String)
signal location_exited()
## Requests handled by the world root (kept decoupled from interactables).
signal location_transition_requested(scene_path: String, spawn_name: String)
signal location_exit_requested()

# --- Interaction (GAME_SYSTEMS.md §3) ---
## Emitted when the player's focused interactable changes (or clears → null).
signal interaction_target_changed(interactable: Node)
signal interacted(interactable: Node)

# --- Inventory (GAME_SYSTEMS.md §9) ---
signal inventory_changed()

# --- Save/load (ARCHITECTURE.md §11) ---
signal game_saved()
signal game_loaded()
signal autosaved(reason: String)

# --- App lifecycle (MOBILE_FIRST.md §23) ---
signal app_paused()
signal app_resumed()
