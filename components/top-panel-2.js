/**
 * ==============================================================================================
 * Top Panel 2 - Actions Display Component (Ultra-Compact Layout)
 * ==============================================================================================
 * 
 * This panel displays available actions sorted by priority in a highly space-efficient single-line layout.
 * 
 * @version 3.3.2 - Ultra-compact single-line layout with improved button alignment
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-2',
        
        // DOM references
        dom: {
            content: null,
            actionsContainer: null,
            searchInput: null,
            updateInfo: null,
            loadingIndicator: null,
            errorMessage: null,
            emptyMessage: null,
            clearSearch: null,
            refreshButton: null,
            sortButton: null,
            statsElement: null
        },
        
        // Component state
        state: {
            actions: null,
            filteredActions: null,
            isLoading: false,
            lastUpdate: null,
            searchQuery: '',
            sortOrder: 'priority', // 'priority' or 'name'
            errorState: null,
            actionCount: 0,
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
            
            // Create basic structure
            this.createStructure();
            
            // Fetch initial data
            this.fetchActions();
            
            // Set up refresh interval
            const refreshInterval = CONFIG.refreshIntervals.actions || 60000;
            setInterval(() => this.fetchActions(), refreshInterval);
            
            console.log(`[${this.id}] Initialization complete. Refresh interval set to ${refreshInterval}ms`);
        },
        
        /**
         * Create the basic panel structure
         */
        createStructure: function() {
            const container = document.createElement('div');
            container.className = 'actions-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            container.style.overflow = 'hidden';
            container.style.minWidth = '300px'; // Ensure minimum panel width
            
            // Add header with title and sort/refresh controls
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            
            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '10px';
            
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Available Actions';
            headerTitle.style.fontWeight = 'bold';
            headerLeft.appendChild(headerTitle);
            
            header.appendChild(headerLeft);
            
            // Right side with controls
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';
            
            // Add sort toggle
            const sortButton = document.createElement('button');
            sortButton.className = 'sort-button';
            sortButton.innerHTML = '⇅';
            sortButton.setAttribute('aria-label', 'Toggle sort order');
            sortButton.setAttribute('title', 'Toggle sort order (priority/name)');
            sortButton.style.background = 'none';
            sortButton.style.border = 'none';
            sortButton.style.cursor = 'pointer';
            sortButton.style.fontSize = '1em';
            sortButton.style.color = 'var(--color-primary)';
            sortButton.style.padding = 'var(--space-xs)';
            sortButton.addEventListener('click', () => this.toggleSortOrder());
            this.dom.sortButton = sortButton;
            
            // Add refresh button
            const refreshButton = document.createElement('button');
            refreshButton.className = 'refresh-button';
            refreshButton.innerHTML = '🔄';
            refreshButton.setAttribute('aria-label', 'Refresh actions');
            refreshButton.setAttribute('title', 'Refresh actions');
            refreshButton.style.background = 'none';
            refreshButton.style.border = 'none';
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.fontSize = '1em';
            refreshButton.style.color = 'var(--color-primary)';
            refreshButton.style.padding = 'var(--space-xs)';
            refreshButton.addEventListener('click', () => this.fetchActions(true));
            this.dom.refreshButton = refreshButton;
            
            // Add update info
            const updateInfo = document.createElement('span');
            updateInfo.className = 'update-info';
            updateInfo.textContent = 'Updated just now';
            updateInfo.style.fontSize = '0.8em';
            updateInfo.style.color = 'var(--color-text-light)';
            this.dom.updateInfo = updateInfo;
            
            headerControls.appendChild(sortButton);
            headerControls.appendChild(refreshButton);
            headerControls.appendChild(updateInfo);
            
            header.appendChild(headerControls);
            container.appendChild(header);
            
            // Add search container
            const searchContainer = document.createElement('div');
            searchContainer.className = 'search-container';
            searchContainer.style.padding = '8px 10px';
            searchContainer.style.display = 'flex';
            searchContainer.style.position = 'relative';
            searchContainer.style.borderBottom = '1px solid #e0e0e0';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search actions...';
            searchInput.setAttribute('aria-label', 'Search actions');
            searchInput.style.flex = '1';
            searchInput.style.padding = '6px 8px';
            searchInput.style.paddingRight = '30px'; // Space for clear button
            searchInput.style.border = '1px solid var(--color-border)';
            searchInput.style.borderRadius = 'var(--border-radius-sm)';
            searchInput.addEventListener('input', () => this.handleSearch(searchInput.value));
            this.dom.searchInput = searchInput;
            
            const clearSearch = document.createElement('button');
            clearSearch.className = 'clear-search';
            clearSearch.innerHTML = '×';
            clearSearch.setAttribute('aria-label', 'Clear search');
            clearSearch.style.position = 'absolute';
            clearSearch.style.right = '15px';
            clearSearch.style.top = '50%';
            clearSearch.style.transform = 'translateY(-50%)';
            clearSearch.style.background = 'none';
            clearSearch.style.border = 'none';
            clearSearch.style.fontSize = '18px';
            clearSearch.style.cursor = 'pointer';
            clearSearch.style.color = 'var(--color-text-light)';
            clearSearch.style.display = 'none'; // Hidden by default
            clearSearch.addEventListener('click', () => {
                searchInput.value = '';
                this.handleSearch('');
                clearSearch.style.display = 'none';
            });
            this.dom.clearSearch = clearSearch;
            
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearSearch);
            container.appendChild(searchContainer);
            
            // Create actions container
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'actions-container';
            actionsContainer.setAttribute('role', 'list');
            actionsContainer.setAttribute('aria-label', 'Available actions');
            actionsContainer.style.flex = '1';
            actionsContainer.style.overflowY = 'auto';
            actionsContainer.style.padding = '0';
            container.appendChild(actionsContainer);
            this.dom.actionsContainer = actionsContainer;
            
            // Create empty message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = 'var(--color-text-light)';
            emptyMessage.style.fontStyle = 'italic';
            emptyMessage.style.display = 'none';
            container.appendChild(emptyMessage);
            this.dom.emptyMessage = emptyMessage;
            
            // Create loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                    <div style="margin-bottom: 10px; border: 3px solid #f3f3f3; border-top: 3px solid var(--color-primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
                    <div>Loading actions...</div>
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
                /* Action item - ultra-compact layout */
                .action-item {
                    display: flex;
                    align-items: center;
                    height: 30px;
                    padding: 0;
                    margin: 0;
                    position: relative;
                    background-color: white;
                    border-bottom: 1px solid #eee;
                }
                
                .action-item:hover {
                    background-color: #f9f9f9;
                }
                
                /* Left section with dot and name */
                .action-left {
                    display: flex;
                    align-items: center;
                    padding-left: 10px;
                    flex: 1;
                    min-width: 0;
                    height: 100%;
                }
                
                /* Green dot indicator */
                .action-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #4caf50;
                    margin-right: 8px;
                    flex-shrink: 0;
                }
                
                /* Action name */
                .action-name {
                    font-size: 13px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                    min-width: 0;
                }
                
                /* Middle section with priority and info */
                .action-middle {
                    display: flex;
                    align-items: center;
                    margin-right: 8px;
                    height: 100%;
                }
                
                /* Priority tag - IMPROVED ALIGNMENT */
                .priority-tag {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    padding: 0 5px;
                    border-radius: 10px;
                    margin-right: 8px;
                    text-align: center;
                    min-width: 24px;
                    height: 18px;  /* Fixed height for consistent sizing */
                    box-sizing: border-box;
                }
                
                .priority-high {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                    border: 1px solid #c8e6c9;
                }
                
                .priority-medium {
                    background-color: #fff3e0;
                    color: #e65100;
                    border: 1px solid #ffe0b2;
                }
                
                .priority-low {
                    background-color: #f5f5f5;
                    color: #757575;
                    border: 1px solid #e0e0e0;
                }
                
                /* Info button - IMPROVED ALIGNMENT */
                .info-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #2196f3;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 11px;
                    text-decoration: underline;
                    padding: 0 4px;
                    margin: 0;
                    height: 18px; /* Match height of priority tag */
                }
                
                /* Start button container */
                .action-right {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    width: 80px; /* Fixed width for better panel layout */
                    min-width: 60px; /* Ensure minimum width */
                    flex-shrink: 1; /* Allow shrinking if needed */
                    padding-right: 4px; /* Add small padding on right */
                }
                
                /* Start button - IMPROVED ALIGNMENT */
                .start-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #e3f2fd;
                    color: #2196f3;
                    border: 1px solid #bbdefb;
                    border-radius: 4px;
                    font-size: 12px;
                    height: 22px; /* Consistent height */
                    width: 100%;
                    text-align: center;
                    cursor: pointer;
                    margin: 0 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-width: 50px;
                    box-sizing: border-box;
                    font-weight: 500; /* Slightly bolder text */
                }

                /* Search highlighting */
                .search-highlight {
                    background-color: #ffecb3;
                    font-weight: bold;
                }
                
                /* Stats element at bottom */
                .action-stats {
                    padding: 5px 10px;
                    font-size: 11px;
                    color: #757575;
                    text-align: center;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                }
                
                /* Container styling */
                .actions-container {
                    overflow-y: auto;
                }
                
                /* Custom scrollbar */
                .actions-container::-webkit-scrollbar {
                    width: 6px;
                }
                
                .actions-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .actions-container::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
            `;
            
            document.head.appendChild(style);
        },
        
        /**
         * Toggle between sorting by priority and name
         */
        toggleSortOrder: function() {
            this.state.sortOrder = this.state.sortOrder === 'priority' ? 'name' : 'priority';
            
            // Update sort button with indicator
            if (this.dom.sortButton) {
                this.dom.sortButton.innerHTML = `⇅ ${this.state.sortOrder === 'priority' ? 'Priority' : 'Name'}`;
                this.dom.sortButton.title = `Sorted by ${this.state.sortOrder}. Click to toggle.`;
            }
            
            Framework.showToast(`Sorting by ${this.state.sortOrder}`);
            this.renderActions();
        },
        
        /**
         * Handle search input
         * @param {string} query - Search query
         */
        handleSearch: function(query) {
            this.state.searchQuery = query.trim().toLowerCase();
            
            // Show/hide clear button
            if (this.dom.clearSearch) {
                this.dom.clearSearch.style.display = this.state.searchQuery ? 'block' : 'none';
            }
            
            this.filterActions();
            this.renderActions();
        },
        
        /**
         * Filter actions based on search query
         */
        filterActions: function() {
            if (!this.state.actions) {
                this.state.filteredActions = null;
                return;
            }
            
            if (!this.state.searchQuery) {
                this.state.filteredActions = this.state.actions;
                return;
            }
            
            // Create a filtered copy
            const filtered = {};
            Object.keys(this.state.actions).forEach(actionName => {
                const action = this.state.actions[actionName];
                
                // Check action name and description if available
                if (actionName.toLowerCase().includes(this.state.searchQuery) || 
                    (action.description && action.description.toLowerCase().includes(this.state.searchQuery))) {
                    filtered[actionName] = action;
                }
            });
            
            this.state.filteredActions = filtered;
        },
        
        /**
         * Fetches and displays actions from actions.json
         * @param {boolean} forceRefresh - Whether to force refresh even if data hasn't changed
         */
        fetchActions: async function(forceRefresh = false) {
            // Show loading only on initial load or force refresh
            if (!this.state.actions || forceRefresh) {
                this.showLoading();
            }
            
            try {
                // Clear any existing error state
                this.state.errorState = null;
                this.hideError();
                
                const response = await fetch(CONFIG.api.actions);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const actions = await response.json();
                
                // Update only if data changed or force refresh
                const actionsJSON = JSON.stringify(actions);
                if (forceRefresh || !this.state.actions || actionsJSON !== JSON.stringify(this.state.actions)) {
                    console.log(`[${this.id}] Actions data updated or force refreshed`);
                    
                    // Update state
                    this.state.actions = actions;
                    this.state.lastUpdate = new Date();
                    
                    // Filter and update display
                    this.filterActions();
                    this.renderActions();
                    this.updateLastUpdateTime();
                    
                    // If this was a forced refresh, show a toast
                    if (forceRefresh) {
                        Framework.showToast('Actions refreshed');
                    }
                } else {
                    // Data unchanged, just update the timestamp
                    this.updateLastUpdateTime();
                }
                
                // Hide loading
                this.hideLoading();
                
            } catch (error) {
                console.error(`[${this.id}] Error fetching actions:`, error);
                this.state.errorState = error.message;
                this.showError(`Failed to load actions: ${error.message}`);
                this.hideLoading();
            }
        },
        
        /**
         * Show loading indicator
         */
        showLoading: function() {
            if (this.dom.loadingIndicator) {
                this.state.isLoading = true;
                this.dom.loadingIndicator.style.display = 'block';
                
                // Hide action container while loading
                if (this.dom.actionsContainer) {
                    this.dom.actionsContainer.style.display = 'none';
                }
                
                // Hide empty message if showing
                if (this.dom.emptyMessage) {
                    this.dom.emptyMessage.style.display = 'none';
                }
                
                // Hide stats while loading
                if (this.dom.statsElement) {
                    this.dom.statsElement.style.display = 'none';
                }
            }
        },
        
        /**
         * Hide loading indicator
         */
        hideLoading: function() {
            if (this.dom.loadingIndicator) {
                this.state.isLoading = false;
                this.dom.loadingIndicator.style.display = 'none';
                
                // Show action container after loading
                if (this.dom.actionsContainer) {
                    this.dom.actionsContainer.style.display = 'block';
                }
                
                // Show stats after loading
                if (this.dom.statsElement) {
                    this.dom.statsElement.style.display = 'block';
                }
            }
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
            
            if (this.dom.statsElement) {
                this.dom.statsElement.style.display = 'none';
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
         * Render actions in the panel
         */
        renderActions: function() {
            if (!this.dom.actionsContainer) return;
            
            const actions = this.state.filteredActions;
            this.dom.actionsContainer.innerHTML = '';
            
            if (!actions || Object.keys(actions).length === 0) {
                if (this.dom.emptyMessage) {
                    this.dom.emptyMessage.textContent = this.state.searchQuery 
                        ? `No actions match "${this.state.searchQuery}"` 
                        : 'No actions available';
                    this.dom.emptyMessage.style.display = 'block';
                }
                
                if (this.dom.actionsContainer) {
                    this.dom.actionsContainer.style.display = 'none';
                }
                
                // Update stats
                if (this.dom.statsElement) {
                    this.dom.statsElement.textContent = 'No actions found';
                }
                
                return;
            }
            
            if (this.dom.emptyMessage) {
                this.dom.emptyMessage.style.display = 'none';
            }
            
            if (this.dom.actionsContainer) {
                this.dom.actionsContainer.style.display = 'block';
            }
            
            // Sort actions by priority or name
            const sortedActions = this.getSortedActions(actions);
            
            // Create action elements
            sortedActions.forEach(actionName => {
                const action = actions[actionName];
                const actionElement = this.createActionElement(actionName, action);
                this.dom.actionsContainer.appendChild(actionElement);
            });
            
            // Update action count
            this.state.actionCount = sortedActions.length;
            
            // Create or update stats
            const statsText = `${this.state.actionCount} actions${this.state.searchQuery ? ` matching "${this.state.searchQuery}"` : ''} (sorted by ${this.state.sortOrder})`;
            
            // If statsElement already exists, remove it first
            if (this.dom.statsElement) {
                this.dom.statsElement.remove();
            }
            
            // Create new stats element
            const statsElement = document.createElement('div');
            statsElement.className = 'action-stats';
            statsElement.textContent = statsText;
            
            // Add to actionsContainer directly
            this.dom.actionsContainer.appendChild(statsElement);
            this.dom.statsElement = statsElement;
        },
        
        /**
         * Get actions sorted according to current sort order
         * @param {object} actions - Actions object
         * @returns {Array} - Sorted action names
         */
        getSortedActions: function(actions) {
            const actionNames = Object.keys(actions);
            
            if (this.state.sortOrder === 'priority') {
                // Sort by priority, then name
                return actionNames.sort((a, b) => {
                    const priorityA = actions[a].priority || 0;
                    const priorityB = actions[b].priority || 0;
                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }
                    return a.localeCompare(b);
                });
            } else {
                // Sort by name only
                return actionNames.sort();
            }
        },
        
        /**
         * Create a single-line action element with proper button alignment
         * @param {string} actionName - Name of the action
         * @param {object} action - Action data
         * @returns {HTMLElement} - Action element
         */
        createActionElement: function(actionName, action) {
            const item = document.createElement('div');
            item.className = 'action-item';
            
            // Left section - dot and name
            const leftSection = document.createElement('div');
            leftSection.className = 'action-left';
            
            // Green dot indicator
            const dot = document.createElement('div');
            dot.className = 'action-dot';
            leftSection.appendChild(dot);
            
            // Action name with search highlighting
            const nameElement = document.createElement('div');
            nameElement.className = 'action-name';
            
            if (this.state.searchQuery && actionName.toLowerCase().includes(this.state.searchQuery)) {
                const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                nameElement.innerHTML = actionName.replace(regex, '<span class="search-highlight">$1</span>');
            } else {
                nameElement.textContent = actionName;
            }
            leftSection.appendChild(nameElement);
            item.appendChild(leftSection);
            
            // Middle section - priority and info
            const middleSection = document.createElement('div');
            middleSection.className = 'action-middle';
            
            // Priority badge
            if (action.priority !== undefined) {
                const priorityTag = document.createElement('div');
                priorityTag.className = 'priority-tag';
                
                // Add specific class based on priority
                if (action.priority < 10) {
                    priorityTag.classList.add('priority-high');
                } else if (action.priority < 20) {
                    priorityTag.classList.add('priority-medium');
                } else {
                    priorityTag.classList.add('priority-low');
                }
                
                priorityTag.textContent = `P:${action.priority}`;
                middleSection.appendChild(priorityTag);
            }
            
            // Info button (if description available)
            if (action.description) {
                const infoButton = document.createElement('button');
                infoButton.className = 'info-button';
                infoButton.textContent = 'Info';
                infoButton.title = action.description; // Show description as tooltip
                infoButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Framework.showToast(action.description);
                });
                middleSection.appendChild(infoButton);
            }
            
            item.appendChild(middleSection);
            
            // Right section - start button
            const rightSection = document.createElement('div');
            rightSection.className = 'action-right';
            
            // Start button
            const startButton = document.createElement('button');
            startButton.className = 'start-button';
            startButton.textContent = 'Start';
            startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const userInput = document.getElementById('userInput');
                if (userInput) {
                    userInput.value = `start ${actionName}`;
                    userInput.focus();
                    
                    // Submit the action directly to chat
                    // Find the send button and trigger a click
                    const sendButton = document.getElementById('sendButton');
                    if (sendButton) {
                        sendButton.click();
                    } else {
                        // Alternative: Use Framework's sendMessage function directly
                        Framework.sendMessage();
                    }
                }
                Framework.showToast(`Action "${actionName}" started`);
            });
            rightSection.appendChild(startButton);
            
            item.appendChild(rightSection);
            
            return item;
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
            
            // Clear any timers or subscribers if needed
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