(function() {
    console.log('Johari × MI Quiz JS loaded - Version 0.1.0');
    
    // Debug: Check if we're on a peer assessment URL
    const currentUrl = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const jmiParam = urlParams.get('jmi');
    console.log('DEBUG: URL check:', {
        currentUrl: currentUrl,
        jmiParam: jmiParam,
        hasJmiParam: !!jmiParam
    });
    
    console.log('Raw jmi_quiz_data:', jmi_quiz_data);
    
    const { currentUser, ajaxUrl, ajaxNonce, data } = jmi_quiz_data;
    const { adjective_map, domain_colors, quadrant_colors, all_adjectives } = data;
    
    // Initial login state check - will be updated by AJAX polling
    let isLoggedIn = !!currentUser;
    
    // Debug logging for login state detection
    console.log('Login state detection:', {
        hasCurrentUser: !!currentUser,
        initialIsLoggedIn: isLoggedIn
    });

    const $id = (s) => document.getElementById(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const selfContainer = $id('jmi-self');
    const shareContainer = $id('jmi-share');
    const resultsContainer = $id('jmi-results');
    
    // Debug: Check if containers exist
    console.log('DEBUG: Container check:', {
        selfContainer: !!selfContainer,
        shareContainer: !!shareContainer,
        resultsContainer: !!resultsContainer
    });

    let selectedAdjectives = [];
    let isAuthorMode = true; // true = self-assessment, false = peer assessment
    let shareUuid = null;
    let peerUuid = null;

    // State management
    let appState = 'initial'; // 'initial', 'self-assessment', 'awaiting-peers', 'results', 'peer-assessment'

    // Function to get full user data after successful login
    function refreshUserData() {
        console.log('Refreshing user data...');
        
        const requestData = {
            action: 'jmi_get_user_data',
            nonce: ajaxNonce
        };
        
        return fetch(ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('User data refresh response:', data);
            if (data.success && data.data && data.data.currentUser) {
                // Update the global data with fresh user information
                jmi_quiz_data.currentUser = data.data.currentUser;
                console.log('Updated currentUser:', data.data.currentUser);
                return data.data.currentUser;
            } else if (data.success && data.data && data.data.isLoggedIn) {
                console.log('User is logged in but no detailed data available');
                return true;
            }
            return null;
        })
        .catch(error => {
            console.error('Error refreshing user data:', error);
            return null;
        });
    }
    
    // Analytics tracking functions for peer assessment CTA buttons
    function trackPeerRegistrationClick() {
        console.log('Peer Assessment: Registration button clicked', {
            jmi_uuid: peerUuid,
            timestamp: new Date().toISOString(),
            action: 'peer_registration_click'
        });
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'peer_registration_click', {
                'custom_parameter_jmi_uuid': peerUuid,
                'event_category': 'peer_assessment',
                'event_label': 'registration_start'
            });
        }
    }
    
    function trackPeerLoginClick() {
        console.log('Peer Assessment: Login button clicked', {
            jmi_uuid: peerUuid,
            timestamp: new Date().toISOString(),
            action: 'peer_login_click'
        });
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'peer_login_click', {
                'custom_parameter_jmi_uuid': peerUuid,
                'event_category': 'peer_assessment',
                'event_label': 'login_start'
            });
        }
    }
    
    // Make tracking functions available globally
    window.trackPeerRegistrationClick = trackPeerRegistrationClick;
    window.trackPeerLoginClick = trackPeerLoginClick;
    
    // Login polling system for peer assessment
    let loginPollInterval = null;
    let loginPollAttempts = 0;
    const MAX_LOGIN_POLL_ATTEMPTS = 10; // 10 seconds at 1 second intervals
    
    function startLoginPolling() {
        if (loginPollInterval) return; // Already polling
        
        console.log('Starting login polling...');
        loginPollAttempts = 0;
        
        loginPollInterval = setInterval(() => {
            loginPollAttempts++;
            console.log(`Login poll attempt ${loginPollAttempts}/${MAX_LOGIN_POLL_ATTEMPTS}`);
            
            checkLoginStatusQuick().then(loggedIn => {
                if (loggedIn) {
                    console.log('Login detected! Refreshing user data and re-rendering peer assessment.');
                    stopLoginPolling();
                    isLoggedIn = true;
                    
                    // Refresh user data and then re-render
                    refreshUserData().then(userData => {
                        if (userData) {
                            currentUser = userData;
                        }
                        renderPeerAssessment(); // Re-render now that user is logged in
                    });
                } else if (loginPollAttempts >= MAX_LOGIN_POLL_ATTEMPTS) {
                    console.log('Login polling timeout reached.');
                    stopLoginPolling();
                }
            }).catch(error => {
                console.error('Login poll error:', error);
                if (loginPollAttempts >= MAX_LOGIN_POLL_ATTEMPTS) {
                    stopLoginPolling();
                }
            });
        }, 1000); // Poll every second
    }
    
    function stopLoginPolling() {
        if (loginPollInterval) {
            clearInterval(loginPollInterval);
            loginPollInterval = null;
            loginPollAttempts = 0;
            console.log('Login polling stopped.');
        }
    }
    
    // Quick login status check via AJAX (no page reload)
    function checkLoginStatusQuick() {
        return fetch(ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'miq_jmi_check_login',
                _ajax_nonce: ajaxNonce
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.data.logged_in;
            }
            return false;
        })
        .catch(error => {
            console.error('Quick login check failed:', error);
            return false;
        });
    }

    // Initialize app
    function init() {
        console.log('DEBUG: init() function called!');
        
        // Check if we're in peer assessment mode
        const urlParams = new URLSearchParams(window.location.search);
        peerUuid = urlParams.get('jmi');
        
        console.log('DEBUG: In init, peerUuid =', peerUuid);
        
        // Debug logging
        console.log('Johari MI Init:', {
            currentUrl: window.location.href,
            peerUuid: peerUuid,
            isLoggedIn: isLoggedIn,
            currentUser: currentUser,
            urlParams: Object.fromEntries(urlParams.entries())
        });
        
        // Check if we just came back from registration/login
        const justRegistered = urlParams.get('registered') || urlParams.get('login');
        if (justRegistered && peerUuid && !isLoggedIn) {
            console.log('Detected return from registration but not logged in, reloading in 2 seconds...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
        
        if (peerUuid) {
            console.log('DEBUG: Detected peer assessment mode! peerUuid =', peerUuid);
            isAuthorMode = false;
            appState = 'peer-assessment';
            console.log('DEBUG: About to call renderPeerAssessment()');
            renderPeerAssessment();
        } else if (currentUser && currentUser.existingState) {
            // User has an existing assessment
            shareUuid = currentUser.selfUuid;
            
            if (currentUser.existingState === 'results-ready') {
                // Always fetch fresh results via AJAX to ensure MI integration data is included
                appState = 'results';
                console.log('Results ready, fetching fresh data via AJAX for MI integration...');
                checkProgress(true); // Fetch fresh results with MI profile data
            } else if (currentUser.existingState === 'awaiting-peers' && currentUser.peerLinkUuid) {
                appState = 'awaiting-peers';
                // Generate the share URL using the peer link UUID
                const shareUrl = window.location.origin + window.location.pathname + '?jmi=' + currentUser.peerLinkUuid;
                renderShareInterface(shareUrl);
            } else {
                appState = 'initial';
                renderSelfAssessment();
            }
        } else {
            appState = 'initial';
            renderSelfAssessment();
        }
    }

    // Render self-assessment interface
    function renderSelfAssessment() {
        selfContainer.innerHTML = `
            <div class="jmi-section">
                <h3>Step 1: Select Your Adjectives</h3>
                <p>Choose 6-10 adjectives that best describe you:</p>
                <div id="jmi-adjective-grid"></div>
                <div class="jmi-controls">
                    <div id="jmi-counter">0 selected (choose 6-10)</div>
                    <button id="jmi-submit-self" class="mi-quiz-button mi-quiz-button-primary" disabled>
                        Generate Share Link
                    </button>
                </div>
            </div>
        `;

        renderMixedAdjectiveGrid('jmi-adjective-grid');
        
        const submitBtn = $id('jmi-submit-self');
        const counter = $id('jmi-counter');

        // Handle adjective selection
        selfContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('jmi-adjective-checkbox')) {
                updateSelectedAdjectives();
                updateCounter();
                updateSubmitButton();
            }
        });

        submitBtn.addEventListener('click', saveSelfAssessment);

        function updateSelectedAdjectives() {
            selectedAdjectives = $$('.jmi-adjective-checkbox:checked').map(cb => cb.value);
        }

        function updateCounter() {
            const count = selectedAdjectives.length;
            counter.textContent = `${count} selected (choose 6-10)`;
            counter.className = count >= 6 && count <= 10 ? 'jmi-counter-valid' : 'jmi-counter-invalid';
        }

        function updateSubmitButton() {
            submitBtn.disabled = selectedAdjectives.length < 6 || selectedAdjectives.length > 10;
        }
    }

    // Render peer assessment interface
    function renderPeerAssessment() {
        console.log('Rendering peer assessment, login state:', { isLoggedIn, currentUser });
        
        // Check if user is logged in for peer feedback
        if (!isLoggedIn) {
            const currentUrl = window.location.href;
            const loginUrl = `${window.location.origin}/wp-login.php?redirect_to=${encodeURIComponent(currentUrl)}`;
            const registerUrl = `${window.location.origin}/wp-login.php?action=register&redirect_to=${encodeURIComponent(currentUrl)}`;
            
            // First, try to get the original user's name to personalize the login screen
            fetch(ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'jmi_get_original_user',
                    _ajax_nonce: ajaxNonce,
                    jmi_uuid: peerUuid
                })
            })
            .then(response => response.json())
            .then(data => {
                let friendName = '';
                let personalizedTitle = 'Help Your Friend Discover Their Blind Spots';
                let personalizedSubtitle = 'You\'ve been invited to provide anonymous peer feedback for a Johari Window assessment';
                let personalizedDescription = 'your friend';
                let personalizedButtonText = 'Create Account & Help Friend';
                
                if (data.success && data.data.name) {
                    friendName = data.data.name;
                    personalizedTitle = `Help ${friendName} Discover Their Blind Spots`;
                    personalizedSubtitle = `${friendName} has invited you to provide anonymous peer feedback for their Johari Window assessment`;
                    personalizedDescription = friendName;
                    personalizedButtonText = `Create Account & Help ${friendName}`;
                }
                
                renderLoginScreen(personalizedTitle, personalizedSubtitle, personalizedDescription, personalizedButtonText, loginUrl, currentUrl);
            })
            .catch(error => {
                console.error('Error fetching original user name for login:', error);
                // Fallback to generic login screen
                renderLoginScreen('Help Your Friend Discover Their Blind Spots', 'You\'ve been invited to provide anonymous peer feedback for a Johari Window assessment', 'your friend', 'Create Account & Help Friend', loginUrl, currentUrl);
            });
            
            return;
        }
        
        // Special case: WordPress detects login but we don't have user data
        if (isLoggedIn && !currentUser) {
            console.log('WordPress detects login but no currentUser data, refreshing...');
            selfContainer.innerHTML = `
                <div class="jmi-section">
                    <h3>Loading...</h3>
                    <p>You're logged in! Loading your data...</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <div class="spinner" style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    </div>
                </div>
                <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                </style>
            `;
            // Reload the page after a short delay to get fresh data
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            return;
        }
        
        console.log('Rendering peer assessment interface...');
        
        // Show loading state initially
        selfContainer.innerHTML = `
            <div class="jmi-section">
                <h3>Loading Assessment...</h3>
                <p>Getting information about who you're assessing...</p>
                <div style="text-align: center; margin: 20px 0;">
                    <div class="spinner" style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
            </div>
            <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            </style>
        `;
        
        // Fetch the original user's name
        fetch(ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'jmi_get_original_user',
                _ajax_nonce: ajaxNonce,
                jmi_uuid: peerUuid
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const originalUserName = data.data.name;
                
                // Render the actual peer assessment interface with the user's name
                selfContainer.innerHTML = `
                    <div class="jmi-section">
                        <h3>Peer Assessment for ${originalUserName}</h3>
                        <p>${originalUserName} has asked for your feedback. Select 6-10 adjectives that best describe them:</p>
                        <div id="jmi-peer-grid"></div>
                        <div class="jmi-controls">
                            <div id="jmi-peer-counter">0 selected (choose 6-10)</div>
                            <button id="jmi-submit-peer" class="mi-quiz-button mi-quiz-button-primary" disabled>
                                Submit Feedback for ${originalUserName}
                            </button>
                        </div>
                    </div>
                `;
                
                renderMixedAdjectiveGrid('jmi-peer-grid');
                setupPeerAssessmentListeners();
            } else {
                // Error getting user name - show generic interface
                selfContainer.innerHTML = `
                    <div class="jmi-section">
                        <h3>Peer Assessment</h3>
                        <p>A friend has asked for your feedback. Select 6-10 adjectives that best describe them:</p>
                        <div id="jmi-peer-grid"></div>
                        <div class="jmi-controls">
                            <div id="jmi-peer-counter">0 selected (choose 6-10)</div>
                            <button id="jmi-submit-peer" class="mi-quiz-button mi-quiz-button-primary" disabled>
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                `;
                
                renderMixedAdjectiveGrid('jmi-peer-grid');
                setupPeerAssessmentListeners();
            }
        })
        .catch(error => {
            console.error('Error fetching original user name:', error);
            
            // Error - show generic interface
            selfContainer.innerHTML = `
                <div class="jmi-section">
                    <h3>Peer Assessment</h3>
                    <p>A friend has asked for your feedback. Select 6-10 adjectives that best describe them:</p>
                    <div id="jmi-peer-grid"></div>
                    <div class="jmi-controls">
                        <div id="jmi-peer-counter">0 selected (choose 6-10)</div>
                        <button id="jmi-submit-peer" class="mi-quiz-button mi-quiz-button-primary" disabled>
                            Submit Feedback
                        </button>
                    </div>
                </div>
            `;
            
            renderMixedAdjectiveGrid('jmi-peer-grid');
            setupPeerAssessmentListeners();
        });
    }
    
    // Helper function to render the login screen
    function renderLoginScreen(title, subtitle, friendDescription, buttonText, loginUrl, currentUrl) {
        selfContainer.innerHTML = `
                <div class="jmi-peer-login-container">
                    <!-- Header Section -->
                    <div class="jmi-peer-login-header">
                        <div class="jmi-peer-icon">
                            <svg class="jmi-johari-icon" viewBox="0 0 100 100" width="60" height="60">
                                <rect x="10" y="10" width="35" height="35" fill="#4f46e5" opacity="0.8" rx="3"/>
                                <rect x="55" y="10" width="35" height="35" fill="#10b981" opacity="0.8" rx="3"/>
                                <rect x="10" y="55" width="35" height="35" fill="#f59e0b" opacity="0.8" rx="3"/>
                                <rect x="55" y="55" width="35" height="35" fill="#ef4444" opacity="0.8" rx="3"/>
                            </svg>
                        </div>
                        <h2 class="jmi-peer-login-title">${title}</h2>
                        <p class="jmi-peer-login-subtitle">${subtitle}</p>
                    </div>

                    <!-- Value Proposition -->
                    <div class="jmi-peer-value-section">
                        <div class="jmi-value-grid">
                            <div class="jmi-value-item">
                                <div class="jmi-value-icon">👁️</div>
                                <h4>Reveal Blind Spots</h4>
                                <p>Your perspective helps them see strengths they don't realize they have</p>
                            </div>
                            <div class="jmi-value-item">
                                <div class="jmi-value-icon">🎯</div>
                                <h4>2-3 Minutes</h4>
                                <p>Quick selection of 6-10 adjectives that best describe ${friendDescription}</p>
                            </div>
                            <div class="jmi-value-item">
                                <div class="jmi-value-icon">🔒</div>
                                <h4>Anonymous</h4>
                                <p>Your identity is kept private - only your feedback is shared</p>
                            </div>
                        </div>
                    </div>

                    <!-- Account Requirement Explanation -->
                    <div class="jmi-account-requirement">
                        <h3>Why do I need an account?</h3>
                        <p class="jmi-account-reason">
                            A simple account prevents spam and duplicate responses while keeping your feedback anonymous. 
                            We'll only use your email to send you your own assessment results if you take the quiz later.
                        </p>
                    </div>

                    <!-- Process Overview (Expandable) -->
                    <div class="jmi-process-section">
                        <details class="jmi-expandable">
                            <summary class="jmi-expandable-trigger">
                                <span>How does this work?</span>
                                <svg class="jmi-chevron" viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                                </svg>
                            </summary>
                            <div class="jmi-expandable-content">
                                <ol class="jmi-process-steps">
                                    <li><strong>Create Account:</strong> Quick signup with just email and password</li>
                                    <li><strong>Select Adjectives:</strong> Choose 6-10 words that describe ${friendDescription}</li>
                                    <li><strong>Submit Feedback:</strong> Your anonymous responses help build their Johari Window</li>
                                    <li><strong>Results:</strong> ${friendDescription} gets insights about their communication style and blind spots</li>
                                </ol>
                            </div>
                        </details>
                    </div>

                    <!-- Privacy Details (Expandable) -->
                    <div class="jmi-privacy-section">
                        <details class="jmi-expandable">
                            <summary class="jmi-expandable-trigger">
                                <span>What about my privacy?</span>
                                <svg class="jmi-chevron" viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                                </svg>
                            </summary>
                            <div class="jmi-expandable-content">
                                <ul class="jmi-privacy-points">
                                    <li>Your name is never shown with your feedback</li>
                                    <li>We don't send promotional emails or spam</li>
                                    <li>Your email is only used for login and optional future assessments</li>
                                    <li>You can delete your account anytime</li>
                                    <li>All data follows GDPR privacy standards</li>
                                </ul>
                            </div>
                        </details>
                    </div>

                    <!-- Call-to-Action Buttons -->
                    <div class="jmi-cta-section">
                        <div class="jmi-cta-buttons">
                            <button type="button" class="mi-quiz-button mi-quiz-button-primary jmi-cta-register" onclick="showPeerRegistrationModal()">
                                ${buttonText}
                            </button>
                            <a href="${loginUrl}" class="mi-quiz-button mi-quiz-button-secondary jmi-cta-login" onclick="trackPeerLoginClick()">
                                Already Have Account? Login
                            </a>
                        </div>
                        <p class="jmi-cta-note">
                            Takes less than 30 seconds to sign up
                        </p>
                    </div>

                    <!-- Optional: Social Proof -->
                    <div class="jmi-social-proof">
                        <p class="jmi-proof-text">
                            <span class="jmi-proof-stat">Join 1,200+</span> people who've discovered their communication blind spots through peer feedback
                        </p>
                    </div>
                    
                    ${window.location.hostname === 'mi-test-site.local' ? `
                    <!-- Debug Section (Development Only) -->
                    <div class="jmi-debug" style="margin-top: 2em; padding: 1em; background: #f8f9fa; border-radius: 8px; font-size: 0.8em; color: #666;">
                        <details>
                            <summary style="cursor: pointer; font-weight: bold;">🔧 Debug Info (Dev Only)</summary>
                            <div style="margin-top: 1em;">
                                <p><strong>Current URL:</strong> ${currentUrl}</p>
                                <p><strong>Login URL:</strong> ${loginUrl}</p>
                                <p><strong>JMI UUID:</strong> ${peerUuid}</p>
                                <p><strong>Is Logged In:</strong> ${isLoggedIn}</p>
                                <p><strong>Current User:</strong> ${JSON.stringify(currentUser)}</p>
                                <div style="margin-top: 1em;">
                                    <button onclick="window.location.reload()" class="mi-quiz-button mi-quiz-button-secondary" style="margin-right: 0.5em;">Refresh Page</button>
                                    <button onclick="checkLoginStatus()" class="mi-quiz-button mi-quiz-button-secondary">Check Login Status</button>
                                </div>
                            </div>
                        </details>
                    </div>
                    ` : ''}
                
                <!-- Registration Modal -->
                <div id="jmi-registration-modal" class="jmi-registration-modal" style="display: none;">
                    <div class="jmi-registration-modal-content">
                        <div class="jmi-registration-header">
                            <h3>Quick Account Setup</h3>
                            <p>Create your account to provide peer feedback</p>
                            <button type="button" class="jmi-modal-close" onclick="hidePeerRegistrationModal()">&times;</button>
                        </div>
                        
                        <form id="jmi-registration-form">
                            <div class="jmi-form-group">
                                <label for="jmi-reg-first-name">First Name</label>
                                <input type="text" id="jmi-reg-first-name" name="first_name" required placeholder="Enter your first name">
                            </div>
                            
                            <div class="jmi-form-group">
                                <label for="jmi-reg-email">Email Address</label>
                                <input type="email" id="jmi-reg-email" name="email" required placeholder="Enter your email address">
                            </div>
                            
                            <div class="jmi-form-actions">
                                <button type="submit" class="mi-quiz-button mi-quiz-button-primary">
                                    Create Account & Continue
                                </button>
                                <button type="button" class="mi-quiz-button mi-quiz-button-secondary" onclick="hidePeerRegistrationModal()">
                                    Cancel
                                </button>
                            </div>
                            
                            <p class="jmi-form-note">
                                <small>By creating an account, you agree to provide anonymous feedback. Your email will only be used for account access.</small>
                            </p>
                        </form>
                    </div>
                </div>
            `;
            
            // Setup registration modal handlers
            setupRegistrationModal();
            
            // Start polling for login status after user clicks login/register
            startLoginPolling();
    }
    
    // Helper function to setup peer assessment event listeners
    function setupPeerAssessmentListeners() {
        const submitBtn = $id('jmi-submit-peer');
        const counter = $id('jmi-peer-counter');

        selfContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('jmi-adjective-checkbox')) {
                updateSelectedAdjectives();
                updateCounter();
                updateSubmitButton();
            }
        });

        submitBtn.addEventListener('click', submitPeerFeedback);

        function updateSelectedAdjectives() {
            selectedAdjectives = $$('.jmi-adjective-checkbox:checked').map(cb => cb.value);
        }

        function updateCounter() {
            const count = selectedAdjectives.length;
            counter.textContent = `${count} selected (choose 6-10)`;
            counter.className = count >= 6 && count <= 10 ? 'jmi-counter-valid' : 'jmi-counter-invalid';
        }

        function updateSubmitButton() {
            submitBtn.disabled = selectedAdjectives.length < 6 || selectedAdjectives.length > 10;
        }
    }

    // Render the adjective selection grid
    function renderAdjectiveGrid(containerId) {
        const container = $id(containerId);
        let html = '';

        Object.entries(adjective_map).forEach(([domain, adjectives]) => {
            const domainKey = domain.toLowerCase().replace(/[^a-z]/g, '');
            const color = domain_colors[domain] || '#6b7280';
            
            html += `
                <div class="jmi-domain-section" data-domain="${domain}">
                    <h4 class="jmi-domain-title" style="color: ${color};">${domain}</h4>
                    <div class="jmi-adjectives-row">
                        ${adjectives.map(adj => `
                            <label class="jmi-adjective-label">
                                <input type="checkbox" class="jmi-adjective-checkbox" value="${adj}">
                                <span class="jmi-adjective-pill" style="border-color: ${color};">${adj}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Render mixed adjective grid without domain grouping
    function renderMixedAdjectiveGrid(containerId) {
        console.log('renderMixedAdjectiveGrid called with containerId:', containerId);
        console.log('adjective_map:', adjective_map);
        console.log('domain_colors:', domain_colors);
        
        const container = $id(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        // Flatten all adjectives into a single array with their colors
        const allAdjectives = [];
        Object.entries(adjective_map).forEach(([domain, adjectives]) => {
            const color = domain_colors[domain] || '#6b7280';
            adjectives.forEach(adj => {
                allAdjectives.push({ adjective: adj, color: color });
            });
        });
        
        // Shuffle the adjectives to randomize order
        for (let i = allAdjectives.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allAdjectives[i], allAdjectives[j]] = [allAdjectives[j], allAdjectives[i]];
        }
        
        // Render as a simple grid without domain sections or color coding
        const html = `
            <div class="jmi-mixed-adjectives">
                ${allAdjectives.map(({adjective, color}) => `
                    <label class="jmi-adjective-label">
                        <input type="checkbox" class="jmi-adjective-checkbox" value="${adjective}">
                        <span class="jmi-adjective-pill">${adjective}</span>
                    </label>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }

    // Save self-assessment via AJAX
    function saveSelfAssessment() {
        const submitBtn = $id('jmi-submit-self');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const body = new URLSearchParams({
            action: 'miq_jmi_save_self',
            _ajax_nonce: ajaxNonce,
            adjectives: JSON.stringify(selectedAdjectives)
        });

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })
        .then(r => r.json())
        .then(response => {
            if (response.success) {
                shareUuid = response.data.uuid;
                appState = 'awaiting-peers';
                renderShareInterface(response.data.share_url);
            } else {
                alert('Error: ' + (response.data || 'Could not save assessment'));
                submitBtn.disabled = false;
                submitBtn.textContent = 'Generate Share Link';
            }
        })
        .catch(err => {
            console.error('Save error:', err);
            alert('An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Generate Share Link';
        });
    }

    // Submit peer feedback via AJAX
    function submitPeerFeedback() {
        const submitBtn = $id('jmi-submit-peer');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const body = new URLSearchParams({
            action: 'miq_jmi_peer_submit',
            _ajax_nonce: ajaxNonce,
            uuid: peerUuid,
            adjectives: JSON.stringify(selectedAdjectives)
        });

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })
        .then(r => r.json())
        .then(response => {
            if (response.success) {
                selfContainer.innerHTML = `
                    <div class="jmi-success">
                        <h3>✓ Thank You!</h3>
                        <p>Your feedback has been submitted successfully. Your friend will be notified when enough peers have responded.</p>
                    </div>
                `;
            } else {
                alert('Error: ' + (response.data || 'Could not submit feedback'));
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Feedback';
            }
        })
        .catch(err => {
            console.error('Peer submit error:', err);
            alert('An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
        });
    }

    // Render share interface
    function renderShareInterface(shareUrl) {
        selfContainer.style.display = 'none';
        shareContainer.style.display = 'block';
        
        shareContainer.innerHTML = `
            <div class="jmi-section">
                <h3>Step 2: Invite Peers</h3>
                <p>Share this link with 2-5 friends, family, or colleagues who know you well:</p>
                
                <div class="jmi-share-box">
                    <input type="text" id="jmi-share-url" value="${shareUrl}" readonly>
                    <button id="jmi-copy-btn" class="mi-quiz-button mi-quiz-button-secondary">Copy</button>
                </div>
                
                <div class="jmi-share-actions">
                    <button id="jmi-email-share" class="mi-quiz-button mi-quiz-button-secondary">📧 Email Link</button>
                </div>
                
                <div class="jmi-progress-display" id="jmi-progress-display">
                    <h4>📊 Response Progress</h4>
                    <div class="jmi-progress-bar">
                        <div class="jmi-progress-fill" id="jmi-progress-fill">0/2</div>
                    </div>
                    <p class="jmi-progress-text" id="jmi-progress-text">Waiting for peer responses...</p>
                    <p class="jmi-progress-note">Results will be available once 2+ peers complete the assessment</p>
                </div>
            </div>
        `;

        // Copy to clipboard functionality
        $id('jmi-copy-btn').addEventListener('click', () => {
            const urlInput = $id('jmi-share-url');
            urlInput.select();
            document.execCommand('copy');
            
            const btn = $id('jmi-copy-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        });

        // Email sharing
        $id('jmi-email-share').addEventListener('click', () => {
            const subject = encodeURIComponent('Help me with my Johari Window assessment');
            const body = encodeURIComponent(`Hi!\n\nI'm doing a Johari Window assessment and would value your perspective. Please click this link and select adjectives that describe me:\n\n${shareUrl}\n\nIt only takes 2-3 minutes. Thanks!`);
            window.open(`mailto:?subject=${subject}&body=${body}`);
        });

        // Check progress immediately and update display
        updateProgressDisplay();
        
        // Auto-check progress every 30 seconds
        const progressInterval = setInterval(() => {
            if (appState === 'awaiting-peers') {
                updateProgressDisplay();
            } else {
                clearInterval(progressInterval);
            }
        }, 30000);
    }
    
    // Update progress display with current peer count
    function updateProgressDisplay() {
        const body = new URLSearchParams({
            action: 'miq_jmi_get_peer_count',
            _ajax_nonce: ajaxNonce,
            uuid: shareUuid || peerUuid
        });
        
        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })
        .then(response => response.json())
        .then(response => {
            if (response.success) {
                const { peer_count, ready_for_results } = response.data;
                updateProgressUI(peer_count, ready_for_results);
                
                // If ready, automatically load results
                if (ready_for_results) {
                    setTimeout(() => {
                        checkProgress(true); // Load the actual results
                    }, 1000);
                }
            } else {
                console.log('Progress update failed:', response.data);
            }
        })
        .catch(err => {
            console.error('Progress update error:', err);
        });
    }
    
    // Update the progress UI elements
    function updateProgressUI(peerCount, isReady) {
        const progressFill = document.getElementById('jmi-progress-fill');
        const progressText = document.getElementById('jmi-progress-text');
        const progressBar = document.querySelector('.jmi-progress-bar');
        
        if (!progressFill || !progressText || !progressBar) return;
        
        // Update progress bar
        const percentage = Math.min((peerCount / 2) * 100, 100);
        progressBar.style.background = `linear-gradient(to right, #22c55e ${percentage}%, #e5e7eb ${percentage}%)`;
        
        // Update text content
        progressFill.textContent = `${peerCount}/2`;
        
        if (isReady) {
            progressText.textContent = '🎉 Results are ready! Loading...';
            progressText.style.color = '#22c55e';
            progressText.style.fontWeight = 'bold';
        } else if (peerCount === 1) {
            progressText.textContent = '1 peer has responded. Waiting for 1 more...';
            progressText.style.color = '#f59e0b';
        } else if (peerCount === 0) {
            progressText.textContent = 'Waiting for peer responses...';
            progressText.style.color = '#6b7280';
        } else {
            progressText.textContent = `${peerCount} peers have responded. Waiting for ${Math.max(0, 2 - peerCount)} more...`;
            progressText.style.color = '#f59e0b';
        }
    }

    // Check progress and see if results are ready
    function checkProgress(silent = false) {
        console.log('checkProgress called, silent:', silent);
        console.log('shareUuid:', shareUuid);
        console.log('peerUuid:', peerUuid);
        console.log('ajaxUrl:', ajaxUrl);
        console.log('ajaxNonce:', ajaxNonce);
        
        const body = new URLSearchParams({
            action: 'miq_jmi_generate_results',
            _ajax_nonce: ajaxNonce,
            uuid: shareUuid || peerUuid
        });
        
        console.log('AJAX request body:', Array.from(body.entries()));

        // No UI updates needed - this is just for loading results

        console.log('Starting AJAX request...');
        
        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })
        .then(response => {
            console.log('Raw response status:', response.status);
            console.log('Raw response headers:', Array.from(response.headers.entries()));
            return response.text(); // Get raw text first
        })
        .then(rawText => {
            console.log('Raw response text:', rawText);
            try {
                const response = JSON.parse(rawText);
                console.log('Parsed response:', response);
                
                if (response.success) {
                    console.log('Success! Rendering results...');
                    appState = 'results';
                    renderResults(response.data);
                } else {
                    console.log('Response not successful:', response.data);
                    if (!silent) {
                        const message = response.data || 'Not enough peer feedback yet';
                        alert(message);
                    }
                }
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Raw text that failed to parse:', rawText);
                if (!silent) alert('Invalid response from server. Check console for details.');
            }
        })
        .catch(err => {
            console.error('Progress check fetch error:', err);
            if (!silent) alert('Could not check progress. Please try again.');
        })
        // No cleanup needed for button since it's removed
    }

    // Render Johari Window results
    function renderResults(data) {
        shareContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        const { open, blind, hidden, unknown, domain_summary } = data;

        resultsContainer.innerHTML = `
            <div class="jmi-results-section">
                <h3>Your Johari × MI Window</h3>
                <p class="jmi-results-intro">Here's how you and your peers see your MI-based strengths:</p>
                
                <div class="jmi-johari-grid jmi-three-quadrant">
                    <div class="jmi-quadrant jmi-open" style="background-color: ${quadrant_colors.open}20; border-color: ${quadrant_colors.open};">
                        <h4>🌟 Open (Known to You & Others)</h4>
                        <div class="jmi-adjective-list">${renderAdjectiveList(open || [], 'open')}</div>
                    </div>
                    
                    <div class="jmi-quadrant jmi-blind" style="background-color: ${quadrant_colors.blind}20; border-color: ${quadrant_colors.blind};">
                        <h4>👁️ Blind (Known to Others, Not You)</h4>
                        <div class="jmi-adjective-list">${renderAdjectiveList(blind || [], 'blind')}</div>
                    </div>
                    
                    <div class="jmi-quadrant jmi-hidden" style="background-color: ${quadrant_colors.hidden}20; border-color: ${quadrant_colors.hidden};">
                        <h4>🔐 Hidden (Known to You, Not Others)</h4>
                        <div class="jmi-adjective-list">${renderAdjectiveList(hidden || [], 'hidden')}</div>
                    </div>
                </div>
                
                <div style="margin-top: 1.5em; padding: 1em; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 0.9em;">💡 <strong>The "Unknown" quadrant</strong> represents ${unknown ? unknown.length : 0} adjectives that neither you nor your peers selected. These remain areas of potential future discovery.</p>
                </div>
                
                ${renderMIProfileComparison(data)}
                
                ${renderDebugSection(data)}
                
                <div class="jmi-actions">
                    <button id="jmi-download-pdf" class="mi-quiz-button mi-quiz-button-primary">📄 Download PDF</button>
                    <button id="jmi-invite-more" class="mi-quiz-button mi-quiz-button-secondary">👥 Invite More Peers</button>
                    <button id="jmi-retake" class="mi-quiz-button mi-quiz-button-secondary">🔄 Retake</button>
                </div>
            </div>
        `;

        // Action button handlers
        $id('jmi-download-pdf').addEventListener('click', downloadPDF);
        $id('jmi-invite-more').addEventListener('click', () => {
            appState = 'awaiting-peers';
            resultsContainer.style.display = 'none';
            shareContainer.style.display = 'block';
        });
        $id('jmi-retake').addEventListener('click', () => {
            if (confirm('Are you sure? This will reset your assessment and you\'ll need to invite peers again.')) {
                appState = 'initial';
                selectedAdjectives = [];
                shareUuid = null;
                resultsContainer.style.display = 'none';
                selfContainer.style.display = 'block';
                renderSelfAssessment();
            }
        });
    }

    // Render list of adjectives with domain colors
    function renderAdjectiveList(adjectives, quadrant) {
        if (!adjectives || adjectives.length === 0) {
            return '<em class="jmi-no-adjectives">None identified</em>';
        }

        return adjectives.map(adj => {
            const domain = findAdjectiveDomain(adj);
            const color = domain_colors[domain] || '#6b7280';
            return `<span class="jmi-adjective-pill jmi-${quadrant}" style="border-color: ${color};" title="${domain}">${adj}</span>`;
        }).join('');
    }

    // Find which domain an adjective belongs to
    function findAdjectiveDomain(adjective) {
        for (const [domain, adjectives] of Object.entries(adjective_map)) {
            if (adjectives.includes(adjective)) {
                return domain;
            }
        }
        return 'Unknown';
    }

    // Render MI domain summary with actual adjectives and insights
    function renderDomainSummary(summary, data) {
        const { open = [], blind = [], hidden = [], unknown = [] } = data || {};
        
        // Get MI domain descriptions
        const domainDescriptions = {
            'Linguistic': 'Word-smart: Strength with language, communication, and verbal expression',
            'Logical-Mathematical': 'Logic-smart: Strength with reasoning, patterns, and analytical thinking',
            'Spatial-Visual': 'Picture-smart: Strength with visual imagery, spatial relationships, and design',
            'Bodily-Kinesthetic': 'Body-smart: Strength with physical movement, coordination, and hands-on learning',
            'Musical-Rhythmic': 'Music-smart: Strength with rhythm, melody, and auditory patterns',
            'Interpersonal': 'People-smart: Strength with understanding others and social interaction',
            'Intrapersonal': 'Self-smart: Strength with self-awareness and personal reflection',
            'Naturalistic': 'Nature-smart: Strength with understanding natural patterns and environments'
        };
        
        let html = '<div class="jmi-domain-grid">';
        
        Object.entries(adjective_map).forEach(([domain, domainAdjectives]) => {
            const domainData = summary[domain] || { open: 0, blind: 0, hidden: 0, unknown: 0 };
            const color = domain_colors[domain] || '#6b7280';
            const total = domainData.open + domainData.blind + domainData.hidden;
            
            // Get actual adjectives for this domain in each category
            const domainOpen = open.filter(adj => domainAdjectives.includes(adj));
            const domainBlind = blind.filter(adj => domainAdjectives.includes(adj));
            const domainHidden = hidden.filter(adj => domainAdjectives.includes(adj));
            
            // Skip domains with no activity
            if (total === 0) return;
            
            const domainSlug = domain.toLowerCase().replace(/[^a-z0-9]/g, '-');
            html += `
                <div class="jmi-domain-card jmi-domain-${domainSlug}">
                    <div class="jmi-domain-header">
                        <h5 class="jmi-domain-title">${domain}</h5>
                        <p class="jmi-domain-description">${domainDescriptions[domain] || 'Multiple Intelligence domain'}</p>
                    </div>
                    
                    <div class="jmi-domain-breakdown">
                        ${domainOpen.length > 0 ? `
                            <div class="jmi-category-section">
                                <div class="jmi-category-header">
                                    <span class="jmi-category-label jmi-open">🌟 Open (${domainOpen.length})</span>
                                </div>
                                <div class="jmi-adjectives-mini">
                                    ${domainOpen.map(adj => `<span class="jmi-adjective-mini jmi-open" title="You and peers see this">${adj}</span>`).join('')}
                                </div>
                                <p class="jmi-insight">✨ Recognized ${domain} strengths that others validate</p>
                            </div>
                        ` : ''}
                        
                        ${domainBlind.length > 0 ? `
                            <div class="jmi-category-section">
                                <div class="jmi-category-header">
                                    <span class="jmi-category-label jmi-blind">👁️ Blind (${domainBlind.length})</span>
                                </div>
                                <div class="jmi-adjectives-mini">
                                    ${domainBlind.map(adj => `<span class="jmi-adjective-mini jmi-blind" title="Others see this, you don't">${adj}</span>`).join('')}
                                </div>
                                <p class="jmi-insight">🔍 Potential ${domain} strengths you may not recognize</p>
                            </div>
                        ` : ''}
                        
                        ${domainHidden.length > 0 ? `
                            <div class="jmi-category-section">
                                <div class="jmi-category-header">
                                    <span class="jmi-category-label jmi-hidden">🔐 Hidden (${domainHidden.length})</span>
                                </div>
                                <div class="jmi-adjectives-mini">
                                    ${domainHidden.map(adj => `<span class="jmi-adjective-mini jmi-hidden" title="You see this, others don't">${adj}</span>`).join('')}
                                </div>
                                <p class="jmi-insight">💎 ${domain} strengths you could showcase more</p>
                            </div>
                        ` : ''}
                        
                        ${total === 0 ? `
                            <div class="jmi-category-section">
                                <p class="jmi-insight" style="color: #9ca3af;">No ${domain} adjectives identified in this assessment</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="jmi-domain-summary-line">
                        <strong class="jmi-domain-total">Total ${domain}: ${total} adjectives</strong>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add overall MI insights
        const totalActive = Object.values(summary || {}).reduce((sum, domain) => sum + (domain.open + domain.blind + domain.hidden), 0);
        const activeDomains = Object.entries(summary || {}).filter(([_, domain]) => (domain.open + domain.blind + domain.hidden) > 0).length;
        
        html += `
            <div class="jmi-overall-insights" style="margin-top: 1.5em; padding: 1em; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h5 style="color: #1e40af; margin: 0 0 0.5em;">🧠 Your MI Profile Insights</h5>
                <p style="margin: 0 0 0.5em; font-size: 0.9em;">You show activity across <strong>${activeDomains} of ${Object.keys(adjective_map).length}</strong> multiple intelligence domains with <strong>${totalActive} total adjectives</strong> identified.</p>
                ${activeDomains > 0 ? `
                    <p style="margin: 0; font-size: 0.9em; color: #6c757d;">
                        This suggests a ${activeDomains <= 2 ? 'focused' : activeDomains <= 4 ? 'balanced' : 'highly diverse'} intelligence profile. 
                        ${activeDomains <= 2 ? 'You may have deep expertise in specific areas.' : 
                          activeDomains <= 4 ? 'You show strengths across multiple complementary domains.' : 
                          'You demonstrate versatility across many intelligence types.'}
                    </p>
                ` : ''}
            </div>
        `;
        
        return html;
    }
    
    // Render MI Profile Comparison section
    function renderMIProfileComparison(data) {
        const { mi_profile, domain_summary } = data || {};
        
        if (!mi_profile || !mi_profile.has_results) {
            return `
                <div class="jmi-mi-comparison" style="margin: 3em 0; padding: 2em; background: #f8fafc; border-radius: 8px; border-left: 4px solid #e2e8f0;">
                    <h4 style="color: #64748b; margin-top: 0;">🧠 MI Assessment Comparison</h4>
                    <p style="color: #64748b; font-style: italic;">Complete the <a href="/multiple-intelligences/" target="_blank">Multiple Intelligences Assessment</a> to see how your self-perceived strengths compare with peer feedback!</p>
                </div>
            `;
        }
        
        const { top3_names, part1_scores, strength_levels, assessment_date } = mi_profile;
        
        // Create comparison between MI scores and peer feedback activity
        const comparisonData = [];
        const domainMap = {
            'logical-mathematical': 'Logical-Mathematical',
            'linguistic': 'Linguistic', 
            'spatial': 'Spatial-Visual',
            'bodily-kinesthetic': 'Bodily-Kinesthetic',
            'musical': 'Musical-Rhythmic',
            'interpersonal': 'Interpersonal',
            'intrapersonal': 'Intrapersonal',
            'naturalistic': 'Naturalistic'
        };
        
        // Get actual adjectives from the data
        const { open = [], blind = [], hidden = [] } = data || {};
        
        Object.entries(domainMap).forEach(([slug, displayName]) => {
            const miScore = part1_scores[slug] || 0;
            const miStrength = strength_levels[slug] || 'Not Assessed';
            const domainData = domain_summary[displayName] || { open: 0, blind: 0, hidden: 0, unknown: 0 };
            const peerTotal = domainData.open + domainData.blind + domainData.hidden;
            
            // Determine maximum score based on whether this domain is in top 3
            const isTop3Domain = mi_profile.top3.includes(slug);
            const maxScore = isTop3Domain ? 75 : 45; // Top 3 get detailed questions (75), others get basic (45)
            
            // Get actual adjectives for this domain from each category
            const domainAdjectives = adjective_map[displayName] || [];
            const domainOpen = open.filter(adj => domainAdjectives.includes(adj));
            const domainBlind = blind.filter(adj => domainAdjectives.includes(adj));
            const domainHidden = hidden.filter(adj => domainAdjectives.includes(adj));
            
            comparisonData.push({
                slug,
                displayName,
                miScore,
                miStrength,
                peerTotal,
                maxScore,
                miPercentage: (miScore / maxScore) * 100,
                hasActivity: peerTotal > 0,
                isTop3Domain,
                adjectives: {
                    open: domainOpen,
                    blind: domainBlind,
                    hidden: domainHidden
                }
            });
        });
        
        // Sort by MI score descending
        comparisonData.sort((a, b) => b.miScore - a.miScore);
        
        return `
            <div class="jmi-mi-comparison" style="margin: 3em 0; padding: 2em; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div class="jmi-mi-header" style="text-align: center; margin-bottom: 2em;">
                    <h4 style="color: #0ea5e9; margin: 0 0 0.5em; font-size: 1.3em;">🧠 × 👥 MI Assessment vs Peer Feedback</h4>
                    <p style="color: #64748b; margin: 0 0 1em; font-size: 0.95em;">How do your self-perceived MI strengths compare with what peers see in you?</p>
                    ${assessment_date ? `<small style="color: #9ca3af; font-size: 0.8em;">Your MI assessment: ${new Date(assessment_date).toLocaleDateString()}</small>` : ''}
                </div>
                
                <div style="background: #f8fafc; padding: 1.5em; border-radius: 8px; margin-bottom: 2em; border-left: 4px solid #1e40af;">
                    <h5 style="color: #0ea5e9; margin: 0 0 0.8em; font-size: 1em;">💡 Understanding the Connection</h5>
                    <p style="color: #374151; font-size: 0.9em; line-height: 1.5; margin: 0 0 0.8em;">
                        Each adjective below has been carefully mapped to specific <strong>Multiple Intelligence domains</strong>. 
                        When peers select adjectives like "Analytical" or "Creative," they're actually recognizing traits that correspond 
                        to your Logical-Mathematical or Spatial-Visual intelligence.
                    </p>
                    <p style="color: #374151; font-size: 0.9em; line-height: 1.5; margin: 0;">
                        This comparison reveals whether your <em>self-assessed MI strengths</em> align with the <em>intelligence-related traits peers observe in you</em>. 
                        Strong correlations suggest authentic strengths, while gaps may indicate hidden talents or growth opportunities.
                    </p>
                </div>
                
                <div class="jmi-top3-highlight" style="background: #f8fafc; padding: 1.5em; border-radius: 8px; margin-bottom: 2em; border: 1px solid #e2e8f0;">
                    <h5 style="color: #1e40af; margin: 0 0 1em; text-align: center;">🌟 Your Top 3 MI Strengths</h5>
                    <div class="jmi-top3-cards">
                        ${top3_names.map((name, index) => {
                            const slug = mi_profile.top3[index];
                            const domainData = domain_summary[name] || { open: 0, blind: 0, hidden: 0, unknown: 0 };
                            const peerTotal = domainData.open + domainData.blind + domainData.hidden;
                            const slugClass = slug.replace('-', '-');
                            
                            return `
                                <div class="jmi-strength-card-enhanced ${slugClass}">
                                    <div class="jmi-strength-header">
                                        <h6 class="jmi-strength-title">${name}</h6>
                                        <div class="jmi-strength-score">MI Score: ${part1_scores[slug] || 0}/75</div>
                                        <div class="jmi-strength-activity">Peer Activity: ${peerTotal} adjectives</div>
                                        ${peerTotal > 0 ? 
                                            `<div class="jmi-peer-validation peer-validated">✓ Peer Validated</div>` :
                                            `<div class="jmi-peer-validation hidden-strength">⚡ Hidden Strength?</div>`
                                        }
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; overflow: hidden; background: white; margin-top: 2em;">
                    <div style="background: rgba(59, 130, 246, 0.05); padding: 1em 1.5em; font-weight: bold; color: #1e40af; border-bottom: 1px solid rgba(59, 130, 246, 0.1);">
                        📊 Complete MI vs Peer Feedback Analysis
                    </div>
                    <div style="padding: 1.5em 1.5em 0.5em 1.5em; background: #f8fafc; border-bottom: 1px solid rgba(59, 130, 246, 0.1);">
                        <p style="color: #475569; font-size: 0.9em; margin: 0 0 0.8em; line-height: 1.5; text-align: center;">
                            Each card below shows one of your <strong>Multiple Intelligence domains</strong> with its score from your self-assessment, 
                            followed by the specific adjectives peers selected that map to that intelligence type.
                        </p>
                        <div style="background: rgba(59, 130, 246, 0.08); padding: 0.8em; border-radius: 6px; border-left: 3px solid #3b82f6;">
                            <p style="color: #1e40af; font-size: 0.8em; margin: 0; line-height: 1.4; text-align: center;">
                                <strong>📊 Adaptive Scoring:</strong> Your top 3 MI domains received detailed questioning (scored out of 75), 
                                while other domains received basic assessment (scored out of 45). This is why score ranges vary between domains.
                            </p>
                        </div>
                    </div>
                    <div style="padding: 1.5em;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5em;">
                            ${comparisonData.map(item => {
                                const color = domain_colors[item.displayName] || '#6b7280';
                                const maxScore = Math.max(...comparisonData.map(d => d.miScore)) || 1;
                                const barWidth = Math.max(12, (item.miScore / maxScore) * 100);
                                
                                // Render adjectives for this domain with better contrast and sizing
                                const renderAdjectives = (adjList, category) => {
                                    if (!adjList || adjList.length === 0) return '';
                                    const categoryStyles = {
                                        open: {
                                            bg: '#dcfce7',
                                            border: '#16a34a',
                                            text: '#15803d',
                                            icon: '🌟'
                                        },
                                        blind: {
                                            bg: '#fef3c7',
                                            border: '#d97706',
                                            text: '#b45309',
                                            icon: '👁️'
                                        },
                                        hidden: {
                                            bg: '#f1f5f9',
                                            border: '#64748b',
                                            text: '#475569',
                                            icon: '🔐'
                                        }
                                    };
                                    
                                    const style = categoryStyles[category];
                                    
                                    return `
                                        <div style="margin-top: 0.8em; padding: 0.5em; background: ${style.bg}; border-radius: 6px; border: 1px solid ${style.border}30;">
                                            <div style="font-size: 0.75em; color: ${style.text}; font-weight: bold; margin-bottom: 0.4em; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ${style.icon} ${category} Quadrant
                                            </div>
                                            <div style="display: flex; flex-wrap: wrap; gap: 0.3em;">
                                                ${adjList.map(adj => `
                                                    <span style="background: white; color: ${style.text}; padding: 0.3em 0.6em; border-radius: 4px; font-size: 0.8em; font-weight: 500; border: 1px solid ${style.border}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${adj}</span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;
                                };
                                
                                return `
                                    <div style="border: 2px solid ${color}30; border-radius: 12px; padding: 1.2em; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.08); ${item.isTop3Domain ? 'border-color: ' + color + '60; box-shadow: 0 4px 12px rgba(0,0,0,0.12);' : ''}">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8em;">
                                            <div style="display: flex; align-items: center; flex: 1;">
                                                <h6 style="color: ${color}; margin: 0; font-size: 1em; font-weight: bold;">${item.displayName}</h6>
                                                ${item.isTop3Domain ? `<span style="background: #10b981; color: white; padding: 0.2em 0.4em; border-radius: 12px; font-size: 0.65em; margin-left: 0.5em; font-weight: bold;">TOP 3</span>` : ''}
                                            </div>
                                            <span style="background: ${color}15; color: ${color}; padding: 0.3em 0.6em; border-radius: 20px; font-size: 0.8em; font-weight: bold;">${item.miScore}/${item.maxScore}</span>
                                        </div>
                                        
                                        <div style="background: #f8fafc; border-radius: 6px; height: 16px; margin-bottom: 0.8em; position: relative; overflow: hidden; border: 1px solid #e2e8f0;">
                                            <div style="background: linear-gradient(90deg, ${color}, ${color}dd); height: 100%; border-radius: 5px; width: ${barWidth}%; transition: width 0.8s ease; position: relative; box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);">
                                                <div style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: white; font-size: 0.7em; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">${item.miScore}</div>
                                            </div>
                                        </div>
                                        
                                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; margin-bottom: 0.6em;">
<span style="color: #1e3a8a; font-weight: 600; background: #eef2ff; padding: 0.2em 0.5em; border-radius: 4px;">Self score: ${item.miStrength}</span>
                                            <span style="color: ${item.hasActivity ? '#059669' : '#94a3b8'}; font-weight: bold;">
                                                ${item.peerTotal} peer ${item.peerTotal === 1 ? 'match' : 'matches'}
                                            </span>
                                        </div>
                                        
                                        ${item.adjectives.open.length > 0 ? renderAdjectives(item.adjectives.open, 'open') : ''}
                                        ${item.adjectives.blind.length > 0 ? renderAdjectives(item.adjectives.blind, 'blind') : ''}
                                        ${item.adjectives.hidden.length > 0 ? renderAdjectives(item.adjectives.hidden, 'hidden') : ''}
                                        
                                        ${item.hasActivity ? 
                                            `<div style="margin-top: 1em; font-size: 0.8em; color: #065f46; background: #ecfdf5; padding: 0.6em; border-radius: 6px; border-left: 4px solid #10b981; font-weight: 500;">✨ Strong correlation: Peers validate this MI strength</div>` :
                                            item.miPercentage > 60 ? 
                                                `<div style="margin-top: 1em; font-size: 0.8em; color: #92400e; background: #fffbeb; padding: 0.6em; border-radius: 6px; border-left: 4px solid #f59e0b; font-weight: 500;">💎 Hidden talent: Strong MI score (${Math.round(item.miPercentage)}%) but low peer awareness</div>` :
                                                item.peerTotal > 0 ?
                                                    `<div style="margin-top: 1em; font-size: 0.8em; color: #3730a3; background: #f0f9ff; padding: 0.6em; border-radius: 6px; border-left: 4px solid #3b82f6; font-weight: 500;">👀 Peer discovery: Others see potential you may not recognize</div>` :
                                                    `<div style="margin-top: 1em; font-size: 0.8em; color: #374151; background: #f9fafb; padding: 0.6em; border-radius: 6px; border-left: 4px solid #9ca3af; font-weight: 500;">🌱 Growth opportunity: Room for development in this area</div>`
                                        }
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <div style="margin-top: 2em; padding: 2em; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                            <div style="text-align: center; margin-bottom: 2em;">
                                <h6 style="color: #1e40af; margin: 0 0 0.5em; font-size: 1.4em; font-weight: 700;">💡 How to Interpret Your Results</h6>
                                <p style="color: #64748b; margin: 0; font-size: 1em;">Understanding the relationship between your MI scores and peer feedback</p>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5em; margin-bottom: 2em;">
                                <div style="background: #f0fdf4; padding: 1.5em; border-radius: 12px; border: 2px solid #16a34a20; transition: transform 0.2s ease;">
                                    <div style="color: #15803d; font-weight: 700; font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em;">✨ Validated Strengths</div>
                                    <div style="color: #374151; font-size: 0.95em; line-height: 1.6;">High MI score <strong>+</strong> peer-recognized adjectives = authentic strength that others clearly see in you</div>
                                </div>
                                <div style="background: #fefce8; padding: 1.5em; border-radius: 12px; border: 2px solid #eab30820; transition: transform 0.2s ease;">
                                    <div style="color: #ca8a04; font-weight: 700; font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em;">💎 Hidden Talents</div>
                                    <div style="color: #374151; font-size: 0.95em; line-height: 1.6;">High MI score <strong>+</strong> few peer adjectives = you may not be expressing this intelligence enough for others to notice</div>
                                </div>
                                <div style="background: #f0f9ff; padding: 1.5em; border-radius: 12px; border: 2px solid #3b82f620; transition: transform 0.2s ease;">
                                    <div style="color: #1d4ed8; font-weight: 700; font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em;">👀 Peer Discoveries</div>
                                    <div style="color: #374151; font-size: 0.95em; line-height: 1.6;">Lower MI score <strong>+</strong> peer adjectives = others recognize intelligence potential you may underestimate</div>
                                </div>
                                <div style="background: #f9fafb; padding: 1.5em; border-radius: 12px; border: 2px solid #6b728020; transition: transform 0.2s ease;">
                                    <div style="color: #4b5563; font-weight: 700; font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em;">🌱 Growth Opportunities</div>
                                    <div style="color: #374151; font-size: 0.95em; line-height: 1.6;">Lower scores in both areas suggest potential for development and skill building</div>
                                </div>
                            </div>
                            
                            <div style="background: #f8fafc; padding: 1.5em; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 4px solid #1e40af;">
                                <h6 style="color: #1e40af; margin: 0 0 1em; font-size: 1.1em; font-weight: 600;">🎯 Action Steps</h6>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1em;">
                                    <div style="display: flex; align-items: flex-start; gap: 0.75em;">
                                        <div style="background: #16a34a; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; flex-shrink: 0;">1</div>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 0.25em;">Leverage validated strengths</div>
                                            <div style="font-size: 0.9em; color: #64748b; line-height: 1.4;">Use these in your work and personal projects</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 0.75em;">
                                        <div style="background: #ca8a04; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; flex-shrink: 0;">2</div>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 0.25em;">Showcase hidden talents</div>
                                            <div style="font-size: 0.9em; color: #64748b; line-height: 1.4;">Express these more openly so others can recognize them</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 0.75em;">
                                        <div style="background: #1d4ed8; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; flex-shrink: 0;">3</div>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 0.25em;">Explore peer discoveries</div>
                                            <div style="font-size: 0.9em; color: #64748b; line-height: 1.4;">Ask others what they see in you that you might be missing</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: flex-start; gap: 0.75em;">
                                        <div style="background: #4b5563; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: bold; flex-shrink: 0;">4</div>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 0.25em;">Develop growth areas</div>
                                            <div style="font-size: 0.9em; color: #64748b; line-height: 1.4;">Focus on targeted learning and practice</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render comprehensive debug section
    function renderDebugSection(data) {
        if (window.location.hostname !== 'mi-test-site.local') {
            return ''; // Only show debug on local dev
        }
        
        const { open, blind, hidden, unknown, domain_summary, debug_info } = data;
        
        return `
            <div class="jmi-debug-section" style="margin-top: 2em; padding: 1.5em; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;">
                <h4 style="color: #495057; margin-bottom: 1em;">🔧 Debug Information (Development Only)</h4>
                
                <!-- Raw Data Overview -->
                <details style="margin-bottom: 1em;">
                    <summary style="cursor: pointer; font-weight: bold; color: #007cba;">📊 Raw Results Data</summary>
                    <div style="margin-top: 0.5em; font-family: monospace; background: #fff; padding: 1em; border-radius: 4px; overflow-x: auto;">
                        <pre>${JSON.stringify({ open, blind, hidden, unknown, domain_summary }, null, 2)}</pre>
                    </div>
                </details>
                
                <!-- Self vs Peer Responses -->
                ${debug_info && debug_info.self_adjectives ? `
                <details style="margin-bottom: 1em;">
                    <summary style="cursor: pointer; font-weight: bold; color: #007cba;">👤 Self-Assessment vs Peer Responses</summary>
                    <div style="margin-top: 0.5em;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1em; margin-bottom: 1em;">
                            <div style="background: #fff; padding: 1em; border-radius: 4px;">
                                <h5 style="margin: 0 0 0.5em; color: #28a745;">Your Self-Assessment</h5>
                                <div style="font-size: 0.9em;">
                                    ${debug_info.self_adjectives.map(adj => {
                                        const domain = findAdjectiveDomain(adj);
                                        const color = domain_colors[domain] || '#6b7280';
                                        return `<span style="display: inline-block; margin: 2px; padding: 4px 8px; background: ${color}20; border: 1px solid ${color}; border-radius: 12px; font-size: 0.8em;">${adj} <small>(${domain})</small></span>`;
                                    }).join('')}
                                </div>
                            </div>
                            <div style="background: #fff; padding: 1em; border-radius: 4px;">
                                <h5 style="margin: 0 0 0.5em; color: #17a2b8;">All Peer Responses</h5>
                                <div style="font-size: 0.9em;">
                                    ${debug_info.all_peer_adjectives ? debug_info.all_peer_adjectives.map(adj => {
                                        const domain = findAdjectiveDomain(adj);
                                        const color = domain_colors[domain] || '#6b7280';
                                        return `<span style="display: inline-block; margin: 2px; padding: 4px 8px; background: ${color}20; border: 1px solid ${color}; border-radius: 12px; font-size: 0.8em;">${adj} <small>(${domain})</small></span>`;
                                    }).join('') : 'No peer data available'}
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
                ` : ''}
                
                <!-- Individual Peer Responses -->
                ${debug_info && debug_info.peer_responses ? `
                <details style="margin-bottom: 1em;">
                    <summary style="cursor: pointer; font-weight: bold; color: #007cba;">👥 Individual Peer Responses (${debug_info.peer_responses.length} peers)</summary>
                    <div style="margin-top: 0.5em;">
                        ${debug_info.peer_responses.map((peerResponse, index) => `
                            <div style="background: #fff; padding: 1em; margin-bottom: 0.5em; border-left: 4px solid #17a2b8; border-radius: 4px;">
                                <h6 style="margin: 0 0 0.5em; color: #17a2b8;">Peer ${index + 1} (User ID: ${peerResponse.peer_user_id || 'Unknown'})</h6>
                                <div style="font-size: 0.9em;">
                                    ${peerResponse.adjectives.map(adj => {
                                        const domain = findAdjectiveDomain(adj);
                                        const color = domain_colors[domain] || '#6b7280';
                                        return `<span style="display: inline-block; margin: 2px; padding: 4px 8px; background: ${color}20; border: 1px solid ${color}; border-radius: 12px; font-size: 0.8em;">${adj} <small>(${domain})</small></span>`;
                                    }).join('')}
                                </div>
                                <small style="color: #6c757d; margin-top: 0.5em; display: block;">Submitted: ${peerResponse.created_at || 'Unknown time'}</small>
                            </div>
                        `).join('')}
                    </div>
                </details>
                ` : ''}
                
                <!-- Categorization Logic -->
                <details style="margin-bottom: 1em;">
                    <summary style="cursor: pointer; font-weight: bold; color: #007cba;">🧠 Johari Window Categorization Logic</summary>
                    <div style="margin-top: 0.5em; background: #fff; padding: 1em; border-radius: 4px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1em; font-size: 0.9em;">
                            <div>
                                <h6 style="color: #28a745; margin: 0 0 0.5em;">🌟 Open (You + Others chose)</h6>
                                <p style="margin: 0 0 0.5em; color: #6c757d; font-size: 0.8em;">Adjectives selected by both you and your peers</p>
                                ${(open || []).map(adj => `<div>• <strong>${adj}</strong> (${findAdjectiveDomain(adj)})</div>`).join('') || '<em>None</em>'}
                            </div>
                            <div>
                                <h6 style="color: #dc3545; margin: 0 0 0.5em;">👁️ Blind (Others chose, you didn't)</h6>
                                <p style="margin: 0 0 0.5em; color: #6c757d; font-size: 0.8em;">Adjectives your peers see but you don't recognize</p>
                                ${(blind || []).map(adj => `<div>• <strong>${adj}</strong> (${findAdjectiveDomain(adj)})</div>`).join('') || '<em>None</em>'}
                            </div>
                            <div>
                                <h6 style="color: #ffc107; margin: 0 0 0.5em;">🔐 Hidden (You chose, others didn't)</h6>
                                <p style="margin: 0 0 0.5em; color: #6c757d; font-size: 0.8em;">Adjectives you see in yourself but others don't</p>
                                ${(hidden || []).map(adj => `<div>• <strong>${adj}</strong> (${findAdjectiveDomain(adj)})</div>`).join('') || '<em>None</em>'}
                            </div>
                            <div>
                                <h6 style="color: #6f42c1; margin: 0 0 0.5em;">❓ Unknown (Neither chose)</h6>
                                <p style="margin: 0 0 0.5em; color: #6c757d; font-size: 0.8em;">Adjectives neither you nor your peers selected</p>
                                ${(unknown || []).slice(0, 10).map(adj => `<div>• <strong>${adj}</strong> (${findAdjectiveDomain(adj)})</div>`).join('')}
                                ${(unknown || []).length > 10 ? `<div style="font-style: italic; color: #6c757d;">... and ${(unknown || []).length - 10} more</div>` : ''}
                            </div>
                        </div>
                    </div>
                </details>
                
                <!-- MI Domain Analysis -->
                <details style="margin-bottom: 1em;">
                    <summary style="cursor: pointer; font-weight: bold; color: #007cba;">🎯 MI Domain Analysis</summary>
                    <div style="margin-top: 0.5em; background: #fff; padding: 1em; border-radius: 4px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; font-size: 0.9em;">
                            ${Object.entries(adjective_map).map(([domain, domainAdjectives]) => {
                                const domainData = (domain_summary && domain_summary[domain]) || { open: 0, blind: 0, hidden: 0, unknown: 0 };
                                const color = domain_colors[domain] || '#6b7280';
                                const total = domainData.open + domainData.blind + domainData.hidden;
                                return `
                                    <div style="border-left: 4px solid ${color}; padding-left: 1em;">
                                        <h6 style="color: ${color}; margin: 0 0 0.5em;">${domain}</h6>
                                        <div style="font-size: 0.8em; color: #6c757d; margin-bottom: 0.5em;">Total responses: ${total}</div>
                                        <div style="font-size: 0.8em;">
                                            <div>Open: ${domainData.open || 0}</div>
                                            <div>Blind: ${domainData.blind || 0}</div>
                                            <div>Hidden: ${domainData.hidden || 0}</div>
                                        </div>
                                        <details style="margin-top: 0.5em;">
                                            <summary style="font-size: 0.7em; cursor: pointer; color: ${color};">Show ${domainAdjectives.length} adjectives</summary>
                                            <div style="margin-top: 0.25em; font-size: 0.7em; color: #6c757d;">
                                                ${domainAdjectives.join(', ')}
                                            </div>
                                        </details>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </details>
            </div>
        `;
    }

    // Download PDF functionality
    function downloadPDF() {
        const btn = $id('jmi-download-pdf');
        btn.disabled = true;
        btn.textContent = 'Generating...';

        const resultsHtml = resultsContainer.innerHTML;

        const body = new URLSearchParams({
            action: 'miq_jmi_generate_pdf',
            _ajax_nonce: ajaxNonce,
            results_html: resultsHtml
        });

        fetch(ajaxUrl, {
            method: 'POST',
            body
        })
        .then(response => response.ok ? response.blob() : Promise.reject('Network response was not ok'))
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `johari-mi-results-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        })
        .catch(error => {
            console.error('PDF Download Error:', error);
            alert('Sorry, there was an error generating the PDF.');
        })
        .finally(() => {
            btn.textContent = '📄 Download PDF';
            btn.disabled = false;
        });
    }

    // Legacy function for debug button - now uses new polling system
    window.checkLoginStatus = function() {
        console.log('Manual login status check requested...');
        checkLoginStatusQuick().then(loggedIn => {
            if (loggedIn) {
                alert('You are logged in! Reloading page...');
                window.location.reload();
            } else {
                alert('Still not logged in. Try logging in manually.');
            }
        }).catch(error => {
            console.error('Login check error:', error);
            alert('Could not check login status.');
        });
    }
    
    // Registration modal functions
    function showPeerRegistrationModal() {
        const modal = document.getElementById('jmi-registration-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Focus on first input
            const firstInput = modal.querySelector('#jmi-reg-first-name');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
        trackPeerRegistrationClick();
    }
    
    function hidePeerRegistrationModal() {
        const modal = document.getElementById('jmi-registration-modal');
        if (modal) {
            modal.style.display = 'none';
            // Clear form
            const form = modal.querySelector('#jmi-registration-form');
            if (form) {
                form.reset();
            }
        }
    }
    
    function setupRegistrationModal() {
        const form = document.getElementById('jmi-registration-form');
        const modal = document.getElementById('jmi-registration-modal');
        
        if (!form || !modal) return;
        
        // Handle form submission
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const firstName = formData.get('first_name');
            const email = formData.get('email');
            
            if (!firstName || !email) {
                alert('Please fill in all fields.');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
            
            // Send registration request
            fetch(ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'jmi_magic_register',
                    _ajax_nonce: ajaxNonce,
                    first_name: firstName,
                    email: email,
                    jmi_uuid: peerUuid
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Registration successful:', data.data);
                    
                    // Hide modal
                    hidePeerRegistrationModal();
                    
                    // Show success message briefly
                    alert(data.data.message);
                    
                    // Reload page to show logged in state
                    window.location.reload();
                } else {
                    console.error('Registration failed:', data.data);
                    alert(data.data || 'Registration failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                alert('Network error. Please try again.');
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            });
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hidePeerRegistrationModal();
            }
        });
        
        // ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                hidePeerRegistrationModal();
            }
        });
    }
    
    // Make functions global for onclick handlers
    window.showPeerRegistrationModal = showPeerRegistrationModal;
    window.hidePeerRegistrationModal = hidePeerRegistrationModal;
    
    // Initialize when DOM is ready
    console.log('DEBUG: Document ready state:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('DEBUG: Adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('DEBUG: Document already ready, calling init immediately');
        init();
    }
})();
