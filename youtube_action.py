# youtube_action.py - YouTube API Integration (Enhanced Version with Configurable Limits) V 1.0
import os
import re
import webbrowser
import json
import asyncio
import platform
from datetime import datetime

ACTION_NAME = "youtube"
ACTION_PRIORITY = 8  # Medium priority

# Constants
DEFAULT_MAX_RESULTS = 15  # Default max number of videos to keep in list (increased from 5)
DEFAULT_MAX_HISTORY = 20  # Default max number of search terms to remember (increased from 10)
CONFIG_FILE = "youtube_config.json"
API_KEY_FILE = "youtube_api_key.txt"

# State variables
_is_youtube_active = False
_youtube_api_key = None
_recent_videos = []  # List of dicts with video info
_search_history = []  # List of past search terms
_auto_suggest = False  # Auto-suggest videos based on conversation (off by default)
_max_results = DEFAULT_MAX_RESULTS  # Can be configured
_max_history = DEFAULT_MAX_HISTORY  # Can be configured

# Try to import required libraries
try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    _has_youtube_api = True
except ImportError:
    _has_youtube_api = False

async def _notify_user(system_functions, message):
    """Helper to send notifications via system_functions if available."""
    if not isinstance(system_functions, dict):
        print(f"[YOUTUBE NOTIFY FALLBACK - NO SF] {message}")
        return
    
    notifier = system_functions.get('user_notification')
    if notifier:
        try:
            # Add the action name prefix automatically for clarity in UI
            full_message = f"[{ACTION_NAME.upper()} ACTION]: {message}"
            if asyncio.iscoroutinefunction(notifier):
                await notifier(full_message)
            else:
                notifier(full_message)
        except Exception as e:
            print(f"[YOUTUBE Notify Error: {e}]")
            # Fallback print if notifier fails
            print(f"[{ACTION_NAME.upper()} ACTION NOTIFY FALLBACK]: {message}")
    else:
        # Fallback print if 'user_notification' function not found
        print(f"[{ACTION_NAME.upper()} ACTION NOTIFY FALLBACK - NO FUNC]: {message}")

async def start_action(system_functions=None):
    """Function called when youtube action is started."""
    global _is_youtube_active, _youtube_api_key, _recent_videos, _search_history, _auto_suggest, _max_results, _max_history
    
    # Load configuration if exists
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                _auto_suggest = config.get("auto_suggest", True)
                _search_history = config.get("search_history", [])
                _recent_videos = config.get("recent_videos", [])
                # Load custom limits if present
                _max_results = config.get("max_results", DEFAULT_MAX_RESULTS)
                _max_history = config.get("max_history", DEFAULT_MAX_HISTORY)
                
                # Validate types
                if not isinstance(_auto_suggest, bool): _auto_suggest = True
                if not isinstance(_search_history, list): _search_history = []
                if not isinstance(_recent_videos, list): _recent_videos = []
                if not isinstance(_max_results, int) or _max_results < 1: _max_results = DEFAULT_MAX_RESULTS
                if not isinstance(_max_history, int) or _max_history < 1: _max_history = DEFAULT_MAX_HISTORY
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR loading config: {e}]")
    
    # Try to load API key
    if os.path.exists(API_KEY_FILE):
        try:
            with open(API_KEY_FILE, "r") as f:
                _youtube_api_key = f.read().strip()
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR loading API key: {e}]")
    
    _is_youtube_active = True
    status = "FULLY ACTIVE" if _has_youtube_api and _youtube_api_key else "PARTIALLY ACTIVE (missing dependencies or API key)"
    
    # Use the consistent notification helper
    await _notify_user(system_functions, f"STARTED - {status}. Commands: 'youtube search QUERY', 'youtube open INDEX', 'youtube list', 'youtube auto on/off', 'youtube setkey API_KEY', 'youtube config [results|history] NUMBER'")

async def stop_action(system_functions=None):
    """Function called when youtube action is stopped."""
    global _is_youtube_active
    
    # Save configuration
    try:
        config = {
            "auto_suggest": _auto_suggest,
            "search_history": _search_history[-_max_history:] if _search_history else [],
            "recent_videos": _recent_videos[:_max_results] if _recent_videos else [],
            "max_results": _max_results,
            "max_history": _max_history
        }
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: ERROR saving config: {e}]")
    
    _is_youtube_active = False
    await _notify_user(system_functions, f"STOPPED - YouTube integration disabled.")

async def process_input(user_input, system_functions):
    """Process user input for youtube action."""
    global _is_youtube_active, _youtube_api_key, _recent_videos, _search_history, _auto_suggest, _max_results, _max_history
    
    if not _is_youtube_active:
        return user_input
    
    input_lower = user_input.lower().strip()
    command_handled = False  # Flag if input is identified as a command for this action
    
    # Handle youtube commands
    cmd_prefix = None
    if input_lower.startswith("youtube "):
        cmd_prefix = "youtube "
    
    if cmd_prefix:
        parts = user_input[len(cmd_prefix):].strip().split(" ", 1)
        command = parts[0].lower() if parts else ""
        argument = parts[1].strip() if len(parts) > 1 else None
        
        try:
            # YouTube search command
            if command == "search" and argument:
                command_handled = True
                await search_youtube(argument, system_functions)
            
            # YouTube open command
            elif command == "open" and argument:
                command_handled = True
                try:
                    index = int(argument)
                    await open_video(index, system_functions)
                except ValueError:
                    await _notify_user(system_functions, f"Invalid index '{argument}'. Please use a number.")
            
            # YouTube list command - shows current video list
            elif command == "list" and argument is None:
                command_handled = True
                await list_videos(system_functions)
            
            # YouTube auto on/off command
            elif command == "auto" and argument:
                command_handled = True
                setting = argument.lower()
                if setting in ["on", "true", "yes", "1"]:
                    if not _auto_suggest:
                        _auto_suggest = True
                        _save_config()
                        await _notify_user(system_functions, "Auto-suggest ON")
                    else:
                        await _notify_user(system_functions, "Auto-suggest already ON")
                elif setting in ["off", "false", "no", "0"]:
                    if _auto_suggest:
                        _auto_suggest = False
                        _save_config()
                        await _notify_user(system_functions, "Auto-suggest OFF")
                    else:
                        await _notify_user(system_functions, "Auto-suggest already OFF")
                else:
                    await _notify_user(system_functions, f"Invalid 'auto' setting: '{setting}'. Use 'on' or 'off'.")
            
            # YouTube setkey command
            elif command == "setkey" and argument:
                command_handled = True
                new_key = argument.strip()
                try:
                    with open(API_KEY_FILE, "w") as f:
                        f.write(new_key)
                    _youtube_api_key = new_key
                    await _notify_user(system_functions, "API key updated successfully")
                except Exception as e:
                    await _notify_user(system_functions, f"ERROR saving API key: {e}")
                    
            # New config command for adjusting limits
            elif command == "config":
                command_handled = True
                if argument is None:
                    # Show current configuration 
                    await _notify_user(system_functions, f"Current configuration: max_results={_max_results}, max_history={_max_history}")
                else:
                    # Parse configuration options
                    config_parts = argument.split()
                    if len(config_parts) >= 2:
                        try:
                            option = config_parts[0].lower()
                            value = int(config_parts[1])
                            if value < 1:
                                await _notify_user(system_functions, f"Invalid value: {value}. Must be greater than 0.")
                            elif option == "results":
                                _max_results = value
                                _save_config()
                                await _notify_user(system_functions, f"Maximum results set to: {_max_results}")
                            elif option == "history":
                                _max_history = value
                                _save_config()
                                await _notify_user(system_functions, f"Maximum history set to: {_max_history}")
                            else:
                                await _notify_user(system_functions, f"Unknown option: {option}. Use 'results' or 'history'.")
                        except ValueError:
                            await _notify_user(system_functions, f"Invalid value: {config_parts[1]}. Must be a number.")
                    else:
                        await _notify_user(system_functions, "Usage: youtube config [results|history] NUMBER")
            
            # Unknown command
            elif command:
                command_handled = True
                await _notify_user(system_functions, f"Unknown command '{command}'. Use search|open|list|auto|setkey|config.")
            
            # Missing command
            elif not command:
                command_handled = True
                await _notify_user(system_functions, "Missing command after 'youtube'. Use search|open|list|auto|setkey|config.")
                
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR executing command '{command}': {e}]")
            await _notify_user(system_functions, f"Error processing command '{command}'. Check logs.")
            command_handled = True  # Important: Mark handled even on error
    
    # Auto-suggest logic runs only if NOT a command and enabled
    elif _auto_suggest and _has_youtube_api and _youtube_api_key and len(user_input) > 15:
        # Don't modify the user input, but run a background task for suggestion
        asyncio.create_task(auto_suggest_videos(user_input, system_functions))
    
    # Determine final return value
    if command_handled:
        return None  # Signal to looper that input was consumed
    else:
        return user_input  # Pass input through for further processing

def _save_config():
    """Helper to save the current configuration to JSON file."""
    global _auto_suggest, _search_history, _recent_videos, _max_results, _max_history
    try:
        config = {
            "auto_suggest": _auto_suggest,
            "search_history": _search_history[-_max_history:] if _search_history else [],
            "recent_videos": _recent_videos[:_max_results] if _recent_videos else [],
            "max_results": _max_results,
            "max_history": _max_history
        }
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: ERROR saving config: {e}]")
        return False

async def search_youtube(query, system_functions):
    """Search YouTube for videos."""
    global _recent_videos, _search_history, _youtube_api_key, _max_results, _max_history
    
    if not _has_youtube_api:
        await _notify_user(system_functions, "ERROR - Required libraries not installed. Run: pip install google-api-python-client")
        return
    
    if not _youtube_api_key:
        await _notify_user(system_functions, "ERROR - API key not set. Use 'youtube setkey YOUR_API_KEY'")
        return
    
    try:
        # Add to search history
        if query not in _search_history:
            _search_history.append(query)
            _search_history = _search_history[-_max_history:] # Apply rolling window
        
        await _notify_user(system_functions, f"Searching YouTube for '{query}'...")
        
        # Build the YouTube API service
        youtube = build('youtube', 'v3', developerKey=_youtube_api_key)
        
        # Execute the search
        search_response = youtube.search().list(
            q=query,
            part='id,snippet',
            maxResults=min(_max_results, 50),  # YouTube API has a max of 50
            type='video'
        ).execute()
        
        # Process results
        new_videos = []
        for item in search_response.get('items', []):
            if item['id']['kind'] == 'youtube#video':
                video_id = item['id']['videoId']
                title = item['snippet']['title']
                channel = item['snippet']['channelTitle']
                published = item['snippet']['publishedAt']
                description = item['snippet']['description']
                
                video_info = {
                    'id': video_id,
                    'title': title,
                    'channel': channel,
                    'published': published,
                    'description': description,
                    'url': f"https://www.youtube.com/watch?v={video_id}"
                }
                new_videos.append(video_info)
        
        # Update recent videos list
        _recent_videos = new_videos + _recent_videos
        
        # Keep only unique videos based on ID, preserving order
        seen_ids = set()
        unique_videos = []
        for video in _recent_videos:
            video_id = video.get('id')
            if video_id and video_id not in seen_ids:
                unique_videos.append(video)
                seen_ids.add(video_id)
        
        _recent_videos = unique_videos[:_max_results] # Apply rolling window with configurable limit
        
        # Save config
        _save_config()
        
        # Format results for display
        if new_videos:
            result_message = f"Found {len(new_videos)} video(s) for '{query}':"
            result_message += await _format_video_list()
            result_message += f"\nUse 'youtube open INDEX' to open a video in browser."
            await _notify_user(system_functions, result_message)
        else:
            await _notify_user(system_functions, f"No videos found for '{query}'")
    
    except HttpError as e:
        await _notify_user(system_functions, f"API ERROR - {str(e)}")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ACTION: Unexpected error during search: {e}]")
        await _notify_user(system_functions, f"Unexpected error during search: {e}")

async def _format_video_list():
    """Helper function to format the video list for display."""
    global _recent_videos, _max_results
    if not _recent_videos:
        return "  (No videos in list)"
    
    formatted_list = ""
    videos_to_display = _recent_videos[:_max_results]
    
    for i, video in enumerate(videos_to_display):
        title = video.get('title', 'N/A')
        channel = video.get('channel', 'N/A')
        formatted_list += f"{i+1}. {title}\n   Channel: {channel}\n"
        if i < len(videos_to_display) - 1:
            formatted_list += "\n"
    
    return "\n" + formatted_list

async def open_video(index, system_functions):
    """Open a video from the recent list in browser."""
    global _recent_videos
    
    if not _recent_videos:
        await _notify_user(system_functions, "No videos in list. Use 'youtube search QUERY' first.")
        return
    
    # Adjust index to be 0-based
    index = index - 1
    
    if index < 0 or index >= len(_recent_videos):
        await _notify_user(system_functions, f"Invalid index. Available range is 1-{len(_recent_videos)}")
        return
    
    video = _recent_videos[index]
    video_url = video['url']
    
    # Try to open in browser
    try:
        webbrowser.open(video_url)
        await _notify_user(system_functions, f"Opening video in browser: {video['title']}")
    except Exception as e:
        await _notify_user(system_functions, f"Could not open browser. Use this URL: {video_url}")

async def list_videos(system_functions):
    """List current videos in memory."""
    global _recent_videos
    
    if not _recent_videos:
        await _notify_user(system_functions, "No videos in list. Search first with 'youtube search QUERY'.")
        return
    
    result = "Recent Videos List:\n" + await _format_video_list() + f"\nUse 'youtube open INDEX' to open a video in browser."
    await _notify_user(system_functions, result)

async def auto_suggest_videos(user_input, system_functions):
    """Analyze user input and suggest relevant videos if appropriate."""
    global _recent_videos, _search_history, _youtube_api_key, _has_youtube_api, _max_results, _max_history
    
    # Double check library and API status
    if not _has_youtube_api or not _youtube_api_key:
        return
    
    try:
        # Extract potential keywords from user input
        # Remove common words and extract significant terms
        common_words = {'the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 
                       'as', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
                       'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must'}
        
        # Tokenize and filter
        words = re.findall(r'\b\w{4,}\b', user_input.lower())
        significant_words = [word for word in words if word not in common_words]
        
        # Only proceed if we have enough significant words
        if len(significant_words) < 2:
            return
        
        # Build a search query from the most common significant words
        from collections import Counter
        word_counts = Counter(significant_words)
        top_words = [word for word, count in word_counts.most_common(3)]
        
        # Only search if we have at least 2 top words
        if len(top_words) < 2:
            return
        
        search_query = " ".join(top_words)
        
        # Check if we've already searched for similar terms
        for term in _search_history:
            if all(word in term.lower() for word in top_words[:2]):
                return  # Skip if we've already searched similar terms
        
        # Wait a bit to not interrupt the conversation
        await asyncio.sleep(2)
        
        # Perform search without notification
        try:
            # Add to search history
            if search_query not in _search_history:
                _search_history.append(search_query)
                _search_history = _search_history[-_max_history:] # Apply rolling window
            
            # Build the YouTube API service
            youtube = build('youtube', 'v3', developerKey=_youtube_api_key)
            
            # Execute the search
            search_response = youtube.search().list(
                q=search_query,
                part='id,snippet',
                maxResults=min(_max_results, 50),  # YouTube API has a max of 50
                type='video'
            ).execute()
            
            # Process results
            new_videos = []
            for item in search_response.get('items', []):
                if item['id']['kind'] == 'youtube#video':
                    video_id = item['id']['videoId']
                    title = item['snippet']['title']
                    channel = item['snippet']['channelTitle']
                    published = item['snippet']['publishedAt']
                    description = item['snippet']['description']
                    
                    video_info = {
                        'id': video_id,
                        'title': title,
                        'channel': channel,
                        'published': published,
                        'description': description,
                        'url': f"https://www.youtube.com/watch?v={video_id}"
                    }
                    new_videos.append(video_info)
            
            # Update recent videos list
            if new_videos:
                _recent_videos = new_videos + _recent_videos
                
                # Keep only unique videos based on ID, preserving order
                seen_ids = set()
                unique_videos = []
                for video in _recent_videos:
                    video_id = video.get('id')
                    if video_id and video_id not in seen_ids:
                        unique_videos.append(video)
                        seen_ids.add(video_id)
                
                _recent_videos = unique_videos[:_max_results] # Apply rolling window
                
                # Save config
                _save_config()
                
                # Notify user of auto-suggested videos
                await _notify_user(system_functions, f"Auto-suggested videos for: '{search_query}'. Use 'youtube list' to see results.")
            
        except Exception as e:
            # Silently log errors during the auto-suggest process, don't bother the user
            print(f"[{ACTION_NAME.upper()} ERROR] Unexpected error during auto-suggest for '{search_query}': {e}")
    
    except Exception as e:
        # Silently log errors during the auto-suggest process, don't bother the user
        print(f"[{ACTION_NAME.upper()} ERROR] Unexpected error during auto-suggest for input '{user_input[:50]}...': {e}")