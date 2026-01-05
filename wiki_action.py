# Corrected Wikipedia Action Code (V 3.1 - Enhanced Configuration & Rolling Window)
# File Name: wiki_action.py

import os
import re
import json
import webbrowser
import asyncio
import platform
from datetime import datetime
import traceback # For logging unexpected errors

# --- Action Configuration ---
ACTION_NAME = "wikipedia" # This is the name used in commands and actions.json KEY
ACTION_PRIORITY = 8

# --- Constants ---
DEFAULT_MAX_RESULTS = 15    # Default max number of articles to keep in list (increased from 5)
DEFAULT_MAX_HISTORY = 20    # Default max search terms to remember (increased from 10)
CONFIG_FILE = "wikipedia_config.json" # File to store history and settings

# --- State Variables ---
_is_wikipedia_active = False
_recent_articles = []
_search_history = []
_auto_suggest = True
_max_results = DEFAULT_MAX_RESULTS
_max_history = DEFAULT_MAX_HISTORY

# --- Library Check & Import ---
_wikipedia_library = None
_has_wikipedia_api = False
_PageError = Exception # Default to base Exception
_DisambiguationError = Exception # Default to base Exception

try:
    import wikipedia as wiki_lib
    _wikipedia_library = wiki_lib
    _has_wikipedia_api = True
    _PageError = getattr(_wikipedia_library, 'PageError', Exception)
    _DisambiguationError = getattr(_wikipedia_library, 'DisambiguationError', Exception)
    print(f"[{ACTION_NAME.upper()} ACTION: External 'wikipedia' library loaded successfully.]")
except ImportError:
    _has_wikipedia_api = False
    print(f"[{ACTION_NAME.upper()} ACTION: WARNING - 'wikipedia' library not found. Run: pip install wikipedia")
except Exception as e:
    _has_wikipedia_api = False
    print(f"[{ACTION_NAME.upper()} ACTION: ERROR loading 'wikipedia' library: {e}]")
    print(traceback.format_exc())


# --- Helper Functions ---
def _load_config():
    """Loads configuration from JSON file."""
    global _recent_articles, _search_history, _auto_suggest, _max_results, _max_history
    _auto_suggest = True; _search_history = []; _recent_articles = []
    # Set defaults
    _max_results = DEFAULT_MAX_RESULTS
    _max_history = DEFAULT_MAX_HISTORY
    
    if os.path.exists(CONFIG_FILE):
        try:
            if os.path.getsize(CONFIG_FILE) > 1024*1024:
                 print(f"[{ACTION_NAME.upper()} ACTION: ERROR - Config file too large. Using defaults."); return
            with open(CONFIG_FILE, "r", encoding="utf-8") as f: config = json.load(f)
            _auto_suggest = config.get("auto_suggest", True)
            _search_history = config.get("search_history", [])
            _recent_articles = config.get("recent_articles", [])
            # Load custom limits if present
            _max_results = config.get("max_results", DEFAULT_MAX_RESULTS)
            _max_history = config.get("max_history", DEFAULT_MAX_HISTORY)
            
            # Validate types
            if not isinstance(_auto_suggest, bool): _auto_suggest = True
            if not isinstance(_search_history, list): _search_history = []
            if not isinstance(_recent_articles, list): _recent_articles = []
            if not isinstance(_max_results, int) or _max_results < 1: _max_results = DEFAULT_MAX_RESULTS
            if not isinstance(_max_history, int) or _max_history < 1: _max_history = DEFAULT_MAX_HISTORY
        except (json.JSONDecodeError, TypeError) as json_err:
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR - Invalid format in {CONFIG_FILE}: {json_err}. Using defaults.")
        except Exception as e: print(f"[{ACTION_NAME.upper()} ACTION: ERROR loading {CONFIG_FILE}: {e}")

def _save_config():
    """Saves the current configuration to JSON file."""
    global _recent_articles, _search_history, _auto_suggest, _max_results, _max_history
    config_to_save = {
        "auto_suggest": _auto_suggest if isinstance(_auto_suggest, bool) else True,
        "search_history": _search_history[-_max_history:] if isinstance(_search_history, list) else [],
        "recent_articles": _recent_articles[:_max_results] if isinstance(_recent_articles, list) else [],
        "max_results": _max_results,
        "max_history": _max_history
    }
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f: json.dump(config_to_save, f, indent=2)
        return True
    except Exception as e: print(f"[{ACTION_NAME.upper()} ACTION: ERROR saving config: {e}"); return False

async def _notify_user(system_functions, message):
    """Helper to send notifications via system_functions if available."""
    if not isinstance(system_functions, dict):
        print(f"[WIKI NOTIFY FALLBACK - NO SF] {message}")
        return
    notifier = system_functions.get('user_notification')
    if notifier:
        try:
            # Add the action name prefix automatically for clarity in UI
            full_message = f"[{ACTION_NAME.upper()} ACTION]: {message}"
            if asyncio.iscoroutinefunction(notifier): await notifier(full_message)
            else: notifier(full_message)
        except Exception as e:
            print(f"[WIKI Notify Error: {e}]")
            # Fallback print if notifier fails
            print(f"[{ACTION_NAME.upper()} ACTION NOTIFY FALLBACK]: {message}")
    else:
        # Fallback print if 'user_notification' function not found
        print(f"[{ACTION_NAME.upper()} ACTION NOTIFY FALLBACK - NO FUNC]: {message}")


# --- Core Action Functions ---
async def start_action(system_functions=None):
    """Function called when action is started."""
    global _is_wikipedia_active
    _load_config()
    _is_wikipedia_active = True
    status = "ACTIVE" if _has_wikipedia_api else "INACTIVE (MISSING 'wikipedia' LIBRARY)"
    msg = f"STARTED - {status}. Commands: wiki search|open|list|auto|config"
    # Use the consistent notification helper
    await _notify_user(system_functions, msg)

async def stop_action(system_functions=None):
    """Function called when action is stopped."""
    global _is_wikipedia_active
    saved = _save_config()
    _is_wikipedia_active = False
    msg = f"STOPPED. Config {'saved' if saved else 'save FAILED'}."
    # Use the consistent notification helper
    await _notify_user(system_functions, msg)

async def process_input(user_input, system_functions):
    """Process user input for wikipedia commands."""
    global _is_wikipedia_active, _auto_suggest, _max_results, _max_history
    if not _is_wikipedia_active:
        # print("[WIKI DEBUG] Action not active, returning input.") # Optional debug log
        return user_input # Pass through if not active

    input_lower = user_input.lower().strip()
    command_handled = False # Flag if input is identified as a command for this action
    result_message = None # To store response from command functions

    cmd_prefix = None
    if input_lower.startswith("wiki "): cmd_prefix = "wiki "
    elif input_lower.startswith("wikipedia "): cmd_prefix = "wikipedia "

    if cmd_prefix:
        # print(f"[WIKI DEBUG] Detected command prefix: '{cmd_prefix}'") # Optional debug log
        parts = user_input[len(cmd_prefix):].strip().split(" ", 1)
        command = parts[0].lower() if parts else ""
        argument = parts[1].strip() if len(parts) > 1 else None

        try: # Wrap execution of command functions
            if command == "search" and argument:
                command_handled = True
                # print(f"[WIKI DEBUG] Handling command: search, arg: {argument}") # Optional debug log
                await search_wikipedia(argument, system_functions)
            elif command == "open" and argument:
                command_handled = True
                # print(f"[WIKI DEBUG] Handling command: open, arg: {argument}") # Optional debug log
                await open_article(argument, system_functions)
            elif command == "list" and argument is None:
                command_handled = True
                # print(f"[WIKI DEBUG] Handling command: list") # Optional debug log
                await list_articles(system_functions)
            elif command == "auto" and argument:
                command_handled = True
                # print(f"[WIKI DEBUG] Handling command: auto, arg: {argument}") # Optional debug log
                setting = argument.lower()
                if setting in ["on", "true", "yes", "1"]:
                    if not _auto_suggest: _auto_suggest = True; _save_config(); await _notify_user(system_functions, "Auto-suggest ON")
                    else: await _notify_user(system_functions, "Auto-suggest already ON")
                elif setting in ["off", "false", "no", "0"]:
                    if _auto_suggest: _auto_suggest = False; _save_config(); await _notify_user(system_functions, "Auto-suggest OFF")
                    else: await _notify_user(system_functions, "Auto-suggest already OFF")
                else: await _notify_user(system_functions, f"Invalid 'auto' setting: '{setting}'. Use 'on' or 'off'.")
            # Add new config command to change limits
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
                        await _notify_user(system_functions, "Usage: wiki config [results|history] NUMBER")
            elif command:
                 command_handled = True;
                 # print(f"[WIKI DEBUG] Unknown command: {command}") # Optional debug log
                 await _notify_user(system_functions, f"Unknown command '{command}'. Use search|open|list|auto|config.")
            elif not command:
                 command_handled = True;
                 # print(f"[WIKI DEBUG] Missing command after prefix.") # Optional debug log
                 await _notify_user(system_functions, "Missing command after 'wiki'. Use search|open|list|auto|config.")
        except Exception as e:
            # Catch errors from *within* search_wikipedia, open_article etc.
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR executing command '{command}': {e}]")
            print(traceback.format_exc())
            await _notify_user(system_functions, f"Error processing command '{command}'. Check logs.")
            command_handled = True # Important: Mark handled even on error

    # Auto-suggest logic runs only if NOT a command and enabled etc.
    elif _auto_suggest and _has_wikipedia_api and _wikipedia_library:
        # print(f"[WIKI DEBUG] Input not a command, checking for auto-suggest.") # Optional debug log
        # Check length, extract keywords etc.
        if len(user_input) > 15: # Avoid on short inputs
             # Run suggestion logic asynchronously, don't block the main input flow
             asyncio.create_task(auto_suggest_articles(user_input, system_functions))
             # Note: Auto-suggest runs in background, doesn't "handle" the input itself.
             command_handled = False # Not a command for this action

    # Determine final return value
    if command_handled:
        # print("[WIKI DEBUG] Command was handled, returning None.") # Optional debug log
        return None # Signal to looper that input was consumed
    else:
        # print("[WIKI DEBUG] Command was NOT handled, returning original input.") # Optional debug log
        return user_input # Pass input through for further processing (e.g., to AI)


# --- Wikipedia Interaction Logic ---

async def search_wikipedia(query, system_functions):
    """Search Wikipedia, update list, notify user."""
    global _recent_articles, _search_history, _wikipedia_library, _PageError, _DisambiguationError, _max_results, _max_history

    # Check if library is available
    if not _has_wikipedia_api or not _wikipedia_library:
         await _notify_user(system_functions, "Cannot search - Wikipedia library not loaded or failed to import.")
         return # Stop processing if library isn't working

    # Update search history (keep only last N unique queries)
    if query.lower() not in [q.lower() for q in _search_history]:
         _search_history.append(query)
    _search_history = _search_history[-_max_history:] # Apply rolling window for history

    await _notify_user(system_functions, f"Searching Wikipedia for '{query}'...")

    try:
        # Perform the search using the library
        search_results_titles = _wikipedia_library.search(query, results=_max_results)

        if not search_results_titles:
            await _notify_user(system_functions, f"No direct search results found for '{query}'.")
            _save_config(); return

        new_articles = []; titles_processed = set()
        for title in search_results_titles:
            if title.lower() in titles_processed: continue
            page_obj = None
            try:
                # Get page object (handles redirects)
                page_obj = _wikipedia_library.page(title, auto_suggest=False, redirect=True)
                current_title = page_obj.title # Get potentially redirected title

                if current_title.lower() in titles_processed: continue # Check again after redirect
                titles_processed.add(current_title.lower()) # Add canonical title to processed set

                # Get summary and URL
                # Using try-except for summary specifically as it can fail separately
                summary = ""
                try:
                    summary = _wikipedia_library.summary(current_title, sentences=2, auto_suggest=False)
                except Exception as summary_e:
                    print(f"[{ACTION_NAME.upper()} WARN] Could not get summary for '{current_title}': {summary_e}")
                    summary = "(Summary unavailable)"

                url = page_obj.url
                article_info = {'title': current_title, 'summary': summary, 'url': url, 'query': query}
                new_articles.append(article_info)

            # Handle specific Wikipedia library errors
            except _PageError:
                 # print(f"[{ACTION_NAME.upper()} DBG] PageError encountered for '{title}'. Skipping.") # Optional debug log
                 if page_obj: titles_processed.add(page_obj.title.lower()) # Mark even failed ones as processed
                 else: titles_processed.add(title.lower())
                 continue
            except _DisambiguationError as e:
                 # print(f"[{ACTION_NAME.upper()} DBG] Disambiguation for '{title}'. Options: {e.options[:2]}...") # Optional debug log
                 titles_processed.add(title.lower()) # Mark ambiguous title as processed
                 # Optionally try to fetch the first option as a best guess, similar logic to previous version
                 # (Keeping it simple here - just notifying is often enough)
                 await _notify_user(system_functions, f"'{title}' is ambiguous. Try searching for specific options like: {', '.join(e.options[:3])}...")
                 continue
            except Exception as e: # Catch other errors during page processing
                 print(f"[{ACTION_NAME.upper()} ERROR] Unexpected error processing page '{title}': {e}")
                 print(traceback.format_exc())
                 if page_obj: titles_processed.add(page_obj.title.lower()); # Mark even failed ones as processed
                 else: titles_processed.add(title.lower())
                 continue

        # After processing all titles...
        if not new_articles:
            await _notify_user(system_functions, f"Found titles, but could not retrieve details for '{query}'.")
            _save_config(); return

        # Update the main list and save
        _recent_articles = new_articles + _recent_articles
        # Keep only unique articles based on title, preserving order (most recent first)
        seen_titles = set(); unique_articles = []
        for article in _recent_articles:
            article_title_lower = article.get('title', '').lower()
            if article_title_lower and article_title_lower not in seen_titles:
                unique_articles.append(article)
                seen_titles.add(article_title_lower)
        _recent_articles = unique_articles[:_max_results] # Apply rolling window with new max_results

        _save_config() # Save results immediately

        # Notify user of success
        result_message = f"Found {len(new_articles)} article(s) for '{query}':\n"
        result_message += await _format_article_list()
        result_message += f"\nUse 'wiki open INDEX' to open."
        await _notify_user(system_functions, result_message)

    # --- Error handling for the top-level search call ---
    except AttributeError as ae: # Usually indicates an issue with the library object itself
        print(f"[{ACTION_NAME.upper()} ERROR] Library attribute error during search for '{query}': {ae}")
        print(traceback.format_exc())
        await _notify_user(system_functions, "Internal library error during search. Check installation or logs.")
        _save_config()
    except Exception as e: # Catch any other unexpected errors
        print(f"[{ACTION_NAME.upper()} ERROR] Unexpected error during search for '{query}': {e}")
        print(traceback.format_exc())
        await _notify_user(system_functions, f"Unexpected error searching Wikipedia: {e}")
        _save_config()


async def open_article(index_str, system_functions):
    """Open an article from the recent list."""
    global _recent_articles
    if not _recent_articles:
        await _notify_user(system_functions, "Article list is empty. Use 'wiki search QUERY' first.")
        return
    try:
        index = int(index_str) - 1 # Convert to 0-based index
    except ValueError:
        await _notify_user(system_functions, f"Invalid index '{index_str}'. Please use a number.")
        return

    if 0 <= index < len(_recent_articles):
        article = _recent_articles[index]
        url = article.get('url')
        title = article.get('title', '(Title missing)')
        if not url or not url.startswith('http'):
            await _notify_user(system_functions, f"Cannot open article '{title}' - URL is missing or invalid.")
            return

        await _notify_user(system_functions, f"Attempting to open '{title}' in your browser...")
        try:
            opened = webbrowser.open(url)
            if not opened:
                 await _notify_user(system_functions, f"Could not automatically open the browser. Please visit: {url}")
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR] Error calling webbrowser.open: {e}")
            await _notify_user(system_functions, f"Error opening browser: {e}. Please visit: {url}")
    else:
        await _notify_user(system_functions, f"Invalid index '{index_str}'. Use a number between 1 and {len(_recent_articles)}.")

async def _format_article_list():
     """Helper function to format the recent article list for display."""
     global _recent_articles, _max_results
     if not _recent_articles: return "  (No articles in list)"
     formatted_list = ""
     # Display only the most recent MAX_RESULTS
     articles_to_display = _recent_articles[:_max_results]
     for i, article in enumerate(articles_to_display):
         title = article.get('title', 'N/A'); summary = article.get('summary', 'N/A')
         # Basic formatting, limit summary length
         formatted_summary = summary.replace("\n", " ") # Remove newlines from summary snippet
         formatted_list += f"{i+1}. {title}\n   Summary: {formatted_summary[:120]}{'...' if len(formatted_summary)>120 else ''}\n"
         if i < len(articles_to_display) - 1: formatted_list += "\n" # Add spacing between entries
     return formatted_list

async def list_articles(system_functions):
    """List current articles stored in memory."""
    global _recent_articles
    if not _recent_articles:
        await _notify_user(system_functions, "Article list is empty. Use 'wiki search QUERY' first.")
        return
    msg = "Current Wikipedia Article List:\n" + await _format_article_list() + f"\nUse 'wiki open INDEX' to open."
    await _notify_user(system_functions, msg)


async def auto_suggest_articles(user_input, system_functions):
    """Analyze input and potentially trigger a search in the background."""
    global _search_history, _wikipedia_library, _max_history
    # Double check library status
    if not _has_wikipedia_api or not _wikipedia_library: return

    try:
        # Keyword extraction logic (simple example, could be more sophisticated)
        common_words = {'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'think', 'like', 'know', 'want', 'need', 'please', 'thank', 'okay'}
        words = re.findall(r'\b[a-zA-Z]{4,}\b', user_input.lower()) # Find words >= 4 letters
        significant_words = [word for word in words if word not in common_words]
        if len(significant_words) < 2: return # Need at least two significant words

        from collections import Counter
        word_counts = Counter(significant_words)
        top_words = [word for word, count in word_counts.most_common(3)] # Get top 3 keywords
        if not top_words: return

        search_query = " ".join(top_words)

        # Prevent re-searching very similar topics immediately
        recent_queries_lower = [q.lower() for q in _search_history[-3:]] # Check last 3 searches
        query_words_set = set(top_words)
        already_searched_recently = False
        for recent_q in recent_queries_lower:
            recent_words_set = set(re.findall(r'\b[a-zA-Z]{4,}\b', recent_q)) # Compare significant words
            if len(query_words_set.intersection(recent_words_set)) >= len(query_words_set) * 0.6: # High overlap threshold
                already_searched_recently = True; break

        if already_searched_recently:
            # print(f"[WIKI DEBUG] Auto-suggest query '{search_query}' too similar to recent searches. Skipping.") # Optional debug log
            return

        # Add a small delay before the suggestion lookup to avoid being too aggressive
        await asyncio.sleep(1.5)

        # Perform a lightweight check (e.g., just wikipedia.search with 1 result)
        # to see if the topic seems promising before triggering a full search_wikipedia
        # print(f"[{ACTION_NAME.upper()} DEBUG] Auto-suggest trying lookup for: '{search_query}'") # Optional debug log
        pre_check_results = _wikipedia_library.search(search_query, results=1)

        if pre_check_results:
             # It seems relevant, trigger the full search (which will notify user etc.)
             # print(f"[{ACTION_NAME.upper()} DEBUG] Auto-suggest running full search for '{search_query}'...") # Optional debug log
             # Add the auto-generated query to history BEFORE calling search
             if search_query.lower() not in [q.lower() for q in _search_history]:
                _search_history.append(search_query)
             _search_history = _search_history[-_max_history:] # Apply rolling window
             await search_wikipedia(search_query, system_functions)
        # else: print(f"[{ACTION_NAME.upper()} DEBUG] Auto-suggest pre-check found no results for '{search_query}'.") # Optional debug log

    except Exception as e:
        # Silently log errors during the auto-suggest process, don't bother the user
        print(f"[{ACTION_NAME.upper()} ERROR] Unexpected error during auto-suggest for input '{user_input[:50]}...': {e}")
        # print(traceback.format_exc()) # Optionally print full traceback for debugging