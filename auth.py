# auth.py - Authentication and Authorization Module for Web Input
import os
import json
import hashlib
import secrets
import time
import re  # Added for username sanitization
import shutil  # Added for file copying
from datetime import datetime, timedelta

ACTION_NAME = "auth"
ACTION_PRIORITY = 3  # Higher priority than web_input to intercept first

# Configuration files
AUTH_CONFIG_FILE = "auth_config.json"
AUTH_USERS_FILE = "auth_users.json"
AUTH_LOG_FILE = "auth_attempts.log"
AUTH_TOKENS_FILE = "auth_tokens.json"

# Default configuration
DEFAULT_CONFIG = {
    "enabled": True,
    "allow_anonymous": False,
    "require_token": True,
    "token_expiry_hours": 24,
    "max_failed_attempts": 5,
    "lockout_duration_minutes": 30,
    "log_unauthorized_attempts": True,
    "default_user_role": "user",
    "admin_can_bypass": True
}

# In-memory state
_auth_state = {
    "config": DEFAULT_CONFIG.copy(),
    "users": {},
    "tokens": {},
    "failed_attempts": {},
    "is_active": False
}

# NEW: Track the currently active history user
_current_active_history_user_tracker = None

# NEW: Directory for storing user histories
USER_HISTORIES_DIR = "user_histories"

def _hash_password(password):
    """Hash a password using SHA256."""
    return hashlib.sha256(password.encode()).hexdigest()

def _generate_token():
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)

def _load_config():
    """Load authentication configuration."""
    global _auth_state
    
    # Load main config
    if os.path.exists(AUTH_CONFIG_FILE):
        try:
            with open(AUTH_CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded_config = json.load(f)
                _auth_state["config"].update(loaded_config)
                print(f"[{ACTION_NAME.upper()}]: Loaded configuration from {AUTH_CONFIG_FILE}")
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}]: Error loading config: {e}")
    
    # Load users
    if os.path.exists(AUTH_USERS_FILE):
        try:
            with open(AUTH_USERS_FILE, "r", encoding="utf-8") as f:
                loaded_users = json.load(f)
                # Only update if the loaded data is a valid dict
                if isinstance(loaded_users, dict):
                    _auth_state["users"] = loaded_users
                    print(f"[{ACTION_NAME.upper()}]: Loaded {len(_auth_state['users'])} users")
                else:
                    print(f"[{ACTION_NAME.upper()}]: Invalid users file format, keeping empty")
                    _auth_state["users"] = {}
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}]: Error loading users: {e}")
            _auth_state["users"] = {}
    
    # Load active tokens
    if os.path.exists(AUTH_TOKENS_FILE):
        try:
            with open(AUTH_TOKENS_FILE, "r", encoding="utf-8") as f:
                _auth_state["tokens"] = json.load(f)
                # Clean expired tokens
                _clean_expired_tokens()
                print(f"[{ACTION_NAME.upper()}]: Loaded {len(_auth_state['tokens'])} active tokens")
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}]: Error loading tokens: {e}")

def _save_config():
    """Save configuration to file."""
    try:
        with open(AUTH_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_auth_state["config"], f, indent=2)
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Error saving config: {e}")
        return False

def _save_users():
    """Save users to file."""
    try:
        with open(AUTH_USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(_auth_state["users"], f, indent=2)
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Error saving users: {e}")
        return False

def _save_tokens():
    """Save active tokens to file."""
    try:
        with open(AUTH_TOKENS_FILE, "w", encoding="utf-8") as f:
            json.dump(_auth_state["tokens"], f, indent=2)
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Error saving tokens: {e}")
        return False

def _log_attempt(username, ip_address, success, reason=""):
    """Log authentication attempt."""
    timestamp = datetime.now().isoformat()
    log_entry = f"{timestamp} | {'SUCCESS' if success else 'FAILED'} | User: {username} | IP: {ip_address}"
    if reason:
        log_entry += f" | Reason: {reason}"
    
    try:
        with open(AUTH_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Error logging attempt: {e}")

def _clean_expired_tokens():
    """Remove expired tokens."""
    current_time = time.time()
    expired = []
    
    for token, data in _auth_state["tokens"].items():
        if data.get("expires", 0) < current_time:
            expired.append(token)
    
    for token in expired:
        del _auth_state["tokens"][token]
    
    if expired:
        _save_tokens()
        print(f"[{ACTION_NAME.upper()}]: Cleaned {len(expired)} expired tokens")

def _is_user_locked(username):
    """Check if user is locked out due to failed attempts."""
    if username not in _auth_state["failed_attempts"]:
        return False
    
    attempts_data = _auth_state["failed_attempts"][username]
    lockout_until = attempts_data.get("lockout_until", 0)
    
    if lockout_until > time.time():
        return True
    
    # Lockout expired, reset attempts
    del _auth_state["failed_attempts"][username]
    return False

def _record_failed_attempt(username):
    """Record a failed authentication attempt."""
    max_attempts = _auth_state["config"]["max_failed_attempts"]
    lockout_minutes = _auth_state["config"]["lockout_duration_minutes"]
    
    if username not in _auth_state["failed_attempts"]:
        _auth_state["failed_attempts"][username] = {
            "count": 0,
            "last_attempt": 0,
            "lockout_until": 0
        }
    
    attempts_data = _auth_state["failed_attempts"][username]
    attempts_data["count"] += 1
    attempts_data["last_attempt"] = time.time()
    
    if attempts_data["count"] >= max_attempts:
        attempts_data["lockout_until"] = time.time() + (lockout_minutes * 60)
        print(f"[{ACTION_NAME.upper()}]: User '{username}' locked out for {lockout_minutes} minutes")

# NEW: Helper function to sanitize usernames for safe file operations
def _sanitize_username_for_filename(username):
    """Sanitize username to be safe for use in filenames."""
    # Remove any characters that could cause path traversal or file system issues
    # Only allow alphanumeric, dots, hyphens, and underscores
    sanitized = re.sub(r'[^\w.-]', '', username)
    if not sanitized:
        # If sanitization results in empty string, use a default
        sanitized = "unknown_user"
    return sanitized

# NEW: Ensure user histories directory exists
def _ensure_histories_dir():
    """Ensure the user histories directory exists."""
    try:
        os.makedirs(USER_HISTORIES_DIR, exist_ok=True)
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Error creating histories directory: {e}")
        return False

# NEW: Swap history files when user logs in
def _swap_history_files(new_username):
    """Swap conversation history files when a new user logs in."""
    global _current_active_history_user_tracker
    
    # Ensure histories directory exists
    if not _ensure_histories_dir():
        print(f"[{ACTION_NAME.upper()}]: Failed to ensure histories directory exists")
        return False
    
    try:
        # Step 1: Save current history if there's an active user
        if _current_active_history_user_tracker and os.path.exists("conversation_history.json"):
            sanitized_current_user = _sanitize_username_for_filename(_current_active_history_user_tracker)
            # Save with timestamp instead of overwriting
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            user_history_path = os.path.join(USER_HISTORIES_DIR, f"history_{sanitized_current_user}_{timestamp}.log")
            
            try:
                # Copy instead of rename to preserve the file
                shutil.copy2("conversation_history.json", user_history_path)
                print(f"[{ACTION_NAME.upper()}]: Saved history for user '{_current_active_history_user_tracker}' to {user_history_path}")
            except Exception as e:
                print(f"[{ACTION_NAME.upper()}]: Error saving current user history: {e}")
                # Don't fail the whole operation if save fails
        
        # Step 2: Load new user's most recent history
        sanitized_new_user = _sanitize_username_for_filename(new_username)
        
        # Find the most recent history file for this user
        user_history_files = []
        try:
            for file in os.listdir(USER_HISTORIES_DIR):
                if file.startswith(f"history_{sanitized_new_user}_") and file.endswith(".log"):
                    user_history_files.append(file)
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}]: Error listing history files: {e}")
        
        if user_history_files:
            # Sort by filename (which includes timestamp) and get the most recent
            user_history_files.sort(reverse=True)
            most_recent_file = user_history_files[0]
            most_recent_path = os.path.join(USER_HISTORIES_DIR, most_recent_file)
            
            try:
                # Copy the most recent history to conversation_history.json
                shutil.copy2(most_recent_path, "conversation_history.json")
                print(f"[{ACTION_NAME.upper()}]: Loaded most recent history for user '{new_username}' from {most_recent_file}")
            except Exception as e:
                print(f"[{ACTION_NAME.upper()}]: Error loading user history: {e}")
                # Create new empty history file
                with open("conversation_history.json", "w", encoding="utf-8") as f:
                    f.write("[]\n")
                print(f"[{ACTION_NAME.upper()}]: Created new empty history for user '{new_username}'")
        else:
            # No existing history for this user, create new
            with open("conversation_history.json", "w", encoding="utf-8") as f:
                f.write("[]\n")
            print(f"[{ACTION_NAME.upper()}]: Created new history file for user '{new_username}'")
        
        # Step 3: Update tracker
        _current_active_history_user_tracker = new_username
        print(f"[{ACTION_NAME.upper()}]: Set active history user to '{new_username}'")
        return True
        
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Unexpected error in history swap: {e}")
        return False

# NEW: Handle logout history save
def _handle_logout_history_save():
    """Save current history when user logs out."""
    global _current_active_history_user_tracker
    
    # Ensure histories directory exists
    if not _ensure_histories_dir():
        print(f"[{ACTION_NAME.upper()}]: Failed to ensure histories directory exists")
        return False
    
    try:
        # Save current history if there's an active user
        if _current_active_history_user_tracker and os.path.exists("conversation_history.json"):
            sanitized_user = _sanitize_username_for_filename(_current_active_history_user_tracker)
            # Save with timestamp instead of overwriting
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            user_history_path = os.path.join(USER_HISTORIES_DIR, f"history_{sanitized_user}_{timestamp}.log")
            
            try:
                # Copy instead of rename to preserve the file
                shutil.copy2("conversation_history.json", user_history_path)
                print(f"[{ACTION_NAME.upper()}]: Saved history for logging out user '{_current_active_history_user_tracker}' to {user_history_path}")
            except Exception as e:
                print(f"[{ACTION_NAME.upper()}]: Error saving logout history: {e}")
        
        # Re-initialize conversation_history.json to empty state
        with open("conversation_history.json", "w", encoding="utf-8") as f:
            f.write("[]\n")
        print(f"[{ACTION_NAME.upper()}]: Reset conversation_history.json to empty state")
        
        # Clear the tracker
        _current_active_history_user_tracker = None
        print(f"[{ACTION_NAME.upper()}]: Cleared active history user tracker")
        return True
        
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}]: Unexpected error in logout history save: {e}")
        return False

def authenticate_user(username, password):
    """Authenticate a user with username and password."""
    if not username or not password:
        return False, "Missing credentials"
    
    if _is_user_locked(username):
        return False, "Account locked due to failed attempts"
    
    if username not in _auth_state["users"]:
        _record_failed_attempt(username)
        return False, "Invalid credentials"
    
    user_data = _auth_state["users"][username]
    password_hash = _hash_password(password)
    
    # Debug output to help diagnose the issue
    print(f"[{ACTION_NAME.upper()} DEBUG]: Authenticating user '{username}'")
    print(f"[{ACTION_NAME.upper()} DEBUG]: Provided password hash: {password_hash[:16]}...")
    print(f"[{ACTION_NAME.upper()} DEBUG]: Stored password hash: {user_data.get('password_hash', 'NONE')[:16]}...")
    
    if user_data.get("password_hash") != password_hash:
        _record_failed_attempt(username)
        return False, "Invalid credentials"
    
    if not user_data.get("active", True):
        return False, "Account disabled"
    
    # Reset failed attempts on successful login
    if username in _auth_state["failed_attempts"]:
        del _auth_state["failed_attempts"][username]
    
    return True, "Authentication successful"

def create_token(username):
    """Create an authentication token for a user."""
    token = _generate_token()
    expiry_hours = _auth_state["config"]["token_expiry_hours"]
    
    _auth_state["tokens"][token] = {
        "username": username,
        "created": time.time(),
        "expires": time.time() + (expiry_hours * 3600),
        "role": _auth_state["users"][username].get("role", "user")
    }
    
    _save_tokens()
    return token

def validate_token(token):
    """Validate an authentication token."""
    if not token:
        return False, None, "No token provided"
    
    _clean_expired_tokens()
    
    if token not in _auth_state["tokens"]:
        return False, None, "Invalid token"
    
    token_data = _auth_state["tokens"][token]
    username = token_data["username"]
    
    # Check if user still exists and is active
    if username not in _auth_state["users"]:
        del _auth_state["tokens"][token]
        _save_tokens()
        return False, None, "User no longer exists"
    
    if not _auth_state["users"][username].get("active", True):
        del _auth_state["tokens"][token]
        _save_tokens()
        return False, None, "User account disabled"
    
    return True, username, "Token valid"

def create_user(username, password, role="user", created_by="system"):
    """Create a new user."""
    if not username or not password:
        return False, "Username and password required"
    
    if username in _auth_state["users"]:
        return False, "User already exists"
    
    _auth_state["users"][username] = {
        "password_hash": _hash_password(password),
        "role": role,
        "active": True,
        "created": datetime.now().isoformat(),
        "created_by": created_by,
        "last_login": None
    }
    
    _save_users()
    print(f"[{ACTION_NAME.upper()}]: Created user '{username}' with role '{role}'")
    return True, f"User '{username}' created successfully"

def is_request_authorized(auth_header=None, ip_address="unknown"):
    """Check if a request is authorized."""
    if not _auth_state["config"]["enabled"]:
        return True, "anonymous", "Authentication disabled"
    
    if _auth_state["config"]["allow_anonymous"]:
        return True, "anonymous", "Anonymous access allowed"
    
    if not _auth_state["config"]["require_token"]:
        return True, "anonymous", "Token not required"
    
    if not auth_header:
        return False, None, "No authorization header"
    
    # Extract token from "Bearer <token>" format
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False, None, "Invalid authorization header format"
    
    token = parts[1]
    valid, username, reason = validate_token(token)
    
    if valid:
        # Update last login time
        if username in _auth_state["users"]:
            _auth_state["users"][username]["last_login"] = datetime.now().isoformat()
            _save_users()
    
    return valid, username, reason

async def start_action(system_functions=None):
    """Start the authentication action."""
    global _auth_state
    _auth_state["is_active"] = True
    
    _load_config()
    
    # FIXED: Create default admin user if no users exist OR if users dict is empty
    if not _auth_state["users"] or len(_auth_state["users"]) == 0:
        print(f"[{ACTION_NAME.upper()}]: No users found, creating default admin user")
        success, msg = create_user("admin", "changeme", "admin", "system")
        if success:
            print(f"[{ACTION_NAME.upper()}]: {msg} - PLEASE CHANGE DEFAULT PASSWORD!")
        else:
            print(f"[{ACTION_NAME.upper()}]: ERROR creating default admin user: {msg}")
    else:
        print(f"[{ACTION_NAME.upper()}]: Found {len(_auth_state['users'])} existing users")
    
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Authentication system ACTIVE]")
    print(f"[{ACTION_NAME.upper()}]: Config: require_token={_auth_state['config']['require_token']}, " +
          f"allow_anonymous={_auth_state['config']['allow_anonymous']}")

async def stop_action(system_functions=None):
    """Stop the authentication action."""
    global _auth_state
    _auth_state["is_active"] = False
    
    # Save current state
    _save_config()
    _save_users()
    _save_tokens()
    
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Authentication system INACTIVE]")

async def process_input(user_input, system_functions=None):
    """Process authentication commands."""
    if not user_input:
        return None
    
    input_lower = user_input.lower().strip()
    
    # Handle auth commands
    if input_lower.startswith("auth "):
        parts = user_input.split(None, 4)
        if len(parts) < 2:
            return "[AUTH: Invalid command format]"
        
        command = parts[1].lower()
        
        if command == "status":
            total_users = len(_auth_state["users"])
            active_tokens = len(_auth_state["tokens"])
            config = _auth_state["config"]
            
            return (f"[AUTH STATUS]\n" +
                   f"  Enabled: {config['enabled']}\n" +
                   f"  Require Token: {config['require_token']}\n" +
                   f"  Allow Anonymous: {config['allow_anonymous']}\n" +
                   f"  Total Users: {total_users}\n" +
                   f"  Active Tokens: {active_tokens}\n" +
                   f"  Failed Attempts: {len(_auth_state['failed_attempts'])}")
        
        elif command == "users":
            if not _auth_state["users"]:
                return "[AUTH: No users registered]"
            
            user_list = []
            for username, data in _auth_state["users"].items():
                status = "active" if data.get("active", True) else "disabled"
                role = data.get("role", "user")
                last_login = data.get("last_login", "never")
                user_list.append(f"  - {username} ({role}, {status}, last: {last_login})")
            
            return "[AUTH USERS]\n" + "\n".join(user_list)
        
        elif command == "create" and len(parts) >= 4:
            username = parts[2]
            password = parts[3]
            role = parts[4] if len(parts) > 4 else "user"
            
            success, msg = create_user(username, password, role, "command")
            return f"[AUTH: {msg}]"
        
        elif command == "disable" and len(parts) >= 3:
            username = parts[2]
            if username in _auth_state["users"]:
                _auth_state["users"][username]["active"] = False
                _save_users()
                return f"[AUTH: User '{username}' disabled]"
            return f"[AUTH: User '{username}' not found]"
        
        elif command == "enable" and len(parts) >= 3:
            username = parts[2]
            if username in _auth_state["users"]:
                _auth_state["users"][username]["active"] = True
                _save_users()
                return f"[AUTH: User '{username}' enabled]"
            return f"[AUTH: User '{username}' not found]"
        
        elif command == "reset" and len(parts) >= 4:
            username = parts[2]
            new_password = parts[3]
            if username in _auth_state["users"]:
                _auth_state["users"][username]["password_hash"] = _hash_password(new_password)
                _save_users()
                return f"[AUTH: Password reset for user '{username}']"
            return f"[AUTH: User '{username}' not found]"
        
        elif command == "debug":
            # Debug command to check current state
            return (f"[AUTH DEBUG]\n" +
                   f"  Users dict empty: {len(_auth_state['users']) == 0}\n" +
                   f"  Users: {list(_auth_state['users'].keys())}\n" +
                   f"  Auth files exist: {os.path.exists(AUTH_USERS_FILE)}")
        
        else:
            return "[AUTH: Unknown command. Use: status, users, create, disable, enable, reset, debug]"
    
    return None

# Export useful functions for other modules
def get_auth_state():
    """Get current authentication state."""
    return _auth_state.copy()

def is_auth_enabled():
    """Check if authentication is enabled."""
    return _auth_state["config"]["enabled"] and _auth_state["is_active"]