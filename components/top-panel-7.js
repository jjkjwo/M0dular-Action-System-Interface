/**
 * ==============================================================================================
 * Top Panel 7 - Emotions Tracker Component
 * ==============================================================================================
 *
 * Visualizes conversation emotions. History shows newest first. Animation highlights
 * specific new User/AI entries. Compact layout for current emotions and history items.
 *
 * @version 1.2.3 - Compact history item styling.
 */

(function() {
    // Component definition
    const component = {
        id: 'top-panel-7',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            emotionsContainer: null,
            currentEmotionsDisplayArea: null,
            historyContainer: null,
            refreshButton: null,
            resetButton: null,
            chartContainer: null
        },

        // Component state
        state: {
            emotionsActive: false,
            emotionHistory: [],          // Processed history: {timestamp: Date, role: string, emotions: string[]}
            currentEmotions: [],         // Current emotions: [string]
            lastUserTimestamp: null,     // Timestamp (ms) of last *processed* user entry
            lastAITimestamp: null,     // Timestamp (ms) of last *processed* assistant entry
            refreshInterval: null,
            colors: { joy: '#FFD700', sadness: '#6495ED', anger: '#DC143C', fear: '#800080', surprise: '#FF8C00', disgust: '#228B22', trust: '#4682B4', anticipation: '#FF69B4', curiosity: '#1E90FF', confusion: '#A9A9A9', gratitude: '#32CD32', frustration: '#B22222', neutral: '#A9A9A9' },
            subscriptions: []
        },

        /** Initialize: Get DOM, render structure, set listeners, check initial state */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) { console.error(`Content element for ${this.id} not found`); return; }
            this.renderContent();
            const actionSubscription = Framework.on('activeActionsUpdated', (data) => { this.updateEmotionsState(data.actions); });
            this.state.subscriptions.push({ event: 'activeActionsUpdated', id: actionSubscription });
            const chatSubscription = Framework.on('chatUpdated', (data) => { /* Optionally check chat for hints */ });
            this.state.subscriptions.push({ event: 'chatUpdated', id: chatSubscription });
            this.checkInitialEmotionsState();
        },

        /** Check if 'emotions' action is running on load */
        checkInitialEmotionsState: function() {
            Framework.loadResource(CONFIG.api.activeActions)
                 .then(data => { this.updateEmotionsState(data?.actions || []); })
                 .catch(error => { console.error(`[${this.id}] Error checking initial state:`, error); this.updateEmotionsState([]); });
        },

        /** Update UI and polling based on 'emotions' action status */
        updateEmotionsState: function(actions = []) {
            const isEmotionsActive = actions.some(action => String(action || '').split(':')[0].trim().toLowerCase() === 'emotions');
            if (this.state.emotionsActive !== isEmotionsActive) {
                this.state.emotionsActive = isEmotionsActive;
                 console.log(`[${this.id}] Emotions action state changed: ${isEmotionsActive}`);
                if (this.dom.noteElement) this.dom.noteElement.style.display = isEmotionsActive ? 'none' : 'block';
                if (this.dom.emotionsContainer) this.dom.emotionsContainer.style.display = isEmotionsActive ? 'block' : 'none';
                if (isEmotionsActive) {
                    this.state.lastUserTimestamp = null; this.state.lastAITimestamp = null;
                    this.refreshEmotionData(); this.startRefreshInterval();
                } else { this.stopRefreshInterval(); }
            }
        },

        /** Starts the periodic polling interval */
        startRefreshInterval: function() {
            this.stopRefreshInterval();
            const intervalMs = 5000;
            this.state.refreshInterval = setInterval(() => this.refreshEmotionData(), intervalMs);
            // console.log(`[${this.id}] Started emotion data polling (interval: ${intervalMs}ms)`);
        },

        /** Stops the periodic polling interval */
        stopRefreshInterval: function() {
            if (this.state.refreshInterval) { clearInterval(this.state.refreshInterval); this.state.refreshInterval = null; }
        },

        /** Fetches and processes emotion data, triggers UI updates with animation info */
        refreshEmotionData: function() {
            if (!this.state.emotionsActive) return;

            fetch(CONFIG.api.emotions)
                .then(response => { if (!response.ok) throw new Error(`HTTP error ${response.status}`); return response.json(); })
                .then(data => {
                    if (!data?.success) throw new Error(data?.error || 'API error fetching emotions');

                    this.state.currentEmotions = data.current || [];
                    this.updateCurrentEmotions();

                    const newRawHistory = data.history || [];
                    const newProcessedHistory = newRawHistory
                        .map(item => ({ timestamp: new Date(item.timestamp), role: item.role, emotions: item.emotions }))
                        .filter(entry => entry.role !== 'current');

                    let latestNewUserTs = null, latestNewAITs = null;
                    for(let i = newProcessedHistory.length - 1; i >= 0; i--) {
                         const entry = newProcessedHistory[i]; const entryTs = entry.timestamp.getTime();
                         if(entry.role === 'user' && (latestNewUserTs === null || entryTs > latestNewUserTs)) { latestNewUserTs = entryTs; }
                         else if (entry.role === 'assistant' && (latestNewAITs === null || entryTs > latestNewAITs)) { latestNewAITs = entryTs; }
                    }

                    const isUserEntryNew = latestNewUserTs !== null && latestNewUserTs > (this.state.lastUserTimestamp || 0);
                    const isAIEntryNew = latestNewAITs !== null && latestNewAITs > (this.state.lastAITimestamp || 0);

                    const animationTimestamps = { user: isUserEntryNew ? latestNewUserTs : null, ai: isAIEntryNew ? latestNewAITs : null };

                    const historyNeedsUpdate = (isUserEntryNew || isAIEntryNew || this.state.emotionHistory.length !== newProcessedHistory.length);

                    if (historyNeedsUpdate) {
                         if(isUserEntryNew || isAIEntryNew) console.log(`[${this.id}] New data detected. User: ${isUserEntryNew}, AI: ${isAIEntryNew}. Animating.`);
                        this.state.emotionHistory = newProcessedHistory;
                        this.updateEmotionHistory(animationTimestamps);

                        if (isUserEntryNew) this.state.lastUserTimestamp = latestNewUserTs;
                        if (isAIEntryNew) this.state.lastAITimestamp = latestNewAITs;
                    }
                    this.updateEmotionChart();
                })
                .catch(error => {
                    console.error(`[${this.id}] Error fetching/processing emotion data:`, error);
                    if (this.dom.currentEmotionsDisplayArea) this.dom.currentEmotionsDisplayArea.innerHTML = '<span style="color:red;">Error</span>';
                    if (this.dom.historyContainer) this.dom.historyContainer.textContent = 'Error loading history.';
                    if (this.dom.chartContainer) this.dom.chartContainer.textContent = 'Error loading chart.';
                });
        },

        /** Renders the static panel structure */
        renderContent: function() {
            if (!this.dom.content) return; this.dom.content.innerHTML = '';
            const container = document.createElement('div'); container.className = 'emotions-panel';
            // Note
            const note = document.createElement('div'); note.className = 'emotions-note'; note.innerHTML = '<strong>Plugin Required:</strong> Start "emotions"'; note.style.cssText = "padding:8px;margin:5px 0;background-color:#fff4e5;border:1px solid #ffcc80;border-radius:4px;color:#e65100;text-align:center;font-size:11px;"; this.dom.noteElement = note; container.appendChild(note);
            // Main area
            const main = document.createElement('div'); main.className = 'emotions-container'; main.style.display=this.state.emotionsActive?'flex':'none'; main.style.flexDirection='column'; main.style.height='100%'; this.dom.emotionsContainer = main;
            // Compact Current
            const curSec=document.createElement('div'); curSec.className='current-emotions-section';
            const curHdr=document.createElement('div'); curHdr.className='current-section-header'; const curTitle=document.createElement('span'); curTitle.className='current-emotions-title'; curTitle.textContent='Current:'; const curDisp=document.createElement('span'); curDisp.className='current-emotions-display-area'; curDisp.textContent='...'; this.dom.currentEmotionsDisplayArea=curDisp; const refBtn=document.createElement('button'); refBtn.className='refresh-button compact-refresh'; refBtn.textContent='🔄'; refBtn.title='Refresh'; refBtn.onclick=()=>this.refreshEmotionData(); this.dom.refreshButton=refBtn; curHdr.append(curTitle,curDisp,refBtn); curSec.appendChild(curHdr); main.appendChild(curSec);
            // Chart
            const chartSec=document.createElement('div'); chartSec.className='emotion-chart-section'; const chartHdr=document.createElement('div'); chartHdr.className='section-header'; const chartTitle=document.createElement('h4'); chartTitle.textContent='Visualization'; chartHdr.appendChild(chartTitle); chartSec.appendChild(chartHdr); const chartCont=document.createElement('div'); chartCont.className='chart-container'; this.dom.chartContainer=chartCont; chartSec.appendChild(chartCont); main.appendChild(chartSec);
            // History
            const histSec=document.createElement('div'); histSec.className='emotion-history-section'; const histHdr=document.createElement('div'); histHdr.className='section-header'; const histTitle=document.createElement('h4'); histTitle.textContent='History (Newest)';
            const resetBtn=document.createElement('button'); resetBtn.className='reset-button'; resetBtn.textContent='🗑️ Reset'; resetBtn.title='Reset History'; resetBtn.onclick=()=>this.resetEmotionTracking(); this.dom.resetButton=resetBtn; histHdr.append(histTitle,resetBtn); histSec.appendChild(histHdr); const histCont=document.createElement('div'); histCont.className='history-container'; this.dom.historyContainer=histCont; histSec.appendChild(histCont); main.appendChild(histSec);
            container.appendChild(main); this.dom.content.appendChild(container);
            this.addStyles();
        },

        /** Adds necessary CSS styles, including compact history */
        addStyles: function() {
            const styleId = `${this.id}-styles`; if (document.getElementById(styleId)) return;
            const style = document.createElement('style'); style.id = styleId;
            const panelSelector = `#${this.id}-content .emotions-panel`;
            style.textContent = `
                /* --- Base/Note Styling --- */
                ${panelSelector} .emotions-container { padding: 5px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; gap: 5px; /* Add gap */ }
                ${panelSelector} .emotions-note { padding:8px; margin:5px 0; background-color:#fff4e5; border:1px solid #ffcc80; border-radius:4px; color:#e65100; text-align:center; font-size:11px; }

                /* --- Compact Current Emotions --- */
                ${panelSelector} .current-emotions-section { margin-bottom: 0 !important; flex-shrink: 0; } /* Remove bottom margin */
                ${panelSelector} .current-section-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px !important; background-color: #f8f9fa; border-radius: 4px; min-height: 26px; border: 1px solid #e0e0e0; }
                ${panelSelector} .current-emotions-title { margin: 0 4px 0 0; font-size: 11px; font-weight: bold; color: #555; flex-shrink: 0; }
                ${panelSelector} .current-emotions-display-area { flex-grow: 1; display: inline-flex; flex-wrap: wrap; gap: 2px; font-size: 10px; color: #888; min-height: 16px; line-height: 1.3; overflow: hidden; align-items: center; }
                ${panelSelector} .emotion-tag { padding: 1px 5px; margin: 0; border-radius: 8px; font-size: 10px; color: white; font-weight: 500; white-space: nowrap; }
                ${panelSelector} .compact-refresh { padding: 2px 4px; font-size: 13px; line-height: 1; border: none; border-radius: 3px; background-color: #e9ecef; color: #4a76a8; cursor: pointer; flex-shrink: 0; margin-left: 4px; }
                ${panelSelector} .compact-refresh:hover { background-color: #dfe3e6; }

                /* --- Section Headers (Chart/History) --- */
                ${panelSelector} .section-header { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 4px; border: 1px solid #e0e0e0;}
                ${panelSelector} .section-header h4 { margin: 0; font-size: 12px; font-weight: bold; color: #333; }

                /* --- Chart --- */
                ${panelSelector} .emotion-chart-section { margin-bottom: 0; flex-shrink: 0; }
                ${panelSelector} .chart-container { height: 65px; /* Reduced chart height */ padding: 6px; background-color: white; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden;}
                ${panelSelector} .emotion-bar { height: 11px; /* Reduced bar height */ margin: 1px 0; border-radius: 2px; position: relative; background-color: #f0f0f0; overflow: hidden; }
                ${panelSelector} .emotion-bar-fill { height: 100%; position: absolute; left: 0; top: 0; border-radius: 2px; transition: width 0.5s ease; }
                ${panelSelector} .emotion-bar-label { position: absolute; left: 3px; top: 0; bottom: 0; display: flex; align-items: center; font-size: 8px; /* Smaller label */ color: white; text-shadow: 0 0 1px rgba(0,0,0,0.7); white-space: nowrap; }
                ${panelSelector} .emotion-bar-value { display: none; /* Hide value by default for space */ }

                /* --- History (Compact Items) --- */
                ${panelSelector} .emotion-history-section { flex-grow: 1; display: flex; flex-direction: column; min-height: 0; }
                ${panelSelector} .history-container { flex-grow: 1; padding: 5px; background-color: white; border: 1px solid #e0e0e0; border-radius: 4px; overflow-y: auto; scrollbar-width: thin;}
                ${panelSelector} .history-container::-webkit-scrollbar { width: 4px; } /* Slimmer scrollbar */
                ${panelSelector} .history-container::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 2px; }
                ${panelSelector} .emotion-history-item {
                    padding: 3px 6px; /* Reduced padding */
                    margin-bottom: 3px; /* Reduced margin */
                    border-radius: 3px; /* Slightly smaller radius */
                    border-left-width: 3px; /* Slimmer side border */
                    background-color: #f9f9f9; transition: background-color 0.5s ease;
                 }
                ${panelSelector} .emotion-history-item.user { border-left-color: #4a76a8; }
                ${panelSelector} .emotion-history-item.assistant { border-left-color: #4CAF50; }
                ${panelSelector} .emotion-history-item .role { font-weight: bold; font-size: 10px; margin-bottom: 1px; color: #333;}
                ${panelSelector} .emotion-history-item .timestamp { font-size: 8px; color: #888; margin-bottom: 2px; }
                ${panelSelector} .emotion-history-item .emotions { display: flex; flex-wrap: wrap; gap: 2px; /* Smaller gap */ }
                /* History tag size reduction already handled by global .emotion-tag */
                ${panelSelector} .reset-button { padding: 2px 6px; font-size: 10px; border: none; border-radius: 3px; background-color: #ef5350; color: white; cursor: pointer; line-height: 1; margin-left: 5px;} /* Slightly less harsh red */
                ${panelSelector} .empty-message { padding: 10px; text-align: center; color: #999; font-style: italic; font-size: 11px; }
                /* History Item Animation */
                @keyframes highlight-fade { 0% { background-color: #fffadd;} 70% { background-color: #fffadd;} 100% { background-color: #f9f9f9;} }
                ${panelSelector} .emotion-history-item.new-emotion-entry { animation: highlight-fade 1.5s ease-out forwards; }
                /* --- End CSS --- */
            `;
            document.head.appendChild(style);
        },

        /** Updates compact display with current tags */
        updateCurrentEmotions: function() {
            if (!this.dom.currentEmotionsDisplayArea) return;
            const displayArea = this.dom.currentEmotionsDisplayArea;
            if (!this.state.currentEmotions || this.state.currentEmotions.length === 0) { displayArea.innerHTML = '<span style="color:#888; font-style:italic;">None</span>'; return; }
            displayArea.innerHTML = '';
            this.state.currentEmotions.forEach(emo => { const tag=document.createElement('span'); tag.className='emotion-tag'; tag.textContent=emo; tag.style.backgroundColor=this.state.colors[emo]||'#999'; displayArea.appendChild(tag); });
        },

        /**
         * Updates history list (newest first) & applies animation selectively.
         * @param {object} animationTimestamps - Contains {user: timestamp|null, ai: timestamp|null} for new entries.
         */
        updateEmotionHistory: function(animationTimestamps = { user: null, ai: null }) {
            if (!this.dom.historyContainer) return; const historyContainer = this.dom.historyContainer; historyContainer.innerHTML = '';
            if (!this.state.emotionHistory || this.state.emotionHistory.length === 0) { const m=document.createElement('div'); m.className='empty-message'; m.textContent='No history.'; historyContainer.appendChild(m); return; }

            this.state.emotionHistory.forEach(entry => {
                const item = document.createElement('div'); item.className = `emotion-history-item ${entry.role}`;
                const role=document.createElement('div'); role.className='role'; role.textContent=entry.role==='user'?'User':'AI'; item.appendChild(role);
                const time=document.createElement('div'); time.className='timestamp'; time.textContent=entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); item.appendChild(time); // Format time
                const emos=document.createElement('div'); emos.className='emotions';
                entry.emotions.forEach(emo=>{const tag=document.createElement('span'); tag.className='emotion-tag'; tag.textContent=emo; tag.style.backgroundColor=this.state.colors[emo]||'#999'; emos.appendChild(tag);});
                item.appendChild(emos);

                const entryTs = entry.timestamp.getTime();
                const shouldAnimate = ( (entry.role === 'user' && entryTs === animationTimestamps.user) || (entry.role === 'assistant' && entryTs === animationTimestamps.ai) );

                if (shouldAnimate) {
                     // console.log(`[${this.id}] Animating ${entry.role} @ ${time.textContent}`);
                    item.classList.add('new-emotion-entry');
                    setTimeout(() => { item?.classList.remove('new-emotion-entry'); }, 1500);
                }
                historyContainer.insertBefore(item, historyContainer.firstChild); // Prepend
            });
        },

        /** Updates the compact bar chart */
        updateEmotionChart: function() {
             if (!this.dom.chartContainer) return; this.dom.chartContainer.innerHTML = ''; const history = this.state.emotionHistory;
             if (!history || history.length === 0) { const m=document.createElement('div'); m.className='empty-message'; m.textContent='No chart data.'; this.dom.chartContainer.appendChild(m); return; }
             const counts = {}; let total = 0;
             history.forEach(e => e.emotions.forEach(emo => { counts[emo] = (counts[emo] || 0) + 1; total++; }));
             if (total === 0) { const m=document.createElement('div'); m.className='empty-message'; m.textContent='No emotions.'; this.dom.chartContainer.appendChild(m); return; }
             const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4); // Even fewer bars? Top 4
             const chart = document.createElement('div'); chart.style.cssText = "display:flex;flex-direction:column;height:100%;justify-content:space-around;";
             sorted.forEach(([emo, count]) => {
                 const perc = Math.round((count / total) * 100);
                 const bar = document.createElement('div'); bar.className='emotion-bar'; bar.title=`${emo}: ${count} (${perc}%)`;
                 const fill = document.createElement('div'); fill.className='emotion-bar-fill'; fill.style.width=`${perc}%`; fill.style.backgroundColor=this.state.colors[emo]||'#999';
                 const lbl = document.createElement('div'); lbl.className='emotion-bar-label'; lbl.textContent=emo;
                 // Don't show percentage value in bar to save space
                 bar.append(fill, lbl); chart.appendChild(bar);
             });
             this.dom.chartContainer.appendChild(chart);
        },

        /** Resets tracking via command, clears local state/UI */
        resetEmotionTracking: function() {
            if (!confirm('Reset emotion tracking history?')) return;
            Framework.sendMessage('emotions reset');
            this.state.currentEmotions = []; this.state.emotionHistory = [];
            this.state.lastUserTimestamp = null; this.state.lastAITimestamp = null;
            this.updateCurrentEmotions(); this.updateEmotionHistory(false); this.updateEmotionChart();
            Framework.showToast('Emotion tracking reset command sent.');
        },

        /** Cleans up intervals, listeners, styles */
        cleanup: function() {
            this.stopRefreshInterval();
            this.state.subscriptions.forEach(sub => { Framework.off(sub.event, sub.id); }); this.state.subscriptions = [];
            const style = document.getElementById(`${this.id}-styles`); if (style) style.remove();
             // console.log(`[${this.id}] Emotions component cleaned up.`);
        }
    }; // End component object

    Framework.registerComponent(component.id, component); // Register with framework
})(); // End IIFE