class_name Interactable
extends Node
## The single interaction contract every interactive object implements.
## ARCHITECTURE.md §6, GAME_SYSTEMS.md §3. The player's interaction
## controller only ever calls these four methods — it holds no per-type
## branching (AI_RULES.md Rule 4/5).
##
## Convention: an Interactable is placed as a child of the CollisionObject3D
## the interaction raycast can hit. PlayerInteraction resolves collider →
## Interactable by scanning the collider and its ancestors' children.

## May the player interact right now? (e.g. a locked door still shows a
## prompt but returns true and explains itself in interact()).
func can_interact(_player: Player) -> bool:
	return true

## Short text shown on the HUD prompt when this is the focused target.
func get_interaction_prompt(_player: Player) -> String:
	return ""

## Perform the interaction. Concrete subclasses override this.
func interact(_player: Player) -> void:
	pass

## When multiple interactables are in range, the highest priority wins
## (ties broken by nearest). GAME_SYSTEMS.md §3.
func get_interaction_priority() -> int:
	return 0
