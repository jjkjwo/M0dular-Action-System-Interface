# loader.py - Dynamic Module Loader (Refactored Version) V 3.10
# AIAUTH006: Added get_action_object function to resolve AttributeError.
# AIAUTH007: Pass is_system_command flag to action modules to prevent inappropriate injection
# This function allows retrieval of a loaded action's module object.
# Actions folder is not used currently
import os
import importlib
import json
import inspect
import asyncio
import time
import threading
import atexit  # For thread cleanup

# Registry of available actions
_action_registry = {}

# Configuration for action loading
ACTION_DIR = "actions"  # Directory where action modules are stored
CONFIG_FILE = "actions.json"  # JSON file with action configurations

# Constants for active actions monitoring
ACTIVE_ACTIONS_FILE = "active_actions.txt"
MONITOR_INTERVAL = 3  # Changed from 5 to 3 to match frontend polling
_monitor_thread = None
_monitoring_active = False  # Flag to control thread execution


def discover_actions():
    """Discover and configure actions, prioritizing actions.json if available."""
    actions = {}

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f: # Added encoding
                actions = json.load(f)
            print(f"[LOADER: Loaded {len(actions)} action configurations from '{CONFIG_FILE}']")
        except Exception as e:
            print(f"[LOADER: Error loading action configurations: {e}]")

    if not os.path.exists(ACTION_DIR):
        os.makedirs(ACTION_DIR, exist_ok=True)
        print(f"[LOADER: Created actions directory '{ACTION_DIR}']")

    for filename in os.listdir(ACTION_DIR):
        if filename.endswith(".py") and not filename.startswith("__"):
            action_name = filename[:-3]
            if action_name not in actions:
                actions[action_name] = {
                    "script_file": filename,
                    "priority": 10,
                    "is_active_by_default": False,
                    "description": f"Dynamically discovered action: {action_name}",
                }
                print(f"[LOADER: Discovered new action '{action_name}']")

    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f: # Added encoding
            json.dump(actions, f, indent=2)
        print(f"[LOADER: Saved updated action configurations to '{CONFIG_FILE}']")
    except Exception as e:
        print(f"[LOADER: Error saving action configurations: {e}]")

    return actions


def register_action_config(action_name, config_data):
    """Register an action configuration, loading existing config if available."""
    config = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f: # Added encoding
                config = json.load(f)
        except Exception as e:
            print(f"[LOADER: Error loading action configurations: {e}]")

    config[action_name] = config_data

    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f: # Added encoding
            json.dump(config, f, indent=2)
        print(f"[LOADER: Registered action configuration for '{action_name}']")
        return True
    except Exception as e:
        print(f"[LOADER: Error saving action configuration for '{action_name}': {e}]")
        return False

def save_action_config_from_registry(): # Added for action_simplified.py
    """Saves the current state of action configurations from the registry to actions.json."""
    configs_to_save = {}
    for name, data in _action_registry.items():
        if "config" in data:
             # Ensure script_file reflects the actual module name if not in config
            cfg = data["config"].copy() # Work with a copy
            if "script_file" not in cfg and hasattr(data.get("module"), "__name__"):
                module_name_parts = data["module"].__name__.split('.')
                cfg["script_file"] = f"{module_name_parts[-1]}.py" if len(module_name_parts) > 0 else f"{name}.py"

            # Persist the is_active_by_default based on current active status only if not explicitly set otherwise
            # This behavior needs to be carefully considered based on desired persistence of active states.
            # For now, just save the config as is, assuming loader.py updates it if 'is_active_by_default' changes.
            configs_to_save[name] = cfg
        
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(configs_to_save, f, indent=2)
        print(f"[LOADER: Saved current action configurations from registry to '{CONFIG_FILE}']")
        return True
    except Exception as e:
        print(f"[LOADER: Error saving action configurations from registry: {e}]")
        return False

async def load_action(action_name):
    """Load an action module and return it"""
    # This function's existing logic looks fine, no changes needed here for get_action_object.
    # Ensuring script_file from config is used.
    action_config_entry = _action_registry.get(action_name, {}).get("config", {})
    if not action_config_entry: # If not in registry yet, try to get from discover_actions result / CONFIG_FILE
        all_configs = {}
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    all_configs = json.load(f)
                action_config_entry = all_configs.get(action_name, {})
            except Exception: pass # Ignore if file is bad, will fallback
    
    script_file = action_config_entry.get("script_file", f"{action_name}.py") # Default if not in config

    try:
        if os.path.exists(os.path.join(ACTION_DIR, script_file)):
            module_path = f"{ACTION_DIR}.{action_name}" # Module name is action_name, not script_file
        elif os.path.exists(script_file): # If script_file is a direct path or in current dir
             module_path = action_name # Assume it's discoverable directly
        else: # Fallback for modules not in ACTION_DIR
            module_path = action_name

        module = importlib.import_module(module_path)
        importlib.reload(module) # Ensure fresh import if code changed

        metadata = {
            "name": action_name,
            "description": getattr(module, "__doc__", f"Action module: {action_name}"),
            "functions": [],
        }
        for name, func in inspect.getmembers(module, inspect.isfunction):
            if not name.startswith("_"):
                metadata["functions"].append({"name": name, "doc": inspect.getdoc(func)})
        return module, metadata
    except Exception as e:
        print(f"[LOADER: Error loading action '{action_name}' (path: {module_path if 'module_path' in locals() else 'unknown'}): {e}]")
        return None, {"error": str(e)}


async def register_action(action_name, module, config, system_functions_for_action=None): # Added system_functions
    """Register an action in the registry"""
    _action_registry[action_name] = {
        "module": module,
        "config": config,
        "is_active": config.get("is_active_by_default", False),
        "metadata": getattr(module, "__metadata__", {}), # Corrected from __medatada__
    }
    if config.get("is_active_by_default", False) and hasattr(module, "start_action"):
        try:
            await _call_action_function(module, "start_action", system_functions_for_action) # Pass system_functions
            print(f"[LOADER: Auto-started action '{action_name}']")
        except Exception as e:
            print(f"[LOADER: Error auto-starting action '{action_name}': {e}]")
    return _action_registry[action_name]


def write_active_actions_to_file():
    """Write active actions to file for external systems"""
    try:
        active_actions = []
        for name, data in _action_registry.items():
            if data["is_active"]:
                action_info = {"name": name, "priority": data["config"].get("priority", 10)}
                active_actions.append(action_info)
        try:
            from importlib import import_module # Keep import local
            api_module = import_module("api_manager") # Check if api_manager itself needs to be dynamic
            if hasattr(api_module, "_api_initialized") and api_module._api_initialized:
                # Ensure 'key' isn't doubly added if already in registry and active
                is_key_in_active = any(a['name'] == 'key' for a in active_actions)
                if not is_key_in_active:
                    active_actions.append({"name": "key", "priority": 0}) # "key" indicates API is active
        except (ImportError, AttributeError): pass # api_manager might not exist or be structured this way
        
        active_actions.sort(key=lambda x: x["priority"])
        with open(ACTIVE_ACTIONS_FILE, "w", encoding="utf-8") as f: # Added encoding
            f.truncate(0)
            action_list = [f"{a['name']}:{a['priority']}" for a in active_actions]
            f.write("\n".join(action_list))
        server_mode = os.environ.get("SERVER_ENVIRONMENT") == "SERVER"
        if server_mode and len(active_actions) > 0: pass
    except Exception as e:
        print(f"[LOADER: ERROR writing active actions to file: {e}]")


def _monitor_thread_function():
    global _monitoring_active
    while _monitoring_active:
        try: write_active_actions_to_file()
        except Exception as e: print(f"[LOADER: ERROR in monitor thread: {e}]")
        # Sleep in smaller chunks for responsiveness
        for _ in range(int(MONITOR_INTERVAL / 0.5)): # Use 0.5 for sleep chunk
            if not _monitoring_active: break
            time.sleep(0.5) 


def stop_monitoring():
    global _monitoring_active, _monitor_thread
    if _monitoring_active:
        _monitoring_active = False
        try:
            with open(ACTIVE_ACTIONS_FILE, "w", encoding="utf-8") as f: # Added encoding
                f.write("") 
        except Exception as e: print(f"[LOADER: Error during final update of {ACTIVE_ACTIONS_FILE}: {e}]")
        if _monitor_thread and _monitor_thread.is_alive():
            _monitor_thread.join(timeout=MONITOR_INTERVAL + 1) # Increased timeout
        print("[LOADER: Active actions monitoring stopped]")


async def _call_action_function(module, function_name, system_functions, **kwargs):
    """Call an action function with appropriate parameters including optional kwargs."""
    func = getattr(module, function_name, None)
    if func:
        sig = inspect.signature(func)
        params = {}
        
        # Add system_functions if the function accepts it
        if 'system_functions' in sig.parameters:
            params['system_functions'] = system_functions
            
        # Add any additional kwargs that the function accepts
        for param_name, param_value in kwargs.items():
            if param_name in sig.parameters:
                params[param_name] = param_value
                
        # Call with the appropriate parameters
        if params:
            await func(**params)
        else:
            await func()


async def start_action(action_name, system_functions=None):
    """Start an action by name"""
    action_config_data = _action_registry.get(action_name, {}).get("config")
    if not action_config_data: # If not in registry, load from actions.json
        all_actions = {}
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    all_actions = json.load(f)
                action_config_data = all_actions.get(action_name)
            except Exception as e:
                print(f"[LOADER: Error reading {CONFIG_FILE} for starting {action_name}: {e}]")
        
        if not action_config_data:
            print(f"[LOADER: ERROR - Action '{action_name}' configuration not found in {CONFIG_FILE} or registry]")
            return False

    module_to_load = action_config_data.get("script_file", f"{action_name}.py")[:-3] # Get module name from script_file
    
    if action_name not in _action_registry or not _action_registry[action_name].get("module"):
        module, metadata = await load_action(module_to_load) # Use module_to_load derived name
        if not module:
            print(f"[LOADER: ERROR - Failed to load module '{module_to_load}' for action '{action_name}']")
            return False
        await register_action(action_name, module, action_config_data, system_functions) # Pass system_functions here too

    if action_name not in _action_registry:
        print(f"[LOADER: ERROR - Action '{action_name}' still not registered after load attempt.]")
        return False

    if not _action_registry[action_name].get("is_active", False):
        _action_registry[action_name]["is_active"] = True
        module = _action_registry[action_name]["module"]
        try:
            await _call_action_function(module, "start_action", system_functions)
        except Exception as e:
            print(f"[LOADER: ERROR running start_action for '{action_name}': {e}]")
            # _action_registry[action_name]["is_active"] = False # Optional: rollback on error
            # return False 
        print(f"[LOADER: Started action '{action_name}']")
        write_active_actions_to_file()
    else:
        print(f"[LOADER: Action '{action_name}' is already active.]")
    return True


async def stop_action(action_name, system_functions=None):
    if action_name not in _action_registry:
        print(f"[LOADER: ERROR - Action '{action_name}' not found in registry]")
        return False
    if _action_registry[action_name].get("is_active", False):
        _action_registry[action_name]["is_active"] = False
        module = _action_registry[action_name]["module"]
        try:
            await _call_action_function(module, "stop_action", system_functions)
        except Exception as e:
             print(f"[LOADER: ERROR running stop_action for '{action_name}': {e}]")
        print(f"[LOADER: Stopped action '{action_name}']")
        write_active_actions_to_file()
    else:
        print(f"[LOADER: Action '{action_name}' is already inactive.]")
    return True


async def process_input(user_input, system_functions=None, is_system_command=False):
    """Process input through active actions with awareness of system commands."""
    active_actions = []
    
    # Note: We do NOT skip actions for system commands anymore
    # Actions need to see commands to process their own command functionality
    # They should internally decide whether to inject AI-focused content
    
    for name, data in _action_registry.items():
        if data.get("is_active", False):
            priority = data.get("config", {}).get("priority", 10)
            active_actions.append((name, priority, data.get("module")))
            
    active_actions.sort(key=lambda x: x[1])
    processed_input = user_input
    
    for action_name, priority, module in active_actions:
        if module and hasattr(module, "process_input"):
            try:
                sig = inspect.signature(module.process_input)
                # Pass is_system_command flag if the action accepts it
                if 'system_functions' in sig.parameters and 'is_system_command' in sig.parameters:
                    action_output = await module.process_input(processed_input, system_functions, is_system_command=is_system_command)
                elif 'system_functions' in sig.parameters:
                    action_output = await module.process_input(processed_input, system_functions)
                elif 'is_system_command' in sig.parameters:
                    action_output = await module.process_input(processed_input, is_system_command=is_system_command)
                else:
                    action_output = await module.process_input(processed_input)
                    
                if action_output is not None:
                    processed_input = action_output
            except Exception as e:
                print(f"[LOADER: Error processing input through action '{action_name}': {e}")
                
    return processed_input


async def process_output(ai_response, system_functions=None):
    active_actions = []
    for name, data in _action_registry.items():
        if data.get("is_active", False): # Added .get for safety
            priority = data.get("config", {}).get("priority", 10)
            active_actions.append((name, priority, data.get("module"))) # Store module
    active_actions.sort(key=lambda x: x[1])
    processed_output = ai_response
    for action_name, priority, module in active_actions: # Unpack module
        if module and hasattr(module, "process_output"):
            try:
                sig = inspect.signature(module.process_output)
                if 'system_functions' in sig.parameters:
                    action_modified_output = await module.process_output(processed_output, system_functions)
                else:
                    action_modified_output = await module.process_output(processed_output)
                if action_modified_output is not None: processed_output = action_modified_output
            except Exception as e:
                print(f"[LOADER: Error processing output through action '{action_name}': {e}")
    return processed_output


def get_action_registry():
    return _action_registry

# --- AIAUTH006: ADDED get_action_object FUNCTION ---
def get_action_object(action_name: str):
    """
    Retrieves the loaded module object for a given action name.

    Args:
        action_name (str): The name of the action whose module object is required.

    Returns:
        ModuleType or None: The loaded module object if the action is registered 
                              and loaded, otherwise None.
    """
    action_data = _action_registry.get(action_name)
    if action_data and "module" in action_data:
        return action_data["module"]
    print(f"[LOADER: WARN - Action '{action_name}' not found in registry or module not loaded.]")
    return None
# --- END AIAUTH006 ---

async def initialize(system_functions_for_loader=None): # Accept system_functions
    global _monitor_thread, _monitoring_active
    actions = discover_actions() # actions.json is now source of truth if exists
    try:
        actions_dir_path = os.path.abspath(ACTION_DIR)
        active_actions_path = os.path.abspath(ACTIVE_ACTIONS_FILE)
        # print(f"[LOADER DBG: ACTION_DIR='{actions_dir_path}', ACTIVE_ACTIONS_FILE='{active_actions_path}']")

        if os.path.dirname(ACTIVE_ACTIONS_FILE) and not os.path.exists(os.path.dirname(ACTIVE_ACTIONS_FILE)):
            os.makedirs(os.path.dirname(ACTIVE_ACTIONS_FILE), exist_ok=True)
        with open(ACTIVE_ACTIONS_FILE, "w", encoding="utf-8") as f: f.write("") # Added encoding
        # print(f"[LOADER: Initialized empty {ACTIVE_ACTIONS_FILE}]") # Reduced verbosity
    except Exception as e: print(f"[LOADER: WARNING - Could not initialize {ACTIVE_ACTIONS_FILE}: {e}]")

    _action_registry.clear()
    for name, config_from_file in actions.items():
        if config_from_file.get("is_active_by_default", False):
            module_to_load = config_from_file.get("script_file", f"{name}.py")[:-3]
            module, metadata = await load_action(module_to_load) # Pass correct module name
            if module:
                 await register_action(name, module, config_from_file, system_functions_for_loader) # Pass system_functions
                 # print(f"[LOADER: Auto-loaded action '{name}']") # Reduced verbosity
            else: print(f"[LOADER: WARNING - Failed to auto-load action '{name}' using module name '{module_to_load}']")
    
    if _monitor_thread and _monitor_thread.is_alive():
        _monitoring_active = False
        try: _monitor_thread.join(timeout=0.1) # Quick join
        except Exception: pass
        _monitor_thread = None
    try:
        _monitoring_active = True
        write_active_actions_to_file()
        _monitor_thread = threading.Thread(target=_monitor_thread_function, daemon=True)
        _monitor_thread.start()
        if not hasattr(atexit, '_registered_exit_functions') or stop_monitoring not in [func[0] for func in atexit._registered_exit_functions]: # Prevent multiple registrations
             atexit.register(stop_monitoring)
        # print(f"[LOADER: Active actions monitoring started.]") # Reduced verbosity
    except Exception as e:
        print(f"[LOADER: WARNING - Could not start actions monitoring: {e}]")
        _monitoring_active = False
    # print(f"[LOADER: Initialization complete. {len(_action_registry)} actions loaded/registered.]") # Reduced verbosity
    return actions