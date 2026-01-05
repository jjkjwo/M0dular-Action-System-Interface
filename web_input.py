# web_input.py - Web interface integration for action.py
# Version: 2.0.0

"""
This script acts as a simple file-based bridge between the main AI application
and a separate web interface. It facilitates two-way communication by
monitoring a specific input file and writing to a specific output file.

- Input Mechanism:  Reads user messages from `website_input.txt`.
- Output Mechanism: Writes AI responses to `website_output.txt`.

This allows the AI to receive input from and send responses to a web server
without a direct network connection, using the filesystem as a message queue.
"""

import os
import time
import threading

# --- Action Configuration ---
ACTION_NAME = "web_input"
ACTION_PRIORITY = 4  # Same priority as update.py

# --- Core Action Functions (called by the main application) ---

async def start_action():
    """
    Function called when the web_input action is started by the main application.
    It prints a status message to the console.
    """
    server_env = os.environ.get("SERVER_ENVIRONMENT")
    if server_env == "SERVER":
        print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Website input ENABLED (SERVER_ENVIRONMENT='SERVER' detected). Checking for website_input.txt will be ACTIVE.]")
    else:
        print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Website input ENABLED. Checking for website_input.txt will be ACTIVE.]")

async def stop_action():
    """
    Function called when the web_input action is stopped.
    It prints a status message indicating that it will no longer check for input.
    """
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Website input DISABLED. Checking for website_input.txt will NO LONGER be active.]")

async def process_input(user_input, system_functions):
    """
    Process user input for the web_input action.
    This action gets its input by polling a file, not from direct user console input.
    Therefore, this function does nothing and returns None, as the main work is done
    by check_web_input_file() which is called elsewhere in the application's main loop.
    """
    # This action doesn't modify user input, it just reads from website_input.txt in the main loop
    return None

# --- File I/O Functions ---

def check_web_input_file():
    """
    Checks if 'website_input.txt' exists, reads its content, and then deletes it.
    This is the "IN-BOX" for receiving messages from the web interface.
    """
    # Check if the input file from the website exists in the current directory.
    if os.path.exists("website_input.txt"):
        try:
            # Open the file for reading, ensuring UTF-8 encoding for special characters.
            with open("website_input.txt", "r", encoding="utf-8") as f:
                content = f.read().strip()  # Read content and remove leading/trailing whitespace.

            # Only proceed if the file actually contained some text.
            if content:
                print(f"[{ACTION_NAME.upper()} ACTION: Found content in website_input.txt]")
                # CRITICAL STEP: Remove the file after successfully reading it.
                # This prevents the same message from being processed repeatedly on the next check.
                try:
                    os.remove("website_input.txt")
                except:
                    # This is a fallback in case removal fails (e.g., file lock, permissions).
                    pass
                # Return the message to be processed by the main application.
                return content
        except Exception as e:
            # Log any errors that occur during file reading.
            print(f"[{ACTION_NAME.upper()} ACTION: ERROR reading website_input.txt: {e}]")

    # If the file doesn't exist or was empty, return None so the app knows there's no input.
    return None

def write_web_output(content):
    """
    Writes the AI's response to 'website_output.txt'.
    This is the "OUT-BOX" for sending messages to the web interface.
    """
    try:
        # Open the file in write mode ('w'), which creates the file or overwrites it if it exists.
        with open("website_output.txt", "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[{ACTION_NAME.upper()} ACTION: Wrote output to website_output.txt]")
        return True  # Return True to indicate success.
    except Exception as e:
        # Log any errors that occur during file writing.
        print(f"[{ACTION_NAME.upper()} ACTION: ERROR writing to website_output.txt: {e}]")
        return False  # Return False to indicate failure.