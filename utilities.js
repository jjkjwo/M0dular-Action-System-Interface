/**
 * ==============================================================================================
 * Voice & Media Utilities Module
 * ==============================================================================================
 * Handles TTS, Sound System, Speech Recognition, and Hands-free Mode
 * Extracted from framework.js for better modularity
 * 
 * This module provides a clean interface for all voice and media functionality
 * while maintaining complete state synchronization with the main Framework.
 * 
 * @version 1.0.4 - Improved hands-free restart logic for invalid AI responses and stuck TTS flag.
 */

const VoiceUtilities = {
    // Module state
    initialized: false,
    callbacks: null,
    dom: null,
    config: null,
    
    // Centralized state (mirrors Framework's voice-related state)
    state: {
        // Shared
        voiceAddonActive: false,
        clientId: null,
        
        // TTS State
        tts: {
            enabled: false,
            isSpeaking: false,
            lastSpokenWebsiteOutput: "",
            lastTtsPlayTime: 0,
            expectingAIResponse: false,
            lastMessageTimestamp: null,
            lastMessageId: null
        },
        
        // Sound System State  
        sound: {
            enabled: false,
            userToggledEnabled: false,
            userInteracted: false,
            activeSounds: new Map(),
            processedContent: {
                userClean: '',
                websiteOutput: ''
            },
            lastCheckTimestamp: 0,
            currentVolume: 0.5,
            processedTriggers: new Set(),
            _lastCombinedHash: null
        },
        
        // Speech Recognition State
        speech: {
            enabled: false,
            isRecognizing: false,
            recognition: null,
            interruptionHandlersSet: false,
            isVoiceInput: false,
            recognitionResult: "",
            pendingSubmission: false
        },
        
        // Hands-free State
        handsFree: {
            enabled: false,
            autoRestartPending: false,
            waitingForResponse: false,
            pendingRecognitionRestart: null,
            delay: 1500
        }
    },
    
    // Active polling requests
    activeRequests: new Set(),
    
    /**
     * Initialize the Voice Utilities module
     */
    initialize: function(options) {
        if (this.initialized) {
            console.warn('VoiceUtilities: Already initialized');
            return;
        }
        
        console.log('VoiceUtilities: Initializing...');
        
        // Store references
        this.callbacks = options.callbacks;
        this.dom = options.dom;
        this.config = options.config;
        this.state.clientId = options.clientId;
        
        // Initialize subsystems
        this.tts.init();
        this.sound.init();
        this.speech.init();
        
        // Start polling
        this.startPolling();
        
        this.initialized = true;
        console.log('VoiceUtilities: Initialization complete');
    },
    
    /**
     * Start polling intervals for TTS and Sound System
     */
    startPolling: function() {
        const intervals = this.config.refreshIntervals || {};
        
        // TTS polling
        this.setupPolling(
            'TTS',
            this.config.api?.websiteOutput,
            intervals.ttsOutputCheck || 1500,
            () => this.tts.fetchAIResponse(),
            this.dom.ttsToggleButton
        );
        
        // Sound System polling
        this.setupPolling(
            'Sound System',
            true, // Always enabled for sound system
            intervals.soundCheck || 1000,
            () => this.sound.fetchTriggers(),
            this.dom.soundToggleButton
        );
    },
    
    setupPolling: function(name, enabled, interval, callback, button) {
        if (enabled && interval > 0) {
            setInterval(callback, interval);
            console.log(`VoiceUtilities: ${name} polling enabled every ${interval}ms`);
        } else {
            console.warn(`VoiceUtilities: ${name} polling disabled`);
            if (button) {
                button.classList.add('disabled');
                button.setAttribute('title', `${name} polling not configured`);
                button.setAttribute('aria-disabled', 'true');
            }
        }
    },
    
    /**
     * Update voice addon state and cascade to subsystems
     */
    updateVoiceAddonState: function(active) {
        const previousState = this.state.voiceAddonActive;
        this.state.voiceAddonActive = active;
        
        if (previousState !== active) {
            console.log(`VoiceUtilities: Voice Addon state changed to: ${active}`);
            
            // Update all subsystems
            this.tts.updateButtonState();
            this.speech.updateButtonState();
            this.sound.updateButtonState();
            
            // Handle state changes
            if (!active) {
                this.disableAllFeatures();
            } else {
                this.showAvailabilityToasts();
            }
        }
    },
    
    disableAllFeatures: function() {
        const features = [
            { state: this.state.tts, name: 'TTS', disable: () => {
                this.state.tts.enabled = false;
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    this.state.tts.isSpeaking = false;
                }
            }},
            { state: this.state.speech, name: 'Voice input', disable: () => {
                this.state.speech.enabled = false;
                this.state.handsFree.enabled = false;
                if (this.dom.handsFreeModeToggle) {
                    this.dom.handsFreeModeToggle.checked = false;
                }
                if (this.state.speech.isRecognizing) {
                    this.speech.stop();
                }
            }},
            { state: this.state.sound, name: 'Sound System', disable: () => {
                this.state.sound.enabled = false;
                this.state.sound.userToggledEnabled = false;
                this.sound.stopAll();
            }}
        ];
        
        features.forEach(feature => {
            if (feature.state.enabled) {
                console.log(`VoiceUtilities: Voice addon deactivated, force-disabling ${feature.name}`);
                feature.disable();
                this.callbacks.showToast(`${feature.name} disabled: Voice addon became inactive`);
            }
        });
    },
    
    showAvailabilityToasts: function() {
        const buttons = [
            { button: this.dom.ttsToggleButton, message: 'TTS now available (Voice Addon active)' },
            { button: this.dom.micToggleButton, message: 'Voice input now available (Voice Addon active)' },
            { button: this.dom.soundToggleButton, message: 'Sound System now available (Voice Addon active)' }
        ];
        
        buttons.forEach(({button, message}) => {
            if (button && !button.classList.contains('disabled')) {
                this.callbacks.showToast(message);
            }
        });
    },
    
    // =============================
    // TEXT-TO-SPEECH (TTS) SUBSYSTEM
    // =============================
    
    tts: {
        // TTS Cache Management
        _cleanup_interval: 60,
        _last_cleanup_time: 0,
        
        init: function() {
            console.log("VoiceUtilities.TTS: Initializing...");
            
            const parent = VoiceUtilities;
            
            if (!('speechSynthesis' in window)) {
                console.warn('VoiceUtilities.TTS: Browser does not support SpeechSynthesis API');
                parent.disableButton(parent.dom.ttsToggleButton, true);
                return;
            }
            
            if (parent.dom.ttsToggleButton) {
                this.updateButtonState();
                console.log("VoiceUtilities.TTS: Toggle button configured");
            } else {
                console.warn("VoiceUtilities.TTS: Toggle button not found in DOM");
            }
            
            // Initialize TTS state
            parent.resetState(parent.state.tts, {
                enabled: false,
                isSpeaking: false,
                lastSpokenWebsiteOutput: "",
                expectingAIResponse: false,
                lastMessageTimestamp: null,
                lastMessageId: null,
                lastTtsPlayTime: 0
            });
            
            console.log(`VoiceUtilities.TTS: Initialized successfully. Client ID: ${parent.state.clientId}`);
            
            // Voice change handler
            window.speechSynthesis.onvoiceschanged = () => {
                const voices = window.speechSynthesis.getVoices();
                console.log(`VoiceUtilities.TTS: Voices loaded/changed. Available voices: ${voices.length}`);
            };
            
            // TTS event handlers for speech recognition coordination
            this.setupEventHandlers();
        },
        
        setupEventHandlers: function() {
            const parent = VoiceUtilities;
            
            parent.callbacks.on('ttsStart', () => {
                console.log("VoiceUtilities.TTS Start Event: Pausing speech recognition if active");
                if (parent.state.speech.isRecognizing) {
                    parent.speech.stop();
                }
                if (parent.state.handsFree.pendingRecognitionRestart) {
                    console.log("VoiceUtilities.TTS Start Event: Cancelling pending recognition restart");
                    clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                    parent.state.handsFree.pendingRecognitionRestart = null;
                }
            });
            
            parent.callbacks.on('ttsEnd', () => {
                console.log("VoiceUtilities.TTS End Event: Handling post-speech actions");
                if (parent.state.handsFree.enabled && parent.state.handsFree.waitingForResponse) {
                    console.log("VoiceUtilities.TTS End Event: In hands-free mode, scheduling recognition restart");
                    parent.state.handsFree.waitingForResponse = false; // Clear wait state as TTS cycle is complete
                    parent.handsFree.safeRestart(parent.state.handsFree.delay);
                }
            });
        },
        
        toggle: function() {
            const parent = VoiceUtilities;
            
            if (!('speechSynthesis' in window)) {
                parent.callbacks.showToast('TTS not supported by this browser');
                return;
            }
            
            if (!parent.state.voiceAddonActive) {
                parent.callbacks.showToast('TTS unavailable: Voice Addon is inactive');
                return;
            }
            
            parent.state.tts.enabled = !parent.state.tts.enabled;
            console.log(`VoiceUtilities.TTS: Toggled state to: ${parent.state.tts.enabled}`);
            this.updateButtonState();
            
            if (parent.state.tts.enabled) {
                this.handleEnable();
            } else {
                this.handleDisable();
            }
        },
        
        handleEnable: function() {
            const parent = VoiceUtilities;
            parent.callbacks.showToast('TTS Enabled');
            
            // Reset TTS state
            parent.resetState(parent.state.tts, {
                enabled: true,
                expectingAIResponse: false,
                lastSpokenWebsiteOutput: "",
                lastMessageTimestamp: null,
                lastMessageId: null,
                isSpeaking: false
            });
            
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                console.log("VoiceUtilities.TTS: Cancelling any existing speech on enable");
                window.speechSynthesis.cancel();
            }
            
            // Trigger immediate poll
            setTimeout(() => {
                console.log("VoiceUtilities.TTS: Triggering immediate poll after enabling");
                this.fetchAIResponse();
            }, 150);
        },
        
        handleDisable: function() {
            const parent = VoiceUtilities;
            parent.callbacks.showToast('TTS Disabled');
            
            if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
                console.log("VoiceUtilities.TTS: Cancelling speech on disable");
                window.speechSynthesis.cancel();
            }
            
            parent.state.tts.isSpeaking = false;
            parent.state.tts.expectingAIResponse = false;
        },
        
        updateButtonState: function() {
            const parent = VoiceUtilities;
            const button = parent.dom.ttsToggleButton;
            
            if (!button) {
                console.warn("VoiceUtilities.TTS: Toggle button not found");
                return;
            }
            
            if (!('speechSynthesis' in window)) {
                parent.disableButton(button, true);
                return;
            }
            
            if (!parent.state.voiceAddonActive) {
                parent.updateButtonForInactiveAddon(button, 'TTS', '🔈');
                if (parent.state.tts.enabled) {
                    this.forceDisable();
                }
                return;
            }
            
            // TTS available
            parent.enableButton(button, parent.state.tts.enabled, {
                activeIcon: '🔊',
                inactiveIcon: '🔈',
                activeTitle: 'Click to Disable TTS',
                inactiveTitle: 'Click to Enable TTS'
            });
        },
        
        forceDisable: function() {
            const parent = VoiceUtilities;
            console.warn("VoiceUtilities.TTS: Forcing ttsEnabled to false");
            parent.state.tts.enabled = false;
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                parent.state.tts.isSpeaking = false;
            }
        },
        
        fetchAIResponse: async function() {
            const parent = VoiceUtilities;
            
            if (!this.canFetch()) return;
            
            parent.callbacks.addActiveRequest('ttsOutput');
            const currentTime = Date.now();
            console.log(`VoiceUtilities.TTS Poll: Fetching from ${parent.config.api.websiteOutput} (Client: ${parent.state.clientId})`);
            
            try {
                const response = await this.fetchContent(currentTime);
                
                if (!response.ok) {
                    this.handleFetchError();
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }
                
                await this.processResponse(response);
                
            } catch (error) {
                console.error(`VoiceUtilities.TTS Poll: Error during fetch or processing:`, error);
                this.handleFetchError();
            } finally {
                parent.callbacks.removeActiveRequest('ttsOutput');
            }
        },
        
        canFetch: function() {
            const parent = VoiceUtilities;
            const ttsConfig = parent.config.tts || {};
            const apiEndpoint = parent.config.api?.websiteOutput;
            
            if (!parent.state.tts.enabled || !parent.state.voiceAddonActive || !apiEndpoint) {
                if (!apiEndpoint) console.warn("VoiceUtilities.TTS Poll: websiteOutput API endpoint not configured");
                return false;
            }
            
            if (parent.callbacks.isRequestActive('ttsOutput')) {
                console.log("VoiceUtilities.TTS Poll: Previous request still active");
                return false;
            }
            
            if (parent.state.tts.isSpeaking || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                return false;
            }
            
            // Check minimum delay between TTS
            const currentTime = Date.now();
            const timeSinceLastTts = currentTime - parent.state.tts.lastTtsPlayTime;
            const minDelay = ttsConfig.minimumDelay || 1000;
            
            return timeSinceLastTts >= minDelay;
        },
        
        fetchContent: async function(currentTime) {
            const parent = VoiceUtilities;
            const fetchUrl = `${parent.config.api.websiteOutput}?t=${currentTime}&client=${parent.state.clientId}`;
            
            return await fetch(fetchUrl, {
                cache: "no-store",
                headers: { 'Accept': 'text/plain' }
            });
        },
        
        processResponse: async function(response) {
            const parent = VoiceUtilities;
            const messageTimestamp = response.headers.get('X-Message-Timestamp');
            const messageId = response.headers.get('X-Message-ID');
            const newResponseText = await response.text();
            const trimmedText = newResponseText.trim();
            
            if (this.isInvalidResponse(trimmedText, messageId)) {
                console.log(`VoiceUtilities.TTS Poll: Invalid AI response detected (ID: ${messageId}). No speech.`);
                this.updateStateForInvalidResponse(messageId); // This will handle hands-free restart if needed
                return;
            }
            
            const isNewMessageForClient = messageId !== parent.state.tts.lastMessageId;
            
            if (isNewMessageForClient) {
                console.log(`VoiceUtilities.TTS Poll: New message ID detected (${messageId}). Preparing to speak.`);
                this.updateStateForNewMessage(trimmedText, messageId, messageTimestamp);
                this.speak(trimmedText);
            }
        },
        
        isInvalidResponse: function(text, messageId) {
            return !text || !messageId || 
                messageId.startsWith("empty-") || 
                messageId.startsWith("error-") || 
                messageId.startsWith("route-error-") || 
                messageId.startsWith("proc-error-");
        },
        
        updateStateForInvalidResponse: function(messageId) {
            const parent = VoiceUtilities;
            if (parent.callbacks.getExpectingAIResponse() && messageId && messageId !== parent.state.tts.lastMessageId) {
                console.log("VoiceUtilities.TTS Poll: Resetting framework expectation flag based on new non-speakable message ID");
                parent.callbacks.setExpectingAIResponse(false);
            }
            if (messageId && messageId !== parent.state.tts.lastMessageId) {
                parent.state.tts.lastMessageId = messageId;
            }

            // --- FIX for Hands-Free Restart ---
            if (parent.state.handsFree.enabled && parent.state.handsFree.waitingForResponse) {
                console.log("VoiceUtilities.TTS: Invalid AI response, but hands-free was waiting. Clearing wait state and attempting restart.");
                parent.state.handsFree.waitingForResponse = false;
                parent.handsFree.safeRestart(parent.state.handsFree.delay); 
            }
            // --- END FIX ---
        },
        
        updateStateForNewMessage: function(text, messageId, timestamp) {
            const parent = VoiceUtilities;
            parent.state.tts.lastSpokenWebsiteOutput = text;
            parent.state.tts.lastMessageId = messageId;
            parent.state.tts.lastMessageTimestamp = timestamp;
            parent.state.tts.lastTtsPlayTime = Date.now();
            
            if (parent.callbacks.getExpectingAIResponse()) {
                console.log("VoiceUtilities.TTS Poll: Resetting expectation flag after processing new message");
                parent.callbacks.setExpectingAIResponse(false);
            }
        },
        
        handleFetchError: function() {
            const parent = VoiceUtilities;
            if (parent.callbacks.getExpectingAIResponse()) {
                console.warn(`VoiceUtilities.TTS Poll: Resetting expectation flag due to error`);
                parent.callbacks.setExpectingAIResponse(false);
            }
            // --- Also handle hands-free if it was waiting for this fetch ---
            if (parent.state.handsFree.enabled && parent.state.handsFree.waitingForResponse) {
                console.warn("VoiceUtilities.TTS: Fetch error, but hands-free was waiting. Clearing wait state and attempting restart.");
                parent.state.handsFree.waitingForResponse = false;
                parent.handsFree.safeRestart(parent.state.handsFree.delay);
            }
            // --- END ---
        },
        
        speak: function(text) {
            const parent = VoiceUtilities;
            
            if (!this.canSpeak(text)) return;
            
            // Clean text for speech
            const cleanText = text.replace(/[^a-zA-Z0-9 .,!?'":;\-\n\(\)]/gu, ' ')
                                 .replace(/\s+/g, ' ')
                                 .trim();
            
            if (!cleanText) {
                console.warn("VoiceUtilities.TTS: Text became empty after cleaning");
                this.handleFetchError(); // Ensures waitingForResponse is handled if this was the expected AI output
                return;
            }
            
            console.log(`VoiceUtilities.TTS: Preparing to speak: "${cleanText.substring(0, 70)}..."`);
            
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                console.log("VoiceUtilities.TTS: Synthesis busy. Cancelling previous utterance.");
                window.speechSynthesis.cancel();
                setTimeout(() => {
                    console.log("VoiceUtilities.TTS: Creating utterance after delay");
                    this._createUtterance(cleanText);
                }, 50);
            } else {
                console.log("VoiceUtilities.TTS: Synthesis idle. Creating utterance");
                this._createUtterance(cleanText);
            }
        },
        
        canSpeak: function(text) {
            const parent = VoiceUtilities;
            
            if (!parent.state.tts.enabled) {
                console.log("VoiceUtilities.TTS: TTS is globally disabled");
                return false;
            }
            
            if (!('speechSynthesis' in window)) {
                console.error("VoiceUtilities.TTS: SpeechSynthesis API not available");
                return false;
            }
            
            if (!text || typeof text !== 'string' || !text.trim()) {
                console.warn("VoiceUtilities.TTS: Provided text is empty or invalid");
                // No direct call to handleFetchError here as speak() might be called from other places.
                // The caller (fetchAIResponse) handles the fetch error case.
                return false;
            }
            
            return true;
        },
        
        _createUtterance: function(cleanText) {
            const parent = VoiceUtilities;
            
            if (!parent.state.tts.enabled) return;
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            this.configureUtterance(utterance);
            this.setupUtteranceHandlers(utterance);
            
            try {
                console.log("VoiceUtilities.TTS: Calling window.speechSynthesis.speak()");
                parent.state.tts.isSpeaking = true;
                window.speechSynthesis.speak(utterance);
            } catch(speakError) {
                parent.state.tts.isSpeaking = false;
                console.error("VoiceUtilities.TTS: Error during speak() call:", speakError);
                parent.callbacks.showToast(`TTS failed to start: ${speakError.message}`, 4000);
                this.handleFetchError(); // Ensures waitingForResponse is handled
                parent.callbacks.trigger('ttsError', { error: 'speak_call_failed', message: speakError.message });
            }
        },
        
        configureUtterance: function(utterance) {
            const parent = VoiceUtilities;
            const ttsConfig = parent.config.tts || {};
            const preferredVoiceName = ttsConfig.voicePriority;
            
            if (preferredVoiceName) {
                const voices = window.speechSynthesis.getVoices();
                const selectedVoice = voices.find(voice => voice.name === preferredVoiceName);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    console.log(`VoiceUtilities.TTS: Using preferred voice: ${selectedVoice.name}`);
                } else {
                    console.warn(`VoiceUtilities.TTS: Preferred voice "${preferredVoiceName}" not found`);
                }
            }
            
            utterance.rate = parseFloat(ttsConfig.rate) || 1.0;
            utterance.pitch = parseFloat(ttsConfig.pitch) || 1.0;
        },
        
        setupUtteranceHandlers: function(utterance) {
            const parent = VoiceUtilities;
            
            utterance.onstart = () => {
                parent.state.tts.isSpeaking = true;
                console.log("VoiceUtilities.TTS: Speech started");
                parent.callbacks.trigger('ttsStart');
            };
            
            utterance.onend = () => {
                parent.state.tts.isSpeaking = false;
                console.log("VoiceUtilities.TTS: Speech finished naturally");
                parent.callbacks.trigger('ttsEnd'); // This will clear waitingForResponse if needed
            };
            
            utterance.onerror = (event) => {
                parent.state.tts.isSpeaking = false;
                console.error(`VoiceUtilities.TTS: Error occurred - Type: ${event.error}`);
                if (event.error !== 'canceled' && event.error !== 'interrupted') {
                    parent.callbacks.showToast(`TTS playback error: ${event.error}`);
                    // Instead of handleFetchError, directly manage handsFree state like ttsEnd would
                    if (parent.state.handsFree.enabled && parent.state.handsFree.waitingForResponse) {
                        console.warn("VoiceUtilities.TTS Error: Clearing wait state and attempting restart.");
                        parent.state.handsFree.waitingForResponse = false;
                        parent.handsFree.safeRestart(parent.state.handsFree.delay);
                    }
                }
                parent.callbacks.trigger('ttsError', { error: event.error });
            };
            
            utterance.onpause = () => {
                console.log("VoiceUtilities.TTS: Speech paused");
                parent.state.tts.isSpeaking = false;
                parent.callbacks.trigger('ttsPause');
            };
            
            utterance.onresume = () => {
                console.log("VoiceUtilities.TTS: Speech resumed");
                parent.state.tts.isSpeaking = true;
                parent.callbacks.trigger('ttsResume');
            };
        },
        
        cleanupCache: function() {
            // This would be called by Framework's cleanup function
            const cutoff_time = Date.now() / 1000 - 300; // 5 minutes
            let deleted_count = 0;
            
            if (typeof SPOKEN_MESSAGE_IDS === 'object' && SPOKEN_MESSAGE_IDS !== null) {
                const keys_to_delete = [];
                
                for (const [msg_id, first_seen_time] of Object.entries(SPOKEN_MESSAGE_IDS)) {
                    if (typeof first_seen_time === 'number' && first_seen_time < cutoff_time) {
                        keys_to_delete.push(msg_id);
                    }
                }
                
                for (const key of keys_to_delete) {
                    delete SPOKEN_MESSAGE_IDS[key];
                    deleted_count++;
                }
                
                if (deleted_count > 0) {
                    console.log(`[SYSTEM Clean] Cleaned SPOKEN_MESSAGE_IDS, removed ${deleted_count} stale keys.`);
                }
            }
        }
    },
    
    // ===================================
    // SOUND SYSTEM SUBSYSTEM
    // ===================================
    
    sound: {
        // Sound System Cache Management
        _cleanuser_cleanup_interval: 60,
        _cleanuser_last_cleanup_time: 0,
        
        init: function() {
            console.log("VoiceUtilities.Sound: Initializing...");
            
            const parent = VoiceUtilities;
            
            // Initialize from config
            parent.state.sound.userToggledEnabled = parent.config.soundSystem?.enabled || false;
            parent.state.sound.currentVolume = parent.config.soundSystem?.defaultVolume || 0.5;
            
            if (parent.dom.soundToggleButton) {
                this.updateButtonState();
                console.log("VoiceUtilities.Sound: Toggle button configured");
            } else {
                console.warn("VoiceUtilities.Sound: Toggle button not found in DOM");
            }
            
            // Update effective state
            this.updateEffectiveState();
            console.log("VoiceUtilities.Sound: Initialized successfully");
        },
        
        toggle: function() {
            const parent = VoiceUtilities;
            
            if (!parent.state.voiceAddonActive) {
                parent.callbacks.showToast('Sound System unavailable: Voice Addon is inactive');
                return;
            }
            
            parent.state.sound.userToggledEnabled = !parent.state.sound.userToggledEnabled;
            console.log(`VoiceUtilities.Sound: User toggled preference to: ${parent.state.sound.userToggledEnabled}`);
            
            this.updateEffectiveState();
            this.updateButtonState();
            
            if (parent.state.sound.enabled) {
                parent.callbacks.showToast('Sound System Enabled');
            } else {
                parent.callbacks.showToast('Sound System Disabled');
                this.stopAll();
            }
        },
        
        updateEffectiveState: function() {
            const parent = VoiceUtilities;
            
            // Effective state requires both user preference AND voice addon
            const newEffectiveState = parent.state.sound.userToggledEnabled && parent.state.voiceAddonActive;
            if (parent.state.sound.enabled !== newEffectiveState) {
                parent.state.sound.enabled = newEffectiveState;
                console.log(`VoiceUtilities.Sound: Effective state updated to: ${newEffectiveState}`);
                if (!newEffectiveState) {
                    this.stopAll();
                }
            }
        },
        
        updateButtonState: function() {
            const parent = VoiceUtilities;
            const button = parent.dom.soundToggleButton;
            
            if (!button) {
                console.warn("VoiceUtilities.Sound: Toggle button not found");
                return;
            }
            
            const soundSystemConfig = parent.config.soundSystem || {};
            const pollingConfig = parent.config.refreshIntervals?.soundCheck || 0;
            
            // Check if configured
            if (!parent.config.api?.websiteOutput || pollingConfig <= 0) {
                parent.disableButton(button, true);
                parent.state.sound.enabled = false;
                parent.state.sound.userToggledEnabled = false;
                this.stopAll();
                return;
            }
            
            // Check voice addon dependency
            if (!parent.state.voiceAddonActive) {
                parent.updateButtonForInactiveAddon(button, 'Sound System', '🔇');
                parent.state.sound.enabled = false;
                parent.state.sound.userToggledEnabled = false;
                this.stopAll();
                return;
            }
            
            // Sound system available
            parent.enableButton(button, parent.state.sound.userToggledEnabled, {
                activeIcon: '🎵',
                inactiveIcon: '🎶',
                activeTitle: 'Click to Disable Sound System',
                inactiveTitle: 'Click to Enable Sound System'
            });
            
            this.updateEffectiveState();
        },
        
        fetchTriggers: async function() {
            const parent = VoiceUtilities;
            
            if (!parent.state.sound.enabled || !parent.state.sound.userInteracted || 
                parent.callbacks.isRequestActive('soundTriggers')) return;
            
            parent.callbacks.addActiveRequest('soundTriggers');
            
            try {
                const [userCleanText, websiteOutputText] = await this.fetchContent();
                
                if (userCleanText || websiteOutputText) {
                    const currentContent = {
                        userClean: userCleanText.trim(),
                        websiteOutput: websiteOutputText.trim()
                    };
                    
                    if (this.hasNewContent(currentContent)) {
                        this.processTriggers(currentContent.userClean, currentContent.websiteOutput);
                        parent.state.sound.processedContent = currentContent;
                    }
                }
            } catch (error) {
                console.error('VoiceUtilities.Sound: Unexpected error during fetchTriggers:', error);
            } finally {
                parent.callbacks.removeActiveRequest('soundTriggers');
            }
        },
        
        fetchContent: async function() {
            const parent = VoiceUtilities;
            let userCleanText = '';
            let websiteOutputText = '';
            
            // Fetch cleanuser.txt (optional, silent fail)
            if (parent.config.api?.userClean) {
                try {
                    const response = await fetch(parent.config.api.userClean, {
                        cache: "no-store",
                        headers: { 'Accept': 'text/plain' }
                    });
                    if (response.ok) {
                        userCleanText = await response.text();
                    }
                } catch (err) {
                    // Silently ignore cleanuser errors
                }
            }
            
            // Fetch website_output.txt (critical)
            if (parent.config.api?.websiteOutput) {
                try {
                    const response = await fetch(parent.config.api.websiteOutput, {
                        cache: "no-store",
                        headers: { 'Accept': 'text/plain' }
                    });
                    if (response.ok) {
                        websiteOutputText = await response.text();
                    } else {
                        console.warn(`VoiceUtilities.Sound: website_output.txt fetch error (${response.status})`);
                    }
                } catch (err) {
                    console.error('VoiceUtilities.Sound: Error fetching website_output.txt:', err);
                }
            }
            
            return [userCleanText, websiteOutputText];
        },
        
        hasNewContent: function(currentContent) {
            const parent = VoiceUtilities;
            return currentContent.userClean !== parent.state.sound.processedContent.userClean ||
                   currentContent.websiteOutput !== parent.state.sound.processedContent.websiteOutput;
        },
        
        processTriggers: function(userCleanText, websiteOutputText) {
            const parent = VoiceUtilities;
            
            // Clear old triggers when content changes
            this.clearOldTriggers(userCleanText, websiteOutputText);
            
            // Process triggers
            const triggerRegex = /sound(start|volume|stop):?([^\s\n`'"]*)/gi;
            const triggersToProcess = [];
            
            // Process both sources
            this.extractTriggers(userCleanText, 'user', triggerRegex, triggersToProcess);
            triggerRegex.lastIndex = 0; // Reset regex
            this.extractTriggers(websiteOutputText, 'ai', triggerRegex, triggersToProcess);
            
            // Process new triggers
            triggersToProcess.forEach(trigger => {
                console.log(`VoiceUtilities.Sound: Processing trigger - ${trigger.type}:${trigger.value}`);
                
                switch (trigger.type) {
                    case 'start':
                        if (trigger.value) this.play(trigger.value);
                        break;
                    case 'volume':
                        const volume = parseFloat(trigger.value);
                        if (!isNaN(volume)) {
                            this.setVolume(Math.max(0, Math.min(1, volume)));
                        }
                        break;
                    case 'stop':
                        this.stopAll();
                        break;
                }
            });
            
            // Clean up old triggers periodically
            if (parent.state.sound.processedTriggers.size > 100) {
                this.cleanupTriggerHistory();
            }
        },
        
        clearOldTriggers: function(userCleanText, websiteOutputText) {
            const parent = VoiceUtilities;
            
            // Clear AI triggers if websiteOutput changed
            if (websiteOutputText && websiteOutputText !== parent.state.sound.processedContent.websiteOutput) {
                this.clearTriggersWithPrefix('ai:');
            }
            
            // Clear user triggers if userClean changed
            if (userCleanText && userCleanText !== parent.state.sound.processedContent.userClean) {
                this.clearTriggersWithPrefix('user:');
            }
        },
        
        clearTriggersWithPrefix: function(prefix) {
            const parent = VoiceUtilities;
            const toRemove = Array.from(parent.state.sound.processedTriggers)
                                  .filter(key => key.startsWith(prefix));
            
            toRemove.forEach(key => parent.state.sound.processedTriggers.delete(key));
            
            if (toRemove.length > 0) {
                console.log(`VoiceUtilities.Sound: Cleared ${toRemove.length} old ${prefix.slice(0, -1)} triggers`);
            }
        },
        
        extractTriggers: function(text, source, regex, triggersArray) {
            const parent = VoiceUtilities;
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const triggerType = match[1].toLowerCase();
                let triggerValue = match[2] || '';
                triggerValue = triggerValue.replace(/[`'"]+$/, '');
                
                const triggerKey = `${source}:${triggerType}:${triggerValue}`;
                
                if (!parent.state.sound.processedTriggers.has(triggerKey)) {
                    triggersArray.push({ type: triggerType, value: triggerValue, key: triggerKey });
                    parent.state.sound.processedTriggers.add(triggerKey);
                }
            }
        },
        
        cleanupTriggerHistory: function() {
            const parent = VoiceUtilities;
            const keepKeys = new Set();
            const allKeys = Array.from(parent.state.sound.processedTriggers);
            
            // Keep the last 50 triggers
            for (let i = Math.max(0, allKeys.length - 50); i < allKeys.length; i++) {
                keepKeys.add(allKeys[i]);
            }
            
            parent.state.sound.processedTriggers = keepKeys;
            console.log("VoiceUtilities.Sound: Cleaned up trigger history");
        },
        
        play: function(url) {
            const parent = VoiceUtilities;
            
            if (!parent.state.sound.enabled || !parent.state.sound.userInteracted) {
                console.log(`VoiceUtilities.Sound: Skipped play(${url}) - ${!parent.state.sound.enabled ? 'disabled' : 'no user interaction'}`);
                return;
            }
            
            // Clean and validate URL
            url = url.trim().replace(/[`'"]+$/, '');
            
            if (!this.isValidUrl(url)) {
                console.warn(`VoiceUtilities.Sound: Invalid URL format: ${url}`);
                return;
            }
            
            if (parent.state.sound.activeSounds.has(url)) {
                console.log(`VoiceUtilities.Sound: Sound already playing: ${url}`);
                return;
            }
            
            // Check max simultaneous sounds
            const maxSimultaneous = parent.config.soundSystem?.maxSimultaneousSounds || 5;
            if (parent.state.sound.activeSounds.size >= maxSimultaneous) {
                console.warn(`VoiceUtilities.Sound: Maximum simultaneous sounds reached, stopping oldest`);
                const firstKey = parent.state.sound.activeSounds.keys().next().value;
                this.stop(firstKey);
            }
            
            this.createAndPlayAudio(url);
        },
        
        isValidUrl: function(url) {
            return url && typeof url === 'string' && 
                   (url.startsWith('http://') || url.startsWith('https://') || 
                    url.startsWith('//') || url.startsWith('/'));
        },
        
        createAndPlayAudio: function(url) {
            const parent = VoiceUtilities;
            
            try {
                const audio = new Audio(url);
                audio.volume = parent.state.sound.currentVolume;
                
                this.setupAudioHandlers(audio, url);
                
                parent.state.sound.activeSounds.set(url, audio);
                console.log(`VoiceUtilities.Sound: Started loading sound: ${url}`);
                
            } catch (error) {
                console.error(`VoiceUtilities.Sound: Failed to create Audio object for ${url}:`, error);
            }
        },
        
        setupAudioHandlers: function(audio, url) {
            const parent = VoiceUtilities;
            
            audio.addEventListener('canplay', () => {
                if (parent.state.sound.enabled && parent.state.sound.userInteracted) {
                    audio.play().catch(error => {
                        if (error.name === 'NotAllowedError') {
                            console.log('VoiceUtilities.Sound: Autoplay prevented by browser');
                            parent.state.sound.userInteracted = false;
                        } else {
                            console.error('VoiceUtilities.Sound: Error playing audio:', error);
                        }
                        parent.state.sound.activeSounds.delete(url);
                    });
                } else {
                    console.log(`VoiceUtilities.Sound: Not playing ${url} - system disabled or no user interaction`);
                    parent.state.sound.activeSounds.delete(url);
                    audio.pause();
                    audio.currentTime = 0;
                }
            }, { once: true });
            
            audio.addEventListener('ended', () => {
                console.log(`VoiceUtilities.Sound: Sound ended: ${url}`);
                parent.state.sound.activeSounds.delete(url);
            }, { once: true });
            
            audio.addEventListener('error', (event) => {
                console.error(`VoiceUtilities.Sound: Error loading audio ${url}:`, event);
                parent.state.sound.activeSounds.delete(url);
            }, { once: true });
        },
        
        stop: function(url) {
            const parent = VoiceUtilities;
            const audio = parent.state.sound.activeSounds.get(url);
            
            if (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (error) {
                    console.error(`VoiceUtilities.Sound: Error stopping sound ${url}:`, error);
                }
                parent.state.sound.activeSounds.delete(url);
                console.log(`VoiceUtilities.Sound: Stopped sound: ${url}`);
            }
        },
        
        stopAll: function() {
            const parent = VoiceUtilities;
            console.log(`VoiceUtilities.Sound: Stopping all ${parent.state.sound.activeSounds.size} sounds`);
            
            for (const [url, audio] of parent.state.sound.activeSounds) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (error) {
                    console.error(`VoiceUtilities.Sound: Error stopping sound ${url}:`, error);
                }
            }
            parent.state.sound.activeSounds.clear();
            console.log("VoiceUtilities.Sound: All sounds cleared");
        },
        
        setVolume: function(volume) {
            const parent = VoiceUtilities;
            parent.state.sound.currentVolume = volume;
            console.log(`VoiceUtilities.Sound: Setting global volume to ${volume}`);
            
            for (const [url, audio] of parent.state.sound.activeSounds) {
                try {
                    audio.volume = volume;
                } catch (error) {
                    console.error(`VoiceUtilities.Sound: Error setting volume for ${url}:`, error);
                }
            }
        }
    },
    
    // ============================
    // SPEECH RECOGNITION SUBSYSTEM
    // ============================
    
    speech: {
        init: function() {
            console.log("VoiceUtilities.Speech: Initializing...");
            const parent = VoiceUtilities;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                console.warn('VoiceUtilities.Speech: Browser does not support SpeechRecognition API');
                parent.disableButton(parent.dom.micToggleButton, true);
                return;
            }
            
            if (parent.dom.micToggleButton) {
                this.updateButtonState();
                console.log("VoiceUtilities.Speech: Toggle button configured");
            } else {
                console.warn("VoiceUtilities.Speech: Toggle button not found in DOM");
            }
            
            parent.handsFree.setup();
            
            // Initialize state
            parent.resetState(parent.state.speech, {
                enabled: false,
                isRecognizing: false,
                recognition: null,
                interruptionHandlersSet: false,
                isVoiceInput: false,
                recognitionResult: "",
                pendingSubmission: false
            });
            
            parent.resetState(parent.state.handsFree, {
                enabled: false,
                autoRestartPending: false,
                waitingForResponse: false,
                pendingRecognitionRestart: null,
                delay: parent.config.speechRecognition?.handsFreeModeDelay || 1500
            });
            
            console.log(`VoiceUtilities.Speech: Initialized successfully. Client ID: ${parent.state.clientId}`);
        },
        
        toggle: function() {
            const parent = VoiceUtilities;
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognitionAPI) {
                parent.callbacks.showToast('Speech recognition not supported by this browser');
                return;
            }
            
            if (!parent.state.voiceAddonActive) {
                parent.callbacks.showToast('Voice input unavailable: Voice Addon is inactive');
                return;
            }
            
            if (parent.state.speech.isRecognizing) {
                this.handleStop();
                return;
            }
            
            this.handleStart();
        },
        
        handleStop: function() {
            const parent = VoiceUtilities;
            parent.callbacks.showToast('Stopped Listening');
            this.stop();
            
            if (parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.Speech: Voice button clicked to stop while hands-free active. Disabling hands-free.");
                parent.state.handsFree.enabled = false;
                if (parent.dom.handsFreeModeToggle) parent.dom.handsFreeModeToggle.checked = false;
                parent.callbacks.showToast('Hands-free mode disabled');
            }
        },
        
        handleStart: function() {
            const parent = VoiceUtilities;
            
            // Disable hands-free if it was on
            if (parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.Speech: Voice button clicked while hands-free active. Disabling hands-free.");
                parent.state.handsFree.enabled = false;
                if (parent.dom.handsFreeModeToggle) parent.dom.handsFreeModeToggle.checked = false;
                parent.callbacks.showToast('Hands-free mode disabled');
            }
            
            if (!parent.state.speech.enabled) {
                parent.state.speech.enabled = true;
                console.log("VoiceUtilities.Speech: Enabled via manual toggle");
            }
            
            this.updateButtonState();
            
            if (parent.state.handsFree.pendingRecognitionRestart) {
                clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                parent.state.handsFree.pendingRecognitionRestart = null;
            }
            
            parent.state.speech.recognitionResult = "";
            parent.state.handsFree.waitingForResponse = false;
            parent.callbacks.showToast('Listening...');
            this.start();
        },
        
        updateButtonState: function() {
            const parent = VoiceUtilities;
            const button = parent.dom.micToggleButton;
            
            if (!button) {
                console.warn("VoiceUtilities.Speech: Mic toggle button not found");
                return;
            }
            
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognitionAPI) {
                parent.disableButton(button, true);
                if (parent.dom.voiceOptionsContainer) {
                    parent.dom.voiceOptionsContainer.classList.remove('available');
                }
                return;
            }
            
            if (!parent.state.voiceAddonActive) {
                this.handleInactiveVoiceAddon(button);
                return;
            }
            
            // Speech recognition available
            this.handleActiveVoiceAddon(button);
        },
        
        handleInactiveVoiceAddon: function(button) {
            const parent = VoiceUtilities;
            
            parent.updateButtonForInactiveAddon(button, 'Voice input', '🎤');
            
            if (parent.dom.voiceOptionsContainer) {
                parent.dom.voiceOptionsContainer.classList.remove('available');
                if (parent.dom.handsFreeModeToggle) {
                    parent.dom.handsFreeModeToggle.checked = false;
                    parent.state.handsFree.enabled = false;
                }
            }
            
            if (parent.state.speech.enabled) {
                console.warn("VoiceUtilities.Speech: Forcing speechRecognitionEnabled to false");
                parent.state.speech.enabled = false;
                parent.state.handsFree.enabled = false;
                if (parent.dom.handsFreeModeToggle) {
                    parent.dom.handsFreeModeToggle.checked = false;
                }
                if (parent.state.speech.isRecognizing) {
                    this.stop();
                }
                if (parent.state.handsFree.pendingRecognitionRestart) {
                    clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                    parent.state.handsFree.pendingRecognitionRestart = null;
                }
            }
        },
        
        handleActiveVoiceAddon: function(button) {
            const parent = VoiceUtilities;
            
            button.classList.remove('disabled');
            button.style.display = '';
            button.setAttribute('aria-disabled', 'false');
            button.disabled = false;
            
            if (parent.dom.voiceOptionsContainer) {
                parent.dom.voiceOptionsContainer.classList.add('available');
            }
            
            if (parent.state.speech.isRecognizing) {
                button.classList.add('active');
                button.textContent = '🎤';
                button.setAttribute('title', 'Click to stop voice input');
                if (parent.dom.recordingIndicator) {
                    parent.dom.recordingIndicator.classList.remove('hidden');
                }
            } else {
                button.classList.remove('active');
                button.textContent = '🎤';
                button.setAttribute('title', 'Click to start voice input');
                this.stopCountdown();
                if (parent.dom.recordingIndicator) {
                    parent.dom.recordingIndicator.classList.add('hidden');
                }
            }
        },
        
        setup: function() {
            const parent = VoiceUtilities;
            
            if (parent.state.speech.recognition) {
                return parent.state.speech.recognition;
            }
            
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognitionAPI();
            const srConfig = parent.config.speechRecognition || {};
            
            recognition.continuous = srConfig.continuous !== undefined ? srConfig.continuous : false;
            recognition.interimResults = srConfig.interimResults !== undefined ? srConfig.interimResults : true;
            recognition.lang = srConfig.language || 'en-US';
            
            this.setupRecognitionHandlers(recognition);
            
            parent.state.speech.recognition = recognition;
            return recognition;
        },
        
        setupRecognitionHandlers: function(recognition) {
            const parent = VoiceUtilities;
            
            recognition.onstart = () => {
                console.log("VoiceUtilities.Speech: Recognition started");
                parent.state.speech.isRecognizing = true;
                this.updateButtonState();
                
                if (parent.dom.recordingIndicator) {
                    parent.dom.recordingIndicator.classList.remove('hidden');
                }
                
                // Stop TTS if speaking
                if (parent.state.tts.isSpeaking || (window.speechSynthesis?.speaking || window.speechSynthesis?.pending)) {
                    console.log("VoiceUtilities.Speech: Stopping TTS because recognition started");
                    if (window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                    }
                    parent.state.tts.isSpeaking = false;
                }
                
                if (!parent.state.speech.interruptionHandlersSet) {
                    this.setupInterruptions();
                }
            };
            
            recognition.onresult = (event) => this.handleResult(event);
            
            recognition.onspeechend = () => {
                console.log("VoiceUtilities.Speech: Speech ended");
            };
            
            recognition.onend = () => this.handleRecognitionEnd();
            
            recognition.onerror = (event) => this.handleError(event);
        },
        
        handleResult: function(event) {
            const parent = VoiceUtilities;
            console.log("VoiceUtilities.Speech: Got recognition result");
            
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            parent.state.speech.recognitionResult = finalTranscript || interimTranscript;
            
            if (parent.dom.userInput) {
                const transcriptToUse = finalTranscript || interimTranscript;
                if (transcriptToUse) {
                    parent.state.speech.isVoiceInput = true;
                    parent.dom.userInput.value = transcriptToUse;
                    parent.dom.userInput.dispatchEvent(new Event('input'));
                    setTimeout(() => {
                        parent.state.speech.isVoiceInput = false;
                    }, 10);
                    
                    if (finalTranscript) {
                        this.handleFinalTranscript(finalTranscript);
                    }
                }
            }
        },
        
        handleFinalTranscript: function(finalTranscript) {
            const parent = VoiceUtilities;
            const recognition = parent.state.speech.recognition;
            
            if (parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.Speech: Hands-free mode: Final transcript ready, preparing to submit");
                parent.state.speech.pendingSubmission = true;
                this.stop();
            } else {
                console.log("VoiceUtilities.Speech: Non Hands-free mode: Final transcript obtained.");
                if (!recognition.continuous) {
                    this.stop();
                }
            }
        },
        
        handleRecognitionEnd: function() {
            const parent = VoiceUtilities;
            console.log("VoiceUtilities.Speech: Recognition ended");
            parent.state.speech.isRecognizing = false;
            this.updateButtonState();
            
            if (parent.dom.recordingIndicator) {
                parent.dom.recordingIndicator.classList.add('hidden');
            }
            
            // Handle hands-free auto-submit
            if (parent.state.speech.pendingSubmission) {
                console.log("VoiceUtilities.Speech: Hands-free mode: Recognition ended with pending submission.");
                const recognizedTextForSubmission = parent.state.speech.recognitionResult.trim();
                parent.state.speech.pendingSubmission = false; // Clear before async call

                if (recognizedTextForSubmission) {
                    setTimeout(() => {
                        parent.state.handsFree.waitingForResponse = true;
                        parent.callbacks.sendMessage();
                    }, 100);
                    return; 
                } else {
                     console.log("VoiceUtilities.Speech: Hands-free mode: Pending submission was for empty text. Skipping send, proceeding to restart.");
                     // Fall through to handleHandsFreeRestart
                }
            }
            
            // Auto-restart logic for hands-free mode
            this.handleHandsFreeRestart();
        },
        
        handleHandsFreeRestart: function() {
            const parent = VoiceUtilities;
            
            if (parent.state.handsFree.enabled && !parent.state.handsFree.waitingForResponse) {
                console.log("VoiceUtilities.Speech: Hands-free mode: Recognition ended without submission.");
                
                if (!parent.state.speech.recognitionResult && !parent.callbacks.getExpectingAIResponse()) {
                    console.log("VoiceUtilities.Speech: Hands-free mode: No result, scheduling quick restart");
                    parent.handsFree.safeRestart(500);
                } else if (!parent.state.tts.isSpeaking) {
                    console.log("VoiceUtilities.Speech: Hands-free mode: Scheduling standard restart");
                    parent.handsFree.safeRestart(parent.state.handsFree.delay);
                }
            } else if (parent.state.handsFree.enabled && parent.state.handsFree.waitingForResponse) {
                console.log("VoiceUtilities.Speech: Hands-free mode: Waiting for AI response.");
            }
        },
        
        handleError: function(event) {
            const parent = VoiceUtilities;
            console.error(`VoiceUtilities.Speech: Error occurred - ${event.error}`);
            parent.state.speech.isRecognizing = false;
            this.updateButtonState();
            
            if (parent.dom.recordingIndicator) {
                parent.dom.recordingIndicator.classList.add('hidden');
            }
            
            parent.state.speech.pendingSubmission = false;
            
            const errorHandlers = {
                'no-speech': () => {
                    parent.callbacks.showToast("No speech detected. Please try again.");
                    if (parent.state.handsFree.enabled && !parent.state.handsFree.waitingForResponse) {
                        parent.handsFree.safeRestart(1000);
                    }
                },
                'aborted': () => parent.callbacks.showToast("Speech recognition aborted."),
                'audio-capture': () => parent.callbacks.showToast("No microphone detected. Please check your device."),
                'not-allowed': () => parent.callbacks.showToast("Microphone access denied. Please allow microphone access."),
                'service-not-allowed': () => parent.callbacks.showToast("Speech recognition service not allowed."),
                'bad-grammar': () => parent.callbacks.showToast("Recognition grammar error."),
                'language-not-supported': () => parent.callbacks.showToast("Language not supported."),
                'network': () => {
                    parent.callbacks.showToast("Network error occurred during recognition.");
                    if (parent.state.handsFree.enabled && !parent.state.handsFree.waitingForResponse) {
                        parent.handsFree.safeRestart(3000);
                    }
                },
                'canceled': () => {
                    console.log("VoiceUtilities.Speech: Canceled normally.");
                    return; // Don't show toast
                }
            };
            
            const handler = errorHandlers[event.error] || (() => {
                parent.callbacks.showToast(`Speech recognition error: ${event.error}`, 3000);
            });
            
            handler();
            
            if (parent.state.handsFree.enabled && !parent.state.handsFree.waitingForResponse && 
                event.error !== 'canceled') {
                console.log(`VoiceUtilities.Speech: Restarting after error: ${event.error}`);
                parent.handsFree.safeRestart(1000);
            }
        },
        
        start: function() {
            const parent = VoiceUtilities;
            
            if (parent.state.speech.isRecognizing) {
                console.log("VoiceUtilities.Speech: Already recognizing.");
                return;
            }
            
            if (!parent.state.speech.enabled && !parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.Speech: Speech recognition not enabled.");
                return;
            }
            
            // Check TTS status before starting
            if (parent.state.tts.isSpeaking || (window.speechSynthesis?.speaking || window.speechSynthesis?.pending)) {
                console.log("VoiceUtilities.Speech: TTS is speaking, waiting for it to finish");
                const endListener = parent.callbacks.on('ttsEnd', () => {
                    console.log("VoiceUtilities.Speech: TTS ended, now starting speech recognition");
                    parent.callbacks.off('ttsEnd', endListener);
                    setTimeout(() => {
                        if ((parent.state.speech.enabled || parent.state.handsFree.enabled) && 
                            !parent.state.speech.isRecognizing) {
                            this.start();
                        }
                    }, 300);
                });
                return;
            }
            
            this.beginRecognition();
        },
        
        beginRecognition: function() {
            const parent = VoiceUtilities;
            
            try {
                const recognition = this.setup();
                if (parent.dom.userInput) {
                    parent.dom.userInput.value = '';
                    parent.dom.userInput.dispatchEvent(new Event('input'));
                }
                
                parent.state.speech.recognitionResult = "";
                parent.state.speech.pendingSubmission = false; 
                // If hands-free isn't waiting due to TTS.onEnd, ensure waitingForResponse is false for a fresh start
                if (parent.state.handsFree.enabled && !parent.state.tts.isSpeaking) { 
                    parent.state.handsFree.waitingForResponse = false;
                }
                recognition.start();
                
                console.log("VoiceUtilities.Speech: Started" +
                           (parent.state.handsFree.enabled ? " (Hands-free mode active)" : ""));
                
            } catch (error) {
                console.error("VoiceUtilities.Speech: Error starting recognition:", error);
                parent.callbacks.showToast('Error starting voice input', 3000);
                parent.state.speech.pendingSubmission = false;
                
                if (parent.state.handsFree.enabled && !parent.state.handsFree.waitingForResponse) {
                    console.log("VoiceUtilities.Speech: Error starting recognition in hands-free mode, attempting restart.");
                    parent.handsFree.safeRestart(2000);
                }
            }
        },
        
        stop: function() {
            const parent = VoiceUtilities;
            
            if (!parent.state.speech.isRecognizing || !parent.state.speech.recognition) {
                console.log("VoiceUtilities.Speech: Not currently recognizing.");
                return;
            }
            
            try {
                // parent.state.speech.pendingSubmission = false; // This was the original fix for send bug
                this.stopCountdown();
                parent.state.speech.recognition.stop();
                console.log("VoiceUtilities.Speech: Stopped.");
            } catch (error) {
                console.error("VoiceUtilities.Speech: Error stopping recognition:", error);
                parent.state.speech.isRecognizing = false;
                this.updateButtonState();
                if (parent.dom.recordingIndicator) {
                    parent.dom.recordingIndicator.classList.add('hidden');
                }
                this.stopCountdown();
            }
        },
        
        setupInterruptions: function() {
            const parent = VoiceUtilities;
            
            if (parent.state.speech.interruptionHandlersSet) {
                console.log("VoiceUtilities.Speech: Interruption handlers already set.");
                return;
            }
            
            console.log("VoiceUtilities.Speech: Setting up interruption handlers");
            
            // Click handler for non-toggle/hands-free clicks
            document.addEventListener('click', (event) => {
                const ignoreSelectors = [
                    '#micToggleButton', '#micToggleButton *',
                    '#handsFreeModeToggle', '#handsFreeModeToggle *',
                    '.hands-free-toggle-container', '.hands-free-toggle-container *',
                    '#ttsToggleButton', '#ttsToggleButton *',
                    '#soundToggleButton', '#soundToggleButton *'
                ];
                
                const shouldIgnore = ignoreSelectors.some(selector => event.target.matches(selector));
                
                if (parent.state.speech.isRecognizing && !shouldIgnore) {
                    console.log("VoiceUtilities.Speech: Click outside mic/hands-free/media area detected.");
                    this.handleInterruption('click-outside-mic-area');
                }
            }, { capture: true });
            
            // Input field handlers
            this.setupInputHandlers();
            
            // Touch handler
            document.addEventListener('touchstart', (event) => {
                const ignoreSelectors = [
                    '#micToggleButton', '#micToggleButton *',
                    '#handsFreeModeToggle', '#handsFreeModeToggle *',
                    '.hands-free-toggle-container', '.hands-free-toggle-container *',
                    '#ttsToggleButton', '#ttsToggleButton *',
                    '#soundToggleButton', '#soundToggleButton *'
                ];
                
                const shouldIgnore = ignoreSelectors.some(selector => event.target.matches(selector));
                
                if (parent.state.speech.isRecognizing && !shouldIgnore) {
                    console.log("VoiceUtilities.Speech: Touch outside mic/hands-free/media area detected.");
                    this.handleInterruption('touch-outside-mic-area');
                }
            }, { capture: true, passive: true });
            
            parent.state.speech.interruptionHandlersSet = true;
        },
        
        setupInputHandlers: function() {
            const parent = VoiceUtilities;
            
            if (parent.dom.userInput) {
                const handlers = {
                    'click': 'input-click',
                    'focus': 'input-focus',
                    'keydown': (event) => {
                        if (parent.state.speech.isRecognizing && !event.ctrlKey && !event.metaKey) {
                            console.log("VoiceUtilities.Speech: Key pressed in input field while recognizing.");
                            this.handleInterruption('input-keydown');
                        }
                    }
                };
                
                Object.entries(handlers).forEach(([eventType, handler]) => {
                    parent.dom.userInput.addEventListener(eventType, 
                        typeof handler === 'string' 
                            ? () => {
                                if (parent.state.speech.isRecognizing) {
                                    console.log(`VoiceUtilities.Speech: User input field ${eventType}.`);
                                    this.handleInterruption(handler);
                                }
                              }
                            : handler,
                        { capture: true }
                    );
                });
            }
        },
        
        handleInterruption: function(source) {
            const parent = VoiceUtilities;
            
            if (!parent.state.speech.isRecognizing) {
                console.log(`VoiceUtilities.Speech: handleInterruption called from ${source} but not recognizing.`);
                return;
            }
            
            console.log(`VoiceUtilities.Speech: Handling interruption from: ${source}`);
            
            // Stop recognition immediately
            this.stop();
            
            // Clear any scheduled restarts
            if (parent.state.handsFree.pendingRecognitionRestart) {
                console.log("VoiceUtilities.Speech: Interruption -> Clearing pending restart timer.");
                clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                parent.state.handsFree.pendingRecognitionRestart = null;
            }
            
            // Show toast for certain interruptions
            if (!source.includes('input-') && source !== 'click-outside-mic-area' && 
                source !== 'touch-outside-mic-area') {
                parent.callbacks.showToast('Voice input interrupted', 1500);
            }
            
            // In hands-free mode, decide whether to restart
            if (parent.state.handsFree.enabled) {
                console.log(`VoiceUtilities.Speech: Hands-free mode: Interrupted from ${source}. Deciding whether to restart.`);
                
                if (source.startsWith('input-') || source === 'mic-toggle-stop' || 
                    parent.state.handsFree.waitingForResponse) {
                    console.log("VoiceUtilities.Speech: Hands-free mode: No immediate restart due to interruption source or state.");
                } else {
                    console.log("VoiceUtilities.Speech: Hands-free mode: Scheduling safe restart after interruption.");
                    parent.handsFree.safeRestart(1000);
                }
            }
        },
        
        startCountdown: function() {
            const parent = VoiceUtilities;
            const srConfig = parent.config.speechRecognition || {};
            const duration = srConfig.countdownDuration || 3;
            
            if (!parent.dom.countdownTimer || !parent.dom.countdownText || !parent.dom.countdownProgress) return;
            
            console.log(`VoiceUtilities.Speech: Starting countdown timer for ${duration} seconds`);
            parent.dom.countdownTimer.classList.remove('hidden');
            parent.dom.countdownText.textContent = duration;
            
            const circumference = 2 * Math.PI * 45; // Radius 45
            parent.dom.countdownProgress.style.strokeDasharray = circumference;
            
            let countdown = duration;
            const interval = 1000;
            
            let timer = setInterval(() => {
                countdown--;
                parent.dom.countdownText.textContent = countdown;
                const progressOffset = circumference * (countdown / duration);
                parent.dom.countdownProgress.style.strokeDashoffset = progressOffset;
                
                if (countdown <= 0) {
                    clearInterval(timer);
                    this.stopCountdown();
                    console.log("VoiceUtilities.Speech: Countdown timer ended.");
                }
            }, interval);
            
            // Initialize progress bar
            const initialOffset = circumference * ((duration - 1) / duration);
            parent.dom.countdownProgress.style.transition = 'stroke-dashoffset 1s linear';
            parent.dom.countdownProgress.style.strokeDashoffset = initialOffset;
        },
        
        stopCountdown: function() {
            const parent = VoiceUtilities;
            
            if (!parent.dom.countdownTimer) return;
            
            parent.dom.countdownTimer.classList.add('hidden');
            parent.dom.countdownText.textContent = '';
            
            if (parent.dom.countdownProgress) {
                parent.dom.countdownProgress.style.transition = 'none';
                parent.dom.countdownProgress.style.strokeDashoffset = 0;
            }
            
            console.log("VoiceUtilities.Speech: Countdown timer stopped/hidden.");
        }
    },
    
    // ======================
    // HANDS-FREE MODE SUBSYSTEM
    // ======================
    
    handsFree: {
        setup: function() {
            const parent = VoiceUtilities;
            
            let voiceOptionsContainer = document.querySelector('.voice-options');
            
            if (!voiceOptionsContainer) {
                voiceOptionsContainer = this.createVoiceOptionsContainer();
            }
            
            parent.dom.voiceOptionsContainer = voiceOptionsContainer;
            parent.dom.handsFreeModeToggle = document.getElementById('handsFreeModeToggle');
            
            if (parent.dom.handsFreeModeToggle) {
                parent.dom.handsFreeModeToggle.addEventListener('change', (event) => {
                    parent.state.handsFree.enabled = event.target.checked;
                    console.log(`VoiceUtilities.HandsFree: Mode ${parent.state.handsFree.enabled ? 'enabled' : 'disabled'}`);
                    
                    this.handleToggleChange();
                });
            }
        },
        
        createVoiceOptionsContainer: function() {
            const parent = VoiceUtilities;
            const voiceOptionsContainer = document.createElement('div');
            voiceOptionsContainer.className = 'voice-options';
            
            const handsFreeToggleLabel = document.createElement('label');
            handsFreeToggleLabel.className = 'hands-free-toggle-container';
            handsFreeToggleLabel.setAttribute('for', 'handsFreeModeToggle');
            handsFreeToggleLabel.innerHTML = `
                <input type="checkbox" id="handsFreeModeToggle">
                <span class="hands-free-label">Hands-Free</span>
            `;
            
            voiceOptionsContainer.appendChild(handsFreeToggleLabel);
            
            // Insert before microphone button
            if (parent.dom.micToggleButton?.parentNode) {
                parent.dom.micToggleButton.parentNode.insertBefore(
                    voiceOptionsContainer,
                    parent.dom.micToggleButton
                );
            } else if (parent.dom.userInput?.parentNode) {
                parent.dom.userInput.parentNode.insertBefore(
                    voiceOptionsContainer, 
                    parent.dom.userInput.nextSibling
                );
            }
            
            return voiceOptionsContainer;
        },
        
        handleToggleChange: function() {
            const parent = VoiceUtilities;
            
            if (parent.state.handsFree.enabled && !parent.state.speech.isRecognizing && 
                !parent.state.handsFree.waitingForResponse) {
                console.log("VoiceUtilities.HandsFree: Mode enabled, initiating recognition");
                parent.speech.start();
            } else if (!parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.HandsFree: Mode disabled, stopping recognition");
                if (parent.state.speech.isRecognizing) {
                    parent.speech.stop();
                }
                if (parent.state.handsFree.pendingRecognitionRestart) {
                    clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                    parent.state.handsFree.pendingRecognitionRestart = null;
                }
            }
        },
        
        safeRestart: function(delay) {
            const parent = VoiceUtilities;
            
            if (parent.state.handsFree.pendingRecognitionRestart) {
                clearTimeout(parent.state.handsFree.pendingRecognitionRestart);
                parent.state.handsFree.pendingRecognitionRestart = null;
            }
            
            if (!parent.state.handsFree.enabled) {
                console.log("VoiceUtilities.HandsFree: safeRestart: Hands-free mode not enabled, skipping.");
                return;
            }
            
            const srConfig = parent.config.speechRecognition || {};
            const effectiveDelay = delay || srConfig.handsFreeModeDelay || 1500;
            console.log(`VoiceUtilities.HandsFree: Scheduling safe restart after ${effectiveDelay}ms`);
            
            parent.state.handsFree.pendingRecognitionRestart = setTimeout(() => {
                console.log("VoiceUtilities.HandsFree: Executing scheduled safe restart");
                parent.state.handsFree.pendingRecognitionRestart = null;
                
                // Check conditions before starting
                if (this.canRestart()) {
                    console.log("VoiceUtilities.HandsFree: Conditions met for safe restart.");
                    parent.speech.start();
                } else {
                    console.log("VoiceUtilities.HandsFree: Safe restart conditions not met.");
                    this.logRestartConditions();
                }
            }, effectiveDelay);
        },
        
        canRestart: function() {
            const parent = VoiceUtilities;

            // --- FIX for stuck tts.isSpeaking flag ---
            if (parent.state.tts.isSpeaking && 
                !(window.speechSynthesis?.speaking) && 
                !(window.speechSynthesis?.pending)) {
                console.warn("VoiceUtilities.HandsFree.canRestart: tts.isSpeaking was true but synthesis is not active. Resetting flag.");
                parent.state.tts.isSpeaking = false;
                // Optionally, if a ttsEnd was missed, this could trigger its logic,
                // but be cautious of causing unintended loops. For now, just correcting the flag.
                // parent.callbacks.trigger('ttsEnd'); 
            }
            // --- END FIX ---

            return parent.state.handsFree.enabled && 
                   !parent.state.speech.isRecognizing && 
                   !parent.state.tts.isSpeaking && 
                   !(window.speechSynthesis?.speaking) && 
                   !(window.speechSynthesis?.pending);
        },
        
        logRestartConditions: function() {
            const parent = VoiceUtilities;
            console.log(`  - Hands-free Enabled: ${parent.state.handsFree.enabled}`);
            console.log(`  - Is Recognizing: ${parent.state.speech.isRecognizing}`);
            console.log(`  - TTS Is Speaking Flag: ${parent.state.tts.isSpeaking}`);
            console.log(`  - Browser Synth Speaking: ${window.speechSynthesis?.speaking}`);
            console.log(`  - Browser Synth Pending: ${window.speechSynthesis?.pending}`);
        }
    },
    
    // =================
    // SHARED UTILITIES
    // =================
    
    shared: {
        // User interaction handler for autoplay
        handleUserInteraction: function() {
            const parent = VoiceUtilities;
            if (!parent.state.sound.userInteracted) {
                parent.state.sound.userInteracted = true;
                console.log("VoiceUtilities: User interacted, autoplay now allowed.");
            }
        }
    },
    
    // Helper methods for button state management
    disableButton: function(button, hide = false) {
        if (!button) return;
        
        button.classList.remove('active');
        button.classList.add('disabled');
        if (hide) button.style.display = 'none';
        button.setAttribute('aria-disabled', 'true');
        button.disabled = true;
    },
    
    enableButton: function(button, isActive, options) {
        button.classList.remove('disabled');
        button.style.display = '';
        button.setAttribute('aria-disabled', 'false');
        button.disabled = false;
        
        if (isActive) {
            button.classList.add('active');
            button.textContent = options.activeIcon;
            button.setAttribute('title', options.activeTitle);
        } else {
            button.classList.remove('active');
            button.textContent = options.inactiveIcon;
            button.setAttribute('title', options.inactiveTitle);
        }
    },
    
    updateButtonForInactiveAddon: function(button, featureName, icon) {
        button.classList.remove('active');
        button.classList.add('disabled');
        button.style.display = '';
        button.textContent = icon;
        button.setAttribute('title', `${featureName} unavailable (Voice Addon inactive)`);
        button.setAttribute('aria-disabled', 'true');
        button.disabled = true;
    },
    
    resetState: function(stateObject, newValues) {
        Object.keys(newValues).forEach(key => {
            stateObject[key] = newValues[key];
        });
    }
};

// Ensure VoiceUtilities is globally available
if (typeof window !== 'undefined') {
    window.VoiceUtilities = VoiceUtilities;
}