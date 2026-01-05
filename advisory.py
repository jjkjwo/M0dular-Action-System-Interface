# advisory.py - Central Advisory System for Inter-Addon Communication (FIXED FOR AI COMMANDS)
# Allows addons to register advisories that get injected into the conversation
# Priority 10.5 - runs after most content generators but before final formatting
# FIXED: Now properly handles AI-triggered commands to prevent inappropriate injection

import os
import json
import time
from datetime import datetime
from collections import defaultdict, OrderedDict

ACTION_NAME = "advisory"
ACTION_PRIORITY = 10.5  # After memory (10) but before persona (11)

# State variables
_is_active = False
_advisories = OrderedDict()  # {source: {"content": str, "priority": int, "persistent": bool, "timestamp": float, "category": str}}
_advisory_history = []  # Keep last N rounds of advisories for debugging
_config = {
    "base_advisory_enabled": True,
    "base_advisory_text": "[SYSTEM ADVISORY: AI Assistant Enhanced Mode - Multiple subsystems active]",
    "max_advisories_per_turn": 5,
    "advisory_format": "minimal",  # "minimal", "detailed", "structured"
    "clear_after_turn": True,
    "history_size": 10,
    "priority_threshold": 0,  # Only show advisories with priority >= this
    "debug_mode": False,
    "skip_injection_for_commands": True,  # Skip injecting advisories for system commands
    "show_categories": False,  # Whether to show category info in detailed/structured formats
    "skip_ai_triggered_commands": True  # NEW: Skip injection when processing AI-triggered commands
}
_turn_counter = 0
_last_advisory_content = ""
_processing_ai_command = False  # NEW: Track if we're processing an AI-triggered command

# Config file for persistence
CONFIG_FILE = "advisory_config.json"
ADVISORY_LOG_FILE = "advisory_log.txt"

def load_config():
    """Load configuration from file"""
    global _config
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded_config = json.load(f)
                _config.update(loaded_config)
            print(f"[{ACTION_NAME.upper()}: Loaded configuration from {CONFIG_FILE}]")
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

def log_advisory_event(event_type, data=None):
    """Log advisory events for debugging"""
    if not _config.get("debug_mode", False):
        return
    
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {event_type}"
        if data:
            log_entry += f": {json.dumps(data, default=str)}"
        
        with open(ADVISORY_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error logging: {e}]")

async def start_action(system_functions=None):
    """Initialize the advisory system"""
    global _is_active, _turn_counter, _processing_ai_command
    _is_active = True
    _turn_counter = 0
    _processing_ai_command = False
    
    load_config()
    
    # Clear any stale advisories
    _advisories.clear()
    
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Central Advisory System active]")
    print(f"[{ACTION_NAME.upper()}: Base advisory: {'ON' if _config['base_advisory_enabled'] else 'OFF'}]")
    print(f"[{ACTION_NAME.upper()}: Format: {_config['advisory_format']}, Max per turn: {_config['max_advisories_per_turn']}]")
    print(f"[{ACTION_NAME.upper()}: Skip injection for commands: {'YES' if _config.get('skip_injection_for_commands', True) else 'NO'}]")
    print(f"[{ACTION_NAME.upper()}: Skip AI-triggered commands: {'YES' if _config.get('skip_ai_triggered_commands', True) else 'NO'}]")
    
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()}: Advisory system initialized. Other addons can now register advisories.]"
        )

async def stop_action(system_functions=None):
    """Stop the advisory system"""
    global _is_active, _processing_ai_command
    _is_active = False
    _processing_ai_command = False
    
    save_config()
    
    # Save final state if debug mode
    if _config.get("debug_mode", False) and _advisory_history:
        try:
            with open("advisory_final_state.json", "w", encoding="utf-8") as f:
                json.dump({
                    "final_advisories": dict(_advisories),
                    "history": _advisory_history[-10:],
                    "config": _config
                }, f, indent=2, default=str)
        except Exception:
            pass
    
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Advisory system disabled]")

# Public API for other addons
def register_advisory(source, content, priority=5, persistent=False, category="GENERAL"):
    """
    Register an advisory from another addon.
    
    Args:
        source (str): Name of the addon registering the advisory
        content (str): The advisory text to inject
        priority (int): Priority 1-10, higher = more important
        persistent (bool): If True, advisory persists across turns
        category (str): Category for organizing advisories (e.g., "AGENT_ACTIVITY", "SYSTEM_WARNING", "MEMORY_UPDATE")
    
    Returns:
        bool: True if registered successfully
    """
    global _advisories, _processing_ai_command
    
    if not _is_active:
        return False
    
    if not source or not content:
        return False
    
    # NEW: Check if we're processing an AI command and should skip
    if _processing_ai_command and _config.get("skip_ai_triggered_commands", True):
        log_advisory_event("advisory_skipped_ai_command", {
            "source": source,
            "reason": "AI-triggered command in progress"
        })
        print(f"[{ACTION_NAME.upper()}: Skipped advisory from '{source}' - AI command in progress]")
        return False
    
    # Validate priority
    priority = max(1, min(10, priority))
    
    _advisories[source] = {
        "content": content.strip(),
        "priority": priority,
        "persistent": persistent,
        "timestamp": time.time(),
        "category": category  # Store the category
    }
    
    log_advisory_event("advisory_registered", {
        "source": source,
        "priority": priority,
        "persistent": persistent,
        "category": category,
        "content_preview": content[:100]
    })
    
    return True

def remove_advisory(source):
    """Remove an advisory by source"""
    if source in _advisories:
        del _advisories[source]
        log_advisory_event("advisory_removed", {"source": source})
        return True
    return False

def get_current_advisories():
    """Get all current advisories (for debugging/status)"""
    return dict(_advisories)

def clear_non_persistent_advisories():
    """Clear all non-persistent advisories"""
    global _advisories
    persistent_only = OrderedDict()
    for source, advisory in _advisories.items():
        if advisory.get("persistent", False):
            persistent_only[source] = advisory
    _advisories = persistent_only
    log_advisory_event("cleared_non_persistent", {"remaining": list(persistent_only.keys())})

# NEW: Function to notify advisory system about AI command processing
def set_ai_command_processing(is_processing):
    """
    Set whether we're currently processing an AI-triggered command.
    This should be called by core.py or other modules when they detect AI commands.
    """
    global _processing_ai_command
    _processing_ai_command = is_processing
    if is_processing:
        log_advisory_event("ai_command_processing_started")
    else:
        log_advisory_event("ai_command_processing_ended")

# Internal formatting functions
def format_advisories():
    """Format all active advisories for injection"""
    if not _advisories and not _config.get("base_advisory_enabled", True):
        return None
    
    # NEW: Skip if processing AI command
    if _processing_ai_command and _config.get("skip_ai_triggered_commands", True):
        return None
    
    advisory_parts = []
    
    # Get advisories sorted by priority (highest first)
    sorted_advisories = sorted(
        _advisories.items(),
        key=lambda x: x[1]["priority"],
        reverse=True
    )
    
    # Apply threshold
    threshold = _config.get("priority_threshold", 0)
    filtered_advisories = [
        (source, adv) for source, adv in sorted_advisories 
        if adv["priority"] >= threshold
    ]
    
    # Limit number of advisories
    max_advisories = _config.get("max_advisories_per_turn", 5)
    if len(filtered_advisories) > max_advisories:
        filtered_advisories = filtered_advisories[:max_advisories]
    
    format_style = _config.get("advisory_format", "minimal")
    
    if format_style == "minimal":
        # Simple concatenated format
        if _config.get("base_advisory_enabled", True):
            advisory_parts.append(_config.get("base_advisory_text", ""))
        
        for source, advisory in filtered_advisories:
            advisory_parts.append(advisory["content"])
        
        if advisory_parts:
            return "\n".join(advisory_parts) + "\n"
    
    elif format_style == "detailed":
        # Include source and priority info
        advisory_parts.append("[SYSTEM ADVISORIES ACTIVE]")
        
        if _config.get("base_advisory_enabled", True):
            advisory_parts.append(f"• BASE: {_config.get('base_advisory_text', '')}")
        
        for source, advisory in filtered_advisories:
            category_info = f" [{advisory.get('category', 'GENERAL')}]" if _config.get("show_categories", False) else ""
            advisory_parts.append(f"• {source.upper()} (P{advisory['priority']}{category_info}): {advisory['content']}")
        
        advisory_parts.append("[END ADVISORIES]\n")
        return "\n".join(advisory_parts)
    
    elif format_style == "structured":
        # JSON-like structured format
        advisory_data = {
            "system_advisories": {
                "base": _config.get("base_advisory_text", "") if _config.get("base_advisory_enabled", True) else None,
                "addons": {
                    source: {
                        "content": adv["content"],
                        "priority": adv["priority"],
                        "category": adv.get("category", "GENERAL")
                    }
                    for source, adv in filtered_advisories
                }
            }
        }
        return f"[ADVISORY_DATA]\n{json.dumps(advisory_data, indent=2)}\n[END_ADVISORY_DATA]\n"
    
    return None

# Command handling
async def handle_commands(user_input, system_functions):
    """Handle advisory-specific commands"""
    input_lower = user_input.lower().strip()
    
    if input_lower == "advisory status":
        active_count = len(_advisories)
        persistent_count = sum(1 for a in _advisories.values() if a.get("persistent", False))
        
        # Count advisories by category
        category_counts = defaultdict(int)
        for adv in _advisories.values():
            category_counts[adv.get("category", "GENERAL")] += 1
        
        status_lines = [
            f"[{ACTION_NAME.upper()} STATUS]",
            f"Active advisories: {active_count} ({persistent_count} persistent)",
            f"Base advisory: {'ENABLED' if _config['base_advisory_enabled'] else 'DISABLED'}",
            f"Format: {_config['advisory_format']}",
            f"Max per turn: {_config['max_advisories_per_turn']}",
            f"Priority threshold: {_config['priority_threshold']}",
            f"Clear after turn: {'YES' if _config['clear_after_turn'] else 'NO'}",
            f"Skip injection for commands: {'YES' if _config.get('skip_injection_for_commands', True) else 'NO'}",
            f"Skip AI-triggered commands: {'YES' if _config.get('skip_ai_triggered_commands', True) else 'NO'}",
            f"Currently processing AI command: {'YES' if _processing_ai_command else 'NO'}",
            f"Show categories: {'YES' if _config.get('show_categories', False) else 'NO'}",
        ]
        
        if category_counts:
            status_lines.append("\nAdvisories by category:")
            for category, count in sorted(category_counts.items()):
                status_lines.append(f"  • {category}: {count}")
        
        if active_count > 0:
            status_lines.append("\nActive advisories:")
            for source, adv in _advisories.items():
                persist_marker = " [P]" if adv.get("persistent", False) else ""
                category_info = f" ({adv.get('category', 'GENERAL')})" if _config.get('show_categories', False) else ""
                status_lines.append(f"  • {source}: Priority {adv['priority']}{persist_marker}{category_info}")
        
        return "\n".join(status_lines)
    
    elif input_lower == "advisory clear":
        count = len(_advisories)
        _advisories.clear()
        return f"[{ACTION_NAME.upper()}: Cleared {count} advisories]"
    
    elif input_lower == "advisory clear temp":
        before_count = len(_advisories)
        clear_non_persistent_advisories()
        after_count = len(_advisories)
        cleared = before_count - after_count
        return f"[{ACTION_NAME.upper()}: Cleared {cleared} temporary advisories, {after_count} persistent remain]"
    
    elif input_lower.startswith("advisory remove "):
        source = input_lower[15:].strip()
        if remove_advisory(source):
            return f"[{ACTION_NAME.upper()}: Removed advisory from '{source}']"
        return f"[{ACTION_NAME.upper()}: No advisory found from '{source}']"
    
    elif input_lower.startswith("advisory format "):
        new_format = input_lower[15:].strip()
        if new_format in ["minimal", "detailed", "structured"]:
            _config["advisory_format"] = new_format
            save_config()
            return f"[{ACTION_NAME.upper()}: Format set to '{new_format}']"
        return f"[{ACTION_NAME.upper()}: Invalid format. Use: minimal, detailed, or structured]"
    
    elif input_lower.startswith("advisory threshold "):
        try:
            threshold = int(input_lower[18:].strip())
            if 0 <= threshold <= 10:
                _config["priority_threshold"] = threshold
                save_config()
                return f"[{ACTION_NAME.upper()}: Priority threshold set to {threshold}]"
        except ValueError:
            pass
        return f"[{ACTION_NAME.upper()}: Invalid threshold. Use a number 0-10]"
    
    elif input_lower == "advisory base on":
        _config["base_advisory_enabled"] = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Base advisory ENABLED]"
    
    elif input_lower == "advisory base off":
        _config["base_advisory_enabled"] = False
        save_config()
        return f"[{ACTION_NAME.upper()}: Base advisory DISABLED]"
    
    elif input_lower.startswith("advisory base set "):
        new_base = user_input[18:].strip()  # Use original case
        if new_base:
            _config["base_advisory_text"] = new_base
            save_config()
            return f"[{ACTION_NAME.upper()}: Base advisory updated]"
        return f"[{ACTION_NAME.upper()}: Base advisory text cannot be empty]"
    
    elif input_lower == "advisory categories on":
        _config["show_categories"] = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Category display ENABLED]"
    
    elif input_lower == "advisory categories off":
        _config["show_categories"] = False
        save_config()
        return f"[{ACTION_NAME.upper()}: Category display DISABLED]"
    
    elif input_lower == "advisory skip on":
        _config["skip_injection_for_commands"] = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Will now SKIP injecting advisories for system commands]"
    
    elif input_lower == "advisory skip off":
        _config["skip_injection_for_commands"] = False
        save_config()
        return f"[{ACTION_NAME.upper()}: Will now INJECT advisories even for system commands]"
    
    elif input_lower == "advisory ai skip on":
        _config["skip_ai_triggered_commands"] = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Will now SKIP advisories during AI-triggered commands]"
    
    elif input_lower == "advisory ai skip off":
        _config["skip_ai_triggered_commands"] = False
        save_config()
        return f"[{ACTION_NAME.upper()}: Will now ALLOW advisories during AI-triggered commands]"
    
    elif input_lower == "advisory debug on":
        _config["debug_mode"] = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Debug mode ENABLED - logging to {ADVISORY_LOG_FILE}]"
    
    elif input_lower == "advisory debug off":
        _config["debug_mode"] = False
        save_config()
        return f"[{ACTION_NAME.upper()}: Debug mode DISABLED]"
    
    elif input_lower == "advisory help":
        help_text = [
            f"[{ACTION_NAME.upper()} HELP]",
            "Commands:",
            "  advisory status - Show current status and active advisories",
            "  advisory clear - Clear all advisories",
            "  advisory clear temp - Clear only temporary advisories",
            "  advisory remove <source> - Remove advisory from specific source",
            "  advisory format <minimal|detailed|structured> - Set display format",
            "  advisory threshold <0-10> - Set minimum priority to display",
            "  advisory base on/off - Enable/disable base advisory",
            "  advisory base set <text> - Set base advisory text",
            "  advisory categories on/off - Show/hide category information",
            "  advisory skip on/off - Skip injection for system commands",
            "  advisory ai skip on/off - Skip injection for AI-triggered commands",
            "  advisory debug on/off - Enable/disable debug logging",
            "",
            "For addon developers:",
            "  Call register_advisory(source, content, priority=5, persistent=False, category='GENERAL')",
            "  to add advisories that will be injected into the conversation.",
            "",
            "Common categories: AGENT_ACTIVITY, SYSTEM_WARNING, MEMORY_UPDATE, USER_STATUS"
        ]
        return "\n".join(help_text)
    
    return None

async def process_input(user_input, system_functions, is_system_command=False):
    """Process user input, respecting the command context provided by the loader."""
    global _is_active, _turn_counter, _last_advisory_content, _processing_ai_command
    
    if not _is_active:
        return user_input
    
    # Handle commands internal to this addon first
    command_result = await handle_commands(user_input, system_functions)
    if command_result:
        return command_result
        
    # Determine if we should skip injection based on flags.
    # This is more reliable than re-checking the (potentially modified) user_input.
    should_skip_injection = False
    
    # Scenario 1: It's a regular user command (flag from loader) and we're configured to skip.
    if is_system_command and _config.get("skip_injection_for_commands", True):
        print(f"[{ACTION_NAME.upper()}: Detected system command (via flag) - skipping advisory injection]")
        should_skip_injection = True
        
    # Scenario 2: It's an AI-triggered command being processed and we're configured to skip.
    if _processing_ai_command and _config.get("skip_ai_triggered_commands", True):
        print(f"[{ACTION_NAME.upper()}: Processing AI-triggered command - skipping advisory injection]")
        should_skip_injection = True

    # If we determined we should skip, then exit early.
    if should_skip_injection:
        if _config.get("clear_after_turn", True):
            clear_non_persistent_advisories()
        _turn_counter += 1
        return user_input
    
    # Let other addons register advisories based on user input
    # They can call register_advisory() in their process_input functions
    
    # Format and inject advisories
    advisory_content = format_advisories()
    
    if advisory_content:
        _last_advisory_content = advisory_content
        modified_input = advisory_content + user_input
        
        log_advisory_event("advisories_injected", {
            "turn": _turn_counter,
            "advisory_count": len(_advisories),
            "user_input_preview": user_input[:50]
        })
        
        if len(_advisory_history) >= _config.get("history_size", 10):
            _advisory_history.pop(0)
        
        _advisory_history.append({
            "turn": _turn_counter,
            "advisories": dict(_advisories),
            "formatted": advisory_content[:200] + "..." if len(advisory_content) > 200 else advisory_content
        })
        
        if _config.get("clear_after_turn", True):
            clear_non_persistent_advisories()
        
        _turn_counter += 1
        
        if _config.get("debug_mode", False):
            print(f"[{ACTION_NAME.upper()}: Injected {len(_advisories)} advisories into turn {_turn_counter}]")
        
        return modified_input
    
    # Even if no advisories, increment turn and clear if needed
    if _config.get("clear_after_turn", True):
        clear_non_persistent_advisories()
    
    _turn_counter += 1
    return user_input

async def process_output(ai_response, system_functions):
    """Process AI output (no modification needed)"""
    return ai_response

# Utility function for other addons to check if advisory system is active
def is_advisory_active():
    """Check if the advisory system is currently active"""
    return _is_active

# Utility function for core.py to notify us about AI commands
def notify_ai_command_start():
    """Notify advisory system that an AI-triggered command is starting"""
    set_ai_command_processing(True)

def notify_ai_command_end():
    """Notify advisory system that an AI-triggered command has ended"""
    set_ai_command_processing(False)

# Example usage function for documentation
def example_usage():
    """
    Example of how other addons can use the advisory system:
    
    # In another addon's process_input or other function:
    try:
        import advisory
        if hasattr(advisory, 'register_advisory'):
            # Check if category parameter is supported
            import inspect
            sig = inspect.signature(advisory.register_advisory)
            if 'category' in sig.parameters:
                advisory.register_advisory(
                    source="my_addon",
                    content="[MY_ADDON: Important context - user mood is happy]",
                    priority=7,
                    persistent=False,
                    category="USER_STATUS"
                )
            else:
                # Fallback without category
                advisory.register_advisory(
                    source="my_addon",
                    content="[MY_ADDON: Important context - user mood is happy]",
                    priority=7,
                    persistent=False
                )
    except ImportError:
        pass  # Advisory addon not available
    """
    pass