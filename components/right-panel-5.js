/**
 * ==============================================================================================
 * Right Panel 5 - Word Block Manager (Updated for Active Check & Initial Visibility)
 * ==============================================================================================
 *
 * This panel provides a user interface for the block.py module functionality.
 * Displays controls only when the 'block' action is active. Shows note otherwise.
 * Allows viewing, adding, removing blocked words, and toggling the action.
 *
 * @version 1.2.0 - Fixed initial blank state, structure rendered unconditionally.
 */

(function() {
    // Component definition
    const component = {
        id: 'right-panel-5',

        // DOM references
        dom: {
            content: null,
            noteElement: null,      // To display "Plugin Required" message
            blockContainer: null,   // Holds the main panel UI when active
            statusIndicator: null,  // Control specific
            toggleButton: null,     // Control specific
            wordList: null,         // Control specific
            addWordForm: null,      // Control specific
            addWordInput: null      // Control specific
        },

        // Component state
        state: {
            isBlockActive: false,
            blockedWords: [],
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }

            // *** RENDER STRUCTURE UNCONDITIONALLY ***
            this.renderContentStructure();

            // Subscribe to active actions changes
            const actionSubscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateBlockState(data.actions);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: actionSubscription });

            // Subscribe to chat updates for word list changes (only relevant if active)
            const chatSubscription = Framework.on('chatUpdated', (data) => {
                // Process only if the block action *is currently believed to be active* by the panel
                // This prevents unnecessary processing when the panel is hidden.
                if (this.state.isBlockActive && data?.messages?.length) {
                    this.checkForBlockListUpdates(data.messages);
                }
            });
            this.state.subscriptions.push({ event: 'chatUpdated', id: chatSubscription });

            // Check initial state on load
            this.checkInitialBlockState();
             console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Check initial state of "block" action
         */
        checkInitialBlockState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    this.updateBlockState(data?.actions || []);
                })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial block state:`, error);
                    this.updateBlockState([]); // Assume inactive on error
                });
        },

        /**
         * Update component state based on block active status and update UI
         * @param {Array} actions - Active actions array
         */
        updateBlockState: function(actions = []) {
            const isActive = actions.some(action => {
                const [name] = action.split(':');
                return name.trim().toLowerCase() === 'block';
            });
            const stateChanged = this.state.isBlockActive !== isActive;

            // Update state first
            this.state.isBlockActive = isActive;

            // Always update visibility
            this.updateUIVisibility(); // << MOVED

            if (stateChanged) {
                console.log(`[${this.id}] Block Action Active State Changed: ${isActive}`);

                 if (isActive) {
                     // Render controls if becoming active and not already rendered
                     if (!this.dom.statusIndicator) {
                        this.renderBlockControls();
                     }
                     // Always fetch list when activated (or re-activated)
                     this.getBlockedWordsList();
                 } else {
                    // Clear local word list when deactivated
                     this.state.blockedWords = [];
                     // Optionally clear the display list visually if controls exist
                     if (this.dom.wordList) {
                         this.updateWordListDisplay(); // Will show 'empty' message
                     }
                 }

                 // Always update dynamic UI (button/status) if controls exist
                 if (this.dom.statusIndicator || this.dom.toggleButton) {
                     this.updateDynamicUIElements();
                 }
            } else {
                 // State didn't change, but if active, update dynamic elements (could be redundant but safe)
                 if (isActive && (this.dom.statusIndicator || this.dom.toggleButton)) {
                     this.updateDynamicUIElements();
                 }
                 // If state didn't change, but active, also potentially refresh list display
                 // This might catch cases where list changed but activation state didn't
                 // Be cautious with performance if chatUpdated isn't reliable
                 // if (isActive && this.dom.wordList) {
                 //    this.updateWordListDisplay();
                 // }
            }
        },

         /**
         * Update visibility of note vs main container
         */
        updateUIVisibility: function() {
             if (this.dom.noteElement) {
                 this.dom.noteElement.style.display = this.state.isBlockActive ? 'none' : 'block';
             }
             if (this.dom.blockContainer) {
                 this.dom.blockContainer.style.display = this.state.isBlockActive ? 'block' : 'none';
             }
         },


        /**
         * Get the list of blocked words by sending a command (only if active)
         */
        getBlockedWordsList: function() {
            if (!this.state.isBlockActive) {
                // console.log(`[${this.id}] Skipping word list fetch - action inactive.`);
                return; // Don't fetch if not active
            }
             console.log(`[${this.id}] Requesting blocked words list via command.`);
             // Send "block list" command using Framework helper
             Framework.sendMessage('block list');
             // The 'chatUpdated' event listener will hopefully pick up the response.
             // Add a slight delay then check manually as a backup? Risky.
             // setTimeout(() => this.findListInChatHistory(), 1200); // Potential backup
        },


        /**
         * Check for block list updates in chat messages (Event-driven approach)
         */
        checkForBlockListUpdates: function(messages) {
            // Ensure messages is an array and we are active
            if (!this.state.isBlockActive || !Array.isArray(messages) || messages.length === 0) {
                 return;
            }

            let listUpdated = false;
            let fullListFound = false;

            // Search backwards for relevant messages
            for (let i = messages.length - 1; i >= Math.max(0, messages.length - 5); i--) {
                const message = messages[i];
                // Ensure message is a string before using includes/match
                 if (typeof message !== 'string') continue;

                // --- Look for the Full List ---
                if (message.includes('[BLOCK ACTION: Blocked words:')) {
                    const match = message.match(/\[BLOCK ACTION: Blocked words: (.*)\]/);
                    if (match && match[1]) {
                        // Parse the list from the message
                        const receivedListRaw = match[1];
                        const newList = (receivedListRaw === 'No words are currently blocked.')
                            ? []
                            : receivedListRaw.split(',').map(word => word.trim()).filter(Boolean).sort(); // Clean, filter empty, sort

                        const currentListSorted = [...this.state.blockedWords].sort(); // Ensure comparison is consistent

                        // Check if the received list is actually different
                        if (JSON.stringify(newList) !== JSON.stringify(currentListSorted)) {
                            console.log(`[${this.id}] Detected new block list from chat:`, newList);
                            this.state.blockedWords = newList; // Update state (already sorted)
                            listUpdated = true; // Mark that an update occurred
                        } else {
                           // console.log(`[${this.id}] Received block list is identical to current state.`);
                        }
                        fullListFound = true;
                        break; // Found the latest full list, no need to check older messages for the list itself
                    }
                // --- Look for Confirmation of Add/Remove/Reload (triggers full list fetch) ---
                } else if (message.includes('[BLOCK ACTION: Added') || message.includes('[BLOCK ACTION: Removed') || message.includes('[BLOCK ACTION: Reloaded')) {
                     // Don't break here, we still want to check newer messages for the actual list if possible.
                     // If we reach the end without finding a full list, trigger a manual fetch.
                     console.log(`[${this.id}] Detected add/remove/reload confirmation in chat. Will ensure list is refreshed.`);
                     // This confirmation suggests a list *might* have changed.
                }
            }

            // --- Post-Loop Actions ---
            if (listUpdated) {
                 this.updateWordListDisplay(); // Render the changes if list content changed
            } else if (!fullListFound && messages.some(m => typeof m === 'string' && (m.includes('[BLOCK ACTION: Added') || m.includes('[BLOCK ACTION: Removed') || m.includes('[BLOCK ACTION: Reloaded')))) {
                 // If we saw a confirmation but didn't find a subsequent list message in the recent history,
                 // it's safer to request the full list again.
                 console.log(`[${this.id}] Saw add/remove/reload confirmation but no full list, triggering explicit refresh.`);
                 this.getBlockedWordsList(); // Trigger refresh
            }
        },

        /**
         * Render the basic panel structure (Warning Note + Main Container)
         */
        renderContentStructure: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear

            // --- Create Warning Note ---
            const noteElement = document.createElement('div');
            noteElement.className = 'plugin-required-note'; // Shared class
            noteElement.innerHTML = `<strong>Plugin Required</strong><br>Start the "block" plugin to manage word censorship.<br><br><em>Example command:</em> <code>start block</code>`;
            noteElement.style.display = 'none'; // Initially hidden
            this.dom.noteElement = noteElement; // Cache
            this.dom.content.appendChild(noteElement);

            // --- Create Main Container ---
            const blockContainer = document.createElement('div');
            blockContainer.className = `${this.id}-main-container`; // Specific class
            blockContainer.style.display = 'none'; // Initially hidden
            blockContainer.style.height = '100%';
            blockContainer.style.overflowY = 'auto'; // Ensure scrollable if needed
            this.dom.blockContainer = blockContainer; // Cache
            this.dom.content.appendChild(blockContainer);

            // Add common styles for the note
            this.addBaseStyles(); // Use shared style method
        },

        /**
         * Render component controls content *inside* the main container
         */
        renderBlockControls: function() {
            // Ensure container exists
            if (!this.dom.blockContainer) {
                console.error(`[${this.id}] Block container not found, cannot render controls.`);
                return;
            }
             this.dom.blockContainer.innerHTML = ''; // Clear placeholder

            console.log(`[${this.id}] Rendering Block controls...`);

            const container = document.createElement('div');
            container.className = 'block-panel'; // Inner container class

            // Block status section
            const statusSection = document.createElement('div');
            statusSection.className = 'status-section control-section'; // Style class

            const statusHeader = document.createElement('div');
            statusHeader.className = 'section-header';
            const statusTitle = document.createElement('h4');
            statusTitle.textContent = 'Word Censorship Status';
            statusTitle.style.margin = '0';
            statusTitle.style.flexGrow = '1';
            statusHeader.appendChild(statusTitle);
            const statusIndicatorContainer = document.createElement('div'); // Wrapper for alignment
            statusIndicatorContainer.style.display = 'flex';
            statusIndicatorContainer.style.alignItems = 'center';
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'status-indicator'; // Target class
            // Cache immediately
            this.dom.statusIndicator = statusIndicator;
            statusIndicatorContainer.appendChild(statusIndicator);
            statusHeader.appendChild(statusIndicatorContainer);
            statusSection.appendChild(statusHeader);

            const statusContent = document.createElement('div');
            statusContent.className = 'section-content'; // Style class
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-button'; // Target class
            toggleButton.addEventListener('click', () => this.toggleBlock());
            // Cache immediately
            this.dom.toggleButton = toggleButton;
            statusContent.appendChild(toggleButton);
            statusSection.appendChild(statusContent);
            container.appendChild(statusSection);

            // Block explanation section
            const explanationSection = document.createElement('div');
            explanationSection.className = 'explanation-section control-section'; // Style class
            const explanationHeader = document.createElement('div');
            explanationHeader.className = 'section-header';
            const explanationTitle = document.createElement('h4');
            explanationTitle.textContent = 'About Word Block (Priority 6.5)';
            explanationTitle.style.margin = '0';
            explanationHeader.appendChild(explanationTitle);
            explanationSection.appendChild(explanationHeader);
            const explanationContent = document.createElement('div');
            explanationContent.className = 'section-content'; // Style class
            const explanationText = document.createElement('p');
            explanationText.className = 'explanation-text'; // Style class
            explanationText.innerHTML = `
                The Word Block action censors configured words
                in the AI's final response. When active, it finds exact (case-insensitive) matches and replaces them with <code>[CENSORED]</code>.
                <br>Manage the list of words below. Use <code>block reload</code> to refresh from the server file if edited externally.
            `;
            explanationContent.appendChild(explanationText);
            explanationSection.appendChild(explanationContent);
            container.appendChild(explanationSection);

            // Blocked words management section
            const wordsSection = document.createElement('div');
            wordsSection.className = 'words-section control-section'; // Style class
            const wordsHeader = document.createElement('div');
            wordsHeader.className = 'section-header';
            const wordsTitle = document.createElement('h4');
            wordsTitle.textContent = 'Manage Blocked Words';
            wordsTitle.style.margin = '0';
            wordsTitle.style.flexGrow = '1';
            wordsHeader.appendChild(wordsTitle);
            const reloadButton = document.createElement('button');
            reloadButton.innerHTML = '🔄'; // Refresh symbol
            reloadButton.className = 'reload-button secondary-button'; // Style class
            reloadButton.title = 'Reload word list from server (block reload)';
            reloadButton.addEventListener('click', () => this.reloadWordList());
            wordsHeader.appendChild(reloadButton);
            wordsSection.appendChild(wordsHeader);

            const wordsContent = document.createElement('div');
            wordsContent.className = 'section-content'; // Style class

            // --- Add Word Form ---
            const addWordForm = document.createElement('form');
            addWordForm.className = 'add-word-form'; // Style class
            addWordForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent page reload
                this.addWord();
            });
            const addWordInput = document.createElement('input');
            addWordInput.type = 'text';
            addWordInput.className = 'add-word-input'; // Style class
            addWordInput.placeholder = 'Type word(s) to block...';
            addWordInput.title = 'Enter one or more words separated by spaces';
            // Cache immediately
            this.dom.addWordInput = addWordInput;
            addWordForm.appendChild(addWordInput);
            const addWordButton = document.createElement('button');
            addWordButton.type = 'submit';
            addWordButton.className = 'add-word-button primary-button'; // Style class
            addWordButton.textContent = 'Add';
            addWordButton.title = 'Add word(s) to block list';
            addWordForm.appendChild(addWordButton);
             // Cache immediately
             this.dom.addWordForm = addWordForm;
            wordsContent.appendChild(addWordForm);

            // --- Word List Container ---
            const wordListContainer = document.createElement('div');
            wordListContainer.className = 'word-list-container'; // Style class
            wordListContainer.setAttribute('role', 'list');
            wordListContainer.setAttribute('aria-label', 'Currently blocked words');
            const wordList = document.createElement('div');
            wordList.className = 'word-list'; // Style class
             // Cache immediately
             this.dom.wordList = wordList;
            wordListContainer.appendChild(wordList);
            wordsContent.appendChild(wordListContainer);
            wordsSection.appendChild(wordsContent);
            container.appendChild(wordsSection);

            // --- Visual explanation section (Optional but helpful) ---
             const visualSection = document.createElement('div');
             visualSection.className = 'visual-section control-section'; // Style class
             const visualHeader = document.createElement('div');
             visualHeader.className = 'section-header';
             const visualTitle = document.createElement('h4');
             visualTitle.textContent = 'Example';
             visualTitle.style.margin = '0';
             visualHeader.appendChild(visualTitle);
             visualSection.appendChild(visualHeader);
             const visualContent = document.createElement('div');
             visualContent.className = 'section-content'; // Style class
             visualContent.innerHTML = `<p class="explanation-text">If "<code>duck</code>" is blocked, the output "What the <strong>duck</strong>?" becomes "What the <code>[CENSORED]</code>?". Matching ignores case.</p>`;
             visualSection.appendChild(visualContent);
             container.appendChild(visualSection);

            // --- Add Panel-Specific Styles ---
            this.addPanelSpecificStyles(); // Styles scoped to inner controls

            // --- Update Dynamic Elements & Fetch Initial List ---
            this.updateDynamicUIElements(); // Set initial state for status/button
            this.updateWordListDisplay();   // Render list (likely empty initially)

            // Re-fetch list now that controls are rendered (only if active)
             if (this.state.isBlockActive) {
                 this.getBlockedWordsList();
             }

            // --- Append Controls to Main Container ---
            this.dom.blockContainer.appendChild(container);
        },


        /** Add base styles for the plugin required note */
        addBaseStyles: function() {
             const styleId = 'plugin-required-note-styles'; // Shared ID
             if (document.getElementById(styleId)) return;
             const style = document.createElement('style');
             style.id = styleId;
             style.textContent = `
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
             `;
             document.head.appendChild(style);
         },

        /**
         * Add component-specific styles
         */
        addPanelSpecificStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;

            const style = document.createElement('style');
            style.id = styleId;
            // Scope styles to the component's main container class
            const containerSelector = `.${this.id}-main-container`;

            // Styles for elements *inside* the container
            style.textContent = `
                ${containerSelector} .block-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 15px; /* Space between sections */
                    height: 100%;
                    padding: 10px;
                    box-sizing: border-box;
                }
                /* General Section Styling */
                 ${containerSelector} .control-section {
                     border: 1px solid #e0e0e0;
                     border-radius: 4px;
                     background-color: #f9f9f9;
                     overflow: hidden;
                 }
                 ${containerSelector} .section-header {
                     display: flex; justify-content: space-between; align-items: center;
                     padding: 8px 12px; background-color: #ececec;
                     border-bottom: 1px solid #d0d0d0;
                 }
                 ${containerSelector} .section-header h4 { margin: 0; color: #333; font-weight: bold; }
                 ${containerSelector} .section-content {
                    padding: 12px;
                 }

                 /* Status Indicator & Button */
                 ${containerSelector} .status-indicator { margin-left: 10px; font-weight: bold; }
                 ${containerSelector} .status-value {
                     padding: 3px 8px; border-radius: 3px; font-weight: bold;
                     margin-left: 5px; font-size: 0.9em;
                 }
                 ${containerSelector} .status-value.active { background-color: #e6f7e6; color: #2e7d32; }
                 ${containerSelector} .status-value.inactive { background-color: #ffebee; color: #c62828; }

                 ${containerSelector} .toggle-button {
                     padding: 8px 16px; border: none; border-radius: 4px; color: white;
                     cursor: pointer; font-weight: bold; width: 100%;
                     box-sizing: border-box; font-size: 0.9em;
                 }
                 ${containerSelector} .toggle-button.active { background-color: #f44336; /* Red for Stop */ }
                 ${containerSelector} .toggle-button.inactive { background-color: #4caf50; /* Green for Start */ }

                 /* Reload Button */
                 ${containerSelector} .reload-button {
                     background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460;
                     font-size: 1em; cursor: pointer; padding: 3px 8px; border-radius: 4px; line-height: 1;
                     font-weight: normal; margin-left: 5px;
                 }
                 ${containerSelector} .reload-button:hover { background-color: #bee5eb; }

                 /* Explanation Text */
                 ${containerSelector} .explanation-text { line-height: 1.4; margin: 0; font-size: 0.95em; }
                 ${containerSelector} .explanation-text code { font-family: monospace; background: #eee; padding: 1px 3px; border-radius: 2px; color: #333; }
                 ${containerSelector} .explanation-text strong { font-weight: bold; }

                 /* Add Word Form */
                 ${containerSelector} .add-word-form { display: flex; margin-bottom: 10px; gap: 8px; }
                 ${containerSelector} .add-word-input {
                     flex-grow: 1; /* Take available space */
                     padding: 8px 10px; border: 1px solid #ccc;
                     border-radius: 4px; font-size: 0.9em;
                 }
                 ${containerSelector} .add-word-button { /* Uses primary-button style */
                      background-color: #007bff; color: white; /* Blue */
                      padding: 8px 15px; border: none; border-radius: 4px;
                      cursor: pointer; font-weight: bold; flex-shrink: 0; font-size: 0.9em;
                  }
                  ${containerSelector} .add-word-button:hover { background-color: #0056b3; }


                 /* Word List */
                 ${containerSelector} .word-list-container {
                     max-height: 200px; /* Control height */
                     min-height: 60px; /* Prevent collapse */
                     overflow-y: auto; border: 1px solid #d0d0d0;
                     border-radius: 4px; background-color: #fff;
                     padding: 8px; /* Padding inside list area */
                 }
                 ${containerSelector} .word-list { display: flex; flex-direction: column; gap: 6px; /* Space between items */ }

                 /* Word Item */
                 ${containerSelector} .word-item {
                     display: flex; justify-content: space-between; align-items: center;
                     padding: 6px 10px; border: 1px solid #eee; border-radius: 4px;
                     background-color: #f8f9fa; /* Very light grey */
                 }
                 ${containerSelector} .word-text {
                     font-family: monospace; font-size: 0.95em; color: #333;
                     background-color: #e9ecef; /* Slightly darker grey */
                     padding: 3px 6px; border-radius: 3px;
                     margin-right: 8px; /* Space before button */
                     word-break: break-all; /* Handle long words */
                     flex-grow: 1; /* Allow text to take space */
                 }
                 ${containerSelector} .remove-word-button {
                     background-color: #dc3545; color: white; border: none; border-radius: 4px; /* Red */
                     padding: 4px 8px; cursor: pointer; font-size: 0.85em; flex-shrink: 0;
                     font-weight: bold;
                 }
                 ${containerSelector} .remove-word-button:hover { background-color: #c82333; }

                 /* Empty List Message */
                 ${containerSelector} .empty-list-message {
                    padding: 15px; text-align: center; color: #6c757d; /* Bootstrap text-muted color */
                    font-style: italic; font-size: 0.9em;
                 }
                 /* Basic Button Styles (Can be global) */
                 ${containerSelector} .primary-button { /* ... styles ... */ }
                 ${containerSelector} .secondary-button { /* ... styles ... */ }

            `;
            document.head.appendChild(style);
        },

        /**
         * Update status indicator and toggle button (dynamic elements)
         */
        updateDynamicUIElements: function() {
            // Ensure elements exist before updating
             if (!this.dom.statusIndicator && !this.dom.toggleButton) return;

             const isActive = this.state.isBlockActive;

             if (this.dom.statusIndicator) {
                 this.dom.statusIndicator.innerHTML = `
                     Block:
                     <span class="status-value ${isActive ? 'active' : 'inactive'}">
                         ${isActive ? 'Active' : 'Inactive'}
                     </span>`;
             }

             if (this.dom.toggleButton) {
                 this.dom.toggleButton.textContent = isActive ? 'Stop Word Block' : 'Start Word Block';
                 this.dom.toggleButton.classList.toggle('active', isActive);
                 this.dom.toggleButton.classList.toggle('inactive', !isActive);
                 this.dom.toggleButton.title = isActive ? 'Click to stop the Word Block action plugin' : 'Click to start the Word Block action plugin';
             }
        },

        /**
         * Update word list display based on `this.state.blockedWords`
         */
        updateWordListDisplay: function() {
            // Ensure wordList element exists
            if (!this.dom.wordList) {
                 console.warn(`[${this.id}] Word list element not found, cannot update display.`);
                 return;
             }

            this.dom.wordList.innerHTML = ''; // Clear previous content

            if (!this.state.blockedWords || this.state.blockedWords.length === 0) {
                // Display a message when the list is empty
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-list-message'; // Style class
                emptyMessage.textContent = 'No words currently blocked.';
                this.dom.wordList.appendChild(emptyMessage);
            } else {
                // Ensure words are sorted alphabetically for display consistency
                const sortedWords = [...this.state.blockedWords].sort((a, b) => a.localeCompare(b));

                // Add each word to the list
                sortedWords.forEach(word => {
                    const wordItem = document.createElement('div');
                    wordItem.className = 'word-item'; // Style class
                    wordItem.setAttribute('role', 'listitem');

                    const wordText = document.createElement('span'); // Use span for inline nature
                    wordText.className = 'word-text'; // Style class
                    wordText.textContent = word;

                    const removeButton = document.createElement('button');
                    removeButton.className = 'remove-word-button'; // Style class
                    removeButton.textContent = '✕'; // Use 'x' symbol for remove
                    removeButton.title = `Remove "${word}"`;
                    removeButton.setAttribute('aria-label', `Remove word ${word}`);
                    removeButton.addEventListener('click', () => this.removeWord(word));

                    wordItem.appendChild(wordText);
                    wordItem.appendChild(removeButton);
                    this.dom.wordList.appendChild(wordItem);
                });
            }
        },

        /**
         * Toggle block action on/off
         */
        toggleBlock: function() {
            const command = this.state.isBlockActive ? 'stop block' : 'start block';
            const actionVerb = this.state.isBlockActive ? 'Stopping' : 'Starting';
            Framework.sendMessage(command);
            Framework.showToast(`${actionVerb} word block...`);
            // State update happens via activeActionsUpdated event listener
        },

        /**
         * Add word(s) to the block list
         */
        addWord: function() {
            // Guard: Requires active plugin & input element
            if (!this.state.isBlockActive || !this.dom.addWordInput) {
                 Framework.showToast('Block plugin must be active to add words.');
                 return;
             }

            // Get multiple words, clean them up
            const wordsToAdd = this.dom.addWordInput.value.trim().toLowerCase()
                                  .split(/\s+/) // Split by any whitespace
                                  .filter(Boolean); // Remove empty strings resulting from multiple spaces

            if (wordsToAdd.length === 0) {
                Framework.showToast('Please enter word(s) to block.');
                return;
            }

             const command = `block add ${wordsToAdd.join(' ')}`; // Send space-separated list
             Framework.sendMessage(command);
             this.dom.addWordInput.value = ''; // Clear input after sending
             Framework.showToast(`Sent command to add: ${wordsToAdd.join(', ')}`);
             // List update should happen via chat listener processing the confirmation/new list.
             // Optionally trigger a refresh after a short delay as backup:
             setTimeout(() => this.getBlockedWordsList(), 1500);
        },

        /**
         * Remove a word from the block list
         */
        removeWord: function(word) {
            // Guard: Requires active plugin & valid word
             if (!this.state.isBlockActive || !word) {
                Framework.showToast('Block plugin must be active to remove words.');
                 return;
            }

            // Optional: Confirmation dialog
            // if (!confirm(`Are you sure you want to remove "${word}" from the block list?`)) {
            //     return;
            // }

            Framework.sendMessage(`block remove ${word}`);
             Framework.showToast(`Sent command to remove "${word}"`);
             // List update should happen via chat listener.
             // Optionally trigger refresh:
             setTimeout(() => this.getBlockedWordsList(), 1500);
        },

        /**
         * Reload the word list from the server file
         */
        reloadWordList: function() {
            // Guard: Requires active plugin
             if (!this.state.isBlockActive) {
                 Framework.showToast('Block plugin must be active to reload.');
                 return;
             }

            Framework.sendMessage('block reload');
             Framework.showToast('Sending command to reload block list...');
             // List update should happen via chat listener.
             // Optionally trigger refresh:
             setTimeout(() => this.getBlockedWordsList(), 1500);
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            this.state.subscriptions.forEach(sub => { Framework.off(sub.event, sub.id); });
            this.state.subscriptions = [];
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) styleElement.remove();
            if (this.dom.content) this.dom.content.innerHTML = '';
            console.log(`[${this.id}] Cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();