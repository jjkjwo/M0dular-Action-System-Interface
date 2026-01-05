/**
 * ==============================================================================================
 * Top Panel 5 - Enhanced Core Manager Component
 * ==============================================================================================
 *
 * Redesigned Core Manager panel with a focus on AI Core Control functionality.
 * Provides a streamlined interface for managing the core action, viewing action statuses,
 * and controlling addons via AI commands.
 *
 * @version 4.2.1 - Updated with standard panel header styling
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-5',

        // DOM references
        dom: {
            content: null,
            noteElement: null,           // Displays "Plugin Required"
            coreContainer: null,         // Holds main controls when active
            actionsInfoContainer: null,  // Container for actions info display
            actionsTable: null,          // Table to display action status
            collapsibleSections: {},     // Store references to collapsible sections
            aiControlExample: null,      // Example of AI control syntax
            commandsAccordion: null,     // Accordion for example commands
            tabContents: {},             // Store references to tab content sections
            tabs: {}                     // Store references to tab buttons
        },

        // Component state
        state: {
            isCoreActive: false,         // Tracks 'core' action status
            configOptions: {},           // Holds fetched config
            subscriptions: [],
            actionsInfo: {},             // Store parsed actions info data
            lastRefreshTime: null,       // Track when actions info was last refreshed
            lastControlCommand: null,    // Last AI command detected
            activeTab: 'actionsTab'      // Track which tab is currently active
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element for ${this.id} not found`);
                return;
            }

            // Render structure unconditionally
            this.renderContentStructure();

            // Subscribe to action changes
            const actionSubscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateCoreState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: actionSubscription });

            // Subscribe to chat updates to detect AI commands
            const chatSubscription = Framework.on('chatUpdated', (data) => {
                if (this.state.isCoreActive && data?.messages?.length) {
                    // Look for AI core commands in recent messages
                    this.detectCoreCommands(data.messages);
                }
            });
            this.state.subscriptions.push({ event: 'chatUpdated', id: chatSubscription });

            // Check initial state
            this.checkInitialCoreState();
            console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Check initial state of "core" plugin
         */
        checkInitialCoreState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    this.updateCoreState(data?.actions || []); // Update UI based on initial state
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial core state:`, error);
                    this.updateCoreState([]); // Assume inactive on error
                });
        },

        /**
         * Update component state and UI visibility based on core active status.
         * Does NOT automatically fetch action info.
         * @param {Array} actions - Active actions array
         */
        updateCoreState: function(actions = []) {
            const isActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'core';
            });
            const stateChanged = this.state.isCoreActive !== isActive;

            // Update state first
            this.state.isCoreActive = isActive;

            // Always update visibility
            this.updateUIVisibility();

            if (stateChanged) {
                console.log(`[${this.id}] Core Action Active State Changed: ${isActive}`);
                
                // If core is deactivated, clear actions info
                if (!isActive) {
                    this.state.actionsInfo = {};
                    this.updateActionsInfoDisplay();
                }
            }
        },

        /**
         * Update visibility of note vs main container
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.isCoreActive ? 'none' : 'block';
            }
            if (this.dom.coreContainer) {
                this.dom.coreContainer.style.display = this.state.isCoreActive ? 'block' : 'none';
            }
        },

        /**
         * Switch between tabs
         * @param {string} tabId - ID of the tab to activate
         */
        switchTab: function(tabId) {
            // Don't do anything if trying to activate the already active tab
            if (this.state.activeTab === tabId) return;

            // Update active tab state
            this.state.activeTab = tabId;

            // Update tab button styles
            Object.keys(this.dom.tabs).forEach(key => {
                if (this.dom.tabs[key]) {
                    this.dom.tabs[key].classList.toggle('active-tab', key === tabId);
                }
            });

            // Update tab content visibility
            Object.keys(this.dom.tabContents).forEach(key => {
                if (this.dom.tabContents[key]) {
                    this.dom.tabContents[key].style.display = key === tabId ? 'block' : 'none';
                }
            });

            console.log(`[${this.id}] Switched to tab: ${tabId}`);
        },

        /**
         * Look for AI core commands in recent chat messages
         * @param {Array} messages - Recent chat messages
         */
        detectCoreCommands: function(messages) {
            if (!messages || !messages.length) return;
            
            // Look through the last 10 messages at most
            const messagesToCheck = messages.slice(-10);
            
            // Look for [CORE: command args] pattern in messages
            for (let i = messagesToCheck.length - 1; i >= 0; i--) {
                const msg = messagesToCheck[i];
                if (typeof msg !== 'string') continue;
                
                const coreCommandMatch = msg.match(/\[CORE:\s*(\w+)\s*(.*?)\]/);
                if (coreCommandMatch) {
                    const command = coreCommandMatch[1].toLowerCase();
                    const args = coreCommandMatch[2].trim();
                    
                    console.log(`[${this.id}] Detected AI core command: ${command} with args "${args}"`);
                    
                    // Store and display the detected command
                    this.state.lastControlCommand = {
                        command: command,
                        args: args,
                        timestamp: new Date()
                    };
                    
                    this.updateLastCommandDisplay();
                    
                    // Only process the most recent command
                    break;
                }
            }
        },

        /**
         * Update the display of the last detected AI command
         */
        updateLastCommandDisplay: function() {
            const lastCommandEl = document.getElementById('lastAICommand');
            if (!lastCommandEl || !this.state.lastControlCommand) return;
            
            const { command, args, timestamp } = this.state.lastControlCommand;
            const timeString = timestamp.toLocaleTimeString();
            
            lastCommandEl.innerHTML = `
                <strong>Last AI Command:</strong> 
                <code>[CORE: ${command} ${args}]</code>
                <div class="command-time">Detected at: ${timeString}</div>
            `;
            lastCommandEl.style.display = 'block';
        },

        /**
         * Fetch actions info via "actions info" command
         * Submits the command to chat directly
         */
        fetchActionsInfo: function() {
            if (!this.state.isCoreActive) {
                Framework.showToast('Core plugin is not active.', 2000);
                return;
            }
            
            console.log(`[${this.id}] Fetching actions info...`);
            Framework.showToast('Fetching actions info...');

            // Set input value and submit the command
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = 'actions info';
                Framework.sendMessage();
            }
            
            // Set a slightly longer timeout to wait for response
            setTimeout(() => {
                this.findActionsInfoInChatHistory();
            }, 1500); // Increased wait time for log update
            
            this.state.lastRefreshTime = new Date();
            this.updateLastRefreshDisplay();
        },
        
        /**
         * Fetch core configuration
         */
        fetchCoreConfig: function() {
            if (!this.state.isCoreActive) {
                Framework.showToast('Core plugin is not active.', 2000);
                return;
            }
            
            console.log(`[${this.id}] Fetching core config...`);
            Framework.showToast('Fetching core configuration...');

            // Set input value and submit the command
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = 'core config';
                Framework.sendMessage();
            }
            
            setTimeout(() => {
                this.findConfigInChatHistory(this.parseConfigFromResponse);
            }, 1500); // Increased wait time for log update
        },

        /**
         * Find actions info response in chat history
         */
        findActionsInfoInChatHistory: function() {
            const recentMessages = Framework.state.messagesCache || [];
            if (!recentMessages.length) {
                console.warn(`[${this.id}] No chat messages found in cache to parse actions info from.`);
                return;
            }
            
            let foundResponse = null;
            // Search backwards through recent messages
            for (let i = recentMessages.length - 1; i >= Math.max(0, recentMessages.length - 10); i--) {
                const msg = recentMessages[i];
                if (typeof msg === 'string' && msg.includes('[CORE ACTION: Action Status:')) {
                    foundResponse = msg;
                    break;
                }
            }

            if (foundResponse) {
                console.log(`[${this.id}] Found actions info in cache: ${foundResponse.substring(0, 100)}...`);
                this.parseActionsInfoFromResponse(foundResponse);
            } else {
                console.warn(`[${this.id}] Could not find actions info in recent messages.`);
                Framework.showToast('Could not find actions info in recent messages.', 3000);
            }
        },

        /**
         * Parse the actions info from the response
         * @param {string} response - The chat message containing actions info
         */
        parseActionsInfoFromResponse: function(response) {
            try {
                const actionStatusMatch = response.match(/\[CORE ACTION: Action Status: (.*)\]/);
                if (actionStatusMatch && actionStatusMatch[1]) {
                    const actionStatusString = actionStatusMatch[1];
                    console.log(`[${this.id}] Actions info raw data: ${actionStatusString}`);
                    
                    // Convert Python-like dict to JSON
                    let jsonString = actionStatusString
                        .replace(/'/g, '"')        // Single quotes to double quotes
                        .replace(/True/g, 'true')  // Python True to JS true
                        .replace(/False/g, 'false') // Python False to JS false
                        .replace(/None/g, 'null'); // Python None to JS null
                    
                    // Attempt to fix trailing commas before closing braces/brackets
                    jsonString = jsonString.replace(/,\s*}/g, '}');
                    jsonString = jsonString.replace(/,\s*]/g, ']');
                    
                    // Parse the formatted string as JSON
                    const actionsData = JSON.parse(jsonString);
                    this.state.actionsInfo = actionsData;
                    console.log(`[${this.id}] Successfully parsed actions info:`, actionsData);
                    
                    // Update the UI with the new data
                    this.updateActionsInfoDisplay();
                    Framework.showToast('Actions info updated', 2000);
                } else {
                    console.warn(`[${this.id}] Could not extract actions info from response`);
                    Framework.showToast('Could not parse actions info', 3000);
                }
            } catch (error) {
                console.error(`[${this.id}] Error parsing actions info:`, error);
                Framework.showToast('Error parsing actions info', 3000);
            }
        },

        /**
         * Update the actions info display based on the parsed data
         */
        updateActionsInfoDisplay: function() {
            const tableContainer = this.dom.actionsTable;
            if (!tableContainer) {
                console.error(`[${this.id}] Actions table container not found`);
                return;
            }
            
            // Clear existing content
            tableContainer.innerHTML = '';
            
            if (!this.state.actionsInfo || Object.keys(this.state.actionsInfo).length === 0) {
                tableContainer.innerHTML = '<div class="empty-state">No actions info available. Click "Refresh Info" to load actions data.</div>';
                return;
            }
            
            // Create table elements
            const table = document.createElement('table');
            table.className = 'actions-table';
            
            // Create header row
            const headerRow = document.createElement('tr');
            ['Action', 'Status', 'Priority', 'AI Control'].forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);
            
            // Sort actions by priority (lower number = higher priority)
            const sortedActions = Object.entries(this.state.actionsInfo).sort((a, b) => {
                const priorityA = typeof a[1].priority === 'number' ? a[1].priority : 999;
                const priorityB = typeof b[1].priority === 'number' ? b[1].priority : 999;
                return priorityA - priorityB;
            });
            
            // Create data rows
            sortedActions.forEach(([actionName, actionData]) => {
                const row = document.createElement('tr');
                
                // Action name cell
                const nameCell = document.createElement('td');
                nameCell.textContent = actionName;
                row.appendChild(nameCell);
                
                // Status cell with colored indicator
                const statusCell = document.createElement('td');
                const statusIndicator = document.createElement('span');
                statusIndicator.className = 'status-indicator';
                statusIndicator.classList.add(actionData.active ? 'active' : 'inactive');
                statusCell.appendChild(statusIndicator);
                statusCell.appendChild(document.createTextNode(actionData.active ? 'Active' : 'Inactive'));
                row.appendChild(statusCell);
                
                // Priority cell
                const priorityCell = document.createElement('td');
                priorityCell.textContent = actionData.priority !== undefined ? actionData.priority : 'N/A';
                row.appendChild(priorityCell);
                
                // AI Control cell (Quick command copy buttons)
                const controlCell = document.createElement('td');
                
                // Add Start/Stop buttons based on current status
                if (actionData.active) {
                    const stopButton = document.createElement('button');
                    stopButton.className = 'ai-control-button stop-button';
                    stopButton.textContent = 'Stop';
                    stopButton.title = `Copy example AI command to stop ${actionName}`;
                    stopButton.dataset.command = `[CORE: stop ${actionName}]`;
                    stopButton.addEventListener('click', (e) => this.copyAICommand(e.target.dataset.command));
                    controlCell.appendChild(stopButton);
                } else {
                    const startButton = document.createElement('button');
                    startButton.className = 'ai-control-button start-button';
                    startButton.textContent = 'Start';
                    startButton.title = `Copy example AI command to start ${actionName}`;
                    startButton.dataset.command = `[CORE: start ${actionName}]`;
                    startButton.addEventListener('click', (e) => this.copyAICommand(e.target.dataset.command));
                    controlCell.appendChild(startButton);
                }
                
                row.appendChild(controlCell);
                table.appendChild(row);
            });
            
            tableContainer.appendChild(table);
            this.updateLastRefreshDisplay();
        },
        
        /**
         * Copy an AI command to the user input field
         * @param {string} command - The command to copy
         */
        copyAICommand: function(command) {
            const userInput = document.getElementById('userInput');
            if (userInput) {
                // If there's existing text, add a space before adding the command
                if (userInput.value.trim() !== '') {
                    userInput.value += ' ' + command;
                } else {
                    userInput.value = command;
                }
                userInput.focus();
                Framework.showToast('AI command copied to input', 2000);
            } else {
                console.error(`[${this.id}] User input element not found for copying command`);
                Framework.showToast('Could not copy command - input field not found', 3000);
            }
        },
        
        /**
         * Update the last refresh timestamp display
         */
        updateLastRefreshDisplay: function() {
            const lastRefreshEl = document.getElementById('lastRefreshTime');
            if (lastRefreshEl && this.state.lastRefreshTime) {
                const timeString = this.state.lastRefreshTime.toLocaleTimeString();
                lastRefreshEl.textContent = `Last updated: ${timeString}`;
                lastRefreshEl.style.display = 'block';
            } else if (lastRefreshEl) {
                lastRefreshEl.style.display = 'none';
            }
        },

        /**
         * Tries to find the config response in recent chat history (fragile approach)
         */
        findConfigInChatHistory: function(parseCallback) {
            const recentMessages = Framework.state.messagesCache || [];
            if (!recentMessages.length) {
                console.warn(`[${this.id}] No chat messages found in cache to parse config from.`);
                return;
            }
            
            let foundResponse = null;
            // Search backwards through recent messages
            for (let i = recentMessages.length - 1; i >= Math.max(0, recentMessages.length - 10); i--) {
                const msg = recentMessages[i];
                if (typeof msg === 'string' && msg.includes('Current configuration:')) {
                    foundResponse = msg;
                    break;
                }
            }

            if (foundResponse) {
                console.log(`[${this.id}] Found potential config line in cache: ${foundResponse}`);
                parseCallback.call(this, foundResponse);
            } else {
                console.warn(`[${this.id}] Could not find config response in recent messages cache.`);
            }
        },

        /**
         * Parses the config string received from chat history.
         * @param {string} response - The log line potentially containing the config.
         */
        parseConfigFromResponse: function(response) {
            try {
                const configMatch = response?.match(/Current configuration:\s*(\{.*?\})/);
                if (configMatch && configMatch[1]) {
                    const rawConfigString = configMatch[1];
                    console.log(`[${this.id}] Raw config string extracted:`, rawConfigString);

                    // Attempt to clean and parse the Python-like dict string
                    try {
                        // Aggressively replace Python literals with JSON equivalents
                        let jsonString = rawConfigString.replace(/'/g, '"');       // Single quotes to double quotes
                        jsonString = jsonString.replace(/\bTrue\b/g, 'true');      // True to true
                        jsonString = jsonString.replace(/\bFalse\b/g, 'false');    // False to false
                        jsonString = jsonString.replace(/\bNone\b/g, 'null');      // None to null

                        // Attempt to fix trailing commas before closing braces/brackets
                        jsonString = jsonString.replace(/,\s*}/g, '}');
                        jsonString = jsonString.replace(/,\s*]/g, ']');

                        const configObj = JSON.parse(jsonString);
                        this.state.configOptions = configObj;
                        console.log(`[${this.id}] Successfully parsed core config:`, configObj);
                        this.updateConfigDisplay();
                        Framework.showToast('Core configuration updated.');
                    } catch (parseError) {
                        console.error(`[${this.id}] JSON parsing failed for config:`, parseError);
                        console.error(`[${this.id}] Failed string:`, rawConfigString);
                        Framework.showToast('Could not parse core config from response (Check Console).');
                    }
                } else {
                    console.warn(`[${this.id}] Could not find core config pattern in response:`, response);
                    Framework.showToast('Core configuration pattern not found in response.');
                }
            } catch (error) {
                console.error(`[${this.id}] Error processing core config response:`, error, 'Response:', response);
                Framework.showToast('Error handling core configuration response.');
            }
        },

        /**
         * Update the configuration display based on fetched state
         */
        updateConfigDisplay: function() {
            // Only update if controls are rendered and cached
            if (this.dom.logLevelSelector) {
                // Safer access with optional chaining and default value
                const currentLevel = this.state.configOptions?.log_level || 'info';
                console.log(`[${this.id}] Updating log level selector display to: ${currentLevel}`);
                this.dom.logLevelSelector.value = currentLevel;
            }
        },

        /**
         * Render the basic panel structure (Warning Note + Main Container)
         */
        renderContentStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear existing

            // Create/Cache Warning Note Element
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note core-note';
            noteElement.innerHTML = `<strong>Plugin Required</strong><br>Start the "core" plugin to manage plugins and view action statuses.<br><br><em>Example command:</em> <code>start core</code>`;
            noteElement.style.display = 'none'; // Initially hidden
            this.dom.noteElement = noteElement;
            this.dom.content.appendChild(noteElement);

            // Create/Cache Main Container for Panel Controls
            const coreContainer = document.createElement('div');
            coreContainer.className = `${this.id}-main-container`;
            coreContainer.style.display = 'none'; // Initially hidden
            coreContainer.style.height = '100%';
            coreContainer.style.overflowY = 'auto'; // Allow scroll
            this.dom.coreContainer = coreContainer;
            this.dom.content.appendChild(coreContainer);

            // Add base styles
            this.addBaseStyles();
            
            // Render controls inside the container
            this.renderCoreControls();
        },

        /**
         * Render component controls inside the main container.
         * Now with tabbed interface instead of collapsible sections
         */
        renderCoreControls: function() {
            // Ensure container exists
            if (!this.dom.coreContainer) {
                console.error(`[${this.id}] Core container not found, cannot render controls.`);
                return;
            }
            this.dom.coreContainer.innerHTML = ''; // Clear placeholder/previous render

            console.log(`[${this.id}] Rendering Core controls with tabbed interface...`);

            // Create the main container for the panel
            const container = document.createElement('div');
            container.className = 'core-manager-panel';

            // --- Add Standard Panel Header Section with same style as other panels ---
            const headerSection = document.createElement('div');
            headerSection.className = 'panel-header-info';
            headerSection.style.display = 'flex';
            headerSection.style.justifyContent = 'space-between';
            headerSection.style.alignItems = 'center';
            headerSection.style.padding = '8px 10px';
            headerSection.style.backgroundColor = '#f5f5f5';
            headerSection.style.borderBottom = '1px solid #e0e0e0';
            
            // Left side with title
            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.gap = '10px';
            
            // Title
            const headerTitle = document.createElement('div');
            headerTitle.textContent = 'Core Manager';
            headerTitle.style.fontWeight = 'bold';
            headerLeft.appendChild(headerTitle);
            
            // Add status indicator to the left section
            const statusWrapper = document.createElement('div');
            statusWrapper.className = 'status-wrapper';
            statusWrapper.style.display = 'flex';
            statusWrapper.style.alignItems = 'center';
            
            const statusShape = document.createElement('span');
            statusShape.className = 'status-shape active';
            statusShape.style.display = 'inline-block';
            statusShape.style.width = '10px';
            statusShape.style.height = '10px';
            statusShape.style.borderRadius = '50%';
            statusShape.style.marginRight = '5px';
            statusShape.style.backgroundColor = '#4caf50';
            
            const statusText = document.createElement('span');
            statusText.className = 'status-text';
            statusText.textContent = 'Active';
            statusText.style.fontSize = '0.85em';
            statusText.style.fontWeight = 'bold';
            
            statusWrapper.appendChild(statusShape);
            statusWrapper.appendChild(statusText);
            headerLeft.appendChild(statusWrapper);
            
            headerSection.appendChild(headerLeft);
            
            // Right side with controls
            const headerControls = document.createElement('div');
            headerControls.style.display = 'flex';
            headerControls.style.alignItems = 'center';
            headerControls.style.gap = '10px';
            
            // Stop Core button
            const stopCoreBtn = document.createElement('button');
            stopCoreBtn.id = 'stopCoreBtn';
            stopCoreBtn.className = 'control-button stop-button';
            stopCoreBtn.textContent = 'Stop';
            stopCoreBtn.setAttribute('title', 'Send \'stop core\' command');
            stopCoreBtn.style.backgroundColor = '#f44336';
            stopCoreBtn.style.color = 'white';
            stopCoreBtn.style.border = 'none';
            stopCoreBtn.style.borderRadius = '4px';
            stopCoreBtn.style.padding = '6px 12px';
            stopCoreBtn.style.cursor = 'pointer';
            stopCoreBtn.style.fontSize = '0.85em';
            stopCoreBtn.style.fontWeight = 'bold';
            
            // Refresh info button
            const refreshInfoBtn = document.createElement('button');
            refreshInfoBtn.id = 'refreshInfoBtn';
            refreshInfoBtn.className = 'control-button refresh-button';
            refreshInfoBtn.textContent = 'Refresh';
            refreshInfoBtn.setAttribute('title', 'Get current actions info');
            refreshInfoBtn.style.backgroundColor = '#2196f3';
            refreshInfoBtn.style.color = 'white';
            refreshInfoBtn.style.border = 'none';
            refreshInfoBtn.style.borderRadius = '4px';
            refreshInfoBtn.style.padding = '6px 12px';
            refreshInfoBtn.style.cursor = 'pointer';
            refreshInfoBtn.style.fontSize = '0.85em';
            refreshInfoBtn.style.fontWeight = 'bold';
            
            headerControls.appendChild(stopCoreBtn);
            headerControls.appendChild(refreshInfoBtn);
            headerSection.appendChild(headerControls);
            
            container.appendChild(headerSection);

            // --- Add Last Detected AI Command Display ---
            const lastCommandEl = document.createElement('div');
            lastCommandEl.id = 'lastAICommand';
            lastCommandEl.className = 'last-command-display';
            lastCommandEl.style.display = 'none'; // Hidden initially
            container.appendChild(lastCommandEl);

            // --- Create Tabbed Interface ---
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'tabs-container';
            
            // Tab navigation
            const tabNav = document.createElement('div');
            tabNav.className = 'tab-nav';
            
            // Define tabs
            const tabs = [
                { id: 'actionsTab', text: 'Actions' },
                { id: 'aiControlTab', text: 'AI Control' },
                { id: 'configTab', text: 'Config' }
            ];
            
            // Create tab buttons
            tabs.forEach(tab => {
                const tabButton = document.createElement('button');
                tabButton.className = 'tab-button';
                tabButton.textContent = tab.text;
                tabButton.dataset.tabId = tab.id;
                
                // Set active tab for the first tab
                if (tab.id === this.state.activeTab) {
                    tabButton.classList.add('active-tab');
                }
                
                // Add click event
                tabButton.addEventListener('click', () => this.switchTab(tab.id));
                
                // Store reference to tab button
                this.dom.tabs[tab.id] = tabButton;
                
                // Add to nav
                tabNav.appendChild(tabButton);
            });
            
            tabsContainer.appendChild(tabNav);
            
            // Tab content container
            const tabContent = document.createElement('div');
            tabContent.className = 'tab-content';
            
            // --- ACTIONS TAB CONTENT ---
            const actionsTabContent = document.createElement('div');
            actionsTabContent.id = 'actionsTab';
            actionsTabContent.className = 'tab-pane';
            actionsTabContent.style.display = this.state.activeTab === 'actionsTab' ? 'block' : 'none';
            
            // Add refresh timestamp
            const lastRefreshTime = document.createElement('div');
            lastRefreshTime.id = 'lastRefreshTime';
            lastRefreshTime.className = 'last-refresh-time';
            lastRefreshTime.style.display = 'none'; // Hidden initially
            actionsTabContent.appendChild(lastRefreshTime);
            
            // Add table container
            const actionsTableContainer = document.createElement('div');
            actionsTableContainer.id = 'actionsTableContainer';
            actionsTableContainer.className = 'actions-table-container';
            actionsTabContent.appendChild(actionsTableContainer);
            
            // Store reference to the actions table container
            this.dom.actionsTable = actionsTableContainer;
            
            // Store the tab content reference
            this.dom.tabContents['actionsTab'] = actionsTabContent;
            tabContent.appendChild(actionsTabContent);
            
            // --- AI CONTROL TAB CONTENT ---
            const aiControlTabContent = document.createElement('div');
            aiControlTabContent.id = 'aiControlTab';
            aiControlTabContent.className = 'tab-pane';
            aiControlTabContent.style.display = this.state.activeTab === 'aiControlTab' ? 'block' : 'none';
            
            // Add syntax example
            const syntaxExample = document.createElement('div');
            syntaxExample.className = 'syntax-example';
            syntaxExample.innerHTML = `
                <p>Command syntax for AI control:</p>
                <pre class="command-syntax">[CORE: command arguments]</pre>
            `;
            aiControlTabContent.appendChild(syntaxExample);
            
            // Add command examples with copy buttons
            const commandExamples = document.createElement('div');
            commandExamples.className = 'command-examples';
            
            const commands = [
                {name: 'start', args: 'action_name', description: 'Start an action'},
                {name: 'stop', args: 'action_name', description: 'Stop an action'},
                {name: 'start common', args: '', description: 'Start common actions'}
            ];
            
            commands.forEach(cmd => {
                const cmdElement = document.createElement('div');
                cmdElement.className = 'command-example-item';
                
                const cmdText = cmd.args ? `[CORE: ${cmd.name} ${cmd.args}]` : `[CORE: ${cmd.name}]`;
                
                cmdElement.innerHTML = `
                    <div class="command-info">
                        <code>${cmdText}</code>
                        <span class="command-desc">${cmd.description}</span>
                    </div>
                    <button class="copy-button" data-command="${cmdText}" title="Copy to input">Copy</button>
                `;
                
                // Add click event for copy button
                cmdElement.querySelector('.copy-button').addEventListener('click', (e) => {
                    this.copyAICommand(e.target.dataset.command);
                });
                
                commandExamples.appendChild(cmdElement);
            });
            
            aiControlTabContent.appendChild(commandExamples);
            
            // Store the tab content reference
            this.dom.tabContents['aiControlTab'] = aiControlTabContent;
            tabContent.appendChild(aiControlTabContent);
            
            // --- CONFIG TAB CONTENT ---
            const configTabContent = document.createElement('div');
            configTabContent.id = 'configTab';
            configTabContent.className = 'tab-pane';
            configTabContent.style.display = this.state.activeTab === 'configTab' ? 'block' : 'none';
            
            // Log Level Selector (optimized for visibility)
            const logLevelGroup = document.createElement('div');
            logLevelGroup.className = 'config-group';
            
            // Create compact label
            const logLevelLabel = document.createElement('label');
            logLevelLabel.htmlFor = 'logLevelSelector';
            logLevelLabel.textContent = 'Log Level:';
            logLevelLabel.className = 'config-label';
            logLevelGroup.appendChild(logLevelLabel);
            
            // Create select with improved styling for dropdown visibility
            const logLevelSelector = document.createElement('select');
            logLevelSelector.id = 'logLevelSelector';
            logLevelSelector.className = 'config-select improved-dropdown';
            logLevelSelector.title = "Select Core logging level";
            
            // Add options with proper value and display text
            ['debug', 'info', 'warning', 'error', 'critical', 'none'].forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level.charAt(0).toUpperCase() + level.slice(1);
                logLevelSelector.appendChild(option);
            });
            
            logLevelGroup.appendChild(logLevelSelector);
            configTabContent.appendChild(logLevelGroup);
            
            // Cache selector reference
            this.dom.logLevelSelector = logLevelSelector;
            
            // Custom Config Input (optimized layout)
            const customConfigGroup = document.createElement('div');
            customConfigGroup.className = 'config-group custom-config-group';
            
            // Create title for custom config
            const customConfigTitle = document.createElement('div');
            customConfigTitle.className = 'custom-config-title';
            customConfigTitle.textContent = 'Custom Configuration:';
            customConfigGroup.appendChild(customConfigTitle);
            
            // Create input container with improved spacing
            const customConfigInputs = document.createElement('div');
            customConfigInputs.className = 'custom-config-inputs';
            
            // Key input
            const keyInput = document.createElement('input');
            keyInput.id = 'coreConfigKey';
            keyInput.type = 'text';
            keyInput.className = 'config-input key-input';
            keyInput.placeholder = 'Key';
            keyInput.title = 'Config key';
            customConfigInputs.appendChild(keyInput);
            
            // Equals sign separator
            const equalsSign = document.createElement('span');
            equalsSign.className = 'equals-sign';
            equalsSign.textContent = '=';
            customConfigInputs.appendChild(equalsSign);
            
            // Value input
            const valueInput = document.createElement('input');
            valueInput.id = 'coreConfigValue';
            valueInput.type = 'text';
            valueInput.className = 'config-input value-input';
            valueInput.placeholder = 'Value';
            valueInput.title = 'Value';
            customConfigInputs.appendChild(valueInput);
            
            // Set button
            const setConfigBtn = document.createElement('button');
            setConfigBtn.id = 'setCoreConfigBtn';
            setConfigBtn.className = 'set-config-button';
            setConfigBtn.textContent = 'Set';
            setConfigBtn.title = 'Set configuration value';
            customConfigInputs.appendChild(setConfigBtn);
            
            customConfigGroup.appendChild(customConfigInputs);
            configTabContent.appendChild(customConfigGroup);
            
            // Store the tab content reference
            this.dom.tabContents['configTab'] = configTabContent;
            tabContent.appendChild(configTabContent);
            
            // Add tabs container to main container
            tabsContainer.appendChild(tabContent);
            container.appendChild(tabsContainer);

            // --- Append controls to the main container ---
            this.dom.coreContainer.appendChild(container);

            // --- Add Event Listeners AFTER elements are in the DOM ---
            this.addControlEventListeners();

            // --- Update Display ---
            this.updateActionsInfoDisplay(); // Initialize actions info display
            this.updateConfigDisplay(); // Ensure dropdown reflects current state if config was fetched already
        },

        /** Helper to add event listeners to controls */
        addControlEventListeners: function() {
            const get = (id) => this.dom.coreContainer?.querySelector(`#${id}`);

            // Stop Core button now directly submits command to chat
            get('stopCoreBtn')?.addEventListener('click', () => {
                const userInput = document.getElementById('userInput');
                if (userInput) {
                    userInput.value = 'stop core';
                    Framework.sendMessage();
                }
                Framework.showToast('Sending command: stop core...');
            });

            // Refresh Info button (now properly submits the command)
            get('refreshInfoBtn')?.addEventListener('click', () => this.fetchActionsInfo());

            // Log level selector listener (ensure selector exists from cache)
            this.dom.logLevelSelector?.addEventListener('change', () => {
                if (!this.state.isCoreActive) {
                    Framework.showToast('Start "core" plugin first.');
                    this.updateConfigDisplay(); // Revert selection visually
                    return;
                }
                const newLevel = this.dom.logLevelSelector.value;
                const userInput = document.getElementById('userInput');
                if (userInput) {
                    userInput.value = `core config log_level=${newLevel}`;
                    Framework.sendMessage();
                }
                Framework.showToast(`Sending command: set log level to ${newLevel}...`);
                // Update local state optimistically (will be overwritten on refresh)
                this.state.configOptions.log_level = newLevel;
            });

            // Custom config listener
            get('setCoreConfigBtn')?.addEventListener('click', () => {
                if (!this.state.isCoreActive) { 
                    Framework.showToast('Start "core" plugin first.'); 
                    return; 
                }
                const keyInput = get('coreConfigKey');
                const valueInput = get('coreConfigValue');
                const key = keyInput?.value.trim();
                const value = valueInput?.value.trim();

                if (key && value) {
                    const userInput = document.getElementById('userInput');
                    if (userInput) {
                        userInput.value = `core config ${key}=${value}`;
                        Framework.sendMessage();
                    }
                    Framework.showToast(`Sending command: set config ${key}=${value}...`);
                    keyInput.value = ''; // Clear inputs after sending
                    valueInput.value = '';
                    // Config UI won't reflect change until 'Refresh Info' is clicked.
                    setTimeout(() => this.fetchCoreConfig(), 1500); // Auto-refresh after delay
                } else {
                    Framework.showToast('Both Key and Value are required for custom config.');
                }
            });

            // Listener for Enter key in custom config value field
            get('coreConfigValue')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission/newline
                    get('setCoreConfigBtn')?.click(); // Simulate button click
                }
            });
        },

        /** Add base styles for the component with tabbed interface styling */
        addBaseStyles: function() {
            const styleId = 'core-manager-panel-styles';
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Plugin Required Note */
                .plugin-required-note {
                    padding: 15px; margin: 10px; background-color: #fff4e5;
                    border: 1px solid #ffcc80; border-radius: 5px;
                    color: #e65100; text-align: center; font-size: 0.9em; line-height: 1.4;
                }
                .plugin-required-note code {
                    background-color: #ffe0b2; padding: 2px 4px;
                    border-radius: 3px; font-family: monospace; color: #c65a11;
                }
                .plugin-required-note strong { color: #c65a11; }
                
                /* Core Manager Panel */
                .core-manager-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                /* Last AI Command Display */
                .last-command-display {
                    background-color: #fffde7;
                    border: 1px solid #fff9c4;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 10px;
                    font-size: 0.85em;
                }
                
                .last-command-display code {
                    background-color: #424242;
                    color: #ffffff;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: monospace;
                    margin: 0 4px;
                }
                
                .command-time {
                    margin-top: 4px;
                    font-size: 0.75em;
                    color: #666;
                    font-style: italic;
                }
                
                /* Tabbed Interface Styles */
                .tabs-container {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: var(--border-radius-md, 4px);
                    background-color: var(--color-background, #f9f9f9);
                    overflow: hidden;
                    flex: 1;
                    margin: 10px;
                }
                
                .tab-nav {
                    display: flex;
                    border-bottom: 1px solid var(--color-border, #e0e0e0);
                    background-color: #f1f1f1;
                }
                
                .tab-button {
                    flex: 1;
                    padding: 8px 12px;
                    border: none;
                    background-color: transparent;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-weight: bold;
                    color: #555;
                    transition: background-color 0.2s;
                    text-align: center;
                    border-bottom: 3px solid transparent;
                }
                
                .tab-button:hover {
                    background-color: #e0e0e0;
                }
                
                .tab-button.active-tab {
                    background-color: #fff;
                    color: var(--color-primary, #4a76a8);
                    border-bottom: 3px solid var(--color-primary, #4a76a8);
                }
                
                .tab-content {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                
                .tab-pane {
                    padding: 10px;
                    height: 100%;
                    overflow-y: auto;
                    background-color: white;
                }
                
                /* Actions Tab Styles */
                .last-refresh-time {
                    font-size: 0.75em;
                    color: #666;
                    margin-bottom: 6px;
                }
                
                .actions-table-container {
                    overflow-x: auto;
                }
                
                .actions-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                
                .actions-table th {
                    background-color: #f1f1f1;
                    padding: 6px 8px;
                    text-align: left;
                    border-bottom: 2px solid #ddd;
                    font-weight: bold;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                
                .actions-table td {
                    padding: 5px 8px;
                    border-bottom: 1px solid #eee;
                }
                
                .actions-table tr:hover {
                    background-color: #f5f5f5;
                }
                
                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 5px;
                }
                
                .status-indicator.active {
                    background-color: #4caf50;
                }
                
                .status-indicator.inactive {
                    background-color: #f44336;
                }
                
                .ai-control-button {
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 0.75em;
                    cursor: pointer;
                    border: none;
                    color: white;
                    font-weight: bold;
                }
                
                .ai-control-button.start-button {
                    background-color: #4caf50;
                }
                
                .ai-control-button.start-button:hover {
                    background-color: #388e3c;
                }
                
                .ai-control-button.stop-button {
                    background-color: #f44336;
                }
                
                .ai-control-button.stop-button:hover {
                    background-color: #d32f2f;
                }
                
                /* AI Control Tab Styles */
                .syntax-example {
                    margin-bottom: 15px;
                }
                
                .syntax-example p {
                    margin: 0 0 5px 0;
                    font-size: 0.9em;
                    font-weight: bold;
                }
                
                .command-syntax {
                    background-color: #424242;
                    color: #ffffff;
                    padding: 8px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 0.9em;
                    display: inline-block;
                }
                
                .command-examples {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    gap: 8px;
                }
                
                .command-example-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: #f5f5f5;
                    padding: 6px 8px;
                    border-radius: 4px;
                    border: 1px solid #e0e0e0;
                    flex: 1;
                    min-width: 180px;
                    max-width: calc(50% - 4px);
                }
                
                .command-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .command-info code {
                    font-family: monospace;
                    background-color: #eef2f7;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 0.85em;
                }
                
                .command-desc {
                    font-size: 0.75em;
                    color: #666;
                }
                
                .copy-button {
                    background-color: var(--color-primary, #4a76a8);
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 3px 8px;
                    font-size: 0.8em;
                    cursor: pointer;
                    white-space: nowrap;
                }
                
                .copy-button:hover {
                    background-color: var(--color-primary-dark, #365980);
                }
                
                /* Config Tab Styles */
                .config-group {
                    margin-bottom: 12px;
                }
                
                .config-label {
                    display: block;
                    margin-bottom: 4px;
                    font-weight: bold;
                    font-size: 0.85em;
                }
                
                .improved-dropdown {
                    position: relative;
                    height: 28px;
                    font-size: 0.85em;
                    background-color: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 0 8px;
                    width: 100%;
                    max-width: 200px;
                    cursor: pointer;
                    appearance: menulist;
                    -webkit-appearance: menulist;
                    -moz-appearance: menulist;
                }
                
                .improved-dropdown:focus, 
                .improved-dropdown:hover {
                    border-color: var(--color-primary, #4a76a8);
                    outline: none;
                }
                
                .improved-dropdown:active, 
                .improved-dropdown:focus {
                    border-color: var(--color-primary, #4a76a8);
                    box-shadow: 0 0 0 2px rgba(74, 118, 168, 0.25);
                }
                
                .custom-config-title {
                    font-weight: bold;
                    font-size: 0.85em;
                    margin-bottom: 6px;
                }
                
                .custom-config-inputs {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .config-input {
                    height: 28px;
                    padding: 0 8px;
                    font-size: 0.85em;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: white;
                }
                
                .key-input {
                    flex: 3;
                    min-width: 80px;
                }
                
                .value-input {
                    flex: 5;
                    min-width: 80px;
                }
                
                .equals-sign {
                    font-weight: bold;
                    color: #555;
                    font-size: 0.85em;
                }
                
                .set-config-button {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    height: 28px;
                    font-size: 0.85em;
                    font-weight: bold;
                    padding: 0 10px;
                    cursor: pointer;
                    white-space: nowrap;
                }
                
                .set-config-button:hover {
                    background-color: #0056b3;
                }
                
                /* Empty State */
                .empty-state {
                    padding: 12px;
                    text-align: center;
                    color: #666;
                    font-style: italic;
                    border: 1px dashed #ccc;
                    border-radius: 4px;
                    font-size: 0.85em;
                }
                
                /* Scrollbar Styling */
                .tab-pane::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                
                .tab-pane::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .tab-pane::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
                
                .tab-pane::-webkit-scrollbar-thumb:hover {
                    background: #999;
                }
                
                /* Focus styles for inputs */
                .config-input:focus {
                    border-color: var(--color-primary, #4a76a8);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 118, 168, 0.25);
                }
            `;
            document.head.appendChild(style);
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Unsubscribe from Framework events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];
            
            // Clear DOM content
            if (this.dom.content) {
                this.dom.content.innerHTML = '';
            }
            
            // Clear DOM references
            Object.keys(this.dom).forEach(key => {
                this.dom[key] = null;
            });
            
            console.log(`[${this.id}] Component cleaned up.`);
        },

        /**
         * Lifecycle hook for panel open
         */
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened.`);
            // No longer auto-refreshes actions info when panel opens
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();