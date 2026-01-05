/**
 * ==============================================================================================
 * Left Panel 7 - Simple Video Player (With Sound & Delayed Start)
 * ==============================================================================================
 *
 * This panel displays and autoplays a specific video file (`cat1.mp4`) responsively WITH SOUND.
 * It loops indefinitely without showing controls.
 * Includes a configurable delay before playback starts after the panel is opened.
 * Autoplay with sound relies on prior user interaction with the site.
 * Conforms to the established framework structure.
 * Stops playback immediately when the panel is closed or deactivated.
 * ADDED: A safe message area for AI overlays! Meow!
 *
 * @version 1.2.0 - Added safe message overlay area.
 *                 Implemented configurable playback delay and improved play/stop logic.
 *                 Ensured playback starts only when panel is active and stops on deactivate/cleanup.
 */

(function() {
    // --- Configuration ---
    const PLAYBACK_DELAY_MS = 2000; // Default delay in milliseconds (2 seconds)
    const ENABLE_PLAYBACK_DELAY = true; // Set to false to disable the delay

    // --- Component Definition ---
    const component = {
        id: 'left-panel-7',

        // DOM references
        dom: {
            content: null,      // Reference to the main content div for this panel
            panelContainer: null, // Container for the panel's elements
            videoElement: null,    // Reference to the video element
            aiMessageDiv: null // MEOW! Our new message spot!
        },

        // Component state
        state: {
            videoSource: 'cat1.mp4',         // Source file for the video
            playbackDelayMs: PLAYBACK_DELAY_MS, // Delay before playback starts
            enablePlaybackDelay: ENABLE_PLAYBACK_DELAY // Toggle for the delay feature
        },

        // Internal properties
        playbackTimeoutId: null,        // Stores the ID of the setTimeout for delayed playback
        panelToggleListenerId: null, // Stores the ID for the framework event listener

        /**
         * Initialize the component
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);

            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found. Panel cannot be initialized. Meow... sad.`);
                return;
            }

            this.renderContent();

            this.panelToggleListenerId = Framework.on('panelToggle', this.handlePanelToggle.bind(this));

            console.log(`[${this.id}] Component initialized! Meow! Playback delay enabled: ${this.state.enablePlaybackDelay}, Duration: ${this.state.playbackDelayMs}ms.`);
        },

        /**
         * Render component content (Video element creation and AI message placeholder)
         */
        renderContent: function() {
            if (!this.dom.content) {
                console.error(`[${this.id}] Cannot render content: Main content element is missing. So un-meow.`);
                return;
            }

            this.dom.content.innerHTML = ''; // Clear existing content

            const panelContainer = document.createElement('div');
            panelContainer.className = 'video-panel-container';
            this.dom.panelContainer = panelContainer;

            const videoElement = document.createElement('video');
            videoElement.className = 'panel-video-player';
            videoElement.src = this.state.videoSource;
            videoElement.loop = true;
            videoElement.muted = false;
            videoElement.playsInline = true;
            videoElement.preload = 'auto';
            videoElement.textContent = 'Your browser does not support the video tag. Meow-ouch!';
            this.dom.videoElement = videoElement;

            panelContainer.appendChild(videoElement);

            // *** MEOW! HERE'S THE NEW MESSAGE SPOT FOR THE AI! ***
            const aiMessagePlaceholder = document.createElement('div');
            aiMessagePlaceholder.id = 'left-panel-7-ai-message'; // Specific ID for AI to target
            aiMessagePlaceholder.style.position = 'absolute';
            aiMessagePlaceholder.style.top = '10px';
            aiMessagePlaceholder.style.left = '10px';
            aiMessagePlaceholder.style.right = '10px';
            aiMessagePlaceholder.style.zIndex = '10'; // Above video, purrfect!
            aiMessagePlaceholder.style.color = 'white';
            aiMessagePlaceholder.style.textAlign = 'center';
            aiMessagePlaceholder.style.padding = '15px';
            aiMessagePlaceholder.style.backgroundColor = 'rgba(0,0,0,0.6)';
            aiMessagePlaceholder.style.borderRadius = '8px';
            aiMessagePlaceholder.style.display = 'none'; // Initially hidden, like a shy kitty
            this.dom.aiMessageDiv = aiMessagePlaceholder; // Save reference, meow!
            panelContainer.appendChild(aiMessagePlaceholder);
            // *** END NEW MEOW-NESS ***

            this.dom.content.appendChild(panelContainer);

            this.addStyles();
        },

        /**
         * Handles framework 'panelToggle' events to manage video playback.
         * @param {object} data - Event data containing { panelId, active }
         */
        handlePanelToggle: function(data) {
            if (data.panelId === this.id) {
                if (data.active) {
                    console.log(`[${this.id}] Panel activated. Meow! Time for video!`);
                    if (this.playbackTimeoutId) {
                        clearTimeout(this.playbackTimeoutId);
                        this.playbackTimeoutId = null;
                    }

                    // MEOW! Hide AI message overlay when panel opens (in case it was left visible)
                    if (this.dom.aiMessageDiv) {
                        this.dom.aiMessageDiv.style.display = 'none';
                        this.dom.aiMessageDiv.innerHTML = ''; // Clear old messages
                    }

                    if (this.state.enablePlaybackDelay && this.state.playbackDelayMs > 0) {
                        console.log(`[${this.id}] Scheduling playback start in ${this.state.playbackDelayMs}ms. Wait for it... meow.`);
                        this.playbackTimeoutId = setTimeout(() => {
                            this.playbackTimeoutId = null;
                            this.startPlayback();
                        }, this.state.playbackDelayMs);
                    } else {
                        console.log(`[${this.id}] Starting playback immediately (delay disabled). Go, kitty, go!`);
                        this.startPlayback();
                    }
                } else {
                    console.log(`[${this.id}] Panel deactivated. Video nap time. Zzzz...`);
                    if (this.playbackTimeoutId) {
                        clearTimeout(this.playbackTimeoutId);
                        this.playbackTimeoutId = null;
                        console.log(`[${this.id}] Cancelled pending playback start. Good kitty.`);
                    }
                    this.stopPlayback();

                    // MEOW! Also hide AI message overlay when panel closes
                    if (this.dom.aiMessageDiv) {
                        this.dom.aiMessageDiv.style.display = 'none';
                        this.dom.aiMessageDiv.innerHTML = '';
                    }
                }
            }
        },

        /**
         * Starts video playback, handling potential browser errors.
         */
        startPlayback: function() {
            if (this.dom.videoElement) {
                console.log(`[${this.id}] Attempting to play video... Meow meow!`);
                const playPromise = this.dom.videoElement.play();

                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log(`[${this.id}] Video playback started successfully! Purrrr!`);
                    }).catch(error => {
                        console.error(`[${this.id}] Video playback failed. Hiss! Error:`, error);
                         if(this.dom.panelContainer) {
                             this.dom.panelContainer.style.outline = "2px solid orange";
                             setTimeout(() => {
                                if (this.dom.panelContainer) this.dom.panelContainer.style.outline = "none";
                             }, 3000);
                         }
                    });
                } else {
                     console.log(`[${this.id}] Browser returned undefined for play() promise. Old kitty browser? Play initiated.`);
                 }
            } else {
                console.warn(`[${this.id}] Cannot start playback: Video element not found. Where'd the video go? Meow?`);
            }
        },

        /**
         * Stops video playback immediately and resets state if necessary.
         */
        stopPlayback: function() {
            if (this.dom.videoElement) {
                if (!this.dom.videoElement.paused) {
                    this.dom.videoElement.pause();
                    console.log(`[${this.id}] Video playback paused. Kitty is sleeping.`);
                }
            }
        },

        /**
         * Add component-specific styles dynamically
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .${this.id}-content {
                    height: 100%; display: flex; padding: 0; margin: 0;
                    overflow: hidden; background-color: #000;
                }
                .video-panel-container {
                    width: 100%; height: 100%; display: flex;
                    justify-content: center; align-items: center;
                    overflow: hidden; background-color: black;
                    position: relative; /* MEOW! Needed for absolute positioned message overlay */
                }
                .panel-video-player {
                    display: block; width: 100%; height: 100%;
                    object-fit: cover;
                }
                /* Styles for #left-panel-7-ai-message are applied inline in renderContent or by AI JS */
            `;
            document.head.appendChild(style);
        },

        /**
         * Clean up component resources when the panel is closed or replaced
         */
        cleanup: function() {
            console.log(`[${this.id}] Cleaning up component... Goodnight, kitty panel.`);

            if (this.panelToggleListenerId) {
                Framework.off('panelToggle', this.panelToggleListenerId);
                this.panelToggleListenerId = null;
                console.log(`[${this.id}] Unsubscribed from panelToggle event. Meow.`);
            }

            if (this.playbackTimeoutId) {
                clearTimeout(this.playbackTimeoutId);
                this.playbackTimeoutId = null;
                console.log(`[${this.id}] Cleared pending playback timeout during cleanup. All done!`);
            }

            if (this.dom.videoElement) {
                this.stopPlayback();
                this.dom.videoElement.src = '';
                this.dom.videoElement.removeAttribute('src');
                this.dom.videoElement.load();
                this.dom.videoElement.remove();
                console.log(`[${this.id}] Video element stopped and removed. Bye bye, video!`);
            }
            // MEOW! Clean up the AI message div too!
            if (this.dom.aiMessageDiv) {
                this.dom.aiMessageDiv.remove();
            }
            if (this.dom.panelContainer) {
                this.dom.panelContainer.remove();
            }
            if (this.dom.content) {
                this.dom.content.innerHTML = '';
            }
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            this.dom = { content: null, panelContainer: null, videoElement: null, aiMessageDiv: null };
            console.log(`[${this.id}] Component cleaned up. Purrrr.`);
        }
    };

    if (typeof Framework !== 'undefined' && typeof Framework.registerComponent === 'function') {
        Framework.registerComponent(component.id, component);
    } else {
        console.error(`[${this.id}] Framework not found or registerComponent is not a function. Sad meow.`);
    }
})();