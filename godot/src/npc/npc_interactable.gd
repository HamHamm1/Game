class_name NpcInteractable
extends Interactable
## The NPC's interaction hook (the standard Interactable contract). It shows a
## "TALK" prompt and, on interact, turns the NPC toward the player and emits the
## NPC's `talked` signal. NO dialogue AI/API yet — this is only the seam the
## future dialogue system will connect to (AI_RULES.md Rule 4/5: the player's
## interaction controller only ever calls the Interactable contract).

var npc: NpcPrototype

func can_interact(_player: Player) -> bool:
	return npc != null

func get_interaction_verb(_player: Player) -> String:
	return npc.interact_verb if npc != null else "TALK"

func get_interaction_prompt(_player: Player) -> String:
	if npc == null:
		return ""
	return "Talk to %s" % npc.display_name

func get_interaction_priority() -> int:
	return 5

func interact(player: Player) -> void:
	if npc == null:
		return
	# Talking wins: this stops movement, cancels the roaming destination, holds the
	# NPC in place and faces the player. A future dialogue system opens on `talked`
	# and calls npc.end_talk() when the conversation finishes.
	var pos := player.global_position if player != null else npc.global_position
	npc.begin_talk(pos)
