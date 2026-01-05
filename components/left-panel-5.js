/**
 * ==============================================================================================
 * Left Panel 5 - Idea Incubator
 * ==============================================================================================
 *
 * Displays a list of potential addon ideas for review and tracking.
 * Data is currently hardcoded based on generated pitches.
 *
 * @version 1.0.0
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-5',

        // DOM references
        dom: {
            content: null,
            ideaListContainer: null
        },

        // --- Addon Ideas Data (Pitches 1-22) ---
        // This data comes directly from our previous conversation
        ideas: [
             // Pitch 1 - Narrative Weaver
            { title: "Narrative Weaver", description: "AI actively *narrates* the ongoing interaction, framing it as a story, log, debate etc., based on user choice or triggered events. Output to a separate file/endpoint." },
            // Pitch 2 - Contextual Ambient Soundscape
            { title: "Contextual Ambient Soundscape", description: "Dynamically generates and plays ambient background sounds based on the *semantic content* of the current conversation using keywords identified by AI." },
             // Pitch 3 - Live Chat Translator & Idiomizer
            { title: "Live Chat Translator & Idiomizer", description: "Translates messages on-the-fly *but* also injects culturally relevant idioms, slang, or politeness levels appropriate for the target language/region." },
             // Pitch 4 - Dream Recorder (Memory Extension)
            { title: "Dream Recorder", description: "Stores conversation snippets tagged with abstract, AI-generated dream-like symbols or moods. Retrieval is via related symbols, not keywords." },
            // Pitch 5 - Argument Reframer
            { title: "Argument Reframer", description: "If conversation gets contentious (sentiment analysis), AI reframes the last statement from a different perspective (mediator, devil's advocate) and presents it." },
             // Pitch 6 - Prompt Injection Sandbox
            { title: "Prompt Injection Sandbox", description: "Developer tool to directly inject instructions into the *next* AI prompt prefix, bypassing normal processing for live testing." },
             // Pitch 7 - Generative UI Theme
            { title: "Generative UI Theme", description: "User describes a theme ('cyberpunk neon'), AI generates corresponding CSS variables (colors, fonts?) which are then applied dynamically." },
            // Pitch 8 - Action Sequencer
            { title: "Action Sequencer", description: "Allows users to define named sequences of commands/actions (with delays) to be executed by a single trigger command." },
            // Pitch 9 - Chat Emotion Visualizer
            { title: "Chat Emotion Visualizer", description: "Uses sentiment analysis to display a dynamically changing background gradient or particle effect in the chat window reflecting the conversation's mood." },
             // Pitch 10 - Command Autocompleter & Aliaser
            { title: "Command Autocompleter & Aliaser", description: "Provides intelligent autocompletion for known commands in the input area and allows defining short aliases for longer commands." },
            // Pitch 11 - Emergent Lore Keeper
            { title: "Emergent Lore Keeper", description: "Silently identifies potential named entities, prompts AI to generate brief 'lore' entries, creating an organically growing conversation-specific knowledge base." },
            // Pitch 12 - Conversational Time-Brancher
            { title: "Conversational Time-Brancher", description: "Allows bookmarking conversation points and later 'branching' from them, sending a new message as a reply to that earlier point, creating parallel timelines." },
            // Pitch 13 - AI Debate Arena
            { title: "AI Debate Arena", description: "User defines topic/stances. Addon initializes two separate AI instances/contexts to debate each other, moderated by the addon." },
            // Pitch 14 - User Input Scrambler
            { title: "User Input Scrambler", description: "Intentionally disrupts user input with configurable effects (noun swap, synonym madness, tangent injection) before sending to AI for creative exploration." },
            // Pitch 15 - Affective Particle System
            { title: "Affective Particle System", description: "Generates a visual particle system overlay (dust, embers, shapes) driven by sentiment *and* complexity/novelty analysis of the conversation." },
            // Pitch 16 - Sentient UI
            { title: "Sentient UI", description: "UI elements gain subtle personality; panel titles, button text, toasts might occasionally change based on context or randomness." },
            // Pitch 17 - Polyglot Parallelizer
            { title: "Polyglot Parallelizer", description: "Sends user input translated into multiple languages to the AI in parallel, displaying all language responses side-by-side to explore language effects." },
            // Pitch 18 - External Hardware Bridge (Conceptual)
            { title: "External Hardware Bridge", description: "Allows framework (if run locally) to interact with external hardware (Arduino via serial) based on chat commands or AI output." },
            // Pitch 19 - Story Arc Visualizer
            { title: "Story Arc Visualizer", description: "Analyzes conversation history to identify narrative phases/topic shifts, plotting them on a timeline or arc diagram." },
            // Pitch 20 - Action Marketplace (Meta Addon)
            { title: "Action Marketplace", description: "Browse descriptions of addons, rate them, use AI to draft code skeletons for new addon ideas based on user descriptions." },
             // Pitch 21 - Structured Output for UI
            { title: "Structured Output for UI", description: "AI generates highly dense, parseable output in a custom format (tokenize-like language) that the frontend translates into complex UI elements, overcoming standard text output limits per turn." },
             // Pitch 22 - Top-Level Pseudo-Code Generator
            { title: "Top-Level Pseudo-Code Generator", description: "Translates high-level user ideas/concepts described in natural language into top-level software design skeletons or pseudo-code outlines." },
        ],

        /**
         * Initialize the component
         */
        initialize: function() {
            // Cache DOM references
            this.dom.content = document.getElementById(`${this.id}-content`);

            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }

            // Render the panel content
            this.renderContent();

             // Add styles
             this.addStyles();

            console.log(`[${this.id}] Initialized.`);
        },

        /**
         * Render component content
         */
        renderContent: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear previous content

            // Create main container
            const container = document.createElement('div');
            container.className = 'idea-incubator-panel'; // Specific class

            // Create list container
            const listContainer = document.createElement('div');
            listContainer.className = 'idea-list';
            this.dom.ideaListContainer = listContainer;

            // Populate list
            if (this.ideas && this.ideas.length > 0) {
                this.ideas.forEach((idea, index) => {
                    const ideaItem = document.createElement('div');
                    ideaItem.className = 'idea-item';

                    const title = document.createElement('h4');
                    title.className = 'idea-title';
                    // Include the original pitch number for reference
                    title.textContent = `Pitch #${index + 1}: ${idea.title}`;

                    const description = document.createElement('p');
                    description.className = 'idea-description';
                    description.textContent = idea.description;

                    // --- Placeholder for Future Features ---
                     const controls = document.createElement('div');
                     controls.className = 'idea-controls';
                     // Example: Add status/notes later
                     // controls.innerHTML = `
                     //  <select class="idea-status"><option>Idea</option><option>Planning</option><option>WIP</option><option>Done</option></select>
                     //  <textarea class="idea-notes" placeholder="Add notes..."></textarea>
                     // `;
                     controls.style.marginTop = '8px';
                     controls.style.paddingTop = '8px';
                     controls.style.borderTop = '1px dashed #eee'; // Separator
                     controls.innerHTML = `<small style='color:#888;'><em>(Status/Notes/Actions coming soon)</em></small>`; // Placeholder text
                    // --- End Placeholder ---

                    ideaItem.appendChild(title);
                    ideaItem.appendChild(description);
                    ideaItem.appendChild(controls); // Add controls placeholder
                    listContainer.appendChild(ideaItem);
                });
            } else {
                listContainer.innerHTML = '<p>No ideas loaded.</p>';
            }

            container.appendChild(listContainer);
            this.dom.content.appendChild(container);
        },

         /**
         * Add component-specific styles
         */
         addStyles: function() {
             const styleId = `${this.id}-styles`;
             if (document.getElementById(styleId)) return; // Prevent duplicate styles

             const style = document.createElement('style');
             style.id = styleId;
             style.textContent = `
                 .idea-incubator-panel {
                     padding: 10px;
                     height: 100%; /* Allow filling the panel */
                     display: flex;
                     flex-direction: column;
                 }
                 .idea-list {
                     overflow-y: auto; /* Make the list scrollable */
                     flex-grow: 1; /* Allow list to take available space */
                     padding-right: 5px; /* Space for scrollbar */
                 }
                 .idea-item {
                     margin-bottom: 15px;
                     padding-bottom: 10px;
                     border-bottom: 1px solid #e0e0e0;
                 }
                 .idea-item:last-child {
                     margin-bottom: 0;
                     border-bottom: none;
                 }
                 .idea-title {
                     font-size: 1.1em;
                     color: var(--color-primary, #4a76a8);
                     margin-top: 0;
                     margin-bottom: 5px;
                 }
                 .idea-description {
                     font-size: 0.95em;
                     color: var(--color-text, #333);
                     margin: 0;
                     line-height: 1.4;
                 }
                /* Styles for future controls (placeholders) */
                .idea-controls { }
                .idea-status { font-size: 0.9em; margin-bottom: 5px; display: block; }
                .idea-notes { width: 100%; font-size: 0.9em; height: 40px; border: 1px solid #ddd; border-radius: 3px; padding: 4px; box-sizing: border-box; resize: vertical;}

             `;
             document.head.appendChild(style);
         },

        /**
         * Clean up component resources
         */
        cleanup: function() {
             const styleElement = document.getElementById(`${this.id}-styles`);
             if (styleElement) styleElement.remove();
             if (this.dom.content) this.dom.content.innerHTML = '';
             this.dom = {}; // Clear DOM refs
             console.log(`[${this.id}] Cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);

})();