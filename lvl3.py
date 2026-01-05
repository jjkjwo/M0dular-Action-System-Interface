# lvl3.py - Minimal version for fix command only
import os
import time

ACTION_NAME = "lvl3"
ACTION_PRIORITY = 1

SAVE_DIR = "saved_sessions"
os.makedirs(SAVE_DIR, exist_ok=True)

async def start_action():
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - 'fix' command enabled.]")

async def stop_action():
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - 'fix' command disabled.]")

async def process_input(user_input, system_functions):
    if user_input.lower() == "fix":
        print(f"[{ACTION_NAME.upper()} ACTION: FIX - Saving last AI reply to file...]")
        last_ai_reply_func = system_functions.get("last_ai_reply")
        
        if not last_ai_reply_func:
            return "[LVL3 ACTION: ERROR - Could not access last AI reply data.]"
        
        last_ai_reply_text = last_ai_reply_func()
        if not last_ai_reply_text:
            return "[LVL3 ACTION: WARNING - No AI response available yet. Chat with AI first.]"
        
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = os.path.join(SAVE_DIR, f"fix_summary_{timestamp}.txt")
        with open(filename, "w", encoding="utf-8") as f:
            f.write(last_ai_reply_text)
        
        print(f"[{ACTION_NAME.upper()} ACTION: FIX - Last AI reply SAVED as '{filename}']")
        return f"[LVL3 ACTION: FIX - Last AI reply saved as '{filename}']"
    
    return None