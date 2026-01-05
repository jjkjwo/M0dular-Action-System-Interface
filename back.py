# back.py - Web-visible version with improved reliability
import os

ACTION_NAME = "back"  # Define action name
ACTION_PRIORITY = 2   # Assign priority level

async def start_action():
    """Function called when back action is started."""
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - AI Reply Loopback ENABLED. Command: 'back'.]")
    # Write notification to conversation history for visibility
    with open("conversation_history.json", "a", encoding="utf-8") as f:
        f.write(f"[SYSTEM: BACK ACTION STARTED - Type 'back' to repeat the last AI message]\n")

async def stop_action():
    """Function called when back action is stopped."""
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - AI Reply Loopback DISABLED. Command 'back' is no longer active.]")
    # Write notification to conversation history for visibility
    with open("conversation_history.json", "a", encoding="utf-8") as f:
        f.write(f"[SYSTEM: BACK ACTION STOPPED]\n")

def get_last_ai_reply_from_history():
    """Get last AI reply from conversation history."""
    try:
        if os.path.exists("conversation_history.json"):
            with open("conversation_history.json", "r", encoding="utf-8") as f:
                lines = f.readlines()
                # Look for the most recent "AI:" line in the conversation history
                for line in reversed(lines):
                    line = line.strip()
                    if line.startswith("AI: "):
                        print(f"[{ACTION_NAME.upper()} ACTION: Found last AI reply in conversation history]")
                        return line[4:].strip()  # Return just the AI response part
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: ERROR reading conversation history: {e}]")
    
    return None  # Nothing found or error occurred

async def process_input(user_input, system_functions):
    """Process user input for back action."""
    # Check if input CONTAINS back as a word
    input_words = user_input.lower().split()
    
    if "back" in input_words:
        # Try the memory method first
        last_ai_reply_text = None
        last_ai_reply_func = system_functions.get("last_ai_reply")
        
        if last_ai_reply_func:
            try:
                last_ai_reply_text = last_ai_reply_func()
                if last_ai_reply_text:
                    print(f"[{ACTION_NAME.upper()} ACTION: Retrieved last AI reply from memory function]")
            except Exception as e:
                print(f"[{ACTION_NAME.upper()} ACTION: Memory method failed: {e}]")
        
        # If memory method failed, use file-based method
        if not last_ai_reply_text:
            print(f"[{ACTION_NAME.upper()} ACTION: Trying history-based fallback]")
            last_ai_reply_text = get_last_ai_reply_from_history()
        
        # Did we get a last AI reply?
        if last_ai_reply_text:
            if user_input.lower().strip() == "back":
                # This is JUST the "back" command by itself
                # Create a system notification in conversation history
                try:
                    with open("conversation_history.json", "a", encoding="utf-8") as f:
                        f.write(f"[SYSTEM: BACK command detected - Re-sending last AI message]\n")
                        # REMOVED: No longer writing "You: back" at all
                except Exception:
                    pass
                
                print(f"[{ACTION_NAME.upper()} ACTION: 'back' command triggered successfully]")
                
                # Return the last AI reply to be sent back to the AI
                return last_ai_reply_text
            else:
                # "back" is part of a larger message, don't process as command
                return None
        else:
            if user_input.lower().strip() == "back":
                # Just the back command, but no AI reply found
                error_message = "[BACK ACTION: No previous AI reply available to 'back' to.]"
                # Also write to conversation history
                try:
                    with open("conversation_history.json", "a", encoding="utf-8") as f:
                        f.write(f"{error_message}\n")
                        # REMOVED: No longer writing "You: back" here either
                except Exception:
                    pass
                return error_message
            else:
                # "back" is part of a larger message, don't process
                return None
    else:
        return None  # Not related to "back" command