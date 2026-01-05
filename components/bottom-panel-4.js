/**
 * ==============================================================================================
 * Bottom Panel 4 - Prompt Templates Manager Component
 * ==============================================================================================
 *
 * This panel manages prompt templates from the prompts.py module and allows users to
 * view, edit, create, and use prompt templates for AI interactions. Fetches metadata
 * (names/active) on init/refresh and content only when editing to prevent unwanted commands.
 *
 * @version 3.0.0 - Completely redesigned with enhanced styling to match other panels
 *                  Improved UI/UX with consistent design language
 *                  Maintained original functionality while adding visual feedback
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-4',

        // DOM references
        dom: {
            content: null,
            noteElement: null,             // Note shown when prompts action is inactive
            promptsContainer: null,        // Main container for controls when active
            promptList: null,              // Div containing the list of prompt names
            promptEditor: null,            // Object containing editor elements {container, title, nameInput, ...}
            activePromptIndicator: null,   // Div displaying the active prompt name
            statsElement: null,            // Element to display stats about prompt templates
            headerElement: null            // Header element for prompts panel
        },

        // Component state
        state: {
            promptsActive: false,           // Is the 'prompts' backend action running?
            promptNames: [],                // Array of available prompt names
            promptContentsCache: {},        // Cache for fetched contents {name: content}
            activePrompt: 'default',        // Name of the currently active prompt
            editingPromptName: null,        // Name of prompt currently loaded in the editor (null if creating new)
            subscriptions: [],              // Framework event subscriptions
            isLoading: false,               // Flag to prevent overlapping API calls
            lastUpdate: null                // Timestamp of last update
        },

        /**
         * Initialize the component: set up DOM, render UI, set listeners.
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }
            
            // Create the basic HTML structure within the panel
            this.renderContentStructure();
            
            // Listen for when backend active actions change
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updatePromptsState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: subscription });
            
            // Check the initial state of actions when the page loads
            Framework.fetchActiveActions().then(() => {
                // Initial fetch (if needed) is handled by updatePromptsState listener
                console.log(`[${this.id}] Initialized. Current prompts state: ${this.state.promptsActive}`);
            });
            
            // Add styles
            this.addStyles();
        },

        /**
         * Update component state based on whether the 'prompts' action is active.
         * Toggles UI visibility and triggers data fetch if needed.
         */
        updatePromptsState: function(actions) {
            // Check if 'prompts' is listed in the active actions from the backend
            const isPromptsActive = actions.some(action => action.split(':')[0].trim().toLowerCase() === 'prompts');

            // Only proceed if the active state has actually changed
            if (this.state.promptsActive !== isPromptsActive) {
                this.state.promptsActive = isPromptsActive;
                console.log(`[${this.id}] Prompts action state changed to: ${isPromptsActive}`);

                // Toggle visibility of the main prompt controls vs. the 'plugin required' note
                if (this.dom.noteElement) this.dom.noteElement.style.display = isPromptsActive ? 'none' : 'flex';
                if (this.dom.promptsContainer) this.dom.promptsContainer.style.display = isPromptsActive ? 'flex' : 'none';

                if (isPromptsActive) {
                    // If the 'prompts' action just started, fetch essential data
                    this.fetchPromptsMetadata();
                } else {
                    // If the 'prompts' action stopped, clear local state and UI elements
                    this.state.promptNames = [];
                    this.state.promptContentsCache = {};
                    this.state.activePrompt = 'default';
                    this.renderPromptList(); // Update list display (will show empty)
                    this.updateActivePromptDisplay(); // Reset active prompt display
                    this.clearEditor(); // Ensure editor is hidden if it was open
                    this.updateStatistics(); // Update stats
                }
            }
        },

        /**
         * Fetch prompts *metadata* (list of names and active prompt name) from the API.
         * Called when the panel becomes active or is manually refreshed.
         * Crucially, this function DOES NOT fetch the content of all prompts.
         */
        fetchPromptsMetadata: async function() {
            if (this.state.isLoading) {
                console.log(`[${this.id}] Request ignored: Already fetching metadata.`);
                return;
            }
            
            this.state.isLoading = true;
            console.log(`[${this.id}] Fetching prompts metadata (names & active state)...`);
            
            // Show loading state in header
            this.updateHeaderStatus('Loading...', 'loading');
            
            this.state.promptNames = []; // Clear old names before fetching
            this.state.promptContentsCache = {}; // Clear content cache as list/content might change
            this.renderPromptList(); // Update UI immediately to show "Loading..."

            try {
                // Step 1: Fetch the list of prompt names (e.g., ["default", "coding", ...])
                const listResponse = await fetch(CONFIG.api.prompts); // GET /api/prompts
                if (!listResponse.ok) {
                    throw new Error(`Failed to fetch prompt list: ${listResponse.status} ${listResponse.statusText}`);
                }
                const listData = await listResponse.json();
                if (!listData?.success || !Array.isArray(listData.prompts)) {
                    throw new Error('Invalid data format received for prompt list.');
                }
                this.state.promptNames = listData.prompts;

                // Step 2: Fetch the name of the currently active prompt (e.g., "default")
                const activeResponse = await fetch(CONFIG.api.activePrompt); // GET /api/prompts/active
                if (!activeResponse.ok) {
                    console.warn(`[${this.id}] Failed to fetch active prompt: ${activeResponse.status}. Defaulting.`);
                    this.state.activePrompt = 'default';
                } else {
                    const activeData = await activeResponse.json();
                    if (activeData?.success) {
                        this.state.activePrompt = activeData.active_prompt || 'default';
                    } else {
                        console.warn(`[${this.id}] API failed to report active prompt name. Defaulting.`);
                        this.state.activePrompt = 'default';
                    }
                }

                // Step 3: Update the UI with the fetched metadata
                this.updateActivePromptDisplay(); // Display the active prompt's name
                this.renderPromptList(); // Display the list of prompt names
                this.updateStatistics(); // Update statistics info
                this.updateHeaderStatus('Ready', 'success');
                
                // Update last update time
                this.state.lastUpdate = new Date();

                console.log(`[${this.id}] Successfully fetched prompts metadata.`);

            } catch (error) {
                console.error(`[${this.id}] Error during fetchPromptsMetadata:`, error);
                Framework.showToast(`Error loading prompts: ${error.message}`);
                this.renderPromptList(); // Re-render list to show error/empty state clearly
                this.updateHeaderStatus('Error', 'error');
            } finally {
                this.state.isLoading = false; // Allow subsequent fetches
            }
        },

        /**
         * Fetches the *content* of a specific prompt from the API (`GET /api/prompts/<name>`).
         * This function is called *only* when the user needs the content (e.g., clicks "Edit").
         * Caches the result to avoid redundant API calls.
         */
        fetchPromptContent: async function(promptName) {
            // Return immediately if content is already in the cache
            if (this.state.promptContentsCache[promptName]) {
                console.log(`[${this.id}] Returning cached content for: ${promptName}`);
                return this.state.promptContentsCache[promptName];
            }
            
            // Prevent multiple simultaneous fetches if metadata is already loading
            if (this.state.isLoading) {
                 console.log(`[${this.id}] Content fetch delayed: Metadata fetch in progress.`);
                 return "[Loading... Please wait]";
            }
            
            this.state.isLoading = true; // Mark as busy fetching content
            console.log(`[${this.id}] Fetching content via API for: ${promptName}`);
            
            this.updateHeaderStatus(`Loading ${promptName}...`, 'loading');

            const url = `${CONFIG.api.promptContent}${encodeURIComponent(promptName)}`;
            let content = `[Error loading content for '${promptName}']`; // Default error message

            try {
                const response = await fetch(url); // GET request
                if (!response.ok) {
                    if (response.status === 404) {
                        content = `[Prompt '${promptName}' could not be found via API]`;
                        console.warn(`[${this.id}] ${content}`);
                    } else {
                        const errorText = await response.text();
                        throw new Error(`API Error ${response.status}: ${errorText}`);
                    }
                } else {
                    const data = await response.json();
                    if (data?.success && typeof data.content === 'string') {
                        content = data.content; // Success! Store the actual content.
                        console.log(`[${this.id}] Successfully fetched content for ${promptName}.`);
                        this.updateHeaderStatus('Ready', 'success');
                    } else {
                        content = '[Invalid content data received from API]';
                        console.warn(`[${this.id}] ${content}:`, data);
                        this.updateHeaderStatus('Error', 'error');
                    }
                }
            } catch (error) { // Catches fetch network errors or errors thrown above
                console.error(`[${this.id}] Error fetching content for '${promptName}':`, error);
                content = `[Error: ${error.message}]`;
                Framework.showToast(`Failed to load content for ${promptName}.`);
                this.updateHeaderStatus('Error', 'error');
            } finally {
                this.state.promptContentsCache[promptName] = content; // Cache the final result (content or error message)
                this.state.isLoading = false; // Unmark busy state
                return content; // Return content or error string
            }
        },

        // ---------------------------------------------------------------------
        // UI Rendering Functions (Create the visual structure and update it)
        // ---------------------------------------------------------------------

        /**
         * Creates the initial HTML structure for the entire panel.
         */
        renderContentStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear previous content
            this.dom.content.className = 'panel-content'; // Ensure proper panel content class is set for scrolling

            const container = document.createElement('div');
            container.className = 'prompts-panel-container'; // Overall container for the panel

            // --- Note Element (Shown when 'prompts' action is inactive) ---
            this.dom.noteElement = document.createElement('div');
            this.dom.noteElement.className = 'panel-note info-note'; // Apply base classes
            this.dom.noteElement.innerHTML = `
                <div class="note-content">
                    <div class="note-icon">📝</div>
                    <div class="note-text">
                        <strong>Plugin Required</strong><br>
                        Start the "prompts" action to manage templates
                    </div>
                </div>
                <div class="note-action">
                    <code>start prompts</code>
                </div>
            `;
            container.appendChild(this.dom.noteElement);

            // --- Main Prompts Area (Shown when 'prompts' action is active) ---
            this.dom.promptsContainer = document.createElement('div');
            this.dom.promptsContainer.className = 'prompts-controls-area';
            this.dom.promptsContainer.style.display = this.state.promptsActive ? 'flex' : 'none'; // Initial visibility

            // Create panel header
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            
            const headerLeft = document.createElement('div');
            headerLeft.className = 'header-left';
            
            const headerTitle = document.createElement('div');
            headerTitle.className = 'header-title';
            headerTitle.textContent = 'Prompt Templates';
            
            const promptCount = document.createElement('div');
            promptCount.className = 'prompt-count';
            promptCount.textContent = '0';
            
            headerLeft.appendChild(headerTitle);
            headerLeft.appendChild(promptCount);
            
            // Right side with controls
            const headerControls = document.createElement('div');
            headerControls.className = 'header-controls';
            
            // Status text - simple version without shapes
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'status-text';
            statusIndicator.textContent = 'Ready';
            
            // Refresh button
            const refreshButton = document.createElement('button');
            refreshButton.className = 'refresh-button';
            refreshButton.innerHTML = '🔄';
            refreshButton.setAttribute('aria-label', 'Refresh prompt list');
            refreshButton.setAttribute('title', 'Refresh prompt list');
            refreshButton.addEventListener('click', () => this.fetchPromptsMetadata());
            
            headerControls.appendChild(statusIndicator);
            headerControls.appendChild(refreshButton);
            
            header.appendChild(headerLeft);
            header.appendChild(headerControls);
            
            // Save references
            this.dom.headerElement = header;
            this.dom.promptCount = promptCount;
            this.dom.statusIndicator = statusIndicator;
            
            this.dom.promptsContainer.appendChild(header);

            // Add two-column main content container
            const contentContainer = document.createElement('div');
            contentContainer.className = 'prompts-content-container';
            
            // Add left column for active prompt display and list
            const leftColumn = document.createElement('div');
            leftColumn.className = 'prompts-column left-column';
            
            // Add active prompt display section
            const activePromptSection = document.createElement('div');
            activePromptSection.className = 'active-prompt-section';
            
            const activePromptSectionHeader = document.createElement('div');
            activePromptSectionHeader.className = 'section-header';
            activePromptSectionHeader.innerHTML = `
                <h4>
                    <span class="section-icon">✓</span>
                    <span>Active Prompt</span>
                </h4>
            `;
            
            // Create active prompt display
            const activePromptDisplay = document.createElement('div');
            activePromptDisplay.className = 'active-prompt-display';
            
            this.dom.activePromptIndicator = document.createElement('div');
            this.dom.activePromptIndicator.className = 'active-prompt-value';
            this.dom.activePromptIndicator.textContent = this.state.activePrompt;
            
            activePromptDisplay.appendChild(this.dom.activePromptIndicator);
            activePromptSection.appendChild(activePromptSectionHeader);
            activePromptSection.appendChild(activePromptDisplay);
            
            // Add prompt list section
            const promptListSection = document.createElement('div');
            promptListSection.className = 'prompt-list-section';
            
            // Header with title
            const listHeader = document.createElement('div');
            listHeader.className = 'section-header';
            listHeader.innerHTML = `
                <h4>
                    <span class="section-icon">📋</span>
                    <span>Available Templates</span>
                </h4>
            `;
            
            // Search filter input
            const searchContainer = document.createElement('div');
            searchContainer.className = 'search-container';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Filter templates...';
            searchInput.addEventListener('input', (e) => this.filterPromptList(e.target.value));
            
            searchContainer.appendChild(searchInput);
            
            // The scrollable list container
            this.dom.promptList = document.createElement('div');
            this.dom.promptList.className = 'prompt-list scrollable-list';
            this.dom.promptList.setAttribute('aria-live', 'polite');
            
            // Add "Create New Prompt" button below list
            const newPromptButton = document.createElement('button');
            newPromptButton.className = 'new-prompt-button primary-button';
            newPromptButton.innerHTML = '<span class="button-icon">+</span> Create New Template';
            newPromptButton.setAttribute('title', 'Create a new prompt template');
            newPromptButton.addEventListener('click', () => this.showEditorForNew());
            
            promptListSection.appendChild(listHeader);
            promptListSection.appendChild(searchContainer);
            promptListSection.appendChild(this.dom.promptList);
            promptListSection.appendChild(newPromptButton);
            
            // Add sections to left column
            leftColumn.appendChild(activePromptSection);
            leftColumn.appendChild(promptListSection);
            
            // Add right column for the prompt editor
            const rightColumn = document.createElement('div');
            rightColumn.className = 'prompts-column right-column';
            
            // Create prompt editor section
            const editorContainer = document.createElement('div');
            editorContainer.className = 'prompt-editor-section';
            editorContainer.style.display = 'none'; // Hidden initially
            
            const editorHeader = document.createElement('div');
            editorHeader.className = 'section-header';
            
            const editorTitle = document.createElement('h4');
            editorTitle.innerHTML = `
                <span class="section-icon">✏️</span>
                <span class="editor-title-text">Edit Prompt</span>
            `;
            
            editorHeader.appendChild(editorTitle);
            
            // Create form container
            const formContainer = document.createElement('div');
            formContainer.className = 'editor-form-container';
            
            // Prompt name field
            const nameFormGroup = document.createElement('div');
            nameFormGroup.className = 'form-group';
            
            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Template Name:';
            nameLabel.setAttribute('for', 'prompt-name-input');
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.id = 'prompt-name-input';
            nameInput.className = 'prompt-name-input form-input';
            nameInput.placeholder = 'Unique name (no spaces)';
            nameInput.addEventListener('input', function() {
                this.value = this.value.replace(/\s+/g, '');
            });
            
            const nameHint = document.createElement('div');
            nameHint.className = 'input-hint';
            nameHint.textContent = 'No spaces allowed. Example: "coding", "math", "creative"';
            
            nameFormGroup.appendChild(nameLabel);
            nameFormGroup.appendChild(nameInput);
            nameFormGroup.appendChild(nameHint);
            
            // Prompt content textarea
            const contentFormGroup = document.createElement('div');
            contentFormGroup.className = 'form-group';
            
            const contentLabel = document.createElement('label');
            contentLabel.textContent = 'Template Content:';
            contentLabel.setAttribute('for', 'prompt-content-textarea');
            
            const contentTextarea = document.createElement('textarea');
            contentTextarea.id = 'prompt-content-textarea';
            contentTextarea.className = 'prompt-content-textarea form-textarea';
            contentTextarea.placeholder = 'Enter prompt system message or template text';
            contentTextarea.rows = 12;
            
            const contentHint = document.createElement('div');
            contentHint.className = 'input-hint';
            contentHint.textContent = 'System message that will be used when this prompt is active';
            
            contentFormGroup.appendChild(contentLabel);
            contentFormGroup.appendChild(contentTextarea);
            contentFormGroup.appendChild(contentHint);
            
            // Add form groups to form container
            formContainer.appendChild(nameFormGroup);
            formContainer.appendChild(contentFormGroup);
            
            // Editor action buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'editor-buttons';
            
            const saveButton = document.createElement('button');
            saveButton.className = 'save-button primary-button';
            saveButton.innerHTML = '<span class="button-icon">💾</span> Save Template';
            saveButton.addEventListener('click', () => this.handleSave());
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'cancel-button secondary-button';
            cancelButton.innerHTML = '<span class="button-icon">✕</span> Cancel';
            cancelButton.addEventListener('click', () => this.clearEditor());
            
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(saveButton);
            
            // Assemble the editor
            editorContainer.appendChild(editorHeader);
            editorContainer.appendChild(formContainer);
            editorContainer.appendChild(buttonContainer);
            
            // Store references to editor elements
            this.dom.promptEditor = {
                container: editorContainer,
                title: editorTitle,
                titleText: editorTitle.querySelector('.editor-title-text'),
                nameInput: nameInput,
                contentTextarea: contentTextarea,
                saveButton: saveButton,
                cancelButton: cancelButton
            };
            
            // Add editor to right column
            rightColumn.appendChild(editorContainer);
            
            // Create editor placeholder (shown when no prompt is being edited)
            const editorPlaceholder = document.createElement('div');
            editorPlaceholder.className = 'editor-placeholder';
            editorPlaceholder.innerHTML = `
                <div class="placeholder-icon">📝</div>
                <div class="placeholder-text">
                    <h3>Prompt Template Editor</h3>
                    <p>Select a template to edit or click "Create New Template" to create a new one.</p>
                </div>
            `;
            this.dom.editorPlaceholder = editorPlaceholder;
            rightColumn.appendChild(editorPlaceholder);
            
            // Add columns to content container
            contentContainer.appendChild(leftColumn);
            contentContainer.appendChild(rightColumn);
            
            // Add content container to main container
            this.dom.promptsContainer.appendChild(contentContainer);
            
            // Create statistics bar at the bottom
            const statsBar = document.createElement('div');
            statsBar.className = 'prompts-stats-bar';
            
            const statsContent = document.createElement('div');
            statsContent.className = 'stats-content';
            statsContent.innerHTML = 'No prompt templates loaded';
            
            statsBar.appendChild(statsContent);
            this.dom.statsElement = statsContent;
            
            this.dom.promptsContainer.appendChild(statsBar);
            
            // Add everything to the main container
            container.appendChild(this.dom.promptsContainer);
            
            // Add to panel
            this.dom.content.appendChild(container);
            
            // Update the statistics display
            this.updateStatistics();
        },
        
        /**
         * Add component-specific styles to match other panels
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Base container */
                .prompts-panel-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    background-color: var(--color-white);
                    font-size: 13px;
                }
                
                /* Plugin Required Note */
                .panel-note {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    justify-content: center;
                    align-items: center;
                    background-color: #fff8e1;
                    color: #ff8f00;
                    border: 1px solid #ffe082;
                    border-radius: 6px;
                    margin: 12px;
                    padding: 20px;
                    text-align: center;
                    gap: 15px;
                }
                
                .note-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .note-icon {
                    font-size: 24px;
                    opacity: 0.8;
                }
                
                .note-text {
                    text-align: left;
                    line-height: 1.4;
                }
                
                .note-action {
                    margin-top: 10px;
                }
                
                .note-action code {
                    background-color: #fff3e0;
                    border: 1px solid #ffe0b2;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-family: monospace;
                    color: #e65100;
                }
                
                /* Main prompts container active */
                .prompts-controls-area {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                /* Header styling */
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
                    color: var(--color-primary-dark);
                }
                
                .prompt-count {
                    background-color: var(--color-primary);
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                    height: 18px;
                    min-width: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 9px;
                    padding: 0 5px;
                }
                
                .header-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .status-text {
                    font-size: 11px;
                    color: #757575;
                }
                
                .status-text.loading {
                    color: #2196f3;
                }
                
                .status-text.success {
                    color: #4caf50;
                }
                
                .status-text.error {
                    color: #f44336;
                }
                
                .refresh-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    color: var(--color-primary);
                    padding: 2px 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 3px;
                    transition: all 0.2s;
                }
                
                .refresh-button:hover {
                    background-color: rgba(74, 118, 168, 0.1);
                    transform: scale(1.1);
                }
                
                /* Main content layout */
                .prompts-content-container {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .prompts-column {
                    height: 100%;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                
                .left-column {
                    flex: 4;
                    min-width: 180px;
                    border-right: 1px solid #e0e0e0;
                    background-color: #fafafa;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden; /* Prevent overflow at the column level */
                }
                
                .right-column {
                    flex: 6;
                    min-width: 200px;
                    background-color: #ffffff;
                    position: relative;
                }
                
                /* Active prompt section */
                .active-prompt-section {
                    border-bottom: 1px solid #e0e0e0;
                    padding-bottom: 10px;
                    flex-shrink: 0; /* Prevent this section from shrinking when list grows */
                }
                
                .section-header {
                    padding: 10px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                    flex-shrink: 0; /* Prevent headers from shrinking */
                }
                
                .section-header h4 {
                    margin: 0;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--color-primary-dark);
                }
                
                .section-icon {
                    opacity: 0.7;
                }
                
                .active-prompt-display {
                    padding: 10px;
                }
                
                .active-prompt-value {
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    border-radius: 4px;
                    background-color: #e3f2fd;
                    border: 1px solid #bbdefb;
                    font-family: monospace;
                    position: relative;
                    font-weight: bold;
                    color: #0277bd;
                }
                
                .active-prompt-value:before {
                    content: "✓";
                    margin-right: 6px;
                    color: #00c853;
                    font-weight: bold;
                }
                
                /* Prompt list section */
                .prompt-list-section {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow: hidden;
                    min-height: 0; /* Critical for proper flexbox scrolling */
                }
                
                .search-container {
                    padding: 10px;
                    border-bottom: 1px solid #e0e0e0;
                    background-color: #f1f1f1;
                    flex-shrink: 0; /* Prevent search from shrinking */
                }
                
                .search-input {
                    width: 100%;
                    padding: 6px 8px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: white;
                    font-size: 12px;
                }
                
                .search-input:focus {
                    border-color: var(--color-primary);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 118, 168, 0.2);
                }
                
                .prompt-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 5px;
                    min-height: 0; /* Critical for proper flexbox scrolling */
                }
                
                .prompt-item {
                    margin-bottom: 5px;
                    border-radius: 4px;
                    overflow: hidden;
                    background-color: white;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }
                
                .prompt-item:hover {
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transform: translateY(-1px);
                }
                
                .prompt-item.active {
                    border-color: #bbdefb;
                    background-color: #e3f2fd;
                }
                
                .prompt-name-row {
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    cursor: pointer;
                }
                
                .prompt-name {
                    flex: 1;
                    font-weight: bold;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .prompt-item.active .prompt-name {
                    color: #0277bd;
                }
                
                .prompt-icon {
                    margin-right: 6px;
                    opacity: 0.7;
                }
                
                .prompt-actions {
                    display: flex;
                    border-top: 1px solid #f0f0f0;
                    background-color: #fafafa;
                }
                
                .prompt-action-button {
                    flex: 1;
                    padding: 4px 8px;
                    background: none;
                    border: none;
                    font-size: 11px;
                    cursor: pointer;
                    color: #555;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                }
                
                .prompt-action-button:not(:last-child) {
                    border-right: 1px solid #f0f0f0;
                }
                
                .prompt-action-button:hover {
                    background-color: #f0f0f0;
                    color: #333;
                }
                
                .prompt-action-button.use-button {
                    color: #0277bd;
                }
                
                .prompt-action-button.use-button:hover {
                    background-color: #e3f2fd;
                }
                
                .prompt-action-button.edit-button {
                    color: #f57c00;
                }
                
                .prompt-action-button.edit-button:hover {
                    background-color: #fff3e0;
                }
                
                .prompt-action-button.delete-button {
                    color: #e53935;
                }
                
                .prompt-action-button.delete-button:hover {
                    background-color: #ffebee;
                }
                
                .prompt-action-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: none !important;
                }
                
                .new-prompt-button {
                    margin: 10px;
                    align-self: center;
                    flex-shrink: 0; /* Prevent button from shrinking */
                }
                
                /* Editor section */
                .prompt-editor-section {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                
                .editor-form-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }
                
                .form-group {
                    margin-bottom: 15px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #555;
                }
                
                .form-input, .form-textarea {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    font-size: 13px;
                    background-color: #fff;
                    transition: all 0.2s;
                }
                
                .form-input:focus, .form-textarea:focus {
                    border-color: var(--color-primary);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 118, 168, 0.2);
                }
                
                .form-input.is-invalid {
                    border-color: #f44336;
                    background-color: #ffebee;
                }
                
                .form-textarea {
                    min-height: 200px;
                    resize: vertical;
                    font-family: monospace;
                    line-height: 1.4;
                }
                
                .input-hint {
                    font-size: 11px;
                    color: #757575;
                    margin-top: 4px;
                }
                
                .editor-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                }
                
                /* Editor placeholder */
                .editor-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 20px;
                    text-align: center;
                    color: #9e9e9e;
                    background-color: #fafafa;
                }
                
                .placeholder-icon {
                    font-size: 40px;
                    margin-bottom: 20px;
                    opacity: 0.7;
                }
                
                .placeholder-text h3 {
                    color: #757575;
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                
                .placeholder-text p {
                    line-height: 1.5;
                }
                
                /* Stats bar */
                .prompts-stats-bar {
                    display: flex;
                    padding: 8px 10px;
                    font-size: 11px;
                    color: #757575;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                }
                
                .stats-content {
                    display: flex;
                    gap: 15px;
                }
                
                /* Shared button styles */
                .primary-button, .secondary-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                }
                
                .primary-button {
                    background-color: var(--color-primary);
                    color: white;
                }
                
                .primary-button:hover {
                    background-color: var(--color-primary-dark);
                }
                
                .secondary-button {
                    background-color: #f5f5f5;
                    color: #555;
                    border: 1px solid #e0e0e0;
                }
                
                .secondary-button:hover {
                    background-color: #e0e0e0;
                }
                
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .button-icon {
                    font-size: 14px;
                }
                
                /* Messages */
                .empty-list-message {
                    padding: 20px;
                    text-align: center;
                    color: #9e9e9e;
                    font-style: italic;
                }
                
                .loading-placeholder {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 10px;
                    padding: 20px;
                    color: #757575;
                }
                
                .loading-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* Custom scrollbar */
                .prompt-list::-webkit-scrollbar,
                .editor-form-container::-webkit-scrollbar {
                    width: 6px;
                }
                
                .prompt-list::-webkit-scrollbar-track,
                .editor-form-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .prompt-list::-webkit-scrollbar-thumb,
                .editor-form-container::-webkit-scrollbar-thumb {
                    background: #bbb;
                    border-radius: 3px;
                }
                
                .prompt-list::-webkit-scrollbar-thumb:hover,
                .editor-form-container::-webkit-scrollbar-thumb:hover {
                    background: #999;
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
         * Update the header status text
         * @param {string} text - Status text to display
         * @param {string} state - Status state ('loading', 'success', 'error')
         */
        updateHeaderStatus: function(text, state) {
            if (!this.dom.statusIndicator) return;
            
            // Update text
            this.dom.statusIndicator.textContent = text;
            
            // Update state classes
            this.dom.statusIndicator.classList.remove('loading', 'success', 'error');
            if (state) {
                this.dom.statusIndicator.classList.add(state);
            }
        },
        
        /**
         * Update statistics display
         */
        updateStatistics: function() {
            if (!this.dom.statsElement) return;
            
            const promptCount = this.state.promptNames.length;
            const lastUpdate = this.state.lastUpdate ? new Date(this.state.lastUpdate).toLocaleTimeString() : 'Never';
            
            // Update prompt count badge
            if (this.dom.promptCount) {
                this.dom.promptCount.textContent = promptCount;
            }
            
            let statsHTML = '';
            
            if (promptCount > 0) {
                statsHTML = `
                    <div class="stats-item"><span class="stats-icon">📁</span> Templates: ${promptCount}</div>
                    <div class="stats-item"><span class="stats-icon">✓</span> Active: ${this.state.activePrompt}</div>
                    <div class="stats-item"><span class="stats-icon">🕒</span> Updated: ${lastUpdate}</div>
                `;
            } else {
                statsHTML = 'No prompt templates loaded';
            }
            
            this.dom.statsElement.innerHTML = statsHTML;
        },
        
        /**
         * Renders the list of prompt names in the UI, adding buttons for actions.
         */
        renderPromptList: function() {
            if (!this.dom.promptList) return;
            const list = this.dom.promptList;
            list.innerHTML = ''; // Clear previous items before rendering

            // Show loading message if appropriate
            if (this.state.isLoading && this.state.promptNames.length === 0) {
                list.innerHTML = `
                    <div class="loading-placeholder">
                        <div class="loading-spinner"></div>
                        <div>Loading templates...</div>
                    </div>
                `;
                return;
            }
            
            // Show message if no prompts are available after loading
            if (!this.state.promptNames || this.state.promptNames.length === 0) {
                list.innerHTML = `
                    <div class="empty-list-message">
                        No prompt templates found.
                        <br><br>
                        Click "Create New Template" to add one.
                    </div>
                `;
                return;
            }

            // Sort names for consistent order and render each prompt item
            this.state.promptNames.sort().forEach(promptName => {
                const item = document.createElement('div');
                item.className = 'prompt-item';
                // Highlight the currently active prompt
                if (promptName === this.state.activePrompt) {
                    item.classList.add('active');
                }
                
                // Name row (clickable to edit)
                const nameRow = document.createElement('div');
                nameRow.className = 'prompt-name-row';
                nameRow.addEventListener('click', () => this.editPrompt(promptName));
                
                const promptIcon = document.createElement('span');
                promptIcon.className = 'prompt-icon';
                promptIcon.textContent = promptName === this.state.activePrompt ? '✓' : '📄';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'prompt-name';
                nameSpan.textContent = promptName;
                nameSpan.title = `Edit '${promptName}'`;
                
                nameRow.appendChild(promptIcon);
                nameRow.appendChild(nameSpan);
                item.appendChild(nameRow);
                
                // Actions row with buttons
                const actionsRow = document.createElement('div');
                actionsRow.className = 'prompt-actions';
                
                // "Use" button
                const useButton = document.createElement('button');
                useButton.className = 'prompt-action-button use-button';
                useButton.innerHTML = '<span class="action-icon">▶️</span> Use';
                useButton.title = `Activate '${promptName}' prompt`;
                useButton.disabled = (promptName === this.state.activePrompt);
                useButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.usePrompt(promptName);
                });
                actionsRow.appendChild(useButton);
                
                // "Edit" button
                const editButton = document.createElement('button');
                editButton.className = 'prompt-action-button edit-button';
                editButton.innerHTML = '<span class="action-icon">✏️</span> Edit';
                editButton.title = `Edit '${promptName}' details`;
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editPrompt(promptName);
                });
                actionsRow.appendChild(editButton);
                
                // "Delete" button (Only if not the 'default' prompt)
                if (promptName.toLowerCase() !== 'default') {
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'prompt-action-button delete-button';
                    deleteButton.innerHTML = '<span class="action-icon">🗑️</span> Delete';
                    deleteButton.title = `Delete '${promptName}'`;
                    deleteButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deletePrompt(promptName);
                    });
                    actionsRow.appendChild(deleteButton);
                }
                
                item.appendChild(actionsRow);
                list.appendChild(item);
            });
            
            // Update statistics
            this.updateStatistics();
        },
        
        /**
         * Filter the prompt list based on search input
         * @param {string} query - Search query string
         */
        filterPromptList: function(query) {
            if (!this.dom.promptList) return;
            
            const normalizedQuery = query.trim().toLowerCase();
            const promptItems = this.dom.promptList.querySelectorAll('.prompt-item');
            
            if (promptItems.length === 0) return;
            
            let visibleCount = 0;
            
            promptItems.forEach(item => {
                const promptName = item.querySelector('.prompt-name').textContent.toLowerCase();
                const shouldShow = promptName.includes(normalizedQuery);
                
                item.style.display = shouldShow ? 'block' : 'none';
                
                if (shouldShow) {
                    visibleCount++;
                    
                    // Apply search highlighting if query is not empty
                    const nameElement = item.querySelector('.prompt-name');
                    if (normalizedQuery && nameElement) {
                        const regex = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'gi');
                        nameElement.innerHTML = promptName.replace(regex, '<span class="search-highlight">$1</span>');
                    } else if (nameElement) {
                        nameElement.textContent = promptName;
                    }
                }
            });
            
            // Show "no results" message if all items are filtered out
            let noResultsElement = this.dom.promptList.querySelector('.no-results-message');
            
            if (visibleCount === 0 && normalizedQuery) {
                if (!noResultsElement) {
                    noResultsElement = document.createElement('div');
                    noResultsElement.className = 'empty-list-message no-results-message';
                    noResultsElement.textContent = `No templates match "${query}"`;
                    this.dom.promptList.appendChild(noResultsElement);
                } else {
                    noResultsElement.textContent = `No templates match "${query}"`;
                    noResultsElement.style.display = 'block';
                }
            } else if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }
            
            // Helper function to escape special regex characters
            function escapeRegExp(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
        },

        /**
         * Updates the displayed active prompt name in the UI.
         * Also triggers a list re-render to update highlighting and button states.
         */
        updateActivePromptDisplay: function() {
            if (this.dom.activePromptIndicator) {
                this.dom.activePromptIndicator.textContent = this.state.activePrompt || 'default';
            }
            // Re-rendering the list ensures the correct item is highlighted and 'Use' buttons are disabled/enabled
            this.renderPromptList();
        },

        // ---------------------------------------------------------------------
        // Editor State Management and Actions
        // ---------------------------------------------------------------------

        /** Shows the editor panel, configured for creating a new prompt. */
        showEditorForNew: function() {
            if (!this.dom.promptEditor) return;
            
            this.state.editingPromptName = null; // Clear editing state
            
            // Update editor title
            this.dom.promptEditor.titleText.textContent = 'Create New Template';
            
            // Reset form fields
            this.dom.promptEditor.nameInput.value = '';
            this.dom.promptEditor.contentTextarea.value = '';
            this.dom.promptEditor.nameInput.disabled = false; // Allow name input
            this.dom.promptEditor.nameInput.classList.remove('is-invalid'); // Clear validation style
            this.dom.promptEditor.contentTextarea.disabled = false; // Ensure content is editable
            this.dom.promptEditor.contentTextarea.placeholder = 'Enter prompt system message or template text';
            
            // Update button
            this.dom.promptEditor.saveButton.innerHTML = '<span class="button-icon">💾</span> Create Template';
            this.dom.promptEditor.saveButton.disabled = false; // Enable save
            this.dom.promptEditor.cancelButton.disabled = false; // Enable cancel
            
            // Show editor, hide placeholder
            this.dom.promptEditor.container.style.display = 'flex'; // Make editor visible
            this.dom.editorPlaceholder.style.display = 'none'; // Hide placeholder
            
            // Focus name field
            this.dom.promptEditor.nameInput.focus();
        },

        /**
         * Shows the editor panel, configured for editing an existing prompt.
         * Fetches prompt content via API if it's not already cached.
         */
        editPrompt: async function(promptName) {
            if (!this.dom.promptEditor) return;
            console.log(`[${this.id}] Edit requested for: ${promptName}`);

            // Set editing state immediately
            this.state.editingPromptName = promptName;

            // Configure editor fields for editing mode
            this.dom.promptEditor.titleText.textContent = `Edit Template: ${promptName}`;
            this.dom.promptEditor.nameInput.value = promptName;
            this.dom.promptEditor.nameInput.disabled = true; // Prevent changing name via edit
            this.dom.promptEditor.nameInput.classList.remove('is-invalid');
            this.dom.promptEditor.contentTextarea.value = ''; // Clear while loading
            this.dom.promptEditor.contentTextarea.placeholder = 'Loading content...';
            this.dom.promptEditor.contentTextarea.disabled = true; // Disable during load
            this.dom.promptEditor.saveButton.innerHTML = '<span class="button-icon">💾</span> Update Template';
            this.dom.promptEditor.saveButton.disabled = true; // Disable until content loaded
            this.dom.promptEditor.cancelButton.disabled = false; // Cancel should always be enabled
            
            // Show editor, hide placeholder
            this.dom.promptEditor.container.style.display = 'flex';
            this.dom.editorPlaceholder.style.display = 'none';

            try {
                // Fetch content (uses cache if available, otherwise API call)
                const content = await this.fetchPromptContent(promptName);
                
                // Check if the user hasn't cancelled or switched editing context while loading
                if (this.dom.promptEditor && this.state.editingPromptName === promptName) {
                    this.dom.promptEditor.contentTextarea.value = content;
                    this.dom.promptEditor.contentTextarea.placeholder = 'Enter prompt system message or template text';
                    this.dom.promptEditor.contentTextarea.disabled = false; // Re-enable
                    this.dom.promptEditor.saveButton.disabled = false;     // Re-enable
                    this.dom.promptEditor.contentTextarea.focus();        // Focus content area
                }
            } catch (error) { // fetchPromptContent should cache the error msg
                 if (this.dom.promptEditor && this.state.editingPromptName === promptName) {
                     // Display error in textarea but still enable save (maybe user wants to overwrite bad data)
                     this.dom.promptEditor.contentTextarea.value = `[Failed to load content. Error: ${this.state.promptContentsCache[promptName] || 'Unknown'}]`;
                     this.dom.promptEditor.contentTextarea.disabled = false;
                     this.dom.promptEditor.saveButton.disabled = false;
                     this.dom.promptEditor.contentTextarea.placeholder = 'Enter prompt system message or template text';
                 }
            }
        },

        /** Clears editor fields, resets editing state, and hides the editor panel. */
        clearEditor: function() {
            if (!this.dom.promptEditor) return;
            
            this.dom.promptEditor.nameInput.value = '';
            this.dom.promptEditor.contentTextarea.value = '';
            this.dom.promptEditor.nameInput.disabled = false;
            this.dom.promptEditor.nameInput.classList.remove('is-invalid');
            this.state.editingPromptName = null; // Reset editing context
            
            // Hide editor, show placeholder
            this.dom.promptEditor.container.style.display = 'none';
            this.dom.editorPlaceholder.style.display = 'flex';
        },

        // ---------------------------------------------------------------------
        // Action Handlers (Interact with the backend by sending commands)
        // ---------------------------------------------------------------------

        /** Handles the Save/Create/Update button click. Validates input and sends 'prompt set' command. */
        handleSave: function() {
            if (!this.dom.promptEditor) return;
            
            const nameInput = this.dom.promptEditor.nameInput;
            const contentTextarea = this.dom.promptEditor.contentTextarea;
            const isCreating = (this.state.editingPromptName === null);
            const promptName = isCreating ? nameInput.value.trim() : this.state.editingPromptName; // Get name from input if creating, else from state
            const content = contentTextarea.value.trim(); // Content always from textarea

            // --- Basic Validation ---
            nameInput.classList.remove('is-invalid'); // Reset validation style
            if (!promptName || !content) {
                Framework.showToast('Template Name and Content are required.');
                if (!promptName) nameInput.classList.add('is-invalid'); // Highlight missing name
                return;
            }
            
            // Validate name format (no spaces) only when *creating*
            if (isCreating && /\s/.test(promptName)) {
                Framework.showToast('Template Name cannot contain spaces.');
                nameInput.classList.add('is-invalid');
                nameInput.focus();
                return;
            }
            
            // Check if creating a prompt with a name that already exists
            if (isCreating && this.state.promptNames.includes(promptName)) {
                if (!confirm(`A template named '${promptName}' already exists. Overwrite it?`)) {
                    nameInput.focus();
                    return;
                }
            }

            // --- Prepare and Send Command ---
            const actionType = isCreating ? 'Creating' : 'Updating';
            console.log(`[${this.id}] ${actionType} prompt: ${promptName}`);

            // Disable buttons and show saving state
            this.dom.promptEditor.saveButton.disabled = true;
            this.dom.promptEditor.cancelButton.disabled = true;
            this.dom.promptEditor.saveButton.innerHTML = '<span class="button-icon">⏳</span> Saving...';
            
            // Update header status
            this.updateHeaderStatus('Saving...', 'loading');

            const command = `prompt set ${promptName} ${content}`; // Backend handles create vs update via 'set'

            fetch(CONFIG.api.submitInput, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: command
            })
            .then(response => {
                if (!response.ok) { throw new Error(`Command execution failed: ${response.status} ${response.statusText}`); }
                return response.text();
            })
            .then(() => {
                // Allow backend time to process file writes, etc. before refreshing the UI
                setTimeout(() => {
                    Framework.showToast(`Template '${promptName}' saved successfully.`);
                    this.state.promptContentsCache[promptName] = content; // Update cache immediately
                    this.clearEditor(); // Hide editor panel
                    
                    // Update header status
                    this.updateHeaderStatus('Saved', 'success');
                    
                    // Fetch *all* metadata again from backend to get the latest state reliably
                    this.fetchPromptsMetadata();
                }, 700); // Delay allows backend to finish saving
            })
            .catch(error => {
                console.error(`[${this.id}] Error sending save command for '${promptName}':`, error);
                Framework.showToast(`Error saving template: ${error.message}`);
                
                // Update header status
                this.updateHeaderStatus('Error', 'error');
                
                // Re-enable buttons on failure so user can try again
                if(this.dom.promptEditor) {
                    this.dom.promptEditor.saveButton.disabled = false;
                    this.dom.promptEditor.cancelButton.disabled = false;
                    this.dom.promptEditor.saveButton.innerHTML = isCreating ? 
                        '<span class="button-icon">💾</span> Create Template' : 
                        '<span class="button-icon">💾</span> Update Template';
                }
            });
        },

        /** Sends command to delete a prompt. */
        deletePrompt: function(promptName) {
            if (promptName.toLowerCase() === 'default') {
                Framework.showToast("The 'default' template cannot be deleted.");
                return;
            }
            
            if (!confirm(`Delete the template '${promptName}'? This cannot be undone.`)) return;

            console.log(`[${this.id}] Deleting prompt: ${promptName}`);
            
            // Show deleting state
            this.updateHeaderStatus('Deleting...', 'loading');
            
            const command = `prompt delete ${promptName}`;

            fetch(CONFIG.api.submitInput, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: command
            })
            .then(response => {
                if (!response.ok) { throw new Error(`Delete failed: ${response.status} ${response.statusText}`); }
                return response.text();
            })
            .then(() => {
                setTimeout(() => { // Allow backend time
                    Framework.showToast(`Template '${promptName}' deleted.`);
                    delete this.state.promptContentsCache[promptName]; // Clear from cache
                    if (this.state.editingPromptName === promptName) this.clearEditor(); // Close editor if deleting the edited item
                    
                    // Update header status
                    this.updateHeaderStatus('Deleted', 'success');
                    
                    // Refresh metadata
                    this.fetchPromptsMetadata();
                }, 500);
            })
            .catch(error => {
                console.error(`[${this.id}] Error sending delete command for '${promptName}':`, error);
                Framework.showToast(`Error deleting template: ${error.message}`);
                
                // Update header status
                this.updateHeaderStatus('Error', 'error');
            });
        },

        /** Sends command to set the active prompt. */
        usePrompt: function(promptName) {
            if (this.state.activePrompt === promptName) return; // Already active

            console.log(`[${this.id}] Activating prompt: ${promptName}`);
            
            // Show activating state
            this.updateHeaderStatus(`Activating ${promptName}...`, 'loading');
            
            const command = `prompt use ${promptName}`;

            // Disable all 'Use' buttons temporarily for visual feedback
            const useButtons = this.dom.promptList?.querySelectorAll('.use-button');
            if (useButtons) {
                useButtons.forEach(btn => btn.disabled = true);
            }

            fetch(CONFIG.api.submitInput, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: command
            })
            .then(response => {
                if (!response.ok) { throw new Error(`Activation failed: ${response.status} ${response.statusText}`); }
                return response.text();
            })
            .then(() => {
                // Update UI optimistically for better perceived responsiveness
                this.state.activePrompt = promptName;
                this.updateActivePromptDisplay(); // This re-renders the list correctly
                Framework.showToast(`Template '${promptName}' activated.`);
                
                // Update header status
                this.updateHeaderStatus('Ready', 'success');
            })
            .catch(error => {
                console.error(`[${this.id}] Error sending use command for '${promptName}':`, error);
                Framework.showToast(`Error activating template: ${error.message}`);
                
                // Update header status
                this.updateHeaderStatus('Error', 'error');
                
                // On error, re-fetch the *actual* state from backend to ensure UI is correct
                this.fetchPromptsMetadata();
            });
        },

        /** Clean up component resources (e.g., event listeners) when panel is destroyed. */
        cleanup: function() {
            this.state.subscriptions.forEach(sub => Framework.off(sub.event, sub.id));
            this.state.subscriptions = [];
            console.log(`[${this.id}] Cleaned up listeners.`);
        }
    };

    // Register component with the framework
    Framework.registerComponent(component.id, component);

})(); // IIFE restricts scope