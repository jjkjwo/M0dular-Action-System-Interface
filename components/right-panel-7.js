/**
 * ==============================================================================================
 * Restart Conversation Button Component (Styled as right-panel-7)
 * ==============================================================================================
 *
 * This component creates a utility button in the right sidebar that submits the "start key"
 * command when clicked. It does not open a panel and is always visually active.
 *
 * @version 1.0.1 - Corrected command submission to work with framework.
 */

(function() {
    // Component definition
    const component = {
        id: 'right-panel-7', // Matches data-target in HTML and config.js

        // DOM references
        dom: {
            button: null // Reference to the toggle button itself
        },

        // Component state (minimal)
        state: {
            // No state needed for this simple button
        },

        /**
         * Initialize the component: Find the button and attach listener.
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing Restart Conversation button...`);
            this.setupButton();
            if(this.dom.button) {
                console.log(`[${this.id}] Restart button initialized successfully.`);
            } else {
                console.error(`[${this.id}] Initialization failed: Button not found.`);
            }
        },

        /**
         * Finds the button, removes default framework panel-toggling handlers,
         * and adds our custom command submission handler.
         */
        setupButton: function() {
            let button = document.querySelector(`.panel-toggle[data-target="${this.id}"]`);
            if (!button) {
                console.error(`[${this.id}] Restart button toggle element not found in HTML.`);
                return;
            }

            this.dom.button = button; // Store ref before cloning

            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                this.dom.button = newButton;
                button = newButton; // Use new node locally
                console.log(`[${this.id}] Cloned button to remove default framework listeners.`);
            } else {
                console.error(`[${this.id}] Button has no parent node, cannot replace.`);
                this.dom.button = null;
                return;
            }

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.submitRestartCommand();
            });

            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.submitRestartCommand();
                }
            });

            // Ensure button is always visually active and enabled
            button.classList.remove('back-button-inactive');
            button.classList.add('restart-button-active'); // Optional specific class
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.removeAttribute('aria-disabled');
            button.title = "Restart Conversation (Sends 'start key' command)";
        },

        /**
         * Submits the "start key" command via the Framework's sendMessage.
         * CORRECTED: Temporarily sets the input field value as Framework.sendMessage
         * reads directly from it.
         */
        submitRestartCommand: function() {
            console.log(`[${this.id}] Preparing to send 'start key' command...`);

            const userInput = document.getElementById('userInput');

            if (!userInput) {
                console.error(`[${this.id}] User input field (#userInput) not found. Cannot send command.`);
                Framework.showToast('Error: Input field missing.', 3000);
                return;
            }

            // Store the current content of the input field, if any
            const originalInputValue = userInput.value;

            try {
                // Set the input field's value to the command we want to send
                userInput.value = 'start key';
                console.log(`[${this.id}] Set userInput value to 'start key'.`);

                // Call the framework's send function (which will now read 'start key')
                Framework.sendMessage();
                console.log(`[${this.id}] Framework.sendMessage() called.`);

                // Provide user feedback
                Framework.showToast('Restarting conversation context...', 2500);

            } catch (error) {
                 console.error(`[${this.id}] Error during command submission:`, error);
                 Framework.showToast('Error sending restart command.', 3000);
            } finally {
                // IMPORTANT: Restore the original input field content immediately after
                //            the sendMessage function is called. Check if the value is
                //            still 'start key' before restoring.
                 if (userInput.value === 'start key') {
                    userInput.value = originalInputValue;
                    console.log(`[${this.id}] Restored original userInput value.`);
                    // Optional: trigger input event to resize textarea if needed
                    userInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        },

        /**
         * Minimal cleanup (usually just logging for utility buttons).
         */
        cleanup: function() {
            // No listeners or styles added specifically by this component
            // need removal typically, as the button itself might persist.
            console.log(`[${this.id}] Restart Button component cleaned up (no explicit actions).`);
        }
    }; // End component definition

    // Register component with the framework
    if (typeof Framework !== 'undefined' && Framework.registerComponent) {
        Framework.registerComponent(component.id, component);
    } else {
        console.error(`[${component.id}] Framework not available for registration!`);
    }

})(); // End IIFE