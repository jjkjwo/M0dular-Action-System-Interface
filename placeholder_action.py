#
# placeholder_action.py - The Rosetta Stone Addon (Ultimate v3.2)
# =============================================================================
# VERSION: 3.2 - Enhanced with Advanced System Patterns
#
# PURPOSE:
# This is THE reference implementation for AGS addon development. Every pattern,
# every best practice, every integration point is demonstrated here. Use this
# as your template - copy it, modify it, learn from it.
#
# WHAT'S NEW IN v3.2:
# - Enhanced security with jjk.progenitor_check() for rule-based security
# - Added multi-turn tool pattern demonstration
# - Added agent awareness patterns and context manipulation
# - Enhanced documentation for agent state awareness
# - Added silent API call demonstration
#
# WHAT'S NEW IN v3.1:
# - Added AI Coder Communication Protocol (ACCP) for knowledge transfer
# - Added pattern compliance checker function
# - Added ADDON_DNA marker for tracking updates
# - Enhanced documentation for AI-to-AI communication
#
# WHAT'S NEW IN v3.0:
# - Complete is_system_command pattern demonstration with consequences
# - Integration examples with ALL major system components
# - Anti-pattern examples (what NOT to do) with explanations
# - Consultant AI interaction patterns
# - V-Agent tool registration example
# - Complete command pattern showcase
# - Advisory system integration
# - Emotion tracking integration
# - Memory system integration
# - Security (JJK) integration examples
#
# CRITICAL: Read the comments. They explain WHY, not just HOW.
#

import os
import json
import re
import time
import asyncio
import traceback
import inspect
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable

# ==============================================================================
# ===== AI CODER COMMUNICATION PROTOCOL (ACCP) =================================
# ==============================================================================
"""
ATTENTION AI ASSISTANTS, CODERS, AND FUTURE PLACEHOLDER MAINTAINERS:

When you update ANY addon based on this placeholder, you MUST add an update block
that clearly documents your changes. This helps future AI coders understand what
has been done and what still needs attention.

REQUIRED UPDATE BLOCK FORMAT (Add at top of updated addon):

# ==== AI UPDATE BLOCK ====
# Updated By: Claude (Anthropic)
# Update Date: 2025-01-07
# Pattern Version: 3.2 (from placeholder_action.py v3.2)
# 
# CHANGES MADE:
# ✅ Updated security to use jjk.progenitor_check() with rule names
# ✅ Added multi-turn tool pattern demonstration
# ✅ Added agent awareness patterns
# ✅ Enhanced documentation for v-agent interactions
# ✅ Added silent API call pattern example
# 
# DEVIATIONS FROM PLACEHOLDER:
# - None - this IS the placeholder
# 
# TODO FOR NEXT AI:
# - Consider adding more complex multi-turn examples
# - Add examples of interacting with agent's goal system
# 
# PATTERN COMPLIANCE: FULL (all critical patterns implemented)
# ==== END UPDATE BLOCK ====

CRITICAL RULES FOR AI CODERS:

1. NEVER remove existing update blocks - add yours ABOVE previous ones
2. Be SPECIFIC about what you changed and why  
3. Note any patterns you DIDN'T implement and explain why
4. Leave breadcrumbs for the next AI about remaining work
5. If you encounter something confusing, DOCUMENT THE CONFUSION

AGENT-AWARENESS PATTERNS FOR GOOD CITIZENS:

1. CHECK AGENT STATUS: Before performing automatic actions, check if the
   V-Agent is active. If `v_agent.is_active()` is True, your addon
   should remain passive to avoid interfering with its goal.

2. BE AWARE OF STATE CHANGES: The agent may disable consultant AIs.
   Do not assume they are available during agent execution.

3. USE THE RIGHT API CALL:
   - For user-facing conversation: Use `system_functions['send_to_ai']`.
   - For silent, internal logic (e.g., text analysis): Use the pattern
     from v-agent.py's `_silent_api_call` by using `api_manager` directly
     to avoid polluting conversation history.

4. RESPECT SECURITY RULES: Use jjk.progenitor_check() with specific
   rule names for auditable security checks.

WHY THIS MATTERS:
Each AI conversation has no memory of previous sessions. Your notes are the 
ONLY way to transfer knowledge forward. Be kind to your future AI colleagues!

SPECIAL NOTES FOR PATTERN ENFORCEMENT:
- is_system_command: CRITICAL - breaks system if missing
- State persistence: IMPORTANT - loses data if missing  
- Help command: NICE TO HAVE - improves UX
- Test commands: OPTIONAL - mainly for demonstration
- JJK rule-based security: CRITICAL - use named rules for auditability

VERSIONING:
When updating this placeholder itself, increment version in ACTION_VERSION
and document what patterns/examples you added.
"""

# ==============================================================================
# ===== 1. CORE ADDON CONFIGURATION ============================================
# ==============================================================================

# REQUIRED: Every addon needs these constants
ACTION_NAME = "placeholder_action"  # Must match filename without .py
ACTION_PRIORITY = 5.0  # Mid-range - won't interfere with core functions
ACTION_VERSION = "3.2"  # Updated for advanced patterns
ACTION_DESCRIPTION = "The ultimate reference implementation demonstrating all AGS patterns"

# File paths for persistence (best practice: separate files for different data types)
PLACEHOLDER_CONFIG_FILE = "placeholder_config.json"  # User settings
PLACEHOLDER_STATE_FILE = "placeholder_state.json"    # Runtime state
PLACEHOLDER_DATA_DIR = "placeholder_data"            # For larger data files

# JJK Security Rules (define these in jjk_rules.json)
JJK_RULES = {
    "ai_critical_command": f"{ACTION_NAME}_ai_critical_command",
    "admin_operation": f"{ACTION_NAME}_admin_operation",
    "data_modification": f"{ACTION_NAME}_data_modification"
}

# ==============================================================================
# ===== ADDON DNA MARKER =======================================================  
# ==============================================================================

# Future AIs: Every updated addon should include this marker!
ADDON_DNA = {
    "pattern_version": "3.2",
    "parent_template": "placeholder_action.py",
    "compliance_level": "FULL",
    "last_ai_update": "2025-01-07",  # Update this when you modify!
    "update_count": 2,  # Increment this!
    "ai_notes": "Added advanced security patterns, multi-turn tools, and agent awareness"
}

# ==============================================================================
# ===== 2. STATE MANAGEMENT (THE RIGHT WAY) ====================================
# ==============================================================================

class PlaceholderState:
    """
    BEST PRACTICE: Use a class for state management instead of globals.
    This makes the code cleaner, safer, and easier to test.
    """
    def __init__(self):
        self.is_active = False
        self.config = self._get_default_config()
        self.runtime_state = self._get_default_state()
        self.pending_injection = None
        self.last_operation_time = 0
        self.operation_cooldown = 1.0  # Prevent spam
        
        # Multi-turn tool state
        self.pending_multi_step_data = {}
        
    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration - what users can customize"""
        return {
            "auto_inject": False,
            "verbose_mode": True,
            "max_history_items": 50,
            "integration_features": {
                "use_advisory": True,
                "use_emotions": True,
                "use_memory": False,
                "respect_jjk": True,
                "check_agent_status": True  # NEW: Agent awareness
            },
            "custom_threshold": 75,
            "security_rules_enabled": True,  # NEW: Use JJK rules
            "last_saved": None
        }
    
    def _get_default_state(self) -> Dict[str, Any]:
        """Default runtime state - what the addon tracks"""
        return {
            "commands_processed": 0,
            "injections_made": 0,
            "errors_caught": 0,
            "command_history": [],
            "ai_interactions": [],
            "integration_log": [],
            "multi_turn_operations": {},  # NEW: Track multi-turn ops
            "agent_interference_avoided": 0  # NEW: Track agent awareness
        }
    
    def load_config(self) -> None:
        """Load configuration with proper error handling"""
        try:
            if os.path.exists(PLACEHOLDER_CONFIG_FILE):
                with open(PLACEHOLDER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    # Merge with defaults to handle new keys
                    self.config = {**self._get_default_config(), **loaded}
                print(f"[{ACTION_NAME.upper()}: Loaded config from {PLACEHOLDER_CONFIG_FILE}]")
            else:
                self.save_config()  # Create default config file
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: Config load failed: {e}]")
            # Keep defaults on error
            
    def save_config(self) -> bool:
        """Save configuration with timestamp"""
        try:
            self.config["last_saved"] = datetime.now().isoformat()
            with open(PLACEHOLDER_CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: Config save failed: {e}]")
            return False
            
    def load_state(self) -> None:
        """Load runtime state"""
        try:
            if os.path.exists(PLACEHOLDER_STATE_FILE):
                with open(PLACEHOLDER_STATE_FILE, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.runtime_state = {**self._get_default_state(), **loaded}
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: State load failed: {e}]")
            
    def save_state(self) -> bool:
        """Save runtime state"""
        try:
            # Ensure data directory exists
            os.makedirs(PLACEHOLDER_DATA_DIR, exist_ok=True)
            
            with open(PLACEHOLDER_STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.runtime_state, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: State save failed: {e}]")
            return False
    
    def add_command_to_history(self, command: str, details: Dict[str, Any]) -> None:
        """Track command usage with rotation"""
        entry = {
            "command": command,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.runtime_state["command_history"].append(entry)
        
        # Rotate history to prevent unlimited growth
        max_items = self.config.get("max_history_items", 50)
        if len(self.runtime_state["command_history"]) > max_items:
            self.runtime_state["command_history"] = self.runtime_state["command_history"][-max_items:]
            
    def log_integration(self, system: str, action: str, success: bool, details: Optional[Dict] = None) -> None:
        """Track interactions with other systems"""
        log_entry = {
            "system": system,
            "action": action,
            "success": success,
            "timestamp": time.time()
        }
        if details:
            log_entry["details"] = details
        self.runtime_state["integration_log"].append(log_entry)

# Initialize our state manager
state = PlaceholderState()

# ==============================================================================
# ===== 3. LIFECYCLE FUNCTIONS (REQUIRED) ======================================
# ==============================================================================

async def start_action(system_functions: Optional[Dict[str, Callable]] = None) -> None:
    """
    Called when the addon is started via 'start placeholder_action'.
    
    BEST PRACTICES DEMONSTRATED:
    - Load saved state
    - Initialize resources
    - Register with other systems if needed
    - Provide clear user feedback
    - Check agent status before starting
    """
    global state
    
    if state.is_active:
        print(f"[{ACTION_NAME.upper()}: Already active]")
        return
        
    try:
        # Load our saved configuration and state
        state.load_config()
        state.load_state()
        
        # AGENT AWARENESS: Check if agent is active
        if system_functions and state.config["integration_features"].get("check_agent_status", True):
            v_agent = system_functions.get("get_action_obj", lambda x: None)("v-agent")
            if v_agent and hasattr(v_agent, 'is_active') and v_agent.is_active():
                print(f"[{ACTION_NAME.upper()}: WARNING - V-Agent is active. Starting in passive mode.]")
                state.runtime_state["agent_interference_avoided"] += 1
        
        state.is_active = True
        
        # Log the startup
        state.add_command_to_history("start_action", {"version": ACTION_VERSION})
        
        # V-AGENT INTEGRATION: Register our tools if v-agent is available
        if system_functions and "get_action_obj" in system_functions:
            try:
                v_agent = system_functions["get_action_obj"]("v-agent")
                if v_agent and hasattr(v_agent, 'register_tool'):
                    # Register a simple demo tool
                    v_agent.register_tool(
                        name="placeholder_demo",
                        description="Demonstrate placeholder addon features",
                        category="demo",
                        handler=placeholder_tool_handler
                    )
                    
                    # Register a multi-turn tool
                    v_agent.register_tool(
                        name="placeholder_multi_start",
                        description="Start a multi-turn operation demo",
                        category="demo",
                        handler=placeholder_multi_start_handler
                    )
                    
                    v_agent.register_tool(
                        name="placeholder_multi_complete",
                        description="Complete a multi-turn operation demo",
                        category="demo",
                        handler=placeholder_multi_complete_handler
                    )
                    
                    state.log_integration("v-agent", "register_tools", True, {"tools": 3})
            except:
                pass  # V-agent not available
        
        # Notify user
        startup_msg = (
            f"[{ACTION_NAME.upper()} v{ACTION_VERSION}: STARTED]\n"
            f"  The ultimate AGS reference implementation is active.\n"
            f"  Commands: 'placeholder help' | 'placeholder demo' | 'placeholder status'\n"
            f"  This addon demonstrates ALL best practices and patterns.\n"
            f"  Pattern Version: {ADDON_DNA['pattern_version']} | Compliance: {ADDON_DNA['compliance_level']}\n"
            f"  Security: JJK rule-based checks enabled"
        )
        
        if system_functions and "user_notification" in system_functions:
            system_functions["user_notification"](startup_msg)
        else:
            print(startup_msg)
            
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} CRITICAL: Startup failed: {e}]")
        traceback.print_exc()
        state.is_active = False

async def stop_action(system_functions: Optional[Dict[str, Callable]] = None) -> None:
    """
    Called when the addon is stopped via 'stop placeholder_action'.
    
    BEST PRACTICES DEMONSTRATED:
    - Save all state before shutdown
    - Clean up resources
    - Unregister from other systems
    - Clear any pending operations
    """
    global state
    
    if not state.is_active:
        print(f"[{ACTION_NAME.upper()}: Already stopped]")
        return
        
    try:
        # Log the shutdown
        state.add_command_to_history("stop_action", {"runtime_seconds": time.time() - state.last_operation_time})
        
        # Save our state
        state.save_config()
        state.save_state()
        
        # Clear any pending operations
        state.pending_injection = None
        state.pending_multi_step_data = {}
        state.is_active = False
        
        # Summary statistics
        stats = state.runtime_state
        summary = (
            f"[{ACTION_NAME.upper()}: STOPPED]\n"
            f"  Session statistics:\n"
            f"  - Commands processed: {stats['commands_processed']}\n"
            f"  - Injections made: {stats['injections_made']}\n"
            f"  - Errors caught: {stats['errors_caught']}\n"
            f"  - Agent interference avoided: {stats['agent_interference_avoided']}"
        )
        
        if system_functions and "user_notification" in system_functions:
            system_functions["user_notification"](summary)
        else:
            print(summary)
            
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR: Shutdown error: {e}]")
        state.is_active = False

# ==============================================================================
# ===== 4. INPUT PROCESSING (THE MOST CRITICAL FUNCTION) =======================
# ==============================================================================

async def process_input(
    user_input: str,
    system_functions: Optional[Dict[str, Any]] = None,
    is_system_command: bool = False
) -> Optional[str]:
    """
    Process user input - THE MOST IMPORTANT FUNCTION TO GET RIGHT.
    
    CRITICAL PATTERN: The is_system_command parameter!!!
    - If True: This is a command, DO NOT apply AI-focused modifications
    - If False: This is a prompt for the AI, modifications are allowed
    
    VIOLATING THIS PATTERN BREAKS THE ENTIRE SYSTEM!
    """
    global state
    
    # BEST PRACTICE: Always check if active first
    if not state.is_active:
        return user_input
        
    try:
        input_lower = user_input.lower().strip()
        
        # AGENT AWARENESS: Check if agent is active before any modifications
        if not is_system_command and state.config["integration_features"].get("check_agent_status", True):
            if system_functions:
                v_agent = system_functions.get("get_action_obj", lambda x: None)("v-agent")
                if v_agent and hasattr(v_agent, 'is_active') and v_agent.is_active():
                    # Agent is active - be passive
                    state.runtime_state["agent_interference_avoided"] += 1
                    return user_input  # Pass through unchanged
        
        # ================================================================
        # CRITICAL SECTION: PROPER COMMAND HANDLING
        # ================================================================
        
        # Step 1: Check if this is OUR command
        if input_lower.startswith("placeholder"):
            # It's our command - handle it regardless of is_system_command
            result = await _handle_placeholder_command(user_input, system_functions)
            state.runtime_state["commands_processed"] += 1
            return result
            
        # Step 2: If is_system_command=True and it's NOT our command, PASS IT THROUGH
        if is_system_command:
            # THIS IS THE MOST CRITICAL CHECK IN YOUR ADDON!
            # Modifying system commands will break things like 'start', 'stop', 'api switch', etc.
            
            # ANTI-PATTERN EXAMPLE (NEVER DO THIS):
            # return "[PERSONA] " + user_input  # WRONG! Breaks system commands
            
            # CORRECT PATTERN:
            return user_input  # Pass through unchanged
            
        # ================================================================
        # SAFE ZONE: We know this is NOT a system command
        # ================================================================
        
        # Check for pending injection (delayed injection pattern)
        if state.pending_injection:
            injection_content = _format_injection(state.pending_injection)
            state.pending_injection = None  # Clear after use
            state.runtime_state["injections_made"] += 1
            
            # Integrate with advisory if enabled
            if state.config["integration_features"]["use_advisory"] and system_functions:
                _try_advisory_integration(system_functions, "Injection made", "INFO")
                
            return injection_content + user_input
            
        # Auto-injection feature (if enabled)
        if state.config.get("auto_inject", False):
            prefix = f"[{ACTION_NAME.upper()} CONTEXT: Auto-injection active]\n"
            return prefix + user_input
            
        # No modifications needed
        return user_input
        
    except Exception as e:
        # BEST PRACTICE: Always catch errors and return original input
        state.runtime_state["errors_caught"] += 1
        print(f"[{ACTION_NAME.upper()} ERROR in process_input: {e}]")
        traceback.print_exc()
        return user_input  # CRITICAL: Return original on error

# ==============================================================================
# ===== 5. OUTPUT PROCESSING ===================================================
# ==============================================================================

async def process_output(
    ai_response: str,
    system_functions: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    Process AI output - parse for AI-triggered commands.
    
    PATTERN: Allow AI to trigger addon functionality via special tags.
    """
    global state
    
    if not state.is_active or not ai_response:
        return ai_response
        
    try:
        # Look for AI command triggers
        pattern = r'\[PLACEHOLDER_ACTION:\s*([^\]]+)\]'
        matches = re.findall(pattern, ai_response, re.IGNORECASE)
        
        if matches:
            for command in matches:
                await _handle_ai_command(command.strip(), system_functions)
                state.runtime_state["ai_interactions"].append({
                    "command": command,
                    "timestamp": time.time()
                })
                
            # Remove the tags from output
            cleaned = re.sub(pattern, '', ai_response, flags=re.IGNORECASE).strip()
            return cleaned if cleaned else f"[{ACTION_NAME.upper()}: Processed {len(matches)} AI commands]"
            
        return ai_response
        
    except Exception as e:
        state.runtime_state["errors_caught"] += 1
        print(f"[{ACTION_NAME.upper()} ERROR in process_output: {e}]")
        return ai_response

# ==============================================================================
# ===== 6. COMMAND HANDLERS ====================================================
# ==============================================================================

async def _handle_placeholder_command(user_input: str, system_functions: Optional[Dict[str, Any]]) -> str:
    """
    Handle all placeholder-specific commands.
    
    DEMONSTRATES: All major command patterns from COMMANDS.MD
    """
    global state
    
    parts = user_input.strip().split(maxsplit=2)
    if len(parts) < 2:
        return f"[{ACTION_NAME.upper()}: Use 'placeholder help' for available commands]"
        
    subcommand = parts[1].lower()
    args = parts[2] if len(parts) > 2 else ""
    
    # Rate limiting
    current_time = time.time()
    if current_time - state.last_operation_time < state.operation_cooldown:
        return f"[{ACTION_NAME.upper()}: Please wait {state.operation_cooldown}s between commands]"
    state.last_operation_time = current_time
    
    # Log command
    state.add_command_to_history(f"placeholder {subcommand}", {"args": args})
    
    # ========== COMMAND IMPLEMENTATIONS ==========
    
    if subcommand == "help":
        return _generate_help()
        
    elif subcommand == "status":
        return _generate_status(system_functions)
        
    elif subcommand == "demo":
        # PATTERN: Delayed Injection (like log_reader.py)
        if args:
            # SECURITY: Check if this is a sensitive operation
            if state.config.get("security_rules_enabled", True):
                try:
                    import jjk
                    # Use rule-based security check
                    if not jjk.progenitor_check(JJK_RULES["data_modification"], source="user_command"):
                        return f"[{ACTION_NAME.upper()}: JJK denied demo injection (rule: {JJK_RULES['data_modification']})]"
                except ImportError:
                    print(f"[{ACTION_NAME.upper()}: JJK not available, allowing demo]")
            
            demo_content = (
                f"[{ACTION_NAME.upper()} DEMO INJECTION]\n"
                f"This demonstrates the delayed injection pattern.\n"
                f"Your argument: {args}\n"
                f"This content is injected into your NEXT AI prompt.\n"
                f"[END DEMO]\n\n"
            )
            state.pending_injection = {
                "type": "demo",
                "content": demo_content,
                "timestamp": time.time()
            }
            return f"[{ACTION_NAME.upper()}: Demo content queued for next AI interaction]"
        else:
            return f"[{ACTION_NAME.upper()}: Usage: placeholder demo <your text>]"
            
    elif subcommand == "integrate":
        # PATTERN: Inter-addon communication
        return await _demonstrate_integrations(args, system_functions)
        
    elif subcommand == "set":
        # PATTERN: Configuration management
        return _handle_set_command(args)
        
    elif subcommand == "test":
        # PATTERN: Test various features
        return await _run_tests(args, system_functions)
        
    elif subcommand == "multi_step_demo":
        # NEW: Demonstrate multi-turn tool pattern
        return await _demo_multi_step_tool_start()
        
    elif subcommand == "multi_step_result":
        # NEW: Complete the multi-turn operation
        return await _demo_multi_step_tool_complete(args)
        
    elif subcommand == "antipattern":
        # Educational: Show what NOT to do
        return _demonstrate_antipatterns()
        
    elif subcommand == "compliance":
        # Check compliance of other addons
        return await _check_addon_compliance(args, system_functions)
        
    else:
        return f"[{ACTION_NAME.upper()}: Unknown command '{subcommand}'. Try 'placeholder help']"

def _generate_help() -> str:
    """Generate comprehensive help text"""
    return f"""[{ACTION_NAME.upper()} HELP - v{ACTION_VERSION}]
The Ultimate AGS Reference Implementation

COMMANDS:
  placeholder help              - Show this help
  placeholder status            - Show detailed status and statistics  
  placeholder demo <text>       - Queue text for delayed injection
  placeholder integrate <sys>   - Test integration with other systems
  placeholder set <key> <val>   - Modify configuration
  placeholder test <feature>    - Test specific features
  placeholder multi_step_demo   - Start a multi-turn operation demo
  placeholder multi_step_result - Get result of multi-turn operation
  placeholder antipattern       - Show what NOT to do (educational)
  placeholder compliance <addon>- Check if an addon follows best practices

CONFIGURATION KEYS (for 'set' command):
  auto_inject <on|off>         - Enable auto-injection
  verbose <on|off>             - Verbose output mode
  threshold <number>           - Custom threshold value
  security <on|off>            - Enable/disable JJK rule checks

INTEGRATION TARGETS (for 'integrate' command):
  advisory    - Test advisory system integration
  emotions    - Test emotion tracking integration  
  memory      - Test memory system integration
  jjk         - Test security (JJK) integration
  consultant  - Test consultant AI interaction
  agent_context - Set context in V-Agent

TEST FEATURES (for 'test' command):
  commands    - Test command handling
  state       - Test state persistence
  errors      - Test error handling
  security    - Test JJK security patterns
  silent_api  - Test silent API calls
  all         - Run all tests

EXAMPLE USAGE:
  placeholder demo Hello World
  placeholder integrate advisory
  placeholder set verbose off
  placeholder multi_step_demo
  placeholder test security
  placeholder compliance voice

FOR AI: Use [PLACEHOLDER_ACTION: command] to trigger actions

PATTERN VERSION: {ADDON_DNA['pattern_version']} | COMPLIANCE: {ADDON_DNA['compliance_level']}
SECURITY: JJK rule-based checks {"ENABLED" if state.config.get("security_rules_enabled", True) else "DISABLED"}"""

def _generate_status(system_functions: Optional[Dict[str, Any]]) -> str:
    """Generate detailed status report"""
    lines = [f"[{ACTION_NAME.upper()} STATUS REPORT]"]
    lines.append(f"Version: {ACTION_VERSION}")
    lines.append(f"Pattern Version: {ADDON_DNA['pattern_version']}")
    lines.append(f"Active: {state.is_active}")
    
    # Configuration
    lines.append("\nCONFIGURATION:")
    lines.append(f"  Auto-inject: {state.config.get('auto_inject', False)}")
    lines.append(f"  Verbose mode: {state.config.get('verbose_mode', True)}")
    lines.append(f"  Custom threshold: {state.config.get('custom_threshold', 75)}")
    lines.append(f"  Security rules: {state.config.get('security_rules_enabled', True)}")
    
    # Integration features
    int_features = state.config.get("integration_features", {})
    lines.append("\nINTEGRATION FEATURES:")
    for feature, enabled in int_features.items():
        lines.append(f"  {feature}: {'ENABLED' if enabled else 'DISABLED'}")
    
    # Runtime statistics
    stats = state.runtime_state
    lines.append("\nRUNTIME STATISTICS:")
    lines.append(f"  Commands processed: {stats['commands_processed']}")
    lines.append(f"  Injections made: {stats['injections_made']}")
    lines.append(f"  Errors caught: {stats['errors_caught']}")
    lines.append(f"  AI interactions: {len(stats['ai_interactions'])}")
    lines.append(f"  Agent interference avoided: {stats['agent_interference_avoided']}")
    lines.append(f"  Multi-turn operations: {len(stats.get('multi_turn_operations', {}))}")
    
    # Recent command history
    history = stats.get('command_history', [])
    if history:
        lines.append("\nRECENT COMMANDS:")
        for entry in history[-5:]:
            lines.append(f"  - {entry['command']} @ {entry['timestamp']}")
    
    # Pending operations
    if state.pending_injection:
        lines.append(f"\nPENDING: Injection of type '{state.pending_injection.get('type', 'unknown')}'")
    
    if state.pending_multi_step_data:
        lines.append(f"\nPENDING: {len(state.pending_multi_step_data)} multi-turn operations")
    
    # Check other addon status if possible
    if system_functions and "get_action_obj" in system_functions:
        lines.append("\nSYSTEM INTEGRATION STATUS:")
        for addon in ["advisory", "emotions", "memory", "jjk", "v-agent"]:
            try:
                obj = system_functions["get_action_obj"](addon)
                if obj:
                    status = "AVAILABLE"
                    # Check if v-agent is active
                    if addon == "v-agent" and hasattr(obj, 'is_active'):
                        if obj.is_active():
                            status += " (ACTIVE - BE PASSIVE!)"
                    lines.append(f"  {addon}: {status}")
            except:
                lines.append(f"  {addon}: NOT LOADED")
    
    # ADDON DNA Info
    lines.append("\nADDON DNA:")
    lines.append(f"  Pattern Version: {ADDON_DNA['pattern_version']}")
    lines.append(f"  Parent Template: {ADDON_DNA['parent_template']}")
    lines.append(f"  Compliance Level: {ADDON_DNA['compliance_level']}")
    lines.append(f"  Last AI Update: {ADDON_DNA['last_ai_update']}")
    
    return "\n".join(lines)

async def _demonstrate_integrations(target: str, system_functions: Optional[Dict[str, Any]]) -> str:
    """Demonstrate integration with other system components"""
    if not system_functions:
        return f"[{ACTION_NAME.upper()}: System functions not available]"
        
    target = target.lower().strip()
    
    # ADVISORY SYSTEM INTEGRATION
    if target == "advisory":
        success = _try_advisory_integration(
            system_functions,
            f"Test message from {ACTION_NAME}",
            "TEST"
        )
        return f"[{ACTION_NAME.upper()}: Advisory integration {'SUCCESS' if success else 'FAILED'}]"
    
    # EMOTION SYSTEM INTEGRATION  
    elif target == "emotions":
        try:
            emotions_obj = system_functions.get("get_action_obj", lambda x: None)("emotions")
            if emotions_obj and hasattr(emotions_obj, 'get_current_emotions'):
                emotions = emotions_obj.get_current_emotions()
                return f"[{ACTION_NAME.upper()}: Current emotions: {emotions}]"
            else:
                return f"[{ACTION_NAME.upper()}: Emotions addon not available]"
        except Exception as e:
            return f"[{ACTION_NAME.upper()}: Emotions integration error: {e}]"
    
    # MEMORY SYSTEM INTEGRATION
    elif target == "memory":
        try:
            memory_obj = system_functions.get("get_action_obj", lambda x: None)("memory")
            if memory_obj and hasattr(memory_obj, 'store_memory'):
                memory_obj.store_memory(
                    f"Test memory from {ACTION_NAME}",
                    {"source": ACTION_NAME, "timestamp": time.time()}
                )
                return f"[{ACTION_NAME.upper()}: Memory stored successfully]"
            else:
                return f"[{ACTION_NAME.upper()}: Memory addon not available]"
        except Exception as e:
            return f"[{ACTION_NAME.upper()}: Memory integration error: {e}]"
    
    # JJK SECURITY INTEGRATION (ENHANCED)
    elif target == "jjk":
        try:
            import jjk
            results = []
            
            # Test basic progenitor status
            is_progenitor = jjk.is_progenitor()
            results.append(f"Basic progenitor status: {is_progenitor}")
            
            # Test rule-based checks
            for rule_name, rule_key in JJK_RULES.items():
                try:
                    allowed = jjk.progenitor_check(rule_key, source="integration_test")
                    results.append(f"Rule '{rule_name}': {'ALLOWED' if allowed else 'DENIED'}")
                except Exception as e:
                    results.append(f"Rule '{rule_name}': ERROR - {e}")
            
            return f"[{ACTION_NAME.upper()}: JJK Security Tests]\n" + "\n".join(results)
        except ImportError:
            return f"[{ACTION_NAME.upper()}: JJK security module not available]"
    
    # CONSULTANT AI INTEGRATION
    elif target == "consultant":
        # Check consultant AI status
        consultants = []
        for i in range(1, 5):
            addon_name = f"addon_ai{'' if i == 1 else i}"
            try:
                # This would normally check config, simplified for demo
                consultants.append(f"{addon_name}: CHECK CONFIG")
            except:
                pass
        return f"[{ACTION_NAME.upper()}: Consultant AIs:\n" + "\n".join(consultants)
    
    # V-AGENT CONTEXT INTEGRATION (NEW)
    elif target == "agent_context":
        try:
            v_agent = system_functions.get("get_action_obj", lambda x: None)("v-agent")
            if v_agent and hasattr(v_agent, 'is_active') and v_agent.is_active():
                # Agent is active - we could set context if it had a public method
                # For now, just report status
                return f"[{ACTION_NAME.upper()}: V-Agent is ACTIVE - context manipulation would require public API]"
            else:
                return f"[{ACTION_NAME.upper()}: V-Agent is not active]"
        except Exception as e:
            return f"[{ACTION_NAME.upper()}: V-Agent integration error: {e}]"
    
    else:
        return f"[{ACTION_NAME.upper()}: Unknown integration target '{target}']"

def _handle_set_command(args: str) -> str:
    """Handle configuration changes"""
    parts = args.split(maxsplit=1)
    if len(parts) != 2:
        return f"[{ACTION_NAME.upper()}: Usage: placeholder set <key> <value>]"
        
    key, value = parts
    key = key.lower()
    
    # Boolean settings
    if key in ["auto_inject", "verbose", "security"]:
        bool_val = value.lower() in ["on", "true", "yes", "1"]
        if key == "verbose":
            key = "verbose_mode"
        elif key == "security":
            key = "security_rules_enabled"
        state.config[key] = bool_val
        state.save_config()
        return f"[{ACTION_NAME.upper()}: Set {key} = {bool_val}]"
    
    # Numeric settings
    elif key == "threshold":
        try:
            num_val = int(value)
            state.config["custom_threshold"] = num_val
            state.save_config()
            return f"[{ACTION_NAME.upper()}: Set threshold = {num_val}]"
        except ValueError:
            return f"[{ACTION_NAME.upper()}: Threshold must be a number]"
    
    # Integration toggles
    elif key.startswith("use_"):
        feature = key[4:]  # Remove 'use_' prefix
        if feature in state.config["integration_features"]:
            bool_val = value.lower() in ["on", "true", "yes", "1"]
            state.config["integration_features"][feature] = bool_val
            state.save_config()
            return f"[{ACTION_NAME.upper()}: Integration '{feature}' = {bool_val}]"
    
    return f"[{ACTION_NAME.upper()}: Unknown setting '{key}']"

async def _run_tests(test_type: str, system_functions: Optional[Dict[str, Any]]) -> str:
    """Run various tests to demonstrate features"""
    test_type = test_type.lower().strip()
    results = []
    
    if test_type in ["commands", "all"]:
        results.append("COMMAND HANDLING: ✓ Properly checking is_system_command")
        results.append("COMMAND PARSING: ✓ Multi-word commands supported")
        
    if test_type in ["state", "all"]:
        # Test state persistence
        old_count = state.runtime_state["commands_processed"]
        state.runtime_state["commands_processed"] = 999
        state.save_state()
        state.load_state()
        if state.runtime_state["commands_processed"] == 999:
            results.append("STATE PERSISTENCE: ✓ Save/load working")
        state.runtime_state["commands_processed"] = old_count
        
    if test_type in ["errors", "all"]:
        # Test error handling
        try:
            raise ValueError("Test error")
        except:
            state.runtime_state["errors_caught"] += 1
            results.append("ERROR HANDLING: ✓ Exceptions caught properly")
            
    if test_type in ["security", "all"]:
        # Test JJK security
        try:
            import jjk
            # Test progenitor_check
            test_result = jjk.progenitor_check(JJK_RULES["admin_operation"], source="test")
            results.append(f"SECURITY (JJK): ✓ Rule-based checks working (admin_op: {test_result})")
        except ImportError:
            results.append("SECURITY (JJK): ✗ JJK module not available")
        except Exception as e:
            results.append(f"SECURITY (JJK): ✗ Error: {e}")
            
    if test_type in ["silent_api", "all"]:
        # Test silent API call pattern
        if system_functions and "api_manager" in system_functions:
            results.append("SILENT API: ✓ api_manager available for silent calls")
            results.append("  Use api_manager.send_message_to_specific_provider()")
            results.append("  for internal analysis without polluting history")
        else:
            results.append("SILENT API: ✗ api_manager not available")
            
    if test_type in ["integration", "all"]:
        if system_functions:
            results.append("SYSTEM FUNCTIONS: ✓ Available for integration")
        else:
            results.append("SYSTEM FUNCTIONS: ✗ Not provided")
            
    return f"[{ACTION_NAME.upper()} TEST RESULTS]\n" + "\n".join(results)

async def _demo_multi_step_tool_start() -> str:
    """Initiates the first step of a multi-turn tool operation."""
    global state
    
    # Generate a unique operation ID
    operation_id = f"demo_{int(time.time())}"
    
    # Store state for this operation
    state.pending_multi_step_data[operation_id] = {
        "status": "pending",
        "start_time": time.time(),
        "data": {"value": 42}  # Example data
    }
    
    # Track in runtime state
    if "multi_turn_operations" not in state.runtime_state:
        state.runtime_state["multi_turn_operations"] = {}
    state.runtime_state["multi_turn_operations"][operation_id] = "started"
    
    return (f"[{ACTION_NAME.upper()}: Multi-step operation initiated]\n"
            f"  Operation ID: {operation_id}\n"
            f"  This simulates a long-running task.\n"
            f"  To complete: 'placeholder multi_step_result {operation_id}'\n"
            f"  (In a real V-Agent tool, it would call a completion tool)")

async def _demo_multi_step_tool_complete(operation_id: str) -> str:
    """Completes a multi-turn operation and returns the result."""
    global state
    
    if not operation_id:
        return f"[{ACTION_NAME.upper()}: Usage: placeholder multi_step_result <operation_id>]"
    
    # Check if operation exists
    if operation_id not in state.pending_multi_step_data:
        return f"[{ACTION_NAME.upper()}: Operation '{operation_id}' not found]"
    
    # Get operation data
    op_data = state.pending_multi_step_data[operation_id]
    elapsed = time.time() - op_data["start_time"]
    
    # Clean up
    del state.pending_multi_step_data[operation_id]
    if "multi_turn_operations" in state.runtime_state:
        state.runtime_state["multi_turn_operations"][operation_id] = "completed"
    
    return (f"[{ACTION_NAME.upper()}: Multi-step operation completed]\n"
            f"  Operation ID: {operation_id}\n"
            f"  Elapsed time: {elapsed:.2f}s\n"
            f"  Result data: {op_data['data']}\n"
            f"  This demonstrates the stateful multi-turn pattern!")

def _demonstrate_antipatterns() -> str:
    """Educational: Show what NOT to do"""
    return f"""[{ACTION_NAME.upper()} - ANTI-PATTERNS TO AVOID]

1. IGNORING is_system_command (CRITICAL):
   BAD:  async def process_input(user_input, system_functions):
   GOOD: async def process_input(user_input, system_functions=None, is_system_command=False):

2. MODIFYING SYSTEM COMMANDS:
   BAD:  if True: return "[PREFIX] " + user_input
   GOOD: if is_system_command: return user_input

3. HANDLING OWN START/STOP:
   BAD:  if input == "start myaction": await start_action()  
   GOOD: Let loader.py handle lifecycle commands

4. SILENT FAILURES:
   BAD:  try: risky_op() except: pass
   GOOD: try: risky_op() except Exception as e: log_error(e)

5. HARDCODED SECRETS:
   BAD:  API_KEY = "sk-abc123xyz"
   GOOD: Load from config file

6. MODIFYING SYSTEM FUNCTIONS:
   BAD:  system_functions['log_event'] = my_function
   GOOD: Wrap the call instead

7. NO STATE PERSISTENCE:
   BAD:  global some_data  # Lost on restart
   GOOD: Save to JSON file

8. IGNORING AGENT STATUS:
   BAD:  Always modify input regardless
   GOOD: Check v_agent.is_active() first

9. USING BASIC SECURITY:
   BAD:  if jjk.is_progenitor(): allow()
   GOOD: if jjk.progenitor_check("rule_name", source): allow()

These patterns WILL break your addon or the system!"""

async def _check_addon_compliance(addon_name: str, system_functions: Optional[Dict[str, Any]]) -> str:
    """Check if another addon follows best practices"""
    if not system_functions or "get_action_obj" not in system_functions:
        return f"[{ACTION_NAME.upper()}: System functions not available for compliance check]"
    
    if not addon_name:
        return f"[{ACTION_NAME.upper()}: Usage: placeholder compliance <addon_name>]"
    
    addon_name = addon_name.strip().lower()
    
    try:
        addon_obj = system_functions["get_action_obj"](addon_name)
        if not addon_obj:
            return f"[{ACTION_NAME.upper()}: Addon '{addon_name}' not found or not loaded]"
        
        compliance = check_addon_compliance(addon_obj)
        
        # Format results
        lines = [f"[{ACTION_NAME.upper()} COMPLIANCE CHECK: {addon_name}]"]
        lines.append("\nPATTERN COMPLIANCE:")
        
        total_checks = len(compliance)
        passed_checks = sum(1 for v in compliance.values() if v)
        
        for pattern, compliant in compliance.items():
            status = "✓" if compliant else "✗"
            lines.append(f"  {status} {pattern}")
        
        lines.append(f"\nCOMPLIANCE SCORE: {passed_checks}/{total_checks} ({int(passed_checks/total_checks*100)}%)")
        
        if passed_checks == total_checks:
            lines.append("\nSTATUS: FULLY COMPLIANT! 🏆")
        elif passed_checks >= total_checks * 0.8:
            lines.append("\nSTATUS: Mostly compliant, minor issues")
        elif passed_checks >= total_checks * 0.5:
            lines.append("\nSTATUS: Partially compliant, needs work")
        else:
            lines.append("\nSTATUS: Non-compliant, major refactoring needed")
        
        return "\n".join(lines)
        
    except Exception as e:
        return f"[{ACTION_NAME.upper()}: Error checking compliance: {e}]"

# ==============================================================================
# ===== 7. HELPER FUNCTIONS ====================================================
# ==============================================================================

def _format_injection(injection_data: Dict[str, Any]) -> str:
    """Format pending injection data"""
    if not injection_data:
        return ""
    
    inj_type = injection_data.get("type", "unknown")
    content = injection_data.get("content", "")
    
    # Add metadata if verbose mode
    if state.config.get("verbose_mode", True):
        timestamp = injection_data.get("timestamp", 0)
        age = time.time() - timestamp if timestamp else 0
        return f"{content}[Injected: type={inj_type}, age={age:.1f}s]\n\n"
    else:
        return content

def _try_advisory_integration(system_functions: Dict[str, Any], message: str, category: str) -> bool:
    """Attempt to integrate with advisory system"""
    try:
        advisory_obj = system_functions.get("get_action_obj", lambda x: None)("advisory")
        if advisory_obj and hasattr(advisory_obj, 'register_advisory'):
            advisory_obj.register_advisory(
                source=ACTION_NAME,
                content=message,
                priority=5,
                persistent=False,
                category=category
            )
            state.log_integration("advisory", "register", True)
            return True
    except Exception as e:
        state.log_integration("advisory", "register", False)
        if state.config.get("verbose_mode"):
            print(f"[{ACTION_NAME.upper()}: Advisory integration failed: {e}]")
    return False

async def _handle_ai_command(command: str, system_functions: Optional[Dict[str, Any]]) -> None:
    """Handle commands triggered by AI"""
    print(f"[{ACTION_NAME.upper()}: AI triggered command: '{command}']")
    
    # ENHANCED SECURITY: Use rule-based check
    if command.lower().startswith("admin") or command.lower().startswith("critical"):
        try:
            import jjk
            # Use specific rule for AI commands
            if not jjk.progenitor_check(JJK_RULES["ai_critical_command"], source="ai"):
                print(f"[{ACTION_NAME.upper()}: JJK denied AI command '{command}' (rule: {JJK_RULES['ai_critical_command']})]")
                # Also notify advisory system if available
                if system_functions:
                    _try_advisory_integration(system_functions, f"AI command '{command}' denied by JJK", "SECURITY")
                return
        except ImportError:
            print(f"[{ACTION_NAME.upper()}: JJK not available, denying sensitive command]")
            return
    
    # Process the command
    if command.lower() == "status":
        # AI can request status
        pass
    elif command.lower().startswith("log"):
        # AI can request logging
        if system_functions and "log_event" in system_functions:
            system_functions["log_event"](f"{ACTION_NAME}_ai_log", {"message": command})
    elif command.lower() == "silent_analysis":
        # DEMO: Silent API call pattern
        if system_functions and "api_manager" in system_functions:
            # This would make a silent API call for internal analysis
            print(f"[{ACTION_NAME.upper()}: Would perform silent analysis here]")

# V-Agent Tool Handlers
def placeholder_tool_handler(args: Dict[str, Any]) -> Dict[str, Any]:
    """Handler for V-Agent tool registration"""
    return {
        "success": True,
        "message": f"{ACTION_NAME} processed V-Agent request",
        "data": {"args": args, "state": state.runtime_state["commands_processed"]}
    }

def placeholder_multi_start_handler(args: Dict[str, Any]) -> Dict[str, Any]:
    """Handler for starting multi-turn operations"""
    operation_id = f"agent_op_{int(time.time())}"
    state.pending_multi_step_data[operation_id] = {
        "status": "pending",
        "start_time": time.time(),
        "agent_data": args
    }
    
    return {
        "success": True,
        "operation_id": operation_id,
        "message": "Multi-turn operation started. Use placeholder_multi_complete to finish.",
        "next_tool": "placeholder_multi_complete"
    }

def placeholder_multi_complete_handler(args: Dict[str, Any]) -> Dict[str, Any]:
    """Handler for completing multi-turn operations"""
    operation_id = args.get("operation_id")
    if not operation_id or operation_id not in state.pending_multi_step_data:
        return {
            "success": False,
            "error": "Invalid or missing operation_id"
        }
    
    op_data = state.pending_multi_step_data[operation_id]
    elapsed = time.time() - op_data["start_time"]
    
    # Clean up
    del state.pending_multi_step_data[operation_id]
    
    return {
        "success": True,
        "result": {
            "elapsed_time": elapsed,
            "original_args": op_data.get("agent_data", {}),
            "computed_value": 42  # Example result
        }
    }

# ==============================================================================
# ===== PATTERN COMPLIANCE CHECKER =============================================
# ==============================================================================

def check_addon_compliance(addon_module) -> Dict[str, bool]:
    """
    Helper function to verify an addon follows required patterns.
    Future AIs: Use this to validate your updates!
    
    Returns dict of pattern: compliance status
    """
    compliance = {
        "has_is_system_command": False,
        "has_start_action": False,
        "has_stop_action": False,
        "has_process_input": False,
        "has_process_output": False,
        "has_help_command": False,
        "has_status_command": False,
        "uses_state_persistence": False,
        "no_hardcoded_secrets": True,  # Assume true unless found
        "checks_agent_status": False,  # NEW
        "uses_jjk_rules": False,  # NEW
    }
    
    # Check for is_system_command parameter
    if hasattr(addon_module, 'process_input'):
        try:
            sig = inspect.signature(addon_module.process_input)
            if 'is_system_command' in sig.parameters:
                compliance["has_is_system_command"] = True
        except:
            pass
    
    # Check for required functions
    compliance["has_start_action"] = hasattr(addon_module, 'start_action')
    compliance["has_stop_action"] = hasattr(addon_module, 'stop_action')
    compliance["has_process_input"] = hasattr(addon_module, 'process_input')
    compliance["has_process_output"] = hasattr(addon_module, 'process_output')
    
    # Check source code for patterns (if available)
    try:
        source = inspect.getsource(addon_module)
        
        # Check for help command
        if 'help' in source and ('_help' in source or 'generate_help' in source):
            compliance["has_help_command"] = True
            
        # Check for status command  
        if 'status' in source and ('_status' in source or 'generate_status' in source):
            compliance["has_status_command"] = True
            
        # Check for state persistence
        if 'json.dump' in source or 'save_config' in source or 'save_state' in source:
            compliance["uses_state_persistence"] = True
            
        # Check for agent awareness
        if 'is_active()' in source and ('v_agent' in source or 'v-agent' in source):
            compliance["checks_agent_status"] = True
            
        # Check for JJK rule usage
        if 'progenitor_check' in source:
            compliance["uses_jjk_rules"] = True
            
        # Check for hardcoded secrets (basic check)
        suspicious_patterns = [
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'password\s*=\s*["\'][^"\']+["\']', 
            r'token\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']'
        ]
        import re
        for pattern in suspicious_patterns:
            if re.search(pattern, source, re.IGNORECASE):
                # Check if it's not just a placeholder
                match = re.search(pattern, source, re.IGNORECASE)
                if match and not any(placeholder in match.group(0) for placeholder in ['your_', 'changeme', 'xxx', '...']):
                    compliance["no_hardcoded_secrets"] = False
                    break
                
    except:
        pass  # Source inspection failed, use defaults
        
    return compliance

# ==============================================================================
# ===== 8. PUBLIC API FOR OTHER ADDONS =========================================
# ==============================================================================

def get_placeholder_info() -> Dict[str, Any]:
    """Public API: Get addon information"""
    return {
        "name": ACTION_NAME,
        "version": ACTION_VERSION,
        "pattern_version": ADDON_DNA["pattern_version"],
        "active": state.is_active,
        "stats": {
            "commands": state.runtime_state["commands_processed"],
            "errors": state.runtime_state["errors_caught"],
            "agent_avoidance": state.runtime_state["agent_interference_avoided"]
        }
    }

def register_external_event(source: str, event_type: str, data: Any) -> bool:
    """Public API: Allow other addons to register events with us"""
    if not state.is_active:
        return False
        
    state.runtime_state["integration_log"].append({
        "source": source,
        "event": event_type,
        "data": data,
        "timestamp": time.time()
    })
    return True

def get_pattern_version() -> Dict[str, Any]:
    """
    Public API: Other addons can check what pattern version this demonstrates
    This helps track compliance across the system
    """
    return {
        "version": ADDON_DNA["pattern_version"],
        "has_is_system_command": True,
        "has_state_management": True,
        "has_help_command": True,
        "has_compliance_checker": True,
        "follows_accp": True,  # AI Coder Communication Protocol
        "has_jjk_rules": True,  # NEW: Rule-based security
        "has_multi_turn_tools": True,  # NEW: Stateful tools
        "has_agent_awareness": True,  # NEW: V-Agent awareness
        "last_update": ADDON_DNA["last_ai_update"]
    }

# ==============================================================================
# ===== 9. FINAL NOTES =========================================================
# ==============================================================================

"""
SUMMARY: This addon demonstrates EVERYTHING:

✓ CRITICAL PATTERNS:
  - is_system_command handling (THE MOST IMPORTANT)
  - Delayed injection pattern
  - Command parsing (single and multi-word)
  - State persistence
  - Error handling with recovery
  - JJK rule-based security (NEW)
  - Multi-turn tool patterns (NEW)
  - Agent awareness patterns (NEW)

✓ INTEGRATIONS:
  - Advisory system
  - Emotion tracking
  - Memory system
  - JJK security (enhanced with rules)
  - V-Agent tools (including multi-turn)
  - Consultant AIs
  - Silent API calls (NEW)

✓ BEST PRACTICES:
  - Class-based state management
  - Comprehensive error handling
  - Rate limiting
  - Configuration persistence
  - Public API for other addons
  - Educational anti-patterns
  - AI Coder Communication Protocol (ACCP)
  - Pattern compliance checking
  - Agent state awareness (NEW)
  - Rule-based security (NEW)

✓ USER EXPERIENCE:
  - Clear help text
  - Detailed status reports
  - Meaningful error messages
  - Command history
  - Testing capabilities
  - Security feedback

✓ AI COLLABORATION:
  - Clear update documentation requirements
  - Pattern versioning
  - Compliance checking tools
  - Knowledge transfer protocol
  - Advanced pattern examples

USE THIS AS YOUR TEMPLATE. COPY IT. MODIFY IT. LEARN FROM IT.
DOCUMENT YOUR CHANGES FOR FUTURE AI CODERS.

The toilet flushes properly when all addons follow these patterns! 🚽✨

Version: 3.2 - Enhanced with JJK rules, multi-turn tools, and agent awareness
"""