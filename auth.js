// auth.js

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.username = localStorage.getItem('auth_username');
        this.loginModal = null;
        this.authModalLoaded = false;
        // Note: this._auth_config used by is_auth_enabled is not initialized here.
        // Ensure it's set elsewhere if you intend to use the redirect-on-logout feature.
    }

    get is_auth_enabled() {
        // Check if auth is enabled by looking at auth config
        return true; // Just return true for now since auth is being used
    }

    async loadAuthModal() {
        if (this.authModalLoaded) return;
        
        try {
            const response = await fetch('auth.html');
            if (!response.ok) {
                throw new Error(`Failed to load auth.html: ${response.status} ${response.statusText}`);
            }
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Extract the auth modal and append to body
            const authModalElement = temp.querySelector('#auth-modal');
            if (authModalElement) {
                // Remove existing modal if any (e.g., from a previous failed attempt or hot reload)
                const existingModal = document.getElementById('auth-modal');
                if (existingModal) {
                    existingModal.remove();
                }
                document.body.appendChild(authModalElement);
                this.loginModal = authModalElement; // Use the appended element
                this.authModalLoaded = true;
                this.setupModalEventHandlers();
            } else {
                throw new Error('Auth modal structure not found in auth.html');
            }
        } catch (error) {
            console.error('Error loading auth modal:', error);
            // If loading fails, the modal will not be available.
            // No dynamic fallback to createLoginUI as per the plan to remove it.
            this.authModalLoaded = false; 
        }
    }

    async initializeAuth() {
        await this.loadAuthModal(); // Load external HTML first
        
        if (this.token) {
            const isValid = await this.validateToken();
            if (isValid) {
                this.updateUIForAuth(true);
                this.triggerAuthChange(true, this.username);
                return true;
            } else {
                // validateToken calls logout() which calls updateUIForAuth(false) and triggerAuthChange(false)
                return false;
            }
        } else {
            this.updateUIForAuth(false);
            this.triggerAuthChange(false, null);
            return false;
        }
    }
    
    setupModalEventHandlers() {
        if (!this.loginModal) {
            console.error("Auth modal element not found for setting up event handlers.");
            return;
        }
        
        // Form submit handler
        const authForm = this.loginModal.querySelector('#auth-form');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        } else {
            console.error("Auth form not found in modal.");
        }
        
        // Close button handler
        const closeButton = this.loginModal.querySelector('.auth-modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.hideLoginModal());
        } else {
            console.error("Auth modal close button not found.");
        }
        
        // Click outside to close
        this.loginModal.addEventListener('click', (e) => {
            if (e.target === this.loginModal) {
                this.hideLoginModal();
            }
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.loginModal && this.loginModal.style.display === 'flex') {
                this.hideLoginModal();
            }
        });
    }


    hideLoginModal() {
        if (this.loginModal) {
            this.loginModal.style.display = 'none';
            const errorDiv = this.loginModal.querySelector('#auth-error'); // Query within modal
            if (errorDiv) {
                errorDiv.textContent = ''; // Clear errors when hiding
                errorDiv.style.color = ''; // Reset color
            }
            const form = this.loginModal.querySelector('#auth-form'); // Query within modal
            if (form) {
                form.reset(); // Reset form fields
            }
        }
    }

    async handleLogin() {
        // Ensure elements are queried from the modal context if it's loaded
        const usernameInput = this.loginModal ? this.loginModal.querySelector('#auth-username-input') : document.getElementById('auth-username-input');
        const passwordInput = this.loginModal ? this.loginModal.querySelector('#auth-password-input') : document.getElementById('auth-password-input');
        const errorDiv = this.loginModal ? this.loginModal.querySelector('#auth-error') : document.getElementById('auth-error');

        if (!usernameInput || !passwordInput || !errorDiv) {
            console.error("Auth form elements not found. Modal loaded:", this.authModalLoaded);
            return;
        }
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        // Add loading state to the form
        const authForm = this.loginModal.querySelector('#auth-form');
        const submitButton = authForm ? authForm.querySelector('button[type="submit"]') : null;
        const originalButtonText = submitButton ? submitButton.textContent : 'Login';
        
        // Disable form and show loading state
        if (authForm) {
            authForm.classList.add('auth-loading');
            usernameInput.disabled = true;
            passwordInput.disabled = true;
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="auth-spinner"></span> Authenticating...';
            }
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.username = data.username;
                localStorage.setItem('auth_token', this.token);
                localStorage.setItem('auth_username', this.username);
                
                // Update button to show backend restart is happening
                if (submitButton) {
                    submitButton.innerHTML = '<span class="auth-spinner"></span> Loading your history...';
                }
                
                // Show success message
                errorDiv.innerHTML = '<div class="auth-success">Login successful! Loading your conversation history...</div>';
                errorDiv.style.color = '#4CAF50';
                
                // Wait a bit to show the success message before hiding
                setTimeout(() => {
                    this.hideLoginModal();
                    this.updateUIForAuth(true);
                    this.triggerAuthChange(true, this.username);
                    
                    // Show a toast notification about the backend restart
                    if (window.Framework && window.Framework.showToast) {
                        window.Framework.showToast('Loading your conversation history...', 5000);
                    }
                }, 1500);
                
                console.log(`Logged in as ${this.username}`);
                
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.color = '';
                
                // Re-enable form
                if (authForm) {
                    authForm.classList.remove('auth-loading');
                    usernameInput.disabled = false;
                    passwordInput.disabled = false;
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText;
                    }
                }
            }
            
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.color = '';
            console.error('Login error:', error);
            
            // Re-enable form on error
            if (authForm) {
                authForm.classList.remove('auth-loading');
                usernameInput.disabled = false;
                passwordInput.disabled = false;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            }
        }
    }

    async validateToken() {
        if (!this.token) {
            this.logout(); 
            return false;
        }
        
        try {
            const response = await fetch('/api/auth/validate', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (!data.success || !data.valid) {
                this.logout();
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
            return false;
        }
    }

    async showLoginModal() {
        // Always try to load the modal if it's not loaded
        if (!this.authModalLoaded || !this.loginModal || !document.getElementById('auth-modal')) {
            console.log("Auth modal not found in DOM, loading it...");
            await this.loadAuthModal();
        }
        
        // Double-check the modal exists
        if (!this.loginModal) {
            this.loginModal = document.getElementById('auth-modal');
        }
        
        if (this.loginModal) {
            // Ensure modal is in the document body (not inside loading screen)
            if (!document.body.contains(this.loginModal)) {
                document.body.appendChild(this.loginModal);
            }
            
            this.loginModal.style.display = 'flex';
            
            // Reset form state
            const usernameField = this.loginModal.querySelector('#auth-username-input');
            const passwordField = this.loginModal.querySelector('#auth-password-input');
            const authForm = this.loginModal.querySelector('#auth-form');
            const submitButton = authForm ? authForm.querySelector('button[type="submit"]') : null;
            
            if (usernameField) {
                usernameField.disabled = false;
                usernameField.focus();
            }
            if (passwordField) {
                passwordField.disabled = false;
            }
            if (authForm) {
                authForm.classList.remove('auth-loading');
            }
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Login';
            }
            
            const errorDiv = this.loginModal.querySelector('#auth-error');
            if (errorDiv) {
                errorDiv.textContent = ''; // Clear previous errors
                errorDiv.style.color = ''; // Reset color
            }
        } else {
            console.error("Login modal could not be shown because it failed to load or initialize.");
            // Fallback: Show a toast message
            if (window.Framework && window.Framework.showToast) {
                window.Framework.showToast('Error: Login modal could not be loaded. Please refresh the page.', 5000);
            }
        }
    }

    logout() {
        const oldToken = this.token; 
        this.token = null;
        this.username = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        
        if (oldToken) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${oldToken}`
                }
            }).catch(err => console.error('Logout API error:', err));
        }
        
        this.updateUIForAuth(false);
        this.triggerAuthChange(false, null);
        
        // Smarter redirect: Only redirect if not already on the home page.
        // This prevents an unnecessary page reload if logout is triggered on '/'.
        if (window.location.pathname !== '/') {
            console.log('Auth: Redirecting to home page after logout');
            window.location.href = '/';
        } else {
            console.log('Auth: Logout complete. Already on home page.');
        }
    }

    updateUIForAuth(isAuthenticated) {
        const statusElement = document.getElementById('auth-status');
        if (statusElement) {
            if (isAuthenticated && this.username) {
                statusElement.innerHTML = `
                    <span>Logged in as: <strong>${this.username}</strong></span>
                    <button id="logoutButton">Logout</button>
                `;
                
                // Use setTimeout to ensure DOM is updated before adding listener
                setTimeout(() => {
                    const logoutBtn = document.getElementById('logoutButton');
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', () => this.logout());
                    }
                }, 0);
            } else {
                statusElement.innerHTML = `
                    <span>Not logged in</span>
                    <button id="loginStatusButton">Login</button>
                `;
                
                // Use setTimeout to ensure DOM is updated before adding listener
                setTimeout(() => {
                    const loginBtn = document.getElementById('loginStatusButton');
                    if (loginBtn) {
                        // Remove any existing listeners first
                        const newLoginBtn = loginBtn.cloneNode(true);
                        loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);
                        
                        // Add fresh click listener
                        newLoginBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.showLoginModal();
                        });
                    }
                }, 0);
            }
        }
    }

    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`
            };
        }
        return {};
    }

    isAuthenticated() {
        return !!this.token;
    }

    triggerAuthChange(isAuthenticated, username) {
        const event = new CustomEvent('authChange', { detail: { isAuthenticated, username } });
        document.dispatchEvent(event);
        console.log('AuthChange event triggered:', { isAuthenticated, username });
    }
}

const authManager = new AuthManager();