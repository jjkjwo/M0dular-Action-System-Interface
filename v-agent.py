# v-agent.py - Goal-Oriented Agent Core (MINIMAL DECOUPLING)
# This version only moves tool IMPLEMENTATIONS to agent_tools.py
# Core logic, state machine, and critical functions remain here
#
# CRITICAL: This preserves ALL functionality from the original

import asyncio
import json
import os
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib
import config
import re

# Import tool implementations
import agent_tools

# ===========================================
# === AGENT STATE & CONFIGURATION ===
# ===========================================

_agent_state = {
    "active": False,
    "current_goal": None,
    "goal_steps": [],
    "current_step_index": 0,
    "context": {},
    "history": [],
    "tools_used": [],
    "pending_save": False,
    "consultant_original_states": {}
}

_system_functions = {}
_loader = None
_api_manager = None
_available_tools = {}

AGENT_TOOLS_FILE = "agent_tools.json"
AGENT_STATE_FILE = "agent_state.json"
MAX_STEPS_PER_GOAL = 20
MAX_HISTORY_SIZE = 100
SAVE_BATCH_SIZE = 3

USE_AI_PREFIX_FOR_MESSAGES = True
SYSTEM_MESSAGE_PREFIX = "[V-AGENT]"

_history_cache = {
    "last_analysis_time": 0,
    "cached_analysis": None,
    "cache_duration": 60,
    "cache_key": None
}

_consultant_response_cache = {
    "cache": {},
    "max_size": 10,
    "ttl_seconds": 300
}

# ===========================================
# === CRITICAL HELPER FUNCTIONS (KEEP HERE) ===
# ===========================================

def _format_message(message: str, is_system_message: bool = False) -> str:
    """Format messages with appropriate prefix."""
    if is_system_message:
        return f"{SYSTEM_MESSAGE_PREFIX} {message}"
    elif USE_AI_PREFIX_FOR_MESSAGES:
        return f"AI: {message}"
    else:
        return message

def _notify_user(message: str, is_system_message: bool = False):
    """Send a notification to the user."""
    formatted_message = _format_message(message, is_system_message)
    if "user_notification" in _system_functions:
        _system_functions["user_notification"](formatted_message)
    else:
        print(formatted_message)

async def _silent_api_call(prompt: str) -> str:
    """Make an API call without polluting conversation history."""
    if _api_manager and hasattr(_api_manager, 'send_message_to_specific_provider'):
        provider = _api_manager.get_active_provider()
        model = _api_manager.get_active_model_name()
        if provider and model:
            return await _api_manager.send_message_to_specific_provider(
                prompt, provider, model, conversation_history_override=[]
            )
    return "[ERROR: API not available]"

def _save_consultant_states():
    """Save the current state of all consultant AIs."""
    consultant_states = {}
    
    for i in range(1, 5):
        addon_num = str(i) if i > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        
        consultant_states[f"consultant_{i}"] = {
            "enabled": config.get(f"{prefix}ENABLED", False),
            "provider": config.get(f"{prefix}PROVIDER", "Not set"),
            "model": config.get(f"{prefix}MODEL_NAME", "Not set"),
            "mode": config.get(f"{prefix}MODE", "delayed"),
            "inject_response": config.get(f"{prefix}INJECT_RESPONSE", False),
            "history_turns": config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
        }
    
    _agent_state["consultant_original_states"] = consultant_states
    _agent_state["pending_save"] = True
    print(f"{SYSTEM_MESSAGE_PREFIX} Saved consultant states before goal execution")

def _restore_consultant_states():
    """Restore consultant AIs to their original state."""
    if not _agent_state.get("consultant_original_states"):
        return
    
    restored_count = 0
    for i in range(1, 5):
        addon_num = str(i) if i > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        consultant_key = f"consultant_{i}"
        
        if consultant_key in _agent_state["consultant_original_states"]:
            original_state = _agent_state["consultant_original_states"][consultant_key]
            
            current_enabled = config.get(f"{prefix}ENABLED", False)
            current_provider = config.get(f"{prefix}PROVIDER", "Not set")
            current_model = config.get(f"{prefix}MODEL_NAME", "Not set")
            current_mode = config.get(f"{prefix}MODE", "delayed")
            current_inject = config.get(f"{prefix}INJECT_RESPONSE", False)
            current_turns = config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
            
            if (current_enabled != original_state["enabled"] or
                current_provider != original_state["provider"] or
                current_model != original_state["model"] or
                current_mode != original_state["mode"] or
                current_inject != original_state["inject_response"] or
                current_turns != original_state["history_turns"]):
                
                config.set(f"{prefix}ENABLED", original_state["enabled"])
                config.set(f"{prefix}PROVIDER", original_state["provider"])
                config.set(f"{prefix}MODEL_NAME", original_state["model"])
                config.set(f"{prefix}MODE", original_state["mode"])
                config.set(f"{prefix}INJECT_RESPONSE", original_state["inject_response"])
                config.set(f"{prefix}MAX_HISTORY_TURNS", original_state["history_turns"])
                restored_count += 1
    
    if restored_count > 0:
        config.save_config()
        print(f"{SYSTEM_MESSAGE_PREFIX} Restored {restored_count} consultant(s) to original state")
    
    _agent_state["consultant_original_states"] = {}
    _agent_state["pending_save"] = True

def _export_tools_to_json():
    """Export all available tools to JSON for frontend visibility."""
    try:
        if not _available_tools:
            return
        
        categorized_tools = {
            "communication": [],
            "system_commands": [],
            "memory_management": [],
            "persona_and_prompts": [],
            "information": [],
            "plugin_control": [],
            "agent_control": [],
            "consultant_control": [],
            "utility": []
        }
        
        category_mapping = {
            "message_user": "communication",
            "pipeline_message": "communication",
            "speak_for_user": "communication",
            "send_command": "system_commands",
            "control_action": "system_commands",
            "fix_response": "system_commands",
            "set_context": "memory_management",
            "get_context": "memory_management",
            "analyze_history": "memory_management",
            "memory_store_fact": "memory_management",
            "memory_get_fact": "memory_management",
            "memory_list_facts": "memory_management",
            "memory_delete_fact": "memory_management",
            "persona_use": "persona_and_prompts",
            "persona_list": "persona_and_prompts",
            "persona_info": "persona_and_prompts",
            "prompt_use": "persona_and_prompts",
            "prompt_list": "persona_and_prompts",
            "prompt_active": "persona_and_prompts",
            "prompt_show": "persona_and_prompts",
            "emotions_status": "information",
            "emotions_reset": "information",
            "api_status": "information",
            "api_switch_provider": "information",
            "api_reset_counter": "information",
            "check_actions": "information",
            "actions_info": "information",
            "principles_list": "information",
            "principles_report": "information",
            "advisory_status": "information",
            "focus_status": "information",
            "block_list": "information",
            "log_search": "information",
            "log_recent": "information",
            "log_status": "information",
            "log_clear_pending": "information",
            "wait_for_log_results": "information",
            "youtube_search": "plugin_control",
            "youtube_open": "plugin_control",
            "wiki_search": "plugin_control",
            "wiki_open": "plugin_control",
            "sms_send": "plugin_control",
            "sandbox_reverse_text": "plugin_control",
            "sandbox_get_var": "plugin_control",
            "sandbox_set_var": "plugin_control",
            "block_add": "plugin_control",
            "block_remove": "plugin_control",
            "consultant_status": "consultant_control",
            "consultant_enable": "consultant_control",
            "consultant_disable": "consultant_control",
            "consultant_configure": "consultant_control",
            "consultant_assign_task": "consultant_control",
            "consultant_coordinate": "consultant_control",
            "wait": "utility"
        }
        
        export_data = {
            "metadata": {
                "exported_at": datetime.now().isoformat(),
                "total_tools": len(_available_tools),
                "description": "Available tools for the V-Agent system"
            },
            "tools": {},
            "categorized": categorized_tools
        }
        
        for tool_name, tool_info in _available_tools.items():
            default_category = "utility" if "wait" in tool_name else "agent_control"
            
            tool_export = {
                "name": tool_name,
                "description": tool_info.get("description", "No description available"),
                "parameters": tool_info.get("parameters", []),
                "category": category_mapping.get(tool_name, default_category)
            }
            
            export_data["tools"][tool_name] = tool_export
            
            category = tool_export["category"]
            if category in categorized_tools:
                categorized_tools[category].append({
                    "name": tool_name,
                    "description": tool_info.get("description", ""),
                    "parameters": tool_info.get("parameters", [])
                })
        
        with open(AGENT_TOOLS_FILE, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2)
        
        print(f"{SYSTEM_MESSAGE_PREFIX} Exported {len(_available_tools)} tools to {AGENT_TOOLS_FILE}")
        
    except Exception as e:
        print(f"{SYSTEM_MESSAGE_PREFIX} Warning: Failed to export tools: {e}")

# ===========================================
# === INITIALIZATION ===
# ===========================================

def initialize(system_functions: Dict, loader_module, api_manager_module):
    """Initialize the agent with system functions and module references."""
    global _system_functions, _loader, _api_manager, _available_tools
    
    _system_functions = system_functions
    _loader = loader_module
    _api_manager = api_manager_module
    
    # Initialize the tools module with ALL necessary references
    agent_tools.initialize(
        agent_state=_agent_state,
        system_functions=_system_functions,
        loader=_loader,
        api_manager=_api_manager,
        config=config,
        history_cache=_history_cache,
        consultant_response_cache=_consultant_response_cache,
        notify_user_func=_notify_user,
        silent_api_call_func=_silent_api_call
    )
    
    # Get available tools
    _available_tools = agent_tools.get_available_tools()
    
    # Export tools for frontend visibility
    _export_tools_to_json()
    
    # Load saved state
    _load_state()
    
    # Check for advisory system
    try:
        import advisory
        if hasattr(advisory, 'register_advisory'):
            print(f"{SYSTEM_MESSAGE_PREFIX} Advisory system detected - will use for status updates")
    except Exception:
        pass
    
    print(f"{SYSTEM_MESSAGE_PREFIX} Initialized with {len(_available_tools)} tools")

# ===========================================
# === PUBLIC INTERFACE ===
# ===========================================

def is_active() -> bool:
    """Check if the agent is currently active with a goal."""
    return _agent_state["active"] and _agent_state["current_goal"] is not None

async def handle_input_or_command(user_input: str) -> bool:
    """Handle agent-specific commands or goal setting."""
    input_lower = user_input.lower().strip()
    
    if input_lower.startswith("agent "):
        command_part = input_lower[len("agent "):].strip()
        await _handle_agent_command(command_part)
        return True
    
    if input_lower.startswith("goal:"):
        goal_description = user_input[len("goal:"):].strip()
        if not goal_description:
            _notify_user("Goal description cannot be empty.", is_system_message=True)
            return True
        await _set_new_goal(goal_description)
        return True
    
    if is_active() and not (input_lower.startswith(("start ", "stop ", "delay ")) or input_lower == "delay"):
        _agent_state["context"]["last_user_input_during_goal"] = user_input
        _agent_state["context"]["last_user_input_time"] = datetime.now().isoformat()
        _agent_state["pending_save"] = True
    
    return False

async def take_turn():
    """Execute the next step in the current goal."""
    if not is_active():
        return
    
    state = _agent_state
    if state["current_step_index"] >= len(state["goal_steps"]):
        await _complete_goal()
        return
    
    current_step = state["goal_steps"][state["current_step_index"]]
    step_description = current_step.get('description', 'No description')
    
    # Use advisory system if available
    try:
        import advisory
        if hasattr(advisory, 'register_advisory'):
            step_info = f"Step {state['current_step_index'] + 1}/{len(state['goal_steps'])}: {step_description}"
            import inspect
            sig = inspect.signature(advisory.register_advisory)
            if 'category' in sig.parameters:
                advisory.register_advisory("v-agent", f"[AGENT EXECUTING] {step_info}", 
                                         priority=3, persistent=False, category="AGENT_ACTIVITY")
            else:
                advisory.register_advisory("v-agent", f"[AGENT EXECUTING] {step_info}", 
                                         priority=3, persistent=False)
    except Exception:
        pass
    
    print(f"{SYSTEM_MESSAGE_PREFIX} Executing step {state['current_step_index'] + 1}/{len(state['goal_steps'])}: {step_description}")
    
    tool_name = current_step.get("tool")
    params = current_step.get("parameters", {})
    
    if tool_name in _available_tools:
        tool_info = _available_tools[tool_name]
        tool_func = tool_info["function"]
        
        try:
            result = await tool_func(**params)
            
            state["tools_used"].append({
                "tool": tool_name,
                "parameters": params,
                "result": result,
                "timestamp": datetime.now().isoformat()
            })
            
            if isinstance(result, dict):
                user_message = await agent_tools.present_tool_result(tool_name, result)
                
                if result.get("success", False):
                    state["current_step_index"] += 1
                    state["pending_save"] = True
                    
                    is_system_msg = not tool_name.startswith("consultant_")
                    _notify_user(user_message, is_system_message=is_system_msg)
                    
                    if state["current_step_index"] % SAVE_BATCH_SIZE == 0:
                        _save_state()
                else:
                    _notify_user(f"Tool '{tool_name}' error: {user_message}", is_system_message=True)
                    
                    error_msg = result.get("error", "Unknown error")
                    critical_errors = [
                        "not found in configuration",
                        "not found in api_config",
                        "Provider .* not found",
                        "Consultant ID must be"
                    ]
                    
                    is_critical = any(re.search(pattern, error_msg, re.IGNORECASE) for pattern in critical_errors)
                    
                    if is_critical:
                        _notify_user("Critical error detected. Aborting goal and restoring consultant states.", 
                                   is_system_message=True)
                        await _stop_agent()
                        return
                    else:
                        state["current_step_index"] += 1
                        state["pending_save"] = True
                        _save_state()
            else:
                _notify_user(f"Tool '{tool_name}' returned unexpected result type.", is_system_message=True)
                state["current_step_index"] += 1
                state["pending_save"] = True
                _save_state()
                
        except TypeError as te:
            _notify_user(f"Parameter error for tool '{tool_name}': {te}", is_system_message=True)
            state["current_step_index"] += 1
            state["pending_save"] = True
            _save_state()
        except Exception as e:
            _notify_user(f"Exception executing tool '{tool_name}': {str(e)}. Aborting goal.", is_system_message=True)
            await _stop_agent()
            return
    else:
        _notify_user(f"Unknown tool: '{tool_name}'. Skipping step.", is_system_message=True)
        state["current_step_index"] += 1
        state["pending_save"] = True
        _save_state()

# ===========================================
# === CORE AGENT LOGIC ===
# ===========================================

async def _set_new_goal(goal_description: str):
    """Set a new goal for the agent."""
    if not goal_description:
        _notify_user("Cannot set an empty goal.", is_system_message=True)
        return
        
    if _agent_state["active"]:
        _notify_user(f"Agent is already active with goal: '{_agent_state['current_goal']}'. "
                    "Stop current goal first.", is_system_message=True)
        return
    
    if config.get("AGENT_AUTO_DISABLE_ADDONS_ON_GOAL", False):
        if "disable_all_addons" in _system_functions:
            await _system_functions["disable_all_addons"]()
            _notify_user("Auto-disabled all consultant AIs for goal execution (safety mode).", 
                        is_system_message=True)
    
    _save_consultant_states()
    
    _agent_state["current_goal"] = goal_description
    _notify_user(f"Decomposing goal: {goal_description}...", is_system_message=True)
    
    start_time = time.time()
    parsed_steps = await _parse_goal_to_steps(goal_description)
    decomposition_time = time.time() - start_time
    
    _agent_state["goal_steps"] = parsed_steps
    _agent_state["current_step_index"] = 0
    _agent_state["active"] = True
    _agent_state["tools_used"] = []
    _agent_state["pending_save"] = True
    
    _save_state()
    
    _notify_user(f"New goal set: {goal_description}", is_system_message=True)
    _notify_user(f"Decomposed in {decomposition_time:.2f}s. Created {len(parsed_steps)} steps. "
                f"First step: '{parsed_steps[0].get('description', 'N/A') if parsed_steps else 'None'}'", 
                is_system_message=True)
    
    goal_lower = goal_description.lower()
    if "remember" in goal_lower or "memory" in goal_lower:
        if any(step.get("tool") == "memory_store_fact" for step in parsed_steps):
            _notify_user("(Note: This goal appears to involve system memory for permanent storage.)", 
                        is_system_message=True)
        elif any(step.get("tool") == "set_context" for step in parsed_steps):
            _notify_user("(Note: This goal appears to involve agent context for temporary storage.)", 
                        is_system_message=True)

async def _parse_goal_to_steps(goal: str) -> List[Dict]:
    """Parse a goal into executable steps using AI decomposition."""
    steps = []
    goal_lower = goal.lower()
    
    # Pre-defined patterns
    if any(phrase in goal_lower for phrase in ["what have i done", "what did i ask", "my history", 
                                                 "previous goals", "goal history"]):
        steps.append({
            "description": "Analyze agent's completed goal history",
            "tool": "analyze_history",
            "parameters": {"pattern": ""}
        })
        steps.append({
            "description": "Report history analysis to user via AI pipeline",
            "tool": "pipeline_message",
            "parameters": {"message": "User asked about their goal history. Based on the `analyze_history` tool output, provide a concise summary."}
        })
        return steps
    
    # Simple creative tasks
    simple_creative_tasks = {
        "poem": "Write a short poem about ",
        "joke": "Tell me a very short, clean joke about ",
        "story": "Write a very short story (1-2 paragraphs) about ",
        "haiku": "Write a haiku about ",
        "song": "Write a short song (verse and chorus) about "
    }
    
    for keyword, prompt_prefix in simple_creative_tasks.items():
        if keyword in goal_lower:
            subject_part = goal_lower.split(keyword, 1)[-1].strip()
            if subject_part.startswith("about "):
                subject_part = subject_part[len("about "):]
            if not subject_part:
                subject_part = "a general topic"
            
            full_prompt = f"{prompt_prefix}{subject_part}."
            steps.append({
                "description": f"Ask AI to: {full_prompt}",
                "tool": "pipeline_message",
                "parameters": {"message": full_prompt}
            })
            _notify_user("Using simplified plan for creative task.", is_system_message=True)
            return steps
    
    # AI-based decomposition
    available_tools_prompt_list = []
    for name, info in _available_tools.items():
        params = info.get("parameters", [])
        param_str = ", ".join(params) if params else "No parameters"
        short_desc = info['description'].split('.')[0]
        available_tools_prompt_list.append(f"- {name}({param_str}): {short_desc}.")
    tools_list_for_prompt = "\n".join(available_tools_prompt_list)
    
    # Get history context using the tool directly
    history_context_str = "No recent goal patterns identified from history."
    if "analyze_history" in _available_tools:
        history_func = _available_tools["analyze_history"]["function"]
        history_analysis = await history_func("")
        if history_analysis["success"] and history_analysis["analysis"].get("common_goal_keywords"):
            top_keywords = history_analysis["analysis"]["common_goal_keywords"]
            history_context_str = f"User's recent goal history involves: {', '.join([f'{k}({v} times)' for k, v in top_keywords.items()])}."
    
    decomposition_prompt = f"""You are an expert Task Decomposer AI. Your sole responsibility is to break down a User's Goal into a sequence of executable steps using ONLY the Provided Tools.
Your output MUST be a valid JSON array of step objects. Each step object MUST have 'description' (string, human-readable step aim), 'tool' (string, one of the Provided Tools), and 'parameters' (object, key-value pairs for the tool).

User's Goal: "{goal}"
Context from Agent's History: {history_context_str}
Provided Tools (use EXACT names and parameters as listed):
{tools_list_for_prompt}

CRITICAL JSON OUTPUT REQUIREMENTS:
1. Your entire response MUST be a single, valid JSON array [...]. No surrounding text, no markdown code fences, no explanations.
2. Each step MUST use a tool from the 'Provided Tools' list. Do NOT invent tools.
3. Parameter names in your JSON MUST EXACTLY match those in the 'Provided Tools' list for the chosen tool.
4. For consultant tasks, your sequence should be: enable → configure → assign_task. The assign_task tool will show the response directly.
5. For log search tools (log_search, log_recent), you must IMMEDIATELY follow it with `wait_for_log_results` to get the output.
6. Maximum {MAX_STEPS_PER_GOAL} steps per goal. Be efficient.

Example: "Tell me the weather in London"
[
  {{"description": "Ask AI about the weather in London", "tool": "pipeline_message", "parameters": {{"message": "What is the current weather in London?"}}}}
]

Begin JSON output now:"""
    
    try:
        ai_response_raw = await _silent_api_call(decomposition_prompt)
        
        match = re.search(r'\[\s*\{.*?\}\s*\]', ai_response_raw, re.DOTALL)
        if not match:
            raise json.JSONDecodeError("No JSON array found.", ai_response_raw, 0)
        
        json_str = match.group(0)
        parsed_steps_from_ai = json.loads(json_str)
        
        if not isinstance(parsed_steps_from_ai, list):
            raise ValueError("Decomposed steps are not a list.")
        
        validated_steps = []
        for step_data in parsed_steps_from_ai[:MAX_STEPS_PER_GOAL]:
            if not isinstance(step_data, dict):
                continue
            if not all(k in step_data for k in ["description", "tool", "parameters"]):
                continue
            if step_data["tool"] not in _available_tools:
                continue
            validated_steps.append(step_data)
        
        if not validated_steps:
            raise ValueError("No valid steps after validation.")
        
        return validated_steps
        
    except Exception as e:
        _notify_user(f"Error during AI goal decomposition: {e}. Falling back to single step.", 
                    is_system_message=True)
        steps.append({
            "description": f"Process original goal via AI: {goal}",
            "tool": "pipeline_message",
            "parameters": {"message": goal}
        })
        return steps

async def _complete_goal():
    """Mark the current goal as completed."""
    state = _agent_state
    if not state["current_goal"]:
        _notify_user("Attempted to complete a null goal.", is_system_message=True)
        state["active"] = False
        return
    
    _notify_user(f"Goal completed: {state['current_goal']}", is_system_message=True)
    
    goal_record = {
        "goal": state["current_goal"],
        "completed_at": datetime.now().isoformat(),
        "steps_planned": len(state["goal_steps"]),
        "steps_executed": state["current_step_index"],
        "tools_used_details": state["tools_used"]
    }
    state["history"].append(goal_record)
    
    if len(state["history"]) > MAX_HISTORY_SIZE:
        state["history"] = state["history"][-MAX_HISTORY_SIZE:]
    
    _restore_consultant_states()
    
    state["active"] = False
    state["current_goal"] = None
    state["goal_steps"] = []
    state["current_step_index"] = 0
    state["tools_used"] = []
    state["pending_save"] = True
    
    _save_state()

async def _stop_agent():
    """Stop the current goal execution."""
    if not _agent_state["active"]:
        _notify_user("Agent is not currently active.", is_system_message=True)
        return
    
    _restore_consultant_states()
    
    _agent_state["active"] = False
    _agent_state["pending_save"] = True
    _save_state()
    
    _notify_user("Agent stopped. Consultant states restored.", is_system_message=True)

async def _clear_agent():
    """Clear agent state and stop execution."""
    global _agent_state, _history_cache
    
    _restore_consultant_states()
    
    _agent_state = {
        "active": False,
        "current_goal": None,
        "goal_steps": [],
        "current_step_index": 0,
        "context": {},
        "history": [],
        "tools_used": [],
        "pending_save": True,
        "consultant_original_states": {}
    }
    
    _history_cache = {
        "last_analysis_time": 0,
        "cached_analysis": None,
        "cache_duration": _history_cache.get("cache_duration", 60),
        "cache_key": None
    }
    
    _save_state()
    _notify_user("Agent state cleared. Consultant states restored.", is_system_message=True)

# ===========================================
# === COMMAND HANDLERS ===
# ===========================================

async def _handle_agent_command(sub_command_full: str):
    """Handle specific internal agent commands."""
    parts = sub_command_full.lower().split(maxsplit=1)
    sub_command = parts[0]
    
    if sub_command == "status":
        await _show_status()
    elif sub_command == "stop":
        await _stop_agent()
    elif sub_command == "clear":
        await _clear_agent()
    elif sub_command == "tools":
        await _list_tools()
    else:
        _notify_user(f"Unknown agent command: '{sub_command_full}'.", is_system_message=True)

async def _show_status():
    """Show current agent status including history summary."""
    state = _agent_state
    
    goal_summary = "No goals completed yet."
    if state.get("history"):
        completed_goals = len(state["history"])
        total_steps = sum(g.get("steps_executed", 0) for g in state["history"])
        avg_steps = total_steps / completed_goals if completed_goals else 0
        last_goal = state["history"][-1]
        goal_summary = (f"Goals Completed: {completed_goals}. "
                       f"Avg Steps/Goal: {avg_steps:.1f}. "
                       f"Last Goal: '{last_goal['goal']}' ({last_goal['completed_at']})")
    
    status_lines = [
        f"{SYSTEM_MESSAGE_PREFIX} AGENT STATUS:",
        f"  Active: {state['active']}",
        f"  Current Goal: {state['current_goal'] or 'None'}",
    ]
    
    if state['active'] and state['goal_steps']:
        current_idx = state['current_step_index']
        if current_idx < len(state['goal_steps']):
            current_desc = state['goal_steps'][current_idx].get('description', 'N/A')
        else:
            current_desc = 'Finished'
        status_lines.append(f"  Progress: Step {current_idx}/{len(state['goal_steps'])} ('{current_desc}')")
    else:
        status_lines.append("  Progress: Not applicable")
    
    status_lines.extend([
        f"  Agent Context Keys: {list(state['context'].keys()) if state['context'] else 'Empty'}",
        f"  Tools Used This Goal: {len(state['tools_used'])}",
        f"  Agent Goal History: {goal_summary}"
    ])
    
    if "last_user_input_during_goal" in state["context"]:
        status_lines.append(
            f"  Last user input during goal: '{state['context']['last_user_input_during_goal']}' "
            f"at {state['context'].get('last_user_input_time', 'unknown')}"
        )
    
    if "analyze_history" in _available_tools:
        history_func = _available_tools["analyze_history"]["function"]
        history_analysis = await history_func("")
        if history_analysis["success"] and history_analysis["analysis"].get("common_goal_keywords"):
            keywords = history_analysis["analysis"]["common_goal_keywords"]
            keywords_str = ", ".join([f"{k}({v})" for k, v in keywords.items()])
            status_lines.append(f"  Common Goal Keywords: {keywords_str}")
    
    for line in status_lines:
        _notify_user(line, is_system_message=False)

async def _list_tools():
    """List available agent tools, categorized."""
    if not _available_tools:
        _notify_user("No tools are currently registered.", is_system_message=True)
        return
    
    _notify_user(f"{SYSTEM_MESSAGE_PREFIX} AVAILABLE AGENT TOOLS ({len(_available_tools)} total):", 
                is_system_message=False)
    
    tools_by_category = {}
    for tool_name, tool_info in _available_tools.items():
        category = "Utility"
        if "memory" in tool_name or "context" in tool_name or "history" in tool_name:
            category = "Memory & Context"
        elif "persona" in tool_name or "prompt" in tool_name:
            category = "Persona & Prompts"
        elif "api" in tool_name or "status" in tool_name or "check" in tool_name:
            category = "Information & Status"
        elif any(x in tool_name for x in ["message", "speak", "pipeline"]):
            category = "Communication"
        elif any(x in tool_name for x in ["command", "control", "save", "load", "fix"]):
            category = "System Control"
        elif any(x in tool_name for x in ["youtube", "wiki", "sms", "sandbox", "block"]):
            category = "Plugin Interface"
        elif "consultant" in tool_name:
            category = "Consultant Control"
        elif "log_" in tool_name:
            category = "Log Analysis"
        
        if category not in tools_by_category:
            tools_by_category[category] = []
        
        params_str = ", ".join(tool_info.get("parameters", [])) or "None"
        tools_by_category[category].append(
            f"  - {tool_name} ({params_str}): {tool_info.get('description', 'N/A')}"
        )
    
    for category, tool_list in sorted(tools_by_category.items()):
        _notify_user(f"\n{SYSTEM_MESSAGE_PREFIX} --- {category} ---", is_system_message=False)
        for tool_entry in tool_list:
            _notify_user(tool_entry, is_system_message=False)
    
    _notify_user(f"{SYSTEM_MESSAGE_PREFIX} End of tool list.", is_system_message=False)

# ===========================================
# === STATE PERSISTENCE ===
# ===========================================

def _save_state():
    """Save agent state to file."""
    if not _agent_state.get("pending_save", False):
        return
    
    try:
        state_to_save = _agent_state.copy()
        with open(AGENT_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state_to_save, f, indent=2)
        _agent_state["pending_save"] = False
    except Exception as e:
        print(f"{SYSTEM_MESSAGE_PREFIX} CRITICAL ERROR saving state: {e}")

def _load_state():
    """Load agent state from file."""
    global _agent_state, _history_cache
    
    if os.path.exists(AGENT_STATE_FILE):
        try:
            with open(AGENT_STATE_FILE, "r", encoding="utf-8") as f:
                loaded_state = json.load(f)
            
            default_state = {
                "active": False,
                "current_goal": None,
                "goal_steps": [],
                "current_step_index": 0,
                "context": {},
                "history": [],
                "tools_used": [],
                "pending_save": False,
                "consultant_original_states": {}
            }
            
            merged_state = default_state.copy()
            for key in default_state.keys():
                if key in loaded_state and isinstance(loaded_state[key], type(default_state[key])):
                    merged_state[key] = loaded_state[key]
            
            _agent_state = merged_state
            _agent_state["pending_save"] = False
            
            _history_cache = {
                "last_analysis_time": 0,
                "cached_analysis": None,
                "cache_duration": _history_cache.get("cache_duration", 60),
                "cache_key": None
            }
            
            print(f"{SYSTEM_MESSAGE_PREFIX} Agent state loaded successfully.")
            if _agent_state["active"] and _agent_state["current_goal"]:
                print(f"{SYSTEM_MESSAGE_PREFIX} Resuming goal: '{_agent_state['current_goal']}' "
                     f"at step {_agent_state['current_step_index'] + 1}.")
                
        except Exception as e:
            print(f"{SYSTEM_MESSAGE_PREFIX} Error loading state: {e}. Starting with defaults.")
    else:
        print(f"{SYSTEM_MESSAGE_PREFIX} No saved state found. Starting fresh.")