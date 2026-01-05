/**
 * ==============================================================================================
 * Left Panel 3 - Wikipedia Integration Component (FIXED)
 * ==============================================================================================
 *
 * Fetches article list via API, sends commands, allows opening articles in browser.
 * Uses standard registration pattern with improved UX and error handling.
 * FIXED: Now correctly reads 'recent_articles' field from API response.
 *
 * @version 2.2.1 - API Response Field Fix
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-3',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            wikiContainer: null,
            searchInput: null,
            articlesList: null,
            autoSuggestToggle: null
        },

        // Component state
        state: {
            wikiActive: false,
            articles: [],
            isSearching: false,
            autoSuggestEnabled: true, // Default state
            subscriptions: []
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            console.log(`[${this.id}] Initializing...`);
            
            // Cache DOM references
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`Content element for ${this.id} not found`);
                return;
            }
            
            // Create UI structure
            this.renderContent();
            
            // Subscribe to active actions changes to detect "wiki_action" plugin
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateWikiState(data.actions);
            });
            
            // Store subscription for cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });
            
            // Initial state check
            this.checkInitialWikiState();
            
            console.log(`[${this.id}] Initialization complete`);
        },
        
        /**
         * Check initial state of "wiki_action" plugin
         */
        checkInitialWikiState: function() {
            fetch(CONFIG.api.activeActions)
                .then(response => response.json())
                .then(data => {
                    if (data && data.actions) {
                        this.updateWikiState(data.actions);
                    }
                })
                .catch(error => {
                    console.error('Error checking initial wiki state:', error);
                });
        },
        
        /**
         * Update component state based on wiki active status
         * @param {Array} actions - Active actions array
         */
        updateWikiState: function(actions) {
            // Check if "wiki_action" plugin is in the active actions - check multiple variations
            const isWikiActive = actions.some(action => {
                const [name] = action.split(':');
                const lowercaseName = name.trim().toLowerCase();
                return lowercaseName === 'wiki' || 
                       lowercaseName === 'wikipedia' || 
                       lowercaseName === 'wiki_action';
            });
            
            console.log(`[${this.id}] Wiki active state: ${isWikiActive}`);
            
            // Only update if state has changed
            if (this.state.wikiActive !== isWikiActive) {
                this.state.wikiActive = isWikiActive;
                
                // Update UI visibility
                this.updateUIVisibility();
                
                // Fetch Wikipedia data if active
                if (isWikiActive) {
                    this.fetchArticles();
                }
            }
        },
        
        /**
         * Update UI element visibility based on active state
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.wikiActive ? 'none' : 'block';
            }
            
            if (this.dom.wikiContainer) {
                this.dom.wikiContainer.style.display = this.state.wikiActive ? 'block' : 'none';
            }
        },
        
        /**
         * Render component content
         */
        renderContent: function() {
            if (!this.dom.content) return;
            
            // Create main container
            const container = document.createElement('div');
            container.className = 'wikipedia-panel';
            
            // Create warning note for wiki requirement - UPDATED MESSAGE
            const noteElement = document.createElement('div');
            noteElement.className = 'wiki-note';
            noteElement.innerHTML = '<strong>Plugin Required</strong><br>You must start the "wiki_action" plugin to access Wikipedia features';
            noteElement.style.padding = '10px';
            noteElement.style.margin = '10px 0';
            noteElement.style.backgroundColor = '#fff4e5';
            noteElement.style.border = '1px solid #ffcc80';
            noteElement.style.borderRadius = '5px';
            noteElement.style.color = '#e65100';
            noteElement.style.textAlign = 'center';
            this.dom.noteElement = noteElement;
            container.appendChild(noteElement);
            
            // Create wiki container
            const wikiContainer = document.createElement('div');
            wikiContainer.className = 'wiki-container';
            wikiContainer.style.display = this.state.wikiActive ? 'block' : 'none';
            this.dom.wikiContainer = wikiContainer;
            
            // Create search section
            const searchSection = document.createElement('div');
            searchSection.className = 'search-section';
            searchSection.style.padding = '10px';
            searchSection.style.borderBottom = '1px solid #e0e0e0';
            
            const searchTitle = document.createElement('h4');
            searchTitle.textContent = 'Wikipedia Search';
            searchTitle.style.margin = '0 0 10px 0';
            searchTitle.style.color = '#4a76a8';
            searchSection.appendChild(searchTitle);
            
            const searchForm = document.createElement('div');
            searchForm.className = 'search-form';
            searchForm.style.display = 'flex';
            searchForm.style.marginBottom = '10px';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search Wikipedia...';
            searchInput.style.flex = '1';
            searchInput.style.padding = '8px';
            searchInput.style.border = '1px solid #ccc';
            searchInput.style.borderRadius = '4px';
            searchInput.style.marginRight = '5px';
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search(searchInput.value);
                }
            });
            this.dom.searchInput = searchInput;
            searchForm.appendChild(searchInput);
            
            const searchButton = document.createElement('button');
            searchButton.textContent = 'Search';
            searchButton.className = 'search-button';
            searchButton.style.padding = '8px 15px';
            searchButton.style.backgroundColor = '#4a76a8';
            searchButton.style.color = 'white';
            searchButton.style.border = 'none';
            searchButton.style.borderRadius = '4px';
            searchButton.style.cursor = 'pointer';
            searchButton.addEventListener('click', () => {
                this.search(searchInput.value);
            });
            searchForm.appendChild(searchButton);
            
            searchSection.appendChild(searchForm);
            
            // Auto-suggest setting
            const autoSuggestContainer = document.createElement('div');
            autoSuggestContainer.className = 'auto-suggest-container';
            autoSuggestContainer.style.display = 'flex';
            autoSuggestContainer.style.alignItems = 'center';
            
            const autoSuggestToggle = document.createElement('input');
            autoSuggestToggle.type = 'checkbox';
            autoSuggestToggle.id = 'autoSuggestToggle';
            autoSuggestToggle.className = 'auto-suggest-toggle';
            autoSuggestToggle.checked = this.state.autoSuggestEnabled;
            autoSuggestToggle.addEventListener('change', () => {
                this.toggleAutoSuggest(autoSuggestToggle.checked);
            });
            this.dom.autoSuggestToggle = autoSuggestToggle;
            autoSuggestContainer.appendChild(autoSuggestToggle);
            
            const autoSuggestLabel = document.createElement('label');
            autoSuggestLabel.setAttribute('for', 'autoSuggestToggle');
            autoSuggestLabel.textContent = 'Auto-suggest Wikipedia articles';
            autoSuggestLabel.style.marginLeft = '5px';
            autoSuggestLabel.style.fontSize = '0.9rem';
            autoSuggestLabel.style.color = '#666';
            autoSuggestContainer.appendChild(autoSuggestLabel);
            
            searchSection.appendChild(autoSuggestContainer);
            wikiContainer.appendChild(searchSection);
            
            // Create articles section
            const articlesSection = document.createElement('div');
            articlesSection.className = 'articles-section';
            articlesSection.style.padding = '10px';
            
            const articlesHeader = document.createElement('div');
            articlesHeader.className = 'articles-header';
            articlesHeader.style.display = 'flex';
            articlesHeader.style.justifyContent = 'space-between';
            articlesHeader.style.alignItems = 'center';
            articlesHeader.style.marginBottom = '10px';
            
            const articlesTitle = document.createElement('h4');
            articlesTitle.textContent = 'Recent Articles';
            articlesTitle.style.margin = '0';
            articlesTitle.style.color = '#4a76a8';
            articlesHeader.appendChild(articlesTitle);
            
            const refreshButton = document.createElement('button');
            refreshButton.innerHTML = '🔄';
            refreshButton.className = 'refresh-button';
            refreshButton.style.background = 'none';
            refreshButton.style.border = 'none';
            refreshButton.style.color = '#4a76a8';
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.fontSize = '1.2rem';
            refreshButton.style.padding = '0';
            refreshButton.style.lineHeight = '1';
            refreshButton.title = 'Refresh article list';
            refreshButton.addEventListener('click', () => {
                this.fetchArticles();
                Framework.showToast('Refreshing article list...');
            });
            articlesHeader.appendChild(refreshButton);
            
            articlesSection.appendChild(articlesHeader);
            
            const articlesList = document.createElement('div');
            articlesList.className = 'articles-list';
            articlesList.style.border = '1px solid #e0e0e0';
            articlesList.style.borderRadius = '4px';
            articlesList.style.maxHeight = '300px';
            articlesList.style.overflowY = 'auto';
            articlesList.style.padding = '5px';
            articlesList.style.backgroundColor = '#fafafa';
            this.dom.articlesList = articlesList;
            
            articlesSection.appendChild(articlesList);
            wikiContainer.appendChild(articlesSection);
            
            // Create commands section
            const commandsSection = document.createElement('div');
            commandsSection.className = 'commands-section';
            commandsSection.style.padding = '10px';
            commandsSection.style.borderTop = '1px solid #e0e0e0';
            commandsSection.style.marginTop = '10px';
            
            const commandsTitle = document.createElement('h4');
            commandsTitle.textContent = 'Wiki Commands';
            commandsTitle.style.margin = '0 0 10px 0';
            commandsTitle.style.color = '#4a76a8';
            commandsSection.appendChild(commandsTitle);
            
            const commandsList = document.createElement('ul');
            commandsList.style.margin = '0';
            commandsList.style.paddingLeft = '20px';
            
            const commands = [
                'wiki search [term] - Search for articles',
                'wiki open [index] - Open article in browser',
                'wiki auto [on/off] - Toggle auto-suggestions'
            ];
            
            commands.forEach(command => {
                const item = document.createElement('li');
                item.textContent = command;
                item.style.marginBottom = '5px';
                item.style.fontSize = '0.9rem';
                commandsList.appendChild(item);
            });
            
            commandsSection.appendChild(commandsList);
            wikiContainer.appendChild(commandsSection);
            
            // Help text for starting the plugin if not active
            const helpText = document.createElement('div');
            helpText.className = 'help-text';
            helpText.innerHTML = 'To start the plugin, type <code>start wiki_action</code> in the chat input.';
            helpText.style.marginTop = '10px';
            helpText.style.fontSize = '0.9rem';
            helpText.style.color = '#666';
            helpText.style.fontStyle = 'italic';
            helpText.style.textAlign = 'center';
            helpText.style.padding = '5px';
            helpText.style.backgroundColor = '#f5f5f5';
            helpText.style.borderRadius = '4px';
            noteElement.appendChild(helpText);
            
            container.appendChild(wikiContainer);
            this.dom.content.appendChild(container);
            
            // Render initial articles list
            this.renderArticles();
        },
        
        /**
         * Fetch articles from API
         */
        fetchArticles: function() {
            if (!this.state.wikiActive) return;
            
            // Check if API endpoint is defined
            if (!CONFIG.api.wikipediaList) {
                console.error('Wikipedia list API endpoint not defined in config');
                this.renderEmptyArticles('API endpoint not configured');
                return;
            }
            
            this.renderLoadingArticles();
            
            fetch(CONFIG.api.wikipediaList)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Fetched Wikipedia articles:', data);
                    
                    // FIXED: Now checking for recent_articles instead of articles
                    if (data.success && data.recent_articles) {
                        this.state.articles = data.recent_articles;
                    } else {
                        this.state.articles = [];
                    }
                    
                    this.renderArticles();
                })
                .catch(error => {
                    console.error('Error fetching articles:', error);
                    this.renderEmptyArticles('Error fetching articles');
                });
        },
        
        /**
         * Render articles list
         */
        renderArticles: function() {
            if (!this.dom.articlesList) return;
            
            this.dom.articlesList.innerHTML = '';
            
            if (this.state.isSearching) {
                this.renderLoadingArticles();
                return;
            }
            
            if (!this.state.articles || this.state.articles.length === 0) {
                this.renderEmptyArticles('No articles found');
                return;
            }
            
            this.state.articles.forEach((article, index) => {
                const articleItem = document.createElement('div');
                articleItem.className = 'article-item';
                articleItem.style.backgroundColor = 'white';
                articleItem.style.border = '1px solid #e0e0e0';
                articleItem.style.borderRadius = '4px';
                articleItem.style.padding = '10px';
                articleItem.style.marginBottom = '8px';
                articleItem.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
                
                // Add hover effect
                articleItem.addEventListener('mouseenter', () => {
                    articleItem.style.transform = 'translateY(-2px)';
                    articleItem.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                });
                
                articleItem.addEventListener('mouseleave', () => {
                    articleItem.style.transform = 'translateY(0)';
                    articleItem.style.boxShadow = 'none';
                });
                
                const articleHeader = document.createElement('div');
                articleHeader.style.display = 'flex';
                articleHeader.style.alignItems = 'center';
                articleHeader.style.marginBottom = '5px';
                
                const articleIndex = document.createElement('span');
                articleIndex.textContent = article.index || (index + 1);
                articleIndex.style.backgroundColor = '#e3f2fd';
                articleIndex.style.color = '#4a76a8';
                articleIndex.style.borderRadius = '3px';
                articleIndex.style.padding = '2px 6px';
                articleIndex.style.marginRight = '8px';
                articleIndex.style.fontWeight = 'bold';
                articleHeader.appendChild(articleIndex);
                
                const articleTitle = document.createElement('h5');
                articleTitle.textContent = article.title;
                articleTitle.style.margin = '0';
                articleTitle.style.flex = '1';
                articleTitle.style.overflow = 'hidden';
                articleTitle.style.textOverflow = 'ellipsis';
                articleTitle.style.whiteSpace = 'nowrap';
                articleHeader.appendChild(articleTitle);
                
                articleItem.appendChild(articleHeader);
                
                if (article.summary) {
                    const articleSummary = document.createElement('p');
                    articleSummary.textContent = article.summary;
                    articleSummary.style.margin = '5px 0';
                    articleSummary.style.fontSize = '0.9rem';
                    articleSummary.style.color = '#666';
                    articleSummary.style.display = '-webkit-box';
                    articleSummary.style.webkitLineClamp = '2';
                    articleSummary.style.webkitBoxOrient = 'vertical';
                    articleSummary.style.overflow = 'hidden';
                    articleItem.appendChild(articleSummary);
                }
                
                const articleActions = document.createElement('div');
                articleActions.style.display = 'flex';
                articleActions.style.justifyContent = 'flex-end';
                articleActions.style.marginTop = '8px';
                articleActions.style.gap = '5px';
                
                // Check if the article has a URL we can display
                if (article.url) {
                    const urlText = document.createElement('div');
                    urlText.className = 'article-url';
                    urlText.textContent = article.url;
                    urlText.style.fontSize = '0.8rem';
                    urlText.style.color = '#999';
                    urlText.style.overflow = 'hidden';
                    urlText.style.textOverflow = 'ellipsis';
                    urlText.style.whiteSpace = 'nowrap';
                    urlText.style.maxWidth = '300px';
                    urlText.style.marginTop = '3px';
                    urlText.style.marginBottom = '5px';
                    articleItem.appendChild(urlText);
                }
                
                const openButton = document.createElement('button');
                openButton.textContent = 'Open in Browser';
                openButton.style.backgroundColor = '#4a76a8';
                openButton.style.color = 'white';
                openButton.style.border = 'none';
                openButton.style.borderRadius = '3px';
                openButton.style.padding = '5px 10px';
                openButton.style.fontSize = '0.85rem';
                openButton.style.cursor = 'pointer';
                openButton.style.transition = 'background-color 0.2s';
                
                // Add hover effect
                openButton.addEventListener('mouseenter', () => {
                    openButton.style.backgroundColor = '#3a5f8a';
                });
                
                openButton.addEventListener('mouseleave', () => {
                    openButton.style.backgroundColor = '#4a76a8';
                });
                
                openButton.addEventListener('click', () => {
                    this.openArticle(article.index || (index + 1), article);
                });
                articleActions.appendChild(openButton);
                
                // Add copy URL button if URL is available
                if (article.url) {
                    const copyUrlButton = document.createElement('button');
                    copyUrlButton.textContent = 'Copy URL';
                    copyUrlButton.style.backgroundColor = '#4caf50';
                    copyUrlButton.style.color = 'white';
                    copyUrlButton.style.border = 'none';
                    copyUrlButton.style.borderRadius = '3px';
                    copyUrlButton.style.padding = '5px 10px';
                    copyUrlButton.style.fontSize = '0.85rem';
                    copyUrlButton.style.cursor = 'pointer';
                    copyUrlButton.style.transition = 'background-color 0.2s';
                    
                    copyUrlButton.addEventListener('mouseenter', () => {
                        copyUrlButton.style.backgroundColor = '#3d8b40';
                    });
                    
                    copyUrlButton.addEventListener('mouseleave', () => {
                        copyUrlButton.style.backgroundColor = '#4caf50';
                    });
                    
                    copyUrlButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.copyToClipboard(article.url);
                    });
                    
                    articleActions.appendChild(copyUrlButton);
                }
                
                articleItem.appendChild(articleActions);
                
                this.dom.articlesList.appendChild(articleItem);
            });
        },
        
        /**
         * Show loading state in articles list
         */
        renderLoadingArticles: function() {
            if (!this.dom.articlesList) return;
            
            this.dom.articlesList.innerHTML = '';
            
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.innerHTML = '<div class="spinner"></div>Loading articles...';
            loadingMessage.style.padding = '20px';
            loadingMessage.style.textAlign = 'center';
            loadingMessage.style.color = '#999';
            loadingMessage.style.fontStyle = 'italic';
            
            // Add a loading spinner
            const styleEl = document.createElement('style');
            styleEl.textContent = `
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    margin-right: 10px;
                    border: 3px solid rgba(0, 0, 0, 0.1);
                    border-radius: 50%;
                    border-top-color: #4a76a8;
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleEl);
            
            this.dom.articlesList.appendChild(loadingMessage);
        },
        
        /**
         * Show empty state in articles list
         * @param {string} message - Message to display
         */
        renderEmptyArticles: function(message) {
            if (!this.dom.articlesList) return;
            
            this.dom.articlesList.innerHTML = '';
            
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = message || 'No articles found';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#999';
            emptyMessage.style.fontStyle = 'italic';
            
            this.dom.articlesList.appendChild(emptyMessage);
        },
        
        /**
         * Search for Wikipedia articles
         * @param {string} query - Search query
         */
        search: function(query) {
            if (!this.state.wikiActive) {
                Framework.showToast('Please start the wiki_action plugin first');
                return;
            }
            
            if (!query || query.trim() === '') {
                Framework.showToast('Please enter a search term');
                return;
            }
            
            console.log(`Searching Wikipedia for: ${query}`);
            this.state.isSearching = true;
            this.renderLoadingArticles();
            
            // Create command to send to backend via input
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = `wiki search ${query}`;
                Framework.sendMessage();
                Framework.showToast(`Searching Wikipedia for "${query}"`);
            }
            
            // Clear search input
            if (this.dom.searchInput) {
                this.dom.searchInput.value = '';
                this.dom.searchInput.focus();
            }
            
            // Add delay before fetching updated results
            setTimeout(() => {
                this.state.isSearching = false;
                this.fetchArticles();
            }, 2000);
        },
        
        /**
         * Copy text to clipboard
         * @param {string} text - Text to copy
         */
        copyToClipboard: function(text) {
            if (!text) return;
            
            // Use the clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        Framework.showToast('URL copied to clipboard');
                    })
                    .catch(err => {
                        console.error('Failed to copy URL:', err);
                        Framework.showToast('Failed to copy URL');
                        
                        // Fallback to the textarea method
                        this.fallbackCopyToClipboard(text);
                    });
            } else {
                // Fallback for browsers that don't support the clipboard API
                this.fallbackCopyToClipboard(text);
            }
        },
        
        /**
         * Fallback method to copy text using a temporary textarea
         * @param {string} text - Text to copy
         */
        fallbackCopyToClipboard: function(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // Make the textarea out of viewport
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            let success = false;
            try {
                success = document.execCommand('copy');
            } catch (err) {
                console.error('Fallback clipboard copy failed:', err);
            }
            
            document.body.removeChild(textArea);
            
            if (success) {
                Framework.showToast('URL copied to clipboard');
            } else {
                Framework.showToast('Failed to copy URL');
            }
        },
        
        /**
         * Open a Wikipedia article in browser
         * @param {number} index - Article index
         * @param {object} article - Article object (optional)
         */
        openArticle: function(index, article) {
            if (!this.state.wikiActive) {
                Framework.showToast('Please start the wiki_action plugin first');
                return;
            }
            
            console.log(`Opening article at index: ${index}`);
            
            // Create command to send to backend via input
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = `wiki open ${index}`;
                Framework.sendMessage();
                
                // Show more detailed toast with URL if available
                if (article && article.url) {
                    Framework.showToast(`Opening "${article.title}" in browser...`);
                    
                    // Provide URL as a fallback in case browser launch fails
                    setTimeout(() => {
                        Framework.showToast(`If browser didn't open, copy URL: ${article.url}`);
                    }, 3000);
                    
                    // Try to open the URL directly from the frontend as well (as a backup)
                    // This might be blocked by popup blockers but worth trying
                    try {
                        window.open(article.url, '_blank');
                    } catch (e) {
                        console.log('Browser popup blocked or failed:', e);
                    }
                } else {
                    Framework.showToast(`Opening article #${index} in browser...`);
                }
            }
        },
        
        /**
         * Toggle auto-suggest feature
         * @param {boolean} enabled - Whether auto-suggest should be enabled
         */
        toggleAutoSuggest: function(enabled) {
            if (!this.state.wikiActive) {
                Framework.showToast('Please start the wiki_action plugin first');
                
                // Reset toggle to match current state
                if (this.dom.autoSuggestToggle) {
                    this.dom.autoSuggestToggle.checked = this.state.autoSuggestEnabled;
                }
                return;
            }
            
            console.log(`Setting auto-suggest to: ${enabled}`);
            this.state.autoSuggestEnabled = enabled;
            
            // Create command to send to backend via input
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = `wiki auto ${enabled ? 'on' : 'off'}`;
                Framework.sendMessage();
            }
            
            Framework.showToast(`Wikipedia auto-suggestions ${enabled ? 'enabled' : 'disabled'}`);
        },
        
        /**
         * Clean up component resources
         */
        cleanup: function() {
            // Unsubscribe from events
            this.state.subscriptions.forEach(sub => {
                Framework.off(sub.event, sub.id);
            });
            this.state.subscriptions = [];
        }
    };
    
    // Register component
    Framework.registerComponent(component.id, component);
})();