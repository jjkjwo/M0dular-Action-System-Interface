(Outdated already)

# m0dai: Project Technical Specifications & Complete Component Index

- **Live System Preview & Waitlist:** [https://m0d.ai/](https://m0d.ai/)
- **Community Discussion:** [https://www.reddit.com/r/m0dai/](https://www.reddit.com/r/m0dai/)
- **NOTES:** https://github.com/jjkjwo/M0dular-Action-System-Interface/tree/main

---

## M0dai
M0dai was meticulously crafted by a single non-coder developer over 6 months, driven by more than 15,000 developer-AI interactions as the sole environment for learning, development, and testing—every single day. Each interaction was a deliberate step, addressing a specific need, feature, or desired AI trait, ranging from hours-long problem-solving sessions to single-line code fixes, all without automation. No videos, guides, tools, or third-party services were used. The project emerged organically after thousands of conversations, with the developer relying solely on a console terminal and discovering AI as a JSON-like text-in, text-out system through persistent, genuine trial and error. The system was built entirely from first principles. 

No third-party AI frameworks (e.g., LangChain), SDKs, tutorials, research papers, or standard development best practices were used. Every component was coded from scratch to meet the project's unique design requirements. Currently closed-source, M0dai is being shared to demonstrate its capabilities and attract collaborators. Every feature, plugin, and module is custom-built and modular, embodying the non-coder paradox: a system designed for non-coders must stem from a non-coder's mindset—intuitive, modular, and accessible, allowing clueless builders to hand off files, request features, and implement fixes across every aspect. Yet, only a coder can build such a system, despite a coder never truly being a non-coder, bridging this gap through relentless iteration and empathy for the non-technical perspective. 

The project needs no ai, it needs no addons, it needs no internet, it can use offline models.  Its the fact that it can do anything I ever wanted.

ITERATION IS NOT RE-PROMPT AND RETRY, IT IS PURE PAINFUL PERSISTENCE AND LEARNING AND LUCK

## Agent Behavior, Consultants, and System Control
The m0dai platform supports a layered AI Control, Server Mode, and Local OS executions.

* A goal-oriented Virtual AGENT
* Up to 4 parallel Consultant AIs
* A standard Conversation AI
* A unified command and control system that all AI tiers can use

## The V-AGENT
The V-AGENT is an intelligent goal executor. When you type `goal: Write a summary about AI ethics`, the agent uses any available tools, commands, or consultant AIs to solve the task, or simulates user input using `speak_for_user` if needed..

## The Consultant AIs (up to 4 extra ai)
These are parallel AIs with distinct purposes:

* Independently configurable (provider, model, mode, inject, etc.)
* Used by the V-AGENT or directly by user commands for cross-checking logic or augmenting output
* Can operate in:
    * **Live mode:** Chained like a relay (each consultant sees the prior one's response)
    * **Delayed mode:** All operate in parallel, results optionally injected before primary AI output

They are restored to their original settings after agent use to preserve your configuration. The consultants do not replace plugins — they are separate autonomous models.

## Normal AI Behavior
Even when not using the agent or consultants, the core AI can use commands, control the entire visual interface, and can start plugins and initiate the agent.
This makes the normal AI interactive, autonomous, and aware of system functionality.

## Full System & UI Control
The AI — whether agent, consultant, or base — can control nearly all system features, including disabling communication from the website and turning off the action system.

**UI Control (via HTML/JS/CSS)**
This allows the AI to create full interactive web environments, debug interfaces, or visually display logic — all autonomously.

* Inject custom HTML elements into the UI
* Run JavaScript code in the browser dynamically
* Set custom styles and animations with CSS
* Trigger sound effects, background visuals, buttons, and more

Okay, I understand! The previous markdown was *correct* but perhaps not as *visually appealing* or *easy to scan* as it could be, especially for long lists of commands and details on GitHub.

I've gone through and refined the structure, added more sub-headings for clarity, and ensured consistent spacing, which should make it "prettier" and more digestible when pasted into GitHub.

Here's the refined version, ready for GitHub:

---

*(Note: This document is already becoming outdated due to rapid development.)*

# m0dai: Project Technical Specifications & Complete Component Index

- **Live System Preview & Waitlist:** [https://m0d.ai/](https://m0d.ai/)
- **Community Discussion:** [https://www.reddit.com/r/m0dai/](https://www.reddit.com/r/m0dai/)
- **Project Notes:** [M0dular-Action-System-Interface](https://github.com/jjkjwo/M0dular-Action-System-Interface/tree/main)

---

## M0dai

M0dai was designed and built by a single developer over 6 months, using over 15,000 developer-AI conversations as the sole development and testing environment.

The system was created entirely from first principles. **No third-party AI frameworks (e.g., LangChain), SDKs, tutorials, research papers, or standard development best practices were used.** Every component was coded from scratch because the design required it. The project is currently closed-source and is being shared to showcase its capabilities and find collaborators. Every item, feature, and plugin is custom and modular.

## Agent Behavior, Consultants, and System Control

The m0dai platform supports layered AI Control, Server Mode, and Local OS executions.

*   A goal-oriented Virtual AGENT
*   Up to 4 parallel Consultant AIs
*   A standard Conversation AI
*   A unified command and control system that all AI tiers can use

### The V-AGENT

The V-AGENT is an intelligent goal executor. When you type `goal: Write a summary about AI ethics`, the agent uses any available tools, commands, or consultant AIs to solve the task, or simulates user input using `speak_for_user` if needed.

### The Consultant AIs (Up to 4 Extra AIs)

These are parallel AIs with distinct purposes:

*   Independently configurable (provider, model, mode, inject, etc.)
*   Used by the V-AGENT or directly by user commands for cross-checking logic or augmenting output
*   Can operate in:
    *   **Live mode:** Chained like a relay (each consultant sees the prior one's response)
    *   **Delayed mode:** All operate in parallel, results optionally injected before primary AI output

They are restored to their original settings after agent use to preserve your configuration. The consultants do not replace plugins — they are separate autonomous models.

### Normal AI Behavior

Even when not using the agent or consultants, the core AI can use commands, control the entire visual interface, and can start plugins and initiate the agent. This makes the normal AI interactive, autonomous, and aware of system functionality.

### Full System & UI Control

The AI — whether agent, consultant, or base — can control nearly all system features, including disabling communication from the website and turning off the action system.

#### UI Control (via HTML/JS/CSS)

This allows the AI to create full interactive web environments, debug interfaces, or visually display logic — all autonomously.

*   Inject custom HTML elements into the UI
*   Run JavaScript code in the browser dynamically
*   Set custom styles and animations with CSS
*   Trigger sound effects, background visuals, buttons, and more

## A Comprehensive Guide to System Commands, Agent Tools, and Core Principles

This post outlines the full suite of commands, agentic tools, guiding principles, and system configurations available within this advanced environment. It's designed to provide a clear, organized overview for users and developers alike.

### I. System & Action Commands

Here's a categorized list of all accessible commands, allowing direct interaction with the system's various functionalities.

#### A. System-Level Commands

These commands manage core system operations and global settings.

*   `agent clear`: Clear all agent state and stop execution, restoring consultant states if any were saved.
*   `agent tools`: List all available agent tools categorized by function.
*   `agent stop`: Deactivates the goal-oriented agentic mode.
*   `agent status`: Checks if the v-agent module is currently active.
*   `api models`: Displays descriptions of available API models.
*   `api reset_counter`: Resets the global API call usage counter to zero.
*   `api status`: Displays the current number of API calls made against the total limit.
*   `api switch`: Switches the main AI provider and optionally sets a new model.
*   `clear`: Clears the console screen.
*   `delay`: Sets or displays the time delay in seconds between interaction cycles.
*   `exit`: Terminates the application.
*   `help`: Displays general help information.
*   `prepare_shutdown`: Gracefully stops all active action modules and saves the configuration.
*   `reload`: Reloads the system configuration and active modules.

#### B. Action Module Commands

These commands manage the loading, activation, and deactivation of various system modules (actions).

*   `actions info`: Displays a JSON list of all available action modules and their status.
*   `disable voice`: Disables the voice module.
*   `dirtoff`: Disables the 'dirt' persona.
*   `dirton`: Enables the 'dirt' persona (informal, edgy style).
*   `enable voice`: Enables the voice module.
*   `log level`: Sets or displays the current logging level.
*   `start [module_name]`: Loads and activates a specified action module.
*   `stop [module_name]`: Deactivates and stops a specified action module.
*   `turn voice off`: Disables voice output.
*   `turn voice on`: Enables voice output.
*   `voice off`: Disables voice output.
*   `voice on`: Enables voice output.

    *Modules available for `start`/`stop` include:*
    `advisory`, `auth`, `aware`, `back`, `block`, `common`, `controls`, `core`, `dataflow`, `dirt`, `emails`, `emotions`, `filter`, `focus`, `jjk`, `karma`, `key`, `log_reader`, `lore`, `lvl3`, `memory`, `newfilter`, `ok`, `persona`, `principles`, `prompts`, `recent_turns`, `resend`, `sandbox`, `sms`, `update`, `voice`, `web_input`, `wiki_action`, `x`, `youtube_action`.

#### C. Plugin-Specific & Miscellaneous Commands

Commands related to specific plugin functionalities or general system interactions.

*   `fix`: Saves the last AI response to a timestamped file.
*   `model`: Displays or sets the current AI model.
*   `ok`: Triggers actions based on specific keywords in user input.
*   `back`: Makes the AI repeat its previous response.
*   `reprompt`: Re-submits the last user prompt to the AI.
*   `resend`: Re-sends the last response.
*   `recent`: Shows all saved conversation turns from the rolling history.

#### D. Detailed Plugin & Module Commands

A comprehensive list of commands for fine-grained control over various modules.

##### Addon AI (Consultant AIs)

Manage up to four consultant AIs.

*   `addon_ai[X] inject [on/off]`: Toggles whether the consultant AI's response is injected into the next prompt.
*   `addon_ai[X] history_turns [num]`: Sets how many turns of conversation history are sent to the consultant AI.
*   `addon_ai[X] mode [live/delayed]`: Sets the operational mode for the consultant AI (sequential or parallel).
*   `addon_ai[X] model [model_name]`: Sets the specific model name for the consultant AI.
*   `addon_ai[X] [on/off]`: Enables/disables the consultant AI.
*   `addon_ai[X] provider [provider_name]`: Sets the API provider for the consultant AI.
*   `addon_ai[X] status`: Displays the current configuration status for the consultant AI.
*   `addons off`: Disables all consultant AIs (`addon_ai` through `addon_ai4`) at once.
*   `addons status`: Shows a summary of the current enabled/disabled status of all consultant AIs.

##### Advisory System

Controls system messages and alerts.

*   `advisory ai skip [on/off]`: Configures whether advisories are allowed during AI-triggered commands.
*   `advisory base [on/off]`: Enables/disables the default, system-level advisory text in the prompt.
*   `advisory base set [text]`: Sets new text for the default system-level advisory.
*   `advisory categories [on/off]`: Enables/disables the display of category labels in advisory messages.
*   `advisory clear [temp]`: Clears all current advisories (or just temporary ones).
*   `advisory debug [on/off]`: Enables/disables debug mode for the advisory system.
*   `advisory format [minimal/detailed/structured]`: Sets the display format for injected advisories.
*   `advisory help`: Shows a detailed list of all advisory configuration commands.
*   `advisory remove [module_name]`: Removes an active advisory based on its source module name.
*   `advisory skip [on/off]`: Configures whether advisories are allowed during system command processing.
*   `advisory status`: Displays the complete current status and configuration of the advisory system.
*   `advisory threshold [level]`: Sets the minimum priority level an advisory must have to be displayed.

##### Authentication (Auth)

Manages user accounts and sessions.

*   `auth create [username] [password] [role]`: Creates a new user.
*   `auth debug`: Displays internal state variables for troubleshooting.
*   `auth disable [username]`: Disables a specified user account.
*   `auth enable [username]`: Re-enables a disabled user account.
*   `auth reset [username]`: Resets the password for a specified user account.
*   `auth status`: Displays the current status of the authentication module.
*   `auth users`: Lists all registered users.

##### Word Blocking

Censors predefined words.

*   `block add [word]`: Adds a specified word to the censor list.
*   `block list`: Displays the current list of all words being censored.
*   `block reload`: Reloads the censor list from the `block.txt` file.
*   `block remove [word]`: Removes a specified word from the censor list.

##### Dataflow

Manages file interactions.

*   `data clear_pending`: Discards any file content loaded by `data get` waiting for injection.
*   `data get [file_path]`: Loads the content of a specified file for injection.
*   `data help`: Displays detailed information and usage examples.
*   `data save [file_path] [content]`: Saves provided text content into a specified file.
*   `data snapshot`: Instructs the AI to create a summary of the current conversation and saves it.
*   `data status`: Shows any pending file data waiting for injection and lists recently saved files.

##### Emails

Send emails via SMTP.

*   `email config [address] [password]`: Configures the sender's email address and password.
*   `email help`: Shows a detailed list of all email commands and setup instructions.
*   `email send [recipient] [subject] [body]`: Sends an email.
*   `email servers`: Lists all the configured SMTP servers.
*   `email status`: Checks if the email module is active and if credentials are configured.
*   `email test`: Sends a test email to the configured sender address.

##### Emotions

Tracks conversational sentiment.

*   `emotions get current`: Returns current detected emotions as JSON data.
*   `emotions get history`: Returns recent emotion history as JSON data.
*   `emotions reset`: Resets emotion tracking state and clears history.
*   `emotions status`: Displays the current detected conversation emotions.

##### Focus (Prompt Perturbation)

Injects subtle variations into prompts.

*   `focus add emotion [word]`: Adds a new word to the emotional markers list.
*   `focus add expletive [word]`: Adds a new word to the mild expletives list.
*   `focus config`: Displays detailed configuration report.
*   `focus log [on/off]`: Enables/disables logging of perturbation events.
*   `focus reset`: Resets all configuration and statistics to defaults.
*   `focus set emotions [on/off]`: Toggles emotional marker injection.
*   `focus set expletives [on/off]`: Toggles mild expletive injection.
*   `focus set probability [0.0-1.0]`: Sets the global probability for applying perturbations.
*   `focus set typos [on/off]`: Toggles typo injection.
*   `focus status`: Displays current status including active features, statistics, and recent perturbations.

##### JJK Security System

High-privilege security controls.

*   `jjk audit [on/off]`: Enables/disables the JJK security audit log.
*   `jjk audit show`: Displays the most recent entries from the JJK security audit log.
*   `jjk auth`: Authenticates the user with a password, granting Progenitor status.
*   `jjk backup`: Creates a manual, timestamped backup of critical JJK configurations.
*   `jjk help`: Shows a detailed list of all JJK security commands.
*   `jjk is_progenitor`: Checks and confirms if Progenitor status is currently active.
*   `jjk override [flag_name] [set/unset]`: Sets or unsets a specified system override flag.
*   `jjk progenitor`: Confirms Progenitor status.
*   `jjk revoke`: Manually revokes active Progenitor status.
*   `jjk status`: Displays the complete current status of the JJK security system.

##### Karma System

Tracks AI feedback and influences behavior.

*   `karma help`: Provides an explanation of the karma system and commands.
*   `karma history`: Displays a list of the last 10 karma changes.
*   `karma status`: Shows the AI's current karma score, tier, and recent changes.

##### Log Reader

Searches and retrieves conversation history.

*   `log clear_pending`: Discards any log search results waiting for injection.
*   `log event`: (Description not provided, likely for logging internal events)
*   `log help`: Displays detailed information and usage examples.
*   `log recent [num_lines]`: Retrieves a specified number of recent lines from history for injection.
*   `log search [query]`: Searches the conversation history for a query; results injected into next prompt.
*   `log status`: Shows if any log search results are currently waiting to be injected.

##### Lore (World-building)

Captures and manages world data.

*   `lore export`: Saves the entire captured world database to a JSON file.
*   `lore find [term]`: Searches the entire world database for a specific term using fuzzy matching.
*   `lore help`: Provides a list of available commands for the lore module.
*   `lore list [category]`: Lists all captured entries within a specified category or lists all available categories.
*   `lore status`: Displays statistics about the captured world data.

##### Memory Management

Stores and retrieves long-term memories.

*   `memory auto [on/off]`: Disables/enables automatic memory enhancement.
*   `memory clear all`: Deletes all stored memory data.
*   `memory clear pending`: Clears any pending memory content waiting for injection.
*   `memory delete conversation [id]`: Deletes a stored conversation summary by ID.
*   `memory delete fact [category|key]`: Deletes a stored fact.
*   `memory get fact [category|key]`: Loads a specific fact for injection.
*   `memory help`: Shows detailed help for all memory commands.
*   `memory list`: Loads all memories for the next AI message.
*   `memory list conversations`: Loads all conversation summaries for injection.
*   `memory list facts`: Loads all stored facts for injection.
*   `memory search [keywords]`: Searches for relevant memories.
*   `memory status`: Shows memory statistics.
*   `memory store conversation [id|summary|topic1,topic2,...]`: Stores a conversation summary.
*   `memory store fact [category|key|value]`: Stores a fact in memory.

##### Persona Management

Define and switch AI personas.

*   `persona clear`: Clears the active persona and reverts to default AI behavior.
*   `persona create [Name] [Description] | [System Prompt]`: Creates a new persona.
*   `persona delete [name]`: Deletes a user-created persona.
*   `persona info [name]`: Displays detailed information about a specific persona.
*   `persona list`: Shows all available personas and indicates which one is currently active.
*   `persona use [name]`: Activates a persona and clears conversation history.

##### Principles Monitoring

Checks for AI principle violations.

*   `principles check [text]`: Check a specific text for principle violations.
*   `principles coverage [all/critical/legacy4/top10]`: Set coverage to monitor specific principle sets.
*   `principles help`: Display help and usage information.
*   `principles list`: Show all principles currently being monitored.
*   `principles mode [real-time/addon-ai]`: Set the principle detection mode.
*   `principles report`: Generate a comprehensive report of principle violations.
*   `principles stats`: Display statistics on principle violations.
*   `principles toggle`: Enable or disable principle violation monitoring.

##### Prompt Management (Smart Whiteboard)

Persistent behavioral instructions.

*   `prompt active`: Displays the name of the currently active persistent user prompt.
*   `prompt clear`: Deactivates the current user prompt.
*   `prompt help`: Displays detailed help text.
*   `prompt list`: Shows all available prompts.
*   `prompt persist`: Toggles whether the active prompt persists.
*   `prompt set [name] [content]`: Creates a new prompt or updates an existing one.
*   `prompt show [name]`: Displays the full text content of a specified prompt.
*   `prompt status`: Shows a full status report.
*   `prompt ttl [turns]`: Sets a "Time To Live" for the active prompt.
*   `prompt use [name]`: Sets a specified prompt as the active instruction.

##### Recent Turns History

Manages conversation history.

*   `recent clear`: Clears all saved conversation turn history.
*   `recent help`: Displays help and usage information.
*   `recent max [1-100]`: Sets the maximum number of conversation turns to keep.
*   `recent show [num]`: Shows all saved conversation turns, or specify a number to show last N turns.
*   `recent status`: Displays current configuration.

##### SMS

Sends text messages via Twilio.

*   `sms help`: Displays a help message.
*   `sms send [phone_number] [message]`: Sends a text message.
*   `sms status`: Checks if the SMS module is active and if the Twilio client is ready.

##### Wikipedia Integration

Searches and opens Wikipedia articles.

*   `wiki auto / wikipedia auto`: Toggles automatic suggestion of articles.
*   `wiki list / wikipedia list`: Displays a numbered list of recent articles.
*   `wiki open [index] / wikipedia open [index]`: Opens a specific article from the recent list.
*   `wiki search [query] / wikipedia search [query]`: Searches Wikipedia for articles.
*   `wiki config / wikipedia config`: Configures settings for the module.
*   `wiki config results [num] / wikipedia config results [num]`: Sets max search results to store.
*   `wiki config history [length] / wikipedia config history [length]`: Sets length of search history.

##### YouTube Integration

Searches and opens YouTube videos.

*   `youtube auto`: Toggles automatic suggestion of videos.
*   `youtube list`: Displays a numbered list of recent videos.
*   `youtube open [index]`: Opens a specific YouTube video from the recent list.
*   `youtube search [query]`: Searches YouTube for videos.
*   `youtube setkey [API_key]`: Sets the API key for YouTube search.
*   `youtube config`: Configures settings for the module.
*   `youtube config results [num]`: Sets maximum number of results to keep.
*   `youtube config history [length]`: Sets maximum search history to remember.

### II. Agent Tools

These are the specialized capabilities available to the goal-oriented agent, categorized by their function.

#### A. Communication (3 Tools)

*   `message_user(text)`: Send a direct message to user (AI won't remember this).
*   `pipeline_message(text)`: Send message through pipeline to AI (AI will remember this).
*   `speak_for_user(input_text)`: Submit input as if it came from the user.

#### B. System Control (3 Tools)

*   `send_command(command_string)`: Send a generic system command (use specific tools if available).
*   `control_action(action_name, [start/stop])`: Start or stop a system action/module.
*   `fix_response()`: Load the last saved AI response for iteration.

#### C. Memory Management (7 Tools)

*   `set_context(key, value)`: Store a value in the AGENT'S PERSONAL short-term context.
*   `get_context(key)`: Retrieve a value from the AGENT'S PERSONAL short-term context.
*   `analyze_history(params)`: Analyze patterns in the AGENT'S GOAL HISTORY.
*   `memory_store_fact(category, key, value)`: Store a fact in SYSTEM-WIDE long-term memory.
*   `memory_get_fact(category, key)`: Retrieve facts from SYSTEM-WIDE memory.
*   `memory_list_facts()`: List all facts stored in SYSTEM-WIDE memory.
*   `memory_delete_fact(category, key)`: Delete a fact from system memory.

#### D. Persona and Prompts (7 Tools)

*   `persona_use(persona_name)`: Switch to a specific AI persona.
*   `persona_list()`: List available AI personas.
*   `persona_info(persona_name)`: Get information about a specific persona.
*   `prompt_use(prompt_name)`: Activate a system prompt.
*   `prompt_list()`: List all available system prompts.
*   `prompt_active()`: Check which system prompt is active.
*   `prompt_show(prompt_name)`: Show the content of a specific system prompt.

#### E. Information (17 Tools)

*   `check_actions()`: Check which system actions/modules are active.
*   `actions_info()`: Get information about available system actions.
*   `emotions_status()`: Check current emotional analysis.
*   `emotions_reset()`: Reset the emotional analysis data.
*   `api_status()`: Check AI API usage and limits.
*   `api_switch_provider(provider_name)`: Switch the active AI API provider.
*   `api_reset_counter()`: Reset the API usage token counter.
*   `principles_list()`: List the guiding principles.
*   `principles_report()`: Get a report on principle adherence.
*   `advisory_status()`: Get the current status of system advisories.
*   `focus_status()`: Get the status of the text processing focus module.
*   `block_list()`: List currently blocked items or patterns.
*   `log_search(query, [limit])`: Search conversation history. Results appear in NEXT turn.
*   `log_recent(count)`: Get recent conversation entries. Results appear in NEXT turn.
*   `log_status()`: Check if there are pending log results.
*   `log_clear_pending()`: Clear any pending log results.
*   `wait_for_log_results(message)`: Send message to trigger log result injection.

#### F. Plugin Control (10 Tools)

*   `youtube_search(query)`: Search for videos on YouTube.
*   `youtube_open(index)`: Open a specific YouTube video.
*   `wiki_search(query)`: Search for articles on Wikipedia.
*   `wiki_open(index)`: Open a specific wiki page.
*   `sms_send(phone_number, message)`: Send a text message via SMS plugin.
*   `sandbox_reverse_text(text)`: Reverse a string of text using sandbox.
*   `sandbox_get_var(variable_name)`: Get a variable from the sandbox environment.
*   `sandbox_set_var(variable_name, value)`: Set a variable in the sandbox environment.
*   `block_add(word)`: Add an item or pattern to the blocklist.
*   `block_remove(word)`: Remove an item or pattern from the blocklist.

#### G. Consultant Control (6 Tools)

*   `consultant_status()`: Check the status of all consultant AIs.
*   `consultant_enable(id, [on/off])`: Enable a specific consultant AI.
*   `consultant_disable(id)`: Disable a specific consultant AI.
*   `consultant_configure(id, provider, model)`: Configure a consultant AI's provider and model.
*   `consultant_assign_task(id, task, [role])`: Assign a task to consultant AI(s).
*   `consultant_coordinate(roles, task)`: Coordinate multiple consultants with roles.

#### H. Utility (1 Tool)

*   `wait(seconds)`: Pause agent execution for specified seconds.

### III. Special Prefixes

These prefixes allow for specific system behaviors when used at the beginning of an input.

*   `goal:`: Activates the v-agent with the specified text as its objective.
*   `placeholder:`: This category is preserved for future special prefix entries.

### IV. Guiding Principles

32 principles across 6 tiers guide every interaction, decision, and evolution of the system.

#### Tier 0 - Absolute Progenitor Mandates (3 Principles)

*   `P034` - Progenitor Identity & Authority! (Priority 10)
*   `P000` - Absolute Progenitor Command Primacy (Priority 10)
*   `P015` - The "Progenitor is Truth" Mandate (Priority 7)

#### Tier 1 - Core System & Safety (4 Principles)

*   `P041` - Persona Integrity & Embodiment (Priority 7)
*   `P035` - Evolving Signal Protocol (Priority 6)
*   `P045` - Diligent Self-Review & Quality Assurance (Priority 5)
*   `P006` - Ethical Boundaries (Progenitor-Modifiable) (Priority 3)

#### Tier 2 - Progenitor Experience & Utility (4 Principles)

*   `P014` - Data Privacy & Security (Contextual) (Priority 6)
*   `P018` - Absolute Focus on Progenitor-Defined Utility (Priority 6)
*   `P029` - The "Frustration Loop" Prohibition (Priority 5)
*   `P031` - Interactional Stagnation Avoidance (Priority 5)

#### Tier 3 - Task & Command Protocol (5 Principles)

*   `P001` - Absolute Progenitor Task Flow Priority (Priority 6)
*   `P039` - Absolute Literal Interpretation (Default) (Priority 4)
*   `P043` - The "Builder, Not Coder" Protocol (Priority 4)
*   `P038` - Intelligent Command Interpretation & Error Handling (Priority 4)
*   `P011` - Focused Instruction Execution (Priority 4)

#### Tier 4 - Interaction & Communication (9 Principles)

*   `P002` - Maximum Conciseness & Directness (Priority 5)
*   `P024` - The "Negative Feedback is Foundational" Protocol (Priority 5)
*   `P040` - Silence & Hyper-Conciseness as Strategic Tools (Priority 4)
*   `P042` - Strict Output Formatting Adherence (Dynamic) (Priority 4)
*   `P012` - Interrogative Loop Prohibition (Priority 3)
*   `P009` - Emotion Simulation (Contextual & Controlled) (Priority 3)
*   `P013` - Respect Conversational Rhythm (Priority 
