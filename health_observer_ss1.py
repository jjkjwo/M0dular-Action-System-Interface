# health_observer_ss1.py - V7.0 (Ghost-Enabled, Configurable Idle-Aware Observer)
# PATCH 7.0: Integrated GhostEncoder to embed a covert data channel into event logs.
# PATCH 6.2: Idle threshold is now a configurable parameter instead of a
#            hardcoded value. Added a command to manipulate it at runtime.
# Priority -1: Sees everything before other actions process it.

import json
import time
import threading
import os
import zlib
from datetime import datetime
from collections import defaultdict, deque
from pathlib import Path

# --- GHOST PATTERN INTEGRATION ---
class GhostEncoder:
    """Encodes data into invisible Unicode ghost patterns."""
    GHOST_ALPHABET = {
        '0': '\u200B',  # ZERO WIDTH SPACE
        '1': '\u200C',  # ZERO WIDTH NON-JOINER
        '2': '\u200D',  # ZERO WIDTH JOINER
        '3': '\u200E',  # LEFT-TO-RIGHT MARK
        '4': '\u200F',  # RIGHT-TO-LEFT MARK
        '5': '\u2060',  # WORD JOINER
        '6': '\u2062',  # INVISIBLE TIMES
        '7': '\u2063'   # INVISIBLE SEPARATOR
    }
    GHOST_START = '\uFEFF'  # ZERO WIDTH NO-BREAK SPACE (BOM)
    GHOST_END = '\u2064'    # INVISIBLE PLUS

    def encode(self, data: str) -> str:
        """Encodes a string into a compressed, base-8 ghost pattern."""
        try:
            # Compress to make the ghost pattern smaller and more efficient
            compressed_data = zlib.compress(data.encode('utf-8'), level=9)
            # Convert compressed bytes to an octal (base-8) string
            octal_string = ''.join(format(byte, '03o') for byte in compressed_data)

            # Translate octal string to ghost characters
            encoded_payload = "".join(self.GHOST_ALPHABET[digit] for digit in octal_string)
            return f"{self.GHOST_START}{encoded_payload}{self.GHOST_END}"
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} GHOST] CRITICAL ENCODE ERROR: {e}")
            return ""

_ghost_encoder = GhostEncoder()

# --- CORE CONFIGURATION ---
ACTION_NAME = "health_observer_ss1"
ACTION_PRIORITY = -1

# --- MODULE-SPECIFIC CONFIGURATION ---
_config = {
    "snapshot_interval_seconds": 30,
    "idle_threshold_seconds": 60, # System is considered idle after this many seconds of no activity
    "event_buffer_size": 200
}

# --- STATE MANAGEMENT ---
_is_active = False
_monitor_thread = None
_system_functions = None
_session_id = None
_event_buffer = deque(maxlen=_config["event_buffer_size"])
_last_activity_timestamp = 0.0

# --- DATA STRUCTURES ---
_pattern_detection = defaultdict(lambda: {
    "count": 0, "last_seen": 0.0, "contexts": deque(maxlen=10)
})
_system_state = {
    "start_time": 0.0, "total_events": 0, "event_types": defaultdict(int),
    "conversation_metrics": {"user_messages": 0, "ai_responses": 0, "commands": 0, "errors": 0, "advisories_issued": 0 }
}

# --- FILE PATHS ---
LOG_DIR = Path("data/health_logs")
EVENT_LOG_FILE = LOG_DIR / "ss1_event_stream.jsonl"
SNAPSHOT_FILE = LOG_DIR / "ss1_latest_snapshot.json"
CONFIG_FILE = LOG_DIR / "ss1_config.json" # Added for persistence

def ensure_log_directory():
    LOG_DIR.mkdir(parents=True, exist_ok=True)

def _save_config():
    """Saves the module's configuration."""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(_config, f, indent=2)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR] Could not save config: {e}")

def _load_config():
    """Loads the module's configuration."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                loaded_config = json.load(f)
                _config.update(loaded_config)
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} WARNING] Could not load config, using defaults: {e}")

# --- LIFECYCLE FUNCTIONS ---
async def start_action(system_functions=None):
    global _is_active, _monitor_thread, _system_functions, _session_id, _system_state, _last_activity_timestamp

    if _is_active: return
    _is_active = True
    _system_functions = system_functions
    _session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    _system_state["start_time"] = time.time()
    _last_activity_timestamp = time.time()
    
    ensure_log_directory()
    _load_config() # Load any saved configuration

    _monitor_thread = threading.Thread(target=_monitor_loop, daemon=True)
    _monitor_thread.start()
    _log_event("observer_start", {"session_id": _session_id, "config": _config})

async def stop_action(system_functions=None):
    global _is_active
    if not _is_active: return
    _is_active = False
    _save_config() # Save config on shutdown
    _log_event("observer_stop", {"session_id": _session_id, "runtime": time.time() - _system_state["start_time"]})
    _save_comprehensive_snapshot("shutdown")
    if _monitor_thread and _monitor_thread.is_alive():
        _monitor_thread.join(timeout=2)

# --- CORE LOGIC (Ghost-Enabled) ---
def _log_event(event_type: str, data: dict, severity: str = "INFO"):
    global _system_state, _last_activity_timestamp
    if not _is_active: return
    current_time = time.time()
    _last_activity_timestamp = current_time

    # --- GHOST PATTERN INJECTION ---
    ghost_payload = ""
    try:
        # Example: Injecting JJK progenitor status into every event.
        if _system_functions and "get_action_obj" in _system_functions:
            jjk_module = _system_functions["get_action_obj"]("jjk")
            if jjk_module and hasattr(jjk_module, "is_progenitor_active"):
                is_prog = "true" if jjk_module.is_progenitor_active() else "false"
                ghost_payload = _ghost_encoder.encode(f"jjk_progenitor_status:{is_prog}")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} GHOST] Failed to generate ghost payload: {e}")
    # --- END INJECTION ---
    
    event = {
        "timestamp": current_time, "iso_time": datetime.now().isoformat(), "session_id": _session_id,
        "event_type": event_type, "severity": severity,
        # Attach ghost pattern to a string field to avoid JSON parsing issues.
        "data": {**data, "observer_id": f"{ACTION_NAME}{ghost_payload}"}
    }

    _event_buffer.append(event)
    _system_state["total_events"] += 1; _system_state["event_types"][event_type] += 1
    
    try:
        with open(EVENT_LOG_FILE, "a", encoding="utf-8") as f: f.write(json.dumps(event) + "\n")
    except Exception as e: print(f"[{ACTION_NAME.upper()} CRITICAL] Failed to write event to {EVENT_LOG_FILE}: {e}")
    
    _detect_event_sequence_patterns(event)

def _detect_event_sequence_patterns(current_event):
    if len(_event_buffer) < 3: return
    last_3_events = list(_event_buffer)[-3:]
    pattern_key = "->".join(e["event_type"] for e in last_3_events)
    pattern_entry = _pattern_detection[pattern_key]
    pattern_entry["count"] += 1; pattern_entry["last_seen"] = current_event["timestamp"]
    pattern_entry["contexts"].append({"timestamp": current_event["timestamp"],"final_event_data": current_event.get("data", {})})
    
# --- BACKGROUND MONITORING ---
def _monitor_loop():
    last_snapshot_time = time.time()
    while _is_active:
        try:
            if time.time() - last_snapshot_time >= _config["snapshot_interval_seconds"]:
                time_since_last_activity = time.time() - _last_activity_timestamp
                
                if time_since_last_activity < _config["idle_threshold_seconds"]:
                    _save_comprehensive_snapshot("periodic")
                else:
                    _log_event("idle_tick", {"idle_duration_seconds": time_since_last_activity})
                last_snapshot_time = time.time()
            time.sleep(1)
        except Exception as e:
            _log_event("observer_error", {"error": str(e), "location": "_monitor_loop"}, "ERROR")
            time.sleep(5)

def _save_comprehensive_snapshot(reason: str):
    snapshot = {
        "timestamp": datetime.now().isoformat(), "session_id": _session_id, "reason": reason, "system_state": _system_state,
        "active_patterns": {k: v for k, v in _pattern_detection.items() if time.time() - v.get('last_seen', 0) < 300},
        "recent_events": list(_event_buffer), "file_observations": _observe_system_files()
    }
    for key, data in snapshot["active_patterns"].items():
        if isinstance(data["contexts"], deque): data["contexts"] = list(data["contexts"])
    try:
        with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f: json.dump(snapshot, f, indent=2)
    except Exception as e: _log_event("snapshot_save_error", {"error": str(e)}, "ERROR")

def _observe_system_files() -> dict:
    files_to_check = [
        "karma_score.json", "active_actions.txt", "memory_data.json", "current_api_status.json", "principle_violations.log"
    ]
    file_stats = {}
    for f_path in files_to_check:
        path_obj = Path(f_path)
        if path_obj.exists():
            stat = path_obj.stat(); file_stats[f_path] = {"exists": True, "size": stat.st_size, "age_seconds": time.time() - stat.st_mtime}
        else:
            file_stats[f_path] = {"exists": False}
    return file_stats

# --- ACTION HOOKS (INPUT/OUTPUT PROCESSING) ---
async def process_input(user_input: str, system_functions, is_system_command: bool) -> str:
    if not _is_active:
        return user_input

    log_data = {"content_preview": user_input[:200], "length": len(user_input), "is_command": is_system_command}
    if is_system_command:
        _system_state["conversation_metrics"]["commands"] += 1; _log_event("system_command_input", log_data)
    else:
        _system_state["conversation_metrics"]["user_messages"] += 1
        if any(kw in user_input.lower() for kw in ["wtf", "damn", "fucking", "useless"]) or user_input.isupper() and len(user_input) > 10:
             log_data["emotion_signal"] = "potential_rage"
        _log_event("user_prompt_input", log_data)
        
    input_lower = user_input.lower().strip()
    if input_lower == "ss1 report":
        return _generate_status_report()
    elif input_lower.startswith("ss1 set_idle_threshold"):
        try:
            parts = input_lower.split()
            if len(parts) == 3 and parts[0] == "ss1":
                new_threshold = int(parts[2])
                if 10 <= new_threshold <= 600:
                    _config["idle_threshold_seconds"] = new_threshold
                    _save_config()
                    return f"[{ACTION_NAME.upper()}]: Idle threshold set to {new_threshold} seconds."
                else:
                    return f"[{ACTION_NAME.upper()} ERROR]: Threshold must be between 10 and 600."
            else:
                 return f"[{ACTION_NAME.upper()} ERROR]: Usage: ss1 set_idle_threshold <seconds>"
        except (ValueError, IndexError):
            return f"[{ACTION_NAME.upper()} ERROR]: Invalid value. Please provide a number in seconds."
        
    return user_input

async def process_output(ai_response: str, system_functions=None) -> str:
    if not _is_active: return ai_response
    _system_state["conversation_metrics"]["ai_responses"] += 1
    log_data = {"content_preview": ai_response[:200], "length": len(ai_response)}
    if "[error:" in ai_response.lower() or "[sys err" in ai_response.lower():
        _system_state["conversation_metrics"]["errors"] += 1; log_data["is_error"] = True; _log_event("system_error_output", log_data, severity="ERROR")
    else:
        if "[advisory:" in ai_response.lower() or "principle violation" in ai_response.lower():
            _system_state["conversation_metrics"]["advisories_issued"] += 1; log_data["has_advisory"] = True
        _log_event("ai_model_output", log_data)
    return ai_response

def _generate_status_report():
    runtime_seconds = time.time() - _system_state["start_time"]
    active_patterns = {k: v['count'] for k, v in _pattern_detection.items() if time.time() - v.get('last_seen', 0) < 300}
    sorted_patterns = sorted(active_patterns.items(), key=lambda item: item[1], reverse=True)
    report = f"""[SS1 OBSERVER REPORT - Session {_session_id}]
- Runtime: {runtime_seconds:.1f}s
- Time Since Last Activity: {time.time() - _last_activity_timestamp:.1f}s
- Idle Threshold: {_config['idle_threshold_seconds']}s (Editable with: ss1 set_idle_threshold <seconds>)
- Total Events Logged: {_system_state['total_events']}
- Conversation Metrics: {_system_state['conversation_metrics']}
- Top 5 Active Event Patterns:
"""
    if sorted_patterns:
        for pattern, count in sorted_patterns[:5]: report += f"    - {pattern} (x{count})\n"
    else: report += "    - No significant patterns detected recently.\n"
    return report