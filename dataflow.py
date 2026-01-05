# dataflow.py - Modern Data Interaction Addon for AI Agents
# Version 4.0 - CORRECTLY IMPLEMENTED LIKE LOG_READER
#
# =========================================================================
# This addon allows users and AI to read and save files through commands.
# Following the log_reader.py pattern:
# - "data get" stores file content in _pending_data
# - Content is injected into the NEXT user message to AI
# - Commands themselves return status messages, not AI input
# =========================================================================

import os
import re
import time
import json

# --- ACTION CONFIGURATION ---
ACTION_NAME = "dataflow"
ACTION_PRIORITY = 3  # High priority to process data commands early

# --- CONSTANTS ---
SAVE_DIR = "saved_sessions"
ALLOWED_SAVE_EXTENSIONS = {'.txt', '.md', '.json', '.log', '.html', '.css', '.xml', '.csv'}
SAVE_PROMPT_FILE = "save.txt"

# --- STATE ---
_is_active = False
_pending_data = None  # Store data to inject into next user message
_last_operation_time = 0
_operation_cooldown = 1.0  # Seconds between operations


# --- LIFECYCLE FUNCTIONS ---

async def start_action(system_functions=None):
    global _is_active, _pending_data
    _is_active = True
    _pending_data = None
    
    # Create save directory
    try:
        os.makedirs(SAVE_DIR, exist_ok=True)
        print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Modern agent data interaction enabled]")
        print(f"[{ACTION_NAME.upper()}: Save directory: {os.path.abspath(SAVE_DIR)}]")
        
        if system_functions and "user_notification" in system_functions:
            system_functions["user_notification"](
                f"[{ACTION_NAME.upper()}: Data commands active. Use 'data help' for info.]"
            )
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR: Failed to create save directory: {e}]")
        _is_active = False

async def stop_action(system_functions=None):
    global _is_active, _pending_data
    _is_active = False
    _pending_data = None
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Agent data interaction disabled]")


# --- CORE PROCESSING ---

async def process_input(user_input, system_functions=None, is_system_command=False):
    global _is_active, _pending_data, _last_operation_time
    
    if not _is_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    
    # Check for rate limiting
    current_time = time.time()
    time_since_last = current_time - _last_operation_time
    
    # Handle data commands
    if input_lower.startswith("data "):
        if time_since_last < _operation_cooldown:
            return f"[{ACTION_NAME.upper()}: Please wait {_operation_cooldown - time_since_last:.1f} seconds before next operation]"
        
        parts = user_input.strip().split(maxsplit=2)
        command = parts[1].lower() if len(parts) > 1 else ""
        args = parts[2] if len(parts) > 2 else ""
        
        _last_operation_time = current_time
        
        if command == "get":
            return await _handle_data_get(args)
        elif command == "save":
            return await _handle_data_save(args)
        elif command == "snapshot":
            return await _handle_data_snapshot(system_functions)
        elif command == "status":
            return _handle_data_status()
        elif command == "clear_pending":
            _pending_data = None
            return f"[{ACTION_NAME.upper()}: Cleared pending data]"
        elif command == "help":
            return _handle_data_help()
        else:
            return f"[{ACTION_NAME.upper()}: Unknown command '{command}'. Use 'data help'.]"
    
    # CRITICAL: Check if this is a system command to avoid injection loops
    if is_system_command:
        return user_input
    
    # For non-commands, check if we should skip injection
    try:
        import command_system
        if command_system.is_command(user_input):
            return user_input
    except:
        pass
    
    # Inject pending data if available
    if _pending_data and not _pending_data.get("injected", False):
        # Format the data for injection
        formatted_data = _format_data_for_injection(_pending_data)
        
        if formatted_data:
            _pending_data["injected"] = True
            modified_input = formatted_data + user_input
            
            print(f"[{ACTION_NAME.upper()}: Injected data from '{_pending_data['filename']}' into user input]")
            
            # Log the injection if available
            if system_functions and "log_event" in system_functions:
                system_functions["log_event"]("dataflow_data_injected", {
                    "filename": _pending_data["filename"],
                    "size": len(_pending_data["content"])
                })
            
            # Clear after injection
            _pending_data = None
            
            return modified_input
    
    return user_input


async def process_output(ai_response, system_functions=None):
    # No output processing needed
    return ai_response


# --- COMMAND HANDLERS ---

async def _handle_data_get(filename: str):
    global _pending_data
    
    if not filename:
        return f"[{ACTION_NAME.upper()}: ERROR - 'data get' requires a filename]"
    
    # Sanitize filename
    safe_filename = os.path.basename(filename.strip())
    filepath = os.path.join(SAVE_DIR, safe_filename)
    
    if not os.path.exists(filepath):
        return f"[{ACTION_NAME.upper()}: ERROR - File '{safe_filename}' not found]"
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Store for next message injection
        _pending_data = {
            "filename": safe_filename,
            "content": content,
            "timestamp": time.time(),
            "injected": False
        }
        
        file_size = len(content)
        return f"[{ACTION_NAME.upper()}: Loaded '{safe_filename}' ({file_size} chars). Content will be included in next message.]"
        
    except Exception as e:
        return f"[{ACTION_NAME.upper()}: ERROR reading '{safe_filename}': {e}]"


async def _handle_data_save(args: str):
    if "|" not in args:
        return f"[{ACTION_NAME.upper()}: ERROR - Format: data save filename.ext | content to save]"
    
    filename_part, content = args.split("|", 1)
    filename = filename_part.strip()
    content = content.strip()
    
    if not filename:
        return f"[{ACTION_NAME.upper()}: ERROR - Filename cannot be empty]"
    
    if not content:
        return f"[{ACTION_NAME.upper()}: ERROR - Content cannot be empty]"
    
    # Validate filename
    safe_filename = os.path.basename(filename)
    if safe_filename != filename:
        return f"[{ACTION_NAME.upper()}: ERROR - Invalid filename (no paths allowed)]"
    
    # Check extension
    _, ext = os.path.splitext(safe_filename)
    if ext.lower() not in ALLOWED_SAVE_EXTENSIONS:
        return f"[{ACTION_NAME.upper()}: ERROR - Extension '{ext}' not allowed. Use: {', '.join(sorted(ALLOWED_SAVE_EXTENSIONS))}]"
    
    # Sanitize filename
    safe_filename = re.sub(r'[^\w\-_\.]', '_', safe_filename)
    if safe_filename.startswith('.'):
        safe_filename = '_' + safe_filename[1:]
    
    filepath = os.path.join(SAVE_DIR, safe_filename)
    
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return f"[{ACTION_NAME.upper()}: Saved {len(content)} chars to '{safe_filename}']"
        
    except Exception as e:
        return f"[{ACTION_NAME.upper()}: ERROR saving '{safe_filename}': {e}]"


async def _handle_data_snapshot(system_functions):
    if not system_functions or "send_to_ai" not in system_functions:
        return f"[{ACTION_NAME.upper()}: ERROR - AI communication not available for snapshot]"
    
    send_to_ai = system_functions["send_to_ai"]
    if not callable(send_to_ai):
        return f"[{ACTION_NAME.upper()}: ERROR - Invalid AI communication function]"
    
    # Get snapshot prompt
    prompt = _get_snapshot_prompt()
    
    try:
        # Get AI to summarize the conversation
        ai_summary = await send_to_ai(prompt)
        
        if not ai_summary or ai_summary.startswith("[ERROR:"):
            return f"[{ACTION_NAME.upper()}: ERROR - AI failed to generate snapshot]"
        
        # Save snapshot
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"snapshot_{timestamp}.txt"
        filepath = os.path.join(SAVE_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Conversation Snapshot - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 60 + "\n\n")
            f.write(ai_summary)
        
        return f"[{ACTION_NAME.upper()}: Saved conversation snapshot to '{filename}']"
        
    except Exception as e:
        return f"[{ACTION_NAME.upper()}: ERROR creating snapshot: {e}]"


def _handle_data_status():
    status_lines = [f"[{ACTION_NAME.upper()} STATUS]"]
    
    # Check pending data
    if _pending_data and not _pending_data.get("injected", False):
        status_lines.append(f"Pending: '{_pending_data['filename']}' ({len(_pending_data['content'])} chars) waiting for injection")
    else:
        status_lines.append("No pending data")
    
    # List saved files
    try:
        files = []
        if os.path.exists(SAVE_DIR):
            for f in os.listdir(SAVE_DIR):
                if os.path.isfile(os.path.join(SAVE_DIR, f)):
                    files.append(f)
        
        if files:
            status_lines.append(f"\nSaved files ({len(files)}):")
            for f in sorted(files)[:10]:  # Show max 10
                status_lines.append(f"  - {f}")
            if len(files) > 10:
                status_lines.append(f"  ... and {len(files) - 10} more")
        else:
            status_lines.append("\nNo saved files")
            
    except Exception as e:
        status_lines.append(f"\nError listing files: {e}")
    
    return "\n".join(status_lines)


def _handle_data_help():
    return f"""[{ACTION_NAME.upper()} HELP]
Commands for file operations:

  data get <filename> - Load file content for next AI message
    Example: data get notes.txt
    
  data save <filename> | <content> - Save content to file  
    Example: data save report.md | # Report\\nContent here...
    Allowed types: {', '.join(sorted(ALLOWED_SAVE_EXTENSIONS))}
    
  data snapshot - Ask AI to summarize conversation and save it
    Creates: snapshot_YYYYMMDD_HHMMSS.txt
    
  data status - Show pending data and saved files
  data clear_pending - Clear any pending data injection
  data help - Show this help

Files location: {os.path.abspath(SAVE_DIR)}/

For AI usage: Use [command data get <file>] to load files"""


# --- UTILITY FUNCTIONS ---

def _format_data_for_injection(pending_data):
    """Format pending data for injection into user prompt"""
    if not pending_data or not pending_data.get("content"):
        return None
    
    filename = pending_data.get("filename", "unknown")
    content = pending_data.get("content", "")
    
    # Format with clear boundaries
    formatted = f"""[DATAFLOW: Content from '{filename}']
{'=' * 60}
{content}
{'=' * 60}
[END DATAFLOW]

"""
    
    return formatted


def _get_snapshot_prompt():
    """Get the prompt for AI to create a snapshot"""
    default_prompt = """Please create a comprehensive summary of our conversation so far. Include:
- Main topics discussed
- Key decisions or conclusions
- Important information shared
- Current context or state
- Any pending items or questions

Format this as a clear, organized summary that would help someone understand the conversation."""
    
    try:
        if os.path.exists(SAVE_PROMPT_FILE):
            with open(SAVE_PROMPT_FILE, "r", encoding="utf-8") as f:
                custom_prompt = f.read().strip()
                if custom_prompt:
                    return custom_prompt
    except:
        pass
    
    return default_prompt


# --- TESTING ---
if __name__ == "__main__":
    print("Dataflow addon - No standalone testing available")
    print("Load this addon in the main system and use 'data help' for commands")