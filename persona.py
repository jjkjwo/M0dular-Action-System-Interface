# persona.py - AI Persona Manager (Corrected and Simplified)
import os
import json

# Global variables to track the addon's state
_is_persona_active = False
_current_persona = None
_personas = {}

# --- CORE ADDON FUNCTIONS ---

def initialize():
    """Load default and user-defined personas from personas.json."""
    global _personas
    
    DEFAULT_PERSONAS = {
        "default": {
            "name": "Default Assistant",
            "description": "A helpful, balanced AI assistant.",
            "system_prompt": "You are a helpful AI assistant that provides factual, balanced responses."
        },
        "technical": {
            "name": "Technical Expert",
            "description": "An AI assistant focused on technical subjects.",
            "system_prompt": "You are a technical expert AI assistant. You specialize in providing detailed, accurate information on technical subjects including programming, data science, engineering, and mathematics. Use examples and clear explanations."
        },
        "creative": {
            "name": "Creative Writer",
            "description": "An AI assistant for creative writing.",
            "system_prompt": "You are a creative writing assistant. You help with generating creative content, stories, poems, and other imaginative writing. Use rich language, vivid descriptions, and interesting narrative structures."
        }
    }
    
    _personas = DEFAULT_PERSONAS.copy()
    
    try:
        if os.path.exists("personas.json"):
            with open("personas.json", "r", encoding="utf-8") as f:
                _personas.update(json.load(f))
                print(f"[PERSONA: Loaded personas from file]")
    except Exception as e:
        print(f"[PERSONA: Error loading personas.json: {e}]")

def save_personas():
    """Save the current personas dictionary to personas.json."""
    try:
        with open("personas.json", "w", encoding="utf-8") as f:
            json.dump(_personas, f, indent=2)
            print("[PERSONA: Saved personas to personas.json]")
    except Exception as e:
        print(f"[PERSONA: Error saving personas.json: {e}]")

async def start_action(system_functions):
    """Activates the persona addon. Called by 'start persona'."""
    global _is_persona_active
    _is_persona_active = True
    initialize()
    return "[PERSONA: Persona manager activated.]"

async def stop_action(system_functions):
    """Deactivates the persona addon. Called by 'stop persona'."""
    global _is_persona_active, _current_persona
    _is_persona_active = False
    _current_persona = None
    save_personas()
    return "[PERSONA: Persona manager deactivated.]"

# --- MAIN LOGIC ---

async def process_input(user_input, system_functions):
    """
    This is the core logic that applies the persona's instructions.
    It runs on EVERY message that is NOT a command.
    """
    # If the addon isn't on or no persona is selected, do nothing.
    if not _is_persona_active or not _current_persona:
        return user_input

    # Get the api_manager from the system_functions dictionary passed by the main loop.
    api_manager = system_functions.get("api_manager")
    
    # THE FIX:
    # 1. We check if the api_manager exists.
    # 2. We call api_manager.get_history() to get the chat history.
    # 3. We check if that history is empty (meaning this is a new conversation).
    if api_manager and not api_manager.get_history():
        # If it's a new conversation, get the system_prompt for the active persona.
        persona_data = _personas.get(_current_persona)
        if persona_data:
            persona_prompt = persona_data.get("system_prompt")
            if persona_prompt:
                print(f"[PERSONA: Applying '{_current_persona}' persona to new conversation.]")
                # Prepend the instruction to the user's message.
                return f"{persona_prompt}\n\nUser: {user_input}"
            
    # If it's not a new conversation, just return the user's input unchanged.
    return user_input

async def handle_command(command, system_functions):
    """
    This function handles all the user-typed commands like 'persona list', 'persona use', etc.
    """
    # If the command doesn't start with 'persona', this function ignores it.
    if not command.lower().startswith("persona "):
        return None

    global _current_persona
    
    parts = command.strip().split(" ", 2)
    sub_command = parts[1].lower() if len(parts) > 1 else ""

    if sub_command == "list":
        active = f" (Active: {_current_persona})" if _current_persona else ""
        return f"[PERSONA: Available personas: {', '.join(_personas.keys())}{active}]"

    elif sub_command == "info":
        if len(parts) > 2:
            name = parts[2]
            if name in _personas:
                p = _personas[name]
                return f"[PERSONA: '{p['name']}']\nDescription: {p['description']}\nSystem Prompt: {p['system_prompt']}"
            return f"[PERSONA: Persona '{name}' not found.]"
        return "[PERSONA: Usage: persona info <name>]"

    elif sub_command == "use":
        if len(parts) > 2:
            name = parts[2]
            if name in _personas:
                _current_persona = name
                # CRITICAL IMPROVEMENT:
                # When you switch personas, we must clear the old conversation history.
                # This guarantees the new persona's instructions are applied on the very next turn.
                api_manager = system_functions.get("api_manager")
                if api_manager:
                    api_manager.clear_history()
                return f"[PERSONA: Style set to '{name}'. History cleared to apply new style immediately.]"
            return f"[PERSONA: Persona '{name}' not found.]"
        return "[PERSONA: Usage: persona use <name>]"

    elif sub_command == "clear":
        _current_persona = None
        return "[PERSONA: Active persona cleared. Reverting to default behavior.]"

    elif sub_command == "create":
        if len(parts) > 2:
            # Format: Name Description | System Prompt
            create_args = parts[2]
            if "|" not in create_args:
                return "[PERSONA: Invalid format. Use: persona create Name Description | System Prompt]"
            
            name_desc, prompt = create_args.split("|", 1)
            name_desc_parts = name_desc.strip().split(" ", 1)

            if len(name_desc_parts) < 2:
                return "[PERSONA: You must provide a single-word name and a description.]"

            name, desc = name_desc_parts[0], name_desc_parts[1]
            _personas[name] = {"name": name, "description": desc.strip(), "system_prompt": prompt.strip()}
            save_personas()
            return f"[PERSONA: Created persona '{name}']"
        return "[PERSONA: Invalid format. Use: persona create Name Description | System Prompt]"

    elif sub_command == "delete":
        if len(parts) > 2:
            name = parts[2]
            if name == "default":
                return "[PERSONA: The 'default' persona cannot be deleted.]"
            if name in _personas:
                del _personas[name]
                save_personas()
                return f"[PERSONA: Deleted persona '{name}']"
            return f"[PERSONA: Persona '{name}' not found.]"
        return "[PERSONA: Usage: persona delete <name>]"
    
    return None # Return None if the command is unknown