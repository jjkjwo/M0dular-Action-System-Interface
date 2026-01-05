# prompts.py - Smart Whiteboard Addon (Version 2.1 - Corrected & Simplified)
# This version fixes the critical import loop, correctly implements the bulletin
# board, and simplifies the command structure to align with the architectural mandate.

import os
import json
import time
from datetime import datetime

# ===== CONFIGURATION =====
ACTION_NAME = "prompts"
ACTION_PRIORITY = 12  # Runs late in the input pipeline to apply just before sending to AI

# Use the original filename for web UI compatibility
PROMPTS_FILE = "prompts.json" 

# Default prompts always available to the user
DEFAULT_PROMPPTS = {
    "default": "",  # An empty default ensures no injection occurs when no prompt is active
    "concise": "Be extremely concise. Short responses only. No elaboration.",
    "detailed": "Provide comprehensive, detailed responses with examples and thorough explanations.",
    "creative": "Be creative and imaginative. Think outside conventional boundaries.",
    "technical": "Use precise technical language. Include code examples where relevant. Be specific and accurate.",
}

# ===== GLOBAL STATE =====
_is_active = False
_prompts = {}                   # name -> content mapping for user-defined prompts
_active_prompt_name = "default" # The user's currently active persistent prompt

# The Bulletin Board is a separate system for inter-addon communication
_bulletin_board = {}            # source -> {message, turns_remaining}

# Settings for the active prompt's persistence
_persistence_mode = True        # Does the prompt persist across turns?
_ttl = -1                       # Time-to-live in turns (-1 = infinite)
_turns_since_activation = 0     # Counter for TTL

# ===== PUBLIC API FOR OTHER ADDONS (THE BULLETIN BOARD) =====

def post_bulletin(source: str, message: str, ttl: int = 1):
    """
    Public API for other addons to post temporary messages to the whiteboard.
    This is the official "Bulletin Board" mechanism.
    It does NOT override the user's active prompt; it runs in parallel.
    """
    global _bulletin_board
    if not isinstance(ttl, int) or ttl < 1:
        ttl = 1
        
    _bulletin_board[source] = {
        "message": message,
        "turns_remaining": ttl
    }
    print(f"[{ACTION_NAME.upper()}: Bulletin posted by '{source}' (TTL: {ttl} turn(s))]")

# ===== LIFECYCLE & PERSISTENCE =====

async def start_action(system_functions=None):
    """Initializes the Smart Whiteboard when the action is started."""
    global _is_active
    _is_active = True
    _load_state()
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Smart Whiteboard active]")
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()}: Whiteboard active. Use 'prompt help' for commands.]"
        )

async def stop_action(system_functions=None):
    """Gracefully saves state when the action is stopped."""
    global _is_active
    _is_active = False
    _save_state()
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Whiteboard state saved.]")

def _load_state():
    """Loads the entire state from the JSON file, supporting old and new formats."""
    global _prompts, _active_prompt_name, _persistence_mode, _ttl
    _prompts = DEFAULT_PROMPTS.copy()
    try:
        if os.path.exists(PROMPTS_FILE):
            with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Support both new nested format and old flat format for robustness
            loaded_prompts = data.get("prompts", data if isinstance(data, dict) else {})
            if isinstance(loaded_prompts, dict):
                 _prompts.update(loaded_prompts)

            # Load persistent settings
            _active_prompt_name = data.get("active_prompt", "default")
            _persistence_mode = data.get("persistence_mode", True)
            _ttl = data.get("ttl", -1)
            print(f"[{ACTION_NAME.upper()}: Loaded state from {PROMPTS_FILE}]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error loading state: {e}. Using defaults.]")

def _save_state():
    """Saves the current state to the JSON file."""
    try:
        # Don't save default prompts to the file if they haven't been changed.
        user_prompts = {
            k: v for k, v in _prompts.items() 
            if k not in DEFAULT_PROMPTS or v != DEFAULT_PROMPTS.get(k)
        }
        
        state_to_save = {
            "prompts": user_prompts,
            "active_prompt": _active_prompt_name,
            "persistence_mode": _persistence_mode,
            "ttl": _ttl,
            "last_saved": datetime.now().isoformat()
        }
        
        with open(PROMPTS_FILE, "w", encoding="utf-8") as f:
            json.dump(state_to_save, f, indent=2)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving state: {e}]")

def _show_help():
    """Returns the help text for all prompt commands."""
    return """[PROMPTS: Smart Whiteboard Help]
This is NOT a template system. It's a persistent behavioral instruction channel.

CORE COMMANDS:
  prompt use <name>    - Activate a prompt (it stays active).
  prompt set <name> <content> - Create or update a prompt.
  prompt clear         - Clear the active user prompt.
  prompt list          - Show all available prompts.
  prompt show <name>   - Display a prompt's content.
  prompt active        - Show current active user prompt.

ADVANCED SETTINGS:
  prompt persist <on|off> - Make prompts clear after one use (off) or stay active (on).
  prompt ttl <turns>   - Set how many turns a prompt lasts. (-1 for infinite).
  prompt status        - Show full system status, including bulletins.

EXAMPLES:
  prompt set eli5 Explain this to me like I am five years old.
  prompt use eli5
"""
# ===== MAIN PROCESSING =====

async def process_input(user_input: str, system_functions=None, is_system_command=False):
    """
    Main input processing hook.
    1. Checks for and handles its own commands.
    2. If not a command, it prepends active prompt/bulletins to the user's message.
    """
    global _is_active, _active_prompt_name, _prompts, _turns_since_activation
    global _persistence_mode, _ttl, _bulletin_board

    if not _is_active:
        return user_input

    # --- 1. COMMAND HANDLING ---
    input_lower = user_input.lower().strip()
    if input_lower.startswith("prompt "):
        parts = user_input.strip().split(maxsplit=2)
        command = parts[1].lower() if len(parts) > 1 else "help"
        args = parts[2] if len(parts) > 2 else ""

        if command == "list":
            active_marker = f"(Active: {_active_prompt_name})" if _active_prompt_name != 'default' else '(No active prompt)'
            return f"[{ACTION_NAME.upper()}: Available Prompts {active_marker}]\n- " + "\n- ".join(sorted(_prompts.keys()))
        
        elif command == "use":
            name = args.strip()
            if name in _prompts:
                _active_prompt_name = name
                _turns_since_activation = 0
                _save_state()
                return f"[PROMPTS: Active prompt set to '{name}']"
            return f"[PROMPTS: Prompt '{name}' not found.]"
        
        elif command == "set":
            name_content = args.split(" ", 1)
            if len(name_content) < 2: return "[PROMPTS: Invalid format. Use 'prompt set <name> <content>']"
            name, content = name_content[0].strip(), name_content[1].strip()
            if not name: return "[PROMPTS: Prompt name cannot be empty.]"
            _prompts[name] = content
            _save_state()
            return f"[PROMPTS: Prompt '{name}' saved.]"

        elif command == "show":
            name = args.strip()
            if not name: return "[PROMPTS: Please specify a prompt name to show.]"
            content = _prompts.get(name)
            if content is not None:
                return f"[PROMPTS: Content of '{name}']\n---\n{content or '(This prompt is empty)'}\n---"
            return f"[PROMPTS: Prompt '{name}' not found.]"
            
        elif command in ["active", "current"]:
            return f"[PROMPTS: Current active prompt is '{_active_prompt_name}']"

        elif command == "clear":
            _active_prompt_name = "default"
            _turns_since_activation = 0
            _save_state()
            return "[PROMPTS: Active prompt has been cleared.]"
        
        elif command == "persist":
            mode = args.lower()
            if mode == "on": _persistence_mode = True
            elif mode == "off": _persistence_mode = False
            else: return "[PROMPTS: Use 'on' or 'off' for persist command.]"
            _save_state()
            return f"[PROMPTS: Persistence mode is now {'ON' if _persistence_mode else 'OFF'}.]"
            
        elif command == "ttl":
            try:
                turns = int(args)
                if turns < -1: return "[PROMPTS: TTL must be -1 or greater.]"
                _ttl = turns
                _save_state()
                return f"[PROMPTS: Active prompt TTL set to {turns} turns.]"
            except (ValueError, IndexError):
                return "[PROMPTS: Invalid TTL value. Please provide a number.]"
        
        elif command == "status":
            bulletins = [f"  - {src} ({b['turns_remaining']} turns left)" for src, b in _bulletin_board.items()]
            status = [
                f"[PROMPTS STATUS]",
                f"  Active Prompt: '{_active_prompt_name}'",
                f"  Persistence: {'ON' if _persistence_mode else 'OFF'}",
                f"  TTL: {_ttl if _ttl != -1 else 'Infinite'} (used for {_turns_since_activation} turns)",
                f"  Bulletins: {len(bulletins)} active",
            ]
            if bulletins:
                status.extend(bulletins)
            return "\n".join(status)

        else: # Also covers 'help'
            return _show_help()

    # --- 2. INJECTION LOGIC ---
    # CRITICAL FIX: Use the 'is_system_command' flag from the loader.
    # Do NOT 'import command_system' here, as it causes a fatal circular dependency on startup.
    if is_system_command:
        return user_input

    # --- Process Bulletins ---
    injection_parts = []
    expired_bulletins = []
    for source, bulletin in _bulletin_board.items():
        injection_parts.append(f"[{source.upper()} BULLETIN: {bulletin['message']}]")
        bulletin["turns_remaining"] -= 1
        if bulletin["turns_remaining"] <= 0:
            expired_bulletins.append(source)

    for source in expired_bulletins:
        del _bulletin_board[source]
        print(f"[{ACTION_NAME.upper()}: Bulletin from '{source}' expired.]")

    # --- Process User's Active Prompt ---
    # Handle TTL Expiration
    if _ttl != -1 and _turns_since_activation >= _ttl:
        print(f"[{ACTION_NAME.upper()}: Prompt '{_active_prompt_name}' expired due to TTL.]")
        _active_prompt_name = "default"
        _turns_since_activation = 0

    active_content = _prompts.get(_active_prompt_name, "")
    if active_content:
        injection_parts.append(active_content)
        _turns_since_activation += 1
        
        # Handle non-persistent mode
        if not _persistence_mode:
            print(f"[{ACTION_NAME.upper()}: Prompt '{_active_prompt_name}' was used once and cleared (persistence is off).]")
            _active_prompt_name = "default"
            _turns_since_activation = 0
            
    # --- Final Assembly ---
    if injection_parts:
        # Join all instruction parts together and prepend to user input
        whiteboard_content = "\n".join(injection_parts)
        return f"{whiteboard_content}\n\n{user_input}"

    # If nothing to inject, return original input
    return user_input

async def process_output(ai_response, system_functions=None):
    """This addon does not modify the AI's output."""
    return ai_response