# controls.py - Minimal UI Control Action
# ==========================================
# This action enables AI-driven UI control by processing [CONTROL: ...] commands
# embedded in AI responses. It acts as a bridge between the AI and the frontend,
# extracting commands and passing them to the UI through a JSON file interface.
#
# Core Functionality:
# - Extracts [CONTROL: command args] tags from AI output
# - Writes commands to control_output.json for frontend processing
# - Removes control tags from the visible AI response
# - Injects periodic reminders to the AI about UI control capabilities
#
# Integration Points:
# - Works with core.py which mentions controls in its system reminder
# - Respects the is_system_command flag from the command system
# - Outputs to control_output.json which frontend polls/watches
# - Logs to website_output.txt for debugging/history
#
# Frontend Contract:
# - Frontend reads control_output.json for command batches
# - Frontend interprets command names and arguments as needed
# - Frontend can ignore optional metadata fields
# - No assumptions made about specific UI frameworks or commands
#
# SEPARATION OF CONCERNS:
# What controls.py IS responsible for:
# - Detecting [CONTROL:] tags in AI output
# - Extracting command name and arguments
# - Writing to control_output.json
# - Removing tags from visible output
# - Reminding AI about UI control capability
#
# What controls.py is NOT responsible for:
# - Validating command safety or correctness
# - Executing any UI changes
# - Checking if commands succeeded
# - Rate limiting or queueing commands
# - Understanding command semantics
# - Sanitizing or escaping arguments
#
# System Integration Details (from other system files):
#
# From core.py:
# - Core action (priority 0) provides a system-wide reminder that mentions three tag types:
#   1. [start/stop action_name] - Backend action control
#   2. [command command_value] - Backend system commands  
#   3. [CONTROL: command ui_args] - Frontend UI control (this action)
# - Core specifically states: "Requires the 'controls' action to be active"
# - Core tells AI: "See the separate 'controls' reminder for full UI commands"
#
# From commands.json:
# - "start controls": true (in action category)
# - "stop controls": true (in action category)
# - These are the only controls-specific commands in the command system
#
# From action_simplified.py ACTION_MAP:
# - "script_file": "controls.py"
# - "priority": 6 (runs after core, memory, etc. but before filters)
# - "is_active_by_default": False (must be manually started)
# - "description": "Parses AI commands ([CONTROL:...]) and passes them to the interface"
#
# From loader.py:
# - Actions are processed in priority order (lower number = higher priority)
# - process_input is called with is_system_command flag to differentiate commands from chat
# - process_output is called for all AI responses when action is active
# - Controls runs at priority 6, so it processes after:
#   - core (0), lvl3 (1), auth (3), web_input (4), focus (5.5)
# - But before:
#   - voice (6), block (6.5), filter (7), and others
#
# From looper.py:
# - Calls process_input before sending to AI (with is_system_command flag)
# - Calls process_output after receiving AI response
# - Handles the async execution of all actions in priority order
# - Controls whether input is a command vs chat via is_system_command
# - Commands like "start controls" and "stop controls" are handled by loader
#
# Processing Order Constraints:
# - Must run AFTER core.py so the AI has seen the control reminder
# - Must run BEFORE output filters that might strip the commands
# - Should respect voice.py also at priority 6 (both process AI output)
#
# Command Format Constraints:
# - Commands must start with [CONTROL:, [CONT:, or [C: (case insensitive)
# - Must have a command name (word characters only) after the colon
# - Arguments extend until the matching closing bracket
# - Brackets within arguments are handled via counting (nesting supported)
# - All control tags are completely removed from output (no partial removal)
#
# File I/O Constraints:
# - control_output.json is OVERWRITTEN each time (not appended)
# - website_output.txt is APPENDED to (creates history log)
# - Both files are written synchronously to avoid race conditions
# - Frontend must handle file locking/reading appropriately
#
# Memory/Performance Constraints:
# - No command queue - each batch overwrites the previous
# - No built-in rate limiting (frontend must handle)
# - No command history beyond website_output.txt log
# - No validation of command success/failure from frontend
#
# LIMITATIONS:
# - One-way communication only (AI -> Frontend)
# - No feedback mechanism for command results
# - No conditional command execution
# - No command parameters beyond string arguments
# - Cannot modify commands from other actions
# - Cannot prevent other actions from modifying response after us
# ==========================================

import os
import re
import json
import time
import sys
import asyncio

# --- Configuration ---
# Action name used in logs and for start/stop commands
ACTION_NAME = "controls"

# Priority determines order of execution (lower = earlier)
# Priority 6 means this runs after most input processors but before output filters
#
# PRIORITY INTERACTIONS WITH OTHER ACTIONS:
# Input Processing Order (process_input):
#   0: core - Might inject system reminders mentioning controls
#   1: lvl3 - Could load context that contains [CONTROL:] examples
#   3: auth - Handles authentication before we see input
#   4: web_input - Provides input that might need UI feedback
#   5: focus - Could modify input before we add our reminder
#   5.5: aware - Might inject feature awareness before us
#   6: controls (THIS ACTION) - Adds UI control reminder
#   6: voice - Also priority 6, order undefined between us
#
# Output Processing Order (process_output):
#   Same priority order, but now processing AI's response
#   Controls removes [CONTROL:] tags before voice/filter/etc see them
#
ACTION_PRIORITY = 6

# How often to remind the AI about control capabilities (every N messages)
REMINDER_INTERVAL = 10

# Output file that frontend monitors for UI commands
# This file is overwritten with each new command batch
#
# FILE FORMAT for control_output.json:
# Status message (on start/stop):
# {
#   "type": "status",
#   "status": "CONTROLS started|stopped",
#   "commands_batch": [],  // Always empty for status
#   "timestamp": 1234567890.123
# }
#
# Command batch (normal operation):
# {
#   "type": "command_batch",
#   "batch_id": "batch_1234567890.123_a1b2c3d4",
#   "commands": [
#     {
#       "command": "execute_js",
#       "args": "alert('Hello')",
#       "metadata": {
#         "raw_tag": "[CONTROL: execute_js alert('Hello')]",
#         "timestamp": 1234567890.123
#       }
#     }
#   ],
#   "timestamp": 1234567890.123,
#   "version": "1.0"
# }
#
CONTROL_OUTPUT_FILE = "control_output.json"

# Log file for debugging and command history
# This file is appended to, not overwritten
STANDARD_OUTPUT_FILE = "website_output.txt"

# --- Command Validation (Optional - Frontend can ignore) ---
# This configuration structure allows for optional command filtering
# Set allow_all=True (default) to pass all commands through
# Or set allow_all=False and populate allowed_commands list
COMMAND_VALIDATION = {
    "allow_all": True,  # If True, all commands are passed through
    "allowed_commands": [],  # List of allowed command names (if allow_all is False)
    "max_arg_length": 65536  # Maximum argument length (optional safety limit)
}

# --- State Variables ---
# Whether this action is currently active
_is_active = False

# Counter for messages processed (used for reminder injection)
_message_counter = 0

# --- Helper Functions ---
def _extract_commands_from_response(ai_response):
    """
    Extract [CONTROL: ...] commands from AI response using bracket counting.
    
    This function handles nested brackets within command arguments, ensuring
    we correctly parse commands even when they contain JSON or other bracketed content.
    
    Args:
        ai_response (str): The AI's response text potentially containing control commands
        
    Returns:
        list: List of dicts with keys:
            - start: Starting position of the command in the text
            - end: Ending position of the command in the text
            - command: The command name (first word after CONTROL:)
            - args: Everything after the command name until the closing bracket
            - full_tag: The complete [CONTROL: ...] tag as it appeared
    """
    commands = []
    pos = 0
    
    while pos < len(ai_response):
        # Find the next [CONTROL: or variant (case insensitive)
        # Supports [CONTROL:, [CONT:, and [C: as shortcuts
        match = re.search(r'\[\s*(?:CONTROL|CONT|C):\s*', ai_response[pos:], re.IGNORECASE)
        if not match: 
            break
            
        # Calculate positions in the original string
        start_pos = pos + match.start()  # Position of the opening [
        cmd_start = pos + match.end()    # Position after "CONTROL: "
        
        # Extract the command name (first word)
        cmd_match = re.match(r'(\w+)\s+', ai_response[cmd_start:])
        if not cmd_match:
            # No valid command name found, skip this match
            pos = cmd_start
            continue
            
        command_name = cmd_match.group(1).lower()
        args_start = cmd_start + cmd_match.end()
        
        # Use bracket counting to find the matching closing bracket
        # This handles nested brackets in the arguments
        bracket_count = 1  # We've already seen the opening [
        i = args_start
        
        while i < len(ai_response) and bracket_count > 0:
            if ai_response[i] == '[': 
                bracket_count += 1
            elif ai_response[i] == ']': 
                bracket_count -= 1
            i += 1
            
        if bracket_count == 0:
            # Found matching closing bracket
            args_end = i - 1  # Position before the closing ]
            args = ai_response[args_start:args_end]
            full_command = ai_response[start_pos:i]
            
            commands.append({
                'start': start_pos,
                'end': i,
                'command': command_name,
                'args': args,
                'full_tag': full_command
            })
            pos = i
        else:
            # No matching closing bracket found, skip
            pos = args_start
            
    return commands

def _write_control_output_sync(data_payload):
    """
    Write command data to the control output file for frontend consumption.
    
    This function writes a JSON file that the frontend can read to execute UI commands.
    The file is completely overwritten each time (not appended).
    
    Args:
        data_payload (dict): Data to write, typically containing:
            - type: "status" or "command_batch"
            - commands: List of command objects (for command_batch type)
            - timestamp: Unix timestamp (auto-added if not present)
            
    Returns:
        bool: True if write succeeded, False otherwise
    """
    # Add timestamp if not already present
    if 'timestamp' not in data_payload: 
        data_payload['timestamp'] = time.time()
        
    try:
        # Convert to formatted JSON string
        json_string_output = json.dumps(data_payload, indent=2, ensure_ascii=False)
        
        # Ensure output directory exists
        output_dir = os.path.dirname(CONTROL_OUTPUT_FILE)
        if output_dir and not os.path.exists(output_dir): 
            os.makedirs(output_dir, exist_ok=True)
            
        # Write to file (overwrites existing content)
        with open(CONTROL_OUTPUT_FILE, "w", encoding="utf-8") as f: 
            f.write(json_string_output)
            
        return True
        
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERR: Write {CONTROL_OUTPUT_FILE} fail: {e}]", file=sys.stderr)
        return False

async def _write_standard_output_async(message):
    """
    Append a log message to the standard output file for debugging/history.
    
    Unlike control_output.json, this file is appended to, creating a running log
    of all commands processed.
    
    Args:
        message (str): Message to log
    """
    try:
        # Ensure output directory exists
        output_dir = os.path.dirname(STANDARD_OUTPUT_FILE)
        if output_dir and not os.path.exists(output_dir): 
            os.makedirs(output_dir, exist_ok=True)
            
        # Append message with timestamp
        timestamp = time.time()
        with open(STANDARD_OUTPUT_FILE, "a", encoding="utf-8") as f: 
            f.write(f"[{timestamp}] {message}\n")
            
    except Exception as e: 
        print(f"[{ACTION_NAME.upper()} ERR: Write {STANDARD_OUTPUT_FILE} fail: {e}]", file=sys.stderr)

# --- Core Action Functions ---
# These functions implement the action interface expected by loader.py
#
# BEHAVIORAL NOTES AND EDGE CASES:
#
# 1. Timing Dependencies:
#    - Control commands are processed AFTER the AI generates its response
#    - Commands execute asynchronously - no guarantee of completion
#    - Next AI response could generate new commands before previous complete
#
# 2. Command Isolation:
#    - Each command is independent - no command chaining or dependencies
#    - No return values or success/failure feedback from frontend
#    - AI cannot "wait" for command completion or check results
#
# 3. Tag Processing Edge Cases:
#    - Malformed tags like [CONTROL: ] (no command) are skipped
#    - Unclosed tags like [CONTROL: cmd args (no closing ]) are ignored
#    - Multiple commands in one response are all processed
#    - Commands inside code blocks or quotes are still processed
#
# 4. Security Considerations:
#    - No built-in sanitization of command arguments
#    - Frontend MUST validate and sanitize all commands
#    - Argument length limit (65536) is only advisory
#    - No protection against command injection in args
#
# 5. Concurrency:
#    - File writes are synchronous to avoid corruption
#    - No locking mechanism - frontend must handle concurrent reads
#    - Rapid command batches will overwrite each other
#
# 6. Integration Behavior:
#    - Empty responses after command removal get replacement text
#    - Reminder injection adds to token count for AI
#    - Commands in user input are NOT processed (only in AI output)
#    - System commands never get reminder injections

async def start_action():
    """
    Initialize and start the controls action.
    
    Called by the loader when 'start controls' command is issued.
    Writes an initial status to control_output.json to signal activation.
    """
    global _is_active, _message_counter
    
    _is_active = True
    _message_counter = 0  # Reset counter on start
    
    # Write initial status to output file
    _write_control_output_sync({
        "type": "status", 
        "status": f"{ACTION_NAME.upper()} started", 
        "commands_batch": []
    })
    
    print(f"[{ACTION_NAME.upper()} STARTED - Minimal UI control active]")

async def stop_action():
    """
    Stop the controls action.
    
    Called by the loader when 'stop controls' command is issued.
    Writes a final status to control_output.json to signal deactivation.
    """
    global _is_active
    
    _is_active = False
    
    # Write stop status to output file
    _write_control_output_sync({
        "type": "status", 
        "status": f"{ACTION_NAME.upper()} stopped", 
        "commands_batch": []
    })
    
    print(f"[{ACTION_NAME.upper()} STOPPED]")

async def process_input(user_input, system_functions, is_system_command=False):
    """
    Process user input before it goes to the AI.
    
    This function injects periodic reminders about UI control capabilities
    into the AI's context. Reminders are only injected for actual user
    messages, not for system commands.
    
    Args:
        user_input (str): The user's input text
        system_functions (dict): System functions provided by loader (unused here)
        is_system_command (bool): True if this is a system command, not user chat
        
    Returns:
        str: Original input, possibly prefixed with a control reminder
    """
    global _is_active, _message_counter
    
    # Pass through if not active
    if not _is_active:
        return user_input

    # Don't inject reminders for system commands
    # System commands are things like "start voice" or "memory status"
    # We only want to remind the AI during actual conversation
    if is_system_command:
        return user_input

    # Increment counter for actual user messages
    _message_counter += 1
    
    # Check if it's time for a reminder (first message and every N messages)
    if (_message_counter - 1) % REMINDER_INTERVAL == 0:
        # Generic prompt reminder that doesn't assume specific frontend implementation
        reminder = (
            "[CONTROLS REMINDER: You can use [CONTROL: command args] tags to control the UI. "
            "The frontend will interpret these commands. Commands are removed from your visible response.]\n\n"
        )
        
        print(f"[{ACTION_NAME.upper()} LOG] Injecting minimal UI control reminder at message #{_message_counter}]")
        
        # Prepend reminder to user input
        return reminder + user_input

    # No reminder needed this turn
    return user_input

async def process_output(ai_response, system_functions):
    """
    Process AI output to extract and handle control commands.
    
    This is the core function that:
    1. Finds all [CONTROL: ...] commands in the AI's response
    2. Extracts them into a batch for the frontend
    3. Removes them from the visible response
    4. Writes the command batch to control_output.json
    
    Args:
        ai_response (str): The AI's response text
        system_functions (dict): System functions provided by loader (unused here)
        
    Returns:
        str: The AI's response with control commands removed
    """
    global _is_active
    
    # Pass through if not active or empty response
    if not _is_active or not ai_response:
        return ai_response

    # Extract all control commands from the response
    all_commands = _extract_commands_from_response(ai_response)
    
    # If no commands found, return unchanged
    if not all_commands:
        return ai_response

    # Prepare to collect commands and clean the response
    commands_to_send = []
    commands_processed_summary = []
    cleaned_response = ai_response
    
    # Process commands in reverse order to maintain text positions
    # (removing from the end first prevents position shifts)
    for cmd_info in reversed(all_commands):
        # Remove this command from the response text
        cleaned_response = cleaned_response[:cmd_info['start']] + cleaned_response[cmd_info['end']:]
        
        cmd_name = cmd_info['command']
        arg_str = cmd_info['args']
        
        # Optional validation (frontend can ignore by setting allow_all=True)
        if not COMMAND_VALIDATION.get("allow_all", True):
            allowed = COMMAND_VALIDATION.get("allowed_commands", [])
            if allowed and cmd_name not in allowed:
                print(f"[{ACTION_NAME.upper()} WARN] Command '{cmd_name}' not in allowed list, skipping")
                continue
        
        # Optional arg length check for safety
        max_len = COMMAND_VALIDATION.get("max_arg_length", 65536)
        if len(arg_str) > max_len:
            print(f"[{ACTION_NAME.upper()} WARN] Command '{cmd_name}' args too long ({len(arg_str)} > {max_len}), truncating")
            arg_str = arg_str[:max_len]
        
        # Build command object for frontend
        # Structure is kept generic - frontend defines interpretation
        command_obj = {
            "command": cmd_name,      # The command name
            "args": arg_str,          # The arguments as a string
            # Optional metadata that frontend can use or ignore
            "metadata": {
                "raw_tag": cmd_info['full_tag'],  # Original [CONTROL: ...] text
                "timestamp": time.time()           # When command was processed
            }
        }
        
        # Insert at beginning to maintain original command order
        commands_to_send.insert(0, command_obj)
        commands_processed_summary.insert(0, cmd_name)

    # Clean up any extra whitespace
    cleaned_text = cleaned_response.strip()

    # Send command batch if we have commands
    if commands_to_send:
        # Generate unique batch ID for tracking
        batch_id = f"batch_{time.time()}_{os.urandom(4).hex()}"
        
        print(f"[{ACTION_NAME.upper()} SENDING BATCH: {batch_id} with {len(commands_to_send)} commands: {', '.join(commands_processed_summary)}]")
        
        # Build output structure
        # This format is the contract with the frontend
        output_data = {
            "type": "command_batch",      # Indicates this contains commands
            "batch_id": batch_id,         # Unique identifier for this batch
            "commands": commands_to_send,  # List of command objects
            "timestamp": time.time(),     # When batch was created
            "version": "1.0"              # Format version for future compatibility
        }
        
        # Write to control output file
        if not _write_control_output_sync(output_data):
            # Log error if write failed
            await _write_standard_output_async(f"[{ACTION_NAME.upper()} ERROR: Failed to write batch {batch_id}.]")

    # If response is now empty after removing commands, provide feedback
    # This prevents empty AI responses when AI only provided commands
    if not cleaned_text and commands_to_send:
        return f"[{ACTION_NAME.upper()} PROCESSED: {len(commands_to_send)} UI commands sent to frontend.]"

    # Return cleaned response (commands removed)
    return cleaned_text

# --- Test Block ---
# Unit tests that verify core functionality
if __name__ == '__main__':
    print(f"Running minimal {ACTION_NAME}.py tests...")
    
    async def run_tests():
        """Run comprehensive tests of the controls action."""
        global _is_active, _message_counter
        
        print("\n--- TESTING MINIMAL CONTROLS ---")
        
        # Test activation
        await start_action()
        assert _is_active
        
        # Test 1: Verify reminder injection for regular input
        print("\n[T1: Reminder Injection Test]")
        _message_counter = 0
        prompt = await process_input("test input", {})
        assert "[CONTROLS REMINDER:" in prompt
        print(" ✓ Reminder injected successfully")
        
        # Test 2: Verify reminders are skipped for system commands
        print("\n[T2: System Command Test]")
        _message_counter = 0
        cmd_prompt = await process_input("start something", {}, is_system_command=True)
        assert "[CONTROLS REMINDER:" not in cmd_prompt
        print(" ✓ No reminder for system commands")
        
        # Test 3: Verify command extraction from AI response
        print("\n[T3: Command Extraction Test]")
        test_response = "Here's the result: [CONTROL: execute_js alert('test')] Done."
        processed = await process_output(test_response, {})
        assert "[CONTROL:" not in processed
        assert "Here's the result:" in processed
        print(" ✓ Commands extracted successfully")
        
        # Test 4: Verify output file structure
        print("\n[T4: Output File Test]")
        if os.path.exists(CONTROL_OUTPUT_FILE):
            with open(CONTROL_OUTPUT_FILE, 'r') as f:
                data = json.load(f)
                assert "type" in data
                assert "timestamp" in data
                print(" ✓ Output file has expected structure")
        
        # Test deactivation
        await stop_action()
        assert not _is_active
        print("\n--- ALL TESTS PASSED ---")
    
    # Run the tests
    asyncio.run(run_tests())