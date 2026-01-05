/**
 * ==============================================================================================
 * Left Panel 2 - Enhanced AI Self-Prompting Loop Instructions Component
 * ==============================================================================================
 * 
 * This panel provides a comprehensive guide for creating AI self-prompting loops.
 * Features a step-by-step interface with real-time plugin status monitoring,
 * visualizations, and interactive examples.
 * 
 * @version 3.0.0 - Complete visual redesign, improved status monitoring, interactive elements
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-2',
        
        // DOM references
        dom: {
            content: null,
            noteElement: null,
            instructionsContainer: null,
            pluginStatusElements: {},
            copyButtons: {},
            exampleSection: null,
            visualizationElement: null,
            interactiveElements: {}
        },
        
        // Component state
        state: {
            okActive: false,
            backActive: false,
            subscriptions: [],
            intervals: [],
            examples: {
                basicPrompt: `I'd like to explore a self-referential loop using AI. In each response, you'll include a "Next Prompt" section at the end with instructions for your next response. When I respond with "ok" (no punctuation), please follow the instructions from your previous "Next Prompt" section. Always end with "ok" (lowercase, no punctuation) to continue the loop. Let's begin exploring this creative technique!`,
                advancedPrompt: `Let's create an AI self-instructing loop in which the AI guides its own conversation by adding a "NEXT PROMPT" section at the end of each message. When I reply with just "ok" (no punctuation), the AI will interpret its previous NEXT PROMPT section as instructions for its next response. The AI should:
1. Respond normally to my initial question/prompt
2. End EVERY response with a "NEXT PROMPT: [instructions]" section
3. Make each NEXT PROMPT creative and lead toward interesting content
4. Always end messages with "ok" (no punctuation) after the NEXT PROMPT
5. When receiving "ok" as input, follow the prior NEXT PROMPT instructions

Initial topic: Describe an unusual animal adaptation and why it evolved.`,
                creativityPrompt: `I'd like you to create a story that evolves over time through a self-instructing loop. For each response:
1. Continue the story based on your previous instructions
2. Include interesting characters, setting details, and plot development
3. End with "NEXT PROMPT:" that gives specific instructions for the next part of the story
4. Always finish with "ok" (no punctuation) as the final word

The story should start with a character discovering a mysterious object in an unexpected place. As the loop progresses, gradually reveal the object's significance and powers. Begin now with your first story segment, next prompt, and "ok".`
            },
            statusCheckInterval: 3000 // Check plugin status every 3 seconds
        },
        
        /**
         * Initialize the component
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }
            
            // Create UI structure
            this.renderContent();
            
            // Subscribe to active actions changes to detect plugins
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updatePluginStates(data.actions);
            });
            
            // Store subscription for cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });
            
            // Initial plugin state check
            this.checkInitialPluginStates();
            
            // Set up regular plugin status checking
            this.setupStatusChecker();
            
            console.log(`[${this.id}] Component initialized successfully.`);
        },
        
        /**
         * Check initial state of required plugins
         */
        checkInitialPluginStates: function() {
            fetch(CONFIG.api.activeActions)
                .then(response => response.json())
                .then(data => {
                    if (data && data.actions) {
                        this.updatePluginStates(data.actions);
                    }
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial plugin states:`, error);
                });
        },
        
        /**
         * Set up regular plugin status checking
         */
        setupStatusChecker: function() {
            // Clear any existing interval
            if (this.state.statusCheckInterval) {
                this.state.intervals.forEach(interval => clearInterval(interval));
                this.state.intervals = [];
            }
            
            // Set up new interval
            const intervalId = setInterval(() => {
                fetch(CONFIG.api.activeActions)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.actions) {
                            this.updatePluginStates(data.actions);
                        }
                    })
                    .catch(error => {
                        console.error(`[${this.id}] Error checking plugin states:`, error);
                    });
            }, this.state.statusCheckInterval);
            
            this.state.intervals.push(intervalId);
        },
        
        /**
         * Update plugin states based on active actions
         */
        updatePluginStates: function(actions = []) {
            // Check for 'ok' plugin
            const isOkActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'ok';
            });
            
            // Check for 'back' plugin
            const isBackActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'back';
            });
            
            // Update state only if changes detected
            let stateChanged = false;
            
            if (this.state.okActive !== isOkActive) {
                this.state.okActive = isOkActive;
                stateChanged = true;
            }
            
            if (this.state.backActive !== isBackActive) {
                this.state.backActive = isBackActive;
                stateChanged = true;
            }
            
            // Update UI only if state changed
            if (stateChanged) {
                this.updateUIBasedOnPlugins();
            }
            
            // Always update status indicators
            this.updateStatusIndicators();
        },
        
        /**
         * Update UI based on plugin states
         */
        updateUIBasedOnPlugins: function() {
            const allPluginsActive = this.state.okActive && this.state.backActive;
            const anyPluginActive = this.state.okActive || this.state.backActive;
            
            // Update note visibility
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = anyPluginActive ? 'none' : 'block';
            }
            
            // Update instructions container visibility
            if (this.dom.instructionsContainer) {
                this.dom.instructionsContainer.style.display = anyPluginActive ? 'block' : 'none';
            }
            
            // Update example section visibility
            if (this.dom.exampleSection) {
                this.dom.exampleSection.style.display = allPluginsActive ? 'block' : 'none';
            }
            
            // Update visualization element
            if (this.dom.visualizationElement) {
                if (allPluginsActive) {
                    this.dom.visualizationElement.classList.add('fully-active');
                } else {
                    this.dom.visualizationElement.classList.remove('fully-active');
                }
            }
            
            // Update recommended actions message
            this.updateRecommendedActionsMessage();
        },
        
        /**
         * Update status indicators for plugins
         */
        updateStatusIndicators: function() {
            // Update ok plugin status
            if (this.dom.pluginStatusElements.ok) {
                const okStatus = this.dom.pluginStatusElements.ok;
                
                if (this.state.okActive) {
                    okStatus.textContent = 'Active';
                    okStatus.className = 'plugin-status-indicator active';
                } else {
                    okStatus.textContent = 'Inactive';
                    okStatus.className = 'plugin-status-indicator inactive';
                }
            }
            
            // Update back plugin status
            if (this.dom.pluginStatusElements.back) {
                const backStatus = this.dom.pluginStatusElements.back;
                
                if (this.state.backActive) {
                    backStatus.textContent = 'Active';
                    backStatus.className = 'plugin-status-indicator active';
                } else {
                    backStatus.textContent = 'Inactive';
                    backStatus.className = 'plugin-status-indicator inactive';
                }
            }
            
            // Update overall ready status
            if (this.dom.pluginStatusElements.ready) {
                const readyStatus = this.dom.pluginStatusElements.ready;
                const allReady = this.state.okActive && this.state.backActive;
                
                if (allReady) {
                    readyStatus.textContent = 'System Ready';
                    readyStatus.className = 'ready-indicator active';
                } else {
                    readyStatus.textContent = 'System Not Ready';
                    readyStatus.className = 'ready-indicator inactive';
                }
            }
        },
        
        /**
         * Update recommended actions message
         */
        updateRecommendedActionsMessage: function() {
            const actionsElement = this.dom.interactiveElements.recommendedActions;
            if (!actionsElement) return;
            
            if (!this.state.okActive && !this.state.backActive) {
                actionsElement.innerHTML = `
                    <div class="action-item">
                        <span class="action-label">Start both required plugins:</span>
                        <button class="action-button" data-command="start ok">Start OK</button>
                        <button class="action-button" data-command="start back">Start Back</button>
                    </div>
                `;
            } else if (!this.state.okActive && this.state.backActive) {
                actionsElement.innerHTML = `
                    <div class="action-item">
                        <span class="action-label">Start missing plugin:</span>
                        <button class="action-button" data-command="start ok">Start OK</button>
                    </div>
                `;
            } else if (this.state.okActive && !this.state.backActive) {
                actionsElement.innerHTML = `
                    <div class="action-item">
                        <span class="action-label">Start missing plugin:</span>
                        <button class="action-button" data-command="start back">Start Back</button>
                    </div>
                `;
            } else {
                actionsElement.innerHTML = `
                    <div class="action-item success">
                        <span class="action-label">Both plugins are active and ready!</span>
                        <button class="action-button copy-button" data-example="basicPrompt">Copy Basic Prompt</button>
                    </div>
                `;
            }
            
            // Add event listeners to new buttons
            actionsElement.querySelectorAll('.action-button').forEach(button => {
                if (button.dataset.command) {
                    button.addEventListener('click', () => {
                        this.executeCommand(button.dataset.command);
                    });
                } else if (button.dataset.example) {
                    button.addEventListener('click', () => {
                        this.copyExampleToClipboard(button.dataset.example);
                    });
                }
            });
        },
        
        /**
         * Render component content
         */
        renderContent: function() {
            if (!this.dom.content) return;
            
            // Create main container
            const container = document.createElement('div');
            container.className = 'loopback-panel';
            
            // Create warning note for required plugins
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note';
            noteElement.innerHTML = `
                <div class="note-icon">⚠️</div>
                <div class="note-title">Plugins Required</div>
                <div class="note-content">
                    <p>This feature requires both the <strong>OK</strong> and <strong>Back</strong> plugins.</p>
                    <div class="note-actions">
                        <button class="note-button" data-command="start ok">Start OK Plugin</button>
                        <button class="note-button" data-command="start back">Start Back Plugin</button>
                    </div>
                </div>
            `;
            
            // Add event listeners to buttons
            noteElement.querySelectorAll('.note-button').forEach(button => {
                button.addEventListener('click', () => {
                    this.executeCommand(button.dataset.command);
                });
            });
            
            this.dom.noteElement = noteElement;
            container.appendChild(noteElement);
            
            // Create instructions container
            const instructionsContainer = document.createElement('div');
            instructionsContainer.className = 'instructions-container';
            instructionsContainer.style.display = (this.state.okActive || this.state.backActive) ? 'block' : 'none';
            
            // Add title and description
            const titleSection = document.createElement('div');
            titleSection.className = 'section-title-container';
            
            const title = document.createElement('h3');
            title.className = 'instructions-title';
            title.textContent = 'AI Self-Prompting Loops';
            
            const description = document.createElement('div');
            description.className = 'instructions-description';
            description.innerHTML = `
                <p>Create dynamic conversations where the AI directs its own responses through a continuous loop. This technique enables creative explorations, storytelling, and complex reasoning processes.</p>
            `;
            
            titleSection.appendChild(title);
            titleSection.appendChild(description);
            instructionsContainer.appendChild(titleSection);
            
            // Add system status section
            instructionsContainer.appendChild(this.createStatusSection());
            
            // Add visual explanation section
            instructionsContainer.appendChild(this.createVisualExplanationSection());
            
            // Add step-by-step guide section
            instructionsContainer.appendChild(this.createStepsSection());
            
            // Add example prompts section
            const exampleSection = this.createExamplesSection();
            this.dom.exampleSection = exampleSection;
            instructionsContainer.appendChild(exampleSection);
            
            // Add tips section
            instructionsContainer.appendChild(this.createTipsSection());
            
            this.dom.instructionsContainer = instructionsContainer;
            container.appendChild(instructionsContainer);
            
            // Add styles
            this.addStyles();
            
            // Add component to panel
            this.dom.content.innerHTML = '';
            this.dom.content.appendChild(container);
            
            // Update indicators
            this.updateStatusIndicators();
            this.updateRecommendedActionsMessage();
        },
        
        /**
         * Create status section
         */
        createStatusSection: function() {
            const section = document.createElement('div');
            section.className = 'instructions-section status-section';
            
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = 'System Status';
            
            const statusContainer = document.createElement('div');
            statusContainer.className = 'status-container';
            
            // Plugin status indicators
            const pluginStatus = document.createElement('div');
            pluginStatus.className = 'plugin-status';
            
            // OK Plugin status
            const okStatusItem = document.createElement('div');
            okStatusItem.className = 'status-item';
            
            const okLabel = document.createElement('span');
            okLabel.className = 'status-label';
            okLabel.textContent = 'OK Plugin:';
            
            const okStatus = document.createElement('span');
            okStatus.className = 'plugin-status-indicator';
            okStatus.textContent = 'Checking...';
            
            okStatusItem.appendChild(okLabel);
            okStatusItem.appendChild(okStatus);
            
            // Back Plugin status
            const backStatusItem = document.createElement('div');
            backStatusItem.className = 'status-item';
            
            const backLabel = document.createElement('span');
            backLabel.className = 'status-label';
            backLabel.textContent = 'Back Plugin:';
            
            const backStatus = document.createElement('span');
            backStatus.className = 'plugin-status-indicator';
            backStatus.textContent = 'Checking...';
            
            backStatusItem.appendChild(backLabel);
            backStatusItem.appendChild(backStatus);
            
            // Overall ready status
            const readyStatusItem = document.createElement('div');
            readyStatusItem.className = 'status-item ready-status';
            
            const readyStatus = document.createElement('span');
            readyStatus.className = 'ready-indicator';
            readyStatus.textContent = 'Checking system status...';
            
            readyStatusItem.appendChild(readyStatus);
            
            // Save references to status elements
            this.dom.pluginStatusElements = {
                ok: okStatus,
                back: backStatus,
                ready: readyStatus
            };
            
            pluginStatus.appendChild(okStatusItem);
            pluginStatus.appendChild(backStatusItem);
            pluginStatus.appendChild(readyStatusItem);
            
            // Recommended actions
            const actionsTitle = document.createElement('h5');
            actionsTitle.className = 'subsection-title';
            actionsTitle.textContent = 'Recommended Actions';
            
            const recommendedActions = document.createElement('div');
            recommendedActions.className = 'recommended-actions';
            recommendedActions.innerHTML = `<div class="loading">Checking plugin status...</div>`;
            
            // Save reference
            this.dom.interactiveElements.recommendedActions = recommendedActions;
            
            statusContainer.appendChild(pluginStatus);
            statusContainer.appendChild(actionsTitle);
            statusContainer.appendChild(recommendedActions);
            
            section.appendChild(title);
            section.appendChild(statusContainer);
            
            return section;
        },
        
        /**
         * Create visual explanation section
         */
        createVisualExplanationSection: function() {
            const section = document.createElement('div');
            section.className = 'instructions-section visual-section';
            
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = 'How It Works';
            
            const visualization = document.createElement('div');
            visualization.className = 'loop-visualization';
            
            // Create visualization elements
            visualization.innerHTML = `
                <div class="vis-user vis-element">
                    <div class="vis-icon">👤</div>
                    <div class="vis-label">User</div>
                </div>
                <div class="vis-arrow right">➡️</div>
                <div class="vis-ai vis-element">
                    <div class="vis-icon">🤖</div>
                    <div class="vis-label">AI</div>
                    <div class="vis-detail">Includes "Next Prompt" + ends with "ok"</div>
                </div>
                <div class="vis-arrow down">⬇️</div>
                <div class="vis-ok vis-element">
                    <div class="vis-icon">👍</div>
                    <div class="vis-label">OK Plugin</div>
                    <div class="vis-detail">Detects "ok" trigger</div>
                </div>
                <div class="vis-arrow down">⬇️</div>
                <div class="vis-back vis-element">
                    <div class="vis-icon">↩️</div>
                    <div class="vis-label">Back Plugin</div>
                    <div class="vis-detail">Sends AI's previous message back as input</div>
                </div>
                <div class="vis-arrow left loop-arrow">⬅️</div>
            `;
            
            // Save reference
            this.dom.visualizationElement = visualization;
            
            section.appendChild(title);
            section.appendChild(visualization);
            
            return section;
        },
        
        /**
         * Create steps section
         */
        createStepsSection: function() {
            const section = document.createElement('div');
            section.className = 'instructions-section steps-section';
            
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = 'Step-by-Step Guide';
            
            const steps = document.createElement('div');
            steps.className = 'step-list';
            
            // Step 1: Start Plugins
            const step1 = this.createStepElement('1', 'Start Required Plugins', `
                <p>Both the <strong>OK</strong> and <strong>Back</strong> plugins must be active for the loop to work:</p>
                <div class="step-commands">
                    <button class="step-command-button" data-command="start ok">Start OK Plugin</button>
                    <button class="step-command-button" data-command="start back">Start Back Plugin</button>
                </div>
            `);
            
            // Step 2: Create Initial Prompt
            const step2 = this.createStepElement('2', 'Create Self-Prompting Instruction', `
                <p>Send a prompt that explains the self-prompting concept to the AI. Tell it to:</p>
                <ul class="step-list-items">
                    <li>Include a section like <strong>"Next Prompt for Myself:"</strong> in each response</li>
                    <li>Follow its own previous instructions when they come back as input</li>
                    <li>Always end messages with the word <strong>"ok"</strong> (no punctuation)</li>
                </ul>
                <div class="step-action">
                    <button class="copy-prompt-button" data-target="basicPrompt">
                        <span class="button-icon">📋</span>
                        <span class="button-text">Copy Basic Prompt</span>
                    </button>
                </div>
            `);
            
            // Step 3: Let the Loop Run
            const step3 = this.createStepElement('3', 'Watch the Loop Run', `
                <p>Once properly set up, the self-prompting loop operates automatically:</p>
                <ol class="step-list-numbered">
                    <li>The AI creates a message with content and a "Next Prompt" section</li>
                    <li>The AI message ends with "ok"</li>
                    <li>The OK plugin detects this trigger word</li>
                    <li>The Back plugin sends the AI's previous message back as input</li>
                    <li>The AI reads its own "Next Prompt" instructions and follows them</li>
                    <li>The cycle repeats as long as messages end with "ok"</li>
                </ol>
            `);
            
            // Step 4: Stopping the Loop
            const step4 = this.createStepElement('4', 'Controlling & Stopping', `
                <p>You have several options to control or stop the loop:</p>
                <ul class="step-list-items">
                    <li><strong>To intervene:</strong> Type any input while the loop is running</li>
                    <li><strong>To pause:</strong> Ask the AI to end its response without "ok"</li>
                    <li><strong>To stop:</strong> Send <code>stop ok</code> or <code>stop loop</code></li>
                </ul>
                <p class="step-note">You can restart at any time by instructing the AI to end messages with "ok"</p>
            `);
            
            // Add all steps
            steps.appendChild(step1);
            steps.appendChild(step2);
            steps.appendChild(step3);
            steps.appendChild(step4);
            
            // Add event listeners to command buttons
            steps.querySelectorAll('.step-command-button').forEach(button => {
                button.addEventListener('click', () => {
                    this.executeCommand(button.dataset.command);
                });
            });
            
            // Add event listeners to copy buttons
            steps.querySelectorAll('.copy-prompt-button').forEach(button => {
                button.addEventListener('click', () => {
                    this.copyExampleToClipboard(button.dataset.target);
                });
                // Save reference
                this.dom.copyButtons[button.dataset.target] = button;
            });
            
            section.appendChild(title);
            section.appendChild(steps);
            
            return section;
        },
        
        /**
         * Create examples section
         */
        createExamplesSection: function() {
            const section = document.createElement('div');
            section.className = 'instructions-section examples-section';
            
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = 'Example Prompts';
            
            const description = document.createElement('p');
            description.className = 'section-description';
            description.textContent = 'Choose from these ready-to-use loop prompts:';
            
            const examplesList = document.createElement('div');
            examplesList.className = 'examples-list';
            
            // Basic example
            const basicExample = document.createElement('div');
            basicExample.className = 'example-item';
            
            const basicTitle = document.createElement('h5');
            basicTitle.className = 'example-title';
            basicTitle.textContent = 'Simple Self-Prompting Loop';
            
            const basicDescription = document.createElement('p');
            basicDescription.className = 'example-description';
            basicDescription.textContent = 'A straightforward setup for beginners. Gets the loop working without any specific direction.';
            
            const basicButton = document.createElement('button');
            basicButton.className = 'copy-example-button';
            basicButton.setAttribute('data-target', 'basicPrompt');
            basicButton.innerHTML = '<span class="button-icon">📋</span><span class="button-text">Copy Basic Prompt</span>';
            
            basicExample.appendChild(basicTitle);
            basicExample.appendChild(basicDescription);
            basicExample.appendChild(basicButton);
            
            // Advanced example
            const advancedExample = document.createElement('div');
            advancedExample.className = 'example-item';
            
            const advancedTitle = document.createElement('h5');
            advancedTitle.className = 'example-title';
            advancedTitle.textContent = 'Advanced Topic Exploration';
            
            const advancedDescription = document.createElement('p');
            advancedDescription.className = 'example-description';
            advancedDescription.textContent = 'Detailed prompt with specific initial topic and clear instructions for a structured loop.';
            
            const advancedButton = document.createElement('button');
            advancedButton.className = 'copy-example-button';
            advancedButton.setAttribute('data-target', 'advancedPrompt');
            advancedButton.innerHTML = '<span class="button-icon">📋</span><span class="button-text">Copy Advanced Prompt</span>';
            
            advancedExample.appendChild(advancedTitle);
            advancedExample.appendChild(advancedDescription);
            advancedExample.appendChild(advancedButton);
            
            // Creative example
            const creativeExample = document.createElement('div');
            creativeExample.className = 'example-item';
            
            const creativeTitle = document.createElement('h5');
            creativeTitle.className = 'example-title';
            creativeTitle.textContent = 'Creative Storytelling Loop';
            
            const creativeDescription = document.createElement('p');
            creativeDescription.className = 'example-description';
            creativeDescription.textContent = 'Uses the self-prompting loop for evolving narrative creation. Perfect for generating fiction.';
            
            const creativeButton = document.createElement('button');
            creativeButton.className = 'copy-example-button';
            creativeButton.setAttribute('data-target', 'creativityPrompt');
            creativeButton.innerHTML = '<span class="button-icon">📋</span><span class="button-text">Copy Story Prompt</span>';
            
            creativeExample.appendChild(creativeTitle);
            creativeExample.appendChild(creativeDescription);
            creativeExample.appendChild(creativeButton);
            
            // Add examples to list
            examplesList.appendChild(basicExample);
            examplesList.appendChild(advancedExample);
            examplesList.appendChild(creativeExample);
            
            // Add event listeners to all copy buttons
            examplesList.querySelectorAll('.copy-example-button').forEach(button => {
                button.addEventListener('click', () => {
                    this.copyExampleToClipboard(button.dataset.target);
                });
                // Save reference
                this.dom.copyButtons[button.dataset.target] = button;
            });
            
            section.appendChild(title);
            section.appendChild(description);
            section.appendChild(examplesList);
            
            return section;
        },
        
        /**
         * Create tips section
         */
        createTipsSection: function() {
            const section = document.createElement('div');
            section.className = 'instructions-section tips-section';
            
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = 'Advanced Tips';
            
            const tipsList = document.createElement('div');
            tipsList.className = 'tips-list';
            
            const tips = [
                {
                    title: 'Structured Output',
                    content: 'Ask for structured formats in your initial prompt. This helps maintain consistency as the loop progresses.'
                },
                {
                    title: 'Topic Evolution',
                    content: 'For creative exercises, instruct the AI to gradually evolve the topic or approach rather than making dramatic shifts.'
                },
                {
                    title: 'Checkpoint Summaries',
                    content: 'Include periodic summary instructions in the loop to maintain context and prevent drift from the original objective.'
                },
                {
                    title: 'Character Development',
                    content: 'For storytelling, direct character growth or new character introductions at specific points in the loop.'
                },
                {
                    title: 'Combining with Plugins',
                    content: 'The loop can work alongside other plugins. Consider using it with memory, Wikipedia, or other tools for richer content.'
                }
            ];
            
            tips.forEach(tip => {
                const tipItem = document.createElement('div');
                tipItem.className = 'tip-item';
                
                const tipTitle = document.createElement('h5');
                tipTitle.className = 'tip-title';
                tipTitle.textContent = tip.title;
                
                const tipContent = document.createElement('p');
                tipContent.className = 'tip-content';
                tipContent.textContent = tip.content;
                
                tipItem.appendChild(tipTitle);
                tipItem.appendChild(tipContent);
                tipsList.appendChild(tipItem);
            });
            
            section.appendChild(title);
            section.appendChild(tipsList);
            
            return section;
        },
        
        /**
         * Create a step element
         */
        createStepElement: function(number, title, contentHTML) {
            const step = document.createElement('div');
            step.className = 'step-item';
            
            const header = document.createElement('div');
            header.className = 'step-header';
            
            const numberBadge = document.createElement('div');
            numberBadge.className = 'step-number';
            numberBadge.textContent = number;
            
            const stepTitle = document.createElement('h5');
            stepTitle.className = 'step-title';
            stepTitle.textContent = title;
            
            header.appendChild(numberBadge);
            header.appendChild(stepTitle);
            
            const content = document.createElement('div');
            content.className = 'step-content';
            content.innerHTML = contentHTML;
            
            step.appendChild(header);
            step.appendChild(content);
            
            return step;
        },
        
        /**
         * Execute a command
         */
        executeCommand: function(command) {
            if (!command) return;
            
            // Get user input field
            const userInput = document.getElementById('userInput');
            if (!userInput) {
                console.error(`[${this.id}] User input field not found`);
                return;
            }
            
            // Set command to input
            userInput.value = command;
            
            // Focus input field
            userInput.focus();
            
            // Check if Framework provides direct message sending
            if (typeof Framework.sendMessage === 'function') {
                Framework.sendMessage();
            } else {
                // Manually trigger input event for auto-resize
                userInput.dispatchEvent(new Event('input'));
                
                // Show feedback toast
                Framework.showToast(`Command set: ${command}`);
            }
        },
        
        /**
         * Copy example prompt to clipboard
         */
        copyExampleToClipboard: function(exampleKey) {
            if (!exampleKey || !this.state.examples[exampleKey]) {
                console.error(`[${this.id}] Example prompt not found: ${exampleKey}`);
                return;
            }
            
            const text = this.state.examples[exampleKey];
            
            try {
                // Use Clipboard API to copy text
                navigator.clipboard.writeText(text)
                    .then(() => {
                        // Show success feedback
                        Framework.showToast('Example prompt copied to clipboard');
                        
                        // Update button to indicate copy was successful
                        const button = this.dom.copyButtons[exampleKey];
                        if (button) {
                            const originalText = button.innerHTML;
                            button.innerHTML = '<span class="button-icon">✅</span><span class="button-text">Copied!</span>';
                            
                            // Reset button text after a delay
                            setTimeout(() => {
                                button.innerHTML = originalText;
                            }, 2000);
                        }
                    })
                    .catch(error => {
                        console.error(`[${this.id}] Error copying to clipboard:`, error);
                        Framework.showToast('Error copying to clipboard');
                    });
            } catch (error) {
                console.error(`[${this.id}] Error copying to clipboard:`, error);
                Framework.showToast('Error copying to clipboard');
                
                // Fallback method for browsers without clipboard API
                this.copyTextFallback(text);
            }
        },
        
        /**
         * Fallback method for copying text to clipboard
         */
        copyTextFallback: function(text) {
            // Create temporary textarea
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                // Try to copy using document.execCommand
                const success = document.execCommand('copy');
                if (success) {
                    Framework.showToast('Example prompt copied to clipboard');
                } else {
                    Framework.showToast('Failed to copy text. Please copy it manually');
                    console.error(`[${this.id}] execCommand copy failed`);
                }
            } catch (error) {
                Framework.showToast('Failed to copy text. Please copy it manually');
                console.error(`[${this.id}] execCommand copy error:`, error);
            }
            
            document.body.removeChild(textarea);
        },
        
        /**
         * Add component-specific styles
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Loopback Panel Styles */
                .loopback-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    font-size: 13px;
                    color: var(--color-text);
                    background-color: white;
                }
                
                /* Plugin Required Note */
                .plugin-required-note {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background-color: #fff4e5;
                    border: 1px solid #ffcc80;
                    border-radius: 6px;
                    padding: 16px;
                    margin: 16px;
                    text-align: center;
                    color: #e65100;
                }
                
                .note-icon {
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                
                .note-title {
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 8px;
                }
                
                .note-content {
                    margin-bottom: 12px;
                }
                
                .note-actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .note-button {
                    background-color: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: background-color 0.2s;
                }
                
                .note-button:hover {
                    background-color: #f57c00;
                }
                
                /* Instructions Container */
                .instructions-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    padding: 12px;
                }
                
                .section-title-container {
                    margin-bottom: 16px;
                }
                
                .instructions-title {
                    color: var(--color-primary);
                    font-size: 18px;
                    margin: 0 0 8px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--color-primary-light);
                }
                
                .instructions-description {
                    font-size: 13px;
                    color: var(--color-text);
                    line-height: 1.4;
                }
                
                /* Instructions Section */
                .instructions-section {
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                
                .section-title {
                    font-size: 15px;
                    color: var(--color-primary-dark);
                    margin: 0 0 12px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .subsection-title {
                    font-size: 14px;
                    margin: 12px 0 8px 0;
                    color: var(--color-primary);
                }
                
                /* Status Section */
                .status-section {
                    border-left: 3px solid var(--color-primary);
                }
                
                .status-container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .plugin-status {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 10px;
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                }
                
                .status-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 10px;
                    background-color: #f5f5f5;
                    border-radius: 4px;
                }
                
                .status-label {
                    font-weight: bold;
                    font-size: 13px;
                }
                
                .plugin-status-indicator {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .plugin-status-indicator.active {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                }
                
                .plugin-status-indicator.inactive {
                    background-color: #ffebee;
                    color: #c62828;
                }
                
                .ready-status {
                    margin-top: 8px;
                    justify-content: center;
                }
                
                .ready-indicator {
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    text-align: center;
                }
                
                .ready-indicator.active {
                    background-color: #4caf50;
                    color: white;
                }
                
                .ready-indicator.inactive {
                    background-color: #f44336;
                    color: white;
                }
                
                .recommended-actions {
                    padding: 8px;
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                }
                
                .action-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    padding: 5px;
                }
                
                .action-item.success {
                    background-color: #e8f5e9;
                    border-radius: 4px;
                    padding: 8px;
                    border-left: 3px solid #4caf50;
                }
                
                .action-label {
                    font-size: 13px;
                    flex: 1;
                    min-width: 150px;
                }
                
                .action-button {
                    background-color: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 10px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .action-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                .loading {
                    text-align: center;
                    font-style: italic;
                    color: var(--color-text-light);
                    padding: 10px;
                }
                
                /* Visual Explanation */
                .visual-section {
                    border-left: 3px solid #9c27b0;
                }
                
                .loop-visualization {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    grid-template-rows: auto auto auto auto;
                    gap: 5px;
                    align-items: center;
                    justify-items: center;
                    margin: 10px auto;
                    max-width: 400px;
                    position: relative;
                }
                
                .vis-element {
                    padding: 8px;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 120px;
                    text-align: center;
                    transition: all 0.3s ease;
                }
                
                .vis-element .vis-icon {
                    font-size: 24px;
                    margin-bottom: 4px;
                }
                
                .vis-element .vis-label {
                    font-weight: bold;
                    margin-bottom: 2px;
                }
                
                .vis-element .vis-detail {
                    font-size: 11px;
                    color: var(--color-text-light);
                    line-height: 1.2;
                }
                
                .vis-user {
                    background-color: #e3f2fd;
                    border: 1px solid #90caf9;
                    grid-column: 1;
                    grid-row: 1;
                }
                
                .vis-ai {
                    background-color: #e8f5e9;
                    border: 1px solid #a5d6a7;
                    grid-column: 3;
                    grid-row: 1;
                }
                
                .vis-ok {
                    background-color: #fff8e1;
                    border: 1px solid #ffe082;
                    grid-column: 3;
                    grid-row: 2;
                    opacity: 0.6;
                    transform: scale(0.95);
                }
                
                .vis-back {
                    background-color: #fff8e1;
                    border: 1px solid #ffe082;
                    grid-column: 3;
                    grid-row: 3;
                    opacity: 0.6;
                    transform: scale(0.95);
                }
                
                .vis-arrow {
                    font-size: 20px;
                }
                
                .vis-arrow.right {
                    grid-column: 2;
                    grid-row: 1;
                }
                
                .vis-arrow.down {
                    grid-column: 3;
                    grid-row-start: 1;
                    grid-row-end: 3;
                    align-self: end;
                    margin-bottom: -10px;
                }
                
                .vis-arrow.down:nth-of-type(3) {
                    grid-row-start: 2;
                    grid-row-end: 4;
                }
                
                .vis-arrow.left {
                    grid-column: 2;
                    grid-row: 3;
                    transform: rotate(180deg);
                    opacity: 0.3;
                    transition: opacity 0.3s ease;
                }
                
                .loop-visualization.fully-active .vis-ok,
                .loop-visualization.fully-active .vis-back {
                    opacity: 1;
                    transform: scale(1);
                }
                
                .loop-visualization.fully-active .vis-arrow.left {
                    opacity: 1;
                    animation: pulse-arrow 2s infinite;
                }
                
                @keyframes pulse-arrow {
                    0% { transform: rotate(180deg) scale(1); }
                    50% { transform: rotate(180deg) scale(1.1); }
                    100% { transform: rotate(180deg) scale(1); }
                }
                
                /* Steps Section */
                .steps-section {
                    border-left: 3px solid #ff9800;
                }
                
                .step-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .step-item {
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    overflow: hidden;
                }
                
                .step-header {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .step-number {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background-color: #ff9800;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    margin-right: 10px;
                    flex-shrink: 0;
                }
                
                .step-title {
                    margin: 0;
                    font-size: 14px;
                    color: var(--color-text);
                }
                
                .step-content {
                    padding: 12px;
                    font-size: 13px;
                    line-height: 1.4;
                }
                
                .step-content p {
                    margin: 0 0 10px 0;
                }
                
                .step-content p:last-child {
                    margin-bottom: 0;
                }
                
                .step-list-items,
                .step-list-numbered {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                .step-list-items li,
                .step-list-numbered li {
                    margin-bottom: 5px;
                }
                
                .step-commands {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 10px 0;
                }
                
                .step-command-button {
                    background-color: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .step-command-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                .step-action {
                    margin-top: 12px;
                    display: flex;
                    justify-content: center;
                }
                
                .copy-prompt-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background-color: #4caf50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 15px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .copy-prompt-button:hover {
                    background-color: #388e3c;
                    transform: translateY(-2px);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                
                .button-icon {
                    font-size: 16px;
                }
                
                .step-note {
                    font-style: italic;
                    color: var(--color-text-light);
                    margin-top: 10px;
                    font-size: 12px;
                    border-left: 2px solid #e0e0e0;
                    padding-left: 8px;
                }
                
                code {
                    background-color: #f1f1f1;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 12px;
                }
                
                /* Examples Section */
                .examples-section {
                    border-left: 3px solid #4caf50;
                }
                
                .section-description {
                    margin: 0 0 12px 0;
                    color: var(--color-text);
                }
                
                .examples-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .example-item {
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 12px;
                    transition: all 0.2s;
                }
                
                .example-item:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                    border-color: #4caf50;
                }
                
                .example-title {
                    margin: 0 0 5px 0;
                    font-size: 14px;
                    color: #2e7d32;
                }
                
                .example-description {
                    margin: 0 0 10px 0;
                    font-size: 12px;
                    color: var(--color-text);
                    line-height: 1.4;
                }
                
                .copy-example-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background-color: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .copy-example-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                /* Tips Section */
                .tips-section {
                    border-left: 3px solid #2196f3;
                }
                
                .tips-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .tip-item {
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 10px;
                }
                
                .tip-title {
                    margin: 0 0 5px 0;
                    font-size: 13px;
                    color: #1976d2;
                }
                
                .tip-content {
                    margin: 0;
                    font-size: 12px;
                    color: var(--color-text);
                    line-height: 1.4;
                }
                
                /* Responsive Adjustments */
                @media (max-width: 768px) {
                    .loop-visualization {
                        grid-template-columns: auto auto;
                        grid-template-rows: auto auto auto auto auto;
                    }
                    
                    .vis-user {
                        grid-column: 1;
                        grid-row: 1;
                    }
                    
                    .vis-arrow.right {
                        grid-column: 2;
                        grid-row: 1;
                        transform: rotate(90deg);
                    }
                    
                    .vis-ai {
                        grid-column: 1;
                        grid-row: 2;
                    }
                    
                    .vis-arrow.down {
                        grid-column: 1;
                        grid-row: 3;
                    }
                    
                    .vis-ok {
                        grid-column: 1;
                        grid-row: 4;
                    }
                    
                    .vis-arrow.down:nth-of-type(3) {
                        grid-column: 1;
                        grid-row: 5;
                    }
                    
                    .vis-back {
                        grid-column: 1;
                        grid-row: 6;
                    }
                    
                    .vis-arrow.left {
                        grid-column: 2;
                        grid-row: 6;
                    }
                }
                
                @media (max-width: 480px) {
                    .instructions-container {
                        padding: 8px;
                    }
                    
                    .instructions-section {
                        padding: 10px;
                    }
                    
                    .step-commands {
                        flex-direction: column;
                    }
                    
                    .action-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .action-button {
                        width: 100%;
                    }
                }
            `;
            
            document.head.appendChild(style);
        },
        
        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Remove style element
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            
            // Clear intervals
            this.state.intervals.forEach(interval => clearInterval(interval));
            this.state.intervals = [];
            
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];
            
            console.log(`[${this.id}] Component cleaned up.`);
        }
    };
    
    // Register component
    Framework.registerComponent(component.id, component);
})();