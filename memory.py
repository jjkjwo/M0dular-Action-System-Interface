# memory.py - Long-term Memory Manager V 3.0 (Fixed Command Routing)
# 
# This plugin provides persistent memory capabilities to the AI system, allowing it to
# remember facts, conversation summaries, and user preferences across sessions.
#
# FIXED: Memory content is now ONLY injected into AI prompts, not displayed as command output

import os
import json
import time
import asyncio
from datetime import datetime

# Global variables
_is_memory_active = False
_memory_data = {
    "conversations": {},
    "facts": {},
    "preferences": {}
}
_pending_memory_injection = None  # Store memory content to inject into next AI message
_auto_enhance = True  # Whether to automatically enhance prompts with relevant memories

# Initialize the module
def initialize():
    """Initialize memory module"""
    global _memory_data
    
    # Load from file if exists
    try:
        if os.path.exists("memory_data.json"):
            with open("memory_data.json", "r") as f:
                loaded_data = json.load(f)
                _memory_data.update(loaded_data)
                print(f"[MEMORY: Loaded memory data with {len(_memory_data['conversations'])} conversations, {len(_memory_data['facts'])} facts]")
    except Exception as e:
        print(f"[MEMORY: Error loading memory data: {e}]")

# Save memory data to file
def save_memory():
    """Save memory data to file"""
    try:
        # Make backup directory if it doesn't exist
        backup_dir = "memory_backups"
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir, exist_ok=True)
            
        # Save main file
        with open("memory_data.json", "w") as f:
            json.dump(_memory_data, f, indent=2)
            
        # During shutdown, also create a timestamped backup
        if not _is_memory_active:  # If we're stopping, create a backup
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_file = os.path.join(backup_dir, f"memory_backup_{timestamp}.json")
            with open(backup_file, "w") as f:
                json.dump(_memory_data, f, indent=2)
            print(f"[MEMORY: Created shutdown backup at {backup_file}]")
            
        print("[MEMORY: Saved memory data to file]")
    except Exception as e:
        print(f"[MEMORY: Error saving memory data: {e}]")

# Start memory action
async def start_action(system_functions=None):
    """Start memory action"""
    global _is_memory_active, _pending_memory_injection
    _is_memory_active = True
    _pending_memory_injection = None
    initialize()
    print("[MEMORY ACTION: STARTED - Memory system active]")
    
    if system_functions and "user_notification" in system_functions:
        system_functions["user_notification"](
            "[MEMORY: Memory system active. Use 'memory help' for commands.]"
        )

# Stop memory action
async def stop_action(system_functions=None):
    """Stop memory action with enhanced shutdown handling"""
    global _is_memory_active, _pending_memory_injection
    
    # Only proceed if we're actually active
    if not _is_memory_active:
        print("[MEMORY: Not active, nothing to shut down]")
        return
    
    print("[MEMORY: Stopping - Saving data before shutdown]")
    
    # Mark as inactive BEFORE saving so the save routine creates a backup
    _is_memory_active = False
    _pending_memory_injection = None
    
    # Save all memory data with backup during shutdown
    save_memory()
    
    print("[MEMORY ACTION: STOPPED - Memory system is now inactive]")

# Store a fact in memory
def store_fact(category, key, value):
    """Store a fact in memory"""
    if category not in _memory_data["facts"]:
        _memory_data["facts"][category] = {}
        
    _memory_data["facts"][category][key] = {
        "value": value,
        "timestamp": datetime.now().isoformat()
    }
    
    save_memory()  # Save after storing
    print(f"[MEMORY: Stored fact '{key}' in category '{category}']")

# Retrieve a fact from memory
def retrieve_fact(category, key):
    """Retrieve a fact from memory"""
    if category in _memory_data["facts"] and key in _memory_data["facts"][category]:
        return _memory_data["facts"][category][key]["value"]
    return None

# Store a conversation summary
def store_conversation(conversation_id, summary, topics=None):
    """Store a conversation summary"""
    _memory_data["conversations"][conversation_id] = {
        "summary": summary,
        "topics": topics or [],
        "timestamp": datetime.now().isoformat()
    }
    
    save_memory()  # Save after storing
    print(f"[MEMORY: Stored conversation '{conversation_id}']")

# Format memory data for injection
def format_memories_for_injection(memory_type="all", category=None, key=None):
    """Format memory data for injection into AI prompt"""
    lines = ["[MEMORY CONTEXT]", "=" * 60]
    
    if memory_type == "all" or memory_type == "facts":
        if _memory_data["facts"]:
            lines.append("\nStored Facts:")
            for cat, facts in _memory_data["facts"].items():
                if category and cat != category:
                    continue
                for k, data in facts.items():
                    if key and k != key:
                        continue
                    lines.append(f"  - {cat}/{k}: {data['value']}")
    
    if memory_type == "all" or memory_type == "conversations":
        if _memory_data["conversations"]:
            lines.append("\nConversation Summaries:")
            for conv_id, data in list(_memory_data["conversations"].items())[-5:]:  # Last 5
                lines.append(f"  - {conv_id}: {data['summary']}")
                if data['topics']:
                    lines.append(f"    Topics: {', '.join(data['topics'])}")
    
    lines.extend(["=" * 60, "[END MEMORY CONTEXT]\n"])
    return "\n".join(lines)

# Find relevant memories based on keywords
def find_relevant_memories(text):
    """Find memories relevant to the given text"""
    words = text.lower().split()
    relevant_facts = []
    
    # Check for facts that might be relevant
    for category, facts in _memory_data["facts"].items():
        for key, data in facts.items():
            # Simple keyword matching
            key_lower = key.lower()
            value_lower = data['value'].lower()
            if any(word in key_lower or word in value_lower for word in words if len(word) > 3):
                relevant_facts.append(f"  - {category}/{key}: {data['value']}")
    
    if relevant_facts:
        return "\n[Relevant memories found:]\n" + "\n".join(relevant_facts[:5]) + "\n"
    return ""

# Process input for memory action
async def process_input(user_input, system_functions=None, is_system_command=False):
    """Process input for memory-related commands"""
    global _is_memory_active, _pending_memory_injection, _auto_enhance
    
    if not _is_memory_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    
    # Check if this is a system command to avoid injection
    if is_system_command:
        # Still process memory commands but skip injection
        pass
    else:
        # Try to determine if it's a command without the flag
        try:
            import command_system
            if command_system.is_command(user_input):
                is_system_command = True
        except:
            pass
    
    # Handle memory commands
    if input_lower.startswith("memory "):
        # All memory commands return status messages, not content
        
        if input_lower == "memory help":
            return """[MEMORY HELP]
Commands for memory operations:

  memory status - Show memory statistics
  memory list - Load all memories for next AI message
  memory list facts - Load all facts for next AI message
  memory list conversations - Load all conversations for next AI message
  memory search <query> - Search memories and load results for next AI message
  
  memory store fact <category>|<key>|<value> - Store a fact
  memory get fact <category>|<key> - Load specific fact for next AI message
  memory delete fact <category>|<key> - Delete a fact
  
  memory store conversation <id>|<summary>|<topic1,topic2,...> - Store conversation
  memory delete conversation <id> - Delete a conversation
  
  memory auto on - Enable automatic memory enhancement
  memory auto off - Disable automatic memory enhancement
  memory clear pending - Clear any pending memory injection
  memory clear all - Delete all memory data

For AI usage: Use [command memory list] or [command memory search <query>] to load memories"""
        
        elif input_lower == "memory status":
            fact_count = sum(len(category) for category in _memory_data["facts"].values())
            auto_status = "ON" if _auto_enhance else "OFF"
            pending_status = "Yes" if _pending_memory_injection else "No"
            return f"[MEMORY STATUS]\nConversations: {len(_memory_data['conversations'])}\nFacts: {fact_count}\nPreferences: {len(_memory_data['preferences'])}\nAuto-enhance: {auto_status}\nPending injection: {pending_status}"
        
        elif input_lower == "memory list":
            _pending_memory_injection = format_memories_for_injection("all")
            return "[MEMORY: Loading all memories. Content will be included in next message.]"
        
        elif input_lower == "memory list facts":
            _pending_memory_injection = format_memories_for_injection("facts")
            fact_count = sum(len(category) for category in _memory_data["facts"].values())
            return f"[MEMORY: Loading {fact_count} facts. Content will be included in next message.]"
        
        elif input_lower == "memory list conversations":
            _pending_memory_injection = format_memories_for_injection("conversations")
            return f"[MEMORY: Loading {len(_memory_data['conversations'])} conversations. Content will be included in next message.]"
        
        elif input_lower.startswith("memory search "):
            query = user_input[14:].strip()
            relevant = find_relevant_memories(query)
            if relevant:
                _pending_memory_injection = relevant
                return f"[MEMORY: Found relevant memories for '{query}'. Content will be included in next message.]"
            else:
                return f"[MEMORY: No relevant memories found for '{query}'.]"
        
        elif input_lower.startswith("memory store fact "):
            # Format: memory store fact category|key|value
            parts = user_input[18:].split("|", 2)
            if len(parts) != 3:
                return "[MEMORY: Invalid format. Use 'memory store fact category|key|value']"
                
            category, key, value = [p.strip() for p in parts]
            store_fact(category, key, value)
            return f"[MEMORY: Stored fact '{key}' in category '{category}']"
        
        elif input_lower.startswith("memory get fact "):
            # Format: memory get fact category|key
            parts = user_input[16:].split("|", 1)
            if len(parts) != 2:
                return "[MEMORY: Invalid format. Use 'memory get fact category|key']"
                
            category, key = [p.strip() for p in parts]
            value = retrieve_fact(category, key)
            if value:
                _pending_memory_injection = f"[Memory: {category}/{key}]\n{value}\n"
                return f"[MEMORY: Found fact '{key}'. Content will be included in next message.]"
            else:
                return f"[MEMORY: Fact '{key}' in category '{category}' not found]"
        
        elif input_lower.startswith("memory store conversation "):
            # Format: memory store conversation id|summary|topic1,topic2,...
            parts = user_input[26:].split("|", 2)
            if len(parts) != 3:
                return "[MEMORY: Invalid format. Use 'memory store conversation id|summary|topic1,topic2,...']"
                
            conv_id, summary, topics_str = [p.strip() for p in parts]
            topics = [t.strip() for t in topics_str.split(",")]
            store_conversation(conv_id, summary, topics)
            return f"[MEMORY: Stored conversation '{conv_id}']"
        
        elif input_lower.startswith("memory delete fact "):
            # Format: memory delete fact category|key
            parts = user_input[19:].split("|", 1)
            if len(parts) != 2:
                return "[MEMORY: Invalid format. Use 'memory delete fact category|key']"
                
            category, key = [p.strip() for p in parts]
            
            if category in _memory_data["facts"] and key in _memory_data["facts"][category]:
                del _memory_data["facts"][category][key]
                if not _memory_data["facts"][category]:  # Remove empty category
                    del _memory_data["facts"][category]
                save_memory()
                return f"[MEMORY: Deleted fact '{key}' from category '{category}']"
            else:
                return f"[MEMORY: Fact '{key}' in category '{category}' not found]"
        
        elif input_lower.startswith("memory delete conversation "):
            conv_id = user_input[27:].strip()
            if conv_id in _memory_data["conversations"]:
                del _memory_data["conversations"][conv_id]
                save_memory()
                return f"[MEMORY: Deleted conversation '{conv_id}']"
            else:
                return f"[MEMORY: Conversation '{conv_id}' not found]"
        
        elif input_lower == "memory auto on":
            _auto_enhance = True
            return "[MEMORY: Automatic memory enhancement enabled]"
        
        elif input_lower == "memory auto off":
            _auto_enhance = False
            return "[MEMORY: Automatic memory enhancement disabled]"
        
        elif input_lower == "memory clear pending":
            _pending_memory_injection = None
            return "[MEMORY: Cleared pending memory injection]"
        
        elif input_lower == "memory clear all":
            _memory_data.clear()
            _memory_data.update({
                "conversations": {},
                "facts": {},
                "preferences": {}
            })
            save_memory()
            return "[MEMORY: Cleared all memory data]"
        
        else:
            return "[MEMORY: Unknown command. Use 'memory help' for available commands.]"
    
    # For non-commands, inject pending memories and/or auto-enhance
    if not is_system_command:
        modified_input = user_input
        
        # First, inject any pending memory content
        if _pending_memory_injection:
            modified_input = _pending_memory_injection + modified_input
            print(f"[MEMORY: Injected pending memory content into user input]")
            _pending_memory_injection = None  # Clear after injection
        
        # Then, auto-enhance if enabled
        if _auto_enhance:
            relevant = find_relevant_memories(user_input)
            if relevant:
                modified_input = modified_input + relevant
                print("[MEMORY: Auto-enhanced user input with relevant memories]")
        
        return modified_input
    
    return user_input

# Process output (no changes needed)
async def process_output(ai_response, system_functions=None):
    """Process AI output (no modification needed)"""
    return ai_response

# Function to summarize the current conversation (can be called by other actions)
async def summarize_conversation(conversation_history, system_functions):
    """Generate a summary of the current conversation"""
    if not conversation_history:
        return "No conversation to summarize"
    
    # Create a prompt for summarization
    conversation_text = ""
    for entry in conversation_history:
        role = entry.get("role", "unknown")
        text = entry.get("parts", [{}])[0].get("text", "")
        conversation_text += f"{role.upper()}: {text}\n\n"
    
    prompt = f"Please create a brief summary (2-3 sentences) of the following conversation:\n\n{conversation_text}"
    
    # Use the AI to generate a summary
    try:
        summary = await system_functions["send_to_ai"](prompt)
        return summary
    except Exception as e:
        print(f"[MEMORY: Error generating summary: {e}]")
        return "Failed to generate summary"