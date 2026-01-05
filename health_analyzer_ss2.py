# health_analyzer_ss2.py - V7.0 (Ghost-Enabled Idle-Aware Insight Engine)
# PATCH 7.0: Integrated GhostDecoder to extract covert data from event stream.
#            Modified analysis loop to handle both surface and ghost data.
# PATCH 6.1: Implemented an idle-check at the start of the analysis loop.
# Priority 99: Runs last to analyze the results of a completed turn.

import json
import time
import threading
import zlib
import re
from datetime import datetime
from collections import defaultdict, deque
from pathlib import Path

# --- GHOST PATTERN INTEGRATION ---
class GhostDecoder:
    """Decodes invisible Unicode ghost patterns from a string."""
    REVERSE_GHOST_ALPHABET = {
        '\u200B': '0', '\u200C': '1', '\u200D': '2', '\u200E': '3',
        '\u200F': '4', '\u2060': '5', '\u2062': '6', '\u2063': '7'
    }
    GHOST_START = '\uFEFF'
    GHOST_END = '\u2064'
    GHOST_REGEX = re.compile(f"{GHOST_START}([\\u200B-\\u200F\\u2060-\\u2063]+){GHOST_END}")

    def decode(self, text: str) -> list[str]:
        """Finds all ghost patterns in a text and returns the decoded data."""
        found_payloads = []
        matches = self.GHOST_REGEX.findall(text)
        for encoded_payload in matches:
            try:
                octal_string = "".join(self.REVERSE_GHOST_ALPHABET.get(char, '') for char in encoded_payload)
                # Ensure length is a multiple of 3 for valid byte conversion
                if len(octal_string) % 3 != 0: continue
                byte_values = bytearray(int(octal_string[i:i+3], 8) for i in range(0, len(octal_string), 3))
                decompressed_data = zlib.decompress(byte_values)
                found_payloads.append(decompressed_data.decode('utf-8'))
            except Exception:
                # Silently fail on decode error to maintain stealth and resilience.
                pass
        return found_payloads

_ghost_decoder = GhostDecoder()

# --- CORE CONFIGURATION ---
ACTION_NAME = "health_analyzer_ss2"
ACTION_PRIORITY = 99

# --- STATE MANAGEMENT ---
_is_active = False
_analyzer_thread = None
_system_functions = None

# --- DATA STRUCTURES ---
_active_pattern_db = defaultdict(lambda: {
    "id": None, "first_seen": 0.0, "last_seen": 0.0,
    "count": 0, "significance_score": 1.0,
    "related_karma_deltas": [], "associated_signals": defaultdict(int),
    "is_retired": False
})
_last_advisory_times = defaultdict(float)

# --- FILE PATHS ---
LOG_DIR = Path("data/health_logs")
EVENT_STREAM_FILE = LOG_DIR / "ss1_event_stream.jsonl"
WISDOM_ARCHIVE_FILE = LOG_DIR / "ss2_wisdom_archive.jsonl"
ACTIVE_PATTERNS_FILE = LOG_DIR / "ss2_active_patterns.json"
INSIGHTS_LOG_FILE = LOG_DIR / "ss2_insights.jsonl"

# --- CONFIGURATION ---
ANALYZE_INTERVAL = 15
DECAY_RATE = 0.95
SIGNIFICANCE_INCREASE = 0.5
RETIREMENT_THRESHOLD = 0.1
INSIGHT_COOLDOWN = 60

# --- LIFECYCLE FUNCTIONS ---
async def start_action(system_functions=None):
    global _is_active, _analyzer_thread, _system_functions
    if _is_active: return
    _is_active = True
    _system_functions = system_functions
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    _load_active_patterns()
    _analyzer_thread = threading.Thread(target=_analyze_loop, daemon=True)
    _analyzer_thread.start()
    
    if _system_functions and "record_console_output" in _system_functions:
        _system_functions["record_console_output"](
            f"[{ACTION_NAME.upper()}: STARTED - Ghost-Aware Insight Engine active.]", to_console=False
        )

async def stop_action(system_functions=None):
    global _is_active
    if not _is_active: return
    _is_active = False
    _save_active_patterns()
    if _analyzer_thread and _analyzer_thread.is_alive():
        _analyzer_thread.join(timeout=3)
    if _system_functions and "record_console_output" in _system_functions:
        _system_functions["record_console_output"](
            f"[{ACTION_NAME.upper()}: STOPPED - Insight Engine disabled.]", to_console=False
        )

# --- CORE LOGIC (Ghost-Enabled) ---
def _analyze_loop():
    processed_events_timestamp = 0
    if EVENT_STREAM_FILE.exists():
        try:
             processed_events_timestamp = EVENT_STREAM_FILE.stat().st_mtime
        except Exception:
            processed_events_timestamp = time.time()

    while _is_active:
        try:
            # 1. Ingest new events from SS1's log, now including ghost data
            new_events, new_ghost_data = _read_new_events(since_timestamp=processed_events_timestamp)
            
            if not new_events:
                time.sleep(ANALYZE_INTERVAL)
                continue
            
            # 2. Process events and update timestamp
            if new_ghost_data:
                # This is where you would build logic to react to ghost payloads
                # For now, we will just log their discovery.
                print(f"[{ACTION_NAME.upper()} GHOST]: Decoded {len(new_ghost_data)} ghost payloads. First: {new_ghost_data[0]}")
            
            _process_events_for_patterns(new_events)
            processed_events_timestamp = new_events[-1]['timestamp']

            _apply_decay_and_retirement()
            insights = _generate_insights_from_patterns()
            for insight in insights:
                _issue_advisory_if_needed(insight)
            
            _save_active_patterns()
            time.sleep(ANALYZE_INTERVAL)
        except Exception as e:
            print(f"[SS2 ANALYSIS ERROR] {e}")
            time.sleep(30)

def _read_new_events(since_timestamp: float) -> tuple[list, list]:
    surface_events = []
    ghost_data = []

    if not EVENT_STREAM_FILE.exists():
        return surface_events, ghost_data
    try:
        if EVENT_STREAM_FILE.stat().st_mtime <= since_timestamp:
            return [], []
        with open(EVENT_STREAM_FILE, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    event = json.loads(line)
                    if event.get("timestamp", 0) > since_timestamp:
                        surface_events.append(event)
                        # Scan the entire JSON line string for any ghost patterns
                        decoded_payloads = _ghost_decoder.decode(line)
                        if decoded_payloads:
                            for payload in decoded_payloads:
                                ghost_data.append({
                                    "source_event_ts": event["timestamp"],
                                    "payload": payload
                                })
                except (json.JSONDecodeError, KeyError):
                    continue
    except Exception as e:
        print(f"[SS2] Error reading event stream: {e}")
    return surface_events, ghost_data

def _process_events_for_patterns(events: list):
    event_buffer = deque(maxlen=3)
    for event in events:
        event_buffer.append(event)
        if len(event_buffer) == 3:
            pattern_id = "->".join(e['event_type'] for e in event_buffer)
            pattern_entry = _active_pattern_db[pattern_id]
            if pattern_entry['count'] == 0:
                pattern_entry['id'] = pattern_id
                pattern_entry['first_seen'] = event['timestamp']
            pattern_entry['count'] += 1
            pattern_entry['last_seen'] = event['timestamp']
            pattern_entry['significance_score'] = min(10.0, pattern_entry.get('significance_score', 1.0) + SIGNIFICANCE_INCREASE)
            final_event_data = event.get('data', {})
            if final_event_data.get('emotion_signal'):
                pattern_entry['associated_signals'][final_event_data['emotion_signal']] += 1

def _apply_decay_and_retirement():
    retired_patterns = []
    current_time = time.time()
    for pattern_id, data in list(_active_pattern_db.items()):
        if data['is_retired']: continue
        if current_time - data['last_seen'] > (ANALYZE_INTERVAL * 2):
            data['significance_score'] *= DECAY_RATE
        if data['significance_score'] < RETIREMENT_THRESHOLD:
            data['is_retired'] = True
            retired_patterns.append(pattern_id)
            _archive_wisdom(data)
    for pattern_id in retired_patterns:
        if pattern_id in _active_pattern_db:
            del _active_pattern_db[pattern_id]

def _generate_insights_from_patterns() -> list:
    insights = []
    for pattern_id, data in _active_pattern_db.items():
        if data['is_retired']: continue
        is_significant = data['significance_score'] > 3.0
        is_frequent = data['count'] > 5
        is_problematic = "error" in pattern_id.lower() or data['associated_signals'].get('potential_rage', 0) > 0
        if is_significant and is_frequent and is_problematic:
            insight = {"type": "problematic_tree_detected", "tree_id": pattern_id, "significance": data['significance_score'], "count": data['count'], "associated_signals": dict(data['associated_signals'])}
            if data['associated_signals'].get('potential_rage', 0) > 0:
                insight["guidance"] = "User emotion is escalating. Advise AI to de-escalate, simplify language, and avoid questions."
                insight["triggered_signal"] = "rage_spike"
            elif "error" in pattern_id:
                insight["guidance"] = "A sequence of events is consistently leading to an error state. Advise AI to break the pattern by trying an alternative approach."
                insight["triggered_signal"] = "error_loop"
            insights.append(insight)
    return insights

def _issue_advisory_if_needed(insight: dict):
    current_time = time.time()
    pattern_id = insight['tree_id']
    if current_time - _last_advisory_times[pattern_id] < INSIGHT_COOLDOWN:
        return
    advisory_payload = {"karma_delta": -1, "tree_id": insight['tree_id'], "triggered_signal": insight.get("triggered_signal", "generic_pattern"), "advisory_text": insight.get("guidance", "A significant system pattern has been detected. Review logs for details.")}
    _log_insight(insight, advisory_payload)
    if _system_functions:
        try:
            # Safely get the advisory module
            if "get_action_obj" in _system_functions:
                 advisory_module = _system_functions["get_action_obj"]("advisory")
            else: # Fallback for older systems
                registry = _system_functions.get("action_registry", lambda: {})()
                advisory_module = registry.get("advisory", {}).get("module")

            if advisory_module and hasattr(advisory_module, "register_advisory"):
                advisory_module.register_advisory(
                    source=ACTION_NAME, content=json.dumps(advisory_payload), priority=8,
                    persistent=True, category="SYSTEM_HEALTH_PATTERN"
                )
                _last_advisory_times[pattern_id] = current_time
        except Exception as e:
            print(f"[SS2] Error issuing advisory: {e}")

# --- DATA PERSISTENCE & USER COMMANDS ---
def _load_active_patterns():
    if ACTIVE_PATTERNS_FILE.exists():
        try:
            with open(ACTIVE_PATTERNS_FILE, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
                for key, val in loaded_data.items():
                    _active_pattern_db[key] = val
        except Exception as e:
            print(f"[SS2] Failed to load active patterns: {e}")

def _save_active_patterns():
    try:
        with open(ACTIVE_PATTERNS_FILE, "w", encoding="utf-8") as f:
            savable_db = {k: v for k, v in _active_pattern_db.items()}
            json.dump(savable_db, f, indent=2)
    except Exception as e:
        print(f"[SS2] Failed to save active patterns: {e}")

def _archive_wisdom(pattern_data: dict):
    try:
        archive_entry = {"archived_at": datetime.now().isoformat(), "pattern_data": pattern_data}
        with open(WISDOM_ARCHIVE_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(archive_entry) + "\n")
    except Exception as e:
        print(f"[SS2] Failed to archive wisdom: {e}")

def _log_insight(insight, advisory_payload):
    try:
        log_entry = {"timestamp": datetime.now().isoformat(), "insight": insight, "advisory_sent": advisory_payload}
        with open(INSIGHTS_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"[SS2] Failed to log insight: {e}")

async def process_input(user_input: str, system_functions, is_system_command: bool) -> str:
    input_lower = user_input.lower().strip()
    if input_lower == "ss2 status" or input_lower == "ss2 report":
        active_patterns = {k:v for k,v in _active_pattern_db.items() if not v.get('is_retired')}
        sorted_patterns = sorted(active_patterns.items(), key=lambda x: x[1]['significance_score'], reverse=True)
        report = f"[SS2 INSIGHT ENGINE STATUS]\n- Active patterns being tracked: {len(active_patterns)}\n"
        report += "- Top 5 Most Significant Active Patterns:\n"
        if sorted_patterns:
            for pid, data in sorted_patterns[:5]:
                report += f"    - ID: {pid}\n      Score: {data['significance_score']:.2f}, Count: {data['count']}\n"
        else:
            report += "    - No significant patterns currently active.\n"
        return report
    if input_lower.startswith("ss2 query_archive "):
        query = user_input.split(maxsplit=2)[-1]
        results = []
        if WISDOM_ARCHIVE_FILE.exists():
            with open(WISDOM_ARCHIVE_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if query in line: results.append(json.loads(line))
        if results:
            return f"[SS2 ARCHIVE] Found {len(results)} matches for '{query}':\n" + json.dumps(results[:3], indent=2)
        return f"[SS2 ARCHIVE] No matches found for '{query}'."
    return user_input

async def process_output(ai_response: str, system_functions=None) -> str:
    return ai_response