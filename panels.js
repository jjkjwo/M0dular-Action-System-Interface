/**
 * ========================
 * PANEL MANAGER MODULE - panels.js
 * ========================
 * Manages all panel-related functionality, decoupled from the main framework
 * Version 1.0.0
 * Load this BEFORE framework.js as framework depends on PanelManager
 */

class PanelManager {
    constructor(config, callbacks) {
        // Configuration
        this.config = config;
        this.callbacks = callbacks || {};
        
        // State management
        this.panelStates = {};
        this.lvl3Active = false;
        this.isMobile = false;
        this.isLandscape = false;
        
        // Event system
        this.events = {};
        
        // DOM cache
        this.dom = {};
        
        // Panel loading state
        this.loadedPanels = 0;
        this.totalPanels = 0;
    }

    // ===== INITIALIZATION =====
    init() {
        console.log('PanelManager: Initializing...');
        this.cacheDomReferences();
        this.detectDeviceState();
        this.createPanels();
        this.setupEventHandlers();
        this.applyInitialPanelStates();
        console.log('PanelManager: Initialization complete');
    }

    // ===== DOM MANAGEMENT =====
    cacheDomReferences() {
        // Panel areas
        Object.keys(this.config.areas).forEach(key => {
            const area = this.config.areas[key];
            if (area?.id) {
                this.dom[area.id] = document.getElementById(area.id);
            }
        });
        
        // Chat container for resize detection
        this.dom.chatContainer = document.getElementById('chatContainer');
        
        // Panel overlay
        this.dom.panelOverlay = document.getElementById('panelOverlay');
    }

    detectDeviceState() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const m = w <= 768;
        const l = w > h;
        
        this.isMobile = m;
        this.isLandscape = l;
        
        return { isMobile: m, isLandscape: l, width: w, height: h };
    }

    // ===== PANEL CREATION =====
    createPanels() {
        this.totalPanels = Object.keys(this.config.panels).length;
        Object.entries(this.config.panels).forEach(([id, cfg]) => {
            this.createPanel(id, cfg);
        });
    }

    createPanel(id, cfg) {
        // Handle utility panels (no visual panel, just behavior)
        if (cfg.isUtility) {
            this.setupUtilityPanel(id, cfg);
            return;
        }

        // Validate panel configuration
        if (!cfg?.area) {
            console.error(`PanelManager: Invalid panelConfig - Missing area for panel ID: ${id}`);
            return;
        }

        // Get area configuration
        const areaCfg = this.config.areas[cfg.area];
        if (!areaCfg) {
            console.error(`PanelManager: Invalid area key '${cfg.area}' for panel ${id}`);
            return;
        }

        const areaEl = this.dom[areaCfg.id];
        if (!areaEl) {
            console.error(`PanelManager: Area element with ID ${areaCfg.id} not found for panel ${id}`);
            return;
        }

        const container = areaEl.querySelector('.panel-container');
        if (!container) {
            console.error(`PanelManager: Panel container missing in area ${areaCfg.id} for panel ${id}`);
            return;
        }

        // Create panel DOM structure
        const el = this.createElement('div', {
            id,
            className: 'panel',
            role: 'region',
            'aria-label': cfg.title || 'Panel'
        });

        // Panel header
        const head = this.createElement('div', {
            className: 'panel-header',
            textContent: cfg.title || 'Panel'
        });

        // Panel content container
        const content = this.createElement('div', {
            className: 'panel-content',
            id: `${id}-content`
        });

        el.appendChild(head);
        el.appendChild(content);
        container.appendChild(el);

        // Setup toggle button
        this.setupToggleButton(id, cfg);

        // Initialize panel state
        this.panelStates[id] = {
            active: cfg.defaultActive || false,
            requiresLvl3: cfg.requiresLvl3 || false
        };
    }

    setupUtilityPanel(id, cfg) {
        const toggle = document.querySelector(`.panel-toggle[data-target="${id}"]`);
        if (toggle) {
            toggle.addEventListener('click', () => {
                console.log(`PanelManager: Utility toggle clicked: ${id}`);
                this.trigger('utilityToggleClicked', { panelId: id });
            });
        } else {
            console.warn(`PanelManager: Utility panel ${id} defined but toggle not found.`);
        }
    }

    setupToggleButton(id, cfg) {
        const toggle = document.querySelector(`.panel-toggle[data-target="${id}"]`);
        if (toggle) {
            Object.assign(toggle, {
                role: 'button',
                'aria-controls': id,
                'aria-expanded': 'false',
                title: `Toggle ${cfg.title || 'Panel'}`
            });
            toggle.addEventListener('click', () => this.togglePanel(id));
        } else {
            console.warn(`PanelManager: Toggle button for panel ${id} not found.`);
        }
    }

    // ===== PANEL STATE MANAGEMENT =====
    applyInitialPanelStates() {
        Object.entries(this.config.panels).forEach(([panelId, cfg]) => {
            if (cfg?.defaultActive) {
                this.activatePanelInitial(panelId, cfg);
            }

            if (cfg?.area) {
                const areaCfg = this.config.areas[cfg.area];
                if (areaCfg && this.dom[areaCfg.id]) {
                    this.updateAreaSize(cfg.area);
                }
            }
        });
        this.updateAllAreaSizes();
    }

    activatePanelInitial(panelId, config) {
        const el = document.getElementById(panelId);
        if (el) el.classList.add('active');

        const areaCfg = config.area ? this.config.areas[config.area] : null;
        if (areaCfg) {
            const areaEl = this.dom[areaCfg.id];
            if (areaEl) areaEl.classList.add('active');
        }

        const toggle = document.querySelector(`.panel-toggle[data-target="${panelId}"]`);
        if (toggle) {
            toggle.classList.add('active');
            toggle.setAttribute('aria-expanded', 'true');
        }
    }

    // ===== PANEL TOGGLING =====
    togglePanel(id) {
        const cfg = this.config.panels[id];
        if (!cfg) {
            console.warn(`PanelManager: Toggle failed - No configuration found for panel ID: ${id}`);
            return;
        }

        if (cfg.isUtility) {
            console.log(`PanelManager: Utility toggle ${id} activated (no visual panel change).`);
            return;
        }

        const areaKey = cfg.area;
        if (!areaKey) {
            console.warn(`PanelManager: Toggle failed - No area defined for panel: ${id}`);
            return;
        }

        const areaCfg = this.config.areas[areaKey];
        if (!areaCfg) {
            console.warn(`PanelManager: Toggle failed - Area configuration for '${areaKey}' not found.`);
            return;
        }

        const el = document.getElementById(id);
        if (!el) {
            console.error(`PanelManager: Toggle failed - Panel element with ID ${id} not found in DOM.`);
            return;
        }

        const toggle = document.querySelector(`.panel-toggle[data-target="${id}"]`);

        if (!this.panelStates[id]) {
            console.warn(`PanelManager: Toggle failed - State object for panel ${id} not found. Initializing.`);
            this.panelStates[id] = { active: false, requiresLvl3: cfg.requiresLvl3 || false };
        }

        // Check Lvl3 requirement
        if (cfg.requiresLvl3 && !this.lvl3Active) {
            if (this.callbacks.showToast) {
                this.callbacks.showToast(`Panel '${cfg.title || id}' requires Lvl3 Action to be active.`);
            }
            return;
        }

        const newState = !this.panelStates[id].active;

        // Handle single-active areas (sidebars)
        if (!areaCfg.multipleActive && newState) {
            this.deactivateOtherPanelsInArea(id, areaKey);
        }

        // Update panel state
        this.panelStates[id].active = newState;
        el.classList.toggle('active', newState);
        toggle?.classList.toggle('active', newState);
        toggle?.setAttribute('aria-expanded', newState.toString());

        console.log(`PanelManager: Panel ${id} toggled to ${newState ? 'active' : 'inactive'}.`);

        this.updateAreaSize(areaKey);
        this.trigger('panelToggle', { panelId: id, active: newState });

        // Call component lifecycle methods
        this.callPanelLifecycleMethod(id, newState ? 'onPanelOpen' : 'onPanelClose');
    }

    deactivateOtherPanelsInArea(currentId, areaKey) {
        Object.entries(this.panelStates).forEach(([otherId, state]) => {
            if (otherId !== currentId && state?.active) {
                const otherCfg = this.config.panels[otherId];
                if (otherCfg && otherCfg.area === areaKey) {
                    console.log(`PanelManager: Deactivating panel ${otherId} in single-active area ${areaKey}`);
                    this.deactivatePanel(otherId);
                }
            }
        });
    }

    deactivatePanel(id) {
        const el = document.getElementById(id);
        const toggle = document.querySelector(`.panel-toggle[data-target="${id}"]`);

        if (this.panelStates[id]?.active) {
            this.panelStates[id].active = false;
            el?.classList.remove('active');
            toggle?.classList.remove('active');
            toggle?.setAttribute('aria-expanded', 'false');
            console.log(`PanelManager: Panel ${id} explicitly deactivated.`);

            this.callPanelLifecycleMethod(id, 'onPanelClose');
            this.trigger('panelDeactivated', { panelId: id });
        } else {
            el?.classList.remove('active');
            toggle?.classList.remove('active');
            toggle?.setAttribute('aria-expanded', 'false');
        }
    }

    // ===== AREA SIZE MANAGEMENT =====
    updateAreaSize(key) {
        const cfg = this.config.areas[key];
        if (!cfg) {
            console.warn(`PanelManager: updateAreaSize - No area config found for key '${key}'`);
            return;
        }

        const el = this.dom[cfg.id];
        if (!el) {
            console.warn(`PanelManager: updateAreaSize - Area element not found for key '${key}'`);
            return;
        }

        // Check if any panel in this area is active
        const isAreaActive = Object.entries(this.panelStates).some(([panelId, state]) => {
            const panelCfg = this.config.panels[panelId];
            return panelCfg && panelCfg.area === key && state?.active;
        });

        const currentlyHasActiveClass = el.classList.contains('active');
        if (isAreaActive !== currentlyHasActiveClass) {
            el.classList.toggle('active', isAreaActive);
            console.log(`PanelManager: Area ${key} ${isAreaActive ? 'activated' : 'deactivated'}`);
            this.trigger('areaSizeChanged', { areaId: key, active: isAreaActive });
        }
    }

    updateAllAreaSizes() {
        console.log("PanelManager: Updating all area sizes based on panel states.");
        Object.keys(this.config.areas).forEach(key => {
            const cfg = this.config.areas[key];
            if (cfg && this.dom[cfg.id]) {
                this.updateAreaSize(key);
            }
        });
        console.log("PanelManager: Finished updating all area sizes.");
    }

    // ===== LVL3 MANAGEMENT =====
    setLvl3State(active) {
        if (this.lvl3Active !== active) {
            this.lvl3Active = active;
            console.log(`PanelManager: Lvl3 state changed to: ${active}`);
            
            if (!active) {
                this.closeLvl3RequiredPanels();
            }
        }
    }

    closeLvl3RequiredPanels() {
        Object.entries(this.panelStates).forEach(([panelId, state]) => {
            const panelConfig = this.config.panels[panelId];
            if (panelConfig?.requiresLvl3 && state?.active) {
                console.log(`PanelManager: Lvl3 deactivated, closing panel: ${panelId}`);
                this.deactivatePanel(panelId);
                if (panelConfig.area) {
                    this.updateAreaSize(panelConfig.area);
                }
            }
        });
    }

    // ===== LIFECYCLE METHODS =====
    callPanelLifecycleMethod(panelId, method) {
        const component = this.callbacks.getComponent ? this.callbacks.getComponent(panelId) : null;
        if (component && typeof component[method] === 'function') {
            try {
                component[method]();
            } catch (e) {
                console.error(`PanelManager: Error in ${method} for ${panelId}:`, e);
            }
        }
    }

    // ===== EVENT HANDLERS =====
    setupEventHandlers() {
        // Window resize handling
        this.setupResizeHandlers();
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', this.handleGlobalPanelToggleKey.bind(this));
    }

    setupResizeHandlers() {
        const handleResize = this.debounce(() => {
            console.log("PanelManager: Debounced resize event triggered.");
            const previousMobileState = this.isMobile;
            this.detectDeviceState();

            if (previousMobileState !== this.isMobile) {
                console.log("PanelManager: Mobile state changed, updating all area sizes.");
                this.updateAllAreaSizes();
            }
        }, 250, { leading: false });

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            console.log("PanelManager: Orientation change detected.");
            setTimeout(() => {
                console.log("PanelManager: Processing orientation change after delay.");
                this.detectDeviceState();
                this.updateAllAreaSizes();
                console.log("PanelManager: Orientation change processing complete.");
            }, 300);
        });
    }

    handleGlobalPanelToggleKey(event) {
        // Check if the key is '`' (backtick) and no input field is focused
        if (event.key === '`' && !this.isInputFocused(event)) {
            event.preventDefault();

            // Determine if any non-utility panel is currently open
            const anyPanelOpen = Object.entries(this.config.panels).some(([id, cfg]) =>
                cfg && !cfg.isUtility && this.panelStates[id]?.active
            );

            const action = anyPanelOpen ? "Closing" : "Opening";
            let actionCount = 0;
            let lvl3SkipCount = 0;

            // Iterate over all panel toggles
            document.querySelectorAll('.panel-toggle').forEach(toggle => {
                const panelId = toggle.dataset.target;
                if (!panelId) return;

                const cfg = this.config.panels[panelId];
                if (!cfg || cfg.isUtility) return;

                const isActive = this.panelStates[panelId]?.active;

                if ((anyPanelOpen && isActive) || (!anyPanelOpen && !isActive)) {
                    if (!anyPanelOpen && cfg.requiresLvl3 && !this.lvl3Active) {
                        lvl3SkipCount++;
                    } else {
                        toggle.click();
                        actionCount++;
                    }
                }
            });

            this.showGlobalToggleToast(action, actionCount, lvl3SkipCount, anyPanelOpen);
        }
    }

    isInputFocused(event) {
        const tag = event.target.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || event.target.isContentEditable;
    }

    showGlobalToggleToast(action, actionCount, lvl3SkipCount, anyPanelOpen) {
        if (!this.callbacks.showToast) return;

        let message = `${action} all eligible non-utility panels.`;

        if (actionCount > 0) {
            if (action === "Opening" && lvl3SkipCount > 0) {
                message = `Attempted to open panels. ${lvl3SkipCount} require(s) Lvl3 (inactive).`;
            }
            this.callbacks.showToast(message, 2500);
            console.log(`PanelManager: Global panel toggle: ${message}`);
        } else {
            if (anyPanelOpen && actionCount === 0) {
                this.callbacks.showToast("No non-utility panels needed to change state.", 2000);
            } else if (!anyPanelOpen && actionCount === 0 && lvl3SkipCount === 0) {
                this.callbacks.showToast("No eligible non-utility panels to open.", 2000);
            } else if (!anyPanelOpen && lvl3SkipCount > 0 && actionCount === 0) {
                this.callbacks.showToast(`Attempted to open panels. ${lvl3SkipCount} panel(s) require Lvl3 (inactive).`, 2500);
            }
        }
    }

    // ===== UTILITY METHODS =====
    createElement(tag, attrs = {}) {
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
    }

    debounce(func, wait, options = {}) {
        if (this.callbacks.debounce) {
            return this.callbacks.debounce(func, wait, options);
        }
        // Fallback simple debounce if not provided
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ===== EVENT SYSTEM =====
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    off(eventName, callback) {
        if (!this.events[eventName]) return;
        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    trigger(eventName, data = {}) {
        if (!this.events[eventName]) return;
        this.events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`PanelManager: Error in event handler for "${eventName}":`, error);
            }
        });
    }

    // ===== PUBLIC API =====
    getPanelState(panelId) {
        return this.panelStates[panelId] || null;
    }

    getAllPanelStates() {
        return { ...this.panelStates };
    }

    isAnyPanelActive(area = null) {
        return Object.entries(this.panelStates).some(([panelId, state]) => {
            if (!state?.active) return false;
            if (!area) return true;
            const panelCfg = this.config.panels[panelId];
            return panelCfg && panelCfg.area === area;
        });
    }
}

// Export for use in framework
if (typeof window !== 'undefined') {
    window.PanelManager = PanelManager;
}