# lore.py - World Builder Addon (Improved Version 4.0)
#
# IMPROVEMENTS BASED ON RESEARCH:
# 1. Better entity extraction using confidence scoring
# 2. Smarter categorization using context clues
# 3. RapidFuzz for better duplicate detection
# 4. Enhanced alias management
#
# DESIGN PHILOSOPHY & PURPOSE:
# This addon is a comprehensive world-building capture system. It operates on the
# principle that when it is active, ALL non-command discourse is intentional world-building.
# It is designed to be an enthusiastic, hyper-attentive note-taking assistant that errs
# on the side of capturing too much data rather than too little. The goal is to ensure
# no creative element from a storytelling session is lost. False positives are considered
# acceptable and can be cleaned up later; missed content cannot be recovered.
#
# KEY FEATURES (For Future AI Assistants):
# - Fusion Architecture: This code is a deliberate fusion of two designs:
#   1. A powerful, research-based "greedy" capture engine for comprehensive data extraction.
#   2. The robust, system-aware safety checks from a previous stable version.
# - "Good Citizen" Behavior: It uses `_is_system_message` and `_is_command` to avoid
#   interfering with other actions. It will not try to parse "start voice" or "memory status"
#   as lore, ensuring it works harmoniously within the broader application.
# - Robust Saving: The system saves data immediately on startup, every 3 minutes
#   during active use, and once more on shutdown to prevent data loss.
# - Fuzzy Matching: Connects related but slightly different names (e.g., "Bob" and "Bob the Mage")
#   to build richer entity profiles over time.
#
import os
import json
import re
import uuid
import asyncio
from datetime import datetime
from collections import defaultdict
import hashlib

# Try to import RapidFuzz for better matching
try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    from difflib import SequenceMatcher
    RAPIDFUZZ_AVAILABLE = False

# The unique name of this action.
ACTION_NAME = "lore"
# The priority in the loader's processing pipeline.
ACTION_PRIORITY = 8

### --- CONFIGURATION & GLOBAL STATE --- ###

# --- FILENAMES ---
# Using the original filename for front-end compatibility.
LORE_DATA_FILENAME = "lore_data.json"
EXPORT_FILENAME_TEMPLATE = "world_export_{timestamp}.json"

# --- STATE VARIABLES ---
# This dictionary holds all the captured world-building data in memory.
_world_data = {}
# A simple flag to determine if the action is currently running.
_is_active = False
# A temporary list holding metadata about detections from the current session.
_session_data = []
# An in-memory index for fast fuzzy matching of entity names.
_entity_index = {}
# A unique identifier for the current storytelling session.
_current_session_id = None
# The timestamp when the current session started.
_session_start_time = None
# The timestamp of the last successful auto-save.
_last_save_time = None

# --- TUNABLE PARAMETERS ---
# How similar two names must be (from 0.0 to 1.0) to be considered a potential match.
FUZZY_MATCH_THRESHOLD = 0.8
# How often, in seconds, the system will automatically save data during a session.
AUTO_SAVE_INTERVAL = 180  # Save every 3 minutes
# The maximum length for a stored context snippet to keep the JSON file manageable.
MAX_CONTEXT_LENGTH = 500

### --- TAXONOMY & DETECTION PATTERNS --- ###

# A comprehensive, research-based list of categories for world-building elements.
# The 'confidence_boost' helps prioritize the importance of repeated detections in each category.
WORLD_BUILDING_CATEGORIES = {
    "characters": {"priority": 1, "confidence_boost": 2.0},
    "locations": {"priority": 1, "confidence_boost": 1.5},
    "items_artifacts": {"priority": 2, "confidence_boost": 1.3},
    "factions_organizations": {"priority": 2, "confidence_boost": 1.5},
    "events": {"priority": 3, "confidence_boost": 1.2},
    "relationships": {"priority": 3, "confidence_boost": 1.4},
    "rules_systems": {"priority": 4, "confidence_boost": 1.3},
    "cultures_societies": {"priority": 5, "confidence_boost": 1.2},
    "history_timeline": {"priority": 5, "confidence_boost": 1.1},
    "magic_technology": {"priority": 5, "confidence_boost": 1.4},
    "geography": {"priority": 6, "confidence_boost": 1.1},
    "economy_trade": {"priority": 7, "confidence_boost": 1.0},
    "languages": {"priority": 8, "confidence_boost": 1.0},
    "religions_beliefs": {"priority": 6, "confidence_boost": 1.3},
    "conflicts": {"priority": 4, "confidence_boost": 1.2},
    # Meta categories are for tracking the creative process itself.
    "creative_notes": {"priority": 9, "confidence_boost": 1.0},
    "plot_seeds": {"priority": 9, "confidence_boost": 1.0},
    "session_markers": {"priority": 10, "confidence_boost": 1.0}
}

# IMPROVED: Much more comprehensive noise filtering based on research
COMMON_FALSE_POSITIVES = {
    'sentence_starters': {'perhaps', 'maybe', 'however', 'therefore', 'thus', 'indeed', 
                          'actually', 'certainly', 'meanwhile', 'suddenly', 'finally', 
                          'eventually', 'often', 'sometimes', 'although', 'though',
                          'nevertheless', 'nonetheless', 'moreover', 'furthermore'},
    'common_capitals': {'the', 'i', 'a', 'an', 'yes', 'no', 'ok', 'oh', 'ah', 'well', 
                        'now', 'then', 'here', 'there', 'was', 'were', 'been', 'have', 
                        'had', 'will', 'would', 'could', 'should', 'very', 'much', 
                        'just', 'only', 'also', 'still', 'even', 'back', 'again', 
                        'away', 'always', 'never', 'about', 'above', 'below', 'before',
                        'after', 'during', 'while', 'since', 'until', 'unless'},
    'false_patterns': [
        re.compile(r'^(Said|Says?|Replied|Responded|Asked|Answered|Shouted|Whispered)\s+[A-Z]'), 
        re.compile(r'^(Chapter|Section|Part|Book|Volume|Act|Scene)\s+\d'),
        re.compile(r'^(First|Second|Third|Fourth|Fifth|Next|Last|Previous)\s+[A-Z]'),
        re.compile(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s'),
        re.compile(r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s')
    ]
}

# Very "greedy" patterns designed to capture any potential entity name.
ENTITY_PATTERNS = {
    'capitalized': re.compile(r'\b[A-Z][a-zA-Z]+(?:\s+(?:of|the|and)\s+)?[A-Z][a-zA-Z]+\b|\b[A-Z][a-zA-Z]{2,}\b'),
    'quoted': re.compile(r'"([^"]+)"|\'([^\']+)\''),
    'titled': re.compile(r'\b(?:Lord|Lady|Sir|Captain|King|Queen|Prince|Princess|Wizard|Mage|Priest|Elder)\s+[A-Z][a-zA-Z]+'),
    'the_entity': re.compile(r'\bthe\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b')
}

LOCATION_PATTERNS = {
    'prepositions': re.compile(r'\b(?:in|at|on|near|to|from)\s+(?:the\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b', re.I),
    'compound_places': re.compile(r'\b(?:the\s+)?([a-zA-Z\'_]+\s+(?:shop|tavern|inn|temple|tower|castle|fort|palace|market|gate|bridge|hall|house|lair|forest|river|mountain))\b', re.I),
    'possessive_places': re.compile(r"\b([A-Z][a-zA-Z]+(?:'s)?\s+(?:shop|tavern|inn|house|lair|domain|lands|tower|castle|fort))\b", re.I)
}

ITEM_PATTERNS = {
    'described_items': re.compile(r'\b((?:[\w-]+\s+){0,4}(?:sword|axe|shield|armor|staff|wand|ring|amulet|potion|scroll|book|tome|artifact|relic|blade))\b', re.I)
}

# IMPROVED: Context patterns for better categorization
CATEGORIZATION_CONTEXTS = {
    'items_artifacts': ['wield', 'carry', 'hold', 'equip', 'wear', 'use', 'forge', 'craft', 'enchant', 'blessed', 'cursed', 'magical', 'ancient'],
    'creatures': ['creature', 'beast', 'monster', 'animal', 'dragon', 'demon', 'spirit', 'elemental', 'undead', 'hunt', 'tame', 'summon'],
    'factions_organizations': ['guild', 'order', 'clan', 'faction', 'organization', 'member', 'leader', 'founded', 'joined', 'allied', 'rival'],
    'locations': ['city', 'town', 'village', 'kingdom', 'realm', 'forest', 'mountain', 'river', 'sea', 'located', 'traveled', 'visited', 'from'],
    'magic_technology': ['spell', 'magic', 'enchantment', 'ritual', 'cast', 'invoke', 'summon', 'technology', 'device', 'mechanism'],
    'religions_beliefs': ['god', 'goddess', 'deity', 'worship', 'faith', 'temple', 'priest', 'holy', 'sacred', 'divine', 'prayer', 'blessing']
}

### --- CORE ACTION FUNCTIONS (ENTRY POINTS) --- ###

async def start_action(system_functions=None):
    """
    Called by the loader when the action is started.
    This function initializes the world data, creates the JSON file immediately
    to confirm it's working, and starts a new session.
    """
    global _is_active, _last_save_time
    _is_active = True
    _initialize_world()

    # --- IMMEDIATE SAVE ON STARTUP ---
    # This guarantees the file exists from the very beginning.
    await _save_world_data()

    _start_new_session()
    _last_save_time = datetime.now()  # Initialize the auto-save timer.

    total_entries = _world_data.get('meta', {}).get('total_entries', 0)
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Comprehensive World Builder Active!]")
    print(f"[{ACTION_NAME.upper()}: Capturing ALL non-command text. Current world has {total_entries} entries.]")
    if RAPIDFUZZ_AVAILABLE:
        print(f"[{ACTION_NAME.upper()}: Using RapidFuzz for enhanced matching.]")

async def stop_action(system_functions=None):
    """
    Called by the loader when the action is stopped.
    This function performs a final, guaranteed save of all captured data.
    """
    global _is_active
    if not _is_active:
        return
    _is_active = False

    session_detections = len(_session_data)
    _end_current_session()
    await _save_world_data()

    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Session complete with {session_detections} detections.]")
    print(f"[{ACTION_NAME.upper()}: World data saved to {LORE_DATA_FILENAME}]")

async def process_input(user_input: str, system_functions=None, is_system_command=False) -> str:
    """
    Called by the loader for every line of user input. This is a primary pathway for data capture.
    It checks for its own commands, respects commands for other actions, and processes all other
    text as world-building content.
    """
    global _last_save_time
    if not _is_active:
        return user_input

    # --- RELIABLE TIME-BASED AUTO-SAVE ---
    # This check ensures that data is saved periodically during a long session.
    if _last_save_time and (datetime.now() - _last_save_time).total_seconds() > AUTO_SAVE_INTERVAL:
        print(f"[{ACTION_NAME.upper()}: Auto-saving world data...]")
        await _save_world_data()
        _last_save_time = datetime.now()

    input_strip = user_input.strip()
    if not input_strip:
        return user_input

    input_lower = input_strip.lower()

    # First, check if this is a command specifically for the lore action.
    if input_lower.startswith("lore "):
        return await _handle_lore_command(input_strip)

    # Next, use robust filters to ignore system messages and other actions' commands.
    # This is a critical "good citizen" check.
    if _is_system_message(input_strip) or _is_command(input_strip):
        return user_input

    # If it's not a command, process it as world-building content.
    _capture_and_process(input_strip, "user")

    return user_input

async def process_output(ai_response: str, system_functions=None) -> str:
    """
    Called by the loader for every AI response. This is the second pathway for data capture.
    """
    if not _is_active or not ai_response or _is_system_message(ai_response):
        return ai_response

    _capture_and_process(ai_response, "ai")
    return ai_response

### --- DATA CAPTURE & PROCESSING LOGIC --- ###

def _capture_and_process(text: str, source: str):
    """
    The main pipeline for taking raw text and storing it as structured world data.
    1. Extracts all potential data points from the text.
    2. Adds or updates a corresponding entry for each detection.
    3. Logs the detection event for the current session.
    """
    detections = _extract_all_from_text(text, source)
    for detection in detections:
        entry_id = _add_or_update_entry(detection)
        if entry_id:
            _session_data.append({
                "entry_id": entry_id, "category": detection["category"],
                "timestamp": detection["timestamp"], "source": source, "session_id": _current_session_id
            })

def _extract_all_from_text(text: str, source: str) -> list:
    """
    Greedily extracts all potential world-building information from a block of text
    and packages it into structured 'detection' objects.
    """
    detections = []
    
    entities = _extract_entities_comprehensive(text)
    locations = _extract_locations_comprehensive(text)
    items = _extract_items_comprehensive(text)
    
    # Package each raw detection with full metadata for later processing.
    for entity in entities:
        detections.append({"category": _guess_entity_category(entity["name"], text), "data": entity, "context": text, "source": source, "timestamp": datetime.now().isoformat()})
    for location in locations:
        detections.append({"category": "locations", "data": location, "context": text, "source": source, "timestamp": datetime.now().isoformat()})
    for item in items:
        detections.append({"category": "items_artifacts", "data": item, "context": text, "source": source, "timestamp": datetime.now().isoformat()})
    
    # Check for meta-information (the user's creative thoughts).
    if any(phrase in text.lower() for phrase in ["i think", "let's make", "what if", "maybe we should", "i like how"]):
        detections.append({"category": "creative_notes", "data": {"note": text, "type": "creative_decision"}, "context": text, "source": source, "timestamp": datetime.now().isoformat()})
    
    return detections

### --- SAFELISTING & FILTERING --- ###

def _is_system_message(text: str) -> bool:
    """Checks if the text is a system message that should be ignored."""
    text_strip = text.strip()
    return text_strip.startswith("[") or text_strip.startswith("SYSTEM:") or text_strip.startswith("Error:")

def _is_command(text: str) -> bool:
    """
    Checks if the text is a command intended for another action. This is a critical
    "good citizen" function to prevent this addon from interfering with others.
    """
    text_lower = text.lower().strip()
    # If the command starts with "lore", it's for us, so it's not an "other" command.
    if text_lower.startswith("lore "):
        return False
    
    # List of command prefixes from other known actions in the system.
    command_prefixes = [
        "goal ", "start ", "stop ", "api ", "delay", "exit", "save", "load", "fix", "ok", "back", 
        "addon_ai ", "memory ", "persona ", "prompt ", "wiki ", "focus ", "auth ", 
        "principles ", "controls ", "sandbox ", "voice "
    ]
    return any(text_lower.startswith(prefix) for prefix in command_prefixes)

### --- DETECTION & EXTRACTION HELPERS --- ###

def _is_likely_false_positive(text: str, position_in_sentence: str) -> bool:
    """IMPROVED: Much better filters to reduce noise from capitalized words."""
    text_lower = text.lower()
    
    # Check common false positives
    if position_in_sentence == "start" and text_lower in COMMON_FALSE_POSITIVES['sentence_starters']:
        return True
    if text_lower in COMMON_FALSE_POSITIVES['common_capitals']:
        return True
    for pattern in COMMON_FALSE_POSITIVES['false_patterns']:
        if pattern.match(text):
            return True
    
    # NEW: Additional filters based on research
    # Skip single short words
    if ' ' not in text and len(text) < 4:
        return True
    
    # Skip words ending in common verb/adverb suffixes
    if text_lower.endswith(('ing', 'ed', 'ly', 'tion', 'sion', 'ment', 'ness', 'ity')):
        return True
    
    # Skip if it's just "The Something" and appears only once
    if text.startswith("The ") and text.count(" ") == 1:
        return True
        
    return False

def _extract_entities_comprehensive(text: str) -> list:
    """IMPROVED: Better entity extraction with confidence scoring."""
    entities = []
    seen = set()
    
    for match in ENTITY_PATTERNS['capitalized'].finditer(text):
        name = match.group(0)
        is_first_word = match.start() == 0 or text[match.start()-2:match.start()] in ['. ','? ','! ']
        position = "start" if is_first_word else "middle"
        
        if not _is_likely_false_positive(name, position) and name.lower() not in seen:
            # Calculate confidence based on multiple factors
            confidence = 0.5
            
            # Boost confidence for multi-word names
            if ' ' in name:
                confidence += 0.2
            
            # Boost confidence if it appears multiple times
            occurrences = text.count(name)
            if occurrences > 1:
                confidence += 0.1 * min(occurrences, 3)
            
            # Boost confidence if it's in quotes
            if f'"{name}"' in text or f"'{name}'" in text:
                confidence += 0.2
                
            confidence = min(confidence, 0.95)  # Cap at 0.95
            
            entities.append({"name": name, "confidence": confidence, "pattern": "capitalized"})
            seen.add(name.lower())
    
    for match in ENTITY_PATTERNS['the_entity'].finditer(text):
        name = "the " + match.group(1)
        if name.lower() not in seen:
            entities.append({"name": name, "confidence": 0.7, "pattern": "the_entity"})
            seen.add(name.lower())
    
    for match in ENTITY_PATTERNS['titled'].finditer(text):
        name = match.group(0)
        if name.lower() not in seen:
            entities.append({"name": name, "confidence": 0.95, "pattern": "titled"})
            seen.add(name.lower())
    
    # Filter out entities with very low confidence
    return [e for e in entities if e["confidence"] >= 0.6]

def _extract_locations_comprehensive(text: str) -> list:
    """Extracts all potential location references."""
    locations = []
    seen = set()
    for pattern_name, pattern in LOCATION_PATTERNS.items():
        for match in pattern.finditer(text):
            name = match.group(1) if pattern_name != 'prepositions' else match.group(0)
            name = ' '.join(word.capitalize() for word in name.split()) # Normalize
            if name.lower() not in seen and not _is_likely_false_positive(name, "middle"):
                locations.append({"name": name, "confidence": 0.9 if pattern_name.endswith('_places') else 0.7})
                seen.add(name.lower())
    return locations

def _extract_items_comprehensive(text: str) -> list:
    """Extracts potential item/artifact references."""
    items = []
    seen = set()
    for match in ITEM_PATTERNS['described_items'].finditer(text):
        name = match.group(1).strip().title()
        if len(name.split()) > 1 and name.lower() not in seen:
            items.append({"name": name, "confidence": 0.85})
            seen.add(name.lower())
    return items

def _guess_entity_category(name: str, context: str) -> str:
    """IMPROVED: Much better category guessing using context clues."""
    context_lower = context.lower()
    name_lower = name.lower()
    
    # Check each category's context patterns
    best_category = "characters"  # Default
    best_score = 0
    
    for category, keywords in CATEGORIZATION_CONTEXTS.items():
        score = 0
        for keyword in keywords:
            if keyword in context_lower:
                # Proximity bonus - keyword closer to entity name gets higher score
                distance = abs(context_lower.find(keyword) - context_lower.find(name_lower))
                if distance < 50:  # Within ~50 characters
                    score += 2
                else:
                    score += 1
        
        if score > best_score:
            best_score = score
            best_category = category
    
    # Special case: if it's a creature-like name pattern
    if any(suffix in name_lower for suffix in ['dragon', 'beast', 'demon', 'spirit']):
        return "creatures"
    
    return best_category

### --- DATA MANAGEMENT (INITIALIZE, SAVE, UPDATE) --- ###

def _initialize_world():
    """Initializes a new world data structure or loads an existing one."""
    global _world_data
    if os.path.exists(LORE_DATA_FILENAME):
        try:
            with open(LORE_DATA_FILENAME, "r", encoding="utf-8") as f:
                _world_data = json.load(f)
            # Retroactively add any new category keys to the loaded data.
            for cat in WORLD_BUILDING_CATEGORIES:
                if cat not in _world_data: _world_data[cat] = {}
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}: ERROR loading {LORE_DATA_FILENAME}: {e}. Starting fresh.")
            _world_data = _create_empty_world()
    else:
        _world_data = _create_empty_world()
    _rebuild_entity_index()

def _create_empty_world() -> dict:
    """Returns a dictionary representing a new, empty world structure."""
    world = {"meta": {"world_name": "New World", "created_at": datetime.now().isoformat(), "sessions": [], "total_entries": 0}}
    for category in WORLD_BUILDING_CATEGORIES:
        world[category] = {}
    return world

async def _save_world_data():
    """Saves the current world data to JSON using an atomic write method."""
    _world_data["meta"]["last_updated"] = datetime.now().isoformat()
    _world_data["meta"]["total_entries"] = sum(len(entries) for cat, entries in _world_data.items() if cat != "meta")
    
    # Atomic write: write to a temporary file, then rename it. This prevents data
    # corruption if the program crashes mid-save.
    temp_file = LORE_DATA_FILENAME + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(_world_data, f, indent=2)
        os.replace(temp_file, LORE_DATA_FILENAME)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: ERROR saving world data: {e}]")

def _add_or_update_entry(detection: dict):
    """
    IMPROVED: Better duplicate detection and merging using RapidFuzz when available.
    """
    category, data = detection["category"], detection["data"]
    entry_name = data.get("name")
    if not entry_name: return None
    
    # Find existing entries that might be a match.
    matches = _fuzzy_match_entity(entry_name)
    
    # Better threshold handling
    if matches:
        best_match = matches[0]
        matched_cat, matched_key, score = best_match
        
        # Very high confidence match
        if score >= 0.95 and matched_cat == category:
            _update_existing_entry(category, matched_key, detection)
            return matched_key
        
        # Check if it's likely a name variant (e.g., "Sho" vs "Sho the Crossbowman")
        if score >= FUZZY_MATCH_THRESHOLD and matched_cat == category:
            if _is_likely_name_variant(entry_name, matched_key):
                _update_existing_entry(category, matched_key, detection)
                return matched_key

    # If no suitable match is found, create a new entry.
    entry_id = _generate_entry_id(category, entry_name)
    new_entry = {
        "id": entry_id, "name": entry_name,
        "created": detection["timestamp"], "updated": detection["timestamp"],
        "mentions": 1, "confidence": data.get("confidence", 0.5),
        "first_session": _current_session_id, "sessions": [_current_session_id],
        "detection_patterns": [data.get("pattern")],
        "contexts": [{"text": _truncate_context(detection["context"]), "timestamp": detection["timestamp"], "session_id": _current_session_id, "source": detection["source"]}]
    }
    _world_data[category][entry_id] = new_entry
    _entity_index[entry_name.lower()].append((category, entry_id))
    return entry_id

def _update_existing_entry(category: str, entry_key: str, detection: dict):
    """Applies new information from a detection to an existing entry."""
    entry = _world_data[category][entry_key]
    data, context, source = detection["data"], detection["context"], detection["source"]

    # Increase mention count and recalculate confidence.
    entry["mentions"] = entry.get("mentions", 0) + 1
    old_conf, new_conf = entry.get("confidence", 0.5), data.get("confidence", 0.5)
    boost = WORLD_BUILDING_CATEGORIES.get(category, {}).get("confidence_boost", 1.0)
    entry["confidence"] = min(1.0, (old_conf * (entry["mentions"] - 1) + new_conf * boost) / entry["mentions"])

    # Track which sessions this entity has appeared in.
    if _current_session_id not in entry.get("sessions", []):
        entry.setdefault("sessions", []).append(_current_session_id)
    
    # Add the new context where the entity was mentioned.
    entry.setdefault("contexts", []).append({
        "text": _truncate_context(context), "timestamp": detection["timestamp"], "session_id": _current_session_id, "source": source
    })
    entry["contexts"] = entry["contexts"][-20:] # Keep the last 20 contexts for relevance.

    # If the new name is a slight variation, add it as an alias.
    new_name = data.get("name")
    if new_name and new_name.lower() != entry["name"].lower():
        if "aliases" not in entry: entry["aliases"] = []
        if new_name not in entry["aliases"]:
            entry["aliases"].append(new_name)
            _entity_index[new_name.lower()].append((category, entry_key))
    
    entry["updated"] = detection["timestamp"]

### --- SESSION MANAGEMENT & UTILITY HELPERS --- ###

def _start_new_session(session_name: str = None):
    """Creates a new session record in the metadata."""
    global _current_session_id, _session_start_time, _session_data
    _session_data = []
    _session_start_time = datetime.now()
    _current_session_id = f"session_{_session_start_time.strftime('%Y%m%d_%H%M%S')}"
    session_info = {"id": _current_session_id, "name": session_name or f"Session {_session_start_time.strftime('%Y-%m-%d %H:%M')}", "started": _session_start_time.isoformat(), "ended": None}
    _world_data["meta"].setdefault("sessions", []).append(session_info)

def _end_current_session():
    """Finalizes the current session's metadata."""
    if not _current_session_id: return
    for session in _world_data["meta"]["sessions"]:
        if session["id"] == _current_session_id:
            session["ended"] = datetime.now().isoformat()
            duration_minutes = (_session_start_time and (datetime.now() - _session_start_time).total_seconds() / 60) or 0
            session["duration_minutes"] = round(duration_minutes, 1)
            session["detections"] = len(_session_data)
            break
    _current_session_id = None

def _fuzzy_match_entity(name: str) -> list:
    """IMPROVED: Uses RapidFuzz when available for much faster matching."""
    name_lower = name.lower()
    matches = []
    
    # Exact matches first
    if name_lower in _entity_index:
        for cat, key in _entity_index[name_lower]:
            matches.append((cat, key, 1.0))
    
    if RAPIDFUZZ_AVAILABLE:
        # Use RapidFuzz for fast fuzzy matching
        candidates = {k: v for k, v in _entity_index.items() if k != name_lower}
        if candidates:
            # WRatio handles different word orders better
            rapid_matches = process.extract(
                name_lower, 
                candidates.keys(), 
                scorer=fuzz.WRatio,
                score_cutoff=FUZZY_MATCH_THRESHOLD * 100
            )
            
            for matched_name, score, _ in rapid_matches:
                for cat, key in candidates[matched_name]:
                    matches.append((cat, key, score / 100.0))
    else:
        # Fallback to SequenceMatcher
        for indexed_name, locations in _entity_index.items():
            if indexed_name != name_lower:
                similarity = SequenceMatcher(None, name_lower, indexed_name).ratio()
                if similarity >= FUZZY_MATCH_THRESHOLD:
                    for cat, key in locations:
                        matches.append((cat, key, similarity))
    
    return sorted(matches, key=lambda x: x[2], reverse=True)

def _is_likely_name_variant(name1: str, entry_key: str) -> bool:
    """NEW: Detects if name1 is a variant of an existing entity."""
    # Get the stored entity
    for cat, entries in _world_data.items():
        if cat != "meta" and entry_key in entries:
            stored_name = entries[entry_key].get("name", "")
            break
    else:
        return False
    
    name1_lower = name1.lower()
    stored_lower = stored_name.lower()
    
    # Pattern 1: One contains the other
    if name1_lower in stored_lower or stored_lower in name1_lower:
        return True
    
    # Pattern 2: Same first word (titles/epithets)
    name1_first = name1.split()[0].lower()
    stored_first = stored_name.split()[0].lower()
    if name1_first == stored_first:
        return True
    
    # Pattern 3: Remove common titles and compare
    for title in ['lord', 'lady', 'sir', 'captain', 'king', 'queen', 'prince', 'princess']:
        name1_cleaned = name1_lower.replace(title + ' ', '')
        stored_cleaned = stored_lower.replace(title + ' ', '')
        if name1_cleaned == stored_cleaned:
            return True
    
    return False

def _rebuild_entity_index():
    """Reconstructs the in-memory search index from the main world data."""
    global _entity_index
    _entity_index = defaultdict(list)
    for category, entries in _world_data.items():
        if category == "meta": continue
        for key, entry in entries.items():
            names_to_index = [entry.get("name")] + entry.get("aliases", [])
            for name in filter(None, names_to_index):
                _entity_index[name.lower()].append((category, key))

def _generate_entry_id(category: str, name: str) -> str:
    """Generates a unique, human-readable ID for a new entry to prevent key collisions."""
    base_id = re.sub(r'[^a-z0-9_]', '', name.lower().replace(" ", "_"))[:30]
    entry_id = base_id
    counter = 1
    while entry_id in _world_data.get(category, {}):
        entry_id = f"{base_id}_{counter}"
        counter += 1
    return entry_id

def _truncate_context(context: str, max_len: int = MAX_CONTEXT_LENGTH) -> str:
    """Utility to shorten context strings for storage."""
    return context if len(context) <= max_len else context[:max_len-3] + "..."

### --- COMMAND HANDLER --- ###

async def _handle_lore_command(command: str) -> str:
    """Internal router for all 'lore ...' commands."""
    parts = command.strip().split(maxsplit=2)
    cmd = parts[1].lower() if len(parts) > 1 else "help"
    args = parts[2] if len(parts) > 2 else ""

    if cmd == "help":
        return ("[LORE COMMANDS]\n"
                "lore status - World capture statistics\n"
                "lore export - Save world data to a readable file\n"
                "lore find <term> - Search for an entity across all categories\n"
                "lore list [category] - List entries. If no category, list categories.")

    elif cmd == "status":
        stats = {cat: len(entries) for cat, entries in _world_data.items() if cat != "meta"}
        total = sum(stats.values())
        session_info = f"This Session: {len(_session_data)} new detections."
        matcher_info = f"Matching: {'RapidFuzz (fast)' if RAPIDFUZZ_AVAILABLE else 'SequenceMatcher (basic)'}"
        return (f"[LORE STATUS: World '{_world_data['meta'].get('world_name')}']\n"
                f"Total Entries: {total}\n" +
                "\n".join(f"  - {cat.title()}: {count}" for cat, count in sorted(stats.items(), key=lambda x: x[1], reverse=True)[:5]) +
                f"\n{session_info}\n{matcher_info}")

    elif cmd == "export":
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = EXPORT_FILENAME_TEMPLATE.format(timestamp=timestamp)
        export_data = {"meta": _world_data["meta"], "world": {cat: list(entries.values()) for cat, entries in _world_data.items() if cat != "meta"}}
        try:
            with open(filename, "w", encoding="utf-8") as f: json.dump(export_data, f, indent=2)
            return f"[LORE: World exported to {filename}]"
        except Exception as e:
            return f"[LORE: Export failed - {e}]"
            
    elif cmd == "find":
        if not args: return "[LORE: Usage: lore find <search term>]"
        matches = _fuzzy_match_entity(args)
        if not matches: return f"[LORE: No matches found for '{args}']"
        results = [f"[LORE: Found {len(matches)} potential matches for '{args}']"]
        for cat, key, sim in matches[:5]:
            entry = _world_data.get(cat, {}).get(key, {})
            results.append(f"- {entry.get('name', key)} ({cat}, score: {sim:.2f}, mentions: {entry.get('mentions', 1)})")
        return "\n".join(results)

    elif cmd == "list":
        if not args:
            categories = sorted([cat for cat in _world_data if cat != "meta" and _world_data[cat]])
            return "[LORE: Available Categories]\n" + ", ".join(categories)
        
        category = args.lower().replace(" ", "_")
        if category not in _world_data or not _world_data[category]:
            return f"[LORE: No entries found for category '{category}']"
        
        entries = _world_data[category].values()
        sorted_entries = sorted(entries, key=lambda x: x.get('confidence', 0), reverse=True)
        
        results = [f"[LORE: Top 10 entries in '{category}']"]
        for entry in sorted_entries[:10]:
            results.append(f"- {entry.get('name')} (conf: {entry.get('confidence', 0):.2f}, mentions: {entry.get('mentions', 1)})")
        return "\n".join(results)

    else:
        return f"[LORE: Unknown command '{cmd}'. Use 'lore help'.]"