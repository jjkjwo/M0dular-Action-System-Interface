# emotions.py - Conversation Emotion Tracker with Karma Integration
import os
import re
import json
import time
import asyncio
from datetime import datetime
from collections import defaultdict, deque

# Attempt to import karma for integration
try:
    import karma
    KARMA_AVAILABLE = True
except ImportError:
    KARMA_AVAILABLE = False
    print(f"[EMOTIONS: WARNING - karma.py not found. Karma suggestions disabled.]")

# Action metadata
ACTION_NAME = "emotions"
ACTION_PRIORITY = 9  # Medium priority, runs after content modifiers but before memory

# Constants
EMOTIONS_FILE = "emotions.txt"
MAX_HISTORY_TURNS = 15  # Keep last 15 turn-pairs
USER_WEIGHT_MULTIPLIER = 2.0  # User emotions weighted 2x vs assistant

# Karma suggestion configuration
KARMA_SUGGESTION_CONFIG = {
    "enabled": True,
    "check_interval": 3,  # Check every N turns
    "emotion_weights": {
        # Positive emotions
        "joy": 1.0,
        "gratitude": 1.2,
        "trust": 0.8,
        "anticipation": 0.6,
        # Negative emotions
        "anger": -1.0,
        "frustration": -1.0,
        "sadness": -0.8,
        "disgust": -0.8,
        "fear": -0.6,
        # Neutral
        "neutral": 0.0,
        "curiosity": 0.0,
        "surprise": 0.0,
        "confusion": -0.2
    },
    "threshold": 0.3,  # Minimum absolute score to suggest karma
    "max_suggestion": 1.0,  # Cap suggestions at +/- 1.0
}

# State variables
_is_emotions_active = False
_turn_counter = 0
_message_history = deque(maxlen=MAX_HISTORY_TURNS * 2)  # Store both user and assistant messages
_current_emotions = []
_emotion_history = {}  # Track emotions over time
_karma_suggestion_turn = 0  # Turn counter for karma suggestions

# Emotion keywords with weights - extensive mapping for accurate detection
_emotion_keywords = {
    "joy": {
        "happy": 1.0, "excited": 0.9, "delighted": 1.0, "pleased": 0.8, "glad": 0.8, 
        "cheerful": 0.9, "content": 0.7, "thrilled": 1.0, "enjoy": 0.8, "smile": 0.6,
        "wonderful": 0.7, "love": 0.7, "great": 0.6, "amazing": 0.8, "fantastic": 0.8,
        "excellent": 0.7, "perfect": 0.8, "yay": 1.0, "awesome": 0.9, "nice": 0.6
    },
    "sadness": {
        "sad": 1.0, "unhappy": 0.9, "depressed": 1.0, "down": 0.6, "upset": 0.8,
        "disappointed": 0.9, "miserable": 1.0, "heartbroken": 1.0, "blue": 0.6, "cry": 0.8,
        "terrible": 0.7, "awful": 0.7, "lost": 0.5, "miss": 0.6, "regret": 0.8,
        "lonely": 0.9, "grief": 1.0, "sorrow": 1.0, "despair": 1.0, "hurt": 0.7
    },
    "anger": {
        "angry": 1.0, "mad": 0.9, "furious": 1.0, "outraged": 1.0, "irritated": 0.8,
        "annoyed": 0.7, "frustrated": 0.8, "hate": 0.9, "rage": 1.0, "upset": 0.7,
        "aggressive": 0.8, "hostile": 0.9, "bitter": 0.7, "resentful": 0.8, "indignant": 0.8,
        "disgusted": 0.7, "offended": 0.8, "fuming": 1.0, "contempt": 0.8, "enraged": 1.0
    },
    "fear": {
        "afraid": 1.0, "scared": 1.0, "frightened": 1.0, "terrified": 1.0, "anxious": 0.8,
        "worried": 0.7, "nervous": 0.8, "panic": 0.9, "dread": 0.9, "horror": 0.9,
        "concern": 0.6, "alarmed": 0.8, "stress": 0.7, "uneasy": 0.7, "hesitant": 0.6,
        "suspicious": 0.6, "doubt": 0.5, "insecure": 0.7, "threatened": 0.8, "afraid": 1.0
    },
    "surprise": {
        "surprised": 1.0, "shocked": 0.9, "amazed": 0.9, "astonished": 1.0, "stunned": 0.9,
        "startled": 0.9, "unexpected": 0.7, "wow": 1.0, "speechless": 0.8, "wonder": 0.7,
        "disbelief": 0.8, "whoa": 1.0, "sudden": 0.6, "unbelievable": 0.8, "incredible": 0.7,
        "unexpected": 0.7, "shocking": 0.8, "bewildered": 0.8, "unprepared": 0.6, "unpredicted": 0.7
    },
    "disgust": {
        "disgusted": 1.0, "gross": 0.9, "revolting": 1.0, "nasty": 0.9, "repulsed": 1.0,
        "sickened": 0.9, "distaste": 0.8, "yuck": 1.0, "nauseous": 0.7, "eww": 1.0,
        "hideous": 0.7, "repulsive": 0.9, "dislike": 0.6, "awful": 0.7, "repugnant": 0.9,
        "offensive": 0.7, "revolted": 1.0, "abhorrent": 0.9, "distasteful": 0.8, "loathsome": 0.9
    },
    "trust": {
        "trust": 1.0, "believe": 0.8, "faith": 0.9, "confident": 0.8, "reliable": 0.9,
        "honest": 0.9, "loyal": 0.9, "dependable": 0.9, "truthful": 0.9, "secure": 0.8,
        "assured": 0.8, "certain": 0.7, "reliance": 0.9, "integrity": 0.8, "credible": 0.9,
        "supportive": 0.7, "devoted": 0.8, "steadfast": 0.8, "trustworthy": 1.0, "authentic": 0.8
    },
    "anticipation": {
        "anticipate": 1.0, "expect": 0.8, "await": 0.9, "forward": 0.7, "hope": 0.8,
        "looking forward": 0.9, "excited": 0.8, "eager": 0.9, "ready": 0.7, "prepared": 0.6,
        "anticipation": 1.0, "awaiting": 0.9, "keen": 0.8, "enthusiastic": 0.8, "hopeful": 0.8,
        "impatient": 0.7, "longing": 0.8, "yearning": 0.9, "anxious": 0.6, "expectant": 0.9
    },
    "curiosity": {
        "curious": 1.0, "wonder": 0.9, "interested": 0.8, "intrigued": 0.9, "fascinated": 0.9,
        "questioning": 0.7, "exploring": 0.7, "seeking": 0.7, "learning": 0.6, "inquisitive": 1.0,
        "investigating": 0.8, "puzzled": 0.7, "investigate": 0.8, "inquire": 0.9, "discover": 0.7,
        "probing": 0.8, "searching": 0.6, "study": 0.5, "research": 0.6, "examine": 0.6
    },
    "confusion": {
        "confused": 1.0, "puzzled": 0.9, "perplexed": 1.0, "baffled": 0.9, "bewildered": 0.9,
        "unsure": 0.8, "uncertain": 0.8, "unclear": 0.7, "lost": 0.6, "misunderstand": 0.8,
        "muddled": 0.9, "disoriented": 0.9, "mystified": 0.9, "vague": 0.6, "ambiguous": 0.7,
        "disorganized": 0.6, "jumbled": 0.7, "mixed up": 0.8, "foggy": 0.7, "unfamiliar": 0.6
    },
    "gratitude": {
        "grateful": 1.0, "thankful": 1.0, "appreciate": 0.9, "thanks": 0.8, "thank you": 0.9,
        "gratitude": 1.0, "indebted": 0.8, "obliged": 0.7, "recognition": 0.6, "acknowledgment": 0.7,
        "appreciative": 0.9, "blessed": 0.8, "pleased": 0.6, "humbled": 0.7, "recognized": 0.6,
        "honored": 0.7, "moved": 0.6, "touched": 0.7, "welcomed": 0.5, "valued": 0.7
    },
    "frustration": {
        "frustrated": 1.0, "annoyed": 0.8, "irritated": 0.8, "aggravated": 0.9, "exasperated": 0.9,
        "vexed": 0.8, "troubled": 0.7, "upset": 0.7, "difficult": 0.5, "struggle": 0.7,
        "nuisance": 0.7, "bothered": 0.7, "irritation": 0.8, "agitated": 0.8, "displeased": 0.7,
        "disgruntled": 0.8, "fed up": 0.9, "impatient": 0.7, "hindered": 0.6, "problems": 0.5
    },
    "neutral": {
        "ok": 0.7, "fine": 0.7, "alright": 0.7, "neutral": 1.0, "indifferent": 0.9,
        "unaffected": 0.8, "detached": 0.8, "dispassionate": 0.9, "unbiased": 0.8, "objective": 0.7,
        "calm": 0.7, "steady": 0.6, "balanced": 0.6, "standard": 0.5, "typical": 0.5,
        "ordinary": 0.5, "common": 0.5, "regular": 0.5, "middle": 0.5, "average": 0.5
    }
}

# Negation words that flip emotion valence
_negation_words = [
    "not", "no", "never", "neither", "nor", "none", "hardly", "barely", 
    "scarcely", "seldom", "rarely", "don't", "doesn't", "didn't", 
    "won't", "wouldn't", "can't", "cannot", "couldn't", "isn't", "aren't", 
    "wasn't", "weren't", "hasn't", "haven't", "hadn't"
]

# Context dependent phrases that need more careful handling
_context_phrases = {
    "not happy": "sadness",
    "not sad": "joy",
    "no worries": "trust",
    "not afraid": "trust",
    "not bad": "neutral",
    "not good": "sadness",
    "never fear": "trust",
    "don't worry": "trust",
    "no problem": "neutral"
}

def initialize_files():
    """Initialize the emotions.txt file if it doesn't exist."""
    if not os.path.exists(EMOTIONS_FILE):
        with open(EMOTIONS_FILE, "w", encoding="utf-8") as f:
            f.write("# Conversation Emotions Tracker\n# Format: timestamp|user/ai|emotion1,emotion2,...\n")
        print(f"[{ACTION_NAME.upper()} ACTION: Created {EMOTIONS_FILE}]")

def reset_emotion_state():
    """Reset the emotion tracking state."""
    global _turn_counter, _message_history, _current_emotions, _emotion_history, _karma_suggestion_turn
    _turn_counter = 0
    _message_history.clear()
    _current_emotions = []
    _emotion_history = {}
    _karma_suggestion_turn = 0
    
    # Clear the emotions file
    with open(EMOTIONS_FILE, "w", encoding="utf-8") as f:
        f.write("# Conversation Emotions Tracker\n# Format: timestamp|user/ai|emotion1,emotion2,...\n")
    
    print(f"[{ACTION_NAME.upper()} ACTION: Emotion tracking reset]")

# Fixed function to handle notification safely
async def _notify_user(system_functions, message):
    """Safely notify the user through system_functions."""
    if not system_functions or "user_notification" not in system_functions:
        print(f"[{ACTION_NAME.upper()} ACTION: {message}]")
        return
    
    notify_func = system_functions["user_notification"]
    if not callable(notify_func):
        print(f"[{ACTION_NAME.upper()} ACTION: Cannot notify - user_notification not callable]")
        return
    
    full_message = f"[{ACTION_NAME.upper()} ACTION]: {message}"
    
    # Check if the function is a coroutine function (awaitable)
    if asyncio.iscoroutinefunction(notify_func):
        try:
            await notify_func(full_message)
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ACTION: Error in async notification: {e}]")
    else:
        # Call directly if it's a regular function
        try:
            notify_func(full_message)
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ACTION: Error in notification: {e}]")

async def start_action(system_functions=None):
    """Function called when emotions action is started."""
    global _is_emotions_active
    _is_emotions_active = True
    initialize_files()
    reset_emotion_state()
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Now tracking conversation emotions]")
    
    # Use the safer notification function
    if system_functions:
        await _notify_user(system_functions, 
                          "Now tracking conversation emotions. Use 'emotions status' to see current emotions, 'emotions reset' to clear.")
    
    if not KARMA_AVAILABLE:
        print(f"[{ACTION_NAME.upper()}: WARNING - karma.py not found. Karma suggestions disabled.]")

async def stop_action(system_functions=None):
    """Function called when emotions action is stopped."""
    global _is_emotions_active
    _is_emotions_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - No longer tracking conversation emotions]")
    
    # Use the safer notification function
    if system_functions:
        await _notify_user(system_functions, "Stopped tracking conversation emotions.")

def check_for_negations(text, emotion_keyword):
    """Check if an emotion keyword is negated in the text."""
    # Simple negation check using regex to find negation words before emotions
    negation_pattern = r"(" + "|".join(_negation_words) + r")\s+\w*\s*" + re.escape(emotion_keyword)
    return bool(re.search(negation_pattern, text.lower()))

def detect_emotions(text, role="user"):
    """Detect emotions in the provided text with optional negation handling."""
    text = text.lower()
    
    # Initialize emotion scores
    emotion_scores = defaultdict(float)
    
    # First check for context-dependent phrases
    for phrase, mapped_emotion in _context_phrases.items():
        if phrase in text:
            emotion_scores[mapped_emotion] += 1.0
    
    # Then check individual emotion keywords
    for emotion, keywords in _emotion_keywords.items():
        for keyword, weight in keywords.items():
            # Count occurrences of the keyword
            matches = re.finditer(r'\b' + re.escape(keyword) + r'\b', text)
            match_count = sum(1 for _ in matches)
            
            if match_count > 0:
                # Check for negations for this keyword
                if not check_for_negations(text, keyword):
                    # Apply weight - multiply by 2 for user messages
                    multiplier = USER_WEIGHT_MULTIPLIER if role == "user" else 1.0
                    emotion_scores[emotion] += weight * match_count * multiplier
    
    # Get the top emotions (with scores > 0.5)
    top_emotions = [(emotion, score) for emotion, score in 
                   sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True) 
                   if score > 0.5]
    
    # Default to neutral if no strong emotions detected
    if not top_emotions:
        return ["neutral"]
    
    # Return just the emotion names, limited to top 3
    return [emotion for emotion, _ in top_emotions[:3]]

def record_emotions(emotions, role="user"):
    """Record emotions to the emotions.txt file."""
    global _current_emotions
    
    # Update current emotions (giving precedence to user emotions)
    if role == "user" or not _current_emotions:
        _current_emotions = emotions
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        with open(EMOTIONS_FILE, "a", encoding="utf-8") as f:
            f.write(f"{timestamp}|{role}|{','.join(emotions)}\n")
        print(f"[{ACTION_NAME.upper()} ACTION: Recorded {role} emotions: {', '.join(emotions)}]")
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: Error recording emotions: {e}]")
        return False

def analyze_message(message, role="user"):
    """Analyze a message for emotions and record them."""
    global _turn_counter, _message_history
    
    # Add message to history
    _message_history.append({"role": role, "text": message})
    
    # Only record emotions after first turn (for user) or after user has spoken (for assistant)
    if (role == "user" and _turn_counter > 0) or (role == "assistant" and _turn_counter > 0):
        emotions = detect_emotions(message, role)
        record_emotions(emotions, role)
        return emotions
    
    return []

def calculate_karma_suggestion():
    """Calculate karma suggestion based on current emotional state."""
    if not KARMA_AVAILABLE or not KARMA_SUGGESTION_CONFIG["enabled"]:
        return None
    
    # Get recent emotions (last 3 messages)
    recent_emotions = []
    for msg in list(_message_history)[-6:]:  # Last 3 turn pairs
        if msg["role"] == "user":
            emotions = detect_emotions(msg["text"], "user")
            recent_emotions.extend(emotions)
    
    if not recent_emotions:
        return None
    
    # Calculate weighted score
    emotion_score = 0.0
    emotion_counts = {}
    
    for emotion in recent_emotions:
        weight = KARMA_SUGGESTION_CONFIG["emotion_weights"].get(emotion, 0.0)
        emotion_score += weight
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
    
    # Average the score
    if recent_emotions:
        emotion_score /= len(recent_emotions)
    
    # Check threshold
    if abs(emotion_score) < KARMA_SUGGESTION_CONFIG["threshold"]:
        return None
    
    # Cap the suggestion
    suggestion = max(-KARMA_SUGGESTION_CONFIG["max_suggestion"], 
                    min(KARMA_SUGGESTION_CONFIG["max_suggestion"], emotion_score))
    
    # Build reason
    top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    emotion_summary = ", ".join([f"{e[0]}({e[1]})" for e in top_emotions])
    reason = f"Emotional tone: {emotion_summary}"
    
    return {"amount": round(suggestion, 2), "reason": reason}

async def process_input(user_input, system_functions):
    """Process user input for emotion tracking."""
    global _is_emotions_active, _turn_counter, _karma_suggestion_turn
    
    if not _is_emotions_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    
    # Command handling
    if input_lower == "emotions status":
        emotion_str = ", ".join(_current_emotions) if _current_emotions else "neutral"
        await _notify_user(system_functions, f"Current conversation emotions: {emotion_str}")
        return f"[{ACTION_NAME.upper()} ACTION: Current emotions: {emotion_str}]"
    
    elif input_lower == "emotions reset":
        reset_emotion_state()
        await _notify_user(system_functions, "Emotion tracking has been reset.")
        return f"[{ACTION_NAME.upper()} ACTION: Emotion tracking reset]"
    
    elif input_lower == "emotions get current":
        current_emotions = get_current_emotions()
        # Return the raw data for the agent to use
        return json.dumps(current_emotions)

    elif input_lower == "emotions get history":
        history = get_emotion_history()
        # Return the raw data for the agent to use
        return json.dumps(history)
    
    elif input_lower == "emotions karma status":
        status_info = [
            f"[{ACTION_NAME.upper()} KARMA INTEGRATION STATUS]",
            f"Karma module available: {KARMA_AVAILABLE}",
            f"Karma suggestions enabled: {KARMA_SUGGESTION_CONFIG['enabled']}",
            f"Check interval: every {KARMA_SUGGESTION_CONFIG['check_interval']} turns",
            f"Current turn counter: {_karma_suggestion_turn}/{KARMA_SUGGESTION_CONFIG['check_interval']}",
            f"Emotion score threshold: {KARMA_SUGGESTION_CONFIG['threshold']}",
            f"Max suggestion: ±{KARMA_SUGGESTION_CONFIG['max_suggestion']}"
        ]
        return "\n".join(status_info)
    
    # Process user message for emotions
    analyze_message(user_input, "user")
    
    # Check for first turn
    if _turn_counter == 0:
        _turn_counter += 1
        print(f"[{ACTION_NAME.upper()} ACTION: First turn detected - Initialize emotion tracking]")
    else:
        _turn_counter += 1
    
    # Get last AI message if available (using system_functions)
    last_ai_reply = None
    if system_functions and "last_ai_reply" in system_functions:
        last_ai_reply_func = system_functions["last_ai_reply"]
        if last_ai_reply_func and callable(last_ai_reply_func):
            try:
                last_ai_reply = last_ai_reply_func()
            except Exception as e:
                print(f"[{ACTION_NAME.upper()} ACTION: Error getting last AI reply: {e}]")
    
    if last_ai_reply:
        # Process last AI message for emotions
        analyze_message(last_ai_reply, "assistant")
    
    # Check if we should suggest karma (every N turns)
    _karma_suggestion_turn += 1
    if KARMA_AVAILABLE and _karma_suggestion_turn >= KARMA_SUGGESTION_CONFIG["check_interval"]:
        _karma_suggestion_turn = 0
        suggestion = calculate_karma_suggestion()
        if suggestion:
            try:
                success, msg = karma.suggest_karma_change(
                    suggestion["amount"],
                    suggestion["reason"],
                    "emotions"
                )
                if success:
                    print(f"[{ACTION_NAME.upper()}: Suggested karma change {suggestion['amount']:+.2f} - {msg}]")
                else:
                    print(f"[{ACTION_NAME.upper()}: Karma suggestion rejected - {msg}]")
            except Exception as e:
                print(f"[{ACTION_NAME.upper()}: Error suggesting karma: {e}]")
    
    # Return original input unmodified
    return user_input

def get_current_emotions():
    """Get the current detected emotions (for other plugins to use)."""
    global _current_emotions
    return _current_emotions.copy() if _current_emotions else ["neutral"]

def get_emotion_history(limit=10):
    """Get the recent emotion history (for other plugins to use)."""
    try:
        emotions_history = []
        if os.path.exists(EMOTIONS_FILE):
            with open(EMOTIONS_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
                # Skip header lines
                data_lines = [line for line in lines if not line.startswith("#")]
                # Get last 'limit' entries
                for line in data_lines[-limit:]:
                    if "|" in line:
                        parts = line.strip().split("|")
                        if len(parts) >= 3:
                            timestamp, role, emotions = parts
                            emotions_list = emotions.split(",")
                            emotions_history.append({
                                "timestamp": timestamp,
                                "role": role,
                                "emotions": emotions_list
                            })
        return emotions_history
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: Error getting emotion history: {e}]")
        return []