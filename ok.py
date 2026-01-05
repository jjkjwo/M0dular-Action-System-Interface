# ok.py - Fixed version for compatibility with action_simplified.py

ACTION_NAME = "ok"
ACTION_PRIORITY = 3  # Priority level (after 'back', before 'update/web_input')

_loopback_this_turn_triggered = False  # Track if loopback already triggered in THIS AI turn

async def start_action():
    """Function called when ok action is started."""
    global _loopback_this_turn_triggered
    _loopback_this_turn_triggered = False  # Reset loopback triggered flag on action start
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - AI-Controlled Loopback ('ok') ENABLED. Panic Stop Hotkey: Ctrl+C]")

async def stop_action():
    """Function called when ok action is stopped."""
    global _loopback_this_turn_triggered
    _loopback_this_turn_triggered = False  # Reset loopback triggered flag on action stop
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - AI-Controlled Loopback ('ok') DISABLED.]")

async def process_input(user_input, system_functions):
    """Process user input - for 'ok' action - NO DIRECT INPUT MODIFICATION in priority loop."""
    global _loopback_this_turn_triggered
    _loopback_this_turn_triggered = False  # Reset loopback flag at START of each new user input round
    # 'ok' action primarily works by checking AI output and triggering 'back' action automatically
    return None  # Action does NOT modify user input directly

async def check_and_execute_loopback(system_functions):
    """Checks conditions and executes AI-controlled loopback if criteria are met."""
    global _loopback_this_turn_triggered

    if _loopback_this_turn_triggered:  # Already triggered this turn?
        return None  # Yes, do NOT trigger again - Prevent runaway loop

    # Check if 'back' action is available and active
    # FIX: Call the action_registry function to get the registry dictionary
    registry = system_functions["action_registry"]()  # Changed from system_functions.get("action_registry", {})
    if not registry.get("back", {}).get("is_active", False):
        return None  # 'back' action not active, exit check

    # Get last AI reply
    last_ai_reply_func = system_functions.get("last_ai_reply")
    if not last_ai_reply_func:
        return None  # Cannot get last AI reply function, exit check
        
    last_ai_reply_text = last_ai_reply_func()
    if not last_ai_reply_text:
        return None  # No last AI reply available, exit check

    # Check if AI reply ends with "ok" variants (case-insensitive)
    if (last_ai_reply_text.lower().endswith("ok") or 
        last_ai_reply_text.lower().endswith("okay!") or 
        last_ai_reply_text.lower().endswith("ok ok") or 
        last_ai_reply_text.lower().endswith("ok.") or 
        last_ai_reply_text.lower().endswith("okay")):
        
        # Notify user about loopback trigger
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()} ACTION: AI reply ended with 'ok' (or variant). Triggering AI-Controlled Loopback..."
        )
        
        # Set flag to prevent re-triggering in same turn
        _loopback_this_turn_triggered = True
        
        # Return the last AI reply to trigger loopback
        return last_ai_reply_text

    return None  # No loopback triggered - conditions not met