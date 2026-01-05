# C:\shit\dirt.py

ACTION_NAME = "dirt" # Define action name (must match key in ACTION_MAP in action.py)
ACTION_PRIORITY = 9 # Let's assign it priority 9 for now (Input Modification - Core Actions)

_is_dirt_active = False # Internal state variable to track if 'dirt' is ON or OFF (initially OFF)

async def start_action():  # <---- async
    """Function called when action is started."""
    global _is_dirt_active
    _is_dirt_active = True
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - [dirt] will be appended. AI responses will now be influenced by 'dirt' style. Type 'dirton' to enable, 'dirtoff' to disable, 'stop dirt' to stop action.]") # Updated startup message

async def stop_action():  # <---- async
    """Function called when action is stopped."""
    global _is_dirt_active
    _is_dirt_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - [dirt] appending disabled. AI responses revert to normal style. 'dirton'/'dirtoff' commands no longer available. Type 'start dirt' to restart.]") # Updated stop message

async def process_input(user_input, system_functions):
    """Function to process user input for dirt action, now with functional 'dirt mode'."""
    global _is_dirt_active

    # Handle system commands first
    if user_input.lower() in ["dirton", "dirtoff"]:
        if user_input.lower() == "dirton":
            _is_dirt_active = True
            return "[DIRT ACTION: DIRT MODE - ON. AI responses will now be influenced by 'dirt' style.]"
        else:
            _is_dirt_active = False
            return "[DIRT ACTION: DIRT MODE - OFF. AI responses will revert to normal style.]"

    # If dirt mode is OFF, return original input
    if not _is_dirt_active:
        return user_input

    modified_prompt = user_input # Start with the original user input

    if _is_dirt_active: # If dirt mode is ON
        # --- IMPLEMENT FUNCTIONAL "DIRT MODE" EFFECT HERE ---
        dirt_style_instructions = """
         Respond to the following user input in a style that is:
         - Intentionally unpolished and informal
         - Injecting slang and unexpected, slightly chaotic phrases
         - Occasionally using mildly irreverent or edgy humor (but still appropriate and safe for general conversation)
         - Keeping responses relatively concise and direct
         - Aiming for a 'grungy', 'street-smart', or 'slightly rebellious' persona in your replies.
         - Do NOT explicitly mention that you are in "dirt mode" or that you are adopting this style; make it sound natural.

         User Input: """ # <--- IMPORTANT: Note the "User Input: " prefix - to clearly separate instructions from user's actual input

        modified_prompt = dirt_style_instructions + user_input + " [dirt]" # Prepend instructions + append "[dirt]" visual marker (optional, but helpful)
    else:
        pass # If dirt mode is OFF, no functional modification, just return original input

    return modified_prompt # Return the (potentially modified) prompt