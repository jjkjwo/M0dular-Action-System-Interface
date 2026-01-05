/**
 * ==============================================================================================
 * Bottom Panel 6 - Dirt Action Interface (Redesigned)
 * ==============================================================================================
 *
 * Provides UI controls for the dirt.py action module with a modern, compact design that
 * matches the system theme. Panel is only visible when the action is active.
 *
 * @version 2.2.3 - Panel now hidden when action is inactive
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-6',

        // DOM references
        dom: {
            content: null,
            statusContainer: null,
            controlsContainer: null,
            infoContainer: null,
            toggleButton: null,
            statusText: null,
            commandExample: null
        },

        // Component state
        state: {
            isDirtActionActive: false,
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }

            // Create the base panel structure
            this.renderPanel();

            // Subscribe to active actions updates
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateActionState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: subscription });

            // Check initial state
            this.checkInitialState();
            
            console.log(`[${this.id}] Initialization complete`);
        },

        /**
         * Fetch initial active actions to set state
         */
        checkInitialState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    this.updateActionState(data?.actions || []);
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial state:`, error);
                    this.updateActionState([]);
                });
        },

        /**
         * Update the state based on active actions
         */
        updateActionState: function(actions = []) {
            const isActive = actions.some(action => action.split(':')[0].trim().toLowerCase() === 'dirt');
            
            // Only update UI if state changed
            if (this.state.isDirtActionActive !== isActive) {
                this.state.isDirtActionActive = isActive;
                this.updateUI();
                console.log(`[${this.id}] Dirt action state changed to: ${isActive}`);
            }
        },

        /**
         * Render the main panel content
         */
        renderPanel: function() {
            if (!this.dom.content) return;
            
            // Clear existing content
            this.dom.content.innerHTML = '';
            
            // Create container with proper CSS
            const container = document.createElement('div');
            container.className = 'dirt-panel';
            
            // Add panel header (grey area)
            const panelHeader = document.createElement('div');
            panelHeader.className = 'panel-header-info';
            panelHeader.innerHTML = '<h4 class="panel-title"><span class="panel-icon">💥</span> Dirt Action Controls</h4>';
            container.appendChild(panelHeader);
            
            // Create status section
            const statusContainer = document.createElement('div');
            statusContainer.className = 'panel-section status-section';
            
            const statusContent = document.createElement('div');
            statusContent.className = 'section-content status-content';
            
            // Status text - inline with button
            const statusText = document.createElement('div');
            statusText.className = 'status-text';
            statusContent.appendChild(statusText);
            this.dom.statusText = statusText;
            
            // Toggle button
            const toggleButton = document.createElement('button');
            toggleButton.className = 'action-toggle-button';
            toggleButton.addEventListener('click', () => this.toggleAction());
            statusContent.appendChild(toggleButton);
            this.dom.toggleButton = toggleButton;
            
            statusContainer.appendChild(statusContent);
            container.appendChild(statusContainer);
            this.dom.statusContainer = statusContainer;
            
            // Create info section
            const infoContainer = document.createElement('div');
            infoContainer.className = 'panel-section info-section';
            
            const infoContent = document.createElement('div');
            infoContent.className = 'section-content';
            infoContent.innerHTML = `
                <div class="info-card">
                    <div class="info-item">
                        <span class="info-icon">💬</span>
                        <div class="info-description">Makes AI responses more informal, casual, and edgy</div>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">⚙️</span>
                        <div class="info-description">Priority 9 action (high priority)</div>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">🔄</span>
                        <div class="info-description">Toggle on/off with <code>dirton</code> and <code>dirtoff</code> commands</div>
                    </div>
                </div>
            `;
            
            // Command example
            const commandExample = document.createElement('div');
            commandExample.className = 'command-example';
            infoContent.appendChild(commandExample);
            this.dom.commandExample = commandExample;
            
            infoContainer.appendChild(infoContent);
            container.appendChild(infoContainer);
            this.dom.infoContainer = infoContainer;
            
            // Create inactive message
            const inactiveMessage = document.createElement('div');
            inactiveMessage.className = 'inactive-message';
            inactiveMessage.innerHTML = `
                <div class="message-icon">💥</div>
                <div class="message-text">
                    <h3>Dirt Action Inactive</h3>
                    <p>Type <code>start dirt</code> in chat to activate.</p>
                </div>
            `;
            
            // Add the elements to the panel
            this.dom.content.appendChild(container);
            this.dom.content.appendChild(inactiveMessage);
            
            // Add styles
            this.addStyles();
            
            // Update UI with initial state
            this.updateUI();
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
                .dirt-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    height: 100%;
                    overflow-y: auto;
                }
                
                /* Panel header */
                .panel-header-info {
                    flex-shrink: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background-color: #e9ecef;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .panel-title {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #343a40;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .panel-icon {
                    font-size: 16px;
                }
                
                .panel-section {
                    border-radius: 0;
                    border: none;
                    border-bottom: 1px solid #e0e0e0;
                    background-color: white;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    padding: 0;
                }
                
                .section-content {
                    padding: 12px;
                    overflow-y: auto;
                }
                
                /* Status section - horizontal layout */
                .status-content {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    min-height: 40px;
                }
                
                .status-text {
                    font-weight: 500;
                    font-size: 14px;
                    color: #e65100;
                }
                
                .action-toggle-button {
                    padding: 6px 12px;
                    border-radius: 4px;
                    border: none;
                    color: white;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    flex-shrink: 0;
                    margin-left: 10px;
                    background-color: #f44336;
                }
                
                .action-toggle-button:hover {
                    opacity: 0.9;
                }
                
                /* Info section */
                .info-card {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .info-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    font-size: 13px;
                    line-height: 1.4;
                }
                
                .info-icon {
                    flex-shrink: 0;
                    font-size: 16px;
                }
                
                .info-description {
                    flex: 1;
                    min-width: 0;
                }
                
                .command-example {
                    margin-top: 12px;
                    padding: 10px;
                    border-radius: 5px;
                    border-left: 3px solid #ff9800;
                    background-color: #fff8e1;
                    font-size: 13px;
                }
                
                .command-example code {
                    padding: 2px 4px;
                    background-color: rgba(255, 255, 255, 0.5);
                    border-radius: 3px;
                    font-family: monospace;
                }
                
                /* Inactive message */
                .inactive-message {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    height: 100%;
                    padding: 20px;
                    background-color: #f8f9fa;
                    color: #6c757d;
                }
                
                .inactive-message .message-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
                
                .inactive-message h3 {
                    margin: 0 0 10px 0;
                    font-size: 18px;
                    color: #495057;
                }
                
                .inactive-message p {
                    margin: 0;
                    font-size: 14px;
                }
                
                .inactive-message code {
                    padding: 2px 5px;
                    background-color: #e9ecef;
                    border-radius: 3px;
                    font-family: monospace;
                }
                
                /* Responsive styles */
                @media (max-width: 640px) {
                    .panel-title {
                        font-size: 13px;
                    }
                    
                    .panel-icon {
                        font-size: 14px;
                    }
                    
                    .section-content {
                        padding: 10px;
                    }
                    
                    .info-item {
                        font-size: 12px;
                    }
                    
                    .inactive-message .message-icon {
                        font-size: 36px;
                    }
                    
                    .inactive-message h3 {
                        font-size: 16px;
                    }
                    
                    .inactive-message p {
                        font-size: 13px;
                    }
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Update UI elements based on current state
         */
        updateUI: function() {
            const isActive = this.state.isDirtActionActive;
            const panelContainer = this.dom.content.querySelector('.dirt-panel');
            const inactiveMessage = this.dom.content.querySelector('.inactive-message');
            
            // Show panel or inactive message based on action state
            if (panelContainer && inactiveMessage) {
                if (isActive) {
                    panelContainer.style.display = 'flex';
                    inactiveMessage.style.display = 'none';
                } else {
                    panelContainer.style.display = 'none';
                    inactiveMessage.style.display = 'flex';
                }
            }
            
            // If active, update the actual panel content
            if (isActive) {
                // Update status text
                if (this.dom.statusText) {
                    this.dom.statusText.textContent = 'Dirt Action is ACTIVE';
                }
                
                // Update toggle button
                if (this.dom.toggleButton) {
                    this.dom.toggleButton.textContent = 'Stop Dirt Action';
                    this.dom.toggleButton.title = 'Sends "stop dirt" to chat';
                }
                
                // Update command example
                if (this.dom.commandExample) {
                    this.dom.commandExample.innerHTML = '<strong>Current Mode:</strong> Type <code>dirtoff</code> in chat to temporarily disable the dirt effect while keeping the action running.';
                }
            }
        },

        /**
         * Toggle the Dirt action by sending the command to chat
         */
        toggleAction: function() {
            const command = this.state.isDirtActionActive ? 'stop dirt' : 'start dirt';
            
            try {
                // Get the user input element
                const userInput = document.getElementById('userInput');
                if (!userInput) {
                    Framework.showToast('Error: Cannot find input field.', 3000);
                    return;
                }
                
                // Set the command in the input field
                userInput.value = command;
                userInput.focus();
                userInput.dispatchEvent(new Event('input'));
                
                // Find and click the send button
                const sendButton = document.querySelector('.send-button') || 
                                  document.querySelector('button[type="submit"]') ||
                                  document.getElementById('sendButton');
                                  
                if (sendButton) {
                    // Click the send button
                    sendButton.click();
                } else {
                    // If we can't find a button, try using the Framework function as a fallback
                    if (typeof Framework.sendMessage === 'function') {
                        Framework.sendMessage();
                    } else {
                        // As a last resort, try to submit the form
                        const form = userInput.closest('form');
                        if (form) {
                            form.submit();
                        } else {
                            throw new Error('Could not find a way to submit the message');
                        }
                    }
                }
                
                // Show toast as feedback
                Framework.showToast(`Sending: ${command}`, 1500);
            } catch (error) {
                console.error(`[${this.id}] Error sending command:`, error);
                Framework.showToast(`Error sending "${command}" command`, 3000);
            }
        },

        /**
         * Clean up resources
         */
        cleanup: function() {
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => Framework.off(sub.event, sub.id));
            this.state.subscriptions = [];
            
            // Remove styles
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) styleElement.remove();
            
            console.log(`[${this.id}] Cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();