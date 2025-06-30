# m0dai: Project Technical Specifications & Complete Component Index

- **Live System Preview & Waitlist:** [https://m0d.ai/](https://m0d.ai/)
- **Community Discussion:** [https://www.reddit.com/r/m0dai/](https://www.reddit.com/r/m0dai/)

---

## 1. Project Philosophy & Development Context

This document is a technical specification for m0dai, a modular AI platform. It was designed and built by a single developer over 6 months, using over 15,000 developer-AI conversations as the sole development and testing environment.

The system was created entirely from first principles. **No third-party AI frameworks (e.g., LangChain), SDKs, tutorials, research papers, or standard development best practices were used.** Every component was coded from scratch because the design required it. The project is currently closed-source and is being shared to showcase its capabilities and find collaborators.

## 1A. Agent Behavior, Consultants, and System Control
The m0dai platform supports a layered AI control architecture centered on:

* A goal-oriented V-AGENT
* Up to 4 parallel Consultant AIs (addon_ai1–4)
* A main Conversation AI (standard AI model)
* A unified command and control system that all AI tiers can use

### 🧠 The V-AGENT
The V-AGENT is an intelligent goal executor. When you type `goal: Write a summary about AI ethics`, the agent:

1. Decomposes the goal into substeps using private prompts
2. Uses any available tools, commands, or consultant AIs to solve the task
3. Simulates user input using `speak_for_user` if needed
4. Controls plugins (called “Actions”) by issuing `start <module>` or `stop <module>` commands
5. Temporarily modifies system state (e.g., personas, prompts, memory) and restores it after the goal is complete

The agent can use every system feature the user can — and more — with a command suite that includes file management, state toggling, emotion resets, log searches, web UI control, etc.

### 👥 The Consultant AIs (addon_ai1–4)
These are parallel AIs with distinct purposes:

* Independently configurable (provider, model, mode, inject, etc.)
* Used by the V-AGENT or directly by user commands for cross-checking logic or augmenting output
* Can operate in:
    * **Live mode:** Chained like a relay (each consultant sees the prior one’s response)
    * **Delayed mode:** All operate in parallel, results optionally injected before primary AI output

They are restored to their original settings after agent use to preserve your configuration. The consultants do not replace plugins — they are separate autonomous models.

### 💬 Normal AI Behavior (Primary AI Model)
Even when not using the agent or consultants, the core AI can:

* Accept raw user input and respond as usual
* Use commands (e.g., `start memory`, `dirton`, `voice off`) if a response ends with one
* Trigger the loopback system, which lets the AI send another reply without user input
* Simulate user input via the `speakforuser` mechanism — where the next user turn is auto-filled by AI intent
* Suggest or activate plugin modules based on context (e.g., loading a YouTube module when a video is referenced)

This makes the AI interactive, autonomous, and aware of system functionality.

### 🕹️ Full System & UI Control
The AI — whether agent, consultant, or base — can control nearly all system features:

**✅ Core Controls:**
* `start`, `stop`, or `status` of any Action module
* Switch memory modes, prompts, and personas
* Send file commands (`save`, `load`, `fix`)
* Inspect logs, block content, manipulate emotional state

**🧠 Behavior + Memory:**
* Alter its own behavior by setting `principles`
* Adjust emotional tone or persona stack
* Store and recall system-wide facts or personal context

**🌐 UI Control (via HTML/JS/CSS):**
* Inject custom HTML elements into the UI
* Run JavaScript code in the browser dynamically
* Set custom styles and animations with CSS
* Trigger sound effects, background visuals, buttons, and more

This allows the AI to create full interactive web environments, debug interfaces, or visually display logic — all autonomously.

## 2. The 32 Guiding Principles (Complete List)

System behavior is governed by the following 32 principles, structured in a 6-tier hierarchy. Lower-numbered tiers have absolute authority. The system actively monitors its own adherence to this ruleset.

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

## 3. The 39 System Features (Complete List)

These are the high-level capabilities of the m0dai platform.

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

## 4. The 29 Action Modules (Complete List)

The processing pipeline of the system. Modules execute in order of priority (`P#`).

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

## 5. The 56 Agent Tools (Complete List)

The specific functions the AI agent can call to perform actions.

<details>
<summary><strong>Communication (3 Tools)</strong></summary>

- **message_user:** Send a direct message to user (bypasses conversation history).
- **pipeline_message:** Send message through pipeline to AI (normal conversation flow).
- **speak_for_user:** Submit input as if it came from the user.
</details>

<details>
<summary><strong>System Commands (5 Tools)</strong></summary>

- **send_command:** Send a generic system command.
- **control_action:** Start or stop a system action/module.
- **save_context:** Save current conversation context.
- **fix_response:** Load the last saved AI response for iteration.
- **load_context:** Load a previously saved context file.
</details>

<details>
<summary><strong>Memory Management (7 Tools)</strong></summary>

- **set_context:** Store a value in the AGENT'S short-term context.
- **get_context:** Retrieve a value from the AGENT'S short-term context.
- **analyze_history:** Analyze patterns in the agent's completed goal history.
- **memory_store_fact:** Store a fact in SYSTEM-WIDE long-term memory.
- **memory_get_fact:** Retrieve facts from SYSTEM-WIDE memory.
- **memory_list_facts:** List all facts stored in SYSTEM-WIDE memory.
- **memory_delete_fact:** Delete a specific fact from system memory.
</details>

<details>
<summary><strong>Persona & Prompts (7 Tools)</strong></summary>

- **persona_use:** Switch to a specific AI persona.
- **persona_list:** List available AI personas.
- **persona_info:** Get detailed information about a specific persona.
- **prompt_use:** Activate a system prompt.
- **prompt_list:** List all available system prompts.
- **prompt_active:** Check which system prompt is currently active.
- **prompt_show:** Show the content of a specific system prompt.
</details>

<details>
<summary><strong>Information & State (17 Tools)</strong></summary>

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
</details>

<details>
<summary><strong>Plugin Control (10 Tools)</strong></summary>

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
</details>

<details>
<summary><strong>Consultant AI Control (6 Tools)</strong></summary>

- **consultant_status:** Check the status of all consultant AIs.
- **consultant_enable:** Enable a specific consultant AI.
- **consultant_disable:** Disable a specific consultant AI.
- **consultant_configure:** Configure a consultant AI's provider and model.
- **consultant_assign_task:** Assign a specific task to consultant(s).
- **consultant_coordinate:** Coordinate multiple consultants for complex tasks.
</details>

<details>
<summary><strong>Utility (1 Tool)</strong></summary>

- **wait:** Pause agent execution for a specified number of seconds.
</details>

## 6. The 271 CLI Commands (Categorized Index)

This is the complete list of commands available to the Progenitor for direct system manipulation.

<details>
<summary><strong>📌 System (13 Commands)</strong></summary>

`help` `clear` `exit` `reload` `delay` `prepare_shutdown` `agent status` `agent stop` `agent clear` `agent tools` `api switch` `api status` `api reset_counter` `api models`
</details>

<details>
<summary><strong>📌 Action Module Control (59 Commands)</strong></summary>

`start key` `start jjk` `stop jjk` `start lvl3` `stop lvl3` `start back` `stop back` `start ok` `stop ok` `start web_input` `stop web_input` `start x` `stop x` `start focus` `stop focus` `start voice` `stop voice` `voice on` `voice off` `enable voice` `disable voice` `turn voice on` `turn voice off` `start filter` `stop filter` `start newfilter` `stop newfilter` `start dirt` `stop dirt` `dirton` `dirtoff` `start memory` `stop memory` `start persona` `stop persona` `start prompts` `stop prompts` `start update` `stop update` `start youtube_action` `stop youtube_action` `start wiki_action` `stop wiki_action` `start emotions` `stop emotions` `start core` `stop core` `start block` `stop block` `core config` `start common` `actions info` `log level` `start controls` `stop controls` `start sandbox` `stop sandbox` `start auth` `stop auth` `start advisory` `stop advisory` `start principles` `stop principles` `start aware` `stop aware` `start lore` `stop lore` `start sms` `stop sms` `start mematrix` `stop mematrix` `start log_reader` `stop log_reader`
</details>

<details>
<summary><strong>📌 Plugin-Specific Shortcuts (5 Commands)</strong></summary>

`ok` `save` `fix` `load` `model`
</details>

<details>
<summary><strong>📌 Comprehensive Plugin Commands (189 Commands)</strong></summary>

-   **JJK (Security):** `jjk auth` `jjk status` `jjk progenitor` `jjk is_progenitor` `jjk revoke` `jjk audit on` `jjk audit off` `jjk audit show` `jjk override` `jjk backup` `jjk help`
-   **Memory:** `memory status` `memory list facts` `memory list conversations` `memory store fact` `memory get fact` `memory store conversation` `memory delete fact` `memory delete conversation` `memory clear all`
-   **Persona:** `persona list` `persona info` `persona create` `persona delete` `persona use` `persona clear`
-   **Prompts:** `prompt list` `prompt show` `prompt set` `prompt delete` `prompt use` `prompt active` `prompt format`
-   **Emotions:** `emotions status` `emotions reset` `emotions get current` `emotions get history`
-   **YouTube:** `youtube search` `youtube open` `youtube list` `youtube auto` `youtube setkey`
-   **Wiki:** `wiki search` `wiki open` `wiki list` `wiki auto` `wikipedia search` `wikipedia open` `wikipedia list` `wikipedia auto`
-   **SMS:** `sms send` `sms status` `sms help`
-   **Blocklist:** `block list` `block add` `block remove` `block reload`
-   **Focus (Perturbation):** `focus status` `focus config` `focus set typos on` `focus set typos off` `focus set emotions on` `focus set emotions off` `focus set expletives on` `focus set expletives off` `focus set probability` `focus add emotion` `focus add expletive` `focus log on` `focus log off` `focus reset`
-   **Sandbox:** `sandbox reverse_text` `sandbox set_var` `sandbox get_var` `sandbox status` `sandbox clear_log` `sandbox clear_vars`
-   **Auth:** `auth status` `auth users` `auth create` `auth disable` `auth enable` `auth debug` `auth reset`
-   **Consultant AI (`addon_ai` 1-4):**
    -   *Per addon:* `on` `off` `provider` `model` `mode` `mode delayed` `mode live` `inject` `inject on` `inject off` `history_turns` `status`
    -   *Global:* `addons off` `addons status`
-   **Advisory System:** `advisory status` `advisory clear` `advisory clear temp` `advisory remove` `advisory format` `advisory threshold` `advisory base on` `advisory base off` `advisory base set` `advisory categories on` `advisory categories off` `advisory skip on` `advisory skip off` `advisory debug on` `advisory debug off` `advisory help`
-   **Logging:** `log event` `log search` `log recent` `log status` `log clear_pending` `log help`
-   **Principles:** `principles stats` `principles report` `principles check` `principles toggle` `principles mode` `principles mode real-time` `principles mode addon-ai` `principles coverage` `principles coverage all` `principles coverage critical` `principles coverage top10` `principles coverage legacy4` `principles list` `principles help`
-   **Lore:** `lore help` `lore status` `lore export` `lore find` `lore list`
</details>

<details>
<summary><strong>📌 Special Input Prefixes (4 Commands)</strong></summary>

-   **`<path>`:** Provide a file path for loading.
-   **`<update>` / `<download>`:** Prefixes to trigger file transfers.
-   **`goal:`:** The prefix for assigning an autonomous objective to the agent.
</details>
