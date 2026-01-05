/**
 * ==============================================================================================
 * Bottom Panel 3 - Enhanced Control Panel Component
 * ==============================================================================================
 *
 * Provides quick access to commands, system controls, and configuration display.
 * Features independently scrollable configuration sections, improved responsive layout,
 * and adaptive sizing for multi-panel scenarios.
 *
 * @version 5.6.0 - Unique IDs/Classes for Restart Dialog elements to prevent conflicts.
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-3',

        // DOM references
        dom: {
            content: null,
            panelHeader: null,        // Reference to the static header
            scrollableContent: null,  // The middle section that scrolls
            commandsWrapper: null,    // The bottom command area wrapper
            apiConfigSection: null,
            mainConfigSection: null,
            configDisplay: null,      // For api_config.json items
            mainConfigDisplay: null,  // For config.json items
            commandsContainer: null,  // Holds the command grids
            systemCommands: null,
            delayCommands: null,
            apiConfigPanel: null,     // NEW: Panel for API Config tab
            // --- START: Unique Dialog Refs ---
            // NOTE: Using highly specific IDs/Classes for dialog elements to prevent
            // conflicts with other components or global styles. This is intentional.
            restartDialog: null,          // Element with ID 'bp3-restart-system-dialog'
            restartDialogBackdrop: null,  // Element with ID 'bp3-restart-dialog-backdrop'
            restartStatusSection: null,   // Element with class 'bp3-dialog-status-section'
            restartStatusMessage: null,   // Element with class 'bp3-dialog-status-message'
            restartStatusDetail: null,    // Element with class 'bp3-dialog-status-detail'
            restartButtonsSection: null,  // Element with class 'bp3-dialog-buttons-section'
            // --- END: Unique Dialog Refs ---
            restartButton: null,          // The command button that triggers the dialog
            autoRefreshToggle: null,      // Toggle for auto-refresh
            apiStatusContainer: null,
            sizeObserver: null            // ResizeObserver instance
        },

        // Component state
        state: {
            commandCategories: {
                system: [
                    { label: 'Restart System', command: 'restart', icon: '🔄', description: 'Restart the AI action system', isSpecial: true, specialClass: 'restart-button', handler: 'handleRestartClick' },
                    { label: 'Clear Chat', command: 'clear', icon: '🗑️', description: 'Clear all chat messages' },
                    { label: 'Help', command: 'help', icon: '❓', description: 'Show available commands' }
                ],
                delay: [
                    { label: 'Delay 2s', command: 'delay 2', icon: '⏱️', description: 'Set delay: 2s' },
                    { label: 'Delay 3s', command: 'delay 3', icon: '⏱️', description: 'Set delay: 3s' },
                    { label: 'Delay 4s', command: 'delay 4', icon: '⏱️', description: 'Set delay: 4s' },
                    { label: 'Delay 5s', command: 'delay 5', icon: '⏱️', description: 'Set delay: 5s' },
                    { label: 'Delay 6s', command: 'delay 6', icon: '⏱️', description: 'Set delay: 6s' },
                    { label: 'Delay 7s', command: 'delay 7', icon: '⏱️', description: 'Set delay: 7s' },
                    { label: 'Delay 8s', command: 'delay 8', icon: '⏱️', description: 'Set delay: 8s' },
                    { label: 'Delay 9s', command: 'delay 9', icon: '⏱️', description: 'Set delay: 9s' },
                    { label: 'Delay 10s', command: 'delay 10', icon: '⏱️', description: 'Set delay: 10s' }
                ],
                api: []
            },
            config: null, // For api_config.json
            mainConfigData: null, // For config.json data
            apiStatus: null,
            isRestarting: false,
            configPollingInterval: null,
            pollTimerId: null, // For restart polling timer
            autoRefresh: false, // Auto-refresh toggle state
            compactMode: false, // Flag for compact display mode
            compactThreshold: 400, // Width threshold for compact mode (px)
            activeCommandTab: 'system' // Active command tab ('system', 'delay', or 'api')
        },

        // --- Core Lifecycle & Initialization ---

        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }
            this.fetchInitialData();
            this.renderContent();
            this.createRestartDialog(); // Create dialog on init, but keep hidden
            this.setupResizeObserver();
            this.startConfigPolling();
            console.log(`[${this.id}] Component initialized.`);
        },

        fetchInitialData: function() {
            this.fetchConfig();       // Fetch API config
            this.fetchMainConfig();   // Fetch main config
            this.fetchApiStatus();    // Fetch health status
        },

        onPanelOpen: function() {
            this.fetchInitialData(); // Fetch fresh data when opened
            this.startConfigPolling();
            console.log(`[${this.id}] Panel opened, polling started.`);
            // Trigger resize check when panel opens
            setTimeout(() => this.checkPanelSize(), 100);
        },

        onPanelClose: function() {
            this.stopConfigPolling();
            if (this.dom.restartDialog && this.dom.restartDialog.style.display !== 'none' && !this.state.isRestarting) {
                this.hideRestartDialog();
            }
            console.log(`[${this.id}] Panel closed, polling stopped.`);
        },

        setupResizeObserver: function() {
            if (window.ResizeObserver && this.dom.content) {
                if (this.dom.sizeObserver) {
                    this.dom.sizeObserver.disconnect();
                }
                this.dom.sizeObserver = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        if (entry.target === this.dom.content) {
                            this.checkPanelSize();
                            break;
                        }
                    }
                });
                this.dom.sizeObserver.observe(this.dom.content);
                console.log(`[${this.id}] Resize observer setup.`);
            } else {
                console.log(`[${this.id}] ResizeObserver not available, using fallback.`);
                window.addEventListener('resize', this.checkPanelSize.bind(this));
            }
        },

        checkPanelSize: function() {
            if (!this.dom.content) return;
            const width = this.dom.content.clientWidth;
            const height = this.dom.content.clientHeight;
            const shouldBeCompact = width < this.state.compactThreshold;
            console.log(`[${this.id}] Panel size check - Width: ${width}px, Height: ${height}px`);
            if (this.state.compactMode !== shouldBeCompact) {
                this.state.compactMode = shouldBeCompact;
                console.log(`[${this.id}] Switching to ${shouldBeCompact ? 'compact' : 'normal'} mode`);
                this.updateLayoutForSize();
            }
        },

        updateLayoutForSize: function() {
            const isCompact = this.state.compactMode;
            if (this.dom.configDisplay) {
                this.dom.configDisplay.style.gridTemplateColumns = isCompact ? 'repeat(1, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))';
            }
            if (this.dom.mainConfigDisplay) {
                this.dom.mainConfigDisplay.style.gridTemplateColumns = isCompact ? 'repeat(1, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))';
            }
            const commandPanels = this.dom.content.querySelectorAll('.command-panel');
            commandPanels.forEach(panel => {
                panel.style.gridTemplateColumns = isCompact ? 'repeat(auto-fill, minmax(80px, 1fr))' : 'repeat(auto-fill, minmax(100px, 1fr))';
            });
            if (this.dom.panelHeader) {
                this.dom.panelHeader.classList.toggle('compact-header', isCompact);
            }
        },

        // --- Rendering ---

        renderContent: function() {
            if (!this.dom.content) return;

            const container = document.createElement('div');
            container.className = 'control-panel';

            container.appendChild(this.createHeaderElement());
            container.appendChild(this.createScrollableContentElement());
            container.appendChild(this.createCommandsElement());

            this.addStyles();

            this.dom.content.innerHTML = '';
            this.dom.content.appendChild(container);

            this.updateApiStatusDisplay();
            this.updateConfigDisplay();
            this.updateMainConfigDisplay();
            this.updateApiConfigTabContent();

            setTimeout(() => this.checkPanelSize(), 50);
        },

        createHeaderElement: function() {
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            this.dom.panelHeader = header;

            header.innerHTML = `
                <h4 class="panel-title"><span class="panel-icon">🎛️</span> Control Panel</h4>
                <div class="auto-refresh-toggle">
                    <input type="checkbox" id="${this.id}-auto-refresh-check" class="toggle-input">
                    <label for="${this.id}-auto-refresh-check" class="toggle-label" title="Auto-refresh data">
                        <span class="toggle-icon">🔄</span>
                    </label>
                </div>
                <div class="api-status-container"></div>
            `;
            this.dom.apiStatusContainer = header.querySelector('.api-status-container');
            this.dom.autoRefreshToggle = header.querySelector('.auto-refresh-toggle');
            const toggleInput = header.querySelector(`#${this.id}-auto-refresh-check`);
            toggleInput.addEventListener('change', () => {
                this.toggleAutoRefresh(toggleInput.checked);
            });

            return header;
        },

        createScrollableContentElement: function() {
            const scrollWrapper = document.createElement('div');
            scrollWrapper.className = 'scrollable-content';
            this.dom.scrollableContent = scrollWrapper;

            // API Config Section
            const apiConfigSection = document.createElement('div');
            apiConfigSection.className = 'config-section api-config-section';
            apiConfigSection.innerHTML = `
                <div class="config-section-title"><span>🔑</span> API Configuration</div>
                <div class="config-display config-items"></div>
            `;
            this.dom.apiConfigSection = apiConfigSection;
            this.dom.configDisplay = apiConfigSection.querySelector('.config-display');
            scrollWrapper.appendChild(apiConfigSection);

            // Main Config Section
            const mainConfigSection = document.createElement('div');
            mainConfigSection.className = 'config-section main-config-section';
            mainConfigSection.innerHTML = `
                <div class="config-section-title"><span>⚙️</span> System Configuration</div>
                <div class="main-config-display config-items"></div>
            `;
            this.dom.mainConfigSection = mainConfigSection;
            this.dom.mainConfigDisplay = mainConfigSection.querySelector('.main-config-display');
            scrollWrapper.appendChild(mainConfigSection);

            return scrollWrapper;
        },

        createCommandsElement: function() {
            const commandsWrapper = document.createElement('div');
            commandsWrapper.className = 'commands-wrapper';
            this.dom.commandsWrapper = commandsWrapper;

            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'command-tabs';
            ['System', 'Delay', 'API'].forEach((category, index) => {
                const catLower = category.toLowerCase();
                const tabIcon = catLower === 'system' ? '⚙️' : (catLower === 'delay' ? '⏱️' : '🔑');
                const tabButton = document.createElement('button');
                tabButton.className = `tab-button ${index === 0 ? 'active' : ''}`;
                tabButton.setAttribute('data-category', catLower);
                tabButton.innerHTML = `<span class="tab-icon">${tabIcon}</span> <span class="tab-text">${category}</span>`;
                tabButton.addEventListener('click', () => this.switchCommandTab(catLower));
                tabsContainer.appendChild(tabButton);
            });
            commandsWrapper.appendChild(tabsContainer);

            const commandsContainer = document.createElement('div');
            commandsContainer.className = 'commands-container';
            this.dom.commandsContainer = commandsContainer;

            // System Commands
            const systemCommands = document.createElement('div');
            systemCommands.className = 'command-panel active';
            systemCommands.setAttribute('data-category', 'system');
            this.buildCommandButtons(systemCommands, this.state.commandCategories.system);
            this.dom.systemCommands = systemCommands;
            commandsContainer.appendChild(systemCommands);

            // Delay Commands
            const delayCommands = document.createElement('div');
            delayCommands.className = 'command-panel';
            delayCommands.setAttribute('data-category', 'delay');
            this.buildCommandButtons(delayCommands, this.state.commandCategories.delay);
            this.dom.delayCommands = delayCommands;
            commandsContainer.appendChild(delayCommands);

            // API Config Panel (populated later)
            const apiConfigPanel = document.createElement('div');
            apiConfigPanel.className = 'command-panel config-panel';
            apiConfigPanel.setAttribute('data-category', 'api');
            this.dom.apiConfigPanel = apiConfigPanel;
            commandsContainer.appendChild(apiConfigPanel);

            commandsWrapper.appendChild(commandsContainer);
            return commandsWrapper;
        },

        updateApiConfigTabContent: function() {
            if (!this.dom.apiConfigPanel) return;
            this.dom.apiConfigPanel.innerHTML = ''; // Clear

            const config = this.state.config;
            if (!config || typeof config !== 'object') {
                this.dom.apiConfigPanel.innerHTML = '<div class="config-item config-error"><span>API Config Error</span></div>';
                return;
            }

            const apiConfigContainer = document.createElement('div');
            apiConfigContainer.className = 'api-config-container'; // Use specific class if needed

            const provider = config.active_provider || 'N/A';
            apiConfigContainer.appendChild(this.createConfigDisplayItem('API Provider', provider));

            const modelName = config.providers?.[provider]?.model_name || 'N/A';
            apiConfigContainer.appendChild(this.createConfigDisplayItem('Model', modelName));

            if (config.providers && config.providers[provider]) {
                const apiConfig = config.providers[provider];
                if (apiConfig.api_base) {
                    apiConfigContainer.appendChild(this.createConfigDisplayItem('API Base', this.truncateUrl(apiConfig.api_base)));
                }
                if (apiConfig.has_api_key !== undefined) {
                    apiConfigContainer.appendChild(this.createConfigDisplayItem('Has API Key', apiConfig.has_api_key));
                }
                Object.keys(apiConfig).forEach(key => {
                    if (['model_name', 'api_base', 'has_api_key'].includes(key)) return;
                    const value = apiConfig[key];
                    if (value === null || value === undefined) return;
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let displayValue = value;
                    if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
                    else if (Array.isArray(value)) displayValue = `[${value.length} items]`;
                    else if (typeof value === 'object' && value !== null) displayValue = `{${Object.keys(value).length} props}`;
                    apiConfigContainer.appendChild(this.createConfigDisplayItem(formattedKey, displayValue));
                });
            }

            if (apiConfigContainer.childElementCount <= 2) { // Only provider and model were added
                const noDetails = document.createElement('div');
                noDetails.className = 'config-item config-info';
                noDetails.innerHTML = '<span>No additional provider details found.</span>';
                apiConfigContainer.appendChild(noDetails);
            }

            this.dom.apiConfigPanel.appendChild(apiConfigContainer);
        },

        createConfigDisplayItem: function(label, value) {
            const item = document.createElement('div');
            // Use unique class for items within the API tab if needed, otherwise reuse config-item
            item.className = 'config-item api-config-display-item'; // Re-using config-item structure
            let displayValue = String(value);
            let valueClass = '';

            if (typeof value === 'boolean') {
                displayValue = value ? 'Enabled' : 'Disabled';
                valueClass = value ? 'value-true' : 'value-false';
            } else if (value === null || value === undefined || value === 'N/A') {
                displayValue = 'N/A';
                valueClass = 'value-na';
            } else if (displayValue.startsWith('[') && displayValue.endsWith(']')) {
                valueClass = 'value-object'; // Array indication
            } else if (displayValue.startsWith('{') && displayValue.endsWith('}')) {
                valueClass = 'value-object'; // Object indication
            }

            const maxLength = 35;
            if (displayValue.length > maxLength) {
                displayValue = displayValue.substring(0, maxLength) + '...';
            }

            item.innerHTML = `
                <div class="config-label" title="${label}">${label}</div>
                <div class="config-value ${valueClass}" title="${String(value)}">${displayValue}</div>
            `;
            return item;
        },


        // --- Data Fetching & Updates ---

        startConfigPolling: function() {
            this.stopConfigPolling();
            const pollInterval = CONFIG.refreshIntervals.configPolling || 10000;
            this.state.configPollingInterval = setInterval(() => {
                if (this.state.autoRefresh && Framework.isPanelVisible(this.id)) { // Only poll if visible and enabled
                    this.fetchConfig();
                    this.fetchMainConfig();
                    this.fetchApiStatus();
                }
            }, pollInterval);
            console.log(`[${this.id}] Started config polling interval (${pollInterval}ms). Auto-refresh: ${this.state.autoRefresh}`);
        },

        stopConfigPolling: function() {
            if (this.state.configPollingInterval) {
                clearInterval(this.state.configPollingInterval);
                this.state.configPollingInterval = null;
                console.log(`[${this.id}] Stopped config polling.`);
            }
        },

        toggleAutoRefresh: function(enabled) {
            this.state.autoRefresh = enabled;
            const toggleInput = this.dom.autoRefreshToggle.querySelector('input');
            if (toggleInput) toggleInput.checked = enabled; // Sync checkbox state

            console.log(`[${this.id}] Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
            if (enabled) {
                this.fetchInitialData(); // Fetch immediately when turned on
                Framework.showToast('Auto-refresh enabled');
                this.startConfigPolling(); // Ensure polling is running
            } else {
                Framework.showToast('Auto-refresh disabled');
                // Polling interval itself will check this flag, no need to stop explicitly unless desired
            }
        },

        fetchConfig: function() { // api_config.json
             fetch(CONFIG.api.apiConfig, { cache: "no-store" })
                .then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response.status}`))
                .then(data => {
                    if (data?.api && typeof data.api === 'object') {
                        this.state.config = data.api;
                    } else { throw new Error("Invalid API config format"); }
                     this.updateConfigDisplay();
                     this.updateApiConfigTabContent();
                })
                .catch(error => {
                    console.warn('[API Config] Fetch Error:', error.message || error);
                    this.state.config = { active_provider: "Error", providers: {} };
                     this.updateConfigDisplay();
                     this.updateApiConfigTabContent();
                });
        },

        fetchMainConfig: async function() { // config.json
            try {
                const response = await Framework.loadResource(CONFIG.api.mainConfig);
                this.state.mainConfigData = (response?.success && response.config) ? response.config : { error: response?.error || 'Load failed' };
            } catch (error) {
                this.state.mainConfigData = { error: `Fetch error: ${error.message}` };
            }
            this.updateMainConfigDisplay();
        },

        fetchApiStatus: function() { // /health
            fetch('/health', { cache: "no-store" })
                .then(response => {
                    if (!response.ok && response.status !== 503) throw new Error(`HTTP ${response.status}`);
                     return response.json().catch(() => ({ status: response.status === 503 ? "unavailable" : "parse_error", action_system: { status: "unknown" } }));
                })
                .then(data => {
                    this.state.apiStatus = data;
                    this.updateApiStatusDisplay();
                })
                .catch(error => {
                    console.warn('[API Status] Fetch Error:', error.message);
                    this.state.apiStatus = { status: "fetch_error", action_system: { status: "unknown" } };
                    this.updateApiStatusDisplay();
                });
        },

        updateApiStatusDisplay: function() {
            if (!this.dom.apiStatusContainer || !this.state.apiStatus) return;
             const statusData = this.state.apiStatus;
             const overallStatus = statusData.status || 'unknown';
             const actionSystemStatus = statusData.action_system?.status || 'unknown';
             const flaskStatus = statusData.flask_app || 'unknown';

             let displayStatus = 'Unknown';
             let statusClass = 'status-unknown';
             let titleText = `Flask: ${flaskStatus}, Action System: ${actionSystemStatus}, Overall: ${overallStatus}`;

             if (overallStatus === 'ok' && actionSystemStatus === 'running' && flaskStatus === 'running') {
                 statusClass = 'status-good'; displayStatus = 'System OK';
             } else if (overallStatus === 'error' || actionSystemStatus === 'not running') {
                 statusClass = 'status-error'; displayStatus = 'Error';
             } else if (overallStatus === 'unavailable' || actionSystemStatus === 'checking...') {
                 statusClass = 'status-warning'; displayStatus = 'Checking';
             } else if (overallStatus === 'ok' && (actionSystemStatus !== 'running' || flaskStatus !== 'running')) {
                 statusClass = 'status-warning'; displayStatus = 'Partial';
             } else if (['parse_error', 'fetch_error', 'invalid_data'].includes(overallStatus)) {
                 statusClass = 'status-error'; displayStatus = 'Comms Error';
             }

            this.dom.apiStatusContainer.innerHTML = `
                <div class="api-status-badge ${statusClass}" title="${titleText}">
                    <span class="status-text">${displayStatus}</span>
                </div>
            `;
        },

        updateConfigDisplay: function() { // API Config (api_config.json) section
            if (!this.dom.configDisplay) return;
            const config = this.state.config;
             this.dom.configDisplay.innerHTML = '';

            if (!config || typeof config !== 'object') {
                 this.dom.configDisplay.innerHTML = '<div class="config-item config-error"><span>API Config Error</span></div>';
                 return;
             }

             const provider = config.active_provider || 'N/A';
             const modelName = config.providers?.[provider]?.model_name || 'N/A';

             this.dom.configDisplay.appendChild(this.createConfigItemElement('API Provider', provider));
             this.dom.configDisplay.appendChild(this.createConfigItemElement('Model', modelName));

             if (!this.state.compactMode && config.providers && config.providers[provider]) {
                 const apiConfig = config.providers[provider];
                 if (apiConfig.api_base) {
                     this.dom.configDisplay.appendChild(this.createConfigItemElement('API Base', this.truncateUrl(apiConfig.api_base)));
                 }
                 if (apiConfig.has_api_key !== undefined) {
                     this.dom.configDisplay.appendChild(this.createConfigItemElement('Has API Key', apiConfig.has_api_key));
                 }
             }
        },

        truncateUrl: function(url) {
            if (!url || typeof url !== 'string') return 'N/A';
            try {
                const urlObj = new URL(url);
                // Maybe return more than just hostname if useful, e.g., hostname + first path part
                return urlObj.hostname + (urlObj.pathname.length > 1 ? '/...' : '');
            } catch (e) {
                return url.length > 30 ? url.substring(0, 27) + '...' : url;
            }
        },

        updateMainConfigDisplay: function() { // System Config (config.json) section
            if (!this.dom.mainConfigDisplay) return;
            const configData = this.state.mainConfigData;
             this.dom.mainConfigDisplay.innerHTML = '';

             if (!configData) {
                this.dom.mainConfigDisplay.innerHTML = '<div class="config-item config-loading"><span>Loading...</span></div>'; return;
             }
            if (configData.error) {
                 this.dom.mainConfigDisplay.innerHTML = `<div class="config-item config-error"><span>Error: ${configData.error}</span></div>`; return;
            }
            if (Object.keys(configData).length === 0) {
                this.dom.mainConfigDisplay.innerHTML = '<div class="config-item config-empty"><span>No system config data.</span></div>'; return;
            }

            const getPriorityOrder = (key) => ({ 'version': 1, 'name': 2, 'active_actions': 3, 'api_provider': 4, 'model': 5 }[key] || 99);
            const keys = Object.keys(configData).sort((a, b) => getPriorityOrder(a) - getPriorityOrder(b));
            const displayKeys = this.state.compactMode ? keys.slice(0, 4) : keys;

            displayKeys.forEach(key => {
                if (Object.hasOwnProperty.call(configData, key)) {
                    this.dom.mainConfigDisplay.appendChild(this.createConfigItemElement(key, configData[key], true));
                }
            });

            if (this.state.compactMode && keys.length > displayKeys.length) {
                const moreCount = keys.length - displayKeys.length;
                const moreItem = document.createElement('div');
                moreItem.className = 'config-item config-more-info';
                moreItem.innerHTML = `<span>+ ${moreCount} more items</span>`;
                this.dom.mainConfigDisplay.appendChild(moreItem);
            }
        },

        createConfigItemElement: function(key, value, isMainConfig = false) {
             const item = document.createElement('div');
             item.className = `config-item ${isMainConfig ? 'main-config-item' : 'api-config-item'}`;
             let displayValue;
             let valueClass = '';

             if (typeof value === 'boolean') {
                 displayValue = value ? 'Enabled' : 'Disabled'; valueClass = value ? 'value-true' : 'value-false';
             } else if (value === null || value === undefined) {
                 displayValue = 'N/A'; valueClass = 'value-na';
             } else if (Array.isArray(value)) {
                 displayValue = `[${value.length} items]`; valueClass = 'value-object';
             } else if (typeof value === 'object') {
                 displayValue = `{${Object.keys(value).length} props}`; valueClass = 'value-object';
             } else {
                 displayValue = String(value);
             }

             const maxLength = this.state.compactMode ? 20 : 35;
             if (displayValue.length > maxLength) {
                 displayValue = displayValue.substring(0, maxLength) + '...';
             }
             const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

             item.innerHTML = `
                <div class="config-label" title="${formattedKey}">${formattedKey}</div>
                <div class="config-value ${valueClass}" title="${String(value)}">${displayValue}</div>
            `;
             return item;
        },

        // --- Command Handling ---

        buildCommandButtons: function(container, commands) {
            commands.forEach(cmd => {
                const button = document.createElement('button');
                button.className = `command-button ${cmd.specialClass || ''}`;
                button.setAttribute('data-command', cmd.command);
                button.setAttribute('title', cmd.description || cmd.command);
                button.innerHTML = `<span class="cmd-icon">${cmd.icon}</span><span class="cmd-label">${cmd.label}</span>`;

                if (cmd.isSpecial && cmd.handler && typeof this[cmd.handler] === 'function') {
                    button.addEventListener('click', this[cmd.handler].bind(this));
                    if (cmd.command === 'restart') this.dom.restartButton = button; // Keep track of the trigger button
                } else {
                    button.addEventListener('click', () => this.executeCommand(cmd.command));
                }
                container.appendChild(button);
            });
        },

        switchCommandTab: function(category) {
            if (this.state.activeCommandTab === category) return;
            this.state.activeCommandTab = category;
            const contentEl = this.dom.content;
            if (!contentEl) return;
            contentEl.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-category') === category));
            contentEl.querySelectorAll('.command-panel').forEach(panel => panel.classList.toggle('active', panel.getAttribute('data-category') === category));
        },

        executeCommand: function(command) {
             if (!command || typeof command !== 'string') return;
            console.log(`[${this.id}] Executing command: ${command}`);
            const userInput = document.getElementById('userInput');
            if (!userInput) { Framework.showToast('Error: Cannot find input field.', 3000); return; }
            userInput.value = command;
            userInput.focus();
            userInput.dispatchEvent(new Event('input')); // Trigger potential handlers
            Framework.showToast(`Running: ${command}`, 1500);
            if (typeof Framework.sendMessage === 'function') {
                Framework.sendMessage();
            } else {
                 console.warn(`[${this.id}] Framework.sendMessage not found.`);
                 Framework.showToast('Error: Cannot send message.', 3000);
            }
        },

        // --- Restart Dialog Logic ---

        createRestartDialog: function() {
            // Remove existing dialog/backdrop if they exist
            document.getElementById('bp3-restart-system-dialog')?.remove();
            document.getElementById('bp3-restart-dialog-backdrop')?.remove();

            // --- INTENTIONAL UNIQUE NAMING ---
            // The IDs and Classes used below (e.g., 'bp3-dialog-*') are intentionally
            // specific to this Bottom Panel 3 component's restart dialog. This is done
            // to prevent CSS or JavaScript conflicts with other parts of the application
            // that might use generic names like 'cancel-button' or 'confirm-button'.
            // Please maintain this specificity if modifying this section.
            // --- END INTENTIONAL UNIQUE NAMING ---

            const dialog = document.createElement('div');
            dialog.id = 'bp3-restart-system-dialog'; // Unique ID
            dialog.className = 'bp3-system-dialog'; // Unique Class
            dialog.style.display = 'none';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'bp3-dialog-title');

            dialog.innerHTML = `
                <div class="bp3-dialog-content">
                    <div class="bp3-dialog-header">
                        <h3 id="bp3-dialog-title" class="bp3-dialog-title">Restart System</h3>
                        <button id="bp3-dialog-header-close-btn" class="bp3-dialog-header-close-button" aria-label="Close">×</button>
                    </div>
                    <div class="bp3-dialog-body">
                        <p>Restart the AI action system. Active actions will attempt to stop gracefully.</p>
                        <div class="bp3-provider-section">
                            <label for="bp3-restart-provider-select" class="bp3-provider-label">Restart with provider:</label>
                            <select id="bp3-restart-provider-select" class="bp3-provider-select">
                                <option value="">Current (no change)</option>
                                <option value="gemini">Gemini</option>
                                <option value="openai">OpenAI</option>
                                <!-- Add more providers dynamically if needed -->
                            </select>
                        </div>
                        <div class="bp3-dialog-status-section" style="display: none;">
                            <div class="bp3-dialog-status-message"><span class="bp3-dialog-status-spinner"></span> Restarting...</div>
                            <div class="bp3-dialog-status-detail">Please wait...</div>
                        </div>
                        <div class="bp3-dialog-buttons-section">
                            <!-- Buttons will be added dynamically by showRestartDialog -->
                        </div>
                    </div>
                </div>
            `;

            const backdrop = document.createElement('div');
            backdrop.id = 'bp3-restart-dialog-backdrop'; // Unique ID
            backdrop.className = 'bp3-dialog-backdrop'; // Unique Class
            backdrop.style.display = 'none';

            document.body.appendChild(backdrop);
            document.body.appendChild(dialog);

            // Store references using unique selectors
            this.dom.restartDialog = dialog;
            this.dom.restartDialogBackdrop = backdrop;
            this.dom.restartStatusSection = dialog.querySelector('.bp3-dialog-status-section');
            this.dom.restartStatusMessage = dialog.querySelector('.bp3-dialog-status-message');
            this.dom.restartStatusDetail = dialog.querySelector('.bp3-dialog-status-detail');
            this.dom.restartButtonsSection = dialog.querySelector('.bp3-dialog-buttons-section'); // Reference the container

            // Add event listeners using unique IDs/Classes
            dialog.querySelector('#bp3-dialog-header-close-btn').addEventListener('click', () => this.hideRestartDialog());
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop && !this.state.isRestarting) {
                    this.hideRestartDialog();
                }
            });
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !this.state.isRestarting) {
                    this.hideRestartDialog();
                }
            });

            console.log(`[${this.id}] Restart dialog created with unique identifiers.`);
            return dialog;
        },

        showRestartDialog: function() {
            if (!this.dom.restartDialog) this.createRestartDialog();

            // Ensure elements are present before manipulating
            if (!this.dom.restartStatusSection || !this.dom.restartButtonsSection || !this.dom.restartDialog) {
                 console.error(`[${this.id}] Cannot show restart dialog, essential elements missing.`);
                 Framework.showToast("Error displaying restart dialog.", 3000);
                 return;
            }

            this.dom.restartStatusSection.style.display = 'none'; // Hide status section initially
            this.dom.restartButtonsSection.style.display = 'flex'; // Show button section

            // Clear previous buttons and add new ones with unique IDs/Classes
            this.dom.restartButtonsSection.innerHTML = '';

            const cancelButton = document.createElement('button');
            cancelButton.id = 'bp3-dialog-initial-cancel-btn'; // Unique ID
            cancelButton.className = 'bp3-dialog-button bp3-dialog-cancel-button'; // Unique Classes
            cancelButton.textContent = 'Cancel';
            cancelButton.addEventListener('click', () => this.hideRestartDialog());

            const confirmButton = document.createElement('button');
            confirmButton.id = 'bp3-dialog-initial-confirm-btn'; // Unique ID
            confirmButton.className = 'bp3-dialog-button bp3-dialog-confirm-button'; // Unique Classes
            confirmButton.textContent = 'Restart Now';
            confirmButton.addEventListener('click', () => {
                const selectElement = document.getElementById('bp3-restart-provider-select');
                this.performRestart(selectElement ? selectElement.value : '');
            });

            this.dom.restartButtonsSection.appendChild(cancelButton);
            this.dom.restartButtonsSection.appendChild(confirmButton);

            this.dom.restartDialog.style.display = 'block';
            this.dom.restartDialogBackdrop.style.display = 'block';
            confirmButton.focus(); // Focus the confirmation button
            document.body.classList.add('bp3-dialog-open'); // Use prefixed class for body lock
        },

        hideRestartDialog: function() {
            if (!this.dom.restartDialog || this.state.isRestarting) return; // Don't hide if restarting
            this.dom.restartDialog.style.display = 'none';
            this.dom.restartDialogBackdrop.style.display = 'none';
            document.body.classList.remove('bp3-dialog-open'); // Remove prefixed class
            // Try to focus back the original trigger button if it exists
            if (this.dom.restartButton) this.dom.restartButton.focus();
        },

        handleRestartClick: function() {
            this.showRestartDialog();
        },

        performRestart: async function(provider = '') {
             if (!this.dom.restartButtonsSection || !this.dom.restartStatusSection) {
                 console.error("Restart dialog elements missing, cannot proceed.");
                 Framework.showToast("Error initiating restart.", 3000);
                 return;
             }
            this.state.isRestarting = true;
            this.dom.restartButtonsSection.style.display = 'none'; // Hide buttons
            this.dom.restartStatusSection.style.display = 'block'; // Show status
            if (this.dom.restartStatusMessage) this.dom.restartStatusMessage.innerHTML = '<span class="bp3-dialog-status-spinner"></span> Restarting...';
            if (this.dom.restartStatusDetail) this.dom.restartStatusDetail.textContent = 'Please wait...';

            // Update the trigger button state
            if (this.dom.restartButton) {
                this.dom.restartButton.classList.add('restarting');
                this.dom.restartButton.disabled = true;
                const label = this.dom.restartButton.querySelector('.cmd-label');
                if (label) label.textContent = 'Restarting...';
            }
            Framework.showToast('System restart initiated...');
            let url = `/restart_action${provider ? `?provider=${provider}` : ''}`;
            try {
                const response = await fetch(url, { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Cache-Control': 'no-cache' }});
                const data = await response.json().catch(() => ({ success: false, message: `Invalid response from server (Status: ${response.status})`})); // Gracefully handle non-JSON
                if (!response.ok || !data.success) {
                     throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
                 }
                // Success from API just means request received, now poll for actual status
                await new Promise(r => setTimeout(r, 1500)); // Short delay before polling
                this.pollRestartStatus();
            } catch (error) {
                this.handleRestartFailure(`Request Error: ${error.message}`);
            }
        },

        pollRestartStatus: function() {
             if (this.state.pollTimerId) clearTimeout(this.state.pollTimerId);
            const interval = 1500, maxAttempts = 40;
            let attempts = 0;

            const check = async () => {
                if (!this.state.isRestarting) { // Stop polling if restart was aborted or finished elsewhere
                     clearTimeout(this.state.pollTimerId); this.state.pollTimerId = null; return;
                 }
                if (attempts >= maxAttempts) {
                     this.handleRestartFailure('Timeout waiting for system to restart');
                     clearTimeout(this.state.pollTimerId); this.state.pollTimerId = null; return;
                 }
                attempts++;
                try {
                     const resp = await fetch('/health', { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Cache-Control': 'no-cache' }});
                     if (!resp.ok && resp.status !== 503) throw new Error(`Health check failed: HTTP ${resp.status}`);
                    const data = await resp.json().catch(()=>({ action_system:{ status: resp.status === 503 ? "restarting" : "error" } }));

                    if (data.action_system?.status === 'running') {
                        this.handleRestartSuccess(); // System is back online
                        return;
                    } else {
                         // Still restarting or checking
                         if(this.dom.restartStatusDetail) {
                            this.dom.restartStatusDetail.textContent = `System initializing... (${attempts}/${maxAttempts})`;
                        }
                        this.state.pollTimerId = setTimeout(check, interval); // Poll again
                    }
                } catch (error) {
                     // Network error or failed health check
                     if(this.dom.restartStatusDetail) {
                         this.dom.restartStatusDetail.textContent = `Connection issue... Retrying (${attempts}/${maxAttempts})`;
                     }
                     this.state.pollTimerId = setTimeout(check, interval); // Poll again despite error
                 }
            };

            if(this.dom.restartStatusDetail) {
                this.dom.restartStatusDetail.textContent = 'Waiting for restart confirmation...';
            }
            this.state.pollTimerId = setTimeout(check, interval); // Start the polling loop
        },

        handleRestartSuccess: function() {
             this.state.isRestarting = false;
             clearTimeout(this.state.pollTimerId); this.state.pollTimerId = null;

             // Update Dialog (if it still exists)
             if (this.dom.restartDialog && this.dom.restartDialog.isConnected) {
                 if (this.dom.restartStatusMessage) this.dom.restartStatusMessage.innerHTML = '<span class="bp3-dialog-status-success">✅</span> Restart Complete';
                 if (this.dom.restartStatusDetail) this.dom.restartStatusDetail.textContent = 'System restarted successfully.';
                 if (this.dom.restartButtonsSection) {
                     this.dom.restartButtonsSection.innerHTML = ''; // Clear old buttons
                     const closeButton = document.createElement('button');
                     closeButton.id = 'bp3-dialog-success-close-btn'; // Unique ID
                     closeButton.className = 'bp3-dialog-button bp3-dialog-close-button'; // Unique Classes
                     closeButton.textContent = 'Close';
                     closeButton.addEventListener('click', () => this.hideRestartDialog());
                     this.dom.restartButtonsSection.appendChild(closeButton);
                     this.dom.restartButtonsSection.style.display = 'flex';
                     closeButton.focus();
                 }
                 // Auto-close dialog after a short delay
                 setTimeout(() => {
                    // Check if still in success state and dialog is visible before closing
                    if (!this.state.isRestarting && this.dom.restartDialog?.style.display !== 'none') {
                         this.hideRestartDialog();
                    }
                 }, 4000);
             }

             // Update Trigger Button (if it still exists)
             if (this.dom.restartButton && this.dom.restartButton.isConnected) {
                 this.dom.restartButton.classList.remove('restarting');
                 this.dom.restartButton.classList.add('restart-success');
                 this.dom.restartButton.disabled = false;
                 const label = this.dom.restartButton.querySelector('.cmd-label');
                 if(label) label.textContent = 'Restart System';
                 setTimeout(() => { this.dom.restartButton?.classList.remove('restart-success'); }, 5000);
             }

             Framework.showToast('System restart successful!', 3000);
             setTimeout(() => { this.fetchInitialData(); }, 1000); // Refresh panel data
        },

        handleRestartFailure: function(errorMessage) {
             this.state.isRestarting = false;
             clearTimeout(this.state.pollTimerId); this.state.pollTimerId = null;

             // Update Dialog (if it still exists)
             if (this.dom.restartDialog && this.dom.restartDialog.isConnected) {
                 if (this.dom.restartStatusMessage) this.dom.restartStatusMessage.innerHTML = '<span class="bp3-dialog-status-error">❌</span> Restart Failed';
                 if (this.dom.restartStatusDetail) this.dom.restartStatusDetail.textContent = errorMessage || 'An unknown error occurred.';
                 if (this.dom.restartButtonsSection) {
                     this.dom.restartButtonsSection.innerHTML = ''; // Clear old buttons
                     const tryAgainButton = document.createElement('button');
                     tryAgainButton.id = 'bp3-dialog-failure-try-again-btn'; // Unique ID
                     tryAgainButton.className = 'bp3-dialog-button bp3-dialog-try-again-button'; // Unique Classes
                     tryAgainButton.textContent = 'Try Again';
                     tryAgainButton.addEventListener('click', () => this.showRestartDialog()); // Re-show initial dialog

                     const closeButton = document.createElement('button');
                     closeButton.id = 'bp3-dialog-failure-close-btn'; // Unique ID
                     closeButton.className = 'bp3-dialog-button bp3-dialog-close-button'; // Unique Classes
                     closeButton.textContent = 'Close';
                     closeButton.addEventListener('click', () => this.hideRestartDialog());

                     this.dom.restartButtonsSection.appendChild(tryAgainButton);
                     this.dom.restartButtonsSection.appendChild(closeButton);
                     this.dom.restartButtonsSection.style.display = 'flex';
                     closeButton.focus();
                 }
             }

             // Update Trigger Button (if it still exists)
             if (this.dom.restartButton && this.dom.restartButton.isConnected) {
                 this.dom.restartButton.classList.remove('restarting');
                 this.dom.restartButton.classList.add('restart-error');
                 this.dom.restartButton.disabled = false;
                 const label = this.dom.restartButton.querySelector('.cmd-label');
                 if(label) label.textContent = 'Restart Failed';
                 setTimeout(() => {
                     if (this.dom.restartButton) {
                         this.dom.restartButton.classList.remove('restart-error');
                         if(label) label.textContent = 'Restart System';
                     }
                 }, 5000);
             }

             Framework.showToast(`Restart failed: ${errorMessage}`, 5000);
             // Optionally refresh data even on failure
             // setTimeout(() => { this.fetchApiStatus(); }, 1000);
        },

        // --- Styling & Cleanup ---

        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* === Enhanced Bottom Panel 3 Styles (v5.6.0) === */
                .control-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background-color: var(--color-background-secondary, #f8f9fa); font-size: 14px; }

                /* Header */
                .panel-header-info { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: #e9ecef; border-bottom: 1px solid #dee2e6; gap: 8px; }
                .panel-header-info.compact-header { padding: 6px 8px; }
                .panel-title { margin: 0; font-size: 14px; font-weight: 600; color: #343a40; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
                .compact-header .panel-title { font-size: 13px; }
                .panel-icon { font-size: 16px; }
                .compact-header .panel-icon { font-size: 14px; }

                /* Auto-refresh toggle */
                .auto-refresh-toggle { display: flex; align-items: center; margin-left: auto; /* Push toggle right before status */ }
                .toggle-input { display: none; }
                .toggle-label { display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; width: 25px; height: 25px; font-size: 14px; background-color: #e0e0e0; color: #666; transition: all 0.2s; }
                .toggle-label:hover { background-color: #d0d0d0; }
                .toggle-input:checked + .toggle-label { background-color: var(--color-primary); color: white; }
                .compact-header .toggle-label { width: 22px; height: 22px; font-size: 12px; }

                /* Status badge */
                .api-status-container { flex-shrink: 0; } /* Prevent status from shrinking */
                .api-status-badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
                .compact-header .api-status-badge { padding: 2px 6px; font-size: 10px; }
                .api-status-badge .status-text { line-height: 1; }
                .api-status-badge.status-good { background-color: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
                .api-status-badge.status-error { background-color: #ffebee; color: #c62828; border-color: #ef9a9a; }
                .api-status-badge.status-unknown { background-color: #f5f5f5; color: #757575; border-color: #e0e0e0; }
                .api-status-badge.status-warning { background-color: #fff8e1; color: #ff8f00; border-color: #ffecb3; }

                /* Scrollable Content Area */
                .scrollable-content { flex: 1; overflow-y: auto; padding: 8px 0; background-color: #fff; }

                /* Config Sections */
                .config-section { padding: 8px 12px 12px 12px; border-bottom: 1px solid #e9ecef; }
                .api-config-section { background-color: #ffffff; }
                .main-config-section { background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-bottom: none; }
                .config-section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: bold; color: #495057; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px dashed #ddd; padding-bottom: 4px;}
                .config-section-title span { font-size: 14px; line-height: 1; }
                .config-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
                .config-item { background-color: #fff; border: 1px solid #eee; border-radius: 4px; padding: 6px 10px; font-size: 12px; line-height: 1.3; min-height: 45px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; /* Prevent content overflow */ }
                .main-config-item { background-color: #fdfdff; }
                .api-config-display-item { background-color: #f8f9fa; border: 1px solid #e9ecef; } /* Slightly different bg for API tab items */
                .config-label { font-size: 10px; color: #6c757d; margin-bottom: 2px; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
                .config-value { font-weight: 600; color: #343a40; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .config-item span { font-style: italic; color: #6c757d; display: block; text-align: center; width: 100%; padding: 5px;} /* For loading/error/empty states */
                .config-item.config-error span, .config-item.config-empty span, .config-item.config-loading span, .config-item.config-info span { font-style: normal; font-weight: normal;}
                .config-item.config-error span { color: #c62828; font-weight: bold; }
                .config-more-info { font-style: italic; color: #6c757d; text-align: center; background-color: #f8f9fa; justify-content: center; align-items: center; }
                .value-true { color: #28a745; } .value-false { color: #dc3545; } .value-na { color: #adb5bd; } .value-object { font-style: italic; }

                /* Commands Section Wrapper */
                .commands-wrapper { flex-shrink: 0; border-top: 1px solid #dee2e6; background-color: #f8f9fa; }

                /* Command Tabs & Panels */
                .command-tabs { display: flex; background-color: #f1f3f5; }
                .tab-button { flex: 1; padding: 9px 5px; background: none; border: none; border-bottom: 3px solid transparent; outline: none; font-size: 13px; font-weight: 500; color: #495057; cursor: pointer; transition: background-color 0.2s, border-color 0.2s, color 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px; text-align: center; }
                .tab-button:hover { background-color: #e9ecef; }
                .tab-button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); background-color: #fff; }
                .tab-icon { font-size: 14px; line-height: 1; }
                @media (max-width: 350px) { .tab-text { display: none; } .tab-button { padding: 8px 3px; } }

                .commands-container { position: relative; min-height: 75px; background-color: #fff;}
                .command-panel { position: absolute; inset: 0; display: none; padding: 10px; overflow-y: auto; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; align-content: flex-start; }
                .command-panel.active { display: grid; }

                /* API Config Tab Specific Content Styling */
                .command-panel.config-panel { display: none; /* Overridden by .active */ overflow-y: auto; padding: 12px; }
                .command-panel.config-panel.active { display: block; /* Make it visible */ } /* Ensure display: block overrides display: grid */
                .api-config-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                /* .api-config-display-item styles are merged with .config-item above */

                /* Command Buttons */
                .command-button { display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #fff; border: 1px solid #d1d9e0; border-radius: 6px; padding: 8px 5px; transition: all 0.15s ease-in-out; cursor: pointer; text-align: center; box-shadow: 0 1px 1px rgba(0,0,0,0.05); min-height: 60px; }
                .command-button:hover { transform: translateY(-2px); box-shadow: 0 3px 5px rgba(0,0,0,0.08); border-color: var(--color-primary); background-color: #fcfdff; }
                .cmd-icon { font-size: 18px; margin-bottom: 5px; line-height: 1; }
                .cmd-label { font-size: 11px; line-height: 1.2; color: #343a40; font-weight: 500; word-break: break-word; max-height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
                .command-button.restart-button { grid-column: span 2; background-color: #e3f2fd; border-color: #90caf9; font-weight: bold; }
                .command-button.restart-button:hover:not(:disabled) { background-color: #d0eafd; }
                .command-button.restarting { background-color: #fff8e1 !important; border-color: #ffe082 !important; pointer-events: none; animation: bp3-pulse 1.5s infinite ease-in-out; cursor: wait; }
                .command-button.restart-success { background-color: #e8f5e9 !important; border-color: #81c784 !important; }
                .command-button.restart-error { background-color: #ffebee !important; border-color: #ef9a9a !important; }
                @keyframes bp3-pulse { 0%, 100% { box-shadow: 0 1px 1px rgba(0,0,0,0.05); } 50% { box-shadow: 0 3px 5px rgba(255, 248, 225, 0.5); } } /* Pulse uses dialog bg color */

                @media (max-width: 350px) {
                    .command-button { min-height: 50px; padding: 5px 3px; }
                    .cmd-icon { font-size: 16px; margin-bottom: 3px; }
                    .cmd-label { font-size: 10px; max-height: 2.2em; }
                    .command-button.restart-button { grid-column: span 1; }
                }

                /* === START: Unique Restart Dialog Styles (bp3- prefix is intentional) === */
                /* Using prefixed classes to prevent conflicts with global styles */
                .bp3-dialog-backdrop { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.55); z-index: 1050; } /* Higher z-index */
                .bp3-system-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: clamp(280px, 90%, 480px); z-index: 1051; border-radius: 6px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); background-color: white; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; }
                .bp3-dialog-content { display: flex; flex-direction: column; overflow: hidden; } /* Container for header/body */
                .bp3-dialog-header { background-color: var(--color-primary); color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
                .bp3-dialog-title { margin: 0; font-size: 16px; font-weight: 600; }
                .bp3-dialog-header-close-button { background: none; border: none; color: rgba(255,255,255,0.8); font-size: 24px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color 0.2s; }
                .bp3-dialog-header-close-button:hover { color: white; }
                .bp3-dialog-body { padding: 16px 20px; overflow-y: auto; flex-grow: 1; } /* Allow body to scroll */
                .bp3-dialog-body p { margin: 0 0 16px 0; line-height: 1.5; color: #495057;}
                .bp3-provider-section { margin: 16px 0; }
                .bp3-provider-label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: #343a40; }
                .bp3-provider-select { width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; background-color: white; appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right .75rem center; background-size: 16px 12px; }
                .bp3-dialog-status-section { margin-top: 20px; padding: 12px 16px; border-radius: 4px; background-color: #f1f3f5; border: 1px solid #e9ecef; text-align: center; }
                .bp3-dialog-status-message { font-weight: 600; font-size: 15px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: #343a40; }
                .bp3-dialog-status-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #dee2e6; border-top-color: var(--color-primary); border-radius: 50%; margin-right: 8px; animation: bp3-spin 1s linear infinite; }
                .bp3-dialog-status-success { color: #28a745; font-size: 1.1em; margin-right: 8px; }
                .bp3-dialog-status-error { color: #dc3545; font-size: 1.1em; margin-right: 8px; }
                .bp3-dialog-status-detail { font-size: 13px; color: #6c757d; line-height: 1.4; }
                .bp3-dialog-buttons-section { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e9ecef; flex-shrink: 0; }
                .bp3-dialog-button { padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s ease; border: 1px solid transparent; }
                .bp3-dialog-cancel-button, .bp3-dialog-close-button { background-color: #f8f9fa; color: #495057; border-color: #ced4da; } .bp3-dialog-cancel-button:hover, .bp3-dialog-close-button:hover { background-color: #e9ecef; }
                .bp3-dialog-confirm-button, .bp3-dialog-try-again-button { background-color: var(--color-primary); color: white; border-color: var(--color-primary); } .bp3-dialog-confirm-button:hover, .bp3-dialog-try-again-button:hover { background-color: var(--color-primary-dark); border-color: var(--color-primary-dark); }
                body.bp3-dialog-open { overflow: hidden; } /* Use prefixed class for body lock */
                @keyframes bp3-spin { 100% { transform: rotate(360deg); } }

                @media (max-width: 350px) {
                    .bp3-system-dialog { width: 95%; }
                    .bp3-dialog-header { padding: 10px 12px; }
                    .bp3-dialog-title { font-size: 14px; }
                    .bp3-dialog-body { padding: 12px 15px; }
                    .bp3-provider-label { font-size: 12px; }
                    .bp3-provider-select { padding: 6px 10px; font-size: 13px; }
                    .bp3-dialog-button { padding: 6px 14px; font-size: 13px; }
                }
                /* === END: Unique Restart Dialog Styles === */
            `;
            document.head.appendChild(style);
        },

        // --- Cleanup ---
        cleanup: function() {
            this.stopConfigPolling();
            if (this.state.pollTimerId) clearTimeout(this.state.pollTimerId);

            if (this.dom.sizeObserver) {
                this.dom.sizeObserver.disconnect();
                this.dom.sizeObserver = null;
            }
            window.removeEventListener('resize', this.checkPanelSize.bind(this)); // Ensure listener removed if fallback used

            // Remove dialog and backdrop safely
            this.dom.restartDialog?.remove();
            this.dom.restartDialogBackdrop?.remove();

            // Remove styles
            document.getElementById(`${this.id}-styles`)?.remove();

            // Clear state
            this.state.config = null;
            this.state.mainConfigData = null;
            this.state.apiStatus = null;
            this.state.isRestarting = false;

            console.log(`[${this.id}] Component cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();

