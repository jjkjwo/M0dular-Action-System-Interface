/**
 * ==============================================================================================
 * Left Panel 6 - Remote File Connector Status
 * ==============================================================================================
 *
 * A panel that monitors the status of the legacy remote file connector utility.
 * Provides basic information about the connector without exposing sensitive details.
 * Only displays functional interface when the update action is active.
 *
 * @version 1.0.1 - Improved styling for narrow side panel, better status indicator
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-6',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            connectorContainer: null,
            statusIndicator: null,
            pathDisplay: null
        },

        // Component state
        state: {
            isUpdateActive: false,
            subscriptions: [],
            currentPath: null
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

            // Render basic panel structure
            this.renderContentStructure();

            // Subscribe to active actions changes
            const actionSubscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateConnectorState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: actionSubscription });

            // Subscribe to chat updates to detect path changes
            const chatSubscription = Framework.on('chatUpdated', (data) => {
                if (this.state.isUpdateActive && data?.messages?.length) {
                    this.checkForPathUpdates(data.messages);
                }
            });
            this.state.subscriptions.push({ event: 'chatUpdated', id: chatSubscription });

            // Check initial state on load
            this.checkInitialState();
            console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Check initial state of connector plugin
         */
        checkInitialState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    this.updateConnectorState(data?.actions || []);
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial state:`, error);
                    this.updateConnectorState([]); // Assume inactive on error
                });
        },

        /**
         * Update component state based on update active status
         * @param {Array} actions - Active actions array
         */
        updateConnectorState: function(actions = []) {
            const isActive = actions.some(action => {
                const [name] = String(action).split(':');
                return name.trim().toLowerCase() === 'update';
            });
            
            const stateChanged = this.state.isUpdateActive !== isActive;

            // Update state first
            this.state.isUpdateActive = isActive;

            // Update UI visibility
            this.updateUIVisibility();

            if (stateChanged) {
                console.log(`[${this.id}] Remote Connector Active State Changed: ${isActive}`);
            }
        },

        /**
         * Update visibility of note vs main container
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.isUpdateActive ? 'none' : 'block';
            }
            if (this.dom.connectorContainer) {
                this.dom.connectorContainer.style.display = this.state.isUpdateActive ? 'block' : 'none';
            }
            if (this.dom.statusIndicator) {
                this.dom.statusIndicator.textContent = this.state.isUpdateActive ? 'Connected' : 'Disconnected';
                this.dom.statusIndicator.className = `status-indicator ${this.state.isUpdateActive ? 'active' : 'inactive'}`;
            }
        },

        /**
         * Check for path updates in chat messages
         */
        checkForPathUpdates: function(messages) {
            // Search backwards through recent messages for path set confirmation
            for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
                const message = messages[i];
                if (typeof message !== 'string') continue;
                
                // Look for path set confirmation
                if (message.includes('[UPDATE ACTION: Local file path base set to:')) {
                    const match = message.match(/\[UPDATE ACTION: Local file path base set to: '(.+?)'/);
                    if (match && match[1]) {
                        const newPath = match[1];
                        if (this.state.currentPath !== newPath) {
                            this.state.currentPath = newPath;
                            this.updatePathDisplay();
                            console.log(`[${this.id}] Detected new path: ${newPath}`);
                        }
                        break;
                    }
                }
            }
        },

        /**
         * Update the path display in the UI
         */
        updatePathDisplay: function() {
            if (this.dom.pathDisplay) {
                if (this.state.currentPath) {
                    const obfuscatedPath = this.obfuscatePath(this.state.currentPath);
                    this.dom.pathDisplay.textContent = obfuscatedPath;
                    this.dom.pathDisplay.title = 'Local directory path is set';
                } else {
                    this.dom.pathDisplay.textContent = 'Not configured';
                    this.dom.pathDisplay.title = 'Use <path> command to set local directory';
                }
            }
        },

        /**
         * Obfuscate path to show limited information
         */
        obfuscatePath: function(path) {
            // Show only drive letter and number of directory levels
            if (!path) return 'Unknown';
            
            // Extract drive letter if present (Windows)
            let drivePart = '';
            if (path.match(/^[a-zA-Z]:/)) {
                drivePart = path.substring(0, 2) + '\\';
            }
            
            // Count directory levels
            const parts = path.split(/[\/\\]/).filter(Boolean);
            return `${drivePart}[${parts.length} director${parts.length === 1 ? 'y' : 'ies'}]`;
        },

        /**
         * Render the basic panel structure
         */
        renderContentStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear

            // --- Create Warning Note ---
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note';
            noteElement.innerHTML = `<strong>Legacy Connector Required</strong><br>Start the "update" plugin to enable remote file operations.<br><br><em>Example command:</em> <code>start update</code>`;
            noteElement.style.display = 'none'; // Initially hidden
            this.dom.noteElement = noteElement;
            this.dom.content.appendChild(noteElement);

            // --- Create Main Container ---
            const connectorContainer = document.createElement('div');
            connectorContainer.className = `${this.id}-main-container`;
            connectorContainer.style.display = 'none'; // Initially hidden
            this.dom.connectorContainer = connectorContainer;
            this.dom.content.appendChild(connectorContainer);

            // --- Create Panel Contents ---
            const content = document.createElement('div');
            content.className = 'connector-panel';

            // Status section
            const statusSection = document.createElement('div');
            statusSection.className = 'status-section control-section';

            const statusHeader = document.createElement('div');
            statusHeader.className = 'section-header';
            
            const statusTitle = document.createElement('h4');
            statusTitle.textContent = 'Remote Connector Status';
            statusTitle.className = 'section-title';
            statusHeader.appendChild(statusTitle);
            statusSection.appendChild(statusHeader);

            const statusContent = document.createElement('div');
            statusContent.className = 'section-content';
            
            const statusBox = document.createElement('div');
            statusBox.className = 'status-box';
            
            const statusLabel = document.createElement('span');
            statusLabel.className = 'status-label';
            statusLabel.textContent = 'Status:';
            statusBox.appendChild(statusLabel);

            const statusIndicator = document.createElement('span');
            statusIndicator.className = 'status-indicator';
            statusIndicator.textContent = 'Disconnected';
            this.dom.statusIndicator = statusIndicator;
            statusBox.appendChild(statusIndicator);
            
            statusContent.appendChild(statusBox);
            statusSection.appendChild(statusContent);
            content.appendChild(statusSection);

            // Path section
            const pathSection = document.createElement('div');
            pathSection.className = 'path-section control-section';

            const pathHeader = document.createElement('div');
            pathHeader.className = 'section-header';
            const pathTitle = document.createElement('h4');
            pathTitle.textContent = 'Local Directory';
            pathTitle.className = 'section-title';
            pathHeader.appendChild(pathTitle);
            pathSection.appendChild(pathHeader);

            const pathContent = document.createElement('div');
            pathContent.className = 'section-content';
            
            const pathDisplay = document.createElement('div');
            pathDisplay.className = 'path-display';
            pathDisplay.textContent = 'Not configured';
            this.dom.pathDisplay = pathDisplay;
            pathContent.appendChild(pathDisplay);

            const pathNote = document.createElement('div');
            pathNote.className = 'path-note';
            pathNote.innerHTML = 'Set with <code>&lt;path&gt;</code> command';
            pathContent.appendChild(pathNote);
            
            pathSection.appendChild(pathContent);
            content.appendChild(pathSection);

            // Command summary section
            const commandSection = document.createElement('div');
            commandSection.className = 'command-section control-section';

            const commandHeader = document.createElement('div');
            commandHeader.className = 'section-header';
            const commandTitle = document.createElement('h4');
            commandTitle.textContent = 'Available Commands';
            commandTitle.className = 'section-title';
            commandHeader.appendChild(commandTitle);
            commandSection.appendChild(commandHeader);

            const commandContent = document.createElement('div');
            commandContent.className = 'section-content';
            
            const commandList = document.createElement('div');
            commandList.className = 'command-list';
            commandList.innerHTML = `
                <div class="command-item">
                    <div class="command-name">&lt;path&gt;</div>
                    <div class="command-description">Set local directory path</div>
                </div>
                <div class="command-item">
                    <div class="command-name">&lt;update&gt;</div>
                    <div class="command-description">Send file to remote system</div>
                </div>
                <div class="command-item">
                    <div class="command-name">&lt;download&gt;</div>
                    <div class="command-description">Get file from remote system</div>
                </div>
            `;
            commandContent.appendChild(commandList);
            commandSection.appendChild(commandContent);
            content.appendChild(commandSection);

            // Note section (intentionally vague)
            const noteSection = document.createElement('div');
            noteSection.className = 'note-section control-section';

            const noteContent = document.createElement('div');
            noteContent.className = 'section-content note-content';
            noteContent.innerHTML = `
                <p class="note-text">Legacy connector established for maintenance purposes. 
                Use only when necessary and with appropriate authorization.</p>
                <p class="note-text caution">Consult documentation before use.</p>
            `;
            noteSection.appendChild(noteContent);
            content.appendChild(noteSection);

            connectorContainer.appendChild(content);

            // Add styles
            this.addStyles();
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
                /* Plugin Required Note */
                .plugin-required-note {
                    padding: 10px;
                    margin: 5px;
                    background-color: #fff4e5;
                    border: 1px solid #ffcc80;
                    border-radius: 4px;
                    color: #e65100;
                    text-align: center;
                    font-size: 0.85em;
                    line-height: 1.3;
                }
                .plugin-required-note strong {
                    display: block;
                    margin-bottom: 5px;
                    color: #e65100;
                }
                .plugin-required-note code {
                    background-color: #ffe0b2;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-family: monospace;
                    color: #c65a11;
                    font-size: 0.9em;
                }

                /* Panel Container */
                .${this.id}-main-container {
                    height: 100%;
                    width: 100%;
                    overflow-y: auto;
                    padding: 5px;
                    box-sizing: border-box;
                }
                .connector-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-bottom: 8px;
                }

                /* Section Styling */
                .control-section {
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #f9f9f9;
                    overflow: hidden;
                    width: 100%;
                    box-sizing: border-box;
                }
                .section-header {
                    padding: 6px 8px;
                    background-color: #e8f5e9;
                    border-bottom: 1px solid #c8e6c9;
                }
                .section-title {
                    margin: 0;
                    font-size: 0.95em;
                    color: #2e7d32;
                    font-weight: bold;
                    text-align: center;
                }
                .section-content {
                    padding: 8px;
                }

                /* Status Box and Indicator */
                .status-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background-color: #f5f5f5;
                    padding: 6px 8px;
                    border-radius: 4px;
                    border: 1px solid #e0e0e0;
                }
                .status-label {
                    font-weight: bold;
                    font-size: 0.9em;
                    color: #555;
                }
                .status-indicator {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 12px;
                    font-size: 0.85em;
                    font-weight: bold;
                    text-align: center;
                    min-width: 80px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .status-indicator.active {
                    background-color: #4caf50;
                    color: white;
                    border: 1px solid #43a047;
                }
                .status-indicator.inactive {
                    background-color: #f44336;
                    color: white;
                    border: 1px solid #e53935;
                }

                /* Path Display */
                .path-display {
                    font-family: monospace;
                    background-color: #f5f5f5;
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid #e0e0e0;
                    margin-bottom: 6px;
                    word-break: break-all;
                    font-size: 0.85em;
                    color: #555;
                }
                .path-note {
                    font-size: 0.8em;
                    color: #666;
                    font-style: italic;
                    text-align: center;
                }
                .path-note code {
                    background-color: #f0f0f0;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-family: monospace;
                }

                /* Command List */
                .command-list {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .command-item {
                    display: flex;
                    flex-direction: column;
                    background-color: #f5f5f5;
                    border-radius: 4px;
                    padding: 5px 8px;
                    border-left: 3px solid #4a76a8;
                }
                .command-name {
                    font-family: monospace;
                    font-weight: bold;
                    color: #4a76a8;
                    font-size: 0.85em;
                    margin-bottom: 2px;
                }
                .command-description {
                    font-size: 0.8em;
                    color: #555;
                }

                /* Note Section */
                .note-content {
                    background-color: #f5f5f5;
                    padding: 6px 8px;
                    border-radius: 4px;
                }
                .note-text {
                    margin: 0 0 6px 0;
                    font-size: 0.8em;
                    color: #555;
                    line-height: 1.3;
                }
                .note-text:last-child {
                    margin-bottom: 0;
                }
                .note-text.caution {
                    color: #d32f2f;
                    font-weight: bold;
                    text-align: center;
                }
            `;
            document.head.appendChild(style);
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];

            // Remove styles
            const style = document.getElementById(`${this.id}-styles`);
            if (style) style.remove();

            console.log(`[${this.id}] Cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();