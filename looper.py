# looper.py - Main Interaction Loop (V-AGENT: with Goal-Oriented Agentic Loop + Multiple Addon AIs + Think Mode)
#
# EXTENDED: Now supports addon_ai, addon_ai2, addon_ai3, and addon_ai4
# - Each addon can be configured independently
# - In "live" mode: sequential chain (telephone game)
# - In "delayed" mode: parallel execution with chained injection
# ENHANCED: Think mode support for multi-turn AI thinking
#
import asyncio
import os
import sys
import time
import json
import importlib
import re
import jjk

# Ensure project modules can be imported
current_dir = os.path.abspath(os.path.dirname(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import loader
import config
import command_system
import api_manager

# Correctly import the module with a hyphen in its name
spec = importlib.util.spec_from_file_location("v_agent", "v-agent.py")
v_agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v_agent)

# ------------------------------ GLOBALS ------------------------------
API_KEY_LOADED = False
last_ai_reply = ""
current_delay_seconds = config.get("DEFAULT_DELAY_SECONDS", 2.0)
# Store last responses from each addon AI for potential injection
last_addon_ai_responses = {
    "addon_ai": None,
    "addon_ai2": None,
    "addon_ai3": None,
    "addon_ai4": None
}

# ------------------------------ CONSOLE OUTPUT & LOGGING -----------------------
def record_console_output(message, to_console=True):
    """Records a message to the console and to the conversation_history.json file."""
    try:
        if not isinstance(message, str):
            message = str(message)
        message_with_newline = message if message.endswith('\n') else message + '\n'
        with open("conversation_history.json", "a", encoding="utf-8") as f:
            f.write(message_with_newline)
        if to_console:
            print(message)
    except Exception as e:
        print(f"[SYS ERR HistoryWrite: {e}]", file=sys.stderr)

def log_event(event_name, data=None):
    """Logs an event. Does not write to console by default."""
    log_level = config.get("LOG_LEVEL", "info")
    if log_level == "none": return
    filter_active = False
    try:
        registry = loader.get_action_registry()
        filter_info = registry.get("filter", {})
        filter_active = filter_info.get("is_active", False)
    except:
        pass

    filter_skipped_events = (
        "priority_level_", "input_processing_", "send_to_ai_api_",
        "round_end", "ai_output_processing_start", "ai_output_processing_end"
    )
    if filter_active and event_name.startswith(filter_skipped_events):
        return

    log_message = f"[LOG EVENT: {event_name}]"
    if data:
        data_str = str(data)
        max_len = 150
        log_message += f" - Data: {data_str[:max_len] + ('...' if len(data_str) > max_len else '')}"
    record_console_output(log_message, to_console=False)

def user_notification(message):
    """Sends a notification to the user (console and log)."""
    record_console_output(f"[NOTIFICATION]: {message}", to_console=True)

# ------------------------------ COMMAND CHECK ------------------------------
# Extended to include all addon_ai variants and think mode
RECOGNIZED_COMMAND_PREFIXES = {
    # System & Loop Control
    "exit", "delay", "prepare_shutdown",
    # API Management
    "api",
    # Action Control
    "start", "stop",
    # All Addon AI Controls
    "addon_ai", "addon_ai2", "addon_ai3", "addon_ai4", "addons",
    # Think Mode
    "think"
}

def is_system_command(input_text: str) -> bool:
    """Check if input is a command this looper can handle."""
    lower_input = input_text.strip().lower()
    if not lower_input:
        return False

    first_word = lower_input.split(' ', 1)[0]
    if first_word in RECOGNIZED_COMMAND_PREFIXES:
        return True

    return command_system.is_command(input_text)

# ------------------------------ HELPERS ------------------------------
def strip_markdown_and_emoji(text):
    """Removes markdown and emojis from text for TTS or clean display."""
    if not isinstance(text, str): return ""
    try:
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
        text = re.sub(r'[^\x20-\x7E]+', '', text)
        return text.strip()
    except Exception as e:
        print(f"[SYS WARN Strip: {e}]", file=sys.stderr)
        return text

def get_all_addons_status():
    """Returns a string summarizing the status of all consultant AIs.
    
    NOTE: This shows CONSULTANT AI status (addon_ai through addon_ai4),
    NOT Action/plugin status. Use 'actions info' to see active Actions.
    """
    statuses = []
    for i in range(1, 5):
        addon_num = str(i) if i > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        name = f"addon_ai{addon_num}"
        enabled = "ON" if config.get(f"{prefix}ENABLED") else "OFF"
        statuses.append(f"  - {name}: {enabled}")
    return "Consultant Addon Status:\n" + "\n".join(statuses)

async def disable_all_addons():
    """Turns all four consultant AIs to OFF in the config.
    
    IMPORTANT: This disables CONSULTANT AIs (addon_ai through addon_ai4) only.
    This does NOT affect Actions (plugin modules like memory.py, voice.py, etc.)
    Actions remain active and are controlled separately via start/stop commands.
    """
    was_changed = False
    for i in range(1, 5):
        addon_num = str(i) if i > 1 else ""
        prefix = f"ADDON_AI{addon_num}_"
        if config.get(f"{prefix}ENABLED"):
            config.set(f"{prefix}ENABLED", False)
            was_changed = True
    
    if was_changed:
        config.save_config()

# ------------------------------ API & KEY MANAGEMENT ------------------------------
async def send_to_ai(prompt):
    """Send to primary AI"""
    global API_KEY_LOADED

    if not api_manager._api_initialized:
        error_msg = "[SYSTEM: ERROR - API key unloaded or api_manager not initialized for primary AI.]"
        record_console_output(error_msg)
        API_KEY_LOADED = False
        return error_msg

    API_KEY_LOADED = True
    log_event("send_to_ai_req", data={"prompt_head": prompt[:150]})
    try:
        response = await api_manager.send_message(prompt)
        log_event("send_to_ai_res", data={"response_head": str(response)[:100]})
        return response
    except Exception as e:
        err_msg = f"[SYS ERR API Call (Primary): {e}]"
        log_event("send_to_ai_err", data={"error": str(e)})
        record_console_output(err_msg)
        return "[ERROR: AI API Call Failed]"

async def start_key_async():
    """Initializes PRIMARY AI"""
    global API_KEY_LOADED
    try:
        success = await api_manager.initialize_api()
        if not success:
            provider_name = api_manager.get_active_provider() or config.get("API_PROVIDER", "default")
            message = f"[SYS ERR API Init ({provider_name}): Check API key files and config/network.]"
            record_console_output(message)
            API_KEY_LOADED = False
            return message
        API_KEY_LOADED = True
        success_msg = f"[SYSTEM: API ready ({api_manager.get_active_provider()}). History RESET.]"
        record_console_output(success_msg)
        return success_msg
    except Exception as e:
        err_msg = f"[SYS FATAL API Init: {e}]"
        record_console_output(err_msg)
        API_KEY_LOADED = False
        import traceback
        traceback.print_exc(file=sys.stderr)
        return err_msg

# ------------------------------ CONTEXT & COMMAND SEND -------------
async def get_context(): return None
async def set_context(new_context): pass
def send_command(command, wait_time=0.5):
    """Writes a command to website_input.txt for the web UI or other listeners."""
    try:
        with open("website_input.txt", "w", encoding="utf-8") as f:
            f.write(command)
        if wait_time > 0:
            time.sleep(wait_time)
        return True
    except Exception as e:
        print(f"[SYS CMD SEND] FAILED: {command}, Error: {e}")
        return False

# ------------------------------ ADDON AI COMMAND HANDLER ------------------------------
async def handle_addon_ai_command(user_input_strip, addon_num=""):
    """
    Handles addon_ai commands for any of the 4 addon AIs.
    addon_num can be "", "2", "3", or "4"
    """
    parts = user_input_strip.split()
    lower_parts = user_input_strip.lower().split()
    
    # Config key prefix
    prefix = f"ADDON_AI{addon_num}_"
    display_name = f"addon_ai{addon_num}"
    
    if len(lower_parts) > 1:
        sub_command = lower_parts[1]
        
        if sub_command == "on":
            config.set(f"{prefix}ENABLED", True)
            user_notification(f"[SYSTEM: {display_name} enabled.]")
            return True
            
        elif sub_command == "off":
            config.set(f"{prefix}ENABLED", False)
            user_notification(f"[SYSTEM: {display_name} disabled.]")
            return True
            
        elif sub_command == "provider" and len(parts) > 2:
            provider_name_val = parts[2]
            config.set(f"{prefix}PROVIDER", provider_name_val)
            user_notification(f"[SYSTEM: {display_name} provider set to '{provider_name_val}'.]")
            return True
            
        elif sub_command == "model" and len(parts) > 2:
            model_name_val = " ".join(parts[2:])
            config.set(f"{prefix}MODEL_NAME", model_name_val)
            user_notification(f"[SYSTEM: {display_name} model set to '{model_name_val}'.]")
            return True
            
        elif sub_command == "mode" and len(lower_parts) > 2:
            mode_val = lower_parts[2]
            if mode_val in ["live", "delayed"]:
                config.set(f"{prefix}MODE", mode_val)
                user_notification(f"[SYSTEM: {display_name} mode set to '{mode_val}'.]")
                return True
            else:
                user_notification(f"[SYSTEM: Usage: {display_name} mode <live|delayed>]")
                return False
                
        elif sub_command == "inject" and len(lower_parts) > 2:
            if lower_parts[2] == "on":
                config.set(f"{prefix}INJECT_RESPONSE", True)
                user_notification(f"[SYSTEM: {display_name} response injection ON (for 'delayed' mode).]")
                return True
            elif lower_parts[2] == "off":
                config.set(f"{prefix}INJECT_RESPONSE", False)
                user_notification(f"[SYSTEM: {display_name} response injection OFF (for 'delayed' mode).]")
                return True
            else:
                user_notification(f"[SYSTEM: Usage: {display_name} inject <on|off>]")
                return False
                
        elif sub_command == "history_turns" and len(lower_parts) > 2:
            try:
                turns = int(lower_parts[2])
                if turns >= 0:
                    config.set(f"{prefix}MAX_HISTORY_TURNS", turns)
                    user_notification(f"[SYSTEM: {display_name} history turns set to {turns}.]")
                    return True
                else:
                    user_notification("[SYSTEM: Error - History turns must be non-negative.]")
                    return False
            except ValueError:
                user_notification("[SYSTEM: Error - Invalid number for history turns.]")
                return False
                
        elif sub_command == "status":
            status_msg = (f"{display_name} Status:\n"
                          f"  Enabled: {config.get(f'{prefix}ENABLED')}\n"
                          f"  Provider: {config.get(f'{prefix}PROVIDER')}\n"
                          f"  Model: {config.get(f'{prefix}MODEL_NAME')}\n"
                          f"  Mode: {config.get(f'{prefix}MODE')}\n"
                          f"  Inject (delayed mode): {config.get(f'{prefix}INJECT_RESPONSE')}\n"
                          f"  History Turns: {config.get(f'{prefix}MAX_HISTORY_TURNS')}")
            user_notification(status_msg)
            return True
        else:
            user_notification(f"[SYSTEM: Unknown '{display_name}' subcommand.]")
            return False
    else:
        user_notification(f"[SYSTEM: Usage: {display_name} <subcommand>.]")
        return False

# ------------------------------ MAIN INTERACTION LOOP ----
async def interaction_loop():
    global last_ai_reply, current_delay_seconds, last_addon_ai_responses, API_KEY_LOADED
    record_console_output("\n[looper.py - AGS Interaction Loop Starting...]\n", to_console=True)

    # Functions made available to actions and v-agent
    system_functions = {
        "send_to_ai": send_to_ai,
        "get_context": get_context,
        "set_context": set_context,
        "log_event": log_event,
        "user_notification": user_notification,
        "stop_action": loader.stop_action,
        "start_action": loader.start_action,
        "last_ai_reply": lambda: last_ai_reply,
        "action_registry": loader.get_action_registry,
        "send_command": send_command,
        "disable_all_addons": disable_all_addons,
        "add_system_message": lambda msg: user_notification(msg),
        "api_manager_switch_provider": api_manager.switch_provider,
        "api_manager_get_active_provider": api_manager.get_active_provider,
        "api_manager_get_active_model_name": api_manager.get_active_model_name,
        "record_console_output": record_console_output,
        "api_manager": api_manager,
        "get_action_obj": loader.get_action_object  # For think mode
    }

    # Initialize the V-Agent module
    v_agent.initialize(system_functions, loader, api_manager)

    loopback_triggered, loopback_input = False, None
    server_mode = os.environ.get("SERVER_ENVIRONMENT") == "SERVER"
    think_mode_active = False  # Track if think mode is processing

    try:
        while True:
            # =================== V-AGENT: AGENTIC BLOCK ===================
            if v_agent.is_active():
                await v_agent.take_turn()
                await asyncio.sleep(current_delay_seconds)
                continue
            # =================== END V-AGENT BLOCK ======================

            user_input = None
            from_console = False
            input_source = "none"
            registry = loader.get_action_registry()

            # --- Check if think mode is in progress ---
            is_think_mode_active = "think_mode" in registry and registry.get("think_mode", {}).get("is_active", False)
            if is_think_mode_active:
                think_mod = registry["think_mode"].get("module")
                if think_mod and hasattr(think_mod, "is_thinking_active") and think_mod.is_thinking_active():
                    # Think mode is actively processing, it will handle its own flow
                    think_mode_active = True
                    # Let the normal flow continue but think mode will inject prompts
                else:
                    think_mode_active = False

            # --- Input Acquisition ---
            # 1. Check web_input.txt
            is_web_active = "web_input" in registry and registry.get("web_input", {}).get("is_active", False)
            if is_web_active and os.path.exists("website_input.txt"):
                try:
                    content = ""
                    with open("website_input.txt", "r+", encoding="utf-8") as f:
                        content = f.read().strip()
                        if content:
                            f.seek(0)
                            f.truncate()
                    if content:
                        user_input = content
                        input_source = "web"
                except Exception as e:
                    record_console_output(f"[SYS ERR WebRead: {e}]")

            # 2. Check for "ok" action loopback
            is_ok_active = "ok" in registry and registry.get("ok", {}).get("is_active", False)
            if user_input is None and is_ok_active and not loopback_triggered:
                ok_mod = registry["ok"].get("module")
                if ok_mod and hasattr(ok_mod, "check_and_execute_loopback"):
                    response = await ok_mod.check_and_execute_loopback(system_functions)
                    if response:
                        loopback_input = response
                        loopback_triggered = True
                        record_console_output("[SYS OK Loopback Triggered by AI 'ok']")

            # 3. Use loopback input if triggered
            if user_input is None and loopback_triggered:
                user_input = loopback_input
                loopback_input = None
                loopback_triggered = False
                record_console_output(f"[SYS Injecting Loopback: {str(user_input)[:100]}...]")
                input_source = "loopback"

            # 4. Get input from console
            if user_input is None and not server_mode:
                try:
                    user_input_raw = input("Progenitor: ")
                    user_input = user_input_raw.strip()
                    from_console = True
                    input_source = "console"
                except EOFError:
                    record_console_output("[SYS EOF]")
                    break
                except KeyboardInterrupt:
                    raise

            if user_input is None:
                if server_mode:
                    await asyncio.sleep(0.5)
                continue

            # --- V-AGENT: DELEGATE INPUT HANDLING ---
            agent_handled_input = await v_agent.handle_input_or_command(user_input)
            if agent_handled_input:
                continue

            # --- Processing & Logging User Input ---
            user_input_strip = user_input.strip()
            user_input_lower = user_input_strip.lower()

            try:
                with open("cleanuser.txt", "w", encoding="utf-8") as f:
                    f.write(user_input_strip)
            except Exception as e:
                record_console_output(f"[SYS ERR Write cleanuser.txt: {e}]")

            processed_input_for_primary_pipeline = user_input_strip
            is_cmd = is_system_command(user_input_strip)

            # Log the source and content of the input
            if is_cmd:
                record_console_output(f"[SYSTEM: Progenitor Command Received:] {user_input_strip}", to_console=True)
            elif input_source == "web":
                record_console_output(f"\n[SYSTEM: Using INPUT as User Input:]\n{user_input}\n[SYSTEM: End INPUT]", to_console=True)
            elif input_source == "loopback":
                record_console_output(f"You: [Loopback] {user_input_strip}", to_console=True)
            elif from_console:
                record_console_output(f"You: {user_input_strip}", to_console=False)

            # --- Command Execution ---
            if is_cmd:
                command_handled_internally = False

                # Extended command handling for multiple addon AIs
                if user_input_lower == "exit":
                    command_handled_internally = True
                    break

                elif user_input_lower == "start key":
                    await start_key_async()
                    command_handled_internally = True

                elif user_input_lower.startswith("api "):
                    sub_command_part = user_input_lower.split(" ", 1)[-1]

                    if sub_command_part.startswith("switch "):
                        # Centralized security check against the "api_switch_provider" rule
                        if jjk.progenitor_check("api_switch_provider", source=input_source):
                            parts = user_input_strip.split(" ", 2)
                            if len(parts) == 3:
                                new_provider = parts[2].lower()
                                response_msg = await api_manager.switch_provider(new_provider)
                                user_notification(response_msg)
                            else:
                                user_notification("[SYSTEM: Usage: api switch <provider_name>]")
                        else:
                            user_notification("[JJK: DENIED - Progenitor status required to switch API provider.]")
                    elif sub_command_part == "status":
                        status = api_manager.get_api_call_status()
                        count = status.get('count', 'N/A')
                        limit = status.get('limit', 'N/A')
                        user_notification(f"[SYSTEM: API Call Status: {count} / {limit} calls used.]")
                    elif sub_command_part == "reset_counter":
                        api_manager.reset_api_call_counter()
                        user_notification("[SYSTEM: API call counter has been reset to 0.]")

                    if sub_command_part.startswith("switch ") or sub_command_part == "status" or sub_command_part == "reset_counter":
                        command_handled_internally = True

                elif user_input_lower == "prepare_shutdown":
                    try:
                        action_simplified_module = importlib.import_module("action_simplified")
                        if hasattr(action_simplified_module, 'handle_prepare_shutdown'):
                            response = await action_simplified_module.handle_prepare_shutdown()
                            user_notification(response)
                    except Exception as e_shutdown:
                        user_notification(f"[SYS ERR PrepareShutdown: {e_shutdown}]")
                    command_handled_internally = True

                elif user_input_lower.startswith("start ") or \
                     user_input_lower.startswith("stop ") or \
                     user_input_lower.startswith("delay "):
                    cmd_parts = user_input_strip.split(" ", 1)
                    cmd_name = cmd_parts[0].lower()
                    arg = cmd_parts[1].strip() if len(cmd_parts) > 1 else None

                    if cmd_name in ("start", "stop") and arg:
                        if cmd_name == "start":
                            await loader.start_action(arg, system_functions)
                        else:
                            await loader.stop_action(arg, system_functions)
                        command_handled_internally = True
                    elif cmd_name == "delay":
                        if arg:
                            try:
                                current_delay_seconds = max(0, min(float(arg), 60))
                                user_notification(f"Delay now: {current_delay_seconds:.1f}s")
                            except ValueError:
                                user_notification("Invalid delay value. Must be a number.")
                        else:
                            user_notification(f"Current delay: {current_delay_seconds:.1f}s")
                        command_handled_internally = True

                # Handle all addon_ai commands (original and 2/3/4)
                elif user_input_lower.startswith("addon_ai "):
                    if await handle_addon_ai_command(user_input_strip, ""):
                        config.save_config()
                        log_event("addon_ai_command_processed", {"command": user_input_strip})
                    command_handled_internally = True

                elif user_input_lower.startswith("addon_ai2 "):
                    if await handle_addon_ai_command(user_input_strip, "2"):
                        config.save_config()
                        log_event("addon_ai2_command_processed", {"command": user_input_strip})
                    command_handled_internally = True

                elif user_input_lower.startswith("addon_ai3 "):
                    if await handle_addon_ai_command(user_input_strip, "3"):
                        config.save_config()
                        log_event("addon_ai3_command_processed", {"command": user_input_strip})
                    command_handled_internally = True

                elif user_input_lower.startswith("addon_ai4 "):
                    if await handle_addon_ai_command(user_input_strip, "4"):
                        config.save_config()
                        log_event("addon_ai4_command_processed", {"command": user_input_strip})
                    command_handled_internally = True

                elif user_input_lower == "addons off":
                    # Disable all CONSULTANT AIs - does NOT affect Actions (plugins)
                    # Actions like memory.py, voice.py remain active
                    await disable_all_addons()
                    user_notification("[SYSTEM: All consultant addons have been disabled.]")
                    command_handled_internally = True

                elif user_input_lower == "addons status":
                    # Show status of CONSULTANT AIs only - use "actions info" for plugin status
                    status_message = get_all_addons_status()
                    user_notification(status_message)
                    command_handled_internally = True

                if command_handled_internally:
                    log_event("looper_direct_command_processed", {"command": user_input_strip})
                    continue

                # --- Fallback: Pass to loader.process_input ---
                log_event("cmd_proc_start_loader", data={"command": user_input_strip})
                try:
                    command_response = await loader.process_input(user_input_strip, system_functions, is_system_command=True)

                    if user_input_lower.startswith("load ") and command_response and not str(command_response).startswith("[LVL3"):
                        processed_input_for_primary_pipeline = command_response
                        is_cmd = False
                        user_notification("[SYS Injecting Context from 'load' Command for AI processing...]")
                    elif user_input_lower == "back" and command_response and not str(command_response).startswith("[BACK"):
                        loopback_input = command_response
                        loopback_triggered = True
                        record_console_output("[SYS 'back' Command Triggered Loopback by Plugin Response]")
                        continue
                    elif command_response and isinstance(command_response, str):
                        user_notification(command_response)

                    if is_cmd:
                        log_event("cmd_proc_end_skipped_ai_after_loader")
                        continue
                except Exception as e:
                    record_console_output(f"[SYS ERR CmdPipe: {e}]")
                    log_event("cmd_proc_err_loader", data={"error": str(e)})
                    continue

            # --- Input Pipeline for PRIMARY AI ---
            effective_input_for_primary_pipeline = processed_input_for_primary_pipeline

            # Inject responses from Addon AIs (if in delayed mode and injection is on)
            # This creates a chain: addon_ai -> addon_ai2 -> addon_ai3 -> addon_ai4 -> primary
            injection_parts = []
            
            for addon_name in ["addon_ai", "addon_ai2", "addon_ai3", "addon_ai4"]:
                addon_num = addon_name.replace("addon_ai", "")
                prefix = f"ADDON_AI{addon_num}_"
                
                if config.get(f"{prefix}MODE") == "delayed" and \
                   config.get(f"{prefix}INJECT_RESPONSE") and \
                   last_addon_ai_responses.get(addon_name):
                    
                    provider = config.get(f"{prefix}PROVIDER")
                    response = last_addon_ai_responses[addon_name]
                    injection_parts.append(f"[Information from {addon_name} ({provider}) last turn:\n{response}]")
                    log_event(f"{addon_name}_response_injected_delayed", data={"response_head": str(response)[:50]})
                    last_addon_ai_responses[addon_name] = None  # Clear after use

            if injection_parts:
                injection_prefix = "\n".join(injection_parts) + "\n---\n\n"
                effective_input_for_primary_pipeline = injection_prefix + processed_input_for_primary_pipeline

            # --- Pass through action input pipeline ---
            final_prompt_for_primary_ai = effective_input_for_primary_pipeline
            log_event("primary_ai_input_pipeline_start", data={"input_head": str(effective_input_for_primary_pipeline)[:100]})
            try:
                pipeline_out = await loader.process_input(effective_input_for_primary_pipeline, system_functions, is_system_command=False)
                if pipeline_out is not None:
                    final_prompt_for_primary_ai = pipeline_out
                    if pipeline_out != effective_input_for_primary_pipeline:
                        log_event("primary_ai_input_pipeline_mod")
                log_event("primary_ai_input_pipeline_end")
            except Exception as e:
                record_console_output(f"[SYS ERR InPipe (Primary): {e}]")
                log_event("primary_ai_input_pipeline_err", data={"error": str(e)})
                continue

            # --- Check if think mode is suppressing output ---
            if think_mode_active and is_think_mode_active:
                think_mod = registry["think_mode"].get("module")
                if think_mod and hasattr(think_mod, "get_thinking_status"):
                    status = think_mod.get_thinking_status()
                    if status.get("active") and status.get("turns_remaining", 0) > 0:
                        # Think mode is still processing, skip the normal AI call delay
                        # The output processing will handle the next turn injection
                        await asyncio.sleep(0.1)  # Small delay to prevent tight loop
                    else:
                        # Normal delay before AI call
                        await asyncio.sleep(current_delay_seconds)
            else:
                # Normal delay before AI call
                await asyncio.sleep(current_delay_seconds)

            primary_ai_response_raw = "[ERROR: Primary AI API Call Failed]"
            addon_responses = {}

            # --- AI Calls (Primary and Multiple Addons) ---
            enabled_addons = []
            for addon_name in ["addon_ai", "addon_ai2", "addon_ai3", "addon_ai4"]:
                addon_num = addon_name.replace("addon_ai", "")
                if config.get(f"ADDON_AI{addon_num}_ENABLED"):
                    enabled_addons.append(addon_name)

            if enabled_addons:
                # Determine if we need live mode for any addon
                any_live_mode = any(
                    config.get(f"ADDON_AI{name.replace('addon_ai', '')}_MODE") == "live" 
                    for name in enabled_addons
                )

                if any_live_mode:
                    # --- Live Mode: Sequential execution with chaining ---
                    accumulated_injection = ""
                    
                    # Process each addon in sequence
                    for addon_name in enabled_addons:
                        addon_num = addon_name.replace("addon_ai", "")
                        prefix = f"ADDON_AI{addon_num}_"
                        
                        if config.get(f"{prefix}MODE") == "live":
                            provider = config.get(f"{prefix}PROVIDER")
                            model = config.get(f"{prefix}MODEL_NAME")
                            history_turns = config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
                            
                            # Prepare prompt - for live mode, include accumulated injections
                            addon_prompt = user_input_strip
                            if accumulated_injection:
                                addon_prompt = accumulated_injection + addon_prompt
                            
                            # Prepare history
                            history_for_call = []
                            if history_turns > 0 and api_manager.get_history():
                                full_primary_history = api_manager.get_history()
                                num_messages_to_take = history_turns * 2
                                history_for_call = full_primary_history[-num_messages_to_take:]
                            
                            log_event(f"{addon_name}_call_initiated_live")
                            
                            response = await api_manager.send_message_to_specific_provider(
                                addon_prompt, provider, model,
                                conversation_history_override=history_for_call
                            )
                            
                            addon_responses[addon_name] = response
                            log_event(f"{addon_name}_response_received_live", data={"response_head": str(response)[:100]})
                            
                            if response and not response.startswith("[ERROR:"):
                                # Add to accumulation for next addon
                                injection = f"[Information from {addon_name} ({provider}):\n{response}\n---]\n\n"
                                accumulated_injection += injection
                            elif response:
                                record_console_output(f"[{addon_name.upper()} (LIVE) ERROR]: {response}", to_console=False)
                    
                    # Add final accumulated injection to primary AI prompt
                    if accumulated_injection:
                        final_prompt_for_primary_ai = accumulated_injection + final_prompt_for_primary_ai
                        log_event("addon_ai_responses_injected_live_chain")
                    
                    # Call primary AI
                    primary_ai_response_raw = await send_to_ai(final_prompt_for_primary_ai)
                    
                    # Process delayed-mode addons if any
                    delayed_tasks = []
                    for addon_name in enabled_addons:
                        addon_num = addon_name.replace("addon_ai", "")
                        prefix = f"ADDON_AI{addon_num}_"
                        
                        if config.get(f"{prefix}MODE") == "delayed":
                            provider = config.get(f"{prefix}PROVIDER")
                            model = config.get(f"{prefix}MODEL_NAME")
                            history_turns = config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
                            
                            history_for_call = []
                            if history_turns > 0 and api_manager.get_history():
                                full_primary_history = api_manager.get_history()
                                num_messages_to_take = history_turns * 2
                                history_for_call = full_primary_history[-num_messages_to_take:]
                            
                            task = api_manager.send_message_to_specific_provider(
                                user_input_strip, provider, model,
                                conversation_history_override=history_for_call
                            )
                            delayed_tasks.append((addon_name, task))
                    
                    # Execute delayed tasks if any
                    if delayed_tasks:
                        task_results = await asyncio.gather(*[t[1] for t in delayed_tasks], return_exceptions=True)
                        for i, (addon_name, _) in enumerate(delayed_tasks):
                            if isinstance(task_results[i], Exception):
                                addon_responses[addon_name] = f"[ERROR: {addon_name} call failed: {task_results[i]}]"
                            else:
                                addon_responses[addon_name] = task_results[i]
                
                else:
                    # --- Delayed Mode: All addons run in parallel ---
                    all_tasks = []
                    
                    # Primary AI task
                    all_tasks.append(("primary", send_to_ai(final_prompt_for_primary_ai)))
                    
                    # Addon AI tasks
                    for addon_name in enabled_addons:
                        addon_num = addon_name.replace("addon_ai", "")
                        prefix = f"ADDON_AI{addon_num}_"
                        
                        provider = config.get(f"{prefix}PROVIDER")
                        model = config.get(f"{prefix}MODEL_NAME")
                        history_turns = config.get(f"{prefix}MAX_HISTORY_TURNS", 0)
                        
                        history_for_call = []
                        if history_turns > 0 and api_manager.get_history():
                            full_primary_history = api_manager.get_history()
                            num_messages_to_take = history_turns * 2
                            history_for_call = full_primary_history[-num_messages_to_take:]
                        
                        log_event(f"{addon_name}_call_initiated_delayed", data={"provider": provider})
                        
                        task = api_manager.send_message_to_specific_provider(
                            user_input_strip, provider, model,
                            conversation_history_override=history_for_call
                        )
                        all_tasks.append((addon_name, task))
                    
                    # Execute all tasks in parallel
                    try:
                        results = await asyncio.gather(*[t[1] for t in all_tasks], return_exceptions=True)
                        
                        for i, (name, _) in enumerate(all_tasks):
                            if isinstance(results[i], Exception):
                                if name == "primary":
                                    primary_ai_response_raw = f"[ERROR: Primary AI call failed: {results[i]}]"
                                else:
                                    addon_responses[name] = f"[ERROR: {name} call failed: {results[i]}]"
                            else:
                                if name == "primary":
                                    primary_ai_response_raw = results[i]
                                else:
                                    addon_responses[name] = results[i]
                    
                    except Exception as gather_e:
                        primary_ai_response_raw = f"[ERROR: Async Gather failed: {gather_e}]"
                        record_console_output(f"[SYS ERR Gather: {gather_e}]")
            else:
                # No addons enabled, just run primary AI
                primary_ai_response_raw = await send_to_ai(final_prompt_for_primary_ai)

            # --- Post-call processing for addon results ---
            for addon_name, response in addon_responses.items():
                addon_num = addon_name.replace("addon_ai", "")
                prefix = f"ADDON_AI{addon_num}_"
                
                if response and config.get(f"{prefix}MODE") == "delayed":
                    # Log and display delayed addon output
                    provider_name = config.get(f"{prefix}PROVIDER", addon_name).upper()
                    addon_log_prefix = f"[{provider_name} CONSULT ({addon_name})]:"
                    record_console_output(f"{addon_log_prefix} {response}", to_console=False)
                    
                    print(f"\n--- {addon_name} ({provider_name}) Consult Output ---")
                    print(response)
                    print(f"--- End {addon_name} Consult ---\n")
                
                # Store response for potential injection in next turn (delayed mode only)
                if config.get(f"{prefix}MODE") == "delayed" and \
                   config.get(f"{prefix}INJECT_RESPONSE") and \
                   response and not response.startswith("[ERROR:"):
                    last_addon_ai_responses[addon_name] = response
                elif config.get(f"{prefix}MODE") == "delayed" and config.get(f"{prefix}INJECT_RESPONSE"):
                    last_addon_ai_responses[addon_name] = None

            # --- PRIMARY AI Output Processing ---
            processed_primary_ai_response = primary_ai_response_raw
            if primary_ai_response_raw is None:
                primary_ai_response_raw = "[ERROR: AI returned no response]"
                processed_primary_ai_response = primary_ai_response_raw
                log_event("ai_api_none_response")
            elif not primary_ai_response_raw.startswith("[ERROR:"):
                log_event("ai_output_processing_start")
                try:
                    pipeline_out_primary = await loader.process_output(primary_ai_response_raw, system_functions)
                    if pipeline_out_primary is not None and pipeline_out_primary != primary_ai_response_raw:
                        processed_primary_ai_response = pipeline_out_primary
                        log_event("ai_output_processing_mod")
                    log_event("ai_output_processing_end")
                except Exception as e:
                    record_console_output(f"[SYS ERR OutPipe (Primary): {e}]")
                    log_event("ai_output_processing_err", data={"error": str(e)})
            else:
                log_event("ai_api_error_response", data={"error_msg": primary_ai_response_raw})

            # --- Check if think mode suppressed the output ---
            if processed_primary_ai_response == "" and think_mode_active:
                # Think mode is handling the flow, skip normal output processing
                log_event("think_mode_suppressed_output")
                continue

            # Store and display the final AI response
            last_ai_reply = processed_primary_ai_response
            user_notification(f"AI: {processed_primary_ai_response}")

            # Text-to-Speech
            is_voice_active = "voice" in registry and registry.get("voice", {}).get("is_active", False)
            if is_voice_active and not processed_primary_ai_response.startswith("[ERROR:"):
                voice_mod = registry["voice"].get("module")
                if voice_mod and hasattr(voice_mod, "speak_ai_reply"):
                    tts_txt = strip_markdown_and_emoji(processed_primary_ai_response)
                    if tts_txt:
                        try:
                            await voice_mod.speak_ai_reply(tts_txt)
                        except Exception as e:
                            record_console_output(f"[SYS ERR TTS: {e}]")

            # Write to website_output.txt
            if is_web_active and not processed_primary_ai_response.startswith("[ERROR:"):
                try:
                    with open("website_output.txt", "w", encoding="utf-8") as f:
                        f.write(processed_primary_ai_response)
                    log_event("web_out_file_written_ok")
                except Exception as e:
                    record_console_output(f"[SYS ERR WebWrite website_output.txt: {e}]")
                    log_event("web_out_file_err", data={"error": str(e)})

            log_event("interaction_round_end")

    except KeyboardInterrupt:
        record_console_output("\n[SYS Interrupt Detected in looper.py]")
    except Exception as e:
        record_console_output(f"\n[SYS FATAL LOOP ERR in looper.py: {e}]\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
    finally:
        record_console_output("\n[SYS looper.py Interaction Loop Finished.]")
        if loader:
            loader.stop_monitoring()

async def _looper_main_direct_test():
    """For direct testing of looper.py outside of action_simplified.py."""
    try:
        config.load_config()
        if 'command_system' in sys.modules: command_system.load_commands()
        await loader.initialize()
    except Exception as e:
        print(f"Looper Direct Test Init Error: {e}")
        return

    server_mode = os.environ.get("SERVER_ENVIRONMENT") == "SERVER"
    record_console_output(f"[SYSTEM STARTUP (looper direct): {'SERVER' if server_mode else 'CONSOLE'} mode]")

    if server_mode:
        await api_manager.initialize_api()
        if "web_input" in loader.get_action_registry():
            await loader.start_action("web_input")

    await interaction_loop()

if __name__ == "__main__":
    try:
        asyncio.run(_looper_main_direct_test())
    except KeyboardInterrupt:
        print("\n[SYS Exit Signal (Ctrl+C) in looper.py __main__]")
    except Exception as e_main:
        print(f"\n[SYS Critical Exit in looper.py __main__: {e_main}]", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)