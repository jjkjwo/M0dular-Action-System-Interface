# sms.py - Twilio SMS Integration Action
# Allows the system to send SMS messages via commands.

import os
import asyncio
import re
from typing import Tuple

# Try to import Twilio, will be handled gracefully in start_action if missing.
try:
    from twilio.rest import Client
    TWILIO_INSTALLED = True
except ImportError:
    TWILIO_INSTALLED = False

ACTION_NAME = "sms"
ACTION_PRIORITY = 8  # A reasonable priority for an external communication tool

# =======================
# --- CONFIGURATION ---
# =======================
# WARNING: Per your request, credentials are hardcoded for now.
# For production, it is STRONGLY recommended to move these to a secure
# configuration file (e.g., sms_config.json) or environment variables.

TWILIO_SID = "placeholder"
TWILIO_TOKEN = "placeholder"
TWILIO_FROM_NUMBER = "+PLACEHOLDER"

# --- Other hardcoded API key (not used in this SMS module, logged for reference) ---
# OTHER_API_KEY = "placeholder"
# OTHER_API_SECRET = "placeholder"

# =======================
# --- MODULE STATE ---
# =======================
_is_active = False
_twilio_client: 'Client' = None  # Type hint for the client object

# =======================
# --- LIFECYCLE FUNCTIONS ---
# =======================

async def start_action(system_functions=None):
    """Initializes the SMS Action and the Twilio client."""
    global _is_active, _twilio_client

    if not TWILIO_INSTALLED:
        print("[SMS ACTION: ERROR - Twilio library not found. Please run 'pip install twilio'. Action disabled.]")
        _is_active = False
        return

    try:
        _twilio_client = Client(TWILIO_SID, TWILIO_TOKEN)
        # The line below would throw an exception if credentials are bad, which is good for testing.
        _twilio_client.api.accounts(TWILIO_SID).fetch()
        _is_active = True
        print("[SMS ACTION: STARTED - Twilio client initialized and credentials validated. Ready to send SMS.]")
    except Exception as e:
        print(f"[SMS ACTION: FAILED to start. Twilio client could not be initialized. Error: {e}")
        print("[SMS ACTION: Please check your Account SID and Auth Token. Action will remain disabled.]")
        _twilio_client = None
        _is_active = False

async def stop_action(system_functions=None):
    """Stops the SMS Action."""
    global _is_active, _twilio_client
    _is_active = False
    _twilio_client = None
    print("[SMS ACTION: STOPPED - SMS functionality disabled.]")

# =======================
# --- CORE LOGIC ---
# =======================

async def _send_sms_message(to_number: str, message: str) -> Tuple[bool, str]:
    """
    Internal function to send an SMS message. Runs the synchronous Twilio call
    in a separate thread to avoid blocking the asyncio event loop.

    Returns:
        A tuple of (success, result_string).
        On success, result_string is the message SID.
        On failure, result_string is the error message.
    """
    if not _twilio_client:
        return False, "Twilio client is not initialized."

    try:
        # The Twilio library is synchronous, so we run it in a thread
        # to prevent it from blocking our async application.
        sent_message = await asyncio.to_thread(
            _twilio_client.messages.create,
            to=to_number,
            from_=TWILIO_FROM_NUMBER,
            body=message
        )
        return True, sent_message.sid
    except Exception as e:
        # Twilio errors are often very descriptive
        error_message = str(e)
        print(f"[SMS ACTION: ERROR sending message to {to_number}: {error_message}]")
        return False, error_message

# =======================
# --- PIPELINE FUNCTIONS ---
# =======================

async def process_input(user_input: str, system_functions=None) -> str:
    """
    Processes user input to handle SMS commands. This function ensures that
    only SMS-related commands are acted upon, and other inputs are passed through
    the pipeline unmodified.

    It returns a string message for the user, which prevents the command
    from being sent to the AI.
    """
    if not _is_active:
        return user_input # Pass through if the action is not active

    # For safety, operate on a stripped, lowercased version for command matching
    input_lower = user_input.strip().lower()

    # --- Command: sms status ---
    if input_lower == "sms status":
        if _twilio_client:
            return f"[SMS: System is ACTIVE. Client initialized and ready to send from {TWILIO_FROM_NUMBER}.]"
        else:
            return f"[SMS: System is INACTIVE. Twilio client failed to initialize. Check credentials/logs.]"

    # --- Command: sms help ---
    if input_lower == "sms help":
        help_text = (
            "[SMS Help]\n"
            "  - `sms send <number> <message>`: Send an SMS. The number must be in E.164 format (e.g., +15551234567).\n"
            "  - `sms status`: Check if the SMS action is active and the client is initialized.\n"
            "  - `sms help`: Shows this help message."
        )
        return help_text

    # --- Command: sms send <number> <message> ---
    # Using regex for robust parsing of the number and message.
    send_match = re.match(r'^sms\s+send\s+(\+\d{10,15})\s+(.*)', user_input, re.IGNORECASE | re.DOTALL)
    if send_match:
        to_number = send_match.group(1)
        message_to_send = send_match.group(2)

        if not message_to_send:
            return "[SMS: FAILED. Message content cannot be empty.]"

        print(f"[SMS ACTION: Attempting to send message to {to_number}...")
        success, result = await _send_sms_message(to_number, message_to_send)

        if success:
            # Command was successful, return a success message to the user.
            # This will NOT be sent to the AI.
            print(f"[SMS ACTION: Message sent successfully. SID: {result}]")
            return f"[SMS: Message successfully sent to {to_number}. SID: {result}]"
        else:
            # Command failed, return an error message to the user.
            return f"[SMS: FAILED to send message to {to_number}. Error: {result}]"

    # If no specific SMS commands match, pass the original input through for other actions to process.
    return user_input

# Note: process_output is not needed for this action as it does not modify the AI's response.
async def process_output(ai_response: str, system_functions=None) -> str:
    """This action does not modify AI output."""
    return ai_response