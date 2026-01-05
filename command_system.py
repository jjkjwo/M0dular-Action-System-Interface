# command_system.py - Centralized Command Management System V 1.6
# --------------------------------------------------------------------------------------------------
# Version History:
#   - v1.5:  Fixed prefix command handling.
#   - v1.6: (Current Version)
#     - Modified to support a more descriptive `commands.json` structure where each
#       command can be an object containing properties like 'enabled' and 'description'.
#     - The core command recognition logic (`is_command`, `get_command_category`) REMAINS
#       UNCHANGED as it was already resilient, operating on dictionary keys only.
#     - Updated `DEFAULT_COMMANDS` to use the new object structure, so a fresh `commands.json`
#       is generated in the correct format.
#     - Updated `add_command` to create entries using the new object format, ensuring
#       future programmatically-added commands are compatible.
# --------------------------------------------------------------------------------------------------

"""
Manages all system commands, acting as the central authority for command recognition.

This module's primary responsibilities are:
1.  Loading command definitions from a `commands.json` file.
2.  Providing a robust `is_command()` function to determine if a given string
    is a system command or regular user input for the AI.
3.  Categorizing commands to allow for different handling logic.
4.  Offering utility functions to add, remove, and reload commands dynamically.
"""

import os
import json
import re

# The filename for storing command definitions.
COMMAND_FILE = "commands.json"

# This dictionary serves as the default set of commands if the JSON file is missing.
# It's also used to create a new `commands.json` file on first run.
# UPDATED: Now uses the new object format.
DEFAULT_COMMANDS = {
    "system": {
        "help": {"enabled": True, "description": "help_description"},
        "clear": {"enabled": True, "description": "clear_description"},
        "exit": {"enabled": True, "description": "exit_description"},
        "reload": {"enabled": True, "description": "reload_description"},
        "delay": {"enabled": True, "description": "delay_description"},
        "prepare_shutdown": {"enabled": True, "description": "prepare_shutdown_description"}
    },
    "action": { # Example: "start core": {"enabled": True, "description": "..."}
        "start key": {"enabled": True, "description": "start_key_description"},
        "actions info": {"enabled": True, "description": "actions_info_description"},
        "log level": {"enabled": True, "description": "log_level_description"}
    },
    "plugin_specific": { # Example: "fix": {"enabled": True, "description": "..."}
        "ok": {"enabled": True, "description": "ok_description"},
        "fix": {"enabled": True, "description": "fix_description"}
    },
    "plugin_commands": { # Example: "prompt use": {"enabled": True, "description": "..."}
        "memory status": {"enabled": True, "description": "memory_status_description"},
        "prompt list": {"enabled": True, "description": "prompt_list_description"},
        "prompt use": {"enabled": True, "description": "prompt_use_description"}
    },
    "special_prefixes": {
        "<path>": {"enabled": True, "description": "path_prefix_description"},
        "<update>": {"enabled": True, "description": "update_prefix_description"},
        "<download>": {"enabled": True, "description": "download_prefix_description"}
    }
}


# Global variable to cache the loaded command system for performance.
_command_system = None

# Defines categories where commands can be followed by arguments.
# This allows `is_command()` to recognize "prompt use concise" as a command,
# because "prompt use" is in the `plugin_commands` category.
_PREFIX_COMMAND_CATEGORIES = ["action", "plugin_specific", "plugin_commands"]

def load_commands():
    """
    Loads the command system from COMMAND_FILE.
    If the file doesn't exist or is invalid, it uses/creates DEFAULT_COMMANDS.

    Returns:
        dict: The loaded command system dictionary.
    """
    global _command_system

    try:
        # Check if the command configuration file exists.
        if os.path.exists(COMMAND_FILE):
            with open(COMMAND_FILE, "r", encoding="utf-8") as f:
                try:
                    # Attempt to parse the JSON file.
                    loaded_data = json.load(f)
                    if isinstance(loaded_data, dict): # Basic validation
                         _command_system = loaded_data
                         print(f"[COMMAND SYSTEM: Loaded commands from {COMMAND_FILE}]")
                    else:
                         # If file content is not a dictionary, it's invalid.
                         raise TypeError("Commands file content is not a dictionary")
                except (json.JSONDecodeError, TypeError) as json_err:
                     # Handle errors in JSON parsing or if the structure is not a dict.
                     print(f"[COMMAND SYSTEM: Error decoding JSON or invalid format in {COMMAND_FILE}: {json_err}]")
                     _command_system = DEFAULT_COMMANDS.copy()
                     print(f"[COMMAND SYSTEM: Using default commands due to load error.]")
        else:
            # If the command file doesn't exist, use defaults and create the file.
            _command_system = DEFAULT_COMMANDS.copy()
            print(f"[COMMAND SYSTEM: No command file found. Using defaults and creating {COMMAND_FILE}]")
            save_commands() # Save the defaults to create the file

    except Exception as e:
        # Catch any other unexpected errors during loading as a final safeguard.
        print(f"[COMMAND SYSTEM: Unexpected error loading commands: {e}]")
        _command_system = DEFAULT_COMMANDS.copy() # Fallback to defaults
        print(f"[COMMAND SYSTEM: Using default commands due to unexpected load error.]")

    return _command_system

def save_commands():
    """
    Saves the current in-memory command system to COMMAND_FILE.

    Returns:
        bool: True if successful, False otherwise.
    """
    global _command_system

    # Safety check: If no commands are loaded, try loading them before saving.
    if not _command_system:
        print("[COMMAND SYSTEM: No command system loaded to save, attempting load/default first.]")
        load_commands()
        if not _command_system:
             print("[COMMAND SYSTEM: FATAL - Cannot save command system, load failed critically.")
             return False

    try:
        # Ensure parent directory exists if COMMAND_FILE is in a subdirectory.
        parent_dir = os.path.dirname(COMMAND_FILE)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        with open(COMMAND_FILE, "w", encoding="utf-8") as f:
            # Write the command dictionary to the file in a human-readable format.
            json.dump(_command_system, f, indent=2, ensure_ascii=False)
        print(f"[COMMAND SYSTEM: Saved commands to {COMMAND_FILE}]")
        return True
    except Exception as e:
        print(f"[COMMAND SYSTEM: Error saving commands: {e}]")
        return False

def get_command_system():
    """
    Returns the current command system dictionary.
    This acts as a public accessor and ensures commands are loaded if not already in memory.

    Returns:
        dict: The current command system dictionary.
    """
    global _command_system
    if not _command_system:
        load_commands() # Lazy loading: load only when first needed.
    return _command_system


def is_command(message):
    """
    Checks if a given message string is a recognized command. This is the core function
    of this module, used by the main loop to differentiate commands from AI prompts.

    Args:
        message (str): The user's input string.

    Returns:
        bool: True if the message is a command, False otherwise.
    """
    global _command_system, _PREFIX_COMMAND_CATEGORIES

    if not _command_system:
        load_commands()
        if not _command_system: return False

    if not isinstance(message, str):
        return False
    message_lower = message.lower().strip()
    if not message_lower:
        return False # Empty strings are not commands.

    # --- Order of checks is important for specificity and performance ---

    # 1. Check for exact command matches and prefix-based commands.
    #    This is the most common path.
    for category, command_map in _command_system.items():
        if category == "special_prefixes":
            continue
        if isinstance(command_map, dict):
            # Check for an exact match first (e.g., "help").
            if message_lower in command_map:
                return True
            # For designated categories, check if the input starts with a command.
            # This handles commands with arguments (e.g., "prompt use concise").
            if category in _PREFIX_COMMAND_CATEGORIES:
                for cmd_prefix in command_map:
                    if message_lower.startswith(cmd_prefix + " ") or message_lower == cmd_prefix:
                        return True

    # 2. Check for dynamic, pattern-based commands like "start <action_name>".
    #    These are not hardcoded in commands.json but follow a recognized pattern.
    start_match = re.match(r"^start\s+([\w-]+)$", message_lower)
    stop_match = re.match(r"^stop\s+([\w-]+)$", message_lower)
    if start_match or stop_match:
        return True

    # 3. Check for the specific "delay" command pattern, which can have an optional argument.
    if message_lower == "delay" or re.match(r"^delay\s+(\d+(\.\d*)?|\.\d+)$", message_lower):
        return True

    # 4. Check for special prefixes (e.g., "<path>") that are treated as commands.
    if "special_prefixes" in _command_system:
         prefixes = _command_system["special_prefixes"]
         if isinstance(prefixes, dict):
             for prefix in prefixes:
                 if message_lower.startswith(prefix.lower()):
                    return True

    return False

def get_command_category(message):
    """
    Determines the category of a given command message.

    Args:
        message (str): The command string.

    Returns:
        str or None: The name of the command's category, or None if it's not a command.
    """
    global _command_system, _PREFIX_COMMAND_CATEGORIES

    if not _command_system:
        load_commands()
        if not _command_system: return None

    if not isinstance(message, str):
        return None

    # For efficiency and correctness, first verify it IS a command.
    if not is_command(message):
        return None

    message_lower = message.lower().strip()
    if not message_lower:
        return None

    # The logic here mirrors is_command() to find which category matched.
    for category, command_map in _command_system.items():
        if category == "special_prefixes": continue
        if isinstance(command_map, dict):
            if message_lower in command_map:
                return category
            if category in _PREFIX_COMMAND_CATEGORIES:
                for cmd_prefix in command_map:
                    if message_lower.startswith(cmd_prefix + " ") or message_lower == cmd_prefix:
                        return category

    if re.match(r"^(start|stop)\s+([\w-]+)$", message_lower):
        return "action"

    if message_lower == "delay" or re.match(r"^delay\s+(\d+(\.\d*)?|\.\d+)$", message_lower):
        return "system"

    if "special_prefixes" in _command_system:
         prefixes = _command_system["special_prefixes"]
         if isinstance(prefixes, dict):
             for prefix in prefixes:
                 if message_lower.startswith(prefix.lower()):
                     return "special_prefixes"

    return None


def is_ai_message(message):
    """A simple helper to check if a message is NOT a command (and thus for the AI)."""
    return not is_command(message)

def should_show_thinking(message):
    """Determines if a "thinking..." indicator should be shown (i.e., for AI messages)."""
    return not is_command(message)

def add_command(command, category="system"):
    """
    Adds a new command to the system in memory and saves it to the JSON file.
    UPDATED: Now creates an object with a placeholder description.

    Args:
        command (str): The command string (e.g., "my new command").
        category (str): The category to add it to (e.g., "system"). Creates the category if it doesn't exist.

    Returns:
        bool: True on success, False on failure.
    """
    global _command_system
    if not _command_system: load_commands()
    if not _command_system: return False

    if not isinstance(command, str) or not isinstance(category, str):
        print(f"[COMMAND SYSTEM: Invalid input type for add_command ({type(command)}, {type(category)})]")
        return False
    command_lower = command.lower().strip()
    cat_lower = category.lower().strip()
    if not command_lower or not cat_lower:
         print("[COMMAND SYSTEM: Command or category cannot be empty for add_command]")
         return False

    # If the category doesn't exist, create it as a new dictionary.
    if cat_lower not in _command_system or not isinstance(_command_system.get(cat_lower), dict):
        print(f"[COMMAND SYSTEM: Creating new category '{cat_lower}']")
        _command_system[cat_lower] = {}

    # Create the command with the new object structure.
    description_placeholder = command_lower.replace(" ", "_") + "_description"
    _command_system[cat_lower][command_lower] = {
        "enabled": True,
        "description": description_placeholder
    }
    print(f"[COMMAND SYSTEM: Added command '{command_lower}' to category '{cat_lower}']")

    # Persist the change to the file.
    return save_commands()

def remove_command(command, category=None):
    """
    Removes a command from the system in memory and saves the change.

    Args:
        command (str): The command string to remove.
        category (str, optional): The specific category to remove from. If None, searches all categories.

    Returns:
        bool: True if the command was removed and saved, False otherwise.
    """
    global _command_system
    if not _command_system: load_commands()
    if not _command_system: return False

    if not isinstance(command, str):
        print(f"[COMMAND SYSTEM: Invalid input type for remove_command ({type(command)})]")
        return False
    command_lower = command.lower().strip()
    if not command_lower:
        print("[COMMAND SYSTEM: Command cannot be empty for remove_command]")
        return False

    removed = False
    if category:
        # Remove from a specific category if provided.
        cat_lower = category.lower().strip()
        if cat_lower in _command_system and isinstance(_command_system.get(cat_lower), dict) and command_lower in _command_system[cat_lower]:
            del _command_system[cat_lower][command_lower]
            print(f"[COMMAND SYSTEM: Removed command '{command_lower}' from category '{cat_lower}']")
            removed = True
    else:
        # If no category is specified, search all categories and remove the first match.
        for cat in list(_command_system.keys()): # Iterate over a copy for safe deletion.
            if cat != "special_prefixes" and isinstance(_command_system.get(cat), dict):
                if command_lower in _command_system[cat]:
                    del _command_system[cat][command_lower]
                    print(f"[COMMAND SYSTEM: Removed command '{command_lower}' from category '{cat}']")
                    removed = True
                    break # Stop after finding and removing the first instance.
    if removed:
        return save_commands()
    else:
        print(f"[COMMAND SYSTEM: Command '{command_lower}' not found for removal (category: {category or 'any'})]")
        return False

def reload_commands():
    """
    Forces a reload of commands from the COMMAND_FILE, discarding any in-memory changes.

    Returns:
        dict: The newly loaded command system dictionary.
    """
    global _command_system
    print("[COMMAND SYSTEM: Reloading commands from file...]")
    # By setting the global cache to None, the next call to any function
    # that uses it (like get_command_system) will trigger a fresh load.
    _command_system = None
    return load_commands()

# This block ensures that commands are loaded from the file as soon as this module
# is imported by another part of the system, making it ready for immediate use.
if _command_system is None:
    load_commands()