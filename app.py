#  =================
# app.py - AI Assistant Web Server (With Authentication System)
#  =================
# Serves the web interface and provides API endpoints for interacting with
# the backend AI action system (action_simplified.py).
# Version 7.3 with authentication support and user-specific conversation history
# Admin (Progenitor - James O'kelly)
#  =================

# =======================
# IMPORTS
# =======================
# --- Flask & Web Framework ---
from flask import Flask, request, redirect, url_for, send_from_directory, send_file, jsonify
from flask_cors import CORS

# --- Standard Library ---
import os
import sys
import time
import json
import re
import threading
import hashlib
import subprocess
import atexit
from datetime import datetime, timedelta
from functools import wraps
from threading import Lock

# --- Project Imports ---
import command_system
import auth

# =======================
# INITIALIZATION
# =======================
os.environ["FLASK_SKIP_DOTENV"] = "1"
auth._load_config()

app = Flask(__name__)
CORS(app)
app.secret_key = os.urandom(24)

# =======================
# CONSTANTS
# =======================
# File paths
CONVERSATION_HISTORY_FILE = "conversation_history.json"
WEBSITE_OUTPUT_FILE = "website_output.txt"
WEBSITE_INPUT_FILE = "website_input.txt"
KEY_HISTORY_FILE = "key_history.json"
ACTIVE_ACTIONS_FILE = "active_actions.txt"
ACTIONS_CONFIG_FILE = "actions.json"
API_CONFIG_FILE = "api_config.json"
MAIN_CONFIG_FILE = "config.json"
CONTROL_OUTPUT_FILE = "control_output.json"
FOCUS_STATS_FILE = "focus_stats.json"
FOCUS_CONFIG_FILE = "focus_config.json"
FOCUS_LOG_FILE = "focus_log.txt"
MEMORY_DATA_FILE = "memory_data.json"
EMOTIONS_FILE = "emotions.txt"
SAVE_FILE = "save.txt"
SAVED_SESSIONS_DIR = "saved_sessions"
ACTION_OUTPUT_LOG = "action_output.log"
LORE_DATA_FILE = "lore_data.json"
WAITLIST_FILE = "waitlist.json"

# Limits
MAX_MESSAGE_SIZE = 20000
MAX_FILE_SIZE = 50000
MAX_CONTEXT_SIZE = 200000
MAX_LOG_SIZE = 100000
MAX_COMMAND_LENGTH = 2000
MAX_QUERY_LENGTH = 200
MAX_HISTORY_ENTRIES = 20
MAX_LOG_ENTRIES = 5000
MAX_EMOTIONS_HISTORY = 50
DEFAULT_WAIT_TIME = 0.5

# Cache settings
CACHE_CLEANUP_INTERVAL = 60
CACHE_EXPIRY_SECONDS = 300

# File types and extensions
ALLOWED_EXTENSIONS = ['.mp4', '.css', '.js', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.html', '.json']
BLOCKED_FILES = ['key_history.json','auth_users.json', 'auth_tokens.json', 'auth_config.json']

# Special markers
FILE_READ_ERROR_SENTINEL = "<_INTERNAL_APP_FILE_READ_ERROR_SENTINEL_>"

# =======================
# GLOBAL STATE
# =======================
action_process = None
SPOKEN_MESSAGE_IDS = {}
spoken_ids_lock = Lock()
_cleanuser_served_ids_cache = {}
_cleanuser_ids_cache_lock = Lock()
_last_cleanup_time = 0
_cleanuser_last_cleanup_time = 0

# =======================
# FILE I/O UTILITIES
# =======================
def safe_read_file(file_path, default="", encoding="utf-8", max_size=MAX_FILE_SIZE):
    """Safely read a file with error handling and size limiting."""
    try:
        if not os.path.exists(file_path):
            return default
        if os.path.getsize(file_path) > max_size:
            print(f"Warning: {file_path} size ({os.path.getsize(file_path)}) exceeds limit {max_size}.")
            return "[Error: File too large]"
        with open(file_path, "r", encoding=encoding) as f:
            return f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return default

def safe_write_file(file_path, content, encoding="utf-8"):
    """Safely write to a file with error handling."""
    try:
        with open(file_path, "w", encoding=encoding) as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error writing to {file_path}: {e}")
        return False

def safe_load_json(file_path, default=None, encoding="utf-8"):
    """Safely load JSON with error handling."""
    # This function now correctly uses the caller-provided default.
    # It avoids assuming the default should be a dictionary.

    # The default value for this function if nothing is provided.
    # We will use this to set the `effective_default`.
    effective_default = default
    if default is None:
        effective_default = {}

    try:
        if not os.path.exists(file_path):
            return effective_default

        with open(file_path, "r", encoding=encoding) as f:
            content = f.read()
            if not content.strip():
                return effective_default

            loaded_json = json.loads(content)

            # CRITICAL FIX: If a file contains the word "null", json.loads returns None.
            # In this case, we must return the intended default, not None, to prevent crashes.
            if loaded_json is None:
                return effective_default

            return loaded_json

    except json.JSONDecodeError as e:
        print(f"JSON Decode Error loading {file_path}: {e}")
        try:
            with open(file_path, "r", encoding=encoding) as f_err:
                print(f"Content of invalid JSON file {file_path}: {f_err.read(200)}...")
        except Exception:
            pass
        return effective_default

    except Exception as e:
        print(f"Error loading JSON from {file_path}: {e}")
        return effective_default

def safe_save_json(file_path, data, indent=2, encoding="utf-8"):
    """Safely save JSON with error handling."""
    try:
        with open(file_path, "w", encoding=encoding) as f:
            json.dump(data, f, indent=indent)
        return True
    except TypeError as e:
        print(f"TypeError saving JSON to {file_path}: {e}. Data might contain non-serializable types.")
        return False
    except Exception as e:
        print(f"Error saving JSON to {file_path}: {e}")
        return False

# =======================
# COMMAND HANDLING
# =======================
def send_command(command, wait_time=DEFAULT_WAIT_TIME):
    """Send command to the action system via website_input.txt."""
    try:
        if safe_write_file(WEBSITE_INPUT_FILE, command):
            print(f"[APP CMD SEND] Sent command to backend: {command}")
            if wait_time > 0:
                time.sleep(wait_time)
            return True
        print(f"[APP CMD SEND] FAILED write: {command}")
        return False
    except Exception as e:
        print(f"[APP CMD SEND] FAILED exception: {command}, Error: {e}")
        return False

def handle_command_and_parse(command, search_pattern, history_lines=30, result_processor=None, default_result=None):
    """Generic handler for sending command and parsing result from history file."""
    if command:
        if not send_command(command, wait_time=0.7):
            print(f"handle_command_and_parse: Failed to send command '{command}'")
            return default_result

    if not os.path.exists(CONVERSATION_HISTORY_FILE):
        return default_result

    try:
        content = safe_read_file(CONVERSATION_HISTORY_FILE)
        if not content:
            return default_result
        lines = content.strip().split('\n')

        for line in reversed(lines[-history_lines:]):
            match = re.search(search_pattern, line, re.IGNORECASE | re.DOTALL)
            if match:
                print(f"handle_command_and_parse: Match found for '{search_pattern}' in line: {line[:100]}...")
                if result_processor:
                    return result_processor(match)
                return match.group(1) if match.groups() else match.group(0)
        print(f"handle_command_and_parse: No match found for '{search_pattern}' in last {history_lines} lines.")
        return default_result
    except Exception as e:
        print(f"Error parsing command result for '{search_pattern}': {e}")
        return default_result

# =======================
# API UTILITIES
# =======================
def api_response(success, data=None, error=None, status_code=200):
    """Create standardized API response JSON."""
    response = {"success": success}
    if data is not None:
        if isinstance(data, dict):
            response.update(data)
        else:
            response["data"] = data
    if error is not None:
        response["error"] = str(error)
    return jsonify(response), status_code

def handle_errors(f):
    """Decorator to standardize error handling for API routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            import traceback
            print(f"--- Error in route {f.__name__} ---")
            traceback.print_exc()
            print(f"--- End error for {f.__name__} ---")
            return api_response(False, error="An internal server error occurred.", status_code=500)
    return decorated_function

def mask_api_key(api_key):
    """Mask API key for display/logging."""
    if not api_key or len(api_key) < 8:
        return '********'
    return f"{api_key[:4]}{'*' * 8}{api_key[-4:]}"

def log_api_key(api_key, provider='gemini', model=None):
    """Log API key update (masked) to key_history.json."""
    keys = safe_load_json(KEY_HISTORY_FILE, [])
    if keys is None: # safe_load_json might return None on error
        keys = []
    masked_key_value = mask_api_key(api_key)
    new_entry = {
        'key': masked_key_value,
        'provider': provider,
        'timestamp': datetime.now().isoformat()
    }
    if model:
        new_entry['model'] = model
    keys.insert(0, new_entry)
    if len(keys) > MAX_HISTORY_ENTRIES:
        keys = keys[:MAX_HISTORY_ENTRIES]
    safe_save_json(KEY_HISTORY_FILE, keys)

# =======================
# AUTHENTICATION
# =======================
def validate_token_from_header(auth_header):
    """Extract and validate token from Authorization header."""
    if not auth_header:
        return False, None, "No authorization header"

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return False, None, "Invalid authorization header format"

    token = parts[1]
    return auth.validate_token(token)

# =======================
# CACHE MANAGEMENT
# =======================
def _cleanup_generic_cache(cache_dict_ref, cache_lock, expiry_seconds, cache_name_for_log):
    """Generic function to clean up old entries from a cache dictionary."""
    cutoff_time = time.time() - expiry_seconds
    keys_to_delete = []
    deleted_count = 0

    with cache_lock:
        if cache_dict_ref is None:
            print(f"[{cache_name_for_log} Clean] Warning: Cache dictionary is None, skipping cleanup.")
            return

        items_copy = list(cache_dict_ref.items())
        for item_id, timestamp in items_copy:
            if isinstance(timestamp, (int, float)) and timestamp < cutoff_time:
                keys_to_delete.append(item_id)

        for key in keys_to_delete:
            if cache_dict_ref.pop(key, None) is not None:
                deleted_count += 1

    if deleted_count > 0:
        print(f"[{cache_name_for_log} Clean] Cleaned cache, removed {deleted_count} stale keys. Size now: {len(cache_dict_ref)}")

def cleanup_spoken_ids():
    """Periodically cleanup old entries from SPOKEN_MESSAGE_IDS cache."""
    global SPOKEN_MESSAGE_IDS, spoken_ids_lock
    _cleanup_generic_cache(SPOKEN_MESSAGE_IDS, spoken_ids_lock, CACHE_EXPIRY_SECONDS, "SPOKEN_MESSAGE_IDS")

def cleanup_cleanuser_served_ids_cache():
    """Periodically cleanup old entries from _cleanuser_served_ids_cache."""
    global _cleanuser_served_ids_cache, _cleanuser_ids_cache_lock
    _cleanup_generic_cache(_cleanuser_served_ids_cache, _cleanuser_ids_cache_lock, CACHE_EXPIRY_SECONDS, "CleanUserCache")

def check_and_run_cleanup():
    """Execute cleanup function if interval has passed."""
    global _last_cleanup_time
    now = time.time()
    if now - _last_cleanup_time > CACHE_CLEANUP_INTERVAL:
        try:
            cleanup_spoken_ids()
        except Exception as e:
            print(f"[SYSTEM Clean] Error during scheduled cleanup: {e}")
        finally:
            _last_cleanup_time = now

def check_and_run_cleanuser_cache_cleanup():
    """Check if it's time to run cleanup and execute if needed."""
    global _cleanuser_last_cleanup_time
    now = time.time()
    if now - _cleanuser_last_cleanup_time > CACHE_CLEANUP_INTERVAL:
        try:
            cleanup_cleanuser_served_ids_cache()
        except Exception as e:
            print(f"[CLEANUSER Clean] Error during scheduled cleanup: {e}")
        finally:
            _cleanuser_last_cleanup_time = now

# =======================
# FILE SERVING UTILITIES
# =======================
def _serve_file_with_metadata_headers(app_instance, file_path, id_cache, id_cache_lock,
                                     new_status_str="NEW", cached_status_str="CACHED", log_context="File"):
    """Generic helper to serve a file with metadata headers (X-Message-Timestamp, ID, Status)."""
    response_text = ""
    message_id = ""
    file_mod_time_ns = 0
    message_status = "UNKNOWN"

    try:
        if os.path.exists(file_path):
            stat_result = os.stat(file_path)
            file_mod_time_ns = max(0, stat_result.st_mtime_ns)
            file_size = stat_result.st_size

            if file_size == 0:
                response_text = ""
                message_status = "EMPTY"
            elif file_size < MAX_FILE_SIZE:
                content_or_error = safe_read_file(file_path, default=FILE_READ_ERROR_SENTINEL)
                
                if content_or_error == FILE_READ_ERROR_SENTINEL:
                    response_text = "[Error: Read Failed]"
                    message_status = "FILE_READ_ERROR"
                    file_mod_time_ns = int(time.time_ns())
                elif content_or_error == "[Error: File too large]":
                    response_text = "[Error: File too large]"
                    message_status = "CONTENT_TOO_LARGE_ERROR"
                    file_mod_time_ns = int(time.time_ns())
                else:
                    response_text = content_or_error.strip()
            else:
                response_text = "[Error: File too large]"
                message_status = "CONTENT_TOO_LARGE_ERROR"
                file_mod_time_ns = int(time.time_ns())
        else:
            message_status = "MISSING"
    except FileNotFoundError:
        print(f"Warning: {log_context} file {file_path} disappeared during access.")
        message_status = "MISSING"
    except Exception as e:
        print(f"Error accessing {log_context} file {file_path}: {e}")
        response_text = "[Error: Read Failed]"
        message_status = "SERVER_FILE_ACCESS_ERROR"
        file_mod_time_ns = int(time.time_ns())

    # Determine final message_status and generate message_id
    try:
        if message_status == "UNKNOWN":
            if not response_text:
                message_status = "EMPTY"

        if message_status == "EMPTY" or message_status == "MISSING":
            message_id = f"{message_status.lower()}-{file_mod_time_ns or int(time.time_ns())}"
        elif message_status.endswith("_ERROR") or response_text.startswith("[Error:"):
            error_prefix = message_status.split('_')[0].lower() if '_' in message_status else 'error'
            message_id = f"{error_prefix}-msg-{file_mod_time_ns or int(time.time_ns())}"
        else:
            content_hash = hashlib.md5(response_text.encode('utf-8')).hexdigest()[:16]
            message_id = f"{content_hash}-{file_mod_time_ns}"

            with id_cache_lock:
                current_time = time.time()
                if id_cache is None:
                    print(f"Warning: {log_context} ID cache is None. Cannot determine NEW/CACHED status for {file_path}.")
                    message_status = "CACHE_ERROR"
                    message_id = f"cache_error-nohash-{file_mod_time_ns or int(time.time_ns())}"
                elif message_id not in id_cache:
                    message_status = new_status_str
                    id_cache[message_id] = current_time
                else:
                    message_status = cached_status_str
    except Exception as e:
        print(f"Error generating msg ID or checking cache for {log_context} ({file_path}): {e}")
        if not (message_status.endswith("_ERROR") or message_status == "CACHE_ERROR"):
            message_status = "ID_GENERATION_ERROR"
        
        error_prefix_for_id = message_status.split('_')[0].lower() if '_' in message_status else 'id_fail'
        message_id = f"{error_prefix_for_id}-fail-{int(time.time_ns())}"

    if message_status == "UNKNOWN":
        print(f"Warning: {log_context} message status for {file_path} remained UNKNOWN, defaulting to GENERIC_ERROR")
        message_status = "GENERIC_ERROR"
        if not (message_id.startswith("error-") or message_id.startswith("generic-error-") or "fail-" in message_id or "cache_error-" in message_id):
            message_id = f"generic-error-{file_mod_time_ns or int(time.time_ns())}"
    
    response_obj = app_instance.response_class(
        response=response_text,
        status=200,
        mimetype='text/plain'
    )
    response_obj.headers.update({
        'Access-Control-Allow-Origin': '*',
        'X-Message-Timestamp': str(file_mod_time_ns),
        'X-Message-ID': str(message_id),
        'X-Message-Status': str(message_status),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    })
    return response_obj

# =======================
# ACTION SYSTEM MANAGEMENT
# =======================
def start_action_system(api_provider=None):
    """Starts the action_simplified.py subprocess."""
    env = os.environ.copy()
    env["SERVER_ENVIRONMENT"] = "SERVER"
    script_path = "action_simplified.py"
    python_executable = sys.executable if sys.executable else "python3"

    if not os.path.exists(script_path):
        print(f"ERROR: Action script '{script_path}' not found.")
        return None

    command = [python_executable, script_path]
    if api_provider in ["gemini", "openai"]:
        command.append(api_provider)

    stdout_log = None
    process = None
    try:
        stdout_log = open(ACTION_OUTPUT_LOG, "w", encoding='utf-8')
        process = subprocess.Popen(
            command, env=env, stdout=stdout_log, stderr=subprocess.STDOUT,
        )
        print(f"[APP] Started action system (PID {process.pid}) with command: {' '.join(command)}")
        print(f"[APP] Logging backend output to {ACTION_OUTPUT_LOG}")
    except FileNotFoundError:
        print(f"ERROR: Command '{python_executable}' not found. Is Python installed and in PATH?")
        if stdout_log:
            stdout_log.close()
        return None
    except Exception as e:
        print(f"ERROR: Failed to start action system: {e}")
        if stdout_log:
            stdout_log.close()
        if process and process.poll() is None:
            try:
                process.kill()
                process.wait(timeout=1)
            except Exception:
                pass
        return None

    return process

def cleanup_action_system():
    """Terminates the action_simplified.py subprocess cleanly on exit."""
    global action_process
    if action_process and action_process.poll() is None:
        pid = action_process.pid
        print(f"[APP] Terminating action system (PID {pid})...")
        try:
            action_process.terminate()
            action_process.wait(timeout=5)
            print(f"[APP] Action system (PID {pid}) terminated gracefully.")
        except subprocess.TimeoutExpired:
            print(f"[APP] Graceful shutdown timeout (PID {pid}), sending SIGKILL...")
            action_process.kill()
            try:
                action_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                print(f"[APP] Process {pid} kill timed out.")
            except Exception as kill_e:
                print(f"[APP] Error waiting on kill for PID {pid}: {kill_e}")
            print(f"[APP] Action system (PID {pid}) killed.")
        except ProcessLookupError:
            print(f"[APP] Process {pid} not found, likely already terminated.")
        except Exception as e:
            print(f"[APP] Error during shutdown (PID {pid}): {e}")
        finally:
            action_process = None
    elif action_process:
        print(f"[APP] Action system (PID {action_process.pid}) already terminated.")
        action_process = None
    else:
        print("[APP] No running action system process to terminate.")

def restart_action_system(api_provider=None):
    """Handles the full sequence of restarting the action system."""
    global action_process
    print("[APP] Initiating action system restart...")
    print("[APP] Sending prepare_shutdown command...")
    send_command("prepare_shutdown", wait_time=5)

    cleanup_action_system()

    try:
        print("[APP] Re-initializing files...")
        initialize_files()
        print("[APP] Reloading command system...")
        command_system.reload_commands()
    except BaseException as e:
        import traceback
        print(f"--- Restart Error during filesystem/command init ---")
        traceback.print_exc()
        print(f"--- End Restart Init Error ---")
        return False, f"Restart failed during filesystem/command init: {e}"

    print(f"[APP] Starting new action system process (Provider: {api_provider or 'default'})...")
    action_process = start_action_system(api_provider)
    if action_process is None:
        print("[APP] ERROR: Failed to start new action system process after cleanup.")
        return False, "Failed to start new action system process"

    print("[APP] Pausing briefly to check process health...")
    time.sleep(1.5)
    if action_process.poll() is not None:
        print(f"[APP] ERROR: Action system terminated unexpectedly after start (code {action_process.poll()})")
        return False, f"Action system terminated unexpectedly after start (code {action_process.poll()})"

    print("[APP] Re-initializing key actions post-restart (start key, start web_input)...")
    results = {"success": True, "warning": False, "errors": []}
    key_init_commands = ["start key", "start web_input"]
    for cmd in key_init_commands:
        success = False
        for attempt in range(3):
            time.sleep(3)
            if action_process.poll() is not None:
                print(f"[APP] ERROR: Action system terminated before sending '{cmd}'")
                results["errors"].append(f"Action system terminated before sending '{cmd}'")
                results["warning"] = True
                break
            if send_command(cmd):
                print(f"[APP] Successfully sent command: {cmd}")
                success = True
                break
            print(f"[APP] Warning: Failed to send '{cmd}' (attempt {attempt+1})")
            results["errors"].append(f"Failed to send '{cmd}' (attempt {attempt+1})")
            time.sleep(1)

        if not success and action_process.poll() is None:
            results["warning"] = True
            print(f"[APP] Warning: Could not confirm '{cmd}' command was sent successfully.")

        if action_process.poll() is not None:
            break

    print("[APP] Final check after re-initialization attempts...")
    time.sleep(2)
    if action_process.poll() is not None:
        error_message = f"Action system terminated during initialization (code {action_process.poll()})."
        if results["errors"]:
            error_message += f" Last Errors: {'; '.join(results['errors'][-2:])}"
        print(f"[APP] ERROR: {error_message}")
        return False, error_message

    message = "System restarted successfully"
    if results["warning"]:
        message = "System restarted with warnings during key action init"
        if results["errors"]:
            message += f" (Details logged server-side)"
        print(f"[APP] Restart completed with warnings. Errors: {results['errors']}")

    print(f"[APP] Restart complete: {message}")
    return True, {**results, "message": message}

# =======================
# FILE INITIALIZATION
# =======================
def initialize_files():
    """Initialize or clear necessary files for system operation."""
    files_to_init = [CONVERSATION_HISTORY_FILE, WEBSITE_OUTPUT_FILE, WEBSITE_INPUT_FILE]
    files_to_ensure_exist = ["key.py", "openai_key.py", ACTIONS_CONFIG_FILE, API_CONFIG_FILE, MAIN_CONFIG_FILE, WAITLIST_FILE]

    print("[APP Init] Initializing files...")
    for file_path in files_to_init:
        try:
            mode = "w" if file_path != CONVERSATION_HISTORY_FILE else "a"
            dir_name = os.path.dirname(file_path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)

            if not os.path.exists(file_path) or mode == "w":
                with open(file_path, "w", encoding="utf-8") as f:
                    if file_path == CONVERSATION_HISTORY_FILE:
                        f.write("[]\n")
                    else:
                        f.write("")
                print(f"[APP Init] Initialized/Cleared file: {file_path}")
            elif mode == "a" and os.path.getsize(file_path) == 0:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write("[]\n")
                print(f"[APP Init] Initialized empty history file: {file_path}")

        except OSError as e:
            print(f"ERROR: Failed to initialize file '{file_path}': {e}")
            raise SystemExit(f"File initialization failed for {file_path}: {e}")

    for file_path in files_to_ensure_exist:
        if not os.path.exists(file_path):
            try:
                print(f"[APP Init] File {file_path} not found. Creating default.")
                if file_path.endswith("_key.py"):
                    content = f"# Default {file_path}\nAPI_KEY = \"YOUR_API_KEY_HERE\"\n"
                    safe_write_file(file_path, content)
                elif file_path == ACTIONS_CONFIG_FILE:
                    safe_save_json(file_path, {})
                elif file_path == WAITLIST_FILE:
                    print(f"[APP Init] Creating empty waitlist file: {file_path}")
                    if safe_save_json(file_path, []):
                        print(f"[APP Init] Successfully created {file_path}")
                    else:
                        print(f"[APP Init] Failed to create {file_path}")
                elif file_path == API_CONFIG_FILE:
                    default_api_config = {
                        "active_provider": "openai",
                        "providers": {
                            "gemini": {"model_name": "gemini-2.0-flash-thinking-exp-01-21", "api_key_file": "key.py", "api_key_var": "GEMINI_API_KEY"},
                            "openai": {"model_name": "gpt-4", "api_key_file": "openai_key.py", "api_key_var": "OPENAI_API_KEY"}
                        }
                    }
                    safe_save_json(file_path, default_api_config)
                elif file_path == MAIN_CONFIG_FILE:
                    default_config = {
                        "API_PROVIDER": "gemini",
                        "DEFAULT_DELAY_SECONDS": 2.0,
                        "LOG_LEVEL": "info",
                        "ENABLE_VOICE": False,
                        "ENABLE_WEB_INPUT": True,
                        "LOCAL_PATH_BASE": "",
                        "SERVER_MODE": False,
                        "MAX_HISTORY_SIZE": 50000,
                        "CACHE_EXPIRY_SECONDS": 300,
                        "TTS_VOLUME": 1.0
                    }
                    safe_save_json(file_path, default_config)
                else:
                    safe_write_file(file_path, "{}")
            except Exception as e:
                print(f"ERROR: Failed to create default file '{file_path}': {e}")

    # --- THIS BLOCK WAS REMOVED ---
    # The creation of lore_data.json is handled by the backend lore addon.
    # This server should only READ the file, not create it, to avoid race conditions.

    print("[APP Init] File initialization check complete.")

# =======================
# FLASK ROUTES - STATIC FILES
# =======================
@app.route('/')
def home():
    """Serve the main application homepage (index.html)."""
    try:
        return send_file('index.html')
    except FileNotFoundError:
        return "Error: index.html not found.", 404

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (.css, .js, images) with security checks."""
    if path.endswith('.py'):
        return "Access denied", 403
    
    try:
        app_root_directory = os.path.abspath(os.path.dirname(__file__))
        requested_file_absolute_path = os.path.abspath(os.path.join(app_root_directory, path))
        
        if not requested_file_absolute_path.startswith(app_root_directory):
            print(f"Access denied (path traversal attempt): {path}")
            return "Access denied", 403

        if path in BLOCKED_FILES:
            print(f"Access explicitly denied for sensitive file: {path}")
            return "Access Denied", 403

        extension_is_allowed = any(path.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

        if extension_is_allowed and os.path.isfile(requested_file_absolute_path):
            return send_from_directory(os.path.dirname(requested_file_absolute_path), 
                                     os.path.basename(requested_file_absolute_path))
        else:
            print(f"Access denied or file not found for: {path} (Resolved: {requested_file_absolute_path}, "
                  f"ExtAllowed: {extension_is_allowed}, IsFile: {os.path.isfile(requested_file_absolute_path)})")
            return "Access denied or file not found", 404
            
    except Exception as e:
        print(f"Error serving static file {path}: {e}")
        return "Server error", 500

# =======================
# FLASK ROUTES - DATA FILES
# =======================
@app.route('/cleanuser.txt')
def get_cleanuser():
    """Serve the cleanuser.txt file using the generic metadata header helper."""
    check_and_run_cleanuser_cache_cleanup()
    return _serve_file_with_metadata_headers(
        app_instance=app,
        file_path="cleanuser.txt",
        id_cache=_cleanuser_served_ids_cache,
        id_cache_lock=_cleanuser_ids_cache_lock,
        new_status_str="NEW",
        cached_status_str="CACHED",
        log_context="CleanUser"
    )

@app.route('/website_output.txt')
def get_latest_response():
    """Serve latest AI response using the generic metadata header helper."""
    check_and_run_cleanup()
    return _serve_file_with_metadata_headers(
        app_instance=app,
        file_path=WEBSITE_OUTPUT_FILE,
        id_cache=SPOKEN_MESSAGE_IDS,
        id_cache_lock=spoken_ids_lock,
        new_status_str="NEW",
        cached_status_str="SPOKEN",
        log_context="WebsiteOutput"
    )

@app.route('/princi2.txt')
@handle_errors
def get_principles():
    """Serve the princi2.txt file containing principle definitions."""
    princi_file = "princi2.txt"
    
    if not os.path.exists(princi_file):
        return api_response(False, error="Principles file not found", status_code=404)
    
    try:
        content = safe_read_file(princi_file, default="", max_size=MAX_FILE_SIZE)
        
        if content == "[Error: File too large]":
            return api_response(False, error="Principles file too large", status_code=413)
        
        response = app.response_class(
            response=content,
            status=200,
            mimetype='text/plain'
        )
        
        response.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        })
        
        return response
        
    except Exception as e:
        print(f"Error reading princi2.txt: {e}")
        return api_response(False, error="Error reading principles file", status_code=500)

@app.route('/commands.json')
@handle_errors
def serve_commands():
    """Serve the commands.json configuration file."""
    command_file = command_system.COMMAND_FILE
    if os.path.exists(command_file):
        data = safe_load_json(command_file)
        if not isinstance(data, dict):
            return api_response(False, error="Commands file is invalid JSON or not a JSON object.", status_code=500)
        return send_file(command_file, mimetype='application/json')
    else:
        return api_response(False, error="Commands file not found.", status_code=404)

@app.route('/actions.json')
@handle_errors
def get_actions_config():
    """Serve the actions.json configuration file."""
    if os.path.exists(ACTIONS_CONFIG_FILE):
        data = safe_load_json(ACTIONS_CONFIG_FILE)
        if data is None:
            return api_response(False, error="Actions file is invalid JSON, unreadable, or contains 'null'.", status_code=500)
        if not isinstance(data, dict):
            return api_response(False, error="Actions file is not a valid JSON object.", status_code=500)
        return jsonify(data)
    else:
        return api_response(False, error=f"{ACTIONS_CONFIG_FILE} not found", status_code=404)

@app.route('/api/lore_data', methods=['GET'])
@handle_errors
def get_lore_data():
    """Serve the lore_data.json file."""
    if not os.path.exists(LORE_DATA_FILE):
        return api_response(False, error=f"'{LORE_DATA_FILE}' not found.", status_code=404)

    data = safe_load_json(LORE_DATA_FILE)

    if data is None:
        return api_response(False, error=f"'{LORE_DATA_FILE}' could not be loaded/parsed, or its content is 'null'.", status_code=500)

    if not isinstance(data, (dict, list)):
        return api_response(False, error=f"Content of '{LORE_DATA_FILE}' is not a valid JSON object or array (got type: {type(data).__name__}).", status_code=500)

    return api_response(True, data=data)

@app.route('/conversation_history.json')
def get_conversation_history():
    """Serve the raw conversation history file."""
    try:
        if os.path.exists(CONVERSATION_HISTORY_FILE):
            return send_file(CONVERSATION_HISTORY_FILE, mimetype='application/json', max_age=0)
        else:
            return jsonify([])
    except Exception as e:
        print(f"Error reading {CONVERSATION_HISTORY_FILE}: {e}")
        return jsonify({"error": f"Error reading conversation history: {e}"}), 500

@app.route('/control_output.json')
@handle_errors
def get_control_output():
    """Serve the control_output.json file generated by the controls.py action."""
    if not os.path.exists(CONTROL_OUTPUT_FILE):
        return jsonify({"status": "No control commands", "timestamp": time.time()})

    try:
        data = safe_load_json(CONTROL_OUTPUT_FILE)
        if data is None:
            return jsonify({"error": "Invalid JSON or 'null' content in control file", "timestamp": time.time()})
        if not data:
             return jsonify({"status": "Empty control file", "timestamp": time.time()})
        return jsonify(data)
    except Exception as e:
        print(f"Error reading control_output.json: {e}")
        return jsonify({"error": f"Error reading control file: {e}", "timestamp": time.time()})


# =======================
# FLASK ROUTES - CORE INTERACTION
# =======================
@app.route('/submit_input', methods=['POST', 'OPTIONS'])
@handle_errors
def submit_input():
    """Receive user input/commands from frontend and send to backend."""
    if request.method == 'OPTIONS':
        resp = app.make_default_options_response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return resp

    if auth.is_auth_enabled():
        auth_header = request.headers.get('Authorization')
        ip_address = request.remote_addr or 'unknown'
        is_authorized, username, reason = auth.is_request_authorized(auth_header, ip_address)
        if not is_authorized:
            try:
                content_type = request.headers.get('Content-Type', 'text/plain')
                if 'text/plain' in content_type:
                    message = request.data.decode('utf-8')
                elif 'application/json' in content_type:
                    json_data = request.get_json()
                    message = json_data.get('input') if isinstance(json_data, dict) else str(json_data)
                else:
                    message = "Unknown content"
            except:
                message = "Failed to parse content"
            log_message = f"[AUTH BLOCKED]: Unauthorized input attempt from {ip_address}: {message[:100]}..."
            print(log_message)
            auth._log_attempt(username or "unknown", ip_address, False, f"Unauthorized: {reason}")
            return api_response(False, error='Unauthorized', status_code=401)
        print(f"[APP] Authorized request from user: {username}")

    try:
        content_type = request.headers.get('Content-Type', 'text/plain')
        if 'text/plain' in content_type:
            message = request.data.decode('utf-8')
        elif 'application/json' in content_type:
            json_data = request.get_json()
            message = json_data.get('input') if isinstance(json_data, dict) else None
            if message is None:
                raise ValueError("Missing 'input' field in JSON")
        else:
            return api_response(False, error=f"Unsupported Content-Type: {content_type}", status_code=415)
    except UnicodeDecodeError:
        return api_response(False, error="Invalid UTF-8 data received", status_code=400)
    except ValueError as e:
        return api_response(False, error=str(e), status_code=400)
    except Exception as e:
        print(f"Error accessing request data: {e}")
        return api_response(False, error="Failed to process request data", status_code=400)

    if len(message) > MAX_MESSAGE_SIZE:
        print(f"Oversized message ({len(message)} bytes), rejecting")
        return api_response(False, error="Message too large", status_code=413)

    log_prefix = "Received command" if command_system.is_command(message) else "Received user input"
    if auth.is_auth_enabled():
        auth_header = request.headers.get('Authorization')
        token_valid, token_username, _ = validate_token_from_header(auth_header)
        if token_valid:
            print(f"[APP] {log_prefix} from '{token_username}': {message[:100]}{'...' if len(message)>100 else ''}")
        else:
            print(f"[APP] {log_prefix} (user validation issue): {message[:100]}{'...' if len(message)>100 else ''}")
    else:
        print(f"[APP] {log_prefix}: {message[:100]}{'...' if len(message)>100 else ''}")

    if not send_command(message, wait_time=0):
        print("[APP] Error: Failed to write command to website_input.txt")
        return api_response(False, error="Failed to communicate with backend action system", status_code=500)

    response, status_code = api_response(True, {"message": "Input submitted successfully."})
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response, status_code

# =======================
# FLASK ROUTES - AUTHENTICATION
# =======================
@app.route('/api/auth/login', methods=['POST'])
@handle_errors
def auth_login():
    """Authenticate user and return token. Also swaps conversation history."""
    data = request.json
    if not data or 'username' not in data or 'password' not in data:
        return api_response(False, error='Username and password required', status_code=400)

    username = data['username']
    password = data['password']
    ip_address = request.remote_addr or 'unknown'
    success, reason = auth.authenticate_user(username, password)
    auth._log_attempt(username, ip_address, success, reason)

    if success:
        token = auth.create_token(username)
        
        print(f"[APP] User '{username}' logged in successfully. Swapping conversation history...")
        try:
            auth._swap_history_files(username)
            
            print(f"[APP] Triggering backend restart to load {username}'s conversation history...")
            restart_success, restart_result = restart_action_system()
            
            if not restart_success:
                print(f"[APP] WARNING: Backend restart failed after login: {restart_result}")
                return api_response(True, {
                    'token': token,
                    'username': username,
                    'message': 'Login successful but history swap encountered issues',
                    'warning': 'Backend restart failed - conversation history may not be loaded correctly'
                })
            
            print(f"[APP] Successfully swapped to {username}'s conversation history")
            
        except Exception as e:
            print(f"[APP] ERROR during history swap for user '{username}': {e}")
            return api_response(True, {
                'token': token,
                'username': username,
                'message': 'Login successful but history swap failed',
                'warning': str(e)
            })
        
        return api_response(True, {'token': token, 'username': username, 'message': 'Login successful'})
    else:
        return api_response(False, error=reason, status_code=401)

@app.route('/api/auth/validate', methods=['GET'])
@handle_errors
def auth_validate():
    """Validate current token."""
    auth_header = request.headers.get('Authorization')
    valid, username, reason = validate_token_from_header(auth_header)
    if valid:
        return api_response(True, {'valid': True, 'username': username})
    else:
        return api_response(False, error=reason, status_code=401)

@app.route('/api/auth/logout', methods=['POST'])
@handle_errors
def auth_logout():
    """Logout user by invalidating token. Also saves and clears conversation history."""
    auth_header = request.headers.get('Authorization')
    username = None
    
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]
            if token in auth._auth_state['tokens']:
                username = auth._auth_state['tokens'][token].get('username')
                del auth._auth_state['tokens'][token]
                auth._save_tokens()
                
                if username:
                    print(f"[APP] User '{username}' logging out. Saving conversation history...")
                    try:
                        auth._handle_logout_history_save()
                        
                        print(f"[APP] Triggering backend restart to clear conversation history after logout...")
                        restart_success, restart_result = restart_action_system()
                        
                        if not restart_success:
                            print(f"[APP] WARNING: Backend restart failed after logout: {restart_result}")
                            return api_response(True, {
                                'message': 'Logout successful but history clear encountered issues',
                                'warning': 'Backend restart failed - conversation history may not be cleared'
                            })
                        
                        print(f"[APP] Successfully saved {username}'s history and cleared active session")
                        
                    except Exception as e:
                        print(f"[APP] ERROR during history save for logout of user '{username}': {e}")
                        return api_response(True, {
                            'message': 'Logout successful but history save failed',
                            'warning': str(e)
                        })
                
                return api_response(True, {'message': 'Logout successful'})
    
    return api_response(True, {'message': 'No active session'})

# =======================
# FLASK ROUTES - SYSTEM CONTROL
# =======================
@app.route('/restart_action', methods=['GET'])
@handle_errors
def restart_action():
    """Restart the action system, applying config changes."""
    api_provider = request.args.get('provider')
    success, result_data = restart_action_system(api_provider)

    response_data = {"success": success}
    if isinstance(result_data, dict):
        response_data.update(result_data)
    else:
        response_data["message"] = str(result_data)
    status_code = 200 if success else 500
    if not success:
        response_data["error"] = response_data.get("message", "Unknown restart error")

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify(response_data), status_code
    else:
        print(f"Browser restart requested. Success: {success}. Message: {response_data.get('message')}")
        return redirect(url_for('home'))

@app.route('/health')
def health_check():
    """Check and report system health."""
    action_running = action_process is not None and action_process.poll() is None
    cache_size = -1
    try:
        with spoken_ids_lock: 
            cache_size = len(SPOKEN_MESSAGE_IDS) if SPOKEN_MESSAGE_IDS is not None else 0
    except Exception as e:
        print(f"Health check error (cache): {e}")
        cache_size = -2

    essential_files = [API_CONFIG_FILE, ACTIONS_CONFIG_FILE, MAIN_CONFIG_FILE]
    missing_files = [f for f in essential_files if not os.path.exists(f)]

    health_status = {
        "status": "ok" if action_running and not missing_files else "error",
        "flask_app": "running",
        "action_system": {
            "status": "running" if action_running else "not running",
            "pid": action_process.pid if action_running else None,
        },
        "caches": {"spoken_ids_size": cache_size},
        "config_files": {
            "status": "ok" if not missing_files else "missing",
            "missing": missing_files
        }
    }
    http_status = 200 if health_status["status"] == "ok" else 503
    return jsonify(health_status), http_status

# =======================
# FLASK ROUTES - CONFIGURATION
# =======================
@app.route('/api/config', methods=['GET', 'POST'])
@handle_errors
def handle_config():
    """GET: Retrieve api_config.json. POST: Update API provider and restart."""
    default_cfg = {
        "active_provider": "unknown",
        "providers": {
            "gemini": {"model_name": "unknown", "api_key_file": "key.py", "api_key_var": "GEMINI_API_KEY"},
            "openai": {"model_name": "unknown", "api_key_file": "openai_key.py", "api_key_var": "OPENAI_API_KEY"}
        }
    }

    if request.method == 'GET':
        config_data = safe_load_json(API_CONFIG_FILE) 
        if config_data is None: 
            if not os.path.exists(API_CONFIG_FILE):
                print(f"Warning: API config '{API_CONFIG_FILE}' not found, returning default structure.")
                return api_response(True, data={"api": default_cfg})
            else:
                return api_response(False, error=f"Failed to load or parse API config '{API_CONFIG_FILE}'.", status_code=500)
        return jsonify({"api": config_data})


    data = request.json
    if not isinstance(data, dict) or "api_provider" not in data:
        return api_response(False, error="Missing or invalid 'api_provider' in JSON body", status_code=400)
    provider = data["api_provider"]
    if provider not in ["gemini", "openai"]:
        return api_response(False, error="Invalid API provider specified.", status_code=400)

    api_config = safe_load_json(API_CONFIG_FILE)
    if api_config is None: 
        print(f"Warning: Failed to load '{API_CONFIG_FILE}' before update, initializing with default.")
        api_config = default_cfg.copy() 
    elif not isinstance(api_config, dict): 
        print(f"Warning: '{API_CONFIG_FILE}' content was not a dict, re-initializing.")
        api_config = default_cfg.copy()


    api_config.setdefault("active_provider", "unknown")
    api_config.setdefault("providers", {})
    api_config["active_provider"] = provider
    if not safe_save_json(API_CONFIG_FILE, api_config):
        return api_response(False, error="Failed to save API config file.", status_code=500)

    print(f"API provider set to {provider}. Triggering action system restart...")
    success, result_data = restart_action_system(provider)
    response_data = {"success": success}
    if isinstance(result_data, dict):
        response_data.update(result_data)
    else:
        response_data["message"] = str(result_data)
    if not success:
        response_data["error"] = response_data.get("message", "Unknown restart error")
    status_code = 200 if success else 500
    if success and "message" not in response_data:
        response_data["message"] = f"Switched API provider to {provider} and restarted action system."
    return jsonify(response_data), status_code

@app.route('/api/main_config', methods=['GET'])
@handle_errors
def get_main_config():
    """Serve the main config.json file."""
    config_data = safe_load_json(MAIN_CONFIG_FILE) 
    if config_data is None: 
        if not os.path.exists(MAIN_CONFIG_FILE):
            print(f"Warning: Main config file '{MAIN_CONFIG_FILE}' not found.")
            return api_response(False, error=f"Configuration file '{MAIN_CONFIG_FILE}' not found.", status_code=404)
        else:
            print(f"Error: Could not load or parse '{MAIN_CONFIG_FILE}'.")
            return api_response(False, error=f"Could not read or parse configuration file '{MAIN_CONFIG_FILE}'.", 
                              status_code=500)
    return api_response(True, data={"config": config_data})


@app.route('/api/update_api_key', methods=['POST'])
@handle_errors
def update_api_key():
    """Update API key for selected provider and restart action system."""
    data = request.get_json()
    if not data or 'api_key' not in data:
        return api_response(False, error='API key is required', status_code=400)

    api_key = data['api_key']
    provider = data.get('provider', 'gemini')
    model = data.get('model', None)
    
    if not isinstance(api_key, str) or len(api_key) < 10:
        return api_response(False, error='Invalid or too short API key', status_code=400)

    provider_lower = provider.lower()
    if provider_lower == 'gemini':
        key_file, key_var = 'key.py', 'GEMINI_API_KEY'
    elif provider_lower == 'openai':
        key_file, key_var = 'openai_key.py', 'OPENAI_API_KEY'
    else:
        return api_response(False, error=f'Unsupported provider: {provider}', status_code=400)

    if not safe_write_file(key_file, f'{key_var} = "{api_key}" # Updated via API {datetime.now().isoformat()}\n'):
        return api_response(False, error=f'Could not write key file {key_file}', status_code=500)
    print(f"Updated key file: {key_file}")

    api_config = safe_load_json(API_CONFIG_FILE) 
    if api_config is None:
        print("Warning: Failed to load api_config.json to update model/active provider. Creating default.")
        api_config = {"providers": {}, "active_provider": provider_lower}
    elif not isinstance(api_config, dict): 
        print("Warning: api_config.json is invalid or empty. Re-initializing with default structure.")
        api_config = {"providers": {}, "active_provider": provider_lower}


    if 'providers' not in api_config or not isinstance(api_config['providers'], dict) :
        api_config['providers'] = {}

    if model and isinstance(model, str) and model.strip():
        if provider_lower not in api_config['providers'] or not isinstance(api_config['providers'][provider_lower], dict):
            api_config['providers'][provider_lower] = {}
        api_config['providers'][provider_lower]['model_name'] = model.strip()
    
    api_config['active_provider'] = provider_lower 

    if not safe_save_json(API_CONFIG_FILE, api_config):
        print(f"Warning: Failed to save updated API config after key update for provider '{provider_lower}'")
    else:
        print(f"Updated API config with provider '{provider_lower}' (model: '{model or 'unchanged'}')")


    log_api_key(api_key, provider, model)
    print(f"API key updated for {provider}. Triggering action system restart...")
    success, result_data = restart_action_system(provider_lower)

    response_data = {"success": success}
    status_code = 200 if success else 500
    if isinstance(result_data, dict):
        response_data.update(result_data)
        if not success:
            response_data["error"] = response_data.get("message", "Restart failed after key update.")
    else:
        response_data["message"] = str(result_data)
        if not success:
            response_data["error"] = str(result_data)
    if success and "message" not in response_data:
        response_data["message"] = f"API Key for {provider} updated and system restarted."
    return jsonify(response_data), status_code

@app.route('/api/key_history', methods=['GET'])
@handle_errors
def get_key_history():
    """Get masked history of API key updates."""
    keys = safe_load_json(KEY_HISTORY_FILE, []) 
    if keys is None:
        keys = []
    return api_response(True, data={'keys': keys})


# =======================
# FLASK ROUTES - ACTIONS
# =======================
@app.route('/api/active_actions', methods=['GET'])
@handle_errors
def get_active_actions():
    """Get list of currently active action names from active_actions.txt."""
    actions_list = []
    if os.path.exists(ACTIVE_ACTIONS_FILE):
        content = safe_read_file(ACTIVE_ACTIONS_FILE, max_size=10000)
        if content == "[Error: File too large]":
            return api_response(False, error="Active actions file too large to process", status_code=500)
        if content and content != "[Error: Read Failed]":
            lines = [line for line in content.splitlines() if line.strip() and ':' in line]
            actions_list = [line.split(':')[0].strip() for line in lines]
        elif content == "[Error: Read Failed]":
             return api_response(False, error="Failed to read active actions file", status_code=500)
    return api_response(True, data={"actions": actions_list})


@app.route('/api/actions', methods=['GET'])
@handle_errors
def get_actions():
    """Get combined list of known actions from actions.json and their current active status."""
    active_set = set()
    try:
        active_actions_resp, status_code_active = get_active_actions()
        if status_code_active == 200:
            active_data_json = active_actions_resp.get_json()
            if active_data_json and isinstance(active_data_json.get('data', {}).get('actions'), list):
                active_set = set(a.lower() for a in active_data_json['data']['actions']
                               if isinstance(a, str) and a.strip() and not a.startswith("Error:"))
    except Exception as e:
        print(f"Error fetching active actions for get_actions endpoint: {e}")

    known_actions = []
    actions_config = safe_load_json(ACTIONS_CONFIG_FILE)
    if actions_config is None:
        print(f"Error: {ACTIONS_CONFIG_FILE} could not be loaded, is invalid, or contains 'null'.")
        return api_response(False, error=f"Failed to load actions configuration from '{ACTIONS_CONFIG_FILE}'.", status_code=500)

    if isinstance(actions_config, dict):
        for name, config in actions_config.items():
            if isinstance(config, dict):
                is_active = name.lower() in active_set
                known_actions.append({
                    "name": name,
                    "priority": config.get("priority", 10),
                    "description": config.get("description", f"Action: {name}"),
                    "active": is_active
                })
        known_actions.sort(key=lambda x: (x.get('priority', 10), x.get('name', '')))
    else:
        print(f"Warning: {ACTIONS_CONFIG_FILE} content is not a valid dictionary after loading.")
    return api_response(True, data={"actions": known_actions})


@app.route('/api/actions/<action_name>', methods=['POST'])
@handle_errors
def toggle_action(action_name):
    """Send start/stop command for a specific action."""
    safe_name = re.sub(r'[^\w-]', '', action_name).strip()
    if not safe_name:
        return api_response(False, error="Invalid action name format.", status_code=400)

    data = request.json
    if not isinstance(data, dict):
        return api_response(False, error="Request body must be JSON.", status_code=400)
    activate = data.get("active")
    if not isinstance(activate, bool):
        return api_response(False, error="'active' field (true/false) is required.", status_code=400)

    command = f"{'start' if activate else 'stop'} {safe_name}"
    print(f"[APP] Toggling action '{safe_name}' to {'ACTIVE' if activate else 'INACTIVE'}")
    if send_command(command, wait_time=DEFAULT_WAIT_TIME):
        return api_response(True, data={
            "action": safe_name,
            "active": activate,
            "message": f"{safe_name} {'started' if activate else 'stopped'}."
        })
    print(f"[APP] Error: Failed to send toggle command '{command}' to backend.")
    return api_response(False, error=f"Failed to send toggle command for {safe_name}.", status_code=500)

@app.route('/api/command', methods=['POST'])
@handle_errors
def execute_command():
    """Send an arbitrary command string to the backend action system."""
    data = request.json
    if not data or "command" not in data or not isinstance(data["command"], str):
        return api_response(False, error="Missing/invalid 'command' string in JSON body.", status_code=400)
    command = data["command"].strip()
    if not command:
        return api_response(False, error="Command cannot be empty.", status_code=400)
    if len(command) > MAX_COMMAND_LENGTH:
        return api_response(False, error=f"Command exceeds maximum length ({MAX_COMMAND_LENGTH} chars).", 
                          status_code=413)

    print(f"[APP] Executing generic command: '{command}'")
    if send_command(command, wait_time=DEFAULT_WAIT_TIME):
        return api_response(True, data={"message": f"Command '{command[:50]}...' sent."})
    print(f"[APP] Error: Failed to send generic command '{command}'")
    return api_response(False, error="Failed to send command to backend.", status_code=500)

# =======================
# FLASK ROUTES - FEATURES
# =======================
@app.route('/api/logs', methods=['GET'])
@handle_errors
def get_logs():
    """Retrieve and filter lines from conversation_history.json."""
    filter_text = request.args.get('filter', '', type=str).lower().strip()
    try:
        limit = max(1, min(int(request.args.get('limit', 100)), MAX_LOG_ENTRIES))
    except ValueError:
        limit = 100
    reverse = request.args.get('reverse', 'false', type=str).lower() == 'true'
    
    logs = []
    total_lines = 0
    error_msg = None
    
    try:
        if os.path.exists(CONVERSATION_HISTORY_FILE) and os.access(CONVERSATION_HISTORY_FILE, os.R_OK):
            with open(CONVERSATION_HISTORY_FILE, 'r', encoding='utf-8') as f:
                all_lines = [line.strip() for line in f if line.strip()]
            filtered_lines = [line for line in all_lines if filter_text in line.lower()] if filter_text else all_lines
            total_lines = len(filtered_lines)
            if reverse:
                logs = filtered_lines[:limit] 
            else:
                logs = filtered_lines[-limit:]
        else:
            error_msg = "Log file not found or not readable."
            print(f"Warning: {error_msg}")
    except Exception as e:
        print(f"Error reading or processing log file {CONVERSATION_HISTORY_FILE}: {e}")
        error_msg = f"Error processing logs: {e}"
    
    if error_msg:
        status_code = 404 if "not found" in error_msg.lower() else 500
        return api_response(False, error=error_msg, status_code=status_code)
    else:
        return api_response(True, data={"logs": logs, "total": total_lines})


@app.route('/api/memory', methods=['GET'])
@handle_errors
def get_memory_data():
    """Get the current memory data (facts, conversations, preferences)."""
    default_structure = {"conversations": {}, "facts": {}, "preferences": {}}
    data = safe_load_json(MEMORY_DATA_FILE)

    if data is None:
        if not os.path.exists(MEMORY_DATA_FILE):
            print(f"Warning: Memory data file '{MEMORY_DATA_FILE}' not found, returning default structure.")
            return jsonify(default_structure.copy())
        else:
            return api_response(False, error=f"Could not load or parse memory data file '{MEMORY_DATA_FILE}'.", status_code=500)

    if not isinstance(data, dict):
        print(f"Warning: Memory data from '{MEMORY_DATA_FILE}' is not a dictionary. Returning default structure.")
        data = default_structure.copy()

    data.setdefault("conversations", {})
    data.setdefault("facts", {})
    data.setdefault("preferences", {})

    if not isinstance(data["conversations"], dict):
        print(f"Warning: 'conversations' in memory data is not a dict. Resetting.")
        data["conversations"] = {}
    if not isinstance(data["facts"], dict):
        print(f"Warning: 'facts' in memory data is not a dict. Resetting.")
        data["facts"] = {}
    if not isinstance(data["preferences"], dict):
        print(f"Warning: 'preferences' in memory data is not a dict. Resetting.")
        data["preferences"] = {}
    
    return jsonify(data)


@app.route('/api/emotions', methods=['GET'])
@handle_errors
def get_emotions_data():
    """Parse and return data from emotions.txt."""
    default_data = {"current": [], "history": []}
    if not os.path.exists(EMOTIONS_FILE):
        return api_response(True, data=default_data)
    
    content = safe_read_file(EMOTIONS_FILE, "")
    if content == "[Error: File too large]" or content == "[Error: Read Failed]":
        return api_response(False, error=f"Could not read emotions file ({content})", status_code=500)
    if not content:
        return api_response(True, data=default_data)
    
    history = []
    try:
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.count('|') < 2:
                continue
            try:
                parts = line.split("|", 2)
                ts_str, role_str, emo_str = parts[0].strip(), parts[1].strip(), parts[2].strip()
                emotions = [e.strip() for e in emo_str.split(",") if e.strip()]
                history.append({
                    "timestamp": ts_str,
                    "role": role_str.lower(),
                    "emotions": emotions
                })
            except ValueError:
                print(f"Skipping malformed emotions line (ValueError): {line}")
            except IndexError:
                print(f"Skipping malformed emotions line (IndexError): {line}")
            except Exception as parse_line_e:
                print(f"Error parsing line '{line}': {parse_line_e}")
    except Exception as e:
        print(f"Error processing emotions file content: {e}")
        return api_response(False, error="Could not parse emotions data", status_code=500)
    
    current_emotions = []
    if history:
        for entry in reversed(history):
            if entry.get('role') in ['user', 'ai'] and entry.get('emotions'):
                current_emotions = entry['emotions']
                break
    
    return api_response(True, data={"current": current_emotions, "history": history[-MAX_EMOTIONS_HISTORY:]})


# =======================
# FLASK ROUTES - PLUGINS
# =======================
# Wikipedia
@app.route('/api/wikipedia/search', methods=['POST'])
@handle_errors
def wikipedia_search():
    data = request.json
    query = data.get("query", "").strip() if isinstance(data, dict) else ""
    if not query:
        return api_response(False, error="Missing search query", status_code=400)
    if len(query) > MAX_QUERY_LENGTH:
        return api_response(False, error="Query too long", status_code=413)
    if send_command(f"wiki search {query}", wait_time=1):
        return api_response(True, data={"message": f"Sent search: '{query}'"})
    return api_response(False, error="Failed to send search command", status_code=500)

@app.route('/api/wikipedia/open/<int:index>', methods=['POST'])
@handle_errors
def wikipedia_open(index):
    if index < 0:
        return api_response(False, error="Index must be non-negative", status_code=400)
    if send_command(f"wiki open {index}", wait_time=1):
        return api_response(True, data={"message": f"Sent open index: {index}"})
    return api_response(False, error="Failed to send open command", status_code=500)

@app.route('/api/wikipedia/list', methods=['GET'])
@handle_errors
def wikipedia_list():
    config_data = safe_load_json("wikipedia_config.json")
    if config_data is None:
        return api_response(False, error="Wikipedia config invalid, unreadable, or 'null'.", status_code=500)
    items = config_data.get("recent_articles", []) if isinstance(config_data, dict) else []
    return api_response(True, data={"recent_articles": items if isinstance(items, list) else []})


# YouTube
@app.route('/api/youtube/search', methods=['POST'])
@handle_errors
def youtube_search():
    data = request.json
    query = data.get("query", "").strip() if isinstance(data, dict) else ""
    if not query:
        return api_response(False, error="Missing search query", status_code=400)
    if len(query) > MAX_QUERY_LENGTH:
        return api_response(False, error="Query too long", status_code=413)
    if send_command(f"youtube search {query}", wait_time=1):
        return api_response(True, data={"message": f"Sent search: '{query}'"})
    return api_response(False, error="Failed to send search command", status_code=500)

@app.route('/api/youtube/open/<int:index>', methods=['POST'])
@handle_errors
def youtube_open(index):
    if index < 0:
        return api_response(False, error="Index must be non-negative", status_code=400)
    if send_command(f"youtube open {index}", wait_time=1):
        return api_response(True, data={"message": f"Sent open index: {index}"})
    return api_response(False, error="Failed to send open command", status_code=500)

@app.route('/api/youtube/list', methods=['GET'])
@handle_errors
def youtube_list():
    config_data = safe_load_json("youtube_config.json")
    if config_data is None:
        return api_response(False, error="YouTube config invalid, unreadable, or 'null'.", status_code=500)
    items = config_data.get("recent_videos", []) if isinstance(config_data, dict) else []
    return api_response(True, data={"recent_videos": items if isinstance(items, list) else []})


# Focus Plugin
@app.route('/api/focus/status', methods=['GET'])
@handle_errors
def get_focus_status():
    """Get current status, config, and LIVE statistics of the focus plugin."""
    focus_is_active = False
    try:
        active_actions_resp, status_code_active = get_active_actions()
        if status_code_active == 200:
            active_data_json = active_actions_resp.get_json()
            if active_data_json and active_data_json.get("success") and isinstance(active_data_json.get('data', {}).get('actions'), list):
                active_set = set(a.lower() for a in active_data_json['data']['actions'] if isinstance(a, str))
                focus_is_active = 'focus' in active_set
    except Exception as e:
        print(f"Error checking active actions for focus status: {e}")
    
    default_stats = {
        "total_inputs": 0, "perturbed_inputs": 0, "typos_applied": 0,
        "emotions_injected": 0, "expletives_injected": 0, "last_perturbation": None
    }
    stats = safe_load_json(FOCUS_STATS_FILE)
    if stats is None:
        print(f"Warning: {FOCUS_STATS_FILE} missing, invalid, or 'null'. Using defaults.")
        stats = default_stats.copy()
    elif not isinstance(stats, dict):
        print(f"Warning: {FOCUS_STATS_FILE} content is not a dictionary. Using defaults.")
        stats = default_stats.copy()
    elif not all(k in stats for k in default_stats.keys()):
        print(f"Warning: {FOCUS_STATS_FILE} incomplete. Merging with defaults.")
        merged_stats = default_stats.copy()
        merged_stats.update(stats)
        stats = merged_stats
    
    default_config = {
        "features": {}, "probability": 0.0, "typo_config": {},
        "emotion_config": {"markers": []}, "expletive_config": {"words": []},
        "triggers": {"keywords": {}, "stress_indicators": {}}, "logging": False
    }
    config = safe_load_json(FOCUS_CONFIG_FILE)
    if config is None:
        print(f"Warning: {FOCUS_CONFIG_FILE} missing, invalid, or 'null'. Using defaults.")
        config = default_config.copy()
    elif not isinstance(config, dict):
        print(f"Warning: {FOCUS_CONFIG_FILE} content is not a dictionary. Using defaults.")
        config = default_config.copy()

    return api_response(True, data={"active": focus_is_active, "statistics": stats, "config": config})


@app.route('/api/focus/logs', methods=['GET'])
@handle_errors
def get_focus_logs():
    """Get logs from the focus_log.txt file."""
    logs = []
    if os.path.exists(FOCUS_LOG_FILE):
        content = safe_read_file(FOCUS_LOG_FILE, "", max_size=MAX_LOG_SIZE)
        if content == "[Error: File too large]":
            return api_response(True, data={"logs": ["[Log file too large to display]"]})
        elif content and content != "[Error: Read Failed]":
            delimiter = "-" * 40
            logs = [log_entry.strip() for log_entry in content.split(delimiter) if log_entry.strip()]
        elif content == "[Error: Read Failed]":
            return api_response(False, error="Failed to read focus log file", status_code=500)
    return api_response(True, data={"logs": logs})

@app.route('/api/focus/config', methods=['GET', 'POST'])
@handle_errors
def handle_focus_config():
    """GET: Return focus config. POST: Update focus config."""
    default_config = {
        "features": {"typos": True, "emotions": True, "expletives": False},
        "probability": 0.3,
        "typo_config": {"probability": 0.5, "max_typos": 1, "preserve_keywords": True},
        "emotion_config": {"probability": 0.4, "markers": []},
        "expletive_config": {"probability": 0.1, "words": []},
        "triggers": {"keywords": {}, "stress_indicators": {}},
        "logging": True
    }
    
    if request.method == 'GET':
        config = safe_load_json(FOCUS_CONFIG_FILE)
        if config is None:
            if not os.path.exists(FOCUS_CONFIG_FILE):
                print(f"Focus config file '{FOCUS_CONFIG_FILE}' not found. Returning default structure.")
                config = default_config.copy()
            else:
                print(f"Error loading or parsing Focus config '{FOCUS_CONFIG_FILE}'.")
                return api_response(False, error=f"Failed to load focus configuration from '{FOCUS_CONFIG_FILE}'.", status_code=500)
        elif not isinstance(config, dict):
             print(f"Focus config file '{FOCUS_CONFIG_FILE}' content is not a valid JSON object. Returning default.")
             config = default_config.copy()
        return api_response(True, data={"config": config})
    
    data = request.json
    if not isinstance(data, dict):
        return api_response(False, error="Invalid JSON data format. Expected an object.", status_code=400)
    
    if not safe_save_json(FOCUS_CONFIG_FILE, data):
        return api_response(False, error="Failed to save focus configuration", status_code=500)
    return api_response(True, data={"message": "Configuration saved."})


@app.route('/api/focus/command', methods=['POST'])
@handle_errors
def execute_focus_command():
    """Execute a focus-specific command by sending it to the backend."""
    data = request.json
    if not data or "command" not in data or not isinstance(data.get("command"), str):
        return api_response(False, error="Missing or invalid 'command' string in JSON body.", status_code=400)
    command_raw = data["command"].strip()
    if not command_raw:
        return api_response(False, error="Command cannot be empty.", status_code=400)
    if len(command_raw) > 500:
        return api_response(False, error="Focus command too long (max 500 chars).", status_code=413)
    
    command_to_send = command_raw if command_raw.lower().startswith("focus ") else f"focus {command_raw}"
    
    print(f"[APP] Sending Focus command: '{command_to_send}'")
    if send_command(command_to_send, wait_time=DEFAULT_WAIT_TIME):
        return api_response(True, data={"message": f"Command '{command_to_send}' sent to Focus plugin."})
    
    print(f"[APP] Error: Failed to send Focus command '{command_to_send}' to backend.")
    return api_response(False, error="Failed to send command to Focus backend.", status_code=500)

# =======================
# FLASK ROUTES - PROMPTS/PERSONAS
# =======================
@app.route('/api/prompts', methods=['GET'])
@handle_errors
def get_prompts():
    """Get list of available prompts directly from prompts.json."""
    prompts_file = "prompts.json"
    if os.path.exists(prompts_file):
        prompts_data = safe_load_json(prompts_file)
        if prompts_data is None:
            return api_response(False, error=f"Failed to load or parse '{prompts_file}'.", status_code=500)
        if isinstance(prompts_data, dict):
            return api_response(True, data={"prompts": list(prompts_data.keys())})
        else:
            return api_response(False, error=f"'{prompts_file}' content is not a valid JSON object.", status_code=500)
    else:
        print(f"Prompts file {prompts_file} not found")
        return api_response(True, data={"prompts": []})

@app.route('/api/prompts/<prompt_name>', methods=['GET'])
@handle_errors
def get_prompt_content(prompt_name):
    """Get content of a specific prompt directly from prompts.json."""
    safe_name = re.sub(r'[^\w-]', '', prompt_name)
    if not safe_name:
        return api_response(False, error="Invalid prompt name format", status_code=400)
    
    prompts_file = "prompts.json"
    if os.path.exists(prompts_file):
        prompts_data = safe_load_json(prompts_file)
        if prompts_data is None:
            return api_response(False, error=f"Failed to load or parse '{prompts_file}'.", status_code=500)
        if not isinstance(prompts_data, dict):
             return api_response(False, error=f"'{prompts_file}' content is not a valid JSON object.", status_code=500)

        if safe_name in prompts_data:
            return api_response(True, data={"content": prompts_data[safe_name]})
        else:
            return api_response(False, error=f"Prompt '{safe_name}' not found in '{prompts_file}'.", status_code=404)
    else:
        return api_response(False, error=f"Prompts file '{prompts_file}' not found.", status_code=404)


@app.route('/api/prompts/active', methods=['GET'])
@handle_errors
def get_active_prompt():
    active_prompt = handle_command_and_parse(
        "prompt active",
        r"Current active prompt is\s+'([^']+)'",
        result_processor=lambda m: m.group(1) if m.group(1).lower() != 'none' else None,
        default_result=None,
        history_lines=10
    )
    if active_prompt is None:
        no_prompt_match = handle_command_and_parse(
            None,
            r"No active prompt set",
            history_lines=10,
            default_result=None
        )
        if no_prompt_match is not None:
            active_prompt = None
            
    return api_response(True, data={"active_prompt": active_prompt})


@app.route('/api/personas', methods=['GET'])
@handle_errors
def get_personas():
    personas_raw = handle_command_and_parse(
        "persona list",
        r"Available personas:\s*\[?(.*?)\]?\s*$",
        result_processor=lambda m: [p.strip().strip("'") for p in m.group(1).split(",") if p.strip()] if m.group(1) and m.group(1).strip() else [],
        default_result=[]
    )
    personas = personas_raw if isinstance(personas_raw, list) else []
    return api_response(True, data={"personas": personas})

@app.route('/api/personas/<persona_name>', methods=['GET'])
@handle_errors
def get_persona_details(persona_name):
    safe_name = re.sub(r'[^\w-]', '', persona_name)
    if not safe_name:
        return api_response(False, error="Invalid persona name format", status_code=400)
    
    details_pattern = rf"Persona info for '{re.escape(safe_name)}'.*?Name:\s*(.*?)(?:\n|$).*?Description:\s*(.*?)(?:\n|$).*?System Prompt:\s*(.*)"
    details = handle_command_and_parse(
        f"persona info {safe_name}",
        details_pattern,
        result_processor=lambda m: {
            "name": m.group(1).strip(),
            "description": m.group(2).strip(),
            "system_prompt": m.group(3).strip()
        },
        default_result=None,
        history_lines=30
    )
    if details and isinstance(details, dict):
        return api_response(True, data={"details": details})
    return api_response(False, error=f"Persona '{safe_name}' details not found or failed to parse.", status_code=404)


@app.route('/api/personas/active', methods=['GET'])
@handle_errors
def get_active_persona():
    active_persona = handle_command_and_parse(
        None,
        r"Now using\s+'([^']+)'\s+persona",
        history_lines=50,
        default_result=None
    )
    
    if active_persona is None:
        cleared_persona_match = handle_command_and_parse(
            None,
            r"Cleared active persona",
            history_lines=50,
            default_result=None
        )
        if cleared_persona_match is not None:
            active_persona = None
            
    return api_response(True, data={"active_persona": active_persona})

# =======================
# FLASK ROUTES - SAVE/LOAD
# =======================
@app.route('/api/save_prompt', methods=['GET', 'POST'])
@handle_errors
def handle_save_prompt():
    """GET: Get content of save.txt. POST: Update content of save.txt."""
    if request.method == 'GET':
        if not os.path.exists(SAVE_FILE):
            return api_response(True, data={"prompt": ""})
        
        content = safe_read_file(SAVE_FILE, default=FILE_READ_ERROR_SENTINEL)
        
        if content == FILE_READ_ERROR_SENTINEL:
            return api_response(False, error="Could not read save prompt file.", status_code=500)
        elif content == "[Error: File too large]":
            return api_response(False, error="Save prompt file is too large.", status_code=413)
        else:
            return api_response(True, data={"prompt": content})
    
    data = request.json
    prompt_content = data.get("prompt") if isinstance(data, dict) else None
    
    if not isinstance(prompt_content, str):
        return api_response(False, error="Invalid or missing 'prompt' string in JSON body.", status_code=400)
    
    if len(prompt_content.encode('utf-8')) > MAX_FILE_SIZE :
         return api_response(False, error=f"Save prompt content exceeds maximum size of {MAX_FILE_SIZE} bytes.", status_code=413)

    if safe_write_file(SAVE_FILE, prompt_content):
        return api_response(True, data={"message": "Save prompt updated."})
    
    return api_response(False, error="Could not write save prompt file", status_code=500)


@app.route('/api/saved_contexts', methods=['GET'])
@handle_errors
def get_saved_contexts():
    """Get list of saved context files from saved_sessions directory."""
    contexts = []
    os.makedirs(SAVED_SESSIONS_DIR, exist_ok=True) 
    
    try:
        for filename in os.listdir(SAVED_SESSIONS_DIR):
            if filename.endswith('.txt'):
                file_path = os.path.join(SAVED_SESSIONS_DIR, filename)
                try:
                    if os.path.isfile(file_path):
                        mtime = os.path.getmtime(file_path)
                        contexts.append({
                            "id": filename[:-4],
                            "name": filename,
                            "date": datetime.fromtimestamp(mtime).isoformat()
                        })
                except OSError as stat_e:
                    print(f"Error getting info for saved context {filename}: {stat_e}")
        contexts.sort(key=lambda x: x['date'], reverse=True)
    except Exception as e:
        print(f"Error listing saved contexts in {SAVED_SESSIONS_DIR}: {e}")
    return api_response(True, data={"contexts": contexts})


@app.route('/api/saved_contexts/<context_id>/content', methods=['GET'])
@handle_errors
def get_context_content(context_id):
    """Securely retrieve the content of a specific saved context file."""
    safe_id_match = re.fullmatch(r'[\w\-\.]+', context_id)
    if not safe_id_match:
        return api_response(False, error="Invalid context ID format.", status_code=400)
    
    safe_id = safe_id_match.group(0)
    filename = f"{safe_id}.txt"
    
    abs_saved_dir = os.path.abspath(SAVED_SESSIONS_DIR)
    potential_file_path = os.path.join(abs_saved_dir, filename)
    
    if os.path.abspath(potential_file_path) != potential_file_path or not potential_file_path.startswith(abs_saved_dir):
        print(f"Path traversal attempt or invalid path for saved context: {context_id} -> {filename}")
        return api_response(False, error="Invalid context ID (path error).", status_code=400)
    
    if not os.path.isfile(potential_file_path):
        return api_response(False, error="Context file not found.", status_code=404)
    
    try:
        file_size = os.path.getsize(potential_file_path)
    except OSError as size_e:
        print(f"Error getting file size for {potential_file_path}: {size_e}")
        return api_response(False, error=f"Could not get file size: {size_e}", status_code=500)
    
    if file_size > MAX_CONTEXT_SIZE:
        print(f"Context file '{filename}' too large ({file_size} bytes). Max: {MAX_CONTEXT_SIZE}")
        return api_response(False, error=f"File exceeds size limit of {MAX_CONTEXT_SIZE} bytes. Cannot display content.", 
                          data={"filename": filename, "truncated": True},
                          status_code=413)
    
    content = safe_read_file(potential_file_path, default=FILE_READ_ERROR_SENTINEL)
    
    if content == FILE_READ_ERROR_SENTINEL:
        return api_response(False, error="Could not read file content.", status_code=500)
    
    file_type = "unknown"
    if filename.startswith("summary_"):
        file_type = "summary"
    elif filename.startswith("fix_"):
        file_type = "fix"
    elif filename.startswith("custom_"):
        file_type = "custom"
    
    description = {"summary": "AI summary", "fix": "Saved AI response", "custom": "Custom context"}.get(file_type, "User saved context")
    
    return api_response(True, data={
        "content": content,
        "filename": filename,
        "type": file_type,
        "description": description
    })

@app.route('/api/waitlist/join', methods=['POST'])
@handle_errors
def join_waitlist():
    """Add user to waitlist."""
    print("[WAITLIST] Join request received")
    
    data = request.json
    print(f"[WAITLIST] Request data: {data}")
    
    if not data or not all(k in data for k in ['name', 'email', 'type']):
        print("[WAITLIST] Missing required fields")
        return api_response(False, error='Missing required fields', status_code=400)
    
    # Load existing waitlist
    waitlist = safe_load_json(WAITLIST_FILE, [])
    print(f"[WAITLIST] Loaded existing waitlist with {len(waitlist)} entries")
    
    # Check if email already exists
    if any(entry.get('email') == data['email'] for entry in waitlist):
        print(f"[WAITLIST] Email {data['email']} already exists")
        return api_response(False, error='Email already on waitlist', status_code=400)
    
    # #1 & #3: REFINED - More robustly handle the 'type' field
    allowed_types = ['contributor', 'supporter', 'user']
    user_type = data['type'] if data['type'] in allowed_types else 'user' # Default to user if invalid type sent

    # Add new entry
    entry = {
        'name': data['name'][:100],  # Limit length
        'email': data['email'][:200],
        'type': user_type,
        'timestamp': datetime.now().isoformat()
    }
    waitlist.append(entry)
    print(f"[WAITLIST] Adding new entry: {entry}")
    
    # Save
    save_result = safe_save_json(WAITLIST_FILE, waitlist)
    print(f"[WAITLIST] Save result: {save_result}")
    
    if save_result:
        # Verify the file was actually written
        try:
            verify = safe_load_json(WAITLIST_FILE, [])
            print(f"[WAITLIST] Verification: File now contains {len(verify)} entries")
        except Exception as e:
            print(f"[WAITLIST] Verification failed: {e}")
        
        return api_response(True, {'message': 'Successfully joined waitlist', 'count': len(waitlist)})
    
    print("[WAITLIST] Failed to save waitlist")
    return api_response(False, error='Failed to save waitlist', status_code=500)

@app.route('/api/waitlist/count', methods=['GET'])
@handle_errors
def get_waitlist_count():
    """Get waitlist count."""
    waitlist = safe_load_json(WAITLIST_FILE, [])
    if waitlist is None:
        waitlist = []
    return api_response(True, {'count': len(waitlist)})

# =======================
# FLASK MIDDLEWARE
# =======================
@app.after_request
def add_cors_headers(response):
    """Add essential CORS headers to all outgoing responses."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Requested-With, Cache-Control, Authorization, X-Message-Timestamp, X-Message-ID, X-Message-Status'

    required_exposed = ['X-Message-Timestamp', 'X-Message-ID', 'X-Message-Status']
    current_exposed_str = response.headers.get('Access-Control-Expose-Headers', '')
    
    if not isinstance(current_exposed_str, str):
        current_exposed_str = str(current_exposed_str)
        
    current_exposed_set = set(h.strip().lower() for h in current_exposed_str.split(',') if h.strip())
    
    final_exposed_list = list(current_exposed_set)
    for h_req in required_exposed:
        if h_req.lower() not in current_exposed_set:
            final_exposed_list.append(h_req)
            
    if final_exposed_list:
        response.headers['Access-Control-Expose-Headers'] = ', '.join(sorted(list(set(final_exposed_list))))
    
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

# =======================
# INITIALIZATION AND STARTUP
# =======================
def perform_initial_setup():
    """Performs application setup: file init, command loading, subprocess start."""
    print("[SYSTEM] === Performing Initial Setup ===")
    try:
        print("[SYSTEM] Ensuring clean history state on startup...")
        try:
            auth._handle_logout_history_save()
            print("[SYSTEM] Cleared/Saved any previous user history state to default.")
        except Exception as e:
            print(f"[SYSTEM] Warning: Could not clear/save previous history state: {e}")
        
        initialize_files()
        print("[SYSTEM] Loading commands...")
        command_system.load_commands()
    except SystemExit as e:
        print(f"[SYSTEM] CRITICAL FAILURE during file initialization: {e}")
        sys.exit(1)
    except Exception as e:
        import traceback
        print(f"--- Error during initial file/command setup ---")
        traceback.print_exc()
        print(f"--- End Initial Setup Error ---")
        print("[SYSTEM] Warning: Failed initial setup. Proceeding with potentially limited functionality.")

    global action_process
    print("[SYSTEM] Starting action system subprocess...")
    action_process = start_action_system()
    if action_process is None:
        print("[SYSTEM] CRITICAL FAILURE: Action system subprocess failed to start. Check logs above. Exiting.")
        sys.exit(1)

    print("[SYSTEM] Action system process likely started. Giving it time to initialize...")
    time.sleep(6)
    if action_process.poll() is not None:
        print(f"[SYSTEM] CRITICAL FAILURE: Action system died immediately after start (Code: {action_process.poll()}). "
              f"Check {ACTION_OUTPUT_LOG}. Exiting.")
        sys.exit(1)

    print("[SYSTEM] Sending essential startup commands (start key, start web_input)...")
    essential_actions_started_successfully = True
    for cmd in ["start key", "start web_input"]:
        if not send_command(cmd, wait_time=DEFAULT_WAIT_TIME):
            print(f"[SYSTEM] Warning: Failed to send essential startup command '{cmd}'")
            essential_actions_started_successfully = False
        else:
            print(f"[SYSTEM] Sent '{cmd}' successfully.")
        time.sleep(1)
    
    time.sleep(3)
    if action_process.poll() is not None:
        print(f"[SYSTEM] CRITICAL FAILURE: Action system died during essential action startup "
              f"(Code: {action_process.poll()}). Check {ACTION_OUTPUT_LOG}. Exiting.")
        sys.exit(1)
    elif not essential_actions_started_successfully:
        print("[SYSTEM] Warning: Not all essential startup commands were confirmed sent. "
              "Backend might be partially initialized or unresponsive to these actions.")
    print("[SYSTEM] === Initial Setup Complete ===")

# =======================
# MAIN EXECUTION
# =======================
atexit.register(cleanup_action_system)
perform_initial_setup()

if __name__ == '__main__':
    print("[SYSTEM] === Starting Flask Server ===")
    server_host = '0.0.0.0'
    server_port = 5000
    print(f"[SYSTEM] Serving on http://{server_host}:{server_port}")
    print("[SYSTEM] Use Ctrl+C to stop.")
    try:
        from waitress import serve
        print("[SYSTEM] Using Waitress production server.")
        serve(app, host=server_host, port=server_port, threads=8)
    except ImportError:
        print("[SYSTEM] Waitress not found. Using Flask development server (NOT RECOMMENDED for production).")
        app.run(host=server_host, port=server_port, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n[SYSTEM] Ctrl+C detected. Shutting down Flask server...")
    except SystemExit:
        print("\n[SYSTEM] SystemExit called. Shutting down...")
    except Exception as e:
        print(f"\n[SYSTEM] Flask server encountered an unhandled exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        print("[SYSTEM] === Flask Server Stopped ===")