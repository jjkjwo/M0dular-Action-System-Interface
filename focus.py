# focus.py - Prompt Perturbation Layer (FIXED)
# Version 1.2.0 - Added command system check to prevent perturbing system commands
# Version 1.1.0 - Added statistics saving/loading and config saving fixes.
#
# This plugin strategically injects subtle variations (typos, emotional markers, mild expletives) 
# into user prompts based on context analysis and configurable triggers.
#

import os
import json
import random
import re
import time
from datetime import datetime

# Import command_system to check for commands
import command_system

# ===========================
# GLOBAL STATE VARIABLES
# ===========================
_is_active = False
_config = {
    "features": { "typos": True, "emotions": True, "expletives": False },
    "probability": 0.3,
    "typo_config": { "probability": 0.5, "max_typos": 1, "preserve_keywords": True },
    "emotion_config": { "probability": 0.4, "markers": ["hmm", "wow", "ugh", "sigh", "huh", "hmph", "ah", "oh", "geez", "whoa", "yikes", "sheesh", "meh", "eh", "oof"] },
    "expletive_config": { "probability": 0.1, "words": ["damn", "heck", "darn", "shoot", "crap"] },
    "triggers": {
        "keywords": { "explain": 0.4, "stuck": 0.6, "try again": 0.5, "not working": 0.6, "confused": 0.5, "help": 0.3 },
        "stress_indicators": { "multiple_punctuation": 0.5, "all_caps": 0.6, "repetition": 0.7 }
    },
    "logging": True
}
_statistics = {
    "total_inputs": 0, "perturbed_inputs": 0, "typos_applied": 0,
    "emotions_injected": 0, "expletives_injected": 0, "last_perturbation": None
}
_previous_inputs = []
_max_previous_inputs = 5

# ===========================
# FILE PATHS
# ===========================
CONFIG_FILE = "focus_config.json"
LOG_FILE = "focus_log.txt"
STATS_FILE = "focus_stats.json" # File to store runtime statistics

# ===========================
# FILE OPERATIONS
# ===========================

def load_config():
    """Load configuration from file"""
    global _config
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                loaded_config = json.load(f)
                # Update nested dictionaries safely
                for key, value in loaded_config.items():
                    if isinstance(value, dict) and key in _config and isinstance(_config[key], dict):
                        _config[key].update(value)
                    else:
                        _config[key] = value
            print(f"[FOCUS: Loaded configuration from {CONFIG_FILE}]")
    except Exception as e:
        print(f"[FOCUS: Error loading configuration: {e}]")

def save_config():
    """Save current configuration to file"""
    global _config
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(_config, f, indent=2)
        print(f"[FOCUS: Saved configuration to {CONFIG_FILE}]")
    except Exception as e:
        print(f"[FOCUS: Error saving configuration: {e}]")

def log_perturbation(original, modified, perturbation_type, trigger=None):
    """Log a perturbation event if logging is enabled"""
    if not _config.get("logging", False): # Use .get for safety
        return
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {perturbation_type.upper()}"
        if trigger: log_entry += f" (Trigger: {trigger})"
        log_entry += f"\nOriginal: {original}\nModified: {modified}\n"
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry + "-" * 40 + "\n")
    except Exception as e:
        print(f"[FOCUS: Error logging perturbation: {e}]")

# --- Function to save statistics ---
def save_stats():
    """Save current statistics to file"""
    global _statistics
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(_statistics, f, indent=2)
        # Removed noisy log print: print(f"[FOCUS: Saved statistics to {STATS_FILE}]")
    except Exception as e:
        print(f"[FOCUS: Error saving statistics: {e}]")

# ===========================
# PLUGIN LIFECYCLE HOOKS
# ===========================

async def start_action():
    """Start the focus action - load config, stats, initialize state"""
    global _is_active, _statistics # Ensure statistics is global here
    _is_active = True
    load_config() # Load config first

    # --- Load previous stats on start ---
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                loaded_stats = json.load(f)
                if isinstance(loaded_stats, dict): # Basic validation
                    _statistics.update(loaded_stats) # Update existing stats dict safely
                    print(f"[FOCUS: Loaded statistics from {STATS_FILE}]")
                else:
                    print(f"[FOCUS: Warning - Invalid stats format in {STATS_FILE}. Resetting.")
                    _statistics = {
                        "total_inputs": 0, "perturbed_inputs": 0, "typos_applied": 0,
                        "emotions_injected": 0, "expletives_injected": 0, "last_perturbation": None
                    }
        except Exception as e:
            print(f"[FOCUS: Error loading statistics: {e}]")
            # Optionally reset stats if loading fails critically
            _statistics = {
                "total_inputs": 0, "perturbed_inputs": 0, "typos_applied": 0,
                "emotions_injected": 0, "expletives_injected": 0, "last_perturbation": None
            }

    # Display status after loading config and stats
    print("[FOCUS: Action started - Prompt Perturbation Layer ENABLED]")
    print(f"[FOCUS: Features - Typos: {'ON' if _config.get('features', {}).get('typos') else 'OFF'}, " +
          f"Emotions: {'ON' if _config.get('features', {}).get('emotions') else 'OFF'}, " +
          f"Expletives: {'ON' if _config.get('features', {}).get('expletives') else 'OFF'}]")
    print(f"[FOCUS: Global probability: {_config.get('probability', 0.0):.2f}]")

    # --- Save stats on activation (ensures file exists) ---
    save_stats()

async def stop_action():
    """Stop the focus action - save config and stats, reset state"""
    global _is_active

    # --- Save final stats on stop ---
    save_stats()

    # Save configuration before stopping
    save_config()
    _is_active = False

    print("[FOCUS: Action stopped - Prompt Perturbation Layer DISABLED]")

# ===========================
# CONTEXT ANALYSIS FUNCTIONS
# ===========================
def analyze_context(user_input, previous_inputs=[]):
    """Analyze input context"""
    # (No changes needed in this function)
    input_lower = user_input.lower()
    analysis = {
        "base_probability": _config.get("probability", 0.0),
        "triggered": False,
        "triggers": [],
        "effective_probability": _config.get("probability", 0.0)
    }

    triggers_config = _config.get("triggers", {})
    keywords_config = triggers_config.get("keywords", {})
    stress_config = triggers_config.get("stress_indicators", {})

    for keyword, boost in keywords_config.items():
        if keyword in input_lower:
            analysis["triggered"] = True
            analysis["triggers"].append(f"keyword:{keyword}")
            analysis["effective_probability"] += boost

    if 'multiple_punctuation' in stress_config and re.search(r'[!?]{2,}', user_input):
        analysis["triggered"] = True; analysis["triggers"].append("stress:multiple_punctuation"); analysis["effective_probability"] += stress_config["multiple_punctuation"]
    if 'all_caps' in stress_config and re.search(r'\b[A-Z]{3,}\b', user_input):
        analysis["triggered"] = True; analysis["triggers"].append("stress:all_caps"); analysis["effective_probability"] += stress_config["all_caps"]
    if 'repetition' in stress_config and previous_inputs and any(similar_inputs(user_input, prev) for prev in previous_inputs):
        analysis["triggered"] = True; analysis["triggers"].append("stress:repetition"); analysis["effective_probability"] += stress_config["repetition"]

    analysis["effective_probability"] = min(0.9, analysis["effective_probability"]) # Cap probability
    return analysis

def similar_inputs(current, previous):
    """Check similarity (simplified)"""
    # (No changes needed in this function)
    current_norm = re.sub(r'[^\w\s]', '', current.lower())
    previous_norm = re.sub(r'[^\w\s]', '', previous.lower())
    if len(current_norm) < 10 or len(previous_norm) < 10: return current_norm == previous_norm
    current_words = set(current_norm.split()); previous_words = set(previous_norm.split())
    if not current_words or not previous_words: return False
    intersection = len(current_words.intersection(previous_words)); union = len(current_words.union(previous_words))
    similarity = intersection / union if union > 0 else 0
    return similarity > 0.7

# ===========================
# PERTURBATION GENERATORS
# ===========================
def apply_typo(text):
    """Apply a random typo"""
    if not text or len(text) < 4: return text
    words = text.split()
    if not words: return text

    typo_cfg = _config.get("typo_config", {})
    modified = False # Flag to track if a change was actually made

    if typo_cfg.get("preserve_keywords", True):
        candidates = [i for i, word in enumerate(words)
                     if len(word) > 3 and not word.startswith("/") and not word.startswith("@")
                     and not word.startswith("#") and not word.lower() in ["help", "please", "assist", "explain"]]
    else:
        candidates = [i for i, word in enumerate(words) if len(word) > 3]

    if not candidates: return text
    word_idx = random.choice(candidates)
    original_word = words[word_idx]
    word = original_word # Work on a copy

    typo_type = random.choice(["swap", "double", "omit", "add", "replace"])
    # --- (Keep existing typo logic) ---
    adjacent_keys = {
        'a': 'sq', 'b': 'vn', 'c': 'xv', 'd': 'sf', 'e': 'wr', 'f': 'dg',
        'g': 'fh', 'h': 'gj', 'i': 'uo', 'j': 'hk', 'k': 'jl', 'l': 'k',
        'm': 'n', 'n': 'bm', 'o': 'ip', 'p': 'o', 'q': 'wa', 'r': 'et',
        's': 'ad', 't': 'ry', 'u': 'yi', 'v': 'cb', 'w': 'qe', 'x': 'zc',
        'y': 'tu', 'z': 'x'
    }

    if typo_type == "swap" and len(word) > 1:
        pos = random.randint(0, len(word) - 2)
        word = word[:pos] + word[pos+1] + word[pos] + word[pos+2:]
    elif typo_type == "double" and len(word) > 1:
        pos = random.randint(0, len(word) - 1)
        word = word[:pos] + word[pos] + word[pos:]
    elif typo_type == "omit" and len(word) > 1:
        pos = random.randint(0, len(word) - 1)
        word = word[:pos] + word[pos+1:]
    elif typo_type == "add" and len(word) > 1:
        pos = random.randint(0, len(word) - 1)
        if word[pos].lower() in adjacent_keys:
            char_to_add = random.choice(adjacent_keys[word[pos].lower()])
            word = word[:pos] + char_to_add + word[pos:]
    elif typo_type == "replace" and len(word) > 1:
        pos = random.randint(0, len(word) - 1)
        if word[pos].lower() in adjacent_keys:
            char_to_add = random.choice(adjacent_keys[word[pos].lower()])
            word = word[:pos] + char_to_add + word[pos+1:]

    # Check if modification actually happened
    if word != original_word:
        words[word_idx] = word
        _statistics["typos_applied"] += 1
        modified = True # Mark modified
        # Removed frequent save_stats() call here, moved to process_input

    return " ".join(words)


def inject_emotional_marker(text):
    """Inject an emotional marker"""
    emotion_cfg = _config.get("emotion_config", {})
    markers = emotion_cfg.get("markers", [])
    if not markers: return text
    marker = random.choice(markers)
    position = random.choice(["beginning", "middle", "end"])
    if position == "beginning": modified = f"{marker}, {text}"
    elif position == "end": modified = f"{text} ({marker})"
    else:
        words = text.split()
        if len(words) < 3: modified = f"{text} ({marker})"
        else: words.insert(len(words) // 2, f"{marker},"); modified = " ".join(words)
    _statistics["emotions_injected"] += 1
    # Removed frequent save_stats() call here
    return modified

def inject_mild_expletive(text):
    """Inject a mild expletive"""
    expletive_cfg = _config.get("expletive_config", {})
    words = expletive_cfg.get("words", [])
    if not words: return text
    expletive = random.choice(words)
    position = random.choice(["beginning", "middle"])
    if position == "beginning": modified = f"{expletive}, {text}"
    else:
        words = text.split()
        if len(words) < 3: modified = f"{expletive}, {text}"
        else: words.insert(len(words) // 2, f"{expletive}"); modified = " ".join(words)
    _statistics["expletives_injected"] += 1
    # Removed frequent save_stats() call here
    return modified

# ===========================
# COMMAND HANDLING & INPUT PROCESSING
# ===========================
async def process_input(user_input, system_functions=None):
    """Process user input, handle commands, apply perturbations."""
    global _is_active, _config, _statistics, _previous_inputs
    input_lower = user_input.lower().strip()
    is_command = input_lower.startswith("focus ")
    stats_changed = False # Track if stats need saving

    # Increment total_inputs for non-commands when active
    if not is_command and _is_active:
        _statistics["total_inputs"] += 1
        stats_changed = True

    # Return early if not active
    if not _is_active:
        return user_input

    # Handle Focus Commands
    if is_command:
        command_processed = True # Assume processed unless we specifically pass it through
        if input_lower == "focus status": result = get_status_report()
        elif input_lower == "focus config": result = get_config_report()
        elif input_lower == "focus reset": result = reset_config() # Now handles save_config/save_stats
        elif input_lower.startswith("focus set "): result = handle_set_command(user_input[10:].strip()) # Now handles save_config
        elif input_lower.startswith("focus add "): result = handle_add_command(user_input[10:].strip()) # Now handles save_config
        elif input_lower == "focus log on":
            _config["logging"] = True; save_config(); result = "[FOCUS: Logging enabled]"
        elif input_lower == "focus log off":
            _config["logging"] = False; save_config(); result = "[FOCUS: Logging disabled]"
        else:
            result = f"[FOCUS: Unknown command '{input_lower}']" # Handle unknown commands
            # command_processed = False # If you want unknown focus commands to be processed further (unlikely)

        if command_processed: return result # Return the result/confirmation message
        # else: Fall through if command wasn't processed (if needed)

    # Apply Perturbations (if not a command)
    if not is_command:
        # ===========================
        # NEW BLOCK: Check if the input is a system command
        # ===========================
        # If the input is a system command, don't perturb it
        try:
            if command_system.is_command(user_input):
                print(f"[FOCUS: Skipping perturbation for system command: '{user_input}']")
                return user_input
        except Exception as e:
            print(f"[FOCUS: Error checking if input is a command: {e}]")
            # Continue with perturbation if command check fails
        # ===========================
        # END NEW BLOCK
        # ===========================

        context_analysis = analyze_context(user_input, _previous_inputs)
        # Update previous inputs list
        _previous_inputs.append(user_input)
        if len(_previous_inputs) > _max_previous_inputs: _previous_inputs.pop(0)

        if random.random() < context_analysis.get("effective_probability", 0.0):
            original_input = user_input; modified_input = user_input; perturbation_type = None;
            # Select perturbation type
            perturbation_choices = []
            features = _config.get("features", {})
            if features.get("typos"): perturbation_choices.extend(["typo"] * int(_config.get("typo_config", {}).get("probability", 0.0) * 10))
            if features.get("emotions"): perturbation_choices.extend(["emotion"] * int(_config.get("emotion_config", {}).get("probability", 0.0) * 10))
            if features.get("expletives"): perturbation_choices.extend(["expletive"] * int(_config.get("expletive_config", {}).get("probability", 0.0) * 10))

            if perturbation_choices:
                chosen_perturbation = random.choice(perturbation_choices)
                # Store previous stats values to check if they actually changed
                prev_typos = _statistics.get('typos_applied', 0)
                prev_emotions = _statistics.get('emotions_injected', 0)
                prev_expletives = _statistics.get('expletives_injected', 0)

                if chosen_perturbation == "typo":
                    modified_input = apply_typo(user_input); perturbation_type = "typo"
                elif chosen_perturbation == "emotion":
                    modified_input = inject_emotional_marker(user_input); perturbation_type = "emotional_marker"
                elif chosen_perturbation == "expletive":
                    modified_input = inject_mild_expletive(user_input); perturbation_type = "mild_expletive"

                # ===========================
                # NEW BLOCK: Check if perturbation created a command
                # ===========================
                # If the perturbation turned the input into a system command, revert to original
                try:
                    if modified_input != original_input and command_system.is_command(modified_input):
                        print(f"[FOCUS: Reverting perturbation that created a system command]")
                        print(f"[FOCUS: Original: '{original_input}' Modified: '{modified_input}']")
                        # Reset to the original input
                        modified_input = original_input
                        perturbation_type = None
                        
                        # Revert the stats increase that happened in the generator functions
                        if chosen_perturbation == "typo":
                            _statistics["typos_applied"] = prev_typos
                        elif chosen_perturbation == "emotion":
                            _statistics["emotions_injected"] = prev_emotions
                        elif chosen_perturbation == "expletive":
                            _statistics["expletives_injected"] = prev_expletives
                except Exception as e:
                    print(f"[FOCUS: Error checking if perturbation created a command: {e}]")
                # ===========================
                # END NEW BLOCK
                # ===========================

                if modified_input != original_input:
                    _statistics["perturbed_inputs"] += 1
                    stats_changed = True # Mark perturbed_inputs changed
                    _statistics["last_perturbation"] = {
                        "type": perturbation_type, "original": original_input, "modified": modified_input,
                        "timestamp": time.time(), "triggers": context_analysis.get("triggers", [])
                    }
                    # Check if specific counters were incremented inside the generator functions
                    if _statistics.get('typos_applied', 0) > prev_typos or \
                       _statistics.get('emotions_injected', 0) > prev_emotions or \
                       _statistics.get('expletives_injected', 0) > prev_expletives:
                        stats_changed = True

                    log_perturbation(original_input, modified_input, perturbation_type, ', '.join(context_analysis.get("triggers",[])))

            # --- Moved save_stats() outside the perturbation block ---

            if modified_input != original_input:
                 user_input = modified_input # Return the modified version

    # --- Save stats IF they changed during this call ---
    if stats_changed:
        save_stats()

    return user_input

# ===========================
# STATUS & CONFIGURATION REPORTING
# ===========================
def get_status_report():
    """Generate status report"""
    # (No changes needed here, relies on global _statistics)
    features = _config.get("features", {})
    enabled_features = [f.capitalize() for f, enabled in features.items() if enabled]
    features_str = ", ".join(enabled_features) if enabled_features else "None"
    stats = _statistics
    perturb_pct = (stats.get('perturbed_inputs', 0) / max(1, stats.get('total_inputs', 0))) * 100
    report = (
        f"[FOCUS: Status Report]\n"
        f"Active: {'Yes' if _is_active else 'No'}\n"
        f"Enabled Features: {features_str}\n"
        f"Global Probability: {_config.get('probability', 0.0):.2f}\n"
        f"Logging: {'Enabled' if _config.get('logging') else 'Disabled'}\n"
        f"Total Inputs Processed: {stats.get('total_inputs', 0)}\n"
        f"Inputs Perturbed: {stats.get('perturbed_inputs', 0)} ({perturb_pct:.1f}%)\n"
        f"Typos Applied: {stats.get('typos_applied', 0)}\n"
        f"Emotional Markers Injected: {stats.get('emotions_injected', 0)}\n"
        f"Mild Expletives Injected: {stats.get('expletives_injected', 0)}\n"
        f"Command Protection: Enabled\n"  # Added to status report
    )
    if stats.get("last_perturbation"):
        last = stats["last_perturbation"]
        time_ago = time.time() - last.get('timestamp', time.time())
        report += f"\nLast Perturbation ({time_ago:.0f}s ago):\n"
        report += f"Type: {last.get('type', 'N/A')}\n"
        report += f"Triggers: {', '.join(last.get('triggers',[])) if last.get('triggers') else 'None'}\n"
        report += f"Original: {last.get('original','')[:60]}...\n"
        report += f"Modified: {last.get('modified','')[:60]}...\n"
    return report

def get_config_report():
    """Generate config report"""
    # (No changes needed here, relies on global _config)
    report = "[FOCUS: Configuration Report]\n\nFeatures:\n"
    features = _config.get("features", {})
    for feature, enabled in features.items(): report += f"- {feature.capitalize()}: {'Enabled' if enabled else 'Disabled'}\n"
    report += f"\nGlobal Probability: {_config.get('probability', 0.0):.2f}\n"
    typo_cfg = _config.get("typo_config", {})
    report += "\nTypo Configuration:\n"; report += f"- Probability: {typo_cfg.get('probability', 0.0):.2f}\n"; report += f"- Max Typos: {typo_cfg.get('max_typos', 0)}\n"; report += f"- Preserve Keywords: {typo_cfg.get('preserve_keywords', True)}\n"
    emotion_cfg = _config.get("emotion_config", {}); markers = emotion_cfg.get('markers', [])
    report += "\nEmotional Marker Configuration:\n"; report += f"- Probability: {emotion_cfg.get('probability', 0.0):.2f}\n"; report += f"- Markers: {', '.join(markers) if markers else 'None'}\n"
    expletive_cfg = _config.get("expletive_config", {}); words = expletive_cfg.get('words', [])
    report += "\nExpletive Configuration:\n"; report += f"- Probability: {expletive_cfg.get('probability', 0.0):.2f}\n"; report += f"- Words: {', '.join(words) if words else 'None'}\n"
    triggers = _config.get("triggers", {}); keywords = triggers.get('keywords', {}); stress = triggers.get('stress_indicators', {})
    report += "\nTriggers:\n- Keywords:\n"; report += "\n".join([f"  * {key}: +{prob:.2f}" for key, prob in keywords.items()]) + "\n" if keywords else "  * None\n"
    report += "- Stress Indicators:\n"; report += "\n".join([f"  * {key}: +{prob:.2f}" for key, prob in stress.items()]) + "\n" if stress else "  * None\n"
    report += "\nCommand Protection: Enabled\n"  # Added to config report
    return report

# ===========================
# COMMAND HANDLERS (Internal logic)
# ===========================
def handle_set_command(command_args):
    """Internal logic for focus set commands"""
    global _config
    args = command_args.lower().split()
    if len(args) < 2: return "[FOCUS: Invalid set command format]"
    setting, value = args[0], args[1]
    changed = False
    if setting == "typos" and value in ["on", "off", "true", "false"]:
        new_val = value in ["on", "true"]; changed = _config['features']['typos'] != new_val; _config['features']['typos'] = new_val
        if changed: save_config(); return "[FOCUS: Typo perturbations " + ("enabled" if new_val else "disabled") + "]"
    elif setting == "emotions" and value in ["on", "off", "true", "false"]:
        new_val = value in ["on", "true"]; changed = _config['features']['emotions'] != new_val; _config['features']['emotions'] = new_val
        if changed: save_config(); return "[FOCUS: Emotional marker perturbations " + ("enabled" if new_val else "disabled") + "]"
    elif setting == "expletives" and value in ["on", "off", "true", "false"]:
        new_val = value in ["on", "true"]; changed = _config['features']['expletives'] != new_val; _config['features']['expletives'] = new_val
        if changed: save_config(); return "[FOCUS: Mild expletive perturbations " + ("enabled" if new_val else "disabled") + (" - Use with caution" if new_val else "") +"]"
    elif setting == "probability":
        try:
            prob = float(value);
            if 0.0 <= prob <= 1.0:
                changed = _config['probability'] != prob; _config['probability'] = prob
                if changed: save_config(); return f"[FOCUS: Global probability set to {prob:.2f}]"
            else: return "[FOCUS: Probability must be between 0.0 and 1.0]"
        except ValueError: return f"[FOCUS: Invalid probability value '{value}']"
    else:
        return f"[FOCUS: Unknown setting '{setting}']"
    
    return "[FOCUS: No changes applied]" # Return if no actual change occurred


def handle_add_command(command_args):
    """Internal logic for focus add commands"""
    global _config
    args = command_args.split(' ', 1);
    if len(args) < 2: return "[FOCUS: Invalid add format]"
    item_type, word = args[0].lower(), args[1].strip()
    if not word: return "[FOCUS: Word cannot be empty]"

    if item_type == "emotion":
        if word in _config['emotion_config']['markers']: return f"[FOCUS: Emotional marker '{word}' already exists]"
        _config['emotion_config']['markers'].append(word); save_config(); return f"[FOCUS: Added '{word}' to emotional markers]"
    elif item_type == "expletive":
        if not _config['features']['expletives']: return "[FOCUS: Expletives must be enabled first]"
        if word in _config['expletive_config']['words']: return f"[FOCUS: Expletive '{word}' already exists]"
        _config['expletive_config']['words'].append(word); save_config(); return f"[FOCUS: Added '{word}' to mild expletives]"
    else: return f"[FOCUS: Unknown item type '{item_type}']"

def reset_config():
    """Reset configuration and stats to defaults"""
    global _config, _statistics

    # Backup current config
    try:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S"); backup_file = f"focus_config_backup_{ts}.json"
        with open(backup_file, "w", encoding="utf-8") as f: json.dump(_config, f, indent=2)
        print(f"[FOCUS: Created config backup: {backup_file}]")
    except Exception as e: print(f"[FOCUS: Error creating backup: {e}")

    # Define defaults explicitly here
    _config = {
        "features": { "typos": True, "emotions": True, "expletives": False },
        "probability": 0.3,
        "typo_config": { "probability": 0.5, "max_typos": 1, "preserve_keywords": True },
        "emotion_config": { "probability": 0.4, "markers": ["hmm", "wow", "ugh", "sigh", "huh", "hmph", "ah", "oh", "geez", "whoa", "yikes", "sheesh", "meh", "eh", "oof"] },
        "expletive_config": { "probability": 0.1, "words": ["damn", "heck", "darn", "shoot", "crap"] },
        "triggers": {
            "keywords": { "explain": 0.4, "stuck": 0.6, "try again": 0.5, "not working": 0.6, "confused": 0.5, "help": 0.3 },
            "stress_indicators": { "multiple_punctuation": 0.5, "all_caps": 0.6, "repetition": 0.7 }
        },
        "logging": True
    }
    save_config() # Save the reset config

    # Reset statistics
    _statistics = {
        "total_inputs": 0, "perturbed_inputs": 0, "typos_applied": 0,
        "emotions_injected": 0, "expletives_injected": 0, "last_perturbation": None
    }
    save_stats() # Save the reset stats

    return "[FOCUS: Configuration and statistics reset to defaults]"