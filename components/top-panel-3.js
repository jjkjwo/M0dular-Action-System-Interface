/**
 * ==============================================================================================
 * Top Panel 3 - Active Actions Display Component (Optimized Layout)
 * ==============================================================================================
 * 
 * This panel displays currently running actions with priority levels in a space-efficient layout.
 * It subscribes to the activeActionsUpdated event from the framework.
 * 
 * @version 3.4.0 - Enhanced layout with toast-based details and prioritized action name visibility
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-3',

        // DOM references
        dom: {
            content: null,
            actionsContainer: null,
            emptyMessage: null,
            actionCount: null,
            stopAllButton: null,
            refreshButton: null,
            loadingIndicator: null,
            errorMessage: null
        },

        // Component state
        state: {
            activeActions: [],
            isLoading: false,
            errorState: null,
            lastUpdate: null,
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            // Cache DOM references
            this.dom.content = document.getElementById(`${this.id}-content`);

            if (!this.dom.content) {
                console.error(`[${this.id}] Content element for ${this.id} not found`);
                return;
            }

            // Create component structure
            this.createStructure();
            
            // Subscribe to active actions updates
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.handleActionsUpdate(data);
            });
            
            // Store subscription for potential cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });

            // Initial fetch
            this.fetchActiveActions();

            console.log(`[${this.id}] Initialization complete.`);
        },
        
        /**
         * Create the basic panel structure
         */
        createStructure: function() {
            const container = document.createElement('div');
            container.className = 'active-actions-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            container.style.overflow = 'hidden';
            
            // Header section with count and buttons
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            
            // Left side with title and count
            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '10px';
            
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Running Actions';
            headerTitle.style.fontWeight = 'bold';
            
            const actionCount = document.createElement('div');
            actionCount.className = 'action-count-badge';
            actionCount.textContent = '0';
            actionCount.style.backgroundColor = 'var(--color-primary)';
            actionCount.style.color = 'white';
            actionCount.style.borderRadius = '50%';
            actionCount.style.width = '20px';
            actionCount.style.height = '20px';
            actionCount.style.display = 'flex';
            actionCount.style.alignItems = 'center';
            actionCount.style.justifyContent = 'center';
            actionCount.style.fontSize = '12px';
            this.dom.actionCount = actionCount;
            
            headerLeft.appendChild(headerTitle);
            headerLeft.appendChild(actionCount);
            
            // Right side with controls
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';
            
            // Add refresh button
            const refreshButton = document.createElement('button');
            refreshButton.className = 'refresh-button';
            refreshButton.innerHTML = '🔄';
            refreshButton.setAttribute('aria-label', 'Refresh active actions');
            refreshButton.setAttribute('title', 'Refresh active actions');
            refreshButton.style.background = 'none';
            refreshButton.style.border = 'none';
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.fontSize = '1em';
            refreshButton.style.color = 'var(--color-primary)';
            refreshButton.style.padding = 'var(--space-xs)';
            refreshButton.addEventListener('click', () => this.fetchActiveActions());
            this.dom.refreshButton = refreshButton;
            
            // Add stop all button
            const stopAllButton = document.createElement('button');
            stopAllButton.className = 'stop-all-button';
            stopAllButton.textContent = 'Stop All';
            stopAllButton.setAttribute('aria-label', 'Stop all active actions');
            stopAllButton.style.backgroundColor = '#f44336';
            stopAllButton.style.color = 'white';
            stopAllButton.style.border = 'none';
            stopAllButton.style.borderRadius = 'var(--border-radius-sm)';
            stopAllButton.style.padding = '4px 8px';
            stopAllButton.style.fontSize = '12px';
            stopAllButton.style.cursor = 'pointer';
            stopAllButton.disabled = true;
            stopAllButton.addEventListener('click', () => this.stopAllActions());
            this.dom.stopAllButton = stopAllButton;
            
            headerControls.appendChild(refreshButton);
            headerControls.appendChild(stopAllButton);
            
            header.appendChild(headerLeft);
            header.appendChild(headerControls);
            container.appendChild(header);
            
            // Actions container
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'active-actions-container';
            actionsContainer.setAttribute('role', 'list');
            actionsContainer.setAttribute('aria-label', 'Currently active actions');
            actionsContainer.style.flex = '1';
            actionsContainer.style.overflowY = 'auto';
            actionsContainer.style.padding = '10px';
            container.appendChild(actionsContainer);
            this.dom.actionsContainer = actionsContainer;
            
            // Empty message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.style.display = 'flex';
            emptyMessage.style.flexDirection = 'column';
            emptyMessage.style.alignItems = 'center';
            emptyMessage.style.justifyContent = 'center';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.height = '100%';
            emptyMessage.style.color = 'var(--color-text-light)';
            emptyMessage.style.textAlign = 'center';
            
            const emptyIcon = document.createElement('div');
            emptyIcon.innerHTML = '🔄';
            emptyIcon.style.fontSize = '24px';
            emptyIcon.style.marginBottom = '10px';
            emptyIcon.style.opacity = '0.5';
            
            const emptyText = document.createElement('div');
            emptyText.textContent = 'No actions are currently running';
            emptyText.style.marginBottom = '5px';
            
            const emptySuggestion = document.createElement('div');
            emptySuggestion.textContent = 'Start an action using the Actions panel';
            emptySuggestion.style.fontSize = '12px';
            emptySuggestion.style.opacity = '0.7';
            
            emptyMessage.appendChild(emptyIcon);
            emptyMessage.appendChild(emptyText);
            emptyMessage.appendChild(emptySuggestion);
            
            container.appendChild(emptyMessage);
            this.dom.emptyMessage = emptyMessage;
            
            // Create loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                    <div style="margin-bottom: 10px; border: 3px solid #f3f3f3; border-top: 3px solid var(--color-primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
                    <div>Loading active actions...</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            loadingIndicator.style.display = 'none';
            container.appendChild(loadingIndicator);
            this.dom.loadingIndicator = loadingIndicator;
            
            // Create error message container
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.style.padding = '15px';
            errorMessage.style.margin = '10px';
            errorMessage.style.backgroundColor = '#ffebee';
            errorMessage.style.border = '1px solid #ffcdd2';
            errorMessage.style.borderRadius = 'var(--border-radius-md)';
            errorMessage.style.color = '#c62828';
            errorMessage.style.display = 'none';
            container.appendChild(errorMessage);
            this.dom.errorMessage = errorMessage;
            
            // Add to panel
            this.dom.content.appendChild(container);
            
            // Add styles
            this.addStyles();
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
                .active-action-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    padding: 8px 10px;
                    border-radius: var(--border-radius-sm);
                    background-color: white;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    transition: all 0.2s ease-out;
                }
                
                .active-action-item::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 3px;
                    height: 100%;
                    background: var(--color-primary);
                    opacity: 0.8;
                }
                
                .active-action-item:hover {
                    background-color: #f9f9f9;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
                }
                
                .action-info {
                    display: flex;
                    align-items: center;
                    min-width: 0;
                    flex: 3; /* Increased flex value to give more space to action name */
                    margin-right: 4px; /* Reduced margin to bring time closer to name */
                }
                
                .running-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #4caf50;
                    margin-right: 6px;
                    flex-shrink: 0; /* Prevent indicator from shrinking */
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { opacity: 0.6; transform: scale(0.95); }
                    50% { opacity: 1; transform: scale(1.05); }
                    100% { opacity: 0.6; transform: scale(0.95); }
                }
                
                .action-name {
                    font-weight: 600;
                    font-size: 13px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: var(--color-text);
                    min-width: 0; /* Allow flex container to shrink action name */
                    flex: 1; /* Take up all available space in parent */
                    white-space: nowrap; /* Keep on single line */
                }
                
                .action-metadata {
                    display: flex;
                    align-items: center;
                    white-space: nowrap;
                    flex: 0.6; /* Further reduced flex value to give less space to metadata */
                    justify-content: flex-start; /* Align to the left to be closer to name */
                    overflow: hidden; /* Hide overflow */
                    flex-shrink: 1; /* Allow metadata to shrink before action name */
                    margin-right: 8px; /* Slightly reduced margin to separate from controls */
                    min-width: 60px; /* Reduced minimum width for metadata */
                    max-width: 100px; /* Reduced maximum width for metadata */
                }
                
                .action-time {
                    font-size: 11px;
                    color: var(--color-text-light);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .action-priority {
                    font-size: 10px;
                    padding: 1px 4px;
                    border-radius: 10px;
                    white-space: nowrap;
                    margin-left: 6px;
                    flex-shrink: 0; /* Prevent priority badge from shrinking */
                }
                
                .priority-high {
                    background-color: rgba(46, 125, 50, 0.1);
                    color: #2e7d32;
                    border: 1px solid rgba(46, 125, 50, 0.2);
                }
                
                .priority-medium {
                    background-color: rgba(230, 81, 0, 0.1);
                    color: #e65100;
                    border: 1px solid rgba(230, 81, 0, 0.2);
                }
                
                .priority-low {
                    background-color: rgba(117, 117, 117, 0.1);
                    color: #757575;
                    border: 1px solid rgba(117, 117, 117, 0.2);
                }
                
                .action-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0; /* Prevent controls from shrinking */
                }
                
                .details-button {
                    background: none;
                    border: none;
                    color: var(--color-primary);
                    cursor: pointer;
                    font-size: 11px;
                    text-decoration: underline;
                    padding: 0;
                    white-space: nowrap;
                }
                
                .stop-action-button {
                    background-color: rgba(244, 67, 54, 0.9);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 3px 8px;
                    cursor: pointer;
                    font-size: 11px;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                    font-weight: 500;
                    flex-shrink: 0; /* Prevent button from shrinking */
                }
                
                .stop-action-button:hover {
                    background-color: #d32f2f;
                }
                
                .stop-all-button {
                    transition: all 0.2s ease;
                    opacity: 0.9;
                }
                
                .stop-all-button:hover {
                    opacity: 1;
                }
                
                .stop-all-button:disabled {
                    opacity: 0.5;
                }
                
                .action-count-badge {
                    transition: background-color 0.3s ease;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Handle actions update event from framework
         * @param {Object} data - Event data containing active actions
         */
        handleActionsUpdate: function(data) {
            if (!data || !Array.isArray(data.actions)) {
                this.state.activeActions = [];
            } else {
                // Create a copy to avoid reference issues
                this.state.activeActions = [...data.actions];
            }
            
            // Update UI
            this.renderActiveActions();
        },
        
        /**
         * Fetch active actions directly from API
         */
        fetchActiveActions: async function() {
            if (this.state.isLoading) return;
            
            this.state.isLoading = true;
            this.showLoading();
            
            try {
                const response = await fetch(CONFIG.api.activeActions, { cache: "no-store" });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Update state
                if (data && Array.isArray(data.actions)) {
                    this.state.activeActions = [...data.actions];
                } else {
                    this.state.activeActions = [];
                }
                
                // Update UI
                this.renderActiveActions();
                
                // Clear error state
                this.state.errorState = null;
                this.hideError();
                
                // Update last update time
                this.state.lastUpdate = new Date();
                
            } catch (error) {
                console.error(`[${this.id}] Error fetching active actions:`, error);
                this.state.errorState = error.message;
                this.showError(`Failed to load active actions: ${error.message}`);
            } finally {
                this.state.isLoading = false;
                this.hideLoading();
            }
        },
        
        /**
         * Show loading indicator
         */
        showLoading: function() {
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'block';
            }
            
            if (this.dom.actionsContainer) {
                this.dom.actionsContainer.style.display = 'none';
            }
            
            if (this.dom.emptyMessage) {
                this.dom.emptyMessage.style.display = 'none';
            }
        },
        
        /**
         * Hide loading indicator
         */
        hideLoading: function() {
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'none';
            }
            
            if (this.dom.actionsContainer) {
                this.dom.actionsContainer.style.display = 'block';
            }
            
            // Empty message visibility is handled in renderActiveActions
        },
        
        /**
         * Show error message
         * @param {string} message - Error message to display
         */
        showError: function(message) {
            if (this.dom.errorMessage) {
                this.dom.errorMessage.textContent = message;
                this.dom.errorMessage.style.display = 'block';
            }
            
            if (this.dom.actionsContainer) {
                this.dom.actionsContainer.style.display = 'none';
            }
            
            if (this.dom.emptyMessage) {
                this.dom.emptyMessage.style.display = 'none';
            }
        },
        
        /**
         * Hide error message
         */
        hideError: function() {
            if (this.dom.errorMessage) {
                this.dom.errorMessage.style.display = 'none';
            }
        },

        /**
         * Render active actions in the panel
         */
        renderActiveActions: function() {
            if (!this.dom.actionsContainer) return;

            const activeActions = this.state.activeActions;
            this.dom.actionsContainer.innerHTML = '';

            // Update action count
            if (this.dom.actionCount) {
                this.dom.actionCount.textContent = activeActions.length;
                
                // Apply visual styling based on count
                if (activeActions.length > 0) {
                    this.dom.actionCount.style.backgroundColor = '#4caf50'; // Green for active
                } else {
                    this.dom.actionCount.style.backgroundColor = 'var(--color-text-light)'; // Gray for none
                }
            }
            
            // Update stop all button
            if (this.dom.stopAllButton) {
                this.dom.stopAllButton.disabled = activeActions.length === 0;
            }

            // Show/hide empty message
            if (this.dom.emptyMessage) {
                this.dom.emptyMessage.style.display = activeActions.length === 0 ? 'flex' : 'none';
            }

            // If no actions, don't proceed further
            if (!activeActions || activeActions.length === 0) {
                if (this.dom.actionsContainer) {
                    this.dom.actionsContainer.style.display = 'none';
                }
                return;
            }
            
            // Display the actions container
            if (this.dom.actionsContainer) {
                this.dom.actionsContainer.style.display = 'block';
            }

            // Sort active actions by priority
            const sortedActions = this.sortActionsByPriority(activeActions);

            // Create action elements
            sortedActions.forEach(actionData => {
                const actionElement = this.createActionElement(actionData);
                this.dom.actionsContainer.appendChild(actionElement);
            });
        },
        
        /**
         * Sort actions by their priority
         * @param {Array} actions - List of active actions
         * @returns {Array} - Sorted actions list
         */
        sortActionsByPriority: function(actions) {
            // Create a copy to avoid modifying the original
            const sortedActions = [...actions];
            
            // Sort by priority (extracted from "ActionName:Priority")
            return sortedActions.sort((a, b) => {
                // Split "ActionName:Priority"
                const [, prioA] = a.split(':');
                const [, prioB] = b.split(':');
                
                // Parse priority as integer, default to 0 if missing/invalid
                return (parseInt(prioA, 10) || 0) - (parseInt(prioB, 10) || 0);
            });
        },
        
        /**
         * Create an action element - OPTIMIZED WITH TOAST DETAILS
         * @param {string} actionString - Action data in format "name:priority"
         * @returns {HTMLElement} - Action element
         */
        createActionElement: function(actionString) {
            // Split action string to get name and priority
            const [name, priority] = actionString.split(':');
            const actionName = name.trim();
            const actionPriority = priority ? priority.trim() : '';
            
            // Create container
            const actionElement = document.createElement('div');
            actionElement.className = 'active-action-item';
            actionElement.setAttribute('role', 'listitem');
            actionElement.setAttribute('data-action-name', actionName);
            
            // Action info section (left side)
            const actionInfo = document.createElement('div');
            actionInfo.className = 'action-info';
            
            // Running indicator - pulsing dot
            const runningIndicator = document.createElement('span');
            runningIndicator.className = 'running-indicator';
            actionInfo.appendChild(runningIndicator);
            
            // Action name
            const actionNameElement = document.createElement('span');
            actionNameElement.className = 'action-name';
            actionNameElement.textContent = actionName;
            actionInfo.appendChild(actionNameElement);
            
            // Add action info to main container
            actionElement.appendChild(actionInfo);
            
            // Action metadata (center - timestamp & priority)
            const actionMetadata = document.createElement('div');
            actionMetadata.className = 'action-metadata';
            
            // Runtime information - more compact format
            const timeElement = document.createElement('span');
            timeElement.className = 'action-time';
            // Extract just the time part for a more compact display
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeElement.textContent = currentTime;
            actionMetadata.appendChild(timeElement);
            
            // Priority badge if available
            if (actionPriority) {
                const priorityElement = document.createElement('span');
                priorityElement.className = 'action-priority';
                
                // Determine priority class
                const priorityValue = parseInt(actionPriority, 10) || 0;
                if (priorityValue < 10) {
                    priorityElement.classList.add('priority-high');
                } else if (priorityValue < 20) {
                    priorityElement.classList.add('priority-medium');
                } else {
                    priorityElement.classList.add('priority-low');
                }
                
                priorityElement.textContent = `P:${actionPriority}`;
                actionMetadata.appendChild(priorityElement);
            }
            
            // Add metadata to main container
            actionElement.appendChild(actionMetadata);
            
            // Action controls (right side)
            const actionControls = document.createElement('div');
            actionControls.className = 'action-controls';
            
            // Details button - UPDATED TO USE TOAST INSTEAD OF EXPANDING SECTION
            const detailsButton = document.createElement('button');
            detailsButton.className = 'details-button';
            detailsButton.textContent = 'Details';
            detailsButton.setAttribute('aria-label', `Show details for ${actionName} action`);
            detailsButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent action toggle
                
                // Format details for toast
                const details = this.formatActionDetailsForToast(actionName, actionPriority);
                
                // Show details in toast
                Framework.showToast(details, 5000); // Show for 5 seconds
            });
            actionControls.appendChild(detailsButton);
            
            // Stop button
            const stopButton = document.createElement('button');
            stopButton.className = 'stop-action-button';
            stopButton.textContent = 'Stop';
            stopButton.setAttribute('aria-label', `Stop ${actionName} action`);
            stopButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent action detail from opening
                this.stopAction(actionName);
            });
            actionControls.appendChild(stopButton);
            
            // Add controls to main container
            actionElement.appendChild(actionControls);
            
            return actionElement;
        },
        
        /**
         * Format action details for toast display
         * @param {string} actionName - Name of the action
         * @param {string} priority - Priority of the action
         * @returns {string} - Formatted details string
         */
        formatActionDetailsForToast: function(actionName, priority) {
            const currentTime = new Date().toLocaleTimeString();
            const actionType = this.getActionType(actionName);
            const memoryUsage = Math.round(Math.random() * 100); // Random number for demo
            
            // Format details as a compact string
            return `Action: ${actionName}\n` +
                   `Priority: ${priority || 'Not set'}\n` +
                   `Status: Running\n` + 
                   `Started: ${currentTime}\n` +
                   `Type: ${actionType}\n` +
                   `Memory: ${memoryUsage}MB`;
        },
        
        /**
         * Get a generic action type based on name
         * @param {string} actionName - Name of the action
         * @returns {string} - Action type
         */
        getActionType: function(actionName) {
            // Just a helper function to categorize actions for the demo
            const lowerName = actionName.toLowerCase();
            
            if (lowerName.includes('filter')) return 'UI Filter';
            if (lowerName.includes('core')) return 'System Core';
            if (lowerName.includes('memory')) return 'Data Storage';
            if (lowerName.includes('voice') || lowerName.includes('tts')) return 'Audio Output';
            if (lowerName.includes('web') || lowerName.includes('http')) return 'Network';
            
            return 'Generic Action';
        },
        
        /**
         * Stop a specific action
         * @param {string} actionName - Name of the action to stop
         */
        stopAction: function(actionName) {
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = `stop ${actionName}`;
                Framework.sendMessage();
            }
            
            Framework.showToast(`Stopping action: ${actionName}`);
        },
        
        /**
         * Stop all active actions
         */
        stopAllActions: function() {
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = 'stop all';
                Framework.sendMessage();
            }
            
            Framework.showToast('Stopping all actions');
        },
        
        /**
         * Clean up resources
         */
        cleanup: function() {
            // Remove style element
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                if (sub.id) {
                    Framework.off(sub.event, sub.id);
                }
            });
        }
    };

    // Register component with the framework
    Framework.registerComponent(component.id, component);
})();