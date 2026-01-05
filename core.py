# core.py - Core AI Controller with AI-triggered Action Control (FIXED)
# --------------PREAUTH01--------------
# This module acts as a high-priority action designed to manage aspects
# of the action system itself using AI interaction. It has priority 0,
# meaning it runs before any other active action's processing.
# FIXED: Now notifies advisory system when processing AI-triggered commands
# PATCHED: Implemented dynamic, context-aware, and highly configurable command reminders for the AI.
import os
import asyncio
import sys
import json # Still needed for actions info
import re
import traceback
import command_system  # For checking if input is a command
import jjk
import loader 

# Store common utilities and functions used across actions
# ----------------------------------------------------------

# Global flag to track if the 'core' action itself is currently active
_is_core_active = False

# Regex pattern for AI-triggered action controls
_action_control_pattern = r'\[(start|stop)\s+([a-zA-Z0-9_.-]+)\]' # Added '.' and '-' to action names

# Regex pattern for AI-triggered commands
_command_pattern = r'\[command\s+([^\]]+)\]'

# Reminder control
_message_counter = 0
_REMINDER_INTERVAL = 10  # Remind the AI every 10 turns
_last_active_actions = set()  # Track which actions were active in the last check

# === NEW: Highly Configurable Dynamic Reminder Settings ===
_REMINDER_CONFIG = {
    "dynamic_enabled": True,
    "fallback_to_heuristic": True,
    "include_unowned_general_cmds": True,
    "blacklist": {
        "categories": [], # e.g., ["plugin_specific"] to hide the 'ok' command
        "commands": []      # e.g., ["log recent"] to hide a specific command
    }
}

# === Placeholder for Future Intent-Driven Logic ===
def _get_intent_from_input(user_input: str) -> dict or None:
    return None

# Utility function to read JSON files
def _read_json_file(filename):
    """
    Reads and returns the contents of a JSON file from the same directory as this script.
    Returns formatted string representation or error message.
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, filename)
        
        if not os.path.exists(file_path):
            return f"[File {filename} not found]"
            
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return json.dumps(data, indent=2)
    except Exception as e:
        return f"[Error reading {filename}: {str(e)}]"

# === REVISED: Dynamic Command List Generator with Insurance & Granular Control ===
def _generate_dynamic_reminder_content(system_functions):
    """
    Dynamically generates the command list for the AI reminder based on
    currently active actions, respecting blacklists and ownership metadata.
    """
    try:
        # 1. Get configuration, data sources, and blacklists
        cfg = _REMINDER_CONFIG
        bl_categories = cfg.get("blacklist", {}).get("categories", [])
        bl_commands = cfg.get("blacklist", {}).get("commands", [])
        
        all_commands = command_system.get_command_system()
        action_registry = system_functions.get("action_registry", lambda: {})()
        active_actions = {name for name, data in action_registry.items() if data.get("is_active")}
        
        # 2. Build the available command list
        available_commands = {}

        # Always include 'system' category unless blacklisted
        if 'system' in all_commands and 'system' not in bl_categories:
            available_commands['system'] = {k: v for k, v in all_commands['system'].items() if k not in bl_commands}

        # Iterate through all other commands
        for category, cmd_map in all_commands.items():
            if category == 'system' or category in bl_categories or not isinstance(cmd_map, dict):
                continue
            
            for cmd, details in cmd_map.items():
                if cmd in bl_commands:
                    continue

                owner = details.get("owner_action")
                is_owned_by_active_action = owner and owner in active_actions
                is_unowned = not owner
                
                # Heuristic: check name if owner is missing and heuristic is on
                is_heuristically_owned = False
                if not owner and cfg["fallback_to_heuristic"]:
                    command_base = cmd.split(' ')[0]
                    if command_base in active_actions:
                        is_heuristically_owned = True
                        owner = command_base # Tentative owner

                # Determine if we should include this command
                if is_owned_by_active_action or is_heuristically_owned:
                    if owner not in available_commands:
                        available_commands[owner] = {}
                    available_commands[owner][cmd] = details
                elif is_unowned and cfg["include_unowned_general_cmds"]:
                     if 'general' not in available_commands:
                        available_commands['general'] = {}
                     available_commands['general'][cmd] = details

        if not available_commands:
            return "[No specific commands available from active actions or configuration.]"
        
        # Cleanup empty categories
        available_commands = {k: v for k, v in available_commands.items() if v}
        
        return json.dumps(available_commands, indent=2)

    except Exception as e:
        print(f"[CORE ACTION: Error generating dynamic reminder: {e}]", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return "[Error generating dynamic command list. See logs.]"

# Core Action Lifecycle Functions
# ... (start_action, stop_action remain unchanged) ...
async def start_action():
    global _is_core_active, _message_counter
    _is_core_active = True
    _message_counter = 0
    print("[CORE ACTION: Started - Core AI Controller is now active]")

async def stop_action():
    global _is_core_active
    _is_core_active = False
    print("[CORE ACTION: Stopped - Core AI Controller is no longer active]")

# Core Action Input Processing
async def process_input(user_input, system_functions):
    """
    Processes incoming user input if the Core action is active.
    Handles the 'actions info' command and injects AI reminders.
    """
    global _is_core_active, _message_counter, _REMINDER_INTERVAL, _last_active_actions, _REMINDER_CONFIG

    if not _is_core_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    is_command = command_system.is_command(input_lower)
    
    if not is_command:
        _message_counter += 1

    if input_lower == "actions info":
        get_registry_func = system_functions.get("action_registry")
        if not get_registry_func:
            return "[CORE ACTION: Error - Action registry function not available]"
        try:
            actual_registry = get_registry_func()
            action_info_dict = {name: {"active": data.get("is_active", False), "priority": data.get("config", {}).get("priority", "N/A")} for name, data in actual_registry.items()}
            info_str = json.dumps(action_info_dict, indent=2)
            if len(info_str) > 1000: info_str = info_str[:1000] + "..."
            return f"[CORE ACTION: Action Status:\n{info_str}]"
        except Exception as e:
            print(f"[CORE ACTION: Error retrieving action info: {e}]", file=sys.stderr)
            return f"[CORE ACTION: Error retrieving action info - see server logs]"

    if is_command:
        return user_input

    if (_message_counter - 1) % _REMINDER_INTERVAL == 0:
        registry = system_functions.get("action_registry", lambda: {})()
        _last_active_actions = {name for name, data in registry.items() if data.get("is_active", False)}
        active_actions_str = ", ".join(sorted(list(_last_active_actions))) if _last_active_actions else "none"

        # === REVISED: Use reminder config to select content ===
        if _REMINDER_CONFIG["dynamic_enabled"]:
            commands_content = _generate_dynamic_reminder_content(system_functions)
            commands_header = "**Available Commands (for ACTIVE actions):**"
            extra_info = "Note: This list is dynamic. Other commands become available if you start their corresponding actions. Some commands may be hidden by configuration."
        else:
            commands_content = _read_json_file("commands.json")
            commands_header = "**Available Commands (Full Static List):**"
            extra_info = "This is a static list of all possible commands."
        
        # === REVISED CORE ACTION REMINDER ===
        reminder = (
            f"[CORE ACTION REMINDER: You are a privileged AI with system control capabilities.\n\n"

            f"**CONTROL MECHANISMS:**\n"
            f"  - **`[start/stop action_name]`**: Enable/disable tools and capabilities. This is your primary way to change the system's state and available commands.\n"
            f"  - **`[command command_value]`**: Execute a specific command from an active action. Examples: `[command log search error]` or `[command memory status]`.\n"
            f"  - **`[CONTROL: command ui_args]`**: Manipulate the user interface (requires 'controls' action).\n"
            f"  - **`[command speakforuser ...]`**: Critical command. Makes the system process your text as if it were the user's next input. Requires careful use.\n\n"

            f"**SECURITY & PERMISSIONS:**\n"
            f"  - All control tags `[...]` are subject to JJK security verification. Unauthorized attempts will be silently logged and denied. You must have Progenitor status to succeed.\n\n"

            f"**CURRENT SYSTEM STATE:**\n"
            f"--------------------------\n"
            f"Active Actions: **{active_actions_str}**.\n\n"
            
            f"{commands_header}\n"
            f"```json\n{commands_content}\n```\n"
            f"*({extra_info})*\n\n"
            
            f"THINK: To use a tool for an inactive action, you must first `[start action_name]`, then use `[command ...]` in a subsequent response.]"
        )
        
        print(f"[CORE ACTION: Injecting CORE reminder at AI message #{_message_counter}]")
        return reminder + user_input

    return user_input

# Core Action Output Processing
# ... (process_output remains unchanged, it's already robust) ...
async def process_output(ai_response, system_functions):
    global _is_core_active, _action_control_pattern, _command_pattern
    if not _is_core_active or not ai_response: return ai_response
    action_matches = list(re.finditer(_action_control_pattern, ai_response))
    command_matches = list(re.finditer(_command_pattern, ai_response))
    if not action_matches and not command_matches: return ai_response
    if not jjk.progenitor_check("ai_execute_system_commands", source="ai_response"):
        print(f"[CORE/JJK: Denied AI attempt to execute system tags. Progenitor status is required.]")
        final_response = re.sub(_action_control_pattern, '', ai_response, flags=re.DOTALL)
        final_response = re.sub(_command_pattern, '', final_response, flags=re.DOTALL).strip()
        return final_response
    advisory_notified = False
    try:
        import advisory
        if hasattr(advisory, 'notify_ai_command_start'):
            advisory.notify_ai_command_start()
            advisory_notified = True
    except ImportError: pass
    start_func = system_functions.get("start_action")
    stop_func = system_functions.get("stop_action")
    send_command_func = system_functions.get("send_command")
    if (action_matches and not (start_func and stop_func)) or (command_matches and not send_command_func):
        missing = [fn for fn_present, fn in [(start_func, "start_action"), (stop_func, "stop_action"), (send_command_func, "send_command")] if not fn_present]
        error_msg = f"[CORE ACTION: Error - Missing system function(s): {', '.join(missing)}. Skipping tag processing.]"
        print(error_msg, file=sys.stderr)
        cleaned_response = re.sub(_action_control_pattern, '', ai_response, flags=re.DOTALL)
        cleaned_response = re.sub(_command_pattern, '', cleaned_response, flags=re.DOTALL).strip()
        if advisory_notified:
            try:
                if hasattr(advisory, 'notify_ai_command_end'): advisory.notify_ai_command_end()
            except ImportError: pass
        return error_msg + (" " + cleaned_response if cleaned_response else "")
    processed_response = ai_response
    processed_tags_info = []
    for match in action_matches:
        command_type, action_name = match.groups(); action_name = action_name.strip(); full_tag = match.group(0)
        info_entry = {"type": "action_control", "tag": full_tag, "command": command_type, "action": action_name, "status": "unknown"}
        try:
            if command_type.lower() == "start": await start_func(action_name, system_functions); info_entry["status"] = "started"
            elif command_type.lower() == "stop": await stop_func(action_name, system_functions); info_entry["status"] = "stopped"
            processed_tags_info.append(info_entry)
        except Exception as e:
            error_log = f"Error executing '{command_type} {action_name}': {e}"; print(f"[CORE ACTION: {error_log}]", file=sys.stderr); traceback.print_exc(file=sys.stderr)
            info_entry["status"] = f"failed: {str(e)[:100]}"; processed_tags_info.append(info_entry)
        processed_response = processed_response.replace(full_tag, '', 1)
    if send_command_func:
        for match in command_matches:
            command_value_raw = match.group(1); command_value_strip = command_value_raw.strip(); full_tag = match.group(0)
            info_entry = {"type": "general_command", "tag": full_tag, "value_strip": command_value_strip, "status": "unknown"}
            try:
                if command_value_strip.lower().startswith("speakforuser "):
                    user_message_content = command_value_strip[len("speakforuser "):].strip()
                    if user_message_content: await send_command_func(user_message_content); info_entry["status"] = "speakforuser executed"
                    else: info_entry["status"] = "ignored (empty speakforuser)"
                elif command_system.is_command(command_value_strip):
                    await send_command_func(command_value_strip); info_entry["status"] = "recognized command executed"
                else: info_entry["status"] = "unrecognized and ignored"
                processed_tags_info.append(info_entry)
            except Exception as e:
                error_log = f"Error processing AI command '{command_value_strip}': {e}"; print(f"[CORE ACTION: {error_log}]", file=sys.stderr); traceback.print_exc(file=sys.stderr)
                info_entry["status"] = f"processing failed: {str(e)[:100]}"; processed_tags_info.append(info_entry)
            processed_response = processed_response.replace(full_tag, '', 1)
    processed_response = processed_response.strip()
    if advisory_notified:
        try:
            import advisory
            if hasattr(advisory, 'notify_ai_command_end'): advisory.notify_ai_command_end()
        except ImportError: pass
    if not processed_response and processed_tags_info:
        summary = []
        for tag_info in processed_tags_info:
            if tag_info['type'] == 'action_control': summary.append(f"{tag_info['action']} {tag_info['status']}")
            elif tag_info['type'] == 'general_command':
                if tag_info['status'] == 'speakforuser executed': summary.append(f"SpeakForUser (processed)")
                elif tag_info['status'] == 'recognized command executed': summary.append(f"command '{tag_info['value_strip'][:30]}...' executed")
                elif tag_info['status'] == 'unrecognized and ignored': summary.append(f"command '{tag_info['value_strip'][:30]}...' unrecognized/ignored")
                elif 'failed' in tag_info['status']: summary.append(f"command '{tag_info['value_strip'][:30]}...' failed")
        if summary: processed_response = f"[CORE ACTION: Processed AI tags. Summary: {'; '.join(summary)}.]"
        else: processed_response = "[CORE ACTION: Processed AI tags. No specific actions to summarize.]"
    return processed_response