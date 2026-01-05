/**
 * ==============================================================================================
 * Left Panel 8 - Referrals Panel
 * ==============================================================================================
 *
 * Displays a list of referral links with preview on hover and opens in new tab when clicked.
 * Currently features TriviaGoat with hover preview functionality.
 * Follows the standard component structure.
 *
 * @version 1.0.0 - Initial implementation with TriviaGoat referral
 */

(function() {
    // Component definition
    const component = {
        id: 'left-panel-8',

        // DOM references
        dom: {
            content: null,
            referralsList: null,
            previewElement: null
        },

        // Component state
        state: {
            referrals: [
                {
                    id: 'triviagoat',
                    name: 'GOAT REFERRAL SYSTEM',
                    description: 'GOAT TRIVIA MILLIONAIRE-STYLE-GAME at https://www.triviagoat.io/. This is the first referral allowed in the system.',
                    url: 'https://www.triviagoat.io/',
                    previewImage: 'images/r1.jpg', // Fallback image URL if needed
                    categories: ['Trivia', 'Quiz', 'Knowledge']
                },
                {
                    id: 'bigideasdb',
                    name: 'BIGIDEASDB.COM',
                    description: 'Find thousands of analyzed validated problems to build your next successful SaaS at bigideasdb.com.',
                    url: 'https://bigideasdb.com',
                    previewImage: 'images/bigideasdb.jpg', // Placeholder
                    categories: ['SaaS', 'Business', 'Ideas']
                },
                {
                    id: 'yournews',
                    name: 'YOUR NEWS',
                    description: 'Personalized RSS News Reader (Android, soon iOS).',
                    url: 'https://yournews.com', // Placeholder URL
                    previewImage: 'yournews.jpg', // Placeholder
                    categories: ['News', 'RSS', 'Mobile']
                },
                {
                    id: 'prmptvault',
                    name: 'PRMPTVAULT.COM',
                    description: 'Central AI Prompts hub for AI Agencies at https://prmptvault.com.',
                    url: 'https://prmptvault.com',
                    previewImage: 'images/prmptvault.jpg', // Placeholder
                    categories: ['AI', 'Prompts', 'Agencies']
                },
                {
                    id: 'typiq',
                    name: 'TYPIQ',
                    description: 'An AI prompt powered font pairing generator.',
                    url: 'https://typiq.io', // Placeholder URL
                    previewImage: 'images/typiq.jpg', // Placeholder
                    categories: ['Design', 'Fonts', 'AI']
                },
                {
                    id: 'networkobservability',
                    name: 'NETWORK-OBSERVABILITY-PLATFORM',
                    description: 'Open-source alternative to ThousandEyes for network observability at https://github.com/shankar0123/network-observability-platform.',
                    url: 'https://github.com/shankar0123/network-observability-platform',
                    previewImage: 'images/networkobs.jpg', // Placeholder
                    categories: ['DevOps', 'Network', 'Open Source']
                },
                {
                    id: 'mindcraftor',
                    name: 'MINDCRAFTOR.AI',
                    description: 'An incomplete MVP (AI app) for stability testing at https://mindcraftor.ai.',
                    url: 'https://mindcraftor.ai',
                    previewImage: 'images/mindcraftor.jpg', // Placeholder
                    categories: ['AI', 'Testing', 'MVP']
                },
                {
                    id: 'backlinksitesdb',
                    name: 'BACKLINKSITESDB.COM',
                    description: 'Public database of sites to get backlinks at https://backlinksitesdb.com.',
                    url: 'https://backlinksitesdb.com',
                    previewImage: 'images/backlink.jpg', // Placeholder
                    categories: ['SEO', 'Backlinks', 'Marketing']
                },
                {
                    id: 'burnthesol',
                    name: 'BURNTHESOL.XYZ',
                    description: 'Reclaim solana token rent exemption fee at Burnthesol.xyz.',
                    url: 'https://burnthesol.xyz',
                    previewImage: 'images/burnthesol.jpg', // Placeholder
                    categories: ['Crypto', 'Solana', 'Finance']
                },
                {
                    id: 'infldb',
                    name: 'INFLDB',
                    description: 'Instagram influencer database (1.5M+ accounts) at https://infldb.com/.',
                    url: 'https://infldb.com/',
                    previewImage: 'images/infldb.jpg', // Placeholder
                    categories: ['Marketing', 'Influencers', 'Instagram']
                },
                {
                    id: 'baryhuang',
                    name: 'BARYHUANG\'S AI AGENT BUILDING BLOCKS',
                    description: 'Open-source AI Agent building blocks available at https://github.com/baryhuang.',
                    url: 'https://github.com/baryhuang',
                    previewImage: 'images/baryhuang.jpg', // Placeholder
                    categories: ['AI', 'Development', 'Open Source']
                },
                {
                    id: 'promap',
                    name: 'PROMAP FOR TALENT',
                    description: 'Turns any job description into a practice interview. Demo at https://vimeo.com/1084694054/66cd9267ab.',
                    url: 'https://vimeo.com/1084694054/66cd9267ab',
                    previewImage: 'images/promap.jpg', // Placeholder
                    categories: ['Careers', 'Interviews', 'Job Search']
                }
            ],
            previewVisible: false,
            currentPreviewId: null,
            hoverTimeoutId: null
        },

        /**
         * Initialize the component
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            
            if (!this.dom.content) {
                console.error(`[${this.id}] Content element not found`);
                return;
            }
            
            // Create UI structure
            this.renderContent();
            
            // Add styles
            this.addStyles();
            
            console.log(`[${this.id}] Component initialized successfully.`);
        },
        
        /**
         * Render component content
         */
        renderContent: function() {
            if (!this.dom.content) return;
            
            this.dom.content.innerHTML = ''; // Clear existing content
            
            // Create main container
            const container = document.createElement('div');
            container.className = 'referrals-panel';
            
            // Create header
            const header = document.createElement('div');
            header.className = 'referrals-header';
            header.innerHTML = `
                <h3>Referrals</h3>
                <p class="panel-description">Helpful resources we recommend</p>
            `;
            container.appendChild(header);
            
            // Create referrals list container
            const referralsList = document.createElement('div');
            referralsList.className = 'referrals-list';
            this.dom.referralsList = referralsList;
            
            // Populate with referrals
            this.populateReferralsList();
            
            container.appendChild(referralsList);
            
            // Preview element - will be positioned absolutely when shown
            const previewElement = document.createElement('div');
            previewElement.className = 'referral-preview';
            previewElement.id = 'referral-preview';
            previewElement.style.display = 'none';
            this.dom.previewElement = previewElement;
            document.body.appendChild(previewElement); // Append to body for better positioning
            
            this.dom.content.appendChild(container);
            
            // Set up event listeners for cleanup
            this.setupPreviewEventListeners();
        },
        
        /**
         * Populate the referrals list with items
         */
        populateReferralsList: function() {
            if (!this.dom.referralsList) return;
            
            this.state.referrals.forEach(referral => {
                const referralItem = document.createElement('div');
                referralItem.className = 'referral-item';
                referralItem.dataset.id = referral.id;
                
                referralItem.innerHTML = `
                    <div class="referral-content">
                        <h4 class="referral-name">${referral.name}</h4>
                        <div class="referral-description">${referral.description}</div>
                        <div class="referral-categories">
                            ${referral.categories.map(cat => `<span class="referral-category">${cat}</span>`).join('')}
                        </div>
                    </div>
                    <div class="referral-action">
                        <span class="referral-icon">🔗</span>
                    </div>
                `;
                
                // Add event listeners
                referralItem.addEventListener('mouseenter', () => this.showPreview(referral));
                referralItem.addEventListener('mouseleave', () => this.hidePreview());
                referralItem.addEventListener('click', () => this.openReferralLink(referral));
                
                // Add to list
                this.dom.referralsList.appendChild(referralItem);
            });
        },
        
        /**
         * Set up event listeners for the preview element
         */
        setupPreviewEventListeners: function() {
            if (!this.dom.previewElement) return;
            
            // When mouse enters the preview, keep it visible
            this.dom.previewElement.addEventListener('mouseenter', () => {
                if (this.state.hoverTimeoutId) {
                    clearTimeout(this.state.hoverTimeoutId);
                    this.state.hoverTimeoutId = null;
                }
            });
            
            // When mouse leaves the preview, hide it
            this.dom.previewElement.addEventListener('mouseleave', () => {
                this.hidePreview();
            });
        },
        
        /**
         * Show preview for a referral
         * @param {Object} referral - Referral object to show preview for
         */
        showPreview: function(referral) {
            if (!this.dom.previewElement) return;
            
            // Clear any existing timeout
            if (this.state.hoverTimeoutId) {
                clearTimeout(this.state.hoverTimeoutId);
            }
            
            // Set a short delay to prevent flicker on quick mouse movements
            this.state.hoverTimeoutId = setTimeout(() => {
                const previewEl = this.dom.previewElement;
                
                // Update preview content
                previewEl.innerHTML = `
                    <div class="preview-header">
                        <h4>${referral.name}</h4>
                        <div class="preview-url">${referral.url}</div>
                    </div>
                    <div class="preview-image-container">
                        <div class="preview-image" style="background-image: url('${referral.previewImage}'); background-size: cover; background-position: center;"></div>
                    </div>
                    <div class="preview-description">${referral.description}</div>
                    <div class="preview-footer">${referral.categories.join(' • ')}</div>
                `;
                
                // Position the preview near the referral item
                const referralItem = document.querySelector(`.referral-item[data-id="${referral.id}"]`);
                if (referralItem) {
                    const rect = referralItem.getBoundingClientRect();
                    const previewWidth = 320; // Fixed width for preview
                    
                    // Check if there's room to the right of the panel
                    const rightSpace = window.innerWidth - rect.right;
                    
                    if (rightSpace >= previewWidth + 20) {
                        // Position to the right
                        previewEl.style.left = `${rect.right + 10}px`;
                        previewEl.style.top = `${rect.top}px`;
                    } else {
                        // Position to the left if there's not enough space on the right
                        previewEl.style.left = `${rect.left - previewWidth - 10}px`;
                        previewEl.style.top = `${rect.top}px`;
                    }
                }
                
                // Make preview visible
                previewEl.style.display = 'block';
                setTimeout(() => {
                    previewEl.classList.add('visible');
                }, 10);
                
                this.state.previewVisible = true;
                this.state.currentPreviewId = referral.id;
                this.state.hoverTimeoutId = null;
            }, 200); // 200ms delay before showing
        },
        
        /**
         * Hide the preview element
         */
        hidePreview: function() {
            if (!this.dom.previewElement) return;
            
            // Clear any existing timeout
            if (this.state.hoverTimeoutId) {
                clearTimeout(this.state.hoverTimeoutId);
            }
            
            // Set a short delay to prevent flicker on quick mouse movements
            this.state.hoverTimeoutId = setTimeout(() => {
                this.dom.previewElement.classList.remove('visible');
                
                // After fade out animation completes, hide the element
                setTimeout(() => {
                    if (!this.state.previewVisible) {
                        this.dom.previewElement.style.display = 'none';
                    }
                }, 300);
                
                this.state.previewVisible = false;
                this.state.currentPreviewId = null;
                this.state.hoverTimeoutId = null;
            }, 100); // 100ms delay before hiding
        },
        
        /**
         * Open the referral link in a new tab
         * @param {Object} referral - Referral object to open
         */
        openReferralLink: function(referral) {
            console.log(`[${this.id}] Opening referral link: ${referral.url}`);
            
            try {
                window.open(referral.url, '_blank');
                
                // Show a toast message
                if (typeof Framework !== 'undefined' && Framework.showToast) {
                    Framework.showToast(`Opening ${referral.name} in a new tab...`);
                }
            } catch (error) {
                console.error(`[${this.id}] Error opening link:`, error);
                
                // Show error toast
                if (typeof Framework !== 'undefined' && Framework.showToast) {
                    Framework.showToast('Could not open link. Please check your popup blocker settings.');
                }
            }
        },
        
        /**
         * Add component-specific styles
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Referrals Panel Styles */
                .referrals-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    font-size: 13px;
                    color: var(--color-text, #333);
                    background-color: #fff;
                    overflow: hidden;
                }
                
                .referrals-header {
                    padding: 10px 15px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .referrals-header h3 {
                    margin: 0 0 5px 0;
                    font-size: 16px;
                    color: var(--color-primary, #4a76a8);
                }
                
                .panel-description {
                    margin: 0;
                    font-size: 12px;
                    color: #666;
                }
                
                .referrals-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .referral-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    margin-bottom: 8px;
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                
                .referral-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 3px 8px rgba(0,0,0,0.1);
                    border-color: var(--color-primary, #4a76a8);
                    background-color: #f5f9ff;
                }
                
                .referral-content {
                    flex: 1;
                }
                
                .referral-name {
                    margin: 0 0 5px 0;
                    font-size: 14px;
                    color: var(--color-primary, #4a76a8);
                }
                
                .referral-description {
                    font-size: 12px;
                    color: #666;
                    line-height: 1.4;
                    margin-bottom: 5px;
                }
                
                .referral-categories {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }
                
                .referral-category {
                    font-size: 10px;
                    background-color: #e8f4fd;
                    color: #4a76a8;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                
                .referral-action {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 30px;
                    height: 30px;
                    margin-left: 10px;
                }
                
                .referral-icon {
                    font-size: 16px;
                    color: #4a76a8;
                }
                
                /* Preview Styles */
                .referral-preview {
                    position: fixed;
                    z-index: 1000;
                    background-color: white;
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    width: 320px;
                    max-height: 450px;
                    overflow: hidden;
                    transition: opacity 0.3s, transform 0.3s;
                    opacity: 0;
                    transform: translateY(10px);
                    pointer-events: none;
                }
                
                .referral-preview.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                
                .preview-header {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                }
                
                .preview-header h4 {
                    margin: 0 0 5px 0;
                    font-size: 16px;
                    color: #4a76a8;
                }
                
                .preview-url {
                    font-size: 11px;
                    color: #888;
                    word-break: break-all;
                }
                
                .preview-image-container {
                    position: relative;
                    width: 100%;
                    height: 180px;
                    background-color: #f5f5f5;
                    overflow: hidden;
                }
                
                .preview-loading {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(255,255,255,0.8);
                    color: #666;
                    font-size: 14px;
                }
                
                .preview-image {
                    width: 100%;
                    height: 100%;
                    background-color: #f0f0f0;
                    background-size: cover;
                    background-position: center top;
                    transition: transform 0.3s ease;
                }
                
                .preview-description {
                    padding: 12px;
                    font-size: 13px;
                    line-height: 1.4;
                    color: #333;
                    border-bottom: 1px solid #eee;
                }
                
                .preview-footer {
                    padding: 10px;
                    text-align: center;
                    font-size: 12px;
                    color: #4a76a8;
                    background-color: #f9f9f9;
                    font-weight: bold;
                }
                
                /* Specific Styling for Different Referrals */
                .referral-item[data-id="triviagoat"] .referral-icon {
                    color: #6b46c1; /* Purple theme for TriviaGoat */
                }
                
                .referral-item[data-id="triviagoat"] .referral-category {
                    background-color: #f0e6ff; /* Light purple */
                    color: #6b46c1;
                }
                
                .referral-item[data-id="bigideasdb"] .referral-icon,
                .referral-item[data-id="backlinksitesdb"] .referral-icon,
                .referral-item[data-id="infldb"] .referral-icon {
                    color: #2c7a7b; /* Teal for databases */
                }
                
                .referral-item[data-id="mindcraftor"] .referral-icon,
                .referral-item[data-id="prmptvault"] .referral-icon,
                .referral-item[data-id="baryhuang"] .referral-icon {
                    color: #805ad5; /* Purple for AI */
                }
                
                .referral-item[data-id="burnthesol"] .referral-icon {
                    color: #dd6b20; /* Orange for crypto */
                }
                
                .referral-item[data-id="promap"] .referral-icon {
                    color: #38a169; /* Green for career tools */
                }
            `;
            
            document.head.appendChild(style);
        },
        
        /**
         * Clean up component resources
         */
        cleanup: function() {
            console.log(`[${this.id}] Cleaning up component resources.`);
            
            // Remove preview element if it exists
            if (this.dom.previewElement) {
                this.dom.previewElement.remove();
            }
            
            // Remove style element
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
            }
            
            // Clear timeouts
            if (this.state.hoverTimeoutId) {
                clearTimeout(this.state.hoverTimeoutId);
                this.state.hoverTimeoutId = null;
            }
        }
    };
    
    // Register component with the framework
    if (typeof Framework !== 'undefined' && Framework.registerComponent) {
        Framework.registerComponent(component.id, component);
    } else {
        console.error(`[${component.id}] Framework not found or registerComponent method not available.`);
    }
})();