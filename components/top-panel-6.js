/**
 * ==============================================================================================
 * Top Panel 6 - Filter Action Interface (STANDARDIZED LAYOUT)
 * ==============================================================================================
 *
 * Redesigned to match the standard panel layout with proper gray header and consistent styling.
 * 
 * @version 2.1.0 - Updated to match standard panel layout with gray header
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-6',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            filterContainer: null
        },

        // Component state
        state: {
            isFilterActive: false,
            filteredTypes: [
                { pattern: '[LOG EVENT:', description: 'System log events', examples: ['[LOG EVENT: action_started]', '[LOG EVENT: input_processing_complete]'] },
                { pattern: '[priority_level_', description: 'Priority level messages', examples: ['[priority_level_5]', '[priority_level_high]'] }
            ],
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element for ${this.id} not found`);
                return;
            }

            // Clear and render the structure immediately
            this.renderContentStructure();

            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateFilterState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: subscription });

            this.checkInitialFilterState();
        },

        /**
         * Check initial state of "filter" action
         */
        checkInitialFilterState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    this.updateFilterState(data?.actions || []);
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial filter state:`, error);
                    this.updateFilterState([]); 
                });
        },

        /**
         * Update component state based on filter active status
         */
        updateFilterState: function(actions = []) {
            const isActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'filter';
            });
            
            this.state.isFilterActive = isActive;
            this.updateUIVisibility();
            
            // Always update the displayed content
            this.renderFilterContent();
        },

        /**
         * Update visibility of note vs main container
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.isFilterActive ? 'none' : 'block';
            }
            if (this.dom.filterContainer) {
                this.dom.filterContainer.style.display = this.state.isFilterActive ? 'block' : 'none';
            }
        },

        /**
         * Render the basic structure
         */
        renderContentStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = '';

            // Create warning note
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note';
            noteElement.innerHTML = `
                <strong>Plugin Required</strong><br>
                Start the "filter" plugin to manage chat message filtering.<br><br>
                <em>Example command:</em> 
                <code>start filter</code>`;
            this.dom.noteElement = noteElement;
            this.dom.content.appendChild(noteElement);

            // Create main container
            const filterContainer = document.createElement('div');
            filterContainer.className = 'filter-panel-container';
            filterContainer.style.display = 'none';
            filterContainer.style.height = '100%';
            filterContainer.style.overflowY = 'auto';
            filterContainer.style.display = 'flex';
            filterContainer.style.flexDirection = 'column';
            this.dom.filterContainer = filterContainer;
            this.dom.content.appendChild(filterContainer);

            // Add styles
            this.addStyles();

            // Initialize content
            this.renderFilterContent();
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
                .filter-panel-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow-y: auto;
                }

                .filter-section {
                    margin: 10px;
                    border: 1px solid var(--color-border);
                    border-radius: var(--border-radius-md);
                    overflow: hidden;
                    background-color: white;
                    box-shadow: var(--shadow-sm);
                }

                .filter-section-header {
                    padding: 8px 10px;
                    background-color: var(--color-secondary);
                    border-bottom: 1px solid var(--color-border);
                    font-weight: bold;
                    font-size: 14px;
                    color: var(--color-primary-dark);
                }

                .filter-section-content {
                    padding: 10px;
                    background-color: white;
                }

                .filter-toggle-button {
                    width: 100%;
                    padding: 8px 12px;
                    border: none;
                    border-radius: var(--border-radius-sm);
                    font-weight: bold;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    margin-bottom: 10px;
                }

                .filter-toggle-button.active {
                    background-color: #f44336;
                    color: white;
                }

                .filter-toggle-button.inactive {
                    background-color: #4caf50;
                    color: white;
                }

                .filter-toggle-button:hover {
                    opacity: 0.9;
                }

                .filter-info-box {
                    background-color: var(--color-primary-light);
                    padding: 10px;
                    border-radius: var(--border-radius-sm);
                    margin-bottom: 10px;
                    border-left: 3px solid var(--color-primary);
                    font-size: 13px;
                    line-height: 1.4;
                }

                .filter-type {
                    margin-bottom: 10px;
                    padding: 10px;
                    border-radius: var(--border-radius-sm);
                    background-color: #f5f5f5;
                    border: 1px solid #e0e0e0;
                }

                .filter-type:last-child {
                    margin-bottom: 0;
                }

                .filter-pattern {
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .filter-pattern code {
                    background: #e8f5e9;
                    padding: 3px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                    border: 1px solid #c5e1a5;
                }

                .filter-description {
                    margin-bottom: 8px;
                    padding-left: 8px;
                    border-left: 3px solid #aed581;
                    font-size: 13px;
                }

                .filter-examples {
                    background-color: #f9fbe7;
                    padding: 8px;
                    border-radius: 4px;
                }

                .filter-examples-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                    font-size: 12px;
                }

                .filter-example-list {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    padding-left: 10px;
                }

                .filter-example code {
                    font-family: monospace;
                    background: white;
                    padding: 3px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    border: 1px solid #dce775;
                }

                .filter-flow-diagram {
                    display: flex;
                    align-items: stretch;
                    justify-content: space-between;
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .filter-flow-box {
                    flex: 1;
                    border: 1px solid #e0e0e0;
                    border-radius: var(--border-radius-sm);
                    overflow: hidden;
                    background-color: #fafafa;
                }

                .filter-flow-header {
                    background-color: #f5f5f5;
                    padding: 6px;
                    border-bottom: 1px solid #e0e0e0;
                    text-align: center;
                    font-weight: bold;
                    font-size: 12px;
                }

                .filter-flow-content {
                    padding: 8px;
                    background-color: white;
                    font-size: 12px;
                }

                .filter-flow-message {
                    font-family: monospace;
                    padding: 2px;
                    font-size: 12px;
                }

                .filter-flow-message.filtered {
                    color: #bdbdbd;
                    text-decoration: line-through;
                    background-color: #f5f5f5;
                    opacity: 0.7;
                }

                .filter-flow-middle {
                    width: 80px;
                    text-align: center;
                    background-color: #e3f2fd;
                    border: 1px solid #bbdefb;
                    border-radius: var(--border-radius-sm);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }

                .filter-flow-middle-header {
                    background-color: #bbdefb;
                    padding: 6px;
                    border-bottom: 1px solid #90caf9;
                    text-align: center;
                    font-weight: bold;
                    color: #0d47a1;
                    font-size: 12px;
                    width: 100%;
                }

                .filter-flow-icon {
                    font-size: 24px;
                    margin: 8px 0;
                    animation: pulse 2s infinite alternate;
                }

                .filter-note {
                    text-align: center;
                    background-color: #fff8e1;
                    padding: 8px;
                    border-radius: 4px;
                    font-style: italic;
                    color: #ff6f00;
                    font-size: 12px;
                    border: 1px dashed #ffcc80;
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Render the actual filter content
         */
        renderFilterContent: function() {
            if (!this.dom.filterContainer) return;
            
            // Clear existing content
            this.dom.filterContainer.innerHTML = '';
            
            const isActive = this.state.isFilterActive;
            
            // Create standard panel header (gray bar)
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            
            // Left side with title
            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '10px';
            
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Filter Controls';
            headerTitle.style.fontWeight = 'bold';
            headerLeft.appendChild(headerTitle);
            
            // Status indicator on the right
            const statusWrapper = document.createElement('div');
            statusWrapper.style.display = 'flex';
            statusWrapper.style.alignItems = 'center';
            
            const statusShape = document.createElement('span');
            statusShape.style.display = 'inline-block';
            statusShape.style.width = '10px';
            statusShape.style.height = '10px';
            statusShape.style.borderRadius = '50%';
            statusShape.style.marginRight = '5px';
            statusShape.style.backgroundColor = isActive ? '#4caf50' : '#f44336';
            
            const statusText = document.createElement('span');
            statusText.textContent = isActive ? 'Active' : 'Inactive';
            statusText.style.fontSize = '0.85em';
            statusText.style.fontWeight = 'bold';
            
            statusWrapper.appendChild(statusShape);
            statusWrapper.appendChild(statusText);
            
            header.appendChild(headerLeft);
            header.appendChild(statusWrapper);
            
            this.dom.filterContainer.appendChild(header);
            
            // Create content with sections
            const content = document.createElement('div');
            content.className = 'filter-panel-content';
            content.style.flex = '1';
            content.style.overflowY = 'auto';
            content.style.padding = '0';
            
            // 1. STATUS SECTION
            const statusSection = document.createElement('div');
            statusSection.className = 'filter-section';
            
            const statusSectionContent = document.createElement('div');
            statusSectionContent.className = 'filter-section-content';
            
            const toggleButton = document.createElement('button');
            toggleButton.id = `${this.id}-toggle-button`;
            toggleButton.className = `filter-toggle-button ${isActive ? 'active' : 'inactive'}`;
            toggleButton.textContent = isActive ? 'Stop Filter' : 'Start Filter';
            toggleButton.addEventListener('click', () => this.toggleFilter());
            
            statusSectionContent.appendChild(toggleButton);
            statusSection.appendChild(statusSectionContent);
            content.appendChild(statusSection);
            
            // 2. ABOUT SECTION
            const aboutSection = document.createElement('div');
            aboutSection.className = 'filter-section';
            
            const aboutSectionHeader = document.createElement('div');
            aboutSectionHeader.className = 'filter-section-header';
            aboutSectionHeader.textContent = 'About Filter Action (Priority 7)';
            aboutSection.appendChild(aboutSectionHeader);
            
            const aboutSectionContent = document.createElement('div');
            aboutSectionContent.className = 'filter-section-content';
            
            const aboutInfo = document.createElement('div');
            aboutInfo.className = 'filter-info-box';
            aboutInfo.textContent = 'The Filter action hides non-essential system messages for a cleaner chat interface. When active, it filters out messages matching specific patterns (see below).';
            aboutSectionContent.appendChild(aboutInfo);
            
            aboutSection.appendChild(aboutSectionContent);
            content.appendChild(aboutSection);
            
            // 3. FILTERED TYPES SECTION
            const typesSection = document.createElement('div');
            typesSection.className = 'filter-section';
            
            const typesSectionHeader = document.createElement('div');
            typesSectionHeader.className = 'filter-section-header';
            typesSectionHeader.textContent = 'Filtered Message Types';
            typesSection.appendChild(typesSectionHeader);
            
            const typesSectionContent = document.createElement('div');
            typesSectionContent.className = 'filter-section-content';
            
            // Type 1
            const type1 = document.createElement('div');
            type1.className = 'filter-type';
            
            const pattern1 = document.createElement('div');
            pattern1.className = 'filter-pattern';
            pattern1.innerHTML = 'Pattern: <code>[LOG EVENT:</code>';
            type1.appendChild(pattern1);
            
            const desc1 = document.createElement('div');
            desc1.className = 'filter-description';
            desc1.textContent = 'System log events';
            type1.appendChild(desc1);
            
            const examples1 = document.createElement('div');
            examples1.className = 'filter-examples';
            
            const examplesTitle1 = document.createElement('div');
            examplesTitle1.className = 'filter-examples-title';
            examplesTitle1.textContent = 'Examples:';
            examples1.appendChild(examplesTitle1);
            
            const examplesList1 = document.createElement('div');
            examplesList1.className = 'filter-example-list';
            
            this.state.filteredTypes[0].examples.forEach(example => {
                const exampleItem = document.createElement('div');
                exampleItem.className = 'filter-example';
                exampleItem.innerHTML = `<code>${example}</code>`;
                examplesList1.appendChild(exampleItem);
            });
            
            examples1.appendChild(examplesList1);
            type1.appendChild(examples1);
            typesSectionContent.appendChild(type1);
            
            // Type 2
            const type2 = document.createElement('div');
            type2.className = 'filter-type';
            
            const pattern2 = document.createElement('div');
            pattern2.className = 'filter-pattern';
            pattern2.innerHTML = 'Pattern: <code>[priority_level_</code>';
            type2.appendChild(pattern2);
            
            const desc2 = document.createElement('div');
            desc2.className = 'filter-description';
            desc2.textContent = 'Priority level messages';
            type2.appendChild(desc2);
            
            const examples2 = document.createElement('div');
            examples2.className = 'filter-examples';
            
            const examplesTitle2 = document.createElement('div');
            examplesTitle2.className = 'filter-examples-title';
            examplesTitle2.textContent = 'Examples:';
            examples2.appendChild(examplesTitle2);
            
            const examplesList2 = document.createElement('div');
            examplesList2.className = 'filter-example-list';
            
            this.state.filteredTypes[1].examples.forEach(example => {
                const exampleItem = document.createElement('div');
                exampleItem.className = 'filter-example';
                exampleItem.innerHTML = `<code>${example}</code>`;
                examplesList2.appendChild(exampleItem);
            });
            
            examples2.appendChild(examplesList2);
            type2.appendChild(examples2);
            typesSectionContent.appendChild(type2);
            
            typesSection.appendChild(typesSectionContent);
            content.appendChild(typesSection);
            
            // 4. HOW IT WORKS SECTION
            const howSection = document.createElement('div');
            howSection.className = 'filter-section';
            
            const howSectionHeader = document.createElement('div');
            howSectionHeader.className = 'filter-section-header';
            howSectionHeader.textContent = 'How It Works';
            howSection.appendChild(howSectionHeader);
            
            const howSectionContent = document.createElement('div');
            howSectionContent.className = 'filter-section-content';
            
            const flowDiagram = document.createElement('div');
            flowDiagram.className = 'filter-flow-diagram';
            
            // Input Box
            const inputBox = document.createElement('div');
            inputBox.className = 'filter-flow-box';
            
            const inputHeader = document.createElement('div');
            inputHeader.className = 'filter-flow-header';
            inputHeader.textContent = 'All Messages';
            inputBox.appendChild(inputHeader);
            
            const inputContent = document.createElement('div');
            inputContent.className = 'filter-flow-content';
            
            const normalMessage1 = document.createElement('div');
            normalMessage1.className = 'filter-flow-message';
            normalMessage1.textContent = 'Normal message';
            inputContent.appendChild(normalMessage1);
            
            const logMessage = document.createElement('div');
            logMessage.className = 'filter-flow-message';
            logMessage.textContent = '[LOG EVENT: ...]';
            logMessage.style.backgroundColor = '#f5f5f5';
            logMessage.style.color = '#616161';
            inputContent.appendChild(logMessage);
            
            const userMessage1 = document.createElement('div');
            userMessage1.className = 'filter-flow-message';
            userMessage1.textContent = 'User message';
            inputContent.appendChild(userMessage1);
            
            const priorityMessage = document.createElement('div');
            priorityMessage.className = 'filter-flow-message';
            priorityMessage.textContent = '[priority_level_...]';
            priorityMessage.style.backgroundColor = '#f5f5f5';
            priorityMessage.style.color = '#616161';
            inputContent.appendChild(priorityMessage);
            
            const aiResponse1 = document.createElement('div');
            aiResponse1.className = 'filter-flow-message';
            aiResponse1.textContent = 'AI response';
            inputContent.appendChild(aiResponse1);
            
            inputBox.appendChild(inputContent);
            flowDiagram.appendChild(inputBox);
            
            // Filter Box
            const filterBox = document.createElement('div');
            filterBox.className = 'filter-flow-middle';
            
            const filterBoxHeader = document.createElement('div');
            filterBoxHeader.className = 'filter-flow-middle-header';
            filterBoxHeader.textContent = 'Filter Action';
            filterBox.appendChild(filterBoxHeader);
            
            const filterIcon = document.createElement('div');
            filterIcon.className = 'filter-flow-icon';
            filterIcon.textContent = '🧹';
            filterBox.appendChild(filterIcon);
            
            flowDiagram.appendChild(filterBox);
            
            // Output Box
            const outputBox = document.createElement('div');
            outputBox.className = 'filter-flow-box';
            
            const outputHeader = document.createElement('div');
            outputHeader.className = 'filter-flow-header';
            outputHeader.textContent = 'Filtered Chat';
            outputBox.appendChild(outputHeader);
            
            const outputContent = document.createElement('div');
            outputContent.className = 'filter-flow-content';
            
            const normalMessage2 = document.createElement('div');
            normalMessage2.className = 'filter-flow-message';
            normalMessage2.textContent = 'Normal message';
            outputContent.appendChild(normalMessage2);
            
            const logMessage2 = document.createElement('div');
            logMessage2.className = 'filter-flow-message filtered';
            logMessage2.textContent = '[LOG EVENT: ...]';
            outputContent.appendChild(logMessage2);
            
            const userMessage2 = document.createElement('div');
            userMessage2.className = 'filter-flow-message';
            userMessage2.textContent = 'User message';
            outputContent.appendChild(userMessage2);
            
            const priorityMessage2 = document.createElement('div');
            priorityMessage2.className = 'filter-flow-message filtered';
            priorityMessage2.textContent = '[priority_level_...]';
            outputContent.appendChild(priorityMessage2);
            
            const aiResponse2 = document.createElement('div');
            aiResponse2.className = 'filter-flow-message';
            aiResponse2.textContent = 'AI response';
            outputContent.appendChild(aiResponse2);
            
            outputBox.appendChild(outputContent);
            flowDiagram.appendChild(outputBox);
            
            howSectionContent.appendChild(flowDiagram);
            
            const filterNote = document.createElement('p');
            filterNote.className = 'filter-note';
            filterNote.textContent = 'Messages matching filter patterns are hidden from the chat when the filter is active.';
            howSectionContent.appendChild(filterNote);
            
            howSection.appendChild(howSectionContent);
            content.appendChild(howSection);
            
            this.dom.filterContainer.appendChild(content);
        },

        /**
         * Toggle filter on/off
         */
        toggleFilter: function() {
            const userInput = document.getElementById('userInput');
            if (userInput) {
                const command = this.state.isFilterActive ? 'stop filter' : 'start filter';
                userInput.value = command;
                Framework.sendMessage();
                
                const actionVerb = this.state.isFilterActive ? 'Stopping' : 'Starting';
                Framework.showToast(`${actionVerb} filter...`);
            }
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            this.state.subscriptions.forEach(sub => { Framework.off(sub.event, sub.id); });
            this.state.subscriptions = [];
            
            // Remove style element
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            
            if (this.dom.content) this.dom.content.innerHTML = '';
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();