/**
 * left-panel-1.js - Load Prompt Panel with Save Prompt Editor
 * Updated to include functionality to view and edit the save.txt prompt
 * 
 * @version 1.4.0 - Enhanced hover preview with improved positioning and performance
 */
(function() {
    const PanelComponent = {
        // Track scroll animation
        _scrollAnimationFrame: null,
        _currentPreviewId: null,
        _previewTimer: null,
        _hoverTimeout: null,
        
        initialize: function() {
            // Get panel content container
            const panelContent = document.getElementById('left-panel-1-content');
            if (!panelContent) {
                console.error('Panel content container not found');
                return;
            }

            // Create UI
            panelContent.innerHTML = `
                <div class="panel-section">
                    <h3>Saved Contexts</h3>
                    <div class="prompt-list" id="savedContextList">Loading saved contexts...</div>
                </div>
                <div class="panel-section">
                    <h3>Save Prompt Editor</h3>
                    <p class="help-text">Edit the prompt used when saving context with 'save' command</p>
                    <textarea id="savePromptEditor" rows="10" class="full-width-input" style="width: 100%; font-size: 12px; font-family: monospace;"></textarea>
                    <div class="button-row" style="margin-top: 10px; display: flex; gap: 5px;">
                        <button id="savePromptButton" class="primary-button">Save Changes</button>
                        <button id="resetPromptButton" class="secondary-button">Reset to Default</button>
                    </div>
                    <div id="savePromptStatus" class="status-message" style="margin-top: 5px; font-size: 12px; color: #4a76a8;"></div>
                </div>
                
                <!-- Visual separator between sections -->
                <div style="margin: 15px 0; border-top: 1px solid #e0e0e0; padding-top: 5px;">
                    <h4 style="margin-bottom: 10px; color: #4a76a8;">Quick Actions</h4>
                    <div class="button-row" style="display: flex; gap: 5px;">
                        <button id="executeSaveButton" class="action-button" style="background-color: #5a86b8;">Save Conversation</button>
                        <button id="executeFixButton" class="action-button" style="background-color: #6c757d;">Save Last AI Reply</button>
                    </div>
                </div>
                <!-- Preview tooltip - Fixed position in document body for better positioning -->
                <div id="contextPreview" class="context-preview-tooltip"></div>
            `;

            // Add CSS for hover preview with improved styling
            const style = document.createElement('style');
            style.textContent = `
                .context-preview-tooltip {
                    display: none;
                    position: fixed;
                    background: #fff;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 15px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    min-width: 250px;
                    max-width: min(80vw, 500px);
                    min-height: 50px;
                    max-height: min(60vh, 400px);
                    overflow-y: auto;
                    z-index: 1000;
                    font-size: 12px;
                    font-family: monospace;
                    white-space: pre-wrap;
                    word-break: break-word;
                    transition: opacity 0.3s, transform 0.2s;
                    line-height: 1.4;
                    scrollbar-width: thin;
                    scrollbar-color: #ccc transparent;
                    opacity: 0;
                    transform: translateY(5px);
                    pointer-events: none;
                }
                .context-preview-tooltip.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                .context-preview-tooltip::-webkit-scrollbar {
                    width: 6px;
                }
                .context-preview-tooltip::-webkit-scrollbar-thumb {
                    background-color: #ccc;
                    border-radius: 3px;
                }
                .context-loading {
                    text-align: center;
                    color: #666;
                    padding: 10px;
                }
                .action-button {
                    background-color: #5a86b8;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .action-button:hover {
                    background-color: #4a76a8;
                }
                .saved-context-item {
                    position: relative;
                }
                .password-form {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 5px;
                }
                .password-form input {
                    padding: 5px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                }
                .password-form button {
                    background-color: #5a86b8;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 5px 10px;
                    cursor: pointer;
                }
                .password-error {
                    color: #d32f2f;
                    font-size: 11px;
                    margin-top: 5px;
                }
                .load-context-btn {
                    background-color: #5a86b8;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 5px 10px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .load-context-btn:hover {
                    background-color: #4a76a8;
                }
                .load-context-btn {
                    position: relative;
                }
                /* Preview content styling */
                .preview-content {
                    line-height: 1.5;
                }
                .preview-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #4a76a8;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }
                .preview-type {
                    font-size: 11px;
                    color: #666;
                    margin-bottom: 10px;
                }
            `;
            document.head.appendChild(style);

            // Load the save prompt content
            this.loadSavePrompt();
            
            // Set up event listeners
            document.getElementById('savePromptButton').addEventListener('click', () => this.updateSavePrompt());
            document.getElementById('resetPromptButton').addEventListener('click', () => this.resetSavePrompt());
            document.getElementById('executeSaveButton').addEventListener('click', () => this.executeSaveCommand());
            document.getElementById('executeFixButton').addEventListener('click', () => this.executeFixCommand());
            
            // Also load the existing saved contexts
            this.loadSavedContexts();

            // Check if lvl3 is active via framework
            this.checkLvl3Status();

            // Subscribe to lvl3 state changes to update UI accordingly
            Framework.on('lvl3StateChanged', (data) => {
                this.onLvl3StateChanged(data.active);
            });

            // Event listeners for panel open/close to handle previews
            Framework.on('panelToggle', (data) => {
                if (data.panelId === 'left-panel-1' && !data.active) {
                    this.hideContextPreview();
                }
            });
        },

        checkLvl3Status: function() {
            // Check if lvl3 is currently active
            const isLvl3Active = Framework.state.lvl3Active;
            
            if (!isLvl3Active) {
                const panelContent = document.getElementById('left-panel-1-content');
                if (panelContent) {
                    panelContent.innerHTML = `
                        <div class="panel-section">
                            <div class="alert-message">
                                <p>The lvl3 action is not active.</p>
                                <p>This panel requires the lvl3 action to be running.</p>
                                <button id="startLvl3Button" class="primary-button">Activate lvl3</button>
                            </div>
                        </div>
                    `;
                    
                    document.getElementById('startLvl3Button').addEventListener('click', () => this.startLvl3Action());
                }
            }
        },

        onLvl3StateChanged: function(isActive) {
            if (isActive) {
                // Reload the panel content if lvl3 becomes active
                this.initialize();
            } else {
                this.checkLvl3Status();
            }
        },

        startLvl3Action: function() {
            const inputElement = document.getElementById('userInput');
            if (!inputElement) {
                Framework.showToast('Error: Input element not found');
                return;
            }
            
            // Send the command to start lvl3
            inputElement.value = "start lvl3";
            document.getElementById('sendButton').click();
            Framework.showToast('Starting lvl3 action...');
        },

        loadSavePrompt: function() {
            const editor = document.getElementById('savePromptEditor');
            const status = document.getElementById('savePromptStatus');
            
            if (!editor || !status) return;
            
            status.textContent = "Loading...";
            
            fetch(CONFIG.api.savePrompt)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        editor.value = data.prompt;
                        status.textContent = "Prompt loaded successfully";
                        setTimeout(() => { status.textContent = ""; }, 2000);
                    } else {
                        status.textContent = "Error: " + (data.error || "Failed to load prompt");
                    }
                })
                .catch(error => {
                    console.error('Error loading save prompt:', error);
                    status.textContent = "Error loading prompt";
                });
        },

        updateSavePrompt: function() {
            const editor = document.getElementById('savePromptEditor');
            const status = document.getElementById('savePromptStatus');
            
            if (!editor || !status) return;
            
            const prompt = editor.value.trim();
            
            if (!prompt) {
                status.textContent = "Error: Prompt cannot be empty";
                return;
            }
            
            status.textContent = "Saving...";
            
            fetch(CONFIG.api.savePrompt, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        status.textContent = "Prompt saved successfully";
                        setTimeout(() => { status.textContent = ""; }, 2000);
                    } else {
                        status.textContent = "Error: " + (data.error || "Failed to save prompt");
                    }
                })
                .catch(error => {
                    console.error('Error saving prompt:', error);
                    status.textContent = "Error saving prompt";
                });
        },

        resetSavePrompt: function() {
            // Default prompt
            const defaultPrompt = `Generate a highly compressed, machine-parsable representation of the current conversation's *dynamic and evolving* context. This representation should be suitable for direct input into another instance of a functionally equivalent large language model, enabling it to fully reconstruct the conversation's state.
[Concise, Machine-Parsable Output String ONLY]`;
            
            const editor = document.getElementById('savePromptEditor');
            if (editor) {
                editor.value = defaultPrompt;
                this.updateSavePrompt();
            }
        },

        // Execute the save command
        executeSaveCommand: function() {
            const inputElement = document.getElementById('userInput');
            if (!inputElement) {
                Framework.showToast('Error: Input element not found');
                return;
            }
            
            // Send the save command
            inputElement.value = "save";
            document.getElementById('sendButton').click();
            Framework.showToast('Saving conversation context...');
        },

        // Execute the fix command
        executeFixCommand: function() {
            const inputElement = document.getElementById('userInput');
            if (!inputElement) {
                Framework.showToast('Error: Input element not found');
                return;
            }
            
            // Send the fix command
            inputElement.value = "fix";
            document.getElementById('sendButton').click();
            Framework.showToast('Saving last AI reply...');
        },

        loadSavedContexts: function() {
            // Load list of saved contexts
            const contextList = document.getElementById('savedContextList');
            if (!contextList) return;
            
            fetch(CONFIG.api.savedContexts)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.contexts && data.contexts.length > 0) {
                        contextList.innerHTML = `
                            <div class="context-list-header" style="font-weight: bold; margin-bottom: 8px;">
                                <span style="flex: 1;">Filename</span>
                                <span style="width: 80px; text-align: center;">Action</span>
                            </div>
                        `;
                        
                        data.contexts.forEach(context => {
                            const contextDate = new Date(context.date);
                            const formattedDate = contextDate.toLocaleDateString() + ' ' + 
                                                contextDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            
                            const contextEl = document.createElement('div');
                            contextEl.className = 'saved-context-item';
                            contextEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #eee;';
                            contextEl.innerHTML = `
                                <div class="context-info" style="flex: 1; overflow: hidden;">
                                    <div class="context-name" style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${context.name}</div>
                                    <div class="context-date" style="font-size: 10px; color: #666;">${formattedDate}</div>
                                </div>
                                <button class="load-context-btn" data-id="${context.id}" data-filename="${context.name}" style="min-width: 60px;">Load</button>
                            `;
                            
                            contextList.appendChild(contextEl);
                        });
                        
                        // Add event listeners to load buttons
                        document.querySelectorAll('.load-context-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const contextId = e.target.getAttribute('data-id');
                                const filename = e.target.getAttribute('data-filename');
                                
                                // Check if it's anya.txt (case insensitive)
                                if (filename.toLowerCase() === 'anya.txt') {
                                    this.showPasswordPrompt(contextId, filename);
                                } else {
                                    this.loadContext(contextId);
                                }
                            });
                            
                            // Improved hover events for context preview with delay
                            btn.addEventListener('mouseenter', (e) => {
                                // Clear any existing timeout
                                if (this._hoverTimeout) {
                                    clearTimeout(this._hoverTimeout);
                                }
                                
                                // Set a short delay before showing preview (prevents flicker)
                                this._hoverTimeout = setTimeout(() => {
                                    const contextId = e.target.getAttribute('data-id');
                                    const filename = e.target.getAttribute('data-filename');
                                    this.showContextPreview(contextId, filename, e);
                                }, 300); // 300ms delay before showing preview
                            });
                            
                            btn.addEventListener('mouseleave', () => {
                                // Clear the timeout if mouse leaves before preview shows
                                if (this._hoverTimeout) {
                                    clearTimeout(this._hoverTimeout);
                                    this._hoverTimeout = null;
                                }
                                
                                // Set a short delay before hiding (prevents flickering)
                                setTimeout(() => {
                                    // Only hide if the preview isn't being hovered
                                    const previewEl = document.getElementById('contextPreview');
                                    if (previewEl && !previewEl._isHovered) {
                                        this.hideContextPreview();
                                    }
                                }, 100);
                            });
                        });
                        
                        // Add hover management for the preview itself
                        const previewEl = document.getElementById('contextPreview');
                        if (previewEl) {
                            previewEl._isHovered = false;
                            
                            previewEl.addEventListener('mouseenter', () => {
                                previewEl._isHovered = true;
                            });
                            
                            previewEl.addEventListener('mouseleave', () => {
                                previewEl._isHovered = false;
                                this.hideContextPreview();
                            });
                        }
                    } else {
                        contextList.innerHTML = '<p class="no-data" style="color: #666; font-style: italic;">No saved contexts found</p>';
                    }
                })
                .catch(error => {
                    console.error('Error loading contexts:', error);
                    contextList.innerHTML = '<p class="error-message" style="color: #d32f2f;">Error loading saved contexts</p>';
                });
        },

        // New password prompt function for protected files
        showPasswordPrompt: function(contextId, filename) {
            const passwordPrompt = document.createElement('div');
            passwordPrompt.className = 'password-prompt';
            passwordPrompt.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 5px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 1100; min-width: 300px;';
            passwordPrompt.innerHTML = `
                <h3 style="margin-top: 0; color: #4a76a8;">Protected Context</h3>
                <p>This context file is password protected.</p>
                <div class="password-form">
                    <input type="password" id="contextPassword" placeholder="Enter password">
                    <div id="passwordError" class="password-error" style="display: none;"></div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                        <button id="cancelPasswordBtn">Cancel</button>
                        <button id="submitPasswordBtn">Load Context</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(passwordPrompt);
            
            // Focus on password field
            setTimeout(() => {
                const passwordField = document.getElementById('contextPassword');
                if (passwordField) passwordField.focus();
            }, 100);
            
            // Add event listeners
            document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
                passwordPrompt.remove();
            });
            
            document.getElementById('submitPasswordBtn').addEventListener('click', () => {
                const password = document.getElementById('contextPassword').value;
                const errorEl = document.getElementById('passwordError');
                
                if (password === 'LVL3action') {
                    passwordPrompt.remove();
                    this.loadContext(contextId);
                } else {
                    errorEl.textContent = 'Incorrect password. Please try again.';
                    errorEl.style.display = 'block';
                }
            });
            
            // Handle Enter key
            document.getElementById('contextPassword').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('submitPasswordBtn').click();
                }
            });
        },

        loadContext: function(contextId) {
            // Implementation for loading a context
            const inputElement = document.getElementById('userInput');
            if (!inputElement) {
                Framework.showToast('Error: Input element not found');
                return;
            }
            
            // Send the load command to the backend
            inputElement.value = `load ${contextId}`;
            document.getElementById('sendButton').click();
            Framework.showToast(`Loading context: ${contextId}`);
        },

        // Improved smart position function that adapts to available space
        getPreviewPosition: function(targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Ensure minimum dimensions while being responsive
            const previewWidth = Math.max(300, Math.min(viewportWidth * 0.5, 500));
            const previewHeight = Math.max(150, Math.min(viewportHeight * 0.6, 400));
            
            let position = {
                width: previewWidth + 'px'
            };
            
            // Calculate positions - keeping the preview fully visible is priority
            // Right position (default)
            const rightSpace = viewportWidth - rect.right - 20;
            const leftSpace = rect.left - 20;
            const topSpace = rect.top;
            const bottomSpace = viewportHeight - rect.bottom - 20;
            
            // Default to right if there's enough space
            if (rightSpace >= previewWidth) {
                position.left = rect.right + 15 + 'px';
                
                // Vertical alignment - prefer center, adjust if needed
                const idealTop = rect.top - (previewHeight - rect.height) / 2;
                if (idealTop < 10) {
                    position.top = '10px'; // Ensure top margin
                } else if (idealTop + previewHeight > viewportHeight - 10) {
                    position.top = (viewportHeight - previewHeight - 10) + 'px'; // Ensure bottom margin
                } else {
                    position.top = idealTop + 'px'; // Center alignment
                }
            }
            // Try left if right doesn't have enough space
            else if (leftSpace >= previewWidth) {
                position.left = (rect.left - previewWidth - 15) + 'px';
                
                // Vertical alignment - same logic as above
                const idealTop = rect.top - (previewHeight - rect.height) / 2;
                if (idealTop < 10) {
                    position.top = '10px';
                } else if (idealTop + previewHeight > viewportHeight - 10) {
                    position.top = (viewportHeight - previewHeight - 10) + 'px';
                } else {
                    position.top = idealTop + 'px';
                }
            }
            // If neither left nor right has enough space, place below or above
            else {
                // Center horizontally as much as possible
                position.left = Math.max(10, Math.min(viewportWidth - previewWidth - 10, 
                    rect.left + (rect.width - previewWidth) / 2)) + 'px';
                
                // Place below if there's space, otherwise above
                if (bottomSpace >= previewHeight) {
                    position.top = (rect.bottom + 15) + 'px';
                } else if (topSpace >= previewHeight) {
                    position.top = (rect.top - previewHeight - 15) + 'px';
                } else {
                    // If no good option, place at top of screen with scrolling
                    position.top = '10px';
                }
            }
            
            return position;
        },

        // Fixed auto-scroll function with much better scrolling performance
        startAutoScroll: function(element) {
            if (!element) return;
            
            // Clear any existing animation
            if (this._scrollAnimationFrame) {
                window.cancelAnimationFrame(this._scrollAnimationFrame);
                this._scrollAnimationFrame = null;
            }
            
            // Reset to top immediately
            element.scrollTop = 0;
            
            // Wait 1 second before starting scroll
            if (this._previewTimer) {
                clearTimeout(this._previewTimer);
            }
            
            this._previewTimer = setTimeout(() => {
                const scrollHeight = element.scrollHeight;
                const clientHeight = element.clientHeight;
                
                // Only auto-scroll if content is taller than container
                if (scrollHeight > clientHeight) {
                    // Set a reasonable scroll speed based on content length
                    const SCROLL_SPEED = 100; // 100 pixels per second
                    
                    // Calculate duration based on content length
                    const scrollDistance = scrollHeight - clientHeight;
                    const duration = Math.max(3000, (scrollDistance / SCROLL_SPEED) * 1000);
                    
                    const startTime = performance.now();
                    const self = this;
                    
                    function smoothScroll(timestamp) {
                        const elapsed = timestamp - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Simple linear scroll - more reliable than easing
                        element.scrollTop = progress * scrollDistance;
                        
                        if (progress < 1) {
                            self._scrollAnimationFrame = window.requestAnimationFrame(smoothScroll);
                        } else {
                            self._scrollAnimationFrame = null;
                            
                            // After finishing the scroll, pause 1 second then scroll back to top
                            setTimeout(() => {
                                // Smoothly scroll back to top
                                const scrollBackDuration = 1000;
                                const startBackTime = performance.now();
                                const startScrollPos = element.scrollTop;
                                
                                function scrollBackToTop(timestamp) {
                                    const elapsedBack = timestamp - startBackTime;
                                    const progressBack = Math.min(elapsedBack / scrollBackDuration, 1);
                                    
                                    element.scrollTop = startScrollPos * (1 - progressBack);
                                    
                                    if (progressBack < 1) {
                                        self._scrollAnimationFrame = window.requestAnimationFrame(scrollBackToTop);
                                    } else {
                                        self._scrollAnimationFrame = null;
                                        // After returning to top, start the cycle again
                                        setTimeout(() => self.startAutoScroll(element), 1000);
                                    }
                                }
                                
                                self._scrollAnimationFrame = window.requestAnimationFrame(scrollBackToTop);
                            }, 1000);
                        }
                    }
                    
                    self._scrollAnimationFrame = window.requestAnimationFrame(smoothScroll);
                }
            }, 1000);
        },

        // Helper function to fetch and display content
        fetchAndDisplayContent: function(contextId, previewEl) {
            // Cancel any existing scroll animation
            if (this._scrollAnimationFrame) {
                window.cancelAnimationFrame(this._scrollAnimationFrame);
                this._scrollAnimationFrame = null;
            }
            
            // Reset scroll position
            previewEl.scrollTop = 0;
            
            // Fetch content from the API endpoint
            fetch(`${CONFIG.api.savedContextContent}${contextId}/content`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load preview: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Create a more structured and informative preview
                        let previewContent = `<div class="preview-title">${data.filename}</div>`;
                        
                        // Add file type info if available
                        if (data.type) {
                            let typeDesc = data.description || 'Unknown type';
                            previewContent += `<div class="preview-type">${typeDesc}</div>`;
                        }
                        
                        // Add the actual content
                        previewContent += `<div class="preview-content">${this.escapeHtml(data.content)}</div>`;
                        
                        // Display content
                        previewEl.innerHTML = previewContent;
                        this._currentPreviewId = contextId;
                        
                        // Start auto-scroll after content is displayed
                        this.startAutoScroll(previewEl);
                    } else {
                        previewEl.innerHTML = data.error || "Could not load preview";
                    }
                })
                .catch(error => {
                    console.error('Error loading context preview:', error);
                    previewEl.innerHTML = `<div class="preview-error" style="color:#d32f2f">${error.message}</div>`;
                });
        },
        
        // Improved preview with auto-scrolling and privacy check
        showContextPreview: function(contextId, filename, event) {
            // Clear any existing preview first
            this.hideContextPreview();
            
            const previewEl = document.getElementById('contextPreview');
            if (!previewEl) return;
            
            // Update position dynamically based on viewport
            const position = this.getPreviewPosition(event.target);
            Object.keys(position).forEach(prop => {
                previewEl.style[prop] = position[prop];
            });
            
            // Show loading indicator
            previewEl.innerHTML = `<div class="context-loading">Loading preview...</div>`;
            
            // Make preview visible with opacity transition
            previewEl.style.display = 'block';
            // Force reflow to trigger CSS transitions
            void previewEl.offsetWidth;
            previewEl.classList.add('visible');
            
            // Check if it's anya.txt (case insensitive)
            if (filename.toLowerCase() === 'anya.txt') {
                previewEl.innerHTML = `<div class="password-form">
                    <p>This context file is password protected.</p>
                    <input type="password" id="previewPassword" placeholder="Enter password">
                    <div id="previewPasswordError" class="password-error" style="display: none;"></div>
                    <button id="previewSubmitPasswordBtn">View Content</button>
                </div>`;
                
                // Add event listener to password button
                document.getElementById('previewSubmitPasswordBtn').addEventListener('click', () => {
                    const password = document.getElementById('previewPassword').value;
                    const errorEl = document.getElementById('previewPasswordError');
                    
                    if (password === 'LVL3action') {
                        // Password correct, fetch and display content
                        this.fetchAndDisplayContent(contextId, previewEl);
                    } else {
                        errorEl.textContent = 'Incorrect password. Please try again.';
                        errorEl.style.display = 'block';
                    }
                });
                
                // Handle Enter key
                document.getElementById('previewPassword').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById('previewSubmitPasswordBtn').click();
                    }
                });
                
                return;
            }
            
            // For non-protected files, fetch content directly
            this.fetchAndDisplayContent(contextId, previewEl);
        },
        
        // Helper function to safely escape HTML content
        escapeHtml: function(text) {
            if (!text) return '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");
        },
        
        // Hide preview and properly clean up
        hideContextPreview: function() {
            const previewEl = document.getElementById('contextPreview');
            if (!previewEl) return;
            
            // Cancel any ongoing animations
            if (this._scrollAnimationFrame) {
                window.cancelAnimationFrame(this._scrollAnimationFrame);
                this._scrollAnimationFrame = null;
            }
            
            if (this._previewTimer) {
                clearTimeout(this._previewTimer);
                this._previewTimer = null;
            }
            
            if (this._hoverTimeout) {
                clearTimeout(this._hoverTimeout);
                this._hoverTimeout = null;
            }
            
            // Fade out
            previewEl.classList.remove('visible');
            
            // After transition completes, hide completely
            setTimeout(() => {
                if (!previewEl.classList.contains('visible')) {
                    previewEl.style.display = 'none';
                    // Reset state and scroll position
                    this._currentPreviewId = null;
                    previewEl.scrollTop = 0;
                    previewEl.innerHTML = '';
                }
            }, 300); // Match this to the CSS transition time
        },
        
        // Clean up when panel is closed or another panel is opened
        onPanelClose: function() {
            this.hideContextPreview();
            
            // Clear any timers
            if (this._previewTimer) {
                clearTimeout(this._previewTimer);
                this._previewTimer = null;
            }
            
            if (this._hoverTimeout) {
                clearTimeout(this._hoverTimeout);
                this._hoverTimeout = null;
            }
            
            if (this._scrollAnimationFrame) {
                window.cancelAnimationFrame(this._scrollAnimationFrame);
                this._scrollAnimationFrame = null;
            }
        }
    };

    // Register with framework
    Framework.registerComponent('left-panel-1', PanelComponent);
})();