# think_mode.py - Dead simple think mode using YOUR patterns

import re

ACTION_NAME = "think_mode"
ACTION_PRIORITY = 2  # Same as back.py

_is_active = False
_think_turns_remaining = 0
_suppress_output = False
_thinking_history = []
_inject_memory = True  # Config option to inject thinking into memory

async def start_action(system_functions=None):
    global _is_active
    _is_active = True
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED]")

async def stop_action(system_functions=None):
    global _is_active, _think_turns_remaining
    _is_active = False
    _think_turns_remaining = 0
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED]")

async def process_input(user_input, system_functions=None, is_system_command=False):
    global _think_turns_remaining, _suppress_output, _thinking_history
    
    if not _is_active:
        return user_input
    
    # Check for think command
    think_match = re.match(r'^think\s*(\d*)$', user_input.strip().lower())
    if think_match:
        turns = int(think_match.group(1)) if think_match.group(1) else 2
        if turns > 5:
            return "[THINK MODE: Max 5 turns]"
        _think_turns_remaining = turns
        _thinking_history = []
        return f"[THINK MODE: {turns} turns activated. Next input will be processed with thinking.]"
    
    # If we're in think mode, add header
    if _think_turns_remaining > 0 and not is_system_command:
        _suppress_output = True
        header = f"\n[THINKING: Turn {len(_thinking_history) + 1}/{len(_thinking_history) + _think_turns_remaining}]\n"
        if _think_turns_remaining == 1:
            header += "Final turn - provide complete response.\n"
        else:
            header += "Intermediate turn - analyze and prepare.\n"
        return header + user_input
    
    return user_input

async def process_output(ai_response, system_functions=None):
    global _think_turns_remaining, _suppress_output, _thinking_history
    
    if not _is_active or not _suppress_output:
        return ai_response
    
    _suppress_output = False
    _thinking_history.append(ai_response)
    _think_turns_remaining -= 1
    
    if _think_turns_remaining > 0:
        # Send the response back as input for next turn
        if system_functions and "send_command" in system_functions:
            # Include previous thinking in next prompt
            next_prompt = f"[Previous thinking: {ai_response[:200]}...]\nContinue thinking."
            system_functions["send_command"](next_prompt)
        # Show progress to user
        turn_num = len(_thinking_history)
        total_turns = turn_num + _think_turns_remaining
        return f"[THINK MODE: Completed turn {turn_num}/{total_turns}...]"
    else:
        # Final turn - show the response with optional thinking summary
        total_turns = len(_thinking_history)
        
        # If we should inject into memory
        if _inject_memory and system_functions:
            # Try to use memory system if available
            if "memory_store_fact" in system_functions:
                # Store a summary of the thinking process
                thinking_summary = f"Used {total_turns}-turn thinking mode. Key points: "
                for i, thought in enumerate(_thinking_history, 1):
                    # Extract first sentence or 100 chars
                    summary = thought.split('.')[0][:100]
                    thinking_summary += f"Turn {i}: {summary}... "
                
                # This would need the actual memory function signature
                # For now, just add to response so AI remembers
            
            # Inject into response so AI remembers in conversation history
            memory_note = f"\n\n[Thinking context: Processed through {total_turns} thinking turns"
            if _thinking_history:
                # Add brief summary of key thinking points
                memory_note += ". Key considerations: "
                for thought in _thinking_history[:2]:  # Just first 2 turns
                    key_point = thought.split('.')[0][:50]
                    memory_note += f"{key_point}... "
            memory_note += "]"
            
            ai_response = ai_response + memory_note
        
        # Show progress to user
        user_note = f"\n\n[Think mode: Refined through {total_turns} turns]"
        
        # Clear history
        _thinking_history = []
        
        return ai_response + user_note