/**
 * ==============================================================================================
 * Left Panel 4 - YouTube Integration Component (FIXED)
 * ==============================================================================================
 *
 * Fetches video list via API, sends commands, allows opening videos in browser.
 * Uses standard registration pattern with improved UX and error handling.
 * FIXED: Now correctly reads 'recent_videos' field from API response.
 *
 * @version 1.0.1 - API Response Field Fix
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-4',

        // DOM references
        dom: {
            content: null,
            noteElement: null,
            youtubeContainer: null,
            searchInput: null,
            videosList: null,
            autoSuggestToggle: null
        },

        // Component state
        state: {
            youtubeActive: false,
            videos: [],
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
            
            // Subscribe to active actions changes to detect "youtube_action" plugin
            const subscription = Framework.on('activeActionsUpdated', (data) => {
                this.updateYoutubeState(data.actions);
            });
            
            // Store subscription for cleanup
            this.state.subscriptions.push({
                event: 'activeActionsUpdated',
                id: subscription
            });
            
            // Initial state check
            this.checkInitialYoutubeState();
            
            console.log(`[${this.id}] Initialization complete`);
        },
        
        /**
         * Check initial state of "youtube_action" plugin
         */
        checkInitialYoutubeState: function() {
            fetch(CONFIG.api.activeActions)
                .then(response => response.json())
                .then(data => {
                    if (data && data.actions) {
                        this.updateYoutubeState(data.actions);
                    }
                })
                .catch(error => {
                    console.error('Error checking initial YouTube state:', error);
                });
        },
        
        /**
         * Update component state based on youtube active status
         * @param {Array} actions - Active actions array
         */
        updateYoutubeState: function(actions) {
            // Check if "youtube_action" plugin is in the active actions - check multiple variations
            const isYoutubeActive = actions.some(action => {
                const [name] = action.split(':');
                const lowercaseName = name.trim().toLowerCase();
                return lowercaseName === 'youtube' || 
                       lowercaseName === 'youtube_action';
            });
            
            console.log(`[${this.id}] YouTube active state: ${isYoutubeActive}`);
            
            // Only update if state has changed
            if (this.state.youtubeActive !== isYoutubeActive) {
                this.state.youtubeActive = isYoutubeActive;
                
                // Update UI visibility
                this.updateUIVisibility();
                
                // Fetch YouTube data if active
                if (isYoutubeActive) {
                    this.fetchVideos();
                }
            }
        },
        
        /**
         * Update UI element visibility based on active state
         */
        updateUIVisibility: function() {
            if (this.dom.noteElement) {
                this.dom.noteElement.style.display = this.state.youtubeActive ? 'none' : 'block';
            }
            
            if (this.dom.youtubeContainer) {
                this.dom.youtubeContainer.style.display = this.state.youtubeActive ? 'block' : 'none';
            }
        },
        
        /**
         * Render component content
         */
        renderContent: function() {
            if (!this.dom.content) return;
            
            // Create main container
            const container = document.createElement('div');
            container.className = 'youtube-panel';
            
            // Create warning note for YouTube requirement
            const noteElement = document.createElement('div');
            noteElement.className = 'youtube-note';
            noteElement.innerHTML = '<strong>Plugin Required</strong><br>You must start the "youtube_action" plugin to access YouTube features';
            noteElement.style.padding = '10px';
            noteElement.style.margin = '10px 0';
            noteElement.style.backgroundColor = '#fff4e5';
            noteElement.style.border = '1px solid #ffcc80';
            noteElement.style.borderRadius = '5px';
            noteElement.style.color = '#e65100';
            noteElement.style.textAlign = 'center';
            this.dom.noteElement = noteElement;
            container.appendChild(noteElement);
            
            // Create YouTube container
            const youtubeContainer = document.createElement('div');
            youtubeContainer.className = 'youtube-container';
            youtubeContainer.style.display = this.state.youtubeActive ? 'block' : 'none';
            this.dom.youtubeContainer = youtubeContainer;
            
            // Create search section
            const searchSection = document.createElement('div');
            searchSection.className = 'search-section';
            searchSection.style.padding = '10px';
            searchSection.style.borderBottom = '1px solid #e0e0e0';
            
            const searchTitle = document.createElement('h4');
            searchTitle.textContent = 'YouTube Search';
            searchTitle.style.margin = '0 0 10px 0';
            searchTitle.style.color = '#FF0000'; // YouTube Red
            searchSection.appendChild(searchTitle);
            
            const searchForm = document.createElement('div');
            searchForm.className = 'search-form';
            searchForm.style.display = 'flex';
            searchForm.style.marginBottom = '10px';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'search-input';
            searchInput.placeholder = 'Search YouTube...';
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
            searchButton.style.backgroundColor = '#FF0000'; // YouTube Red
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
            autoSuggestToggle.id = 'youtubeAutoSuggestToggle';
            autoSuggestToggle.className = 'auto-suggest-toggle';
            autoSuggestToggle.checked = this.state.autoSuggestEnabled;
            autoSuggestToggle.addEventListener('change', () => {
                this.toggleAutoSuggest(autoSuggestToggle.checked);
            });
            this.dom.autoSuggestToggle = autoSuggestToggle;
            autoSuggestContainer.appendChild(autoSuggestToggle);
            
            const autoSuggestLabel = document.createElement('label');
            autoSuggestLabel.setAttribute('for', 'youtubeAutoSuggestToggle');
            autoSuggestLabel.textContent = 'Auto-suggest YouTube videos';
            autoSuggestLabel.style.marginLeft = '5px';
            autoSuggestLabel.style.fontSize = '0.9rem';
            autoSuggestLabel.style.color = '#666';
            autoSuggestContainer.appendChild(autoSuggestLabel);
            
            searchSection.appendChild(autoSuggestContainer);
            youtubeContainer.appendChild(searchSection);
            
            // Create videos section
            const videosSection = document.createElement('div');
            videosSection.className = 'videos-section';
            videosSection.style.padding = '10px';
            
            const videosHeader = document.createElement('div');
            videosHeader.className = 'videos-header';
            videosHeader.style.display = 'flex';
            videosHeader.style.justifyContent = 'space-between';
            videosHeader.style.alignItems = 'center';
            videosHeader.style.marginBottom = '10px';
            
            const videosTitle = document.createElement('h4');
            videosTitle.textContent = 'Recent Videos';
            videosTitle.style.margin = '0';
            videosTitle.style.color = '#FF0000'; // YouTube Red
            videosHeader.appendChild(videosTitle);
            
            const refreshButton = document.createElement('button');
            refreshButton.innerHTML = '🔄';
            refreshButton.className = 'refresh-button';
            refreshButton.style.background = 'none';
            refreshButton.style.border = 'none';
            refreshButton.style.color = '#FF0000'; // YouTube Red
            refreshButton.style.cursor = 'pointer';
            refreshButton.style.fontSize = '1.2rem';
            refreshButton.style.padding = '0';
            refreshButton.style.lineHeight = '1';
            refreshButton.title = 'Refresh video list';
            refreshButton.addEventListener('click', () => {
                this.fetchVideos();
                Framework.showToast('Refreshing video list...');
            });
            videosHeader.appendChild(refreshButton);
            
            videosSection.appendChild(videosHeader);
            
            const videosList = document.createElement('div');
            videosList.className = 'videos-list';
            videosList.style.border = '1px solid #e0e0e0';
            videosList.style.borderRadius = '4px';
            videosList.style.maxHeight = '300px';
            videosList.style.overflowY = 'auto';
            videosList.style.padding = '5px';
            videosList.style.backgroundColor = '#fafafa';
            this.dom.videosList = videosList;
            
            videosSection.appendChild(videosList);
            youtubeContainer.appendChild(videosSection);
            
            // Create commands section
            const commandsSection = document.createElement('div');
            commandsSection.className = 'commands-section';
            commandsSection.style.padding = '10px';
            commandsSection.style.borderTop = '1px solid #e0e0e0';
            commandsSection.style.marginTop = '10px';
            
            const commandsTitle = document.createElement('h4');
            commandsTitle.textContent = 'YouTube Commands';
            commandsTitle.style.margin = '0 0 10px 0';
            commandsTitle.style.color = '#FF0000'; // YouTube Red
            commandsSection.appendChild(commandsTitle);
            
            const commandsList = document.createElement('ul');
            commandsList.style.margin = '0';
            commandsList.style.paddingLeft = '20px';
            
            const commands = [
                'youtube search [term] - Search for videos',
                'youtube open [index] - Open video in browser',
                'youtube list - Show current video list',
                'youtube auto [on/off] - Toggle auto-suggestions',
                'youtube setkey [API_KEY] - Set YouTube API key'
            ];
            
            commands.forEach(command => {
                const item = document.createElement('li');
                item.textContent = command;
                item.style.marginBottom = '5px';
                item.style.fontSize = '0.9rem';
                commandsList.appendChild(item);
            });
            
            commandsSection.appendChild(commandsList);
            youtubeContainer.appendChild(commandsSection);
            
            // Help text for starting the plugin if not active
            const helpText = document.createElement('div');
            helpText.className = 'help-text';
            helpText.innerHTML = 'To start the plugin, type <code>start youtube_action</code> in the chat input.';
            helpText.style.marginTop = '10px';
            helpText.style.fontSize = '0.9rem';
            helpText.style.color = '#666';
            helpText.style.fontStyle = 'italic';
            helpText.style.textAlign = 'center';
            helpText.style.padding = '5px';
            helpText.style.backgroundColor = '#f5f5f5';
            helpText.style.borderRadius = '4px';
            noteElement.appendChild(helpText);
            
            container.appendChild(youtubeContainer);
            this.dom.content.appendChild(container);
            
            // Render initial videos list
            this.renderVideos();
        },
        
        /**
         * Fetch videos from API
         */
        fetchVideos: function() {
            if (!this.state.youtubeActive) return;
            
            // Check if API endpoint is defined
            if (!CONFIG.api.youtubeList) {
                console.error('YouTube list API endpoint not defined in config');
                this.renderEmptyVideos('API endpoint not configured');
                return;
            }
            
            this.renderLoadingVideos();
            
            fetch(CONFIG.api.youtubeList)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Fetched YouTube videos:', data);
                    
                    // FIXED: Now checking for recent_videos instead of videos
                    if (data.success && data.recent_videos) {
                        this.state.videos = data.recent_videos;
                    } else {
                        this.state.videos = [];
                    }
                    
                    this.renderVideos();
                })
                .catch(error => {
                    console.error('Error fetching videos:', error);
                    this.renderEmptyVideos('Error fetching videos');
                });
        },
        
        /**
         * Render videos list
         */
        renderVideos: function() {
            if (!this.dom.videosList) return;
            
            this.dom.videosList.innerHTML = '';
            
            if (this.state.isSearching) {
                this.renderLoadingVideos();
                return;
            }
            
            if (!this.state.videos || this.state.videos.length === 0) {
                this.renderEmptyVideos('No videos found');
                return;
            }
            
            this.state.videos.forEach((video, index) => {
                const videoItem = document.createElement('div');
                videoItem.className = 'video-item';
                videoItem.style.backgroundColor = 'white';
                videoItem.style.border = '1px solid #e0e0e0';
                videoItem.style.borderRadius = '4px';
                videoItem.style.padding = '10px';
                videoItem.style.marginBottom = '8px';
                videoItem.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
                
                // Add hover effect
                videoItem.addEventListener('mouseenter', () => {
                    videoItem.style.transform = 'translateY(-2px)';
                    videoItem.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                });
                
                videoItem.addEventListener('mouseleave', () => {
                    videoItem.style.transform = 'translateY(0)';
                    videoItem.style.boxShadow = 'none';
                });
                
                const videoHeader = document.createElement('div');
                videoHeader.style.display = 'flex';
                videoHeader.style.alignItems = 'center';
                videoHeader.style.marginBottom = '5px';
                
                const videoIndex = document.createElement('span');
                videoIndex.textContent = (index + 1);
                videoIndex.style.backgroundColor = '#ffcdd2';
                videoIndex.style.color = '#d32f2f';
                videoIndex.style.borderRadius = '3px';
                videoIndex.style.padding = '2px 6px';
                videoIndex.style.marginRight = '8px';
                videoIndex.style.fontWeight = 'bold';
                videoHeader.appendChild(videoIndex);
                
                const videoTitle = document.createElement('h5');
                videoTitle.textContent = video.title;
                videoTitle.style.margin = '0';
                videoTitle.style.flex = '1';
                videoTitle.style.overflow = 'hidden';
                videoTitle.style.textOverflow = 'ellipsis';
                videoTitle.style.whiteSpace = 'nowrap';
                videoHeader.appendChild(videoTitle);
                
                videoItem.appendChild(videoHeader);
                
                // Add channel name
                const channelInfo = document.createElement('div');
                channelInfo.className = 'channel-info';
                channelInfo.textContent = `Channel: ${video.channel}`;
                channelInfo.style.fontSize = '0.9rem';
                channelInfo.style.color = '#666';
                channelInfo.style.marginBottom = '5px';
                videoItem.appendChild(channelInfo);
                
                // Add publish date
                if (video.published) {
                    // Convert to readable date format
                    const publishDate = new Date(video.published);
                    const dateStr = publishDate.toLocaleDateString();
                    
                    const publishInfo = document.createElement('div');
                    publishInfo.className = 'publish-info';
                    publishInfo.textContent = `Published: ${dateStr}`;
                    publishInfo.style.fontSize = '0.8rem';
                    publishInfo.style.color = '#888';
                    publishInfo.style.marginBottom = '5px';
                    videoItem.appendChild(publishInfo);
                }
                
                // Add video description
                if (video.description) {
                    const videoDesc = document.createElement('p');
                    videoDesc.textContent = video.description;
                    videoDesc.style.margin = '5px 0';
                    videoDesc.style.fontSize = '0.9rem';
                    videoDesc.style.color = '#666';
                    videoDesc.style.display = '-webkit-box';
                    videoDesc.style.webkitLineClamp = '2';
                    videoDesc.style.webkitBoxOrient = 'vertical';
                    videoDesc.style.overflow = 'hidden';
                    videoItem.appendChild(videoDesc);
                }
                
                const videoActions = document.createElement('div');
                videoActions.style.display = 'flex';
                videoActions.style.justifyContent = 'flex-end';
                videoActions.style.marginTop = '8px';
                videoActions.style.gap = '5px';
                
                // Check if the video has a URL we can display
                if (video.url) {
                    const urlText = document.createElement('div');
                    urlText.className = 'video-url';
                    urlText.textContent = video.url;
                    urlText.style.fontSize = '0.8rem';
                    urlText.style.color = '#999';
                    urlText.style.overflow = 'hidden';
                    urlText.style.textOverflow = 'ellipsis';
                    urlText.style.whiteSpace = 'nowrap';
                    urlText.style.maxWidth = '300px';
                    urlText.style.marginTop = '3px';
                    urlText.style.marginBottom = '5px';
                    videoItem.appendChild(urlText);
                }
                
                const openButton = document.createElement('button');
                openButton.textContent = 'Watch Video';
                openButton.style.backgroundColor = '#FF0000'; // YouTube Red
                openButton.style.color = 'white';
                openButton.style.border = 'none';
                openButton.style.borderRadius = '3px';
                openButton.style.padding = '5px 10px';
                openButton.style.fontSize = '0.85rem';
                openButton.style.cursor = 'pointer';
                openButton.style.transition = 'background-color 0.2s';
                
                // Add hover effect
                openButton.addEventListener('mouseenter', () => {
                    openButton.style.backgroundColor = '#cc0000';
                });
                
                openButton.addEventListener('mouseleave', () => {
                    openButton.style.backgroundColor = '#FF0000';
                });
                
                openButton.addEventListener('click', () => {
                    this.openVideo(index + 1, video);
                });
                videoActions.appendChild(openButton);
                
                // Add copy URL button if URL is available
                if (video.url) {
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
                        this.copyToClipboard(video.url);
                    });
                    
                    videoActions.appendChild(copyUrlButton);
                }
                
                videoItem.appendChild(videoActions);
                
                this.dom.videosList.appendChild(videoItem);
            });
        },
        
        /**
         * Show loading state in videos list
         */
        renderLoadingVideos: function() {
            if (!this.dom.videosList) return;
            
            this.dom.videosList.innerHTML = '';
            
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.innerHTML = '<div class="spinner"></div>Loading videos...';
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
                    border-top-color: #FF0000;
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleEl);
            
            this.dom.videosList.appendChild(loadingMessage);
        },
        
        /**
         * Show empty state in videos list
         * @param {string} message - Message to display
         */
        renderEmptyVideos: function(message) {
            if (!this.dom.videosList) return;
            
            this.dom.videosList.innerHTML = '';
            
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = message || 'No videos found';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#999';
            emptyMessage.style.fontStyle = 'italic';
            
            this.dom.videosList.appendChild(emptyMessage);
        },
        
        /**
         * Search for YouTube videos
         * @param {string} query - Search query
         */
        search: function(query) {
            if (!this.state.youtubeActive) {
                Framework.showToast('Please start the youtube_action plugin first');
                return;
            }
            
            if (!query || query.trim() === '') {
                Framework.showToast('Please enter a search term');
                return;
            }
            
            console.log(`Searching YouTube for: ${query}`);
            this.state.isSearching = true;
            this.renderLoadingVideos();
            
            // Use the API endpoint to search
            fetch(CONFIG.api.youtubeList + '/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: query })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Search command sent:', data);
                
                // Clear search input
                if (this.dom.searchInput) {
                    this.dom.searchInput.value = '';
                    this.dom.searchInput.focus();
                }
                
                // Show a toast message
                Framework.showToast(`Searching YouTube for "${query}"`);
                
                // Add delay before fetching updated results
                setTimeout(() => {
                    this.state.isSearching = false;
                    this.fetchVideos();
                }, 2000);
            })
            .catch(error => {
                console.error('Error searching:', error);
                this.state.isSearching = false;
                Framework.showToast('Error searching YouTube. Try using the command directly.');
                
                // Create command to send to backend via input as fallback
                const userInput = document.getElementById('userInput');
                if (userInput) {
                    userInput.value = `youtube search ${query}`;
                    Framework.sendMessage();
                }
                
                // Clear search input
                if (this.dom.searchInput) {
                    this.dom.searchInput.value = '';
                    this.dom.searchInput.focus();
                }
                
                // Add delay before fetching updated results
                setTimeout(() => {
                    this.fetchVideos();
                }, 2000);
            });
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
         * Open a YouTube video in browser
         * @param {number} index - Video index
         * @param {object} video - Video object (optional)
         */
        openVideo: function(index, video) {
            if (!this.state.youtubeActive) {
                Framework.showToast('Please start the youtube_action plugin first');
                return;
            }
            
            console.log(`Opening video at index: ${index}`);
            
            // Get video object if not provided
            if (!video && this.state.videos && this.state.videos[index - 1]) {
                video = this.state.videos[index - 1];
            }
            
            // Create command to send to backend via input
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = `youtube open ${index}`;
                Framework.sendMessage();
                
                // Show more detailed toast with URL if available
                if (video && video.title) {
                    Framework.showToast(`Opening "${video.title}" in browser...`);
                    
                    // Provide URL as a fallback in case browser launch fails
                    if (video.url) {
                        setTimeout(() => {
                            Framework.showToast(`If browser didn't open, copy URL: ${video.url}`);
                        }, 3000);
                    }
                } else {
                    Framework.showToast(`Opening video #${index} in browser...`);
                }
            }
            
            // Try to open the URL directly from the frontend as well (as a backup)
            // This might be blocked by popup blockers but worth trying
            if (video && video.url) {
                try {
                    window.open(video.url, '_blank');
                } catch (e) {
                    console.log('Browser popup blocked or failed:', e);
                }
            }
        },
        
        /**
         * Toggle auto-suggest feature
         * @param {boolean} enabled - Whether auto-suggest should be enabled
         */
        toggleAutoSuggest: function(enabled) {
            if (!this.state.youtubeActive) {
                Framework.showToast('Please start the youtube_action plugin first');
                
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
                userInput.value = `youtube auto ${enabled ? 'on' : 'off'}`;
                Framework.sendMessage();
            }
            
            Framework.showToast(`YouTube auto-suggestions ${enabled ? 'enabled' : 'disabled'}`);
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