# api_manager.py - v4.2 - Multi-Model, Multi-Provider Support (with Ollama/Local LLaMA)
# 
# CHANGES FROM YOUR VERSION:
# - Added Ollama support for local LLaMA models
# - Ollama can run locally or on a server
# - Auto-discovery of available Ollama models
#
# REQUIRED NEW DEPENDENCIES:
# - None! Ollama uses httpx which is already installed
#
# NO NEW KEY FILES NEEDED - Ollama doesn't require API keys

import os
import json
import asyncio
import sys
import importlib.util
import re
import httpx  # REQUIRED for OpenAI v1.0+ connection management - DO NOT REMOVE!

# ------------------------------ CONFIGURATION ------------------------------
DEFAULT_CONFIG = {
    "active_provider": "openai",
    "total_api_call_limit": 100,
    "providers": {
        "gemini": {
            "model_name": "gemini-2.0-flash-thinking-exp-01-21",
            "api_key_file": "key.py",
            "api_key_var": "GEMINI_API_KEY"
        },
        "openai": {
            "model_name": "gpt-3.5-turbo",
            "api_key_file": "openai_key.py", 
            "api_key_var": "OPENAI_API_KEY"
        },
        "anthropic": {
            "model_name": "claude-3-sonnet-20240229",
            "api_key_file": "anthropic_key.py",
            "api_key_var": "ANTHROPIC_API_KEY"
        },
        "perplexity": {
            "model_name": "llama-3.1-sonar-large-128k-online",
            "api_key_file": "perplexity_key.py",
            "api_key_var": "PERPLEXITY_API_KEY"
        },
        "deepseek": {
            "model_name": "deepseek-chat",
            "api_key_file": "deepseek_key.py",
            "api_key_var": "DEEPSEEK_API_KEY"
        },
        "ollama": {
            "model_name": "llama3",
            "base_url": "http://localhost:11434",
            "api_key_file": None,  # Ollama doesn't need API keys
            "api_key_var": None
        },
        "ollama_server": {
            "model_name": "llama3",
            "base_url": "PLACEHOLDER",
            "api_key_file": None,  # Ollama doesn't need API keys
            "api_key_var": None
        }
    }
}

# --- GLOBAL API CALL LIMITER STATE ---
_api_call_counter = 0
_api_call_limit = DEFAULT_CONFIG["total_api_call_limit"]
_counter_lock = asyncio.Lock()

# --- CURRENT STATE ---
_current_config = {}
_api_initialized = False
_active_provider = None
_conversation_history = []
_openai_client = None
_anthropic_client = None
_available_models_cache = {}  # Cache for discovered models
API_STATUS_FILE = "current_api_status.json"

# ------------------------------ INITIALIZATION ------------------------------
def load_config():
    """Load API configuration from file, including the global call limit."""
    global _current_config, DEFAULT_CONFIG, _api_call_limit

    _current_config = json.loads(json.dumps(DEFAULT_CONFIG))

    try:
        if os.path.exists("api_config.json"):
            with open("api_config.json", "r", encoding="utf-8") as f:
                loaded_config = json.load(f)
                _api_call_limit = loaded_config.get("total_api_call_limit", _current_config.get("total_api_call_limit"))
                print(f"[API MANAGER: Global API call limit set to {_api_call_limit}]")
                _current_config["active_provider"] = loaded_config.get("active_provider", _current_config.get("active_provider"))
                if "providers" in loaded_config and isinstance(loaded_config["providers"], dict):
                    for provider_key, provider_data in loaded_config["providers"].items():
                        if provider_key not in _current_config["providers"]:
                            _current_config["providers"][provider_key] = {}
                        if isinstance(provider_data, dict):
                             _current_config["providers"][provider_key].update(provider_data)
                        else:
                            print(f"[API MANAGER: Warning - provider data for '{provider_key}' is not a dict. Skipping.]")
            print("[API MANAGER: Configuration loaded from api_config.json]")
        else:
            print("[API MANAGER: api_config.json not found. Using defaults and creating the file.]")
            _api_call_limit = _current_config.get("total_api_call_limit")
            save_config()
    except Exception as e:
        print(f"[API MANAGER: Error loading api_config.json: {e}. Falling back to defaults.")
        _current_config = json.loads(json.dumps(DEFAULT_CONFIG))
        _api_call_limit = _current_config.get("total_api_call_limit")

def save_config():
    """Save current API configuration to file"""
    try:
        with open("api_config.json", "w", encoding="utf-8") as f:
            json.dump(_current_config, f, indent=2)
        print("[API MANAGER: Configuration saved to api_config.json]")
    except Exception as e:
        print(f"[API MANAGER: Error saving configuration: {e}]")

# ------------------------------ HELPER FUNCTIONS ------------------------------
def load_key_from_file(api_key_file, api_key_var):
    """
    Loads an API key from a Python file.
    Tries importlib, then __import__, then direct file reading.
    """
    # Return None for providers that don't need keys (like Ollama)
    if api_key_file is None or api_key_var is None:
        return None
        
    current_dir = os.path.abspath(os.path.dirname(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

    module_name = os.path.splitext(os.path.basename(api_key_file))[0]
    module_path = os.path.abspath(api_key_file)

    try:
        if not os.path.exists(module_path):
            if not module_path.endswith('.py') and not os.path.isabs(api_key_file):
                temp_path = f"{module_path}.py"
                if os.path.exists(temp_path):
                    module_path = temp_path
                else:
                    raise FileNotFoundError(f"Key file {api_key_file} or {temp_path} not found.")
            elif not os.path.exists(module_path):
                 raise FileNotFoundError(f"Key file {module_path} not found.")
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if spec and spec.loader:
            key_module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = key_module
            spec.loader.exec_module(key_module)
            api_key = getattr(key_module, api_key_var)
            if api_key:
                print(f"[API MANAGER: Loaded key '{api_key_var}' from {api_key_file} via importlib.util]")
                return api_key
    except Exception: pass

    try:
        key_file_dir = os.path.dirname(module_path)
        if key_file_dir not in sys.path and key_file_dir != current_dir :
            sys.path.insert(0, key_file_dir)
        key_module = __import__(module_name)
        if module_name in sys.modules:
            key_module = importlib.reload(sys.modules[module_name])
        api_key = getattr(key_module, api_key_var)
        if api_key:
            print(f"[API MANAGER: Loaded key '{api_key_var}' from {api_key_file} via __import__]")
            return api_key
    except Exception: pass
    finally:
        if 'key_file_dir' in locals() and key_file_dir not in sys.path and key_file_dir != current_dir:
            if sys.path[0] == key_file_dir:
                sys.path.pop(0)
    try:
        if not os.path.exists(module_path):
            raise FileNotFoundError(f"Key file {module_path} not found for read.")
        with open(module_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(rf"^\s*{re.escape(api_key_var)}\s*=\s*['\"](.*?)['\"]", content, re.MULTILINE)
        if match and match.group(1):
            print(f"[API MANAGER: Loaded key '{api_key_var}' via direct file read]")
            return match.group(1)
    except Exception: pass

    raise ValueError(f"Failed to load API key '{api_key_var}' from '{api_key_file}' using all methods.")


def _write_api_status_file(provider_name, model_name, initialized):
    status_data = {
        "active_provider": provider_name,
        "model_name": model_name,
        "initialized": initialized
    }
    try:
        with open(API_STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(status_data, f, indent=2)
    except Exception as e:
        print(f"[API MANAGER: ERROR writing API status to {API_STATUS_FILE}: {e}]", file=sys.stderr)


# ------------------------------ MODEL DISCOVERY ------------------------------
async def discover_available_models(provider_name=None):
    """Discover available models from providers that support it"""
    global _available_models_cache
    
    if provider_name:
        providers_to_check = [provider_name] if provider_name in _current_config.get("providers", {}) else []
    else:
        providers_to_check = list(_current_config.get("providers", {}).keys())
    
    for provider in providers_to_check:
        if provider == "openai" and _openai_client:
            try:
                models_response = await _openai_client.models.list()
                models = [m.id for m in models_response.data if 'gpt' in m.id or 'o1' in m.id or 'dall' in m.id]
                _available_models_cache[provider] = sorted(models)
                print(f"[API MANAGER: Discovered {len(models)} OpenAI models]")
            except Exception as e:
                print(f"[API MANAGER: Error discovering OpenAI models: {e}]")
                # Fallback to known models
                _available_models_cache[provider] = ["gpt-4", "gpt-4-turbo-preview", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"]
                
        elif provider == "gemini":
            try:
                import google.generativeai as genai
                # Note: list_models() might need API key to be configured first
                api_key = load_key_from_file(
                    _current_config["providers"][provider]["api_key_file"],
                    _current_config["providers"][provider]["api_key_var"]
                )
                genai.configure(api_key=api_key)
                models = []
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        # Extract model ID from name like "models/gemini-pro"
                        model_id = m.name.split('/')[-1] if '/' in m.name else m.name
                        models.append(model_id)
                _available_models_cache[provider] = sorted(models)
                print(f"[API MANAGER: Discovered {len(models)} Gemini models]")
            except Exception as e:
                print(f"[API MANAGER: Error discovering Gemini models: {e}]")
                # Fallback to known models
                _available_models_cache[provider] = ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest"]
                
        elif provider == "anthropic":
            # Claude doesn't have a model discovery API, use known models
            _available_models_cache[provider] = [
                "claude-3-opus-20240229", 
                "claude-3-sonnet-20240229", 
                "claude-3-haiku-20240307",
                "claude-2.1",
                "claude-instant-1.2"
            ]
            
        elif provider == "perplexity":
            # Perplexity doesn't have a model discovery API, use known models
            _available_models_cache[provider] = [
                "llama-3.1-sonar-small-128k-online",
                "llama-3.1-sonar-large-128k-online",
                "llama-3.1-sonar-huge-128k-online",
                "llama-3.1-sonar-small-128k-chat",
                "llama-3.1-sonar-large-128k-chat"
            ]
            
        elif provider == "deepseek":
            # DeepSeek doesn't have a model discovery API, use known models
            _available_models_cache[provider] = [
                "deepseek-chat",
                "deepseek-coder"
            ]
            
        elif provider == "ollama" or provider == "ollama_server":
            # Ollama has a model discovery API!
            try:
                base_url = _current_config["providers"][provider].get("base_url", "http://localhost:11434")
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{base_url}/api/tags")
                    if response.status_code == 200:
                        data = response.json()
                        models = [model["name"] for model in data.get("models", [])]
                        _available_models_cache[provider] = sorted(models)
                        print(f"[API MANAGER: Discovered {len(models)} Ollama models: {models}]")
                    else:
                        print(f"[API MANAGER: Error discovering Ollama models: HTTP {response.status_code}]")
                        _available_models_cache[provider] = ["llama3", "llama2", "mistral", "codellama"]
            except Exception as e:
                print(f"[API MANAGER: Error discovering Ollama models: {e}]")
                # Fallback to common models
                _available_models_cache[provider] = ["llama3", "llama2", "mistral", "codellama"]
    
    return _available_models_cache


# ------------------------------ API MANAGEMENT ------------------------------
async def initialize_api(provider_name=None):
    """Initialize the selected API provider for the main session."""
    global _api_initialized, _active_provider, _openai_client, _anthropic_client, _current_config
    if not _current_config: load_config()
    target_provider = provider_name if provider_name else _current_config.get("active_provider", "openai")
    if target_provider not in _current_config.get("providers", {}):
        print(f"[API MANAGER: ERROR - Provider '{target_provider}' not found in configuration]")
        _write_api_status_file(None, None, False)
        return False
    provider_config = _current_config["providers"][target_provider]
    success = False
    if target_provider == "gemini":
        success = await _initialize_gemini(provider_config)
    elif target_provider == "openai":
        success = await _initialize_openai(provider_config)
    elif target_provider == "anthropic":
        success = await _initialize_anthropic(provider_config)
    elif target_provider == "perplexity":
        # Perplexity uses OpenAI-compatible client, just verify key exists
        try:
            api_key = load_key_from_file(provider_config["api_key_file"], provider_config["api_key_var"])
            success = bool(api_key)
        except Exception as e:
            print(f"[API MANAGER: ERROR initializing Perplexity: {e}]")
            success = False
    elif target_provider == "deepseek":
        success = await _initialize_deepseek(provider_config)
    elif target_provider == "ollama":
        success = await _initialize_ollama(provider_config)
    elif target_provider == "ollama_server":
        success = await _initialize_ollama(provider_config)
    else:
        print(f"[API MANAGER: ERROR - Main session initialization for provider '{target_provider}' is not supported]")
        _write_api_status_file(None, None, False)
        return False
    if success:
        _api_initialized = True
        _active_provider = target_provider
        _current_config["active_provider"] = target_provider
        save_config()
        _write_api_status_file(_active_provider, provider_config.get("model_name", "unknown"), True)
        print(f"[API MANAGER: Successfully initialized main API session for '{target_provider}']")
        # Try to discover models for this provider
        await discover_available_models(target_provider)
    else:
        _api_initialized = False
        print(f"[API MANAGER: Failed to initialize main API session for '{target_provider}']")
        _write_api_status_file(get_active_provider(), get_active_model_name(), False)
    return success

async def switch_provider(new_provider_name: str, model_name: str = None, clear_history_on_switch: bool = True) -> str:
    """
    Attempts to switch the active AI provider for the main session.
    Can optionally specify a model at the same time.
    Returns a success message or an error message.
    """
    global _api_initialized, _active_provider, _openai_client, _anthropic_client, _current_config
    if not _current_config: load_config()
    if new_provider_name not in _current_config.get("providers", {}):
        msg = f"[API MANAGER: ERROR - Provider '{new_provider_name}' is not configured.]"; print(msg); return msg
    
    # If model specified, update it in config
    if model_name:
        _current_config["providers"][new_provider_name]["model_name"] = model_name
        save_config()
        
    if new_provider_name == _active_provider and _api_initialized and not model_name:
        msg = f"[API MANAGER: Provider '{new_provider_name}' is already active and initialized.]"; print(msg)
        _write_api_status_file(_active_provider, get_active_model_name(), True); return msg
    print(f"[API MANAGER: Attempting to switch main API session to: '{new_provider_name}']")
    old_openai_client = _openai_client if _active_provider == "openai" else None
    old_anthropic_client = _anthropic_client if _active_provider == "anthropic" else None
    old_active_provider = _active_provider
    old_api_initialized = _api_initialized
    _openai_client = None; _anthropic_client = None; _api_initialized = False
    success = await initialize_api(new_provider_name)
    if success:
        if clear_history_on_switch: clear_history(); msg = f"[API MANAGER: Successfully switched to '{new_provider_name}'{' with model ' + model_name if model_name else ''}. Conversation history cleared.]"
        else: msg = f"[API MANAGER: Successfully switched to '{new_provider_name}'{' with model ' + model_name if model_name else ''}. History preserved (caution!).]"
        print(msg); return msg
    else:
        _openai_client = old_openai_client; _anthropic_client = old_anthropic_client; _active_provider = old_active_provider; _api_initialized = old_api_initialized
        if old_active_provider and old_api_initialized:
            print(f"[API MANAGER: Switch to '{new_provider_name}' failed. Attempting to restore '{old_active_provider}'.]")
            await initialize_api(old_active_provider)
        msg = f"[API MANAGER: FAILED to switch to '{new_provider_name}'. API initialization failed. State may be reverted if possible.]"; print(msg)
        _write_api_status_file(get_active_provider(), get_active_model_name(), _api_initialized); return msg

async def _initialize_gemini(config_params):
    """Initialize Google's Gemini API for the main session"""
    try:
        api_key = load_key_from_file(config_params["api_key_file"], config_params["api_key_var"])
        if not api_key: raise ValueError("Empty API key")
        import google.generativeai as genai; genai.configure(api_key=api_key)
        print(f"[API MANAGER: Gemini API configured]"); return True
    except Exception as e: print(f"[API MANAGER: ERROR initializing Gemini API: {e}]"); return False

async def _initialize_openai(config_params):
    """Initialize OpenAI API for the main session with proper v1.0+ configuration"""
    global _openai_client
    try:
        api_key = load_key_from_file(config_params["api_key_file"], config_params["api_key_var"])
        if not api_key: raise ValueError("Empty API key")
        
        import openai
        
        # CRITICAL: Create httpx client with proper timeout configuration
        # This is REQUIRED for OpenAI v1.0+ to prevent connection errors
        # DO NOT REMOVE THIS - it's not optional!
        http_client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=10.0),  # 30s total, 10s connect
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        
        # Initialize OpenAI client with REQUIRED timeout and retry configuration
        # These settings prevent the "Connection error" issues
        _openai_client = openai.OpenAI(
            api_key=api_key,
            max_retries=3,      # Retry failed requests up to 3 times
            timeout=30.0,       # Overall timeout for requests
            http_client=http_client  # Custom httpx client with connection pooling
        )
        
        print(f"[API MANAGER: OpenAI client initialized with timeout and retry configuration]")
        return True
    except Exception as e:
        print(f"[API MANAGER: ERROR initializing OpenAI API: {e}]")
        _openai_client = None
        return False

async def _initialize_anthropic(config_params):
    """Initialize Anthropic's Claude API for the main session"""
    global _anthropic_client
    try:
        api_key = load_key_from_file(config_params["api_key_file"], config_params["api_key_var"])
        if not api_key: raise ValueError("Empty API key")
        
        import anthropic
        _anthropic_client = anthropic.AsyncAnthropic(api_key=api_key)
        print(f"[API MANAGER: Anthropic/Claude API configured]")
        return True
    except Exception as e:
        print(f"[API MANAGER: ERROR initializing Anthropic API: {e}]")
        _anthropic_client = None
        return False

async def _initialize_deepseek(config_params):
    """Initialize DeepSeek API"""
    try:
        api_key = load_key_from_file(config_params["api_key_file"], config_params["api_key_var"])
        if not api_key: raise ValueError("Empty API key")
        # DeepSeek uses a REST API, so we'll handle it in the send function
        print(f"[API MANAGER: DeepSeek API configured]")
        return True
    except Exception as e:
        print(f"[API MANAGER: ERROR initializing DeepSeek API: {e}]")
        return False

async def _initialize_ollama(config_params):
    """Initialize Ollama API (no API key needed)"""
    try:
        # Test connection to Ollama
        base_url = config_params.get("base_url", "http://localhost:11434")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                print(f"[API MANAGER: Ollama API configured at {base_url}]")
                return True
            else:
                print(f"[API MANAGER: Ollama server returned status {response.status_code}]")
                return False
    except Exception as e:
        print(f"[API MANAGER: ERROR initializing Ollama API: {e}]")
        print("[API MANAGER: Make sure Ollama is running (ollama serve)]")
        return False

# ------------------------------ CONVERSATION HISTORY (Main Session) ------------------------------
def clear_history():
    global _conversation_history; _conversation_history = []
    print("[API MANAGER: Main session conversation history cleared]")

def get_history():
    return _conversation_history.copy()

# ------------------------------ SENDING MESSAGES (Main Session & Specific) ------------------------------
async def send_message(prompt):
    """Send a message to the active AI provider (main session) and get response"""
    global _conversation_history, _active_provider, _api_initialized
    if not _api_initialized or not _active_provider: msg = "[API MANAGER: ERROR - Main API session not initialized. Call initialize_api() first]"; print(msg); return msg
    provider_config = _current_config["providers"].get(_active_provider)
    if not provider_config: return f"[ERROR: Configuration for active provider '{_active_provider}' not found]"
    model_name = provider_config["model_name"]
    response = f"[ERROR: Sending to provider '{_active_provider}' not fully implemented or failed]"
    if _active_provider == "gemini": response = await _send_to_gemini_internal(prompt, model_name, _conversation_history)
    elif _active_provider == "openai": response = await _send_to_openai_internal(prompt, model_name, _conversation_history, _openai_client)
    elif _active_provider == "anthropic": response = await _send_to_anthropic_internal(prompt, model_name, _conversation_history, _anthropic_client)
    elif _active_provider == "perplexity": 
        api_key = load_key_from_file(provider_config["api_key_file"], provider_config["api_key_var"])
        response = await _send_to_perplexity_internal(prompt, model_name, _conversation_history, api_key)
    elif _active_provider == "deepseek":
        api_key = load_key_from_file(provider_config["api_key_file"], provider_config["api_key_var"])
        response = await _send_to_deepseek_internal(prompt, model_name, _conversation_history, api_key)
    elif _active_provider == "ollama":
        base_url = provider_config.get("base_url", "http://localhost:11434")
        response = await _send_to_ollama_internal(prompt, model_name, _conversation_history, base_url)
    elif _active_provider == "ollama_server":
        base_url = provider_config.get("base_url", "http://localhost:11434")
        response = await _send_to_ollama_internal(prompt, model_name, _conversation_history, base_url)
    if not response.startswith("[ERROR:"):
        _conversation_history.append({"role": "user", "parts": [{"text": prompt}]})
        _conversation_history.append({"role": "model", "parts": [{"text": response}]})
    return response

async def send_message_to_specific_provider(prompt: str, provider_name: str, model_name: str, conversation_history_override: list = None):
    """
    Sends a message to a specifically named provider and model.
    This is a stateless call by default, or uses provided history.
    It does NOT use or update the main session's history or active client.
    """
    if not _current_config: load_config()
    if provider_name not in _current_config.get("providers", {}):
        err_msg = f"[ERROR: Provider '{provider_name}' not found in api_config.json for specific call]"; print(err_msg); return err_msg
    target_provider_config = _current_config["providers"][provider_name]
    history_for_call = conversation_history_override if conversation_history_override is not None else []
    response = f"[ERROR: Specific provider call to '{provider_name}' failed internally]"
    try:
        if provider_name == "ollama":
            base_url = target_provider_config.get("base_url", "http://localhost:11434")
            response = await _send_to_ollama_internal(prompt, model_name, history_for_call, base_url)
        elif provider_name == "ollama_server":
            base_url = target_provider_config.get("base_url", "http://localhost:11434")
            response = await _send_to_ollama_internal(prompt, model_name, history_for_call, base_url)
        else:
            api_key = load_key_from_file(target_provider_config["api_key_file"], target_provider_config["api_key_var"])
            if not api_key and provider_name != "ollama":
                raise ValueError(f"Failed to load API key for specific call to {provider_name}")
                
            if provider_name == "gemini":
                import google.generativeai as genai_specific; genai_specific.configure(api_key=api_key)
                response = await _send_to_gemini_internal(prompt, model_name, history_for_call, genai_specific)
            elif provider_name == "openai":
                import openai as openai_specific
                import httpx
                
                # NOTE: This creates a TEMPORARY client for each addon AI call
                # This is why addon AI worked even when main session had connection errors
                # Fresh clients avoid connection state issues but are less efficient
                
                # Create httpx client for specific call (same config as main)
                http_client = httpx.Client(
                    timeout=httpx.Timeout(30.0, connect=10.0),
                    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                )
                
                temp_openai_client = openai_specific.OpenAI(
                    api_key=api_key,
                    max_retries=3,
                    timeout=30.0,
                    http_client=http_client
                )
                response = await _send_to_openai_internal(prompt, model_name, history_for_call, temp_openai_client)
            elif provider_name == "anthropic":
                import anthropic as anthropic_specific
                temp_anthropic_client = anthropic_specific.AsyncAnthropic(api_key=api_key)
                response = await _send_to_anthropic_internal(prompt, model_name, history_for_call, temp_anthropic_client)
            elif provider_name == "perplexity":
                response = await _send_to_perplexity_internal(prompt, model_name, history_for_call, api_key)
            elif provider_name == "deepseek":
                response = await _send_to_deepseek_internal(prompt, model_name, history_for_call, api_key)
            else:
                response = f"[ERROR: Specific call for provider '{provider_name}' not implemented yet]"
    except Exception as e:
        print(f"[API MANAGER (Specific)]: ERROR during call to {provider_name} ({model_name}): {e}")
        response = f"[ERROR: Specific call to {provider_name} failed: {e}]"
    return response

# ------------------------------ INTERNAL SENDERS (WITH LIMITER) ------------------------------
async def _send_to_gemini_internal(prompt, model_name, history, gemini_lib_instance=None):
    """(CORRECTED) Internal helper to send prompt to Gemini API with call limiting."""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg); return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")

    try:
        genai_to_use = gemini_lib_instance
        if genai_to_use is None:
            import google.generativeai as genai
            genai_to_use = genai
        client = genai_to_use.GenerativeModel(model_name=model_name)
        contents = [{"role": ("user" if msg["role"] == "user" else "model"), "parts": msg["parts"]} for msg in history]
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        api_response_obj = await client.generate_content_async(contents=contents)
        await api_response_obj.resolve(); return api_response_obj.text
    except Exception as e: print(f"[API MANAGER: ERROR in Gemini call ({model_name}): {e}]"); return f"[ERROR: Gemini API call failed: {e}]"

async def _send_to_openai_internal(prompt, model_name, history, openai_client_instance):
    """Fixed internal helper to send prompt to OpenAI API with proper error handling"""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg)
            return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")
    
    if not openai_client_instance:
        return "[ERROR: OpenAI client not initialized]"
    
    try:
        # Convert history format from internal to OpenAI format
        messages = []
        for m in history:
            role = "user" if m["role"] == "user" else "assistant"
            content = m["parts"][0]["text"] if m.get("parts") else ""
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})
        
        print(f"[API MANAGER: Making OpenAI API call to model '{model_name}'...]")
        
        # IMPORTANT: Try synchronous call first (preferred by OpenAI v1.0+)
        # This avoids potential asyncio.to_thread issues
        try:
            response = openai_client_instance.chat.completions.create(
                model=model_name,
                messages=messages
            )
            return response.choices[0].message.content
        except Exception as sync_error:
            # If sync fails, try with asyncio.to_thread as fallback
            # Some environments may require this approach
            print(f"[API MANAGER: Sync call failed ({sync_error}), trying async fallback...]")
            response = await asyncio.to_thread(
                openai_client_instance.chat.completions.create,
                model=model_name,
                messages=messages
            )
            return response.choices[0].message.content
            
    except Exception as e:
        error_msg = str(e)
        print(f"[API MANAGER: ERROR in OpenAI call ({model_name}): {error_msg}]")
        
        # Provide more specific error messages to help with debugging
        if "Connection" in error_msg:
            return f"[ERROR: OpenAI API call failed: Connection error - Check network/firewall settings]"
        elif "timeout" in error_msg.lower():
            return f"[ERROR: OpenAI API call failed: Request timeout - Try again]"
        elif "api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            return f"[ERROR: OpenAI API call failed: Authentication error - Check API key]"
        else:
            return f"[ERROR: OpenAI API call failed: {error_msg}]"

async def _send_to_anthropic_internal(prompt, model_name, history, anthropic_client_instance):
    """Internal helper to send prompt to Anthropic Claude API with call limiting."""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg)
            return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")
    
    if not anthropic_client_instance:
        return "[ERROR: Anthropic client not initialized]"
    
    try:
        # Convert history format from internal to Anthropic format
        messages = []
        for m in history:
            role = "user" if m["role"] == "user" else "assistant"
            content = m["parts"][0]["text"] if m.get("parts") else ""
            messages.append({"role": role, "content": content})
        
        print(f"[API MANAGER: Making Anthropic API call to model '{model_name}'...]")
        
        response = await anthropic_client_instance.messages.create(
            model=model_name,
            messages=messages + [{"role": "user", "content": prompt}],
            max_tokens=1024
        )
        
        # Claude returns content as a list of blocks
        return response.content[0].text
            
    except Exception as e:
        error_msg = str(e)
        print(f"[API MANAGER: ERROR in Anthropic call ({model_name}): {error_msg}]")
        return f"[ERROR: Anthropic API call failed: {error_msg}]"

async def _send_to_perplexity_internal(prompt, model_name, history, api_key):
    """Internal helper to send prompt to Perplexity API using OpenAI-compatible format."""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg)
            return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")
    
    try:
        import openai
        import httpx
        
        # Create httpx client for Perplexity
        http_client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        
        # Perplexity uses OpenAI-compatible API
        perplexity_client = openai.OpenAI(
            api_key=api_key,
            base_url="https://api.perplexity.ai",
            http_client=http_client
        )
        
        # Convert history format
        messages = []
        for m in history:
            role = "user" if m["role"] == "user" else "assistant"
            content = m["parts"][0]["text"] if m.get("parts") else ""
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})
        
        print(f"[API MANAGER: Making Perplexity API call to model '{model_name}'...]")
        
        response = perplexity_client.chat.completions.create(
            model=model_name,
            messages=messages
        )
        
        return response.choices[0].message.content
            
    except Exception as e:
        error_msg = str(e)
        print(f"[API MANAGER: ERROR in Perplexity call ({model_name}): {error_msg}]")
        return f"[ERROR: Perplexity API call failed: {error_msg}]"

async def _send_to_deepseek_internal(prompt, model_name, history, api_key):
    """Internal helper to send prompt to DeepSeek API"""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg)
            return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")
    
    try:
        import httpx
        
        # Convert history format
        messages = []
        for m in history:
            role = "user" if m["role"] == "user" else "assistant"
            content = m["parts"][0]["text"] if m.get("parts") else ""
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})
        
        # Make API call to DeepSeek
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                return f"[ERROR: DeepSeek API returned status {response.status_code}: {response.text}]"
                
    except Exception as e:
        error_msg = str(e)
        print(f"[API MANAGER: ERROR in DeepSeek call ({model_name}): {error_msg}]")
        return f"[ERROR: DeepSeek API call failed: {error_msg}]"

async def _send_to_ollama_internal(prompt, model_name, history, base_url):
    """Internal helper to send prompt to Ollama API"""
    global _api_call_counter, _api_call_limit
    async with _counter_lock:
        if _api_call_counter >= _api_call_limit:
            err_msg = f"[API MANAGER: GLOBAL API CALL LIMIT REACHED ({_api_call_limit})]"
            print(err_msg)
            return err_msg
        _api_call_counter += 1
        print(f"[API MANAGER: API Call #{_api_call_counter}/{_api_call_limit}]")
    
    try:
        # Convert history format to Ollama format
        messages = []
        for m in history:
            role = "user" if m["role"] == "user" else "assistant"
            content = m["parts"][0]["text"] if m.get("parts") else ""
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})
        
        print(f"[API MANAGER: Making Ollama API call to model '{model_name}' at {base_url}...]")
        
        # Make API call to Ollama
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "stream": False
                },
                timeout=60.0  # Ollama can be slower for large models
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["message"]["content"]
            else:
                return f"[ERROR: Ollama API returned status {response.status_code}: {response.text}]"
                
    except Exception as e:
        error_msg = str(e)
        print(f"[API MANAGER: ERROR in Ollama call ({model_name}): {error_msg}]")
        
        # Provide helpful error messages
        if "connect" in error_msg.lower():
            return f"[ERROR: Cannot connect to Ollama at {base_url}. Make sure Ollama is running (ollama serve)]"
        else:
            return f"[ERROR: Ollama API call failed: {error_msg}]"

# ------------------------------ CONFIGURATION & CONTROL HELPERS ------------------------------
def get_active_provider(): return _active_provider
def get_active_model_name(): return _current_config["providers"][_active_provider].get("model_name") if _active_provider and _active_provider in _current_config.get("providers", {}) else None
def set_model(provider, model):
    if not _current_config: load_config()
    if provider in _current_config.get("providers",{}):
        _current_config["providers"][provider]["model_name"]=model
        save_config()
        print(f"[API MANAGER: Set {provider} model to '{model}'.")
        if provider==_active_provider and _api_initialized: _write_api_status_file(_active_provider,model,True)
        return True
    print(f"[API MANAGER: ERROR - Provider '{provider}' not found."); return False
def add_provider(provider, config_data):
    if not _current_config: load_config()
    if"providers"not in _current_config: _current_config["providers"]={}
    _current_config["providers"][provider]=config_data
    save_config()
    print(f"[API MANAGER: Added/Updated provider '{provider}'."); return True

def get_available_models(provider=None):
    """Get available models for a provider (or current provider if None)"""
    global _available_models_cache
    if provider is None:
        provider = _active_provider
    if provider and provider in _available_models_cache:
        return _available_models_cache[provider]
    return []

# --- USER-FACING CONTROL FUNCTIONS ---
def get_api_call_status():
    """
    Returns the current status of the API call counter and its limit.
    This function is intended to be called by other modules (e.g., looper.py)
    to provide user-facing feedback. It is async-safe.
    """
    return {"count": _api_call_counter, "limit": _api_call_limit}

def reset_api_call_counter():
    """
    Resets the global API call counter back to zero.
    This is the control function to be triggered by a user command.
    """
    global _api_call_counter
    _api_call_counter = 0
    print(f"[API MANAGER: Global API call counter has been RESET to 0.]")
    return True
# --- END CONTROL FUNCTIONS ---

# --- Module-level initialization ---
if not _current_config: load_config()
if _api_initialized and _active_provider: _write_api_status_file(_active_provider, get_active_model_name(), True)
else:
    provider = _current_config.get("active_provider")
    model_name = _current_config.get("providers",{}).get(provider,{}).get("model_name") if provider else None
    _write_api_status_file(provider, model_name, False)