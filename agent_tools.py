# agent_tools.py - Tool Implementations for V-Agent
# This module contains tool implementations only
# Core agent logic remains in v-agent.py

import asyncio
import json
import os
import re
import time
import hashlib
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

# Module state (initialized by v-agent.py)
_agent_state = None
_system_functions = None
_loader = None
_api_manager = None
_config = None
_history_cache = None
_consultant_response_cache = None
_notify_user_func = None
_silent_api_call_func = None

# Tool registry
AVAILABLE_TOOLS = {}

# ===========================================
# === INITIALIZATION ===
# ===========================================

def initialize(agent_state: Dict, system_functions: Dict, loader, api_manager, config, 
              history_cache: Dict, consultant_response_cache: Dict, 
              notify_user_func: Callable, silent_api_call_func: Callable):
    """Initialize the tools module with necessary references."""
    global _agent_state, _system_functions, _loader, _api_manager, _config
    global _history_cache, _consultant_response_cache, _notify_user_func, _silent_api_call_func
    
    _agent_state = agent_state
    _system_functions = system_functions
    _loader = loader
    _api_manager = api_manager
    _config = config
    _history_cache = history_cache
    _consultant_response_cache = consultant_response_cache
    _notify_user_func = notify_user_func
    _silent_api_call_func = silent_api_call_func
    
    # Register all tools
    _register_all_tools()

def get_available_tools() -> Dict:
    """Get all available tools."""
    return AVAILABLE_TOOLS

def _register_tool(name: str, description: str, parameters: List[str], function: Callable):
    """Register a tool in the registry."""
    AVAILABLE_TOOLS[name] = {
        "name": name,
        "description": description,
        "parameters": parameters,
        "function": function
    }

# ===========================================
# === TOOL RESULT PRESENTER ===
# ===========================================

async def present_tool_result(tool_name: str, result: Dict[str, Any]) -> str:
    """Convert tool results into user-friendly presentations."""
    
    # Special handling for consultant tools
    if tool_name.startswith("consultant_"):
        if tool_name == "consultant_assign_task" and result.get("success"):
            if "response" in result and result["response"]:
                return result["response"]
            return "Consultant task completed but no response was received."
        
        elif tool_name == "consultant_status":
            if result.get("success") and "consultants" in result:
                status_lines = [f"Consultant Status: {result.get('summary', '')}"]
                for consultant in result["consultants"]:
                    status_lines.append(
                        f"  • Consultant {consultant['id']}: "
                        f"{'Active' if consultant['enabled'] else 'Inactive'} "
                        f"({consultant['provider']}/{consultant['model']})"
                    )
                return "\n".join(status_lines)
        
        elif tool_name == "consultant_coordinate":
            if result.get("success") and "response" in result:
                return result["response"]
    
    # Special handling for log tools
    elif tool_name == "wait_for_log_results":
        if result.get("success"):
            parsed_data = result.get("parsed_data", {})
            if "last_api_status" in parsed_data:
                api_status = parsed_data["last_api_status"]
                return f"Found API status in logs: {api_status['calls_used']} / {api_status['calls_limit']} calls used"
            elif result.get("entries_found", 0) > 0:
                return f"Successfully retrieved {result['entries_found']} log entries and stored in context"
            else:
                return "Log results retrieved but no entries found"
        else:
            return result.get("error", "Failed to retrieve log results")
    
    # Default handling
    if result.get("success"):
        for field in ["message", "response", "output", "result"]:
            if field in result and isinstance(result[field], str):
                return result[field]
    
    if result.get("success"):
        return result.get("message", f"Tool '{tool_name}' executed successfully.")
    else:
        return result.get("error", f"Tool '{tool_name}' failed.")

# ===========================================
# === HELPER FUNCTIONS ===
# ===========================================

def _validate_consultant_response(response: str) -> tuple[bool, str]:
    """Validate consultant responses for safety and quality."""
    if not response or not isinstance(response, str):
        return False, "Empty or invalid response"
    
    error_patterns = [
        r"^\[ERROR:",
        r"^\[API MANAGER:",
        r"^{.*}$",
        r"^<.*>$",
    ]
    
    for pattern in error_patterns:
        if re.match(pattern, response.strip()):
            return False, f"Response appears to contain system output"
    
    if len(response.strip()) < 5:
        return False, "Response too short"
    
    return True, ""

def _cache_consultant_response(consultant_id: int, task: str, response: str):
    """Cache consultant responses."""
    cache_key = f"{consultant_id}:{hashlib.md5(task.encode()).hexdigest()[:8]}"
    current_time = time.time()
    
    # Clean old entries
    _consultant_response_cache["cache"] = {
        k: v for k, v in _consultant_response_cache["cache"].items()
        if current_time - v["timestamp"] < _consultant_response_cache["ttl_seconds"]
    }
    
    # Add new entry
    _consultant_response_cache["cache"][cache_key] = {
        "response": response,
        "timestamp": current_time,
        "task": task[:100]
    }
    
    # Limit cache size
    if len(_consultant_response_cache["cache"]) > _consultant_response_cache["max_size"]:
        oldest_key = min(
            _consultant_response_cache["cache"].keys(),
            key=lambda k: _consultant_response_cache["cache"][k]["timestamp"]
        )
        del _consultant_response_cache["cache"][oldest_key]

# ===========================================
# === COMMUNICATION TOOLS ===
# ===========================================

async def _tool_message_user(message: str) -> Dict[str, Any]:
    """Send a direct message to the user."""
    try:
        if "user_notification" in _system_functions:
            _system_functions["user_notification"](f"AI: {message}")
        else:
            print(f"AI: {message}")
        return {"success": True, "message": "Message sent to user"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def _tool_pipeline_message(message: str) -> Dict[str, Any]:
    """Send a message through the processing pipeline."""
    try:
        processed_message = message
        if _loader and hasattr(_loader, "process_input"):
            result = await _loader.process_input(message, _system_functions, is_system_command=False)
            if result is not None:
                processed_message = result
        
        if "send_to_ai" in _system_functions:
            ai_response = await _system_functions["send_to_ai"](processed_message)
            
            final_response = ai_response
            if _loader and hasattr(_loader, "process_output"):
                result = await _loader.process_output(ai_response, _system_functions)
                if result is not None:
                    final_response = result
            
            if "user_notification" in _system_functions:
                _system_functions["user_notification"](f"AI: {final_response}")
            
            return {"success": True, "ai_response": final_response}
        else:
            return {"success": False, "error": "AI communication not available"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def _tool_speak_for_user(message: str) -> Dict[str, Any]:
    """Submit input as if it came from the user."""
    try:
        with open("website_input.txt", "w", encoding="utf-8") as f:
            f.write(message)
        await asyncio.sleep(0.5)
        return {"success": True, "message_submitted": message}
    except Exception as e:
        return {"success": False, "error": f"SpeakForUser failed: {str(e)}"}

# ===========================================
# === SYSTEM COMMAND TOOLS ===
# ===========================================

async def _tool_send_command(command: str) -> Dict[str, Any]:
    """Send a system command."""
    try:
        if "send_command" in _system_functions:
            success = await asyncio.to_thread(_system_functions["send_command"], command)
            
            if success:
                await asyncio.sleep(0.2)
                return {"success": True, "command": command, "message": f"Command '{command}' sent."}
            else:
                return {"success": False, "error": f"Command '{command}' failed or was not recognized."}
        else:
            return {"success": False, "error": "send_command function not available."}
    except Exception as e:
        return {"success": False, "error": f"Error sending command: {str(e)}"}

async def _tool_control_action(action: str, operation: str) -> Dict[str, Any]:
    """Control system actions (start or stop)."""
    try:
        operation = operation.lower()
        if operation not in ['start', 'stop']:
            return {"success": False, "error": "Operation must be 'start' or 'stop'."}
        
        func_name = f"{operation}_action"
        if func_name in _system_functions and callable(_system_functions[func_name]):
            func = _system_functions[func_name]
            
            if asyncio.iscoroutinefunction(func):
                await func(action, _system_functions)
            else:
                await asyncio.to_thread(func, action, _system_functions)
            
            return {"success": True, "action": action, "operation": operation}
        else:
            return {"success": False, "error": f"System function '{func_name}' not available."}
    except Exception as e:
        return {"success": False, "error": f"Error {operation}ing action '{action}': {str(e)}"}

async def _tool_fix_response() -> Dict[str, Any]:
    """Execute the 'fix' command."""
    return await _tool_send_command("fix")

# ===========================================
# === MEMORY & CONTEXT TOOLS ===
# ===========================================

async def _tool_set_context(key: str, value: Any) -> Dict[str, Any]:
    """Set a value in agent context."""
    try:
        _agent_state["context"][key] = value
        _agent_state["pending_save"] = True
        return {"success": True, "key": key, "value": value}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def _tool_get_context(key: str) -> Dict[str, Any]:
    """Get a value from agent context."""
    try:
        value = _agent_state["context"].get(key, None)
        return {"success": True, "key": key, "value": value}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def _tool_analyze_history(pattern: str = "") -> Dict[str, Any]:
    """Analyze patterns in the agent's goal history with caching."""
    try:
        current_time = time.time()
        pattern_str = str(pattern) if pattern is not None else ""
        cache_key = hashlib.md5(f"{pattern_str}{len(_agent_state['history'])}".encode()).hexdigest()
        
        if (_history_cache.get("last_analysis_time", 0) > current_time - _history_cache["cache_duration"] and
            _history_cache.get("cache_key") == cache_key and _history_cache.get("cached_analysis") is not None):
            return {"success": True, "analysis": _history_cache["cached_analysis"]}
        
        history = _agent_state.get("history", [])
        
        if not history:
            analysis = {
                "analysis": "No history found",
                "count": 0,
                "total_goals": 0,
                "matching_goals": 0,
                "recent_matches": [],
                "keywords": {}
            }
            _history_cache.update({
                "last_analysis_time": current_time,
                "cached_analysis": analysis,
                "cache_key": cache_key
            })
            return {"success": True, "analysis": analysis}
        
        matching_goals = []
        if pattern_str:
            pattern_lower = pattern_str.lower()
            matching_goals = [h for h in history if pattern_lower in h.get("goal", "").lower()]
        else:
            matching_goals = history
        
        analysis_result = {
            "total_goals": len(history),
            "matching_goals_count": len(matching_goals),
            "matches_for_pattern": [{"goal": g["goal"], "completed_at": g["completed_at"]} 
                                   for g in matching_goals[-10:]],
            "overall_recent_goals": [{"goal": h["goal"], "completed_at": h["completed_at"]} 
                                   for h in history[-5:]],
            "common_goal_keywords": {}
        }
        
        keyword_counts = {}
        common_keywords = ["poem", "joke", "story", "search", "find", "list", "check", 
                          "set", "tell me", "what is", "how to", "create", "send", 
                          "save", "load", "summarize"]
        for entry in history:
            goal_text = entry.get("goal", "").lower()
            for word in common_keywords:
                if word in goal_text:
                    keyword_counts[word] = keyword_counts.get(word, 0) + 1
        
        analysis_result["common_goal_keywords"] = dict(
            sorted(keyword_counts.items(), key=lambda item: item[1], reverse=True)[:10]
        )
        
        _history_cache.update({
            "last_analysis_time": current_time,
            "cached_analysis": analysis_result,
            "cache_key": cache_key
        })
        
        return {"success": True, "analysis": analysis_result}
    except Exception as e:
        return {"success": False, "error": f"History analysis failed: {str(e)}"}

# System memory tools
async def _tool_memory_store_fact(fact: str, keywords: str) -> Dict[str, Any]:
    """Store a fact in system memory."""
    if not fact or not keywords:
        return {"success": False, "error": "Fact and keywords cannot be empty."}
    return await _tool_send_command(f"memory store fact {keywords.strip()} | {fact.strip()}")

async def _tool_memory_get_fact(keywords: str) -> Dict[str, Any]:
    """Retrieve facts from system memory."""
    if not keywords:
        return {"success": False, "error": "Keywords cannot be empty."}
    return await _tool_send_command(f"memory get fact {keywords.strip()}")

async def _tool_memory_list_facts() -> Dict[str, Any]:
    """List all facts in system memory."""
    return await _tool_send_command("memory list facts")

async def _tool_memory_delete_fact(keywords: str) -> Dict[str, Any]:
    """Delete a fact from system memory."""
    if not keywords:
        return {"success": False, "error": "Keywords cannot be empty."}
    return await _tool_send_command(f"memory delete fact {keywords.strip()}")

# ===========================================
# === PERSONA & PROMPT TOOLS ===
# ===========================================

async def _tool_persona_use(persona_name: str) -> Dict[str, Any]:
    """Switch to a specific persona."""
    if not persona_name:
        return {"success": False, "error": "Persona name cannot be empty."}
    return await _tool_send_command(f"persona use {persona_name.strip()}")

async def _tool_persona_list() -> Dict[str, Any]:
    """List available personas."""
    return await _tool_send_command("persona list")

async def _tool_persona_info(persona_name: str) -> Dict[str, Any]:
    """Get information about a persona."""
    if not persona_name:
        return {"success": False, "error": "Persona name cannot be empty."}
    return await _tool_send_command(f"persona info {persona_name.strip()}")

async def _tool_prompt_use(prompt_name: str) -> Dict[str, Any]:
    """Activate a system prompt."""
    if not prompt_name:
        return {"success": False, "error": "Prompt name cannot be empty."}
    return await _tool_send_command(f"prompt use {prompt_name.strip()}")

async def _tool_prompt_list() -> Dict[str, Any]:
    """List available prompts."""
    return await _tool_send_command("prompt list")

async def _tool_prompt_active() -> Dict[str, Any]:
    """Check active prompt."""
    return await _tool_send_command("prompt active")

async def _tool_prompt_show(prompt_name: str) -> Dict[str, Any]:
    """Show prompt details."""
    if not prompt_name:
        return {"success": False, "error": "Prompt name cannot be empty."}
    return await _tool_send_command(f"prompt show {prompt_name.strip()}")

# ===========================================
# === INFORMATION TOOLS ===
# ===========================================

async def _tool_check_actions() -> Dict[str, Any]:
    """Check active actions."""
    try:
        if "action_registry" in _system_functions:
            registry = _system_functions["action_registry"]()
            active_actions = []
            for name, data in registry.items():
                if data.get("is_active", False):
                    active_actions.append({
                        "name": name,
                        "priority": data.get("config", {}).get("priority", 10)
                    })
            active_actions.sort(key=lambda x: x["priority"])
            return {"success": True, "active_actions": active_actions}
        else:
            return {"success": False, "error": "Action registry not available"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def _tool_actions_info() -> Dict[str, Any]:
    """Get actions information."""
    return await _tool_send_command("actions info")

async def _tool_emotions_status() -> Dict[str, Any]:
    """Check emotions status."""
    return await _tool_send_command("emotions status")

async def _tool_emotions_reset() -> Dict[str, Any]:
    """Reset emotions."""
    return await _tool_send_command("emotions reset")

async def _tool_api_status() -> Dict[str, Any]:
    """Check API status."""
    return await _tool_send_command("api status")

async def _tool_api_switch_provider(provider_name: str) -> Dict[str, Any]:
    """Switch API provider."""
    if not provider_name:
        return {"success": False, "error": "Provider name cannot be empty."}
    return await _tool_send_command(f"api switch {provider_name.strip()}")

async def _tool_api_reset_counter() -> Dict[str, Any]:
    """Reset API counter."""
    return await _tool_send_command("api reset_counter")

async def _tool_principles_list() -> Dict[str, Any]:
    """List principles."""
    return await _tool_send_command("principles list")

async def _tool_principles_report() -> Dict[str, Any]:
    """Get principles report."""
    return await _tool_send_command("principles report")

async def _tool_advisory_status() -> Dict[str, Any]:
    """Check advisory status."""
    return await _tool_send_command("advisory status")

async def _tool_focus_status() -> Dict[str, Any]:
    """Check focus status."""
    return await _tool_send_command("focus status")

async def _tool_block_list() -> Dict[str, Any]:
    """List blocked items."""
    return await _tool_send_command("block list")

# ===========================================
# === LOG TOOLS ===
# ===========================================

async def _tool_log_search(query: str, limit: int = 10) -> Dict[str, Any]:
    """Search logs."""
    try:
        if not query:
            return {"success": False, "error": "Search query cannot be empty"}
        
        limit = min(max(1, int(limit)), 20)
        command = f"log search {query} {limit}"
        result = await _tool_send_command(command)
        
        if result.get("success"):
            _agent_state["context"]["last_log_search"] = {
                "query": query,
                "limit": limit,
                "timestamp": datetime.now().isoformat(),
                "pending": True
            }
            _agent_state["pending_save"] = True
            
            return {
                "success": True,
                "message": f"Log search initiated for '{query}' (limit: {limit}). Results will appear in next message.",
                "note": "Use wait_for_log_results to trigger result injection"
            }
        else:
            return result
    except Exception as e:
        return {"success": False, "error": f"Log search failed: {str(e)}"}

async def _tool_log_recent(count: int = 5) -> Dict[str, Any]:
    """Get recent logs."""
    try:
        count = min(max(1, int(count)), 20)
        command = f"log recent {count}"
        result = await _tool_send_command(command)
        
        if result.get("success"):
            _agent_state["context"]["last_log_recent"] = {
                "count": count,
                "timestamp": datetime.now().isoformat(),
                "pending": True
            }
            _agent_state["pending_save"] = True
            
            return {
                "success": True,
                "message": f"Retrieving {count} recent log entries. Results will appear in next message.",
                "note": "Use wait_for_log_results to trigger result injection"
            }
        else:
            return result
    except Exception as e:
        return {"success": False, "error": f"Log recent failed: {str(e)}"}

async def _tool_log_status() -> Dict[str, Any]:
    """Check log status."""
    try:
        result = await _tool_send_command("log status")
        
        search_pending = _agent_state["context"].get("last_log_search", {}).get("pending", False)
        recent_pending = _agent_state["context"].get("last_log_recent", {}).get("pending", False)
        
        status_info = {
            "command_result": result.get("message", "Unknown"),
            "agent_tracking": {
                "search_pending": search_pending,
                "recent_pending": recent_pending
            }
        }
        
        return {
            "success": True,
            "status": status_info,
            "has_pending": search_pending or recent_pending
        }
    except Exception as e:
        return {"success": False, "error": f"Log status check failed: {str(e)}"}

async def _tool_log_clear_pending() -> Dict[str, Any]:
    """Clear pending logs."""
    try:
        result = await _tool_send_command("log clear_pending")
        
        if "last_log_search" in _agent_state["context"]:
            _agent_state["context"]["last_log_search"]["pending"] = False
        if "last_log_recent" in _agent_state["context"]:
            _agent_state["context"]["last_log_recent"]["pending"] = False
        _agent_state["pending_save"] = True
        
        return {"success": True, "message": "Cleared pending log results"}
    except Exception as e:
        return {"success": False, "error": f"Clear pending failed: {str(e)}"}

async def _tool_wait_for_log_results(wait_message: str = "Processing log results...") -> Dict[str, Any]:
    """Wait for and retrieve log results."""
    try:
        instruction_message = (
            "[AGENT REQUEST: Please read the log entries above and repeat them EXACTLY as shown, "
            "including all brackets, timestamps, and formatting. Start your response with 'LOG_ENTRIES_START:' "
            "and end with 'LOG_ENTRIES_END'. This is for automated parsing.]"
        )
        
        pipeline_result = await _tool_pipeline_message(instruction_message)
        
        if pipeline_result.get("success"):
            # Clear pending flags
            if "last_log_search" in _agent_state["context"]:
                _agent_state["context"]["last_log_search"]["pending"] = False
            if "last_log_recent" in _agent_state["context"]:
                _agent_state["context"]["last_log_recent"]["pending"] = False
            _agent_state["pending_save"] = True
            
            # Extract and parse log results
            ai_response = pipeline_result.get("ai_response", "")
            log_entries = []
            parsed_data = {}
            
            # Extract entries between markers
            if "LOG_ENTRIES_START:" in ai_response and "LOG_ENTRIES_END" in ai_response:
                start_idx = ai_response.find("LOG_ENTRIES_START:") + len("LOG_ENTRIES_START:")
                end_idx = ai_response.find("LOG_ENTRIES_END")
                log_section = ai_response[start_idx:end_idx].strip()
                
                lines = log_section.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and (line[0].isdigit() or line.startswith('[')):
                        if re.match(r'^\d+\.\s', line):
                            line = re.sub(r'^\d+\.\s', '', line)
                        log_entries.append(line)
            else:
                # Fallback parsing
                lines = ai_response.split('\n')
                in_log_section = False
                for line in lines:
                    if "[LOG SEARCH RESULTS" in line or "[RECENT LOGS" in line:
                        in_log_section = True
                        continue
                    if "[END LOG RESULTS]" in line:
                        break
                    if in_log_section and line.strip():
                        if re.match(r'^\d+\.\s', line):
                            line = re.sub(r'^\d+\.\s', '', line)
                        log_entries.append(line.strip())
            
            # Parse specific patterns
            for entry in log_entries:
                api_match = re.search(r"API Call Status:\s*(\d+)\s*/\s*(\d+)", entry)
                if api_match:
                    parsed_data["last_api_status"] = {
                        "calls_used": int(api_match.group(1)),
                        "calls_limit": int(api_match.group(2)),
                        "raw_entry": entry
                    }
                
                if "API ready" in entry:
                    provider_match = re.search(r"API ready \(([^)]+)\)", entry)
                    if provider_match:
                        parsed_data["api_provider"] = provider_match.group(1)
            
            # Store results
            _agent_state["context"]["last_log_results"] = {
                "raw_response": ai_response,
                "entries": log_entries,
                "parsed_data": parsed_data,
                "timestamp": datetime.now().isoformat()
            }
            
            if "last_api_status" in parsed_data:
                _agent_state["context"]["last_api_status"] = parsed_data["last_api_status"]
            
            _agent_state["pending_save"] = True
            
            if not log_entries:
                return {
                    "success": False,
                    "error": "No log results were injected. Make sure to call log_search or log_recent first."
                }
            
            return {
                "success": True,
                "message": "Log results retrieved and processed",
                "entries_found": len(log_entries),
                "parsed_data": parsed_data
            }
        else:
            return pipeline_result
    except Exception as e:
        return {"success": False, "error": f"Wait for results failed: {str(e)}"}

# ===========================================
# === PLUGIN CONTROL TOOLS ===
# ===========================================

async def _tool_youtube_search(query: str) -> Dict[str, Any]:
    """Search YouTube."""
    if not query:
        return {"success": False, "error": "Search query cannot be empty."}
    return await _tool_send_command(f"youtube search {query.strip()}")

async def _tool_youtube_open(video_identifier: str) -> Dict[str, Any]:
    """Open YouTube video."""
    if not video_identifier:
        return {"success": False, "error": "Video identifier cannot be empty."}
    return await _tool_send_command(f"youtube open {video_identifier.strip()}")

async def _tool_wiki_search(query: str) -> Dict[str, Any]:
    """Search Wikipedia."""
    if not query:
        return {"success": False, "error": "Search query cannot be empty."}
    return await _tool_send_command(f"wiki search {query.strip()}")

async def _tool_wiki_open(page_identifier: str) -> Dict[str, Any]:
    """Open wiki page."""
    if not page_identifier:
        return {"success": False, "error": "Page identifier cannot be empty."}
    return await _tool_send_command(f"wiki open {page_identifier.strip()}")

async def _tool_sms_send(phone_number: str, message: str) -> Dict[str, Any]:
    """Send SMS."""
    if not phone_number or not message:
        return {"success": False, "error": "Phone number and message cannot be empty."}
    return await _tool_send_command(f"sms send {phone_number.strip()} | {message.strip()}")

async def _tool_sandbox_reverse_text(text: str) -> Dict[str, Any]:
    """Reverse text in sandbox."""
    if not text:
        return {"success": False, "error": "Text cannot be empty."}
    return await _tool_send_command(f"sandbox reverse_text {text}")

async def _tool_sandbox_get_var(variable_name: str) -> Dict[str, Any]:
    """Get sandbox variable."""
    if not variable_name:
        return {"success": False, "error": "Variable name cannot be empty."}
    return await _tool_send_command(f"sandbox get_var {variable_name.strip()}")

async def _tool_sandbox_set_var(variable_name: str, value: str) -> Dict[str, Any]:
    """Set sandbox variable."""
    if not variable_name:
        return {"success": False, "error": "Variable name cannot be empty."}
    return await _tool_send_command(f"sandbox set_var {variable_name.strip()} | {value}")

async def _tool_block_add(item_to_block: str) -> Dict[str, Any]:
    """Add to blocklist."""
    if not item_to_block:
        return {"success": False, "error": "Item cannot be empty."}
    return await _tool_send_command(f"block add {item_to_block.strip()}")

async def _tool_block_remove(item_to_remove: str) -> Dict[str, Any]:
    """Remove from blocklist."""
    if not item_to_remove:
        return {"success": False, "error": "Item cannot be empty."}
    return await _tool_send_command(f"block remove {item_to_remove.strip()}")

# ===========================================
# === CONSULTANT AI TOOLS ===
# ===========================================

async def _tool_consultant_status() -> Dict[str, Any]:
    """Check consultant status."""
    try:
        consultants_info = []
        for i in range(1, 5):
            addon_num = str(i) if i > 1 else ""
            prefix = f"ADDON_AI{addon_num}_"
            
            consultant_data = {
                "id": i,
                "name": f"addon_ai{addon_num}",
                "enabled": _config.get(f"{prefix}ENABLED", False),
                "provider": _config.get(f"{prefix}PROVIDER", "Not set"),
                "model": _config.get(f"{prefix}MODEL_NAME", "Not set"),
                "mode": _config.get(f"{prefix}MODE", "delayed"),
                "inject_response": _config.get(f"{prefix}INJECT_RESPONSE", False),
                "history_turns": _config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
            }
            consultants_info.append(consultant_data)
        
        api_status = {}
        if _api_manager:
            status = _api_manager.get_api_call_status()
            api_status = {
                "calls_used": status.get('count', 0),
                "call_limit": status.get('limit', 100)
            }
        
        return {
            "success": True,
            "consultants": consultants_info,
            "api_status": api_status,
            "summary": f"{sum(1 for c in consultants_info if c['enabled'])} of 4 consultants active"
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to check consultant status: {str(e)}"}

async def _tool_consultant_enable(consultant_id: int, mode: str = "delayed") -> Dict[str, Any]:
    """Enable consultant."""
    try:
        consultant_id = int(consultant_id)
        if consultant_id < 1 or consultant_id > 4:
            return {"success": False, "error": "Consultant ID must be 1-4"}
        
        if mode not in ["live", "delayed"]:
            return {"success": False, "error": "Mode must be 'live' or 'delayed'"}
        
        addon_num = str(consultant_id) if consultant_id > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        
        _config.set(f"{prefix}ENABLED", True)
        _config.set(f"{prefix}MODE", mode)
        _config.save_config()
        
        _agent_state["context"][f"consultant_{consultant_id}_active"] = True
        _agent_state["context"][f"consultant_{consultant_id}_mode"] = mode
        _agent_state["pending_save"] = True
        
        return {
            "success": True,
            "consultant_id": consultant_id,
            "enabled": True,
            "mode": mode,
            "message": f"Consultant {consultant_id} enabled in {mode} mode"
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to enable consultant: {str(e)}"}

async def _tool_consultant_disable(consultant_id: int) -> Dict[str, Any]:
    """Disable consultant."""
    try:
        consultant_id = int(consultant_id)
        if consultant_id < 1 or consultant_id > 4:
            return {"success": False, "error": "Consultant ID must be 1-4"}
        
        addon_num = str(consultant_id) if consultant_id > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        
        _config.set(f"{prefix}ENABLED", False)
        _config.save_config()
        
        _agent_state["context"][f"consultant_{consultant_id}_active"] = False
        _agent_state["pending_save"] = True
        
        return {
            "success": True,
            "consultant_id": consultant_id,
            "enabled": False,
            "message": f"Consultant {consultant_id} disabled"
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to disable consultant: {str(e)}"}

async def _tool_consultant_configure(consultant_id: int, provider: str, model: str) -> Dict[str, Any]:
    """Configure consultant."""
    try:
        consultant_id = int(consultant_id)
        if consultant_id < 1 or consultant_id > 4:
            return {"success": False, "error": "Consultant ID must be 1-4"}
        
        addon_num = str(consultant_id) if consultant_id > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        
        # Validate provider
        if _api_manager and hasattr(_api_manager, '_current_config'):
            providers = _api_manager._current_config.get("providers", {})
            if provider not in providers:
                return {"success": False, "error": f"Provider '{provider}' not found in api_config"}
            
            provider_config = providers.get(provider, {})
            available_models = provider_config.get("available_models", [])
            if available_models and model not in available_models:
                if provider == "openai" and model == "gpt-4":
                    suggested = [m for m in available_models if m.startswith("gpt-4")]
                    if suggested:
                        _notify_user_func(f"Warning: '{model}' not in available models. Consider: {', '.join(suggested)}", True)
        
        _config.set(f"{prefix}PROVIDER", provider)
        _config.set(f"{prefix}MODEL_NAME", model)
        _config.save_config()
        
        _agent_state["context"][f"consultant_{consultant_id}_provider"] = provider
        _agent_state["context"][f"consultant_{consultant_id}_model"] = model
        _agent_state["pending_save"] = True
        
        return {
            "success": True,
            "consultant_id": consultant_id,
            "provider": provider,
            "model": model,
            "message": f"Consultant {consultant_id} configured with {provider}/{model}"
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to configure consultant: {str(e)}"}

async def _tool_consultant_assign_task(task: str, consultant_ids: str, wait_for_response: bool = True) -> Dict[str, Any]:
    """Assign task to consultants."""
    try:
        # Parse consultant IDs
        ids = [int(x.strip()) for x in consultant_ids.split(",") if x.strip().isdigit()]
        if not ids or any(id < 1 or id > 4 for id in ids):
            return {"success": False, "error": "Invalid consultant IDs. Must be comma-separated numbers 1-4"}
        
        results = {}
        enabled_consultants = []
        
        # Check enabled consultants
        for consultant_id in ids:
            addon_num = str(consultant_id) if consultant_id > 1 else ""
            prefix = f"ADDON_AI{addon_num}_"
            if _config.get(f"{prefix}ENABLED", False):
                enabled_consultants.append(consultant_id)
        
        if not enabled_consultants:
            return {"success": False, "error": "None of the specified consultants are enabled"}
        
        if wait_for_response and _api_manager:
            # Get responses from consultants
            for consultant_id in enabled_consultants:
                addon_num = str(consultant_id) if consultant_id > 1 else ""
                prefix = f"ADDON_AI{addon_num}_"
                
                provider = _config.get(f"{prefix}PROVIDER")
                model = _config.get(f"{prefix}MODEL_NAME")
                history_turns = _config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
                
                # Check cache
                cache_key = f"{consultant_id}:{hashlib.md5(task.encode()).hexdigest()[:8]}"
                current_time = time.time()
                if cache_key in _consultant_response_cache["cache"]:
                    cached = _consultant_response_cache["cache"][cache_key]
                    if current_time - cached["timestamp"] < _consultant_response_cache["ttl_seconds"]:
                        results[f"consultant_{consultant_id}"] = {
                            "provider": provider,
                            "model": model,
                            "response": cached["response"],
                            "cached": True
                        }
                        continue
                
                # Prepare history
                history_for_call = []
                if history_turns > 0 and hasattr(_api_manager, 'get_history'):
                    full_history = _api_manager.get_history()
                    num_messages = history_turns * 2
                    history_for_call = full_history[-num_messages:] if len(full_history) > num_messages else full_history
                
                # Get response
                response = await _api_manager.send_message_to_specific_provider(
                    task, provider, model, conversation_history_override=history_for_call
                )
                
                # Validate response
                is_valid, validation_error = _validate_consultant_response(response)
                if is_valid:
                    _cache_consultant_response(consultant_id, task, response)
                
                results[f"consultant_{consultant_id}"] = {
                    "provider": provider,
                    "model": model,
                    "response": response if is_valid else f"[Invalid response: {validation_error}]"
                }
        else:
            # Queue task
            for consultant_id in enabled_consultants:
                results[f"consultant_{consultant_id}"] = {
                    "status": "Task queued for processing"
                }
        
        # Build clean response
        if wait_for_response and results:
            response_parts = []
            for consultant_id in enabled_consultants:
                consultant_key = f"consultant_{consultant_id}"
                if consultant_key in results:
                    result = results[consultant_key]
                    if "response" in result and result["response"] and not result["response"].startswith("["):
                        addon_num = str(consultant_id) if consultant_id > 1 else ""
                        consultant_name = f"Consultant {consultant_id}"
                        provider_info = f"({result['provider']}/{result['model']})"
                        cached_info = " [cached]" if result.get("cached", False) else ""
                        response_parts.append(
                            f"{consultant_name} {provider_info}{cached_info}:\n{result['response']}"
                        )
            
            if response_parts:
                _agent_state["context"]["last_consultant_task_metadata"] = {
                    "task": task,
                    "consultants_used": enabled_consultants,
                    "results": results,
                    "timestamp": datetime.now().isoformat()
                }
                _agent_state["pending_save"] = True
                
                final_response = "\n\n---\n\n".join(response_parts)
                return {
                    "success": True,
                    "response": final_response
                }
        
        # Track task
        task_record = {
            "task": task,
            "consultants": enabled_consultants,
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
        if "consultant_tasks" not in _agent_state["context"]:
            _agent_state["context"]["consultant_tasks"] = []
        _agent_state["context"]["consultant_tasks"].append(task_record)
        _agent_state["pending_save"] = True
        
        return {
            "success": True,
            "task": task,
            "consultants_used": enabled_consultants,
            "results": results
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to assign task: {str(e)}"}

async def _tool_consultant_coordinate(task_description: str, consultant_assignments: str) -> Dict[str, Any]:
    """Coordinate multiple consultants."""
    try:
        # Parse assignments
        try:
            assignments = json.loads(consultant_assignments)
        except json.JSONDecodeError:
            return {"success": False, "error": "consultant_assignments must be valid JSON"}
        
        if not isinstance(assignments, dict):
            return {"success": False, "error": "consultant_assignments must be a JSON object"}
        
        coordination_results = {
            "task_description": task_description,
            "assignments": {},
            "synthesis": None
        }
        
        # Process assignments
        for consultant_str, role_info in assignments.items():
            try:
                consultant_id = int(consultant_str)
                if consultant_id < 1 or consultant_id > 4:
                    continue
                
                addon_num = str(consultant_id) if consultant_id > 1 else ""
                prefix = f"ADDON_AI{addon_num}_"
                
                if not _config.get(f"{prefix}ENABLED", False):
                    coordination_results["assignments"][consultant_str] = {
                        "error": "Consultant not enabled"
                    }
                    continue
                
                # Build role-specific prompt
                if isinstance(role_info, dict):
                    role = role_info.get("role", "assistant")
                    subtask = role_info.get("subtask", task_description)
                else:
                    role = str(role_info)
                    subtask = task_description
                
                role_prompt = f"As a {role}, address this task: {subtask}"
                
                # Get response
                provider = _config.get(f"{prefix}PROVIDER")
                model = _config.get(f"{prefix}MODEL_NAME")
                
                response = await _api_manager.send_message_to_specific_provider(
                    role_prompt, provider, model, conversation_history_override=[]
                )
                
                # Validate
                is_valid, validation_error = _validate_consultant_response(response)
                
                coordination_results["assignments"][consultant_str] = {
                    "role": role,
                    "subtask": subtask,
                    "response": response if is_valid else f"[Invalid response: {validation_error}]"
                }
                
            except (ValueError, KeyError) as e:
                coordination_results["assignments"][consultant_str] = {
                    "error": f"Invalid assignment: {str(e)}"
                }
        
        # Synthesize if multiple valid responses
        valid_responses = [
            v for v in coordination_results["assignments"].values()
            if "response" in v and not v.get("response", "").startswith("[")
        ]
        
        if len(valid_responses) > 1:
            synthesis_prompt = f"Task: {task_description}\n\nConsultant responses:\n"
            for i, resp_data in enumerate(valid_responses, 1):
                synthesis_prompt += f"\n{resp_data['role']}: {resp_data['response'][:500]}...\n"
            synthesis_prompt += "\nSynthesize these responses into a cohesive solution."
            
            if "send_to_ai" in _system_functions:
                synthesis = await _system_functions["send_to_ai"](synthesis_prompt)
                coordination_results["synthesis"] = synthesis
        
        # Build clean response
        if coordination_results.get("synthesis"):
            return {
                "success": True,
                "response": f"Coordinated Analysis:\n{coordination_results['synthesis']}"
            }
        else:
            response_parts = []
            for consultant_str, data in coordination_results["assignments"].items():
                if "response" in data and not data["response"].startswith("["):
                    response_parts.append(
                        f"{data.get('role', 'Consultant')}:\n{data['response']}"
                    )
            
            if response_parts:
                return {
                    "success": True,
                    "response": "\n\n---\n\n".join(response_parts)
                }
            else:
                return {
                    "success": True,
                    "response": "Coordination completed but no valid responses received.",
                    "coordination_results": coordination_results
                }
    except Exception as e:
        return {"success": False, "error": f"Failed to coordinate consultants: {str(e)}"}

# ===========================================
# === UTILITY TOOLS ===
# ===========================================

async def _tool_wait(seconds: float) -> Dict[str, Any]:
    """Wait for specified seconds."""
    try:
        s = float(seconds)
        if s < 0:
            s = 0
        await asyncio.sleep(s)
        return {"success": True, "waited": s}
    except ValueError:
        return {"success": False, "error": "Invalid number of seconds."}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ===========================================
# === TOOL REGISTRATION ===
# ===========================================

def _register_all_tools():
    """Register all available tools."""
    # Clear existing
    AVAILABLE_TOOLS.clear()
    
    # Communication tools
    _register_tool("message_user", "Send a direct message to user (AI won't remember this).", 
                  ["message"], _tool_message_user)
    _register_tool("pipeline_message", "Send message through pipeline to AI (AI will remember this).", 
                  ["message"], _tool_pipeline_message)
    _register_tool("speak_for_user", "Submit input as if it came from the user (speakforuser).", 
                  ["message"], _tool_speak_for_user)
    
    # System command tools
    _register_tool("send_command", "Send a generic system command (use specific tools if available).", 
                  ["command"], _tool_send_command)
    _register_tool("control_action", "Start or stop a system action/module.", 
                  ["action", "operation"], _tool_control_action)
    _register_tool("fix_response", "Load the last saved AI response for iteration.", 
                  [], _tool_fix_response)
    
    # Memory management tools
    _register_tool("set_context", "Store a value in the AGENT'S PERSONAL short-term context.", 
                  ["key", "value"], _tool_set_context)
    _register_tool("get_context", "Retrieve a value from the AGENT'S PERSONAL short-term context.", 
                  ["key"], _tool_get_context)
    _register_tool("analyze_history", "Analyze patterns in the AGENT'S GOAL HISTORY.", 
                  ["pattern"], _tool_analyze_history)
    _register_tool("memory_store_fact", "Store a fact in SYSTEM-WIDE long-term memory.", 
                  ["fact", "keywords"], _tool_memory_store_fact)
    _register_tool("memory_get_fact", "Retrieve facts from SYSTEM-WIDE memory.", 
                  ["keywords"], _tool_memory_get_fact)
    _register_tool("memory_list_facts", "List all facts stored in SYSTEM-WIDE memory.", 
                  [], _tool_memory_list_facts)
    _register_tool("memory_delete_fact", "Delete a fact from system memory.", 
                  ["keywords"], _tool_memory_delete_fact)
    
    # Persona & prompt tools
    _register_tool("persona_use", "Switch to a specific AI persona.", 
                  ["persona_name"], _tool_persona_use)
    _register_tool("persona_list", "List available AI personas.", 
                  [], _tool_persona_list)
    _register_tool("persona_info", "Get information about a specific persona.", 
                  ["persona_name"], _tool_persona_info)
    _register_tool("prompt_use", "Activate a system prompt.", 
                  ["prompt_name"], _tool_prompt_use)
    _register_tool("prompt_list", "List all available system prompts.", 
                  [], _tool_prompt_list)
    _register_tool("prompt_active", "Check which system prompt is active.", 
                  [], _tool_prompt_active)
    _register_tool("prompt_show", "Show the content of a specific system prompt.", 
                  ["prompt_name"], _tool_prompt_show)
    
    # Information tools
    _register_tool("check_actions", "Check which system actions/modules are active.", 
                  [], _tool_check_actions)
    _register_tool("actions_info", "Get information about available system actions.", 
                  [], _tool_actions_info)
    _register_tool("emotions_status", "Check current emotional analysis.", 
                  [], _tool_emotions_status)
    _register_tool("emotions_reset", "Reset the emotional analysis data.", 
                  [], _tool_emotions_reset)
    _register_tool("api_status", "Check AI API usage and limits.", 
                  [], _tool_api_status)
    _register_tool("api_switch_provider", "Switch the active AI API provider.", 
                  ["provider_name"], _tool_api_switch_provider)
    _register_tool("api_reset_counter", "Reset the API usage token counter.", 
                  [], _tool_api_reset_counter)
    _register_tool("principles_list", "List the guiding principles.", 
                  [], _tool_principles_list)
    _register_tool("principles_report", "Get a report on principle adherence.", 
                  [], _tool_principles_report)
    _register_tool("advisory_status", "Get the current status of system advisories.", 
                  [], _tool_advisory_status)
    _register_tool("focus_status", "Get the status of the text processing focus module.", 
                  [], _tool_focus_status)
    _register_tool("block_list", "List currently blocked items or patterns.", 
                  [], _tool_block_list)
    
    # Log tools
    _register_tool("log_search", "Search conversation history. Results appear in NEXT turn.", 
                  ["query", "limit"], _tool_log_search)
    _register_tool("log_recent", "Get recent conversation entries. Results appear in NEXT turn.", 
                  ["count"], _tool_log_recent)
    _register_tool("log_status", "Check if there are pending log results.", 
                  [], _tool_log_status)
    _register_tool("log_clear_pending", "Clear any pending log results.", 
                  [], _tool_log_clear_pending)
    _register_tool("wait_for_log_results", "Send message to trigger log result injection.", 
                  ["wait_message"], _tool_wait_for_log_results)
    
    # Plugin control tools
    _register_tool("youtube_search", "Search for videos on YouTube.", 
                  ["query"], _tool_youtube_search)
    _register_tool("youtube_open", "Open a specific YouTube video.", 
                  ["video_identifier"], _tool_youtube_open)
    _register_tool("wiki_search", "Search for articles on Wikipedia.", 
                  ["query"], _tool_wiki_search)
    _register_tool("wiki_open", "Open a specific wiki page.", 
                  ["page_identifier"], _tool_wiki_open)
    _register_tool("sms_send", "Send a text message via SMS plugin.", 
                  ["phone_number", "message"], _tool_sms_send)
    _register_tool("sandbox_reverse_text", "Reverse a string of text using sandbox.", 
                  ["text"], _tool_sandbox_reverse_text)
    _register_tool("sandbox_get_var", "Get a variable from the sandbox environment.", 
                  ["variable_name"], _tool_sandbox_get_var)
    _register_tool("sandbox_set_var", "Set a variable in the sandbox environment.", 
                  ["variable_name", "value"], _tool_sandbox_set_var)
    _register_tool("block_add", "Add an item or pattern to the blocklist.", 
                  ["item_to_block"], _tool_block_add)
    _register_tool("block_remove", "Remove an item or pattern from the blocklist.", 
                  ["item_to_remove"], _tool_block_remove)
    
    # Consultant AI tools
    _register_tool("consultant_status", "Check the status of all consultant AIs.", 
                  [], _tool_consultant_status)
    _register_tool("consultant_enable", "Enable a specific consultant AI.", 
                  ["consultant_id", "mode"], _tool_consultant_enable)
    _register_tool("consultant_disable", "Disable a specific consultant AI.", 
                  ["consultant_id"], _tool_consultant_disable)
    _register_tool("consultant_configure", "Configure a consultant AI's provider and model.", 
                  ["consultant_id", "provider", "model"], _tool_consultant_configure)
    _register_tool("consultant_assign_task", "Assign a task to consultant AI(s).", 
                  ["task", "consultant_ids", "wait_for_response"], _tool_consultant_assign_task)
    _register_tool("consultant_coordinate", "Coordinate multiple consultants with roles.", 
                  ["task_description", "consultant_assignments"], _tool_consultant_coordinate)
    
    # Utility tools
    _register_tool("wait", "Pause agent execution for specified seconds.", 
                  ["seconds"], _tool_wait)