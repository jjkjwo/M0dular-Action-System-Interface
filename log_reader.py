# log_reader.py - Log Search and Retrieval Action for AI
# Allows AI and users to search conversation history and inject results into context

import os
import json
import re
import time
from datetime import datetime, timedelta
from collections import deque

ACTION_NAME = "log_reader"
ACTION_PRIORITY = 2  # Same as back.py - runs early in pipeline

# State variables
_is_active = False
_pending_results = None
_last_search_time = 0
_search_cooldown = 2.0  # Seconds between searches

# Configuration
MAX_RESULTS = 20
MAX_LINE_LENGTH = 500
CONVERSATION_HISTORY_FILE = "conversation_history.json"

async def start_action(system_functions=None):
    """Initialize the log reader action"""
    global _is_active, _pending_results
    _is_active = True
    _pending_results = None
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Log search capabilities enabled]")
    
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            f"[{ACTION_NAME.upper()}: Log reader active. AI can now search conversation history.]"
        )

async def stop_action(system_functions=None):
    """Stop the log reader action"""
    global _is_active, _pending_results
    _is_active = False
    _pending_results = None
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Log search disabled]")

def search_logs(query, limit=10, mode="keyword"):
    """Search conversation history for matching entries"""
    results = []
    
    try:
        if not os.path.exists(CONVERSATION_HISTORY_FILE):
            return []
            
        with open(CONVERSATION_HISTORY_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Reverse to get most recent first
        lines.reverse()
        
        for line in lines:
            if len(results) >= limit:
                break
                
            line = line.strip()
            if not line:
                continue
                
            # Search based on mode
            match = False
            if mode == "keyword":
                if query.lower() in line.lower():
                    match = True
            elif mode == "regex":
                try:
                    if re.search(query, line, re.IGNORECASE):
                        match = True
                except re.error:
                    continue
                    
            if match:
                # Truncate long lines
                if len(line) > MAX_LINE_LENGTH:
                    line = line[:MAX_LINE_LENGTH] + "..."
                results.append(line)
                
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error searching logs: {e}]")
        
    return results

def get_recent_logs(count=10):
    """Get the most recent log entries"""
    results = []
    
    try:
        if not os.path.exists(CONVERSATION_HISTORY_FILE):
            return []
            
        with open(CONVERSATION_HISTORY_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Get last 'count' non-empty lines
        for line in reversed(lines):
            if len(results) >= count:
                break
            line = line.strip()
            if line:
                if len(line) > MAX_LINE_LENGTH:
                    line = line[:MAX_LINE_LENGTH] + "..."
                results.append(line)
                
    except Exception as e:
        print(f"[{ACTION_NAME.upper()}: Error getting recent logs: {e}]")
        
    return results

def format_results_for_injection(results, query=None):
    """Format search results for injection into user prompt"""
    if not results:
        return None
        
    header = f"[LOG SEARCH RESULTS - Previous query: '{query}' - {len(results)} matches found]\n" if query else f"[RECENT LOGS - Last {len(results)} entries]\n"
    
    formatted_results = [header]
    for i, result in enumerate(results, 1):
        formatted_results.append(f"{i}. {result}")
    
    formatted_results.append("[END LOG RESULTS]\n\n")
    
    return "\n".join(formatted_results)

async def process_input(user_input, system_functions=None):
    """Process user input and inject pending log results"""
    global _is_active, _pending_results, _last_search_time
    
    if not _is_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    
    # Check for rate limiting
    current_time = time.time()
    time_since_last = current_time - _last_search_time
    
    # Handle commands
    if input_lower.startswith("log search "):
        if time_since_last < _search_cooldown:
            return f"[{ACTION_NAME.upper()}: Please wait {_search_cooldown - time_since_last:.1f} seconds before searching again]"
            
        query = user_input[11:].strip()
        if not query:
            return f"[{ACTION_NAME.upper()}: Please provide a search query]"
            
        # Parse limit if provided
        parts = query.rsplit(' ', 1)
        limit = MAX_RESULTS
        if len(parts) == 2 and parts[1].isdigit():
            limit = min(int(parts[1]), MAX_RESULTS)
            query = parts[0]
        
        results = search_logs(query, limit)
        _last_search_time = current_time
        
        if results:
            _pending_results = {
                "query": query,
                "results": results,
                "timestamp": current_time,
                "injected": False
            }
            return f"[{ACTION_NAME.upper()}: Found {len(results)} matches for '{query}'. Results will be included in next message.]"
        else:
            return f"[{ACTION_NAME.upper()}: No matches found for '{query}']"
    
    elif input_lower.startswith("log recent"):
        if time_since_last < _search_cooldown:
            return f"[{ACTION_NAME.upper()}: Please wait {_search_cooldown - time_since_last:.1f} seconds before searching again]"
            
        parts = input_lower.split()
        count = 5  # Default
        if len(parts) > 2 and parts[2].isdigit():
            count = min(int(parts[2]), MAX_RESULTS)
        
        results = get_recent_logs(count)
        _last_search_time = current_time
        
        if results:
            _pending_results = {
                "query": None,
                "results": results,
                "timestamp": current_time,
                "injected": False
            }
            return f"[{ACTION_NAME.upper()}: Retrieved {len(results)} recent log entries. Results will be included in next message.]"
        else:
            return f"[{ACTION_NAME.upper()}: No log entries found]"
    
    elif input_lower == "log clear_pending":
        _pending_results = None
        return f"[{ACTION_NAME.upper()}: Cleared pending results]"
    
    elif input_lower == "log status":
        if _pending_results and not _pending_results["injected"]:
            query_info = f"Query: '{_pending_results['query']}'" if _pending_results['query'] else "Recent logs"
            return f"[{ACTION_NAME.upper()}: {len(_pending_results['results'])} results pending injection. {query_info}]"
        else:
            return f"[{ACTION_NAME.upper()}: No pending results]"
    
    elif input_lower == "log help":
        help_text = [
            f"[{ACTION_NAME.upper()} HELP]",
            "Commands:",
            "  log search <query> [limit] - Search logs for query (max 20 results)",
            "  log recent [n] - Get last n log entries (default 5, max 20)",
            "  log status - Show pending results status",
            "  log clear_pending - Clear any pending results",
            "",
            "AI Usage: Use [command log search <query>] to search logs",
            "Results are injected into the next user message automatically."
        ]
        return "\n".join(help_text)
    
    # CRITICAL: Skip injection for system commands to prevent loops
    # This prevents the advisory skip issue
    is_system_command = False
    try:
        import command_system
        if command_system.is_command(user_input):
            is_system_command = True
    except:
        pass
    
    # Inject pending results if available and not a command
    if _pending_results and not _pending_results["injected"] and not is_system_command:
        formatted_results = format_results_for_injection(
            _pending_results["results"], 
            _pending_results["query"]
        )
        
        if formatted_results:
            _pending_results["injected"] = True
            modified_input = formatted_results + user_input
            
            # Log the injection
            if system_functions and "log_event" in system_functions:
                system_functions["log_event"]("log_reader_results_injected", {
                    "query": _pending_results["query"],
                    "result_count": len(_pending_results["results"])
                })
            
            print(f"[{ACTION_NAME.upper()}: Injected {len(_pending_results['results'])} log results into user input]")
            
            # Clear after injection
            _pending_results = None
            
            return modified_input
    
    return user_input

async def process_output(ai_response, system_functions=None):
    """Process AI output (no modification needed)"""
    return ai_response

# Future expansion functions (stubs for now)
async def search_saved_sessions(query, limit=10):
    """Search saved session files (future implementation)"""
    # TODO: Implement searching in saved_sessions directory
    pass

async def search_user_histories(username, query, limit=10):
    """Search user-specific histories (future implementation)"""
    # TODO: Implement with auth system integration
    pass

async def search_additional_logs(log_files, query, limit=10):
    """Search additional log files (future implementation)"""
    # TODO: Implement searching emotions.txt, focus_log.txt, etc.
    pass