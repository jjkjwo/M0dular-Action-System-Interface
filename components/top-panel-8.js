/**
 * ==============================================================================================
 * Top Panel 8 - Focus Control Panel (FIXED)
 * ==============================================================================================
 *
 * This panel provides controls for the focus.py addon, which applies subtle perturbations
 * to user inputs (typos, emotional markers, mild expletives) to potentially affect AI responses.
 *
 * @version 1.1.0 - Fixed status/stats updates, removed fallback, clarified unimplemented features
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-8',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            focusContainer: null,
            statusIndicator: null,
            toggleButton: null,
            featureToggles: {},
            probabilitySliders: {},
            emotionalMarkersList: null, // Renamed for clarity
            expletivesList: null,       // Renamed for clarity
            logViewer: null,
            resetButton: null,
            refreshButton: null,
            tabs: {},
            // Input fields
            newMarkerInput: null,
            addMarkerButton: null,
            newExpletiveInput: null,
            addExpletiveButton: null,
            loggingToggle: null,
            preserveKeywordsToggle: null,
            maxTyposInput: null
        },

        // Component state
        state: {
            focusActive: false,
            // Initialize config with defaults matching focus.py to avoid errors before first fetch
            config: {
                features: { typos: true, emotions: true, expletives: false },
                probability: 0.3,
                typo_config: { probability: 0.5, max_typos: 1, preserve_keywords: true },
                emotion_config: { probability: 0.4, markers: ["hmm", "wow", "ugh", "sigh", "huh", "hmph", "ah", "oh", "geez", "whoa", "yikes", "sheesh", "meh", "eh", "oof"] },
                expletive_config: { probability: 0.1, words: ["damn", "heck", "darn", "shoot", "crap"] },
                triggers: { keywords: { explain: 0.4, stuck: 0.6 }, stress_indicators: { multiple_punctuation: 0.5 } }, // Simplified defaults
                logging: true
            },
            statistics: { total_inputs: 0, perturbed_inputs: 0, typos_applied: 0, emotions_injected: 0, expletives_injected: 0, last_perturbation: null },
            logs: [],
            activeTab: 'status',
            subscriptions: [],
            refreshTimer: null,
            lastFetchTime: 0
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) { console.error(`[${this.id}] Content element not found`); return; }

            // Render UI, cache DOM elements inside renderContent now
            this.renderContent();
            // Setup listeners immediately after rendering
            this.setupEventListeners();

            const subscription = Framework.on('activeActionsUpdated', (data) => {
                 // Add safety check for data structure
                this.updateFocusState(data && Array.isArray(data.actions) ? data.actions : []);
            });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: subscription });

            this.checkInitialFocusState();
            this.addStyles();

             // Initial UI update based on default state before first fetch
             this.updateUIVisibility();
             this.updateStatistics();
             this.updateConfigUI();

            console.log(`[${this.id}] Initialization complete.`);
        },

        /**
         * Check initial state of "focus" plugin
         */
        checkInitialFocusState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                .then(data => {
                    // Check response structure more carefully
                    if (data && data.success && Array.isArray(data.actions)) {
                        this.updateFocusState(data.actions);
                    } else {
                         console.warn(`[${this.id}] Invalid data received for initial focus state. Assuming inactive.`);
                         this.updateFocusState([]);
                     }
                 })
                .catch(error => {
                    console.error(`[${this.id}] Error checking initial focus state:`, error);
                    this.updateFocusState([]); // Assume inactive on error
                });
        },

        /**
         * Update component state based on focus active status
         * @param {Array} actions - Active actions array (defaults to empty array)
         */
        updateFocusState: function(actions = []) {
            const isFocusActive = actions.some(action => {
                const nameOnly = typeof action === 'string' ? action.split(':')[0].trim().toLowerCase() : '';
                return nameOnly === 'focus';
            });

            if (this.state.focusActive !== isFocusActive) {
                console.log(`[${this.id}] Focus Active State Changed: ${isFocusActive}`);
                this.state.focusActive = isFocusActive;
                this.updateUIVisibility(); // Update general UI visibility

                if (isFocusActive) {
                    const panel = document.getElementById(this.id);
                    if (panel && panel.classList.contains('active')) {
                        console.log(`[${this.id}] Focus activated & panel open, fetching data.`);
                        this.fetchFocusData(); // Fetch immediately if panel already open
                    }
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
                // Refresh config/stats UI elements explicitly after focus state change
                 this.updateConfigUI();
                 this.updateStatistics();
             }
        },

        /**
         * Called when panel is opened
         */
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened.`);
            if (this.state.focusActive) {
                console.log(`[${this.id}] Focus active, fetching data on open.`);
                this.fetchFocusData(); // Fetch data when opened if focus is active
                 if(this.state.activeTab === 'logs') { // Also refresh logs if that tab is active
                    this.fetchLogs();
                 }
            } else {
                console.log(`[${this.id}] Focus inactive, not fetching data on open.`);
                this.updateUIVisibility(); // Ensure the "plugin required" note is visible
            }
        },

        /**
         * Called when panel is closed
         */
        onPanelClose: function() {
            // Could potentially stop polling here if desired, but current logic handles it
             console.log(`[${this.id}] Panel closed.`);
        },

        /**
         * Update UI elements visibility based on focus active state
         */
        updateUIVisibility: function() {
            // Ensure elements exist before modifying
            if (this.dom.noteElement) {
                 this.dom.noteElement.style.display = this.state.focusActive ? 'none' : 'block';
            }
            if (this.dom.focusContainer) {
                this.dom.focusContainer.style.display = this.state.focusActive ? 'block' : 'none';
            }

            if (this.dom.statusIndicator) {
                this.dom.statusIndicator.innerHTML = this.state.focusActive
                    ? '<span class="status-active">Active</span>'
                    : '<span class="status-inactive">Inactive</span>';
            }

            if (this.dom.toggleButton) {
                 this.dom.toggleButton.disabled = false; // Ensure it's enabled unless actively processing
                this.dom.toggleButton.textContent = this.state.focusActive
                    ? 'Deactivate Focus'
                    : 'Activate Focus';
                this.dom.toggleButton.className = `action-button ${this.state.focusActive ? 'stop-button' : 'start-button'}`;
            }
        },

        /**
         * Start auto-refresh interval
         */
        startAutoRefresh: function() {
            this.stopAutoRefresh(); // Clear existing interval
            console.log(`[${this.id}] Starting auto-refresh (interval: 30000ms)`);
            this.state.refreshTimer = setInterval(() => {
                const panel = document.getElementById(this.id);
                // Only fetch if plugin is active AND panel is visible
                if (this.state.focusActive && panel && panel.classList.contains('active')) {
                    console.log(`[${this.id}] Auto-refresh triggered.`);
                    this.fetchFocusData();
                } else {
                    // console.log(`[${this.id}] Skipping auto-refresh (plugin inactive or panel hidden).`);
                }
            }, 30000); // 30 seconds interval
        },

        /**
         * Stop auto-refresh interval
         */
        stopAutoRefresh: function() {
            if (this.state.refreshTimer) {
                 console.log(`[${this.id}] Stopping auto-refresh.`);
                clearInterval(this.state.refreshTimer);
                this.state.refreshTimer = null;
            }
        },

        /**
         * Fetch focus configuration and statistics using the API endpoint.
         */
        fetchFocusData: function() {
            const now = Date.now();
            const minInterval = 3000; // Prevent fetches too close together

            if (now - this.state.lastFetchTime < minInterval) {
                 // console.log(`[${this.id}] Fetch throttled.`);
                 return;
             }
            this.state.lastFetchTime = now;
             console.log(`[${this.id}] Fetching data from /api/focus/status`);

             // Update loading indicators in visible tabs
             this.showLoadingState(true);

             Framework.loadResource('/api/focus/status')
                 .then(data => {
                     if (!data || !data.success) {
                         // Use error from response if available, otherwise provide generic message
                         throw new Error(data?.error || "Invalid or unsuccessful response from status API");
                    }
                     console.log(`[${this.id}] Received data:`, data);

                    // Safely update state
                     this.state.focusActive = typeof data.active === 'boolean' ? data.active : this.state.focusActive;
                    this.state.statistics = (data.statistics && typeof data.statistics === 'object') ? data.statistics : this.state.statistics;
                    this.state.config = (data.config && typeof data.config === 'object') ? data.config : this.state.config;

                    // Refresh UI based on new state
                    this.updateUIVisibility(); // Reflect active state changes
                    this.updateStatistics();   // Update stats display
                    this.updateConfigUI();     // Update all config-related UI

                     // If the logs tab is currently active, trigger a log refresh
                    if (this.state.activeTab === 'logs') {
                        this.fetchLogs();
                     }
                 })
                 .catch(error => {
                    console.error(`[${this.id}] Error fetching focus status:`, error);
                     Framework.showToast('Error updating Focus panel: ' + error.message, 4000);
                     this.showErrorState(error.message); // Show error state in UI
                 })
                 .finally(() => {
                     this.updateLastUpdateTime(); // Update timestamp display
                     this.showLoadingState(false); // Hide loading indicators
                 });
        },

         /** Show loading indicators in relevant UI areas */
        showLoadingState: function(isLoading) {
            // Example for statistics:
             const statsContainer = document.getElementById('focus-statistics');
             if (statsContainer) {
                 if (isLoading) {
                     statsContainer.innerHTML = `<div class="placeholder-message">Refreshing statistics...</div>`;
                 } else if (!statsContainer.querySelector('.stat-item') && !statsContainer.querySelector('.error-message')) {
                     // If loading finished but content is still empty (and not showing an error), show a placeholder
                    statsContainer.innerHTML = `<div class="placeholder-message">Statistics will appear here.</div>`;
                }
             }
            // Add similar logic for other dynamic areas if needed (e.g., lists)
        },

         /** Show error message in relevant UI areas */
        showErrorState: function(errorMessage) {
            const statsContainer = document.getElementById('focus-statistics');
             if (statsContainer) {
                 statsContainer.innerHTML = `<div class="error-message">Failed to load data: ${errorMessage}</div>`;
             }
            // Add for lists/logs if needed
             const markersList = this.dom.emotionalMarkersList;
             if (markersList) markersList.innerHTML = `<div class="error-message">Failed to load markers.</div>`;
             const expletivesList = this.dom.expletivesList;
             if (expletivesList) expletivesList.innerHTML = `<div class="error-message">Failed to load expletives.</div>`;
             const logViewer = this.dom.logViewer;
             if(logViewer) logViewer.innerHTML = `<div class="error-message">Failed to load logs.</div>`;
        },

        /**
         * Update the last update time display
         */
        updateLastUpdateTime: function() {
             // Ensure the element exists before trying to update
             const lastUpdateElement = this.dom.content?.querySelector('.last-update');
            if (lastUpdateElement) {
                const now = new Date();
                lastUpdateElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
            }
        },

        /**
         * Update statistics display - Reads from this.state.statistics
         */
        updateStatistics: function() {
            const stats = this.state.statistics || {}; // Use default if state undefined
            const statsContainer = document.getElementById('focus-statistics');
            if (!statsContainer) return;

            const totalInputs = stats.total_inputs || 0;
            const perturbedInputs = stats.perturbed_inputs || 0;
            const perturbPercentage = totalInputs > 0 ? ((perturbedInputs / totalInputs) * 100).toFixed(1) : 0;

            statsContainer.innerHTML = `
                <div class="stat-item"><div class="stat-label">Total Inputs:</div><div class="stat-value">${totalInputs}</div></div>
                <div class="stat-item"><div class="stat-label">Inputs Perturbed:</div><div class="stat-value">${perturbedInputs} (${perturbPercentage}%)</div></div>
                <div class="stat-item"><div class="stat-label">Typos Applied:</div><div class="stat-value">${stats.typos_applied || 0}</div></div>
                <div class="stat-item"><div class="stat-label">Emotional Markers:</div><div class="stat-value">${stats.emotions_injected || 0}</div></div>
                <div class="stat-item"><div class="stat-label">Mild Expletives:</div><div class="stat-value">${stats.expletives_injected || 0}</div></div>
            `;
        },

        /**
         * Update configuration UI based on this.state.config
         */
        updateConfigUI: function() {
            const config = this.state.config || {}; // Use default empty object if config is missing
            const features = config.features || {};
            const typoConfig = config.typo_config || {};
            const emotionConfig = config.emotion_config || {};
            const expletiveConfig = config.expletive_config || {};

            // Update feature toggles
            if (this.dom.featureToggles.typos) this.dom.featureToggles.typos.checked = features.typos === true;
            if (this.dom.featureToggles.emotions) this.dom.featureToggles.emotions.checked = features.emotions === true;
            if (this.dom.featureToggles.expletives) this.dom.featureToggles.expletives.checked = features.expletives === true;
            if (this.dom.loggingToggle) this.dom.loggingToggle.checked = config.logging === true;

            // Update probability sliders (and value displays)
            const updateSlider = (sliderElement, valueDisplayId, value) => {
                if (sliderElement) {
                    const percentage = Math.round((typeof value === 'number' ? value : 0) * 100);
                    sliderElement.value = percentage;
                    const valueDisplay = document.getElementById(valueDisplayId);
                    if (valueDisplay) valueDisplay.textContent = percentage + '%';
                }
            };
            updateSlider(this.dom.probabilitySliders.global, 'global-probability-value', config.probability);
            updateSlider(this.dom.probabilitySliders.typo, 'typo-probability-value', typoConfig.probability);
            updateSlider(this.dom.probabilitySliders.emotion, 'emotion-probability-value', emotionConfig.probability);
            updateSlider(this.dom.probabilitySliders.expletive, 'expletive-probability-value', expletiveConfig.probability);

            // Update Typo Options
            if (this.dom.preserveKeywordsToggle) this.dom.preserveKeywordsToggle.checked = typoConfig.preserve_keywords === true;
            if (this.dom.maxTyposInput) this.dom.maxTyposInput.value = typoConfig.max_typos || 1;

            // Update Emotional Markers & Expletives lists (delegated)
            this.updateEmotionalMarkersList();
            this.updateExpletivesList();

            // --- Mark unsupported controls as disabled ---
             const disableControl = (element, title) => {
                if (element) {
                     element.disabled = true;
                     element.style.opacity = 0.6;
                     element.title = title;
                     const parentGroup = element.closest('.slider-group') || element.closest('.option-group');
                     if (parentGroup) {
                         parentGroup.style.opacity = 0.6;
                         parentGroup.title = title;
                         // Disable checkbox/label interaction too
                         const label = parentGroup.querySelector('label');
                         if(label) label.style.pointerEvents = 'none';
                         // Disable number input
                         const numberInput = parentGroup.querySelector('input[type="number"]');
                         if (numberInput) numberInput.disabled = true;
                    }
                 }
             };
             disableControl(this.dom.probabilitySliders.typo, 'Individual typo probability not configurable');
             disableControl(this.dom.probabilitySliders.emotion, 'Individual emotion probability not configurable');
             disableControl(this.dom.probabilitySliders.expletive, 'Individual expletive probability not configurable');
             disableControl(this.dom.preserveKeywordsToggle, 'Preserve keywords setting not configurable via UI');
             disableControl(this.dom.maxTyposInput, 'Max typos setting not configurable via UI');

            // Note: Add/Remove list buttons handled in their update functions
        },

        /**
         * Update emotional markers list based on this.state.config
         */
        updateEmotionalMarkersList: function() {
            if (!this.dom.emotionalMarkersList) return;
            const markers = this.state.config?.emotion_config?.markers || [];
            this.dom.emotionalMarkersList.innerHTML = '';

            markers.forEach(marker => {
                const item = document.createElement('div'); item.className = 'marker-item';
                const text = document.createElement('span'); text.className = 'marker-text'; text.textContent = marker;
                const button = document.createElement('button'); button.className = 'delete-button';
                button.innerHTML = '×'; button.title = 'Remove marker (not implemented)';
                button.disabled = true; button.style.opacity = 0.5; // Disable remove button
                button.onclick = () => this.removeEmotionalMarker(marker); // Keep handler
                item.appendChild(text); item.appendChild(button);
                this.dom.emotionalMarkersList.appendChild(item);
            });

            if (markers.length === 0) {
                this.dom.emotionalMarkersList.innerHTML = '<div class="empty-message">No emotional markers defined</div>';
            }
        },

        /**
         * Update expletives list based on this.state.config
         */
        updateExpletivesList: function() {
            if (!this.dom.expletivesList) return;
            const expletives = this.state.config?.expletive_config?.words || [];
            const isFeatureEnabled = this.state.config?.features?.expletives === true;
            this.dom.expletivesList.innerHTML = '';

             // Show warning if feature disabled
             if (!isFeatureEnabled) {
                 const warning = document.createElement('div');
                 warning.className = 'warning-message';
                 warning.textContent = 'Expletives feature is currently disabled. Enable it in the Features tab.';
                 this.dom.expletivesList.appendChild(warning); // Use appendChild
             }

            expletives.forEach(expletive => {
                 const item = document.createElement('div'); item.className = 'expletive-item';
                 const text = document.createElement('span'); text.className = 'expletive-text'; text.textContent = expletive;
                 const button = document.createElement('button'); button.className = 'delete-button';
                 button.innerHTML = '×'; button.title = 'Remove expletive (not implemented)';
                 button.disabled = true; button.style.opacity = 0.5; // Disable remove button
                 button.onclick = () => this.removeExpletive(expletive); // Keep handler
                 item.appendChild(text); item.appendChild(button);
                 this.dom.expletivesList.appendChild(item); // Use appendChild
            });

            if (expletives.length === 0 && isFeatureEnabled) { // Only show if enabled and list empty
                 this.dom.expletivesList.innerHTML = '<div class="empty-message">No mild expletives defined</div>'; // Overwrite warning if feature enabled
             }
        },

        /**
         * Send a command using the Framework API wrapper. Includes optimistic updates.
         * @param {string} command - Command to send (e.g., "focus set typos on")
         * @param {object} [optimisticUpdate=null] - Optional: { keyPath: ['config', 'key'], value: newValue }
         * @returns {Promise<object>} Response data on success, throws error on failure.
         */
        sendCommand: async function(command, optimisticUpdate = null) {
             const panel = document.getElementById(this.id);
             if (!this.state.focusActive || (panel && !panel.classList.contains('active'))) {
                 console.warn(`[${this.id}] Skipping command (inactive/hidden): ${command}`);
                 throw new Error("Focus inactive or panel hidden");
             }

            let previousStateValue = null; // For rollback

             // Apply optimistic update BEFORE sending command
             if (optimisticUpdate && optimisticUpdate.keyPath && optimisticUpdate.keyPath.length > 0) {
                 try {
                     const keys = optimisticUpdate.keyPath;
                     let currentStateRef = this.state;
                     for (let i = 0; i < keys.length - 1; i++) {
                         currentStateRef = currentStateRef[keys[i]];
                         if (currentStateRef === undefined) throw new Error(`Invalid key path at '${keys[i]}'`);
                     }
                     const finalKey = keys[keys.length - 1];
                     previousStateValue = currentStateRef[finalKey]; // Store old value
                     currentStateRef[finalKey] = optimisticUpdate.value;
                     console.log(`[${this.id}] Optimistic update: ${keys.join('.')} set to`, optimisticUpdate.value);
                     this.updateConfigUI(); // Refresh UI parts related to config immediately
                 } catch (e) {
                     console.error(`[${this.id}] Failed to apply optimistic update for ${optimisticUpdate.keyPath.join('.')}:`, e);
                     previousStateValue = 'OPTIMISTIC_UPDATE_FAILED'; // Mark failure
                 }
             }

             console.log(`[${this.id}] Sending command: ${command}`);
            try {
                 // Use the central Framework command/API call method
                 const data = await Framework.loadResource('/api/focus/command', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ command: command })
                 });

                 if (!data || !data.success) {
                     throw new Error(data?.error || 'Backend command failed');
                 }

                 console.log(`[${this.id}] Command successful. Refreshing data in 1.5s.`);
                 // Schedule refresh slightly later to allow backend processing time
                 setTimeout(() => this.fetchFocusData(), 1500);
                 return data; // Propagate success

             } catch (error) {
                 console.error(`[${this.id}] Error sending command "${command}":`, error);
                 Framework.showToast(`Focus command failed: ${error.message || 'Unknown error'}`, 4000);

                 // Rollback optimistic update if it was applied
                 if (optimisticUpdate && previousStateValue !== null && previousStateValue !== 'OPTIMISTIC_UPDATE_FAILED') {
                     try {
                         const keys = optimisticUpdate.keyPath;
                         let currentStateRef = this.state;
                         for (let i = 0; i < keys.length - 1; i++) {
                             currentStateRef = currentStateRef[keys[i]];
                             if (currentStateRef === undefined) throw new Error("Invalid key path during rollback");
                         }
                         currentStateRef[keys[keys.length - 1]] = previousStateValue;
                         console.log(`[${this.id}] Rolled back optimistic update for ${keys.join('.')}`);
                         this.updateConfigUI(); // Refresh UI after rollback
                     } catch (rollbackError) {
                         console.error(`[${this.id}] Error rolling back optimistic update:`, rollbackError);
                         // Force a full refresh since rollback failed
                         setTimeout(() => this.fetchFocusData(), 200);
                     }
                 } else if (previousStateValue === 'OPTIMISTIC_UPDATE_FAILED') {
                     // If optimistic update failed initially, still trigger a refresh on command error
                      setTimeout(() => this.fetchFocusData(), 200);
                 }

                 throw error; // Re-throw the error to be handled by caller's .catch()
             }
         },

        /** Toggle the main focus plugin (start/stop) */
        toggleFocus: function() {
            const command = this.state.focusActive ? 'stop focus' : 'start focus';
            const activating = !this.state.focusActive;

             if (this.dom.toggleButton) { this.dom.toggleButton.disabled = true; this.dom.toggleButton.textContent = activating ? 'Activating...' : 'Deactivating...'; }

             Framework.loadResource('/api/command', { // Use generic command endpoint for start/stop
                method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ command: command })
             })
                 .then(data => {
                     if (!data.success) throw new Error(data.error || "Failed to toggle focus");
                     Framework.showToast(`Focus toggle command sent.`);
                     // Trigger an active actions check to confirm the change sooner
                     Framework.fetchActiveActions();
                 })
                 .catch(error => {
                     Framework.showToast(`Error toggling Focus: ${error.message}`, 4000);
                     this.updateUIVisibility(); // Revert button text based on potentially unchanged state
                 })
                 .finally(() => {
                      // Button will be re-enabled and updated properly by updateFocusState/updateUIVisibility
                      // triggered by the fetchActiveActions poll.
                      // Ensure button enabled if poll fails quickly? Safer to let the poll handle it.
                 });
         },

        /** Toggle a specific feature (typos, emotions, expletives) */
        toggleFeature: function(feature, value) {
            const command = `focus set ${feature} ${value ? 'on' : 'off'}`;
             // Define the state path for optimistic update
             const update = { keyPath: ['config', 'features', feature], value: value };

            this.sendCommand(command, update)
                .then(() => {
                    Framework.showToast(`${feature.charAt(0).toUpperCase() + feature.slice(1)} ${value ? 'enabled' : 'disabled'}`);
                    if (feature === 'expletives') { this.updateExpletivesList(); }
                })
                .catch(error => { /* Rollback handled by sendCommand */ });
        },

        /** Set global probability */
        setProbability: function(type, value) {
            // Only allow setting 'global' probability as others aren't supported by backend commands
             if (type !== 'global') {
                Framework.showToast(`Setting ${type} probability is not supported`, 3000);
                 // Revert UI slider state shortly after message
                 setTimeout(() => this.updateConfigUI(), 150);
                 return;
            }

            const decimalValue = value / 100;
            const command = `focus set probability ${decimalValue.toFixed(2)}`;
            const update = { keyPath: ['config', 'probability'], value: decimalValue };

            this.sendCommand(command, update)
                 .then(() => { Framework.showToast(`Global probability set to ${value}%`); })
                 .catch(error => { /* Rollback handled by sendCommand */ });
        },

        /** Add an emotional marker */
        addEmotionalMarker: function(marker) {
             if (!marker || typeof marker !== 'string') { Framework.showToast('Invalid marker'); return; }
             marker = marker.trim();
             if (!marker) { Framework.showToast('Marker cannot be empty'); return; }

             const currentMarkers = this.state.config?.emotion_config?.markers || [];
            if (currentMarkers.includes(marker)) {
                Framework.showToast(`Marker "${marker}" already exists`); return;
            }

            const command = `focus add emotion ${marker}`;
             const optimisticMarkers = [...currentMarkers, marker];
             // Apply optimistic update directly (more complex path)
             const update = { keyPath: ['config', 'emotion_config', 'markers'], value: optimisticMarkers };

             this.sendCommand(command, update)
                .then(() => {
                    Framework.showToast(`Added emotional marker: ${marker}`);
                    if (this.dom.newMarkerInput) this.dom.newMarkerInput.value = ''; // Clear input
                })
                .catch(error => { /* Rollback handled by sendCommand */ });
        },

        /** Remove an emotional marker (Placeholder - not implemented) */
        removeEmotionalMarker: function(marker) {
             Framework.showToast(`Removing markers is not implemented`, 2000);
        },

        /** Add an expletive */
        addExpletive: function(expletive) {
             if (!expletive || typeof expletive !== 'string') { Framework.showToast('Invalid expletive'); return; }
             expletive = expletive.trim();
             if (!expletive) { Framework.showToast('Expletive cannot be empty'); return; }

             if (!this.state.config?.features?.expletives) {
                 Framework.showToast('Expletives feature is disabled'); return;
             }
             const currentExpletives = this.state.config?.expletive_config?.words || [];
             if (currentExpletives.includes(expletive)) {
                 Framework.showToast(`Expletive "${expletive}" already exists`); return;
             }

             const command = `focus add expletive ${expletive}`;
             const optimisticExpletives = [...currentExpletives, expletive];
             const update = { keyPath: ['config', 'expletive_config', 'words'], value: optimisticExpletives };

             this.sendCommand(command, update)
                .then(() => {
                    Framework.showToast(`Added expletive: ${expletive}`);
                    if (this.dom.newExpletiveInput) this.dom.newExpletiveInput.value = ''; // Clear input
                })
                .catch(error => { /* Rollback handled by sendCommand */ });
        },

        /** Remove an expletive (Placeholder - not implemented) */
        removeExpletive: function(expletive) {
            Framework.showToast(`Removing expletives is not implemented`, 2000);
        },

        /** Reset focus configuration to defaults */
        resetConfig: function() {
             if (!confirm('Are you sure you want to reset Focus configuration to defaults? This will also reset statistics.')) {
                return;
             }
            const command = 'focus reset';
             // Optimistic update is too complex for a full reset, just refresh after command
            this.sendCommand(command)
                .then(() => {
                    Framework.showToast('Focus configuration reset. Refreshing...');
                    // fetchFocusData will be called by sendCommand's success timeout
                })
                 .catch(error => { /* Error handled by sendCommand */ });
        },

        /** Toggle focus logging */
        toggleLogging: function(value) {
            const command = `focus log ${value ? 'on' : 'off'}`;
            const update = { keyPath: ['config', 'logging'], value: value };

            this.sendCommand(command, update)
                .then(() => { Framework.showToast(`Logging ${value ? 'enabled' : 'disabled'}`); })
                .catch(error => { /* Rollback handled by sendCommand */ });
        },

        /** Fetch focus logs */
        fetchLogs: function() {
            if (this.state.activeTab !== 'logs' || !this.state.focusActive || !this.dom.logViewer) return;
            console.log(`[${this.id}] Fetching focus logs...`);
            this.dom.logViewer.innerHTML = '<div class="placeholder-message">Loading logs...</div>';

            Framework.loadResource('/api/focus/logs')
                .then(data => {
                    if (data && data.success && Array.isArray(data.logs)) { // Check for array type
                        this.state.logs = data.logs;
                        this.updateLogs(); // Render the logs
                    } else {
                         throw new Error(data?.error || "Invalid log data received");
                     }
                 })
                 .catch(error => {
                     console.error(`[${this.id}] Error fetching focus logs:`, error);
                    this.dom.logViewer.innerHTML = `<div class="error-message">Error fetching logs: ${error.message}</div>`;
                 });
         },

         /** Update logs display */
        updateLogs: function() {
            if (!this.dom.logViewer) return;
             const logs = this.state.logs || []; // Default to empty array

            if (logs.length > 0) {
                const logsHtml = logs.map(log => {
                     // Simple HTML escaping
                    const escapedLog = String(log || '').replace(/</g, "<").replace(/>/g, ">");
                     return `<div class="log-entry">${escapedLog}</div>`;
                 }).join('<hr style="border-top: 1px dashed #ccc; margin: 5px 0;">');
                this.dom.logViewer.innerHTML = logsHtml;
             } else {
                 // Check if logging is enabled to provide a more accurate message
                 const loggingEnabled = this.state.config?.logging === true;
                this.dom.logViewer.innerHTML = `<div class="placeholder-message">${loggingEnabled ? 'No logs recorded yet.' : 'Logging is disabled (enable in Features tab).'}</div>`;
             }
         },

        /** Switch between tabs */
        switchTab: function(tabId) {
            if (this.state.activeTab === tabId) return;
             console.log(`[${this.id}] Switching tab to: ${tabId}`);
            this.state.activeTab = tabId;

             // Update tab buttons UI
            const tabButtons = this.dom.content?.querySelectorAll('.tab-button');
            tabButtons?.forEach(button => {
                button.classList.toggle('active', button.getAttribute('data-tab') === tabId);
             });

            // Update tab content visibility
            Object.keys(this.dom.tabs).forEach(tabKey => {
                if (this.dom.tabs[tabKey]) { // Check if tab element exists
                    this.dom.tabs[tabKey].style.display = (tabKey === tabId) ? 'block' : 'none';
                }
             });

            // Fetch data for specific tabs when activated
            if (tabId === 'logs') {
                 this.fetchLogs();
             } else if (tabId === 'status' || tabId === 'features' || tabId === 'probabilities' || tabId === 'markers' || tabId === 'expletives' || tabId === 'triggers') {
                // For other tabs that rely on config/stats, maybe trigger a refresh if data is old
                 const dataAge = Date.now() - this.state.lastFetchTime;
                 if(dataAge > 20000) { // If data older than 20 seconds, refresh
                    console.log(`[${this.id}] Data is stale, refreshing for tab ${tabId}`);
                     this.fetchFocusData();
                 } else {
                     // Data is fresh enough, just ensure UI is correct
                     this.updateConfigUI();
                     this.updateStatistics();
                 }
            }
        },

        /** Render component content and cache DOM elements */
        renderContent: function() {
             if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear previous content

            // Create structure (similar to previous render function)
             const container = document.createElement('div'); container.className = 'focus-panel';
             const noteElement = document.createElement('div'); noteElement.className = 'focus-note';
             noteElement.innerHTML = `<strong>Plugin Required</strong><br>Activate the "focus" plugin (<code>start focus</code>) to use these controls.`;
            this.dom.noteElement = noteElement; container.appendChild(noteElement);

             const focusContainer = document.createElement('div'); focusContainer.className = 'focus-container'; focusContainer.style.display = 'none';
            this.dom.focusContainer = focusContainer;

             // Header
             const header = document.createElement('div'); header.className = 'focus-header';
             const statusIndicator = document.createElement('div'); statusIndicator.className = 'focus-status';
             const toggleButton = document.createElement('button'); toggleButton.className = 'action-button start-button';
             this.dom.statusIndicator = statusIndicator; this.dom.toggleButton = toggleButton;
             header.appendChild(statusIndicator); header.appendChild(toggleButton); focusContainer.appendChild(header);

             // Tabs
             const tabsContainer = document.createElement('div'); tabsContainer.className = 'tabs-container';
             const tabButtons = document.createElement('div'); tabButtons.className = 'tab-buttons';
             const tabsConfig = [ { id: 'status', label: 'Status' }, { id: 'features', label: 'Features' }, { id: 'probabilities', label: 'Probabilities' }, { id: 'markers', label: 'Markers' }, { id: 'expletives', label: 'Expletives' }, { id: 'logs', label: 'Logs' }, { id: 'triggers', label: 'Triggers' }];
             tabsConfig.forEach(tab => {
                 const button = document.createElement('button'); button.className = `tab-button ${tab.id === this.state.activeTab ? 'active' : ''}`;
                 button.setAttribute('data-tab', tab.id); button.textContent = tab.label;
                 tabButtons.appendChild(button);
             });
             tabsContainer.appendChild(tabButtons);

             // Tab Content Area
             const tabContent = document.createElement('div'); tabContent.className = 'tab-content';

            // --- Define Inner HTML for each tab --- (Concise versions)
            const tabHTML = {
                status: `
                    <div class="section-title">Status & Statistics</div>
                    <div class="refresh-controls">
                        <button id="refresh-button" class="refresh-button">🔄 Refresh</button>
                        <div class="last-update">Last updated: -</div>
                    </div>
                    <div id="focus-statistics" class="statistics-container"><div class="placeholder-message">Statistics loading...</div></div>
                    <div class="section-title">About</div>
                    <div class="info-box"><p>Injects subtle variations into user prompts to potentially affect AI responses. Uses typos, emotional markers, and (optional) mild expletives.</p></div>
                `,
                features: `
                    <div class="section-title">Feature Toggles</div>
                    <div class="feature-toggles">
                        <div class="toggle-group"><label class="toggle-label"><input type="checkbox" id="typos-toggle" class="feature-toggle"><span class="toggle-text">Typos</span></label><div class="feature-description">Inject typing errors.</div></div>
                        <div class="toggle-group"><label class="toggle-label"><input type="checkbox" id="emotions-toggle" class="feature-toggle"><span class="toggle-text">Emotional Markers</span></label><div class="feature-description">Add "hmm", "sigh", etc.</div></div>
                        <div class="toggle-group"><label class="toggle-label"><input type="checkbox" id="expletives-toggle" class="feature-toggle"><span class="toggle-text">Mild Expletives</span></label><div class="feature-description">Inject "damn", "heck".</div><div class="warning-note">Disabled by default. Use caution.</div></div>
                    </div>
                    <div class="section-title">Typo Options</div>
                    <div class="typo-options">
                        <div class="option-group"><label class="option-label"><input type="checkbox" id="preserve-keywords"><span class="option-text">Preserve Keywords (UI Only)</span></label><div class="option-description">Avoids modifying help, please, etc.</div></div>
                        <div class="option-group"><label class="option-label" for="max-typos">Max Typos (UI Only):</label><input type="number" id="max-typos" min="1" max="5" value="1"></div>
                    </div>
                    <div class="section-title">Logging</div>
                    <div class="logging-options"><div class="option-group"><label class="toggle-label"><input type="checkbox" id="enable-logging"><span class="toggle-text">Enable Logging</span></label><div class="option-description">Log perturbations to file.</div></div></div>
                `,
                probabilities: `
                    <div class="section-title">Probabilities</div>
                    <div class="slider-container">
                        <div class="slider-group"><label class="slider-label">Global Probability</label><div class="slider-with-value"><input type="range" id="global-probability" min="0" max="100" class="probability-slider"><span class="slider-value" id="global-probability-value">-%</span></div><div class="slider-description">Overall chance of perturbation.</div></div>
                        <div class="slider-group" title="Not configurable"><label class="slider-label">Typo Probability</label><div class="slider-with-value"><input type="range" id="typo-probability" min="0" max="100" class="probability-slider" disabled><span class="slider-value" id="typo-probability-value">-%</span></div><div class="slider-description">Relative chance of typo (requires backend support).</div></div>
                        <div class="slider-group" title="Not configurable"><label class="slider-label">Emotion Probability</label><div class="slider-with-value"><input type="range" id="emotion-probability" min="0" max="100" class="probability-slider" disabled><span class="slider-value" id="emotion-probability-value">-%</span></div><div class="slider-description">Relative chance of marker (requires backend support).</div></div>
                        <div class="slider-group" title="Not configurable"><label class="slider-label">Expletive Probability</label><div class="slider-with-value"><input type="range" id="expletive-probability" min="0" max="100" class="probability-slider" disabled><span class="slider-value" id="expletive-probability-value">-%</span></div><div class="slider-description">Relative chance of expletive (requires backend support).</div></div>
                    </div>
                `,
                markers: `
                    <div class="section-title">Emotional Markers</div>
                    <div class="add-new-form"><input type="text" id="new-marker-input" placeholder="Enter new marker"><button id="add-marker-button" class="add-button">Add Marker</button></div>
                    <div id="emotional-markers-list" class="markers-list"><div class="placeholder-message">Loading...</div></div>
                `,
                 expletives: `
                    <div class="section-title">Mild Expletives</div>
                    <div class="warning-banner">⚠️ Use caution. May trigger AI safety filters.</div>
                    <div class="add-new-form"><input type="text" id="new-expletive-input" placeholder="Enter new expletive"><button id="add-expletive-button" class="add-button">Add Expletive</button></div>
                    <div id="expletives-list" class="expletives-list"><div class="placeholder-message">Loading...</div></div>
                 `,
                 logs: `
                     <div class="section-title">Perturbation Logs</div>
                     <div id="log-viewer" class="log-viewer"><div class="placeholder-message">Select Logs tab to load...</div></div>
                     <div class="info-box"><p>Shows applied perturbations. Requires logging enabled.</p></div>
                 `,
                 triggers: `
                     <div class="section-title">Perturbation Triggers (Informational)</div>
                     <div class="triggers-container"> <!-- Container added -->
                         <div class="triggers-section"><h4>Keywords</h4><div id="trigger-keywords" class="triggers-table"><div class="placeholder-message">Load triggers...</div></div></div>
                         <div class="triggers-section"><h4>Stress Indicators</h4><div id="trigger-stress" class="triggers-table"><div class="placeholder-message">Load triggers...</div></div></div>
                     </div>
                     <div class="info-box"><p>Contextual triggers that increase perturbation chance (not configurable via UI).</p></div>
                 `
             };

            // Create tab panes and add HTML
            Object.keys(tabHTML).forEach(tabId => {
                const pane = document.createElement('div');
                pane.className = 'tab-pane';
                pane.style.display = this.state.activeTab === tabId ? 'block' : 'none';
                pane.innerHTML = tabHTML[tabId];
                this.dom.tabs[tabId] = pane; // Cache pane element
                tabContent.appendChild(pane);
            });

             tabsContainer.appendChild(tabContent);
             focusContainer.appendChild(tabsContainer);

            // Footer/Reset Button
             const actionButtons = document.createElement('div'); actionButtons.className = 'action-buttons';
             const resetButton = document.createElement('button'); resetButton.className = 'reset-button'; resetButton.textContent = 'Reset Config/Stats';
             this.dom.resetButton = resetButton;
             actionButtons.appendChild(resetButton); focusContainer.appendChild(actionButtons);

             container.appendChild(focusContainer);
             this.dom.content.appendChild(container); // Add main container to panel content

             // --- Cache essential DOM elements AFTER they are created ---
            this.dom.emotionalMarkersList = document.getElementById('emotional-markers-list');
            this.dom.expletivesList = document.getElementById('expletives-list');
            this.dom.logViewer = document.getElementById('log-viewer');
            this.dom.refreshButton = document.getElementById('refresh-button');

             // Toggles
            this.dom.featureToggles = {
                typos: document.getElementById('typos-toggle'),
                 emotions: document.getElementById('emotions-toggle'),
                 expletives: document.getElementById('expletives-toggle')
             };
             this.dom.loggingToggle = document.getElementById('enable-logging');
             this.dom.preserveKeywordsToggle = document.getElementById('preserve-keywords');
             this.dom.maxTyposInput = document.getElementById('max-typos');

             // Sliders
            this.dom.probabilitySliders = {
                 global: document.getElementById('global-probability'),
                 typo: document.getElementById('typo-probability'),
                 emotion: document.getElementById('emotion-probability'),
                 expletive: document.getElementById('expletive-probability')
             };

             // Inputs & Buttons
             this.dom.newMarkerInput = document.getElementById('new-marker-input');
             this.dom.addMarkerButton = document.getElementById('add-marker-button');
             this.dom.newExpletiveInput = document.getElementById('new-expletive-input');
             this.dom.addExpletiveButton = document.getElementById('add-expletive-button');

            // Update trigger tables (call helper to populate from state)
            this.updateTriggerTables();

         },

        /** Populate trigger tables from state */
        updateTriggerTables: function() {
            const renderTable = (containerId, data) => {
                const container = document.getElementById(containerId);
                 if (!container) return;
                 if (!data || Object.keys(data).length === 0) {
                     container.innerHTML = '<div class="placeholder-message">No triggers defined.</div>';
                     return;
                 }
                 let tableHTML = `
                    <div class="trigger-row header">
                        <div class="trigger-name">Name</div>
                        <div class="trigger-value">Boost</div>
                    </div>`;
                 tableHTML += Object.entries(data).map(([key, value]) => `
                     <div class="trigger-row">
                         <div class="trigger-name">${key.replace(/_/g,' ')}</div>
                         <div class="trigger-value">+${(typeof value === 'number' ? value : 0).toFixed(1)}</div>
                     </div>`).join('');
                container.innerHTML = tableHTML;
            };
             renderTable('trigger-keywords', this.state.config?.triggers?.keywords);
             renderTable('trigger-stress', this.state.config?.triggers?.stress_indicators);
         },


        /**
         * Set up event listeners (called after renderContent)
         */
        setupEventListeners: function() {
             // Check if elements exist before adding listeners
            // Toggle button for start/stop
            if(this.dom.toggleButton) {
                 this.dom.toggleButton.onclick = () => this.toggleFocus();
             }
             // Tab buttons
             this.dom.content?.querySelectorAll('.tab-button').forEach(button => {
                 button.onclick = () => this.switchTab(button.getAttribute('data-tab'));
             });
             // Refresh button
            if (this.dom.refreshButton) {
                this.dom.refreshButton.onclick = () => {
                     Framework.showToast('Refreshing Focus data...');
                     this.fetchFocusData();
                 };
            }
            // Reset button
             if (this.dom.resetButton) {
                 this.dom.resetButton.onclick = () => this.resetConfig();
             }

            // Feature Toggles
             if (this.dom.featureToggles.typos) {
                 this.dom.featureToggles.typos.onchange = (e) => this.toggleFeature('typos', e.target.checked);
             }
             if (this.dom.featureToggles.emotions) {
                 this.dom.featureToggles.emotions.onchange = (e) => this.toggleFeature('emotions', e.target.checked);
             }
             if (this.dom.featureToggles.expletives) {
                 this.dom.featureToggles.expletives.onchange = (e) => this.toggleFeature('expletives', e.target.checked);
             }
             if (this.dom.loggingToggle) {
                 this.dom.loggingToggle.onchange = (e) => this.toggleLogging(e.target.checked);
             }

            // Sliders (only global uses 'change', others just update display)
             if (this.dom.probabilitySliders.global) {
                 this.dom.probabilitySliders.global.addEventListener('input', (e) => {
                     const display = document.getElementById('global-probability-value');
                     if (display) display.textContent = e.target.value + '%';
                 });
                 this.dom.probabilitySliders.global.addEventListener('change', (e) => {
                     this.setProbability('global', parseInt(e.target.value));
                 });
            }
             // Setup 'input' listeners for disabled sliders for visual update if needed
             ['typo', 'emotion', 'expletive'].forEach(type => {
                const slider = this.dom.probabilitySliders[type];
                 const displayId = `${type}-probability-value`;
                 if(slider) {
                    slider.addEventListener('input', (e) => {
                        const display = document.getElementById(displayId);
                        if (display) display.textContent = e.target.value + '%';
                    });
                    // Add change listener to inform user it's unsupported
                    slider.addEventListener('change', (e) => {
                         this.setProbability(type, parseInt(e.target.value));
                    });
                }
             });


             // Add Buttons
            if (this.dom.addMarkerButton) {
                this.dom.addMarkerButton.onclick = () => this.addEmotionalMarker(this.dom.newMarkerInput?.value);
            }
             if (this.dom.newMarkerInput) {
                this.dom.newMarkerInput.onkeypress = (e) => { if (e.key === 'Enter') this.addEmotionalMarker(e.target.value); };
             }
            if (this.dom.addExpletiveButton) {
                 this.dom.addExpletiveButton.onclick = () => this.addExpletive(this.dom.newExpletiveInput?.value);
             }
             if (this.dom.newExpletiveInput) {
                this.dom.newExpletiveInput.onkeypress = (e) => { if (e.key === 'Enter') this.addExpletive(e.target.value); };
             }

             // UI Only options (show feedback, don't send command)
             if (this.dom.preserveKeywordsToggle) {
                 this.dom.preserveKeywordsToggle.onchange = (e) => Framework.showToast(`Preserve keywords set to ${e.target.checked} (UI only)`);
             }
             if (this.dom.maxTyposInput) {
                 this.dom.maxTyposInput.onchange = (e) => Framework.showToast(`Max typos set to ${e.target.value} (UI only)`);
            }
         },

        /** Add component-specific styles */
        addStyles: function() { /* No change needed from previous version */
             const styleId = `${this.id}-styles`; if (document.getElementById(styleId)) return; const style = document.createElement('style'); style.id = styleId;
             style.textContent = `
                 .focus-panel { height: 100%; overflow-y: auto; padding: 0; font-size: 14px; }
                 .focus-note { padding: 15px; margin: 10px; background-color: #fff4e5; border: 1px solid #ffcc80; border-radius: 5px; color: #e65100; text-align: center; }
                 .focus-note code { background-color: #ffe0b2; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
                 .focus-container { display: flex; flex-direction: column; height: 100%; }
                 .focus-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; background-color: #f5f5f5; border-bottom: 1px solid #e0e0e0; }
                 .focus-status { font-weight: bold; } .status-active { color: #4caf50; } .status-inactive { color: #f44336; }
                 .action-button { padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
                 .start-button { background-color: #4caf50; color: white; } .stop-button { background-color: #f44336; color: white; }
                 .tabs-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                 .tab-buttons { display: flex; overflow-x: auto; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; flex-shrink: 0; } /* flex-shrink added */
                 .tab-button { padding: 8px 12px; border: none; background: none; cursor: pointer; white-space: nowrap; color: #666; font-size: 13px; }
                 .tab-button.active { border-bottom: 2px solid #4a76a8; color: #4a76a8; font-weight: bold; }
                 .tab-content { flex: 1; overflow-y: auto; padding: 10px; } .tab-pane { display: none; }
                 .section-title { font-weight: bold; font-size: 16px; margin: 10px 0; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; color: #4a76a8; }
                 .refresh-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                 .refresh-button { padding: 3px 8px; background-color: #4a76a8; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
                 .last-update { font-size: 12px; color: #999; }
                 .statistics-container { display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; }
                 .stat-item { display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #f0f0f0; } .stat-item:nth-child(odd) { background-color: #f9f9f9; } .stat-label { font-weight: bold; }
                 .info-box { padding: 10px; background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 5px; margin: 10px 0; font-size: 13px; }
                 .info-box p, .info-box ul, .info-box ol { margin: 5px 0; padding-left: 20px; } .info-box p:first-child { margin-top: 0;}
                 .feature-toggles, .typo-options, .logging-options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; padding: 10px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 5px; }
                 .toggle-group, .option-group { display: flex; flex-direction: column; }
                 .toggle-label, .option-label { display: flex; align-items: center; cursor: pointer; margin-bottom: 5px;}
                 .toggle-text, .option-text { margin-left: 10px; font-weight: bold; }
                 .feature-description, .option-description { font-size: 12px; color: #666; }
                 .warning-note { margin-top: 5px; font-size: 12px; color: #f44336; }
                 input[type="number"] { width: 60px; padding: 5px; border: 1px solid #ccc; border-radius: 3px; }
                 .slider-container { display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px; }
                 .slider-group { padding: 10px; background-color: #f9f9f9; border-radius: 5px; border: 1px solid #e0e0e0; } .slider-label { font-weight: bold; margin-bottom: 5px; display: block; }
                 .slider-with-value { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; } .probability-slider { flex: 1; } .slider-value { min-width: 40px; text-align: right; font-weight: bold; } .slider-description { font-size: 12px; color: #666; }
                 .add-new-form { display: flex; margin-bottom: 15px; gap: 10px; } .add-new-form input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 3px; } .add-button { padding: 5px 10px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; }
                 .markers-list, .expletives-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 15px; min-height: 30px; /* Min height */ padding: 10px; background-color: #f9f9f9; border-radius: 5px; border: 1px solid #e0e0e0; }
                 .marker-item, .expletive-item { display: inline-flex; /* inline-flex */ align-items: center; padding: 5px 10px; background-color: #e3f2fd; border: 1px solid #bbdefb; border-radius: 15px; font-size: 12px; }
                 .marker-text, .expletive-text { margin-right: 5px; } .delete-button { background: none; border: none; color: #f44336; cursor: pointer; font-size: 14px; padding: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
                 .delete-button:disabled { opacity: 0.5; cursor: not-allowed; }
                 .log-viewer { max-height: 300px; overflow-y: auto; padding: 10px; background-color: #f9f9f9; border-radius: 5px; border: 1px solid #e0e0e0; margin-bottom: 15px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
                 .log-entry { margin-bottom: 5px; padding-bottom: 5px; }
                 .warning-banner { padding: 10px; background-color: #ffebee; border: 1px solid #ffcdd2; border-radius: 5px; color: #c62828; margin-bottom: 15px; }
                 .warning-message { color: #f44336; margin-bottom: 10px; font-weight: bold; }
                 .placeholder-message, .empty-message { color: #999; font-style: italic; text-align: center; padding: 10px 0; }
                 .error-message { color: #f44336; font-style: italic; text-align: center; padding: 10px; }
                 .triggers-container { display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px; } .triggers-section h4 { margin: 0 0 10px 0; color: #4a76a8; font-size: 14px;}
                 .triggers-table { border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; font-size: 13px;} .trigger-row { display: flex; border-bottom: 1px solid #e0e0e0; } .trigger-row:last-child { border-bottom: none; } .trigger-row.header { background-color: #f5f5f5; font-weight: bold; } .trigger-name { flex: 1; padding: 8px; } .trigger-value { width: 80px; padding: 8px; text-align: center; border-left: 1px solid #e0e0e0; }
                 .action-buttons { display: flex; justify-content: flex-end; padding: 10px; background-color: #f5f5f5; border-top: 1px solid #e0e0e0; flex-shrink: 0;} /* flex-shrink added */
                 .reset-button { padding: 5px 10px; background-color: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; }
                 @media (max-width: 768px) { .tab-buttons { flex-wrap: nowrap; /* Prevent wrap */} .tab-button { flex: 0 0 auto; /* Don't grow/shrink, auto width */ } }
             `;
            document.head.appendChild(style);
         },

        /** Clean up component resources */
        cleanup: function() {
             console.log(`[${this.id}] Cleaning up...`);
            this.stopAutoRefresh(); // Stop timer
            // Unsubscribe from events
             this.state.subscriptions.forEach(sub => { Framework.off(sub.event, sub.id); }); this.state.subscriptions = [];
             // Remove styles
             const styleElement = document.getElementById(`${this.id}-styles`); if (styleElement) { styleElement.remove(); }
            console.log(`[${this.id}] Cleanup complete.`);
        }
    };

    // Register component with Framework
    Framework.registerComponent(component.id, component);
})();