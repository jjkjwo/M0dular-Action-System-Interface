# voice.py - Enhanced with web support and improved command handling (Corrected)
import platform
import os
import json

ACTION_NAME = "voice"
ACTION_PRIORITY = 6
_is_voice_action_active = True  # Set to True by default for mobile support
_current_os = platform.system()  # Detect OS at module level
_web_mode = False  # Flag to indicate if we're serving web clients

# Try to import pyttsx3, but don't fail if it's not available
try:
    import pyttsx3
    has_pyttsx3 = True
except ImportError:
    has_pyttsx3 = False

engine = None

async def start_action():
    """Function called when voice action is started."""
    global _is_voice_action_active, engine, _current_os, _web_mode
    _is_voice_action_active = True
    
    # Detect web mode based on environment variable
    _web_mode = os.environ.get("SERVER_ENVIRONMENT") == "SERVER"
    
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Voice Mode ENABLED. OS Detected: {_current_os}, Web Mode: {_web_mode}]")

    if _web_mode:
        # In web mode, we'll use a file to communicate with the browser
        print("[VOICE ACTION: Web mode detected. Speech will be available for web clients.]")
        # Create an empty voice file to start with
        with open("website_voice.txt", "w", encoding="utf-8") as f:
            f.write("")
        
    elif _current_os == "Windows" and has_pyttsx3:  # Windows path - pyttsx3
        try:
            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            if voices:
                print(f"[VOICE ACTION: TTS Engine (pyttsx3) initialized for Windows with voice: {voices[0].name if voices else 'Default Voice'}]")
            else:
                print("[VOICE ACTION: TTS Engine (pyttsx3) initialized for Windows, but NO voices found.]")
        except Exception as e:
            engine = None
            print(f"[VOICE ACTION: TTS Engine (pyttsx3) initialization ERROR (Windows) during start_action: {e}]")

    elif _current_os == "Linux":  # Linux/Termux path - espeak
        print("[VOICE ACTION: Using command-line 'espeak' for TTS in Linux/Termux (LOCAL EXECUTION).]")
        engine = None  # No pyttsx3 engine in Termux/espeak path

    else:  # Unknown OS
        print(f"[VOICE ACTION: WARNING - Unknown OS ({_current_os}). TTS might not be configured for this platform.]")
        engine = None


async def stop_action():
    """Function called when voice action is stopped."""
    global _is_voice_action_active, engine, _current_os, _web_mode
    _is_voice_action_active = False
    
    if _web_mode:
        # Clean up web voice file
        try:
            with open("website_voice.txt", "w", encoding="utf-8") as f:
                f.write("")
            print("[VOICE ACTION: Web voice mode disabled.]")
        except Exception as e:
            print(f"[VOICE ACTION: Error cleaning up web voice file: {e}]")
            
    elif _current_os == "Windows" and engine:  # Windows stop - pyttsx3
        try:
            engine.stop()
            engine = None
            print("[VOICE ACTION: TTS Engine (pyttsx3) STOPPED and released (Windows).]")
        except Exception as e:
            print(f"[VOICE ACTION: TTS Engine (pyttsx3) STOP ERROR (Windows) during stop_action: {e}]")
            
    elif _current_os == "Linux":  # Linux/Termux stop
        print("[VOICE ACTION: No TTS Engine to stop (using 'espeak' in Linux/Termux). Voice mode disabled.]")
        
    else:  # Unknown OS stop
        print("[VOICE ACTION: Voice Mode DISABLED (Unknown OS). No engine to stop.]")
        
    print("[VOICE ACTION: STOPPED - Voice Mode DISABLED.]")


async def process_input(user_input, system_functions):
    """Process user input for voice action."""
    global _is_voice_action_active
    
    # More comprehensive list of voice commands to catch all variations
    lower_input = user_input.lower().strip()
    
    # Check for voice on/start commands
    if (lower_input == "voice on" or 
        lower_input == "start voice" or 
        lower_input == "enable voice" or
        lower_input == "turn voice on"):
        _is_voice_action_active = True
        print(f"[VOICE ACTION: Voice output enabled via command: '{user_input}']")
        return None  # Don't send anything to the AI
        
    # Check for voice off/stop commands
    if (lower_input == "voice off" or 
        lower_input == "stop voice" or 
        lower_input == "disable voice" or
        lower_input == "turn voice off"):
        _is_voice_action_active = False
        print(f"[VOICE ACTION: Voice output disabled via command: '{user_input}']")
        return None  # Don't send anything to the AI
        
    # No modification to normal inputs
    return None


async def speak_ai_reply(ai_reply_text):
    """Speak AI reply text through appropriate TTS method."""
    global engine, _is_voice_action_active, _current_os, _web_mode
    
    if not _is_voice_action_active:  # Skip if voice action not active
        print("[VOICE ACTION: speak_ai_reply - Voice Action NOT ACTIVE - Skipping TTS.]")
        return
    
    # Prepare truncated text for logging
    truncated_text = ai_reply_text[:50] + "..." if len(ai_reply_text) > 50 else ai_reply_text
    
    if _web_mode:
        # Web mode - write to file for browser to pick up
        try:
            # Create a JSON object with the speech text and timestamp
            voice_data = {
                "text": ai_reply_text,
                "timestamp": os.path.getmtime("website_output.txt") if os.path.exists("website_output.txt") else 0
            }
            
            with open("website_voice.txt", "w", encoding="utf-8") as f:
                json.dump(voice_data, f)
                
            print(f"[VOICE ACTION (Web): Speech text written to file for browser: '{truncated_text}']")
        except Exception as e:
            print(f"[VOICE ACTION (Web): Error writing speech text to file: {e}]")

    elif _current_os == "Windows" and engine:  # Windows speak - pyttsx3
        print(f"[VOICE ACTION (Windows/pyttsx3): About to say: '{truncated_text}']")
        try:
            engine.say(ai_reply_text)
            engine.runAndWait()
            print("[VOICE ACTION (Windows/pyttsx3): speech completed.]")
        except Exception as e:
            print(f"[VOICE ACTION (Windows/pyttsx3): TTS Error: {e}]")

    elif _current_os == "Linux":  # Linux/Termux speak - espeak
        print(f"[VOICE ACTION (Linux/Termux): About to say via espeak: '{truncated_text}']")
        espeak_command = f'espeak -v en+f2 "{ai_reply_text}"'
        try:
            result = os.system(espeak_command)
            if result == 0:
                print("[VOICE ACTION (Linux/Termux): espeak command executed successfully.]")
            else:
                print(f"[VOICE ACTION (Linux/Termux): WARNING - espeak command failed (return code: {result}).]")
                print(f"[VOICE ACTION (Linux/Termux): Attempted command: {espeak_command}]")
        except Exception as e:
            print(f"[VOICE ACTION (Linux/Termux): Exception during espeak execution: {e}]")

    else:  # Unknown OS - no TTS attempt
        print(f"[VOICE ACTION (Unknown OS - {_current_os}): Skipping TTS output - Platform not configured for voice.]")