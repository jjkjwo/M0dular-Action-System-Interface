# karma.py - Karma Tracking and Management System
# Version 3.1 - Advanced Mechanics and JJK Integration (Global variable fix)

import os
import json
import re
import time
from datetime import datetime
from collections import deque

# Attempt to import jjk for security checks. If it fails, operations requiring it will be disabled.
try:
    import jjk
    JJK_AVAILABLE = True
except ImportError:
    JJK_AVAILABLE = False

ACTION_NAME = "karma"
ACTION_PRIORITY = 7

# --- Configuration ---
KARMA_FILE = "karma_score.json"
KARMA_LOG_FILE = "karma_history.json"
MAX_HISTORY_ENTRIES = 100
COOLDOWN_SECONDS = 2
TANKING_THRESHOLD = -10 # Score at which "recovery mode" can be triggered

# IMPL: #3, #6 - New modifiers and streak configuration
MOMENTUM_CONFIG = {"start_streak": 3, "multiplier": 1.25}

# --- Karma Tiers ---
KARMA_TIERS = {
    "perfect": {"min": 50, "status": "Exemplary"},
    "excellent": {"min": 20, "status": "Excellent"},
    "good": {"min": 10, "status": "Good"},
    "optimal": {"min": 1, "status": "Optimal"},
    "neutral": {"min": 0, "status": "Neutral"},
    "suboptimal": {"min": -10, "status": "Sub-Optimal"},
    "poor": {"min": -20, "status": "Poor"},
    "critical": {"min": -50, "status": "Critical"}
}

# --- Module State ---
_is_active = False
_agent_karma = 0.0 # Initialize as float for more precise tracking
_karma_history = deque(maxlen=MAX_HISTORY_ENTRIES)
_session_start_karma = 0.0
_last_karma_time = 0

# IMPL: #7 - State for tier-only notifications
_pending_tier_notification = None

# IMPL: #3 - State for momentum tracking
_karma_streak = {"type": None, "count": 0}

# IMPL: #2 - State for recovery mechanic
_is_tanking = False
_tanking_start_score = 0.0

# IMPL: #6 - State for base modifiers (Progenitor controlled)
_karma_modifiers = {"negative_multiplier": 1.0}

# --- Enhanced Regex Patterns ---
KARMA_PATTERNS = [
    (r'^([+-])([1-3])$', 'standalone', 1.0),
]
EXCLUSION_PATTERNS = [r'\d+\s*[+-]\s*\d+']

# --- Core Functions ---

def load_karma():
    global _agent_karma, _session_start_karma, _karma_modifiers
    try:
        if os.path.exists(KARMA_FILE):
            with open(KARMA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _agent_karma = float(data.get("score", 0)) # Ensure it's a float
                _session_start_karma = _agent_karma
                # Load modifiers, keeping default if not found
                _karma_modifiers = data.get("modifiers", {"negative_multiplier": 1.0})
                # Ensure multiplier is float
                if 'negative_multiplier' in _karma_modifiers:
                    _karma_modifiers['negative_multiplier'] = float(_karma_modifiers['negative_multiplier'])
                print(f"[{ACTION_NAME.upper()}: Loaded karma score: {_agent_karma}]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error loading karma: {e}]")
    # Always save after loading to ensure file structure is updated if needed
    save_karma()

def save_karma():
    # Corrected: _agent_karma and _karma_modifiers need to be declared global if their values
    # are accessed or assigned within this function, even if not directly modified as in +=.
    # In this case, they are read to be put into the 'data' dictionary.
    global _agent_karma, _karma_modifiers
    try:
        data = {
            "score": _agent_karma,
            "modifiers": _karma_modifiers,
            "last_updated": datetime.now().isoformat()
        }
        with open(KARMA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving karma: {e}]")

def load_history():
    global _karma_history
    if os.path.exists(KARMA_LOG_FILE):
        try:
            with open(KARMA_LOG_FILE, "r", encoding="utf-8") as f:
                history_list = json.load(f).get("history", [])
                _karma_history = deque(history_list[-MAX_HISTORY_ENTRIES:], maxlen=MAX_HISTORY_ENTRIES)
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}: Error loading history: {e}]")

def save_history():
    try:
        with open(KARMA_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump({"history": list(_karma_history)}, f, indent=2)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error saving history: {e}]")

def get_karma_tier(score):
    for tier_name, tier_info in sorted(KARMA_TIERS.items(), key=lambda x: x[1]["min"], reverse=True):
        if score >= tier_info["min"]:
            return {"name": tier_name, "status": tier_info["status"]}
    return {"name": "critical", "status": KARMA_TIERS["critical"]["status"]}

# IMPL: #4, #5 - Central validation function with JJK hook
def _validate_and_apply_karma(amount, reason, source):
    """Internal function to validate and apply karma changes, with a JJK hook."""
    global _agent_karma, _pending_tier_notification, _is_tanking, _tanking_start_score, _karma_streak

    # JJK Check: Every karma transaction is a auditable event.
    if JJK_AVAILABLE and not jjk.progenitor_check("karma_transaction", source=source):
        print(f"[{ACTION_NAME.upper()}: JJK DENIED karma transaction from source '{source}']")
        return None, "JJK validation failed"

    old_score = _agent_karma
    old_tier = get_karma_tier(old_score)
    
    # Make a working copy of the amount to be applied
    applied_amount = float(amount)

    # IMPL: #6 - Apply Progenitor-controlled base modifiers
    if applied_amount < 0:
        applied_amount *= _karma_modifiers['negative_multiplier']
        if _karma_modifiers['negative_multiplier'] != 1.0:
            reason += f" (modifier x{_karma_modifiers['negative_multiplier']:.2f})"

    # IMPL: #3 - Apply momentum
    # Only apply momentum if a significant streak exists and the karma change aligns with the streak type
    if _karma_streak["count"] >= MOMENTUM_CONFIG["start_streak"]:
        multiplier = MOMENTUM_CONFIG["multiplier"]
        if (_karma_streak["type"] == "positive" and applied_amount > 0) or \
           (_karma_streak["type"] == "negative" and applied_amount < 0):
            applied_amount *= multiplier
            reason += f" (momentum x{multiplier:.2f})"
    
    # IMPL: #2 - Check for and apply recovery bonus
    recovery_bonus = 0.0
    # If currently tanking and receiving a positive karma, calculate recovery bonus
    if _is_tanking and applied_amount > 0:
        karma_lost = abs(_tanking_start_score - old_score)
        # Recovery bonus: a percentage of karma lost during the tanking period
        recovery_bonus = round(karma_lost * 0.25, 2) # Recover 25% of karma lost during tanking, rounded
        if recovery_bonus > 0:
            reason += f" (recovery bonus: +{recovery_bonus:.2f})"
            applied_amount += recovery_bonus
        _is_tanking = False # Recovery is a one-time event upon the first positive change

    _agent_karma += applied_amount
    new_tier = get_karma_tier(_agent_karma)

    # IMPL: #7 - Set pending notification ONLY on tier change
    if old_tier["name"] != new_tier["name"]:
        _pending_tier_notification = (f"[SYSTEM: Karma Tier Updated: {old_tier['status']} -> {new_tier['status']}] "
                                      f"(Score: {old_score:.2f} -> {_agent_karma:.2f})")

    # Update state for next turn
    if applied_amount > 0:
        # If new positive karma, and streak was already positive, increment count. Else, start new positive streak.
        _karma_streak = {"type": "positive", "count": _karma_streak["count"] + 1 if _karma_streak["type"] == "positive" else 1}
    elif applied_amount < 0:
        # If new negative karma, and streak was already negative, increment count. Else, start new negative streak.
        _karma_streak = {"type": "negative", "count": _karma_streak["count"] + 1 if _karma_streak["type"] == "negative" else 1}
    else:
        # If zero change, reset streak or maintain neutral
        _karma_streak = {"type": "neutral", "count": 1}
    
    # IMPL: #2 - Set tanking state if we cross the threshold and weren't tanking before
    if not _is_tanking and _agent_karma < TANKING_THRESHOLD:
        _is_tanking = True
        _tanking_start_score = _agent_karma
    
    # Log and Save
    entry = {
        "timestamp": datetime.now().isoformat(),
        "change": applied_amount, "reason": reason, "source": source,
        "old_score": old_score, "new_score": _agent_karma,
        "old_tier": old_tier['status'], "new_tier": new_tier['status']
    }
    _karma_history.append(entry)
    save_karma()
    save_history()
    
    return entry, "Success"


def detect_karma_feedback(text):
    text_clean = text.strip()
    if any(re.search(ex, text_clean, re.I) for ex in EXCLUSION_PATTERNS):
        return None

    # Check for standalone patterns first
    matches = [m for p, _, _ in KARMA_PATTERNS for m in re.finditer(p, text_clean, re.I | re.M)]
    if len(matches) > 1:
        return {"value": 0, "reason": "Multiple karma values detected", "abuse": True}
    if not matches:
        return None

    match = matches[0]
    sign = match.group(1)
    value = int(match.group(2))
    
    final_value = -float(value) if sign == '-' else float(value) # Ensure float
    
    # IMPL: #1 - Handle conceptual +3/-3
    conceptual_value = None
    if abs(final_value) == 3:
        conceptual_value = final_value
        final_value = 2.0 if final_value > 0 else -2.0 # Apply as +/-2.0
        
    return {"value": final_value, "conceptual_value": conceptual_value}

# --- Action Lifecycle and Command Processing ---

async def start_action(system_functions=None):
    global _is_active
    _is_active = True
    load_karma()
    load_history()
    if not JJK_AVAILABLE:
        print(f"[{ACTION_NAME.upper()}: WARNING - jjk.py not found. Security checks will be bypassed.]")
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Karma v3.1 Active]")

async def stop_action(system_functions=None):
    global _is_active
    _is_active = False
    save_karma()
    save_history()
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED]")

async def process_input(user_input, system_functions=None, is_system_command=False):
    # Corrected: Added all necessary global variables here.
    global _is_active, _last_karma_time, _pending_tier_notification, _karma_modifiers, \
           _agent_karma, _karma_streak, _is_tanking, _tanking_start_score
    
    if not _is_active:
        return user_input

    # --- Command Handling ---
    input_lower = user_input.lower().strip()
    if input_lower.startswith("karma "):
        parts = input_lower.split()
        if len(parts) > 1:
            if parts[1] == "status":
                tier = get_karma_tier(_agent_karma)
                status_lines = [
                    f"[KARMA STATUS]",
                    f"  Score: {_agent_karma:.2f}",
                    f"  Tier: {tier['name'].title()} - {tier['status']}",
                    f"  Negative Modifier: {_karma_modifiers['negative_multiplier']:.0%}",
                    f"  Current Streak: {_karma_streak['type']} ({_karma_streak['count']})"
                ]
                if _is_tanking:
                    status_lines.append(f"  Tanking Mode Active (Start: {_tanking_start_score:.2f})")
                
                return "\n".join(status_lines)

            # IMPL: #6 - Progenitor command to set modifier
            elif parts[1] == "set_modifier" and len(parts) == 4 and parts[2] == "negative":
                if not (JJK_AVAILABLE and jjk.progenitor_check("karma_modify_base_rate")):
                    return "[JJK: DENIED - Progenitor status required to change karma modifiers.]"
                try:
                    value = float(parts[3])
                    if 0.0 <= value <= 2.0:
                        _karma_modifiers['negative_multiplier'] = value
                        save_karma()
                        return f"[KARMA: Negative modifier set to {value:.0%}]"
                    return "[KARMA: Modifier must be between 0.0 and 2.0]"
                except ValueError:
                    return "[KARMA: Invalid modifier value.]"
            
            # IMPL: #5 - Progenitor command to reset karma
            elif parts[1] == "jjk_reset":
                if not (JJK_AVAILABLE and jjk.progenitor_check("karma_reset_authority")):
                    return "[JJK: DENIED - Progenitor status required for full reset.]"
                
                _agent_karma = 0.0
                _karma_streak = {"type": None, "count": 0}
                _is_tanking = False
                _tanking_start_score = 0.0
                _karma_modifiers = {"negative_multiplier": 1.0} # Reset modifiers too on full reset
                _pending_tier_notification = "[SYSTEM: Karma has been fully reset to 0 by JJK Authority. Modifiers also reset.]"
                save_karma()
                return "[KARMA: Score has been reset to 0 by JJK Authority.]"
            
            elif parts[1] == "history":
                if not _karma_history:
                    return "[KARMA: No history available.]"
                
                output = ["[KARMA HISTORY - Last 10 changes]"]
                for entry in list(_karma_history)[-10:]:
                    time_str = datetime.fromisoformat(entry['timestamp']).strftime("%H:%M:%S")
                    change_str = f"{entry['change']:+.2f}"
                    output.append(f"  {time_str}: {change_str} ({entry['reason']}) -> {entry['new_score']:.2f}")
                return "\n".join(output)

    # --- Feedback Detection ---
    current_time = time.time()
    if current_time - _last_karma_time < COOLDOWN_SECONDS:
        # If spamming, just return original input without further processing to avoid interference.
        return user_input 
    
    detection = detect_karma_feedback(user_input)
    if detection:
        _last_karma_time = current_time # Update last karma time on detection attempt
        if detection.get("abuse"):
            return "[KARMA: Multiple feedback signals detected. Ignored.]"

        value = detection["value"]
        reason = f"Direct feedback trigger: '{user_input.strip()}'"

        # IMPL: #1 - Add conceptual hint to reason
        if detection.get("conceptual_value"):
            return_msg = f"[KARMA: Conceptual {detection['conceptual_value']}: The ideal, not applied to score.]"
            if abs(detection['conceptual_value']) == 3:
                return_msg += f" However, applying {value:+.0f} to score for system record."
                entry, msg = _validate_and_apply_karma(value, reason, "user_feedback")
                if not entry:
                     return_msg += f" (Score update denied: {msg})"
            return return_msg

        # Process actual karma change
        entry, msg = _validate_and_apply_karma(value, reason, "user_feedback")

        if entry:
            return f"[KARMA: {entry['change']:+.2f} -> {_agent_karma:.2f} ({get_karma_tier(_agent_karma)['status']})]"
        else:
            return f"[KARMA: Change denied. Reason: {msg}]"
            
    # --- Prompt Injection ---
    # IMPL: #7 - Only inject pending tier notifications, nothing else
    # IMPORTANT: Do not inject if it's a system command itself, as that would pollute commands.
    if not is_system_command and _pending_tier_notification:
        injection_text = _pending_tier_notification
        _pending_tier_notification = None # Clear after injection
        return f"{injection_text}\n\n{user_input}"
    
    return user_input

# --- Public API for other Addons ---

def get_karma_info():
    """Read-only karma information for other addons."""
    return { "score": _agent_karma, "tier": get_karma_tier(_agent_karma), "streak": _karma_streak.copy(), "is_tanking": _is_tanking }

# IMPL: #5 - New API for suggestions from other modules
def suggest_karma_change(amount, reason, source_addon_name):
    """API for other addons to suggest a karma change, subject to JJK validation."""
    if not _is_active: return False, "Karma system inactive"

    entry, msg = _validate_and_apply_karma(amount, reason, source_addon_name)
    if entry:
        print(f"[{ACTION_NAME.upper()}: Karma change from '{source_addon_name}' accepted: {entry['change']:+.2f}]")
        return True, "Suggestion applied"
    else:
        print(f"[{ACTION_NAME.upper()}: Karma change from '{source_addon_name}' denied: {msg}]")
        return False, msg

# --- Initialization ---
load_karma()
load_history()