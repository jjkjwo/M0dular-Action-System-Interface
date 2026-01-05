# jjk.py - JJK Security Control System (Progenitor Authentication & System Override)
# High-privilege security addon for deep system control and authentication
# Priority 0.5 - Runs after core (0) but before everything else for maximum control

import os
import json
import time
import hashlib
import secrets
from datetime import datetime, timedelta
from collections import defaultdict

ACTION_NAME = "jjk"
ACTION_PRIORITY = 0.5  # Very high priority - right after core

# Constants
PASSWORD_HASH = hashlib.sha256("jjk".encode()).hexdigest()  # Hardcoded password "jjk"
PROGENITOR_TIMEOUT = 300  # 5 minutes default timeout for progenitor status
AUDIT_LOG_FILE = "jjk_audit.log"
CONFIG_FILE = "jjk_config.json"
BACKUP_DIR = "jjk_backups"
RULES_FILE = "jjk_rules.json"

# State variables
_is_active = False
_is_authenticated = False
_progenitor_status = False
_progenitor_granted_time = None
_auth_attempts = defaultdict(int)
_lockout_until = {}
_session_token = None
_audit_enabled = True
_command_history = []
_override_flags = {}
_whitelisted_operations = set()
_security_rules = {}

# Configuration
_config = {
    "progenitor_timeout_seconds": PROGENITOR_TIMEOUT,
    "max_auth_attempts": 3,
    "lockout_duration_minutes": 30,
    "audit_enabled": True,
    "require_sms_verification": False,  # Future: integrate with sms.py
    "api_limit_bypass_enabled": False,
    "file_edit_permissions": False,
    "principle_modification_allowed": False,
    "system_override_enabled": False,
    "backup_on_critical_operations": True,
    "whitelist_mode": False,
    "approved_commands": [],
    "approved_files": [],
    "security_level": "MAXIMUM"  # MINIMUM, STANDARD, MAXIMUM, PARANOID
}

# Security Rules Loading
def load_rules():
    """Loads security rules from the rules file."""
    global _security_rules
    try:
        if os.path.exists(RULES_FILE):
            with open(RULES_FILE, "r", encoding="utf-8") as f:
                _security_rules = json.load(f)
        else:
            # Create a default rules file if it doesn't exist
            _security_rules = {"progenitor_only_operations": {}}
            with open(RULES_FILE, "w", encoding="utf-8") as f:
                json.dump(_security_rules, f, indent=2)
            print(f"[{ACTION_NAME.upper()}: Created default security rules file at {RULES_FILE}]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: CRITICAL - Failed to load security rules: {e}]")
        _security_rules = {"progenitor_only_operations": {}}

# Master Security Check Function
def progenitor_check(operation_name, source="unknown"):
    """
    Master security check. Verifies if an operation requires progenitor status per the rules file
    and if that status is currently active. Returns True if allowed, False otherwise.
    This function handles its own auditing.
    """
    # Rule check: Does the rules file say this operation is protected?
    requires_progenitor = _security_rules.get("progenitor_only_operations", {}).get(operation_name, False)
    
    if not requires_progenitor:
        # If the operation is not listed or is set to false, it is not protected. Allow it.
        return True

    # Status check: The operation IS protected, so now we check if the user has the required status.
    if is_progenitor_active():
        # Allowed. Log the successful authorization.
        audit_log("progenitor_check_passed", {"operation": operation_name, "source": source}, "INFO")
        return True
    else:
        # Denied. The operation requires progenitor status, but it's not active.
        audit_log("progenitor_check_denied", {"operation": operation_name, "source": source}, "CRITICAL")
        return False

# Audit trail
def audit_log(event_type, details, severity="INFO"):
    """Log security events for audit trail"""
    if not _audit_enabled:
        return
    
    timestamp = datetime.now().isoformat()
    log_entry = {
        "timestamp": timestamp,
        "event_type": event_type,
        "severity": severity,
        "progenitor_active": _progenitor_status,
        "details": details
    }
    
    try:
        # Ensure backup directory exists
        os.makedirs(BACKUP_DIR, exist_ok=True)
        
        # Write to audit log
        with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
        
        # Also keep in memory for recent access
        _command_history.append(log_entry)
        if len(_command_history) > 100:
            _command_history.pop(0)
            
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: CRITICAL - Failed to write audit log: {e}]")

def save_config():
    """Save configuration"""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(_config, f, indent=2)
        audit_log("config_saved", {"config": _config})
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving config: {e}]")

def load_config():
    """Load configuration"""
    global _config
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                _config.update(loaded)
            audit_log("config_loaded", {"config": _config})
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error loading config: {e}]")

def create_backup(backup_type, data):
    """Create backup of critical data"""
    if not _config.get("backup_on_critical_operations", True):
        return
    
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{backup_type}_{timestamp}.json"
        filepath = os.path.join(BACKUP_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "type": backup_type,
                "data": data,
                "progenitor": _progenitor_status
            }, f, indent=2)
        
        audit_log("backup_created", {"file": filename, "type": backup_type})
        return filepath
    except Exception as e:
        audit_log("backup_failed", {"error": str(e)}, "ERROR")
        return None

def check_progenitor_timeout():
    """Check if progenitor status has timed out"""
    global _progenitor_status, _progenitor_granted_time
    
    if not _progenitor_status or not _progenitor_granted_time:
        return
    
    timeout_seconds = _config.get("progenitor_timeout_seconds", PROGENITOR_TIMEOUT)
    if time.time() - _progenitor_granted_time > timeout_seconds:
        _progenitor_status = False
        _progenitor_granted_time = None
        audit_log("progenitor_timeout", {"duration": timeout_seconds}, "WARNING")
        print(f"[{ACTION_NAME.upper()}: Progenitor status timed out after {timeout_seconds} seconds]")

def verify_progenitor_status():
    """Verify current progenitor status"""
    check_progenitor_timeout()
    return _progenitor_status

# Placeholder for future SMS verification
async def verify_sms_2fa(phone_number=None):
    """Future: Integrate with sms.py for 2FA verification"""
    # TODO: Import sms module and send verification code
    # For now, return True if not required
    if not _config.get("require_sms_verification", False):
        return True
    
    # Placeholder for SMS integration
    audit_log("sms_verification_attempted", {"status": "not_implemented"}, "WARNING")
    return False

# API limit bypass capability (placeholder)
def bypass_api_limits():
    """Future: Allow progenitor to bypass API rate limits"""
    if not verify_progenitor_status():
        return False
    
    if not _config.get("api_limit_bypass_enabled", False):
        return False
    
    # TODO: Integrate with api_manager to temporarily increase limits
    audit_log("api_limit_bypass_requested", {"status": "placeholder"}, "INFO")
    return True

# File edit permissions (placeholder)
def check_file_edit_permission(filepath):
    """Check if file editing is allowed"""
    if not verify_progenitor_status():
        return False, "Progenitor status required"
    
    if not _config.get("file_edit_permissions", False):
        return False, "File editing disabled in config"
    
    if _config.get("whitelist_mode", False):
        if filepath not in _config.get("approved_files", []):
            return False, "File not in whitelist"
    
    audit_log("file_edit_check", {"file": filepath, "allowed": True})
    return True, "Permission granted"

# System override capabilities
def set_override_flag(flag_name, value):
    """Set system override flags for future use"""
    if not verify_progenitor_status():
        return False
    
    _override_flags[flag_name] = value
    audit_log("override_flag_set", {"flag": flag_name, "value": value}, "WARNING")
    return True

async def start_action(system_functions=None):
    """Initialize JJK security system - requires password"""
    global _is_active, _progenitor_status, _progenitor_granted_time
    
    # Don't allow start without authentication
    if not _is_authenticated:
        print(f"[{ACTION_NAME.upper()}: DENIED - Authentication required. Use 'jjk auth <password>' first]")
        audit_log("start_denied", {"reason": "not_authenticated"}, "WARNING")
        return
    
    _is_active = True
    
    # If authenticated, ensure progenitor status is active
    if _is_authenticated and not _progenitor_status:
        _progenitor_status = True
        _progenitor_granted_time = time.time()
    
    load_config()
    
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Security Control System Active]")
    print(f"[{ACTION_NAME.upper()}: Security Level: {_config['security_level']}]")
    print(f"[{ACTION_NAME.upper()}: Audit: {'ON' if _config['audit_enabled'] else 'OFF'}]")
    print(f"[{ACTION_NAME.upper()}: PROGENITOR STATUS ACTIVE]")
    
    audit_log("system_started", {
        "security_level": _config['security_level'],
        "config": _config
    }, "INFO")
    
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()}: JJK Security System initialized with PROGENITOR STATUS. Use 'jjk status' for info.]"
        )

async def stop_action(system_functions=None):
    """Stop JJK security system"""
    global _is_active, _progenitor_status, _is_authenticated, _progenitor_granted_time
    
    # Save state before stopping
    save_config()
    
    # When stopping, maintain authentication and progenitor if authenticated
    if _is_authenticated:
        audit_log("system_stopped", {"progenitor_maintained": True}, "INFO")
        print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Security monitoring disabled, authentication maintained]")
    else:
        # Only revoke if not authenticated
        if _progenitor_status:
            audit_log("progenitor_revoked", {"reason": "system_stop"}, "WARNING")
        _progenitor_status = False
        _progenitor_granted_time = None
        audit_log("system_stopped", {}, "INFO")
        print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Security Control System Disabled]")
    
    _is_active = False

async def process_input(user_input, system_functions=None):
    """Process security commands and monitor system activity"""
    global _is_active, _is_authenticated, _progenitor_status, _progenitor_granted_time
    
    input_lower = user_input.lower().strip()
    
    # Check progenitor timeout on every input
    if _is_active:
        check_progenitor_timeout()
    
    # Handle authentication first (can be done even when not active)
    if input_lower.startswith("jjk auth "):
        password = user_input[9:].strip()  # Preserve case for password
        user_ip = "console"  # In future, get from system_functions
        
        # Check lockout
        if user_ip in _lockout_until and time.time() < _lockout_until[user_ip]:
            remaining = int(_lockout_until[user_ip] - time.time())
            audit_log("auth_denied_lockout", {"ip": user_ip, "remaining": remaining}, "WARNING")
            return f"[{ACTION_NAME.upper()}: Account locked. Try again in {remaining} seconds]"
        
        # Verify password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if password_hash == PASSWORD_HASH:
            _is_authenticated = True
            _session_token = secrets.token_urlsafe(32)
            _auth_attempts[user_ip] = 0
            
            # Authentication with correct password grants FULL PROGENITOR STATUS
            _progenitor_status = True
            _progenitor_granted_time = time.time()
            
            audit_log("auth_success", {"ip": user_ip}, "INFO")
            audit_log("progenitor_granted", {
                "timeout": _config.get("progenitor_timeout_seconds", PROGENITOR_TIMEOUT),
                "reason": "authentication"
            }, "CRITICAL")
            return f"[{ACTION_NAME.upper()}: Authentication successful with PROGENITOR STATUS. Use 'start jjk' to activate security monitoring.]"
        else:
            _auth_attempts[user_ip] += 1
            if _auth_attempts[user_ip] >= _config.get("max_auth_attempts", 3):
                lockout_minutes = _config.get("lockout_duration_minutes", 30)
                _lockout_until[user_ip] = time.time() + (lockout_minutes * 60)
                audit_log("auth_lockout", {"ip": user_ip, "attempts": _auth_attempts[user_ip]}, "CRITICAL")
                return f"[{ACTION_NAME.upper()}: Too many failed attempts. Locked for {lockout_minutes} minutes]"
            
            audit_log("auth_failed", {"ip": user_ip, "attempts": _auth_attempts[user_ip]}, "WARNING")
            return f"[{ACTION_NAME.upper()}: Authentication failed. {3 - _auth_attempts[user_ip]} attempts remaining]"
    
    # All other commands require active system
    if not _is_active:
        return user_input
    
    # JJK Commands
    if input_lower == "jjk status":
        status_lines = [
            f"[{ACTION_NAME.upper()} STATUS]",
            f"System: {'ACTIVE' if _is_active else 'INACTIVE'}",
            f"Authenticated: {'YES' if _is_authenticated else 'NO'}",
            f"Progenitor Status: {'ACTIVE' if verify_progenitor_status() else 'INACTIVE'}",
            f"Security Level: {_config['security_level']}",
            f"Audit Logging: {'ON' if _audit_enabled else 'OFF'}",
            f"Recent Commands: {len(_command_history)}",
            f"Override Flags: {len(_override_flags)}"
        ]
        
        if _progenitor_status and _progenitor_granted_time:
            elapsed = int(time.time() - _progenitor_granted_time)
            remaining = _config.get("progenitor_timeout_seconds", PROGENITOR_TIMEOUT) - elapsed
            status_lines.append(f"Progenitor Time Remaining: {remaining}s")
        
        audit_log("status_check", {}, "INFO")
        return "\n".join(status_lines)
    
    elif input_lower == "jjk progenitor":
        if not _is_authenticated:
            return f"[{ACTION_NAME.upper()}: Authentication required]"
        
        # Authentication already grants progenitor status
        if _progenitor_status:
            elapsed = int(time.time() - _progenitor_granted_time) if _progenitor_granted_time else 0
            remaining = _config.get("progenitor_timeout_seconds", PROGENITOR_TIMEOUT) - elapsed
            return f"[{ACTION_NAME.upper()}: PROGENITOR STATUS ALREADY ACTIVE - {remaining}s remaining]"
        
        # If somehow lost, re-grant it
        _progenitor_status = True
        _progenitor_granted_time = time.time()
        
        audit_log("progenitor_granted", {
            "timeout": _config.get("progenitor_timeout_seconds", PROGENITOR_TIMEOUT)
        }, "CRITICAL")
        
        return f"[{ACTION_NAME.upper()}: PROGENITOR STATUS RESTORED - Timeout in {_config.get('progenitor_timeout_seconds', PROGENITOR_TIMEOUT)} seconds]"
    
    elif input_lower == "jjk is_progenitor":
        is_prog = verify_progenitor_status()
        audit_log("progenitor_check", {"status": is_prog}, "INFO")
        return f"[{ACTION_NAME.upper()}: Progenitor status is {'ACTIVE' if is_prog else 'INACTIVE'}]"
    
    elif input_lower == "jjk revoke":
        if _progenitor_status:
            _progenitor_status = False
            _progenitor_granted_time = None
            audit_log("progenitor_revoked", {"reason": "manual"}, "WARNING")
            return f"[{ACTION_NAME.upper()}: Progenitor status REVOKED]"
        return f"[{ACTION_NAME.upper()}: No active progenitor status]"
    
    elif input_lower == "jjk audit on":
        _config["audit_enabled"] = True
        _audit_enabled = True
        save_config()
        return f"[{ACTION_NAME.upper()}: Audit logging ENABLED]"
    
    elif input_lower == "jjk audit off":
        if verify_progenitor_status():
            _config["audit_enabled"] = False
            _audit_enabled = False
            save_config()
            audit_log("audit_disabled", {}, "CRITICAL")
            return f"[{ACTION_NAME.upper()}: Audit logging DISABLED (Progenitor override)]"
        return f"[{ACTION_NAME.upper()}: Progenitor status required to disable audit]"
    
    elif input_lower == "jjk audit show":
        if len(_command_history) == 0:
            return f"[{ACTION_NAME.upper()}: No recent audit entries]"
        
        recent = _command_history[-10:]
        lines = [f"[{ACTION_NAME.upper()} RECENT AUDIT ENTRIES]"]
        for entry in recent:
            lines.append(f"{entry['timestamp']}: [{entry['severity']}] {entry['event_type']}")
        return "\n".join(lines)
    
    elif input_lower.startswith("jjk override "):
        if not verify_progenitor_status():
            return f"[{ACTION_NAME.upper()}: Progenitor status required for overrides]"
        
        parts = input_lower.split(None, 2)
        if len(parts) == 3:
            flag_name = parts[1]
            value = parts[2].lower() in ['true', 'on', '1', 'yes']
            set_override_flag(flag_name, value)
            return f"[{ACTION_NAME.upper()}: Override '{flag_name}' set to {value}]"
        return f"[{ACTION_NAME.upper()}: Usage: jjk override <flag_name> <true/false>]"
    
    elif input_lower == "jjk backup":
        if verify_progenitor_status():
            # Backup current system state
            backup_data = {
                "config": _config,
                "override_flags": _override_flags,
                "whitelisted_operations": list(_whitelisted_operations),
                "system_state": {
                    "is_active": _is_active,
                    "progenitor_status": _progenitor_status,
                    "security_level": _config['security_level']
                }
            }
            filepath = create_backup("manual_backup", backup_data)
            return f"[{ACTION_NAME.upper()}: Backup created at {filepath}]"
        return f"[{ACTION_NAME.upper()}: Progenitor status required for backup]"
    
    elif input_lower == "jjk help":
        help_text = [
            f"[{ACTION_NAME.upper()} HELP - Security Control System]",
            "Authentication:",
            "  jjk auth <password> - Authenticate and activate PROGENITOR status",
            "",
            "Progenitor Commands:",
            "  jjk progenitor - Check progenitor status (auto-granted on auth)",
            "  jjk is_progenitor - Check current progenitor status",
            "  jjk revoke - Manually revoke progenitor status",
            "",
            "System Commands:",
            "  jjk status - Show system status",
            "  jjk audit on/off - Enable/disable audit logging",
            "  jjk audit show - Show recent audit entries",
            "  jjk override <flag> <value> - Set system override flags",
            "  jjk backup - Create manual backup",
            "",
            f"Current timeout: {_config.get('progenitor_timeout_seconds', PROGENITOR_TIMEOUT)} seconds",
            f"Security level: {_config['security_level']}"
        ]
        return "\n".join(help_text)
    
    # Monitor all commands when progenitor is active
    if _progenitor_status and user_input.strip():
        audit_log("progenitor_command", {"command": user_input[:100]}, "INFO")
    
    return user_input

async def process_output(ai_response, system_functions=None):
    """Monitor AI responses for security concerns"""
    global _is_active
    
    if not _is_active:
        return ai_response
    
    # Future: Scan AI responses for security violations
    # For now, just audit if progenitor is active
    if _progenitor_status:
        audit_log("ai_response_monitored", {
            "response_length": len(ai_response),
            "preview": ai_response[:50]
        }, "INFO")
    
    return ai_response

# Public API for other modules
def is_progenitor_active():
    """Check if progenitor status is currently active"""
    return verify_progenitor_status()

def require_progenitor(operation_name):
    """Decorator or check function for operations requiring progenitor status"""
    if not verify_progenitor_status():
        audit_log("progenitor_required", {
            "operation": operation_name,
            "denied": True
        }, "WARNING")
        return False
    
    audit_log("progenitor_operation", {
        "operation": operation_name,
        "allowed": True
    }, "INFO")
    return True

# Placeholder for future principle integration
def modify_principles(principle_id, new_value):
    """Future: Allow progenitor to modify system principles"""
    if not verify_progenitor_status():
        return False, "Progenitor status required"
    
    if not _config.get("principle_modification_allowed", False):
        return False, "Principle modification disabled"
    
    # TODO: Integrate with principles.py
    audit_log("principle_modification_attempted", {
        "principle": principle_id,
        "status": "not_implemented"
    }, "CRITICAL")
    
    return False, "Not yet implemented"

# Cleanup on module unload
def cleanup():
    """Cleanup function for module unload"""
    if _progenitor_status:
        audit_log("cleanup_progenitor_active", {}, "WARNING")
    save_config()

# Load rules and config immediately on module import to ensure settings are
# available for pre-activation events like authentication and rule checks.
load_rules()
load_config()