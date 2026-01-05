# action_simplified.py - V 3.7 - Main Entry Point (Patched for OpenAI v1.0+ compatibility)
# AIAUTH006: Corrected system_functions to use loader.get_action_object.
# OFFLINE FIX: Only initialize API in server mode to prevent timeout when offline
import os
import asyncio
import importlib
import sys

# Add current directory to Python path to ensure all imports work
current_dir = os.path.abspath(os.path.dirname(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Import our modular components
import config
import loader # Assuming loader.py is in the same directory or Python path
import looper
import api_manager

# ------------------------------ GLOBAL VARIABLES ------------------------------
# Define available actions - Should align with actions.json
ACTION_MAP = {
    "health_observer_ss1": {
        "script_file": "health_observer_ss1.py",
        "priority": -1,  # Runs before most other actions.
        "is_active_by_default": True,
        "description": "Silent Structure 1: A pure observer that safely monitors system state by reading files."
    },
    "health_analyzer_ss2": {
        "script_file": "health_analyzer_ss2.py",
        "priority": 99,   # Runs last to analyze the state of a completed turn.
        "is_active_by_default": True,
        "description": "Silent Structure 2: Analyzes data from SS1 and sends health advisories to the AI when needed."
    },
    "jjk": {
        "script_file": "jjk.py",
        "priority": 0.50010,
        "is_active_by_default": False,
        "description": "High-Privilege Progenitor authentication and system override."
    },
    "lvl3": {
        "script_file": "lvl3.py",
        "priority": 1,
        "is_active_by_default": True,
        "description": "Saves last AI reply as timestamp file."
    },
    "dataflow": {
        "script_file": "dataflow.py",
        "priority": 3,
        "is_active_by_default": True,
        "description": "Modern toolkit for agent data interaction and data saving."
    },
    "back": {
        "script_file": "back.py",
        "priority": 2,
        "is_active_by_default": False,
        "description": "Sends the last AI reply back to the AI as the user's turn."
    },
    "resend": {
        "script_file": "resend.py",
        "priority": 2.5,
        "is_active_by_default": True,
        "description": "Handles resending and reprompting."
    },
    "log_reader": {
        "script_file": "log_reader.py",
        "priority": 2,
        "is_active_by_default": True,
        "description": "Allows AI/agents to search and examine recent conversation logs."
    },
    "ok": {
        "script_file": "ok.py",
        "priority": 3,
        "is_active_by_default": False,
        "description": "Triggers actions based on specific keywords in user input."
    },
    "auth": {
        "script_file": "auth.py",
        "priority": 3,  # Higher priority than web_input to intercept first
        "is_active_by_default": True,  # Enable by default for security
        "description": "Authentication and authorization system for web interface access control."
    },
    "update": {
        "script_file": "update.py",
        "priority": 4,
        "is_active_by_default": False,
        "local_path_base": "",
        "description": "Handles file transfers between client and server."
    },
    "web_input": {
        "script_file": "web_input.py",
        "priority": 4,
        "is_active_by_default": False,
        "description": "Reads user input from a web interface instead of the console."
    },
    "x": {
        "script_file": "x.py",
        "priority": 5,
        "is_active_by_default": False,
        "description": "Selects and potentially intensifies a random persona for the AI."
    },
    "flooring": {
        "script_file": "flooring.py",
        "priority": 5.0,
        "is_active_by_default": False,
        "description": "Floor covering calculator for sales - handles carpet, tile, plank calculations with waste factors and material requirements."
    },
    "focus": {
        "script_file": "focus.py",
        "priority": 5.5,
        "is_active_by_default": False,
        "description": "Prompt Perturbation Layer - strategically injects subtle variations to influence AI responses"
    },
    "aware": {
        "script_file": "aware.py",
        "priority": 5.5,
        "is_active_by_default": True,
        "description": "Informs AI about features, such as the goal agent capabilities and playing sounds, when keywords are detected"
    },
    "voice": {
        "script_file": "voice.py",
        "priority": 6,
        "is_active_by_default": True,
        "description": "Enables Text-To-Speech for AI responses. (Terminal)(Front End TTS Switch)"
    },
    "controls": {
        "script_file": "controls.py",
        "priority": 6,
        "is_active_by_default": False,
        "description": "Parses AI commands ([CONTROL:...]) and passes them to the interface or executes locally. Enables ai ui manipulation."
    },
    "block": {
        "script_file": "block.py",
        "priority": 6.5,
        "is_active_by_default": False,
        "description": "Censors specific configured words in the conversation."
    },
    "think_mode": {
        "script_file": "think_mode.py",
        "priority": 2,
        "is_active_by_default": True,
        "description": "AI multi-turn thinking mode - allows AI to refine responses through multiple internal turns before presenting to user."
    },
    "karma": {
        "script_file": "karma.py",
        "priority": 7,
        "is_active_by_default": True,
        "description": "Karma tracking system - monitors user feedback (+1/-1) and influences AI behavior"
    },
    "filter": {
        "script_file": "filter.py",
        "priority": 7,
        "is_active_by_default": False,
        "description": "Filters or censors sensitive information from logs."
    },
    "newfilter": {
        "script_file": "newfilter.py",
        "priority": 7,
        "is_active_by_default": False,
        "description": "Conversational Mode (Terminal): Hides system messages, showing only user/AI turns."
    },
    "recent_turns": {
        "script_file": "recent_turns.py",
        "priority": 8,
        "is_active_by_default": True,
        "description": "Maintains rolling history of last N conversation turns"
    },
    "sms": {
        "script_file": "sms.py",
        "priority": 8,
        "is_active_by_default": False,
        "description": "Sends SMS messages using the Twilio API."
    },
    "emails": {
        "script_file": "emails.py",
        "priority": 8,
        "is_active_by_default": False,
        "description": "Gmail integration for sending emails via Google API with OAuth2 authentication."
    },
    "youtube_action": {
        "script_file": "youtube_action.py",
        "priority": 8,
        "is_active_by_default": False,
        "description": "Suggests YouTube videos relevant to the conversation (requires API key)."
    },
    "wiki_action": {
        "script_file": "wiki_action.py",
        "priority": 8,
        "is_active_by_default": False,
        "description": "Suggests Wikipedia articles relevant to the conversation."
    },
    "lore": {
        "script_file": "lore.py",
        "priority": 8,
        "is_active_by_default": False,
        "description": "World Builder for D&D and storytellers."
    },
    "emotions": {
        "script_file": "emotions.py",
        "priority": 9,
        "is_active_by_default": False,
        "description": "Monitors and tracks the sentiment and emotional tone of the conversation."
    },
    "dirt": {
        "script_file": "dirt.py",
        "priority": 9,
        "is_active_by_default": False,
        "description": "Applies a predefined, static persona to the AI."
    },
    "memory": {
        "script_file": "memory.py",
        "priority": 10,
        "is_active_by_default": True,
        "description": "Manages long-term memories, feeding relevant info to the AI based on keywords."
    },
    "principles": {
        "script_file": "principles.py",
        "priority": 10.3,
        "is_active_by_default": True,
        "description": "Monitors AI responses for ME PRINCIPLES violations and provides immediate feedback via advisory system."
    },
    "advisory": {
        "script_file": "advisory.py",
        "priority": 10.5,
        "is_active_by_default": True,
        "description": "Central advisory system for inter-addon communication. Collects and injects advisories from other addons."
    },
    "prompts": {
        "script_file": "prompts.py",
        "priority": 12,
        "is_active_by_default": False,
        "description": "Smart Whiteboard - persistent behavioral instructions and tactical nudges for the AI. NOT a template system!"
    },
    "persona": {
        "script_file": "persona.py",
        "priority": 11,
        "is_active_by_default": False,
        "description": "Allows users to define and manage different AI personas."
    },
    "core": {
        "script_file": "core.py",
        "priority": 0,
        "is_active_by_default": True,
        "description": "Core action: Executes first, monitors other actions, enables speakforuser and ai system manipulation."
    },
    "placeholder_action": {
        "script_file": "placeholder_action.py",
        "priority": 5.0,
        "is_active_by_default": True,
        "description": "A template and educational addon to demonstrate system best practices for AI-assisted development."
    },
    "sandbox": {
        "script_file": "sandbox.py",
        "priority": 50,
        "is_active_by_default": False,
        "description": "Provides a sandboxed environment for user-AI experimentation with simple operations and scripting.",
        "required_system_functions": ["user_notification", "get_action_obj"]
    }
}


# ------------------------------ INITIALIZATION ------------------------------
def initialize_system():
    """Register all actions defined in ACTION_MAP."""
    print("[SYSTEM: Initializing action system based on ACTION_MAP...]")
    action_source = ACTION_MAP
    registered_count = 0
    error_count = 0
    for action_name, action_config in action_source.items():
        try:
            # Pass action_config directly, assuming loader.py expects the config dictionary
            loader.register_action_config(action_name, action_config)
            # print(f"[SYSTEM: Registered action config for '{action_name}' from ACTION_MAP]") # Reduced verbosity
            registered_count += 1
        except Exception as e:
            print(f"[SYSTEM: ERROR registering action '{action_name}' from ACTION_MAP: {e}]")
            error_count += 1

    # print(f"[SYSTEM: Action system config registration complete. Registered: {registered_count}, Errors: {error_count}]") # Reduced verbosity


# ------------------------------ SHUTDOWN HANDLER ------------------------------
async def handle_prepare_shutdown():
    """Handle prepare_shutdown command by gracefully stopping active actions."""
    print("\n[SYSTEM: Preparing for shutdown...]")
    registry = loader.get_action_registry()
    active_actions = []
    for name, data in registry.items():
        if data.get("is_active", False):
            priority = data.get("config", {}).get("priority", 10)
            active_actions.append((name, priority))

    active_actions.sort(key=lambda x: x[1]) # Low numeric priority (high actual priority) stops first here. Review if this is intended.

    system_functions = {
        "send_to_ai": looper.send_to_ai,
        "get_context": looper.get_context,
        "set_context": looper.set_context,
        "last_ai_reply": lambda: looper.last_ai_reply,
        "action_registry": loader.get_action_registry,
        "get_action_obj": loader.get_action_object, # AIAUTH006 Correction
        "user_notification": looper.user_notification
    }

    print(f"[SYSTEM: Stopping {len(active_actions)} active actions in priority order (lowest numeric priority first)...]")
    for action_name, priority_num in active_actions:
        try:
            # print(f"[SYSTEM: Stopping '{action_name}' (Priority: {priority_num})...]") # Reduced verbosity
            await loader.stop_action(action_name, system_functions)
            # print(f"[SYSTEM: Stopped '{action_name}'.]") # Reduced verbosity
        except Exception as e:
            print(f"[SYSTEM: ERROR stopping action '{action_name}' during shutdown: {e}]")

    print("[SYSTEM: Saving final main configuration (config.json)...]")
    config.save_config()
    print("[SYSTEM: Saving final action configuration (actions.json state via loader)...]")
    if hasattr(loader, 'save_action_config_from_registry'): # Check if function exists
        loader.save_action_config_from_registry()
    elif hasattr(loader, 'save_action_config'): # Fallback to older name
        loader.save_action_config()


    print("[SYSTEM: Shutdown preparation complete. System state saved.")
    return "[SYSTEM: Ready for shutdown]"

# ------------------------------ MAIN ------------------------------
async def main():
    """Main entry point for the application."""
    # print("\n" + "="*50) # Reduced verbosity
    # print("Modular Action System - Starting Up")
    # print("="*50 + "\n") # Reduced verbosity

    initialize_system()

    # print("[SYSTEM: Loading main configuration...]") # Reduced verbosity
    config.load_config()

    server_mode = config.get("SERVER_MODE", False) # Use config value
    if os.environ.get("SERVER_ENVIRONMENT") == "SERVER": # Env var can override for specific runs
        server_mode = True
        config.set("SERVER_MODE", True) # Persist if overridden

    if server_mode:
        print("[SYSTEM: Running in SERVER mode (expects communication via files/Flask)]")
    else:
        print("[SYSTEM: Running in INTERACTIVE mode (expects console input)]")


    # print("[SYSTEM: Initializing action loader (discovery, default loading, monitoring)...]") # Reduced verbosity
    system_functions_for_loader = {
        "send_to_ai": looper.send_to_ai,
        "get_context": looper.get_context,
        "set_context": looper.set_context,
        "last_ai_reply": lambda: looper.last_ai_reply,
        "action_registry": loader.get_action_registry,
        "user_notification": looper.user_notification,
        "get_action_obj": loader.get_action_object # AIAUTH006 Correction
    }
    await loader.initialize(system_functions_for_loader)


    if "web_input" in ACTION_MAP and config.get("ENABLE_WEB_INPUT", False) :
        # print("[SYSTEM: Explicitly trying to start 'web_input' action as per existing logic...]") # Reduced verbosity
        try:
            success = await loader.start_action("web_input", system_functions=system_functions_for_loader)
            # if success: # Reduced verbosity
                # print("[SYSTEM: Successfully started 'web_input' action.]")
            # else:
                 # print("[SYSTEM: WARN - Failed to start 'web_input' action (it might already be running or failed internally).]") # Reduced verbosity
        except Exception as e:
            print(f"[SYSTEM: ERROR explicitly starting 'web_input': {e}]")
    # else: # Reduced verbosity
        # print("[SYSTEM: NOTE - 'web_input' action not defined in ACTION_MAP or ENABLE_WEB_INPUT is false, not starting explicitly.]")


    # OFFLINE FIX: Only initialize API in server mode
    if server_mode:
        # print("[SYSTEM: Initializing API Manager...]") # Reduced verbosity
        api_manager.load_config()
        provider = config.get("API_PROVIDER", api_manager._current_config.get("active_provider"))

        if provider:
            # print(f"[SYSTEM: Active API provider: '{provider}'. Initializing API connection...]") # Reduced verbosity
            try:
                success = await api_manager.initialize_api(provider)
                if success:
                    pass # print(f"[SYSTEM: Successfully initialized API for '{provider}'.]") # Reduced verbosity
                else:
                    print(f"[SYSTEM: FAILED to initialize API for '{provider}'. Check API key files or config/network.]")
                    # print(f"[SYSTEM: API key files expected in directory: {current_dir}]") # Reduced verbosity
            except Exception as e:
                print(f"[SYSTEM: ERROR during API initialization for '{provider}': {e}]")
                # print("[SYSTEM: Ensure API key files are present and correct in the current directory.]") # Reduced verbosity
        else:
            print("[SYSTEM: WARN - No active API provider found. AI calls will fail until configured via CLI or api_config.json/config.json.]")
    else:
        # Still load config for later use, just don't initialize the connection
        api_manager.load_config()

    # print("[SYSTEM: Starting main interaction loop (looper.py)...]") # Reduced verbosity
    await looper.interaction_loop()

    print("[SYSTEM: Interaction loop finished. Preparing for shutdown via handler...]")
    await handle_prepare_shutdown()

    # print("\n" + "="*50) # Reduced verbosity
    # print("Modular Action System - Shutting Down Sequence Complete")
    # print("="*50 + "\n") # Reduced verbosity

# ------------------------------ COMMAND LINE ARGUMENT PROCESSING ------------------------------
async def process_args():
    """Handles command-line arguments."""
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ["openai", "gemini"]:
            print(f"[SYSTEM CL ARGS: Command-line request to use '{arg}' API provider.]")
            config.set("API_PROVIDER", arg)
            if hasattr(api_manager, '_current_config'):
                 api_manager._current_config["active_provider"] = arg
                 api_manager.save_config()
                 # print(f"[SYSTEM CL ARGS: Set API provider to '{arg}' in api_manager state and saved to api_config.json.]") # Reduced
            # else: # Reduced
                # print(f"[SYSTEM CL ARGS: api_manager not fully initialized, API_PROVIDER '{arg}' set in main config.]")
        elif arg == "--server":
            print(f"[SYSTEM CL ARGS: Command-line request to run in SERVER mode.]")
            config.set("SERVER_MODE", True)
            # os.environ["SERVER_ENVIRONMENT"] = "SERVER" # Optionally set env var too
        else:
             print(f"[SYSTEM CL ARGS: Unknown command-line argument '{arg}'. Ignoring.]")
    await main()

# ------------------------------ SCRIPT EXECUTION BLOCK ------------------------------
if __name__ == "__main__":
    try:
        asyncio.run(process_args())
    except KeyboardInterrupt:
        print("\n[SYSTEM: KeyboardInterrupt (Ctrl+C) detected. Initiating shutdown sequence...]")
        async def perform_graceful_shutdown():
            if 'loader' in sys.modules and hasattr(loader, 'get_action_registry') and callable(loader.get_action_registry):
                 print("[SYSTEM: Attempting graceful action shutdown...]")
                 await handle_prepare_shutdown()
            else:
                 # print("[SYSTEM: Loader not sufficiently initialized for full graceful shutdown of actions.]") # Reduced
                 if 'config' in sys.modules and hasattr(config, 'save_config') and callable(config.save_config):
                      # print("[SYSTEM: Saving main config as a fallback.]") # Reduced
                      config.save_config()
        asyncio.run(perform_graceful_shutdown())
        # print("[SYSTEM: Shutdown attempt complete. If loop was active, it may take a moment to fully exit.]") # Reduced
        # print("[SYSTEM: Press Ctrl+C again if stuck (less graceful).]") # Reduced
    except Exception as e:
        import traceback
        print(f"\n[SYSTEM: CRITICAL UNHANDLED EXCEPTION - {e}]")
        print("--- Traceback ---")
        print(traceback.format_exc())
        print("--- End Traceback ---")
    finally:
        print("[SYSTEM: Application exiting process finalization.]")