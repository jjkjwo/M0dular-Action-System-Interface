# C:\shit\action\filter.py
# C:\shit\filter.py  (for current dual location setup)

ACTION_NAME = "filter"
ACTION_PRIORITY = 7  # Assign priority level - After input modifiers (like x, dirt), before final output in main loop - Adjust as needed.

_is_filter_active = False # Module level variable to track filter state (initially OFF)

async def start_action():
    """Function called when filter action is started."""
    global _is_filter_active
    _is_filter_active = True
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Output filtering ENABLED. Only essential messages will be shown. Use 'stop filter' to disable.]")

async def stop_action():
    """Function called when filter action is stopped."""
    global _is_filter_active
    _is_filter_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Output filtering DISABLED. All messages will be shown.]")

async def process_input(user_input, system_functions):
    """Process user input - for 'filter' action - implements output filtering based on _is_filter_active state."""
    global _is_filter_active

    if not _is_filter_active:
        return user_input  # Filter is OFF - return original input (no filtering)
    else:
        # --- FILTERING LOGIC ---
        if user_input.startswith("[LOG EVENT:"):
            return ""  # Suppress LOG EVENT messages
        elif user_input.startswith("[priority_level_"): # Suppress priority level messages
            return ""  # Suppress priority level messages
        else:
            return user_input  # Show other messages (not filtered)