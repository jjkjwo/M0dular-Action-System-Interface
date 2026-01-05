# resend.py - Re-send Last User Prompt (V5.2 - With Reprompt)
# This version uses the system's intended 'send_command' function and now
# responds to both "resend" and "reprompt" commands.

import command_system

ACTION_NAME = "resend"
ACTION_PRIORITY = 2.5
_is_active = False
_last_user_prompt = None # Stores the last valid, non-command user input
# --- CHANGE: Added reprompt command ---
RESEND_COMMANDS = {"resend", "reprompt"}

async def start_action():
    """Initializes the resend action."""
    global _is_active, _last_user_prompt
    _is_active = True
    _last_user_prompt = None
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Commands: 'resend', 'reprompt']")

async def stop_action():
    """Stops the resend action."""
    global _is_active
    _is_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED]")

async def process_input(user_input, system_functions):
    """
    Handles the 'resend' and 'reprompt' commands by using the system's `send_command` function
    to place the last prompt into the input file for the next loop iteration.
    """
    global _last_user_prompt
    if not _is_active:
        return user_input

    normalized_input = user_input.lower().strip()

    if normalized_input in RESEND_COMMANDS:
        if not _last_user_prompt:
            return "[RESEND: No previous user prompt is available to resend.]"
            
        send_command_func = system_functions.get("send_command")
        if not send_command_func:
            print(f"[{ACTION_NAME.upper()} FATAL_ERROR: The 'send_command' system function is not available.]")
            return "[RESEND: ERROR - Cannot communicate with the main loop. Action failed.]"

        # Handle reprompt - remove last AI response from history
        if normalized_input == "reprompt":
            api_manager = system_functions.get("api_manager")
            if api_manager and hasattr(api_manager, '_conversation_history'):
                # Remove last AI response from history
                if len(api_manager._conversation_history) >= 2:
                    # Pop the last AI response
                    api_manager._conversation_history.pop()
                    # Pop the last user message (we'll resend it)
                    api_manager._conversation_history.pop()
                    print(f"[{ACTION_NAME.upper()}: Cleared last exchange from AI memory for reprompt]")

        try:
            send_command_func(_last_user_prompt)
            if normalized_input == "reprompt":
                print(f"[{ACTION_NAME.upper()}: 'reprompt' executed. Last prompt will be reprocessed with fresh context.]")
                return f"[SYSTEM: Reprompting with fresh context...]"
            else:
                print(f"[{ACTION_NAME.upper()}: 'resend' executed. Last prompt will be processed next turn.]")
                return f"[SYSTEM: The previous prompt has been re-sent to the AI.]"
            
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: An exception occurred during send_command: {e}]")
            return "[RESEND: ERROR - A system error occurred while trying to resend.]"

    if not command_system.is_command(user_input):
        _last_user_prompt = user_input
    
    return user_input


async def process_output(ai_response, system_functions):
    """This addon does not modify the AI's output."""
    return ai_response