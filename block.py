# block.py - Word Blocking Action
import os
import re

ACTION_NAME = "block"
ACTION_PRIORITY = 6.5  # Between x (5) and filter (7) for appropriate processing order

_is_block_active = False  # Module level variable to track action state
_blocked_words = []  # Cache of words from block.txt

async def start_action():
    """Function called when block action is started."""
    global _is_block_active, _blocked_words
    _is_block_active = True
    
    # Load blocked words from file
    try:
        load_blocked_words()
        word_count = len(_blocked_words)
        print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Word censoring ENABLED with {word_count} blocked words. Use 'stop block' to disable.]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: ERROR loading blocked words: {e}]")
        _is_block_active = False
        return

async def stop_action():
    """Function called when block action is stopped."""
    global _is_block_active
    _is_block_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Word censoring DISABLED.]")

def load_blocked_words():
    """Load blocked words from block.txt file."""
    global _blocked_words
    blocked_words_file = "block.txt"
    
    # Create default file if it doesn't exist
    if not os.path.exists(blocked_words_file):
        create_default_block_file()
    
    # Read words from file
    with open(blocked_words_file, "r", encoding="utf-8") as f:
        # Read all lines, strip whitespace, filter out empty lines and comments
        _blocked_words = [line.strip().lower() for line in f.readlines() if line.strip() and not line.strip().startswith("#")]
        
    return _blocked_words

def create_default_block_file():
    """Create a default block.txt file with common swear words."""
    with open("block.txt", "w", encoding="utf-8") as f:
        f.write("# Block.txt - List of words to be censored (one per line)\n")
        f.write("# Add or remove words as needed\n")
        f.write("fuck\n")
        f.write("shit\n")
        f.write("damn\n")
        f.write("ass\n")
        f.write("asshole\n")
        f.write("bitch\n")
        f.write("cunt\n")
        f.write("dick\n")
        f.write("bastard\n")
        f.write("hell\n")

def reload_blocked_words():
    """Reload blocked words from file."""
    try:
        load_blocked_words()
        return f"[{ACTION_NAME.upper()} ACTION: Reloaded {len(_blocked_words)} blocked words from file.]"
    except Exception as e:
        return f"[{ACTION_NAME.upper()} ACTION: ERROR reloading blocked words: {e}]"

def add_blocked_word(word):
    """Add a word to the block list."""
    global _blocked_words
    word = word.strip().lower()
    
    if not word:
        return f"[{ACTION_NAME.upper()} ACTION: ERROR - Cannot add empty word.]"
    
    if word in _blocked_words:
        return f"[{ACTION_NAME.upper()} ACTION: Word '{word}' is already blocked.]"
    
    _blocked_words.append(word)
    
    # Update the file
    try:
        with open("block.txt", "a", encoding="utf-8") as f:
            f.write(f"{word}\n")
        return f"[{ACTION_NAME.upper()} ACTION: Added '{word}' to blocked words list.]"
    except Exception as e:
        _blocked_words.remove(word)  # Revert change if file update fails
        return f"[{ACTION_NAME.upper()} ACTION: ERROR adding word to file: {e}]"

def remove_blocked_word(word):
    """Remove a word from the block list."""
    global _blocked_words
    word = word.strip().lower()
    
    if not word:
        return f"[{ACTION_NAME.upper()} ACTION: ERROR - Cannot remove empty word.]"
    
    if word not in _blocked_words:
        return f"[{ACTION_NAME.upper()} ACTION: Word '{word}' is not in the blocked list.]"
    
    _blocked_words.remove(word)
    
    # Update the file
    try:
        with open("block.txt", "w", encoding="utf-8") as f:
            # Write comments back
            f.write("# Block.txt - List of words to be censored (one per line)\n")
            f.write("# Add or remove words as needed\n")
            # Write all remaining words
            for blocked_word in _blocked_words:
                f.write(f"{blocked_word}\n")
        return f"[{ACTION_NAME.upper()} ACTION: Removed '{word}' from blocked words list.]"
    except Exception as e:
        _blocked_words.append(word)  # Revert change if file update fails
        return f"[{ACTION_NAME.upper()} ACTION: ERROR removing word from file: {e}]"

def get_blocked_words():
    """Return the list of blocked words."""
    return _blocked_words

async def process_input(user_input, system_functions):
    """Process user input - for 'block' action - implements word censorship."""
    global _is_block_active, _blocked_words

    if not _is_block_active or not user_input:
        return user_input  # Return original input if action is inactive or input is empty

    # Check for block commands
    if user_input.startswith("block reload"):
        return reload_blocked_words()
    
    if user_input.startswith("block add "):
        word_to_add = user_input[10:].strip()
        return add_blocked_word(word_to_add)
    
    if user_input.startswith("block remove "):
        word_to_remove = user_input[13:].strip()
        return remove_blocked_word(word_to_remove)
    
    if user_input == "block list":
        word_list = ", ".join(_blocked_words) if _blocked_words else "No words are currently blocked"
        return f"[{ACTION_NAME.upper()} ACTION: Blocked words: {word_list}]"

    # No censoring user input by default, just pass it through
    return user_input  

async def process_output(ai_response, system_functions):
    """Process AI output to censor blocked words."""
    global _is_block_active, _blocked_words
    
    if not _is_block_active or not ai_response:
        return ai_response  # Return original if action is inactive or empty
    
    if _blocked_words:
        # Create a regex pattern that matches whole words only
        pattern = r'\b(' + '|'.join(re.escape(word) for word in _blocked_words) + r')\b'
        # Replace case-insensitively
        censored_output = re.sub(pattern, '[CENSORED]', ai_response, flags=re.IGNORECASE)
        
        if censored_output != ai_response:
            print(f"[{ACTION_NAME.upper()} ACTION: Censored AI output containing blocked words.]")
            return censored_output
    
    return ai_response  # Return original if no censoring occurred