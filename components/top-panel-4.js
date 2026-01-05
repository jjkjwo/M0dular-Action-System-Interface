/**
 * ==============================================================================================
 * Top Panel 4 - API Key Management Component
 * ==============================================================================================
 * 
 * This component allows users to update their AI API keys for multiple providers and view key history.
 * It provides a form for submitting new API keys and displays previously used keys.
 * 
 * @version 3.2.0 - Compact layout matching other panels, optimized for small spaces
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-4',
        
        // DOM references
        dom: {
            content: null,
            providerSelect: null,
            keyInput: null,
            modelSelect: null,
            updateButton: null,
            messageElement: null,
            historyList: null
        },
        
        // Component state
        state: {
            keyHistory: [],
            isLoading: false,
            message: '',
            messageType: '', // 'success', 'error', 'info'
            currentProvider: 'gemini', // Default provider
            subscriptions: [],
            models: {
                gemini: [
                    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Experimental)' },
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
                ],
                openai: [
                    { id: 'gpt-4', name: 'GPT-4' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                    { id: 'gpt-4-vision', name: 'GPT-4 Vision' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
                    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
                    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
                ]
            }
        },
    
        /**
         * Initialize component
         */
        initialize: function() {
            // Cache DOM reference
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`Content element for ${this.id} not found`);
                return;
            }
            
            // Fetch current configuration
            this.fetchCurrentConfig();
            
            // Set up the panel content
            this.renderContent();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load key history
            this.loadKeyHistory();
        },

        /**
         * Fetch current API configuration
         */
        fetchCurrentConfig: function() {
            fetch('/api/config')
                .then(response => response.json())
                .then(data => {
                    if (data.api && data.api.active_provider) {
                        this.state.currentProvider = data.api.active_provider;
                        
                        // Update UI if already rendered
                        if (this.dom.providerSelect) {
                            this.dom.providerSelect.value = this.state.currentProvider;
                            this.updateModelOptions();
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching configuration:', error);
                });
        },
    
        /**
         * Render the panel content with more compact layout
         */
        renderContent: function() {
            const container = document.createElement('div');
            container.className = 'api-key-manager';
            
            // Header with info and context
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            
            // Left side with title
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Configure API Keys';
            headerTitle.style.fontWeight = 'bold';
            
            // Caption for system restart info
            const headerCaption = document.createElement('div');
            headerCaption.style.fontSize = '10px';
            headerCaption.style.color = 'var(--color-text-light)';
            headerCaption.textContent = 'System will restart after update';
            
            const headerLeft = document.createElement('div');
            headerLeft.appendChild(headerTitle);
            headerLeft.appendChild(headerCaption);
            
            header.appendChild(headerLeft);
            container.appendChild(header);
            
            // Main form content area
            const formContainer = document.createElement('div');
            formContainer.className = 'form-container';
            formContainer.style.padding = '10px';
            
            // Create a grid layout for form elements
            const formGrid = document.createElement('div');
            formGrid.className = 'form-grid';
            formGrid.style.display = 'grid';
            formGrid.style.gridTemplateColumns = 'auto 1fr';
            formGrid.style.gridGap = '6px';
            formGrid.style.alignItems = 'center';
            formGrid.style.marginBottom = '8px';
            
            // Provider row
            const providerLabel = document.createElement('label');
            providerLabel.textContent = 'Provider:';
            providerLabel.style.fontSize = '13px';
            providerLabel.htmlFor = 'providerSelect';
            formGrid.appendChild(providerLabel);
            
            const providerSelect = document.createElement('select');
            providerSelect.id = 'providerSelect';
            providerSelect.className = 'form-select';
            providerSelect.style.height = '28px';
            providerSelect.style.fontSize = '13px';
            providerSelect.style.padding = '0 5px';
            providerSelect.style.borderRadius = '4px';
            providerSelect.style.border = '1px solid #ccc';
            
            const geminiOption = document.createElement('option');
            geminiOption.value = 'gemini';
            geminiOption.textContent = 'Google Gemini';
            providerSelect.appendChild(geminiOption);
            
            const openaiOption = document.createElement('option');
            openaiOption.value = 'openai';
            openaiOption.textContent = 'OpenAI';
            providerSelect.appendChild(openaiOption);
            
            // Set current value
            providerSelect.value = this.state.currentProvider;
            formGrid.appendChild(providerSelect);
            this.dom.providerSelect = providerSelect;
            
            // Model row
            const modelLabel = document.createElement('label');
            modelLabel.textContent = 'Model:';
            modelLabel.style.fontSize = '13px';
            modelLabel.htmlFor = 'modelSelect';
            formGrid.appendChild(modelLabel);
            
            const modelSelect = document.createElement('select');
            modelSelect.id = 'modelSelect';
            modelSelect.className = 'form-select';
            modelSelect.style.height = '28px';
            modelSelect.style.fontSize = '13px';
            modelSelect.style.padding = '0 5px';
            modelSelect.style.borderRadius = '4px';
            modelSelect.style.border = '1px solid #ccc';
            formGrid.appendChild(modelSelect);
            this.dom.modelSelect = modelSelect;
            
            // API Key row with input and button
            const keyLabel = document.createElement('label');
            keyLabel.textContent = 'API Key:';
            keyLabel.style.fontSize = '13px';
            keyLabel.htmlFor = 'apiKeyInput';
            formGrid.appendChild(keyLabel);
            
            // Create a container for input and button 
            const inputActionContainer = document.createElement('div');
            inputActionContainer.style.display = 'flex';
            inputActionContainer.style.alignItems = 'center';
            inputActionContainer.style.gap = '6px';
            
            // Input with toggle visibility button
            const inputContainer = document.createElement('div');
            inputContainer.style.position = 'relative';
            inputContainer.style.flex = '1';
            
            const keyInput = document.createElement('input');
            keyInput.type = 'password';
            keyInput.id = 'apiKeyInput';
            keyInput.className = 'api-key-input';
            keyInput.placeholder = 'Enter API key';
            keyInput.style.width = '100%';
            keyInput.style.height = '28px';
            keyInput.style.fontSize = '13px';
            keyInput.style.padding = '0 25px 0 5px';
            keyInput.style.borderRadius = '4px';
            keyInput.style.border = '1px solid #ccc';
            inputContainer.appendChild(keyInput);
            this.dom.keyInput = keyInput;
            
            // Eye button for password visibility
            const visibilityToggle = document.createElement('button');
            visibilityToggle.type = 'button';
            visibilityToggle.className = 'visibility-toggle';
            visibilityToggle.setAttribute('aria-label', 'Toggle password visibility');
            visibilityToggle.innerHTML = '👁️';
            visibilityToggle.style.position = 'absolute';
            visibilityToggle.style.right = '5px';
            visibilityToggle.style.top = '50%';
            visibilityToggle.style.transform = 'translateY(-50%)';
            visibilityToggle.style.background = 'none';
            visibilityToggle.style.border = 'none';
            visibilityToggle.style.fontSize = '12px';
            visibilityToggle.style.cursor = 'pointer';
            visibilityToggle.style.color = '#777';
            visibilityToggle.style.padding = '0';
            inputContainer.appendChild(visibilityToggle);
            
            inputActionContainer.appendChild(inputContainer);
            
            // Update button
            const updateButton = document.createElement('button');
            updateButton.id = 'updateKeyButton';
            updateButton.className = 'update-key-button';
            updateButton.textContent = 'Update';
            updateButton.disabled = true;
            updateButton.style.backgroundColor = '#6c757d';
            updateButton.style.color = 'white';
            updateButton.style.border = 'none';
            updateButton.style.borderRadius = '4px';
            updateButton.style.padding = '0 8px';
            updateButton.style.height = '28px';
            updateButton.style.cursor = 'pointer';
            updateButton.style.fontSize = '12px';
            updateButton.style.fontWeight = 'bold';
            updateButton.style.whiteSpace = 'nowrap';
            inputActionContainer.appendChild(updateButton);
            this.dom.updateButton = updateButton;
            
            formGrid.appendChild(inputActionContainer);
            
            formContainer.appendChild(formGrid);
            
            // Message element
            const messageElement = document.createElement('div');
            messageElement.id = 'keyUpdateMessage';
            messageElement.className = 'message';
            messageElement.style.fontSize = '12px';
            messageElement.style.padding = '4px';
            messageElement.style.margin = '0 0 8px 0';
            messageElement.style.borderRadius = '4px';
            messageElement.style.display = 'none';
            formContainer.appendChild(messageElement);
            this.dom.messageElement = messageElement;
            
            container.appendChild(formContainer);
            
            // Key History section with simple header
            const historyHeader = document.createElement('div');
            historyHeader.className = 'history-header';
            historyHeader.textContent = 'Key History';
            historyHeader.style.fontSize = '12px';
            historyHeader.style.fontWeight = 'bold';
            historyHeader.style.padding = '6px 10px';
            historyHeader.style.backgroundColor = '#f5f5f5';
            historyHeader.style.borderTop = '1px solid #e0e0e0';
            historyHeader.style.borderBottom = '1px solid #e0e0e0';
            container.appendChild(historyHeader);
            
            // History list
            const historyList = document.createElement('div');
            historyList.id = 'keyHistoryList';
            historyList.className = 'key-history-list';
            historyList.style.maxHeight = '120px';
            historyList.style.overflow = 'auto';
            historyList.style.fontSize = '12px';
            historyList.innerHTML = '<div class="loading-placeholder" style="padding:8px;text-align:center;font-style:italic;color:#777;">Loading key history...</div>';
            container.appendChild(historyList);
            this.dom.historyList = historyList;
            
            // Add to panel
            this.dom.content.appendChild(container);
            
            // Add styles
            this.addStyles();
            
            // Update model options
            this.updateModelOptions();
        },
        
        /**
         * Update model options based on selected provider
         */
        updateModelOptions: function() {
            if (!this.dom.modelSelect || !this.dom.providerSelect) return;
            
            const provider = this.dom.providerSelect.value;
            const models = this.state.models[provider] || [];
            
            // Clear current options
            this.dom.modelSelect.innerHTML = '';
            
            // Add new options
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                this.dom.modelSelect.appendChild(option);
            });
        },
        
        /**
         * Add component-specific styles - streamlined
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                #${this.id}-content .api-key-manager {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                #${this.id}-content .form-select:focus,
                #${this.id}-content .api-key-input:focus {
                    outline: 1px solid var(--color-primary);
                    border-color: var(--color-primary);
                }
                
                #${this.id}-content .update-key-button:hover:not(:disabled) {
                    background-color: #5a6268;
                }
                
                #${this.id}-content .update-key-button:disabled {
                    background-color: #adb5bd;
                    cursor: not-allowed;
                }
                
                #${this.id}-content .message {
                    min-height: 0;
                }
                
                #${this.id}-content .message.success {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                    border: 1px solid #a5d6a7;
                }
                
                #${this.id}-content .message.error {
                    background-color: #ffebee;
                    color: #c62828;
                    border: 1px solid #ef9a9a;
                }
                
                #${this.id}-content .message.info {
                    background-color: #e3f2fd;
                    color: #1565c0;
                    border: 1px solid #90caf9;
                }
                
                #${this.id}-content .key-item {
                    padding: 6px 10px;
                    border-bottom: 1px solid #f0f0f0;
                    display: flex;
                    flex-direction: column;
                }
                
                #${this.id}-content .key-provider {
                    display: inline-block;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-right: 4px;
                }
                
                #${this.id}-content .key-provider.gemini {
                    background-color: #e3f2fd;
                    color: #1565c0;
                }
                
                #${this.id}-content .key-provider.openai {
                    background-color: #f0f0f0;
                    color: #412991;
                }
                
                #${this.id}-content .key-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 2px;
                }
                
                #${this.id}-content .key-model {
                    font-size: 10px;
                    color: #555;
                }
                
                #${this.id}-content .key-timestamp {
                    font-size: 10px;
                    color: #777;
                }
                
                /* Custom scrollbar for history list */
                #${this.id}-content .key-history-list::-webkit-scrollbar {
                    width: 6px;
                }
                
                #${this.id}-content .key-history-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                #${this.id}-content .key-history-list::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
            `;
            
            document.head.appendChild(style);
        },
    
        /**
         * Set up event listeners
         */
        setupEventListeners: function() {
            // Provider change event
            if (this.dom.providerSelect) {
                this.dom.providerSelect.addEventListener('change', () => {
                    this.updateModelOptions();
                });
            }
            
            // Add click event for update button
            if (this.dom.updateButton) {
                this.dom.updateButton.addEventListener('click', () => {
                    this.updateApiKey();
                });
            }
            
            // Add enter key support for the input field
            if (this.dom.keyInput) {
                this.dom.keyInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !this.dom.updateButton.disabled) {
                        this.updateApiKey();
                    }
                });
                
                // Disable button when input is empty
                this.dom.keyInput.addEventListener('input', () => {
                    if (this.dom.updateButton) {
                        this.dom.updateButton.disabled = !this.dom.keyInput.value.trim();
                    }
                });
            }
            
            // Visibility toggle button
            const toggleButton = this.dom.content.querySelector('.visibility-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', () => this.toggleKeyVisibility());
            }
        },
        
        /**
         * Toggle visibility of the API key
         */
        toggleKeyVisibility: function() {
            if (!this.dom.keyInput) return;
            
            if (this.dom.keyInput.type === 'password') {
                this.dom.keyInput.type = 'text';
            } else {
                this.dom.keyInput.type = 'password';
            }
        },
    
        /**
         * Show a message to the user
         * @param {string} message - Message text
         * @param {string} type - Message type ('success', 'error', 'info')
         */
        showMessage: function(message, type = 'info') {
            if (!this.dom.messageElement) return;
            
            this.state.message = message;
            this.state.messageType = type;
            
            this.dom.messageElement.textContent = message;
            this.dom.messageElement.className = `message ${type}`;
            this.dom.messageElement.style.display = 'block';
            
            // Clear message after a few seconds if it's a success message
            if (type === 'success') {
                setTimeout(() => {
                    // Only clear if this is still the same message
                    if (this.state.message === message) {
                        this.dom.messageElement.textContent = '';
                        this.dom.messageElement.style.display = 'none';
                        this.state.message = '';
                        this.state.messageType = '';
                    }
                }, 5000);
            }
        },
    
        /**
         * Update the API key
         */
        updateApiKey: function() {
            if (!this.dom.keyInput || !this.dom.providerSelect || !this.dom.modelSelect) return;
            
            const apiKey = this.dom.keyInput.value.trim();
            const provider = this.dom.providerSelect.value;
            const model = this.dom.modelSelect.value;
            
            // Validate API key
            if (!apiKey) {
                this.showMessage('Please enter an API key', 'error');
                return;
            }
            
            // Set loading state
            this.state.isLoading = true;
            this.showMessage(`Updating ${provider.toUpperCase()} API key...`, 'info');
            
            if (this.dom.updateButton) {
                this.dom.updateButton.disabled = true;
            }
            
            // Send API request to update key
            fetch(CONFIG.api.updateApiKey, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    api_key: apiKey,
                    provider: provider,
                    model: model
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.state.isLoading = false;
                
                if (data.success) {
                    this.showMessage(`${provider.toUpperCase()} API key updated successfully! System restarting...`, 'success');
                    
                    if (this.dom.keyInput) {
                        this.dom.keyInput.value = '';
                    }
                    
                    // Reload key history
                    setTimeout(() => {
                        this.loadKeyHistory();
                    }, 1000);
                } else {
                    this.showMessage(`Error updating API key: ${data.error || 'Unknown error'}`, 'error');
                }
            })
            .catch(error => {
                this.state.isLoading = false;
                this.showMessage(`Error updating API key: ${error.message}`, 'error');
            })
            .finally(() => {
                if (this.dom.updateButton) {
                    this.dom.updateButton.disabled = false;
                }
            });
        },
    
        /**
         * Load key history from the server
         */
        loadKeyHistory: function() {
            if (!this.dom.historyList) return;
            
            this.dom.historyList.innerHTML = '<div class="loading-placeholder" style="padding:8px;text-align:center;font-style:italic;color:#777;">Loading key history...</div>';
            
            // Fetch key history
            fetch(CONFIG.api.keyHistory)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.keys && data.keys.length > 0) {
                        // Update state
                        this.state.keyHistory = data.keys;
                        
                        // Render key history
                        this.renderKeyHistory();
                    } else {
                        this.dom.historyList.innerHTML = '<div class="loading-placeholder" style="padding:8px;text-align:center;font-style:italic;color:#777;">No key history found</div>';
                    }
                })
                .catch(error => {
                    console.error('Error loading key history:', error);
                    this.dom.historyList.innerHTML = `
                        <div class="loading-placeholder" style="padding:8px;text-align:center;font-style:italic;color:#777;">
                            Error loading history: ${error.message}
                        </div>
                    `;
                });
        },
        
        /**
         * Render the key history with compact styling
         */
        renderKeyHistory: function() {
            if (!this.dom.historyList || !this.state.keyHistory.length) return;
            
            // Clear current list
            this.dom.historyList.innerHTML = '';
            
            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Add each key to the history list (newest first)
            this.state.keyHistory.forEach((item, index) => {
                const keyItem = document.createElement('div');
                keyItem.className = 'key-item';
                
                // Top row with provider badge and key value
                const keyHeader = document.createElement('div');
                keyHeader.style.display = 'flex';
                keyHeader.style.alignItems = 'center';
                
                // Provider badge
                if (item.provider) {
                    const providerBadge = document.createElement('span');
                    providerBadge.className = `key-provider ${item.provider.toLowerCase()}`;
                    providerBadge.textContent = item.provider;
                    keyHeader.appendChild(providerBadge);
                }
                
                // Mask key except first and last 4 characters
                let displayKey = item.key;
                if (displayKey.length > 8) {
                    const firstFour = displayKey.substring(0, 4);
                    const lastFour = displayKey.substring(displayKey.length - 4);
                    displayKey = `${firstFour}...${lastFour}`;
                }
                
                const keyValue = document.createElement('span');
                keyValue.className = 'key-value';
                keyValue.textContent = displayKey;
                keyValue.style.fontSize = '11px';
                keyHeader.appendChild(keyValue);
                
                keyItem.appendChild(keyHeader);
                
                // Bottom row with model and timestamp
                const keyDetails = document.createElement('div');
                keyDetails.className = 'key-details';
                
                // Model info if available
                const modelInfo = document.createElement('span');
                modelInfo.className = 'key-model';
                modelInfo.textContent = item.model || 'Default model';
                keyDetails.appendChild(modelInfo);
                
                // Format date for display - compact format
                const date = new Date(item.timestamp);
                // Format: MM/DD/YY HH:MM
                const formattedDate = `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                
                const keyTimestamp = document.createElement('span');
                keyTimestamp.className = 'key-timestamp';
                keyTimestamp.textContent = formattedDate;
                keyDetails.appendChild(keyTimestamp);
                
                keyItem.appendChild(keyDetails);
                
                fragment.appendChild(keyItem);
            });
            
            // Add all items to DOM at once
            this.dom.historyList.appendChild(fragment);
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
            
            // Unsubscribe from any events
            this.state.subscriptions.forEach(sub => {
                if (sub.id) {
                    Framework.off(sub.event, sub.id);
                }
            });
        }
    };
    
    // Register component
    Framework.registerComponent(component.id, component);
})();