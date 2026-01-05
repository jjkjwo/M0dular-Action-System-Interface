# recent_turns.py - Rolling Turn History Logger
# Maintains a persistent log of the last X conversation turns
# Survives conversation clears and server restarts

import os
import json
import time
from datetime import datetime
from collections import deque

ACTION_NAME = "recent_turns"
ACTION_PRIORITY = 8  # Mid-range priority - after core processing but before cosmetic addons

# Configuration
CONFIG_FILE = "recent_turns_config.json"
TURNS_FILE = "recent_turns_history.json"

# Default configuration
DEFAULT_CONFIG = {
    "max_turns": 3,  # Number of turns to keep
    "include_system_messages": True,  # Whether to capture system messages
    "include_timestamps": True,  # Add timestamps to each turn
    "pretty_format": True,  # Pretty print when displaying
    "auto_save": True,  # Save after each turn
    "max_turn_size": 10000  # Max characters per turn to prevent huge files
}

# Module state
_is_active = False
_config = DEFAULT_CONFIG.copy()
_current_turn = None
_turn_history = deque(maxlen=DEFAULT_CONFIG["max_turns"])
_turn_counter = 0

def load_config():
    """Load configuration from file"""
    global _config, _turn_history
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded_config = json.load(f)
                _config.update(loaded_config)
                # Recreate deque with new maxlen if max_turns changed
                if _turn_history.maxlen != _config["max_turns"]:
                    _turn_history = deque(list(_turn_history), maxlen=_config["max_turns"])
            print(f"[{ACTION_NAME.upper()}: Loaded configuration from {CONFIG_FILE}]")
        else:
            # Create default config file if it doesn't exist
            print(f"[{ACTION_NAME.upper()}: No config file found, creating {CONFIG_FILE} with defaults]")
            save_config()
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error loading config: {e}]")

def save_config():
    """Save configuration to file"""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_config, f, indent=2)
        print(f"[{ACTION_NAME.upper()}: Saved configuration]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving config: {e}]")

def load_turn_history():
    """Load turn history from file"""
    global _turn_history, _turn_counter
    try:
        if os.path.exists(TURNS_FILE):
            with open(TURNS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    # Convert list back to deque with correct maxlen
                    history_list = data.get("turns", [])
                    _turn_history = deque(history_list, maxlen=_config["max_turns"])
                    _turn_counter = data.get("counter", 0)
                    print(f"[{ACTION_NAME.upper()}: Loaded {len(_turn_history)} turns from history]")
        else:
            # Create empty history file if it doesn't exist
            print(f"[{ACTION_NAME.upper()}: No history file found, creating empty {TURNS_FILE}]")
            save_turn_history()
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error loading turn history: {e}]")
        _turn_history = deque(maxlen=_config["max_turns"])
        _turn_counter = 0

def save_turn_history():
    """Save turn history to file"""
    if not _config.get("auto_save", True):
        return
    
    try:
        # Convert deque to list for JSON serialization
        data = {
            "turns": list(_turn_history),
            "counter": _turn_counter,
            "last_updated": datetime.now().isoformat()
        }
        
        # Write to temp file first then rename (atomic operation)
        temp_file = TURNS_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        
        # Atomic replace
        if os.path.exists(TURNS_FILE):
            os.remove(TURNS_FILE)
        os.rename(temp_file, TURNS_FILE)
        
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving turn history: {e}]")

def truncate_content(content, max_length):
    """Truncate content if it exceeds max length"""
    if len(content) <= max_length:
        return content
    return content[:max_length - 20] + "... [TRUNCATED]"

def format_turn_for_display(turn, index):
    """Format a turn for display"""
    lines = []
    lines.append(f"\n{'='*60}")
    lines.append(f"TURN #{turn.get('number', '?')} (Index: {index})")
    if _config.get("include_timestamps", True) and "timestamp" in turn:
        lines.append(f"Time: {turn['timestamp']}")
    lines.append(f"{'-'*60}")
    
    # User input
    if "user_input" in turn:
        lines.append("USER INPUT:")
        lines.append(turn["user_input"])
        lines.append("")
    
    # System messages (if any)
    if _config.get("include_system_messages", True) and "system_messages" in turn:
        for msg in turn["system_messages"]:
            lines.append(f"[SYSTEM: {msg}]")
        if turn["system_messages"]:
            lines.append("")
    
    # AI response
    if "ai_response" in turn:
        lines.append("AI RESPONSE:")
        lines.append(turn["ai_response"])
    
    lines.append(f"{'='*60}")
    return "\n".join(lines)

async def start_action(system_functions=None):
    """Initialize the recent turns tracker"""
    global _is_active, _current_turn
    _is_active = True
    _current_turn = None
    
    load_config()
    load_turn_history()
    
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Rolling turn history active]")
    print(f"[{ACTION_NAME.upper()}: Keeping last {_config['max_turns']} turns]")
    
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()}: Turn history tracking active. Use 'recent show' to view history.]"
        )

async def stop_action(system_functions=None):
    """Stop the recent turns tracker"""
    global _is_active
    _is_active = False
    
    # Save any pending turn
    if _current_turn and (_current_turn.get("user_input") or _current_turn.get("ai_response")):
        finalize_turn()
    
    save_config()
    save_turn_history()
    
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Turn history tracking disabled]")

def finalize_turn():
    """Finalize and save the current turn"""
    global _current_turn, _turn_counter
    
    if not _current_turn:
        return
    
    # Only save if we have meaningful content
    if _current_turn.get("user_input") or _current_turn.get("ai_response"):
        # Add metadata
        _current_turn["complete"] = True
        _current_turn["finalized_at"] = datetime.now().isoformat()
        
        # Add to history (deque automatically removes oldest if at capacity)
        _turn_history.append(_current_turn.copy())
        
        # Save to file
        save_turn_history()
        
        print(f"[{ACTION_NAME.upper()}: Saved turn #{_current_turn['number']} to history]")
    
    _current_turn = None

async def handle_commands(user_input, system_functions=None):
    """Handle recent_turns specific commands"""
    input_lower = user_input.lower().strip()
    
    if input_lower == "recent show" or input_lower == "recent":
        if not _turn_history:
            return "[RECENT_TURNS: No turn history available]"
        
        output = [f"[RECENT_TURNS: Showing last {len(_turn_history)} turns]"]
        for i, turn in enumerate(_turn_history):
            output.append(format_turn_for_display(turn, i))
        
        return "\n".join(output)
    
    elif input_lower.startswith("recent show "):
        try:
            num = int(input_lower.split()[2])
            if num < 1:
                return "[RECENT_TURNS: Number must be positive]"
            
            # Show last N turns
            turns_to_show = list(_turn_history)[-num:]
            if not turns_to_show:
                return "[RECENT_TURNS: No turn history available]"
            
            output = [f"[RECENT_TURNS: Showing last {len(turns_to_show)} turns]"]
            for i, turn in enumerate(turns_to_show):
                output.append(format_turn_for_display(turn, len(_turn_history) - len(turns_to_show) + i))
            
            return "\n".join(output)
        except (ValueError, IndexError):
            return "[RECENT_TURNS: Usage: recent show <number>]"
    
    elif input_lower == "recent clear":
        _turn_history.clear()
        save_turn_history()
        return "[RECENT_TURNS: Turn history cleared]"
    
    elif input_lower == "recent status":
        return (f"[RECENT_TURNS STATUS]\n"
                f"  Active: {_is_active}\n"
                f"  Turns in history: {len(_turn_history)}\n"
                f"  Max turns kept: {_config['max_turns']}\n"
                f"  Current turn #: {_turn_counter}\n"
                f"  Include timestamps: {_config['include_timestamps']}\n"
                f"  Include system messages: {_config['include_system_messages']}\n"
                f"  Auto-save: {_config['auto_save']}")
    
    elif input_lower.startswith("recent max "):
        try:
            new_max = int(input_lower.split()[2])
            if new_max < 1 or new_max > 100:
                return "[RECENT_TURNS: Max turns must be between 1 and 100]"
            
            _config["max_turns"] = new_max
            _turn_history = deque(list(_turn_history)[-new_max:], maxlen=new_max)
            save_config()
            save_turn_history()
            return f"[RECENT_TURNS: Max turns set to {new_max}]"
        except (ValueError, IndexError):
            return "[RECENT_TURNS: Usage: recent max <number>]"
    
    elif input_lower == "recent help":
        return ("[RECENT_TURNS HELP]\n"
                "Commands:\n"
                "  recent / recent show - Show all saved turns\n"
                "  recent show <n> - Show last n turns\n"
                "  recent clear - Clear turn history\n"
                "  recent status - Show current configuration\n"
                "  recent max <n> - Set maximum turns to keep (1-100)\n"
                "  recent help - Show this help message\n"
                "\n"
                "This addon maintains a rolling history of conversation turns that\n"
                "persists across conversation clears and server restarts.")
    
    return None

async def process_input(user_input, system_functions=None):
    """Process user input and track it for the current turn"""
    global _is_active, _current_turn, _turn_counter
    
    if not _is_active:
        return user_input
    
    # Handle commands first
    command_result = await handle_commands(user_input, system_functions)
    if command_result:
        return command_result
    
    # Check if this is a system command (don't track system commands as turns)
    try:
        import command_system
        if command_system.is_command(user_input):
            # Still return the input, just don't track it
            return user_input
    except ImportError:
        pass
    
    # Start a new turn if needed
    if not _current_turn:
        _turn_counter += 1
        _current_turn = {
            "number": _turn_counter,
            "timestamp": datetime.now().isoformat() if _config.get("include_timestamps", True) else None,
            "user_input": None,
            "ai_response": None,
            "system_messages": [],
            "complete": False
        }
    
    # Truncate if needed
    max_size = _config.get("max_turn_size", 10000)
    truncated_input = truncate_content(user_input, max_size)
    
    # Record user input
    _current_turn["user_input"] = truncated_input
    
    return user_input

async def process_output(ai_response, system_functions=None):
    """Process AI output and complete the current turn"""
    global _is_active, _current_turn
    
    if not _is_active or not ai_response:
        return ai_response
    
    # If we have a current turn, add the AI response
    if _current_turn:
        # Truncate if needed
        max_size = _config.get("max_turn_size", 10000)
        truncated_response = truncate_content(ai_response, max_size)
        
        _current_turn["ai_response"] = truncated_response
        
        # Check for system messages in the response
        if _config.get("include_system_messages", True):
            # Simple pattern matching for [SYSTEM: ...] style messages
            import re
            system_pattern = r'\[([A-Z_]+):\s*([^\]]+)\]'
            matches = re.findall(system_pattern, ai_response)
            for match in matches[:5]:  # Limit to 5 system messages
                _current_turn["system_messages"].append(f"{match[0]}: {match[1][:100]}")
        
        # Finalize the turn
        finalize_turn()
    
    return ai_response

# Utility functions for other addons
def get_recent_turns(count=None):
    """Get recent turns for use by other addons"""
    if count is None:
        return list(_turn_history)
    return list(_turn_history)[-count:]

def get_last_turn():
    """Get the most recent completed turn"""
    if _turn_history:
        return _turn_history[-1]
    return None