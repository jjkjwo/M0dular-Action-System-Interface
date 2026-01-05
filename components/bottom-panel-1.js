/**
 * ==============================================================================================
 * Bottom Panel 1 - Enhanced Memory Management Component
 * ==============================================================================================
 *
 * Redesigned Memory Manager panel with a streamlined, space-efficient interface matching top panels.
 * Provides comprehensive tools for viewing and managing memory data with improved visual consistency.
 *
 * @version 4.0.1 - Fixed button text colors and improved statistics bar flexibility
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-1',
        
        // DOM references
        dom: {
            content: null,
            noteElement: null,
            memoryContainer: null,
            factsList: null,
            conversationsList: null,
            preferencesList: null,
            searchInput: null,
            clearSearchButton: null,
            categoryTabs: null,
            filterContainer: null,
            statsElement: null,
            loadingIndicator: null,
            errorMessage: null,
            refreshButton: null,
            clearButton: null,
            autoRefreshToggle: null
        },
        
        // Component state
        state: {
            memoryActive: false,
            memories: {
                facts: {},
                conversations: {},
                preferences: {}
            },
            activeCategory: 'facts',
            searchQuery: '',
            filteredResults: {
                facts: {},
                conversations: {},
                preferences: {}
            },
            statistics: {
                totalFacts: 0,
                totalConversations: 0,
                totalPreferences: 0
            },
            lastUpdate: null,
            isLoading: false,
            error: null,
            refreshInterval: null,
            autoRefresh: false,
            refreshRate: 30000, // 30 seconds
            expandedItems: new Set(),
            subscriptions: [],
            activeFilters: []
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
            
            // Create UI structure
            this.renderContent();
            
            // Subscribe to active actions changes to detect "memory" plugin
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateMemoryState(data.actions);
            });
            
            // Store subscription for cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });
            
            // Initial state check
            this.checkInitialMemoryState();
            
            // Add styles
            this.addStyles();
            
            console.log(`[${this.id}] Initialization complete.`);
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
                .memory-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                .memory-note {
                    padding: 15px;
                    margin: 10px;
                    background-color: #fff4e5;
                    border: 1px solid #ffcc80;
                    border-radius: 5px;
                    color: #e65100;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                
                .memory-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                /* Standard panel header styling matching top panels */
                .panel-header-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .header-title {
                    font-weight: bold;
                }
                
                .header-count {
                    background-color: var(--color-primary);
                    color: white;
                    padding: 1px 6px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                }
                
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                /* Search styling matching top-panel-2 */
                .search-container {
                    position: relative;
                    padding: 8px 10px;
                    border-bottom: 1px solid #e0e0e0;
                    background-color: #f8f8f8;
                    display: flex;
                    align-items: center;
                }
                
                .search-input {
                    width: 100%;
                    padding: 6px 30px 6px 8px;
                    border: 1px solid var(--color-border);
                    border-radius: var(--border-radius-sm);
                    font-size: 13px;
                    transition: border-color 0.2s;
                }
                
                .search-input:focus {
                    border-color: var(--color-primary);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 118, 168, 0.2);
                }
                
                .clear-search-button {
                    position: absolute;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: var(--color-text-light);
                    display: none;
                }
                
                /* Tab styling matching top-panel-5 */
                .category-tabs {
                    display: flex;
                    background-color: #f1f1f1;
                    border-bottom: 1px solid var(--color-border);
                }
                
                .category-tab {
                    flex: 1;
                    padding: 8px 12px;
                    background-color: transparent;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-weight: bold;
                    color: #555;
                    transition: background-color 0.2s;
                    text-align: center;
                    border-bottom: 3px solid transparent;
                    user-select: none;
                }
                
                .category-tab:hover {
                    background-color: #e0e0e0;
                }
                
                .category-tab.active-tab {
                    background-color: #fff;
                    color: var(--color-primary);
                    border-bottom: 3px solid var(--color-primary);
                }
                
                .filter-container {
                    display: flex;
                    padding: 5px 10px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .filter-tag {
                    padding: 3px 8px;
                    background-color: #e3f2fd;
                    border: 1px solid #bbdefb;
                    border-radius: 12px;
                    font-size: 11px;
                    color: #1565c0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                
                .filter-tag.active {
                    background-color: #bbdefb;
                    font-weight: bold;
                }
                
                .filter-tag:hover {
                    background-color: #bbdefb;
                }
                
                .memory-content {
                    flex: 1;
                    overflow-y: auto;
                    background-color: white;
                    position: relative;
                }
                
                .memory-list {
                    padding: 0;
                }
                
                /* More compact fact category styling */
                .fact-category {
                    margin-bottom: 5px;
                    background-color: #f9f9f9;
                    border-radius: 0;
                    overflow: hidden;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                
                .category-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    background-color: #edf2f7;
                    cursor: pointer;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background-color 0.2s;
                }
                
                .category-header:hover {
                    background-color: #e3eaf3;
                }
                
                .category-name {
                    font-weight: bold;
                    color: var(--color-primary-dark);
                    font-size: 13px;
                }
                
                .category-count {
                    background-color: var(--color-primary);
                    color: white;
                    padding: 1px 6px;
                    border-radius: 10px;
                    font-size: 11px;
                }
                
                /* Compact fact items */
                .facts-items {
                    padding: 0;
                }
                
                .fact-item {
                    padding: 8px 10px;
                    margin: 0;
                    border-bottom: 1px solid #f0f0f0;
                    background-color: white;
                    transition: all 0.2s;
                }
                
                .fact-item:hover {
                    background-color: #f5f5f5;
                }
                
                .fact-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .fact-key {
                    font-weight: bold;
                    color: var(--color-primary-dark);
                    font-size: 13px;
                }
                
                .fact-value {
                    margin-top: 4px;
                    word-break: break-word;
                    line-height: 1.4;
                    font-size: 13px;
                }
                
                .fact-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 5px;
                    font-size: 11px;
                    color: #999;
                }
                
                .fact-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 6px;
                }
                
                .fact-button {
                    padding: 3px 8px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                    background-color: #f0f0f0;
                    color: #333;
                }
                
                .fact-button:hover {
                    background-color: #e0e0e0;
                }
                
                .copy-button {
                    background-color: var(--color-primary);
                    color: #ffffff; 
                    font-weight: bold;
                    text-shadow: 0px 1px 1px rgba(0,0,0,0.3); /* Added text shadow for better contrast */
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2); /* Added subtle shadow */
                    letter-spacing: 0.5px; /* Improve readability */
                    padding: 4px 10px; /* Slightly larger padding */
                }
                
                .copy-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                .delete-button {
                    background-color: #f44336;
                    color: #ffffff;
                    font-weight: bold;
                    text-shadow: 0px 1px 1px rgba(0,0,0,0.3); /* Added text shadow for better contrast */
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2); /* Added subtle shadow */
                    letter-spacing: 0.5px; /* Improve readability */
                    padding: 4px 10px; /* Slightly larger padding */
                }
                
                .delete-button:hover {
                    background-color: #d32f2f;
                }
                
                /* Compact conversation items */
                .conversation-item {
                    padding: 8px 10px;
                    margin: 0;
                    border-bottom: 1px solid #f0f0f0;
                    background-color: white;
                    transition: all 0.2s;
                }
                
                .conversation-item:hover {
                    background-color: #f5f5f5;
                }
                
                .conversation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .conversation-id {
                    font-weight: bold;
                    color: var(--color-primary-dark);
                    font-size: 13px;
                }
                
                .conversation-summary {
                    margin-top: 4px;
                    line-height: 1.4;
                    font-size: 13px;
                }
                
                .topic-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 5px;
                }
                
                .topic-tag {
                    padding: 2px 6px;
                    background-color: #e3f2fd;
                    border: 1px solid #bbdefb;
                    border-radius: 10px;
                    font-size: 11px;
                    color: #1565c0;
                }
                
                /* Compact preference items */
                .preference-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    margin: 0;
                    border-bottom: 1px solid #f0f0f0;
                    background-color: white;
                    transition: all 0.2s;
                }
                
                .preference-item:hover {
                    background-color: #f5f5f5;
                }
                
                .preference-key-value {
                    display: flex;
                    flex-direction: column;
                }
                
                .preference-key {
                    font-weight: bold;
                    color: var(--color-primary-dark);
                    font-size: 13px;
                }
                
                .preference-value {
                    color: #333;
                    margin-top: 2px;
                    font-size: 13px;
                }
                
                /* Action buttons */
                .action-buttons {
                    padding: 8px 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: #f8f8f8;
                    border-top: 1px solid #e0e0e0;
                }
                
                .auto-refresh-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .auto-refresh-toggle {
                    margin: 0;
                    cursor: pointer;
                }
                
                .auto-refresh-label {
                    font-size: 12px;
                    color: #666;
                    cursor: pointer;
                }
                
                .action-button {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 12px;
                    font-weight: bold;
                    color: white;
                }
                
                .refresh-button {
                    background-color: var(--color-primary);
                }
                
                .refresh-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                .clear-button {
                    background-color: #f44336;
                }
                
                .clear-button:hover {
                    background-color: #d32f2f;
                }
                
                /* Status elements - IMPROVED: Made more flexible with wrapping and better spacing */
                .memory-stats {
                    padding: 5px 10px;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                    color: #666;
                    font-size: 11px;
                    display: flex;
                    flex-wrap: wrap; /* FIXED: Allow items to wrap */
                    gap: 8px; /* ADDED: Use gap instead of space-between for better wrapping */
                }
                
                .stats-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap; /* ADDED: Prevent text from breaking within item */
                    min-width: 80px; /* ADDED: Minimum width for better space distribution */
                    max-width: 150px; /* ADDED: Maximum width to prevent one item from taking too much space */
                    overflow: hidden; /* ADDED: Hide overflow */
                    text-overflow: ellipsis; /* ADDED: Show ellipsis for overflowing text */
                }
                
                .stats-icon {
                    color: var(--color-primary);
                    flex-shrink: 0; /* ADDED: Prevent icon from shrinking */
                }
                
                /* Messages and Feedback */
                .empty-message, .no-results-message {
                    padding: 20px;
                    text-align: center;
                    color: #999;
                    font-style: italic;
                    background-color: #f9f9f9;
                    border-radius: 0;
                    margin: 0;
                }
                
                .info-tip {
                    background-color: #e3f2fd;
                    padding: 10px;
                    margin: 0;
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .info-tip-icon {
                    color: #1565c0;
                    flex-shrink: 0;
                    font-size: 14px;
                }
                
                .info-tip-text {
                    font-size: 12px;
                    color: #333;
                    line-height: 1.4;
                }
                
                .loading-indicator {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(255, 255, 255, 0.8);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 10;
                }
                
                .loading-spinner {
                    width: 30px;
                    height: 30px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 10px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .error-message {
                    padding: 10px;
                    margin: 0;
                    background-color: #ffebee;
                    border: 1px solid #ffcdd2;
                    color: #c62828;
                    text-align: center;
                    font-size: 13px;
                }
                
                /* Custom scrollbar for history list */
                .memory-content::-webkit-scrollbar {
                    width: 6px;
                }
                
                .memory-content::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .memory-content::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
                
                /* Search highlighting */
                .search-highlight {
                    background-color: #ffecb3;
                    font-weight: bold;
                }
            `;
            
            document.head.appendChild(style);
        },
        
        /**
         * Check initial state of "memory" plugin
         */
        checkInitialMemoryState: function() {
            fetch(CONFIG.api.activeActions)
                .then(response => response.json())
                .then(data => {
                    if (data && data.actions) {
                        this.updateMemoryState(data.actions);
                    }
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial memory state:`, error);
                    this.showError('Failed to check memory plugin status');
                });
        },
        
        /**
         * Update component state based on memory active status
         * @param {Array} actions - Active actions array
         */
        updateMemoryState: function(actions) {
            // Check if "memory" plugin is in the active actions
            const isMemoryActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'memory';
            });
            
            // Only update if state has changed
            if (this.state.memoryActive !== isMemoryActive) {
                console.log(`[${this.id}] Memory action status changed: ${isMemoryActive}`);
                this.state.memoryActive = isMemoryActive;
                
                // Update UI based on memory status
                this.updateUIVisibility();
                
                // Fetch memory data if active
                if (isMemoryActive) {
                    this.fetchMemoryData();
                    
                    // Start auto-refresh if enabled
                    if (this.state.autoRefresh) {
                        this.startAutoRefresh();
                    }
                } else {
                    // Stop auto-refresh if running
                    this.stopAutoRefresh();
                }
            }
        },
        
        /**
         * Update UI elements visibility based on memory active state
         */
        updateUIVisibility: function() {
            if (!this.dom.noteElement || !this.dom.memoryContainer) return;
            
            this.dom.noteElement.style.display = this.state.memoryActive ? 'none' : 'block';
            this.dom.memoryContainer.style.display = this.state.memoryActive ? 'flex' : 'none';
        },
        
        /**
         * Render component content with the new compact styling
         */
        renderContent: function() {
            if (!this.dom.content) return;
            
            // Create main container
            const container = document.createElement('div');
            container.className = 'memory-panel';
            
            // Create warning note for memory requirement
            const noteElement = document.createElement('div');
            noteElement.className = 'memory-note';
            noteElement.innerHTML = `
                <strong>Plugin Required</strong><br>
                You must start the "memory" plugin to access memory management features<br>
                <code>start memory</code>
            `;
            this.dom.noteElement = noteElement;
            container.appendChild(noteElement);
            
            // Create memory container
            const memoryContainer = document.createElement('div');
            memoryContainer.className = 'memory-container';
            memoryContainer.style.display = this.state.memoryActive ? 'flex' : 'none';
            this.dom.memoryContainer = memoryContainer;
            
            // Add standard panel header (matching top panels)
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            
            // Left side with title and count
            const headerLeft = document.createElement('div');
            headerLeft.className = 'header-left';
            
            const headerTitle = document.createElement('div');
            headerTitle.className = 'header-title';
            headerTitle.textContent = 'Memory Manager';
            
            const memoryCount = document.createElement('div');
            memoryCount.className = 'header-count';
            memoryCount.textContent = '0'; // Will be updated later
            
            headerLeft.appendChild(headerTitle);
            headerLeft.appendChild(memoryCount);
            
            // Right side with controls
            const headerRight = document.createElement('div');
            headerRight.className = 'header-right';
            
            // Refresh button
            const refreshButton = document.createElement('button');
            refreshButton.className = 'action-button refresh-button';
            refreshButton.innerHTML = '🔄 Refresh';
            refreshButton.setAttribute('aria-label', 'Refresh memory data');
            refreshButton.addEventListener('click', () => this.fetchMemoryData(true));
            this.dom.refreshButton = refreshButton;
            
            // Clear button
            const clearButton = document.createElement('button');
            clearButton.className = 'action-button clear-button';
            clearButton.innerHTML = '🗑️ Clear All';
            clearButton.setAttribute('aria-label', 'Clear all memory data');
            clearButton.addEventListener('click', () => this.clearAllMemories());
            this.dom.clearButton = clearButton;
            
            headerRight.appendChild(refreshButton);
            headerRight.appendChild(clearButton);
            
            header.appendChild(headerLeft);
            header.appendChild(headerRight);
            memoryContainer.appendChild(header);
            
            // Create search container matching top panels
            const searchContainer = document.createElement('div');
            searchContainer.className = 'search-container';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search memories...';
            searchInput.setAttribute('aria-label', 'Search memories');
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            this.dom.searchInput = searchInput;
            
            const clearSearchButton = document.createElement('button');
            clearSearchButton.className = 'clear-search-button';
            clearSearchButton.innerHTML = '×';
            clearSearchButton.setAttribute('aria-label', 'Clear search');
            clearSearchButton.addEventListener('click', () => {
                searchInput.value = '';
                this.handleSearch('');
                clearSearchButton.style.display = 'none';
            });
            this.dom.clearSearchButton = clearSearchButton;
            
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearSearchButton);
            memoryContainer.appendChild(searchContainer);
            
            // Create filter container (hidden by default)
            const filterContainer = document.createElement('div');
            filterContainer.className = 'filter-container';
            filterContainer.style.display = 'none'; // Initially hidden
            this.dom.filterContainer = filterContainer;
            memoryContainer.appendChild(filterContainer);
            
            // Create category tabs matching top-panel-5
            const categoryTabs = document.createElement('div');
            categoryTabs.className = 'category-tabs';
            this.dom.categoryTabs = categoryTabs;
            
            // Create tabs for Facts, Conversations, Preferences
            const categories = ['facts', 'conversations', 'preferences'];
            categories.forEach(category => {
                const tab = document.createElement('div');
                tab.className = `category-tab ${category === this.state.activeCategory ? 'active-tab' : ''}`;
                tab.setAttribute('data-category', category);
                
                // Capitalize first letter
                const displayName = category.charAt(0).toUpperCase() + category.slice(1);
                tab.textContent = displayName;
                
                tab.addEventListener('click', () => this.switchCategory(category));
                categoryTabs.appendChild(tab);
            });
            
            memoryContainer.appendChild(categoryTabs);
            
            // Create content area for memories
            const memoryContent = document.createElement('div');
            memoryContent.className = 'memory-content';
            
            // Create lists for each category
            const factsList = document.createElement('div');
            factsList.className = 'memory-list facts-list';
            factsList.style.display = this.state.activeCategory === 'facts' ? 'block' : 'none';
            this.dom.factsList = factsList;
            
            const conversationsList = document.createElement('div');
            conversationsList.className = 'memory-list conversations-list';
            conversationsList.style.display = this.state.activeCategory === 'conversations' ? 'block' : 'none';
            this.dom.conversationsList = conversationsList;
            
            const preferencesList = document.createElement('div');
            preferencesList.className = 'memory-list preferences-list';
            preferencesList.style.display = this.state.activeCategory === 'preferences' ? 'block' : 'none';
            this.dom.preferencesList = preferencesList;
            
            // Loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.style.display = 'none';
            loadingIndicator.innerHTML = `
                <div class="loading-spinner"></div>
                <div>Loading memory data...</div>
            `;
            this.dom.loadingIndicator = loadingIndicator;
            
            // Error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.style.display = 'none';
            this.dom.errorMessage = errorMessage;
            
            memoryContent.appendChild(factsList);
            memoryContent.appendChild(conversationsList);
            memoryContent.appendChild(preferencesList);
            memoryContent.appendChild(loadingIndicator);
            memoryContent.appendChild(errorMessage);
            
            memoryContainer.appendChild(memoryContent);
            
            // Create stats element
            const statsElement = document.createElement('div');
            statsElement.className = 'memory-stats';
            this.dom.statsElement = statsElement;
            memoryContainer.appendChild(statsElement);
            
            // Create action buttons
            const actionButtons = document.createElement('div');
            actionButtons.className = 'action-buttons';
            
            // Auto-refresh toggle
            const autoRefreshContainer = document.createElement('div');
            autoRefreshContainer.className = 'auto-refresh-container';
            
            const autoRefreshToggle = document.createElement('input');
            autoRefreshToggle.type = 'checkbox';
            autoRefreshToggle.id = 'auto-refresh-toggle';
            autoRefreshToggle.className = 'auto-refresh-toggle';
            autoRefreshToggle.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));
            this.dom.autoRefreshToggle = autoRefreshToggle;
            
            const autoRefreshLabel = document.createElement('label');
            autoRefreshLabel.className = 'auto-refresh-label';
            autoRefreshLabel.setAttribute('for', 'auto-refresh-toggle');
            autoRefreshLabel.textContent = 'Auto-refresh';
            
            autoRefreshContainer.appendChild(autoRefreshToggle);
            autoRefreshContainer.appendChild(autoRefreshLabel);
            
            actionButtons.appendChild(autoRefreshContainer);
            memoryContainer.appendChild(actionButtons);
            
            // Add everything to the main container
            container.appendChild(memoryContainer);
            
            // Add to panel
            this.dom.content.appendChild(container);
            
            // Update the statistics display if data exists
            this.updateStatistics();
        },
        
        /**
         * Switch between memory categories
         * @param {string} category - Category to display
         */
        switchCategory: function(category) {
            if (this.state.activeCategory === category) return;
            
            this.state.activeCategory = category;
            
            // Update tabs UI
            const tabs = this.dom.categoryTabs.querySelectorAll('.category-tab');
            tabs.forEach(tab => {
                const tabCategory = tab.getAttribute('data-category');
                if (tabCategory === category) {
                    tab.classList.add('active-tab');
                } else {
                    tab.classList.remove('active-tab');
                }
            });
            
            // Update content visibility
            if (this.dom.factsList) {
                this.dom.factsList.style.display = category === 'facts' ? 'block' : 'none';
            }
            if (this.dom.conversationsList) {
                this.dom.conversationsList.style.display = category === 'conversations' ? 'block' : 'none';
            }
            if (this.dom.preferencesList) {
                this.dom.preferencesList.style.display = category === 'preferences' ? 'block' : 'none';
            }
            
            // Update filter controls based on category
            this.updateFilterControls();
            
            console.log(`[${this.id}] Switched to category: ${category}`);
        },
        
        /**
         * Update filter controls based on current category and search query
         */
        updateFilterControls: function() {
            if (!this.dom.filterContainer) return;
            
            // Clear existing filters
            this.dom.filterContainer.innerHTML = '';
            
            // Only show filters if there's a search query
            if (!this.state.searchQuery) {
                this.dom.filterContainer.style.display = 'none';
                return;
            }
            
            const category = this.state.activeCategory;
            let filterTags = [];
            
            // Create filter tags based on category
            switch (category) {
                case 'facts':
                    // Get unique categories from filtered facts
                    filterTags = Object.keys(this.state.filteredResults.facts);
                    break;
                case 'conversations':
                    // Get unique topics from filtered conversations
                    const topics = new Set();
                    Object.values(this.state.filteredResults.conversations).forEach(convo => {
                        if (convo.topics && Array.isArray(convo.topics)) {
                            convo.topics.forEach(topic => topics.add(topic));
                        }
                    });
                    filterTags = Array.from(topics);
                    break;
                case 'preferences':
                    // No specific filters for preferences
                    break;
            }
            
            // If we have filter tags, display them
            if (filterTags.length > 0) {
                filterTags.forEach(tag => {
                    const filterTag = document.createElement('div');
                    filterTag.className = 'filter-tag';
                    filterTag.textContent = tag;
                    filterTag.setAttribute('data-filter', tag);
                    
                    // Add active class if already in activeFilters
                    if (this.state.activeFilters.includes(tag)) {
                        filterTag.classList.add('active');
                    }
                    
                    filterTag.addEventListener('click', () => {
                        filterTag.classList.toggle('active');
                        this.updateActiveFilters();
                        this.renderMemories();
                    });
                    
                    this.dom.filterContainer.appendChild(filterTag);
                });
                
                // Add a "Clear Filters" tag
                const clearFiltersTag = document.createElement('div');
                clearFiltersTag.className = 'filter-tag';
                clearFiltersTag.textContent = 'Clear Filters';
                clearFiltersTag.style.backgroundColor = '#ffebee';
                clearFiltersTag.style.borderColor = '#ffcdd2';
                clearFiltersTag.style.color = '#c62828';
                
                clearFiltersTag.addEventListener('click', () => {
                    const activeTags = this.dom.filterContainer.querySelectorAll('.filter-tag.active');
                    activeTags.forEach(tag => tag.classList.remove('active'));
                    this.state.activeFilters = [];
                    this.renderMemories();
                });
                
                this.dom.filterContainer.appendChild(clearFiltersTag);
                this.dom.filterContainer.style.display = 'flex';
            } else {
                this.dom.filterContainer.style.display = 'none';
            }
        },
        
        /**
         * Update active filters from DOM
         */
        updateActiveFilters: function() {
            if (!this.dom.filterContainer) return;
            
            const activeFilterElements = this.dom.filterContainer.querySelectorAll('.filter-tag.active');
            this.state.activeFilters = Array.from(activeFilterElements)
                .map(el => el.getAttribute('data-filter'))
                .filter(Boolean);
        },
        
        /**
         * Handle search input
         * @param {string} query - Search query
         */
        handleSearch: function(query) {
            this.state.searchQuery = query.trim().toLowerCase();
            
            // Show/hide clear button
            if (this.dom.clearSearchButton) {
                this.dom.clearSearchButton.style.display = this.state.searchQuery ? 'block' : 'none';
            }
            
            // Reset active filters when search query changes
            this.state.activeFilters = [];
            
            // Filter memories based on search query
            this.filterMemories();
            
            // Update filter controls
            this.updateFilterControls();
            
            // Render filtered results
            this.renderMemories();
        },
        
        /**
         * Filter memories based on search query
         */
        filterMemories: function() {
            const query = this.state.searchQuery;
            
            // Reset filtered results
            this.state.filteredResults = {
                facts: {},
                conversations: {},
                preferences: {}
            };
            
            if (!query) {
                // If no query, use all memories
                this.state.filteredResults = {...this.state.memories};
                return;
            }
            
            // Filter facts
            const facts = this.state.memories.facts;
            if (facts) {
                Object.entries(facts).forEach(([category, items]) => {
                    // Check if category matches query
                    const categoryMatches = category.toLowerCase().includes(query);
                    
                    // Filter items in this category
                    const matchingItems = {};
                    let hasMatches = false;
                    
                    Object.entries(items).forEach(([key, data]) => {
                        // Check if key or value matches query
                        if (key.toLowerCase().includes(query) || 
                            (data.value && data.value.toString().toLowerCase().includes(query)) ||
                            categoryMatches) {
                            matchingItems[key] = data;
                            hasMatches = true;
                        }
                    });
                    
                    // Add category to filtered results if it has matches
                    if (hasMatches) {
                        this.state.filteredResults.facts[category] = matchingItems;
                    }
                });
            }
            
            // Filter conversations
            const conversations = this.state.memories.conversations;
            if (conversations) {
                Object.entries(conversations).forEach(([id, data]) => {
                    // Check if ID, summary or topics match query
                    if (id.toLowerCase().includes(query) || 
                        (data.summary && data.summary.toLowerCase().includes(query)) ||
                        (data.topics && data.topics.some(topic => topic.toLowerCase().includes(query)))) {
                        this.state.filteredResults.conversations[id] = data;
                    }
                });
            }
            
            // Filter preferences
            const preferences = this.state.memories.preferences;
            if (preferences) {
                Object.entries(preferences).forEach(([key, value]) => {
                    // Check if key or value matches query
                    if (key.toLowerCase().includes(query) || 
                        (value && value.toString().toLowerCase().includes(query))) {
                        this.state.filteredResults.preferences[key] = value;
                    }
                });
            }
        },
        
        /**
         * Fetch memory data from the API
         * @param {boolean} showToast - Whether to show a toast notification on success
         */
        fetchMemoryData: function(showToast = false) {
            if (this.state.isLoading) return;
            
            this.showLoading();
            this.state.isLoading = true;
            
            fetch(CONFIG.api.memory)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Store the data
                    this.state.memories = data || { facts: {}, conversations: {}, preferences: {} };
                    
                    // Calculate statistics
                    this.calculateStatistics();
                    
                    // Filter based on current search query
                    this.filterMemories();
                    
                    // Update UI
                    this.renderMemories();
                    this.updateStatistics();
                    
                    // Hide loading and error states
                    this.hideLoading();
                    this.hideError();
                    
                    // Update last update time
                    this.state.lastUpdate = new Date();
                    
                    if (showToast) {
                        Framework.showToast('Memory data refreshed');
                    }
                    
                    console.log(`[${this.id}] Memory data loaded successfully`);
                })
                .catch(error => {
                    console.error(`[${this.id}] Error fetching memory data:`, error);
                    this.showError(`Failed to load memory data: ${error.message}`);
                    this.hideLoading();
                })
                .finally(() => {
                    this.state.isLoading = false;
                });
        },
        
        /**
         * Calculate statistics from memory data
         */
        calculateStatistics: function() {
            const stats = {
                totalFacts: 0,
                totalConversations: 0,
                totalPreferences: 0
            };
            
            // Count facts
            if (this.state.memories.facts) {
                Object.values(this.state.memories.facts).forEach(category => {
                    stats.totalFacts += Object.keys(category).length;
                });
            }
            
            // Count conversations
            if (this.state.memories.conversations) {
                stats.totalConversations = Object.keys(this.state.memories.conversations).length;
            }
            
            // Count preferences
            if (this.state.memories.preferences) {
                stats.totalPreferences = Object.keys(this.state.memories.preferences).length;
            }
            
            this.state.statistics = stats;
            
            // Update header count with total memories
            const totalMemories = stats.totalFacts + stats.totalConversations + stats.totalPreferences;
            const headerCount = this.dom.memoryContainer?.querySelector('.header-count');
            if (headerCount) {
                headerCount.textContent = totalMemories;
            }
        },
        
        /**
         * Update statistics display - IMPROVED: Now uses more compact formatting
         */
        updateStatistics: function() {
            if (!this.dom.statsElement) return;
            
            const stats = this.state.statistics;
            const lastUpdate = this.state.lastUpdate ? new Date(this.state.lastUpdate).toLocaleTimeString() : 'Never';
            
            // Simplified stats display with shorter labels
            this.dom.statsElement.innerHTML = `
                <div class="stats-item"><span class="stats-icon">📝</span> Facts: ${stats.totalFacts}</div>
                <div class="stats-item"><span class="stats-icon">💬</span> Convos: ${stats.totalConversations}</div>
                <div class="stats-item"><span class="stats-icon">⚙️</span> Prefs: ${stats.totalPreferences}</div>
                <div class="stats-item"><span class="stats-icon">🕒</span> Updated: ${lastUpdate}</div>
            `;
        },
        
        /**
         * Render memories based on current category and search query
         */
        renderMemories: function() {
            if (!this.state.memoryActive) return;
            
            const category = this.state.activeCategory;
            
            // Render based on category
            if (category === 'facts') {
                this.renderFacts();
            } else if (category === 'conversations') {
                this.renderConversations();
            } else if (category === 'preferences') {
                this.renderPreferences();
            }
        },
        
        /**
         * Render facts
         */
        renderFacts: function() {
            if (!this.dom.factsList) return;
            
            // Clear current list
            this.dom.factsList.innerHTML = '';
            
            const facts = this.state.filteredResults.facts;
            const hasActiveFilters = this.state.activeFilters.length > 0;
            
            // Check if facts exist
            if (!facts || Object.keys(facts).length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                
                if (this.state.searchQuery) {
                    emptyMessage.textContent = `No facts found matching "${this.state.searchQuery}"`;
                } else {
                    emptyMessage.textContent = 'No facts stored in memory';
                    
                    // Add helpful tip for first-time users
                    const infoTip = document.createElement('div');
                    infoTip.className = 'info-tip';
                    infoTip.innerHTML = `
                        <div class="info-tip-icon">💡</div>
                        <div class="info-tip-text">
                            You can add facts to memory with the command:<br>
                            <code>memory add fact category|key value</code><br>
                            Example: <code>memory add fact personal|name John</code>
                        </div>
                    `;
                    emptyMessage.appendChild(infoTip);
                }
                
                this.dom.factsList.appendChild(emptyMessage);
                return;
            }
            
            // For each category of facts
            Object.entries(facts).forEach(([factCategory, factItems]) => {
                // Skip if category doesn't match active filters
                if (hasActiveFilters && !this.state.activeFilters.includes(factCategory)) return;
                
                // Create category container
                const categoryContainer = document.createElement('div');
                categoryContainer.className = 'fact-category';
                categoryContainer.setAttribute('data-category', factCategory);
                
                // Category header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'category-header';
                
                const categoryName = document.createElement('div');
                categoryName.className = 'category-name';
                categoryName.textContent = factCategory;
                
                const categoryCount = document.createElement('div');
                categoryCount.className = 'category-count';
                categoryCount.textContent = Object.keys(factItems).length;
                
                categoryHeader.appendChild(categoryName);
                categoryHeader.appendChild(categoryCount);
                
                // Make category expandable/collapsible
                const isExpanded = !this.state.expandedItems.has(`facts-${factCategory}`);
                categoryHeader.addEventListener('click', () => {
                    const itemKey = `facts-${factCategory}`;
                    if (this.state.expandedItems.has(itemKey)) {
                        this.state.expandedItems.delete(itemKey);
                    } else {
                        this.state.expandedItems.add(itemKey);
                    }
                    
                    const factsList = categoryContainer.querySelector('.facts-items');
                    if (factsList) {
                        factsList.style.display = this.state.expandedItems.has(itemKey) ? 'none' : 'block';
                    }
                });
                
                categoryContainer.appendChild(categoryHeader);
                
                // Create facts list
                const factsList = document.createElement('div');
                factsList.className = 'facts-items';
                factsList.style.display = isExpanded ? 'block' : 'none';
                
                // Add each fact
                Object.entries(factItems).forEach(([key, data]) => {
                    const factItem = document.createElement('div');
                    factItem.className = 'fact-item';
                    
                    // Fact header with key
                    const factHeader = document.createElement('div');
                    factHeader.className = 'fact-header';
                    
                    // Fact key with search highlighting
                    const factKey = document.createElement('div');
                    factKey.className = 'fact-key';
                    
                    if (this.state.searchQuery && key.toLowerCase().includes(this.state.searchQuery)) {
                        const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                        factKey.innerHTML = key.replace(regex, '<span class="search-highlight">$1</span>');
                    } else {
                        factKey.textContent = key;
                    }
                    
                    factHeader.appendChild(factKey);
                    factItem.appendChild(factHeader);
                    
                    // Fact value with search highlighting
                    const factValue = document.createElement('div');
                    factValue.className = 'fact-value';
                    
                    const valueText = data.value.toString();
                    if (this.state.searchQuery && valueText.toLowerCase().includes(this.state.searchQuery)) {
                        const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                        factValue.innerHTML = valueText.replace(regex, '<span class="search-highlight">$1</span>');
                    } else {
                        factValue.textContent = valueText;
                    }
                    
                    factItem.appendChild(factValue);
                    
                    // Fact meta info (timestamp)
                    const factMeta = document.createElement('div');
                    factMeta.className = 'fact-meta';
                    
                    // Format timestamp nicely
                    const date = new Date(data.timestamp);
                    const formattedDate = date.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    const formattedTime = date.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    factMeta.textContent = `Added: ${formattedDate} at ${formattedTime}`;
                    factItem.appendChild(factMeta);
                    
                    // Action buttons
                    const factActions = document.createElement('div');
                    factActions.className = 'fact-actions';
                    
                    // Copy button
                    const copyButton = document.createElement('button');
                    copyButton.className = 'fact-button copy-button';
                    copyButton.textContent = 'Copy';
                    copyButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.copyFactToInput(factCategory, key);
                    });
                    
                    // Delete button
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'fact-button delete-button';
                    deleteButton.textContent = 'Delete';
                    deleteButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteFactFromMemory(factCategory, key);
                    });
                    
                    factActions.appendChild(copyButton);
                    factActions.appendChild(deleteButton);
                    factItem.appendChild(factActions);
                    
                    factsList.appendChild(factItem);
                });
                
                categoryContainer.appendChild(factsList);
                this.dom.factsList.appendChild(categoryContainer);
            });
            
            // Show message if no matching facts after filtering
            if (this.dom.factsList.childElementCount === 0) {
                const noResultsMessage = document.createElement('div');
                noResultsMessage.className = 'no-results-message';
                
                if (hasActiveFilters) {
                    noResultsMessage.textContent = 'No facts match the selected filters';
                } else if (this.state.searchQuery) {
                    noResultsMessage.textContent = `No facts found matching "${this.state.searchQuery}"`;
                } else {
                    noResultsMessage.textContent = 'No facts stored in memory';
                }
                
                this.dom.factsList.appendChild(noResultsMessage);
            }
        },
        
        /**
         * Render conversations with compact styling
         */
        renderConversations: function() {
            if (!this.dom.conversationsList) return;
            
            // Clear current list
            this.dom.conversationsList.innerHTML = '';
            
            const conversations = this.state.filteredResults.conversations;
            const hasActiveFilters = this.state.activeFilters.length > 0;
            
            // Check if conversations exist
            if (!conversations || Object.keys(conversations).length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                
                if (this.state.searchQuery) {
                    emptyMessage.textContent = `No conversations found matching "${this.state.searchQuery}"`;
                } else {
                    emptyMessage.textContent = 'No conversations stored in memory';
                    
                    // Add helpful tip for first-time users
                    const infoTip = document.createElement('div');
                    infoTip.className = 'info-tip';
                    infoTip.innerHTML = `
                        <div class="info-tip-icon">💡</div>
                        <div class="info-tip-text">
                            Conversations are automatically saved when the memory action is running.<br>
                            You can manually save a conversation with:<br>
                            <code>memory save conversation summary</code>
                        </div>
                    `;
                    emptyMessage.appendChild(infoTip);
                }
                
                this.dom.conversationsList.appendChild(emptyMessage);
                return;
            }
            
            // Add each conversation
            let hasDisplayedConversations = false;
            
            Object.entries(conversations).forEach(([id, data]) => {
                // Skip if doesn't match active topic filters
                if (hasActiveFilters && 
                    (!data.topics || !data.topics.some(topic => this.state.activeFilters.includes(topic)))) {
                    return;
                }
                
                hasDisplayedConversations = true;
                
                const conversationItem = document.createElement('div');
                conversationItem.className = 'conversation-item';
                
                // Conversation header with ID
                const conversationHeader = document.createElement('div');
                conversationHeader.className = 'conversation-header';
                
                // Conversation ID with search highlighting
                const conversationId = document.createElement('div');
                conversationId.className = 'conversation-id';
                
                if (this.state.searchQuery && id.toLowerCase().includes(this.state.searchQuery)) {
                    const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                    conversationId.innerHTML = `ID: ${id.replace(regex, '<span class="search-highlight">$1</span>')}`;
                } else {
                    conversationId.textContent = `ID: ${id}`;
                }
                
                conversationHeader.appendChild(conversationId);
                conversationItem.appendChild(conversationHeader);
                
                // Conversation summary with search highlighting
                const conversationSummary = document.createElement('div');
                conversationSummary.className = 'conversation-summary';
                
                const summaryText = data.summary || 'No summary available';
                if (this.state.searchQuery && summaryText.toLowerCase().includes(this.state.searchQuery)) {
                    const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                    conversationSummary.innerHTML = `Summary: ${summaryText.replace(regex, '<span class="search-highlight">$1</span>')}`;
                } else {
                    conversationSummary.textContent = `Summary: ${summaryText}`;
                }
                
                conversationItem.appendChild(conversationSummary);
                
                // Conversation topics
                if (data.topics && data.topics.length > 0) {
                    const topicTags = document.createElement('div');
                    topicTags.className = 'topic-tags';
                    
                    data.topics.forEach(topic => {
                        const topicTag = document.createElement('span');
                        topicTag.className = 'topic-tag';
                        
                        // Highlight active filter topics and search matches
                        if (hasActiveFilters && this.state.activeFilters.includes(topic)) {
                            topicTag.style.backgroundColor = '#bbdefb';
                            topicTag.style.fontWeight = 'bold';
                        }
                        
                        if (this.state.searchQuery && topic.toLowerCase().includes(this.state.searchQuery)) {
                            const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                            topicTag.innerHTML = topic.replace(regex, '<span class="search-highlight">$1</span>');
                        } else {
                            topicTag.textContent = topic;
                        }
                        
                        topicTags.appendChild(topicTag);
                    });
                    
                    conversationItem.appendChild(topicTags);
                }
                
                // Conversation meta info (timestamp)
                const conversationMeta = document.createElement('div');
                conversationMeta.className = 'fact-meta';
                
                // Format timestamp nicely
                const date = new Date(data.timestamp);
                const formattedDate = date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const formattedTime = date.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                conversationMeta.textContent = `Date: ${formattedDate} at ${formattedTime}`;
                conversationItem.appendChild(conversationMeta);
                
                // Action buttons
                const conversationActions = document.createElement('div');
                conversationActions.className = 'fact-actions';
                
                // Delete button
                const deleteButton = document.createElement('button');
                deleteButton.className = 'fact-button delete-button';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteConversationFromMemory(id);
                });
                
                conversationActions.appendChild(deleteButton);
                conversationItem.appendChild(conversationActions);
                
                this.dom.conversationsList.appendChild(conversationItem);
            });
            
            if (!hasDisplayedConversations) {
                // No conversations match the filters
                const noResultsMessage = document.createElement('div');
                noResultsMessage.className = 'no-results-message';
                
                if (hasActiveFilters) {
                    noResultsMessage.textContent = 'No conversations match the selected filters';
                } else if (this.state.searchQuery) {
                    noResultsMessage.textContent = `No conversations found matching "${this.state.searchQuery}"`;
                } else {
                    noResultsMessage.textContent = 'No conversations stored in memory';
                }
                
                this.dom.conversationsList.appendChild(noResultsMessage);
            }
        },
        
        /**
         * Render preferences with compact styling
         */
        renderPreferences: function() {
            if (!this.dom.preferencesList) return;
            
            // Clear current list
            this.dom.preferencesList.innerHTML = '';
            
            const preferences = this.state.filteredResults.preferences;
            
            // Check if preferences exist
            if (!preferences || Object.keys(preferences).length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                
                if (this.state.searchQuery) {
                    emptyMessage.textContent = `No preferences found matching "${this.state.searchQuery}"`;
                } else {
                    emptyMessage.textContent = 'No preferences stored in memory';
                    
                    // Add helpful tip for first-time users
                    const infoTip = document.createElement('div');
                    infoTip.className = 'info-tip';
                    infoTip.innerHTML = `
                        <div class="info-tip-icon">💡</div>
                        <div class="info-tip-text">
                            You can set preferences with the command:<br>
                            <code>memory set preference key value</code><br>
                            Example: <code>memory set preference theme dark</code>
                        </div>
                    `;
                    emptyMessage.appendChild(infoTip);
                }
                
                this.dom.preferencesList.appendChild(emptyMessage);
                return;
            }
            
            // Add each preference
            Object.entries(preferences).forEach(([key, value]) => {
                const preferenceItem = document.createElement('div');
                preferenceItem.className = 'preference-item';
                
                // Key-value container
                const keyValueContainer = document.createElement('div');
                keyValueContainer.className = 'preference-key-value';
                
                // Preference key with search highlighting
                const preferenceKey = document.createElement('div');
                preferenceKey.className = 'preference-key';
                
                if (this.state.searchQuery && key.toLowerCase().includes(this.state.searchQuery)) {
                    const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                    preferenceKey.innerHTML = key.replace(regex, '<span class="search-highlight">$1</span>');
                } else {
                    preferenceKey.textContent = key;
                }
                
                // Preference value with search highlighting
                const preferenceValue = document.createElement('div');
                preferenceValue.className = 'preference-value';
                
                const valueText = value.toString();
                if (this.state.searchQuery && valueText.toLowerCase().includes(this.state.searchQuery)) {
                    const regex = new RegExp(`(${this.state.searchQuery})`, 'gi');
                    preferenceValue.innerHTML = valueText.replace(regex, '<span class="search-highlight">$1</span>');
                } else {
                    preferenceValue.textContent = valueText;
                }
                
                keyValueContainer.appendChild(preferenceKey);
                keyValueContainer.appendChild(preferenceValue);
                
                // Action buttons
                const preferenceActions = document.createElement('div');
                preferenceActions.className = 'preference-actions';
                
                // Delete button
                const deleteButton = document.createElement('button');
                deleteButton.className = 'fact-button delete-button';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deletePreferenceFromMemory(key);
                });
                
                preferenceActions.appendChild(deleteButton);
                
                // Add elements to preference item
                preferenceItem.appendChild(keyValueContainer);
                preferenceItem.appendChild(preferenceActions);
                
                this.dom.preferencesList.appendChild(preferenceItem);
            });
        },
        
        /**
         * Show loading indicator
         */
        showLoading: function() {
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'flex';
            }
        },
        
        /**
         * Hide loading indicator
         */
        hideLoading: function() {
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'none';
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
                this.state.error = message;
            }
        },
        
        /**
         * Hide error message
         */
        hideError: function() {
            if (this.dom.errorMessage) {
                this.dom.errorMessage.style.display = 'none';
                this.state.error = null;
            }
        },
        
        /**
         * Copy fact to input field
         * @param {string} category - Fact category
         * @param {string} key - Fact key
         */
        copyFactToInput: function(category, key) {
            const command = `memory get fact ${category}|${key}`;
            
            // Set input field value
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = command;
                userInput.focus();
                
                // Trigger input event to resize textarea
                const inputEvent = new Event('input');
                userInput.dispatchEvent(inputEvent);
            }
            
            Framework.showToast(`Copied "${command}" to input`);
        },
        
        /**
         * Delete fact from memory
         * @param {string} category - Fact category
         * @param {string} key - Fact key
         */
        deleteFactFromMemory: function(category, key) {
            // Confirm deletion
            if (!confirm(`Are you sure you want to delete the fact "${key}" from category "${category}"?`)) {
                return;
            }
            
            const command = `memory delete fact ${category}|${key}`;
            
            // Execute command
            fetch(CONFIG.api.submitInput, {
                method: 'POST',
                body: command
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Refresh memory data after successful deletion
                setTimeout(() => this.fetchMemoryData(), 1000);
                
                Framework.showToast(`Deleted fact "${key}" from category "${category}"`);
            })
            .catch(error => {
                console.error(`[${this.id}] Error deleting fact:`, error);
                Framework.showToast('Error deleting fact');
                this.showError(`Failed to delete fact: ${error.message}`);
            });
        },
        
        /**
         * Delete conversation from memory
         * @param {string} id - Conversation ID
         */
        deleteConversationFromMemory: function(id) {
            // Confirm deletion
            if (!confirm(`Are you sure you want to delete the conversation "${id}"?`)) {
                return;
            }
            
            const command = `memory delete conversation ${id}`;
            
            // Execute command
            fetch(CONFIG.api.submitInput, {
                method: 'POST',
                body: command
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Refresh memory data after successful deletion
                setTimeout(() => this.fetchMemoryData(), 1000);
                
                Framework.showToast(`Deleted conversation "${id}"`);
            })
            .catch(error => {
                console.error(`[${this.id}] Error deleting conversation:`, error);
                Framework.showToast('Error deleting conversation');
                this.showError(`Failed to delete conversation: ${error.message}`);
            });
        },
        
        /**
         * Delete preference from memory
         * @param {string} key - Preference key
         */
        deletePreferenceFromMemory: function(key) {
            // Confirm deletion
            if (!confirm(`Are you sure you want to delete the preference "${key}"?`)) {
                return;
            }
            
            const command = `memory delete preference ${key}`;
            
            // Execute command
            fetch(CONFIG.api.submitInput, {
                method: 'POST',
                body: command
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Refresh memory data after successful deletion
                setTimeout(() => this.fetchMemoryData(), 1000);
                
                Framework.showToast(`Deleted preference "${key}"`);
            })
            .catch(error => {
                console.error(`[${this.id}] Error deleting preference:`, error);
                Framework.showToast('Error deleting preference');
                this.showError(`Failed to delete preference: ${error.message}`);
            });
        },
        
        /**
         * Clear all memories
         */
        clearAllMemories: function() {
            // Confirm deletion
            if (!confirm('Are you sure you want to clear ALL memories? This action cannot be undone.')) {
                return;
            }
            
            const command = 'memory clear all';
            
            // Execute command
            fetch(CONFIG.api.submitInput, {
                method: 'POST',
                body: command
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Refresh memory data after successful clearing
                setTimeout(() => this.fetchMemoryData(), 1000);
                
                Framework.showToast('All memories cleared');
            })
            .catch(error => {
                console.error(`[${this.id}] Error clearing memories:`, error);
                Framework.showToast('Error clearing memories');
                this.showError(`Failed to clear memories: ${error.message}`);
            });
        },
        
        /**
         * Toggle auto-refresh functionality
         * @param {boolean} enabled - Whether auto-refresh should be enabled
         */
        toggleAutoRefresh: function(enabled) {
            this.state.autoRefresh = enabled;
            
            if (enabled) {
                this.startAutoRefresh();
                Framework.showToast(`Auto-refresh enabled (every ${this.state.refreshRate / 1000}s)`);
            } else {
                this.stopAutoRefresh();
                Framework.showToast('Auto-refresh disabled');
            }
        },
        
        /**
         * Start auto-refresh interval
         */
        startAutoRefresh: function() {
            // Clear existing interval if any
            this.stopAutoRefresh();
            
            // Only start if memory is active
            if (this.state.memoryActive) {
                this.state.refreshInterval = setInterval(() => {
                    this.fetchMemoryData();
                }, this.state.refreshRate);
                
                console.log(`[${this.id}] Auto-refresh started (${this.state.refreshRate / 1000}s interval)`);
            }
        },
        
        /**
         * Stop auto-refresh interval
         */
        stopAutoRefresh: function() {
            if (this.state.refreshInterval) {
                clearInterval(this.state.refreshInterval);
                this.state.refreshInterval = null;
                console.log(`[${this.id}] Auto-refresh stopped`);
            }
        },
        
        /**
         * Lifecycle hook called when panel is opened
         */
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened`);
            
            // Fetch memory data when panel is opened if memory action is active
            if (this.state.memoryActive) {
                this.fetchMemoryData();
            }
        },
        
        /**
         * Clean up component resources
         */
        cleanup: function() {
            console.log(`[${this.id}] Cleaning up resources...`);
            
            // Stop auto-refresh if running
            this.stopAutoRefresh();
            
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];
            
            // Remove style element
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            
            console.log(`[${this.id}] Cleanup complete`);
        }
    };
    
    // Register component
    Framework.registerComponent(component.id, component);
})();