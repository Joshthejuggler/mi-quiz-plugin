(function() {
    console.log('Johari × MI Quiz JS loaded - Version 0.1.0');
    
    console.log('Raw jmi_quiz_data:', jmi_quiz_data);
    
    const { currentUser, ajaxUrl, ajaxNonce, data } = jmi_quiz_data;
    const { adjective_map, domain_colors, quadrant_colors, all_adjectives } = data;
    
    // Check if we have user data OR if WordPress session exists
    const isLoggedIn = !!currentUser || document.body.classList.contains('logged-in');
    
    // Debug logging for login state detection
    console.log('Login state detection:', {
        hasCurrentUser: !!currentUser,
        hasLoggedInClass: document.body.classList.contains('logged-in'),
        finalIsLoggedIn: isLoggedIn,
        bodyClasses: document.body.className
    });

    const $id = (s) => document.getElementById(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const selfContainer = $id('jmi-self');
    const shareContainer = $id('jmi-share');
    const resultsContainer = $id('jmi-results');

    let selectedAdjectives = [];
    let isAuthorMode = true; // true = self-assessment, false = peer assessment
    let shareUuid = null;
    let peerUuid = null;

    // State management
    let appState = 'initial'; // 'initial', 'self-assessment', 'awaiting-peers', 'results', 'peer-assessment'

    // Check login status via AJAX
    function checkLoginStatus() {
        console.log('Checking login status...');
        console.log('AJAX URL:', ajaxUrl);
        console.log('AJAX Nonce:', ajaxNonce);
        
        const requestData = {
            action: 'jmi_get_user_data',
            nonce: ajaxNonce
        };
        console.log('Request data:', requestData);
        
        fetch(ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Login status response:', data);
            if (data.success && data.data && data.data.currentUser) {
                // Update the global data with fresh user information
                jmi_quiz_data.currentUser = data.data.currentUser;
                console.log('Updated currentUser:', data.data.currentUser);
                // Re-initialize the app with the fresh data
                window.location.reload();
            } else if (data.success && data.data && data.data.isLoggedIn) {
                // User is logged in but currentUser might be empty, still reload
                console.log('User is logged in, reloading page...');
                window.location.reload();
            } else {
                console.log('User is not logged in or no data returned');
            }
        })
        .catch(error => {
            console.error('Error checking login status:', error);
        });
    }

    // Make checkLoginStatus available globally for the debug button
    window.checkLoginStatus = checkLoginStatus;

    // Initialize app
    function init() {
        // Check if we're in peer assessment mode
        const urlParams = new URLSearchParams(window.location.search);
        peerUuid = urlParams.get('jmi');
        
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
            isAuthorMode = false;
            appState = 'peer-assessment';
            renderPeerAssessment();
        } else if (currentUser && currentUser.existingState) {
            // User has an existing assessment
            shareUuid = currentUser.selfUuid;
            
            if (currentUser.existingState === 'results-ready' && currentUser.johari) {
                appState = 'results';
                renderResults(currentUser.johari);
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
            
            selfContainer.innerHTML = `
                <div class="jmi-section">
                    <h3>Login Required</h3>
                    <p>You must create an account or log in to provide peer feedback.</p>
                    <div class="jmi-login-actions">
                        <a href="${loginUrl}" class="mi-quiz-button mi-quiz-button-primary">Login</a>
                        <a href="${registerUrl}" class="mi-quiz-button mi-quiz-button-secondary">Sign Up</a>
                    </div>
                    <div class="jmi-debug" style="margin-top: 1em; font-size: 0.8em; color: #666;">
                        <details>
                            <summary>Debug Info</summary>
                            <p>Current URL: ${currentUrl}</p>
                            <p>Login URL: ${loginUrl}</p>
                            <p>JMI UUID: ${peerUuid}</p>
                            <p>Is Logged In: ${isLoggedIn}</p>
                            <p>Current User: ${JSON.stringify(currentUser)}</p>
                        </details>
                        <p style="margin-top: 1em;"><strong>Note:</strong> If you just logged in and still see this page, try refreshing the page.</p>
                        <button onclick="window.location.reload()" class="mi-quiz-button mi-quiz-button-secondary" style="margin-top: 0.5em;">Refresh Page</button>
                        <button onclick="checkLoginStatus()" class="mi-quiz-button mi-quiz-button-secondary" style="margin-top: 0.5em; margin-left: 0.5em;">Check Login Status</button>
                    </div>
                </div>
            `;
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
                    <button id="jmi-check-progress" class="mi-quiz-button mi-quiz-button-primary">Check Progress</button>
                </div>
                
                <div class="jmi-progress-info">
                    <p><strong>Next:</strong> Once at least 2 peers complete their assessment, your Johari Window results will be available.</p>
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

        // Check progress button
        $id('jmi-check-progress').addEventListener('click', checkProgress);

        // Email sharing
        $id('jmi-email-share').addEventListener('click', () => {
            const subject = encodeURIComponent('Help me with my Johari Window assessment');
            const body = encodeURIComponent(`Hi!\n\nI'm doing a Johari Window assessment and would value your perspective. Please click this link and select adjectives that describe me:\n\n${shareUrl}\n\nIt only takes 2-3 minutes. Thanks!`);
            window.open(`mailto:?subject=${subject}&body=${body}`);
        });

        // Auto-check progress every 30 seconds
        const progressInterval = setInterval(() => {
            if (appState === 'awaiting-peers') {
                checkProgress(true); // silent check
            } else {
                clearInterval(progressInterval);
            }
        }, 30000);
    }

    // Check progress and see if results are ready
    function checkProgress(silent = false) {
        const body = new URLSearchParams({
            action: 'miq_jmi_generate_results',
            _ajax_nonce: ajaxNonce,
            uuid: shareUuid || peerUuid
        });

        if (!silent) {
            const btn = $id('jmi-check-progress');
            btn.textContent = 'Checking...';
            btn.disabled = true;
        }

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        })
        .then(r => r.json())
        .then(response => {
            if (response.success) {
                appState = 'results';
                renderResults(response.data);
            } else {
                if (!silent) {
                    const message = response.data || 'Not enough peer feedback yet';
                    alert(message);
                }
            }
        })
        .catch(err => {
            console.error('Progress check error:', err);
            if (!silent) alert('Could not check progress. Please try again.');
        })
        .finally(() => {
            if (!silent) {
                const btn = $id('jmi-check-progress');
                btn.textContent = 'Check Progress';
                btn.disabled = false;
            }
        });
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
                
                <div class="jmi-johari-grid">
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
                    
                    <div class="jmi-quadrant jmi-unknown" style="background-color: ${quadrant_colors.unknown}20; border-color: ${quadrant_colors.unknown};">
                        <h4>❓ Unknown (Unknown to Both)</h4>
                        <div class="jmi-adjective-list">${renderAdjectiveList(unknown || [], 'unknown')}</div>
                    </div>
                </div>
                
                <div class="jmi-domain-summary">
                    <h4>MI Domain Breakdown</h4>
                    ${renderDomainSummary(domain_summary || {})}
                </div>
                
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

    // Render MI domain summary
    function renderDomainSummary(summary) {
        let html = '<div class="jmi-domain-grid">';
        
        Object.entries(adjective_map).forEach(([domain, _]) => {
            const domainData = summary[domain] || { open: 0, blind: 0, hidden: 0, unknown: 0 };
            const color = domain_colors[domain] || '#6b7280';
            const total = domainData.open + domainData.blind + domainData.hidden;
            
            html += `
                <div class="jmi-domain-card" style="border-left-color: ${color};">
                    <h5>${domain}</h5>
                    <div class="jmi-domain-counts">
                        <span class="jmi-count jmi-open">Open: ${domainData.open}</span>
                        <span class="jmi-count jmi-blind">Blind: ${domainData.blind}</span>
                        <span class="jmi-count jmi-hidden">Hidden: ${domainData.hidden}</span>
                    </div>
                    <div class="jmi-domain-total">Total: ${total}</div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
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

    // Check current login status via AJAX
    window.checkLoginStatus = function() {
        console.log('Checking login status via AJAX...');
        
        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'miq_jmi_check_login',
                _ajax_nonce: ajaxNonce
            })
        })
        .then(r => r.json())
        .then(response => {
            console.log('Login status response:', response);
            if (response.success && response.data.logged_in) {
                alert('You are logged in! Reloading page...');
                window.location.reload();
            } else {
                alert('Still not logged in. Try logging in manually: ' + window.location.origin + '/wp-admin/');
            }
        })
        .catch(err => {
            console.error('Login check error:', err);
            alert('Could not check login status.');
        });
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
