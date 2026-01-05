/**
 * right-panel-1.js - Persona Manager Component
 * 
 * This component handles viewing, selecting, and managing AI personas.
 * It displays personas from personas.json and allows users to activate them.
 * 
 * @version 1.0.0
 */
(function() {
    const PersonaManagerComponent = {
        id: 'right-panel-1',
        
        dom: {
            content: null,
            personaList: null,
            personaDetails: null,
            createForm: null,
            statusMessage: null
        },
        
        state: {
            personas: [],
            personasData: {}, // Store the full personas data
            activePersona: null,
            selectedPersona: null,
            isEditing: false,
            isCreating: false,
            subscriptions: []
        },
        
        initialize: function() {
            console.log(`[${this.id}] Initializing Persona Manager...`);
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }
            
            // Build the initial UI structure
            this.renderUI();
            
            // Load personas from the JSON file
            this.loadPersonas();
            
            // Check for active persona
            this.checkActivePersona();
            
            // Set up event listeners
            this.setupEventListeners();
            
            console.log(`[${this.id}] Initialization complete`);
        },
        
        renderUI: function() {
            // Create the main UI structure with a compact, vertical layout
            this.dom.content.innerHTML = `
                <div class="persona-manager">
                    <div class="persona-section">
                        <div class="section-header">
                            <h3 class="section-title">Available Personas</h3>
                            <div class="section-controls">
                                <button id="${this.id}-refresh-btn" class="icon-button" title="Refresh persona list">
                                    🔄
                                </button>
                                <button id="${this.id}-create-btn" class="icon-button" title="Create new persona">
                                    ➕
                                </button>
                            </div>
                        </div>
                        
                        <div class="active-persona-indicator">
                            <span class="label">Active:</span>
                            <span id="${this.id}-active-persona" class="value">None</span>
                        </div>
                        
                        <div id="${this.id}-persona-list" class="persona-list">
                            <div class="loading-message">Loading personas...</div>
                        </div>
                    </div>
                    
                    <div id="${this.id}-persona-details" class="persona-details">
                        <div class="no-selection-message">Select a persona to view details</div>
                    </div>
                    
                    <div id="${this.id}-create-form" class="create-form" style="display: none;">
                        <h3>Create New Persona</h3>
                        <div class="form-row">
                            <label for="${this.id}-persona-name">Name:</label>
                            <input type="text" id="${this.id}-persona-name" placeholder="persona_id">
                        </div>
                        <div class="form-row">
                            <label for="${this.id}-persona-display-name">Display Name:</label>
                            <input type="text" id="${this.id}-persona-display-name" placeholder="Display Name">
                        </div>
                        <div class="form-row">
                            <label for="${this.id}-persona-description">Description:</label>
                            <input type="text" id="${this.id}-persona-description" placeholder="Brief description">
                        </div>
                        <div class="form-row">
                            <label for="${this.id}-persona-prompt">System Prompt:</label>
                            <textarea id="${this.id}-persona-prompt" rows="6" placeholder="Enter the system prompt that defines the persona's behavior"></textarea>
                        </div>
                        <div class="form-buttons">
                            <button id="${this.id}-cancel-create" class="cancel-button">Cancel</button>
                            <button id="${this.id}-save-persona" class="action-button">Save Persona</button>
                        </div>
                    </div>
                    
                    <div id="${this.id}-status-message" class="status-message"></div>
                </div>
            `;
            
            // Cache DOM elements for later use
            this.dom.personaList = document.getElementById(`${this.id}-persona-list`);
            this.dom.personaDetails = document.getElementById(`${this.id}-persona-details`);
            this.dom.createForm = document.getElementById(`${this.id}-create-form`);
            this.dom.statusMessage = document.getElementById(`${this.id}-status-message`);
            this.dom.activePersonaIndicator = document.getElementById(`${this.id}-active-persona`);
            
            // Add styles specific to this panel
            this.addStyles();
        },
        
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .persona-manager {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .section-title {
                    margin: 0;
                    font-size: 1em;
                    color: var(--color-primary, #4a76a8);
                }
                
                .section-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .icon-button {
                    background: none;
                    border: none;
                    font-size: 1em;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                
                .icon-button:hover {
                    background-color: var(--color-background, #f5f5f5);
                }
                
                .active-persona-indicator {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 0.85em;
                    padding: 4px 6px;
                    background-color: var(--color-secondary, #f0f8ff);
                    border-radius: 4px;
                }
                
                .active-persona-indicator .label {
                    font-weight: bold;
                    margin-right: 4px;
                }
                
                .active-persona-indicator .value {
                    color: var(--color-primary, #4a76a8);
                    font-weight: bold;
                }
                
                .persona-list {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    overflow-y: auto;
                    max-height: 70%;
                    margin-bottom: 10px;
                    padding-right: 3px;
                    width: 100%;
                }
                
                .persona-item {
                    display: flex;
                    flex-direction: column;
                    padding: 8px;
                    border-radius: 4px;
                    background-color: var(--color-background, #f5f5f5);
                    border: 1px solid var(--color-border, #e0e0e0);
                    cursor: pointer;
                    transition: background-color 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                    margin-bottom: 5px;
                }
                
                .persona-item:hover {
                    background-color: var(--color-secondary, #f0f8ff);
                }
                
                .persona-item.selected {
                    background-color: var(--color-primary-light, #e3f2fd);
                    border-color: var(--color-primary, #4a76a8);
                }
                
                .persona-item.active {
                    background-color: rgba(76, 175, 80, 0.15);
                    border-color: #4caf50;
                }
                
                .persona-item.selected.active {
                    background-color: rgba(76, 175, 80, 0.25);
                    border-color: #4caf50;
                }
                
                .persona-name {
                    font-weight: bold;
                    font-size: 0.9em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                    margin-bottom: 4px;
                }
                
                .persona-actions {
                    display: flex;
                    gap: 3px;
                    align-self: flex-end;
                }
                
                .persona-actions button {
                    background: none;
                    border: none;
                    font-size: 0.85em;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 3px;
                    opacity: 0.7;
                }
                
                .persona-actions button:hover {
                    opacity: 1;
                    background-color: rgba(0, 0, 0, 0.05);
                }
                
                .persona-details {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 10px;
                    background-color: var(--color-secondary, #f0f8ff);
                    border-radius: 4px;
                    border: 1px solid var(--color-border, #e0e0e0);
                    overflow-y: auto;
                    flex: 1;
                }
                
                .no-selection-message {
                    color: var(--color-text-light, #666);
                    font-style: italic;
                    text-align: center;
                    padding: 20px 0;
                }
                
                .detail-section {
                    margin-bottom: 8px;
                }
                
                .detail-title {
                    font-weight: bold;
                    font-size: 0.85em;
                    margin-bottom: 3px;
                    color: var(--color-primary, #4a76a8);
                }
                
                .detail-content {
                    background-color: white;
                    padding: 8px;
                    border-radius: 3px;
                    border: 1px solid var(--color-border-light, #f0f0f0);
                    font-size: 0.85em;
                    overflow-wrap: break-word;
                    word-break: break-word;
                    line-height: 1.4;
                }
                
                .action-button {
                    background-color: var(--color-primary, #4a76a8);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 0.85em;
                    font-weight: bold;
                }
                
                .action-button:hover {
                    background-color: var(--color-primary-dark, #2c4a6b);
                }
                
                .action-button:disabled {
                    background-color: var(--color-text-lighter, #999);
                    cursor: not-allowed;
                }
                
                .detail-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 5px;
                }
                
                .create-form {
                    background-color: var(--color-secondary, #f0f8ff);
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid var(--color-border, #e0e0e0);
                    margin-bottom: 10px;
                }
                
                .create-form h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-size: 0.95em;
                    color: var(--color-primary, #4a76a8);
                }
                
                .form-row {
                    margin-bottom: 8px;
                }
                
                .form-row label {
                    display: block;
                    font-size: 0.85em;
                    margin-bottom: 3px;
                    font-weight: bold;
                }
                
                .form-row input,
                .form-row textarea {
                    width: 100%;
                    padding: 6px;
                    border-radius: 3px;
                    border: 1px solid var(--color-border, #e0e0e0);
                    font-size: 0.85em;
                    box-sizing: border-box;
                }
                
                .form-row textarea {
                    resize: vertical;
                    min-height: 80px;
                }
                
                .form-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 10px;
                }
                
                .cancel-button {
                    background-color: var(--color-background, #f5f5f5);
                    border: 1px solid var(--color-border, #e0e0e0);
                    color: var(--color-text, #333333);
                    border-radius: 4px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 0.85em;
                }
                
                .cancel-button:hover {
                    background-color: var(--color-border, #e0e0e0);
                }
                
                .status-message {
                    font-size: 0.85em;
                    margin-top: 10px;
                    min-height: 20px;
                    text-align: center;
                    color: var(--color-primary, #4a76a8);
                }
                
                .loading-message {
                    color: var(--color-text-light, #666);
                    font-style: italic;
                    text-align: center;
                    padding: 10px 0;
                }
                
                .error-message {
                    color: #d32f2f;
                    background-color: #ffebee;
                    padding: 5px 8px;
                    border-radius: 3px;
                }
                
                .success-message {
                    color: #2e7d32;
                    background-color: #e8f5e9;
                    padding: 5px 8px;
                    border-radius: 3px;
                }
            `;
            
            document.head.appendChild(style);
        },
        
        loadPersonas: function() {
            // First, check if there's a cached personas list available from the Framework
            if (typeof Framework === 'object' && Framework.modules?.personas) {
                this.state.personas = Framework.modules.personas;
                this.renderPersonaList();
                return;
            }
            
            // Otherwise, fetch personas directly from personas.json
            fetch('personas.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load personas');
                    }
                    return response.json();
                })
                .then(data => {
                    // The personas.json file is a direct object with persona IDs as keys
                    // We need to extract the persona names from the keys
                    if (data && typeof data === 'object') {
                        this.state.personasData = data; // Store full personas data
                        this.state.personas = Object.keys(data);
                        
                        // Cache personas in Framework for potential reuse
                        if (typeof Framework === 'object' && !Framework.modules) {
                            Framework.modules = {};
                        }
                        if (typeof Framework === 'object' && Framework.modules) {
                            Framework.modules.personas = this.state.personas;
                        }
                        
                        this.renderPersonaList();
                    } else {
                        throw new Error('Invalid personas data format');
                    }
                })
                .catch(error => {
                    console.error(`[${this.id}] Error loading personas:`, error);
                    if (this.dom.personaList) {
                        this.dom.personaList.innerHTML = `
                            <div class="error-message">
                                Error loading personas: ${error.message}
                            </div>
                        `;
                    }
                });
        },
        
        checkActivePersona: function() {
            fetch(CONFIG.api.personas + '/active')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to check active persona');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        this.state.activePersona = data.active_persona;
                        this.updateActivePersonaIndicator();
                        
                        // Update the persona list to highlight the active persona
                        this.renderPersonaList();
                    }
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking active persona:`, error);
                });
        },
        
        updateActivePersonaIndicator: function() {
            if (this.dom.activePersonaIndicator) {
                this.dom.activePersonaIndicator.textContent = this.state.activePersona || 'None';
            }
        },
        
        renderPersonaList: function() {
            if (!this.dom.personaList) return;
            
            if (!this.state.personas || this.state.personas.length === 0) {
                this.dom.personaList.innerHTML = `
                    <div class="error-message">No personas available</div>
                `;
                return;
            }
            
            let html = '';
            this.state.personas.forEach(personaName => {
                const isActive = personaName === this.state.activePersona;
                const isSelected = personaName === this.state.selectedPersona;
                let classes = 'persona-item';
                if (isActive) classes += ' active';
                if (isSelected) classes += ' selected';
                
                html += `
                    <div class="${classes}" data-persona="${personaName}">
                        <span class="persona-name">${personaName}</span>
                        <div class="persona-actions">
                            <button class="use-persona-btn" title="Use this persona" data-persona="${personaName}">
                                ${isActive ? '✓' : '▶'}
                            </button>
                            <button class="delete-persona-btn" title="Delete persona" data-persona="${personaName}">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
            
            this.dom.personaList.innerHTML = html;
            
            // Add event listeners to the persona items
            document.querySelectorAll('.persona-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('use-persona-btn') || 
                        e.target.classList.contains('delete-persona-btn')) {
                        // Button click is handled in the button event listeners
                        return;
                    }
                    
                    const personaName = item.getAttribute('data-persona');
                    this.selectPersona(personaName);
                });
            });
            
            // Add event listeners to the buttons
            document.querySelectorAll('.use-persona-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const personaName = btn.getAttribute('data-persona');
                    this.activatePersona(personaName);
                });
            });
            
            document.querySelectorAll('.delete-persona-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const personaName = btn.getAttribute('data-persona');
                    this.confirmDeletePersona(personaName);
                });
            });
        },
        
        selectPersona: function(personaName) {
            this.state.selectedPersona = personaName;
            
            // Update UI to show the selected persona
            document.querySelectorAll('.persona-item').forEach(item => {
                const itemPersona = item.getAttribute('data-persona');
                if (itemPersona === personaName) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            
            // Load and display persona details directly from our stored data
            this.loadPersonaDetails(personaName);
        },
        
        loadPersonaDetails: function(personaName) {
            if (!this.dom.personaDetails) return;
            
            this.dom.personaDetails.innerHTML = `
                <div class="loading-message">Loading persona details...</div>
            `;
            
            // Get details directly from the stored personas data
            if (this.state.personasData && this.state.personasData[personaName]) {
                const details = this.state.personasData[personaName];
                this.renderPersonaDetails(personaName, details);
            } else {
                // If we don't have the data yet, fetch the personas.json again
                fetch('personas.json')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to load persona details');
                        }
                        return response.json();
                    })
                    .then(data => {
                        this.state.personasData = data; // Update our stored data
                        
                        if (data[personaName]) {
                            this.renderPersonaDetails(personaName, data[personaName]);
                        } else {
                            throw new Error(`Persona "${personaName}" not found in data`);
                        }
                    })
                    .catch(error => {
                        console.error(`[${this.id}] Error loading persona details:`, error);
                        this.dom.personaDetails.innerHTML = `
                            <div class="error-message">
                                Error loading details: ${error.message}
                            </div>
                        `;
                    });
            }
        },
        
        renderPersonaDetails: function(personaName, details) {
            if (!this.dom.personaDetails) return;
            
            const isActive = personaName === this.state.activePersona;
            
            let html = `
                <div class="detail-section">
                    <div class="detail-title">Name</div>
                    <div class="detail-content">${details.name || personaName}</div>
                </div>
                
                <div class="detail-section">
                    <div class="detail-title">Description</div>
                    <div class="detail-content">${details.description || 'No description provided'}</div>
                </div>
                
                <div class="detail-section">
                    <div class="detail-title">System Prompt</div>
                    <div class="detail-content">${details.system_prompt || 'No system prompt provided'}</div>
                </div>
                
                <div class="detail-actions">
                    <button class="action-button use-persona-btn" ${isActive ? 'disabled' : ''}>
                        ${isActive ? 'Currently Active' : 'Activate Persona'}
                    </button>
                </div>
            `;
            
            this.dom.personaDetails.innerHTML = html;
            
            // Add event listener to the activate button
            const activateBtn = this.dom.personaDetails.querySelector('.use-persona-btn');
            if (activateBtn && !isActive) {
                activateBtn.addEventListener('click', () => {
                    this.activatePersona(personaName);
                });
            }
        },
        
        activatePersona: function(personaName) {
            // Simulate sending a command to activate the persona
            this.showStatus('Activating persona...', 'loading');
            
            // Create a command and send it to the chat input
            this.executeCommand(`persona use ${personaName}`, () => {
                // Update state after command is sent
                this.state.activePersona = personaName;
                this.updateActivePersonaIndicator();
                this.renderPersonaList();
                
                // If details are open for this persona, refresh them
                if (this.state.selectedPersona === personaName) {
                    this.loadPersonaDetails(personaName);
                }
                
                this.showStatus(`Persona "${personaName}" activated!`, 'success');
            });
        },
        
        confirmDeletePersona: function(personaName) {
            // Skip confirmation for built-in personas
            if (['default', 'technical', 'creative'].includes(personaName)) {
                this.showStatus(`Cannot delete built-in persona "${personaName}"`, 'error');
                return;
            }
            
            // Confirm deletion with the user
            if (confirm(`Are you sure you want to delete the persona "${personaName}"? This cannot be undone.`)) {
                this.deletePersona(personaName);
            }
        },
        
        deletePersona: function(personaName) {
            this.showStatus('Deleting persona...', 'loading');
            
            // Create a command and send it
            this.executeCommand(`persona delete ${personaName}`, () => {
                // Remove from list
                this.state.personas = this.state.personas.filter(p => p !== personaName);
                
                // Remove from personasData
                if (this.state.personasData[personaName]) {
                    delete this.state.personasData[personaName];
                }
                
                // If this was the active persona, clear it
                if (this.state.activePersona === personaName) {
                    this.state.activePersona = null;
                    this.updateActivePersonaIndicator();
                }
                
                // If this was the selected persona, clear details
                if (this.state.selectedPersona === personaName) {
                    this.state.selectedPersona = null;
                    this.dom.personaDetails.innerHTML = `
                        <div class="no-selection-message">Select a persona to view details</div>
                    `;
                }
                
                // Update the UI
                this.renderPersonaList();
                this.showStatus(`Persona "${personaName}" deleted`, 'success');
            });
        },
        
        showCreateForm: function() {
            if (!this.dom.createForm) return;
            
            // Hide persona details and show create form
            if (this.dom.personaDetails) {
                this.dom.personaDetails.style.display = 'none';
            }
            
            this.dom.createForm.style.display = 'block';
            this.state.isCreating = true;
            
            // Clear form fields
            document.getElementById(`${this.id}-persona-name`).value = '';
            document.getElementById(`${this.id}-persona-display-name`).value = '';
            document.getElementById(`${this.id}-persona-description`).value = '';
            document.getElementById(`${this.id}-persona-prompt`).value = '';
            
            // Focus first field
            document.getElementById(`${this.id}-persona-name`).focus();
        },
        
        hideCreateForm: function() {
            if (!this.dom.createForm) return;
            
            // Hide create form and show persona details
            this.dom.createForm.style.display = 'none';
            if (this.dom.personaDetails) {
                this.dom.personaDetails.style.display = 'flex';
            }
            
            this.state.isCreating = false;
        },
        
        saveNewPersona: function() {
            // Get form values
            const name = document.getElementById(`${this.id}-persona-name`).value.trim();
            const displayName = document.getElementById(`${this.id}-persona-display-name`).value.trim();
            const description = document.getElementById(`${this.id}-persona-description`).value.trim();
            const prompt = document.getElementById(`${this.id}-persona-prompt`).value.trim();
            
            // Validate
            if (!name) {
                this.showStatus('Persona name is required', 'error');
                return;
            }
            
            if (!description) {
                this.showStatus('Description is required', 'error');
                return;
            }
            
            if (!prompt) {
                this.showStatus('System prompt is required', 'error');
                return;
            }
            
            // Create persona command
            const actualName = displayName || name;
            const command = `persona create ${name} ${description} | ${prompt}`;
            
            this.showStatus('Creating persona...', 'loading');
            
            // Send the command
            this.executeCommand(command, () => {
                // Add to list
                if (!this.state.personas.includes(name)) {
                    this.state.personas.push(name);
                }
                
                // Add to personasData
                this.state.personasData[name] = {
                    name: actualName,
                    description: description,
                    system_prompt: prompt
                };
                
                // Update UI
                this.renderPersonaList();
                this.hideCreateForm();
                this.showStatus(`Persona "${name}" created successfully`, 'success');
                
                // Select the new persona
                this.selectPersona(name);
            });
        },
        
        setupEventListeners: function() {
            // Refresh button
            document.getElementById(`${this.id}-refresh-btn`).addEventListener('click', () => {
                this.loadPersonas();
                this.checkActivePersona();
                this.showStatus('Refreshing personas...', 'loading');
                
                // Clear status after a delay
                setTimeout(() => {
                    this.showStatus('', '');
                }, 2000);
            });
            
            // Create button
            document.getElementById(`${this.id}-create-btn`).addEventListener('click', () => {
                this.showCreateForm();
            });
            
            // Cancel create button
            document.getElementById(`${this.id}-cancel-create`).addEventListener('click', () => {
                this.hideCreateForm();
            });
            
            // Save persona button
            document.getElementById(`${this.id}-save-persona`).addEventListener('click', () => {
                this.saveNewPersona();
            });
        },
        
        // Execute a command via chat input
        executeCommand: function(command, callback) {
            const inputElement = document.getElementById('userInput');
            const sendButton = document.getElementById('sendButton');
            
            if (!inputElement || !sendButton) {
                console.error(`[${this.id}] Chat input elements not found`);
                this.showStatus('Error: Chat input not found', 'error');
                return;
            }
            
            // Set the command in the input field
            inputElement.value = command;
            
            // Create a listener to wait for response
            const chatUpdateListener = Framework.on('chatUpdated', () => {
                // Remove the listener to avoid multiple callbacks
                Framework.off('chatUpdated', chatUpdateListener);
                
                // Execute callback after a short delay to ensure complete update
                setTimeout(() => {
                    if (callback) callback();
                }, 500);
            });
            
            // Click the send button
            sendButton.click();
        },
        
        showStatus: function(message, type = '') {
            if (!this.dom.statusMessage) return;
            
            this.dom.statusMessage.textContent = message;
            this.dom.statusMessage.className = 'status-message';
            
            if (type) {
                this.dom.statusMessage.classList.add(`${type}-message`);
            }
            
            // Clear status after a delay for success messages
            if (type === 'success') {
                setTimeout(() => {
                    if (this.dom.statusMessage.textContent === message) {
                        this.dom.statusMessage.textContent = '';
                        this.dom.statusMessage.className = 'status-message';
                    }
                }, 3000);
            }
        },
        
        // Panel lifecycle methods
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened`);
            
            // Refresh data when panel is opened
            this.loadPersonas();
            this.checkActivePersona();
        },
        
        onPanelClose: function() {
            console.log(`[${this.id}] Panel closed`);
            
            // Cancel any pending operations
            this.state.isCreating = false;
            this.hideCreateForm();
        }
    };
    
    // Register component with framework
    Framework.registerComponent('right-panel-1', PersonaManagerComponent);
})();