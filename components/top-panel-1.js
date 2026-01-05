/**
 * ==============================================================================================
 * Top Panel 1 - Commands Display Component (Enhanced Structure)
 * ==============================================================================================
 * 
 * This panel displays available system commands organized by category.
 * Data is fetched from the commands.json endpoint and displayed in a collapsible format.
 * 
 * @version 3.0.0 - Enhanced structure, improved styling, better error handling
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-1',
        
        // DOM references
        dom: {
            content: null,
            commandsContainer: null,
            updateInfo: null,
            loadingIndicator: null,
            errorMessage: null,
            refreshButton: null,
            emptyMessage: null
        },
        
        // Component state
        state: {
            commands: null,
            isLoading: false,
            lastUpdate: null,
            expandedCategories: new Set(),
            errorState: null,
            commandCount: 0,
            categoryCount: 0,
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
            this.fetchCommands();
            
            // Set up refresh interval
            const refreshInterval = CONFIG.refreshIntervals.commands || 60000;
            setInterval(() => this.fetchCommands(), refreshInterval);
            
            console.log(`[${this.id}] Initialization complete. Refresh interval set to ${refreshInterval}ms`);
        },
        
        /**
         * Create the basic panel structure
         */
        createStructure: function() {
            const container = document.createElement('div');
            container.className = 'commands-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            container.style.overflow = 'hidden';
            
            // Add header with last update time and refresh button
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'System Commands';
            headerTitle.style.fontWeight = 'bold';
            
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';
            
            const refreshButton = document.createElement('button');
            refreshButton.className = 'refresh-button';
            refreshButton.innerHTML = '🔄';
            refreshButton.setAttribute('aria-label', 'Refresh commands');
            refreshButton.setAttribute('title', 'Refresh commands');
            refreshButton.style.background = 'none';
            refreshButton.style.border = 'none';
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.fontSize = '1em';
            refreshButton.style.color = 'var(--color-primary)';
            refreshButton.style.padding = 'var(--space-xs)';
            refreshButton.addEventListener('click', () => this.fetchCommands(true));
            this.dom.refreshButton = refreshButton;
            
            const updateInfo = document.createElement('span');
            updateInfo.className = 'update-info';
            updateInfo.textContent = 'Never updated';
            updateInfo.style.fontSize = '0.8em';
            updateInfo.style.color = 'var(--color-text-light)';
            this.dom.updateInfo = updateInfo;
            
            headerControls.appendChild(refreshButton);
            headerControls.appendChild(updateInfo);
            
            header.appendChild(headerTitle);
            header.appendChild(headerControls);
            container.appendChild(header);
            
            // Create search bar
            const searchContainer = document.createElement('div');
            searchContainer.className = 'search-container';
            searchContainer.style.padding = '10px';
            searchContainer.style.display = 'flex';
            searchContainer.style.borderBottom = '1px solid #e0e0e0';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search commands...';
            searchInput.style.flex = '1';
            searchInput.style.padding = '8px';
            searchInput.style.border = '1px solid var(--color-border)';
            searchInput.style.borderRadius = 'var(--border-radius-sm)';
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            
            searchContainer.appendChild(searchInput);
            container.appendChild(searchContainer);
            
            // Create commands container
            const commandsContainer = document.createElement('div');
            commandsContainer.className = 'commands-container';
            commandsContainer.setAttribute('role', 'list');
            commandsContainer.setAttribute('aria-label', 'Available commands');
            commandsContainer.style.flex = '1';
            commandsContainer.style.overflowY = 'auto';
            commandsContainer.style.padding = '10px';
            container.appendChild(commandsContainer);
            this.dom.commandsContainer = commandsContainer;
            
            // Create empty message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No commands available';
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
                    <div>Loading commands...</div>
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
                .command-category {
                    margin-bottom: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: var(--border-radius-md);
                    overflow: hidden;
                    background-color: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                
                .category-header {
                    display: flex;
                    align-items: center;
                    padding: 10px 15px;
                    background-color: #f5f5f5;
                    cursor: pointer;
                    user-select: none;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background-color 0.2s;
                }
                
                .category-header:hover {
                    background-color: #e9e9e9;
                }
                
                .category-icon {
                    margin-right: 8px;
                    transition: transform 0.2s;
                }
                
                .category-header.expanded .category-icon {
                    transform: rotate(90deg);
                }
                
                .category-header h4 {
                    margin: 0;
                    flex: 1;
                    font-size: 14px;
                    font-weight: bold;
                    color: var(--color-text);
                }
                
                .command-count {
                    font-size: 12px;
                    background-color: var(--color-primary-light);
                    color: var(--color-primary-dark);
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: normal;
                }
                
                .command-list {
                    padding: 0;
                    overflow: hidden;
                    max-height: 0;
                    transition: max-height 0.3s ease, padding 0.3s ease;
                }
                
                .command-list.expanded {
                    padding: 10px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .command-item {
                    padding: 8px 10px;
                    margin-bottom: 5px;
                    border-radius: var(--border-radius-sm);
                    cursor: pointer;
                    transition: background-color 0.2s;
                    font-size: 13px;
                    border-left: 3px solid transparent;
                }
                
                .command-item:hover {
                    background-color: var(--color-primary-light);
                    border-left-color: var(--color-primary);
                }
                
                .search-highlight {
                    background-color: #fff9c4;
                    font-weight: bold;
                }
                
                .search-no-results {
                    padding: 20px;
                    text-align: center;
                    color: var(--color-text-light);
                    font-style: italic;
                }
                
                .command-stats {
                    padding: 10px;
                    font-size: 12px;
                    color: var(--color-text-light);
                    text-align: center;
                    border-top: 1px solid #e0e0e0;
                }
            `;
            
            document.head.appendChild(style);
        },
        
        /**
         * Handle search input
         * @param {string} query - The search query
         */
        handleSearch: function(query) {
            query = query.trim().toLowerCase();
            
            // Get all categories and command items
            const categories = this.dom.commandsContainer.querySelectorAll('.command-category');
            let matchFound = false;
            
            categories.forEach(category => {
                const categoryHeader = category.querySelector('.category-header h4');
                const categoryName = categoryHeader.textContent.toLowerCase();
                const commandList = category.querySelector('.command-list');
                const commandItems = category.querySelectorAll('.command-item');
                
                // Check if category name matches
                const categoryMatches = categoryName.includes(query);
                
                // Count matching commands in this category
                let matchingCommands = 0;
                
                commandItems.forEach(item => {
                    const commandText = item.textContent.toLowerCase();
                    const commandMatches = commandText.includes(query);
                    
                    if (commandMatches || categoryMatches || query === '') {
                        item.style.display = '';
                        matchFound = true;
                        matchingCommands++;
                        
                        // Highlight matching text if there's a query
                        if (query && commandMatches) {
                            const originalText = item.textContent;
                            const highlightedText = originalText.replace(
                                new RegExp(query, 'gi'),
                                match => `<span class="search-highlight">${match}</span>`
                            );
                            item.innerHTML = highlightedText;
                        } else {
                            // Remove highlighting if no query or category match
                            item.textContent = item.textContent;
                        }
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Show/hide category based on matching commands
                if (matchingCommands > 0 || categoryMatches) {
                    category.style.display = '';
                    
                    // Update command count
                    const countElement = category.querySelector('.command-count');
                    if (countElement) {
                        countElement.textContent = `${matchingCommands} command${matchingCommands !== 1 ? 's' : ''}`;
                    }
                    
                    // Expand category if searching
                    if (query) {
                        this.expandCategory(category, true);
                    }
                } else {
                    category.style.display = 'none';
                }
            });
            
            // Show no results message if no matches
            if (!matchFound && query) {
                const noResultsElement = this.dom.commandsContainer.querySelector('.search-no-results');
                if (!noResultsElement) {
                    const noResults = document.createElement('div');
                    noResults.className = 'search-no-results';
                    noResults.textContent = `No commands matching "${query}"`;
                    this.dom.commandsContainer.appendChild(noResults);
                }
            } else {
                // Remove no results message if matches found
                const noResultsElement = this.dom.commandsContainer.querySelector('.search-no-results');
                if (noResultsElement) {
                    noResultsElement.remove();
                }
            }
        },
        
        /**
         * Expand or collapse a category
         * @param {HTMLElement} categoryElement - The category element to toggle
         * @param {boolean} expand - Whether to expand (true) or collapse (false)
         */
        expandCategory: function(categoryElement, expand) {
            const header = categoryElement.querySelector('.category-header');
            const icon = categoryElement.querySelector('.category-icon');
            const list = categoryElement.querySelector('.command-list');
            const categoryId = categoryElement.dataset.category;
            
            if (expand) {
                header.classList.add('expanded');
                list.classList.add('expanded');
                if (icon) icon.textContent = '▼';
                this.state.expandedCategories.add(categoryId);
            } else {
                header.classList.remove('expanded');
                list.classList.remove('expanded');
                if (icon) icon.textContent = '▶';
                this.state.expandedCategories.delete(categoryId);
            }
        },
        
        /**
         * Toggle category expanded state
         * @param {string} categoryId - Category identifier
         * @param {HTMLElement} categoryElement - Category DOM element
         */
        toggleCategory: function(categoryId, categoryElement) {
            const isExpanded = this.state.expandedCategories.has(categoryId);
            this.expandCategory(categoryElement, !isExpanded);
        },
        
        /**
         * Fetches and displays commands from commands.json
         * @param {boolean} forceRefresh - Whether to force refresh even if data hasn't changed
         */
        fetchCommands: async function(forceRefresh = false) {
            // Show loading only on initial load or force refresh
            if (!this.state.commands || forceRefresh) {
                this.showLoading();
            }
            
            try {
                // Clear any existing error state
                this.state.errorState = null;
                this.hideError();
                
                const response = await fetch(CONFIG.api.commands);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const commands = await response.json();
                
                // Update only if data changed or force refresh
                const commandsJSON = JSON.stringify(commands);
                if (forceRefresh || !this.state.commands || commandsJSON !== JSON.stringify(this.state.commands)) {
                    console.log(`[${this.id}] Commands data updated or force refreshed`);
                    
                    // Update state
                    this.state.commands = commands;
                    this.state.lastUpdate = new Date();
                    
                    // Update display
                    this.renderCommands();
                    this.updateLastUpdateTime();
                    
                    // If this was a forced refresh, show a toast
                    if (forceRefresh) {
                        Framework.showToast('Commands refreshed');
                    }
                } else {
                    // Data unchanged, just update the timestamp
                    this.updateLastUpdateTime();
                }
                
                // Hide loading
                this.hideLoading();
                
            } catch (error) {
                console.error(`[${this.id}] Error fetching commands:`, error);
                this.state.errorState = error.message;
                this.showError(`Failed to load commands: ${error.message}`);
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
                
                // Hide command container while loading
                if (this.dom.commandsContainer) {
                    this.dom.commandsContainer.style.display = 'none';
                }
                
                // Hide empty message if showing
                if (this.dom.emptyMessage) {
                    this.dom.emptyMessage.style.display = 'none';
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
                
                // Show command container after loading
                if (this.dom.commandsContainer) {
                    this.dom.commandsContainer.style.display = 'block';
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
            
            if (this.dom.commandsContainer) {
                this.dom.commandsContainer.style.display = 'none';
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
         * Render commands in the panel
         */
        renderCommands: function() {
            if (!this.dom.commandsContainer) return;
            
            const commands = this.state.commands;
            this.dom.commandsContainer.innerHTML = '';
            
            if (!commands || Object.keys(commands).length === 0) {
                if (this.dom.emptyMessage) {
                    this.dom.emptyMessage.style.display = 'block';
                }
                if (this.dom.commandsContainer) {
                    this.dom.commandsContainer.style.display = 'none';
                }
                return;
            }
            
            if (this.dom.emptyMessage) {
                this.dom.emptyMessage.style.display = 'none';
            }
            if (this.dom.commandsContainer) {
                this.dom.commandsContainer.style.display = 'block';
            }
            
            // Sort categories alphabetically
            let totalCommands = 0;
            let categoryCount = 0;
            
            Object.keys(commands).sort().forEach(category => {
                const categoryElement = this.createCategoryElement(category, commands[category]);
                this.dom.commandsContainer.appendChild(categoryElement);
                
                // Count commands
                const commandCount = Object.keys(commands[category]).length;
                totalCommands += commandCount;
                categoryCount++;
            });
            
            // Update state with counts
            this.state.commandCount = totalCommands;
            this.state.categoryCount = categoryCount;
            
            // Add stats to bottom
            const statsElement = document.createElement('div');
            statsElement.className = 'command-stats';
            statsElement.textContent = `${totalCommands} commands in ${categoryCount} categories`;
            this.dom.commandsContainer.appendChild(statsElement);
        },
        
        /**
         * Create a category element with commands
         * @param {string} category - Category name
         * @param {object} commandItems - Commands in this category
         * @returns {HTMLElement} - Category element
         */
        createCategoryElement: function(category, commandItems) {
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'command-category';
            categoryContainer.setAttribute('role', 'listitem');
            categoryContainer.dataset.category = category;
            
            // Create header with toggle
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.setAttribute('role', 'button');
            categoryHeader.setAttribute('aria-expanded', this.state.expandedCategories.has(category) ? 'true' : 'false');
            categoryHeader.setAttribute('tabindex', '0');
            
            const categoryIcon = document.createElement('span');
            categoryIcon.className = 'category-icon';
            categoryIcon.textContent = this.state.expandedCategories.has(category) ? '▼' : '▶';
            categoryHeader.appendChild(categoryIcon);
            
            const categoryTitle = document.createElement('h4');
            categoryTitle.textContent = category;
            categoryHeader.appendChild(categoryTitle);
            
            const commandCount = document.createElement('span');
            commandCount.className = 'command-count';
            const commandsInCategory = Object.keys(commandItems).length;
            commandCount.textContent = `${commandsInCategory} command${commandsInCategory !== 1 ? 's' : ''}`;
            categoryHeader.appendChild(commandCount);
            
            // Toggle expansion on click
            categoryHeader.addEventListener('click', () => {
                this.toggleCategory(category, categoryContainer);
            });
            
            // Support keyboard navigation
            categoryHeader.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleCategory(category, categoryContainer);
                }
            });
            
            categoryContainer.appendChild(categoryHeader);
            
            // Create commands list
            const commandsList = document.createElement('div');
            commandsList.className = `command-list ${this.state.expandedCategories.has(category) ? 'expanded' : ''}`;
            
            // Sort commands within category
            Object.keys(commandItems).sort().forEach(command => {
                const commandItem = document.createElement('div');
                commandItem.className = 'command-item';
                commandItem.textContent = command;
                commandItem.setAttribute('role', 'listitem');
                commandItem.title = `Execute: ${command}`;
                
                // Add click handler to execute command
                commandItem.addEventListener('click', () => {
                    const userInput = document.getElementById('userInput');
                    if (userInput) {
                        userInput.value = command;
                        userInput.focus();
                    }
                    Framework.showToast(`Command "${command}" selected`);
                });
                
                commandsList.appendChild(commandItem);
            });
            
            categoryContainer.appendChild(commandsList);
            
            return categoryContainer;
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