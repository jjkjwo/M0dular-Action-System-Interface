/**
 *  ===================
 * M0dular Panel Framework - Core System - Created by James O'kelly
 *  ===================
 * Manages modular panels, chat interface, and system state
 * Version 3.8.0 - Decoupled panel system into separate PanelManager module
 */

//  ===================
// FRAMEWORK CORE - Global State & Configuration
//  ===================

const Framework = {
    // === Component Registry ===
    modules: {},          // Loaded modules
    components: {},       // Registered component instances
    panelManager: null,   // Panel manager instance

    // === Event System ===
    events: {},           // Event subscriptions

    // === DOM Cache ===
    dom: {},              // Cached DOM references

    // === Loading State ===
    loadedComponents: 0,  // Counter for dynamic loading
    totalComponents: 0,   // Total components to load
    componentsInitialized: false,

    // === Application State ===
    state: {
        // System State
        clientId: null,
        lvl3Active: false,
        isMobile: false,
        isLandscape: false,
        backActionActive: false,
        controlsAddonActive: false,

        // Chat State
        lastLogCount: 0,
        messagesCache: [],
        isScrolledToBottom: true,
        expectingAIResponse: false,
        lastMessageTimestamp: null,
        lastMessageId: null,
        messageHashes: new Map(), // Track message hashes for deduplication
        isUpdatingChat: false,    // Flag to prevent scroll jumpiness during updates

        // Request Management
        activeRequests: new Set(),

        // Voice features state now managed by VoiceUtilities
        voiceAddonActive: false,

        // UI Visibility State
        arePanelTogglesGloballyVisibleByOverride: true,  // Buttons visible by default
        areLogMessagesVisible: false,                    // Logs hidden by default

        // AI Modifications Persistence
        aiModifications: {
            // Store modification functions that should be applied to new messages
            messageMods: [],
            // Store CSS rules that should persist
            cssRules: [],
            // Track if we have active modifications
            hasActiveMods: false
        }
    },

    // Polling Interval IDs
    logPollingIntervalId: null, // Regular log polling interval
};

//  ===================
// INITIALIZATION & LIFECYCLE
//  ===================

document.addEventListener('DOMContentLoaded', () => Framework.init());

Framework.init = function() {
    console.log('Framework initializing...');

    // Initialize core systems in order
    this.cacheDomReferences();
    this.detectDeviceState();
    
    // Initialize Panel Manager
    this.panelManager = new PanelManager(CONFIG, {
        showToast: this.showToast.bind(this),
        debounce: this.debounce,
        getComponent: (id) => this.components[id] || null
    });
    this.panelManager.init();
    
    // Load panel components after panel manager creates the panels
    this.loadPanelComponents();
    
    // Connect panel manager events to framework events
    this.panelManager.on('panelToggle', (data) => {
        this.trigger('panelToggle', data);
    });
    this.panelManager.on('utilityToggleClicked', (data) => {
        this.trigger('utilityToggleClicked', data);
    });
    
    this.setupEventHandlers();
    this.initChat(); // This now explicitly does NOT start log polling by default
    this.initAIMessageObserver(); // Initialize observer to apply AI modifications to new messages

    // Generate unique client ID for multi-client coordination
    this.state.clientId = this.generateClientId();

    // Start background processes (only active actions polling here now)
    this.startDataPolling();

    // Initialize Voice Utilities Module
    this.initializeVoiceUtilities();

    // Listen for auth state changes - THIS IS THE NEW, ROBUST HANDLER
    document.addEventListener('authChange', (event) => {
        console.log('Framework: Auth state changed:', event.detail);

        // Clear any existing regular log polling interval before new auth state is processed
        if (this.logPollingIntervalId) {
            clearInterval(this.logPollingIntervalId);
            this.logPollingIntervalId = null;
            console.log("Framework: Cleared existing log polling interval due to authChange.");
        }

        if (typeof authManager !== 'undefined' && authManager.is_auth_enabled) {
            if (!event.detail.isAuthenticated) {
                // User is NOT authenticated. Show the public welcome state.
                this.updateConnectionStatus('Welcome! Login optional', '#4a76a8');
                this.setInputState(true); // Keep chat enabled for guests

                // Clear any potentially rendered logs and show the welcome message.
                if (this.dom.chatMessages) {
                    // IMPORTANT: Preserve AI-injected elements when showing welcome message
                    const aiElements = [];
                    this.dom.chatMessages.querySelectorAll('[data-ai-injected], .ai-injected, [data-ai-source]').forEach(el => {
                        aiElements.push(el);
                    });

                    this.dom.chatMessages.innerHTML = '<div class="system-message">Welcome! You can start chatting or login for saved history.</div>';

                    // Re-add AI elements after welcome message
                    aiElements.forEach(el => {
                        this.dom.chatMessages.appendChild(el);
                    });
                }

                // Clear the internal message cache to prevent stale data on login.
                this.state.messagesCache = [];
                this.state.lastLogCount = 0;
                this.state.messageHashes.clear();

            } else {
                // User IS authenticated. Show loading state while backend restarts
                this.updateConnectionStatus('Loading your conversation history...', '#FFA500');
                this.setInputState(false); // Temporarily disable input

                // Show loading message in chat while preserving AI elements
                if (this.dom.chatMessages) {
                    // IMPORTANT: Preserve AI-injected elements during loading
                    const aiElements = [];
                    this.dom.chatMessages.querySelectorAll('[data-ai-injected], .ai-injected, [data-ai-source]').forEach(el => {
                        aiElements.push(el);
                    });

                    this.dom.chatMessages.innerHTML = `
                        <div class="system-message" style="text-align: center; padding: 20px;">
                            <div style="font-size: 24px; margin-bottom: 10px;">🔄</div>
                            <div>Welcome back, ${event.detail.username}!</div>
                            <div style="margin-top: 10px; opacity: 0.8;">Loading your conversation history...</div>
                            <div style="margin-top: 10px;">
                                <div class="loading-dots">
                                    <span>•</span><span>•</span><span>•</span>
                                </div>
                            </div>
                        </div>
                    `;

                    // Re-add AI elements after loading message
                    aiElements.forEach(el => {
                        this.dom.chatMessages.appendChild(el);
                    });
                }

                // Start polling for logs after a delay to allow backend to restart
                setTimeout(() => {
                    this.updateConnectionStatus('Connected', 'green');
                    this.setInputState(true);

                    // Aggressive polling configuration
                    let pollAttempts = 0;
                    const maxAttempts = 10; // Max 10 attempts = 5 seconds of polling

                    // Indicate that we are in an aggressive login history polling phase
                    this.state.activeRequests.add('loginHistoryPolling');

                    // Define the polling function
                    const pollForHistory = async () => {
                        try {
                            // Attempt to fetch logs
                            await this.fetchLogs();

                            // Check if we actually got messages
                            if (this.state.messagesCache.length === 0 && pollAttempts < maxAttempts) {
                                // No messages yet and we haven't hit max attempts
                                pollAttempts++;
                                console.log(`Framework: No messages yet, retrying (${pollAttempts}/${maxAttempts})...`);

                                // Schedule another attempt in 500ms
                                setTimeout(pollForHistory, 500);
                            } else if (this.state.messagesCache.length > 0) {
                                // Success! We got messages
                                console.log(`Framework: Successfully loaded ${this.state.messagesCache.length} messages`);

                                // Show a toast notification to confirm history is loaded
                                this.showToast(`Loaded ${this.state.messagesCache.length} messages from your history`, 3000);

                                // The messages should already be displayed by fetchLogs,
                                // but we could force a scroll to bottom here if needed
                                this.scrollChatToBottom();

                                // Stop the aggressive polling once messages are loaded
                                this.state.activeRequests.delete('loginHistoryPolling');
                                console.log('Framework: Aggressive history polling stopped (success).');

                                // NOW that initial history is loaded, start the regular log polling
                                this.startRegularLogPolling();

                            } else {
                                // We've hit max attempts with no messages
                                console.log('Framework: No messages found after all attempts');

                                // Check if the chat is truly empty (not just the cache)
                                if (this.dom.chatMessages && this.dom.chatMessages.children.length <= 1) { // Check children instead of innerHTML
                                    // Preserve AI elements when showing "no history" message
                                    const aiElements = [];
                                    this.dom.chatMessages.querySelectorAll('[data-ai-injected], .ai-injected, [data-ai-source]').forEach(el => {
                                        aiElements.push(el.cloneNode(true));
                                    });
                                    this.dom.chatMessages.innerHTML = '<div class="system-message">Ready to start a new conversation!</div>';
                                    aiElements.forEach(el => {
                                        this.dom.chatMessages.appendChild(el);
                                    });
                                }
                                // Stop the aggressive polling if max attempts reached
                                this.state.activeRequests.delete('loginHistoryPolling');
                                console.log('Framework: Aggressive history polling stopped (max attempts).');

                                // Even if no history found, regular polling should start for future messages.
                                this.startRegularLogPolling();
                            }
                        } catch (error) {
                            // Handle errors during polling
                            console.error('Framework: Error polling for history:', error);

                            // Retry if we haven't hit max attempts
                            if (pollAttempts < maxAttempts) {
                                pollAttempts++;
                                setTimeout(pollForHistory, 500);
                            } else {
                                // Give up and show error state
                                this.updateConnectionStatus('Error loading history', 'red');
                                this.showToast('Failed to load conversation history', 5000);
                                // Stop the aggressive polling on error
                                this.state.activeRequests.delete('loginHistoryPolling');
                                console.log('Framework: Aggressive history polling stopped (error).');

                                // Start regular log polling even on error, to attempt future updates
                                this.startRegularLogPolling();
                            }
                        }
                    };

                    // Start the aggressive polling
                    console.log('Framework: Starting aggressive history polling after login...');
                    pollForHistory();

                }, 2000); // Reduced initial wait from 3s to 2s for faster response
            }
        }
    });

    // Set initial UI visibility classes
    document.body.classList.add('framework-logs-hidden', 'framework-panel-toggles-visible-override');

    // Initialize dynamic button states
    this.updateBackButtonState();

    console.log('Framework initialized successfully.');
};

Framework.generateClientId = function() {
    const id = `client-${Math.random().toString(36).substring(2,15)}`;
    console.log(`Framework: Generated client ID: ${id}`);
    return id;
};

Framework.initializeVoiceUtilities = function() {
    if (typeof VoiceUtilities === 'undefined') {
        console.warn('Framework: VoiceUtilities module not found. Voice features will be unavailable.');
        return;
    }

    VoiceUtilities.initialize({
        dom: this.dom,
        config: CONFIG,
        clientId: this.state.clientId,
        callbacks: {
            // UI callbacks
            showToast: this.showToast.bind(this),

            // State accessors
            getVoiceAddonState: () => this.state.voiceAddonActive,
            getExpectingAIResponse: () => this.state.expectingAIResponse,
            setExpectingAIResponse: (value) => { this.state.expectingAIResponse = value; },

            // Action callbacks
            sendMessage: this.sendMessage.bind(this),

            // Event system
            on: this.on.bind(this),
            off: this.off.bind(this),
            trigger: this.trigger.bind(this),

            // Request tracking
            isRequestActive: (type) => this.state.activeRequests.has(type),
            addActiveRequest: (type) => this.state.activeRequests.add(type),
            removeActiveRequest: (type) => this.state.activeRequests.delete(type)
        }
    });

    // Handle user interaction for sound autoplay
    const handleUserInteraction = () => {
        if (VoiceUtilities.shared?.handleUserInteraction) {
            VoiceUtilities.shared.handleUserInteraction();
        }
    };
    document.body.addEventListener('click', handleUserInteraction, { once: true });
    document.body.addEventListener('keydown', handleUserInteraction, { once: true });
};

Framework.initAIMessageObserver = function() {
    if (!this.dom.chatMessages) return;

    const observer = new MutationObserver((mutations) => {
        // Only proceed if we have active modifications to apply
        if (!this.state.aiModifications.hasActiveMods) return;

        let hasNewAIMessages = false;

        // Check all DOM mutations to see if any new AI messages were added
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                // Check if the added node is an element with the 'ai-message' class
                if (node.nodeType === 1 && node.classList && node.classList.contains('ai-message')) {
                    hasNewAIMessages = true;
                }
            });
        });

        if (hasNewAIMessages) {
            // Apply modifications after a small delay to ensure DOM is settled
            // This delay prevents issues with messages that are still being constructed
            setTimeout(() => this.applyPersistedAIModifications(), 50);
        }
    });

    // Start observing the chat messages container for new children
    observer.observe(this.dom.chatMessages, {
        childList: true,  // Watch for added/removed children
        subtree: true     // Watch all descendants, not just direct children
    });

    console.log('Framework: AI message observer initialized');
};

//  ===================
// DOM MANAGEMENT
//  ===================

Framework.cacheDomReferences = function() {
    // Chat elements
    this.dom.chatMessages = document.getElementById('chatMessages');
    this.dom.userInput = document.getElementById('userInput');
    this.dom.sendButton = document.getElementById('sendButton');
    this.dom.chatContainer = document.getElementById('chatContainer');
    this.dom.statusElement = document.getElementById('connectionStatus');

    // Media controls
    const mediaIds = ['ttsToggleButton', 'soundToggleButton', 'micToggleButton'];
    mediaIds.forEach(id => this.dom[id] = document.getElementById(id));

    // Voice UI elements
    const voiceIds = ['recordingIndicator', 'countdownTimer', 'voiceOptionsContainer', 'handsFreeModeToggle'];
    voiceIds.forEach(id => this.dom[id] = document.getElementById(id));
    this.dom.countdownText = document.querySelector('.countdown-text');
    this.dom.countdownProgress = document.querySelector('.countdown-progress');

    // Special buttons
    this.dom.backToggleButton = document.getElementById('toggle-right-repeat-reply');

    // Footer toggles
    this.dom.toggleLogsLink = document.getElementById('toggleLogsLink');
    this.dom.togglePanelsLink = document.getElementById('togglePanelsLink');

    // Panel overlay
    this.dom.panelOverlay = document.getElementById('panelOverlay');

    // Panel areas
    Object.keys(CONFIG.areas).forEach(k => {
        const a = CONFIG.areas[k];
        if (a?.id) this.dom[a.id] = document.getElementById(a.id);
    });
};

Framework.detectDeviceState = function() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const m = w <= 768;
    const l = w > h;
    const changed = (this.state.isMobile !== m) || (this.state.isLandscape !== l);

    this.state.isMobile = m;
    this.state.isLandscape = l;

    if (changed) {
        console.log(`Framework: Device state updated - Mobile: ${m}, Landscape: ${l}`);
    }

    return {isMobile: m, isLandscape: l, width: w, height: h};
};

//  ===================
// EVENT SYSTEM
//  ===================

Framework.on = function(eventName, callback) {
    if (typeof callback !== 'function') {
        console.error(`Framework.on: Invalid callback for event "${eventName}"`);
        return null;
    }

    if (!this.events[eventName]) {
        this.events[eventName] = [];
    }

    const listenerId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    this.events[eventName].push({id: listenerId, callback: callback});
    console.log(`Framework: Listener added for event "${eventName}" (ID: ${listenerId})`);

    return listenerId;
};

Framework.off = function(eventName, listenerId) {
    if (!this.events[eventName]) {
        return false;
    }

    if (!listenerId) {
        console.warn(`Framework.off: No listener ID provided for event "${eventName}"`);
        return false;
    }

    const initialLength = this.events[eventName].length;
    this.events[eventName] = this.events[eventName].filter(listener => listener.id !== listenerId);

    if (this.events[eventName].length < initialLength) {
        console.log(`Framework: Listener removed for event "${eventName}" (ID: ${listenerId})`);
        if (this.events[eventName].length === 0) {
            delete this.events[eventName];
            console.log(`Framework: Event queue emptied for "${eventName}".`);
        }
        return true;
    }

    return false;
};

Framework.trigger = function(eventName, data = {}) {
    if (!this.events[eventName]) {
        return;
    }

    console.log(`Framework: Triggering event "${eventName}" with data:`, data);
    const listenersToCall = [...this.events[eventName]]; // Create a copy in case handlers modify the list

    listenersToCall.forEach(listener => {
        // Check if the listener still exists in the original array, in case it was removed by a previous handler
        if (this.events[eventName]?.find(l => l.id === listener.id)) {
            try {
                listener.callback(data);
            } catch(error) {
                console.error(`Framework: Error in handler for event "${eventName}":`, error);
            }
        }
    });
};

//  ===================
// EVENT HANDLERS & USER INTERACTION
//  ===================

Framework.setupEventHandlers = function() {
    // Chat input handlers
    this.setupChatHandlers();

    // Global keyboard shortcuts
    document.addEventListener('keydown', this.handleGlobalButtonVisibilityToggleKey.bind(this));

    // Media control buttons
    this.setupMediaControlHandlers();

    // Footer toggle links
    this.setupFooterToggles();
};

Framework.setupChatHandlers = function() {
    if (this.dom.sendButton) {
        this.dom.sendButton.addEventListener('click', () => this.sendMessage());
    } else {
        console.error("Framework: Send button not found. Cannot add event listener.");
    }

    if (this.dom.userInput) {
        // Enter key to send
        this.dom.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.dom.userInput.addEventListener('input', function() {
            this.style.height = 'auto'; // Reset height
            const computedStyle = window.getComputedStyle(this);
            const paddingTop = parseFloat(computedStyle.paddingTop);
            const paddingBottom = parseFloat(computedStyle.paddingBottom);
            // Calculate content height (scrollHeight includes padding)
            const scrollHeight = this.scrollHeight - paddingTop - paddingBottom;
            const minHeight = 38; // As per existing CSS or desired min height
            const maxHeight = 150; // As per existing CSS or desired max height

            // New height considers only content height for clamping
            let newHeight = Math.max(minHeight - paddingTop - paddingBottom, scrollHeight); // Ensure min content height
            newHeight = Math.min(newHeight, maxHeight - paddingTop - paddingBottom); // Ensure max content height

            // Final height sets the CSS 'height' property, which includes padding
            this.style.height = `${newHeight + paddingTop + paddingBottom}px`;

            // Adjust overflow based on scrollHeight *including* padding
            this.style.overflowY = this.scrollHeight >= maxHeight ? 'auto' : 'hidden';
        });

        // Disable hands-free mode when typing
        this.dom.userInput.addEventListener('input', () => {
            if (VoiceUtilities?.initialized &&
                VoiceUtilities.state.handsFree.enabled &&
                !VoiceUtilities.state.speech.isVoiceInput &&
                this.dom.userInput.value.trim() !== '') {
                console.log("User manually typed, automatically disabling hands-free mode");
                VoiceUtilities.state.handsFree.enabled = false;
                if (this.dom.handsFreeModeToggle) {
                    this.dom.handsFreeModeToggle.checked = false;
                }
                if (VoiceUtilities.state.speech.isRecognizing) {
                    VoiceUtilities.speech.stop();
                }
                if (VoiceUtilities.state.handsFree.pendingRecognitionRestart) {
                    clearTimeout(VoiceUtilities.state.handsFree.pendingRecognitionRestart);
                    VoiceUtilities.state.handsFree.pendingRecognitionRestart = null;
                }
                this.showToast('Hands-free mode disabled while typing', 2000);
            }
        });

        // Trigger initial resize
        this.dom.userInput.dispatchEvent(new Event('input'));
    } else {
        console.error("Framework: User input textarea not found.");
    }

    // Chat scroll tracking
    if (this.dom.chatMessages) {
        this.dom.chatMessages.addEventListener('scroll', this.throttle(() => {
            const el = this.dom.chatMessages;
            const threshold = 10; // Pixels from bottom
            this.state.isScrolledToBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + threshold;
        }, 100));
    } else {
        console.error("Framework: Chat messages container not found.");
    }
};

Framework.setupMediaControlHandlers = function() {
    const mediaHandlers = {
        ttsToggleButton: () => VoiceUtilities?.initialized ? VoiceUtilities.tts.toggle() : this.showToast('Voice features not available'),
        soundToggleButton: () => VoiceUtilities?.initialized ? VoiceUtilities.sound.toggle() : this.showToast('Voice features not available'),
        micToggleButton: () => VoiceUtilities?.initialized ? VoiceUtilities.speech.toggle() : this.showToast('Voice features not available')
    };

    Object.entries(mediaHandlers).forEach(([buttonId, handler]) => {
        if (this.dom[buttonId]) {
            this.dom[buttonId].addEventListener('click', handler);
        } else {
            console.warn(`Framework: ${buttonId} button not found, media control may be impaired.`);
        }
    });
};

Framework.setupFooterToggles = function() {
    if (this.dom.toggleLogsLink) {
        this.dom.toggleLogsLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleLogMessages();
        });
    }

    if (this.dom.togglePanelsLink) {
        this.dom.togglePanelsLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.togglePanelVisibility();
        });
    }
};

Framework.handleGlobalButtonVisibilityToggleKey = function(event) {
    if (event.key === '=' && !this.isInputFocused(event)) {
        event.preventDefault();
        this.togglePanelVisibility();
    }
};

Framework.isInputFocused = function(event) {
    const tag = event.target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || event.target.isContentEditable;
};

//  ===================
// UI STATE MANAGEMENT
//  ===================

Framework.toggleLogMessages = function() {
    this.state.areLogMessagesVisible = !this.state.areLogMessagesVisible;
    document.body.classList.toggle('framework-logs-hidden', !this.state.areLogMessagesVisible);
    this.showToast(this.state.areLogMessagesVisible ? 'Logs: Shown' : 'Logs: Hidden', 2000);
    console.log(`Log messages: Now ${this.state.areLogMessagesVisible ? 'visible' : 'hidden'}`);
};

Framework.togglePanelVisibility = function() {
    document.body.classList.toggle('framework-panel-toggles-visible-override');
    this.state.arePanelTogglesGloballyVisibleByOverride =
        document.body.classList.contains('framework-panel-toggles-visible-override');

    this.showToast(this.state.arePanelTogglesGloballyVisibleByOverride ? 'Panel Toggles: Shown' : 'Panel Toggles: Hidden', 2000);
    console.log(`Panel toggles: Now ${this.state.arePanelTogglesGloballyVisibleByOverride ? 'visible' : 'hidden'}`);
};

Framework.updateBackButtonState = function() {
    if (!this.dom.backToggleButton) {
        console.warn("updateBackButtonState: Back toggle button not found in DOM.");
        return;
    }

    const isRunning = this.state.backActionActive;
    this.dom.backToggleButton.classList.toggle('action-running', isRunning);
    this.dom.backToggleButton.setAttribute('title',
        isRunning ? 'Back action is currently running' : 'Repeat AI\'s Last Reply');
    // Verbose log kept for debugging state changes if needed.
    // console.log(`Back button: ${isRunning ? 'Applied' : 'Removed'} action-running state`);
};

//  ===================
// COMPONENT LOADING
//  ===================

Framework.createElement = function(tag, attrs = {}) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'textContent') {
            el.textContent = value;
        } else if (key === 'className') {
            el.className = value;
        } else {
            el.setAttribute(key, value);
        }
    });
    return el;
};

Framework.loadComponent = function(id, path) {
    if (!path) {
        console.warn(`No component path provided for panel: ${id}`);
        this.onComponentLoaded();
        return;
    }

    if (!path.endsWith('.js')) {
        console.warn(`Component path for ${id} (${path}) might be incorrect`);
    }

    const s = document.createElement('script');
    s.src = path;
    s.onload = () => {
        console.log(`Component Loaded: ${path} for panel ${id}`);
        this.onComponentLoaded();
    };
    s.onerror = (e) => {
        console.error(`Failed to load component: ${path} for panel ${id}`, e);
        this.handleComponentLoadError(id);
        this.onComponentLoaded();
    };
    document.head.appendChild(s);
};

Framework.onComponentLoaded = function() {
    this.loadedComponents++;
    if (this.loadedComponents >= this.totalComponents) {
        this.initializeComponents();
    }
};

Framework.handleComponentLoadError = function(id) {
    const panelElement = document.getElementById(id);
    if (panelElement && !CONFIG.panels[id]?.isUtility) {
        const contentElement = panelElement.querySelector('.panel-content');
        if (contentElement) {
            contentElement.innerHTML = `<div class="error-message">Error loading component for ${id}. Please check console.</div>`;
        }
        if (this.panelManager) {
            this.panelManager.deactivatePanel(id);
        }
    }
};

Framework.initializeComponents = function() {
    console.log('Initializing components...');

    if (this.componentsInitialized) {
        console.warn("Framework: Components already initialized.");
        return;
    }

    let successfulInits = 0;

    Object.entries(this.components).forEach(([id, c]) => {
        if (c && typeof c.initialize === 'function') {
            try {
                console.log(`Initializing component: ${id}`);
                c.initialize();
                successfulInits++;
            } catch(e) {
                console.error(`Initialization error for component ${id}:`, e);
                this.showComponentError(id, 'Error initializing panel');
            }
        } else {
            if (CONFIG.panels[id] && !CONFIG.panels[id].isUtility) {
                console.warn(`Framework: Component ${id} missing or didn't register correctly.`);
                this.showComponentError(id, 'Panel component not found or failed to register');
            }
        }
    });

    console.log(`Framework: ${successfulInits} components initialized successfully.`);
    this.componentsInitialized = true;
    if (this.panelManager) {
        this.panelManager.updateAllAreaSizes();
    }
    this.trigger('componentsInitialized');
};

Framework.loadPanelComponents = function() {
    this.totalComponents = Object.keys(CONFIG.panels).length;
    if (this.totalComponents === 0) { return; }
    Object.entries(CONFIG.panels).forEach(([id, cfg]) => {
        this.loadComponent(id, cfg.component);
    });
};

Framework.showComponentError = function(id, message) {
    const panelContent = document.getElementById(`${id}-content`);
    if (panelContent) {
        panelContent.innerHTML = `<div class="error-message">${message} ${id}. Details in console.</div>`;
    }
};

//  ===================
// CHAT SYSTEM
//  ===================

Framework.initChat = function() {
    // We no longer fetch logs here immediately. Instead, we wait for the 'authChange'
    // event to determine if we should load a user's private chat or show a public message.
    console.log("Framework: Initializing chat and waiting for auth status...");
    this.fetchActiveActions(); // Initial fetch for actions like Lvl3 status
    this.updateConnectionStatus('Initializing connection...', '#FFA500'); // Initial status
};

Framework.sendMessage = async function() {
    // This logic is already solid. It correctly suggests login for guests
    // but allows them to send messages, which is the desired "optional login" behavior.
    if (typeof authManager !== 'undefined' && authManager.is_auth_enabled && !authManager.isAuthenticated()) {
        console.log("sendMessage: User not authenticated, showing login modal as suggestion.");
        authManager.showLoginModal();
        this.showToast('Login recommended for full features', 3000);
        // Do not return; allow guest messaging
    }

    if (!this.dom.userInput || !this.dom.sendButton) {
        console.error("sendMessage: Cannot send message, input or button element not found.");
        return;
    }

    const textToSend = this.dom.userInput.value.trim();
    if (!textToSend) {
        console.log("sendMessage: Ignoring empty input.");
        this.handleEmptyMessage();
        return;
    }

    // Disable UI during send
    this.setInputState(false);
    this.updateConnectionStatus('Sending message...', '#FFA500');

    try {
        console.log(`sendMessage: Sending input: "${textToSend}"`);
        this.prepareSendState();

        if (!CONFIG.api?.submitInput) {
            throw new Error("Submit input API endpoint not configured in config.js");
        }

        const headers = {
            'Content-Type': 'text/plain'
        };
        // Add auth headers if authManager is available and user is authenticated
        if (typeof authManager !== 'undefined' && authManager.getAuthHeaders) {
            Object.assign(headers, authManager.getAuthHeaders());
        }

        const response = await fetch(CONFIG.api.submitInput, {
            method: 'POST',
            headers: headers, // Use the combined headers
            body: textToSend
        });

        console.log(`sendMessage: Response status: ${response.status}`);

        if (!response.ok) {
            // This block correctly handles 401 Unauthorized errors by prompting login.
            if (response.status === 401 && typeof authManager !== 'undefined') {
                authManager.showLoginModal(); // Prompt login
                this.state.expectingAIResponse = false;
                console.error(`sendMessage: Authentication required, resetting expectation flag.`);
                // Do not clearInput() here, let user resend after login if they wish.
                throw new Error('Authentication required. Please login to send messages.');
            }

            const errorDetails = await this.getErrorDetails(response);
            this.state.expectingAIResponse = false;
            console.error(`sendMessage: Send failed, resetting expectation flag.`);
            throw new Error(`HTTP ${response.status} - ${errorDetails}`);
        }

        console.log("sendMessage: POST request successful.");
        this.clearInput();
        this.handleSuccessfulSend();

    } catch(error) {
        console.error('sendMessage Error:', error);
        this.handleSendError(error); // This will update connection status
    } finally {
        // Always re-enable input, unless a more specific state dictates otherwise
        this.setInputState(true);
        if(this.dom.statusElement.textContent === 'Sending message...'){ // if no error, set to connected
            this.updateConnectionStatus('Connected', 'green');
        }
        console.log("sendMessage: Input and button re-enabled (if not overridden by error status).");
    }
};

Framework.handleEmptyMessage = function() {
    if (typeof VoiceUtilities !== 'undefined' && VoiceUtilities?.state.handsFree.autoRestartPending) {
        console.log("sendMessage: Empty input in hands-free mode, resetting auto-restart flag");
        VoiceUtilities.state.handsFree.autoRestartPending = false;
        if (VoiceUtilities.state.handsFree.enabled) {
            VoiceUtilities.handsFree.safeRestart(500);
        }
    }
    // Optionally, give some feedback if the input was empty and send was pressed
    // this.showToast("Cannot send an empty message.", 2000);
};

Framework.prepareSendState = function() {
    this.state.expectingAIResponse = true;
    if (typeof VoiceUtilities !== 'undefined' && VoiceUtilities?.state.sound) {
        VoiceUtilities.state.sound.userInteracted = true; // Mark interaction for sound autoplay
    }
    if (typeof VoiceUtilities !== 'undefined' && VoiceUtilities?.state.speech) {
        VoiceUtilities.state.speech.pendingSubmission = false; // Clear pending submission flag
    }
};

Framework.setInputState = function(enabled) {
    if(this.dom.userInput) this.dom.userInput.disabled = !enabled;
    if(this.dom.sendButton) this.dom.sendButton.disabled = !enabled;
    if (enabled && this.dom.userInput && document.activeElement !== this.dom.userInput) {
        // Only focus if input is not already focused to avoid disrupting user.
        // And if window is focused.
        if (document.hasFocus()) {
           // this.dom.userInput.focus(); // Re-focusing can be aggressive, use with caution.
        }
    }
};

Framework.clearInput = function() {
    if(this.dom.userInput) {
        this.dom.userInput.value = '';
        this.dom.userInput.dispatchEvent(new Event('input')); // To trigger auto-resize
    }
};

Framework.handleSuccessfulSend = function() {
    this.updateConnectionStatus('Message sent, awaiting response...', 'green'); // Optimistic update
    if (typeof VoiceUtilities !== 'undefined' && VoiceUtilities?.state.handsFree.enabled) {
        console.log("Hands-free mode: Message sent successfully, waiting to auto-restart");
        VoiceUtilities.state.handsFree.waitingForResponse = true;
        const srConfig = CONFIG.speechRecognition || {};
        // Use configured delay or default
        VoiceUtilities.state.handsFree.delay = srConfig.handsFreeModeDelay || 1500;
        VoiceUtilities.handsFree.safeRestart(VoiceUtilities.state.handsFree.delay);
    }
};

Framework.handleSendError = function(error) {
    // Ensure message is user-friendly. `error.message` might contain technical details.
    let displayError = "Failed to send message.";
    if (error.message && !error.message.startsWith("HTTP")) { // Avoid showing raw HTTP errors if not needed
        displayError = error.message;
    } else if (error.message) {
        displayError = "Error sending message. Please try again.";
    }

    this.updateConnectionStatus(`Send Error: ${this.truncateError(error.message || 'Unknown error')}`, 'red');
    this.showToast(displayError, 5000);

    if (typeof VoiceUtilities !== 'undefined' && VoiceUtilities?.state.handsFree.autoRestartPending) {
        console.log("sendMessage: Error occurred during send, resetting auto-restart flag for hands-free.");
        VoiceUtilities.state.handsFree.autoRestartPending = false;
        // Optionally, attempt to restart hands-free if appropriate after an error
        // if (VoiceUtilities.state.handsFree.enabled) {
        //     VoiceUtilities.handsFree.safeRestart(2000); // Restart after a delay
        // }
    }
    this.state.expectingAIResponse = false; // Crucial: reset this flag on error.
};

Framework.getErrorDetails = async function(response) {
    try {
        const errorBody = await response.text(); // Attempt to get more details from response body
        // Sanitize or shorten errorBody if it's too long or complex for direct display.
        return errorBody || response.statusText; // Fallback to statusText
    } catch (readError) {
        console.warn("sendMessage: Could not read error response body:", readError);
        return response.statusText; // Ultimate fallback
    }
};

Framework.updateConnectionStatus = function(message, color = '#333333') {
    if (this.dom.statusElement) {
        this.dom.statusElement.textContent = message;
        this.dom.statusElement.style.color = color;
        this.dom.statusElement.setAttribute('aria-live', 'polite'); // Good for accessibility
    } else {
        console.warn("updateConnectionStatus: Status element not found in DOM.");
    }
};

//  ===================
// DATA POLLING & FETCHING
//  ===================

Framework.startDataPolling = function() {
    console.log("Framework: Starting data polling intervals.");
    const intervals = CONFIG.refreshIntervals || {}; // Ensure refreshIntervals exists

    // Logs polling - This is now managed by authChange listener and startRegularLogPolling
    // It will only start AFTER successful authentication and initial history load (if any).

    // Active actions polling
    if (CONFIG.api?.activeActions && intervals.activeActions > 0) {
        setInterval(() => this.fetchActiveActions(), intervals.activeActions);
        console.log(`Framework: Polling active actions every ${intervals.activeActions}ms`);
    } else {
        console.warn("Framework: Active actions polling disabled (no endpoint or interval <= 0).");
    }
};

// New function to start the regular log polling
Framework.startRegularLogPolling = function() {
    const intervals = CONFIG.refreshIntervals || {};
    if (CONFIG.api?.logs && intervals.logs > 0 && this.logPollingIntervalId === null) {
        this.logPollingIntervalId = setInterval(() => {
            // Ensure authManager exists and user is authenticated before fetching logs
            if (typeof authManager !== 'undefined' && authManager.isAuthenticated()) {
                this.fetchLogs();
            } else {
                // If auth status changes mid-interval (e.g., user logs out), stop polling
                if (this.logPollingIntervalId) {
                    clearInterval(this.logPollingIntervalId);
                    this.logPollingIntervalId = null;
                    console.log("Framework: Stopped regular log polling (auth status changed during interval or user logged out).");
                }
            }
        }, intervals.logs);
        console.log(`Framework: Started regular log polling every ${intervals.logs}ms.`);
    } else if (this.logPollingIntervalId !== null) {
        console.log("Framework: Regular log polling already active or attempting to re-start, skipping.");
    } else {
        console.warn("Framework: Regular log polling cannot start (endpoint/interval missing or disabled).");
    }
};


Framework.fetchLogs = async function() {
    if (this.state.activeRequests.has('logs')) {
        // console.log("fetchLogs: Already fetching logs, request skipped.");
        return;
    }

    // Security Check: Do not fetch logs if the user is not authenticated.
    if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
        console.warn("fetchLogs: Aborted. User is not authenticated.");
        // Clear interval if it's somehow running without auth
        if (this.logPollingIntervalId) {
            clearInterval(this.logPollingIntervalId);
            this.logPollingIntervalId = null;
            console.log("Framework: Stopped regular log polling as user is not authenticated.");
        }
        return;
    }

    if (!this.dom.chatMessages) {
        console.error("fetchLogs: chatMessages DOM element not found.");
        return;
    }

    if (!CONFIG.api?.logs) {
        console.error("fetchLogs: Logs API endpoint not configured");
        this.updateConnectionStatusIfNeeded('Config Error: Logs endpoint missing', 'red');
        return;
    }

    this.state.activeRequests.add('logs');
    const chatEl = this.dom.chatMessages;
    const scrollThreshold = 15; // Consider making this slightly larger for leniency
    const wasScrolledToBottom = (chatEl.scrollHeight - chatEl.clientHeight <= chatEl.scrollTop + scrollThreshold);

    const isAggressiveLoginPolling = this.state.activeRequests.has('loginHistoryPolling');

    let fetchedLogs = [];

    try {
        // console.log(`fetchLogs: Fetching from ${CONFIG.api.logs}`); // Can be verbose, make conditional if needed
        const headers = (typeof authManager !== 'undefined' && authManager.getAuthHeaders) ? authManager.getAuthHeaders() : {};
        const response = await fetch(CONFIG.api.logs, {
            cache: "no-store", // Essential for fetching fresh logs
            headers: headers
        });

        if (!response.ok) {
            // handleFetchError will throw, so we don't need to throw again here unless specifically desired
            await this.handleFetchError(response, 'fetchLogs');
            // If handleFetchError doesn't throw (e.g., if modified), ensure to throw here.
            // For now, assume it throws.
            return; // Exit if error handled and thrown
        }

        const data = await response.json();
        // console.log("fetchLogs: Data received successfully."); // Verbose log

        this.updateConnectionStatusIfNeeded('Connected', 'green'); // Update only if no critical error is shown

        if (data?.logs && Array.isArray(data.logs)) {
            fetchedLogs = data.logs;
        } else {
            console.warn("fetchLogs: Logs data received from API is missing or not an array:", data);
            // Don't clear cache here; might be a temporary API glitch. Let `hasNewLogs` handle comparison.
        }
    } catch (error) { // Catches network errors or errors from handleFetchError/response.json()
        console.error('fetchLogs Error:', error);
        // Avoid overwriting a more specific error (like Send Error) with a generic connection error
        this.updateConnectionStatusIfNeeded(`Connection error: ${this.truncateError(error.message)}`, 'red');
        // No re-throw needed here, error is logged and status updated.
    } finally {
        this.state.activeRequests.delete('logs');
    }

    // Update messages only if logs were successfully fetched (even if empty array)
    // The previous `try` block handles the "fetch failed" scenario.
    if (this.hasNewLogs(fetchedLogs)) { // hasNewLogs now compares content, not just length
        // console.log(`fetchLogs: New log data detected. Updating chat with ${fetchedLogs.length} messages.`);
        this.state.messagesCache = [...fetchedLogs]; // Store a copy
        this.updateChatMessages(this.state.messagesCache); // Pass the copy

        // Only scroll if user was already at/near bottom AND chat is not currently in an update phase (isUpdatingChat)
        if (wasScrolledToBottom && !this.state.isUpdatingChat) {
            this.scrollChatToBottom();
            // console.log("fetchLogs: Scrolled chat to bottom after update."); // Verbose
        }

        this.handleHandsFreeResponse(); // For voice UI integration
    } else if (fetchedLogs.length === 0 && this.state.messagesCache.length > 0 && !isAggressiveLoginPolling) {
        // This case: fetched an empty array, but we had messages cached, and it's not the initial login poll.
        // This could mean the log file was cleared on the server.
        console.warn("fetchLogs: Received 0 logs from server, but messages were cached. Clearing chat.");
        this.state.messagesCache = []; // Clear internal cache
        
        // Preserve AI elements while clearing regular messages
        const aiElements = [];
        this.dom.chatMessages.querySelectorAll('[data-ai-injected], .ai-injected, [data-ai-source]').forEach(el => {
            aiElements.push(el.cloneNode(true));
        });
        this.dom.chatMessages.innerHTML = '<div class="system-message">Conversation history cleared or no new messages.</div>';
        aiElements.forEach(el => {
            this.dom.chatMessages.appendChild(el);
        });
        
        this.state.lastLogCount = this.dom.chatMessages.children.length; // Update count based on actual DOM
        if (wasScrolledToBottom) this.scrollChatToBottom();

    } else {
        // console.log("fetchLogs: Fetched logs but no *new* content detected to render, or initial aggressive poll with no data yet.");
    }
};


Framework.hasNewLogs = function(newLogs) {
    if (!newLogs) return false; // If newLogs is null or undefined, not new.
    if (!this.state.messagesCache) return newLogs.length > 0; // If old cache is null, any new logs are new.

    // Compare length first for a quick exit if different
    if (newLogs.length !== this.state.messagesCache.length) {
        return true;
    }

    // Deep compare array content. Assumes logs are arrays of strings or simple objects that stringify consistently.
    // For more complex objects, a proper deep equality check would be needed.
    for (let i = 0; i < newLogs.length; i++) {
        // Simple comparison, assumes log entries are primitive or consistently stringifiable
        if (String(newLogs[i]) !== String(this.state.messagesCache[i])) {
            return true; // Found a difference
        }
    }
    return false; // No new logs (arrays are identical in content and order)
};


Framework.handleHandsFreeResponse = function() {
    if (VoiceUtilities?.state.handsFree.enabled && VoiceUtilities.state.handsFree.waitingForResponse) {
        // console.log("Hands-free mode: New log data detected while waiting for response"); // Can be verbose
        if (!VoiceUtilities.state.handsFree.pendingRecognitionRestart && !VoiceUtilities.state.speech.isRecognizing) {
            // console.log("Hands-free mode: Scheduling recognition restart after response"); // Can be verbose
            VoiceUtilities.handsFree.safeRestart(VoiceUtilities.state.handsFree.delay);
        }
    }
};

Framework.updateConnectionStatusIfNeeded = function(message, color) {
    // Only update if current status isn't a more specific or persistent error.
    const currentStatusText = this.dom.statusElement ? this.dom.statusElement.textContent : "";
    if (this.dom.statusElement &&
        !currentStatusText?.toLowerCase().includes('send error') &&
        !currentStatusText?.toLowerCase().includes('config error') &&
        !currentStatusText?.toLowerCase().includes('authentication required')) { // Don't override auth errors
        this.updateConnectionStatus(message, color);
    }
};

Framework.truncateError = function(message, maxLength = 50) {
    if (typeof message !== 'string') message = String(message); // Ensure it's a string
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
};

Framework.handleFetchError = async function(response, source) {
    // Check if a more persistent error message is already displayed.
    // Don't overwrite critical errors like "Send Error" or "Config Error" with transient fetch errors.
    const currentStatusText = this.dom.statusElement ? this.dom.statusElement.textContent : "";
    if (currentStatusText?.toLowerCase().includes('send error') ||
        currentStatusText?.toLowerCase().includes('config error')) {
        console.warn(`${source}: Received non-OK response (HTTP ${response.status}) but preserving existing critical status message.`);
        // Optionally, still throw an error if the function is expected to always throw on failure.
        // For now, just log and return to avoid status overwrite.
        // throw new Error(`HTTP ${response.status} - Preserving existing status message.`);
        return; // Don't update status, let the existing more critical message persist.
    }

    let errorText = `HTTP ${response.status}`;
    try {
        const body = await response.text();
        errorText += (body ? ` - ${body}` : ` - ${response.statusText}`);
    } catch (readError) {
        console.warn(`${source}: Could not read error response body:`, readError);
        errorText += ` - ${response.statusText}`; // Fallback to statusText
    }
    console.error(`${source}: Error response status: ${errorText}`);

    // If it's a 401, specific handling might be needed (e.g., prompt login)
    if (response.status === 401 && typeof authManager !== 'undefined') {
        console.warn(`${source}: Received 401 Unauthorized. Session might be invalid or expired.`);
        // authManager.handleUnauthorized(); // Delegate to authManager if it has such a method
        // For now, just update status and throw
        this.updateConnectionStatus('Session expired or unauthorized. Please login.', 'red');
        throw new Error('Authentication_Required_Or_Expired'); // Special error type for specific handling
    }

    // Update general connection status with the fetched error.
    this.updateConnectionStatus(`Error fetching data: ${this.truncateError(errorText)}`, 'red');
    throw new Error(errorText); // Always throw after handling, so calling functions know it failed.
};

Framework.fetchActiveActions = async function() {
    if (this.state.activeRequests.has('activeActions')) {
        // console.log("fetchActiveActions: Request already in progress, skipped.");
        return;
    }

    if (!CONFIG.api?.activeActions) {
        console.error("fetchActiveActions: Active Actions API endpoint not configured.");
        return; // No endpoint, cannot proceed
    }

    this.state.activeRequests.add('activeActions');

    try {
        const response = await fetch(CONFIG.api.activeActions, { cache: "no-store" });
        if (!response.ok) {
            const errorText = await this.getActiveActionsError(response);
            throw new Error(errorText); // Let catch block handle it
        }

        const data = await response.json();
        this.processActiveActions(data);

    } catch (error) {
        console.error('fetchActiveActions Error:', error.message); // Log the actual error message
        this.resetAllActionStates(); // Reset states on any fetch failure
    } finally {
        this.state.activeRequests.delete('activeActions');
    }
};

Framework.getActiveActionsError = async function(response) {
    let errorText = `HTTP ${response.status}`;
    try {
        const body = await response.text();
        errorText += (body ? ` - ${body}` : ` - ${response.statusText}`);
    } catch { /* ignore read error, statusText is enough */ }
    return errorText;
};

Framework.processActiveActions = function(data) {
    let lvl3CurrentlyActive = false;
    let voiceAddonCurrentlyActive = false;
    let controlsAddonCurrentlyActive = false;
    let backActionCurrentlyActive = false;

    if (data && Array.isArray(data.actions)) {
        // Normalize actions for robust checking: lowercase and take part before any colon
        const lowerCaseActions = data.actions.map(a => String(a).split(':')[0].trim().toLowerCase());

        lvl3CurrentlyActive = lowerCaseActions.includes('lvl3');

        // More robust keywords for voice addon, check if any part of action string contains these
        const voiceKeywords = ['voice addon', 'voiceaddon', 'voice_addon', 'voice'];
        voiceAddonCurrentlyActive = data.actions.some(actionString => {
            const lowerActionString = String(actionString).toLowerCase();
            return voiceKeywords.some(keyword => lowerActionString.includes(keyword));
        });

        // Check for controls addon
        const controlsKeywords = ['controls', 'control'];
        controlsAddonCurrentlyActive = data.actions.some(actionString => {
            const lowerActionString = String(actionString).split(':')[0].trim().toLowerCase();
            return controlsKeywords.some(keyword => lowerActionString.includes(keyword));
        });

        backActionCurrentlyActive = lowerCaseActions.includes('back');
    } else {
        console.warn("fetchActiveActions: 'actions' array missing or invalid in response data:", data);
        // Do not reset states here, could be a temporary blip. Let resetAllActionStates handle general errors.
    }

    // Update states based on fetched data
    this.updateLvl3State(lvl3CurrentlyActive);
    this.updateVoiceAddonState(voiceAddonCurrentlyActive);
    this.updateControlsAddonState(controlsAddonCurrentlyActive);
    this.updateBackActionState(backActionCurrentlyActive);

    // Trigger event for other modules interested in the raw actions data
    this.trigger('activeActionsUpdated', { actions: data?.actions || [] });
};

Framework.updateLvl3State = function(active) {
    if (this.state.lvl3Active !== active) {
        this.state.lvl3Active = active;
        console.log(`Framework: Lvl3 Action state changed to: ${active}`);
        if (this.panelManager) {
            this.panelManager.setLvl3State(active);
        }
        this.trigger('lvl3StateChanged', { active });
    }
};

Framework.updateVoiceAddonState = function(active) {
    if (this.state.voiceAddonActive !== active) {
        console.log(`Voice Addon Active status changed: ${active}`);
        this.state.voiceAddonActive = active;

        if (VoiceUtilities?.initialized) {
            VoiceUtilities.updateVoiceAddonState(active);
        }
        this.trigger('voiceAddonStateChanged', { active }); // New event
    }
};

Framework.updateControlsAddonState = function(active) {
    if (this.state.controlsAddonActive !== active) {
        console.log(`Controls Addon Active status changed: ${active}`);
        this.state.controlsAddonActive = active;
        this.trigger('controlsAddonStateChanged', { active });
    }
};

Framework.updateBackActionState = function(active) {
    if (this.state.backActionActive !== active) {
        // console.log(`Back Action Active status changed: ${active}`); // Can be verbose
        this.state.backActionActive = active;
        this.updateBackButtonState(); // Update UI
        this.trigger('backActionStateChanged', { active }); // New event
    }
};

Framework.resetAllActionStates = function() {
    // Reset Lvl3 if it was active
    if (this.state.lvl3Active) {
        this.state.lvl3Active = false;
        this.trigger('lvl3StateChanged', { active: false });
        console.log("Framework: Reset Lvl3 state to inactive due to fetch error or data issue.");
        if (this.panelManager) {
            this.panelManager.setLvl3State(false);
        }
    }

    // Reset Voice Addon if it was active
    if (this.state.voiceAddonActive) {
        this.state.voiceAddonActive = false;
        if (VoiceUtilities?.initialized) {
            VoiceUtilities.updateVoiceAddonState(false);
        }
        this.trigger('voiceAddonStateChanged', { active: false });
        console.log("Framework: Reset Voice Addon state to inactive due to fetch error or data issue.");
    }

    // Reset Controls Addon if it was active
    if (this.state.controlsAddonActive) {
        this.state.controlsAddonActive = false;
        this.trigger('controlsAddonStateChanged', { active: false });
        console.log("Framework: Reset Controls Addon state to inactive due to fetch error or data issue.");
    }

    // Reset Back Action if it was active
    if (this.state.backActionActive) {
        this.state.backActionActive = false;
        this.updateBackButtonState(); // Update UI
        this.trigger('backActionStateChanged', { active: false });
        console.log("Framework: Reset Back Action state to inactive due to fetch error or data issue.");
    }
};

//  ===================
// CHAT MESSAGE RENDERING
//  ===================

Framework.arraysEqual = function(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        // Basic check; for objects, a deep comparison or stringification might be needed.
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
};

Framework.processSoundUrlsForDisplay = function(text) {
    // Regex to find sound commands like soundstart:url, soundvolume:level, soundstop
    const soundRegex = /sound(start|volume|stop):?([^\s\n\`\'\"]*)/gi;

    return text.replace(soundRegex, (match, type, value) => {
        // Only format 'soundstart' with a URL value for display
        if (type.toLowerCase() === 'start' && value) {
            return this.formatSoundUrl(match, type, value); // Pass original match for context if needed
        }
        // For soundvolume and soundstop, or soundstart without a value, return the match as is or a simplified version.
        // Or, if you want to hide them entirely from display:
        // return ''; // This would remove them from the displayed text
        return match; // For now, keep them visible, but only format soundstart:url
    });
};

Framework.formatSoundUrl = function(match, type, value) {
    try {
        const cleanUrl = value.replace(/[\`\'\"]+$/, ''); // Remove trailing quotes
        let domain = 'sound'; // Default if parsing fails

        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            const url = new URL(cleanUrl);
            domain = url.origin + '/...'; // Show scheme and host
        } else if (cleanUrl.startsWith('//')) { // Protocol-relative URL
            const url = new URL('https:' + cleanUrl); // Assume https for parsing
            domain = '//' + url.hostname + '/...';
        } else if (cleanUrl.startsWith('/')) { // Absolute path
            domain = '/... (local path)';
        } else { // Relative path or just filename
            const firstSlash = cleanUrl.indexOf('/');
            domain = firstSlash > 0 ? cleanUrl.substring(0, firstSlash) + '/...' : cleanUrl.substring(0, 20) + (cleanUrl.length > 20 ? '...' : '');
        }
        return `sound${type}:${domain}`;
    } catch (e) {
        // Fallback for invalid URLs or parsing errors
        console.warn("formatSoundUrl: Could not parse URL, displaying truncated value:", value, e);
        const domainMatch = value.match(/^([^\/]+\/\/[^\/]+)\//); // Try to get domain from malformed http(s) like string
        if (domainMatch) {
            return `sound${type}:${domainMatch[1]}/...`;
        }
        return `sound${type}:${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`;
    }
};

Framework.scrollChatToBottom = function(force = false) { // force param can be used for explicit scroll requests
    if (!this.dom.chatMessages) return;

    // Just scroll to bottom. The browser handles this efficiently.
    // scrollTop equals scrollHeight effectively means scroll to bottom.
    this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
    this.state.isScrolledToBottom = true; // Update state after scrolling
};

Framework.updateChatMessages = function(logs) {
    if (!this.dom.chatMessages) {
        console.error("updateChatMessages: chatMessages DOM element not found.");
        return;
    }

    // console.log(`updateChatMessages: Processing ${logs.length} log entries.`); // Verbose

    // CRITICAL: Calculate scroll position BEFORE any DOM changes
    const scrollEl = this.dom.chatMessages;
    const oldScrollHeight = scrollEl.scrollHeight;
    const oldScrollTop = scrollEl.scrollTop;
    const oldClientHeight = scrollEl.clientHeight; // Usually constant unless window resizes
    // Distance from the very bottom of the scrollable content
    const distanceFromBottom = oldScrollHeight - oldScrollTop - oldClientHeight;
    // User is considered "at the bottom" if they are within a small threshold
    // This allows for slight variations and ensures new messages pull them down.
    const wasEffectivelyAtBottom = distanceFromBottom < 50;

    // STEP 1: Preserve any AI-injected elements
    // These are elements added by client-side AI commands (e.g., execute_js creating UI)
    // that are not part of the server log data. They need to be preserved across re-renders.
    const aiElementsToPreserve = [];
    scrollEl.querySelectorAll('[data-ai-injected], .ai-injected, [data-ai-source]').forEach(el => {
        aiElementsToPreserve.push(el.cloneNode(true)); // Deep clone to preserve all children and attributes
    });

    // STEP 2: Clear and rebuild all messages from the log data
    // This is simpler and often more reliable than complex diffing for incremental updates.
    scrollEl.innerHTML = ''; // Clear existing messages

    // STEP 3: Create and append message elements from logs
    let currentIndex = 0;
    while (currentIndex < logs.length) {
        // `createMessageElement` determines the type of message and might consume multiple log entries.
        // It returns the DOM element and `skipToIndex` indicating how many entries were processed.
        const messageElement = this.createMessageElement(logs, currentIndex);
        if (messageElement) {
            scrollEl.appendChild(messageElement);
            // Advance index based on how many log entries this single message element consumed
            currentIndex = messageElement.skipToIndex !== undefined ? messageElement.skipToIndex + 1 : currentIndex + 1;
        } else {
            // Should not happen if createMessageElement always returns something or an error handler element.
            // Safety increment.
            console.warn(`updateChatMessages: createMessageElement returned null for log at index ${currentIndex}.`);
            currentIndex++;
        }
    }

    // STEP 4: Restore AI-injected elements at the end of the chat
    // This ensures they are visually distinct and don't interfere with standard message flow.
    aiElementsToPreserve.forEach(el => {
        scrollEl.appendChild(el);
    });

    // STEP 5: Apply any persisted AI modifications (e.g., custom styles, JS manipulations)
    // This is crucial for maintaining AI-driven visual changes across chat updates.
    this.applyPersistedAIModifications();

    // STEP 6: Update accessibility attributes on the chat container
    this.updateChatAriaAttributes();

    // STEP 7: Handle scrolling AFTER the DOM has been fully updated
    // `requestAnimationFrame` ensures this runs after the browser has painted the changes,
    // giving accurate scrollHeight values.
    requestAnimationFrame(() => {
        const newScrollHeight = scrollEl.scrollHeight;
        if (wasEffectivelyAtBottom || this.state.expectingAIResponse) {
            // If user was at the bottom, or if we are expecting an AI response (implying user just sent something),
            // scroll them to the absolute bottom of the new content.
            scrollEl.scrollTop = newScrollHeight;
            this.state.isScrolledToBottom = true;
             if (this.state.expectingAIResponse) this.state.expectingAIResponse = false; // Reset flag after scrolling
        } else {
            // User was reading historical messages further up. Restore their scroll position relative
            // to the bottom, so their viewport doesn't jump.
            // This maintains their `distanceFromBottom`.
            scrollEl.scrollTop = newScrollHeight - oldClientHeight - distanceFromBottom;
            this.state.isScrolledToBottom = false;
        }
    });

    // Trigger events for other components that might need to react to chat updates.
    const newLogCountInDOM = scrollEl.children.length; // Count actual DOM elements
    if (newLogCountInDOM !== this.state.lastLogCount) { // Compare with previous DOM count
        // console.log(`updateChatMessages: Chat content changed. Triggering chatUpdated.`); // Verbose
        this.trigger('chatUpdated', { messages: logs }); // Pass the raw logs that were processed
    }
    this.state.lastLogCount = newLogCountInDOM; // Update last known count of elements in chat
};

Framework.generateMessageHash = function(element) {
    const classes = element.className || '';
    const textContent = element.textContent || '';
    // Use a limited portion of text for hash to avoid issues with very long messages,
    // but enough to distinguish most common messages.
    const truncatedText = textContent.substring(0, 100);

    // Simple string concatenation for hash basis
    const baseString = `${classes}|${truncatedText}`;

    // Basic hash function (djb2 variation)
    let hash = 5381;
    for (let i = 0; i < baseString.length; i++) {
        const char = baseString.charCodeAt(i);
        hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
        hash = hash & hash; // Convert to 32bit integer
    }

    // Append length of full text content to further differentiate, especially if truncatedText is same
    return `${hash}-${textContent.length}`;
};

Framework.updateChatAriaAttributes = function() {
    if (!this.dom.chatMessages) return;
    Object.assign(this.dom.chatMessages, {
        role: 'log',                // Informs assistive tech this is a log/live region
        'aria-live': 'polite',      // Announce changes politely (assertive can be too disruptive)
        'aria-relevant': 'additions text', // Announce additions and text changes
        'aria-label': 'Chat messages area' // Descriptive label for the region
    });
};

// ==============================================================================
// NEW MESSAGE PARSING FUNCTIONS (Added for robust unhandled log handling - v3.7.7)
// These functions help identify, group, and display log entries that don't
// match predefined message types (User, AI, System, etc.).
// ==============================================================================

Framework.escapeHtml = function(text) {
    if (typeof text !== 'string') text = String(text); // Ensure input is a string
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;' // or &apos; but &#039; is more widely supported
    };
    return text.replace(/[&<>"']/g, m => map[m]);
};

Framework.isRecognizedPattern = function(logText) {
    if (typeof logText !== 'string') return false; // Only strings can match patterns

    // This check is now robust and catches all valid message types we want to handle individually.
    return logText.includes('[SYSTEM: Using INPUT as User Input:]') ||
           logText.includes('[NOTIFICATION]: AI:') ||
           /\[[A-Z\s]+ CONSULT \((addon_ai\d?)\)\]:/.test(logText) || // Generic check for any consultant
           logText.startsWith('You:') ||
           logText.includes('[SYSTEM: End INPUT]') ||
           this.isSystemLog(logText);
};

Framework.looksLikeNewUnhandledSource = function(firstLog, nextLog) {
    if (typeof firstLog !== 'string' || typeof nextLog !== 'string') return true; // Treat non-strings as new sources

    // Common addon/source prefix patterns. If prefixes exist and differ, it's likely a new source.
    const patterns = [
        /^\[([A-Z_]+(?:\s-\s)?[\w.-]*)\]/i,   // Matches [ADDON_NAME], [ADDON-ID], [ADDON_FILE.py]
        /^([A-Za-z0-9_.-]+):/,               // Matches addon_name:, module.file:
        /^<([^>]+)>/,                       // Matches <source_tag>
        /^([A-Z][A-Za-z0-9_]*\s*-\s*)/,      // Matches AddonName -
    ];

    for (const pattern of patterns) {
        const firstMatch = firstLog.match(pattern);
        const nextMatch = nextLog.match(pattern);

        // If both lines match the same pattern type (e.g., both start with "[XXX]")
        if (firstMatch && nextMatch) {
            // And the captured prefix part (e.g., "XXX") is different
            if (firstMatch[1].trim().toLowerCase() !== nextMatch[1].trim().toLowerCase()) {
                return true; // Then it's a new source.
            }
        }
        // If one matches and the other doesn't, it might also indicate a context switch.
        // This is a bit more aggressive and could be tuned. For now, rely on consistent prefixing.
        // else if ( (firstMatch && !nextMatch) || (!firstMatch && nextMatch) ) {
        //     return true;
        // }
    }

    // Check for significant structural differences:
    // Does one start with a common log prefix char ([ < {) and the other doesn't?
    const firstHasStructuralPrefix = /^\s*[\[\<\{]/.test(firstLog);
    const nextHasStructuralPrefix = /^\s*[\[\<\{]/.test(nextLog);
    if (firstHasStructuralPrefix !== nextHasStructuralPrefix) {
        return true; // Likely a change in log format.
    }

    // If both start with simple text but one is clearly an error/debug and the other is not.
    const firstIsErrorDebug = /\b(ERROR|WARN|DEBUG|FATAL|CRITICAL)\b/i.test(firstLog);
    const nextIsErrorDebug = /\b(ERROR|WARN|DEBUG|FATAL|CRITICAL)\b/i.test(nextLog);
    if (firstIsErrorDebug !== nextIsErrorDebug) {
        return true;
    }

    return false; // Otherwise, assume they might be related or continuous.
};

Framework.detectSourceInfo = function(firstLine) {
    if (typeof firstLine !== 'string') firstLine = '';
    const info = {
        type: 'Message',    // Default type
        source: 'Unknown', // Default source
        hints: []           // Developer hints
    };

    // More specific patterns for source detection
    let match;
    if ((match = firstLine.match(/^\[([A-Z_][A-Z0-9_]*(?:\s-\s)?[\w.-]*)\]/i))) { // [ADDON_NAME] or [ADDON - ID] or [file.py]
        info.source = match[1].trim();
        info.type = 'Addon Log';
        info.hints.push(`Starts with <code>[${this.escapeHtml(match[1].trim())}]</code> - common addon identifier.`);
    } else if ((match = firstLine.match(/^([A-Za-z0-9_.-]+):/))) { // addon_name: or module.file:
        info.source = match[1];
        info.type = 'Module Log';
        info.hints.push(`Starts with <code>${this.escapeHtml(match[1])}:</code> - typical for module/logger name.`);
    } else if ((match = firstLine.match(/^<([^>]+)>/))) { // <source_tag>
        info.source = match[1];
        info.type = 'Tagged Message';
        info.hints.push(`Uses <code>&lt;${this.escapeHtml(match[1])}&gt;</code> tags.`);
    } else if ((match = firstLine.match(/^([A-Z][A-Za-z0-9_]*\s*-\s*)/))) { // AddonName -
        info.source = match[1].replace(/\s*-\s*$/, '').trim(); // Remove trailing ' - '
        info.type = 'Component Log';
        info.hints.push(`Starts with "<code>${this.escapeHtml(info.source)} - </code>" pattern.`);
    }

    // General keyword-based type detection (if not already typed by structure)
    if (info.type === 'Message') { // Only if a structural type wasn't found
        if (/\b(ERROR|FATAL|CRITICAL)\b/i.test(firstLine)) {
            info.type = 'Error';
            if(info.source === 'Unknown') info.source = 'Error Output';
            info.hints.push('Contains error-level keywords.');
        } else if (/\b(WARNING|WARN)\b/i.test(firstLine)) {
            info.type = 'Warning';
            if(info.source === 'Unknown') info.source = 'Warning Output';
            info.hints.push('Contains warning-level keywords.');
        } else if (/\b(DEBUG)\b/i.test(firstLine)) {
            info.type = 'Debug';
            if(info.source === 'Unknown') info.source = 'Debug Output';
            info.hints.push('Contains debug-level keywords.');
        } else if (/\b(INFO)\b/i.test(firstLine)) {
            info.type = 'Info';
             if(info.source === 'Unknown') info.source = 'Informational Log';
            info.hints.push('Contains info-level keywords.');
        }
    }

    // Add general pattern suggestions
    if (info.source !== 'Unknown') {
        info.hints.push(`To handle this source specifically, consider a check like: <code>if (logText.includes('${this.escapeHtml(info.source)}')) { ... }</code> or a more precise regex.`);
    } else {
        info.hints.push('The source of this message could not be reliably determined from the first line.');
    }
    info.hints.push(`Examine the full content to identify a consistent pattern for this message type.`);

    return info;
};

Framework.createDeveloperMessage = function(contentLines, startIndex, endIndex) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'developer-message', 'unhandled-message');

    // Create header part
    const headerElement = document.createElement('div');
    headerElement.className = 'developer-message-header';

    const sourceInfo = this.detectSourceInfo(contentLines[0]); // Analyze the first line for source clues

    headerElement.innerHTML = `
        <span class="dev-icon" title="Unhandled Message Block">🔧</span>
        <span class="dev-label" title="Detected Message Type">${this.escapeHtml(sourceInfo.type)}</span>
        <span class="dev-source" title="Guessed Source/Addon">Source: ${this.escapeHtml(sourceInfo.source)}</span>
        <span class="dev-lines" title="Number of lines in this block">${contentLines.length} line${contentLines.length > 1 ? 's' : ''}</span>
    `;

    // Create content container with raw, escaped log lines
    const contentElement = document.createElement('div');
    contentElement.className = 'developer-message-content';
    // Join lines with newline, escape each line, and wrap in <pre> for preserved formatting
    const escapedContent = contentLines.map(line => this.escapeHtml(line)).join('\n');
    contentElement.innerHTML = `<pre>${escapedContent}</pre>`;

    // Create collapsible info section for developers
    const infoElement = document.createElement('div');
    infoElement.className = 'developer-message-info';
    infoElement.innerHTML = `
        <details>
            <summary>Developer Info & Fix Hints</summary>
            <div class="dev-details">
                <p><strong>What is this?</strong> This block of ${contentLines.length} log line(s) doesn't match any recognized message patterns in <code>Framework.createMessageElement()</code> and has been grouped together.</p>
                <p><strong>Original Log Indices:</strong> ${startIndex} - ${endIndex}</p>
                <p><strong>To properly display these messages:</strong></p>
                <ol>
                    <li>Identify a unique, consistent pattern in these lines (e.g., a prefix like <code>[MyAddonName]</code>, a specific keyword, or structure).</li>
                    <li>Add a new <code>else if</code> condition to <code>Framework.createMessageElement()</code> to detect this pattern.</li>
                    <li>Inside that condition, call a new or existing function (e.g., <code>this.createMyAddonMessageElement(logs, index)</code>) that correctly parses and formats these lines, similar to how <code>createUserMessageElement</code> or <code>createAIMessageElement</code> work. Ensure it handles multi-line content if applicable and sets <code>element.skipToIndex</code> correctly.</li>
                </ol>
                <p><strong>Hints based on the first line:</strong></p>
                <ul>
                    ${sourceInfo.hints.map(hint => `<li>${hint}</li>`).join('')}
                </ul>
                <p>This "Unhandled Message" display is a fallback to prevent chat clutter and help developers integrate new log types.</p>
            </div>
        </details>
    `;

    messageElement.appendChild(headerElement);
    messageElement.appendChild(contentElement);
    messageElement.appendChild(infoElement);

    // Store the skip index: this message element represents logs from startIndex to endIndex.
    // The main loop in updateChatMessages will use this to advance past processed lines.
    messageElement.skipToIndex = endIndex;

    return messageElement;
};

Framework.createUnhandledMessageElement = function(logs, startIndex) {
    const firstLogText = this.getLogText(logs[startIndex]); // Get text of the first unhandled line
    let groupedContent = [firstLogText]; // Start with the first line
    let endIndex = startIndex; // This will be the last index included in this unhandled block

    // Look ahead from `startIndex + 1` to group subsequent related unhandled messages
    for (let i = startIndex + 1; i < logs.length; i++) {
        const nextLogText = this.getLogText(logs[i]);

        // Stop grouping if we hit a log line that matches a *recognized* pattern.
        // That recognized line will be handled by the next iteration of the main loop in createMessageElement.
        if (this.isRecognizedPattern(nextLogText)) {
            break; // End grouping for this unhandled block.
        }

        // Stop grouping if the `nextLogText` appears to be from a completely different unhandled source
        // or a clear break in context from `firstLogText`.
        if (this.looksLikeNewUnhandledSource(firstLogText, nextLogText)) {
            break; // Start a new unhandled block for `nextLogText` later.
        }

        // If it's not recognized and doesn't look like a new source, add it to the current group.
        groupedContent.push(nextLogText);
        endIndex = i; // Update the end index of this group.
    }

    // Now, create the "developer message" display for all the `groupedContent`.
    return this.createDeveloperMessage(groupedContent, startIndex, endIndex);
};


//  ===================================================================
// MODIFIED/EXISTING MESSAGE PARSING FUNCTIONS
//  ===================================================================

Framework.createMessageElement = function(logs, index) {
    const logEntry = logs[index];
    const logText = this.getLogText(logEntry);

    // This is the new, single rule to find all consultant messages.
    // It looks for "[PROVIDER_NAME CONSULT (addon_id)]:"
    const consultantMatch = logText.match(/^(\[[A-Z\s]+ CONSULT \((addon_ai\d?)\)\]:)/i);

    try {
        if (logText.includes('[SYSTEM: Using INPUT as User Input:]')) {
            return this.createUserMessageElement(logs, index);
        } else if (logText.includes('[NOTIFICATION]: AI:')) {
            return this.createAIMessageElement(logs, index);
        } else if (consultantMatch) {
            // If we find ANY consultant, we use this single rule.
            const tag = consultantMatch[0]; // The full matched tag, e.g., "[ANTHROPIC CONSULT (addon_ai3)]:"
            return this.createCustomTaggedAIMessageElement(logs, index, tag);
        } else if (logText.startsWith('You:')) {
            return this.createDirectUserMessageElement(logText);
        } else if (this.isSystemLog(logText)) {
            return this.createLogMessageElement(logText);
        } else {
            // If no rules match, it's an unhandled message.
            return this.createUnhandledMessageElement(logs, index);
        }
    } catch (parseError) {
        console.error(`createMessageElement: Error parsing log entry at index ${index}:`, logText, parseError);
        return this.createErrorMessageElement(logText, index, parseError);
    }
};

Framework.getLogText = function(logEntry) {
    // Robustly convert logEntry to string, handling null, objects, etc.
    if (typeof logEntry === 'string') return logEntry;
    if (logEntry === null || logEntry === undefined) return ''; // Represent null/undefined as empty string
    if (typeof logEntry === 'object') {
        try {
            return JSON.stringify(logEntry); // Try to stringify objects
        } catch (e) {
            return '[Unstringifiable Object]'; // Fallback for circular or problematic objects
        }
    }
    return String(logEntry); // Catch-all for other types (numbers, booleans)
};

Framework.createErrorMessageElement = function(logText, index = 'N/A', error = null) {
    const element = document.createElement('div');
    element.classList.add('log-message', 'error-message', 'framework-error-display'); // Specific class for styling
    let errorMessageContent = `[Error processing log (index: ${index}) - See console for details]`;
    if (logText) {
        errorMessageContent += `<br>Original content (truncated): ${this.escapeHtml(String(logText).substring(0,150))}...`;
    }
    if (error && error.message) {
        errorMessageContent += `<br>Error: ${this.escapeHtml(error.message)}`;
    }
    element.innerHTML = errorMessageContent;
    console.error("Framework.createErrorMessageElement:", {logText, index, error}); // Log details to console
    // This element represents only one log entry (the problematic one).
    // So, skipToIndex should behave as if it's a single line simple log message.
    // If createMessageElement passes an index for 'skipToIndex' on error, it could be used.
    // For now, let the main loop increment by 1.
    // element.skipToIndex = index; (if we want this to represent just 'index')
    return element;
};

Framework.createUserMessageElement = function(logs, startIndex) {
    let extractedText = '';
    let endIndex = -1; // Index of the '[SYSTEM: End INPUT]' marker
    let firstLine = true;
    // const startLogText = this.getLogText(logs[startIndex]); // For context if needed

    // Iterate from the line *after* '[SYSTEM: Using INPUT as User Input:]'
    for (let j = startIndex + 1; j < logs.length; j++) {
        const innerLogText = this.getLogText(logs[j]);

        if (innerLogText.includes('[SYSTEM: End INPUT]')) {
            endIndex = j; // Found the end marker
            break;
        }

        // Only include lines that are not system logs themselves (unless they are part of user's multi-line input)
        // This heuristic assumes user input lines don't typically look like system log markers.
        // It could be refined if users often paste system-log-like text.
        if (!this.isSystemLog(innerLogText) || innerLogText.includes('[USER PASTE') ) { // Example: allow lines marked as user paste
            extractedText += (firstLine ? '' : '\n') + innerLogText; // No .trim() here to preserve user's formatting
            firstLine = false;
        }
        // If an inner log IS a system log and NOT part of pasted content, it might imply the end of user input prematurely.
        // Current logic continues, which is generally fine.
    }

    if (endIndex !== -1) {
        // We found the end marker, create a user message with the extracted text.
        // skipToIndex will be `endIndex`.
        return this.createUserMessage(extractedText.trim(), endIndex); // Trim final result before display
    }

    // End marker was not found. This is unusual. Treat the original starting line as a simple log.
    // This ensures *something* is displayed rather than an error or skipping content.
    console.warn(`createUserMessageElement: End marker '[SYSTEM: End INPUT]' not found after index ${startIndex}. Treating starting line as a generic log.`);
    const fallbackElement = this.createLogMessageElement(this.getLogText(logs[startIndex]));
    fallbackElement.skipToIndex = startIndex; // Indicates only this line was processed.
    return fallbackElement;
};

Framework.createUserMessage = function(text, skipToIndex) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'user-message');

    // Display placeholder if text is empty after trimming
    const displayText = text.trim().length > 0 ?
        this.processSoundUrlsForDisplay(text) : // Process for sound URLs before display
        '[Empty User Input Block]';

    const textSpan = this.createElement('span', {
        className: 'message-text',
        // Use innerHTML carefully, or ensure text is pre-escaped if it can contain HTML.
        // For user messages, textContent is safer unless HTML formatting from user is desired and sanitized.
        textContent: displayText // Assuming plain text for user messages for safety.
                                  // If pre tags or markdown are supported, this would need to change.
    });

    const iconSpan = this.createElement('span', {
        className: 'message-icon', // User icon
        // textContent: '👤' // Or use CSS background for icon
    });

    messageElement.appendChild(textSpan); // Text first for LTR languages
    messageElement.appendChild(iconSpan); // Then icon
    messageElement.skipToIndex = skipToIndex; // Crucial for multi-line processing

    return messageElement;
};

Framework.createAIMessageElement = function(logs, startIndex) {
    const startLogText = this.getLogText(logs[startIndex]);
    const aiMarker = '[NOTIFICATION]: AI:';
    const markerIndex = startLogText.indexOf(aiMarker);

    if (markerIndex === -1) {
        // This shouldn't happen if called correctly, but handle defensively.
        console.warn(`createAIMessageElement: Marker '${aiMarker}' not found in log at index ${startIndex}. Log: "${startLogText}"`);
        const fallbackElement = this.createLogMessageElement(startLogText);
        fallbackElement.skipToIndex = startIndex;
        return fallbackElement;
    }

    // Extract text after the marker from the first line.
    let fullAIMessageText = startLogText.substring(markerIndex + aiMarker.length).trimStart(); // Trim leading space only
    let bufferEndIndex = startIndex; // Last index consumed by this AI message block.

    // Aggregate subsequent lines that are part of this AI message.
    for (let i = startIndex + 1; i < logs.length; i++) {
        const nextLogText = this.getLogText(logs[i]);

        // If the next line indicates a break (new system message, user input, new AI message), stop aggregating.
        if (this.isBreakCondition(nextLogText)) {
            break;
        }

        // Add the next line to the AI message. Preserve leading/trailing spaces from `nextLogText`
        // as they might be part of intended formatting (e.g., in code blocks).
        // Only add newline if there's previous text and new text.
        fullAIMessageText += (fullAIMessageText.length > 0 || nextLogText.length > 0 ? '\n' : '') + nextLogText;
        bufferEndIndex = i; // Update the last consumed index.
    }

    return this.createAIMessage(fullAIMessageText.trimEnd(), bufferEndIndex); // Trim trailing space from the whole message
};

Framework.createCustomTaggedAIMessageElement = function(logs, startIndex, matchedTag) {
    const startLogText = this.getLogText(logs[startIndex]);
    
    // The content is everything AFTER the matched tag.
    let fullAIMessageText = startLogText.substring(matchedTag.length).trimStart();
    let bufferEndIndex = startIndex;

    // Aggregate subsequent lines that are part of this message.
    for (let i = startIndex + 1; i < logs.length; i++) {
        const nextLogText = this.getLogText(logs[i]);
        if (this.isBreakCondition(nextLogText)) {
            break;
        }
        fullAIMessageText += '\n' + nextLogText;
        bufferEndIndex = i;
    }

    // This logic creates the "Anthropic Consultant:" or "Perplexity Consultant:" name.
    let AINamePrefix = "Consultant"; // A sensible default.
    const providerMatch = matchedTag.match(/^\[([A-Z\s]+) CONSULT/i);
    if (providerMatch && providerMatch[1]) {
        const providerName = providerMatch[1].trim();
        // Capitalize the first letter, lowercase the rest for a nice name.
        const capitalizedProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1).toLowerCase();
        AINamePrefix = `${capitalizedProvider} Consultant`;
    }

    return this.createAIMessage(AINamePrefix + ": " + fullAIMessageText.trimEnd(), bufferEndIndex);
};


Framework.createAIMessage = function(text, skipToIndex) {
    // Process text for display (e.g., convert 'soundstart:url' to a friendlier format)
    const displayText = this.processSoundUrlsForDisplay(text.trim()); // Trim overall message first

    const messageElement = document.createElement('div');
    // Add 'ai-message' for observer and general AI styling, 'system-message' for existing styles.
    messageElement.classList.add('message', 'system-message', 'ai-message');

    const iconSpan = this.createElement('span', {
        className: 'message-icon', // AI icon
        // textContent: '🤖' // Or use CSS background for icon
    });

    const textSpan = this.createElement('span', {
        className: 'message-text',
        // AI messages might contain markdown or simple HTML.
        // For security, if HTML is allowed, it MUST be sanitized server-side or client-side.
        // Using textContent is safest if no formatting is expected or handled.
        // If markdown-to-HTML is used here, ensure a safe library.
        textContent: displayText || '[Empty AI Response]' // Fallback for empty responses
    });

    messageElement.appendChild(iconSpan); // Icon first for AI messages often
    messageElement.appendChild(textSpan);
    messageElement.skipToIndex = skipToIndex; // Crucial for multi-line processing

    return messageElement;
};

Framework.createDirectUserMessageElement = function(logText) {
    // Assumes format "You: Actual message content"
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'user-message');

    // Extract text after "You:"
    const rawText = logText.substring(logText.indexOf(':') + 1).trim();
    const displayText = this.processSoundUrlsForDisplay(rawText); // Process for sound URLs

    const textSpan = this.createElement('span', {
        className: 'message-text',
        textContent: displayText
    });

    const iconSpan = this.createElement('span', {
        className: 'message-icon', // User icon
        // textContent: '👤'
    });

    messageElement.appendChild(textSpan);
    messageElement.appendChild(iconSpan);

    // This type of message always consumes one log line.
    // skipToIndex is not strictly needed here if the main loop increments by 1 by default for single-line elements,
    // but explicit definition is safer if default behavior changes.
    // The main loop in updateChatMessages handles incrementing index if skipToIndex is undefined.

    return messageElement;
};

Framework.createLogMessageElement = function(logText) {
    const messageElement = document.createElement('div');
    // Ensure logText is a string and process for any special display like sound URLs.
    const processedText = this.processSoundUrlsForDisplay(
        typeof logText === 'string' ? logText : JSON.stringify(logText) // Stringify if not already string
    );
    messageElement.textContent = processedText;
    messageElement.classList.add('log-message'); // Base class for generic log lines

    // Apply specific styling classes based on log content (e.g., debug, event)
    const logClass = this.getLogMessageClass(logText); // Use original logText for class detection
    if (logClass) {
        messageElement.classList.add(logClass);
    }
    // Also, mark as `skipToIndex` for consistency, even if it's just the current index.
    // Assuming this function is called with current `index`, it consumes only that one line.
    // Framework.updateChatMessages caller handles increment if `skipToIndex` is undefined.

    return messageElement;
};

Framework.isSystemLog = function(logText) {
    const text = typeof logText === 'string' ? logText : ''; // Ensure text is a string
    return text.startsWith('[SYSTEM:') ||
           text.startsWith('[LOG EVENT:') ||
           text.startsWith('[NOTIFICATION]:'); // Note: '[NOTIFICATION]: AI:' is more specific and handled earlier
};

Framework.isBreakCondition = function(logText) {
    // A "break condition" is a log line that should NOT be aggregated into the current multi-line message block
    // (e.g., user input, AI response, or some other system log).
    
    // If it's a known, individually handled message type, it's a break.
    return this.isSystemLog(logText) || 
           (typeof logText === 'string' && 
               (logText.startsWith('You:') || 
                /\[[A-Z\s]+ CONSULT \((addon_ai\d?)\)\]:/.test(logText) ||
                logText.includes('[SYSTEM: Using INPUT as User Input:]'))
           );
};

Framework.getLogMessageClass = function(logText) {
    // Returns a CSS class name based on keywords in the log text for styling.
    const text = typeof logText === 'string' ? logText : ''; // Ensure text is a string for .includes() and .test()

    // Specific system message types
    if (text.includes('[SYSTEM DEBUG')) return 'debug-message';
    if (text.includes('[LOG EVENT:')) return 'event-message';
    // [SYSTEM:] and [NOTIFICATION]: (non-AI ones) might fall under a general system info style
    if (text.startsWith('[SYSTEM:') || (text.startsWith('[NOTIFICATION]:') && !text.includes('[NOTIFICATION]: AI:'))) {
        return 'system-info-message';
    }

    // Patterns for AGS / Matrix related logs, to be styled as 'event-message'
    const agsTextPatterns = [
        '[AGS-MM LOG', '[me.matrix AGS', '[MATRIX_AGS_DIRECTIVE:',
        '[looper.py - AGS Interaction Loop Starting... (Console Styling Fix)]',
        '[AGS ADVISORY PREPENDED]:', 'ADVISORY_END]'
    ];

    // Regex patterns for more complex AGS/Matrix log matching
    const agsRegexPatterns = [
        /^\d+\.\s*(PAYLOAD SIZE|COMMAND SEPARATION|CSS\/JS ROLES|ERROR RESILIENCE|ASSET HANDLING|SELECTOR PRECISION|DECISIVENESS):/i,
        /^(UI_STRATEGY_ADHERENCE_REMINDER|UI_CONTROLS_FAILURE|UI_COMMAND_EXECUTE_IMMEDIATELY|CAT_MODE_CONTEXT|PROGENITOR_UI_PREFERENCE|MOBILE_UI_CONTEXT_DETECTED|DESKTOP_UI_CONTEXT_DETECTED)/i,
        /^(ACTION_|CRITICAL_|NOTE:|IMMEDIATE_ACTION_MANDATE|When ready to apply controls)/i,
        /^P\d{3}\s+\(.*?\)/ // Matches lines like "P001 (Some text)"
    ];

    if (agsTextPatterns.some(pattern => text.includes(pattern)) ||
        agsRegexPatterns.some(regex => regex.test(text))) {
        return 'event-message'; // Style these as event messages
    }

    return null; // No specific class for this log line
};

//  ===================
// AI MODIFICATIONS PERSISTENCE
//  ===================

Framework.registerAIModification = function(modFunction, description = '') {
    // CURRENT BEHAVIOR: New modification replaces all previous `messageMods`.
    // This line causes the "replace" behavior. Comment it out for "stacking" behavior.
    this.state.aiModifications.messageMods = [];

    const modification = {
        id: Date.now(), // Simple unique ID
        function: modFunction,
        description: description,
        timestamp: new Date()
    };

    this.state.aiModifications.messageMods.push(modification);
    this.state.aiModifications.hasActiveMods = true; // Flag that active mods exist

    console.log(`Framework: Registered AI modification (ID: ${modification.id}): ${description || 'Custom mod'}`);

    // Apply the new modification (and any others, if stacking was enabled) to existing messages immediately.
    this.applyPersistedAIModifications();

    return modification.id;
};

Framework.applyPersistedAIModifications = function() {
    if (!this.state.aiModifications.hasActiveMods || this.state.aiModifications.messageMods.length === 0) {
        return; // No active modifications to apply
    }

    // console.log("Framework: Applying persisted AI modifications..."); // Verbose log

    // Execute each registered modification function.
    // These functions are responsible for selecting their own target DOM elements (e.g., specific messages).
    this.state.aiModifications.messageMods.forEach(mod => {
        try {
            // console.log(`Framework: Executing AI mod: ${mod.description || mod.id}`); // Verbose
            mod.function(); // Call the stored function
        } catch (e) {
            console.error(`Framework: Error applying persistent AI modification (ID: ${mod.id}, Desc: "${mod.description}"):`, e);
        }
    });
};

Framework.clearAIModifications = function() {
    this.state.aiModifications.messageMods = []; // Clear modification functions
    this.state.aiModifications.cssRules = [];    // Clear any stored CSS rules (if this array is used elsewhere)
    this.state.aiModifications.hasActiveMods = false; // Reset flag

    // Attempt to remove any visual markers or attributes added by modifications if they are known.
    // This is a generic attempt; specific modifications might need their own cleanup.
    if (this.dom.chatMessages) {
        this.dom.chatMessages.querySelectorAll('[data-ai-mod]').forEach(el => {
            delete el.dataset.aiMod; // Example: remove a common data attribute
        });
    }
    // Any dynamically added style tags by AI should also be removed here if tracked.

    console.log('Framework: Cleared all AI modifications.');
    // May need to trigger a chat re-render or style update if modifications were purely visual and CSS-based.
    // this.updateChatMessages(this.state.messagesCache); // Potentially re-render to strip modifications. Use with caution.
};

//  ===================
// VOICE/MEDIA CACHE MANAGEMENT
//  ===================

// TTS Cache Management (delegated to VoiceUtilities)
let _cleanup_interval = 60; // seconds
let _last_cleanup_time = 0;   // seconds (epoch time)
// Sound System Cache (for `cleanuser` specific IDs, likely backend managed)
let _cleanuser_cleanup_interval = 60; // seconds
let _cleanuser_last_cleanup_time = 0;   // seconds (epoch time)

Framework.cleanup_spoken_ids = function() {
    // This function is for TTS cache cleanup (e.g., "spoken_text_ids.json")
    // The actual implementation is expected to be within VoiceUtilities.
    if (VoiceUtilities?.tts?.cleanupCache) {
        // console.log("[SYSTEM Clean TTS] Calling VoiceUtilities.tts.cleanupCache()");
        VoiceUtilities.tts.cleanupCache();
    } else {
        // console.log("[SYSTEM Clean TTS] VoiceUtilities.tts.cleanupCache not found.");
    }
};

Framework.check_and_run_cleanup = function() {
    // Periodically calls the TTS cache cleanup.
    const now_seconds = Date.now() / 1000;
    if (now_seconds - _last_cleanup_time > _cleanup_interval) {
        try {
            // console.log("[SYSTEM Clean TTS] Interval reached. Running cleanup_spoken_ids.");
            this.cleanup_spoken_ids();
        } catch (e) {
            console.error(`[SYSTEM Clean TTS] Error during scheduled cleanup: ${e}`);
        } finally {
            _last_cleanup_time = now_seconds; // Update last cleanup time regardless of success/failure
        }
    }
};

// Sound System Cache Management for `cleanuser_served_ids_cache.json`
// This is typically managed by the backend; front-end has minimal role.
Framework.cleanup_cleanuser_served_ids_cache = function() {
    // This cache is usually for tracking sound files served to prevent re-serving recent ones too quickly.
    // The backend generally handles its lifecycle. This frontend function is mostly a placeholder
    // or for triggering a backend cleanup if an API endpoint for that existed.
    // console.log("Sound System: `cleanuser_served_ids_cache` cleanup is typically managed by the backend.");
};

Framework.check_and_run_cleanuser_cache_cleanup = function() {
    // Periodically checks if it's time to "cleanup" (which might be a no-op if backend handles it).
    const now_seconds = Date.now() / 1000;
    if (now_seconds - _cleanuser_last_cleanup_time > _cleanuser_cleanup_interval) {
        // console.log("[SYSTEM CleanUser Cache] Interval reached for cleanuser cache check/cleanup.");
        // this.cleanup_cleanuser_served_ids_cache(); // Call the (likely placeholder) cleanup
        _cleanuser_last_cleanup_time = now_seconds; // Update time
    }
};

//  ===================
// UTILITY FUNCTIONS
//  ===================

Framework.debounce = function(func, wait, options = {}) {
    let timeoutId;
    let lastArgs;
    let lastThis;
    let lastCallTime;
    let trailTimeoutId;

    const invokeFunc = (time) => {
        const args = lastArgs;
        const thisArg = lastThis;

        lastArgs = lastThis = undefined; // Clear stored context
        lastCallTime = time;
        func.apply(thisArg, args);
    };

    const trailingEdge = () => {
        trailTimeoutId = undefined;
        if (options.trailing && lastArgs) { // Check if there was a call during the wait period
            invokeFunc(Date.now());
        }
        lastArgs = lastThis = undefined; // Ensure clear after trailing if no call made
    };
    
    const debounced = function(...args) {
        const time = Date.now();
        const isLeading = options.leading && !lastCallTime; // Is it the first call in a series?

        lastArgs = args; // Store the latest arguments
        lastThis = this; // Store the context

        clearTimeout(timeoutId); // Clear previous main timer
        if (trailTimeoutId) clearTimeout(trailTimeoutId); // Clear previous trailing timer

        if (isLeading) {
            lastCallTime = time; // Mark leading call time
            invokeFunc(time); // Invoke immediately for leading edge
             // For leading, setup timer to nullify lastCallTime to allow next leading call after wait
            timeoutId = setTimeout(() => { lastCallTime = undefined; }, wait);
        } else {
            // Not leading: Reset timer for the main debounce period
            timeoutId = setTimeout(() => {
                // If options.trailing is false, this invoke is it.
                // If options.trailing is true, this might be redundant if trailingEdge handles it,
                // but ensures at least one call if no trailing option is set.
                // However, with refined logic, the trailingEdge will handle it.
                // We mainly need timeoutId to clear for subsequent calls.
                lastCallTime = undefined; // Allow next leading if sequence stops.
                if (!options.trailing) invokeFunc(Date.now());
            }, wait);
        }

        // Setup trailing edge timer if option is set
        if (options.trailing) {
             trailTimeoutId = setTimeout(trailingEdge, wait);
        }

        return undefined; // Debounced functions usually don't return the func's result immediately
    };

    debounced.cancel = () => {
        clearTimeout(timeoutId);
        clearTimeout(trailTimeoutId);
        lastCallTime = 0;
        lastArgs = lastThis = trailTimeoutId = timeoutId = undefined;
    };

    return debounced;
};

Framework.throttle = function(func, limit, options = {}) {
    let timeoutId;
    let lastArgs;
    let lastThis;
    let lastCallTime = 0; // Initialize to 0 to allow immediate first call
    let trailingCall = false;

    const invokeFunc = (time) => {
        if (lastArgs) {
            func.apply(lastThis, lastArgs);
            lastCallTime = time; // Update last call time
            lastArgs = lastThis = undefined; // Clear stored context
            trailingCall = false; // Reset trailing call flag
        }
    };

    const throttled = function(...args) {
        const time = Date.now();
        if (!options.leading && !lastCallTime) { // For no-leading, set lastCallTime to prevent immediate invoke
            lastCallTime = time;
        }

        const remaining = limit - (time - lastCallTime);
        lastArgs = args;
        lastThis = this;

        if (remaining <= 0 || remaining > limit) { // Time past limit or timer reset (e.g. system clock change)
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
            lastCallTime = time;
            invokeFunc(time); // Invoke immediately
        } else if (!timeoutId && options.trailing) { // Setup trailing call if not already and option enabled
            trailingCall = true; // Mark that a trailing call is pending
            timeoutId = setTimeout(() => {
                lastCallTime = options.leading ? 0 : Date.now(); // Reset for leading, or set current for non-leading for next cycle
                timeoutId = undefined;
                if (trailingCall) invokeFunc(Date.now()); // Check trailingCall in case cancel was called
            }, remaining);
        }
    };
    
    throttled.cancel = () => {
        clearTimeout(timeoutId);
        lastCallTime = 0;
        trailingCall = false;
        lastArgs = lastThis = timeoutId = undefined;
    };

    return throttled;
};


Framework.showToast = function(message, duration = 3000) {
    let toastElement = document.getElementById('framework-toast');

    // Create toast element if it doesn't exist
    if (!toastElement) {
        toastElement = this.createElement('div', {
            id: 'framework-toast',
            role: 'alert', // Good for accessibility
            'aria-live': 'assertive' // Announce immediately
        });
        document.body.appendChild(toastElement);
        console.log("Framework: Created toast element dynamically.");
    }

    // Clear any existing timeout for this toast to handle rapid calls
    if (this._toastTimeout) {
        clearTimeout(this._toastTimeout);
    }
    // If there's an existing fadeout timeout, clear that too.
    if (this._toastFadeOutTimeout) {
        clearTimeout(this._toastFadeOutTimeout);
    }


    toastElement.textContent = message;
    // Make it visible and interactive immediately
    toastElement.style.opacity = '1';
    toastElement.style.visibility = 'visible'; // Ensure it's visible
    toastElement.style.pointerEvents = 'auto'; // Allow interaction (though toasts usually aren't)

    // Ensure duration is a valid positive number
    const validDuration = (typeof duration === 'number' && duration > 0) ? duration : 3000;

    // Set timeout to start fading out the toast
    this._toastTimeout = setTimeout(() => {
        toastElement.style.opacity = '0';
        // After fade out transition (e.g., 300ms), hide it fully and make non-interactive
        this._toastFadeOutTimeout = setTimeout(() => {
            if (toastElement) { // Check if element still exists
                toastElement.style.visibility = 'hidden';
                toastElement.style.pointerEvents = 'none';
            }
        }, 300); // This duration should match the CSS transition time for opacity
    }, validDuration);
};

Framework.registerComponent = function(id, componentInstance) {
    if (!id || typeof id !== 'string') {
        console.error("Framework: Component registration failed. Invalid or missing ID.");
        return;
    }

    if (!componentInstance || typeof componentInstance !== 'object') {
        console.error(`Framework: Component registration failed for "${id}". Invalid component instance (must be an object).`);
        return;
    }

    if (this.components[id]) {
        console.warn(`Framework: Component with ID "${id}" is being re-registered. Overwriting previous instance.`);
    }

    this.components[id] = componentInstance;
    console.log(`Framework: Component registered successfully: ${id}`);

    // If components are already initialized, and this component has an initialize method, call it.
    // Useful for components loaded dynamically after initial framework setup.
    if (this.componentsInitialized && typeof componentInstance.initialize === 'function') {
        console.log(`Framework: Dynamically initializing late-registered component: ${id}`);
        try {
            componentInstance.initialize();
        } catch (e) {
            console.error(`Framework: Error initializing late-registered component ${id}:`, e);
            // Optionally, show an error in the component's panel if applicable
            // this.showComponentError(id, 'Error during late initialization');
        }
    }
};

Framework.loadResource = async function(url, options = {}) {
    if (!url) {
        console.error("loadResource: URL parameter is missing.");
        throw new Error("URL is required to load resource.");
    }

    // Default fetch options, can be overridden by `options`
    const fetchOptions = {
        method: 'GET',         // Default to GET
        cache: 'no-store',     // Default to no-store to get fresh data
        headers: {
            'Accept': 'application/json, text/plain, */*', // Accept common types
            ...options.headers, // Merge custom headers
        },
        ...options // Spread other options like body, mode, credentials, etc.
    };

    try {
        // console.log(`loadResource: Fetching from ${url} with options:`, fetchOptions); // Verbose log
        const response = await fetch(url, fetchOptions);
        // console.log(`loadResource: Response Status for ${url}: ${response.status}`); // Verbose log

        if (!response.ok) {
            // If response is not OK (e.g., 404, 500), try to get error details and throw
            const errorText = await this.getResourceError(response, url); // Helper to format error
            const error = new Error(errorText);
            error.response = response; // Attach the full response to the error object
            throw error;
        }

        // If response is OK, parse it based on content type
        return await this.parseResourceResponse(response, url);

    } catch(error) { // Catches network errors or errors thrown from non-OK responses
        console.error(`loadResource: Error fetching or parsing resource ${url}:`, error.message);
        // Re-throw the error so the caller can handle it
        // The error object might already have `error.response` attached from above.
        throw error;
    }
};

Framework.getResourceError = async function(response, url) {
    // Helper to create a descriptive error message from a failed HTTP response.
    let errorText = `HTTP ${response.status} ${response.statusText || ''}`.trim(); // Start with status code and text
    let responseBody = '';
    try {
        responseBody = await response.text(); // Try to get the response body for more details
        if (responseBody) {
            // Limit body length in error message to avoid overly long console messages
            const truncatedBody = responseBody.substring(0, 200) + (responseBody.length > 200 ? '...' : '');
            errorText += ` - Body: ${truncatedBody}`;
        }
    } catch (readError) {
        // console.warn(`loadResource: Could not read error response body for ${url}:`, readError);
        // Silently ignore if body cannot be read, statusText is sufficient.
    }
    // console.error(`loadResource: Fetch failed for ${url}: ${errorText}`); // Already logged by caller potentially
    return errorText; // Return the composed error message string
};

Framework.parseResourceResponse = async function(response, url) {
    // Parses the response body based on its Content-Type header.
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
        try {
            const jsonData = await response.json();
            // console.log(`loadResource: Successfully parsed JSON from ${url}`); // Verbose
            return jsonData;
        } catch (jsonError) {
            console.error(`loadResource: Failed to parse JSON response from ${url} despite Content-Type. Error:`, jsonError);
            // Throw a new error indicating JSON parsing failure.
            throw new Error(`Invalid JSON response from ${url}. Parsing error: ${jsonError.message}`);
        }
    } else if (contentType?.includes('text/plain') || contentType?.includes('text/html') || contentType?.includes('application/xml')) { // Expand to common text types
        try {
            const textData = await response.text();
            // console.log(`loadResource: Successfully read Text-based content from ${url} (Type: ${contentType})`); // Verbose
            return textData;
        } catch (textError) {
            console.error(`loadResource: Failed to read Text response from ${url}:`, textError);
            throw new Error(`Failed to read Text response from ${url}. Error: ${textError.message}`);
        }
    } else {
        // Fallback for unknown or missing content types: try to read as text.
        // console.warn(`loadResource: Unknown or unspecified content type (${contentType || 'N/A'}) for ${url}. Attempting to return as raw text.`);
        try {
            return await response.text(); // Attempt to read as text by default
        } catch (fallbackError) {
            console.error(`loadResource: Failed to read response as fallback text from ${url}:`, fallbackError);
            // If even text reading fails, return the raw response object (or throw, depending on desired strictness)
            // throw new Error(`Failed to read response content from ${url}. Error: ${fallbackError.message}`);
            return response; // Or return raw response for manual handling by caller
        }
    }
};