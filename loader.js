/**
 * =============
 * LOADING SCREEN MODULE - loader.js - V 2.4.3
 * =============
 * V2.4.3 - Updated to handle new agent_tools.json 
 * and dynamic princi2.txt parsing 
 * =============
 */

// Initialize loading screen
const LoadingScreen = {
    loadingComplete: false,
    dataFetched: {
        commands: false,
        actions: false,
        principles: false,
        apiConfig: false,
        memories: false,
        lastMessages: false,
        htmlFiles: false,
        tools: false
    },
    loadingScreenData: {
        commands: null,
        commandsCount: 0,
        actions: null,
        actionsCount: 0,
        memories: null,
        memoriesCount: 0
    },
    currentNewsIndex: 1,
    totalNewsNotes: 3,
    
    init: function() {
        this.updateLoadingScreenLayout();
        this.setupEventHandlers();
        this.loadHTMLSections(); // Load HTML sections first
        this.initializeNewsNavigation();
        this.generatePanelToggles();
        this.setupLoginButton(); 
        
        // Start fetching data after short delay
        setTimeout(() => {
            this.fetchCommandsCount();
            this.fetchActionsList();
            this.fetchPrinciplesList();
            this.fetchAPIConfig();
            this.fetchMemoriesCount();
            this.fetchLastMessages();
            this.fetchToolsList();
        }, 300);
    },

    loadHTMLSections: function() {
        const sections = [
            { file: 'mission.html', container: 'loader-mission-container' },
            { file: 'system.html', container: 'loader-system-container' },
            { file: 'user.html', container: 'loader-user-container' },
            // REMOVED: { file: 'features.html', container: 'loader-features-container' },
            { file: 'status.html', container: 'loader-status-container' }
        ];

        const loadPromises = sections.map(section => {
            return fetch(section.file)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load ${section.file}`);
                    }
                    return response.text();
                })
                .then(html => {
                    const container = document.getElementById(section.container);
                    if (container) {
                        container.innerHTML = html;
                    }
                })
                .catch(error => {
                    console.warn(`Failed to load ${section.file}:`, error);
                    const container = document.getElementById(section.container);
                    if (container) {
                        container.innerHTML = `<div class="loader-error">Failed to load ${section.file}</div>`;
                    }
                });
        });

        Promise.all(loadPromises).then(() => {
            console.log('All HTML sections loaded');
            // After loading HTML, process any dynamic content
            this.generateUserStats();
            // REMOVED: this.generateFeatures();
            this.setupTabs();
            this.displayFeatures(); // NEW: Display features in the tab
            this.dataFetched.htmlFiles = true;
            this.checkAllDataLoaded();
        }).catch(error => {
            console.error('Error loading HTML sections:', error);
            this.dataFetched.htmlFiles = true;
            this.checkAllDataLoaded();
        });
    },

    setupLoginButton: function() { 
        const showLoginBtn = document.getElementById('showLoginBtn');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => {
                if (typeof authManager !== 'undefined') {
                    authManager.showLoginModal();
                } else {
                    console.error("authManager not defined when trying to show login modal from loader.");
                }
            });
        }
    },
    
    generatePanelToggles: function() {
        document.querySelectorAll('[data-panel-toggles]').forEach(container => {
            const area = container.dataset.panelToggles;
            const icons = container.dataset.icons?.split(',') || [];
            const panels = Object.entries(CONFIG.panels)
                .filter(([id, cfg]) => cfg.area === area)
                .map(([id, cfg], index) => ({
                    id,
                    icon: icons[index] || '📋',
                    title: cfg.title || 'Panel'
                }));
            
            container.innerHTML = panels.map(p => 
                `<div class="panel-toggle" id="toggle-${p.id}" data-target="${p.id}" 
                      role="button" aria-controls="${p.id}" aria-expanded="false" 
                      tabindex="0" title="Toggle ${p.title}">
                    <span class="toggle-arrow" aria-hidden="true">${p.icon}</span>
                </div>`
            ).join('');
        });
    },
    
    generateUserStats: function() {
        const container = document.querySelector('[data-user-stats]');
        if (!container) return;
        
        const stats = Array.from(container.querySelectorAll('[data-stat]')).map(el => {
            const parts = el.dataset.stat.split(',');
            const iscat = parts[0] === 'cat';
            return iscat ? 
                `<div class="loader-user-stat-item loader-cat-stat">
                    <div class="loader-user-stat-content">
                        <div class="loader-user-stat-label">${parts[1]}</div>
                        <div class="loader-user-stat-details loader-cat-details">
                            <span>• ${parts[2]}</span>
                            <span>• ${parts[3]}</span>
                        </div>
                    </div>
                </div>` :
                `<div class="loader-user-stat-item">
                    <div class="loader-user-stat-content">
                        <div class="loader-user-stat-number">${parts[0]}</div>
                        <div class="loader-user-stat-label">${parts[1]}</div>
                        <div class="loader-user-stat-details">
                            <span>• ${parts[2]}</span>
                            <span>• ${parts[3]}</span>
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = stats.join('');
    },
    
    // REMOVED generateFeatures method - no longer needed
    
    setupEventHandlers: function() {
        // Handle resize
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.updateLoadingScreenLayout(), 100);
        });
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateLoadingScreenLayout(), 100);
        });
    },
    
    checkAllDataLoaded: function() {
        const allLoaded = Object.values(this.dataFetched).every(v => v === true);
        if (allLoaded && !this.loadingComplete) {
            this.loadingComplete = true;
            this.showLoadingComplete();
        }
    },
    
    showLoadingComplete: function() {
        const spinner = document.getElementById('loaderSpinner');
        const checkmark = document.getElementById('loaderCheckmark');
        const loaderText = document.getElementById('loaderText');
        const spinnerContainer = document.querySelector('.loader-spinner-container');
        
        if (spinner && checkmark) {
            spinner.style.display = 'none';
            checkmark.style.display = 'block';
            if (spinnerContainer) spinnerContainer.classList.add('has-checkmark');
            if (loaderText) loaderText.textContent = 'Loading Complete!';
        }
    },
    
    // Updated fetchRedditNews function with better content handling
    fetchRedditNews: async function() {
        try {
            // Reddit's JSON API endpoint for your subreddit
            const response = await fetch('https://www.reddit.com/r/m0dai.json?limit=10');
            const data = await response.json();
            
            // Transform Reddit posts into news items
            const newsItems = data.data.children
                .filter(post => !post.data.stickied) // Skip pinned posts
                .slice(0, 5) // Get top 5 posts
                .map((post, index) => {
                    const postData = post.data;
                    const date = new Date(postData.created_utc * 1000);
                    const formattedDate = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    
                    // Get the body text
                    let body = postData.selftext || postData.title;
                    let wasTruncated = false;
                    
                    // Process bullet points if they exist
                    if (body.includes('*') || body.includes('•') || body.includes('-')) {
                        // Try to preserve bullet point structure
                        const lines = body.split('\n');
                        let processedBody = '';
                        let charCount = 0;
                        const maxChars = 500; // Increased from 150 to 500
                        
                        for (let line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine) {
                                // Check if we're about to exceed the limit
                                if (charCount + trimmedLine.length > maxChars && processedBody) {
                                    // Mark as truncated but don't add text here
                                    wasTruncated = true;
                                    break;
                                }
                                
                                // Format bullet points nicely
                                if (trimmedLine.startsWith('*') || trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
                                    processedBody += (processedBody ? '\n' : '') + '• ' + trimmedLine.substring(1).trim();
                                } else {
                                    processedBody += (processedBody ? '\n' : '') + trimmedLine;
                                }
                                
                                charCount += trimmedLine.length;
                            }
                        }
                        
                        body = processedBody;
                    } else {
                        // For non-bullet content, just truncate at a reasonable length
                        if (body.length > 500) {
                            // Try to cut at a sentence boundary
                            const truncated = body.substring(0, 500);
                            const lastPeriod = truncated.lastIndexOf('.');
                            const lastExclamation = truncated.lastIndexOf('!');
                            const lastQuestion = truncated.lastIndexOf('?');
                            
                            const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
                            
                            if (lastSentenceEnd > 300) {
                                body = truncated.substring(0, lastSentenceEnd + 1);
                            } else {
                                body = truncated;
                            }
                            wasTruncated = true;
                        }
                    }
                    
                    // Create news item HTML with better formatting
                    return `
                        <div class="loader-news-item ${index === 0 ? 'active' : ''}" data-news-id="${index + 1}">
                            <div class="loader-news-date">${formattedDate}</div>
                            <div class="loader-news-title">
                                <a href="https://reddit.com${postData.permalink}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
                                    ${this.escapeHtml(postData.title)}
                                </a>
                            </div>
                            <div class="loader-news-body" style="white-space: pre-line;">
                                ${this.escapeHtml(body)}${wasTruncated ? ` ... <a href="https://reddit.com${postData.permalink}" target="_blank" rel="noopener noreferrer" style="color: #1e88e5; text-decoration: none;">(see full post on Reddit)</a>` : ''}
                                <div style="margin-top: 8px; font-size: 0.8em; opacity: 0.7;">
                                    👍 ${postData.score} | 💬 ${postData.num_comments} comments
                                </div>
                            </div>
                        </div>
                    `;
                });
            
            // Update the news content area
            const newsContent = document.getElementById('newsContent');
            if (newsContent && newsItems.length > 0) {
                newsContent.innerHTML = newsItems.join('');
                this.totalNewsNotes = newsItems.length;
                this.currentNewsIndex = 1;
                
                // Update indicator
                const indicator = document.getElementById('newsIndicator');
                if (indicator) {
                    indicator.textContent = `1 / ${this.totalNewsNotes}`;
                }
            }
            
            // Add a fallback static item if no posts found or error
            if (!newsItems.length) {
                this.showFallbackNews();
            }
            
        } catch (error) {
            console.warn('Failed to fetch Reddit news:', error);
            this.showFallbackNews();
        }
    },

    // News Fallback
    showFallbackNews: function() {
        const newsContent = document.getElementById('newsContent');
        if (newsContent) {
            newsContent.innerHTML = `
                <div class="loader-news-item active" data-news-id="1">
                    <div class="loader-news-date">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div class="loader-news-title">Welcome to m0d.ai</div>
                    <div class="loader-news-body">
                        Visit our subreddit for the latest updates and discussions: 
                        <a href="https://www.reddit.com/r/m0dai/" target="_blank" rel="noopener noreferrer">r/m0dai on Reddit</a>
                    </div>
                </div>
            `;
            this.totalNewsNotes = 1;
            this.currentNewsIndex = 1;
        }
    },

    // Updated initializeNewsNavigation function
    initializeNewsNavigation: function() {
        const prevBtn = document.getElementById('newsPrevBtn');
        const nextBtn = document.getElementById('newsNextBtn');
        const indicator = document.getElementById('newsIndicator');
        
        if (!prevBtn || !nextBtn || !indicator) return;
        
        // Fetch Reddit posts first
        this.fetchRedditNews();
        
        const updateNewsDisplay = () => {
            indicator.textContent = `${this.currentNewsIndex} / ${this.totalNewsNotes}`;
            
            document.querySelectorAll('.loader-news-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const currentItem = document.querySelector(`.loader-news-item[data-news-id="${this.currentNewsIndex}"]`);
            if (currentItem) currentItem.classList.add('active');
            
            prevBtn.disabled = this.currentNewsIndex === 1;
            nextBtn.disabled = this.currentNewsIndex === this.totalNewsNotes;
        };
        
        prevBtn.addEventListener('click', () => {
            if (this.currentNewsIndex > 1) {
                this.currentNewsIndex--;
                updateNewsDisplay();
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (this.currentNewsIndex < this.totalNewsNotes) {
                this.currentNewsIndex++;
                updateNewsDisplay();
            }
        });
        
        // Refresh SubReddit News
        setInterval(() => {
            this.fetchRedditNews();
        }, 300000); // 5 minutes
    },
    
    setupTabs: function() {
        const tabs = {
            actions: { tab: 'actionsTab', content: 'actionsList' },
            commands: { tab: 'commandsTab', content: 'commandsList' },
            memories: { tab: 'memoriesTab', content: 'memoriesList' },
            tools: { tab: 'toolsTab', content: 'toolsList' },
            principles: { tab: 'principlesTab', content: 'principlesTabList' }, // Duplicate of standalone principles card
            features: { tab: 'featuresTab', content: 'featuresTabList' } // NEW TAB
        };
        
        Object.entries(tabs).forEach(([name, ids]) => {
            const tab = document.getElementById(ids.tab);
            if (tab) {
                tab.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent any default behavior
                    
                    // Update active states
                    document.querySelectorAll('.loader-tab').forEach(t => {
                        t.classList.remove('active');
                        // Remove inline styles that might conflict
                        t.style.fontWeight = '';
                        t.style.color = '';
                        t.style.borderBottom = '';
                    });
                    tab.classList.add('active');
                    
                    // Hide all content
                    Object.values(tabs).forEach(t => {
                        const content = document.getElementById(t.content);
                        if (content) content.style.display = 'none';
                    });
                    
                    // Show selected content
                    const content = document.getElementById(ids.content);
                    if (content) {
                        content.style.display = 'block';
                        // Prevent layout shift by ensuring content is ready
                        requestAnimationFrame(() => {
                            content.scrollTop = 0;
                        });
                    }
                });
            }
        });
    },
    
    fetchLastMessages: function() {
        // Generate random online users
        const randomUserCount = Math.floor(Math.random() * 10) + 1;
        const onlineUsersElement = document.getElementById('onlineUsersText');
        if (onlineUsersElement) {
            onlineUsersElement.textContent = `${randomUserCount} placeholderusers online`;
        }
        
        // Fetch API config
        fetch('/api/config')
            .then(response => response.json())
            .then(data => {
                const providerElement = document.getElementById('apiProviderText');
                const modelElement = document.getElementById('apiModelText');
                
                if (providerElement && modelElement && data.api) {
                    const provider = data.api.active_provider || 'Unknown';
                    const model = data.api.providers?.[provider]?.model_name || 'Unknown Model';
                    
                    providerElement.textContent = provider;
                    modelElement.textContent = model;
                }
            })
            .catch(error => {
                console.warn('Failed to fetch API config:', error);
                const providerElement = document.getElementById('apiProviderText');
                const modelElement = document.getElementById('apiModelText');
                if (providerElement) providerElement.textContent = 'Error';
                if (modelElement) modelElement.textContent = 'Unable to load';
            });
        
        // Fetch last AI message
        fetch('/website_output.txt')
            .then(response => response.text())
            .then(text => {
                const element = document.getElementById('lastAIMessage');
                if (element) {
                    const trimmedText = text.trim();
                    const maxLength = 100;
                    element.textContent = trimmedText ? 
                        (trimmedText.length > maxLength ? 
                            trimmedText.substring(0, maxLength) + '...' : trimmedText) :
                        'No AI message yet';
                }
            })
            .catch(() => {
                const element = document.getElementById('lastAIMessage');
                if (element) element.textContent = 'Unable to load';
            });
        
        // Fetch last user message
        fetch('/cleanuser.txt')
            .then(response => response.text())
            .then(text => {
                const element = document.getElementById('lastUserMessage');
                if (element) {
                    const trimmedText = text.trim();
                    const maxLength = 100;
                    element.textContent = trimmedText ? 
                        (trimmedText.length > maxLength ? 
                            trimmedText.substring(0, maxLength) + '...' : trimmedText) :
                        'No user message yet';
                }
                this.dataFetched.lastMessages = true;
                this.checkAllDataLoaded();
            })
            .catch(() => {
                const element = document.getElementById('lastUserMessage');
                if (element) element.textContent = 'Unable to load';
                this.dataFetched.lastMessages = true;
                this.checkAllDataLoaded();
            });
    },
    
    fetchCommandsCount: function() {
        fetch('/commands.json')
            .then(response => response.json())
            .then(data => {
                let totalCommands = 0;
                Object.values(data).forEach(category => {
                    totalCommands += Object.keys(category).length;
                });
                
                this.loadingScreenData.commands = data;
                this.loadingScreenData.commandsCount = totalCommands;
                
                const tabCount = document.getElementById('commandsTabCount');
                if (tabCount) tabCount.textContent = `(${totalCommands})`;
                
                this.displayCommands(data);
                this.dataFetched.commands = true;
                this.checkAllDataLoaded();
            })
            .catch(error => {
                console.warn('Failed to fetch commands:', error);
                const tabCount = document.getElementById('commandsTabCount');
                if (tabCount) tabCount.textContent = '(Error)';
                this.dataFetched.commands = true;
                this.checkAllDataLoaded();
            });
    },
    
    // Helper function to escape HTML entities
    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    displayCommands: function(data) {
        const listElement = document.getElementById('commandsList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        listElement.className = 'loader-data-value loader-commands-list';
        
        const categoryIcons = {
            'System': '⚙️',
            'Action': '🎯',
            'Controls': '🎮',
            'Utilities': '🛠️',
            'Commands': '📋',
            'Default': '📌'
        };
        
        Object.entries(data).forEach(([category, commands]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'loader-command-category';
            
            categoryDiv.innerHTML = `
                <div class="loader-command-category-title">
                    <span class="loader-command-category-icon">${categoryIcons[category] || categoryIcons['Default']}</span>
                    <span>${this.escapeHtml(category)}</span>
                </div>
                <div class="loader-commands-grid">
                    ${Object.entries(commands).map(([cmd, cmdData]) => `
                        <div class="loader-command-item">
                            <span class="loader-command-bullet">›</span>
                            <span class="loader-command-name">${this.escapeHtml(cmd)}</span>
                            ${cmdData.description ? `<span class="loader-command-description">${this.escapeHtml(cmdData.description)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
            
            listElement.appendChild(categoryDiv);
        });
    },
    
    fetchAPIConfig: function() {
        this.dataFetched.apiConfig = true;
        this.checkAllDataLoaded();
    },
    
    fetchActionsList: function() {
        fetch('/actions.json')
            .then(response => response.json())
            .then(data => {
                const element = document.getElementById('actionsList');
                
                const sortedActions = Object.entries(data).sort((a, b) => {
                    const aPriority = a[1].priority !== undefined && a[1].priority !== null ? a[1].priority : 999;
                    const bPriority = b[1].priority !== undefined && b[1].priority !== null ? b[1].priority : 999;
                    return aPriority - bPriority;
                });
                
                this.loadingScreenData.actions = sortedActions;
                this.loadingScreenData.actionsCount = sortedActions.length;
                
                const tabCount = document.getElementById('actionsTabCount');
                if (tabCount) tabCount.textContent = `(${sortedActions.length})`;
                
                if (element) {
                    // Group actions by priority ranges
                    const priorityGroups = {
                        'Core (Priority 0)': [],
                        'High Priority (1-3)': [],
                        'Medium Priority (4-6)': [],
                        'Low Priority (7-9)': [],
                        'Other': []
                    };
                    
                    sortedActions.forEach(([name, info]) => {
                        const priority = info.priority !== undefined && info.priority !== null ? info.priority : 999;
                        if (priority === 0) {
                            priorityGroups['Core (Priority 0)'].push([name, info]);
                        } else if (priority <= 3) {
                            priorityGroups['High Priority (1-3)'].push([name, info]);
                        } else if (priority <= 6) {
                            priorityGroups['Medium Priority (4-6)'].push([name, info]);
                        } else if (priority <= 9) {
                            priorityGroups['Low Priority (7-9)'].push([name, info]);
                        } else {
                            priorityGroups['Other'].push([name, info]);
                        }
                    });
                    
                    let html = '';
                    
                    Object.entries(priorityGroups).forEach(([groupName, actions]) => {
                        if (actions.length > 0) {
                            html += `
                                <div class="loader-action-category">
                                    <div class="loader-action-category-title">
                                        <span>${groupName} - ${actions.length} action${actions.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="loader-action-items">
                                        ${actions.map(([name, info]) => `
                                            <div class="loader-action-item">
                                                <span class="loader-action-priority">${info.priority !== undefined && info.priority !== null ? `P${info.priority}` : 'P?'}</span>
                                                <span class="loader-action-name">[${name.toUpperCase()}]</span>
                                                <span class="loader-action-description">${info.description || `${name} action module`}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }
                    });
                    
                    element.innerHTML = html;
                }
                this.dataFetched.actions = true;
                this.checkAllDataLoaded();
            })
            .catch(error => {
                console.warn('Failed to fetch actions:', error);
                const element = document.getElementById('actionsList');
                if (element) element.textContent = 'Error loading actions';
                const tabCount = document.getElementById('actionsTabCount');
                if (tabCount) tabCount.textContent = '(Error)';
                this.dataFetched.actions = true;
                this.checkAllDataLoaded();
            });
    },
    
    // NEW: Dynamic principles fetcher that parses princi2.txt
    fetchPrinciplesList: function() {
        fetch('/princi2.txt')
            .then(response => response.text())
            .then(data => {
                const tabElement = document.getElementById('principlesTabList');
                const tabCount = document.getElementById('principlesTabCount');
                
                // Parse principles from the text format
                const principles = this.parsePrinciplesFromText(data);
                
                // Update tab count
                if (tabCount) {
                    tabCount.textContent = `(${principles.length})`;
                }
                
                // Group principles by their Group/Tier
                const principlesByGroup = {};
                principles.forEach(principle => {
                    const group = principle.group || 'Uncategorized';
                    if (!principlesByGroup[group]) {
                        principlesByGroup[group] = [];
                    }
                    principlesByGroup[group].push(principle);
                });
                
                // Create the HTML - now dynamically based on parsed groups
                if (tabElement) {
                    let html = `
                        <div style="padding: 0.5rem;">
                            <div class="loader-principles-intro" style="margin-bottom: 1rem;">
                                <p style="font-size: 0.875rem; color: #666; font-style: italic;">
                                    ${principles.length} principles across ${Object.keys(principlesByGroup).length} tiers guide every interaction, decision, and evolution of the system
                                </p>
                            </div>
                    `;
                    
                    // Sort groups by tier number (extract from group name)
                    const sortedGroups = Object.keys(principlesByGroup).sort((a, b) => {
                        const tierA = this.extractTierNumber(a);
                        const tierB = this.extractTierNumber(b);
                        return tierA - tierB;
                    });
                    
                    // Display each group
                    sortedGroups.forEach(group => {
                        const groupPrinciples = principlesByGroup[group];
                        // Sort principles within group by priority (highest first)
                        groupPrinciples.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                        
                        html += `
                            <div style="margin-bottom: 1.5rem;">
                                <h4 style="font-size: 0.9rem; color: #4a76a8; margin-bottom: 0.75rem; padding: 0.5rem; background: #e3f2fd; border-radius: 4px;">
                                    ${this.escapeHtml(group)} (${groupPrinciples.length})
                                </h4>
                                <div class="loader-principles-list">
                        `;
                        
                        groupPrinciples.forEach(principle => {
                            const priorityColor = principle.priority >= 7 ? '#e53e3e' : 
                                                principle.priority >= 5 ? '#ed8936' : 
                                                principle.priority >= 3 ? '#4a76a8' : '#718096';
                            
                            html += `
                                <div class="loader-principle-item" style="position: relative; padding-right: 2rem;">
                                    <span class="loader-principle-name">${this.escapeHtml(principle.id)} - ${this.escapeHtml(principle.name)}</span>
                                    <span style="position: absolute; top: 0.75rem; right: 0.5rem; font-size: 0.7rem; color: ${priorityColor}; font-weight: bold;">P${principle.priority || '?'}</span>
                                </div>
                            `;
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += '</div>';
                    tabElement.innerHTML = html;
                }
                
                this.dataFetched.principles = true;
                this.checkAllDataLoaded();
            })
            .catch(error => {
                console.warn('Failed to fetch principles:', error);
                const tabElement = document.getElementById('principlesTabList');
                if (tabElement) tabElement.textContent = 'Error loading principles';
                const tabCount = document.getElementById('principlesTabCount');
                if (tabCount) tabCount.textContent = '(Error)';
                this.dataFetched.principles = true;
                this.checkAllDataLoaded();
            });
    },

    // NEW: Parser for princi2.txt format
    parsePrinciplesFromText: function(text) {
        const principles = [];
        const lines = text.split('\n');
        let currentPrinciple = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this is a principle ID line (e.g., "P034 – Progenitor Identity & Authority")
            const principleMatch = line.match(/^(P\d+)\s*–\s*(.+)$/);
            if (principleMatch) {
                // Save previous principle if exists
                if (currentPrinciple) {
                    principles.push(currentPrinciple);
                }
                
                // Start new principle
                currentPrinciple = {
                    id: principleMatch[1],
                    name: principleMatch[2].trim(),
                    group: null,
                    priority: null,
                    description: ''
                };
                continue;
            }
            
            // Parse Group line
            if (line.startsWith('Group:') && currentPrinciple) {
                currentPrinciple.group = line.substring(6).trim();
                continue;
            }
            
            // Parse Priority line
            if (line.startsWith('Priority:') && currentPrinciple) {
                const priorityMatch = line.match(/Priority:\s*(\d+)/);
                if (priorityMatch) {
                    currentPrinciple.priority = parseInt(priorityMatch[1]);
                }
                continue;
            }
            
            // Parse Description line
            if (line.startsWith('Description:') && currentPrinciple) {
                currentPrinciple.description = line.substring(12).trim();
                // Continue reading multi-line descriptions
                let j = i + 1;
                while (j < lines.length && lines[j].trim() && !lines[j].trim().match(/^P\d+\s*–/)) {
                    currentPrinciple.description += ' ' + lines[j].trim();
                    j++;
                }
                i = j - 1; // Skip the lines we just read
                continue;
            }
        }
        
        // Don't forget the last principle
        if (currentPrinciple) {
            principles.push(currentPrinciple);
        }
        
        return principles;
    },

    // Helper to extract tier number from group name
    extractTierNumber: function(groupName) {
        const match = groupName.match(/Tier\s*(\d+)/i);
        return match ? parseInt(match[1]) : 999;
    },
    
    fetchMemoriesCount: function() {
        fetch('/api/memory')
            .then(response => response.json())
            .then(data => {
                let totalMemories = 0;
                
                if (data.facts) {
                    Object.values(data.facts).forEach(category => {
                        totalMemories += Object.keys(category).length;
                    });
                }
                
                if (data.conversations) {
                    totalMemories += Object.keys(data.conversations).length;
                }
                
                if (data.preferences) {
                    totalMemories += Object.keys(data.preferences).length;
                }
                
                this.loadingScreenData.memories = data;
                this.loadingScreenData.memoriesCount = totalMemories;
                
                const tabCount = document.getElementById('memoriesTabCount');
                if (tabCount) {
                    tabCount.textContent = `(${totalMemories})`;
                }
                
                this.displayMemories(data);
                this.dataFetched.memories = true;
                this.checkAllDataLoaded();
            })
            .catch(error => {
                console.warn('Failed to fetch memories:', error);
                const tabCount = document.getElementById('memoriesTabCount');
                if (tabCount) tabCount.textContent = '(N/A)';
                this.dataFetched.memories = true;
                this.checkAllDataLoaded();
            });
    },
    
    displayMemories: function(data) {
        const listElement = document.getElementById('memoriesList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        listElement.className = 'loader-data-value loader-memories-list';
        
        // Facts Category
        if (data.facts && Object.keys(data.facts).length > 0) {
            const factsCategory = document.createElement('div');
            factsCategory.className = 'loader-memory-category';
            
            let factsHtml = `
                <div class="loader-memory-category-title">
                    <span class="loader-memory-category-icon">📚</span>
                    <span>Facts</span>
                    <span class="loader-memory-category-count">${Object.values(data.facts).reduce((sum, cat) => sum + Object.keys(cat).length, 0)} items</span>
                </div>
            `;
            
            Object.entries(data.facts).forEach(([category, facts]) => {
                factsHtml += `
                    <div class="loader-memory-subcategory">
                        <div class="loader-memory-subcategory-title">${category} (${Object.keys(facts).length})</div>
                        <div class="loader-memory-items">
                            ${Object.entries(facts).map(([key, factData]) => {
                                // Handle both direct values and objects with 'value' property
                                let value = '';
                                if (typeof factData === 'object' && factData !== null && 'value' in factData) {
                                    value = factData.value;
                                } else {
                                    value = factData;
                                }
                                return `
                                    <div class="loader-memory-item">
                                        <span class="loader-memory-bullet">›</span>
                                        <span class="loader-memory-key">${key}:</span>
                                        <span class="loader-memory-value">${value}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            });
            
            factsCategory.innerHTML = factsHtml;
            listElement.appendChild(factsCategory);
        }
        
        // Conversations Category
        if (data.conversations && Object.keys(data.conversations).length > 0) {
            const convoCategory = document.createElement('div');
            convoCategory.className = 'loader-memory-category';
            convoCategory.innerHTML = `
                <div class="loader-memory-category-title">
                    <span class="loader-memory-category-icon">💬</span>
                    <span>Conversations</span>
                    <span class="loader-memory-category-count">${Object.keys(data.conversations).length} items</span>
                </div>
                <div class="loader-memory-items">
                    ${Object.entries(data.conversations).map(([key, value]) => `
                        <div class="loader-memory-item">
                            <span class="loader-memory-bullet">›</span>
                            <span class="loader-memory-key">${key}:</span>
                            <span class="loader-memory-value">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            listElement.appendChild(convoCategory);
        }
        
        // Preferences Category
        if (data.preferences && Object.keys(data.preferences).length > 0) {
            const prefCategory = document.createElement('div');
            prefCategory.className = 'loader-memory-category';
            prefCategory.innerHTML = `
                <div class="loader-memory-category-title">
                    <span class="loader-memory-category-icon">⚙️</span>
                    <span>Preferences</span>
                    <span class="loader-memory-category-count">${Object.keys(data.preferences).length} items</span>
                </div>
                <div class="loader-memory-items">
                    ${Object.entries(data.preferences).map(([key, value]) => `
                        <div class="loader-memory-item">
                            <span class="loader-memory-bullet">›</span>
                            <span class="loader-memory-key">${key}:</span>
                            <span class="loader-memory-value">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            listElement.appendChild(prefCategory);
        }
    },
    
    // Updated fetchToolsList to handle new agent_tools.json structure
    fetchToolsList: function() {
        fetch('/agent_tools.json')
            .then(response => response.json())
            .then(data => {
                let totalTools = 0;
                
                // NEW STRUCTURE: Count tools from the 'tools' object
                if (data.tools && typeof data.tools === 'object') {
                    totalTools = Object.keys(data.tools).length;
                }
                
                this.loadingScreenData.tools = data;
                this.loadingScreenData.toolsCount = totalTools;
                
                const tabCount = document.getElementById('toolsTabCount');
                if (tabCount) tabCount.textContent = `(${totalTools})`;
                
                this.displayTools(data);
                this.dataFetched.tools = true;
                this.checkAllDataLoaded();
            })
            .catch(error => {
                console.warn('Failed to fetch tools:', error);
                const tabCount = document.getElementById('toolsTabCount');
                if (tabCount) tabCount.textContent = '(Error)';
                this.dataFetched.tools = true;
                this.checkAllDataLoaded();
            });
    },
    
    // Updated displayTools to handle new structure with tools/categories/metadata
    displayTools: function(data) {
        const listElement = document.getElementById('toolsList');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        listElement.className = 'loader-data-value loader-commands-list';
        
        // NEW: Extract tools and group by category
        if (!data.tools || typeof data.tools !== 'object') {
            listElement.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No tools configured</div>';
            return;
        }
        
        // Group tools by category
        const toolsByCategory = {};
        Object.entries(data.tools).forEach(([toolId, toolData]) => {
            const category = toolData.category || 'uncategorized';
            if (!toolsByCategory[category]) {
                toolsByCategory[category] = [];
            }
            toolsByCategory[category].push({ id: toolId, ...toolData });
        });
        
        // Get category metadata for better display
        const categoryMetadata = data.categories || {};
        
        // Category configuration with icons and colors
        const categoryConfig = {
            'communication': { icon: '💬', color: '#4a76a8', bgColor: 'rgba(74, 118, 168, 0.1)' },
            'control': { icon: '🎮', color: '#9333ea', bgColor: 'rgba(147, 51, 234, 0.1)' },
            'system': { icon: '⚙️', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.1)' },
            'memory': { icon: '🧠', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
            'uncategorized': { icon: '📦', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' }
        };
        
        // Process each category
        Object.entries(toolsByCategory).forEach(([categoryKey, tools]) => {
            const config = categoryConfig[categoryKey] || categoryConfig['uncategorized'];
            const categoryInfo = categoryMetadata[categoryKey] || { name: categoryKey, description: '' };
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'loader-command-category';
            categoryDiv.style.marginBottom = '20px';
            
            // Category header with metadata
            let categoryHtml = `
                <div class="loader-command-category-title" style="margin-bottom: 12px;">
                    <span class="loader-command-category-icon">${config.icon}</span>
                    <span style="color: ${config.color};">${categoryInfo.name} (${tools.length})</span>
                </div>
            `;
            
            // Add category description if available
            if (categoryInfo.description) {
                categoryHtml += `<div style="font-size: 0.8rem; color: #666; margin: -8px 0 12px 28px; font-style: italic;">${this.escapeHtml(categoryInfo.description)}</div>`;
            }
            
            // Add important note if available
            if (categoryInfo.important_note) {
                categoryHtml += `<div style="font-size: 0.75rem; color: #e53e3e; margin: -8px 0 12px 28px; font-weight: 600;">⚠️ ${this.escapeHtml(categoryInfo.important_note)}</div>`;
            }
            
            // Tools list
            categoryHtml += '<div class="loader-tools-list">';
            
            tools.forEach(tool => {
                const params = tool.parameters ? Object.entries(tool.parameters)
                    .map(([key, param]) => `${key}${param.required ? '*' : ''}`)
                    .join(', ') : '';
                
                categoryHtml += `
                    <div class="loader-tool-item" style="margin-bottom: 12px; padding: 10px; background: ${config.bgColor}; border-radius: 6px; border: 1px solid ${config.color}33;">
                        <div style="display: flex; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 0.25rem;">
                            <span class="loader-command-bullet" style="color: ${config.color}; margin-right: 8px; flex-shrink: 0;">›</span>
                            <span class="loader-tool-command" style="font-weight: 600; color: ${config.color}; font-family: monospace; word-break: break-all; min-width: 0;">${this.escapeHtml(tool.name)}</span>
                            ${params ? `<span style="font-size: 0.7rem; color: #718096;">(${this.escapeHtml(params)})</span>` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: #4a5568; margin-left: 20px; margin-bottom: 4px; word-wrap: break-word;">${this.escapeHtml(tool.description)}</div>
                `;
                
                // Add notes if available
                if (tool.notes && typeof tool.notes === 'object') {
                    Object.entries(tool.notes).forEach(([noteKey, noteValue]) => {
                        if (Array.isArray(noteValue)) {
                            categoryHtml += `<div style="font-size: 0.7rem; color: #718096; margin-left: 20px; margin-top: 2px;">
                                <span style="color: ${config.color}; font-weight: 600;">${this.escapeHtml(noteKey)}:</span> ${this.escapeHtml(noteValue.join(', '))}
                            </div>`;
                        } else if (typeof noteValue === 'object') {
                            categoryHtml += `<div style="font-size: 0.7rem; color: #718096; margin-left: 20px; margin-top: 2px;">
                                <span style="color: ${config.color}; font-weight: 600;">${this.escapeHtml(noteKey)}:</span> ${this.escapeHtml(JSON.stringify(noteValue))}
                            </div>`;
                        } else {
                            categoryHtml += `<div style="font-size: 0.7rem; color: #718096; margin-left: 20px; margin-top: 2px;">
                                <span style="color: ${config.color}; font-weight: 600;">${this.escapeHtml(noteKey)}:</span> ${this.escapeHtml(String(noteValue))}
                            </div>`;
                        }
                    });
                }
                
                categoryHtml += '</div>';
            });
            
            categoryHtml += '</div>';
            categoryDiv.innerHTML = categoryHtml;
            listElement.appendChild(categoryDiv);
        });
        
        // Add metadata footer if available
        if (data.metadata) {
            const metadataDiv = document.createElement('div');
            metadataDiv.style.cssText = 'margin-top: 20px; padding: 10px; background: #f7fafc; border-radius: 6px; font-size: 0.75rem; color: #718096; text-align: center;';
            metadataDiv.innerHTML = `
                <div>Version: ${this.escapeHtml(data.metadata.version || 'Unknown')}</div>
                ${data.metadata.frontend_format ? `<div style="color: #e53e3e; font-weight: 600; margin-top: 4px;">Frontend: ${this.escapeHtml(data.metadata.frontend_format)}</div>` : ''}
            `;
            listElement.appendChild(metadataDiv);
        }
    },
    
    // NEW: Add displayFeatures method
    displayFeatures: function() {
        const listElement = document.getElementById('featuresTabList');
        if (!listElement) return;

const featuresData = [
            '🔊,Text-to-Speech', '🎤,Speech-to-Text', '🤲,Hands-Free', '🎵,Background Sounds',
            '📋,Toggleable Logs', '🎛️,Non-Intrusive Panels', '💾,Persistent Memory', '🔄,Cross-Service',
            '⌨️,Command-Line Based', '🔒,Secure Webserver', '🤖,Autonomous Behavior', '🧩,Adaptive Principle System',
            '💻,Local OS Aware', '👤,User-Centric', '📡,Server Detection', '🎯,Priority-Based',
            '🛠️,Custom Framework', '🔗,External API Capable', '😊,Emotion Tracking',
            '🌀,Perturbation Layer', '⚙️,Pre/Post-Processing', '🚫,Word Blocker', '📁,File Loader',
            '💬,Cross-Convo Context', '🎭,Persona Controllers', '🔠,Silent Structure', '👥,Multi-Client',
            '📝,Pre-Prompts', '📟,System Manipulation', '🖱️,UI Manipulation', '👨‍🔧,Multiple AI Consultants',
            '🧭,Topic/Keyword Triggered Events', '🔐,User Authentication', '🗄️,User-Based Convo History', 
            '🎯,Agent Goal Mode', '🧱,Full Stack Architecture', '🗺️,Lore World Building',
            '📊,AI Log Inspection', '🛡️,High-Privilege Security Layer', '🪶,Offline Model Support'
        ];
        
        const featuresCount = featuresData.length;
        
        // Update tab count
        const tabCount = document.getElementById('featuresTabCount');
        if (tabCount) tabCount.textContent = `(${featuresCount})`;
        
        // Create features HTML
        listElement.innerHTML = '';
        listElement.className = 'loader-data-value loader-features-list';
        
        const featuresContainer = document.createElement('div');
        featuresContainer.className = 'loader-features-grid-container';
        
        const featuresGrid = document.createElement('div');
        featuresGrid.className = 'loader-features-grid';
        featuresGrid.style.padding = '0.5rem';
        
        // Create feature items
        const featureItemsHtml = featuresData.map(feature => {
            const [icon, name] = feature.split(',');
            return `
                <div class="loader-feature-item">
                    <span class="loader-feature-icon">${icon}</span>
                    <span class="loader-feature-name">${name}</span>
                </div>
            `;
        }).join('');
        
        featuresGrid.innerHTML = featureItemsHtml;
        featuresContainer.appendChild(featuresGrid);
        listElement.appendChild(featuresContainer);
    },
    
    updateLoadingScreenLayout: function() {
        const loader = document.getElementById('appLoader');
        const container = document.querySelector('.loader-main-container');
        const dataGrid = document.getElementById('loaderDataGrid');
        
        if (!loader || !container) return;
        
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const isLandscape = vw > vh;
        const isSmallScreen = vw <= 600 || vh <= 500;
        const isVerySmallLandscape = isLandscape && vh <= 500;
        
        loader.classList.toggle('landscape-mode', isLandscape);
        loader.classList.toggle('small-screen', isSmallScreen);
        loader.classList.toggle('very-small-landscape', isVerySmallLandscape);
        
        const compactMsg = document.querySelector('.compact-loading-msg');
        if (compactMsg) {
            compactMsg.remove();
        }
        
        if (dataGrid) {
            dataGrid.style.maxHeight = '';
            dataGrid.style.overflow = '';
        }
        
        if (CSS.supports('-webkit-touch-callout', 'none')) {
            const actualHeight = window.innerHeight;
            loader.style.height = `${actualHeight}px`;
        }
    }
};

// Function to update auth status in loading screen - KEEP THIS GLOBAL
function updateLoaderAuthStatus(isAuthenticated, username) {
    const loaderAuthStatusEl = document.getElementById('loaderAuthStatus');
    const showLoginBtn = document.getElementById('showLoginBtn');

    if (loaderAuthStatusEl) {
        loaderAuthStatusEl.classList.remove('status-success', 'status-error', 'status-loading'); 

        if (isAuthenticated && username) {
            loaderAuthStatusEl.textContent = `Welcome back, ${username}!`;
            loaderAuthStatusEl.classList.add('status-success');
            if (showLoginBtn) showLoginBtn.style.display = 'none';
        } else {
            // CHANGE: Updated message to not imply login is required
            loaderAuthStatusEl.textContent = '(Registration Unavailable)';
            loaderAuthStatusEl.classList.add('status-loading'); 
            if (showLoginBtn) showLoginBtn.style.display = 'inline-flex'; 
        }
    }
}

// Initialize loading screen when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    LoadingScreen.init();
    
    const initialAuthStatusEl = document.getElementById('loaderAuthStatus');
    if (initialAuthStatusEl) {
        initialAuthStatusEl.textContent = 'Checking credentials...';
        initialAuthStatusEl.classList.add('status-loading');
    }

    // Wait a bit to ensure authManager is loaded
    setTimeout(() => {
        if (typeof authManager !== 'undefined') {
            const loaderAuthStatusOnInit = document.getElementById('loaderAuthStatus');
            if (loaderAuthStatusOnInit) {
                loaderAuthStatusOnInit.textContent = 'Verifying session...';
                loaderAuthStatusOnInit.classList.remove('status-success', 'status-error');
                loaderAuthStatusOnInit.classList.add('status-loading');
            }

            // Check if already authenticated from stored values
            if (authManager.token && authManager.username) {
                updateLoaderAuthStatus(true, authManager.username);
            } else {
                authManager.initializeAuth().then(isAuthenticated => {
                    updateLoaderAuthStatus(isAuthenticated, authManager.username);
                }).catch(error => {
                    console.error("Error during AuthManager initialization:", error);
                    const loaderAuthStatusOnError = document.getElementById('loaderAuthStatus');
                    if (loaderAuthStatusOnError) {
                        loaderAuthStatusOnError.textContent = 'Authentication system error.';
                        loaderAuthStatusOnError.classList.remove('status-success', 'status-loading');
                        loaderAuthStatusOnError.classList.add('status-error');
                    }
                });
            }
        } else {
             console.error("authManager is not defined at DOMContentLoaded for loader screen.");
             const loaderAuthStatusNoAuth = document.getElementById('loaderAuthStatus');
             if (loaderAuthStatusNoAuth) {
                loaderAuthStatusNoAuth.textContent = 'Authentication system unavailable.';
                loaderAuthStatusNoAuth.classList.remove('status-success', 'status-loading');
                loaderAuthStatusNoAuth.classList.add('status-error');
             }
        }
    }, 100); // Small delay to ensure auth.js is loaded
});

// Listen for auth changes from auth.js
document.addEventListener('authChange', function(event) {
    updateLoaderAuthStatus(event.detail.isAuthenticated, event.detail.username);
});

// Export layout updater for external use - KEEP THIS GLOBAL
window._loadingScreenLayoutUpdater = {
    update: LoadingScreen.updateLoadingScreenLayout.bind(LoadingScreen)
};