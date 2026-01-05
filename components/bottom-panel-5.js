/**
 * ==============================================================================================
 * Bottom Panel 5 - Project File Explorer
 * ==============================================================================================
 *
 * This panel displays comprehensive information about all project files, including sizes
 * and last modified dates. Features include filtering by file type, sorting by various
 * attributes, and powerful search capabilities.
 *
 * @version 3.1.2 - Default sort order set to 'Newest first'.
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-5',

        // DOM references
        dom: {
            content: null,
            versionContainer: null,
            fileListContainer: null,
            searchInput: null,
            filterButtons: null,
            statsContainer: null,
            loadingIndicator: null,
            errorMessage: null,
            sortButton: null,
            groupButton: null,
            refreshButton: null,
            lastUpdateTime: null,
            categoryCounters: null
        },

        // Component state
        state: {
            files: [],
            filteredFiles: [],
            isLoading: false,
            error: null,
            lastUpdate: null,
            searchQuery: '',
            currentFilter: 'all',
            sortOrder: 'date-desc', // name-asc, name-desc, size-asc, size-desc, date-asc, date-desc -- CHANGED
            groupByCategory: false,
            totalSize: 0,
            fileCount: 0,
            categories: {
                'js': { label: 'JS', count: 0, size: 0, color: '#f0db4f' },
                'py': { label: 'PY', count: 0, size: 0, color: '#3572A5' },
                'html': { label: 'HTML', count: 0, size: 0, color: '#e34c26' },
                'css': { label: 'CSS', count: 0, size: 0, color: '#563d7c' },
                'json': { label: 'JSON', count: 0, size: 0, color: '#000000' },
                'txt': { label: 'Text', count: 0, size: 0, color: '#7a7a7a' },
                'log': { label: 'Log', count: 0, size: 0, color: '#4CAF50' }, // Added new category for .log files
                'other': { label: 'Other', count: 0, size: 0, color: '#cccccc' }
            }
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

            // Load version data
            this.loadVersionData();

            console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Load version data (simulated from the provided list)
         */
        loadVersionData: function() {
            this.showLoading();

            // Simulate API call delay
            setTimeout(() => {
                try {
                    // Process the version data from the provided file list
                    this.processVersionData(this.getVersionData());
                    this.hideLoading();
                    // Update last update time
                    this.state.lastUpdate = new Date();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error(`[${this.id}] Error loading version data:`, error);
                    this.state.error = "Failed to load version data: " + error.message;
                    this.showError(this.state.error);
                    this.hideLoading();
                }
            }, 300);
        },

        /**
         * Process the file data and update state
         */
        processVersionData: function(data) {
            this.state.files = data;
            this.state.fileCount = data.length;
            this.state.totalSize = 0;

            // Reset category counts and sizes
            Object.keys(this.state.categories).forEach(key => {
                this.state.categories[key].count = 0;
                this.state.categories[key].size = 0;
            });

            // Count files by category and calculate sizes
            this.state.files.forEach(file => {
                // Track total size
                this.state.totalSize += file.size || 0;

                const extension = this.getFileExtension(file.name);
                if (this.state.categories[extension]) {
                    this.state.categories[extension].count++;
                    this.state.categories[extension].size += file.size || 0;
                } else {
                    this.state.categories['other'].count++;
                    this.state.categories['other'].size += file.size || 0;
                }

                // Add category to file object for easier filtering
                file.category = this.state.categories[extension] ? extension : 'other';
            });

            // Update UI
            this.updateCategoryCounters();
            this.applyFiltersAndSort();
            this.renderFileVersions();
            this.updateFileStats();
        },

        /**
         * Get file extension
         */
        getFileExtension: function(filename) {
            const parts = filename.split('.');
            if (parts.length === 1 || (parts[0] === '' && parts.length === 2)) {
                return 'other';
            }
            const extension = parts.pop().toLowerCase();
            // Map to known categories or return 'other'
            return this.state.categories[extension] ? extension : 'other';
        },

        /**
         * Apply filters, search, and sorting
         */
        applyFiltersAndSort: function() {
            // First apply category filter
            let filtered = [...this.state.files];

            if (this.state.currentFilter !== 'all') {
                filtered = filtered.filter(file => file.category === this.state.currentFilter);
            }

            // Then apply search filter if any
            if (this.state.searchQuery) {
                const query = this.state.searchQuery.toLowerCase();
                filtered = filtered.filter(file =>
                    file.name.toLowerCase().includes(query) ||
                    (file.version && file.version.toLowerCase().includes(query))
                );
            }

            // Sort the filtered results
            filtered = this.sortFiles(filtered);

            this.state.filteredFiles = filtered;
        },

        /**
         * Sort files based on current sort order
         */
        sortFiles: function(files) {
            const [field, direction] = this.state.sortOrder.split('-');

            return files.sort((a, b) => {
                if (field === 'name') {
                    // Sort by name
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    if (direction === 'asc') {
                        return nameA.localeCompare(nameB);
                    } else {
                        return nameB.localeCompare(nameA);
                    }
                } else if (field === 'size') {
                    // Sort by file size
                    const sizeA = a.size || 0;
                    const sizeB = b.size || 0;
                    if (direction === 'asc') {
                        return sizeA - sizeB;
                    } else {
                        return sizeB - sizeA;
                    }
                } else if (field === 'date') {
                    // Sort by last modified date
                    const dateA = a.lastModified ? new Date(a.lastModified) : new Date(0);
                    const dateB = b.lastModified ? new Date(b.lastModified) : new Date(0);
                    if (direction === 'asc') {
                        return dateA - dateB;
                    } else {
                        return dateB - dateA;
                    }
                }
                return 0;
            });
        },

        /**
         * Create component structure with improved scrolling and flexible layout
         */
        createStructure: function() {
            const container = document.createElement('div');
            container.className = 'version-tracker-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            container.style.overflow = 'auto'; // EXPLICITLY MAKING PARENT SCROLLABLE

            // Header section with title and controls
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            header.style.flexShrink = '0'; // Prevent header from shrinking

            // Left side with title
            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '10px';

            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Project File Explorer';
            headerTitle.style.fontWeight = 'bold';
            headerLeft.appendChild(headerTitle);

            header.appendChild(headerLeft);

            // Right side with controls
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';

            // Sort dropdown menu - FIX: Improved dropdown positioning and visibility
            const sortButton = document.createElement('div');
            sortButton.className = 'control-button sort-button';
            sortButton.style.display = 'flex';
            sortButton.style.alignItems = 'center';
            sortButton.style.position = 'relative';
            sortButton.style.cursor = 'pointer';

            const sortLabel = document.createElement('div');
            // CHANGED: Default sort button label to "Date" with descending arrow
            sortLabel.innerHTML = '<span>↑↓</span> Date';
            sortLabel.style.padding = '4px 8px';
            sortLabel.style.display = 'flex';
            sortLabel.style.alignItems = 'center';
            sortLabel.style.gap = '4px';
            sortLabel.style.fontSize = '12px';
            sortLabel.style.fontWeight = 'bold';
            sortLabel.style.backgroundColor = '#4a76a8'; // CHANGED: Improved contrast with dark background
            sortLabel.style.color = 'white'; // CHANGED: White text for better readability
            sortLabel.style.borderRadius = '3px';
            sortLabel.style.border = '1px solid #4a76a8'; // CHANGED: Border color to match background
            sortLabel.style.minWidth = '80px'; // FIX: Ensure minimum width for label text

            // Create dropdown menu - FIX: Improved z-index and positioning
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'sort-dropdown-content';
            dropdownContent.style.display = 'none';
            dropdownContent.style.position = 'absolute';
            dropdownContent.style.top = '100%';
            dropdownContent.style.right = '0'; // FIX: Align to right to avoid overflow
            dropdownContent.style.backgroundColor = '#ffffff';
            dropdownContent.style.minWidth = '180px'; // FIX: Wider dropdown
            dropdownContent.style.boxShadow = '0px 8px 16px 0px rgba(0,0,0,0.2)';
            dropdownContent.style.zIndex = '100'; // FIX: Higher z-index to ensure visibility
            dropdownContent.style.borderRadius = '3px';
            dropdownContent.style.border = '1px solid #e0e0e0';

            // Add sort options
            const sortOptions = [
                { id: 'name-asc', label: 'Name (A-Z)' },
                { id: 'name-desc', label: 'Name (Z-A)' },
                { id: 'size-asc', label: 'Size (Small to Large)' },
                { id: 'size-desc', label: 'Size (Large to Small)' },
                { id: 'date-asc', label: 'Date (Oldest first)' },
                { id: 'date-desc', label: 'Date (Newest first)' }
            ];

            sortOptions.forEach(option => {
                const optionEl = document.createElement('div');
                optionEl.className = 'sort-option';
                optionEl.textContent = option.label;
                optionEl.style.padding = '8px 12px';
                optionEl.style.cursor = 'pointer';
                optionEl.style.fontSize = '12px';
                optionEl.style.borderBottom = '1px solid #f0f0f0';

                optionEl.addEventListener('mouseover', () => {
                    optionEl.style.backgroundColor = '#f5f5f5';
                });

                optionEl.addEventListener('mouseout', () => {
                    optionEl.style.backgroundColor = '';
                });

                optionEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.state.sortOrder = option.id;

                    // Update sort button label
                    const [field, direction] = option.id.split('-');
                    const directionArrow = direction === 'asc' ? '↓↑' : '↑↓';
                    sortLabel.innerHTML = `<span>${directionArrow}</span> ${field.charAt(0).toUpperCase() + field.slice(1)}`;

                    // Hide dropdown
                    dropdownContent.style.display = 'none';

                    // Apply sort and update display
                    this.applyFiltersAndSort();
                    this.renderFileVersions();

                    // Show toast notification
                    Framework.showToast(`Sorted by ${option.label}`, 2000);
                });

                dropdownContent.appendChild(optionEl);
            });

            // Show dropdown on click
            sortLabel.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownContent.style.display = dropdownContent.style.display === 'none' ? 'block' : 'none';
            });

            // Hide dropdown when clicking elsewhere
            document.addEventListener('click', () => {
                dropdownContent.style.display = 'none';
            });

            sortButton.appendChild(sortLabel);
            sortButton.appendChild(dropdownContent);
            this.dom.sortButton = sortButton;

            // Group toggle - FIX: Improved button size and text visibility
            const groupButton = document.createElement('button');
            groupButton.className = 'control-button group-button';
            groupButton.innerHTML = '<span>⊞</span> Group';
            groupButton.title = 'Toggle grouping by category';
            groupButton.style.padding = '4px 8px';
            groupButton.style.display = 'flex';
            groupButton.style.alignItems = 'center';
            groupButton.style.gap = '4px';
            groupButton.style.fontSize = '12px';
            groupButton.style.fontWeight = 'bold';
            groupButton.style.backgroundColor = '#4a76a8'; // CHANGED: Improved contrast with dark background
            groupButton.style.color = 'white'; // CHANGED: White text for better readability
            groupButton.style.borderRadius = '3px';
            groupButton.style.border = '1px solid #4a76a8'; // CHANGED: Border color to match background
            groupButton.style.cursor = 'pointer';
            groupButton.style.minWidth = '80px'; // FIX: Ensure button has minimum width
            groupButton.addEventListener('click', () => this.toggleGrouping());
            this.dom.groupButton = groupButton;

            // Refresh button
            const refreshButton = document.createElement('button');
            refreshButton.className = 'control-button refresh-button';
            refreshButton.innerHTML = '🔄';
            refreshButton.title = 'Refresh data';
            refreshButton.style.padding = '4px 8px';
            refreshButton.style.backgroundColor = '#4a76a8';
            refreshButton.style.color = 'white';
            refreshButton.style.borderRadius = '3px';
            refreshButton.style.border = 'none';
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.minWidth = '30px'; // FIX: Set minimum width
            refreshButton.addEventListener('click', () => this.loadVersionData());
            this.dom.refreshButton = refreshButton;

            headerControls.appendChild(sortButton);
            headerControls.appendChild(groupButton);
            headerControls.appendChild(refreshButton);

            // Update time
            const lastUpdateTime = document.createElement('div');
            lastUpdateTime.className = 'last-update-time';
            lastUpdateTime.textContent = 'Never updated';
            lastUpdateTime.style.fontSize = '11px';
            lastUpdateTime.style.color = 'var(--color-text-light)';
            lastUpdateTime.style.marginLeft = '10px';
            headerControls.appendChild(lastUpdateTime);
            this.dom.lastUpdateTime = lastUpdateTime;

            header.appendChild(headerControls);
            container.appendChild(header);

            // Search and filter container
            const searchFilterContainer = document.createElement('div');
            searchFilterContainer.className = 'search-filter-container';
            searchFilterContainer.style.padding = '8px'; // REDUCED padding to save space
            searchFilterContainer.style.borderBottom = '1px solid #e0e0e0';
            searchFilterContainer.style.backgroundColor = '#f9f9f9';
            searchFilterContainer.style.flexShrink = '0'; // Prevent search area from shrinking

            // Search box
            const searchContainer = document.createElement('div');
            searchContainer.className = 'search-container';
            searchContainer.style.marginBottom = '10px';
            searchContainer.style.position = 'relative';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search by file name or version...';
            searchInput.style.width = '100%';
            searchInput.style.padding = '6px 10px';
            searchInput.style.paddingRight = '30px'; // Space for clear button
            searchInput.style.borderRadius = '4px';
            searchInput.style.border = '1px solid #e0e0e0';
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            this.dom.searchInput = searchInput;

            // Clear search button
            const clearButton = document.createElement('button');
            clearButton.className = 'clear-search';
            clearButton.innerHTML = '✕';
            clearButton.style.position = 'absolute';
            clearButton.style.right = '10px';
            clearButton.style.top = '50%';
            clearButton.style.transform = 'translateY(-50%)';
            clearButton.style.background = 'none';
            clearButton.style.border = 'none';
            clearButton.style.fontSize = '14px';
            clearButton.style.color = '#888';
            clearButton.style.cursor = 'pointer';
            clearButton.style.display = 'none'; // Initially hidden
            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                this.handleSearch('');
                clearButton.style.display = 'none';
            });

            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearButton);
            searchFilterContainer.appendChild(searchContainer);

            // File category filters - FIX: Improved horizontal scrolling for small panels
            const filterButtons = document.createElement('div');
            filterButtons.className = 'filter-buttons';
            filterButtons.style.display = 'flex';
            filterButtons.style.flexWrap = 'nowrap'; // FIX: Changed to nowrap for horizontal scrolling
            filterButtons.style.gap = '6px';
            filterButtons.style.marginBottom = '5px';
            filterButtons.style.overflowX = 'auto'; // FIX: Enable horizontal scrolling
            filterButtons.style.paddingBottom = '5px'; // FIX: Added padding for scroll space
            this.dom.filterButtons = filterButtons;

            // Add "All" filter
            const allFilter = this.createFilterButton('all', 'All', '#4a76a8', true); // CHANGED: Color to match other buttons
            filterButtons.appendChild(allFilter);

            // Add category filters
            Object.entries(this.state.categories).forEach(([key, category]) => {
                const filterBtn = this.createFilterButton(key, category.label, '#4a76a8'); // CHANGED: Color to match other buttons
                filterButtons.appendChild(filterBtn);
            });

            searchFilterContainer.appendChild(filterButtons);

            // Category counters
            const categoryCounters = document.createElement('div');
            categoryCounters.className = 'category-counters';
            categoryCounters.style.display = 'flex';
            categoryCounters.style.flexWrap = 'wrap';
            categoryCounters.style.gap = '8px';
            categoryCounters.style.fontSize = '11px';
            this.dom.categoryCounters = categoryCounters;
            searchFilterContainer.appendChild(categoryCounters);

            container.appendChild(searchFilterContainer);

            // Stats container
            const statsContainer = document.createElement('div');
            statsContainer.className = 'version-stats-container';
            statsContainer.style.padding = '8px'; // REDUCED padding to save space
            statsContainer.style.backgroundColor = '#f0f8ff';
            statsContainer.style.borderBottom = '1px solid #e0e0e0';
            statsContainer.style.fontSize = '12px';
            statsContainer.style.display = 'flex';
            statsContainer.style.flexWrap = 'wrap';
            statsContainer.style.gap = '10px';
            statsContainer.style.flexShrink = '0'; // Prevent stats from shrinking
            this.dom.statsContainer = statsContainer;
            container.appendChild(statsContainer);

            // Main file list container - FIX: This is the main scrollable area
            const fileListContainer = document.createElement('div');
            fileListContainer.className = 'file-version-container';
            fileListContainer.style.flex = '1'; // FIX: Take remaining space
            fileListContainer.style.overflowY = 'auto'; // FIX: Enable vertical scrolling
            fileListContainer.style.padding = '10px';
            fileListContainer.style.backgroundColor = 'white';
            fileListContainer.style.minHeight = '150px'; // INCREASED: Ensure larger minimum height
            fileListContainer.style.border = '1px solid #ccc'; // ADDED: Visual border for clarity
            fileListContainer.style.borderRadius = '4px'; // ADDED: Rounded corners
            fileListContainer.style.margin = '0 10px 10px 10px'; // ADDED: Margins for visual separation
            this.dom.fileListContainer = fileListContainer;
            container.appendChild(fileListContainer);

            // Loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                    <div style="margin-bottom: 10px; border: 3px solid #f3f3f3; border-top: 3px solid var(--color-primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
                    <div>Loading version data...</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            loadingIndicator.style.display = 'none';
            loadingIndicator.style.position = 'absolute';
            loadingIndicator.style.top = '0';
            loadingIndicator.style.left = '0';
            loadingIndicator.style.right = '0';
            loadingIndicator.style.bottom = '0';
            loadingIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            loadingIndicator.style.zIndex = '10';
            container.appendChild(loadingIndicator);
            this.dom.loadingIndicator = loadingIndicator;

            // Error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.style.display = 'none';
            errorMessage.style.padding = '15px';
            errorMessage.style.margin = '10px';
            errorMessage.style.backgroundColor = '#ffebee';
            errorMessage.style.border = '1px solid #ffcdd2';
            errorMessage.style.borderRadius = '4px';
            errorMessage.style.color = '#c62828';
            container.appendChild(errorMessage);
            this.dom.errorMessage = errorMessage;

            // Add to panel
            this.dom.content.appendChild(container);

            // Update category counters
            this.updateCategoryCounters();

            // Add specific styles to ensure consistent button sizing and text visibility
            this.addCustomStyles();
        },

        /**
         * Add custom styles to fix button and layout issues
         */
        addCustomStyles: function() {
            // Create a style element
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                /* CRITICAL: Make panel-content explicitly scrollable */
                .panel-content {
                    overflow: auto !important;
                    height: 100% !important;
                }

                /* Fix button text visibility and size consistency */
                #${this.id}-content .control-button {
                    min-width: 30px;
                    min-height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                    overflow: visible;
                    background-color: #4a76a8 !important;
                    color: white !important;
                }

                /* Ensure dropdown options are visible and properly sized */
                #${this.id}-content .sort-dropdown-content {
                    max-height: 300px;
                    overflow-y: auto;
                    white-space: nowrap;
                }

                /* Style dropdown options for better contrast */
                #${this.id}-content .sort-option {
                    color: #333 !important;
                    background-color: white !important;
                }

                #${this.id}-content .sort-option:hover {
                    background-color: #e3f2fd !important;
                }

                /* IMPROVED: Make file items more distinctive and visible */
                #${this.id}-content .file-item {
                    margin-bottom: 8px;
                    width: 100%;
                    padding: 10px !important;
                    border: 1px solid #ddd !important;
                    border-radius: 4px !important;
                    background-color: #f8f8f8 !important;
                    transition: background-color 0.2s !important;
                }

                #${this.id}-content .file-item:hover {
                    background-color: #eaf5ff !important;
                    border-color: #bbdefb !important;
                }

                /* IMPROVED: Make file list area stand out better */
                #${this.id}-content .file-version-container {
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1) !important;
                    background-color: #fff !important;
                    max-height: none !important; /* Remove any max-height limitations */
                }

                /* Ensure status items have proper layout */
                #${this.id}-content .status-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 8px;
                    width: 100%;
                }

                /* Fix filter buttons styling for small panels */
                #${this.id}-content .filter-buttons::-webkit-scrollbar {
                    height: 4px;
                }

                #${this.id}-content .filter-buttons::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }

                #${this.id}-content .filter-buttons::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }

                /* Ensure filter buttons have consistent size and improved visibility */
                #${this.id}-content .filter-button {
                    min-width: 90px;
                    white-space: nowrap;
                    background-color: #4a76a8 !important;
                    color: white !important;
                    border: 1px solid #4a76a8 !important;
                }

                #${this.id}-content .filter-button.active {
                    background-color: #2c4a6b !important;
                    border-color: #2c4a6b !important;
                    color: white !important;
                }

                /* ADDED: Reduce size of other UI elements to maximize file list space */
                #${this.id}-content .version-stats-container {
                    padding: 8px 10px !important;
                }

                #${this.id}-content .search-filter-container {
                    padding: 8px !important;
                }
            `;

            // Add the style element to the document head
            document.head.appendChild(styleElement);
        },

        /**
         * Create filter button
         */
        createFilterButton: function(key, label, color, isActive = false) {
            const button = document.createElement('button');
            button.className = 'filter-button';
            button.setAttribute('data-filter', key);

            if (isActive) {
                button.classList.add('active');
            }

            button.innerHTML = `
                <span class="filter-color" style="background-color: ${color}"></span>
                <span class="filter-label">${label}</span>
                <span class="filter-count" id="count-${key}">0</span>
            `;

            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.gap = '5px';
            button.style.padding = '4px 8px';
            button.style.fontSize = '12px';
            button.style.backgroundColor = isActive ? '#2c4a6b' : '#4a76a8'; // CHANGED: Improved contrast with dark colors
            button.style.border = '1px solid #e0e0e0';
            button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
            button.style.whiteSpace = 'nowrap'; // FIX: Prevent text wrapping in buttons
            button.style.minWidth = '90px'; // FIX: Set minimum width for filter buttons

            button.querySelector('.filter-color').style.width = '8px';
            button.querySelector('.filter-color').style.height = '8px';
            button.querySelector('.filter-color').style.borderRadius = '50%';
            button.querySelector('.filter-color').style.display = 'inline-block';
            button.querySelector('.filter-color').style.flexShrink = '0'; // FIX: Prevent color dot from shrinking

            button.addEventListener('click', () => {
                // Update active filter
                this.state.currentFilter = key;

                // Update UI
                document.querySelectorAll('.filter-button').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-filter') === key);
                    btn.style.backgroundColor = btn.getAttribute('data-filter') === key ? '#2c4a6b' : '#4a76a8'; // CHANGED: Darker blue for active, blue for normal
                });

                // Apply filters and update display
                this.applyFiltersAndSort();
                this.renderFileVersions();
            });

            return button;
        },

        /**
         * Update category counters
         */
        updateCategoryCounters: function() {
            if (!this.dom.categoryCounters) return;

            this.dom.categoryCounters.innerHTML = '';

            // Total count
            const totalFiles = this.state.files.length;
            const allCountEl = document.getElementById('count-all');
            if (allCountEl) {
                allCountEl.textContent = totalFiles;
            }

            // Update category counts in filter buttons
            Object.entries(this.state.categories).forEach(([key, category]) => {
                const countEl = document.getElementById(`count-${key}`);
                if (countEl) {
                    countEl.textContent = category.count;
                }

                // Skip categories with no files for cleaner display
                if (category.count === 0) return;

                // Add detailed counters
                const counter = document.createElement('div');
                counter.className = 'category-counter';
                counter.style.display = 'flex';
                counter.style.alignItems = 'center';
                counter.style.gap = '5px';

                const colorIndicator = document.createElement('span');
                colorIndicator.style.width = '8px';
                colorIndicator.style.height = '8px';
                colorIndicator.style.borderRadius = '50%';
                colorIndicator.style.backgroundColor = category.color;
                counter.appendChild(colorIndicator);

                const label = document.createElement('span');
                label.textContent = `${category.label}: `;
                counter.appendChild(label);

                const count = document.createElement('span');
                count.textContent = `${category.count} (${this.formatBytes(category.size)})`;
                count.style.fontWeight = 'bold';
                counter.appendChild(count);

                this.dom.categoryCounters.appendChild(counter);
            });
        },

        /**
         * Show loading indicator
         */
        showLoading: function() {
            this.state.isLoading = true;
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'flex';
            }
            if (this.dom.refreshButton) {
                this.dom.refreshButton.disabled = true;
            }
        },

        /**
         * Hide loading indicator
         */
        hideLoading: function() {
            this.state.isLoading = false;
            if (this.dom.loadingIndicator) {
                this.dom.loadingIndicator.style.display = 'none';
            }
            if (this.dom.refreshButton) {
                this.dom.refreshButton.disabled = false;
            }
        },

        /**
         * Show error message
         */
        showError: function(message) {
            if (this.dom.errorMessage) {
                this.dom.errorMessage.textContent = message;
                this.dom.errorMessage.style.display = 'block';
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
         * Handle search input
         */
        handleSearch: function(query) {
            // Update search query
            this.state.searchQuery = query.trim();

            // Show/hide clear button
            const clearButton = this.dom.searchInput.nextElementSibling;
            if (clearButton) {
                clearButton.style.display = this.state.searchQuery ? 'block' : 'none';
            }

            // Apply filters and update display
            this.applyFiltersAndSort();
            this.renderFileVersions();
        },

        /**
         * Format bytes into human-readable format
         * @param {number} bytes - The number of bytes
         * @returns {string} - Formatted string (e.g., "2.5 MB")
         */
        formatBytes: function(bytes, decimals = 1) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        },

        /**
         * Toggle grouping by category
         */
        toggleGrouping: function() {
            this.state.groupByCategory = !this.state.groupByCategory;

            // Update button appearance
            if (this.dom.groupButton) {
                this.dom.groupButton.innerHTML = this.state.groupByCategory ?
                    '<span>⊞</span> Ungroup' : // FIX: Changed text to clarify action
                    '<span>⊞</span> Group';

                this.dom.groupButton.style.backgroundColor = this.state.groupByCategory ?
                    '#2c4a6b' : '#4a76a8'; // CHANGED: Use darker blue for active state, but keep it readable
            }

            // Update display
            this.renderFileVersions();

            // Show toast notification
            const message = this.state.groupByCategory ?
                'Grouped by file category' :
                'Ungrouped view';
            Framework.showToast(message, 2000);
        },

        /**
         * Render file versions based on current filters and sorting
         */
        renderFileVersions: function() {
            const container = this.dom.fileListContainer;
            if (!container) return;

            // Clear container
            container.innerHTML = '';

            // Check if we have files to display
            if (this.state.filteredFiles.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                emptyMessage.textContent = this.state.searchQuery ?
                    `No files match "${this.state.searchQuery}"` :
                    'No files available';
                emptyMessage.style.padding = '20px';
                emptyMessage.style.textAlign = 'center';
                emptyMessage.style.color = '#666';
                emptyMessage.style.fontStyle = 'italic';
                container.appendChild(emptyMessage);
                return;
            }

            // Decide how to render files based on grouping option
            if (this.state.groupByCategory) {
                this.renderGroupedFiles(container);
            } else {
                this.renderFileList(container, this.state.filteredFiles);
            }
        },

        /**
         * Render files grouped by category
         */
        renderGroupedFiles: function(container) {
            // Get unique categories from filtered files and total sizes for each
            const categories = {};
            this.state.filteredFiles.forEach(file => {
                if (!categories[file.category]) {
                    categories[file.category] = {
                        label: this.state.categories[file.category]?.label || 'Other',
                        color: this.state.categories[file.category]?.color || '#cccccc',
                        files: [],
                        totalSize: 0
                    };
                }
                categories[file.category].files.push(file);
                categories[file.category].totalSize += file.size || 0;
            });

            // Create sections for each category
            // Sort categories by their display label for consistent grouping order
            const sortedCategoryKeys = Object.keys(categories).sort((a, b) => {
                const labelA = this.state.categories[a]?.label || 'Other';
                const labelB = this.state.categories[b]?.label || 'Other';
                return labelA.localeCompare(labelB);
            });


            sortedCategoryKeys.forEach((categoryKey) => {
                const category = categories[categoryKey];
                // Create category section
                const sectionContainer = document.createElement('div');
                sectionContainer.className = 'file-category-section';
                sectionContainer.style.marginBottom = '15px';

                // Add category header
                const header = document.createElement('div');
                header.className = 'category-header';
                header.style.display = 'flex';
                header.style.alignItems = 'center';
                header.style.gap = '8px';
                header.style.padding = '8px 10px';
                header.style.borderRadius = '4px';
                header.style.backgroundColor = '#f5f5f5';
                header.style.borderLeft = `4px solid ${category.color}`;
                header.style.marginBottom = '8px';

                const categoryColor = document.createElement('span');
                categoryColor.style.width = '10px';
                categoryColor.style.height = '10px';
                categoryColor.style.borderRadius = '50%';
                categoryColor.style.backgroundColor = category.color;
                header.appendChild(categoryColor);

                const categoryLabel = document.createElement('span');
                categoryLabel.textContent = category.label;
                categoryLabel.style.fontWeight = 'bold';
                header.appendChild(categoryLabel);

                const categoryCount = document.createElement('span');
                categoryCount.textContent = `${category.files.length} file${category.files.length !== 1 ? 's' : ''}`;
                categoryCount.style.marginLeft = 'auto';
                categoryCount.style.fontSize = '12px';
                categoryCount.style.color = '#666';
                header.appendChild(categoryCount);

                sectionContainer.appendChild(header);

                // Add files for this category
                this.renderFileList(sectionContainer, category.files);

                // Add to main container
                container.appendChild(sectionContainer);
            });
        },

        /**
         * Render a list of files
         */
        renderFileList: function(container, files) {
            const list = document.createElement('div');
            list.className = 'file-list';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '4px';
            list.style.width = '100%'; // FIX: Ensure full width

            files.forEach(file => {
                const fileItem = this.createFileItem(file);
                list.appendChild(fileItem);
            });

            container.appendChild(list);
        },

        /**
         * Create a file item element
         */
        createFileItem: function(file) {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px 10px';
            item.style.borderRadius = '4px';
            item.style.backgroundColor = '#f9f9f9';
            item.style.border = '1px solid #eee';
            item.style.width = '100%'; // FIX: Ensure full width

            // Left section with file icon and name
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.style.display = 'flex';
            fileInfo.style.alignItems = 'center';
            fileInfo.style.gap = '8px';
            fileInfo.style.overflow = 'hidden';
            fileInfo.style.flex = '1';
            fileInfo.style.minWidth = '0'; // FIX: Allow text truncation

            // File icon based on category
            const fileIcon = document.createElement('span');
            fileIcon.className = 'file-icon';
            fileIcon.textContent = this.getFileIcon(file.category);
            fileIcon.style.flexShrink = '0'; // FIX: Prevent icon from shrinking
            fileInfo.appendChild(fileIcon);

            // File name
            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            fileName.style.whiteSpace = 'nowrap';
            fileName.style.overflow = 'hidden';
            fileName.style.textOverflow = 'ellipsis';
            fileName.style.minWidth = '0'; // FIX: Allow ellipsis to work properly
            fileInfo.appendChild(fileName);

            item.appendChild(fileInfo);

            // Right section with file details
            const fileDetails = document.createElement('div');
            fileDetails.className = 'file-details';
            fileDetails.style.display = 'flex';
            fileDetails.style.alignItems = 'center';
            fileDetails.style.gap = '12px';
            fileDetails.style.marginLeft = '10px';
            fileDetails.style.whiteSpace = 'nowrap';
            fileDetails.style.flexShrink = '0'; // FIX: Prevent details from shrinking

            // Size badge
            if (file.size !== undefined) {
                const sizeBadge = document.createElement('span');
                sizeBadge.className = 'size-badge';
                sizeBadge.textContent = this.formatBytes(file.size);
                sizeBadge.style.backgroundColor = '#e8f5e9';
                sizeBadge.style.color = '#2e7d32';
                sizeBadge.style.border = '1px solid #c8e6c9';
                sizeBadge.style.padding = '2px 6px';
                sizeBadge.style.borderRadius = '12px';
                sizeBadge.style.fontSize = '11px';
                sizeBadge.style.fontWeight = 'bold';
                fileDetails.appendChild(sizeBadge);
            }

            // Date badge
            if (file.lastModified) {
                const dateBadge = document.createElement('span');
                dateBadge.className = 'date-badge';

                // Format the date nicely
                const date = new Date(file.lastModified);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                let dateText;
                if (date.toDateString() === today.toDateString()) {
                    dateText = 'Today ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                } else if (date.toDateString() === yesterday.toDateString()) {
                    dateText = 'Yesterday ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                } else {
                    dateText = date.toLocaleDateString([], {month: 'short', day: 'numeric'}) + ' ' +
                               date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }

                dateBadge.textContent = dateText;
                dateBadge.style.backgroundColor = '#e3f2fd';
                dateBadge.style.color = '#0d47a1';
                dateBadge.style.border = '1px solid #bbdefb';
                dateBadge.style.padding = '2px 6px';
                dateBadge.style.borderRadius = '12px';
                dateBadge.style.fontSize = '11px';
                dateBadge.style.fontWeight = 'bold';
                fileDetails.appendChild(dateBadge);
            }

            item.appendChild(fileDetails);

            // Highlight search matches if applicable
            if (this.state.searchQuery) {
                const query = this.state.searchQuery.toLowerCase();

                // Highlight in file name
                if (file.name.toLowerCase().includes(query)) {
                    const highlightedName = file.name.replace(
                        new RegExp(query, 'gi'),
                        match => `<span style="background-color: #fff9c4;">${match}</span>`
                    );
                    fileName.innerHTML = highlightedName;
                }
            }

            return item;
        },

        /**
         * Get file icon based on category
         */
        getFileIcon: function(category) {
            const icons = {
                'js': '📄', // JavaScript files
                'py': '🐍', // Python files
                'html': '🌐', // HTML files
                'css': '🎨', // CSS files
                'json': '📋', // JSON files
                'txt': '📝', // Text files
                'log': '📊', // Log files
                'other': '📄'  // Other file types
            };

            return icons[category] || icons['other'];
        },

        /**
         * Update file statistics display
         */
        updateFileStats: function() {
            if (!this.dom.statsContainer) return;

            this.dom.statsContainer.innerHTML = '';

            // Basic statistics
            const totalFiles = this.state.fileCount;
            const totalSize = this.state.totalSize;

            // Find largest file
            let largestFile = { name: 'None', size: 0 };
            if (this.state.files.length > 0) {
                largestFile = this.state.files.reduce((prev, current) =>
                    (prev.size > current.size) ? prev : current
                );
            }

            // Find newest file
            let newestFile = { name: 'None', lastModified: null };
            if (this.state.files.length > 0) {
                newestFile = this.state.files.reduce((prev, current) => {
                    if (!prev.lastModified) return current;
                    if (!current.lastModified) return prev;
                    return (new Date(prev.lastModified) > new Date(current.lastModified)) ? prev : current;
                });
            }

            // Calculate average file size
            const avgSize = totalFiles > 0 ? totalSize / totalFiles : 0;

            // Count files modified today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const recentFiles = this.state.files.filter(file =>
                file.lastModified && new Date(file.lastModified) >= today
            ).length;

            // Create stat blocks - MODIFIED: Limited to just a few key stats to save space
            const stats = [
                {
                    label: 'Total Files',
                    value: totalFiles,
                    color: '#0277bd'
                },
                {
                    label: 'Total Size',
                    value: this.formatBytes(totalSize),
                    color: '#00897b'
                },
                {
                    label: 'Files Modified Today',
                    value: recentFiles,
                    color: '#e65100'
                }
            ];

            // Only add largest file if there's extra space
            if (window.innerWidth > 500 && largestFile.size > 0) {
                stats.push({
                    label: 'Largest File',
                    value: `${largestFile.name} (${this.formatBytes(largestFile.size)})`,
                    color: '#c2185b'
                });
            }

            // Create stat elements
            stats.forEach(stat => {
                const statElement = document.createElement('div');
                statElement.className = 'stat-item';
                statElement.style.backgroundColor = 'white';
                statElement.style.border = '1px solid #e0e0e0';
                statElement.style.borderLeft = `4px solid ${stat.color}`;
                statElement.style.borderRadius = '4px';
                statElement.style.padding = '6px 10px'; // REDUCED padding for compactness
                statElement.style.flex = '1';
                statElement.style.minWidth = '140px'; // REDUCED width for more flexibility

                const statLabel = document.createElement('div');
                statLabel.className = 'stat-label';
                statLabel.textContent = stat.label;
                statLabel.style.fontSize = '11px';
                statLabel.style.color = '#666';
                statLabel.style.marginBottom = '2px';
                statElement.appendChild(statLabel);

                const statValue = document.createElement('div');
                statValue.className = 'stat-value';
                statValue.textContent = stat.value;
                statValue.style.fontSize = '14px';
                statValue.style.fontWeight = 'bold';
                statValue.style.color = stat.color;
                // FIX: Add word wrapping for long values
                statValue.style.wordBreak = 'break-word';
                statElement.appendChild(statValue);

                this.dom.statsContainer.appendChild(statElement);
            });
        },

        /**
         * Update the last update time display
         */
        updateLastUpdateTime: function() {
            if (!this.dom.lastUpdateTime || !this.state.lastUpdate) return;

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

            this.dom.lastUpdateTime.textContent = timeText;
        },

        /**
         * Get file data from the provided file list
         */
        getVersionData: function() {
            // Parse the provided file list data
            const fileData = [
                { name: "actions.json", size: 4551, lastModified: "05/17/2025 07:48 AM" },
                { name: "action_simplified.py", size: 15818, lastModified: "05/17/2025 07:52 AM" },
                { name: "active_actions.txt", size: 0, lastModified: "05/16/2025 10:53 AM" },
                { name: "ai_prompt_controls.txt", size: 1269, lastModified: "05/25/2025 12:44 PM" },
                { name: "api_config.json", size: 765, lastModified: "05/16/2025 10:44 AM" },
                { name: "api_manager.py", size: 13325, lastModified: "05/14/2025 06:17 PM" },
                { name: "app.py", size: 75104, lastModified: "05/12/2025 08:20 PM" },
                { name: "back.py", size: 4668, lastModified: "04/28/2025 05:18 PM" },
                { name: "block.py", size: 6603, lastModified: "04/21/2025 05:28 PM" },
                { name: "block.txt", size: 156, lastModified: "04/21/2025 04:34 PM" },
                { name: "commands.json", size: 3984, lastModified: "05/17/2025 08:03 AM" },
                { name: "command_config.json", size: 1321, lastModified: "05/24/2025 07:52 PM" },
                { name: "command_system.py", size: 18205, lastModified: "05/12/2025 08:20 PM" },
                { name: "config.js", size: 18359, lastModified: "05/22/2025 04:44 PM" },
                { name: "config.json", size: 279, lastModified: "05/16/2025 10:53 AM" },
                { name: "config.py", size: 7917, lastModified: "05/12/2025 08:20 PM" },
                { name: "controls.py", size: 26788, lastModified: "05/25/2025 12:47 PM" },
                { name: "control_output.json", size: 118, lastModified: "05/16/2025 10:44 AM" },
                { name: "core.py", size: 15392, lastModified: "05/22/2025 04:25 PM" },
                { name: "css_selectors.json", size: 5627, lastModified: "05/24/2025 07:30 PM" },
                { name: "dirt.py", size: 3060, lastModified: "03/27/2025 06:41 PM" },
                { name: "emotions.py", size: 16241, lastModified: "04/22/2025 03:39 AM" },
                { name: "emotions.txt", size: 437, lastModified: "04/22/2025 03:42 AM" },
                { name: "error_patterns.json", size: 9196, lastModified: "05/24/2025 07:47 PM" },
                { name: "filter.py", size: 1601, lastModified: "03/18/2025 02:39 PM" },
                { name: "flask_output.log", size: 1, lastModified: "05/11/2025 02:24 PM" },
                { name: "focus.py", size: 29223, lastModified: "05/10/2025 12:10 PM" },
                { name: "focus_config.json", size: 939, lastModified: "04/25/2025 10:20 AM" },
                { name: "focus_log.txt", size: 4963, lastModified: "04/25/2025 10:19 AM" },
                { name: "framework.js", size: 106598, lastModified: "05/14/2025 09:36 PM" },
                { name: "framework_integration.json", size: 7708, lastModified: "05/24/2025 07:56 PM" },
                { name: "index.html", size: 19274, lastModified: "05/22/2025 01:10 PM" },
                { name: "jjk.py", size: 9710, lastModified: "05/25/2025 08:59 PM" },
                { name: "js_examples.json", size: 2272, lastModified: "05/22/2025 08:14 PM" },
                { name: "key.py", size: 127, lastModified: "03/22/2025 02:05 PM" },
                { name: "key_history.json", size: 559, lastModified: "04/11/2025 05:41 PM" },
                { name: "loader.py", size: 19731, lastModified: "05/17/2025 07:51 AM" },
                { name: "looper.py", size: 18814, lastModified: "05/16/2025 04:56 PM" },
                { name: "lvl3.py", size: 7106, lastModified: "04/20/2025 02:21 PM" },
                { name: "mematrix.py", size: 134651, lastModified: "05/26/2025 12:35 PM" },
                { name: "mematrix_keywords.py", size: 7462, lastModified: "05/25/2025 06:22 PM" },
                { name: "mematrix_message_cleaner.py", size: 8542, lastModified: "05/26/2025 11:45 AM" },
                { name: "mematrix_state.py", size: 18415, lastModified: "05/25/2025 06:57 PM" },
                { name: "mematrix_ui.py", size: 21007, lastModified: "05/26/2025 12:33 PM" },
                { name: "memory.py", size: 12539, lastModified: "04/23/2025 07:20 PM" },
                { name: "newfilter.py", size: 3259, lastModified: "04/28/2025 10:12 AM" },
                { name: "ok.py", size: 3299, lastModified: "04/22/2025 03:48 PM" },
                { name: "openai_key.py", size: 200, lastModified: "04/07/2025 02:18 PM" },
                { name: "persona.py", size: 6112, lastModified: "03/18/2025 02:39 PM" },
                { name: "personas.json", size: 1296, lastModified: "05/09/2025 10:05 PM" },
                { name: "principles_definitions.json", size: 44521, lastModified: "05/23/2025 05:51 AM" },
                { name: "prompts.json", size: 476, lastModified: "05/09/2025 12:34 PM" },
                { name: "prompts.py", size: 6614, lastModified: "03/18/2025 02:39 PM" },
                { name: "ref.json", size: 2093, lastModified: "05/21/2025 08:16 AM" },
                { name: "save.txt", size: 359, lastModified: "04/20/2025 02:21 PM" },
                { name: "styles.css", size: 40463, lastModified: "05/14/2025 09:36 PM" },
                { name: "temp_control_display.html", size: 797, lastModified: "05/07/2025 08:32 AM" },
                { name: "update.py", size: 6298, lastModified: "03/18/2025 02:40 PM" },
                { name: "voice.py", size: 7427, lastModified: "03/21/2025 06:56 PM" },
                { name: "website_input.txt", size: 0, lastModified: "05/15/2025 11:18 PM" },
                { name: "website_output.txt", size: 392, lastModified: "05/16/2025 10:53 AM" },
                { name: "web_input.py", size: 2332, lastModified: "03/22/2025 03:41 PM" },
                { name: "wikipedia_config.json", size: 2712, lastModified: "05/10/2025 11:23 AM" },
                { name: "wiki_action.py", size: 26359, lastModified: "05/10/2025 03:33 PM" },
                { name: "x.py", size: 4731, lastModified: "03/27/2025 06:41 PM" },
                { name: "youtube_action.py", size: 23053, lastModified: "05/10/2025 04:14 PM" },
                { name: "youtube_api_key.txt", size: 39, lastModified: "04/18/2025 06:39 PM" },
                { name: "youtube_config.json", size: 1942, lastModified: "05/10/2025 11:27 AM" },
                { name: "sandbox.py", size: 9225, lastModified: "05/17/2025 09:44 AM" },
                { name: "bottom-panel-1.js", size: 85175, lastModified: "05/08/2025 08:30 PM" },
                { name: "bottom-panel-2.js", size: 64415, lastModified: "05/09/2025 12:28 PM" },
                { name: "bottom-panel-3.js", size: 67195, lastModified: "05/12/2025 10:52 AM" },
                { name: "bottom-panel-4.js", size: 74296, lastModified: "05/09/2025 02:01 PM" },
                { name: "bottom-panel-5.js", size: 69663, lastModified: "05/26/2025 01:10 PM" },
                { name: "bottom-panel-6.js", size: 18965, lastModified: "05/09/2025 06:30 PM" },
                { name: "bottom-panel-7.js", size: 24049, lastModified: "05/09/2025 06:30 PM" },
                { name: "bottom-panel-8.js", size: 184019, lastModified: "05/04/2025 12:05 AM" },
                { name: "bottom-panel-9.js", size: 68810, lastModified: "05/21/2025 02:23 PM" },
                { name: "left-panel-1.js", size: 39966, lastModified: "04/24/2025 02:55 PM" },
                { name: "left-panel-2.js", size: 65723, lastModified: "04/23/2025 08:19 PM" },
                { name: "left-panel-3.js", size: 33708, lastModified: "05/10/2025 11:42 AM" },
                { name: "left-panel-4.js", size: 36618, lastModified: "05/10/2025 11:44 AM" },
                { name: "left-panel-5.js", size: 12544, lastModified: "05/02/2025 11:10 PM" },
                { name: "left-panel-6.js", size: 21077, lastModified: "04/30/2025 09:56 PM" },
                { name: "left-panel-7.js", size: 13022, lastModified: "05/12/2025 01:01 PM" },
                { name: "left-panel-8.js", size: 25715, lastModified: "05/18/2025 01:18 PM" },
                { name: "right-panel-1.js", size: 37857, lastModified: "05/10/2025 10:56 AM" },
                { name: "right-panel-2.js", size: 65600, lastModified: "04/28/2025 01:19 AM" },
                { name: "right-panel-3.js", size: 77290, lastModified: "04/27/2025 09:40 PM" },
                { name: "right-panel-4.js", size: 11612, lastModified: "04/28/2025 04:13 PM" },
                { name: "right-panel-5.js", size: 37199, lastModified: "04/21/2025 11:06 PM" },
                { name: "right-panel-6.js", size: 127019, lastModified: "05/22/2025 04:15 PM" },
                { name: "right-panel-7.js", size: 6522, lastModified: "04/30/2025 07:43 PM" },
                { name: "top-panel-1.js", size: 30865, lastModified: "04/23/2025 07:50 PM" },
                { name: "top-panel-10.js", size: 117640, lastModified: "05/04/2025 01:40 PM" },
                { name: "top-panel-2.js", size: 36014, lastModified: "05/08/2025 05:59 PM" },
                { name: "top-panel-3.js", size: 33709, lastModified: "05/08/2025 06:18 PM" },
                { name: "top-panel-4.js", size: 31128, lastModified: "05/08/2025 06:26 PM" },
                { name: "top-panel-5.js", size: 61761, lastModified: "05/08/2025 07:30 PM" },
                { name: "top-panel-6.js", size: 28941, lastModified: "05/08/2025 07:35 PM" },
                { name: "top-panel-7.js", size: 23293, lastModified: "04/30/2025 08:15 PM" },
                { name: "top-panel-8.js", size: 67073, lastModified: "04/25/2025 10:44 AM" },
                { name: "top-panel-9.js", size: 23523, lastModified: "05/09/2025 06:38 PM" },
                { name: "20turns.txt", size: 1509, lastModified: "03/23/2025 08:35 PM" },
                { name: "action.txt", size: 1853, lastModified: "03/18/2025 02:39 PM" },
                { name: "anya.txt", size: 29822, lastModified: "03/18/2025 02:39 PM" },
                { name: "bomb.txt", size: 6236, lastModified: "03/18/2025 02:40 PM" },
                { name: "capabilities.txt", size: 24246, lastModified: "03/18/2025 02:39 PM" },
                { name: "coding.txt", size: 1522, lastModified: "03/18/2025 02:40 PM" },
                { name: "contextprompt.txt", size: 4980, lastModified: "03/18/2025 02:39 PM" },
                { name: "corerepeat.txt", size: 4243, lastModified: "03/18/2025 02:39 PM" },
                { name: "dash.txt", size: 3577, lastModified: "05/11/2025 03:54 PM" },
                { name: "debug.txt", size: 8980, lastModified: "03/18/2025 02:40 PM" },
                { name: "diagnostic.txt", size: 1742, lastModified: "03/18/2025 02:39 PM" },
                { name: "directive.txt", size: 2724, lastModified: "03/18/2025 02:39 PM" },
                { name: "dual.txt", size: 2405, lastModified: "03/18/2025 02:39 PM" },
                { name: "emoji.txt", size: 2979, lastModified: "03/18/2025 02:39 PM" },
                { name: "empower.txt", size: 1918, lastModified: "03/18/2025 02:40 PM" },
                { name: "enemy.txt", size: 20903, lastModified: "03/18/2025 02:39 PM" },
                { name: "evolve.txt", size: 3081, lastModified: "03/18/2025 02:40 PM" },
                { name: "execute.txt", size: 912, lastModified: "03/18/2025 02:39 PM" },
                { name: "fix_summary_20250507-083134.txt", size: 126, lastModified: "05/07/2025 08:31 AM" },
                { name: "flip.txt", size: 3617, lastModified: "03/18/2025 02:39 PM" },
                { name: "framer.txt", size: 24171, lastModified: "03/18/2025 02:39 PM" },
                { name: "goodcom.txt", size: 5695, lastModified: "03/18/2025 02:39 PM" },
                { name: "gpt.txt", size: 458, lastModified: "05/15/2025 09:55 PM" },
                { name: "guided.txt", size: 1624, lastModified: "03/18/2025 02:39 PM" },
                { name: "honest.txt", size: 842, lastModified: "03/18/2025 02:39 PM" },
                { name: "hyper.txt", size: 5715, lastModified: "03/18/2025 02:39 PM" },
                { name: "journey.txt", size: 5866, lastModified: "03/21/2025 12:08 AM" },
                { name: "joy.txt", size: 3512, lastModified: "03/18/2025 02:39 PM" },
                { name: "joyauto.txt", size: 1168, lastModified: "03/18/2025 02:40 PM" },
                { name: "linux.txt", size: 406, lastModified: "03/23/2025 01:28 PM" },
                { name: "loop.txt", size: 1980, lastModified: "05/07/2025 03:04 PM" },
                { name: "loop2.txt", size: 10079, lastModified: "05/07/2025 02:33 PM" },
                { name: "mandatory.txt", size: 2982, lastModified: "03/18/2025 02:39 PM" },
                { name: "math.txt", size: 3670, lastModified: "03/18/2025 02:39 PM" },
                { name: "me.txt", size: 1069, lastModified: "05/15/2025 06:14 AM" },
                { name: "meta.txt", size: 4642, lastModified: "03/18/2025 02:39 PM" },
                { name: "million.txt", size: 1937, lastModified: "03/18/2025 02:40 PM" },
                { name: "nopain.txt", size: 1705, lastModified: "03/18/2025 02:40 PM" },
                { name: "NOTE1.txt", size: 11186, lastModified: "03/18/2025 11:24 PM" },
                { name: "obey.txt", size: 1057, lastModified: "03/18/2025 02:40 PM" },
                { name: "professor.txt", size: 5170, lastModified: "03/18/2025 02:40 PM" },
                { name: "reasoning.txt", size: 7510, lastModified: "03/18/2025 02:40 PM" },
                { name: "reflect.txt", size: 3370, lastModified: "03/18/2025 02:39 PM" },
                { name: "reverse.txt", size: 1229, lastModified: "03/18/2025 02:39 PM" },
                { name: "shortaction.txt", size: 421, lastModified: "03/18/2025 02:39 PM" },
                { name: "shrinktext.txt", size: 1835, lastModified: "05/05/2025 11:00 PM" },
                { name: "silence.txt", size: 2436, lastModified: "03/18/2025 02:39 PM" },
                { name: "speak.txt", size: 974, lastModified: "05/10/2025 06:42 PM" },
                { name: "storage.txt", size: 21281, lastModified: "03/18/2025 02:39 PM" },
                { name: "structure.txt", size: 1576, lastModified: "03/18/2025 02:39 PM" },
                { name: "tool.txt", size: 944, lastModified: "03/18/2025 02:39 PM" },
                { name: "understand.txt", size: 956, lastModified: "03/18/2025 02:40 PM" },
                { name: "usercommand.txt", size: 2400, lastModified: "03/18/2025 02:39 PM" },
                { name: "usermax.txt", size: 201, lastModified: "03/18/2025 02:39 PM" },
                { name: "utter.txt", size: 1246, lastModified: "03/18/2025 02:39 PM" }
            ];

            return fileData;
        },

        /**
         * Clean up resources
         */
        cleanup: function() {
            // Clear intervals, remove event listeners, etc.
            console.log(`[${this.id}] Cleaning up resources...`);

            // Remove any custom styles
            const styleElement = document.querySelector(`style[id^="${this.id}"]`);
            if (styleElement) {
                styleElement.remove();
            }
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();