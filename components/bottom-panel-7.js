/**
 * ==============================================================================================
 * Bottom Panel 7 - Dynamic Persona (X) Action Interface (Redesigned)
 * ==============================================================================================
 *
 * Provides UI controls for the x.py action module with a modern, compact design that 
 * matches the system theme. Panel is only visible when the action is active.
 *
 * @version 2.2.3 - Panel now hidden when action is inactive
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-7',

        // DOM references
        dom: {
            content: null,
            statusContainer: null,
            personaDisplay: null,
            infoContainer: null,
            toggleButton: null,
            statusText: null,
            personaList: null
        },

        // Component state
        state: {
            isXActionActive: false,
            currentPersonaDetails: null,
            subscriptions: [],
            potentialPersonas: [
                "Philosopher", "Artist", "Mad Scientist", "Zen Master", "Childlike Explorer",
                "Historical Scientist", "Code Poet", "Abstract Thinker", "Grungy Detective",
                "Dusty Grifter", "Rebellious Hacker", "Cynical Comedian", "Space Pirate", "Time Traveler",
                "Surrealist Painter", "蒸汽波 Vaporwave Dreamer", "Stoic Warrior", "Quantum Observer"
            ]
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
         * Update state based on active actions list
         */
        updateActionState: function(actions = []) {
            let isActive = false;
            let currentDetails = null;
            const xActionEntry = actions.find(action => action.split(':')[0].trim().toLowerCase() === 'x');

            if (xActionEntry) {
                isActive = true;
                // Parse details from the action string, e.g., "x:Philosopher:0.8"
                const parts = xActionEntry.split(':');
                if (parts.length >= 3) {
                    currentDetails = {
                        name: parts[1].trim(),
                        intensity: parts[2].trim()
                    };
                } else if (parts.length === 2) {
                    currentDetails = {
                        name: parts[1].trim(),
                        intensity: '?' // Indicate unknown intensity
                    };
                }
            }

            // Only update if state changed
            if (this.state.isXActionActive !== isActive || 
                JSON.stringify(this.state.currentPersonaDetails) !== JSON.stringify(currentDetails)) {
                
                this.state.isXActionActive = isActive;
                this.state.currentPersonaDetails = currentDetails;
                this.updateUI();
                console.log(`[${this.id}] X action state changed to: ${isActive}`);
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
            container.className = 'persona-panel';
            
            // Add panel header (grey area)
            const panelHeader = document.createElement('div');
            panelHeader.className = 'panel-header-info';
            panelHeader.innerHTML = '<h4 class="panel-title"><span class="panel-icon">🎭</span> Dynamic Persona Controls</h4>';
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
            
            // Persona display - shows current persona when active
            const personaDisplay = document.createElement('div');
            personaDisplay.className = 'persona-display';
            container.appendChild(personaDisplay);
            this.dom.personaDisplay = personaDisplay;
            
            // Create info section
            const infoContainer = document.createElement('div');
            infoContainer.className = 'panel-section info-section';
            
            const infoContent = document.createElement('div');
            infoContent.className = 'section-content';
            infoContent.innerHTML = `
                <div class="info-card">
                    <div class="info-item">
                        <span class="info-icon">🎭</span>
                        <div class="info-description">Randomly assigns AI personas with varying intensity levels</div>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">⚙️</span>
                        <div class="info-description">Priority 5 action (medium priority)</div>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">🔄</span>
                        <div class="info-description">Changes persona each time the action runs</div>
                    </div>
                </div>
                
                <div class="persona-list-title">Potential Personas:</div>
                <div class="persona-list"></div>
            `;
            
            infoContainer.appendChild(infoContent);
            container.appendChild(infoContainer);
            this.dom.infoContainer = infoContainer;
            
            // Create inactive message
            const inactiveMessage = document.createElement('div');
            inactiveMessage.className = 'inactive-message';
            inactiveMessage.innerHTML = `
                <div class="message-icon">🎭</div>
                <div class="message-text">
                    <h3>Dynamic Persona Inactive</h3>
                    <p>Type <code>start x</code> in chat to activate.</p>
                </div>
            `;
            
            // Add the elements to the panel
            this.dom.content.appendChild(container);
            this.dom.content.appendChild(inactiveMessage);
            
            // Populate persona list
            const personaListElement = infoContent.querySelector('.persona-list');
            this.dom.personaList = personaListElement;
            this.renderPersonaList();
            
            // Add styles
            this.addStyles();
            
            // Update UI with initial state
            this.updateUI();
        },

        /**
         * Render persona list chips
         */
        renderPersonaList: function() {
            if (!this.dom.personaList) return;
            
            this.dom.personaList.innerHTML = '';
            
            this.state.potentialPersonas.forEach(persona => {
                const chip = document.createElement('span');
                chip.className = 'persona-chip';
                chip.textContent = persona;
                this.dom.personaList.appendChild(chip);
            });
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
                .persona-panel {
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
                    color: #6a1b9a;
                }
                
                /* Persona display - moved outside the status section */
                .persona-display {
                    margin: 0;
                    padding: 10px 12px;
                    background-color: #f3e5f5;
                    border-top: none;
                    border-bottom: 1px solid #e0e0e0;
                    display: none;
                }
                
                .persona-display.active {
                    display: block;
                }
                
                .persona-name {
                    font-weight: bold;
                    font-size: 16px;
                    color: #6a1b9a;
                    margin-bottom: 5px;
                }
                
                .persona-intensity {
                    font-size: 13px;
                    color: #555;
                }
                
                .intensity-bar {
                    height: 6px;
                    background-color: #e0e0e0;
                    border-radius: 3px;
                    margin-top: 5px;
                    overflow: hidden;
                }
                
                .intensity-fill {
                    height: 100%;
                    background-color: #8e24aa;
                    width: 0%;
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
                    margin-bottom: 15px;
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
                
                .persona-list-title {
                    font-weight: bold;
                    margin: 12px 0 8px 0;
                    font-size: 13px;
                    color: #555;
                }
                
                .persona-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    max-height: 120px;
                    overflow-y: auto;
                }
                
                .persona-chip {
                    font-size: 12px;
                    padding: 3px 8px;
                    background-color: #f3e5f5;
                    border: 1px solid #e1bee7;
                    border-radius: 12px;
                    color: #6a1b9a;
                    white-space: nowrap;
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
                    
                    .persona-list {
                        max-height: 80px;
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
            const isActive = this.state.isXActionActive;
            const personaDetails = this.state.currentPersonaDetails;
            const panelContainer = this.dom.content.querySelector('.persona-panel');
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
                    this.dom.statusText.textContent = 'Dynamic Persona is ACTIVE';
                }
                
                // Update toggle button
                if (this.dom.toggleButton) {
                    this.dom.toggleButton.textContent = 'Stop Dynamic Persona';
                    this.dom.toggleButton.title = 'Sends "stop x" to chat';
                }
                
                // Update persona display
                if (this.dom.personaDisplay && personaDetails) {
                    this.dom.personaDisplay.className = 'persona-display active';
                    
                    // Calculate intensity percentage for visualization
                    let intensityPercent = 50; // Default to middle
                    if (personaDetails.intensity !== '?') {
                        const intensity = parseFloat(personaDetails.intensity);
                        if (!isNaN(intensity)) {
                            intensityPercent = Math.min(100, Math.max(0, intensity * 100));
                        }
                    }
                    
                    this.dom.personaDisplay.innerHTML = `
                        <div class="persona-name">${personaDetails.name || 'Unknown'}</div>
                        <div class="persona-intensity">Intensity: ${personaDetails.intensity || '?'}</div>
                        <div class="intensity-bar">
                            <div class="intensity-fill" style="width: ${intensityPercent}%;"></div>
                        </div>
                    `;
                }
            }
        },

        /**
         * Toggle the X action by sending the command to chat
         */
        toggleAction: function() {
            const command = this.state.isXActionActive ? 'stop x' : 'start x';
            
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