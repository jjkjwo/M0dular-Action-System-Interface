/**
 * ==============================================================================================
 * Right Panel 2 - Advanced Theme Customization Component
 * ==============================================================================================
 *
 * Enhanced theme panel with advanced customization options, theme management,
 * accessibility features, color manipulation, and improved visual feedback.
 * FORCED VERTICAL LAYOUT FOR NARROW PANELS.
 *
 * @version 4.1.7 - Targeted fix for vertical tab button sizing and layout.
 */

(function() {
    // Component definition
    const component = {
        id: 'right-panel-2',

        // DOM references
        dom: {
            content: null, tabs: {}, colorInputs: {}, fontInputs: {}, spacingInputs: {},
            previewElement: null, themePresets: null, customThemeContainer: null,
            componentPreviewContainer: null, accessibilityResults: null
        },

        // Component state
        state: {
             originalTheme: { /* ... same ... */
                primary: '#4a76a8', primaryDark: '#2c4a6b', primaryLight: '#e3f2fd',
                secondary: '#f0f8ff', text: '#333333', background: '#f5f5f5',
                fontFamily: 'Arial, sans-serif', fontSize: '1rem', borderRadius: '5px',
                spacing: 'normal', transitionSpeed: '0.3s', transitionEasing: 'ease'
            },
            currentTheme: {}, hasChanges: false, previewActive: false, savedThemes: [],
            activeTab: 'colors', colorErrors: {},
            presetThemes: [ /* ... same ... */
                { name: 'Default Blue', primary: '#4a76a8', secondary: '#f0f8ff', background: '#f5f5f5', text: '#333333' },
                { name: 'Dark Mode', primary: '#3d5a80', secondary: '#293241', background: '#1e1e1e', text: '#e0fbfc' },
                { name: 'Forest', primary: '#2a9d8f', secondary: '#e9f5db', background: '#f8f9fa', text: '#333333' },
                { name: 'Sunset', primary: '#e76f51', secondary: '#ffd8be', background: '#fff1e6', text: '#333333' },
                { name: 'Lavender', primary: '#7209b7', secondary: '#f3d5fa', background: '#fbf8ff', text: '#333333' },
                { name: 'High Contrast', primary: '#0000ff', secondary: '#ffffff', background: '#ffffff', text: '#000000', borderRadius: '2px' },
                { name: 'Monochrome', primary: '#404040', secondary: '#f5f5f5', background: '#ffffff', text: '#202020' }
            ]
        },

        // --- Initialization ---
        initialize: function() { /* ... same as v4.1.6 ... */
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) { console.error(`Content element for ${this.id} not found`); return; }
            this.loadCurrentTheme();
            try { const saved = localStorage.getItem('customThemes'); if (saved) { this.state.savedThemes = JSON.parse(saved); } } catch (e) { console.warn('Could not load saved themes', e); }
            this.renderContent();
            this.setupEventListeners();
            this.dom.content.classList.add('vertical-layout-theme-panel');
        },

        // --- Theme State Loading ---
        loadCurrentTheme: function() { /* ... same as v4.1.6 ... */
            const style = getComputedStyle(document.documentElement);
            const theme = {
                primary: style.getPropertyValue('--color-primary').trim() || this.state.originalTheme.primary,
                primaryDark: style.getPropertyValue('--color-primary-dark').trim() || this.state.originalTheme.primaryDark,
                primaryLight: style.getPropertyValue('--color-primary-light').trim() || this.state.originalTheme.primaryLight,
                secondary: style.getPropertyValue('--color-secondary').trim() || this.state.originalTheme.secondary,
                text: style.getPropertyValue('--color-text').trim() || this.state.originalTheme.text,
                background: style.getPropertyValue('--color-background').trim() || this.state.originalTheme.background,
                fontFamily: style.getPropertyValue('--font-family').trim() || this.state.originalTheme.fontFamily,
                fontSize: style.getPropertyValue('--font-size-md').trim() || this.state.originalTheme.fontSize,
                borderRadius: style.getPropertyValue('--border-radius-md').trim() || this.state.originalTheme.borderRadius,
                transitionSpeed: style.getPropertyValue('--transition-normal').trim() || this.state.originalTheme.transitionSpeed,
                transitionEasing: 'ease',
                spacing: (spaceVal => { const val = style.getPropertyValue('--space-md').trim(); if (val === '10px') return 'compact'; if (val === '20px') return 'comfortable'; return 'normal'; })()
            };
            this.state.originalTheme = {...theme};
            this.state.currentTheme = {...theme};
        },

        // --- Content Rendering (Forced Vertical) ---
        renderContent: function() { /* ... same structure as v4.1.6 ... */
            if (!this.dom.content) return; this.dom.content.innerHTML = '';
            const container = document.createElement('div'); container.className = 'theme-customizer vertical-layout-theme-panel';
            const header = document.createElement('div'); header.className = 'theme-header'; const title = document.createElement('h4'); title.className = 'customizer-title'; title.textContent = 'Theme Customization'; header.appendChild(title); container.appendChild(header);
            const tabsContainer = document.createElement('div'); tabsContainer.className = 'tabs-container';
            const tabHeaders = document.createElement('div'); tabHeaders.className = 'tab-headers vertical-tabs'; tabHeaders.setAttribute('role', 'tablist'); tabHeaders.setAttribute('aria-orientation', 'vertical');
            const tabs = [ {id: 'colors', label: 'Colors', icon: '🎨'}, {id: 'typography', label: 'Text', icon: 'Aa'}, {id: 'layout', label: 'Layout', icon: '⚙️'}, {id: 'presets', label: 'Presets', icon: '📋'}, {id: 'themes', label: 'My Themes', icon: '💾'} ];
            tabs.forEach(tab => { const tabHeader = document.createElement('div'); tabHeader.className = `tab-header ${tab.id === this.state.activeTab ? 'active' : ''}`; tabHeader.dataset.tab = tab.id; tabHeader.id = `tab-header-${tab.id}`; tabHeader.innerHTML = `<span class="tab-icon" aria-hidden="true">${tab.icon}</span><span class="tab-label">${tab.label}</span>`; tabHeader.setAttribute('role', 'tab'); tabHeader.setAttribute('aria-selected', tab.id === this.state.activeTab); tabHeader.setAttribute('aria-controls', `tab-content-${tab.id}`); tabHeader.tabIndex = tab.id === this.state.activeTab ? 0 : -1; tabHeader.addEventListener('click', () => this.switchTab(tab.id)); tabHeader.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.switchTab(tab.id); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const currentIdx = tabs.findIndex(t => t.id === tab.id); const nextIdx = (e.key === 'ArrowDown') ? (currentIdx + 1) % tabs.length : (currentIdx - 1 + tabs.length) % tabs.length; const nextTabHeader = tabHeaders.querySelector(`[data-tab="${tabs[nextIdx].id}"]`); if (nextTabHeader) nextTabHeader.focus(); } }); tabHeaders.appendChild(tabHeader); });
            tabsContainer.appendChild(tabHeaders);
            const tabContents = document.createElement('div'); tabContents.className = 'tab-contents';
            tabs.forEach(tab => { const tabContent = document.createElement('div'); tabContent.className = 'tab-content'; tabContent.id = `tab-content-${tab.id}`; tabContent.dataset.tab = tab.id; tabContent.style.display = this.state.activeTab === tab.id ? 'block' : 'none'; tabContent.setAttribute('role', 'tabpanel'); tabContent.setAttribute('aria-labelledby', `tab-header-${tab.id}`);
                switch(tab.id) { case 'colors': tabContent.appendChild(this.createColorControls()); break; case 'typography': tabContent.appendChild(this.createTypographyControls()); break; case 'layout': tabContent.appendChild(this.createLayoutControls()); break; case 'presets': tabContent.appendChild(this.createPresetControls()); break; case 'themes': tabContent.appendChild(this.createThemesControls()); break; }
                this.dom.tabs[tab.id] = tabContent; tabContents.appendChild(tabContent);
            });
            tabsContainer.appendChild(tabContents); container.appendChild(tabsContainer);
            const previewSection = document.createElement('div'); previewSection.className = 'preview-section'; const previewElement = document.createElement('div'); previewElement.className = 'theme-preview'; this.dom.previewElement = previewElement; const previewToggleContainer = document.createElement('div'); previewToggleContainer.className = 'preview-toggle-container'; const previewToggle = document.createElement('input'); previewToggle.type = 'checkbox'; previewToggle.id = 'previewToggle'; previewToggle.className = 'toggle-checkbox'; previewToggle.checked = this.state.previewActive; const previewToggleLabel = document.createElement('label'); previewToggleLabel.setAttribute('for', 'previewToggle'); previewToggleLabel.textContent = 'Live Preview'; previewToggleContainer.appendChild(previewToggle); previewToggleContainer.appendChild(previewToggleLabel); previewSection.appendChild(previewElement); previewSection.appendChild(previewToggleContainer); container.appendChild(previewSection);
            const actionButtons = document.createElement('div'); actionButtons.className = 'action-buttons'; const resetButton = document.createElement('button'); resetButton.textContent = 'Reset'; resetButton.className = 'reset-button'; const applyButton = document.createElement('button'); applyButton.textContent = 'Apply'; applyButton.className = 'apply-button'; applyButton.disabled = !this.state.hasChanges; actionButtons.appendChild(resetButton); actionButtons.appendChild(applyButton); container.appendChild(actionButtons);
            this.dom.content.appendChild(container); this.addStyles(); this.updatePreview();
         },

        // --- Control Creation Functions (Unchanged) ---
        createColorControls: function() { /* ... same as v4.1.6 ... */
            const section = document.createElement('div'); section.className = 'color-section';
            const colorItems = [ { id: 'primary', label: 'Primary' }, { id: 'primaryDark', label: 'Dark' }, { id: 'primaryLight', label: 'Light' }, { id: 'secondary', label: 'Secondary' }, { id: 'text', label: 'Text' }, { id: 'background', label: 'BG' } ]; this.dom.colorInputs = {};
            const colorGrid = document.createElement('div'); colorGrid.className = 'color-grid'; // CSS: single column
            colorItems.forEach(item => { const colorItem = document.createElement('div'); colorItem.className = 'color-item'; /* CSS: flex-wrap */ const colorLabel = document.createElement('label'); colorLabel.setAttribute('for', `color-${item.id}`); colorLabel.className = 'color-label'; colorLabel.textContent = item.label; const inputContainer = document.createElement('div'); inputContainer.className = 'color-input-container'; const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.id = `color-${item.id}`; colorInput.className = 'color-input'; colorInput.value = this.state.currentTheme[item.id]; colorInput.dataset.color = item.id; this.dom.colorInputs[item.id] = colorInput; const textInput = document.createElement('input'); textInput.type = 'text'; textInput.className = 'color-text-input'; textInput.value = this.state.currentTheme[item.id]; textInput.dataset.color = item.id; textInput.maxLength = 7; textInput.pattern = '^#([0-9A-F]{3}){1,2}$';
                colorInput.addEventListener('input', () => { textInput.value = colorInput.value; this.updateColor(item.id, colorInput.value); textInput.classList.remove('error'); this.state.colorErrors[item.id] = false; });
                textInput.addEventListener('input', () => { const v = textInput.value.trim(); if(v===''||v==='#'){textInput.classList.remove('error');this.state.colorErrors[item.id]=false;return;} if (/^#([0-9A-F]{3}){1,2}$/i.test(v)) { colorInput.value = v; this.updateColor(item.id, v); textInput.classList.remove('error'); this.state.colorErrors[item.id] = false; } else { textInput.classList.add('error'); this.state.colorErrors[item.id] = true; } });
                textInput.addEventListener('blur', () => { const v = textInput.value.trim(); if (v !== '' && !/^#([0-9A-F]{3}){1,2}$/i.test(v)) { textInput.classList.add('error'); this.state.colorErrors[item.id] = true; } else { textInput.classList.remove('error'); this.state.colorErrors[item.id] = false; } });
                inputContainer.appendChild(colorInput); inputContainer.appendChild(textInput); colorItem.appendChild(colorLabel); colorItem.appendChild(inputContainer); colorGrid.appendChild(colorItem);
            });
            section.appendChild(colorGrid);
            const contrastSection = document.createElement('div'); contrastSection.className = 'contrast-section'; const contrastSamples = document.createElement('div'); contrastSamples.className = 'contrast-samples'; const textOnBg = document.createElement('div'); textOnBg.className = 'contrast-sample'; textOnBg.id = 'text-on-bg'; textOnBg.textContent = 'T/BG'; const textOnPrimary = document.createElement('div'); textOnPrimary.className = 'contrast-sample'; textOnPrimary.id = 'text-on-primary'; textOnPrimary.textContent = 'T/Pri'; contrastSamples.appendChild(textOnBg); contrastSamples.appendChild(textOnPrimary); const contrastScore = document.createElement('div'); contrastScore.className = 'contrast-score'; contrastScore.id = 'contrast-score'; contrastSection.appendChild(contrastSamples); contrastSection.appendChild(contrastScore); section.appendChild(contrastSection);
            const schemeButtons = document.createElement('div'); schemeButtons.className = 'scheme-buttons'; const schemes = [{ id: 'complementary', label: 'Complementary' }, { id: 'monochromatic', label: 'Monochrome' }]; schemes.forEach(s => { const btn = document.createElement('button'); btn.className = 'scheme-button'; btn.textContent = s.label; btn.addEventListener('click', () => this.generateColorScheme(s.id)); schemeButtons.appendChild(btn); }); section.appendChild(schemeButtons);
            const schemePreview = document.createElement('div'); schemePreview.className = 'scheme-preview'; schemePreview.id = 'scheme-preview'; section.appendChild(schemePreview);
            setTimeout(() => this.updateContrastInfo(), 0); return section;
        },
        createTypographyControls: function() { /* ... same as v4.1.6 ... */
            const section = document.createElement('div'); section.className = 'typography-section';
            const ffContainer = document.createElement('div'); ffContainer.className = 'control-group'; const ffLabel = document.createElement('label'); ffLabel.setAttribute('for', 'font-family'); ffLabel.textContent = 'Font Family'; const ffSelect = document.createElement('select'); ffSelect.id = 'font-family'; ffSelect.className = 'select-input'; const ffOptions = [ { value: 'Arial, sans-serif', label: 'Arial' }, { value: 'Verdana, sans-serif', label: 'Verdana' }, { value: 'Tahoma, sans-serif', label: 'Tahoma' }, { value: 'Georgia, serif', label: 'Georgia' }, { value: '"Times New Roman", serif', label: 'Times New Roman' }, { value: '"Courier New", monospace', label: 'Courier New' } ]; ffOptions.forEach(opt => { const el = document.createElement('option'); el.value = opt.value; el.textContent = opt.label; el.selected = this.state.currentTheme.fontFamily.includes(opt.label); ffSelect.appendChild(el); }); this.dom.fontInputs = { fontFamily: ffSelect }; ffContainer.appendChild(ffLabel); ffContainer.appendChild(ffSelect);
            const fsContainer = document.createElement('div'); fsContainer.className = 'control-group'; const fsLabel = document.createElement('label'); fsLabel.setAttribute('for', 'font-size-slider'); fsLabel.textContent = 'Font Size'; const fsValue = document.createElement('span'); fsValue.className = 'slider-value'; const origFsPx = parseFloat(this.state.originalTheme.fontSize.replace(/[^\d.]/g, '')) || 16; const currFsPx = parseFloat(this.state.currentTheme.fontSize.replace(/[^\d.]/g, '')) || 16; const initPerc = Math.round((currFsPx / origFsPx) * 100); fsValue.textContent = `${initPerc}%`; fsLabel.appendChild(fsValue); const fsSlider = document.createElement('input'); fsSlider.type = 'range'; fsSlider.id = 'font-size-slider'; fsSlider.className = 'slider-input'; fsSlider.min = 75; fsSlider.max = 150; fsSlider.step = 5; fsSlider.value = initPerc; this.dom.fontInputs.fontSize = fsSlider; fsSlider.addEventListener('input', () => { const perc = parseInt(fsSlider.value); fsValue.textContent = `${perc}%`; const base = parseFloat(this.state.originalTheme.fontSize.replace(/[^\d.]/g, '')) || 16; const newPx = (base * perc / 100); this.updateTypography('fontSize', `${(newPx / 16).toFixed(2)}rem`); }); fsContainer.appendChild(fsLabel); fsContainer.appendChild(fsSlider);
            const textSample = document.createElement('div'); textSample.className = 'text-sample'; const sampleContainer = document.createElement('div'); sampleContainer.className = 'sample-container'; sampleContainer.innerHTML = `<h6 class="sample-heading">Quick brown fox</h6><p class="sample-paragraph">Lorem ipsum dolor sit.</p><button class="sample-button">Button</button>`; textSample.appendChild(sampleContainer);
            section.appendChild(ffContainer); section.appendChild(fsContainer); section.appendChild(textSample); setTimeout(() => this.updateSampleText(), 0); return section;
        },
        createLayoutControls: function() { /* ... same as v4.1.6 ... */
             const section = document.createElement('div'); section.className = 'layout-section';
            const brContainer = document.createElement('div'); brContainer.className = 'control-group'; const brLabel = document.createElement('label'); brLabel.setAttribute('for', 'border-radius-slider'); brLabel.textContent = 'Border Radius'; const brValue = document.createElement('span'); brValue.className = 'slider-value'; brValue.textContent = this.state.currentTheme.borderRadius; brLabel.appendChild(brValue); const brSlider = document.createElement('input'); brSlider.type = 'range'; brSlider.id = 'border-radius-slider'; brSlider.className = 'slider-input'; brSlider.min = 0; brSlider.max = 20; brSlider.value = parseInt(this.state.currentTheme.borderRadius) || 5; this.dom.spacingInputs = { borderRadius: brSlider }; brSlider.addEventListener('input', () => { const v = `${brSlider.value}px`; brValue.textContent = v; this.updateLayout('borderRadius', v); }); brContainer.appendChild(brLabel); brContainer.appendChild(brSlider);
            const spContainer = document.createElement('div'); spContainer.className = 'control-group'; const spLabel = document.createElement('div'); spLabel.className = 'control-label'; spLabel.textContent = 'Density'; spLabel.id = 'spacing-label'; const spOptions = document.createElement('div'); spOptions.className = 'button-group'; spOptions.setAttribute('role', 'radiogroup'); spOptions.setAttribute('aria-labelledby', 'spacing-label'); const spValues = [{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'comfortable', label: 'Comfy' }]; spValues.forEach(opt => { const btn = document.createElement('button'); btn.type = 'button'; const active = this.state.currentTheme.spacing === opt.value; btn.className = `option-button ${active ? 'active' : ''}`; btn.textContent = opt.label; btn.dataset.value = opt.value; btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', active); btn.tabIndex = active ? 0 : -1; btn.addEventListener('click', () => { spOptions.querySelectorAll('.option-button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1; }); btn.classList.add('active'); btn.setAttribute('aria-checked', 'true'); btn.tabIndex = 0; this.updateLayout('spacing', opt.value); }); /* ... keydown nav ... */ spOptions.appendChild(btn); }); spContainer.appendChild(spLabel); spContainer.appendChild(spOptions);
            const trContainer = document.createElement('div'); trContainer.className = 'control-group'; const trLabel = document.createElement('label'); trLabel.setAttribute('for', 'transition-speed-slider'); trLabel.textContent = 'Animation Speed'; const trValue = document.createElement('span'); trValue.className = 'slider-value'; trValue.textContent = this.state.currentTheme.transitionSpeed || '0.3s'; trLabel.appendChild(trValue); const trSlider = document.createElement('input'); trSlider.type = 'range'; trSlider.id = 'transition-speed-slider'; trSlider.className = 'slider-input'; trSlider.min = 0; trSlider.max = 1000; trSlider.step = 50; trSlider.value = (parseFloat(this.state.currentTheme.transitionSpeed) || 0.3) * 1000; this.dom.spacingInputs.transitionSpeed = trSlider; trSlider.addEventListener('input', () => { const v = `${(trSlider.value / 1000).toFixed(2)}s`; trValue.textContent = v; this.updateLayout('transitionSpeed', v); }); trContainer.appendChild(trLabel); trContainer.appendChild(trSlider);
            section.appendChild(brContainer); section.appendChild(spContainer); section.appendChild(trContainer); return section;
        },
        createPresetControls: function() { /* ... same as v4.1.6 ... */
            const section = document.createElement('div'); section.className = 'preset-section'; const title = document.createElement('h5'); title.textContent = 'Theme Presets'; title.id = 'preset-title'; const container = document.createElement('div'); container.className = 'preset-container'; /* CSS: single column */ container.setAttribute('role', 'listbox'); container.setAttribute('aria-labelledby', 'preset-title');
            this.state.presetThemes.forEach((preset, index) => { const btn = document.createElement('div'); btn.className = 'theme-preset-button'; /* CSS: row layout */ btn.dataset.index = index; btn.style.backgroundColor = preset.primary; btn.title = `Apply ${preset.name} theme`; btn.tabIndex = 0; btn.setAttribute('role', 'option'); btn.setAttribute('aria-label', preset.name); const name = document.createElement('span'); name.className = 'preset-name'; name.textContent = preset.name; const preview = document.createElement('div'); preview.className = 'mini-preview'; preview.style.backgroundColor = preset.background; preview.innerHTML = `<div class="mini-text" style="color: ${preset.text}">T</div>`; btn.appendChild(name); btn.appendChild(preview); btn.addEventListener('click', () => this.applyPreset(index)); btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.applyPreset(index); } }); container.appendChild(btn); });
            this.dom.themePresets = container; section.appendChild(title); section.appendChild(container); return section;
        },
        createThemesControls: function() { /* ... same as v4.1.6 ... */
            const section = document.createElement('div'); section.className = 'themes-section'; const title = document.createElement('h5'); title.textContent = 'Saved Themes';
            const saveContainer = document.createElement('div'); saveContainer.className = 'save-theme-container'; /* CSS: column */ const saveInput = document.createElement('input'); saveInput.type = 'text'; saveInput.id = 'save-theme-input'; saveInput.className = 'theme-name-input'; saveInput.placeholder = 'New theme name'; const saveButton = document.createElement('button'); saveButton.id = 'save-theme-button'; saveButton.className = 'save-theme-button'; saveButton.textContent = 'Save Theme'; saveButton.addEventListener('click', () => { const name = saveInput.value.trim(); if(name) { this.saveCustomTheme(name); saveInput.value=''; } else { Framework.showToast('Enter name'); saveInput.focus();} }); saveInput.addEventListener('keydown', (e)=>{if(e.key==='Enter'){e.preventDefault();saveButton.click();}}); saveContainer.appendChild(saveInput); saveContainer.appendChild(saveButton);
            const listContainer = document.createElement('div'); listContainer.className = 'custom-theme-container'; listContainer.id = 'custom-themes-list'; this.dom.customThemeContainer = listContainer; this.renderSavedThemes(); // Populate
            const ieContainer = document.createElement('div'); ieContainer.className = 'export-import-container'; /* CSS: column */ const exportBtn = document.createElement('button'); exportBtn.className = 'export-button'; exportBtn.textContent = 'Export Themes'; exportBtn.addEventListener('click', () => this.exportThemes()); const importLabel = document.createElement('label'); importLabel.className = 'import-label button-like'; importLabel.textContent = 'Import Themes'; importLabel.setAttribute('for', 'import-themes'); importLabel.tabIndex = 0; importLabel.setAttribute('role', 'button'); importLabel.addEventListener('keydown', (e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();importInput.click();}}); const importInput = document.createElement('input'); importInput.type = 'file'; importInput.id = 'import-themes'; importInput.className = 'import-input visually-hidden'; importInput.accept = '.json,application/json'; importInput.addEventListener('change', (e) => this.importThemes(e)); ieContainer.appendChild(exportBtn); ieContainer.appendChild(importLabel); ieContainer.appendChild(importInput);
            section.appendChild(title); section.appendChild(saveContainer); section.appendChild(listContainer); section.appendChild(ieContainer); return section;
        },

        // --- Styles (FOCUS ON FIXING BUTTON/LAYOUT WIDTHS) ---
        addStyles: function() {
            const styleId = 'theme-customizer-styles'; if (document.getElementById(styleId)) return; const style = document.createElement('style'); style.id = styleId; style.textContent = `
                /* Ensure parent panel allows flex content to scroll */
                #${this.id}-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; box-sizing: border-box; }

                /* Base Container - Forced Vertical */
                .vertical-layout-theme-panel .theme-customizer { display: flex; flex-direction: column; height: 100%; padding: 8px; overflow: hidden; box-sizing: border-box; }
                .vertical-layout-theme-panel .theme-header { flex-shrink: 0; margin-bottom: 8px; }
                .vertical-layout-theme-panel .customizer-title { margin: 0; font-size: 1rem; font-weight: bold; color: var(--color-primary); }

                /* Tabs Container - Row Layout */
                .vertical-layout-theme-panel .tabs-container { display: flex; flex-direction: row; border: 1px solid var(--color-border-light); border-radius: var(--border-radius-md); overflow: hidden; flex: 1; min-height: 0; }

                /* >>> FIX 1: Vertical Tab Headers Width <<< */
                .vertical-layout-theme-panel .tab-headers.vertical-tabs {
                    display: flex; flex-direction: column; flex-shrink: 0;
                    border-right: 1px solid var(--color-border-light); background-color: var(--color-secondary);
                    /* *** FIXED WIDTH - ADJUST AS NEEDED *** */
                    width: 75px; /* <<<< REDUCED WIDTH */
                    overflow-y: auto; scrollbar-width: thin;
                }
                .vertical-layout-theme-panel .tab-headers.vertical-tabs::-webkit-scrollbar { width: 4px; }
                .vertical-layout-theme-panel .tab-headers.vertical-tabs::-webkit-scrollbar-thumb { background-color: var(--color-border); border-radius: 2px; }

                /* >>> FIX 2: Vertical Tab Button Styling (Padding, Font, Gap) <<< */
                .vertical-layout-theme-panel .tab-header {
                    padding: 6px 4px; /* <<<< REDUCED PADDING */
                    cursor: pointer; text-align: left; white-space: normal; /* Allow wrap */
                    font-size: 0.75em; /* <<<< REDUCED FONT SIZE */
                    display: flex; align-items: center; justify-content: flex-start;
                    gap: 3px; /* <<<< REDUCED GAP */
                    border-right: 3px solid transparent; border-bottom: 1px solid var(--color-border-light);
                    transition: background-color 0.2s, border-color 0.2s, color 0.2s; color: var(--color-text-light); flex-shrink: 0;
                    min-height: 30px; /* Reduced min height */
                    box-sizing: border-box; /* Include padding in height calculation */
                    overflow: hidden; /* Hide overflow within button */
                }
                .vertical-layout-theme-panel .tab-header:last-child { border-bottom: none; }
                .vertical-layout-theme-panel .tab-header:hover, .vertical-layout-theme-panel .tab-header:focus { background-color: rgba(0,0,0,0.05); color: var(--color-text); outline: none; }
                .vertical-layout-theme-panel .tab-header:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; z-index: 1; }
                .vertical-layout-theme-panel .tab-header.active { background-color: var(--color-background); color: var(--color-primary); font-weight: bold; border-right-color: var(--color-primary); }
                .vertical-layout-theme-panel .tab-icon {
                    font-size: 0.9em; /* <<<< REDUCED ICON SIZE */
                    flex-shrink: 0; margin-right: 2px; /* Reduced margin */
                    line-height: 1; /* Ensure icon aligns well */
                 }
                .vertical-layout-theme-panel .tab-label {
                    line-height: 1.2; /* Adjust line height for wrapping */
                    /* text-overflow: ellipsis; */ /* Might not be needed if wrapping */
                    /* white-space: nowrap; */ /* Remove this if wrapping is desired */
                }

                /* >>> FIX 3: Tab Content Area Width & Scroll <<< */
                .vertical-layout-theme-panel .tab-contents {
                    background-color: var(--color-background); padding: 10px;
                    overflow-y: auto; /* Enable vertical scrolling */
                    flex: 1; /* Take remaining horizontal space */
                    min-width: 0; /* Crucial: Allow shrinking below intrinsic width */
                    box-sizing: border-box;
                }

                /* General Controls (Mostly unchanged) */
                .vertical-layout-theme-panel .control-group { margin-bottom: 10px; }
                .vertical-layout-theme-panel .control-label, .vertical-layout-theme-panel label { display: block; margin-bottom: 4px; font-size: 0.8em; font-weight: bold; color: var(--color-text); }
                .vertical-layout-theme-panel input[type="text"], .vertical-layout-theme-panel input[type="color"], .vertical-layout-theme-panel input[type="range"], .vertical-layout-theme-panel select, .vertical-layout-theme-panel button { font-size: 0.8em; border-radius: var(--border-radius-sm); }
                .vertical-layout-theme-panel input[type="text"], .vertical-layout-theme-panel select { padding: 4px 6px; border: 1px solid var(--color-border); width: 100%; box-sizing: border-box; }
                .vertical-layout-theme-panel input[type="color"] { padding: 1px; border: 1px solid var(--color-border); height: 22px; min-width: 22px; vertical-align: middle; cursor: pointer; }
                .vertical-layout-theme-panel input[type="range"] { width: 100%; margin-top: 3px; height: 18px; cursor: pointer; }
                .vertical-layout-theme-panel button, .vertical-layout-theme-panel .button-like { padding: 5px 10px; cursor: pointer; }
                .vertical-layout-theme-panel .slider-value { margin-left: 6px; font-weight: normal; color: var(--color-text-light); font-size: 0.75em; }

                /* Color Controls - Vertical Layout (Should fit better now) */
                .vertical-layout-theme-panel .color-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 8px; }
                .vertical-layout-theme-panel .color-item { display: flex; flex-direction: column; gap: 3px; }
                .vertical-layout-theme-panel .color-label { margin-bottom: 2px; font-size: 0.78em; }
                .vertical-layout-theme-panel .color-input-container { display: flex; align-items: center; gap: 4px; width: 100%; }
                .vertical-layout-theme-panel .color-input { flex-shrink: 0; }
                .vertical-layout-theme-panel .color-text-input { flex: 1; min-width: 40px; }
                .vertical-layout-theme-panel .color-text-input.error { border-color: #f44336; background-color: #ffebee; }

                /* Scheme/Contrast - Vertical Layout (Adjusted for space) */
                .vertical-layout-theme-panel .scheme-buttons { display: flex; flex-direction: column; gap: 5px; margin: 10px 0 8px; }
                .vertical-layout-theme-panel .scheme-button { width: 100%; text-align: center; background-color: var(--color-primary); color:white; border:none; }
                .vertical-layout-theme-panel .scheme-preview { display: none; }
                .vertical-layout-theme-panel .contrast-section { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--color-border-light); }
                .vertical-layout-theme-panel .contrast-samples { display: flex; gap: 5px; margin-bottom: 5px; justify-content: space-around; }
                .vertical-layout-theme-panel .contrast-sample { flex: 1 1 45%; /* Allow two samples side-by-side */ padding: 4px; font-size: 0.7em; text-align: center; border-radius: var(--border-radius-sm); min-height: 20px; display: flex; align-items: center; justify-content: center; }
                .vertical-layout-theme-panel .contrast-score { font-size: 0.7em; color: var(--color-text-light); display: flex; flex-direction: column; gap: 2px; }
                .vertical-layout-theme-panel .contrast-score div { white-space: normal; line-height: 1.3; }
                .vertical-layout-theme-panel .contrast-score .status-good { color: #4CAF50; } .vertical-layout-theme-panel .contrast-score .status-fair { color: #FFC107; } .vertical-layout-theme-panel .contrast-score .status-poor { color: #F44336; }

                /* Typography/Layout - Vertical Layout */
                .vertical-layout-theme-panel .button-group { display: flex; flex-wrap: wrap; gap: 4px; }
                .vertical-layout-theme-panel .option-button { flex: 1 1 auto; min-width: 60px; font-size: 0.75em; padding: 4px 6px; border: 1px solid var(--color-border); background-color: var(--color-secondary); color: var(--color-text); }
                 .vertical-layout-theme-panel .option-button.active { background-color: var(--color-primary); color: white; border-color: var(--color-primary); font-weight: bold; }
                .vertical-layout-theme-panel .text-sample { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--color-border-light); }
                .vertical-layout-theme-panel .sample-container { padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius-md); background-color: var(--color-background); color: var(--color-text); font-family: var(--font-family); font-size: var(--font-size-md); }
                .vertical-layout-theme-panel .sample-heading { margin:0 0 8px 0; font-size: 1em; font-weight:bold; color: var(--color-primary); } .vertical-layout-theme-panel .sample-paragraph { margin: 0 0 8px 0; font-size: 0.9em; } .vertical-layout-theme-panel .sample-button { font-size: 0.8em; padding: 4px 8px; background-color: var(--color-primary); color: white; border: none; border-radius: var(--border-radius-sm); }

                /* Presets - Vertical Layout */
                .vertical-layout-theme-panel .preset-section h5 { margin: 0 0 5px 0; font-size: 0.9em; }
                .vertical-layout-theme-panel .preset-container { display: grid; grid-template-columns: 1fr; gap: 6px; }
                .vertical-layout-theme-panel .theme-preset-button { height: 40px; display: flex; flex-direction: row; align-items: center; padding: 0 5px; border: 1px solid var(--color-border-light); border-radius: var(--border-radius-sm); cursor: pointer; overflow: hidden; transition: box-shadow 0.2s; }
                 .vertical-layout-theme-panel .theme-preset-button:hover, .vertical-layout-theme-panel .theme-preset-button:focus { box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-color: var(--color-primary); outline: none; } .vertical-layout-theme-panel .theme-preset-button:focus-visible{ outline: 2px solid var(--color-primary); outline-offset: 1px; }
                .vertical-layout-theme-panel .preset-name { flex: 1; text-align: left; background: none; color: white; text-shadow: 1px 1px 1px rgba(0,0,0,0.7); font-size: 0.75em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .vertical-layout-theme-panel .mini-preview { width: 22px; height: 22px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; border-radius: 3px; } .vertical-layout-theme-panel .mini-text { font-weight: bold; font-size: 0.9em; }

                /* My Themes - Vertical Layout */
                .vertical-layout-theme-panel .themes-section h5 { margin: 0 0 5px 0; font-size: 0.9em; }
                .vertical-layout-theme-panel .save-theme-container { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
                .vertical-layout-theme-panel .save-theme-button { width: 100%; background-color: var(--color-primary); color: white; border:none; }
                .vertical-layout-theme-panel .custom-theme-container { border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); padding: 5px; max-height: 120px; overflow-y: auto; background-color: white; }
                .vertical-layout-theme-panel .theme-list { display: flex; flex-direction: column; gap: 4px; }
                .vertical-layout-theme-panel .theme-item { display: flex; align-items: center; gap: 5px; padding: 4px; border-radius: var(--border-radius-sm); background-color: var(--color-secondary); border: 1px solid transparent; } .vertical-layout-theme-panel .theme-item:hover { border-color: var(--color-border); }
                .vertical-layout-theme-panel .theme-item-preview { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 1px solid var(--color-border); }
                .vertical-layout-theme-panel .theme-item-name { flex: 1; font-size: 0.75em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .vertical-layout-theme-panel .theme-item-actions { display: flex; gap: 3px; }
                .vertical-layout-theme-panel .apply-theme-button, .vertical-layout-theme-panel .delete-theme-button { padding: 1px 4px; font-size: 0.65em; border:none; border-radius: var(--border-radius-sm); cursor:pointer; line-height:1; }
                .vertical-layout-theme-panel .apply-theme-button { background-color: var(--color-primary); color: white; } .vertical-layout-theme-panel .delete-theme-button { background-color: #e57373; color: white; } .vertical-layout-theme-panel .delete-theme-button:hover { background-color: #f44336; }
                .vertical-layout-theme-panel .export-import-container { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
                .vertical-layout-theme-panel .export-button, .vertical-layout-theme-panel .import-label { width: 100%; text-align: center; }
                 .vertical-layout-theme-panel .export-button { background-color: var(--color-primary); color:white; border:none; }
                 .vertical-layout-theme-panel .button-like { display: inline-flex; align-items: center; justify-content: center; padding: 5px 10px; border: 1px solid var(--color-border); border-radius: var(--border-radius-md); background-color: var(--color-secondary); color: var(--color-text); cursor: pointer; text-align: center; font-size: 0.8em; transition: background-color 0.2s; } .vertical-layout-theme-panel .button-like:hover, .vertical-layout-theme-panel .button-like:focus { background-color: var(--color-border-light); outline: none; } .vertical-layout-theme-panel .button-like:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
                 .vertical-layout-theme-panel .import-label { /* Uses button-like */ }

                /* Preview Section - Hidden */
                .vertical-layout-theme-panel .preview-section { display: none !important; }

                /* Action Buttons - Vertical */
                .vertical-layout-theme-panel .action-buttons { display: flex; justify-content: space-around; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--color-border-light); flex-wrap: nowrap; gap: 8px; flex-shrink: 0; }
                .vertical-layout-theme-panel .action-buttons button { flex: 1 1 50%; min-width: 60px; padding: 5px 8px; font-size: 0.85em; border:none; }
                .vertical-layout-theme-panel .reset-button { background-color: var(--color-text-light); color: white; }
                .vertical-layout-theme-panel .apply-button { background-color: var(--color-primary); color: white; }
                .vertical-layout-theme-panel .apply-button:disabled { background-color: var(--color-text-lighter); cursor: not-allowed; opacity: 0.7; }

                /* Helpers */
                .vertical-layout-theme-panel .visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
             `;
            document.head.appendChild(style);
        },

        // --- Event Listeners Setup ---
        setupEventListeners: function() { /* ... same as v4.1.6 ... */
            const content = this.dom.content; if (!content) return;
            const previewToggle = content.querySelector('#previewToggle'); if (previewToggle) previewToggle.addEventListener('change', () => this.togglePreview(previewToggle.checked));
            const ffSelect = content.querySelector('#font-family'); if (ffSelect) ffSelect.addEventListener('change', () => this.updateTypography('fontFamily', ffSelect.value));
            const resetButton = content.querySelector('.reset-button'); if (resetButton) resetButton.addEventListener('click', () => this.resetTheme());
            const applyButton = content.querySelector('.apply-button'); if (applyButton) applyButton.addEventListener('click', () => this.applyChanges());
            const schemePreview = content.querySelector('#scheme-preview'); if (schemePreview) { schemePreview.addEventListener('click', (event) => { if (event.target.classList.contains('scheme-color')) { const color = event.target.style.backgroundColor; const hexColor = this.rgbStringToHex(color); if (hexColor && this.dom.colorInputs.primary) { this.dom.colorInputs.primary.value = hexColor; const textInput = this.dom.colorInputs.primary.closest('.color-item')?.querySelector('.color-text-input'); if (textInput) textInput.value = hexColor; this.updateColor('primary', hexColor); } } }); }
         },

        // --- Core Logic Methods (Unchanged from v4.1.4/v4.1.5) ---
        // ... (All methods like switchTab, updateColor, helpers, etc., are included below) ...
        switchTab: function(tabId) { if (this.state.activeTab === tabId) return; this.state.activeTab = tabId; const headers = this.dom.content.querySelectorAll('.tab-header'); headers.forEach(h => { const active = h.dataset.tab === tabId; h.classList.toggle('active', active); h.setAttribute('aria-selected', active); h.tabIndex = active ? 0 : -1; }); Object.keys(this.dom.tabs).forEach(k => { const el = this.dom.tabs[k]; if(el) { el.style.display = (k === tabId) ? 'block' : 'none'; el.setAttribute('aria-hidden', String(k !== tabId)); } }); if (tabId === 'colors') { this.updateContrastInfo(); } },
        updateColor: function(key, value) { if (!/^#([0-9A-F]{3}){1,2}$/i.test(value)) return; if (!this.state.currentTheme.hasOwnProperty(key) || this.state.currentTheme[key] === value) return; this.state.currentTheme[key] = value; this.checkForChanges(); this.updatePreview(); if (['text', 'background', 'primary'].includes(key)) { this.updateContrastInfo(); } if (key === 'primary') { this.updateDerivedColors(value); } if (this.state.previewActive) { this.applyThemeToDocument(); } },
        updateDerivedColors: function(primaryColor) { if (!/^#([0-9A-F]{3}){1,2}$/i.test(primaryColor)) return; const derived = this.calculateDerivedColors(primaryColor); let changed = false; if (this.state.currentTheme.primaryDark !== derived.dark) { this.state.currentTheme.primaryDark = derived.dark; changed = true; } if (this.state.currentTheme.primaryLight !== derived.light) { this.state.currentTheme.primaryLight = derived.light; changed = true; } const darkInput = this.dom.colorInputs.primaryDark?.closest('.color-item')?.querySelector('.color-text-input'); const lightInput = this.dom.colorInputs.primaryLight?.closest('.color-item')?.querySelector('.color-text-input'); if (this.dom.colorInputs.primaryDark) this.dom.colorInputs.primaryDark.value = derived.dark; if (darkInput) darkInput.value = derived.dark; if (this.dom.colorInputs.primaryLight) this.dom.colorInputs.primaryLight.value = derived.light; if (lightInput) lightInput.value = derived.light; if (changed) { this.checkForChanges(); if (this.state.previewActive) { this.applyThemeToDocument(); } this.updatePreview(); } },
        updateTypography: function(key, value) { if (!this.state.currentTheme.hasOwnProperty(key) || this.state.currentTheme[key] === value) return; this.state.currentTheme[key] = value; this.checkForChanges(); this.updatePreview(); this.updateSampleText(); if (this.state.previewActive) { this.applyThemeToDocument(); } },
        updateLayout: function(key, value) { if (!this.state.currentTheme.hasOwnProperty(key) || this.state.currentTheme[key] === value) return; this.state.currentTheme[key] = value; this.checkForChanges(); this.updatePreview(); if (key === 'borderRadius') { this.updateSampleText(); } if (this.state.previewActive) { this.applyThemeToDocument(); } },
        generateColorScheme: function(type) { const base = this.state.currentTheme.primary; const colors = this.getScheme(base, type); const preview = document.getElementById('scheme-preview'); if (preview) { preview.innerHTML = ''; colors.forEach(c => { const el = document.createElement('div'); el.className = 'scheme-color'; el.style.backgroundColor = c; el.title=`Set primary to ${c}`; el.tabIndex=0; el.setAttribute('role','button'); el.setAttribute('aria-label',`Set primary to ${c}`); preview.appendChild(el); }); } Framework.showToast(`Generated ${type} scheme preview`); },
        applyPreset: function(index) { const preset = this.state.presetThemes[index]; if (!preset) return; let newTheme = { ...this.state.currentTheme }; Object.keys(preset).forEach(key => { if (key !== 'name' && newTheme.hasOwnProperty(key)) newTheme[key] = preset[key]; }); const derived = this.calculateDerivedColors(newTheme.primary); newTheme = { ...this.state.originalTheme, ...newTheme, primaryDark: derived.dark, primaryLight: derived.light }; this.state.currentTheme = newTheme; this.updateAllInputs(); this.checkForChanges(); this.updatePreview(); this.updateContrastInfo(); this.updateSampleText(); if (this.state.previewActive) { this.applyThemeToDocument(); } Framework.showToast(`Applied theme: ${preset.name}`); },
        saveCustomTheme: function(name) { if (!name || typeof name !== 'string' || name.length > 50) { Framework.showToast('Invalid theme name (max 50 chars).'); return; } const theme = { name: name, ...this.state.currentTheme }; const idx = this.state.savedThemes.findIndex(t => t.name.toLowerCase() === name.toLowerCase()); if (idx >= 0) { if (!confirm(`Overwrite theme "${this.state.savedThemes[idx].name}"?`)) return; this.state.savedThemes[idx] = theme; Framework.showToast(`Updated theme "${theme.name}"`); } else { this.state.savedThemes.push(theme); Framework.showToast(`Saved theme "${theme.name}"`); } this.persistSavedThemes(); this.renderSavedThemes(); },
        persistSavedThemes: function() { try { localStorage.setItem('customThemes', JSON.stringify(this.state.savedThemes)); } catch (e) { console.warn('Could not save themes', e); Framework.showToast('Error saving themes.'); } },
        renderSavedThemes: function() { if (!this.dom.customThemeContainer) return; const c = this.dom.customThemeContainer; c.innerHTML = ''; if (this.state.savedThemes.length === 0) { c.innerHTML = `<div class="empty-themes-message">No saved themes.</div>`; return; } const list = document.createElement('div'); list.className = 'theme-list'; list.setAttribute('role','list'); list.setAttribute('aria-label','Saved themes'); this.state.savedThemes.forEach((t, i) => { const item = document.createElement('div'); item.className = 'theme-item'; item.setAttribute('role','listitem'); const preview = document.createElement('div'); preview.className = 'theme-item-preview'; preview.style.backgroundColor = t.primary || '#ccc'; preview.setAttribute('aria-hidden','true'); const nameEl = document.createElement('div'); nameEl.className = 'theme-item-name'; nameEl.textContent = t.name; nameEl.title = t.name; const actions = document.createElement('div'); actions.className = 'theme-item-actions'; const applyBtn = document.createElement('button'); applyBtn.className = 'apply-theme-button'; applyBtn.textContent = 'Apply'; applyBtn.title=`Apply theme ${t.name}`; applyBtn.setAttribute('aria-label',`Apply theme ${t.name}`); applyBtn.addEventListener('click',(e)=>{e.stopPropagation();this.applyCustomTheme(i);}); const delBtn = document.createElement('button'); delBtn.className = 'delete-theme-button'; delBtn.innerHTML = '🗑️'; delBtn.title=`Delete theme ${t.name}`; delBtn.setAttribute('aria-label',`Delete theme ${t.name}`); delBtn.addEventListener('click',(e)=>{e.stopPropagation();this.deleteCustomTheme(i);}); actions.appendChild(applyBtn); actions.appendChild(delBtn); item.appendChild(preview); item.appendChild(nameEl); item.appendChild(actions); list.appendChild(item); }); c.appendChild(list); },
        applyCustomTheme: function(index) { const theme = this.state.savedThemes[index]; if (!theme) return; const completeTheme = { ...this.state.originalTheme, ...theme }; this.state.currentTheme = completeTheme; this.updateAllInputs(); this.updatePreview(); this.checkForChanges(); this.updateContrastInfo(); this.updateSampleText(); if (this.state.previewActive) { this.applyThemeToDocument(); } Framework.showToast(`Applied theme "${theme.name}"`); },
        deleteCustomTheme: function(index) { const theme = this.state.savedThemes[index]; if (!theme || !confirm(`Delete theme "${theme.name}"?`)) return; this.state.savedThemes.splice(index, 1); this.persistSavedThemes(); this.renderSavedThemes(); Framework.showToast(`Deleted theme "${theme.name}"`); },
        exportThemes: function() { if (this.state.savedThemes.length === 0) { Framework.showToast('No themes to export'); return; } const themes = this.state.savedThemes.map(t => ({ name:t.name, primary:t.primary, primaryDark:t.primaryDark, primaryLight:t.primaryLight, secondary:t.secondary, text:t.text, background:t.background, fontFamily:t.fontFamily, fontSize:t.fontSize, borderRadius:t.borderRadius, spacing:t.spacing, transitionSpeed:t.transitionSpeed })); const str = JSON.stringify(themes, null, 2); const blob = new Blob([str], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; const ts = new Date().toISOString().slice(0,10); link.download = `modular-ui-themes-${ts}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); Framework.showToast('Themes exported'); },
        importThemes: function(event) { const file = event.target.files[0]; if (!file || !file.type.match('application/json')) { if(file) Framework.showToast('Invalid file type.'); return; } const reader = new FileReader(); reader.onload = (e) => { try { const imported = JSON.parse(e.target.result); if (!Array.isArray(imported)) throw new Error('Invalid format: requires array.'); let added = 0, skipped = 0; const names = this.state.savedThemes.map(t => t.name.toLowerCase()); imported.forEach(imp => { if (imp && typeof imp.name === 'string' && typeof imp.primary === 'string') { if (!names.includes(imp.name.toLowerCase())) { const complete = { ...this.state.originalTheme, ...imp }; this.state.savedThemes.push(complete); names.push(imp.name.toLowerCase()); added++; } else { skipped++; } } else { skipped++; } }); this.persistSavedThemes(); this.renderSavedThemes(); let msg = `Import complete. Added ${added}.`; if (skipped > 0) msg += ` Skipped ${skipped}.`; Framework.showToast(msg, 4000); } catch (err) { console.error('Import Error:', err); Framework.showToast(`Import Error: ${err.message}`, 5000); } finally { event.target.value = ''; } }; reader.onerror = () => { Framework.showToast('Error reading file.'); event.target.value = ''; }; reader.readAsText(file); },
        togglePreview: function(active) { this.state.previewActive = active; if (active) { this.applyThemeToDocument(); Framework.showToast('Live preview enabled'); } else { this.restoreDocumentTheme(); Framework.showToast('Live preview disabled'); } },
        applyThemeToDocument: function() { const root = document.documentElement; const theme = this.state.currentTheme; const map = { primary:'--color-primary', primaryDark:'--color-primary-dark', primaryLight:'--color-primary-light', secondary:'--color-secondary', text:'--color-text', background:'--color-background', fontFamily:'--font-family', fontSize:'--font-size-md', borderRadius:'--border-radius-md', transitionSpeed:'--transition-normal' }; if (!this.state.savedInlineStyles) { this.state.savedInlineStyles = {}; Object.values(map).forEach(v => { this.state.savedInlineStyles[v] = root.style.getPropertyValue(v); }); this.state.savedInlineStyles['--space-md'] = root.style.getPropertyValue('--space-md'); } Object.keys(map).forEach(k => { if (theme[k]) root.style.setProperty(map[k], theme[k]); }); const spaceVal = theme.spacing === 'compact' ? '10px' : theme.spacing === 'comfortable' ? '20px' : '15px'; root.style.setProperty('--space-md', spaceVal); },
        restoreDocumentTheme: function() { const root = document.documentElement; if (!this.state.savedInlineStyles) return; Object.keys(this.state.savedInlineStyles).forEach(v => { const val = this.state.savedInlineStyles[v]; if (val) root.style.setProperty(v, val); else root.style.removeProperty(v); }); this.state.savedInlineStyles = null; },
        resetTheme: function() { if (!confirm('Reset theme editor to defaults?')) return; this.state.currentTheme = {...this.state.originalTheme}; this.updateAllInputs(); this.state.hasChanges = false; const btn = this.dom.content?.querySelector('.apply-button'); if(btn) btn.disabled = true; this.updatePreview(); this.updateContrastInfo(); this.updateSampleText(); if (this.state.previewActive) { this.applyThemeToDocument(); } Framework.showToast('Theme editor reset'); },
        applyChanges: function() { if (!this.state.hasChanges) { Framework.showToast("No changes to apply."); return; } this.applyThemeToDocument(); this.state.originalTheme = {...this.state.currentTheme}; this.state.hasChanges = false; const btn = this.dom.content?.querySelector('.apply-button'); if(btn) btn.disabled = true; this.state.savedInlineStyles = null; Framework.showToast('Theme changes applied'); },
        updateAllInputs: function() { Object.keys(this.dom.colorInputs).forEach(k => { const ci = this.dom.colorInputs[k]; if (ci && this.state.currentTheme[k]) { ci.value = this.state.currentTheme[k]; const ti = ci.closest('.color-item')?.querySelector('.color-text-input'); if(ti) { ti.value = this.state.currentTheme[k]; ti.classList.remove('error');}} }); if (this.dom.fontInputs.fontFamily) { this.dom.fontInputs.fontFamily.value = this.state.currentTheme.fontFamily; } if (this.dom.fontInputs.fontSize) { const origFsPx = parseFloat(this.state.originalTheme.fontSize.replace(/[^\d.]/g,''))||16; const currFsPx = parseFloat(this.state.currentTheme.fontSize.replace(/[^\d.]/g,''))||16; const perc = Math.round((currFsPx/origFsPx)*100); this.dom.fontInputs.fontSize.value = perc; const vd = this.dom.fontInputs.fontSize.parentElement?.querySelector('.slider-value'); if(vd) vd.textContent = `${perc}%`; } if (this.dom.spacingInputs.borderRadius) { const rVal = parseInt(this.state.currentTheme.borderRadius)||5; this.dom.spacingInputs.borderRadius.value = rVal; const vd = this.dom.spacingInputs.borderRadius.parentElement?.querySelector('.slider-value'); if(vd) vd.textContent = `${rVal}px`; } if (this.dom.spacingInputs.transitionSpeed) { const sVal = (parseFloat(this.state.currentTheme.transitionSpeed)||0.3)*1000; this.dom.spacingInputs.transitionSpeed.value = sVal; const vd = this.dom.spacingInputs.transitionSpeed.parentElement?.querySelector('.slider-value'); if(vd) vd.textContent = `${(sVal/1000).toFixed(2)}s`; } const spBtns = this.dom.content?.querySelectorAll('.button-group .option-button[data-value]'); if(spBtns){ spBtns.forEach(b=>{const active=b.dataset.value===this.state.currentTheme.spacing; b.classList.toggle('active',active); b.setAttribute('aria-checked',active); b.tabIndex=active?0:-1;});} },
        updatePreview: function() { if (!this.dom.previewElement) return; const p = this.dom.previewElement; const t = this.state.currentTheme; p.style.backgroundColor = t.background||'transparent'; p.style.color = t.text||'#000'; p.style.borderColor = t.primaryLight||t.primary||'#ccc'; p.style.borderRadius = t.borderRadius||'0px'; p.style.fontFamily = t.fontFamily||'sans-serif'; const h = p.querySelector('.preview-header'); if(h){ h.style.backgroundColor = t.primary||'#eee'; const hc = this.calculateContrastRatio('#ffffff',t.primary||'#eee') >= 4.5 ? '#ffffff' : '#000000'; h.style.color = hc; } const b = p.querySelector('.preview-button'); if(b){ b.style.backgroundColor = t.primary||'#eee'; const bc = this.calculateContrastRatio('#ffffff',t.primary||'#eee') >= 4.5 ? '#ffffff' : '#000000'; b.style.color = bc; b.style.borderRadius = t.borderRadius||'0px'; } const c = p.querySelector('.preview-content'); if(c){ c.style.backgroundColor = t.secondary||'#f8f8f8'; c.style.color = t.text||'#000'; } },
        updateSampleText: function() { const s = this.dom.content?.querySelector('.sample-container'); if (!s) return; const t = this.state.currentTheme; s.style.fontFamily = t.fontFamily||'sans-serif'; s.style.backgroundColor = t.background||'transparent'; s.style.color = t.text||'#000'; s.style.borderRadius = t.borderRadius||'0px'; s.style.fontSize = t.fontSize||'1rem'; const b = s.querySelector('.sample-button'); if(b){ b.style.backgroundColor = t.primary||'#eee'; const bc = this.calculateContrastRatio('#ffffff',t.primary||'#eee') >= 4.5 ? '#ffffff' : '#000000'; b.style.color = bc; b.style.borderRadius = t.borderRadius||'0px'; b.style.fontSize = '0.9em'; } const h = s.querySelector('.sample-heading'); if(h){ h.style.color = t.primary||t.text||'#000'; } },
        updateContrastInfo: function() { const bgSample = this.dom.content?.querySelector('#text-on-bg'); const priSample = this.dom.content?.querySelector('#text-on-primary'); const scoreDisp = this.dom.content?.querySelector('#contrast-score'); if (!bgSample || !priSample || !scoreDisp) return; const t = this.state.currentTheme; const bg = /^#([0-9A-F]{3}){1,2}$/i.test(t.background) ? t.background : '#f5f5f5'; const txt = /^#([0-9A-F]{3}){1,2}$/i.test(t.text) ? t.text : '#333333'; const pri = /^#([0-9A-F]{3}){1,2}$/i.test(t.primary) ? t.primary : '#4a76a8'; bgSample.style.backgroundColor = bg; bgSample.style.color = txt; const priTxt = this.calculateContrastRatio('#ffffff', pri) >= this.calculateContrastRatio('#000000', pri) ? '#ffffff' : '#000000'; priSample.style.backgroundColor = pri; priSample.style.color = priTxt; const bgCr = this.calculateContrastRatio(txt, bg); const priCr = this.calculateContrastRatio(priTxt, pri); const getRating = r => { if (r >= 7) return {r:'AAA', c:'good'}; if (r >= 4.5) return {r:'AA', c:'good'}; if (r >= 3) return {r:'AA Large', c:'fair'}; return {r:'Fail', c:'poor'}; }; const bgRate = getRating(bgCr); const priRate = getRating(priCr); scoreDisp.innerHTML = `<div>T/BG: <strong>${bgCr.toFixed(1)}:1</strong> (<span class="status-${bgRate.c}">${bgRate.r}</span>)</div> <div>T/Pri: <strong>${priCr.toFixed(1)}:1</strong> (<span class="status-${priRate.c}">${priRate.r}</span>)</div>`; },
        checkForChanges: function() { const changed = Object.keys(this.state.currentTheme).some(k => this.state.currentTheme[k] !== this.state.originalTheme[k]); if (this.state.hasChanges !== changed) { this.state.hasChanges = changed; const btn = this.dom.content?.querySelector('.apply-button'); if(btn) btn.disabled = !changed; } },
        calculateContrastRatio: function(c1, c2) { try { const l1=this.getLuminance(c1), l2=this.getLuminance(c2); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); } catch { return 1; } },
        getLuminance: function(hexColor) { if (!/^#([0-9A-F]{3}){1,2}$/i.test(hexColor)) { throw new Error(`Invalid hex: ${hexColor}`); } const rgb = this.hexToRgb(hexColor); const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => { let v = val / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
        darkenColor: function(hex, pc) { try { const rgb=this.hexToRgb(hex); const hsl=this.rgbToHsl(rgb.r,rgb.g,rgb.b); hsl.l=Math.max(0,hsl.l-(pc/100)); const nRgb=this.hslToRgb(hsl.h,hsl.s,hsl.l); return this.rgbToHex(nRgb.r,nRgb.g,nRgb.b); } catch { return hex; } },
        lightenColor: function(hex, pc) { try { const rgb=this.hexToRgb(hex); const hsl=this.rgbToHsl(rgb.r,rgb.g,rgb.b); hsl.l=Math.min(1,hsl.l+(pc/100)); const nRgb=this.hslToRgb(hsl.h,hsl.s,hsl.l); return this.rgbToHex(nRgb.r,nRgb.g,nRgb.b); } catch { return hex; } },
        calculateDerivedColors: function(pri) { if (!/^#([0-9A-F]{3}){1,2}$/i.test(pri)) return {dark:'#000',light:'#fff'}; const dark=this.darkenColor(pri,20); const light=this.lightenColor(pri,65); return {dark, light}; },
        hexToRgb: function(hex) { hex=hex.replace(/^#/,''); if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; if(hex.length!==6) throw new Error('Invalid hex'); const r=parseInt(hex.substring(0,2),16), g=parseInt(hex.substring(2,4),16), b=parseInt(hex.substring(4,6),16); if(isNaN(r+g+b)) throw new Error('Invalid hex chars'); return {r,g,b}; },
        rgbToHex: function(r,g,b) { const th=n=>{const h=Math.max(0,Math.min(255,Math.round(n))).toString(16); return h.length===1?'0'+h:h;}; return `#${th(r)}${th(g)}${th(b)}`; },
        rgbStringToHex: function(rgb) { if(!rgb || !rgb.startsWith('rgb')) return null; const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d*\.?\d+)?\)/); return m ? this.rgbToHex(parseInt(m[1]),parseInt(m[2]),parseInt(m[3])) : null; },
        rgbToHsl: function(r,g,b) { r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0, s=0, l=(max+min)/2; if(max!==min){ const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){ case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; case b: h=(r-g)/d+4; break; } h/=6; } return {h,s,l}; },
        hslToRgb: function(h,s,l) { let r,g,b; if(s===0){ r=g=b=l; } else { const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}; const q=l<0.5?l*(1+s):l+s-l*s; const p=2*l-q; r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3); } return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)}; },
        getComplementaryColor: function(hex) { try {const rgb=this.hexToRgb(hex); const hsl=this.rgbToHsl(rgb.r,rgb.g,rgb.b); hsl.h=(hsl.h+0.5)%1; const nRgb=this.hslToRgb(hsl.h,hsl.s,hsl.l); return this.rgbToHex(nRgb.r,nRgb.g,nRgb.b); } catch { return hex; } },
        getScheme: function(hex, type) { let colors=[hex]; try { switch(type){ case 'complementary': colors.push(this.getComplementaryColor(hex)); break; case 'monochromatic': colors=[this.lightenColor(hex,30),this.lightenColor(hex,15),hex,this.darkenColor(hex,15),this.darkenColor(hex,30)]; break; } } catch(e){ console.error(`Scheme error '${type}':`, e); return [hex]; } return colors.filter((c,i,a)=>a.indexOf(c)===i); },
        cleanup: function() { if (this.state.previewActive) { this.restoreDocumentTheme(); this.state.previewActive = false; } this.dom = {}; console.log(`Component ${this.id} cleaned up.`); },
        onPanelOpen: function() { console.log(`${this.id} opened.`); },
        onPanelClose: function() { console.log(`${this.id} closed.`); if (this.state.previewActive) { this.togglePreview(false); const toggle = this.dom.content?.querySelector('#previewToggle'); if (toggle) toggle.checked = false; } }

    }; // End component object

    Framework.registerComponent(component.id, component); // Register
})(); // End IIFE
