/**
 * ==========================
 * M0dular Panel Framework - Configuration System
 * ==========================
 *
 * This centralized configuration file defines all panels, layouts, and system settings.
 * Each section is clearly documented for easy customization.
 *
 * @version 2.1.6 - Added Sound System configuration with optional cleanuser.txt support
 * @author Original developer with enhancements by Claude & User Corrections & Gemini Fixes
 */

const CONFIG = {
    /**
     * ===== APPLICATION METADATA =====
     * General information about the application
     */
    app: {
        name: 'M0dular Action Interface',
        version: '2.1.6',
        description: 'A modular panel-based interface for controlling AI actions',
        theme: {
            primaryColor: '#4a76a8',
            secondaryColor: '#f0f8ff',
            textColor: '#333333',
            backgroundColor: '#f5f5f5'
        }
    },

    /**
     * ===== LAYOUT CONFIGURATION =====
     * Controls dimensions and behavior of the four main panel areas.
     */
    areas: {
        top: {
            id: 'topArea',
            togglesId: 'topToggles',
            multipleActive: true,
            maxHeight: '40%',
            defaultHeight: '34px'
        },
        bottom: {
            id: 'bottomArea',
            togglesId: 'bottomToggles',
            multipleActive: true,
            maxHeight: '40%',
            defaultHeight: '34px'
        },
        left: {
            id: 'leftArea',
            togglesId: 'leftToggles',
            multipleActive: false, // KEEP THIS FALSE FOR SIDEBARS
            maxWidth: '300px',
            defaultWidth: '0'
        },
        right: {
            id: 'rightArea',
            togglesId: 'rightToggles',
            multipleActive: false, // KEEP THIS FALSE FOR SIDEBARS
            maxWidth: '300px',
            defaultWidth: '0'
        }
    },

    /**
     * ===== PANEL DEFINITIONS =====
     * Each panel needs:
     * - area: Which container the panel belongs to (top, bottom, left, right)
     * - title: Display name shown in the panel header
     * - component: Path to the JS file containing the panel implementation
     * - defaultActive: Whether the panel is open by default
     * Optional:
     * - isUtility: true - If the component just adds behavior to the toggle, no panel DOM is created.
     * - requiresLvl3: true - Requires 'lvl3' action to be active
     */
    panels: {
        // ===== TOP PANELS =====
        ...createPanelGroup('top', [
            {
                id: 'top-panel-1',
                title: 'Commands',
                component: 'components/top-panel-1.js',
                defaultActive: false,
                description: 'Displays available system commands'
            },
            {
                id: 'top-panel-2',
                title: 'Actions',
                component: 'components/top-panel-2.js',
                defaultActive: false,
                description: 'Lists all available actions'
            },
            {
                id: 'top-panel-3',
                title: 'Active Actions',
                component: 'components/top-panel-3.js',
                defaultActive: false,
                description: 'Shows currently running actions'
            },
            {
                id: 'top-panel-4',
                title: 'Add Your AI (API)',
                component: 'components/top-panel-4.js',
                defaultActive: false,
                description: 'Configure external AI API integration'
            },
            {
                id: 'top-panel-5',
                title: 'Core Manager',
                component: 'components/top-panel-5.js',
                defaultActive: false,
                description: 'Manage core action settings and configuration'
            },
            {
                id: 'top-panel-6',
                title: 'Filter Controls',
                component: 'components/top-panel-6.js',
                defaultActive: false,
                description: 'Control and configure filter action behavior'
            },
            {
                id: 'top-panel-7',
                title: 'Emotions Tracker',
                component: 'components/top-panel-7.js',
                defaultActive: false,
                description: 'Track and visualize conversation emotions using the emotions action (Priority 9).'
            },
            {
                id: 'top-panel-8',
                title: 'Focus Controls',
                component: 'components/top-panel-8.js',
                defaultActive: false,
                description: 'Controls for the focus.py prompt perturbation system'
            },
            {
                id: 'top-panel-9',
                title: 'Web Conversation Mode',
                component: 'components/top-panel-9.js',
                defaultActive: false,
                description: 'Toggle conversation-only mode for web interface - only shows User and AI messages'
            },
            {
                id: 'top-panel-10',
                title: 'CS Surf Game',
                component: 'components/top-panel-10.js',
                defaultActive: false,
                description: 'Counter-Strike style surfing game with procedural map generation'
            },
            {
                id: 'top-panel-11',
                title: 'Lore Data',
                component: 'components/top-panel-11.js',
                defaultActive: false,
                description: 'View and search world-building lore data with auto-refresh'
            }
        ]),

        // ===== BOTTOM PANELS =====
        ...createPanelGroup('bottom', [
            {
                id: 'bottom-panel-1',
                title: 'Memory Manager',
                component: 'components/bottom-panel-1.js',
                defaultActive: false,
                description: 'View and manage memory data'
            },
            {
                id: 'bottom-panel-2',
                title: 'Server Health',
                component: 'components/bottom-panel-2.js',
                defaultActive: false,
                description: 'Monitor system performance metrics'
            },
            {
                id: 'bottom-panel-3',
                title: 'Control Panel',
                component: 'components/bottom-panel-3.js',
                defaultActive: false,
                description: 'Control panel for common commands'
            },
            {
                id: 'bottom-panel-4',
                title: 'Preprompts',
                component: 'components/bottom-panel-4.js',
                defaultActive: false,
                description: 'Manage and use prompt templates'
            },
            {
                id: 'bottom-panel-5',
                title: 'Project Details',
                component: 'components/bottom-panel-5.js',
                defaultActive: false,
                description: 'Shows project file summary and details, plus AI conversation info'
            },
            {
                id: 'bottom-panel-6',
                title: 'Dirt Action Controls',
                component: 'components/bottom-panel-6.js',
                defaultActive: false,
                description: 'Control the "dirt" style action (Priority 9).'
            },
            {
                id: 'bottom-panel-7',
                title: 'Dynamic Persona (X) Controls',
                component: 'components/bottom-panel-7.js',
                defaultActive: false,
                description: 'Control the "x" dynamic persona action (Priority 5).'
            },
            {
                id: 'bottom-panel-8',
                title: 'SS Translator',
                component: 'components/bottom-panel-8.js',
                defaultActive: false,
                description: 'Translate Silent-Structure patterns <-> Natural Language'
            }
        ]),

        // ===== LEFT PANELS =====
        ...createPanelGroup('left', [
            {
                id: 'left-panel-1',
                title: 'Load/Edit Prompt',
                component: 'components/left-panel-1.js',
                defaultActive: false,
                requiresLvl3: true,
                description: 'Load saved prompts & edit save.txt prompt (requires lvl3)'
            },
            {
                id: 'left-panel-2',
                title: 'Loopback',
                component: 'components/left-panel-2.js',
                defaultActive: false,
                description: 'AI self-prompting loop instructions'
            },
            {
                id: 'left-panel-3',
                title: 'Wikipedia',
                component: 'components/left-panel-3.js',
                defaultActive: false,
                description: 'Search and browse Wikipedia articles'
            },
            {
                id: 'left-panel-4',
                title: 'YouTube',
                component: 'components/left-panel-4.js',
                defaultActive: false,
                description: 'Search and watch YouTube videos'
            },
            {
                id: 'left-panel-5',
                title: 'Idea Incubator',
                component: 'components/left-panel-5.js',
                defaultActive: false,
                description: 'Review and track potential new addon ideas.'
            },
            {
                id: 'left-panel-6',
                title: 'Remote Connector',
                component: 'components/left-panel-6.js',
                defaultActive: false,
                description: 'Legacy remote file connector status and commands.'
            },
            {
                id: 'left-panel-7',
                title: 'Feline Companion',
                component: 'components/left-panel-7.js',
                defaultActive: false,
                description: 'Displays information about feline companions.'
            },
            {
                id: 'left-panel-8',
                title: 'Referrals',
                component: 'components/left-panel-8.js',
                defaultActive: false,
                description: 'Helpful resources we recommend'
            }
        ]),

        // ===== RIGHT PANELS =====
        ...createPanelGroup('right', [
            {
                id: 'right-panel-1',
                title: 'Persona',
                component: 'components/right-panel-1.js',
                defaultActive: false,
                description: 'Manage AI personas'
            },
            {
                id: 'right-panel-2',
                title: 'Theme',
                component: 'components/right-panel-2.js',
                defaultActive: false,
                description: 'Customize the interface appearance'
            },
            {
                id: 'right-panel-3',
                title: 'Partner Features',
                component: 'components/right-panel-3.js',
                defaultActive: false,
                description: 'Special features for partner site users (Opens Overlay)',
                isUtility: true
            },
            {
                id: 'right-panel-4',
                title: 'Back Button',
                component: 'components/right-panel-4.js',
                defaultActive: false,
                description: 'Submit "back" command to see AI\'s last reply',
                isUtility: true
            },
            {
                id: 'right-panel-5',
                title: 'Word Block',
                component: 'components/right-panel-5.js',
                defaultActive: false,
                description: 'Manage blocked words and censorship settings'
            },
            {
                id: 'right-panel-7',
                title: 'Restart Conversation',
                component: 'components/right-panel-7.js',
                defaultActive: false,
                isUtility: true,
                description: 'Sends "start key" command to reset the conversation.'
            }
        ])
    },

    /**
     * ===== API ENDPOINTS =====
     * Backend service endpoints for data retrieval and updates
     */
    api: {
        // Core endpoints
        logs: '/api/logs',
        commands: '/commands.json',
        actions: '/actions.json',
        activeActions: '/api/active_actions',
        submitInput: '/submit_input',
        agentTools: '/agent_tools.json',
        
        // API configuration
        updateApiKey: '/api/update_api_key',
        keyHistory: '/api/key_history',
        
        // Output files
        websiteOutput: '/website_output.txt',
        userClean: '/cleanuser.txt', // Optional, system works without it
        
        // Data endpoints
        memory: '/api/memory',
        youtubeList: '/api/youtube/list',
        wikipediaList: '/api/wikipedia/list',
        emotions: '/api/emotions',
        
        // Prompt/Persona endpoints
        prompts: '/api/prompts',
        promptContent: '/api/prompts/', // Needs name appended
        activePrompt: '/api/prompts/active',
        personas: '/api/personas',
        personaDetails: '/api/personas/', // Needs name appended
        activePersona: '/api/personas/active',
        
        // Save.txt/Context endpoints
        savePrompt: '/api/save_prompt',
        savedContexts: '/api/saved_contexts',
        savedContextContent: '/api/saved_contexts/', // Needs ID appended, then /content
        
        // Configuration endpoints
        blockedWords: '/api/blocked_words',
        apiConfig: '/api/config',
        mainConfig: '/api/main_config',
        controlOutput: '/control_output.json'
    },

    /**
     * ===== REFRESH INTERVALS =====
     * Polling intervals in milliseconds for data updates
     */
    refreshIntervals: {
        // Core polling
        logs: 2000,
        activeActions: 3000,
        
        // Data refresh
        commands: 60000,
        actions: 60000,
        memoryData: 30000,
        youtubeList: 60000,
        wikipediaList: 60000,
        promptList: 60000,
        personaList: 60000,
        
        // Real-time features
        ttsOutputCheck: 1500,
        soundCheck: 1000,
        
        // Configuration
        configPolling: 10000,
        controlOutputCheck: 2000
    },

    /**
     * ===== PERFORMANCE SETTINGS =====
     * Parameters that affect application performance
     */
    performance: {
        maxChatMessages: 100,
        debounceDelay: 250,
        maxPanelLoadAttempts: 3,
        useAnimations: true
    },

    /**
     * ===== TTS SETTINGS =====
     * Fine-tuning parameters for Text-to-Speech behavior
     */
    tts: {
        minimumDelay: 1000,
        voicePriority: null
        // Optional: rate: 1.0, pitch: 1.0
    },

    /**
     * ===== SPEECH RECOGNITION SETTINGS =====
     * Parameters for voice input behavior
     */
    speechRecognition: {
        countdownDuration: 3,
        language: 'en-US',
        continuous: false,
        interimResults: true,
        handsFreeModeDelay: 3000
    },

    /**
     * ===== SOUND SYSTEM SETTINGS =====
     * Parameters for background sound behavior
     */
    soundSystem: {
        enabled: true,
        defaultVolume: 0.5,
        maxSimultaneousSounds: 5,
        fadeOutDuration: 500 // Not implemented yet
    }
};

/**
 * Helper function to create panel groups with area assignment
 * @param {string} area - The area name (top, bottom, left, right)
 * @param {Array} panels - Array of panel configurations
 * @returns {Object} Panel configurations with area assigned
 */
function createPanelGroup(area, panels) {
    return panels.reduce((acc, panel) => {
        acc[panel.id] = { ...panel, area };
        return acc;
    }, {});
}