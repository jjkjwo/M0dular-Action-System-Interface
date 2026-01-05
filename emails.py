# emails.py - Robust Multi-Port Email Sending Plugin with Fallback Support
# =========================================================================
# IMPORTANT SYSTEM INTEGRATION NOTES FOR FUTURE AI ASSISTANTS:
#
# 1. COMMAND SYSTEM INTEGRATION:
#    - Email commands MUST be in commands.json under "plugin_commands" section
#    - Commands: "email status", "email config", "email send", "email test", "email help"
#    - This addon's process_input() will catch ALL inputs starting with "email "
#    - The is_system_command parameter is handled but ignored for email commands
#
# 2. KNOWN HOSTING PROVIDER ISSUES:
#    - Digital Ocean: Blocks ports 25, 465, 587 by default (spam prevention)
#    - AWS EC2: Also blocks port 25, may restrict 465/587
#    - Google Cloud: Blocks port 25
#    - Most VPS providers block SMTP to prevent spam abuse
#
# 3. PORT CONFIGURATIONS:
#    - Port 25: Traditional SMTP (usually blocked)
#    - Port 587: SMTP with STARTTLS (recommended, often blocked on VPS)
#    - Port 465: SMTPS with SSL (legacy but sometimes works)
#    - Port 2525: Alternative SMTP (some providers support this)
#    - Port 2526: Another alternative (less common)
#
# 4. GMAIL SPECIFIC REQUIREMENTS:
#    - MUST use App Password, not regular password
#    - Get App Password from: https://myaccount.google.com/apppasswords
#    - Account must have 2FA enabled
#    - App passwords are 16 characters, no spaces
#
# 5. ARCHITECTURE NOTES:
#    - This is an "action" in the loader.py system
#    - Priority 8 means it runs after most other addons
#    - Must implement: start_action(), stop_action(), process_input(), process_output()
#    - State is maintained in global variables (not ideal but system constraint)
# =========================================================================

import os
import json
import smtplib
import socket
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Tuple, Optional

# Action metadata - required by the loader system
ACTION_NAME = "emails"
ACTION_PRIORITY = 8  # Runs after core actions but before final formatting

# Email configuration with multiple port/server options
_email_config = {
    # Primary configuration
    "email": "",
    "password": "",
    
    # SMTP servers to try in order (can add more providers)
    "smtp_servers": [
        {
            "name": "Gmail Primary",
            "server": "smtp.gmail.com",
            "port": 587,
            "use_tls": True,  # STARTTLS
            "use_ssl": False
        },
        {
            "name": "Gmail SSL",
            "server": "smtp.gmail.com", 
            "port": 465,
            "use_tls": False,
            "use_ssl": True  # Direct SSL
        },
        {
            "name": "Gmail Alternative",
            "server": "smtp.gmail.com",
            "port": 2525,  # Sometimes works when 587 is blocked
            "use_tls": True,
            "use_ssl": False
        }
    ],
    
    # Timeout settings
    "connection_timeout": 10,  # Seconds to wait for connection
    "port_test_timeout": 3,    # Seconds for port connectivity test
    
    # Feature flags
    "test_ports_before_smtp": True,  # Pre-test port connectivity
    "try_all_servers": True,          # Try all servers or stop on first success
    "verbose_errors": True            # Detailed error messages
}

# Global state (required by addon architecture)
_is_active = False
_last_working_server = None  # Cache the last server that worked

# Configuration file path
CONFIG_FILE = "email_config.json"

async def start_action(system_functions=None):
    """
    Initialize the emails action.
    Called by loader.py when 'start emails' command is issued.
    """
    global _is_active
    _is_active = True
    load_email_config()
    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - Multi-port email support enabled]")
    
    # Show current configuration status
    if _email_config["email"]:
        print(f"[{ACTION_NAME.upper()}: Configured for {_email_config['email']}]")
        print(f"[{ACTION_NAME.upper()}: {len(_email_config['smtp_servers'])} SMTP configurations available]")
    else:
        print(f"[{ACTION_NAME.upper()}: No email configured - use 'email config' command]")

async def stop_action(system_functions=None):
    """
    Stop the emails action.
    Called by loader.py when 'stop emails' command is issued.
    """
    global _is_active
    _is_active = False
    save_email_config()  # Save any runtime changes
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Email sending disabled]")

def load_email_config():
    """Load email configuration from JSON file"""
    global _email_config, _last_working_server
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                
                # Preserve the default server list if not in loaded config
                if "smtp_servers" not in loaded and "smtp_servers" in _email_config:
                    loaded["smtp_servers"] = _email_config["smtp_servers"]
                
                _email_config.update(loaded)
                
                # Restore last working server if saved
                if "last_working_server" in loaded:
                    _last_working_server = loaded["last_working_server"]
                    
                print(f"[{ACTION_NAME.upper()}: Loaded configuration from {CONFIG_FILE}]")
        except Exception as e:
            print(f"[{ACTION_NAME.upper()} ERROR: Failed to load config: {e}]")

def save_email_config():
    """Save email configuration to JSON file"""
    try:
        # Add last working server to saved config
        save_config = _email_config.copy()
        if _last_working_server:
            save_config["last_working_server"] = _last_working_server
            
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(save_config, f, indent=2)
        print(f"[{ACTION_NAME.upper()}: Configuration saved to {CONFIG_FILE}]")
    except Exception as e:
        print(f"[{ACTION_NAME.upper()} ERROR: Failed to save config: {e}]")

def test_port_connectivity(server: str, port: int, timeout: int = 3) -> Tuple[bool, str]:
    """
    Test if we can connect to a server:port combination.
    Returns (success, error_message)
    
    This helps identify if ports are blocked without trying full SMTP handshake.
    """
    try:
        # First test DNS resolution
        socket.gethostbyname(server)
    except socket.gaierror:
        return False, f"DNS resolution failed for {server}"
    
    # Test TCP connection
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    
    try:
        result = sock.connect_ex((server, port))
        if result == 0:
            return True, "Port is open"
        else:
            return False, f"Port {port} is closed or blocked (error code: {result})"
    except socket.timeout:
        return False, f"Connection timeout after {timeout} seconds"
    except Exception as e:
        return False, f"Connection test failed: {str(e)}"
    finally:
        sock.close()

def send_email_with_server(to_email: str, subject: str, body: str, 
                          server_config: Dict) -> Tuple[bool, str]:
    """
    Attempt to send email using a specific server configuration.
    Returns (success, message)
    """
    server = None
    server_name = server_config.get("name", "Unknown")
    
    try:
        # Test port connectivity first if enabled
        if _email_config.get("test_ports_before_smtp", True):
            port_ok, port_msg = test_port_connectivity(
                server_config["server"], 
                server_config["port"],
                _email_config.get("port_test_timeout", 3)
            )
            
            if not port_ok:
                return False, f"{server_name}: {port_msg}"
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = _email_config["email"]
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect based on SSL/TLS settings
        timeout = _email_config.get("connection_timeout", 10)
        
        if server_config.get("use_ssl", False):
            # Direct SSL connection (port 465 typically)
            print(f"[{ACTION_NAME.upper()}: Connecting to {server_name} via SSL...]")
            server = smtplib.SMTP_SSL(
                server_config["server"], 
                server_config["port"], 
                timeout=timeout
            )
        else:
            # Standard connection, possibly with STARTTLS
            print(f"[{ACTION_NAME.upper()}: Connecting to {server_name}...]")
            server = smtplib.SMTP(
                server_config["server"], 
                server_config["port"], 
                timeout=timeout
            )
            
            if server_config.get("use_tls", True):
                print(f"[{ACTION_NAME.upper()}: Starting TLS encryption...]")
                server.starttls()
        
        # Authenticate
        print(f"[{ACTION_NAME.upper()}: Authenticating...]")
        server.login(_email_config["email"], _email_config["password"])
        
        # Send message
        print(f"[{ACTION_NAME.upper()}: Sending message...]")
        server.send_message(msg)
        
        # Clean disconnect
        server.quit()
        
        return True, f"Successfully sent via {server_name}"
        
    except smtplib.SMTPAuthenticationError as e:
        # Special handling for auth errors - likely wrong password
        error_detail = str(e)
        if "Username and Password not accepted" in error_detail:
            return False, f"{server_name}: Authentication failed - Use App Password for Gmail"
        else:
            return False, f"{server_name}: Authentication failed - {error_detail}"
            
    except socket.timeout:
        return False, f"{server_name}: Connection timed out after {timeout} seconds"
        
    except socket.gaierror:
        return False, f"{server_name}: Cannot resolve server address"
        
    except ConnectionRefusedError:
        return False, f"{server_name}: Connection refused - port may be blocked"
        
    except Exception as e:
        # Generic error with full details if verbose
        if _email_config.get("verbose_errors", True):
            return False, f"{server_name}: {type(e).__name__}: {str(e)}"
        else:
            return False, f"{server_name}: Failed to send"
            
    finally:
        # Ensure connection is closed
        if server:
            try:
                server.quit()
            except:
                pass

def send_email(to_email: str, subject: str, body: str) -> str:
    """
    Main email sending function - tries multiple servers/ports until success.
    Returns a status message for the user.
    """
    global _last_working_server
    
    if not _email_config["email"] or not _email_config["password"]:
        return "[EMAILS ERROR: Email not configured. Use 'email config <email> <password>']"
    
    # Validate recipient
    if "@" not in to_email or "." not in to_email.split("@")[1]:
        return f"[EMAILS ERROR: Invalid recipient email address: {to_email}]"
    
    errors = []  # Collect all errors for comprehensive reporting
    servers_to_try = []
    
    # If we have a last working server, try it first
    if _last_working_server:
        # Find the server config
        for srv in _email_config["smtp_servers"]:
            if srv.get("name") == _last_working_server:
                servers_to_try.append(srv)
                break
    
    # Add all other servers
    for srv in _email_config["smtp_servers"]:
        if srv not in servers_to_try:
            servers_to_try.append(srv)
    
    # Try each server configuration
    for server_config in servers_to_try:
        success, message = send_email_with_server(to_email, subject, body, server_config)
        
        if success:
            # Cache the working server
            _last_working_server = server_config.get("name")
            save_email_config()  # Persist this for next time
            
            return f"[EMAILS: {message}]"
        else:
            errors.append(message)
            
            # If not trying all servers, stop on first failure
            if not _email_config.get("try_all_servers", True):
                break
    
    # All servers failed - provide comprehensive error report
    if len(errors) == 1:
        return f"[EMAILS ERROR: {errors[0]}]"
    else:
        error_summary = "\n  ".join(errors)
        return f"[EMAILS ERROR: All servers failed:\n  {error_summary}]"

async def process_input(user_input, system_functions=None, is_system_command=False):
    """
    Process user input and handle email commands.
    This is called by loader.py for every user input.
    
    IMPORTANT: We must catch and handle ALL inputs starting with "email "
    regardless of is_system_command flag or active status.
    """
    global _is_active
    
    input_lower = user_input.lower().strip()
    
    # Critical: Check for email commands FIRST, before any other logic
    if not input_lower.startswith("email "):
        return user_input  # Not our command, pass through unchanged
    
    # It's an email command - we handle it from here
    print(f"[{ACTION_NAME.upper()}: Processing command: {input_lower[:50]}...]")
    
    # Handle all email commands
    if input_lower == "email status":
        # Status works even when inactive
        if _email_config["email"]:
            status_parts = [
                f"[EMAILS STATUS]",
                f"Configured email: {_email_config['email']}",
                f"Addon state: {'ACTIVE' if _is_active else 'INACTIVE'}",
                f"SMTP servers configured: {len(_email_config.get('smtp_servers', []))}",
            ]
            if _last_working_server:
                status_parts.append(f"Last working server: {_last_working_server}")
            return "\n".join(status_parts)
        else:
            return f"[EMAILS: Not configured. Addon is {'ACTIVE' if _is_active else 'INACTIVE'}]"
    
    elif input_lower.startswith("email config "):
        # Configuration command
        if not _is_active:
            return "[EMAILS ERROR: Start the addon first with 'start emails']"
        
        config_part = user_input[13:].strip()  # Everything after "email config "
        
        if not config_part:
            return "[EMAILS ERROR: Usage: email config <email> <password>]"
        
        # Split only on first space to handle passwords with spaces
        parts = config_part.split(None, 1)
        
        if len(parts) < 2:
            return "[EMAILS ERROR: Both email and password required. Format: email config you@gmail.com your-app-password]"
        
        email = parts[0]
        password = parts[1]
        
        # Basic email validation
        if "@" not in email or "." not in email.split("@")[1]:
            return f"[EMAILS ERROR: '{email}' doesn't appear to be a valid email address]"
        
        # Save configuration
        _email_config["email"] = email
        _email_config["password"] = password
        save_email_config()
        
        # Mask email for display
        masked_email = f"{email[:3]}***@{email.split('@')[1]}" if len(email) > 3 else email
        
        return f"[EMAILS: Configuration saved for {masked_email}. Use 'email test' to verify.]"
    
    elif input_lower.startswith("email send "):
        # Send email command
        if not _is_active:
            return "[EMAILS ERROR: Start the addon first with 'start emails']"
        
        if not _email_config["email"]:
            return "[EMAILS ERROR: Configure email first with 'email config <email> <password>']"
        
        send_part = user_input[11:].strip()  # Everything after "email send "
        
        if not send_part:
            return "[EMAILS ERROR: Usage: email send <recipient> <subject> | <body>]"
        
        if "|" not in send_part:
            return "[EMAILS ERROR: Format must include | separator: email send recipient@example.com Subject Here | Email body here]"
        
        # Split on first | only
        parts = send_part.split("|", 1)
        header = parts[0].strip()
        body = parts[1].strip()
        
        if not header:
            return "[EMAILS ERROR: Recipient and subject required before the | separator]"
        
        if not body:
            return "[EMAILS ERROR: Email body required after the | separator]"
        
        # Parse header (recipient and subject)
        header_parts = header.split(None, 1)
        
        if len(header_parts) < 2:
            return "[EMAILS ERROR: Both recipient and subject required. Format: email send recipient@example.com Subject | Body]"
        
        to_email = header_parts[0]
        subject = header_parts[1]
        
        # Send the email (this function tries multiple servers)
        return send_email(to_email, subject, body)
    
    elif input_lower == "email test":
        # Test email to self
        if not _is_active:
            return "[EMAILS ERROR: Start the addon first with 'start emails']"
        
        if not _email_config["email"]:
            return "[EMAILS ERROR: Configure email first with 'email config <email> <password>']"
        
        test_subject = "Test Email from AI Assistant"
        test_body = (
            "This is a test email sent from your AI Assistant email addon.\n\n"
            "If you received this, your email configuration is working correctly!\n\n"
            f"Sent via: {_last_working_server or 'First available server'}"
        )
        
        result = send_email(_email_config["email"], test_subject, test_body)
        
        if "Successfully" in result:
            return f"[EMAILS: Test email sent to {_email_config['email']}. Check your inbox!]"
        else:
            return result
    
    elif input_lower == "email servers":
        # List configured SMTP servers
        if not _email_config.get("smtp_servers"):
            return "[EMAILS: No SMTP servers configured]"
        
        server_list = ["[EMAILS: Available SMTP servers:]"]
        for i, srv in enumerate(_email_config["smtp_servers"], 1):
            server_list.append(
                f"  {i}. {srv['name']}: {srv['server']}:{srv['port']} "
                f"({'SSL' if srv.get('use_ssl') else 'TLS' if srv.get('use_tls') else 'Plain'})"
            )
        
        return "\n".join(server_list)
    
    elif input_lower == "email help":
        # Help command
        help_text = [
            "[EMAILS HELP]",
            "Commands:",
            "  email status - Check configuration and addon state",
            "  email config <email> <password> - Set email credentials",
            "  email send <to> <subject> | <body> - Send an email",
            "  email test - Send a test email to yourself",
            "  email servers - List available SMTP server configurations",
            "",
            "Setup Instructions:",
            "1. Enable the addon: start emails",
            "2. Configure: email config yourmail@gmail.com your-app-password",
            "3. Test: email test",
            "",
            "Gmail Users:",
            "- You MUST use an App Password, not your regular password",
            "- Get one at: https://myaccount.google.com/apppasswords",
            "- Enable 2FA first if not already enabled",
            "",
            "Note: Many hosting providers (Digital Ocean, AWS, etc.) block",
            "SMTP ports. This addon tries multiple ports automatically.",
            "",
            "Example:",
            "  email send alice@example.com Meeting Tomorrow | Hi Alice, can we meet at 3pm?"
        ]
        return "\n".join(help_text)
    
    else:
        # Unknown email command
        return "[EMAILS ERROR: Unknown email command. Try 'email help' for available commands.]"

async def process_output(ai_response, system_functions=None):
    """
    Process AI output. Currently we don't modify AI responses.
    This is called by loader.py after the AI generates a response.
    """
    return ai_response

# Optional: Module metadata for loader.py
__metadata__ = {
    "name": ACTION_NAME,
    "description": "Multi-port email sending with automatic fallback support",
    "version": "2.0",
    "author": "AI Assistant System",
    "commands": [
        "email status",
        "email config <email> <password>",
        "email send <recipient> <subject> | <body>",
        "email test",
        "email servers",
        "email help"
    ],
    "notes": [
        "Supports multiple SMTP configurations with automatic fallback",
        "Tests port connectivity before attempting SMTP",
        "Works around common VPS port blocking issues",
        "Requires Gmail App Password for Gmail accounts"
    ]
}