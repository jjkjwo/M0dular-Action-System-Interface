# newfilter.py - Conversation-Only Mode
# Replaces logging functions to only show user and AI messages

ACTION_NAME = "newfilter"
ACTION_PRIORITY = 7

_is_filter_active = False
_original_log_event = None
_original_record_console_output = None

async def start_action(system_functions=None):
    """Replace the logging functions with filtered versions"""
    global _is_filter_active, _original_log_event, _original_record_console_output
    
    # Save references to original logging functions
    if system_functions and 'log_event' in system_functions:
        _original_log_event = system_functions['log_event']
        # Replace with filtered version that does nothing
        system_functions['log_event'] = filtered_log_event
    
    import looper
    if not _original_record_console_output:
        _original_record_console_output = looper.record_console_output
        # Replace with filtered version
        looper.record_console_output = filtered_record_console_output
    
    _is_filter_active = True
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Conversation-Only Mode enabled]")

async def stop_action(system_functions=None):
    """Restore original logging functions"""
    global _is_filter_active, _original_log_event, _original_record_console_output
    
    # Restore original functions
    if system_functions and 'log_event' in system_functions and _original_log_event:
        system_functions['log_event'] = _original_log_event

    # Also restore the record_console_output function
    if _original_record_console_output:
        import looper
        looper.record_console_output = _original_record_console_output
    
    _is_filter_active = False
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Normal logging restored]")

def filtered_log_event(event_name, data=None):
    """Filtered version of log_event that does nothing"""
    # Don't show any log events in the console
    pass

def filtered_record_console_output(message, to_console=True):
    """Only show user and AI messages"""
    # Always write to history file
    if _original_record_console_output:
        _original_record_console_output(message, to_console=False)
    
    # For console output, only show these messages:
    if to_console:
        # User messages
        if message.startswith("You:"):
            _original_record_console_output(message, to_console=True)
        
        # AI responses
        elif "[NOTIFICATION]: AI:" in message:
            _original_record_console_output(message, to_console=True)
        
        # Command confirmations (so users know commands worked)
        elif message.startswith("[SYSTEM: Command Received:"):
            _original_record_console_output(message, to_console=True)
        
        # Our own action messages
        elif f"[{ACTION_NAME.upper()} ACTION:" in message:
            _original_record_console_output(message, to_console=True)

async def process_input(user_input, system_functions=None):
    """Pass through unchanged - we're filtering at the logging level"""
    return user_input

async def process_output(ai_response, system_functions=None):
    """Pass through unchanged"""
    return ai_response