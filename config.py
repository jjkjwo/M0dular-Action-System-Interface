# config.py - Enhanced Configuration Manager V 3.1 (Multiple Addon AIs + Think Mode)
import os
import json
import sys
from typing import Any, Dict, Optional

# Default configuration with comprehensive options, now with multiple addon AIs and think mode
DEFAULT_CONFIG = {
    # API settings
    "API_PROVIDER": "gemini",  # Default API provider (gemini or openai)
    
    # System behavior settings
    "DEFAULT_DELAY_SECONDS": 2.0,  # Delay between interaction cycles
    "LOG_LEVEL": "info",  # Logging level (none, error, warn, info, debug)
    
    # Feature flags
    "ENABLE_VOICE": False,  # Enable TTS voice output
    "ENABLE_WEB_INPUT": True,  # Enable web interface input
    
    # System paths
    "LOCAL_PATH_BASE": "",  # Base path for local files
    
    # Operational mode
    "SERVER_MODE": False,  # Whether running in server mode
    
    # Advanced settings
    "MAX_HISTORY_SIZE": 50000,  # Maximum size of conversation history file
    "CACHE_EXPIRY_SECONDS": 300,  # Expiry time for cache items
    "TTS_VOLUME": 1.0,  # Text-to-speech volume (0.0-1.0)

    # --- Original Addon AI Feature ---
    "ADDON_AI_ENABLED": False,         # bool: Whether to use the addon AI
    "ADDON_AI_PROVIDER": "openai",     # str: 'openai', 'gemini', etc. (must be in api_config.json)
    "ADDON_AI_MODEL_NAME": "gpt-3.5-turbo", # str: Specific model for the addon AI
    "ADDON_AI_MODE": "delayed",        # str: 'delayed' (parallel, uses prior turn's data) or 'live' (sequential, uses current turn's data)
    "ADDON_AI_INJECT_RESPONSE": False, # bool: If true, inject addon's last response into primary AI's next prompt (Only used in 'delayed' mode)
    "ADDON_AI_MAX_HISTORY_TURNS": 0,  # int: How many previous user/model pairs from primary history to send to addon AI. 0 for stateless.
    
    # --- Addon AI 2 ---
    "ADDON_AI2_ENABLED": False,
    "ADDON_AI2_PROVIDER": "gemini",
    "ADDON_AI2_MODEL_NAME": "gemini-1.5-flash",
    "ADDON_AI2_MODE": "delayed",
    "ADDON_AI2_INJECT_RESPONSE": False,
    "ADDON_AI2_MAX_HISTORY_TURNS": 0,
    
    # --- Addon AI 3 ---
    "ADDON_AI3_ENABLED": False,
    "ADDON_AI3_PROVIDER": "anthropic",
    "ADDON_AI3_MODEL_NAME": "claude-3-haiku-20240307",
    "ADDON_AI3_MODE": "delayed",
    "ADDON_AI3_INJECT_RESPONSE": False,
    "ADDON_AI3_MAX_HISTORY_TURNS": 0,
    
    # --- Addon AI 4 ---
    "ADDON_AI4_ENABLED": False,
    "ADDON_AI4_PROVIDER": "perplexity",
    "ADDON_AI4_MODEL_NAME": "llama-3.1-sonar-small-128k-online",
    "ADDON_AI4_MODE": "delayed",
    "ADDON_AI4_INJECT_RESPONSE": False,
    "ADDON_AI4_MAX_HISTORY_TURNS": 0,
    
    # --- Agent Safety Toggle ---
    "AGENT_AUTO_DISABLE_ADDONS_ON_GOAL": True,  # Automatically disable all addon AIs when agent sets a goal
    
    # --- Think Mode Configuration ---
    "THINK_MODE_ENABLED": True,         # bool: Enable think mode feature
    "THINK_MODE_DEFAULT_TURNS": 2,     # int: Default number of thinking turns
    "THINK_MODE_MAX_TURNS": 5,         # int: Maximum allowed thinking turns
    "THINK_MODE_SHOW_PROCESS": False,  # bool: Show intermediate thinking to user
    "THINK_MODE_AUTO_ACTIVATE": False, # bool: Auto-activate for complex queries
    
    # --- Principle Monitoring (unchanged) ---
    # NOTE: The principles system has its own "addon-ai" feature for monitoring
    # This is SEPARATE from the consultant AIs (addon_ai through addon_ai4)
    # The principles addon-ai is used to analyze responses for principle violations
    "PRINCIPLE_MONITORING_ENABLED": True,
    "PRINCIPLE_MONITORING_MODE": "real-time",
    "PRINCIPLE_ADDON_AI_PROVIDER": "openai",
    "PRINCIPLE_ADDON_AI_MODEL": "gpt-3.5-turbo"
}

# Current configuration (initialized to defaults)
_config: Dict[str, Any] = {}

# Configuration file path
CONFIG_FILE = "config.json"

def load_config(file_path: Optional[str] = None) -> Dict[str, Any]:
    """Load configuration from file with enhanced error handling.
    
    Args:
        file_path: Optional custom path to config file
        
    Returns:
        Dict containing the current configuration
    """
    global _config
    
    # Start with defaults
    _config = DEFAULT_CONFIG.copy()
    
    # Use custom path if provided
    actual_path = file_path or CONFIG_FILE
    
    try:
        if os.path.exists(actual_path):
            with open(actual_path, "r", encoding="utf-8") as f:
                try:
                    loaded_config = json.load(f)
                    if not isinstance(loaded_config, dict):
                        print(f"[CONFIG ERROR: Invalid format in {actual_path}, expected JSON object]", file=sys.stderr)
                    else:
                        # Update with known keys, then add any unknown keys from file
                        temp_config = _config.copy() # Start with defaults
                        for key, value in loaded_config.items():
                            if key in DEFAULT_CONFIG: # Key is known from current defaults
                                default_type = type(DEFAULT_CONFIG[key])
                                if isinstance(value, default_type) or \
                                   (default_type is float and isinstance(value, int)) or \
                                   value is None : # Allow int for float, and None for any
                                    temp_config[key] = value
                                else:
                                    print(f"[CONFIG WARNING: Type mismatch for '{key}', expected {default_type.__name__}, got {type(value).__name__}. Using default.")
                            elif key == "MODEL_NAME": # Legacy handling
                                print(f"[CONFIG NOTICE: Ignoring legacy 'MODEL_NAME' setting, use api_config.json instead]")
                                continue
                            else: # Key is not in current defaults (new key from file)
                                print(f"[CONFIG NOTICE: Unknown configuration key '{key}' found in {actual_path}. Adding it.")
                                temp_config[key] = value
                        _config = temp_config # Apply the merged config
                                
                    print(f"[CONFIG: Loaded configuration from {actual_path}]")
                except json.JSONDecodeError as e:
                    print(f"[CONFIG ERROR: Invalid JSON in {actual_path}: {e}]", file=sys.stderr)
        else:
            print(f"[CONFIG: No config file found at {actual_path}, using defaults and creating file.]")
            save_config(actual_path) # Save defaults if file doesn't exist
    except Exception as e:
        print(f"[CONFIG ERROR: Failed to load configuration: {e}]", file=sys.stderr)
    
    return _config

def save_config(file_path: Optional[str] = None) -> bool:
    """Save current configuration to file with error handling.
    
    Args:
        file_path: Optional custom path for saving config
        
    Returns:
        bool: True if save was successful, False otherwise
    """
    actual_path = file_path or CONFIG_FILE
    
    try:
        # Create directory if it doesn't exist
        directory = os.path.dirname(actual_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            
        with open(actual_path, "w", encoding="utf-8") as f:
            json.dump(_config, f, indent=2)
            print(f"[CONFIG: Configuration saved to {actual_path}]")
        return True
    except Exception as e:
        print(f"[CONFIG ERROR: Failed to save configuration: {e}]", file=sys.stderr)
        return False

def get(key: str, default: Any = None) -> Any:
    """Get configuration value with fallback default.
    
    Args:
        key: Configuration key to retrieve
        default: Value to return if key is not found
        
    Returns:
        The configuration value or default
    """
    # Ensure _config is initialized if accessed before explicit load_config() in some tests/modules
    if not _config:
        load_config()
    return _config.get(key, default)

def set(key: str, value: Any) -> None:
    """Set configuration value.
    
    Args:
        key: Configuration key to set
        value: Value to assign
    """
    # Prevent setting MODEL_NAME in config as it's now handled by api_manager
    if key == "MODEL_NAME":
        print("[CONFIG NOTICE: 'MODEL_NAME' should be set in api_config.json, not in main config]")
        return
        
    _config[key] = value
    
def update(new_config: Dict[str, Any]) -> None:
    """Update multiple configuration values at once.
    
    Args:
        new_config: Dictionary of configuration keys and values to update
    """
    if isinstance(new_config, dict):
        # Filter out MODEL_NAME if present
        if "MODEL_NAME" in new_config:
            print("[CONFIG NOTICE: 'MODEL_NAME' should be set in api_config.json, not in main config]")
            filtered_config = {k: v for k, v in new_config.items() if k != "MODEL_NAME"}
            _config.update(filtered_config)
        else:
            _config.update(new_config)
    else:
        print(f"[CONFIG ERROR: update() requires dict, got {type(new_config).__name__}]", file=sys.stderr)
    
def get_all() -> Dict[str, Any]:
    """Get a copy of the entire configuration.
    
    Returns:
        Dict containing all configuration values
    """
    return _config.copy()

def reset() -> None:
    """Reset configuration to default values."""
    global _config
    _config = DEFAULT_CONFIG.copy()
    print("[CONFIG: Reset to default configuration]")

def get_env_value(key: str, default: Any = None) -> Any:
    """Get value from environment variable if exists, else from config.
    
    This is useful for containerized deployments that use environment variables.
    
    Args:
        key: Configuration key (will be converted to uppercase for env lookup)
        default: Default value if neither env nor config has the key
        
    Returns:
        Value from environment, config, or default
    """
    env_key = key.upper()
    if env_key in os.environ:
        # Try to convert environment variable to appropriate type
        env_value = os.environ[env_key]
        if key in DEFAULT_CONFIG:
            default_value_type = type(DEFAULT_CONFIG[key])
            if default_value_type is bool:
                return env_value.lower() in ('true', 'yes', '1', 'y')
            elif default_value_type is int:
                try: return int(env_value)
                except ValueError: return get(key, default)
            elif default_value_type is float:
                try: return float(env_value)
                except ValueError: return get(key, default)
        return env_value # Return as string if type is unknown or not bool/int/float
    return get(key, default)

# Initialize configuration on module import
if not _config: # Ensure it's loaded once
    load_config()