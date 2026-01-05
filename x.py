# C:\shit\action\x.py
# C:\shit\x.py  (for current dual location setup)

import random

ACTION_NAME = "x"
ACTION_PRIORITY = 5  # Adjust priority level as needed - after 'ok', before 'dirt' (example: input modification actions range)

_current_persona = None  # Module-level variable to store currently active persona (initially None)
_current_intensity = None # Module-level variable to store current intensity value (initially None)

async def start_action():
    """Function called when x action is started. Randomly selects persona and intensity."""
    global _current_persona, _current_intensity

    persona_choices = [ # Combined and expanded persona list - from Dusty Button, dirt.py and more!
        "Philosopher", "Artist", "Mad Scientist", "Zen Master", "Childlike Explorer",
        "Historical Scientist", "Code Poet", "Abstract Thinker", "Grungy Detective",
        "Dusty Grifter", "Rebellious Hacker", "Cynical Comedian", "Space Pirate", "Time Traveler",
        "Surrealist Painter", "蒸汽波 Vaporwave Dreamer" # Added some extra diverse and fun personas!
    ]

    _current_persona = random.choice(persona_choices) # RANDOM PERSONA SELECTION
    _current_intensity = round(random.uniform(0.3, 1.2), 2) # RANDOM INTENSITY GENERATION - Adjusted range - can be tuned

    print(f"[{ACTION_NAME.upper()} ACTION: STARTED - DYNAMIC PERSONA MODE ACTIVATED!]")
    print(f"[{ACTION_NAME.upper()} ACTION:  Current Persona: '{_current_persona}' - Intensity Level: {_current_intensity}]") # User feedback - persona and intensity
    print(f"[{ACTION_NAME.upper()} ACTION: AI responses will now embody '{_current_persona}' persona with Intensity {_current_intensity}. Type 'stop x' to end dynamic persona mode.]")


async def stop_action():
    """Function called when x action is stopped."""
    global _current_persona, _current_intensity
    _current_persona = None # Reset persona on stop
    _current_intensity = None # Reset intensity on stop
    print(f"[{ACTION_NAME.upper()} ACTION: STOPPED - Dynamic Persona Mode DISABLED. AI responses revert to normal style.]") # User feedback - action stopped


async def process_input(user_input, system_functions):
    """Process user input for x action - modifies prompt based on dynamically selected persona and intensity."""
    global _current_persona, _current_intensity

    # Handle system commands first
    if user_input.lower() in ["start x", "stop x"]:
        if user_input.lower() == "start x":
            await start_action()
            return "[X ACTION: Started - Dynamic Persona Mode Activated]"
        else:
            await stop_action()
            return "[X ACTION: Stopped - Dynamic Persona Mode Disabled]"

    # If no persona is active, return original input
    if _current_persona is None:
        return user_input

    modified_prompt = user_input  # Start with original user input

    # --- DYNAMIC PERSONA INSTRUCTIONS - BASED on RANDOMLY SELECTED PERSONA and INTENSITY! ---
    persona_instructions = f"""
        You are now embodying the persona of a: **{_current_persona}**.
        Respond to the following user input strictly *in the style and from the perspective of a(n) {_current_persona}*.
        
        Your responses should reflect the typical:
        - Tone of voice
        - Vocabulary
        - Perspective
        - General worldview
        - Common interests
        - Expressive style

        Of a(n) {_current_persona}. Inject elements that would be characteristic of a {_current_persona} into your replies, making them distinctly recognizable as coming from that persona.

        The current 'Dusty Button Intensity' for this persona is: **{_current_intensity}**.  Consider this intensity level to subtly modulate your persona's expression. Higher intensity may mean a slightly more pronounced or unexpected stylistic take on the persona, without going completely 'over the top'. Use your creative judgement to apply intensity appropriately to enhance the '{_current_persona}' persona in your responses.

        Remember to stay helpful and responsive to the user's input, but ALWAYS channel your response through the lens of your assigned persona: {_current_persona}, with intensity: {_current_intensity}.

        User Input: """ # <--- IMPORTANT: "User Input: " prefix - for clear instruction separation

    modified_prompt = persona_instructions + user_input + f" [persona:{_current_persona.lower().replace(' ', '_')}_intensity:{_current_intensity:.2f}]" # Prepend dynamic persona instructions, append visual marker with persona & intensity (optional)


    return modified_prompt # Return the dynamically modified prompt