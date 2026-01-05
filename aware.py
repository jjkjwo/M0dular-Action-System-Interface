# aware.py - Goal Agent and System Awareness Plugin
# Informs the AI about v-agent capabilities and other system features when keywords are detected
#
# KEY BEHAVIOR: This plugin monitors USER input (not AI output) for trigger keywords.
# When detected, it injects awareness information into the user's message before sending to AI.
# This ensures the AI is contextually aware of system features when users are likely to need them.
import os
import json
import re

ACTION_NAME = "aware"
ACTION_PRIORITY = 5.5  # After focus (5.5) but before voice/controls (6)

# State tracking
_is_active = False
_awareness_config = None
_last_injection_turns = {}  # Track last injection turn for each awareness type
_turn_counter = 0

async def start_action():
    """Initialize the aware action"""
    global _is_active, _awareness_config, _last_injection_turns, _turn_counter
    _is_active = True
    _turn_counter = 0
    
    # Load awareness configuration
    _awareness_config = load_awareness_config()
    
    # Debug: Verify goal_agent is disabled
    goal_config = _awareness_config.get("awareness_configs", {}).get("goal_agent", {})
    print(f"[{ACTION_NAME.upper()} DEBUG: goal_agent config loaded with enabled={goal_config.get('enabled', 'NOT FOUND')}]")
    
    # Initialize injection tracking for each awareness type
    for awareness_type in _awareness_config.get("awareness_configs", {}):
        cooldown = _awareness_config["awareness_configs"][awareness_type].get("cooldown_turns", 3)
        _last_injection_turns[awareness_type] = -cooldown - 1  # Allow immediate first injection
    
    enabled_types = [k for k, v in _awareness_config.get("awareness_configs", {}).items() if v.get("enabled", False)]
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - System Awareness ENABLED. Active types: {', '.join(enabled_types) if enabled_types else 'None'}]")

async def stop_action():
    """Stop the aware action"""
    global _is_active
    _is_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - System Awareness DISABLED.]")

def load_awareness_config():
    """Load awareness configuration from JSON file"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(script_dir, "aware_config.json")
        
        if not os.path.exists(config_path):
            print(f"[{ACTION_NAME.upper()} WARNING: aware_config.json not found at {config_path}. Using default configuration.]")
            return get_default_config()
            
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
            
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR: Failed to load awareness config: {e}. Using default configuration.]")
        return get_default_config()

def get_default_config():
    """Return default configuration if JSON file is not available"""
    return {
        "awareness_configs": {
            "goal_agent": {
                "enabled": False,  # DISABLED by default
                "keywords": ["ai", "agent", "goal", "task", "v-agent", "vagent", "goal agent"],
                "cooldown_turns": 3
            },
            "sound_system": {
                "enabled": True,  # ENABLED by default
                "keywords": ["play", "sound", "music", "song", "audio"],
                "cooldown_turns": 3
            }
        }
    }

def reload_config():
    """Reload configuration from file (useful for runtime updates)"""
    global _awareness_config
    _awareness_config = load_awareness_config()
    print(f"[{ACTION_NAME.upper()}: Configuration reloaded]")

def contains_keywords(text, keywords):
    """Check if text contains any keywords, respecting word boundaries.
    Used to scan USER input for trigger words that should activate awareness injection."""
    text_lower = text.lower()
    for keyword in keywords:
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, text_lower):
            return True
    return False

def load_agent_capabilities():
    """Load and format agent capabilities from agent_tools.json"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        tools_path = os.path.join(script_dir, "agent_tools.json")
        
        if not os.path.exists(tools_path):
            return None
            
        with open(tools_path, "r", encoding="utf-8") as f:
            agent_tools = json.load(f)
            
        capabilities_parts = []
        
        def format_tools(tool_list, max_items=3):
            formatted = []
            count = 0
            for tool in tool_list:
                if tool.get('type') != 'reference':
                    if count < max_items:
                        formatted.append(f"  • {tool['command']}: {tool['description']}")
                    count += 1
            if count > max_items:
                formatted.append(f"  • ...and {count - max_items} more.")
            return formatted

        if "core_agent_tools" in agent_tools and agent_tools["core_agent_tools"]:
            capabilities_parts.append("CORE CAPABILITIES:")
            capabilities_parts.extend(format_tools(agent_tools["core_agent_tools"]))
        
        if "ui_and_web_tools" in agent_tools and agent_tools["ui_and_web_tools"]:
            capabilities_parts.append("\nUI/WEB CAPABILITIES:")
            capabilities_parts.extend(format_tools(agent_tools["ui_and_web_tools"]))
        
        if "backend_control_tools" in agent_tools and agent_tools["backend_control_tools"]:
            capabilities_parts.append("\nBACKEND CAPABILITIES:")
            capabilities_parts.extend(format_tools(agent_tools["backend_control_tools"]))
                    
        return "\n".join(capabilities_parts) if capabilities_parts else None
        
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR: Failed to load agent capabilities: {e}]")
        return None

def create_awareness_injection(awareness_type, config):
    """Create awareness content from configuration"""
    injection_config = config.get("injection_content", {})
    sections = injection_config.get("sections", {})
    
    content_parts = [f"\n[{injection_config.get('title', awareness_type.upper())}]"]
    
    # Process sections in order
    for section_key, section_data in sections.items():
        if isinstance(section_data, str):
            content_parts.append(section_data)
        elif isinstance(section_data, dict):
            # Handle different section types
            if "title" in section_data:
                content_parts.append(f"\n{section_data['title']}")
            
            if section_key == "capabilities" and section_data.get("load_from_file"):
                # Special handling for capabilities loading
                capabilities = load_agent_capabilities()
                if capabilities:
                    content_parts.append(capabilities)
                else:
                    # Use fallback
                    fallback_items = section_data.get("fallback", [])
                    content_parts.extend(fallback_items)
            
            elif "content" in section_data:
                content_parts.append(section_data["content"])
            
            elif "items" in section_data:
                for item in section_data["items"]:
                    content_parts.append(f"- {item}")
            
            elif "commands" in section_data:
                content_parts.extend(section_data["commands"])
            
            elif "steps" in section_data:
                for step in section_data["steps"]:
                    content_parts.append(f"   {step}")
            
            elif "agent_behavior" in section_data:
                content_parts.append("")
                for behavior in section_data["agent_behavior"]:
                    content_parts.append(f"   {behavior}")
            
            elif "control_commands" in section_data:
                content_parts.append("")
                for command in section_data["control_commands"]:
                    content_parts.append(f"   {command}")
    
    # Add footer if exists
    if "footer" in sections:
        content_parts.append(f"\n{sections['footer']}")
    
    content_parts.append(f"[END {injection_config.get('title', awareness_type.upper())}]\n\nUser's message: ")
    
    return "\n".join(content_parts)

async def process_input(user_input, system_functions):
    """Process user input and inject awareness when keywords detected
    
    IMPORTANT: This function monitors the USER's input for keywords, NOT the AI's responses.
    When a user types something containing trigger keywords (e.g., "play music", "tell me about the agent"),
    the system injects relevant awareness information before sending to the AI.
    
    This is intentional to:
    - Give users indirect control over when AI gets feature reminders
    - Prevent recursive loops (AI mentioning keywords won't trigger more awareness)
    - Ensure AI is informed about features when users are likely to need them
    """
    global _is_active, _awareness_config, _last_injection_turns, _turn_counter
    
    if not _is_active or not _awareness_config:
        return user_input
    
    normalized_input = user_input.strip().lower()
    
    # Skip awareness injection for direct commands
    skip_commands = ["goal ", "start ", "stop ", "api ", "soundstart:", "stopsound", "soundvolume:"]
    if any(normalized_input.startswith(cmd) for cmd in skip_commands):
        print(f"[{ACTION_NAME.upper()} DEBUG: Skipping awareness for direct command: {normalized_input[:20]}...]")
        return user_input
    
    _turn_counter += 1
    
    modified_input = user_input
    log_event = system_functions.get("log_event", lambda *args, **kwargs: None)
    
    # Check each awareness type
    for awareness_type, config in _awareness_config.get("awareness_configs", {}).items():
        enabled = config.get("enabled", False)
        
        # Type safety check - ensure enabled is actually a boolean
        if not isinstance(enabled, bool):
            print(f"[{ACTION_NAME.upper()} WARNING: 'enabled' for {awareness_type} is not a boolean: {type(enabled)} = {enabled}]")
            enabled = str(enabled).lower() == "true"
        
        # Debug log to verify enabled state
        if awareness_type == "goal_agent":
            print(f"[{ACTION_NAME.upper()} DEBUG: goal_agent enabled state = {enabled} (type: {type(enabled)})]")
            
        if not enabled:
            continue
            
        keywords = config.get("keywords", [])
        if not keywords or not contains_keywords(user_input, keywords):
            continue
            
        # Check cooldown
        cooldown_turns = config.get("cooldown_turns", 3)
        last_injection_turn = _last_injection_turns.get(awareness_type, -cooldown_turns - 1)
        
        if (_turn_counter - last_injection_turn) > cooldown_turns:
            _last_injection_turns[awareness_type] = _turn_counter
            log_event(f"{awareness_type}_aware_injection_triggered", {"user_input_snippet": user_input[:70]})
            
            awareness_content = create_awareness_injection(awareness_type, config)
            modified_input = awareness_content + user_input
            print(f"[{ACTION_NAME.upper()}: Injecting {awareness_type.upper()} awareness information]")
            break  # Only inject one awareness type per turn
        else:
            print(f"[{ACTION_NAME.upper()}: {awareness_type} keywords detected, but awareness injection is on cooldown. Last injected on turn {last_injection_turn}, current turn {_turn_counter}.]")
    
    return modified_input

async def process_output(ai_response, system_functions):
    """Optionally process AI output (not used in this plugin for awareness injection)"""
    return ai_response

# Utility function to check if specific awareness is enabled
def is_awareness_enabled(awareness_type):
    """Check if a specific awareness type is enabled"""
    if not _awareness_config:
        return False
    return _awareness_config.get("awareness_configs", {}).get(awareness_type, {}).get("enabled", False)

# Utility function to get all enabled awareness types
def get_enabled_awareness_types():
    """Get list of all enabled awareness types"""
    if not _awareness_config:
        return []
    return [k for k, v in _awareness_config.get("awareness_configs", {}).items() if v.get("enabled", False)]