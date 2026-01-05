/**
 * UI Controls Module - Allows AI to modify the web interface
 * NOW CHECKS FOR CONTROLS ADDON INSTEAD OF VOICE ADDON
 * 
 * OVERVIEW:
 * This module adds a checkbox next to the hands-free toggle that, when checked,
 * enables the AI to modify the web interface using [CONTROL: command args] syntax.
 * 
 * SAFETY:
 * - Checkbox is unchecked by default on page load
 * - Must be manually enabled each session
 * - Only processes commands from AI responses, not user input
 * 
 * SUPPORTED COMMANDS:
 * [CONTROL: css selector | property: value; property2: value2]
 * [CONTROL: html selector | <html>content</html>]
 * [CONTROL: js javascript code]
 * [CONTROL: execute_js javascript code]  (alias for js)
 * [CONTROL: show_html html content]      (shows in popup)
 * [CONTROL: persist_style selector | styles]  (persists across chat updates)
 */
const UIControls = {
    // State management
    enabled: false,          // Whether UI controls are currently active
    pollInterval: null,      // Interval ID for polling control_output.json
    lastBatchId: null,       // Track last processed batch to avoid duplicates
    controlsAddonActive: false, // Track controls addon state
    
    /**
     * Initialize the UI Controls module
     * Creates the checkbox and sets up the system
     */
    init() {
        console.log('UIControls: Initializing...');
        
        // Wait for Framework to be loaded
        if (typeof Framework === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }
        
        // Listen for controls addon state changes
        Framework.on('controlsAddonStateChanged', (data) => {
            this.controlsAddonActive = data.active;
            this.updateCheckboxVisibility();
        });
        
        this.createCheckbox();
        this.addStyles();
        
        // Check initial state
        this.controlsAddonActive = Framework.state.controlsAddonActive || false;
        this.updateCheckboxVisibility();
    },
    
    /**
     * Creates the UI Controls checkbox in the chat interface
     * Places it in its own container for independent visibility control
     */
    createCheckbox() {
        // Poll until chat input form exists
        const checkInterval = setInterval(() => {
            const chatInput = document.querySelector('.chat-input');
            if (chatInput) {
                clearInterval(checkInterval);
                
                // Look for existing checkbox wrapper or voice options
                let wrapper = document.querySelector('.checkbox-options-wrapper');
                const voiceOptions = document.querySelector('.voice-options');
                
                // If wrapper doesn't exist, create it
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.className = 'checkbox-options-wrapper';
                    
                    // If voice options exist, move them into the wrapper
                    if (voiceOptions) {
                        const voiceParent = voiceOptions.parentNode;
                        const voiceNext = voiceOptions.nextSibling;
                        wrapper.appendChild(voiceOptions);
                        
                        // Insert wrapper where voice options were
                        if (voiceNext) {
                            voiceParent.insertBefore(wrapper, voiceNext);
                        } else {
                            voiceParent.appendChild(wrapper);
                        }
                    } else {
                        // No voice options, insert wrapper before first button
                        const firstButton = chatInput.querySelector('button');
                        if (firstButton) {
                            chatInput.insertBefore(wrapper, firstButton);
                        } else {
                            chatInput.appendChild(wrapper);
                        }
                    }
                }
                
                // Create INDEPENDENT container for UI Controls
                const container = document.createElement('div');
                container.className = 'ui-controls-options';
                container.setAttribute('data-disabled', 'true'); // Start disabled
                
                // Create the checkbox element
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = 'uiControlsToggle';
                
                // Create the label
                const label = document.createElement('label');
                label.htmlFor = 'uiControlsToggle';
                label.textContent = 'UI Controls';
                
                // Assemble and add to DOM
                container.appendChild(checkbox);
                container.appendChild(label);
                
                // Add to wrapper (after voice options if they exist)
                wrapper.appendChild(container);
                
                // Make entire container clickable
                container.addEventListener('click', (e) => {
                    // Don't do anything if disabled
                    if (container.getAttribute('data-disabled') === 'true') return;
                    
                    // Don't double-toggle if clicking directly on checkbox
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                });
                
                // Listen for checkbox changes
                checkbox.addEventListener('change', (e) => {
                    this.toggle(e.target.checked);
                });
                
                console.log('UIControls: Checkbox created');
                this.updateCheckboxVisibility();
            }
        }, 100);
    },
    
    /**
     * Update checkbox visibility based on controls addon state
     */
    updateCheckboxVisibility() {
        const container = document.querySelector('.ui-controls-options');
        if (!container) return;
        
        if (this.controlsAddonActive) {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
            container.setAttribute('data-disabled', 'false');
            container.title = '';
        } else {
            container.style.opacity = '0.5';
            container.style.pointerEvents = 'none';
            container.setAttribute('data-disabled', 'true');
            container.title = 'UI Controls unavailable (Controls Addon inactive)';
        }
    },
    
    /**
     * Toggle UI controls on/off
     * @param {boolean} enabled - Whether to enable or disable UI controls
     */
    toggle(enabled) {
        if (!this.controlsAddonActive) {
            Framework.showToast('UI Controls unavailable: Controls Addon is inactive');
            // Reset checkbox
            const checkbox = document.getElementById('uiControlsToggle');
            if (checkbox) checkbox.checked = false;
            return;
        }
        
        this.enabled = enabled;
        
        if (enabled) {
            // Start polling for commands from AI
            this.startPolling();
            Framework.showToast('UI Controls Enabled');
            console.log('UIControls: Started polling');
        } else {
            // Stop polling and clean up
            this.stopPolling();
            Framework.showToast('UI Controls Disabled');
            console.log('UIControls: Stopped polling');
        }
    },
    
    /**
     * Start polling control_output.json for new commands
     * This file is written by the backend when AI includes [CONTROL:] commands
     */
    startPolling() {
        if (this.pollInterval) return; // Already polling
        
        // Check immediately
        this.checkCommands();
        
        // Then poll every 2 seconds (matches backend controls.py polling rate)
        this.pollInterval = setInterval(() => this.checkCommands(), 2000);
    },
    
    /**
     * Stop polling for commands
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.lastBatchId = null; // Reset batch tracking
    },
    
    /**
     * Check control_output.json for new commands from AI
     * This file is written by controls.py when it finds [CONTROL:] tags in AI responses
     */
    async checkCommands() {
        if (!this.enabled) return;
        
        try {
            // Fetch with cache busting to ensure fresh data
            const url = '/control_output.json?t=' + Date.now();
            const response = await fetch(url, { cache: 'no-store' });
            
            if (!response.ok) {
                console.error('UIControls: Failed to fetch control_output.json');
                return;
            }
            
            const data = await response.json();
            console.log('UIControls: Fetched data:', data);
            
            // Process command batch if it's new
            if (data.type === 'command_batch' && data.batch_id && data.commands) {
                if (data.batch_id !== this.lastBatchId) {
                    this.lastBatchId = data.batch_id;
                    console.log(`UIControls: Processing batch ${data.batch_id} with ${data.commands.length} commands`);
                    
                    // Process each command in the batch
                    data.commands.forEach(cmd => {
                        try {
                            this.processCommand(cmd);
                        } catch (e) {
                            console.error('UIControls: Command error:', e);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('UIControls: Fetch error:', error);
        }
    },
    
    /**
     * Process a single command from the AI
     * @param {Object} data - Command object with 'command' and 'args' properties
     */
    processCommand(data) {
        if (!data?.command) return;
        
        const cmd = data.command.toLowerCase().trim();
        const args = String(data.args || '');
        
        console.log(`UIControls: Processing command: ${cmd}`);
        
        // Route to appropriate handler based on command name
        switch(cmd) {
            case 'css':
                this.handleCss(args);
                break;
                
            case 'execute_js':
            case 'js':
                this.handleJs(args);
                break;
                
            case 'html':
            case 'inject_element':
                this.handleHtml(args);
                break;
                
            case 'show_html':
                this.showHtml(args);
                break;
                
            case 'persist_style':
                this.handlePersistStyle(args);
                break;
                
            default:
                console.warn(`UIControls: Unknown command: ${cmd}`);
        }
    },
    
    /**
     * Handle CSS command
     * Format: [CONTROL: css selector | property: value; property2: value2]
     * Example: [CONTROL: css .ai-message | border-left: 4px solid blue; padding-left: 10px]
     * 
     * @param {string} args - The selector and styles separated by |
     */
    handleCss(args) {
        const parts = args.split('|');
        if (parts.length < 2) {
            console.error('UIControls: CSS needs format: selector | styles');
            return;
        }
        
        const selector = parts[0].trim();
        const styles = parts[1].trim();
        
        console.log(`UIControls: Applying CSS to ${selector}: ${styles}`);
        
        // Apply styles to all elements matching the selector
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            // Append to existing styles (use semicolon to ensure proper separation)
            el.style.cssText += ';' + styles;
        });
        
        console.log(`UIControls: Applied CSS to ${elements.length} elements`);
    },
    
    /**
     * Handle JavaScript execution command
     * Format: [CONTROL: js javascript code]
     * Example: [CONTROL: js document.body.style.backgroundColor = '#f0f0f0']
     * 
     * @param {string} code - JavaScript code to execute
     */
    handleJs(code) {
        if (!code.trim()) return;
        
        console.log('UIControls: Executing JS:', code);
        
        try {
            // Create and execute function
            const func = new Function(code);
            func();
            
            // If the code modifies messages, register it for persistence
            // This ensures the modification is reapplied when new messages arrive
            if (Framework && Framework.registerAIModification) {
                Framework.registerAIModification(() => {
                    try {
                        new Function(code)();
                    } catch(e) {
                        console.error('UIControls: Persistent JS error:', e);
                    }
                }, 'AI JS modification');
            }
            
            Framework.showToast('JS executed');
        } catch (e) {
            console.error('UIControls: JS Error:', e);
            Framework.showToast(`JS Error: ${e.message}`, 'error');
        }
    },
    
    /**
     * Handle HTML injection command
     * Format: [CONTROL: html selector | <html>content</html>]
     * Example: [CONTROL: html #chatMessages | <div style="color: blue;">Hello!</div>]
     * 
     * @param {string} args - The selector and HTML content separated by |
     */
    handleHtml(args) {
        const parts = args.split('|');
        if (parts.length < 2) {
            console.error('UIControls: HTML needs format: selector | html');
            return;
        }
        
        const selector = parts[0].trim();
        // Join remaining parts in case HTML contains |
        const html = parts.slice(1).join('|').trim();
        
        // Find target element
        const target = document.querySelector(selector);
        if (!target) {
            console.error(`UIControls: Target not found: ${selector}`);
            return;
        }
        
        console.log(`UIControls: Injecting HTML into ${selector}`);
        
        // Create elements from HTML string
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Mark each element as AI-injected so it persists across chat updates
        Array.from(temp.children).forEach(child => {
            child.setAttribute('data-ai-injected', 'true');
            target.appendChild(child);
        });
    },
    
    /**
     * Show HTML in a popup viewer
     * Format: [CONTROL: show_html <html>content</html>]
     * Creates a floating window with the HTML content
     * 
     * @param {string} html - HTML content to display
     */
    showHtml(html) {
        // Remove any existing viewer
        const existing = document.querySelector('.ui-controls-viewer');
        if (existing) existing.remove();
        
        // Create new viewer
        const viewer = document.createElement('div');
        viewer.className = 'ui-controls-viewer';
        viewer.innerHTML = `
            <button class="close-btn" onclick="this.parentElement.remove()">×</button>
            <div class="viewer-content">${html}</div>
        `;
        
        document.body.appendChild(viewer);
    },
    
    /**
     * Handle persistent style command
     * Like CSS but automatically reapplies when chat updates
     * Format: [CONTROL: persist_style selector | styles]
     * 
     * @param {string} args - The selector and styles separated by |
     */
    handlePersistStyle(args) {
        const parts = args.split('|');
        if (parts.length < 2) return;
        
        const selector = parts[0].trim();
        const styles = parts[1].trim();
        
        // Apply immediately
        document.querySelectorAll(selector).forEach(el => {
            el.style.cssText += ';' + styles;
        });
        
        // Register for persistence using Framework's AI modification system
        // This ensures styles are reapplied to new messages
        if (Framework && Framework.registerAIModification) {
            Framework.registerAIModification(() => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.cssText += ';' + styles;
                });
            }, `Style: ${selector}`);
        }
        
        Framework.showToast('Style applied and will persist');
    },
    
    /**
     * Add CSS styles for UI elements created by this module
     */
    addStyles() {
        if (document.getElementById('ui-controls-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ui-controls-styles';
        style.textContent = `
            /* Popup viewer for show_html command */
            .ui-controls-viewer {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #4a76a8;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 80%;
                max-height: 80%;
                padding: 20px;
                z-index: 10000;
            }
            
            .ui-controls-viewer .close-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                background: #4a76a8;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                cursor: pointer;
            }
            
            .ui-controls-viewer .viewer-content {
                overflow: auto;
                max-height: 70vh;
            }
        `;
        
        document.head.appendChild(style);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIControls.init());
} else {
    UIControls.init();
}

// Add to window for debugging purposes
// Allows checking state in console: window.UIControls.enabled
window.UIControls = UIControls;