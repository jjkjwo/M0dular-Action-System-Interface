/**
 * ==============================================================================================
 * Bottom Panel 2 - System Status Component (Optimized for Multi-Panel Layouts)
 * ==============================================================================================
 *
 * This panel provides comprehensive system health monitoring with visualizations that adapt to
 * available space. The bar chart displays historical values for each metric to help visualize
 * trends over time. All visualizations automatically adjust based on panel size.
 *
 * @version 4.2.7 - Changed 'Last Refresh' to 'Current' for the most recent data point
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-2',

        // DOM references
        dom: {
            content: null,
            statusContainer: null,
            chartContainer: null,
            detailsContainer: null,
            refreshButton: null,
            autoRefreshToggle: null,
            lastUpdateTime: null,
            loadingIndicator: null,
            errorMessage: null,
            metricsToggle: null,
            statusMetrics: {},
            sizeObserver: null, // ResizeObserver reference
            chartExplanation: null // Element for chart explanation
        },

        // Component state
        state: {
            status: {
                serverStatus: { value: 'Online', status: 'good', icon: '🟢', history: [], unit: '', description: 'Server operational status' },
                apiResponse: { value: '150ms', status: 'good', icon: '⚡', history: [], unit: 'ms', description: 'API request response time' },
                memoryUsage: { value: '75%', status: 'warning', icon: '🧠', history: [], unit: '%', description: 'System memory utilization' },
                cpuUsage: { value: '32%', status: 'good', icon: '⚙️', history: [], unit: '%', description: 'CPU utilization percentage' },
                diskSpace: { value: '89%', status: 'warning', icon: '💾', history: [], unit: '%', description: 'Storage space used' },
                errors24h: { value: '0', status: 'good', icon: '⚠️', history: [], unit: '', description: 'Error count in last 24 hours' }
            },
            isLoading: false,
            lastUpdate: null,
            autoRefresh: false,
            refreshInterval: null,
            refreshRate: 30000, // 30 seconds
            selectedMetric: 'cpuUsage',
            expandedViews: { // Not currently used for expanding, but for selection
                serverStatus: false,
                apiResponse: false,
                memoryUsage: false,
                cpuUsage: false,
                diskSpace: false,
                errors24h: false
            },
            metricSettings: {
                cpuUsage: {
                    warningThreshold: 60,
                    criticalThreshold: 80,
                    description: 'CPU usage above 60% may indicate high system load.'
                },
                memoryUsage: {
                    warningThreshold: 70,
                    criticalThreshold: 85,
                    description: 'Memory usage above 70% may affect system performance.'
                },
                apiResponse: {
                    warningThreshold: 200,
                    criticalThreshold: 500,
                    description: 'Response times above 200ms may indicate API slowdown.'
                },
                diskSpace: {
                    warningThreshold: 80,
                    criticalThreshold: 90,
                    description: 'Disk usage above 80% may require cleanup.'
                },
                errors24h: {
                    warningThreshold: 5,
                    criticalThreshold: 20,
                    description: 'Error count indicates system stability issues.'
                }
            },
            historyLimit: 8,
            subscriptions: [],
            compactMode: false,
            ultraCompactMode: false,
            tooltipsEnabled: true,
            compactThreshold: 350,
            ultraCompactThreshold: 250,
            panelWidth: 0,
            panelHeight: 0,
            currentChartScaleMax: 100
        },

        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element for ${this.id} not found`);
                return;
            }
            this.renderContent();
            this.setupEventListeners();
            this.setupResizeObserver();
            this.state.lastUpdate = new Date();
            this.updateLastUpdateTime();
            this.refreshStatus();
            console.log(`[${this.id}] Initialization complete.`);
        },

        setupEventListeners: function() {
            if (this.dom.refreshButton) {
                this.dom.refreshButton.addEventListener('click', () => this.refreshStatus(true));
            }
            if (this.dom.autoRefreshToggle) {
                this.dom.autoRefreshToggle.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));
            }
            if (this.dom.metricsToggle) {
                this.dom.metricsToggle.querySelectorAll('.metric-button').forEach(button => {
                    button.addEventListener('click', (e) => this.selectMetric(e.currentTarget.getAttribute('data-metric')));
                });
            }
        },

        setupResizeObserver: function() {
            if (window.ResizeObserver && this.dom.content) {
                if (this.dom.sizeObserver) this.dom.sizeObserver.disconnect();
                this.dom.sizeObserver = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        if (entry.target === this.dom.content) {
                            const { width, height } = entry.contentRect;
                            if (Math.abs(width - this.state.panelWidth) > 5 || Math.abs(height - this.state.panelHeight) > 5) {
                                this.state.panelWidth = width;
                                this.state.panelHeight = height;
                                this.checkPanelSize();
                            }
                        }
                    }
                });
                this.dom.sizeObserver.observe(this.dom.content);
            } else {
                // Fallback (store debounced function for removal in cleanup)
                this.debouncedCheckPanelSizeListener = this.debounce(() => {
                    if (this.dom.content) {
                        this.state.panelWidth = this.dom.content.clientWidth;
                        this.state.panelHeight = this.dom.content.clientHeight;
                        this.checkPanelSize();
                    }
                }, 250);
                window.addEventListener('resize', this.debouncedCheckPanelSizeListener);
            }
        },

        debounce: function(func, wait) {
            let timeout;
            return function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), wait);
            };
        },

        checkPanelSize: function() {
            if (!this.dom.content) return;
            const width = this.state.panelWidth || this.dom.content.clientWidth;
            const shouldBeCompact = width < this.state.compactThreshold;
            const shouldBeUltraCompact = width < this.state.ultraCompactThreshold;

            if (this.state.compactMode !== shouldBeCompact || this.state.ultraCompactMode !== shouldBeUltraCompact) {
                this.state.compactMode = shouldBeCompact;
                this.state.ultraCompactMode = shouldBeUltraCompact;
                this.updateLayoutForSize();
                this.updateChart();
            }
        },

        updateLayoutForSize: function() {
            const { compactMode, ultraCompactMode } = this.state;
            if (this.dom.statusContainer) {
                this.dom.statusContainer.className = `status-container ${ultraCompactMode ? 'ultra-compact' : compactMode ? 'compact' : ''}`;
            }
            if (this.dom.metricsToggle) {
                this.dom.metricsToggle.className = `metrics-toggle ${ultraCompactMode ? 'ultra-compact' : compactMode ? 'compact' : ''}`;
                this.dom.metricsToggle.querySelectorAll('.metric-button .metric-text').forEach(span => {
                    span.style.display = ultraCompactMode ? 'none' : '';
                });
            }
            if (this.dom.chartContainer) {
                this.dom.chartContainer.style.height = ultraCompactMode ? '100px' : compactMode ? '130px' : '180px';
            }
            if (this.dom.chartExplanation) {
                this.dom.chartExplanation.style.display = ultraCompactMode ? 'none' : 'block';
                 if(!ultraCompactMode) this.updateChartExplanation();
            }
            const panelHeader = this.dom.content.querySelector('.panel-header-info');
            if (panelHeader) {
                panelHeader.classList.toggle('compact-header', compactMode && !ultraCompactMode);
                panelHeader.classList.toggle('ultra-compact-header', ultraCompactMode);
            }
            this.renderStatus(); // Re-render status items for potential layout changes within them
        },

        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* General panel styles */
                .system-status-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background-color: #fcfcfc; }
                .panel-header-info { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: #f5f5f5; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: var(--color-primary-dark); }
                .panel-header-info.compact-header { padding: 5px 8px; }
                .panel-header-info.ultra-compact-header { padding: 3px 6px; }
                .header-title { display: flex; align-items: center; gap: 6px; font-size: 13px; }
                .compact-header .header-title { font-size: 12px; }
                .ultra-compact-header .header-title { font-size: 11px; }
                .auto-refresh-container { display: flex; align-items: center; gap: 4px; }
                .toggle-switch { position: relative; display: inline-block; width: 36px; height: 18px; }
                .compact-header .toggle-switch { width: 30px; height: 16px; }
                .ultra-compact-header .toggle-switch { width: 26px; height: 14px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
                .toggle-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
                .compact-header .toggle-slider:before { height: 12px; width: 12px; }
                .ultra-compact-header .toggle-slider:before { height: 10px; width: 10px; }
                input:checked + .toggle-slider { background-color: var(--color-primary); }
                input:checked + .toggle-slider:before { transform: translateX(18px); }
                .compact-header input:checked + .toggle-slider:before { transform: translateX(14px); }
                .ultra-compact-header input:checked + .toggle-slider:before { transform: translateX(12px); }
                .auto-refresh-label { font-size: 11px; color: var(--color-text); user-select: none; }
                .compact-header .auto-refresh-label { font-size: 10px; }
                .ultra-compact-header .auto-refresh-label { display: none; }
                .refresh-button { display: flex; align-items: center; padding: 4px 8px; background-color: var(--color-primary); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; transition: background-color 0.2s; }
                .compact-header .refresh-button { padding: 3px 6px; font-size: 11px; }
                .ultra-compact-header .refresh-button { padding: 2px 5px; font-size: 10px; }
                .ultra-compact-header .refresh-text { display: none; }
                .refresh-button:hover { background-color: var(--color-primary-dark); }
                .refresh-button:disabled { background-color: #bdbdbd; cursor: not-allowed; }
                .last-update-time { font-size: 11px; color: var(--color-text-light); font-weight: normal; }
                .compact-header .last-update-time { font-size: 10px; }
                .ultra-compact-header .last-update-time { display: none; }
                .metrics-toggle { display: flex; padding: 8px 10px; background-color: #f9f9f9; border-bottom: 1px solid #e0e0e0; overflow-x: auto; gap: 8px; scrollbar-width: thin; }
                .metrics-toggle.compact { padding: 5px 8px; gap: 5px; }
                .metrics-toggle.ultra-compact { padding: 3px 6px; gap: 3px; }
                .metrics-toggle::-webkit-scrollbar { height: 3px; }
                .metrics-toggle::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.2); border-radius: 3px; }
                .metric-button { flex: 0 0 auto; min-width: 70px; padding: 5px 8px; display: flex; align-items: center; justify-content: center; gap: 4px; background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap; transition: all 0.2s; }
                .compact .metric-button { min-width: 60px; padding: 4px 7px; font-size: 11px; }
                .ultra-compact .metric-button { min-width: auto; padding: 3px 6px; font-size: 10px; }
                .ultra-compact .metric-button .metric-text { display: none; }
                .metric-button:hover { background-color: #e3f2fd; border-color: #bbdefb; }
                .metric-button.active { background-color: var(--color-primary); color: white; border-color: var(--color-primary-dark); font-weight: bold; }
                .chart-explanation { font-size: 11px; color: #666; text-align: center; padding: 0 10px 5px 10px; background-color: #fff; }
                .compact .chart-explanation { font-size: 10px; padding: 0 8px 3px 8px; }
                .ultra-compact .chart-explanation { display:none; }
                .status-container { flex: 1; overflow-y: auto; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
                .status-container.compact { padding: 6px 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
                .status-container.ultra-compact { padding: 4px 6px; grid-template-columns: 1fr; gap: 4px; }
                .status-item { display: flex; padding: 10px 12px; background-color: white; border-radius: 5px; border-left: 3px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.08); transition: all 0.2s; cursor: pointer; }
                .compact .status-item { padding: 6px 8px; }
                .ultra-compact .status-item { padding: 4px 6px; }
                .status-item:hover { transform: translateY(-2px); box-shadow: 0 3px 5px rgba(0,0,0,0.1); }
                .status-item.good { border-left-color: #66bb6a; }
                .status-item.warning { border-left-color: #ffa726; }
                .status-item.error { border-left-color: #ef5350; }
                .status-item.neutral { border-left-color: #bdbdbd; }
                .status-icon { font-size: 16px; margin-right: 10px; width: 20px; text-align: center; flex-shrink: 0; }
                .compact .status-icon { font-size: 14px; margin-right: 6px; width: 16px; }
                .ultra-compact .status-icon { font-size: 12px; margin-right: 4px; width: 14px; }
                .status-details { flex: 1; min-width: 0; }
                .status-label { font-weight: bold; margin-bottom: 2px; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
                .compact .status-label { font-size: 11px; margin-bottom: 1px; }
                .ultra-compact .status-label { font-size: 10px; margin-bottom: 0; }
                .status-value { font-size: 15px; font-weight: bold; }
                .compact .status-value { font-size: 13px; }
                .ultra-compact .status-value { font-size: 12px; }
                .status-value.good { color: #2e7d32; }
                .status-value.warning { color: #ef6c00; }
                .status-value.error { color: #c62828; }
                .status-value.neutral { color: #616161; }
                
                /* Chart container and general styling */
                .chart-container { 
                    margin: 8px 10px 2px 10px; 
                    position: relative; 
                    background-color: #fff; 
                    border: 1px solid #eee; 
                    border-radius: 4px; 
                    padding: 8px; 
                }
                .compact .chart-container { margin: 6px 8px 1px 8px; padding: 6px; }
                .ultra-compact .chart-container { margin: 4px 6px 0px 6px; padding: 4px; }
                /* Add tooltip for clarity */
                .chart-container [title] { cursor: help; }
                .chart-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; font-style: italic; text-align: center; padding: 8px; }
                .loading-indicator { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.8); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
                .loading-spinner { width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .error-message { padding: 12px; margin: 8px; background-color: #ffebee; border: 1px solid #ffcdd2; border-radius: 4px; color: #c62828; text-align: center; }

                /* Chart title and axis labels */
                .chart-title { text-align: center; font-size: 13px; font-weight: bold; color: #333; margin: 0 0 6px 0; }
                .compact .chart-title { font-size: 12px; margin: 0 0 4px 0; }
                .ultra-compact .chart-title { font-size: 11px; margin: 0 0 2px 0; }
                .chart-x-axis-label { text-align: center; font-size: 10px; color: #777; margin-top: 4px; font-style: italic; }
                .compact .chart-x-axis-label { font-size: 9px; margin-top: 3px; }
                .ultra-compact .chart-x-axis-label { display: none; }
                
                /* Chart bar container with proper positioning */
                .chart-bar-container { 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: flex-end; 
                    height: 100%; 
                    position: relative; 
                    padding: 8px 0 8px 12px; /* INCREASED padding-left for threshold labels */
                }
                .compact .chart-bar-container { 
                    padding: 6px 0 6px 10px; /* INCREASED padding-left for threshold labels */
                }
                .ultra-compact .chart-bar-container { 
                    padding: 4px 0 4px 8px; /* INCREASED padding-left for threshold labels */
                }

                /* Chart bars horizontal layout with proper baseline */
                .chart-bars { 
                    display: flex; 
                    height: calc(100% - 20px); /* Subtract space for X-axis labels */
                    align-items: flex-end; 
                    gap: 4px; 
                    padding-bottom: 20px; /* For X-axis labels */ 
                    position: relative; 
                    z-index: 2; /* Above grid lines but below overlay elements */
                }
                .compact .chart-bars { gap: 3px; padding-bottom: 18px; }
                .ultra-compact .chart-bars { gap: 2px; padding-bottom: 15px; }

                /* Bar wrapper with proper alignment */
                .chart-bar-wrapper { 
                    flex: 1; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: flex-end; /* Align to bottom */
                    height: 100%; 
                    position: relative;
                }
                
                /* Chart bar with correct styling and positioning */
                .chart-bar { 
                    width: 100%; 
                    max-width: 24px; 
                    border-radius: 2px 2px 0 0; 
                    background-color: var(--color-primary); 
                    transition: height 0.3s ease; 
                    z-index: 3; /* Above threshold lines */
                    position: relative;
                    min-height: 2px; /* Minimum height so even small values are visible */
                }
                .compact .chart-bar { max-width: 20px; }
                .ultra-compact .chart-bar { max-width: 16px; border-radius: 1px 1px 0 0; }
                .chart-bar.warning { background-color: #ffa726; }
                .chart-bar.error { background-color: #ef5350; }

                /* IMPROVED: Bar value/label styling - positioned relative to bar top */
                .chart-bar-value {
                    position: absolute;
                    bottom: 100%; /* Position directly at the top of the bar */
                    left: 50%;
                    transform: translateX(-50%) translateY(-8px); /* Center horizontally and offset vertically from bar top */
                    font-size: 9px;
                    font-weight: bold;
                    color: #555;
                    background-color: white; /* Solid background */
                    padding: 1px 4px;
                    border-radius: 3px;
                    white-space: nowrap;
                    z-index: 5; /* Above everything */
                    box-shadow: 0 0 3px rgba(0,0,0,0.1); /* Add subtle shadow */
                    border: 1px solid #f0f0f0; /* Light border */
                }
                .compact .chart-bar-value {
                    font-size: 8px;
                    transform: translateX(-50%) translateY(-6px); /* Smaller offset for compact mode */
                    padding: 1px 3px;
                }
                .ultra-compact .chart-bar-value {
                    font-size: 7px;
                    transform: translateX(-50%) translateY(-4px); /* Even smaller offset for ultra-compact */
                    padding: 0 2px;
                }
                .chart-bar-value.warning { color: #ef6c00; }
                .chart-bar-value.error { color: #c62828; }
                
                /* Bar label for the time indicator */
                .chart-bar-label { 
                    position: absolute; 
                    bottom: -16px; /* Position below bar, outside of the bar wrapper */
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100%;
                    font-size: 9px; 
                    color: #666; 
                    text-align: center; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center;
                    z-index: 4; /* Above bars and lines */
                }
                .compact .chart-bar-label { font-size: 8px; }
                .ultra-compact .chart-bar-label { font-size: 7px; }
                .time-label { font-weight: normal; color: #888; }
                .time-label.last-refresh { color: var(--color-primary, #2196f3); font-weight: bold; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; text-shadow: 0 0 2px rgba(33, 150, 243, 0.5); } 100% { opacity: 0.7; } }

                /* Threshold lines with correct z-index */
                .chart-axis { 
                    position: absolute; 
                    left: 0; 
                    right: 0; 
                    border-top: 1px dashed; 
                    pointer-events: none; 
                    z-index: 1; /* Below bars */
                    opacity: 0.8; /* Slightly transparent */
                }
                /* UPDATED: Moved threshold labels to left side with consistent styling */
                .chart-axis-label { 
                    position: absolute; 
                    left: 2px; /* Moved from right to left side */
                    top: -7px; 
                    font-size: 9px; 
                    color: #333; /* Darker color for better visibility */
                    background-color: rgba(255, 255, 255, 0.85); /* Semi-transparent white background */
                    padding: 1px 3px; 
                    border-radius: 2px;
                    text-align: left;
                    z-index: 10; /* Increased z-index to match y-axis labels */
                    box-shadow: 0 0 2px rgba(0,0,0,0.1); /* Subtle shadow for better visibility */
                    font-weight: 500; /* Slightly bolder */
                    border: 1px solid rgba(0,0,0,0.05); /* Very subtle border */
                }
                .compact .chart-axis-label { font-size: 8px; top: -6px; }
                .ultra-compact .chart-axis-label { display: none; } /* Hide threshold labels in ultra-compact */

                /* Y-axis grid lines with proper z-index */
                .chart-y-axis-guide { 
                    position: absolute; 
                    left: 0; 
                    right: 0; 
                    border-top: 1px dotted #e0e0e0; 
                    pointer-events: none; 
                    z-index: 1; /* Below bars */
                }
                /* FIXED: Completely revamped Y-axis label styling */
                .chart-y-axis-guide-label { 
                    position: absolute; 
                    left: 2px; /* Now positioned INSIDE the chart area */
                    top: -8px; 
                    font-size: 9px; 
                    color: #333; /* Darker color for better visibility */
                    background-color: rgba(255, 255, 255, 0.85); /* Semi-transparent white background */
                    padding: 1px 3px; 
                    border-radius: 2px;
                    /* No fixed width - let content determine width */
                    text-align: left;
                    z-index: 10; /* Very high to ensure visibility */
                    box-shadow: 0 0 2px rgba(0,0,0,0.1); /* Subtle shadow for better visibility */
                    font-weight: 500; /* Slightly bolder */
                    border: 1px solid rgba(0,0,0,0.05); /* Very subtle border */
                }
                .compact .chart-y-axis-guide-label { 
                    font-size: 8px; 
                    left: 2px;
                    top: -7px; 
                    padding: 1px 2px;
                }
                .ultra-compact .chart-y-axis-guide, .ultra-compact .chart-y-axis-guide-label { display: none; }

                /* Progress bar styles */
                .progress-bar-container { height: 6px; background-color: #f5f5f5; border-radius: 3px; overflow: hidden; margin-top: 4px; }
                .progress-bar { height: 100%; background-color: var(--color-primary); transition: width 0.3s ease; }
                .progress-bar.warning { background-color: #ffa726; }
                .progress-bar.error { background-color: #ef5350; }
                
                /* Zero and placeholder bar styles */
                .chart-bar-placeholder { 
                    background-color: #f0f0f0; 
                    border: 1px dashed #ddd; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 16px; 
                    color: #aaa; 
                    font-weight: bold; 
                    position: relative; 
                    height: 2px; /* Fixed minimum height */
                    width: 100%;
                    max-width: 24px;
                    border-radius: 2px 2px 0 0;
                }
                .compact .chart-bar-placeholder { max-width: 20px; }
                .ultra-compact .chart-bar-placeholder { max-width: 16px; }
                .chart-bar-placeholder::after { content: '×'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-shadow: 0 0 2px white; }
                
                /* Zero value bars with consistent styling */
                .chart-bar-zero { 
                    height: 2px !important; /* Fixed height */
                    min-height: 2px !important;
                    position: relative; 
                    border: 1px dashed #ef5350; 
                    background-color: rgba(239, 83, 80, 0.05);
                    width: 100%;
                    max-width: 24px;
                    border-radius: 2px 2px 0 0;
                }
                .compact .chart-bar-zero { max-width: 20px; }
                .ultra-compact .chart-bar-zero { max-width: 16px; }
                .chart-bar-zero[data-zero-marker="true"]::after { 
                    content: '×'; 
                    position: absolute; 
                    top: -8px; /* Position above the line */
                    left: 50%; 
                    transform: translateX(-50%); 
                    color: #ef5350; 
                    font-weight: bold; 
                    font-size: 14px; 
                    text-shadow: 0 0 2px white;
                }
            `;
            document.head.appendChild(style);
        },

        renderContent: function() {
            if (!this.dom.content) return;
            this.dom.content.innerHTML = ''; // Clear previous content

            const container = document.createElement('div');
            container.className = 'system-status-panel';

            // Header
            const header = document.createElement('div');
            header.className = 'panel-header-info';
            header.innerHTML = `
                <div class="header-title"><span>📊</span> System Health Monitor</div>
                <div class="auto-refresh-container">
                    <label class="toggle-switch">
                        <input type="checkbox" class="auto-refresh-toggle">
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="auto-refresh-label">Auto</span>
                </div>
                <button class="refresh-button"><span>🔄</span> <span class="refresh-text">Refresh</span></button>
                <div class="last-update-time">Never updated</div>
            `;
            container.appendChild(header);
            this.dom.autoRefreshToggle = header.querySelector('.auto-refresh-toggle');
            this.dom.refreshButton = header.querySelector('.refresh-button');
            this.dom.lastUpdateTime = header.querySelector('.last-update-time');

            // Metrics Toggle
            const metricsToggle = document.createElement('div');
            metricsToggle.className = 'metrics-toggle';
            const metrics = [
                { id: 'cpuUsage', label: 'CPU', icon: '⚙️' }, { id: 'memoryUsage', label: 'Memory', icon: '🧠' },
                { id: 'apiResponse', label: 'API', icon: '⚡' }, { id: 'diskSpace', label: 'Disk', icon: '💾' },
                { id: 'errors24h', label: 'Errors', icon: '⚠️' }
            ];
            metrics.forEach(metric => {
                const button = document.createElement('button');
                button.className = `metric-button ${metric.id === this.state.selectedMetric ? 'active' : ''}`;
                button.setAttribute('data-metric', metric.id);
                button.innerHTML = `<span class="metric-icon">${metric.icon}</span> <span class="metric-text">${metric.label}</span>`;
                const desc = this.state.status[metric.id]?.description || this.getMetricDescription(metric.id);
                button.title = desc;
                metricsToggle.appendChild(button);
            });
            container.appendChild(metricsToggle);
            this.dom.metricsToggle = metricsToggle;

            // Chart Area
            this.dom.chartContainer = document.createElement('div');
            this.dom.chartContainer.className = 'chart-container';
            container.appendChild(this.dom.chartContainer);

            this.dom.chartExplanation = document.createElement('div');
            this.dom.chartExplanation.className = 'chart-explanation';
            container.appendChild(this.dom.chartExplanation);

            // Status Items
            this.dom.statusContainer = document.createElement('div');
            this.dom.statusContainer.className = 'status-container';
            container.appendChild(this.dom.statusContainer);

            // Load/Error
            this.dom.loadingIndicator = document.createElement('div');
            this.dom.loadingIndicator.className = 'loading-indicator';
            this.dom.loadingIndicator.innerHTML = `<div class="loading-spinner"></div><div>Refreshing data...</div>`;
            this.dom.loadingIndicator.style.display = 'none';
            container.appendChild(this.dom.loadingIndicator);

            this.dom.errorMessage = document.createElement('div');
            this.dom.errorMessage.className = 'error-message';
            this.dom.errorMessage.style.display = 'none';
            container.appendChild(this.dom.errorMessage);

            this.dom.content.appendChild(container);
            this.addStyles();
            // Initial size check after elements are in DOM
            setTimeout(() => {
                if (this.dom.content) {
                    this.state.panelWidth = this.dom.content.clientWidth;
                    this.state.panelHeight = this.dom.content.clientHeight;
                    this.checkPanelSize(); // This will call updateChart if needed
                }
            }, 50);
        },

        updateChartExplanation: function() {
            if (!this.dom.chartExplanation || this.state.ultraCompactMode) {
                 if(this.dom.chartExplanation) this.dom.chartExplanation.textContent = ''; return;
            }
            const { selectedMetric, metricSettings, status, currentChartScaleMax } = this.state;
            const metricInfo = metricSettings[selectedMetric];
            const statusData = status[selectedMetric];
            if (!metricInfo || !statusData) { this.dom.chartExplanation.textContent = 'Chart displays historical values.'; return; }

            const { warningThreshold: warning, criticalThreshold: critical } = metricInfo;
            const unit = statusData.unit || '';
            let explanation = `Bars show ${selectedMetric.replace(/([A-Z])/g, ' $1').toLowerCase()}. `;

            if (['cpuUsage', 'memoryUsage', 'diskSpace'].includes(selectedMetric)) explanation += `Higher is more load/less space. `;
            else if (['apiResponse', 'errors24h'].includes(selectedMetric)) explanation += `Lower is better. `;

            explanation += `Yellow Line: Warn (${warning}${unit}). Red Line: Crit (${critical}${unit}).`;
            
            // Add note about Y-axis scaling
            if (unit === '%') {
                explanation += ` Y-axis: Fixed 0-100%.`;
            } else {
                explanation += ` Y-axis: Scale adjusts to data (max: ${Math.round(currentChartScaleMax)}${unit}).`;
            }
            
            explanation += ` Timeline: Most recent on right.`;

            this.dom.chartExplanation.textContent = explanation;
        },

        renderStatus: function() {
            if (!this.dom.statusContainer) return;
            this.dom.statusContainer.innerHTML = '';
            this.dom.statusMetrics = {}; // Reset
            Object.entries(this.state.status).forEach(([key, data]) => {
                const statusItem = this.createStatusItem(key, data);
                this.dom.statusContainer.appendChild(statusItem);
                this.dom.statusMetrics[key] = statusItem;
            });
            this.updateChart(); // Always update chart after rendering status
        },

        createStatusItem: function(key, data) {
            const item = document.createElement('div');
            item.className = `status-item ${data.status || 'neutral'} has-tooltip`;
            item.setAttribute('data-metric', key);
            item.title = data.description || this.getMetricDescription(key);
            item.addEventListener('click', () => this.selectMetric(key));

            const formattedLabel = key.replace(/([A-Z0-9]+)/g, " $1").replace(/^ /, "").replace(/^./, str => str.toUpperCase());
            item.innerHTML = `
                <div class="status-icon">${data.icon || '📊'}</div>
                <div class="status-details">
                    <div class="status-label"><span>${formattedLabel}</span></div>
                    <div class="status-value ${data.status || 'neutral'}">${data.value}</div>
                </div>
            `;
            const detailsDiv = item.querySelector('.status-details');

            if ( (data.value.includes('%') || ['cpuUsage', 'memoryUsage', 'diskSpace'].includes(key)) && this.state.metricSettings[key]) {
                const percentage = parseFloat(data.value.replace(/[^0-9.]/g, ''));
                if (!isNaN(percentage)) {
                    const progressContainer = document.createElement('div');
                    progressContainer.className = 'progress-bar-container';
                    const progressBar = document.createElement('div');
                    progressBar.className = 'progress-bar';
                    progressBar.style.width = `${Math.max(0, Math.min(100,percentage))}%`;
                    const { warningThreshold, criticalThreshold } = this.state.metricSettings[key];
                    if (percentage >= criticalThreshold) progressBar.classList.add('error');
                    else if (percentage >= warningThreshold) progressBar.classList.add('warning');
                    progressContainer.appendChild(progressBar);
                    detailsDiv.appendChild(progressContainer);
                }
            }
            return item;
        },

        getMetricDescription: function(metricKey) { // Changed param name for clarity
            const metricInfo = this.state.metricSettings[metricKey];
            if (metricInfo && metricInfo.description) return metricInfo.description;
            // Fallback descriptions
            const descriptions = {
                serverStatus: 'Current server operational status', apiResponse: 'API request response time in milliseconds',
                memoryUsage: 'Percentage of system memory currently in use', cpuUsage: 'Percentage of CPU resources currently in use',
                diskSpace: 'Percentage of storage space currently in use', errors24h: 'Number of system errors in the last 24 hours'
            };
            return descriptions[metricKey] || 'System health metric';
        },

        toggleExpandedView: function(key) {
            this.state.expandedViews[key] = !this.state.expandedViews[key];
            this.selectMetric(key);
            if (typeof Framework !== 'undefined' && Framework.showToast) {
                Framework.showToast(`Showing ${key} history chart`);
            }
        },

        updateChart: function() {
            if (!this.dom.chartContainer) return;
            this.dom.chartContainer.innerHTML = '';

            const { selectedMetric, status, metricSettings, ultraCompactMode, historyLimit } = this.state;
            const metricData = status[selectedMetric];
            const metricConfig = metricSettings[selectedMetric];

            if (!metricData || !metricConfig) { /* ... placeholder ... */ return; }

            const chartTitleEl = document.createElement('div');
            chartTitleEl.className = 'chart-title';
            chartTitleEl.innerHTML = `${metricData.icon || '📈'} ${selectedMetric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} History`;
            this.dom.chartContainer.appendChild(chartTitleEl);

            const unit = metricData.unit || '';
            let scaleMax = 100; // Default for percentage based
            if (unit === '%') {
                this.state.currentChartScaleMax = 100; // Explicitly set for %
            } else {
                const historyValues = metricData.history.map(h => parseFloat((typeof h === 'object' ? h.value : h).replace(/[^0-9.]/g, ''))).filter(v => !isNaN(v));
                let maxValInHistory = historyValues.length > 0 ? Math.max(0, ...historyValues) : 0;
                let ceiling = metricConfig.criticalThreshold !== undefined ? metricConfig.criticalThreshold : 0;
                if (metricConfig.warningThreshold !== undefined && (ceiling < metricConfig.warningThreshold * 1.2)) {
                    ceiling = metricConfig.warningThreshold * 1.2;
                }
                if (maxValInHistory === 0 && ceiling === 0) { // Sensible defaults for empty charts
                    if (selectedMetric === 'apiResponse') ceiling = 50; else if (selectedMetric === 'errors24h') ceiling = 5; else ceiling = 10;
                }
                scaleMax = Math.max(maxValInHistory, ceiling) * 1.15; // 15% headroom
                if (scaleMax === 0) scaleMax = selectedMetric === 'apiResponse' ? 100 : (selectedMetric === 'errors24h' ? 10 : 50);
                this.state.currentChartScaleMax = parseFloat(scaleMax.toFixed(2));
            }

            const chartBarContainer = document.createElement('div');
            chartBarContainer.className = 'chart-bar-container';

            // Y-Axis Guidelines
            if (!ultraCompactMode) {
                const numGuidelines = 2; // 0, 50, 100% lines
                for (let i = 0; i <= numGuidelines; i++) {
                    const percentOfScale = (i / numGuidelines) * 100;
                    const yAxisLine = document.createElement('div');
                    yAxisLine.className = 'chart-y-axis-guide';
                    yAxisLine.style.bottom = `${percentOfScale}%`;

                    const yAxisLabel = document.createElement('div');
                    yAxisLabel.className = 'chart-y-axis-guide-label';
                    let labelText;
                    if (unit === '%') {
                        labelText = `${Math.round(percentOfScale)}%`; // Directly use 0, 50, 100 for % scales
                    } else {
                        const valueAtLine = (this.state.currentChartScaleMax * percentOfScale) / 100;
                        // Format with specific precision for better readability
                        const formattedValue = Math.round(valueAtLine);
                        labelText = `${formattedValue}${unit}`;
                    }
                    yAxisLabel.textContent = labelText;
                    yAxisLine.appendChild(yAxisLabel);
                    chartBarContainer.appendChild(yAxisLine);
                }
            }

            // Metric Threshold Lines
            if (metricConfig && (metricConfig.warningThreshold !== undefined || metricConfig.criticalThreshold !== undefined) && this.state.currentChartScaleMax > 0) {
                const addThresholdLine = (value, type) => {
                    if (value === undefined || value === null) return;
                    let positionPercent = (value / this.state.currentChartScaleMax) * 100;
                    positionPercent = Math.min(100, Math.max(0, positionPercent));
                    const axis = document.createElement('div');
                    axis.className = 'chart-axis';
                    axis.style.bottom = `${positionPercent}%`;
                    axis.style.borderColor = type === 'warning' ? '#ffa726' : '#ef5350';
                    const label = document.createElement('div');
                    label.className = 'chart-axis-label';
                    label.textContent = `${value}${unit || ''}`;
                    label.style.color = type === 'warning' ? '#ef6c00' : '#c62828';
                    axis.appendChild(label);
                    chartBarContainer.appendChild(axis);
                };
                addThresholdLine(metricConfig.warningThreshold, 'warning');
                addThresholdLine(metricConfig.criticalThreshold, 'critical');
            }

            const chartBars = document.createElement('div');
            chartBars.className = 'chart-bars';
            const numBarsToShow = ultraCompactMode ? 5 : historyLimit;
            const historyToShow = metricData.history.slice(-numBarsToShow);
            
            // Create bars with proper positioning and alignment
            for (let i = 0; i < numBarsToShow; i++) {
                const historyIndex = historyToShow.length - numBarsToShow + i;
                if (historyIndex >= 0) {
                    const item = historyToShow[historyIndex];
                    const isLast = i === numBarsToShow - 1; // Last bar visually
                    const timeOffset = -(numBarsToShow - 1 - i);
                    chartBars.appendChild(this.createBarWithTimeline(item, timeOffset, selectedMetric, isLast));
                } else { // Prepend placeholders if history is shorter than numBarsToShow
                    chartBars.appendChild(this.createEmptyBarWithTimeline(-(numBarsToShow -1 -i), false));
                }
            }
            
            chartBarContainer.appendChild(chartBars);
            this.dom.chartContainer.appendChild(chartBarContainer);
            this.updateChartExplanation(); // After scaleMax is set

            // We're now adding timeline info to the chart explanation
            // to keep all explanatory text in one place
            if (!ultraCompactMode && !this.dom.chartExplanation) {
                // Only add this if the chart explanation isn't shown
                const xAxisLabel = document.createElement('div');
                xAxisLabel.className = 'chart-x-axis-label';
                xAxisLabel.textContent = 'Timeline (most recent on right)';
                this.dom.chartContainer.appendChild(xAxisLabel);
            }
        },

        createEmptyBarWithTimeline: function(timeOffset, isLastRefresh = false) {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';
            
            // Empty placeholder with consistent styling
            const bar = document.createElement('div');
            bar.className = 'chart-bar-placeholder';
            barWrapper.appendChild(bar);
            
            const label = document.createElement('div');
            label.className = 'chart-bar-label';
            if (this.state.ultraCompactMode) {
                label.innerHTML = `<span style="font-size: 7px; color: #bbb;">---</span>`;
            } else {
                label.innerHTML = `<span class="time-label">${this.getTimeAgoFromOffset(timeOffset, isLastRefresh)}</span>`;
            }
            barWrapper.appendChild(label);
            return barWrapper;
        },

        createBarWithTimeline: function(historyItem, timeOffset, metricKey, isLastRefresh = false) {
            let valueStr, timestamp;
            if (typeof historyItem === 'object' && historyItem.value !== undefined) {
                valueStr = historyItem.value; timestamp = historyItem.timestamp;
            } else {
                valueStr = String(historyItem); timestamp = null;
            }
            let numericValue = parseFloat(valueStr.replace(/[^0-9.]/g, ''));
            if (isNaN(numericValue)) numericValue = 0;

            const { unit } = this.state.status[metricKey];
            const isPercentage = unit === '%';
            const { currentChartScaleMax, metricSettings, ultraCompactMode } = this.state;

            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';
            
            // Handle zero values with consistent styling
            if (numericValue === 0 && ['apiResponse', 'errors24h', 'cpuUsage', 'memoryUsage', 'diskSpace'].includes(metricKey)) {
                const bar = document.createElement('div');
                bar.className = 'chart-bar-zero';
                bar.setAttribute('data-zero-marker', 'true');
                bar.title = `${valueStr} (Zero Value)`;
                
                if (metricKey === 'errors24h') {
                    bar.classList.add('good'); // Zero errors is good
                }
                
                barWrapper.appendChild(bar);
                
                // Add value display above the bar (even for zero values)
                const valueDisplay = document.createElement('div');
                valueDisplay.className = 'chart-bar-value';
                valueDisplay.textContent = valueStr;
                bar.appendChild(valueDisplay); // Now append to the bar itself, not the wrapper
            } else {
                // Standard bar with proper height calculation
                const bar = document.createElement('div');
                bar.className = 'chart-bar';

                let heightPercent = 0;
                if (currentChartScaleMax > 0) {
                    heightPercent = (isPercentage ? numericValue : (numericValue / currentChartScaleMax) * 100);
                }
                heightPercent = Math.min(100, Math.max(0, heightPercent));
                
                // Set height directly
                bar.style.height = `${Math.max(2, heightPercent)}%`; // Minimum 2% height for visibility
                bar.title = valueStr;
                
                // Determine status based on thresholds
                let barStatus = 'good';
                const config = metricSettings[metricKey];
                if (config) {
                    if (numericValue >= config.criticalThreshold) barStatus = 'error';
                    else if (numericValue >= config.warningThreshold) barStatus = 'warning';
                }
                if (metricKey === 'errors24h' && numericValue > 0 && barStatus === 'good') barStatus = 'warning';
                
                bar.classList.add(barStatus);
                barWrapper.appendChild(bar);
                
                // Add value display above the bar
                const valueDisplay = document.createElement('div');
                valueDisplay.className = `chart-bar-value ${barStatus}`;
                valueDisplay.textContent = valueStr;
                bar.appendChild(valueDisplay); // Now append to the bar itself, not the wrapper
            }

            // Add time label below the bar
            const label = document.createElement('div');
            label.className = 'chart-bar-label';
            const timeLabelText = timestamp ? 
                this.getTimeAgoFromTimestamp(timestamp, isLastRefresh) : 
                this.getTimeAgoFromOffset(timeOffset, isLastRefresh);

            if (ultraCompactMode) {
                label.innerHTML = `${isLastRefresh ? '<span style="font-size:5px; color:var(--color-primary); display:block; line-height:0.5;">●</span>' : ''}`;
            } else {
                label.innerHTML = `<span class="time-label ${isLastRefresh ? 'last-refresh' : ''}">${timeLabelText}</span>`;
            }
            
            barWrapper.appendChild(label);
            return barWrapper;
        },

        getTimeAgoFromOffset: function(offset, isLastRefresh = false) {
            if (isLastRefresh && offset === 0) return 'Current'; // Changed from 'Last Refresh'
            const minsAgo = Math.abs(offset) * (this.state.refreshRate / 60000);
            return this.formatTimeAgo(minsAgo, isLastRefresh);
        },
        getTimeAgoFromTimestamp: function(timestamp, isLastRefresh = false) { // isLastRefresh indicates if it's the absolute last item
            if (isLastRefresh) return 'Current'; // Changed from 'Last Refresh'
            const diffMs = new Date() - new Date(timestamp);
            const minsAgo = diffMs / 60000;
            return this.formatTimeAgo(minsAgo, false); // false here, as relative to now.
        },
        formatTimeAgo: function(minsAgo, isLatestForce = false) { // isLatestForce can be used if contextually it's known to be the latest
            if (isLatestForce) return 'Current'; // Changed from 'Last Refresh'
            if (minsAgo < 1) return '<1m ago';
            if (minsAgo < 60) return `${Math.round(minsAgo)}m ago`;
            const h = Math.floor(minsAgo / 60), m = Math.round(minsAgo % 60);
            return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
        },

        selectMetric: function(metric) {
            if (this.state.selectedMetric === metric) return;
            this.state.selectedMetric = metric;
            if (this.dom.metricsToggle) {
                this.dom.metricsToggle.querySelectorAll('.metric-button').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-metric') === metric);
                });
            }
            this.updateChart();
        },

        toggleAutoRefresh: function(enabled) {
            this.state.autoRefresh = enabled;
            if (this.state.refreshInterval) clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
            if (enabled) {
                this.state.refreshInterval = setInterval(() => this.refreshStatus(), this.state.refreshRate);
                if (typeof Framework !== 'undefined' && Framework.showToast) {
                    Framework.showToast(`Auto-refresh enabled (${this.state.refreshRate / 1000}s)`);
                }
            } else {
                if (typeof Framework !== 'undefined' && Framework.showToast) {
                    Framework.showToast('Auto-refresh disabled');
                }
            }
        },
        updateLastUpdateTime: function() {
            if (!this.dom.lastUpdateTime || !this.state.lastUpdate) return;
            const now = new Date();
            const diff = now - this.state.lastUpdate; // Difference in milliseconds
            if (diff < 60000) { this.dom.lastUpdateTime.textContent = 'Just now'; }
            else if (diff < 3600000) { this.dom.lastUpdateTime.textContent = `${Math.floor(diff / 60000)}m ago`; }
            else { this.dom.lastUpdateTime.textContent = `${Math.floor(diff / 3600000)}h ago`; }
        },
        showLoading: function() {
            if (this.dom.loadingIndicator) this.dom.loadingIndicator.style.display = 'flex';
            if (this.dom.refreshButton) this.dom.refreshButton.disabled = true;
        },
        hideLoading: function() {
            if (this.dom.loadingIndicator) this.dom.loadingIndicator.style.display = 'none';
            if (this.dom.refreshButton) this.dom.refreshButton.disabled = false;
        },
        showError: function(message) {
            if (this.dom.errorMessage) { this.dom.errorMessage.textContent = message; this.dom.errorMessage.style.display = 'block';}
        },
        hideError: function() {
             if (this.dom.errorMessage) this.dom.errorMessage.style.display = 'none';
        },
        refreshStatus: function(showToast = false) {
            this.showLoading(); this.state.isLoading = true;
            setTimeout(() => {
                try {
                    this.updateRandomValues();
                    this.state.lastUpdate = new Date();
                    this.updateLastUpdateTime();
                    this.renderStatus(); // Calls updateChart
                    this.hideLoading(); this.hideError();
                    if (showToast && typeof Framework !== 'undefined' && Framework.showToast) {
                        Framework.showToast('System status refreshed');
                    }
                    this.state.isLoading = false;
                } catch (error) {
                    console.error(`[${this.id}] Error refreshing status:`, error);
                    this.showError(`Failed to refresh system status: ${error.message}`);
                    this.hideLoading(); this.state.isLoading = false;
                }
            }, 1000);
        },
        updateRandomValues: function() {
            const serverStatusRoll = Math.random();
            let serverStatusVal, serverValueIconDetails;
            if (serverStatusRoll > 0.95) { serverStatusVal = 'error'; serverValueIconDetails = { val: 'Offline', icon: '🔴', desc: 'Server is currently offline.'}; }
            else if (serverStatusRoll > 0.85) { serverStatusVal = 'warning'; serverValueIconDetails = { val: 'Degraded', icon: '🟡', desc: 'Server is experiencing issues.'}; }
            else { serverStatusVal = 'good'; serverValueIconDetails = { val: 'Online', icon: '🟢', desc: 'Server operational status is nominal.'};}
            const now = new Date().getTime();

            Object.keys(this.state.status).forEach(key => {
                const currentMetricState = this.state.status[key];
                if (!currentMetricState.history) currentMetricState.history = [];
                currentMetricState.history.push({ value: currentMetricState.value, timestamp: currentMetricState.lastTimestamp || now }); // Use previous item's timestamp or current if none
                currentMetricState.lastTimestamp = now; // Store current timestamp for next cycle
                if (currentMetricState.history.length > this.state.historyLimit) currentMetricState.history.shift();
            });

            this.state.status.serverStatus = { ...this.state.status.serverStatus, value: serverValueIconDetails.val, status: serverStatusVal, icon: serverValueIconDetails.icon, description: serverValueIconDetails.desc, history: this.state.status.serverStatus.history };
            const { apiResponse, memoryUsage, cpuUsage, diskSpace, errors24h } = this.state.metricSettings;

            const apiVal = Math.floor(Math.random() * (apiResponse.criticalThreshold * 1.2 - 30) + 30);
            this.state.status.apiResponse = { ...this.state.status.apiResponse, value: `${apiVal}ms`, status: (apiVal > apiResponse.criticalThreshold ? 'error' : apiVal > apiResponse.warningThreshold ? 'warning' : 'good'), history: this.state.status.apiResponse.history };
            const memVal = Math.floor(Math.random() * 70) + 25;
            this.state.status.memoryUsage = { ...this.state.status.memoryUsage, value: `${memVal}%`, status: (memVal > memoryUsage.criticalThreshold ? 'error' : memVal > memoryUsage.warningThreshold ? 'warning' : 'good'), history: this.state.status.memoryUsage.history };
            const cpuVal = Math.floor(Math.random() * 80) + 10;
            this.state.status.cpuUsage = { ...this.state.status.cpuUsage, value: `${cpuVal}%`, status: (cpuVal > cpuUsage.criticalThreshold ? 'error' : cpuVal > cpuUsage.warningThreshold ? 'warning' : 'good'), history: this.state.status.cpuUsage.history };
            const diskVal = Math.floor(Math.random() * 70) + 25;
            this.state.status.diskSpace = { ...this.state.status.diskSpace, value: `${diskVal}%`, status: (diskVal > diskSpace.criticalThreshold ? 'error' : diskVal > diskSpace.warningThreshold ? 'warning' : 'good'), history: this.state.status.diskSpace.history };
            
            let errVal = 0; const errRoll = Math.random();
            if (errRoll > 0.95) errVal = Math.floor(Math.random() * (errors24h.criticalThreshold * 1.5 - errors24h.criticalThreshold + 1) + errors24h.criticalThreshold);
            else if (errRoll > 0.80) errVal = Math.floor(Math.random() * (errors24h.warningThreshold) + 1);
            else if (errRoll > 0.65) errVal = Math.floor(Math.random() * 2) + 1;
            this.state.status.errors24h = { ...this.state.status.errors24h, value: `${errVal}`, status: (errVal >= errors24h.criticalThreshold ? 'error' : errVal >= errors24h.warningThreshold ? 'warning' : (errVal > 0 ? 'warning' : 'good')), history: this.state.status.errors24h.history };
        },
        getStatusColor: function(status) { return ''; },
        getStatusText: function(status) { return ''; },
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened.`);
            if (this.state.autoRefresh) this.toggleAutoRefresh(true);
            this.refreshStatus();
            setTimeout(() => { if(this.dom.content){ this.state.panelWidth = this.dom.content.clientWidth; this.state.panelHeight = this.dom.content.clientHeight; this.checkPanelSize();}}, 100);
        },
        onPanelClose: function() {
            console.log(`[${this.id}] Panel closed.`);
            if (this.state.refreshInterval) {
                clearInterval(this.state.refreshInterval); this.state.refreshInterval = null;
                if (this.dom.autoRefreshToggle) this.dom.autoRefreshToggle.checked = false;
                this.state.autoRefresh = false;
                if (typeof Framework !== 'undefined' && Framework.showToast) Framework.showToast('Auto-refresh paused');
            }
        },
        cleanup: function() {
            console.log(`[${this.id}] Cleaning up resources...`);
            if (this.state.refreshInterval) { clearInterval(this.state.refreshInterval); this.state.refreshInterval = null; }
            if (this.dom.sizeObserver) { this.dom.sizeObserver.disconnect(); this.dom.sizeObserver = null; }
            if (this.debouncedCheckPanelSizeListener) { window.removeEventListener('resize', this.debouncedCheckPanelSizeListener); }
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) styleElement.remove();
            // Unsubscribe from any framework events if applicable
            this.state.subscriptions.forEach(sub => { if (typeof Framework !== 'undefined' && Framework.off) Framework.off(sub.event, sub.id); });
            this.state.subscriptions = [];
            // Nullify DOM references
            Object.keys(this.dom).forEach(key => this.dom[key] = null);
            console.log(`[${this.id}] Cleanup complete`);
        }
    };

    if (typeof Framework !== 'undefined' && Framework.registerComponent) {
        Framework.registerComponent(component.id, component);
    } else {
        console.warn(`Framework not found, ${component.id} not registered. Attaching to window.`);
        window[component.id] = component; // For standalone testing
    }
})();