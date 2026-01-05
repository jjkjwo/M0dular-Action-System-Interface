/**
 * ==============================================================================================
 * Top Panel 11 - Lore Data Viewer
 * ==============================================================================================
 *
 * Displays ALL world-building lore data from lore_data.json with auto-refresh capability.
 * Shows EVERYTHING - all entries from all categories, fully expanded.
 *
 * @version 2.0.0 - Complete rewrite to show ALL data entries, not just categories
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-11',

        // DOM references
        dom: {
            content: null,
            searchInput: null,
            categoryContainer: null,
            refreshButton: null,
            lastUpdateTime: null,
            expandAllBtn: null,
            collapseAllBtn: null,
            totalCountEl: null
        },

        // Component state
        state: {
            loreData: null,
            filteredData: null,
            expandedCategories: new Set(), // Start with empty set - will be filled on load
            lastFetch: null,
            refreshInterval: null,
            searchTerm: '',
            isCompactMode: false,
            autoRefreshEnabled: true,
            refreshRate: 120000, // 2 minutes
            showAllByDefault: true // NEW: Show all entries by default
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing Lore Data Viewer...`);
            
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }

            // Create the panel structure
            this.renderPanel();
            
            // Load initial data
            this.fetchLoreData();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Setup resize observer for compact mode
            this.setupResizeObserver();
            
            console.log(`[${this.id}] Initialization complete`);
        },

        /**
         * Render the main panel structure
         */
        renderPanel: function() {
            if (!this.dom.content) return;
            
            this.dom.content.innerHTML = '';
            
            const container = document.createElement('div');
            container.className = 'lore-viewer-panel';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.height = '100%';
            container.style.overflow = 'hidden';
            
            // Header with controls
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.style.padding = '8px 10px';
            header.style.backgroundColor = '#f5f5f5';
            header.style.borderBottom = '1px solid #e0e0e0';
            header.style.flexShrink = '0';
            
            // Title and controls row
            const headerTop = document.createElement('div');
            headerTop.style.display = 'flex';
            headerTop.style.justifyContent = 'space-between';
            headerTop.style.alignItems = 'center';
            headerTop.style.marginBottom = '8px';
            
            const titleContainer = document.createElement('div');
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'center';
            titleContainer.style.gap = '10px';
            
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.fontSize = '14px';
            title.innerHTML = '📚 Lore Data Viewer';
            titleContainer.appendChild(title);
            
            // Total count display
            const totalCount = document.createElement('div');
            totalCount.style.fontSize = '12px';
            totalCount.style.color = '#666';
            totalCount.style.padding = '2px 8px';
            totalCount.style.background = '#e9ecef';
            totalCount.style.borderRadius = '12px';
            totalCount.innerHTML = 'Loading...';
            this.dom.totalCountEl = totalCount;
            titleContainer.appendChild(totalCount);
            
            headerTop.appendChild(titleContainer);
            
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '8px';
            controls.style.alignItems = 'center';
            
            // Show All toggle
            const showAllLabel = document.createElement('label');
            showAllLabel.style.display = 'flex';
            showAllLabel.style.alignItems = 'center';
            showAllLabel.style.fontSize = '12px';
            showAllLabel.style.cursor = 'pointer';
            showAllLabel.style.marginRight = '8px';
            
            const showAllCheckbox = document.createElement('input');
            showAllCheckbox.type = 'checkbox';
            showAllCheckbox.checked = this.state.showAllByDefault;
            showAllCheckbox.style.marginRight = '4px';
            showAllCheckbox.addEventListener('change', (e) => {
                this.state.showAllByDefault = e.target.checked;
                if (e.target.checked) {
                    this.expandAll();
                } else {
                    this.collapseAll();
                }
            });
            
            showAllLabel.appendChild(showAllCheckbox);
            showAllLabel.appendChild(document.createTextNode('Show All'));
            controls.appendChild(showAllLabel);
            
            // Auto-refresh toggle
            const autoRefreshLabel = document.createElement('label');
            autoRefreshLabel.style.display = 'flex';
            autoRefreshLabel.style.alignItems = 'center';
            autoRefreshLabel.style.fontSize = '12px';
            autoRefreshLabel.style.cursor = 'pointer';
            
            const autoRefreshCheckbox = document.createElement('input');
            autoRefreshCheckbox.type = 'checkbox';
            autoRefreshCheckbox.checked = this.state.autoRefreshEnabled;
            autoRefreshCheckbox.style.marginRight = '4px';
            autoRefreshCheckbox.addEventListener('change', (e) => {
                this.state.autoRefreshEnabled = e.target.checked;
                if (e.target.checked) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
            
            autoRefreshLabel.appendChild(autoRefreshCheckbox);
            autoRefreshLabel.appendChild(document.createTextNode('Auto'));
            controls.appendChild(autoRefreshLabel);
            
            // Refresh button
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'refresh-button';
            refreshBtn.innerHTML = '🔄';
            refreshBtn.style.padding = '4px 8px';
            refreshBtn.style.fontSize = '12px';
            refreshBtn.style.cursor = 'pointer';
            refreshBtn.style.border = '1px solid #ccc';
            refreshBtn.style.borderRadius = '3px';
            refreshBtn.style.backgroundColor = 'white';
            refreshBtn.title = 'Refresh lore data';
            refreshBtn.addEventListener('click', () => this.fetchLoreData());
            this.dom.refreshButton = refreshBtn;
            controls.appendChild(refreshBtn);
            
            // Expand/Collapse all buttons
            const expandBtn = document.createElement('button');
            expandBtn.innerHTML = '⊕';
            expandBtn.style.padding = '4px 8px';
            expandBtn.style.fontSize = '12px';
            expandBtn.style.cursor = 'pointer';
            expandBtn.style.border = '1px solid #ccc';
            expandBtn.style.borderRadius = '3px';
            expandBtn.style.backgroundColor = 'white';
            expandBtn.title = 'Expand all';
            expandBtn.addEventListener('click', () => this.expandAll());
            this.dom.expandAllBtn = expandBtn;
            controls.appendChild(expandBtn);
            
            const collapseBtn = document.createElement('button');
            collapseBtn.innerHTML = '⊖';
            collapseBtn.style.padding = '4px 8px';
            collapseBtn.style.fontSize = '12px';
            collapseBtn.style.cursor = 'pointer';
            collapseBtn.style.border = '1px solid #ccc';
            collapseBtn.style.borderRadius = '3px';
            collapseBtn.style.backgroundColor = 'white';
            collapseBtn.title = 'Collapse all';
            collapseBtn.addEventListener('click', () => this.collapseAll());
            this.dom.collapseAllBtn = collapseBtn;
            controls.appendChild(collapseBtn);
            
            headerTop.appendChild(controls);
            header.appendChild(headerTop);
            
            // Search bar
            const searchContainer = document.createElement('div');
            searchContainer.style.display = 'flex';
            searchContainer.style.gap = '8px';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search lore...';
            searchInput.style.flex = '1';
            searchInput.style.padding = '4px 8px';
            searchInput.style.fontSize = '12px';
            searchInput.style.border = '1px solid #ccc';
            searchInput.style.borderRadius = '3px';
            searchInput.addEventListener('input', (e) => {
                this.state.searchTerm = e.target.value;
                this.filterData();
                this.renderCategories();
            });
            this.dom.searchInput = searchInput;
            searchContainer.appendChild(searchInput);
            
            // Last update time
            const updateTime = document.createElement('div');
            updateTime.style.fontSize = '11px';
            updateTime.style.color = '#666';
            updateTime.style.whiteSpace = 'nowrap';
            updateTime.textContent = 'Never updated';
            this.dom.lastUpdateTime = updateTime;
            searchContainer.appendChild(updateTime);
            
            header.appendChild(searchContainer);
            container.appendChild(header);
            
            // Main content area
            const contentArea = document.createElement('div');
            contentArea.className = 'lore-content-area';
            contentArea.style.flex = '1';
            contentArea.style.overflowY = 'auto';
            contentArea.style.padding = '10px';
            contentArea.style.backgroundColor = '#fafafa';
            
            // Category container
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'lore-categories';
            this.dom.categoryContainer = categoryContainer;
            contentArea.appendChild(categoryContainer);
            
            container.appendChild(contentArea);
            
            // Add to panel
            this.dom.content.appendChild(container);
            
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
                /* Lore Viewer Styles */
                .lore-viewer-panel {
                    font-family: var(--font-family);
                    color: var(--color-text);
                }
                
                .lore-category {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }
                
                .lore-category:hover {
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .lore-category-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: #f8f9fa;
                    cursor: pointer;
                    user-select: none;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .lore-category-header:hover {
                    background: #f0f1f2;
                }
                
                .lore-category-header.empty {
                    color: #999;
                    cursor: default;
                }
                
                .lore-category-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    text-transform: capitalize;
                }
                
                .lore-category-icon {
                    transition: transform 0.2s;
                }
                
                .lore-category.expanded .lore-category-icon {
                    transform: rotate(90deg);
                }
                
                .lore-category-count {
                    background: var(--color-primary);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: normal;
                }
                
                .lore-category-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .lore-category.expanded .lore-category-content {
                    max-height: none;
                    overflow-y: visible;
                }
                
                .lore-entry {
                    padding: 10px 12px;
                    border-bottom: 1px solid #f0f0f0;
                    font-size: 12px;
                }
                
                .lore-entry:last-child {
                    border-bottom: none;
                }
                
                .lore-entry:hover {
                    background: #f8f9fa;
                }
                
                .lore-entry-name {
                    font-weight: 600;
                    color: var(--color-primary-dark);
                    margin-bottom: 4px;
                }
                
                .lore-entry-aliases {
                    font-style: italic;
                    color: #666;
                    margin-bottom: 4px;
                    font-size: 11px;
                }
                
                .lore-entry-props {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 4px;
                }
                
                .lore-entry-prop {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 6px;
                    background: #e9ecef;
                    border-radius: 3px;
                    font-size: 11px;
                }
                
                .lore-entry-prop-label {
                    font-weight: 600;
                    color: #666;
                }
                
                .lore-entry-contexts {
                    margin-top: 6px;
                    padding: 6px;
                    background: #f8f9fa;
                    border-radius: 3px;
                    font-size: 11px;
                    color: #666;
                    max-height: 100px;
                    overflow-y: auto;
                }
                
                .lore-entry-note {
                    font-size: 11px;
                    padding: 6px;
                    background: #f0f8ff;
                    border-radius: 3px;
                    margin-top: 6px;
                    white-space: pre-wrap;
                }
                
                .lore-entry-status {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .lore-entry-status.confirmed {
                    background: #d4edda;
                    color: #155724;
                }
                
                .lore-entry-status.pending {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .lore-meta-section {
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    margin-bottom: 8px;
                }
                
                .lore-meta-title {
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #495057;
                }
                
                .lore-meta-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 8px;
                }
                
                .lore-meta-stat {
                    background: white;
                    padding: 8px;
                    border-radius: 3px;
                    border: 1px solid #e0e0e0;
                }
                
                .lore-meta-stat-label {
                    font-size: 11px;
                    color: #666;
                    margin-bottom: 2px;
                }
                
                .lore-meta-stat-value {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--color-primary);
                }
                
                .lore-empty {
                    text-align: center;
                    padding: 20px;
                    color: #999;
                    font-style: italic;
                }
                
                .lore-search-highlight {
                    background: yellow;
                    font-weight: 600;
                }
                
                /* Compact mode */
                .lore-viewer-panel.compact .lore-category-header {
                    padding: 6px 10px;
                }
                
                .lore-viewer-panel.compact .lore-entry {
                    padding: 8px 10px;
                }
                
                .lore-viewer-panel.compact .lore-category.expanded .lore-category-content {
                    max-height: none;
                }
                
                /* Loading state */
                .lore-loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                
                .lore-loading::after {
                    content: '...';
                    animation: dots 1.5s steps(4, end) infinite;
                }
                
                @keyframes dots {
                    0%, 20% { content: ''; }
                    40% { content: '.'; }
                    60% { content: '..'; }
                    80%, 100% { content: '...'; }
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Fetch lore data from JSON file
         */
        fetchLoreData: async function() {
            try {
                // Show loading state
                if (this.dom.categoryContainer) {
                    this.dom.categoryContainer.innerHTML = '<div class="lore-loading">Loading lore data</div>';
                }
                
                const response = await fetch('lore_data.json?t=' + Date.now());
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                this.state.loreData = data;
                this.state.lastFetch = new Date();
                
                // Update UI
                this.updateLastFetchTime();
                this.updateTotalCount();
                this.filterData();
                
                // If show all by default, expand all categories
                if (this.state.showAllByDefault) {
                    // Add ALL categories to expanded set
                    const allCategories = Object.keys(data).filter(cat => cat !== 'meta');
                    allCategories.forEach(cat => this.state.expandedCategories.add(cat));
                }
                
                this.renderCategories();
                
                console.log(`[${this.id}] Lore data loaded successfully`);
                
            } catch (error) {
                console.error(`[${this.id}] Error fetching lore data:`, error);
                if (this.dom.categoryContainer) {
                    this.dom.categoryContainer.innerHTML = `
                        <div class="lore-empty">
                            Failed to load lore data<br>
                            <small>${error.message}</small>
                        </div>
                    `;
                }
            }
        },

        /**
         * Update total count display
         */
        updateTotalCount: function() {
            if (!this.dom.totalCountEl || !this.state.loreData) return;
            
            const total = this.state.loreData.meta?.total_entries || 0;
            const categoryCount = Object.keys(this.state.loreData).filter(k => k !== 'meta').length;
            
            this.dom.totalCountEl.innerHTML = `${total} entries in ${categoryCount} categories`;
        },

        /**
         * Filter data based on search term
         */
        filterData: function() {
            if (!this.state.loreData) {
                this.state.filteredData = null;
                return;
            }
            
            if (!this.state.searchTerm) {
                this.state.filteredData = this.state.loreData;
                return;
            }
            
            const searchLower = this.state.searchTerm.toLowerCase();
            const filtered = {};
            
            // Filter each category
            Object.entries(this.state.loreData).forEach(([category, items]) => {
                if (category === 'meta') {
                    filtered.meta = items; // Always include meta
                    return;
                }

                // Ensure items is an object before proceeding
                if (typeof items !== 'object' || items === null) {
                    filtered[category] = {};
                    return;
                }
                
                const filteredItems = {};
                Object.entries(items).forEach(([key, item]) => {
                    // Search in all fields
                    const searchableText = [
                        key,
                        item.name,
                        ...(item.aliases || []),
                        ...(item.contexts || []).map(c => c.text),
                        item.note,
                        item.description,
                        item.type,
                        item.alignment,
                        item.class,
                        ...(item.detection_patterns || [])
                    ].filter(Boolean).join(' ').toLowerCase();
                    
                    if (searchableText.includes(searchLower)) {
                        filteredItems[key] = item;
                    }
                });
                
                filtered[category] = filteredItems;
            });
            
            this.state.filteredData = filtered;
        },

        /**
         * Render all categories
         */
        renderCategories: function() {
            if (!this.dom.categoryContainer || !this.state.filteredData) return;
            
            this.dom.categoryContainer.innerHTML = '';
            
            // Render meta section if available
            if (this.state.filteredData.meta) {
                this.renderMetaSection(this.state.filteredData.meta);
            }
            
            // Define ALL category display info from lore.py
            const categoryInfo = {
                characters: { icon: '👤', title: 'Characters' },
                locations: { icon: '📍', title: 'Locations' },
                items_artifacts: { icon: '⚔️', title: 'Items & Artifacts' },
                factions_organizations: { icon: '🏛️', title: 'Factions & Organizations' },
                events: { icon: '📅', title: 'Events' },
                relationships: { icon: '🤝', title: 'Relationships' },
                rules_systems: { icon: '📋', title: 'Rules & Systems' },
                cultures_societies: { icon: '🏘️', title: 'Cultures & Societies' },
                history_timeline: { icon: '📜', title: 'History & Timeline' },
                magic_technology: { icon: '✨', title: 'Magic & Technology' },
                geography: { icon: '🗺️', title: 'Geography' },
                economy_trade: { icon: '💰', title: 'Economy & Trade' },
                languages: { icon: '💬', title: 'Languages' },
                religions_beliefs: { icon: '🕉️', title: 'Religions & Beliefs' },
                conflicts: { icon: '⚡', title: 'Conflicts' },
                creative_notes: { icon: '💭', title: 'Creative Notes' },
                plot_seeds: { icon: '🌱', title: 'Plot Seeds' },
                session_markers: { icon: '📌', title: 'Session Markers' }
            };
            
            // Render each category
            Object.entries(this.state.filteredData).forEach(([categoryKey, items]) => {
                if (categoryKey !== 'meta' && categoryInfo[categoryKey]) {
                    this.renderCategory(categoryKey, categoryInfo[categoryKey], items);
                }
            });
            
            // If no categories found after filtering
            const hasContent = Object.keys(this.state.filteredData).some(k => 
                k !== 'meta' && Object.keys(this.state.filteredData[k]).length > 0
            );
            
            if (!hasContent && this.state.searchTerm) {
                const noResults = document.createElement('div');
                noResults.className = 'lore-empty';
                noResults.innerHTML = `No results found for "${this.state.searchTerm}"`;
                this.dom.categoryContainer.appendChild(noResults);
            }
        },

        /**
         * Render meta information section
         */
        renderMetaSection: function(meta) {
            const section = document.createElement('div');
            section.className = 'lore-meta-section';
            
            const title = document.createElement('div');
            title.className = 'lore-meta-title';
            title.textContent = meta.world_name || 'World Statistics';
            section.appendChild(title);
            
            const stats = document.createElement('div');
            stats.className = 'lore-meta-stats';
            
            // Display all available meta stats
            const statItems = [
                { label: 'Total Entries', value: meta.total_entries || 0 },
                { label: 'Created', value: this.formatTimestamp(meta.created_at) },
                { label: 'Last Updated', value: this.formatTimestamp(meta.last_updated) },
                { label: 'Sessions', value: meta.sessions?.length || 0 }
            ];
            
            statItems.forEach(stat => {
                if (stat.value !== undefined) {
                    const statEl = document.createElement('div');
                    statEl.className = 'lore-meta-stat';
                    statEl.innerHTML = `
                        <div class="lore-meta-stat-label">${stat.label}</div>
                        <div class="lore-meta-stat-value">${stat.value}</div>
                    `;
                    stats.appendChild(statEl);
                }
            });
            
            section.appendChild(stats);
            
            this.dom.categoryContainer.appendChild(section);
        },

        /**
         * Render a single category with ALL its entries
         */
        renderCategory: function(categoryKey, info, items) {
            // Ensure items is an object
            const validItems = (typeof items === 'object' && items !== null) ? items : {};
            const itemCount = Object.keys(validItems).length;
            
            const category = document.createElement('div');
            category.className = 'lore-category';
            category.dataset.category = categoryKey;
            
            if (this.state.expandedCategories.has(categoryKey)) {
                category.classList.add('expanded');
            }
            
            // Header
            const header = document.createElement('div');
            header.className = 'lore-category-header';
            if (itemCount === 0) header.classList.add('empty');
            
            const title = document.createElement('div');
            title.className = 'lore-category-title';
            title.innerHTML = `
                <span class="lore-category-icon">${itemCount > 0 ? '▶' : '◇'}</span>
                <span>${info.icon} ${info.title}</span>
            `;
            header.appendChild(title);
            
            const count = document.createElement('div');
            count.className = 'lore-category-count';
            count.textContent = itemCount;
            header.appendChild(count);
            
            if (itemCount > 0) {
                header.addEventListener('click', () => this.toggleCategory(categoryKey));
            }
            
            category.appendChild(header);
            
            // Content - Show ALL entries
            if (itemCount > 0) {
                const content = document.createElement('div');
                content.className = 'lore-category-content';
                
                // Sort ALL entries by confidence, then by mentions
                const sortedEntries = Object.entries(validItems).sort((a, b) => {
                    const confA = a[1].confidence || 0;
                    const confB = b[1].confidence || 0;
                    if (confA !== confB) return confB - confA;
                    
                    const mentA = a[1].mentions || 0;
                    const mentB = b[1].mentions || 0;
                    return mentB - mentA;
                });
                
                // Render ALL entries - no limit!
                sortedEntries.forEach(([key, item]) => {
                    content.appendChild(this.renderEntry(key, item));
                });
                
                category.appendChild(content);
            }
            
            this.dom.categoryContainer.appendChild(category);
        },

        /**
         * Render a single lore entry with ALL its data
         */
        renderEntry: function(key, item) {
            const entry = document.createElement('div');
            entry.className = 'lore-entry';
            
            // Name
            const name = document.createElement('div');
            name.className = 'lore-entry-name';
            name.textContent = item.name || key;
            if (this.state.searchTerm) {
                name.innerHTML = this.highlightSearchTerm(name.textContent);
            }
            entry.appendChild(name);
            
            // Aliases (if any)
            if (item.aliases && item.aliases.length > 0) {
                const aliases = document.createElement('div');
                aliases.className = 'lore-entry-aliases';
                aliases.textContent = 'Also known as: ' + item.aliases.join(', ');
                entry.appendChild(aliases);
            }
            
            // Properties
            const props = document.createElement('div');
            props.className = 'lore-entry-props';
            
            // ALL properties from lore.py
            const propList = ['type', 'class', 'alignment', 'source', 'region', 'confidence', 'mentions', 'created', 'updated'];
            propList.forEach(prop => {
                if (item[prop] !== undefined) {
                    const propEl = document.createElement('div');
                    propEl.className = 'lore-entry-prop';
                    let value = item[prop];
                    
                    // Format specific properties
                    if (prop === 'confidence') {
                        value = parseFloat(item[prop]).toFixed(2);
                    } else if (prop === 'created' || prop === 'updated') {
                        value = this.formatTimestamp(value);
                    }
                    
                    propEl.innerHTML = `
                        <span class="lore-entry-prop-label">${prop}:</span>
                        <span>${value}</span>
                    `;
                    props.appendChild(propEl);
                }
            });
            
            // Session count
            if (item.sessions && item.sessions.length > 0) {
                const sessions = document.createElement('div');
                sessions.className = 'lore-entry-prop';
                sessions.innerHTML = `
                    <span class="lore-entry-prop-label">sessions:</span>
                    <span>${item.sessions.length}</span>
                `;
                props.appendChild(sessions);
            }
            
            // Detection patterns (if any)
            if (item.detection_patterns && item.detection_patterns.length > 0) {
                const patterns = document.createElement('div');
                patterns.className = 'lore-entry-prop';
                const uniquePatterns = [...new Set(item.detection_patterns.filter(Boolean))];
                patterns.innerHTML = `
                    <span class="lore-entry-prop-label">patterns:</span>
                    <span>${uniquePatterns.join(', ')}</span>
                `;
                props.appendChild(patterns);
            }
            
            if (props.children.length > 0) {
                entry.appendChild(props);
            }
            
            // For creative_notes category, show the note content
            if (item.note) {
                const note = document.createElement('div');
                note.className = 'lore-entry-note';
                note.textContent = item.note;
                if (this.state.searchTerm) {
                    note.innerHTML = this.highlightSearchTerm(item.note);
                }
                entry.appendChild(note);
            }
            
            // Contexts (ALL of them)
            if (item.contexts && item.contexts.length > 0) {
                const contexts = document.createElement('div');
                contexts.className = 'lore-entry-contexts';
                
                // Show ALL contexts with metadata
                const contextList = item.contexts.map((c, idx) => {
                    const sourceTag = c.source ? `[${c.source}]` : '';
                    const sessionTag = c.session_id ? ` (${c.session_id})` : '';
                    return `${idx + 1}. ${c.text}${sourceTag}${sessionTag}`;
                }).join('\n');
                
                contexts.textContent = contextList;
                if (this.state.searchTerm) {
                    contexts.innerHTML = this.highlightSearchTerm(contextList).replace(/\n/g, '<br>');
                }
                entry.appendChild(contexts);
            }
            
            return entry;
        },

        /**
         * Toggle category expansion
         */
        toggleCategory: function(categoryKey) {
            if (this.state.expandedCategories.has(categoryKey)) {
                this.state.expandedCategories.delete(categoryKey);
            } else {
                this.state.expandedCategories.add(categoryKey);
            }
            
            const categoryEl = this.dom.categoryContainer.querySelector(`[data-category="${categoryKey}"]`);
            if (categoryEl) {
                categoryEl.classList.toggle('expanded');
            }
        },

        /**
         * Expand all categories
         */
        expandAll: function() {
            const categories = ['characters', 'locations', 'items_artifacts', 'factions_organizations', 
                              'events', 'relationships', 'rules_systems', 'cultures_societies',
                              'history_timeline', 'magic_technology', 'geography', 'economy_trade',
                              'languages', 'religions_beliefs', 'conflicts', 'creative_notes',
                              'plot_seeds', 'session_markers'];
            
            categories.forEach(cat => {
                this.state.expandedCategories.add(cat);
                const el = this.dom.categoryContainer.querySelector(`[data-category="${cat}"]`);
                if (el && el.querySelector('.lore-category-content')) {
                    el.classList.add('expanded');
                }
            });
        },

        /**
         * Collapse all categories
         */
        collapseAll: function() {
            this.state.expandedCategories.clear();
            this.dom.categoryContainer.querySelectorAll('.lore-category').forEach(el => {
                el.classList.remove('expanded');
            });
        },

        /**
         * Highlight search term in text
         */
        highlightSearchTerm: function(text) {
            if (!this.state.searchTerm || !text) return text;
            
            const regex = new RegExp(this.state.searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            return text.replace(regex, '<span class="lore-search-highlight">$&</span>');
        },

        /**
         * Format timestamp to readable format
         */
        formatTimestamp: function(timestamp) {
            if (!timestamp) return 'Unknown';
            
            try {
                const date = new Date(timestamp);
                const now = new Date();
                const diff = now - date;
                
                // Less than a minute
                if (diff < 60000) return 'Just now';
                
                // Less than an hour
                if (diff < 3600000) {
                    const mins = Math.floor(diff / 60000);
                    return `${mins} min${mins > 1 ? 's' : ''} ago`;
                }
                
                // Less than a day
                if (diff < 86400000) {
                    const hours = Math.floor(diff / 3600000);
                    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                }
                
                // Otherwise show date
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
            } catch (e) {
                return 'Invalid date';
            }
        },

        /**
         * Update last fetch time display
         */
        updateLastFetchTime: function() {
            if (!this.dom.lastUpdateTime || !this.state.lastFetch) return;
            
            const updateTimer = () => {
                this.dom.lastUpdateTime.textContent = this.formatTimestamp(this.state.lastFetch);
            };
            
            updateTimer();
            // Update every 30 seconds
            if(this._updateTimeInterval) clearInterval(this._updateTimeInterval);
            this._updateTimeInterval = setInterval(updateTimer, 30000);
        },

        /**
         * Start auto-refresh
         */
        startAutoRefresh: function() {
            this.stopAutoRefresh();
            
            if (this.state.autoRefreshEnabled) {
                this.state.refreshInterval = setInterval(() => {
                    console.log(`[${this.id}] Auto-refreshing lore data...`);
                    this.fetchLoreData();
                }, this.state.refreshRate);
            }
        },

        /**
         * Stop auto-refresh
         */
        stopAutoRefresh: function() {
            if (this.state.refreshInterval) {
                clearInterval(this.state.refreshInterval);
                this.state.refreshInterval = null;
            }
        },

        /**
         * Setup resize observer for responsive design
         */
        setupResizeObserver: function() {
            if (!window.ResizeObserver || !this.dom.content) return;
            
            const observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const width = entry.contentRect.width;
                    const isCompact = width < 400;
                    
                    if (this.state.isCompactMode !== isCompact) {
                        this.state.isCompactMode = isCompact;
                        const panel = this.dom.content.querySelector('.lore-viewer-panel');
                        if (panel) {
                            panel.classList.toggle('compact', isCompact);
                        }
                    }
                }
            });
            
            observer.observe(this.dom.content);
        },

        /**
         * Called when panel opens
         */
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened`);
            // Refresh data when panel opens
            this.fetchLoreData();
            this.startAutoRefresh();
        },

        /**
         * Called when panel closes
         */
        onPanelClose: function() {
            console.log(`[${this.id}] Panel closed`);
            this.stopAutoRefresh();
        },

        /**
         * Cleanup
         */
        cleanup: function() {
            this.stopAutoRefresh();
            
            if (this._updateTimeInterval) clearInterval(this._updateTimeInterval);

            // Remove styles
            const styleEl = document.getElementById(`${this.id}-styles`);
            if (styleEl) styleEl.remove();
            
            // Clear DOM
            if (this.dom.content) {
                this.dom.content.innerHTML = '';
            }
            
            console.log(`[${this.id}] Cleanup complete`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();