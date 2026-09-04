extends Node
## AppLifecycle — handles Android/desktop application lifecycle
## (MOBILE_FIRST.md §23). On pause / focus-out / quit it triggers a forced
## autosave so progress survives the player minimizing the app or a phone
## interruption. Emits app_paused / app_resumed on WorldEvents for other
## systems (e.g. pausing simulation) to react.

func _ready() -> void:
	# Intercept desktop window-close so we can autosave before quitting.
	get_tree().set_auto_accept_quit(false)

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED:
			# Android: app is being backgrounded — the critical save moment.
			AutosaveManager.request_autosave("app_pause", true)
			WorldEvents.app_paused.emit()
		NOTIFICATION_APPLICATION_RESUMED:
			WorldEvents.app_resumed.emit()
		NOTIFICATION_APPLICATION_FOCUS_OUT:
			AutosaveManager.request_autosave("app_focus_out", true)
			WorldEvents.app_paused.emit()
		NOTIFICATION_APPLICATION_FOCUS_IN:
			WorldEvents.app_resumed.emit()
		NOTIFICATION_WM_CLOSE_REQUEST:
			AutosaveManager.request_autosave("app_quit", true)
			get_tree().quit()
