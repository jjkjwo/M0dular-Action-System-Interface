/**
 * ==============================================================================================
 * Back Command Button Component (Styled as right-panel-4)
 * ==============================================================================================
 *
 * This component creates a button in the right sidebar that submits the "back" command
 * when clicked. Always visible, but faded/disabled when the 'back' plugin is inactive.
 * Note: This is not a panel, just a direct command button that prevents panel opening.
 *
 * @version 1.1.0 - Changed visibility logic to use opacity/disabled state.
 */

(function() {
    // Component definition
    const component = {
        id: 'right-panel-4',

        // DOM references
        dom: {
            button: null
        },

        // Component state
        state: {
            backPluginActive: false,
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            // Subscribe to active actions changes to detect "back" plugin
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                // Add safety check for data structure
                this.updateBackPluginState(data && Array.isArray(data.actions) ? data.actions : []);
            });

            // Store subscription for cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });

            // Find and set up the button
            this.setupButton();

            // Check initial state and apply styles immediately
            this.checkInitialBackState();

            // Add necessary CSS
            this.addStyles();
        },

        /**
         * Check initial state of "back" plugin
         */
        checkInitialBackState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                 .then(data => {
                     // Check response structure more carefully
                     if (data && data.success && Array.isArray(data.actions)) {
                        this.updateBackPluginState(data.actions);
                     } else {
                          console.warn(`[${this.id}] Invalid data received for initial back state. Assuming inactive.`);
                          this.updateBackPluginState([]);
                      }
                 })
                 .catch(error => {
                     console.error(`[${this.id}] Error checking initial back plugin state:`, error);
                     this.updateBackPluginState([]); // Assume inactive on error
                 });
        },

        /**
         * Update component state based on back plugin active status
         * @param {Array} actions - Active actions array
         */
        updateBackPluginState: function(actions = []) { // Default to empty array
            // Check if "back" plugin is in the active actions
            const isBackActive = actions.some(action => {
                // Handle potential non-string actions
                const actionStr = String(action || '');
                const [name] = actionStr.split(':');
                return name.trim().toLowerCase() === 'back';
            });

            const stateChanged = this.state.backPluginActive !== isBackActive;

            // Update state
            this.state.backPluginActive = isBackActive;

            // Update Button Appearance and Functionality
            if (this.dom.button) {
                this.dom.button.disabled = !isBackActive; // Enable/disable the button functionally
                this.dom.button.classList.toggle('back-button-active', isBackActive);
                this.dom.button.classList.toggle('back-button-inactive', !isBackActive);
                // Update title for better user feedback
                this.dom.button.title = isBackActive
                    ? "Repeat AI's Last Reply (Back Command)"
                    : "Back Command Unavailable (Activate 'back' plugin)";
                // Set ARIA disabled state for accessibility
                this.dom.button.setAttribute('aria-disabled', String(!isBackActive)); // Ensure it's a string
            }

            if (stateChanged) {
                 console.log(`[${this.id}] Back Plugin Active State Changed: ${isBackActive}`);
            }
        },

        /**
         * Finds the button, removes default framework handlers, adds custom ones.
         * Applies initial styling.
         */
        setupButton: function() {
            // Find the button by data-target
            let button = document.querySelector(`.panel-toggle[data-target="${this.id}"]`);

            if (!button) {
                console.error(`[${this.id}] Back button toggle element not found in HTML.`);
                return;
            }

            // Store reference BEFORE cloning
            this.dom.button = button;

            // Clone to remove existing framework listeners
            // This ensures only our click handler runs.
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            this.dom.button = newButton; // Update reference to the new node
            button = newButton; // Use the new node locally

            // Add our specific click handler
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.submitBackCommand(); // Calls our submit function
            });

            // Ensure keyboard accessibility respects the disabled state
            button.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !button.disabled) { // Check !button.disabled
                    e.preventDefault();
                    e.stopPropagation();
                    this.submitBackCommand();
                }
            });

            // Apply initial CSS state immediately (based on potentially false default)
             this.dom.button.disabled = !this.state.backPluginActive;
             this.dom.button.classList.toggle('back-button-active', this.state.backPluginActive);
             this.dom.button.classList.toggle('back-button-inactive', !this.state.backPluginActive);
             this.dom.button.setAttribute('aria-disabled', String(!this.state.backPluginActive)); // Ensure it's a string
             this.dom.button.title = this.state.backPluginActive
                 ? "Repeat AI's Last Reply (Back Command)"
                 : "Back Command Unavailable (Activate 'back' plugin)";
        },

         /**
         * Adds the necessary CSS styles for the button states.
         */
         addStyles: function() {
            const styleId = `${this.id}-styles`;
             if (document.getElementById(styleId)) return; // Prevent duplicate styles

             const style = document.createElement('style');
             style.id = styleId;
             style.textContent = `
                /* Styles for the right-panel-4 Back Button toggle */
                .panel-toggle[data-target="${this.id}"] {
                    /* Ensure it's always taking up space, display: flex is default for toggles */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.3s ease, background-color 0.3s ease; /* Add smooth transition */
                 }

                .panel-toggle[data-target="${this.id}"].back-button-inactive {
                     opacity: 0.5; /* Faded appearance */
                     cursor: not-allowed; /* Indicate non-interactive */
                     /* Optionally dim the background slightly if needed */
                     /* background-color: rgba(200, 200, 200, 0.1); */
                 }

                 .panel-toggle[data-target="${this.id}"].back-button-active {
                     opacity: 1; /* Fully visible */
                     cursor: pointer; /* Standard pointer */
                 }

                 /* Override potential framework styles when disabled */
                 .panel-toggle[data-target="${this.id}"]:disabled,
                 .panel-toggle[data-target="${this.id}"].back-button-inactive {
                     /* Redundant opacity/cursor might be needed for specificity */
                     opacity: 0.5;
                     cursor: not-allowed;
                  }
             `;
            document.head.appendChild(style);
        },

        /**
         * Submit the "back" command ONLY if the plugin is active.
         */
        submitBackCommand: function() {
            // **Guard Clause**: Only proceed if the plugin is active
            if (!this.state.backPluginActive) {
                console.warn(`[${this.id}] 'Back' command blocked because the 'back' plugin is inactive.`);
                // Optional: Provide feedback, though the disabled state should mostly prevent this
                Framework.showToast('Back plugin is not active', 2000);
                return;
            }

            // --- Existing logic for sending command ---
            const userInput = document.getElementById('userInput');
            if (userInput) {
                const currentContent = userInput.value; // Store current input (might not be needed)
                 userInput.value = 'back'; // Set to 'back' temporarily
                Framework.sendMessage(); // Send the 'back' command
                 // Restore previous input? (Probably not desirable)
                // setTimeout(() => { if (userInput.value === 'back') userInput.value = currentContent; }, 100);

                Framework.showToast('Sending Back command...'); // Update feedback
            } else {
                console.error(`[${this.id}] User input field not found.`);
                 Framework.showToast('Error: Could not find input field.', 3000);
            }
        },

        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];

             // Remove added styles
            const styleElement = document.getElementById(`${this.id}-styles`);
             if (styleElement) {
                 styleElement.remove();
             }

             // Optional: Reset button styles if necessary (usually handled by browser/framework on unload)
             if(this.dom.button){
                 this.dom.button.disabled = false;
                 this.dom.button.classList.remove('back-button-active', 'back-button-inactive');
                 this.dom.button.style.opacity = ''; // Reset inline style if used
                 this.dom.button.style.cursor = ''; // Reset inline style if used
                 this.dom.button.removeAttribute('aria-disabled');
                 this.dom.button.title = "Repeat AI's Last Reply"; // Reset to default title
             }

            console.log(`[${this.id}] Component cleaned up.`);
        }
    };

    // Register component
    Framework.registerComponent(component.id, component);
})();