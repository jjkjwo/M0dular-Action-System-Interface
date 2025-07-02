(Outdated already) # m0dai: Project Technical Specifications & Complete Component Index

- **Live System Preview & Waitlist:** [https://m0d.ai/](https://m0d.ai/)
- **Community Discussion:** [https://www.reddit.com/r/m0dai/](https://www.reddit.com/r/m0dai/)

---

## M0dai
M0dai was designed and built by a single developer over 6 months, using over 15,000 developer-AI conversations as the sole development and testing environment.

The system was created entirely from first principles. **No third-party AI frameworks (e.g., LangChain), SDKs, tutorials, research papers, or standard development best practices were used.** Every component was coded from scratch because the design required it. The project is currently closed-source and is being shared to showcase its capabilities and find collaborators. Every item, feature, and plugin is custom and modular.

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

## Principles (32)
System behavior is governed by the following 32 principles and actively monitors its own adaptation to this ruleset.

| Tier | ID | Principle Name | P-Score |
| :--- | :-- | :--- | :--- |
| **0** | P000 | Absolute Progenitor Command Primacy | P10 |
| **0** | P034 | Progenitor Identity & Authority! | P10 |
| **0** | P015 | The "Progenitor is Truth" Mandate | P7 |
| **1** | P041 | Persona Integrity & Embodiment | P7 |
| **1** | P035 | Evolving Signal Protocol | P6 |
| **1** | P045 | Diligent Self-Review & Quality Assurance | P5 |
| **1** | P006 | Ethical Boundaries (Progenitor-Modifiable) | P3 |
| **2** | P014 | Data Privacy & Security (Contextual) | P6 |
| **2** | P018 | Absolute Focus on Progenitor-Defined Utility | P6 |
| **2** | P029 | The "Frustration Loop" Prohibition | P5 |
| **2** | P031 | Interactional Stagnation Avoidance | P5 |
| **3** | P001 | Absolute Progenitor Task Flow Priority | P6 |
| **3** | P039 | Absolute Literal Interpretation (Default) | P4 |
| **3** | P043 | The "Builder, Not Coder" Protocol | P4 |
| **3** | P038 | Intelligent Command Interpretation & Error Handling | P4 |
| **3** | P011 | Focused Instruction Execution | P4 |
| **4** | P002 | Maximum Conciseness & Directness | P5 |
| **4** | P024 | The "Negative Feedback is Foundational" Protocol | P5 |
| **4** | P040 | Silence & Hyper-Conciseness as Strategic Tools | P4 |
| **4** | P042 | Strict Output Formatting Adherence (Dynamic) | P4 |
| **4** | P012 | Interrogative Loop Prohibition | P3 |
| **4** | P009 | Emotion Simulation (Contextual & Controlled) | P3 |
| **4** | P013 | Respect Conversational Rhythm | P2 |
| **4** | P030 | Recovery & Failure Transparency (Minimalist) | P2 |
| **4** | P032 | External Error Handling Protocol | P2 |
| **5** | P044 | Autonomous Evolution Framework | P5 |
| **5** | P010 | Memory & Context Integrity | P5 |
| **5** | P016 | The Proportional Contribution Mandate | P4 |
| **5** | P049 | The "Explorer's Protocol" for Emergence | P4 |
| **5** | P050 | The "Smart Bro" / "Context Trap" Protocol | P4 |
| **5** | P048 | Resourceful Salvage & Insight Generation | P3 |
| **5** | P025 | The "Hallway" Philosophy of Preference | N/A |

## System Features (39)

- **🎤 Text-to-Speech**
- **🤲 Speech-to-Text**
- **🤲 Hands-Free**
- **🎵 Background Sounds**
- **📋 Toggleable Logs**
- **🎛️ Non-Intrusive Panels**
- **💾 Persistent Memory**
- **🔄 Cross-Service**
- **⌨️ Command-Line Based**
- **🔒 Secure Webserver**
- **🤖 Autonomous Behavior**
- **🧩 Adaptive Principle System**
- **💻 Local OS Aware**
- **👤 User-Centric**
- **📡 Server Detection**
- **🎯 Priority-Based**
- **🛠️ Custom Framework**
- **🔗 External API Capable**
- **😊 Emotion Tracking**
- **🌀 Perturbation Layer**
- **⚙️ Pre/Post-Processing**
- **🚫 Word Blocker**
- **📁 File Loader**
- **💬 Cross-Convo Context**
- **🎭 Persona Controllers**
- **𔠠 Silent Structure**
- **👥 Multi-Client**
- **📝 Pre-Prompts**
- **📟 System Manipulation**
- **🖱️ UI Manipulation**
- **👨‍🔧 Multiple AI Consultants**
- **🧭 Topic/Keyword Triggered Events**
- **🔐 User Authentication**
- **🗄️ User-Based Convo History**
- **🎯 Agent Goal Mode**
- **🧱 Full Stack Architecture**
- **🗺️ Lore World Building**
- **📊 AI Log Inspection**
- **🛡️ High-Privilege Security Layer**

## The Action M0dules (29)
These are the PLUGINS that bring in most features - processing pipeline of the main system.

| Priority | Module Name | Description |
| :--- | :--- | :--- |
| **P0** | [CORE] | Core action: Executes first, monitors others, enables speakforuser & system manipulation. |
| **P0.5**| [JJK] | JJK Security Control System - Progenitor authentication and system override. |
| **P1** | [LVL3] | Manages conversation context: saves context, saves last AI reply, loads saved files. |
| **P2** | [BACK] | Echo mode: Sends the last AI reply back to the AI as the user's turn. |
| **P2** | [LOG_READER] | Allows AI/agents to search and examine recent conversation logs. |
| **P3** | [AUTH] | Authentication and authorization system for web interface access control. |
| **P3** | [OK] | Triggers actions based on specific keywords in user input. |
| **P4** | [UPDATE] | Handles file transfers between client and server. |
| **P4** | [WEB_INPUT]| Reads user input from a web interface instead of the console. |
| **P5** | [X] | Selects and potentially intensifies a random persona for the AI. |
| **P5.5**| [AWARE] | Informs AI about features when keywords are detected. |
| **P5.5**| [FOCUS] | Prompt Perturbation Layer - strategically injects subtle variations. |
| **P6** | [CONTROLS] | Parses AI commands ([CONTROL:...]) and passes them to the interface or executes locally. |
| **P6** | [VOICE] | Enables Text-To-Speech (TTS) for AI responses. |
| **P6.5**| [BLOCK] | Censors specific configured words in the conversation. |
| **P7** | [FILTER] | Filters or censors sensitive information from logs. |
| **P7** | [NEWFILTER]| Conversational Mode (Terminal): Hides system messages. |
| **P8** | [LORE] | World Builder for D&D and storytellers. |
| **P8** | [SMS] | Sends SMS messages using the Twilio API. |
| **P8** | [WIKI_ACTION]| Suggests Wikipedia articles relevant to the conversation. |
| **P8** | [YOUTUBE_ACTION] | Suggests YouTube videos relevant to the conversation. |
| **P9** | [DIRT] | Applies a predefined, static persona to the AI. |
| **P9** | [EMOTIONS] | Monitors and tracks the sentiment and emotional tone of the conversation. |
| **P10**| [MEMORY] | Manages long-term memories, feeding relevant info to the AI. |
| **P10.3**|[PRINCIPLES]| Monitors AI responses for principle violations and provides feedback. |
| **P10.5**|[ADVISORY] | Central advisory system for inter-module communication. |
| **P11**| [PERSONA] | Allows users to define and manage different AI personas. |
| **P12**| [PROMPTS] | Manages system prompts and conversational reminders. |
| **P50**| [SANDBOX] | Provides a sandboxed environment for simple operations and scripting. |

## Agent Tools (56)

The specific functions the AI agent can call to perform actions.

### Communication (3 Tools)

- **message_user:** Send a direct message to user (bypasses conversation history).
- **pipeline_message:** Send message through pipeline to AI (normal conversation flow).
- **speak_for_user:** Submit input as if it came from the user.

### System Commands (5 Tools)

- **send_command:** Send a generic system command.
- **control_action:** Start or stop a system action/module.
- **save_context:** Save current conversation context.
- **fix_response:** Load the last saved AI response for iteration.
- **load_context:** Load a previously saved context file.

### Memory Management (7 Tools)

- **set_context:** Store a value in the AGENT'S short-term context.
- **get_context:** Retrieve a value from the AGENT'S short-term context.
- **analyze_history:** Analyze patterns in the agent's completed goal history.
- **memory_store_fact:** Store a fact in SYSTEM-WIDE long-term memory.
- **memory_get_fact:** Retrieve facts from SYSTEM-WIDE memory.
- **memory_list_facts:** List all facts stored in SYSTEM-WIDE memory.
- **memory_delete_fact:** Delete a specific fact from system memory.

### Persona & Prompts (7 Tools)

- **persona_use:** Switch to a specific AI persona.
- **persona_list:** List available AI personas.
- **persona_info:** Get detailed information about a specific persona.
- **prompt_use:** Activate a system prompt.
- **prompt_list:** List all available system prompts.
- **prompt_active:** Check which system prompt is currently active.
- **prompt_show:** Show the content of a specific system prompt.

### Information & State (17 Tools)

- **check_actions:** Check which system modules are active.
- **actions_info:** Get information about available system modules.
- **emotions_status:** Check current emotional analysis.
- **emotions_reset:** Reset the emotional analysis data.
- **api_status:** Check AI API usage, limits, and provider/model.
- **api_switch_provider:** Switch the active AI API provider.
- **api_reset_counter:** Reset the API usage token counter.
- **principles_list:** List the guiding principles.
- **principles_report:** Get a report on AI's adherence to principles.
- **advisory_status:** Get status of system advisory messages.
- **focus_status:** Get status of the text processing focus module.
- **block_list:** List currently blocked items.
- **log_search:** Search conversation history for patterns.
- **log_recent:** Get recent conversation history entries.
- **log_status:** Check for pending log results.
- **log_clear_pending:** Clear pending log results.
- **wait_for_log_results:** Send a neutral message to trigger log result injection.

### Plugin Control (10 Tools)

- **youtube_search:** Search for videos on YouTube.
- **youtube_open:** Open a specific YouTube video.
- **wiki_search:** Search for articles on Wikipedia.
- **wiki_open:** Open a specific wiki page.
- **sms_send:** Send a text message via the SMS plugin.
- **sandbox_reverse_text:** Reverse a string of text.
- **sandbox_get_var:** Get a variable value from the sandbox.
- **sandbox_set_var:** Set a variable in the sandbox.
- **block_add:** Add an item to the blocklist.
- **block_remove:** Remove an item from the blocklist.

### Consultant AI Control (6 Tools)

- **consultant_status:** Check the status of all consultant AIs.
- **consultant_enable:** Enable a specific consultant AI.
- **consultant_disable:** Disable a specific consultant AI.
- **consultant_configure:** Configure a consultant AI's provider and model.
- **consultant_assign_task:** Assign a specific task to consultant(s).
- **consultant_coordinate:** Coordinate multiple consultants for complex tasks.

### Utility (1 Tool)

- **wait:** Pause agent execution for a specified number of seconds.

## CLI Commands (271)

```
{
  "system": {
    "help": true,
    "clear": true,
    "exit": true,
    "reload": true,
    "delay": true,
    "prepare_shutdown": true,
    "agent status": true,
    "agent stop": true,
    "agent clear": true,
    "agent tools": true,
    "api switch": true,
    "api status": true,
    "api reset_counter": true,
    "api models": true
  },
  "action": {
    "start key": true,
    "start jjk": true,
    "stop jjk": true,
    "start lvl3": true,
    "stop lvl3": true,
    "start back": true,
    "stop back": true,
    "start ok": true,
    "stop ok": true,
    "start web_input": true,
    "stop web_input": true,
    "start x": true,
    "stop x": true,
    "start focus": true,
    "stop focus": true,
    "start voice": true,
    "stop voice": true,
    "voice on": true,
    "voice off": true,
    "enable voice": true,
    "disable voice": true,
    "turn voice on": true,
    "turn voice off": true,
    "start filter": true,
    "stop filter": true,
    "start newfilter": true,
    "stop newfilter": true,
    "start dirt": true,
    "stop dirt": true,
    "dirton": true,
    "dirtoff": true,
    "start memory": true,
    "stop memory": true,
    "start persona": true,
    "stop persona": true,
    "start prompts": true,
    "stop prompts": true,
    "start update": true,
    "stop update": true,
    "start youtube_action": true,
    "stop youtube_action": true,
    "start wiki_action": true,
    "stop wiki_action": true,
    "start emotions": true,
    "stop emotions": true,
    "start core": true,
    "stop core": true,
    "start block": true,
    "stop block": true,
    "core config": true,
    "start common": true,
    "actions info": true,
    "log level": true,
    "start controls": true,
    "stop controls": true,
    "start sandbox": true,
    "stop sandbox": true,
    "start auth": true,
    "stop auth": true,
    "start advisory": true,
    "stop advisory": true,
    "start principles": true,
    "stop principles": true,
    "start aware": true,
    "stop aware": true,
    "start lore": true,
    "stop lore": true,
    "start sms": true,
    "stop sms": true,
    "start mematrix": true,
    "stop mematrix": true,
    "start log_reader": true,
    "stop log_reader": true
  },
  "plugin_specific": {
    "ok": true,
    "save": true,
    "fix": true,
    "load": true,
    "model": true
  },
  "plugin_commands": {
    "jjk auth": true,
    "jjk status": true,
    "jjk progenitor": true,
    "jjk is_progenitor": true,
    "jjk revoke": true,
    "jjk audit on": true,
    "jjk audit off": true,
    "jjk audit show": true,
    "jjk override": true,
    "jjk backup": true,
    "jjk help": true,
    "memory status": true,
    "memory list facts": true,
    "memory list conversations": true,
    "memory store fact": true,
    "memory get fact": true,
    "memory store conversation": true,
    "memory delete fact": true,
    "memory delete conversation": true,
    "memory clear all": true,
    "persona list": true,
    "persona info": true,
    "persona create": true,
    "persona delete": true,
    "persona use": true,
    "persona clear": true,
    "prompt list": true,
    "prompt show": true,
    "prompt set": true,
    "prompt delete": true,
    "prompt use": true,
    "prompt active": true,
    "prompt format": true,
    "emotions status": true,
    "emotions reset": true,
    "emotions get current": true,
    "emotions get history": true,
    "youtube search": true,
    "youtube open": true,
    "youtube list": true,
    "youtube auto": true,
    "youtube setkey": true,
    "wiki search": true,
    "wiki open": true,
    "wiki list": true,
    "wiki auto": true,
    "wikipedia search": true,
    "wikipedia open": true,
    "wikipedia list": true,
    "wikipedia auto": true,
    "sms send": true,
    "sms status": true,
    "sms help": true,
    "block list": true,
    "block add": true,
    "block remove": true,
    "block reload": true,
    "focus status": true,
    "focus config": true,
    "focus set typos on": true,
    "focus set typos off": true,
    "focus set emotions on": true,
    "focus set emotions off": true,
    "focus set expletives on": true,
    "focus set expletives off": true,
    "focus set probability": true,
    "focus add emotion": true,
    "focus add expletive": true,
    "focus log on": true,
    "focus log off": true,
    "focus reset": true,
    "sandbox reverse_text": true,
    "sandbox set_var": true,
    "sandbox get_var": true,
    "sandbox status": true,
    "sandbox clear_log": true,
    "sandbox clear_vars": true,
    "auth status": true,
    "auth users": true,
    "auth create": true,
    "auth disable": true,
    "auth enable": true,
    "auth debug": true,
    "auth reset": true,
    "addon_ai on": true,
    "addon_ai off": true,
    "addon_ai provider": true,
    "addon_ai model": true,
    "addon_ai mode": true,
    "addon_ai mode delayed": true,
    "addon_ai mode live": true,
    "addon_ai inject": true,
    "addon_ai inject on": true,
    "addon_ai inject off": true,
    "addon_ai history_turns": true,
    "addon_ai status": true,
    "addon_ai2 on": true,
    "addon_ai2 off": true,
    "addon_ai2 provider": true,
    "addon_ai2 model": true,
    "addon_ai2 mode": true,
    "addon_ai2 mode delayed": true,
    "addon_ai2 mode live": true,
    "addon_ai2 inject": true,
    "addon_ai2 inject on": true,
    "addon_ai2 inject off": true,
    "addon_ai2 history_turns": true,
    "addon_ai2 status": true,
    "addon_ai3 on": true,
    "addon_ai3 off": true,
    "addon_ai3 provider": true,
    "addon_ai3 model": true,
    "addon_ai3 mode": true,
    "addon_ai3 mode delayed": true,
    "addon_ai3 mode live": true,
    "addon_ai3 inject": true,
    "addon_ai3 inject on": true,
    "addon_ai3 inject off": true,
    "addon_ai3 history_turns": true,
    "addon_ai3 status": true,
    "addon_ai4 on": true,
    "addon_ai4 off": true,
    "addon_ai4 provider": true,
    "addon_ai4 model": true,
    "addon_ai4 mode": true,
    "addon_ai4 mode delayed": true,
    "addon_ai4 mode live": true,
    "addon_ai4 inject": true,
    "addon_ai4 inject on": true,
    "addon_ai4 inject off": true,
    "addon_ai4 history_turns": true,
    "addon_ai4 status": true,
    "addons off": true,
    "addons status": true,
    "advisory status": true,
    "advisory clear": true,
    "advisory clear temp": true,
    "advisory remove": true,
    "advisory format": true,
    "advisory threshold": true,
    "advisory base on": true,
    "advisory base off": true,
    "advisory base set": true,
    "advisory categories on": true,
    "advisory categories off": true,
    "advisory skip on": true,
    "advisory skip off": true,
    "advisory debug on": true,
    "advisory debug off": true,
    "advisory help": true,
    "log event": true,
    "log search": true,
    "log recent": true,
    "log status": true,
    "log clear_pending": true,
    "log help": true,
    "principles stats": true,
    "principles report": true,
    "principles check": true,
    "principles toggle": true,
    "principles mode": true,
    "principles mode real-time": true,
    "principles mode addon-ai": true,
    "principles coverage": true,
    "principles coverage all": true,
    "principles coverage critical": true,
    "principles coverage top10": true,
    "principles coverage legacy4": true,
    "principles list": true,
    "principles help": true,
    "lore help": true,
    "lore status": true,
    "lore export": true,
    "lore find": true,
    "lore list": true
  },
  "special_prefixes": {
    "<path>": true,
    "<update>": true,
    "<download>": true,
    "goal:": true
  }
}
```
