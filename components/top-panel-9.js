/**
 * ==============================================================================================
 * Top Panel 9 - Web Conversation Mode (Automatic)
 * ==============================================================================================
 *
 * Automatically applies conversation-only display (user/AI messages only) when newfilter is active.
 * No toggle functionality - works in sync with the backend newfilter action.
 *
 * @version 2.1.0 - Updated styling to match other panels, only visible when newfilter is active
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-9',

        // DOM references
        dom: {
            content: null,
            noteElement: null,          // Displays "Plugin Required" when inactive
            mainContainer: null,        // Holds main controls when active
            statusText: null,
            updateInfo: null
        },

        // Component state
        state: {
            isNewfilterActive: false,
            subscriptions: [],
            lastUpdate: null
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

            // Render the basic structure first (note + container)
            this.renderStructure();
            
            // Add the CSS that filters system messages
            this.addConversationModeStyles();
            
            // Subscribe to active actions changes to detect 'newfilter' plugin
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateNewfilterState(data?.actions || []);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: subscription });

            // Initial check for 'newfilter' state
            this.checkInitialNewfilterState();
            
            // Set initial timestamp
            this.state.lastUpdate = new Date();
            this.updateLastUpdateTime();

            console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Render basic structure (Note + Main Container)
         */
        renderStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear existing

            // Create/Cache Warning Note Element (like panel 5)
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note';
            noteElement.innerHTML = `<strong>Plugin Required</strong><br>Start the "newfilter" plugin to enable conversation-only mode.<br><br><em>Example command:</em> <code>start newfilter</code>`;
            this.dom.noteElement = noteElement;
            this.dom.content.appendChild(noteElement);

            // Create/Cache Main Container
            const mainContainer = document.createElement('div');
            mainContainer.className = `${this.id}-main-container`;
            mainContainer.style.display = 'none'; // Initially hidden
            mainContainer.style.height = '100%';
            mainContainer.style.overflowY = 'auto';
            this.dom.mainContainer = mainContainer;
            this.dom.content.appendChild(mainContainer);

            // Add base styles
            this.addStyles();
            
            // Render panel contents
            this.renderPanelContent();
            
            // Update visibility based on current state
            this.updateUIVisibility();
        },

        /**
         * Check initial state of "newfilter" plugin
         */
        checkInitialNewfilterState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                 .then(data => {
                    this.updateNewfilterState(data?.actions || []);
                 })
                 .catch(error => {
                     console.error(`[${this.id}] Error checking initial newfilter state:`, error);
                     this.updateNewfilterState([]);
                 });
        },

        /**
         * Update component state based on newfilter active status
         */
        updateNewfilterState: function(actions = []) {
            const isActive = actions.some(action => {
                const actionStr = String(action || '');
                const [name] = actionStr.split(':');
                return name.trim().toLowerCase() === 'newfilter';
            });
            
            if (this.state.isNewfilterActive !== isActive) {
                console.log(`[${this.id}] Newfilter Action Active State Changed: ${isActive}`);
                this.state.isNewfilterActive = isActive;
                this.state.lastUpdate = new Date();
                
                // Apply or remove the conversation-mode-enabled class based on newfilter state
                if (Framework.dom.chatContainer) {
                    Framework.dom.chatContainer.classList.toggle('conversation-mode-enabled', isActive);
                    
                    // Force scroll to bottom when toggling the class to ensure proper display
                    requestAnimationFrame(() => {
                        Framework.scrollChatToBottom();
                    });
                }
                
                // Update UI visibility based on active state
                this.updateUIVisibility();
                
                // Update status and timestamp
                this.updateStatusDisplay();
                this.updateLastUpdateTime();
                
                // Show toast notification
                Framework.showToast(`Web Conversation Mode ${isActive ? 'Enabled' : 'Disabled'}`);
            }
        },
        
        /**
         * Update UI visibility based on newfilter status (similar to panel 5)
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.isNewfilterActive ? 'none' : 'block';
            }
            if (this.dom.mainContainer) {
                this.dom.mainContainer.style.display = this.state.isNewfilterActive ? 'block' : 'none';
            }
        },

        /**
         * Render the panel contents inside the main container
         */
        renderPanelContent: function() {
            // Ensure mainContainer exists
            if (!this.dom.mainContainer) {
                console.error(`[${this.id}] Main container not found, cannot render content.`);
                return;
            }
            
            const container = document.createElement('div');
            container.className = 'web-conversation-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            
            // --- Standard Panel Header with controls ---
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
            headerTitle.textContent = 'Web Conversation Mode';
            headerTitle.style.fontWeight = 'bold';
            headerLeft.appendChild(headerTitle);
            
            // Add status text next to the title
            const statusText = document.createElement('div');
            statusText.className = 'status-text active';
            statusText.textContent = 'Active';
            statusText.style.fontSize = '0.85em';
            statusText.style.fontWeight = 'bold';
            statusText.style.color = '#4CAF50';
            this.dom.statusText = statusText;
            headerLeft.appendChild(statusText);
            
            header.appendChild(headerLeft);
            
            // Right side controls
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';
            
            // Update timestamp display
            const updateInfo = document.createElement('span');
            updateInfo.className = 'update-info';
            updateInfo.textContent = 'Updated just now';
            updateInfo.style.fontSize = '0.8em';
            updateInfo.style.color = 'var(--color-text-light)';
            this.dom.updateInfo = updateInfo;
            headerControls.appendChild(updateInfo);
            
            // Add stop button for newfilter
            const stopButton = document.createElement('button');
            stopButton.id = 'stopNewfilterBtn';
            stopButton.className = 'control-button stop-button';
            stopButton.textContent = 'Stop';
            stopButton.setAttribute('title', 'Send \'stop newfilter\' command');
            stopButton.style.backgroundColor = '#f44336';
            stopButton.style.color = 'white';
            stopButton.style.border = 'none';
            stopButton.style.borderRadius = '4px';
            stopButton.style.padding = '6px 12px';
            stopButton.style.cursor = 'pointer';
            stopButton.style.fontSize = '0.85em';
            stopButton.style.fontWeight = 'bold';
            stopButton.addEventListener('click', () => {
                const userInput = document.getElementById('userInput');
                if (userInput) {
                    userInput.value = 'stop newfilter';
                    Framework.sendMessage();
                }
                Framework.showToast('Sending command: stop newfilter...');
            });
            headerControls.appendChild(stopButton);
            
            header.appendChild(headerControls);
            container.appendChild(header);
            
            // --- Main Content Area ---
            const contentArea = document.createElement('div');
            contentArea.className = 'panel-content-area';
            contentArea.style.padding = '15px';
            contentArea.style.flex = '1';
            contentArea.style.overflowY = 'auto';
            
            // Description card
            const descriptionCard = document.createElement('div');
            descriptionCard.className = 'description-card';
            descriptionCard.style.backgroundColor = 'white';
            descriptionCard.style.borderRadius = 'var(--border-radius-md)';
            descriptionCard.style.border = '1px solid var(--color-border)';
            descriptionCard.style.padding = '15px';
            descriptionCard.style.marginBottom = '15px';
            descriptionCard.style.boxShadow = 'var(--shadow-sm)';
            
            // Description content
            const description = document.createElement('div');
            description.className = 'description';
            description.style.lineHeight = '1.5';
            description.style.fontSize = '0.9em';
            description.style.color = 'var(--color-text-light)';
            description.innerHTML = `
                <p>Web Conversation Mode is now <strong>active</strong>.</p>
                <p>System logs and other outputs are being filtered out, showing only user messages and AI responses.</p>
                <p>This mode will stay active until the "newfilter" action is stopped.</p>
            `;
            descriptionCard.appendChild(description);
            contentArea.appendChild(descriptionCard);
            
            // Effect preview card
            const previewCard = document.createElement('div');
            previewCard.className = 'preview-card';
            previewCard.style.backgroundColor = 'white';
            previewCard.style.borderRadius = 'var(--border-radius-md)';
            previewCard.style.border = '1px solid var(--color-border)';
            previewCard.style.overflow = 'hidden';
            previewCard.style.marginBottom = '15px';
            
            // Preview header
            const previewHeader = document.createElement('div');
            previewHeader.className = 'preview-header';
            previewHeader.style.padding = '10px 15px';
            previewHeader.style.backgroundColor = 'var(--color-primary)';
            previewHeader.style.color = 'white';
            previewHeader.style.fontWeight = 'bold';
            previewHeader.style.fontSize = '0.9em';
            previewHeader.textContent = 'Current Message Display';
            previewCard.appendChild(previewHeader);
            
            // Preview content
            const previewContent = document.createElement('div');
            previewContent.className = 'preview-content';
            previewContent.style.padding = '15px';
            
            // Example message display
            const examples = document.createElement('div');
            examples.className = 'message-examples';
            examples.innerHTML = `
                <div style="margin-bottom:10px; border-left:3px solid #4a76a8; padding-left:10px; font-size:0.9em;">
                    <div style="font-weight:bold; margin-bottom:5px;">Visible:</div>
                    <div style="padding:4px; background:#e3f2fd; border-radius:4px; margin-bottom:3px;">User message</div>
                    <div style="padding:4px; background:#f0f8ff; border-radius:4px;">AI response</div>
                </div>
                <div style="border-left:3px solid #f44336; padding-left:10px; font-size:0.9em;">
                    <div style="font-weight:bold; margin-bottom:5px;">Hidden:</div>
                    <div style="padding:4px; background:#f5f5f5; border-radius:4px; margin-bottom:3px; text-decoration:line-through; opacity:0.7;">[SYSTEM: debug message]</div>
                    <div style="padding:4px; background:#f5f5f5; border-radius:4px; text-decoration:line-through; opacity:0.7;">[LOG EVENT: action details]</div>
                </div>
            `;
            previewContent.appendChild(examples);
            previewCard.appendChild(previewContent);
            contentArea.appendChild(previewCard);
            
            // Commands card
            const commandsCard = document.createElement('div');
            commandsCard.className = 'commands-card';
            commandsCard.style.backgroundColor = 'white';
            commandsCard.style.borderRadius = 'var(--border-radius-md)';
            commandsCard.style.border = '1px solid var(--color-border)';
            commandsCard.style.overflow = 'hidden';
            
            // Commands header
            const commandsHeader = document.createElement('div');
            commandsHeader.className = 'commands-header';
            commandsHeader.style.padding = '10px 15px';
            commandsHeader.style.backgroundColor = 'var(--color-primary)';
            commandsHeader.style.color = 'white';
            commandsHeader.style.fontWeight = 'bold';
            commandsHeader.style.fontSize = '0.9em';
            commandsHeader.textContent = 'Terminal Commands';
            commandsCard.appendChild(commandsHeader);
            
            // Commands content
            const commandsContent = document.createElement('div');
            commandsContent.className = 'commands-content';
            commandsContent.style.padding = '10px 15px';
            
            // Stop command item
            const commandItem = document.createElement('div');
            commandItem.className = 'command-item';
            commandItem.style.padding = '8px 10px';
            commandItem.style.backgroundColor = '#f8f9fa';
            commandItem.style.borderRadius = 'var(--border-radius-sm)';
            commandItem.style.border = '1px solid #eaecef';
            commandItem.style.fontSize = '0.9em';
            
            const codeElement = document.createElement('code');
            codeElement.style.fontFamily = 'monospace';
            codeElement.style.backgroundColor = '#f1f3f5';
            codeElement.style.padding = '2px 4px';
            codeElement.style.borderRadius = '3px';
            codeElement.textContent = 'stop newfilter';
            
            commandItem.appendChild(codeElement);
            commandItem.appendChild(document.createTextNode(' - Disable conversation-only mode'));
            
            commandsContent.appendChild(commandItem);
            commandsCard.appendChild(commandsContent);
            contentArea.appendChild(commandsCard);
            
            container.appendChild(contentArea);
            
            // Add to panel
            this.dom.mainContainer.innerHTML = '';
            this.dom.mainContainer.appendChild(container);
        },
        
        /**
         * Update the status display
         */
        updateStatusDisplay: function() {
            // Only update status text if it exists
            if (this.dom.statusText) {
                this.dom.statusText.textContent = 'Active';
                this.dom.statusText.style.color = '#4CAF50';
            }
        },
        
        /**
         * Update the last update time display
         */
        updateLastUpdateTime: function() {
            if (!this.dom.updateInfo || !this.state.lastUpdate) return;
            
            const now = new Date();
            const diff = now - this.state.lastUpdate;
            let timeText;
            
            if (diff < 60000) {
                timeText = 'Updated just now';
            } else if (diff < 3600000) {
                const minutes = Math.floor(diff / 60000);
                timeText = `Updated ${minutes} min${minutes !== 1 ? 's' : ''} ago`;
            } else {
                const hours = Math.floor(diff / 3600000);
                timeText = `Updated ${hours} hour${hours !== 1 ? 's' : ''} ago`;
            }
            
            this.dom.updateInfo.textContent = timeText;
        },

        /**
         * Add conversation mode styles (filter out system messages)
         */
        addConversationModeStyles: function() {
            const styleId = 'conversation-mode-styles';
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Conversation Mode - Only show user and AI messages */
                .conversation-mode-enabled .log-message { 
                    display: none !important; 
                }
                
                /* Ensure user and AI messages are always visible */
                .conversation-mode-enabled .message {
                    display: flex !important;
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Add component styles
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .web-conversation-panel {
                    background-color: var(--color-background);
                }
                
                .command-item:hover {
                    background-color: #f1f3f5;
                    border-color: #dae0e5;
                    cursor: pointer;
                }
                
                /* Custom scrollbar for content area */
                .panel-content-area::-webkit-scrollbar {
                    width: 6px;
                }
                
                .panel-content-area::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .panel-content-area::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
                
                /* Plugin required note styling */
                .plugin-required-note {
                    padding: 15px; 
                    margin: 10px; 
                    background-color: #fff4e5;
                    border: 1px solid #ffcc80; 
                    border-radius: 5px;
                    color: #e65100; 
                    text-align: center; 
                    font-size: 0.9em; 
                    line-height: 1.4;
                }
                
                .plugin-required-note code {
                    background-color: #ffe0b2;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: monospace;
                    color: #c65a11;
                }
                
                .plugin-required-note strong {
                    color: #c65a11;
                }
            `;

            document.head.appendChild(style);
        },

        /**
         * Called when panel is opened
         */
        onPanelOpen: function() {
            this.checkInitialNewfilterState();
            this.updateLastUpdateTime();
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Remove event subscriptions
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];

            // Remove conversation mode if it was active
            if (Framework.dom.chatContainer && Framework.dom.chatContainer.classList.contains('conversation-mode-enabled')) {
                Framework.dom.chatContainer.classList.remove('conversation-mode-enabled');
            }

            // Remove styles
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) styleElement.remove();
            
            const conversationModeStyles = document.getElementById('conversation-mode-styles');
            if (conversationModeStyles) conversationModeStyles.remove();

            // Clear content
            if (this.dom.content) this.dom.content.innerHTML = '';

            console.log(`[${this.id}] Component cleaned up.`);
        }
    };

    // Register component with Framework
    Framework.registerComponent(component.id, component);
})();