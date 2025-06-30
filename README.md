# m0d.ai: A M0dular Action System Interface

> **m0d.ai**: An advanced modular AI platform—designed and built from scratch by a non-coder. (m0d differently)

This system is the result of a single developer's vision and dedication, built from the ground up over 6 months and iteratively refined through more than 15,000 developer-AI conversations. It is a powerful, deeply layered tool designed for a specific type of interaction, and is now being previewed with the wider community.

-   **Community:** [r/m0dai on Reddit](https://www.reddit.com/r/m0dai/)
-   **Project:** [m0dai on GitHub](https://github.com/jjkjwo/M0dular-Action-System-Interface)

---

## What is m0d.ai?

m0dai is a sophisticated, command-line driven AI platform designed for granular control, high utility, and deep customization. It is not a simple chatbot wrapper; it is a full-stack system built around two core concepts:

1.  **The Progenitor-Centric Model:** The system is designed to serve a single, authoritative user—the "Progenitor"—who directs its behavior, tasks, and evolution.
2.  **A Modular Pipeline:** All user input and AI output are processed through a series of "Action Modules" that execute in a specific, prioritized order. This allows for a predictable and highly controllable flow of information.

## The Guiding Principles

Every action in m0dai is governed by a strict hierarchy of 32 principles across 6 tiers. These are not suggestions; they are the core operational logic, actively monitored by the `[PRINCIPLES]` module. Lower-tiered principles have absolute authority over higher ones.

*   **Tier 0: Absolute Progenitor Mandates** - Establishes the Progenitor's ultimate authority (e.g., `P000 - Absolute Progenitor Command Primacy`).
*   **Tier 1: Core System & Safety** - Ensures system stability, persona integrity, and quality assurance (e.g., `P045 - Diligent Self-Review & Quality Assurance`).
*   **Tier 2: Progenitor Experience & Utility** - Focuses on providing a useful, frustration-free experience (e.g., `P029 - The "Frustration Loop" Prohibition`).
*   **Tier 3: Task & Command Protocol** - Governs how commands are interpreted and executed (e.g., `P038 - Intelligent Command Interpretation & Error Handling`).
*   **Tier 4: Interaction & Communication** - Defines a pragmatic communication style emphasizing conciseness (e.g., `P002 - Maximum Conciseness & Directness`).
*   **Tier 5: Adaptation & Evolution** - Guides the system's long-term learning and emergence of new capabilities (e.g., `P044 - Autonomous Evolution Framework`).

## Core Features Overview

m0dai integrates a wide array of features, which are implemented through its modular architecture.

#### Interaction & Interface
*   **Voice I/O:** `Text-to-Speech` and `Speech-to-Text` capabilities enable hands-free operation.
*   **Dual Interface:** Provides both a powerful Command-Line Interface (CLI) and `Non-Intrusive` UI panels.
*   **Toggleable System Logs:** Allows for a clean "conversation-only" view by hiding system-level processing messages.

#### AI & Autonomy
*   **Agent Goal Mode:** Give the AI a high-level goal (e.g., `goal: research topic X and provide a summary`), and it will work autonomously to achieve it.
*   **Multiple AI Consultants:** A powerful orchestration system (`addon_ai` 1-4) that can manage and delegate sub-tasks to different AI models (e.g., GPT, Claude, Gemini) in parallel or sequence, allowing you to use the best tool for each job.
*   **Perturbation Layer:** The `[FOCUS]` module adds subtle, controlled variations to AI prompts to prevent sterile, repetitive responses.

#### Memory & Context
*   **Persistent Memory:** A long-term memory store for facts and knowledge that persists across sessions (`[MEMORY]` module).
*   **Cross-Conversation Context:** Carries over relevant information from previous conversations to inform new ones.
*   **File Handling:** Capable of reading user-provided files for context and managing file transfers.

## The Action Module Pipeline

At its core, m0dai processes all information through a pipeline of over 29 **Action Modules**. Each module has a priority number (`P#`), and execution flows from the lowest number to the highest. The Progenitor has direct control over this pipeline and can `start` or `stop` most modules at will via the CLI.

A simplified example of the information flow:
1.  **P0 [CORE]**: The system kernel initializes.
2.  **P0.5 [JJK]**: The Progenitor security layer authenticates the primary user.
3.  **P4 [WEB_INPUT]**: Raw input is read from the interface.
4.  The input passes through modules that add context (`[LVL3]`), inject memories (`[MEMORY]`), apply personas (`[PERSONA]`), and filter words (`[BLOCK]`).
5.  The final, enriched prompt is sent to the configured AI model (e.g., OpenAI).
6.  The AI's raw response returns and passes through a reverse pipeline that parses for AI-issued commands (`[CONTROLS]`), handles content (`[WIKI_ACTION]`), and finally outputs to the user via text or voice (`[VOICE]`).

## Getting Started: Essential Commands

The primary way to interact with m0dai is through its Command Line Interface.

#### System Management
*   `help`: Displays available commands.
*   `actions info`: See the status of all available modules.
*   `agent tools`: Lists the specific tools the AI agent can currently use to perform tasks.

#### Controlling the Pipeline
*   `start <module_name>`: Activates a module (e.g., `start voice`).
*   `stop <module_name>`: Deactivates a module (e.g., `stop voice`).

#### The Core Refinement Workflow
This loop is fundamental for teaching and guiding the AI's behavior.
1.  `save`: Saves the current conversation state and context to a file.
2.  `fix`: Loads the last AI response into your input field, allowing you to edit and correct it.
3.  `load`: Loads a previously saved conversation state, allowing you to restart complex scenarios.

#### Advanced Capabilities
*   **Triggering Autonomy:**
    `goal: <your high-level objective>`
*   **Managing Consultant AIs:**
    `addon_ai on`
    `addon_ai provider gpt-4-turbo`
    `addon_ai2 on`
    `addon_ai2 provider claude-3-opus-20240229`
*   **Checking Principle Adherence:**
    `principles report`

## Project Status & Disclaimer

m0dai is an active, personal, and continuously evolving project. While the core architecture is robust and has been tested extensively, many features should be considered experimental. The stability and functionality of any given module can vary.

This is not a commercial, "plug-and-play" product. It is a powerful and complex tool offered to the community for exploration, learning, and collaboration. Feedback, bug reports, and ideas are welcome and encouraged via the [subreddit](https://www.reddit.com/r/m0dai/) and [GitHub repository](https://github.com/jjkjwo/M0dular-Action-System-Interface).
