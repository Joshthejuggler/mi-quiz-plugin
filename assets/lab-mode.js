/**
 * AI Coach Lab Mode Frontend
 * Handles the progressive workflow: Import → Qualify → Generate → Execute → Reflect → Recalibrate
 */

(function($) {
    'use strict';

    // Lab Mode main application
    window.LabModeApp = {
        currentStep: 'landing',
        profileData: null,
        qualifiers: null,
        experiments: [],
        
        // Initialize the application
        init: function() {
            this.bindEvents();
            this.loadLandingView();
            // Check admin status after DOM is ready
            setTimeout(() => {
                this.checkAdminStatus();
            }, 100);
            window.LabModeAppInitialized = true;
        },
        
        // Bind UI events
        bindEvents: function() {
            $(document).on('click', '.lab-start-btn', this.startProfileInputs.bind(this));
            $(document).on('click', '.lab-view-history-btn', this.showHistory.bind(this));
            $(document).on('click', '.lab-generate-experiments-btn', this.generateExperiments.bind(this));
            $(document).on('click', '.lab-start-experiment-btn', this.startExperiment.bind(this));
            $(document).on('click', '.lab-reflect-btn', this.showReflectionForm.bind(this));
            $(document).on('click', '.lab-regenerate-ai-btn', this.regenerateAiVariant.bind(this));
            $(document).on('submit', '.lab-qualifiers-form', this.saveQualifiers.bind(this));
            $(document).on('submit', '.lab-reflection-form', this.submitReflection.bind(this));
            $(document).on('click', '.quick-select-btn', this.handleQuickSelect.bind(this));
        },
        
        // Show loading spinner
        showLoading: function(message) {
            $('#lab-mode-app').html(`
                <div class="lab-mode-loading">
                    <p>${message || 'Loading...'}</p>
                    <div class="loading-spinner"></div>
                </div>
            `);
        },
        
        // Show error message
        showError: function(message) {
            $('#lab-mode-app').html(`
                <div class="lab-mode-error">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="lab-retry-btn" onclick="LabModeApp.init()">Try Again</button>
                </div>
            `);
        },
        
        // Check if current user is admin and show admin controls
        checkAdminStatus: function() {
            console.log('Checking admin status...', {
                bodyClasses: document.body.classList.toString(),
                url: window.location.href,
                labMode: typeof labMode !== 'undefined' ? labMode : 'undefined',
                isAdmin: labMode && labMode.isAdmin
            });
            
            // Check if admin controls should be shown (look for admin indicators)
            // WordPress admins often have body class 'logged-in' and other indicators
            const isAdmin = document.body.classList.contains('wp-admin') || 
                          window.location.href.includes('wp-admin') ||
                          (labMode && labMode.isAdmin === true) ||
                          this.detectAdminCapabilities();
            
            console.log('Admin status result:', isAdmin);
            
            if (isAdmin) {
                console.log('Admin detected, showing model selector');
                this.showAdminControls();
            } else {
                console.log('Non-admin user, hiding admin controls');
            }
        },
        
        // Detect admin capabilities (fallback method)
        detectAdminCapabilities: function() {
            // Check for common WordPress admin indicators
            return document.querySelector('#wpadminbar') !== null ||
                   document.body.classList.contains('admin-bar') ||
                   document.body.classList.contains('wp-admin');
        },
        
        // Show admin controls
        showAdminControls: function() {
            console.log('Showing admin controls...');
            const adminControls = document.getElementById('lab-admin-controls');
            console.log('Admin controls element:', adminControls);
            
            if (adminControls) {
                adminControls.style.display = 'block';
                console.log('Admin controls made visible');
                
                // Set default model selection from backend
                const modelSelect = document.getElementById('lab-model-select');
                console.log('Model select element:', modelSelect);
                if (modelSelect && labMode && labMode.defaultModel) {
                    modelSelect.value = labMode.defaultModel;
                    console.log('Set default model to:', labMode.defaultModel);
                }
            } else {
                console.error('Admin controls element not found!');
            }
        },
        
        // Get selected GPT model (for admin users)
        getSelectedModel: function() {
            const modelSelect = document.getElementById('lab-model-select');
            return modelSelect ? modelSelect.value : 'gpt-4o-mini';
        },
        
        // Load the landing view
        loadLandingView: function() {
            const html = `
                <div class="lab-mode-landing">
                    <div class="lab-mode-hero">
                        <div class="lab-hero-icon">🧪</div>
                        <h2>Lab Mode</h2>
                        <div class="lab-beta-badge">Beta Testing</div>
                    </div>
                    
                    <div class="lab-intro-content">
                        <p class="lab-intro-main">Create personalized experiments based on your unique strengths, curiosities, and growth areas.</p>
                        
                        <div class="lab-features">
                            <div class="lab-feature">
                                <div class="lab-feature-icon">🎯</div>
                                <div class="lab-feature-text">
                                    <strong>Tailored to You</strong><br>
                                    <span>Based on your assessment results</span>
                                </div>
                            </div>
                            <div class="lab-feature">
                                <div class="lab-feature-icon">⏱️</div>
                                <div class="lab-feature-text">
                                    <strong>Quick & Focused</strong><br>
                                    <span>Designed for 1-week experiments</span>
                                </div>
                            </div>
                            <div class="lab-feature">
                                <div class="lab-feature-icon">🔄</div>
                                <div class="lab-feature-text">
                                    <strong>Iterative Learning</strong><br>
                                    <span>Refine based on your feedback</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="lab-testing-notice">
                            <div class="lab-notice-icon">⚠️</div>
                            <div class="lab-notice-content">
                                <strong>Currently in Beta Testing</strong>
                                <p>Lab Mode is experimental and may have rough edges. For full functionality, please use the <strong>AI Coach</strong> tab instead.</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Admin Model Selector (only shown to admins) -->
                    <div class="lab-admin-controls" id="lab-admin-controls" style="display: none;">
                        <div class="lab-admin-section">
                            <div class="lab-admin-header">
                                <span class="lab-admin-icon">⚙️</span>
                                <div class="lab-admin-title">Admin Controls</div>
                            </div>
                            <div class="lab-model-selector">
                                <label for="lab-model-select" class="lab-model-label">GPT Model:</label>
                                <select id="lab-model-select" class="lab-model-select">
                                    <option value="gpt-4o-mini">GPT-4o mini (faster, cheaper)</option>
                                    <option value="gpt-4o">GPT-4o (more capable, expensive)</option>
                                </select>
                                <div class="lab-model-note">Override default model for this session</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="lab-landing-actions">
                        <button class="lab-start-btn lab-btn lab-btn-primary">Try Beta Version</button>
                        <button class="lab-view-history-btn lab-btn lab-btn-secondary">View Past Experiments</button>
                    </div>
                </div>
            `;
            $('#lab-mode-app').html(html);
            this.currentStep = 'landing';
            
            // Remove body class when not in form mode
            $('body').removeClass('lab-mode-active');
            
            // Check admin status after rendering landing view
            this.checkAdminStatus();
        },
        
        // Start the profile inputs workflow
        startProfileInputs: function(e) {
            e.preventDefault();
            this.showLoading('Loading your assessment data...');
            this.loadProfileData();
        },
        
        // Load user profile data from assessments
        loadProfileData: function() {
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_get_profile_data',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    if (response.success) {
                        this.profileData = response.data;
                        this.showProfileInputsForm();
                    } else {
                        this.showError(response.data || 'Failed to load profile data');
                    }
                },
                error: () => {
                    this.showError('Network error while loading profile data');
                }
            });
        },
        
        // Show the typeform-style profile inputs
        showProfileInputsForm: function() {
            const mi = this.profileData.mi_results || [];
            const cdt = this.profileData.cdt_results || [];
            
            // Get top 3 MI and lowest 2 CDT for qualifiers
            const topMI = mi.slice(0, 3);
            const bottomCDT = cdt.slice(-2);
            
            // Initialize typeform state
            this.initializeTypeform(topMI, bottomCDT);
        },
        
        // Initialize typeform-style interface
        initializeTypeform: function(topMI, bottomCDT, clearExisting = false) {
            // Try to restore previous state if available
            const savedState = this.loadTypeformState();
            
            if (!clearExisting && savedState && savedState.topMI && savedState.bottomCDT) {
                // Restore previous answers and saved progress, but ALWAYS start at welcome screen
                this.typeformState = {
                    currentQuestionIndex: 0, // Always start at welcome screen
                    answers: savedState.answers || {}, // Restore saved answers
                    topMI: topMI, // Update with current MI data in case it changed
                    bottomCDT: bottomCDT, // Update with current CDT data
                    questions: this.buildQuestionFlow(topMI, bottomCDT),
                    // Store the saved progress separately for the resume functionality
                    savedQuestionIndex: savedState.currentQuestionIndex || 0
                };
                console.log('Restored answers from previous session, starting at welcome screen');
                console.log('Saved progress was at question:', savedState.currentQuestionIndex);
            } else {
                // Create fresh state
                this.typeformState = {
                    currentQuestionIndex: 0,
                    answers: {},
                    topMI: topMI,
                    bottomCDT: bottomCDT,
                    questions: this.buildQuestionFlow(topMI, bottomCDT),
                    savedQuestionIndex: null
                };
                console.log('Initializing typeform with clean state:', this.typeformState);
            }
            
            this.renderTypeform();
        },
        
        // Save typeform state to localStorage
        saveTypeformState: function() {
            if (this.typeformState) {
                try {
                    const stateToSave = {
                        currentQuestionIndex: this.typeformState.currentQuestionIndex,
                        answers: this.typeformState.answers,
                        topMI: this.typeformState.topMI,
                        bottomCDT: this.typeformState.bottomCDT,
                        timestamp: Date.now()
                    };
                    localStorage.setItem('labModeTypeformState', JSON.stringify(stateToSave));
                    console.log('Saved typeform state to localStorage');
                } catch (error) {
                    console.error('Failed to save typeform state:', error);
                }
            }
        },
        
        // Load typeform state from localStorage
        loadTypeformState: function() {
            try {
                const savedState = localStorage.getItem('labModeTypeformState');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    
                    // Check if state is not too old (7 days)
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                    if (parsedState.timestamp && (Date.now() - parsedState.timestamp) < maxAge) {
                        console.log('Loaded typeform state from localStorage');
                        return parsedState;
                    } else {
                        console.log('Saved state is too old, ignoring');
                        this.clearTypeformState();
                    }
                }
            } catch (error) {
                console.error('Failed to load typeform state:', error);
            }
            return null;
        },
        
        // Clear typeform state from localStorage
        clearTypeformState: function() {
            try {
                localStorage.removeItem('labModeTypeformState');
                console.log('Cleared typeform state from localStorage');
            } catch (error) {
                console.error('Failed to clear typeform state:', error);
            }
        },
        
        // Clear saved progress and restart with fresh state
        clearAndRestart: function() {
            // Clear saved state
            this.clearTypeformState();
            
            // Reinitialize with clean state
            const mi = this.profileData.mi_results || [];
            const cdt = this.profileData.cdt_results || [];
            const topMI = mi.slice(0, 3);
            const bottomCDT = cdt.slice(-2);
            
            this.initializeTypeform(topMI, bottomCDT, true); // Force clear existing
        },
        
        // Resume from saved progress (go to the saved question index)
        resumeFromSavedProgress: function() {
            if (this.typeformState.savedQuestionIndex && this.typeformState.savedQuestionIndex > 0) {
                // Safety check - don't go past the last question
                const maxIndex = this.typeformState.questions.length - 1;
                const targetIndex = Math.min(this.typeformState.savedQuestionIndex, maxIndex);
                
                console.log('Resuming from saved progress at question:', targetIndex);
                this.typeformState.currentQuestionIndex = targetIndex;
                this.renderTypeform();
            } else {
                // No saved progress, just go to first real question
                this.typeformState.currentQuestionIndex = 1;
                this.renderTypeform();
            }
        },
        
        // Build the question flow based on user data
        buildQuestionFlow: function(topMI, bottomCDT) {
            const questions = [];
            
            // Welcome screen
            questions.push({
                id: 'welcome',
                type: 'welcome',
                title: '🧪 Lab Mode',
                subtitle: 'Let\'s create personalized experiments based on your strengths and curiosities. This will take about 3 minutes.',
                buttonText: 'Start Questions'
            });
            
            // MI questions - What you enjoy
            topMI.forEach((mi, index) => {
                questions.push({
                    id: `mi_enjoy_${mi.key}`,
                    type: 'textarea',
                    title: `What do you enjoy about ${mi.label}?`,
                    subtitle: `You scored high on ${mi.label}. Tell us what aspects you find most enjoyable.`,
                    placeholder: 'Type your thoughts here...',
                    examples: this.getMIExamples(mi.key, 'enjoy'),
                    required: false
                });
            });
            
            // MI questions - What you currently do
            topMI.forEach((mi, index) => {
                questions.push({
                    id: `mi_doing_${mi.key}`,
                    type: 'textarea', 
                    title: `How do you currently use ${mi.label}?`,
                    subtitle: `What habits, activities, or projects involve your ${mi.label} strength?`,
                    placeholder: 'Describe your current activities...',
                    examples: this.getMIExamples(mi.key, 'doing'),
                    required: false
                });
            });
            
            // CDT growth challenges
            bottomCDT.forEach((cdt, index) => {
                questions.push({
                    id: `cdt_challenge_${cdt.key}`,
                    type: 'multiple_choice',
                    title: `${cdt.label}: Choose your growth focus`,
                    subtitle: `This was your lowest CDT score. Which challenge resonates most?`,
                    options: this.getCDTChallengeOptions(cdt.key),
                    required: true
                });
            });
            
            // Curiosity areas
            questions.push({
                id: 'curiosity_areas',
                type: 'multiple_input',
                title: 'What are you curious about right now?',
                subtitle: 'Share 2-3 things you\'d love to learn or explore. These help us craft relevant experiments.',
                inputs: [
                    { id: 'curiosity_1', placeholder: 'First curiosity area...', required: true },
                    { id: 'curiosity_2', placeholder: 'Second curiosity area...', required: true },
                    { id: 'curiosity_3', placeholder: 'Third curiosity area...', required: false }
                ],
                examples: this.getCuriosityExamples()
            });
            
            // Role models
            questions.push({
                id: 'role_models',
                type: 'multiple_input',
                title: 'Who do you admire or learn from?',
                subtitle: 'Role models, creators, or thought leaders who inspire you (optional but helpful).',
                inputs: [
                    { id: 'role_model_1', placeholder: 'Name or @handle', required: false },
                    { id: 'role_model_2', placeholder: 'Another name or @handle', required: false },
                    { id: 'role_model_3', placeholder: 'Third name or @handle', required: false }
                ],
                examples: this.getRoleModelExamples()
            });
            
            // Constraints - Risk tolerance
            questions.push({
                id: 'risk_tolerance',
                type: 'slider',
                title: 'How do you approach new challenges?',
                subtitle: 'This helps us balance comfort zone stretching with achievable goals.',
                min: 0,
                max: 100,
                value: 50,
                leftLabel: 'Cautious',
                rightLabel: 'Bold',
                required: true
            });
            
            // Constraints - Budget
            questions.push({
                id: 'budget',
                type: 'slider',
                title: 'What\'s your experiment budget?',
                subtitle: 'Most experiments cost little to nothing, but some might involve books, courses, or tools.',
                min: 0,
                max: 200,
                value: 50,
                leftLabel: '$0',
                rightLabel: '$200+',
                valuePrefix: '$',
                required: true
            });
            
            // Constraints - Time
            questions.push({
                id: 'time_per_week',
                type: 'slider',
                title: 'How much time can you commit weekly?',
                subtitle: 'Be realistic - consistency matters more than duration.',
                min: 1,
                max: 10,
                value: 3,
                leftLabel: '1h',
                rightLabel: '10h+',
                valueSuffix: 'h',
                required: true
            });
            
            // Constraints - Solo vs Group
            questions.push({
                id: 'solo_group',
                type: 'slider',
                title: 'Do you prefer working solo or with others?',
                subtitle: 'This affects whether we suggest individual activities or group/community-based experiments.',
                min: 0,
                max: 100,
                value: 50,
                leftLabel: 'Solo',
                rightLabel: 'Group',
                required: true
            });
            
            return questions;
        },
        
        // Render the typeform interface
        renderTypeform: function() {
            const currentQuestion = this.typeformState.questions[this.typeformState.currentQuestionIndex];
            const isLastQuestion = this.typeformState.currentQuestionIndex === this.typeformState.questions.length - 1;
            const progressPercent = (this.typeformState.currentQuestionIndex / (this.typeformState.questions.length - 1)) * 100;
            
            let questionHtml = '';
            
            // Render different question types
            switch(currentQuestion.type) {
                case 'welcome':
                    questionHtml = this.renderWelcomeScreen(currentQuestion);
                    break;
                case 'textarea':
                    questionHtml = this.renderTextareaQuestion(currentQuestion);
                    break;
                case 'multiple_choice':
                    questionHtml = this.renderMultipleChoiceQuestion(currentQuestion);
                    break;
                case 'multiple_input':
                    questionHtml = this.renderMultipleInputQuestion(currentQuestion);
                    break;
                case 'slider':
                    questionHtml = this.renderSliderQuestion(currentQuestion);
                    break;
            }
            
            const html = `
                <div class="lab-typeform-container">
                    <div class="lab-typeform-content">
                        <div class="lab-question-screen active">
                            ${questionHtml}
                        </div>
                    </div>
                    
                    <div class="lab-typeform-footer">
                        <div class="lab-typeform-nav">
                            <div class="lab-nav-left">
                                <button class="lab-nav-back" ${this.typeformState.currentQuestionIndex === 0 ? 'disabled' : ''} data-action="back">
                                    ← Back
                                </button>
                            </div>
                            
                            <div class="lab-progress-container">
                                <div class="lab-progress-bar">
                                    <div class="lab-progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                                <div class="lab-progress-text">${this.typeformState.currentQuestionIndex + 1} of ${this.typeformState.questions.length}</div>
                            </div>
                            
                            <button class="lab-nav-forward" id="next-btn" data-action="next" ${currentQuestion.type === 'welcome' ? '' : 'disabled'}>
                                ${isLastQuestion ? 'Generate Experiments' : (currentQuestion.type === 'welcome' ? 'Start' : 'Next →')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            console.log('Rendering typeform, question index:', this.typeformState.currentQuestionIndex);
            console.log('HTML includes footer:', html.includes('lab-typeform-footer'));
            $('#lab-mode-app').html(html);
            this.currentStep = 'typeform';
            
            // Verify footer exists after render
            setTimeout(() => {
                const footer = document.querySelector('.lab-typeform-footer');
                console.log('Footer element after render:', footer);
                if (footer) {
                    console.log('Footer computed styles:', window.getComputedStyle(footer));
                }
            }, 100);
            
            // Initialize current question
            this.initializeCurrentQuestion(currentQuestion);
            
            // Setup keyboard navigation
            this.setupTypeformKeyboardNavigation();
            
            // Setup event delegation for interactions
            this.setupEventDelegation();
            
            // Make sure global functions are available for simple handlers
            window.updateSliderValue = (questionId, value, prefix, suffix) => this.updateSliderValue(questionId, value, prefix, suffix);
            window.updateAnswer = (questionId, value) => this.updateAnswer(questionId, value);
        },
        
        // Render welcome screen
        renderWelcomeScreen: function(question) {
            const hasExistingAnswers = this.typeformState.answers && Object.keys(this.typeformState.answers).length > 0;
            const savedQuestionIndex = this.typeformState.savedQuestionIndex;
            
            let progressMessage = '';
            let clearButton = '';
            let resumeButton = '';
            
            if (hasExistingAnswers && savedQuestionIndex > 0) {
                const answeredCount = Object.keys(this.typeformState.answers).length;
                const totalQuestions = this.typeformState.questions.length - 1; // Exclude welcome screen
                
                progressMessage = `
                    <div class="saved-progress-indicator">
                        <div class="progress-icon">💾</div>
                        <div class="progress-info">
                            <p><strong>Previous answers restored!</strong></p>
                            <p class="progress-detail">${answeredCount} answers saved • You were on question ${savedQuestionIndex} of ${totalQuestions}</p>
                        </div>
                    </div>
                `;
                
                clearButton = `
                    <button class="lab-btn lab-btn-tertiary clear-progress-btn" onclick="LabModeApp.clearAndRestart()">
                        🗑️ Start Fresh
                    </button>
                `;
                
                resumeButton = `
                    <button class="lab-btn lab-btn-secondary resume-progress-btn" onclick="LabModeApp.resumeFromSavedProgress()">
                        ▶️ Continue Where I Left Off
                    </button>
                `;
            }
            
            return `
                <div class="lab-welcome-screen">
                    <h1>${question.title}</h1>
                    <p>${question.subtitle}</p>
                    ${progressMessage}
                    <div class="welcome-actions">
                        ${resumeButton}
                        ${clearButton}
                    </div>
                </div>
            `;
        },
        
        // Render textarea question
        renderTextareaQuestion: function(question) {
            const currentValue = this.typeformState.answers[question.id] || '';
            console.log('Rendering textarea question:', question.id, 'Current value:', currentValue);
            
            const exampleButtons = question.examples ? question.examples.slice(0, 6).map((example, index) => 
                `<button type="button" class="lab-quick-select-btn" data-question-id="${question.id}" data-example="${example}">${example}</button>`
            ).join('') : '';
            
            return `
                <div>
                    <h2 class="lab-question-title">${question.title}</h2>
                    <p class="lab-question-subtitle">${question.subtitle}</p>
                    
                    ${exampleButtons ? `<div class="lab-quick-select-grid">${exampleButtons}</div>` : ''}
                    
                    <textarea class="lab-typeform-input lab-typeform-textarea" 
                              id="${question.id}" 
                              placeholder="${question.placeholder}"
                              oninput="updateAnswer(this.id, this.value)"></textarea>
                </div>
            `;
        },
        
        // Render multiple choice question
        renderMultipleChoiceQuestion: function(question) {
            const currentValue = this.typeformState.answers[question.id] || '';
            
            return `
                <div>
                    <h2 class="lab-question-title">${question.title}</h2>
                    <p class="lab-question-subtitle">${question.subtitle}</p>
                    
                    <div class="lab-choice-options">
                        ${question.options.map((option, index) => `
                            <div class="lab-choice-option ${currentValue === option ? 'selected' : ''}" 
                                 data-question-id="${question.id}" data-option="${option}">
                                ${option}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        
        // Render multiple input question
        renderMultipleInputQuestion: function(question) {
            const exampleButtons = question.examples ? question.examples.slice(0, 9).map(example => 
                `<button type="button" class="lab-quick-select-btn" data-input-ids="${question.inputs.map(i => i.id).join(',')}" data-example="${example}">${example}</button>`
            ).join('') : '';
            
            return `
                <div>
                    <h2 class="lab-question-title">${question.title}</h2>
                    <p class="lab-question-subtitle">${question.subtitle}</p>
                    
                    ${exampleButtons ? `<div class="lab-quick-select-grid">${exampleButtons}</div>` : ''}
                    
                    <div class="lab-input-group">
                        ${question.inputs.map(input => {
                            const currentValue = this.typeformState.answers[input.id] || '';
                            return `
                                <input type="text" 
                                       class="lab-typeform-input" 
                                       id="${input.id}" 
                                       placeholder="${input.placeholder}"
                                       value="${currentValue}"
                                       oninput="updateAnswer(this.id, this.value)"
                                       ${input.required ? 'required' : ''}>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        },
        
        // Render slider question
        renderSliderQuestion: function(question) {
            const currentValue = this.typeformState.answers[question.id] || question.value;
            const displayValue = (question.valuePrefix || '') + currentValue + (question.valueSuffix || '');
            
            return `
                <div>
                    <h2 class="lab-question-title">${question.title}</h2>
                    <p class="lab-question-subtitle">${question.subtitle}</p>
                    
                    <div class="lab-typeform-slider-container">
                        <div class="lab-slider-value" id="slider-display-${question.id}">${displayValue}</div>
                        <input type="range" 
                               class="lab-typeform-slider" 
                               id="${question.id}"
                               min="${question.min}" 
                               max="${question.max}" 
                               value="${currentValue}"
                               oninput="updateSliderValue(this.id, this.value, '${question.valuePrefix || ''}', '${question.valueSuffix || ''}')">
                        <div class="lab-slider-labels">
                            <span>${question.leftLabel}</span>
                            <span>${question.rightLabel}</span>
                        </div>
                    </div>
                </div>
            `;
        },
        
        // Setup event delegation for all button interactions
        setupEventDelegation: function() {
            const self = this;
            
            // Remove any existing event listeners to avoid duplicates
            $(document).off('click.typeform');
            
            // Add event delegation for all typeform interactions
            $(document).on('click.typeform', '.lab-quick-select-btn', function(e) {
                e.preventDefault();
                const questionId = $(this).data('question-id');
                const example = $(this).data('example');
                const inputIds = $(this).data('input-ids');
                
                if (questionId && example) {
                    // Textarea example button
                    self.addExampleToTextarea(questionId, example);
                } else if (inputIds && example) {
                    // Multiple input example button
                    self.addExampleToFirstEmpty(inputIds.split(','), example);
                }
            });
            
            // Navigation buttons
            $(document).on('click.typeform', '[data-action="next"]', function(e) {
                e.preventDefault();
                if (!$(this).prop('disabled')) {
                    self.goToNextQuestion();
                }
            });
            
            $(document).on('click.typeform', '[data-action="back"]', function(e) {
                e.preventDefault();
                if (!$(this).prop('disabled')) {
                    self.goToPreviousQuestion();
                }
            });
            
            // Multiple choice options
            $(document).on('click.typeform', '.lab-choice-option', function(e) {
                e.preventDefault();
                const questionId = $(this).data('question-id');
                const option = $(this).data('option');
                if (questionId && option) {
                    self.selectChoice(questionId, option);
                }
            });
        },
        
        // Initialize current question (setup event listeners, etc.)
        initializeCurrentQuestion: function(question) {
            // Set values safely after DOM is ready
            setTimeout(() => {
                if (question.type === 'textarea') {
                    const textarea = document.getElementById(question.id);
                    if (textarea) {
                        const currentValue = this.typeformState.answers[question.id] || '';
                        console.log('Setting textarea value for', question.id, ':', currentValue);
                        textarea.value = currentValue;
                    }
                } else if (question.type === 'multiple_input') {
                    // Restore multiple input values
                    question.inputs.forEach(input => {
                        const inputElement = document.getElementById(input.id);
                        if (inputElement) {
                            const currentValue = this.typeformState.answers[input.id] || '';
                            console.log('Setting input value for', input.id, ':', currentValue);
                            inputElement.value = currentValue;
                        }
                    });
                } else if (question.type === 'slider') {
                    // Initialize slider with default value if no saved answer
                    const sliderElement = document.getElementById(question.id);
                    const sliderDisplay = document.getElementById(`slider-display-${question.id}`);
                    if (sliderElement && sliderDisplay) {
                        let currentValue = this.typeformState.answers[question.id];
                        
                        // If no saved answer, use the default value from the question
                        if (currentValue === undefined) {
                            currentValue = question.value || 50; // Use question's default value
                            this.typeformState.answers[question.id] = currentValue; // Save default to answers
                            console.log('Initializing slider with default value for', question.id, ':', currentValue);
                        } else {
                            console.log('Setting slider value for', question.id, ':', currentValue);
                        }
                        
                        sliderElement.value = currentValue;
                        const prefix = question.valuePrefix || '';
                        const suffix = question.valueSuffix || '';
                        sliderDisplay.textContent = prefix + currentValue + suffix;
                    }
                } else if (question.type === 'multiple_choice') {
                    // Restore multiple choice selection
                    const currentValue = this.typeformState.answers[question.id];
                    if (currentValue) {
                        const selectedOption = document.querySelector(`[data-question-id="${question.id}"][data-option="${currentValue}"]`);
                        if (selectedOption) {
                            console.log('Setting multiple choice selection for', question.id, ':', currentValue);
                            selectedOption.classList.add('selected');
                        }
                    }
                }
                
                // Auto-focus on first input if it exists
                const firstInput = document.querySelector('.lab-typeform-input');
                if (firstInput && question.type !== 'welcome') {
                    firstInput.focus();
                }
            }, 100);
            
            // Update next button state
            this.updateNextButton();
        },
        
        // Navigation methods
        goToNextQuestion: function() {
            const currentQuestion = this.typeformState.questions[this.typeformState.currentQuestionIndex];
            
            // Special handling for welcome screen
            if (currentQuestion.type === 'welcome') {
                this.typeformState.currentQuestionIndex++;
                this.renderTypeform();
                return;
            }
            
            // Validate required fields
            if (!this.validateCurrentQuestion()) {
                return;
            }
            
            // Check if this is the last question
            if (this.typeformState.currentQuestionIndex === this.typeformState.questions.length - 1) {
                // Validate all required questions before submitting
                const isFormComplete = this.validateAllQuestions();
                if (isFormComplete) {
                    this.submitTypeformData();
                } else {
                    console.warn('Form validation failed - some required questions not answered');
                    // Find first incomplete question and go there
                    const firstIncomplete = this.findFirstIncompleteQuestion();
                    if (firstIncomplete !== -1) {
                        this.typeformState.currentQuestionIndex = firstIncomplete;
                        this.renderTypeform();
                        alert('Please complete all required questions before generating experiments.');
                    }
                }
                return;
            }
            
            // Move to next question
            this.typeformState.currentQuestionIndex++;
            this.saveTypeformState();
            this.renderTypeform();
        },
        
        goToPreviousQuestion: function() {
            if (this.typeformState.currentQuestionIndex > 0) {
                this.typeformState.currentQuestionIndex--;
                this.saveTypeformState();
                this.renderTypeform();
            }
        },
        
        // Update answer in state
        updateAnswer: function(questionId, value) {
            this.typeformState.answers[questionId] = value;
            this.updateNextButton();
            
            // Auto-save state when answers change
            this.saveTypeformState();
        },
        
        // Select choice for multiple choice questions
        selectChoice: function(questionId, value) {
            this.typeformState.answers[questionId] = value;
            
            // Update UI
            document.querySelectorAll('.lab-choice-option').forEach(option => {
                option.classList.remove('selected');
            });
            event.target.classList.add('selected');
            
            this.updateNextButton();
            
            // Save state after selection
            this.saveTypeformState();
        },
        
        // Update slider value
        updateSliderValue: function(questionId, value, prefix, suffix) {
            this.typeformState.answers[questionId] = parseInt(value);
            document.getElementById(`slider-display-${questionId}`).textContent = prefix + value + suffix;
            this.updateNextButton();
            
            // Save state after slider change
            this.saveTypeformState();
        },
        
        // Add example to textarea
        addExampleToTextarea: function(questionId, example) {
            console.log('Adding example to textarea:', questionId, example);
            const textarea = document.getElementById(questionId);
            if (!textarea) {
                console.error('Textarea not found:', questionId);
                return;
            }
            
            const currentValue = textarea.value;
            
            // Check if example already exists to avoid duplicates
            if (currentValue.includes(example)) {
                // Visual feedback that it's already added
                textarea.focus();
                return;
            }
            
            const newValue = currentValue ? currentValue + '\n' + example : example;
            textarea.value = newValue;
            this.updateAnswer(questionId, newValue);
            textarea.focus();
            
            // Visual feedback on the button
            const clickedButton = event.target;
            if (clickedButton) {
                clickedButton.classList.add('selected');
                setTimeout(() => {
                    clickedButton.classList.remove('selected');
                }, 500);
            }
        },
        
        // Add example to first empty input
        addExampleToFirstEmpty: function(inputIds, example) {
            console.log('Adding example to first empty input:', inputIds, example);
            // Handle both array and comma-separated string
            const ids = Array.isArray(inputIds) ? inputIds : inputIds.split(',');
            
            for (const inputId of ids) {
                const input = document.getElementById(inputId.trim());
                console.log('Checking input:', inputId.trim(), 'Element:', input, 'Current value:', input ? input.value : 'not found');
                if (input && !input.value.trim()) {
                    input.value = example;
                    this.updateAnswer(inputId.trim(), example);
                    input.focus();
                    
                    // Visual feedback on the button
                    const clickedButton = event.target;
                    if (clickedButton) {
                        clickedButton.classList.add('selected');
                        setTimeout(() => {
                            clickedButton.classList.remove('selected');
                        }, 500);
                    }
                    break;
                }
            }
        },
        
        // Validate current question
        validateCurrentQuestion: function() {
            const currentQuestion = this.typeformState.questions[this.typeformState.currentQuestionIndex];
            
            if (!currentQuestion.required && currentQuestion.type !== 'multiple_input') {
                return true;
            }
            
            switch (currentQuestion.type) {
                case 'textarea':
                    const textValue = this.typeformState.answers[currentQuestion.id];
                    return !currentQuestion.required || (textValue && textValue.trim().length > 0);
                    
                case 'multiple_choice':
                    const choiceValue = this.typeformState.answers[currentQuestion.id];
                    return !currentQuestion.required || (choiceValue && choiceValue.length > 0);
                    
                case 'multiple_input':
                    const requiredInputs = currentQuestion.inputs.filter(input => input.required);
                    return requiredInputs.every(input => {
                        const value = this.typeformState.answers[input.id];
                        return value && value.trim().length > 0;
                    });
                    
                case 'slider':
                    // Sliders always have a value (either saved or default), so always valid
                    return true;
                    
                default:
                    return true;
            }
        },
        
        // Update next button state
        updateNextButton: function() {
            const nextBtn = document.getElementById('next-btn');
            if (nextBtn) {
                const currentQuestion = this.typeformState.questions[this.typeformState.currentQuestionIndex];
                const isLastQuestion = this.typeformState.currentQuestionIndex === this.typeformState.questions.length - 1;
                
                if (isLastQuestion) {
                    // For last question, check if all required questions are complete
                    const isFormComplete = this.validateAllQuestions();
                    nextBtn.disabled = !isFormComplete;
                } else {
                    // For other questions, just check current question
                    const isValid = this.validateCurrentQuestion();
                    nextBtn.disabled = !isValid;
                }
            }
        },
        
        // Validate all questions in the form
        validateAllQuestions: function() {
            for (let i = 0; i < this.typeformState.questions.length; i++) {
                const question = this.typeformState.questions[i];
                if (question.type === 'welcome') continue; // Skip welcome screen
                
                if (question.required || question.type === 'multiple_input') {
                    const isValid = this.validateSpecificQuestion(question);
                    if (!isValid) {
                        console.log('Question validation failed:', question.id, question.title);
                        return false;
                    }
                }
            }
            return true;
        },
        
        // Find first incomplete required question
        findFirstIncompleteQuestion: function() {
            for (let i = 0; i < this.typeformState.questions.length; i++) {
                const question = this.typeformState.questions[i];
                if (question.type === 'welcome') continue;
                
                if (question.required || question.type === 'multiple_input') {
                    const isValid = this.validateSpecificQuestion(question);
                    if (!isValid) {
                        return i;
                    }
                }
            }
            return -1;
        },
        
        // Validate a specific question by its object
        validateSpecificQuestion: function(question) {
            switch (question.type) {
                case 'textarea':
                    const textValue = this.typeformState.answers[question.id];
                    return !question.required || (textValue && textValue.trim().length > 0);
                    
                case 'multiple_choice':
                    const choiceValue = this.typeformState.answers[question.id];
                    return !question.required || (choiceValue && choiceValue.length > 0);
                    
                case 'multiple_input':
                    const requiredInputs = question.inputs.filter(input => input.required);
                    return requiredInputs.every(input => {
                        const value = this.typeformState.answers[input.id];
                        return value && value.trim().length > 0;
                    });
                    
                case 'slider':
                    // Sliders always have a value (either saved or default), so always valid
                    return true;
                    
                default:
                    return true;
            }
        },
        
        // Submit typeform data
        submitTypeformData: function() {
            // Transform answers back to the expected format for the existing system
            const formData = this.transformAnswersToFormData();
            
            // Call existing save functionality
            this.saveQualifiers(formData);
        },
        
        // Transform typeform answers to form data format
        transformAnswersToFormData: function() {
            const answers = this.typeformState.answers;
            const formData = new FormData();
            
            // Add all answers to form data
            Object.keys(answers).forEach(key => {
                if (answers[key] !== null && answers[key] !== undefined) {
                    formData.append(key, answers[key]);
                }
            });
            
            return formData;
        },
        
        // Add keyboard navigation for typeform
        setupTypeformKeyboardNavigation: function() {
            const self = this;
            
            $(document).off('keydown.typeform').on('keydown.typeform', function(e) {
                if (self.currentStep !== 'typeform') return;
                
                // Enter key - go to next question (if valid)
                if (e.key === 'Enter' && !e.shiftKey) {
                    const activeElement = document.activeElement;
                    // Don't interfere with textarea line breaks
                    if (activeElement && activeElement.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        const nextBtn = document.getElementById('next-btn');
                        if (nextBtn && !nextBtn.disabled) {
                            self.goToNextQuestion();
                        }
                    }
                }
                
                // Escape key - go to previous question
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.goToPreviousQuestion();
                }
                
                // Number keys for multiple choice (1-9)
                if (e.key >= '1' && e.key <= '9') {
                    const currentQuestion = self.typeformState.questions[self.typeformState.currentQuestionIndex];
                    if (currentQuestion.type === 'multiple_choice') {
                        const optionIndex = parseInt(e.key) - 1;
                        if (optionIndex < currentQuestion.options.length) {
                            e.preventDefault();
                            const option = currentQuestion.options[optionIndex];
                            self.selectChoice(currentQuestion.id, option);
                        }
                    }
                }
            });
        },
        
        // Save qualifiers (updated for typeform data)
        saveQualifiers: function(formData) {
            // Transform typeform answers into the expected qualifiers format
            const answers = this.typeformState.answers;
            const qualifiers = {
                mi_qualifiers: [],
                cdt_qualifiers: [],
                curiosity: {
                    curiosities: [],
                    roleModels: [],
                    constraints: {},
                    contextTags: []
                }
            };
            
            // Extract MI qualifiers
            this.typeformState.topMI.forEach(mi => {
                const enjoy = answers[`mi_enjoy_${mi.key}`] ? answers[`mi_enjoy_${mi.key}`].split('\n').filter(s => s.trim()) : [];
                const doing = answers[`mi_doing_${mi.key}`] ? answers[`mi_doing_${mi.key}`].split('\n').filter(s => s.trim()) : [];
                
                qualifiers.mi_qualifiers.push({
                    key: mi.key,
                    enjoy: enjoy,
                    doing: doing
                });
            });
            
            // Extract CDT qualifiers
            this.typeformState.bottomCDT.forEach(cdt => {
                const challenge = answers[`cdt_challenge_${cdt.key}`] || '';
                qualifiers.cdt_qualifiers.push({
                    key: cdt.key,
                    challenge: challenge,
                    label: cdt.label
                });
            });
            
            // Extract curiosity data
            qualifiers.curiosity.curiosities = [
                answers['curiosity_1'],
                answers['curiosity_2'],
                answers['curiosity_3']
            ].filter(c => c && c.trim());
            
            qualifiers.curiosity.roleModels = [
                answers['role_model_1'],
                answers['role_model_2'],
                answers['role_model_3']
            ].filter(r => r && r.trim());
            
            qualifiers.curiosity.constraints = {
                risk: answers['risk_tolerance'] || 50,
                budget: answers['budget'] || 50,
                timePerWeekHours: answers['time_per_week'] || 3,
                soloToGroup: answers['solo_group'] || 50
            };
            
            qualifiers.curiosity.contextTags = []; // Not used in typeform version
            
            this.qualifiers = qualifiers;
            
            // Save qualifiers and generate experiments
            this.showLoading('Saving your preferences...');
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_save_qualifiers',
                    nonce: labMode.nonce,
                    qualifiers: JSON.stringify(qualifiers)
                },
                success: (response) => {
                    console.log('Save qualifiers response:', response);
                    if (response.success) {
                        console.log('Qualifiers saved successfully, generating experiments...');
                        this.generateExperiments();
                    } else {
                        console.error('Failed to save qualifiers:', response);
                        this.showError('Failed to save qualifiers: ' + (response.data || 'Unknown error'));
                    }
                },
                error: (xhr, status, error) => {
                    console.error('Network error saving qualifiers:', xhr, status, error);
                    this.showError('Network error while saving qualifiers: ' + error);
                }
            });
        },
        
        // Clear validation errors
        clearValidationErrors: function() {
            $('.field-error').removeClass('field-error');
            $('.validation-message').remove();
            $('.validation-summary').remove();
            $('.cdt-challenge-options.field-error').removeClass('field-error');
        },
        
        // Highlight specific field with error
        highlightFieldError: function(fieldName) {
            const field = $(`[name="${fieldName}"]`);
            if (field.length) {
                field.addClass('field-error');
                // Scroll to first error if not visible
                if ($('.field-error').first().get(0) === field.get(0)) {
                    field.get(0).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        },
        
        // Show validation errors in a user-friendly way
        showValidationErrors: function(errors) {
            // Create error summary at the top of the form
            const errorSummaryHtml = `
                <div class="validation-summary lab-error-summary">
                    <h4>Please complete the following fields:</h4>
                    <ul>
                        ${errors.map(error => `<li>${error.message}</li>`).join('')}
                    </ul>
                    <p><em>Fields with errors are highlighted in red below.</em></p>
                </div>
            `;
            
            // Insert error summary at the top of the form
            $('.lab-qualifiers-form').prepend(errorSummaryHtml);
            
            // Scroll to the error summary
            $('.validation-summary').get(0).scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        
        // Handle quick-select button clicks
        handleQuickSelect: function(e) {
            e.preventDefault();
            const button = $(e.target);
            const example = button.text();
            const targetName = button.closest('.quick-select-buttons').data('target');
            const field = $(`textarea[name="${targetName}"], input[name="${targetName}"]`);
            
            // Get current content
            const currentContent = field.val().trim();
            
            // Handle different field types
            if (targetName === 'context_tags') {
                // For context tags, add as comma-separated values
                if (!currentContent.includes(example)) {
                    const newContent = currentContent ? 
                        currentContent + ', ' + example : 
                        example;
                    field.val(newContent);
                }
            } else if (field.is('textarea')) {
                // For textareas, add as new lines
                if (!currentContent.includes(example)) {
                    const newContent = currentContent ? 
                        currentContent + '\n' + example : 
                        example;
                    field.val(newContent);
                }
            } else if (field.is('input')) {
                // For single input fields, try to add to the first empty field or replace current
                if (targetName.startsWith('curiosity_') || targetName.startsWith('role_model_')) {
                    // Find the next empty field in the group
                    const baseName = targetName.replace(/_\d+$/, '');
                    let targetField = null;
                    
                    for (let i = 1; i <= 3; i++) {
                        const candidateField = $(`input[name="${baseName}_${i}"]`);
                        if (candidateField.length && !candidateField.val().trim()) {
                            targetField = candidateField;
                            break;
                        }
                    }
                    
                    if (targetField) {
                        targetField.val(example);
                    } else if (!currentContent) {
                        field.val(example);
                    }
                }
            }
            
            // Visual feedback
            button.addClass('selected');
            setTimeout(() => button.removeClass('selected'), 300);
        },
        
        // Get MI examples for quick-select buttons
        getMIExamples: function(miKey, type) {
            const examples = {
                'linguistic': {
                    enjoy: ['Writing stories', 'Public speaking', 'Wordplay and puns', 'Reading diverse topics', 'Facilitating discussions', 'Debates and arguments'],
                    doing: ['Daily journaling', 'Blog writing', 'Team meeting notes', 'Email newsletters', 'Presentation prep', 'Podcast listening']
                },
                'logical-mathematical': {
                    enjoy: ['Solving puzzles', 'Data analysis', 'System optimization', 'Budget planning', 'Strategic thinking', 'Number patterns'],
                    doing: ['Spreadsheet modeling', 'Project planning', 'Process improvement', 'Financial tracking', 'Research analysis', 'Code debugging']
                },
                'spatial': {
                    enjoy: ['Visual design', 'Photography', 'Map reading', 'Interior decorating', 'Drawing/sketching', 'Architecture'],
                    doing: ['Slide deck design', 'Room organizing', 'Visual note-taking', 'Infographic creation', 'Layout planning', 'Photo editing']
                },
                'bodily-kinesthetic': {
                    enjoy: ['Hands-on building', 'Sports/movement', 'Crafting', 'Cooking', 'Physical challenges', 'Dance/choreography'],
                    doing: ['Exercise routine', 'DIY projects', 'Gesture-rich presenting', 'Active meetings', 'Workshop facilitation', 'Walking meetings']
                },
                'musical': {
                    enjoy: ['Listening to music', 'Creating playlists', 'Singing', 'Playing instruments', 'Rhythm activities', 'Sound mixing'],
                    doing: ['Background music while working', 'Humming/whistling', 'Musical breaks', 'Audio learning', 'Sound design', 'Beat tapping']
                },
                'interpersonal': {
                    enjoy: ['Team collaboration', 'Mentoring others', 'Networking events', 'Group problem-solving', 'Community building', 'Public engagement'],
                    doing: ['One-on-one meetings', 'Team coordination', 'Peer feedback', 'Social organizing', 'Conflict resolution', 'Group facilitation']
                },
                'intrapersonal': {
                    enjoy: ['Self-reflection', 'Personal goal setting', 'Independent learning', 'Meditation', 'Life planning', 'Solitary thinking'],
                    doing: ['Morning reflection', 'Goal tracking', 'Solo work time', 'Personal projects', 'Self-assessment', 'Quiet contemplation']
                },
                'naturalistic': {
                    enjoy: ['Outdoor activities', 'Pattern recognition', 'Environmental awareness', 'Gardening', 'Nature observation', 'Weather tracking'],
                    doing: ['Daily walks', 'Plant care', 'Weather tracking', 'Recycling/sustainability', 'Outdoor meetings', 'Hiking/camping']
                }
            };
            
            return examples[miKey]?.[type] || ['Custom example'];
        },
        
        // Get CDT challenge options (3 focused choices per dimension)
        getCDTChallengeOptions: function(cdtKey) {
            const options = {
                // Current CDT dimensions from the quiz
                'ambiguity-tolerance': [
                    "I need all the details figured out before I can start working",
                    "I feel uncomfortable when requirements or expectations are unclear", 
                    "I struggle with open-ended tasks that don't have obvious solutions"
                ],
                'value-conflict-navigation': [
                    "I find it hard to work with people whose values differ significantly from mine",
                    "I struggle to find common ground when facing opposing viewpoints",
                    "I tend to avoid or shut down conversations that involve conflicting beliefs"
                ],
                'self-confrontation-capacity': [
                    "I struggle to acknowledge when I'm wrong or have made a mistake",
                    "I find it difficult to receive constructive criticism without getting defensive",
                    "I avoid examining my own biases and assumptions about situations"
                ],
                'discomfort-regulation': [
                    "I struggle to stay calm when conversations get heated or tense",
                    "I tend to shut down or withdraw when facing difficult emotions",
                    "I find it hard to work through conflict without getting overwhelmed"
                ],
                'growth-orientation': [
                    "I prefer to stick with methods I already know rather than learn new ones",
                    "I focus on immediate results rather than building long-term capabilities",
                    "I resist trying new approaches that might slow me down initially"
                ],
                // Legacy variations for backward compatibility
                'self-confrontation': [
                    "I struggle to acknowledge when I'm wrong or have made a mistake",
                    "I find it difficult to receive constructive criticism without getting defensive",
                    "I avoid examining my own biases and assumptions about situations"
                ],
                'value-conflict': [
                    "I find it hard to work with people whose values differ significantly from mine",
                    "I struggle to find common ground when facing opposing viewpoints",
                    "I tend to avoid or shut down conversations that involve conflicting beliefs"
                ],
                'intellectual-humility': [
                    "I find it difficult to admit when I don't know something",
                    "I struggle to change my mind even when presented with compelling evidence",
                    "I have trouble asking for help or guidance from others"
                ],
                'perspective-integration': [
                    "I struggle to see situations from multiple viewpoints simultaneously",
                    "I find it hard to synthesize different approaches into a cohesive solution",
                    "I tend to stick to one perspective rather than considering alternatives"
                ],
                // Legacy keys for backward compatibility
                'risk-comfort': [
                    'I avoid making decisions when outcomes are uncertain',
                    'I stick to familiar approaches even when they might not be optimal',
                    'I get paralyzed analyzing risks instead of taking small steps forward'
                ],
                'ambiguity-tolerance': [
                    'I need all the details figured out before I can start working',
                    'I feel uncomfortable when requirements or expectations are unclear',
                    'I struggle with open-ended tasks that don\'t have obvious solutions'
                ],
                'complexity-handling': [
                    'I get overwhelmed when problems have multiple interconnected parts',
                    'I prefer simple, linear solutions over complex systems thinking',
                    'I avoid situations where I have to juggle many variables at once'
                ],
                'learning-orientation': [
                    'I prefer to stick with methods I already know rather than learn new ones',
                    'I focus on immediate results rather than building long-term capabilities',
                    'I resist trying new approaches that might slow me down initially'
                ],
                'future-focus': [
                    'I focus mainly on immediate tasks and struggle with long-term planning',
                    'I find it hard to invest time in things that won\'t pay off right away',
                    'I prefer concrete, tangible work over abstract or visionary thinking'
                ],
                'innovation-drive': [
                    'I prefer to optimize existing processes rather than create new solutions',
                    'I\'m cautious about trying unproven ideas or experimental approaches',
                    'I focus on incremental improvements rather than breakthrough innovations'
                ]
            };
            
            console.log('CDT Key requested:', cdtKey);
            console.log('Available options for key:', options[cdtKey]);
            
            return options[cdtKey] || ['Custom challenge option'];
        },
        
        // Get curiosity examples for quick-select buttons
        getCuriosityExamples: function() {
            return [
                'sustainable design', 'community building', 'digital storytelling', 
                'urban planning', 'behavioral psychology', 'creative writing', 
                'data visualization', 'renewable energy', 'mindfulness practices'
            ];
        },
        
        // Get role model examples for quick-select buttons  
        getRoleModelExamples: function() {
            return [
                'James Clear', 'Brené Brown', 'Tim Urban', 
                'Seth Godin', 'Marie Kondo', 'Simon Sinek', 
                'Cal Newport', 'Austin Kleon', 'Ryan Holiday'
            ];
        },
        
        // Get context tag examples for quick-select buttons
        getContextTagExamples: function() {
            return [
                'creative', 'collaborative', 'outdoors', 'learning', 'social', 'quiet',
                'morning', 'evening', 'weekend', 'home', 'coffee shop', 'nature',
                'music', 'writing', 'building', 'teaching', 'solo', 'group'
            ];
        },
        
        // Fill form with test data for easy testing
        fillTestData: function() {
            // Fill MI qualifiers (for top 3 MI)
            const topMI = this.profileData.mi_results.slice(0, 3);
            topMI.forEach(mi => {
                // Fill enjoy fields
                const enjoyField = $(`textarea[name="mi_enjoy_${mi.key}"]`);
                const doingField = $(`textarea[name="mi_doing_${mi.key}"]`);
                
                if (mi.key === 'linguistic') {
                    enjoyField.val('Writing blog posts\nFacilitating discussions\nStorytelling');
                    doingField.val('Daily journaling\nWeekly team meetings\nContent creation');
                } else if (mi.key === 'logical-mathematical') {
                    enjoyField.val('Solving puzzles\nAnalyzing data patterns\nSystem optimization');
                    doingField.val('Spreadsheet modeling\nProcess improvement\nBudget analysis');
                } else if (mi.key === 'spatial') {
                    enjoyField.val('Creating visual maps\nDesigning layouts\nPhotography');
                    doingField.val('Sketching ideas\nSlide deck design\nRoom organization');
                } else if (mi.key === 'interpersonal') {
                    enjoyField.val('Mentoring colleagues\nBuilding teams\nNetworking events');
                    doingField.val('One-on-one meetings\nTeam coordination\nCommunity involvement');
                } else {
                    enjoyField.val(`Exploring ${mi.label.toLowerCase()}\nPracticing related skills`);
                    doingField.val(`Daily activities with ${mi.label.toLowerCase()}\nWeekly practice sessions`);
                }
            });
            
            // Fill CDT qualifiers (for bottom 2 CDT)
            const bottomCDT = this.profileData.cdt_results.slice(-2);
            bottomCDT.forEach(cdt => {
                const tripsField = $(`textarea[name="cdt_trips_${cdt.key}"]`);
                const helpsField = $(`textarea[name="cdt_helps_${cdt.key}"]`);
                
                if (cdt.key === 'risk-comfort') {
                    tripsField.val('Avoiding decisions with uncertain outcomes\nSticking to proven approaches');
                    helpsField.val('Starting with small experiments\nHaving backup plans');
                } else if (cdt.key === 'ambiguity-tolerance') {
                    tripsField.val('Getting stuck when requirements are unclear\nNeeding all details before starting');
                    helpsField.val('Breaking complex problems into smaller parts\nAsking clarifying questions');
                } else {
                    tripsField.val(`Struggling with ${cdt.label.toLowerCase()}\nAvoiding complex situations`);
                    helpsField.val(`Using structured approaches\nSeeking guidance from others`);
                }
            });
            
            // Fill curiosity fields
            $('input[name="curiosity_1"]').val('sustainable design');
            $('input[name="curiosity_2"]').val('community building');
            $('input[name="curiosity_3"]').val('digital storytelling');
            
            // Fill role models
            $('input[name="role_model_1"]').val('James Clear');
            $('input[name="role_model_2"]').val('Brené Brown');
            $('input[name="role_model_3"]').val('Tim Urban');
            
            // Set constraint sliders
            $('input[name="risk_tolerance"]').val(60).trigger('input');
            $('input[name="budget"]').val(75).trigger('input');
            $('input[name="time_per_week"]').val(4).trigger('input');
            $('input[name="solo_group"]').val(40).trigger('input');
            
            // Fill context tags
            $('input[name="context_tags"]').val('creative, collaborative, outdoors, learning');
            
            alert('Test data filled! You can now generate experiments.');
        },
        
        // Test AI generation directly
        testAI: function() {
            // First save test qualifiers, then try AI
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_test_save_qualifiers',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    console.log('Test qualifiers saved, now testing AI...');
                    
                    // Now try to generate experiments with AI
                    $.ajax({
                        url: labMode.ajaxUrl,
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            action: 'mc_lab_generate_experiments',
                            nonce: labMode.nonce
                        },
                        success: (aiResponse) => {
                            console.log('AI Test Response:', aiResponse);
                            alert('AI test completed. Check console and server logs for details.');
                        },
                        error: (xhr, status, error) => {
                            console.error('AI test failed:', xhr, status, error);
                            alert('AI test failed: ' + error);
                        }
                    });
                },
                error: () => {
                    alert('Failed to save test qualifiers first');
                }
            });
        },
        
        // Test save qualifiers with dummy data
        testSaveQualifiers: function() {
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_test_save_qualifiers',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    console.log('Test Save Response:', response.data);
                    alert('Test save completed. Check console for details.');
                },
                error: () => {
                    console.error('Failed to test save');
                    alert('Failed to test save');
                }
            });
        },
        
        // Debug user data for troubleshooting
        debugUserData: function() {
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_debug_user_data',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    console.log('Debug Data:', response.data);
                    alert('Debug data logged to console. Check browser developer tools.');
                },
                error: () => {
                    console.error('Failed to get debug data');
                    alert('Failed to get debug data');
                }
            });
        },
        
        // Generate experiments using AI
        generateExperiments: function() {
            this.showLoading('Generating your personalized experiments...');
            
            const requestData = {
                action: 'mc_lab_generate_experiments',
                nonce: labMode.nonce,
                qualifiers: JSON.stringify(this.qualifiers)
            };
            
            // Add model selection for admin users
            const selectedModel = this.getSelectedModel();
            if (selectedModel && selectedModel !== 'gpt-4o-mini') {
                requestData.model = selectedModel;
                console.log('Using admin-selected model:', selectedModel);
            }
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: requestData,
                success: (response) => {
                    if (response.success) {
                        const raw = response.data.experiments || [];
                        console.log('Raw experiments from backend:', raw);
                        console.log('Current constraints:', this.qualifiers?.curiosity?.constraints);
                        // Apply client-side constraint calibration to ensure visible impact
                        this.experiments = this.applyConstraintsToExperiments(raw);
                        console.log('Calibrated experiments:', this.experiments);
                        this.experimentSource = response.data.source || 'Unknown';
                        this.usingMock = response.data.using_mock || false;
                        this.showExperiments();
                    } else {
                        this.showError(response.data || 'Failed to generate experiments');
                    }
                },
                error: () => {
                    this.showError('Network error while generating experiments');
                }
            });
        },
        
        // Show generated experiments
        showExperiments: function() {
            const sourceIndicator = this.usingMock ? 
                '<div class="experiment-source mock-indicator">⚠️ Using Mock Data (AI temporarily unavailable)</div>' :
                '<div class="experiment-source ai-indicator">🤖 AI Generated</div>';
            
            let html = `
                <div class="lab-experiments">
                    <h2>Your Experiments</h2>
                    ${sourceIndicator}
                    <div class="lab-experiment-controls">
                        <p class="lab-subtitle">These are prototypes. Use "Regenerate Variant" on individual experiments, or:</p>
                        <div class="experiment-global-actions">
                            <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.startProfileInputs(event)">Modify Constraints & Regenerate All</button>
                            <button class="lab-btn lab-btn-tertiary" onclick="LabModeApp.loadLandingView()">Start Over</button>
                        </div>
                    </div>
                    
                    <div class="experiments-grid">
                        ${this.experiments.map((exp, index) => `
                            <div class="experiment-card" data-archetype="${exp.archetype}">
                                <div class="experiment-header">
                                    <h3 class="experiment-title">${exp.title}</h3>
                                    <span class="archetype-badge archetype-${exp.archetype.toLowerCase()}">${exp.archetype}</span>
                                </div>
                                
                                <div class="experiment-body">
                                    <div class="experiment-description">
                                        <p class="experiment-summary">${this.generateEngagingDescription(exp)}</p>
                                    </div>
                                    
                                    <div class="experiment-connection">
                                        <h4>Why This Fits You:</h4>
                                        <p class="connection-text">${this.generatePersonalizedConnection(exp, index)}</p>
                                    </div>
                                    
                                    ${exp._calibrationNotes ? `<div class="experiment-calibration"><small class="calibration-note">${exp._calibrationNotes}</small></div>` : ''}
                                    
                                    <div class="experiment-steps">
                                        <h4>Steps:</h4>
                                        <ol>
                                            ${exp.steps.map(step => `<li>${step}</li>`).join('')}
                                        </ol>
                                    </div>
                                    
                                    <div class="experiment-meta">
                                        <div class="experiment-effort">
                                            <span class="effort-time">${exp.effort?.timeHours || 0}h</span>
                                            <span class="effort-budget">$${exp.effort?.budgetUSD || 0}</span>
                                            <span class="risk-level risk-${(exp.riskLevel || 'medium').toLowerCase()}">${exp.riskLevel}</span>
                                        </div>
                                        
                                        <div class="success-criteria">
                                            <h5>Success Criteria:</h5>
                                            <ul>
                                                ${(exp.successCriteria || []).map(criteria => `<li>${criteria}</li>`).join('')}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="experiment-actions">
                                    <button class="lab-btn lab-btn-primary lab-start-experiment-btn" data-experiment-id="${index}">Start</button>
                                    <button class="lab-btn lab-btn-secondary lab-regenerate-ai-btn" data-experiment-id="${index}" title="Generate a new AI-powered variant">Regenerate Variant</button>
                                    <button class="lab-btn lab-btn-tertiary lab-debug-toggle-btn" data-experiment-id="${index}">🔍 Debug</button>
                                </div>
                                
                                <div class="experiment-debug" id="debug-${index}" style="display: none;">
                                    <div class="debug-header">
                                        <h4>🛠️ Debug Information</h4>
                                        <small>Technical details for troubleshooting</small>
                                    </div>
                                    
                                    <div class="debug-section">
                                        <h5>AI Prompt Sent:</h5>
                                        <div class="debug-code">
                                            <pre><code>${this.formatDebugPrompt()}</code></pre>
                                        </div>
                                    </div>
                                    
                                    <div class="debug-section">
                                        <h5>Raw Experiment Data:</h5>
                                        <div class="debug-code">
                                            <pre><code>${JSON.stringify(exp, null, 2)}</code></pre>
                                        </div>
                                    </div>
                                    
                                    <div class="debug-section">
                                        <h5>User Profile Data:</h5>
                                        <div class="debug-code">
                                            <pre><code>${JSON.stringify({
                                                topMI: this.profileData?.mi_results?.slice(0, 3) || [],
                                                constraints: this.qualifiers?.curiosity?.constraints || {},
                                                curiosities: this.qualifiers?.curiosity?.curiosities || [],
                                                roleModels: this.qualifiers?.curiosity?.roleModels || [],
                                                bottomCDT: this.profileData?.cdt_results?.slice(-2) || []
                                            }, null, 2)}</code></pre>
                                        </div>
                                    </div>
                                    
                                    ${this.experimentSource ? `
                                        <div class="debug-section">
                                            <h5>Generation Source:</h5>
                                            <div class="debug-info">
                                                <strong>Source:</strong> ${this.experimentSource}<br>
                                                <strong>Using Mock:</strong> ${this.usingMock ? 'Yes' : 'No'}<br>
                                                <strong>Calibrated:</strong> ${exp._calibrated ? 'Yes' : 'No'}
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${exp.influences ? `
                                        <div class="debug-section">
                                            <h5>AI Influences Used:</h5>
                                            <div class="debug-info">
                                                <strong>MI:</strong> ${exp.influences.miUsed || 'None'}<br>
                                                <strong>Role Model:</strong> ${exp.influences.roleModelUsed || 'None'}<br>
                                                <strong>Curiosity:</strong> ${exp.influences.curiosityUsed || 'None'}<br>
                                                <strong>CDT Edge:</strong> ${exp.influences.cdtEdge || 'None'}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="lab-footer-actions">
                        <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.loadLandingView()">Back to Start</button>
                    </div>
                </div>
            `;
            
            $('#lab-mode-app').html(html);
            this.currentStep = 'experiments';
            
            // Setup debug toggle event listeners
            this.setupDebugToggles();
        },
        
        // Setup debug toggle functionality
        setupDebugToggles: function() {
            $(document).off('click.debug').on('click.debug', '.lab-debug-toggle-btn', function(e) {
                e.preventDefault();
                const experimentId = $(this).data('experiment-id');
                const debugSection = $(`#debug-${experimentId}`);
                const button = $(this);
                
                if (debugSection.is(':visible')) {
                    debugSection.slideUp(200);
                    button.text('🔍 Debug');
                } else {
                    debugSection.slideDown(200);
                    button.text('🔍 Hide Debug');
                }
            });
        },
        
        // Format the AI prompt for debugging
        formatDebugPrompt: function() {
            if (!this.qualifiers || !this.profileData) {
                return 'No prompt data available (using mock/fallback experiments)';
            }
            
            const mi = this.profileData.mi_results || [];
            const cdt = this.profileData.cdt_results || [];
            const topMI = mi.slice(0, 3);
            const bottomCDT = cdt.slice(-2);
            const constraints = this.qualifiers.curiosity?.constraints || {};
            const curiosities = this.qualifiers.curiosity?.curiosities || [];
            const roleModels = this.qualifiers.curiosity?.roleModels || [];
            
            return `SYSTEM PROMPT:
Role: You generate personalized "minimum viable experiments" (MVEs) for self-discovery.

Inputs you will receive: A JSON payload with: MI top 3 (with scores), CDT subscale scores (plus strongest & growth edge), optional interests/context; and user-selected filters (cost, time, energy, variety), the brainstorming lenses to use (Curiosity, Role Models, Opposites, Adjacency), and a quantity target.

Task: Produce a diverse set of safe, low-stakes MVEs that the user can try within 7 days. Respect filters; tie each idea back to MI/CDT.

Constraints:
– Specific, runnable steps (3–5), not generic advice.
– Calibrate cost/time/energy/variety to sliders; don't exceed ±1 unless you add a tradeoff note.
– All ideas must be safe, legal, age-appropriate, and low-risk.
– Keep language warm, concrete, and non-judgmental.

USER PROMPT:
Profile+filters JSON: {
  "user": {
    "mi_top3": ${JSON.stringify(topMI.map(mi => ({ label: mi.label, score: mi.score })))},
    "cdt_bottom2": ${JSON.stringify(bottomCDT.map(cdt => ({ label: cdt.label, score: cdt.score })))},
    "curiosities": ${JSON.stringify(curiosities)},
    "roleModels": ${JSON.stringify(roleModels)}
  },
  "constraints": {
    "timePerWeek": ${constraints.timePerWeekHours || 3},
    "budget": ${constraints.budget || 50},
    "risk": ${constraints.risk || 50},
    "soloToGroup": ${constraints.soloToGroup || 50}
  }
}

Generate 3-5 personalized experiments that combine the user's MI strengths, address their CDT growth areas, incorporate their curiosities, and respect their constraints.`;
        },
        
        // Generate Mi Approach based on user's profile
        generateMiApproach: function(experiment) {
            if (!this.profileData?.mi_results) {
                return 'Use your natural learning style to approach this experiment in a way that feels authentic to you.';
            }
            
            const topMI = this.profileData.mi_results.slice(0, 3);
            const primaryMI = topMI[0];
            const secondaryMI = topMI[1];
            
            const approaches = {
                'linguistic': 'Document your process through writing, talking through ideas, or teaching concepts to others. Use words and language as tools for processing and understanding.',
                'logical-mathematical': 'Break down the experiment into logical steps, analyze patterns and connections, and use systematic approaches to track progress and outcomes.',
                'spatial': 'Create visual representations, use diagrams or mind maps, and pay attention to spatial relationships and visual patterns in your learning.',
                'bodily-kinesthetic': 'Learn through hands-on action, physical movement, and direct experience. Trust your bodily sensations and kinesthetic feedback.',
                'musical': 'Use rhythm, patterns, and musical elements to structure your learning. Consider background music or rhythmic approaches to organization.',
                'interpersonal': 'Involve others in your learning process through discussion, collaboration, teaching, or getting feedback from people you trust.',
                'intrapersonal': 'Engage in deep self-reflection, connect the learning to your personal goals and values, and create quiet space for internal processing.',
                'naturalistic': 'Look for patterns and connections, organize information systematically, and connect learning to broader systems and natural processes.'
            };
            
            const primaryApproach = approaches[primaryMI?.key] || 'Approach this experiment in a way that feels natural to your learning style.';
            
            let miApproach = primaryApproach;
            
            // Add secondary MI if available
            if (secondaryMI && approaches[secondaryMI.key]) {
                const secondaryApproach = approaches[secondaryMI.key];
                miApproach += ` Additionally, since ${secondaryMI.label} is also a strength, consider ${secondaryApproach.toLowerCase()}`;
            }
            
            return miApproach;
        },
        
        // Generate engaging description for what the user will do
        generateEngagingDescription: function(experiment) {
            // If experiment has an explicit summary, use that
            if (experiment.summary) {
                return experiment.summary;
            }
            
            // If experiment has steps, create a concise summary from them
            if (experiment.steps && Array.isArray(experiment.steps) && experiment.steps.length > 0) {
                return this.createActionSummary(experiment.steps);
            }
            
            // Fallback to title or generic description
            if (experiment.title) {
                // Remove "Experiment" suffix and convert to action phrase
                const cleanTitle = experiment.title.replace(/\s*Experiment:?\s*/i, '').trim();
                return cleanTitle || 'An engaging experiment tailored to your interests.';
            }
            
            return experiment.description || experiment.rationale || 'An engaging experiment tailored to your interests.';
        },
        
        // Create a concise action summary from experiment steps
        createActionSummary: function(steps) {
            if (!steps || steps.length === 0) {
                return 'Complete a series of personalized activities.';
            }
            
            // Take first 1-2 steps to create summary
            const relevantSteps = steps.slice(0, 2);
            
            // Clean and simplify each step
            const cleanedSteps = relevantSteps.map(step => {
                return step
                    .replace(/^(Choose|Select|Pick|Identify)\s+/, 'Choose ') // Normalize selection verbs
                    .replace(/^(Create|Make|Build|Design)\s+/, 'Create ') // Normalize creation verbs
                    .replace(/^(Write|Document|Journal)\s+/, 'Write ') // Normalize writing verbs
                    .replace(/^(Research|Study|Explore|Investigate)\s+/, 'Research ') // Normalize research verbs
                    .replace(/^(Practice|Try|Attempt|Test)\s+/, 'Practice ') // Normalize practice verbs
                    .replace(/^(Reflect|Think|Consider)\s+/, 'Reflect ') // Normalize reflection verbs
                    .replace(/\s+about\s+your\s+curiosit(y|ies)/, ' about your interests') // Simplify curiosity references
                    .replace(/\s+related\s+to\s+your\s+curiosit(y|ies)/, ' related to your interests') // Simplify curiosity references
                    .replace(/\s+from\s+your\s+role\s+models?/, ' from people you admire') // Simplify role model references
                    .trim();
            });
            
            if (cleanedSteps.length === 1) {
                return cleanedSteps[0].endsWith('.') ? cleanedSteps[0] : cleanedSteps[0] + '.';
            } else if (cleanedSteps.length === 2) {
                // Join with "then" for natural flow
                const firstStep = cleanedSteps[0].replace(/\.$/, ''); // Remove trailing period if present
                const secondStep = cleanedSteps[1].replace(/\.$/, ''); // Remove trailing period if present
                return firstStep + ', then ' + secondStep.toLowerCase() + '.';
            } else {
                const firstStep = cleanedSteps[0].replace(/\.$/, ''); // Remove trailing period if present
                return firstStep + ', and more.';
            }
        },
        
        // Generate personalized connection explaining why this experiment was chosen
        generatePersonalizedConnection: function(experiment, index) {
            if (!this.qualifiers || !this.profileData) {
                return "This experiment aligns with your interests and learning preferences.";
            }
            
            let connection = "Perfect for you because ";
            
            // First check if the AI provided detailed influences
            if (experiment.influences) {
                const influences = experiment.influences;
                const personalConnections = [];
                
                // Role model connection with personal touch
                if (influences.roleModelUsed) {
                    personalConnections.push(`you're drawn to ${influences.roleModelUsed}'s methodology - this captures their essence`);
                }
                
                // MI connection with identity language
                if (influences.miUsed) {
                    personalConnections.push(`your ${influences.miUsed} nature shines in this type of work`);
                }
                
                // Curiosity connection with passion language
                if (influences.curiosityUsed) {
                    personalConnections.push(`your genuine fascination with ${influences.curiosityUsed} will keep you engaged`);
                }
                
                // CDT growth with supportive framing
                if (influences.cdtEdge) {
                    personalConnections.push(`it's a gentle way to strengthen your ${influences.cdtEdge} skills without pressure`);
                }
                
                if (personalConnections.length > 0) {
                    if (personalConnections.length === 1) {
                        connection += personalConnections[0] + ".";
                    } else if (personalConnections.length === 2) {
                        connection += personalConnections[0] + " and " + personalConnections[1] + ".";
                    } else {
                        const last = personalConnections.pop();
                        connection += personalConnections.join(", ") + ", and " + last + ".";
                    }
                    return connection;
                }
            }
            
            // Fallback to manual connection generation with personal tone
            const mi = this.profileData.mi_results || [];
            const topMI = mi.slice(0, 3);
            const curiosities = this.qualifiers.curiosity?.curiosities || [];
            const roleModels = this.qualifiers.curiosity?.roleModels || [];
            const constraints = this.qualifiers.curiosity?.constraints || {};
            
            const personalConnections = [];
            
            // Connect to top MI strength with identity language
            if (topMI.length > 0) {
                const primaryMI = topMI[0];
                const miConnections = {
                    'linguistic': 'your love of words and communication makes this a natural fit',
                    'logical-mathematical': 'your analytical mind will thrive in this structured approach', 
                    'spatial': 'your visual intelligence and design sense will shine here',
                    'bodily-kinesthetic': 'your hands-on learning style is perfectly matched',
                    'musical': 'your ear for patterns and rhythm guides this approach',
                    'interpersonal': 'your gift for understanding people is exactly what\'s needed',
                    'intrapersonal': 'your self-reflective nature will find this deeply engaging',
                    'naturalistic': 'your systematic thinking will make this feel intuitive'
                };
                
                const miConnection = miConnections[primaryMI.key] || `your ${primaryMI.label} strength is perfectly suited for this`;
                personalConnections.push(miConnection);
            }
            
            // Enhanced role model connection with admiration language
            const roleModelMentions = this.findRoleModelInfluences(experiment, roleModels);
            if (roleModelMentions.length > 0) {
                personalConnections.push(`it echoes ${roleModelMentions[0]}'s approach, which clearly resonates with you`);
            } else if (roleModels.length > 0) {
                personalConnections.push(`it channels the spirit of creators like ${roleModels[0]} who inspire you`);
            }
            
            // Connect to curiosities with passion language
            if (curiosities.length > 0) {
                const primaryCuriosity = curiosities[0];
                if (experiment.title && experiment.title.toLowerCase().includes(primaryCuriosity.toLowerCase())) {
                    personalConnections.push(`it directly feeds your fascination with ${primaryCuriosity}`);
                } else {
                    personalConnections.push(`your curiosity about ${primaryCuriosity} will find new expression here`);
                }
            }
            
            // Connect to constraints with thoughtful accommodation
            if (constraints.timePerWeekHours <= 2) {
                personalConnections.push("it respects your time constraints with focused, efficient activities");
            } else if (constraints.timePerWeekHours >= 6) {
                personalConnections.push("it makes good use of your available time for deeper exploration");
            }
            
            if (constraints.risk <= 30) {
                personalConnections.push("it honors your preference for manageable, low-risk steps");
            } else if (constraints.risk >= 70) {
                personalConnections.push("it matches your appetite for bold, adventurous experiments");
            }
            
            if (constraints.soloToGroup <= 30) {
                personalConnections.push("it supports your independent, self-directed style");
            } else if (constraints.soloToGroup >= 70) {
                personalConnections.push("it includes the social connection you value");
            }
            
            // Fallback if no specific connections found
            if (personalConnections.length === 0) {
                connection += "it's thoughtfully designed around your unique combination of strengths and interests.";
                return connection;
            }
            
            // Format with personal touch
            if (personalConnections.length === 1) {
                connection += personalConnections[0] + ".";
            } else if (personalConnections.length === 2) {
                connection += personalConnections[0] + " and " + personalConnections[1] + ".";
            } else {
                const last = personalConnections.pop();
                connection += personalConnections.join(", ") + ", and " + last + ".";
            }
            
            return connection;
        },
        
        // Helper function to format connection strings
        formatConnections: function(connections) {
            if (connections.length === 1) {
                return connections[0] + ".";
            } else if (connections.length === 2) {
                return connections[0] + " and " + connections[1] + ".";
            } else {
                const lastConnection = connections.pop();
                return connections.join(", ") + ", and " + lastConnection + ".";
            }
        },
        
        // Helper function to find role model influences in experiment content
        findRoleModelInfluences: function(experiment, roleModels) {
            const searchText = `${experiment.title || ''} ${experiment.rationale || ''} ${(experiment.steps || []).join(' ')}`.toLowerCase();
            
            const foundModels = [];
            roleModels.forEach(model => {
                if (searchText.includes(model.toLowerCase())) {
                    foundModels.push(model);
                }
            });
            
            return foundModels;
        },
        
        // Map raw slider constraints to normalized targets used for calibration (0..4)
        mapConstraintsToTargets: function() {
            const c = this.qualifiers?.curiosity?.constraints || {};
            // Budget slider may be 0..200; map to 0..4
            const cost = Math.max(0, Math.min(4, Math.round((Number(c.budget ?? 50) / 200) * 4)));
            // Time per week 1..10; map to 0..4
            const tpw = Number(c.timePerWeekHours ?? 3);
            const time = tpw <= 2 ? 0 : tpw <= 3 ? 1 : tpw <= 5 ? 2 : tpw <= 7 ? 3 : 4;
            // Risk 0..100 — use as proxy for energy tolerance 0..4
            const energy = Math.max(0, Math.min(4, Math.round((Number(c.risk ?? 50) / 100) * 4)));
            // Variety unavailable directly; approximate from energy for now
            const variety = energy;
            return { cost, time, energy, variety };
        },

        // Adjust generated experiments client-side to visibly reflect constraints
        applyConstraintsToExperiments: function(experiments) {
            const targets = this.mapConstraintsToTargets();
            const c = this.qualifiers?.curiosity?.constraints || {};
            const tpw = Number(c.timePerWeekHours ?? 3);
            const maxBudget = Number(c.budget ?? 50);
            
            console.log('Applying constraints - targets:', targets, 'constraints:', c);

            const calibrated = (experiments || []).map(exp => {
                const e = { ...exp };
                
                // Initialize effort object if missing (common for mock/fallback experiments)
                if (!e.effort) {
                    e.effort = {
                        timeHours: Math.floor(Math.random() * 3) + 1, // Random 1-3 hours
                        budgetUSD: Math.floor(Math.random() * 50)     // Random 0-49 dollars
                    };
                }
                
                let timeH = Number(e.effort.timeHours ?? 1);
                let budget = Number(e.effort.budgetUSD ?? 0);
                const originalTime = timeH;
                const originalBudget = budget;

                // If user time is low, cap time; if high, allow more time
                if (targets.time <= 1) {
                    timeH = Math.min(timeH, Math.max(1, Math.ceil(tpw / 2))); // keep short
                } else if (targets.time >= 3) {
                    timeH = Math.max(timeH, Math.min(10, Math.ceil(tpw * 0.8))); // deepen more aggressively
                }

                // Budget calibration: if user allows high spend, bump minimal budgets; else clamp
                if (targets.cost <= 1) {
                    budget = Math.min(budget, Math.max(0, Math.floor(maxBudget * 0.2)));
                } else if (targets.cost >= 3) {
                    const floor = Math.max(50, Math.floor(maxBudget * 0.4));
                    budget = Math.max(budget, floor);
                }

                // Always annotate rationale to show calibration happened
                const notes = [];
                if (timeH !== originalTime) {
                    notes.push(`time adjusted from ${originalTime}h to ${timeH}h based on your ${targets.time <= 1 ? 'limited' : 'generous'} availability`);
                }
                if (budget !== originalBudget) {
                    notes.push(`budget adjusted from $${originalBudget} to $${budget} for ${targets.cost >= 3 ? 'higher investment' : 'budget-conscious'} approach`);
                }
                
                // Add a calibration note even if no changes (to show system is working)
                if (notes.length === 0) {
                    notes.push(`calibrated for ${timeH}h/${budget} budget based on your constraints`);
                }
                
                if (notes.length) {
                    e._calibrationNotes = `Calibrated: ${notes.join('; ')}`;
                }

                e.effort.timeHours = timeH;
                e.effort.budgetUSD = budget;
                e._calibrated = true;
                return e;
            });

            // Sort by closeness to targets (time/budget proxy)
            const dist = (e) => {
                const t = Number(e.effort?.timeHours ?? 0);
                const b = Number(e.effort?.budgetUSD ?? 0);
                // Map to 0..4 to compare
                const tScaled = t <= 2 ? 0 : t <= 3 ? 1 : t <= 5 ? 2 : t <= 7 ? 3 : 4;
                const bScaled = Math.max(0, Math.min(4, Math.round((b / Math.max(1, maxBudget)) * 4)));
                return Math.abs(tScaled - targets.time) + Math.abs(bScaled - targets.cost);
            };
            calibrated.sort((a,b) => dist(a) - dist(b));
            
            console.log('Calibration complete - first experiment:', calibrated[0]);
            return calibrated;
        },

        // Regenerate a variant using AI
        regenerateAiVariant: function(e) {
            e.preventDefault();
            const experimentIndex = parseInt($(e.target).data('experiment-id'));
            const experiment = this.experiments[experimentIndex];
            
            if (!experiment) return;
            
            this.showLoading('Generating AI-powered variant...');
            
            // Create a custom prompt for variant generation
            const variantPrompt = this.buildVariantPrompt(experiment);
            
            // Debug logging
            console.log('AI Variant Generation Debug:');
            console.log('- Experiment:', experiment.title || 'No title');
            console.log('- Profile data available:', !!this.profileData);
            console.log('- Qualifiers available:', !!this.qualifiers);
            console.log('- Variant prompt system length:', variantPrompt.system?.length || 0);
            console.log('- Variant prompt user length:', variantPrompt.user?.length || 0);
            console.log('- Full variant prompt:', variantPrompt);
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST', 
                dataType: 'json',
                data: {
                    action: 'mc_lab_generate_ai_variant',
                    nonce: labMode.nonce,
                    original_experiment: JSON.stringify(experiment),
                    prompt_data: JSON.stringify(variantPrompt)
                },
                success: (response) => {
                    console.log('AI Variant Response:', response);
                    
                    if (response.success && response.data.variant) {
                        // Replace the experiment with the AI-generated variant
                        this.experiments[experimentIndex] = {
                            ...response.data.variant,
                            _aiGenerated: true,
                            _variantOf: experiment.title
                        };
                        
                        // Re-render experiments
                        this.showExperiments();
                        
                        // Scroll to the updated experiment
                        setTimeout(() => {
                            $(`.experiment-card[data-archetype="${response.data.variant.archetype}"]`).eq(experimentIndex)
                                .get(0)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                    } else {
                        console.error('AI variant generation failed:', response);
                        this.showError(response.data || 'AI variant generation failed. Please try again.');
                    }
                },
                error: (xhr, status, error) => {
                    console.error('AI variant AJAX error:', { xhr, status, error });
                    this.showError('Network error while generating AI variant. Please check your connection and try again.');
                }
            });
        },
        
        // Build AI prompt for variant generation with reflection feedback
        buildVariantPrompt: function(originalExperiment) {
            // Get profile data - use cached data if available, otherwise create fallback
            let topMI = [];
            let curiosities = [];
            let roleModels = [];
            let constraints = {};
            
            // Try to use existing profile data
            if (this.profileData?.mi_results) {
                topMI = this.profileData.mi_results.slice(0, 3);
            }
            
            if (this.qualifiers?.curiosity) {
                curiosities = this.qualifiers.curiosity.curiosities || [];
                roleModels = this.qualifiers.curiosity.roleModels || [];
                constraints = this.qualifiers.curiosity.constraints || {};
            }
            
            // Create meaningful fallbacks if no profile data is available
            if (topMI.length === 0) {
                topMI = [
                    { label: 'Creative Intelligence' },
                    { label: 'Problem-Solving' },
                    { label: 'Learning' }
                ];
            }
            
            if (curiosities.length === 0) {
                curiosities = ['personal growth', 'skill development', 'creative expression'];
            }
            
            if (roleModels.length === 0) {
                roleModels = ['innovative thinkers', 'skilled practitioners', 'growth-minded individuals'];
            }
            
            // Set reasonable constraint defaults
            const timePerWeek = constraints.timePerWeekHours || 3;
            const budget = constraints.budget || 50;
            const risk = constraints.risk || 50;
            
            // Try to get recent reflection feedback for context
            let reflectionContext = '';
            if (this.recentFeedback && this.recentFeedback.length > 0) {
                const feedback = this.recentFeedback[0]; // Most recent feedback
                const feedbackSummary = [];
                
                if (feedback.difficulty) {
                    if (feedback.difficulty >= 4) {
                        feedbackSummary.push('prefers less challenging experiments');
                    } else if (feedback.difficulty <= 2) {
                        feedbackSummary.push('wants more challenging experiments');
                    }
                }
                
                if (feedback.fit) {
                    if (feedback.fit <= 2) {
                        feedbackSummary.push('needs better personalization');
                    } else if (feedback.fit >= 4) {
                        feedbackSummary.push('good fit with current approach');
                    }
                }
                
                if (feedback.learning) {
                    if (feedback.learning >= 4) {
                        feedbackSummary.push('values high learning content');
                    } else if (feedback.learning <= 2) {
                        feedbackSummary.push('needs more practical learning outcomes');
                    }
                }
                
                if (feedback.evolve_notes) {
                    feedbackSummary.push(`specific request: "${feedback.evolve_notes}"`);
                }
                
                if (feedbackSummary.length > 0) {
                    reflectionContext = `\n\nRecent feedback: ${feedbackSummary.join(', ')}.`;
                }
            }
            
            // Build a rich prompt even with fallback data
            const profileSummary = [
                `Top strengths: ${topMI.map(mi => mi.label).join(', ')}`,
                `Interests: ${curiosities.join(', ')}`,
                `Inspiration: ${roleModels.join(', ')}`,
                `Constraints: ${timePerWeek}h/week, $${budget} budget, ${risk}/100 risk tolerance`
            ].join('\n- ');
            
            const enhancedSystemPrompt = 'Generate a creative variant of the given experiment. Keep the same archetype but change the approach, steps, and success criteria. Make it fresh and engaging while staying true to the user\'s profile. If recent feedback is provided, incorporate those insights to improve the variant. Return only valid JSON with the same structure as the original experiment.';
            
            return {
                system: enhancedSystemPrompt,
                user: `Original experiment: ${JSON.stringify(originalExperiment)}\n\nUser profile:\n- ${profileSummary}${reflectionContext}\n\nCreate a variant that feels different but maintains the same archetype and core intent. Focus on making it more engaging and personally relevant based on their strengths, interests, and any feedback provided.`
            };
        },
        
        // Set recent feedback data for AI variant generation
        setRecentFeedback: function(feedbackData) {
            this.recentFeedback = feedbackData;
        },
        
        // Start an experiment
        startExperiment: function(e) {
            e.preventDefault();
            const experimentIndex = parseInt($(e.target).data('experiment-id'));
            const experiment = this.experiments[experimentIndex];
            
            if (!experiment) return;
            
            this.showLoading('Starting experiment...');
            
            // In a real implementation, this would save the experiment as 'Active' in the database
            // For now, just show the run & reflect interface
            setTimeout(() => {
                this.showRunningExperiment(experiment, experimentIndex);
            }, 1000);
        },
        
        // Show running experiment interface
        showRunningExperiment: function(experiment, experimentId) {
            // Generate personalized Mi Approach based on user's profile
            const miApproach = this.generateMiApproach(experiment);
            
            const html = `
                <div class="lab-running-experiment">
                    <div class="experiment-header">
                        <h2>${experiment.title}</h2>
                        <span class="experiment-status status-active">Active</span>
                    </div>
                    
                    <div class="experiment-details">
                        <div class="experiment-overview">
                            <h3>What You'll Do:</h3>
                            <p class="experiment-description">${this.generateEngagingDescription(experiment)}</p>
                        </div>
                        
                        <div class="experiment-mi-approach">
                            <h3>Mi Approach:</h3>
                            <p class="mi-approach-text">${miApproach}</p>
                        </div>
                        
                        <div class="experiment-steps">
                            <h3>Steps to Complete:</h3>
                            <ul class="steps-checklist">
                                ${experiment.steps.map((step, index) => `
                                    <li>
                                        <input type="checkbox" id="step-${index}">
                                        <label for="step-${index}">${step}</label>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <div class="experiment-effort">
                            <h3>Time & Resources:</h3>
                            <div class="effort-summary">
                                <span class="effort-item">⏱️ ${experiment.effort?.timeHours || 0} hours</span>
                                <span class="effort-item">💰 $${experiment.effort?.budgetUSD || 0}</span>
                                <span class="effort-item risk-${(experiment.riskLevel || 'medium').toLowerCase()}">🎯 ${experiment.riskLevel || 'Medium'} Risk</span>
                            </div>
                        </div>
                        
                        <div class="success-criteria">
                            <h3>Success Criteria:</h3>
                            <ul class="criteria-checklist">
                                ${(experiment.successCriteria || []).map((criteria, index) => `
                                    <li>
                                        <input type="checkbox" id="criteria-${index}">
                                        <label for="criteria-${index}">${criteria}</label>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="experiment-actions">
                        <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.showExperiments()">Back to Experiments</button>
                        <button class="lab-btn lab-btn-primary lab-reflect-btn" data-experiment-id="${experimentId}">Complete & Reflect</button>
                    </div>
                </div>
            `;
            
            $('#lab-mode-app').html(html);
            this.currentStep = 'running';
        },
        
        // Show reflection form
        showReflectionForm: function(e) {
            e.preventDefault();
            const experimentId = $(e.target).data('experiment-id');
            
            const html = `
                <div class="lab-reflection">
                    <h2>Reflection & Feedback</h2>
                    <p>Help us improve future suggestions by sharing how this experiment went.</p>
                    
                    <form class="lab-reflection-form" data-experiment-id="${experimentId}">
                        <div class="reflection-ratings">
                            <div class="rating-group">
                                <label>Difficulty (1 = Too Easy, 5 = Too Hard)</label>
                                <div class="rating-buttons">
                                    ${[1,2,3,4,5].map(n => `
                                        <input type="radio" name="difficulty" value="${n}" id="diff-${n}" required>
                                        <label for="diff-${n}">${n}</label>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="rating-group">
                                <label>Fit (1 = Poor Match, 5 = Perfect Fit)</label>
                                <div class="rating-buttons">
                                    ${[1,2,3,4,5].map(n => `
                                        <input type="radio" name="fit" value="${n}" id="fit-${n}" required>
                                        <label for="fit-${n}">${n}</label>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="rating-group">
                                <label>Learning Value (1 = No Growth, 5 = Major Growth)</label>
                                <div class="rating-buttons">
                                    ${[1,2,3,4,5].map(n => `
                                        <input type="radio" name="learning" value="${n}" id="learn-${n}" required>
                                        <label for="learn-${n}">${n}</label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        
                        <div class="reflection-notes">
                            <label>What surprised you? (optional)</label>
                            <textarea name="notes" rows="3" placeholder="Any insights, unexpected outcomes, or thoughts about the process..."></textarea>
                        </div>
                        
                        <div class="next-action">
                            <label>Next Action:</label>
                            <div class="action-buttons">
                                <input type="radio" name="next_action" value="Repeat" id="action-repeat" required>
                                <label for="action-repeat">Repeat</label>
                                
                                <input type="radio" name="next_action" value="Evolve" id="action-evolve" required>
                                <label for="action-evolve">Evolve</label>
                                
                                <input type="radio" name="next_action" value="Archive" id="action-archive" required>
                                <label for="action-archive">Archive</label>
                            </div>
                        </div>
                        
                        <div class="evolve-notes" style="display:none;">
                            <label>What to change next time?</label>
                            <textarea name="evolve_notes" rows="2" placeholder="Specific adjustments for the next iteration..."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="lab-btn lab-btn-secondary" onclick="LabModeApp.showExperiments()">Cancel</button>
                            <button type="submit" class="lab-btn lab-btn-primary">Submit Reflection</button>
                        </div>
                    </form>
                </div>
            `;
            
            $('#lab-mode-app').html(html);
            
            // Show/hide evolve notes based on selection
            $(document).on('change', 'input[name="next_action"]', function() {
                const evolveNotesDiv = $('.evolve-notes');
                if (this.value === 'Evolve') {
                    evolveNotesDiv.show();
                    evolveNotesDiv.find('textarea').prop('required', true);
                } else {
                    evolveNotesDiv.hide();
                    evolveNotesDiv.find('textarea').prop('required', false);
                }
            });
            
            this.currentStep = 'reflection';
        },
        
        // Submit reflection feedback
        submitReflection: function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const experimentId = $(e.target).data('experiment-id');
            
            const reflection = {
                experiment_id: experimentId,
                difficulty: parseInt(formData.get('difficulty')),
                fit: parseInt(formData.get('fit')),
                learning: parseInt(formData.get('learning')),
                notes: formData.get('notes') || '',
                next_action: formData.get('next_action'),
                evolve_notes: formData.get('evolve_notes') || ''
            };
            
            this.showLoading('Submitting reflection and recalibrating...');
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_submit_reflection',
                    nonce: labMode.nonce,
                    reflection: JSON.stringify(reflection)
                },
                success: (response) => {
                    if (response.success) {
                        this.showRecalibrationSummary(response.data.recalibration);
                    } else {
                        this.showError(response.data || 'Failed to submit reflection');
                    }
                },
                error: () => {
                    this.showError('Network error while submitting reflection');
                }
            });
        },
        
        // Show recalibration summary
        showRecalibrationSummary: function(recalibration) {
            const html = `
                <div class="lab-recalibration">
                    <h2>Recalibration Complete</h2>
                    <div class="recalibration-summary">
                        <h3>What Changed:</h3>
                        <p>${recalibration.summary}</p>
                        
                        <div class="recalibration-details">
                            <h4>Updated Preferences:</h4>
                            <ul>
                                <li>Risk Bias: ${recalibration.risk_bias}</li>
                                <li>Solo/Group Bias: ${recalibration.solo_group_bias}</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="recalibration-actions">
                        <button class="lab-btn lab-btn-primary" onclick="LabModeApp.generateNextIteration()">Generate Next Iteration</button>
                        <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.showHistory()">View History</button>
                        <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.loadLandingView()">Start Fresh</button>
                    </div>
                </div>
            `;
            
            $('#lab-mode-app').html(html);
            this.currentStep = 'recalibration';
        },
        
        // Generate next iteration of experiments
        generateNextIteration: function() {
            this.showLoading('Generating evolved experiments based on your feedback...');
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_recalibrate',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    if (response.success) {
                        this.experiments = response.data.experiments;
                        this.showExperiments();
                    } else {
                        this.showError(response.data || 'Failed to generate evolved experiments');
                    }
                },
                error: () => {
                    this.showError('Network error while generating evolved experiments');
                }
            });
        },
        
        // Show experiment history
        showHistory: function() {
            this.showLoading('Loading your experiment history...');
            
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_get_history',
                    nonce: labMode.nonce
                },
                success: (response) => {
                    if (response.success) {
                        this.displayHistory(response.data);
                    } else {
                        this.showError(response.data || 'Failed to load history');
                    }
                },
                error: () => {
                    this.showError('Network error while loading history');
                }
            });
        },
        
        // Display experiment history
        displayHistory: function(experiments) {
            // Extract recent feedback for AI variant generation
            const recentFeedbackData = [];
            experiments.forEach(exp => {
                if (exp.feedback && exp.feedback.length > 0) {
                    recentFeedbackData.push(...exp.feedback);
                }
            });
            
            // Sort by most recent and store for AI variant generation
            recentFeedbackData.sort((a, b) => {
                const dateA = new Date(a.submitted_at || 0);
                const dateB = new Date(b.submitted_at || 0);
                return dateB - dateA;
            });
            
            // Set recent feedback for AI variant generation
            this.setRecentFeedback(recentFeedbackData.slice(0, 3)); // Keep last 3 feedback entries
            
            const html = `
                <div class="lab-history">
                    <h2>Experiment History</h2>
                    <p>Timeline of your experiments with status and key metrics.</p>
                    
                    <div class="history-timeline">
                        ${experiments.length === 0 ? `
                            <div class="no-experiments">
                                <p>No experiments yet. <a href="#" onclick="LabModeApp.startProfileInputs(event)">Create your first experiment</a>.</p>
                            </div>
                        ` : experiments.map((exp, index) => {
                            const hasReflection = exp.feedback && exp.feedback.length > 0;
                            const canReflect = exp.status === 'Active' || exp.status === 'Completed';
                            
                            return `
                            <div class="history-item status-${exp.status.toLowerCase()}" data-experiment-id="${exp.id}">
                                <div class="history-header">
                                    <h3 class="clickable-title" onclick="LabModeApp.viewExperimentFromHistory(${exp.id})">${exp.experiment_data.title}</h3>
                                    <div class="history-meta">
                                        <span class="status-badge status-${exp.status.toLowerCase()}">${exp.status}</span>
                                        <span class="archetype-badge">${exp.archetype}</span>
                                        <span class="date">${new Date(exp.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <p class="history-rationale">${exp.experiment_data.rationale || exp.experiment_data.description || 'No description available.'}</p>
                                
                                <div class="history-item-actions">
                                    <button class="lab-btn lab-btn-small lab-btn-secondary" onclick="LabModeApp.viewExperimentFromHistory(${exp.id})">View Details</button>
                                    ${canReflect && !hasReflection ? `
                                        <button class="lab-btn lab-btn-small lab-btn-primary" onclick="LabModeApp.showReflectionFormFromHistory(${exp.id})">Complete & Reflect</button>
                                    ` : ''}
                                    ${hasReflection ? `
                                        <span class="reflection-status">✅ Reflected</span>
                                    ` : ''}
                                </div>
                                
                                ${hasReflection ? `
                                    <div class="reflection-summary">
                                        <strong>Your reflection:</strong> ${exp.feedback[0].notes || 'No notes provided'}
                                        ${exp.feedback[0].evolve_notes ? `<br><strong>Evolution notes:</strong> ${exp.feedback[0].evolve_notes}` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="history-actions">
                        <button class="lab-btn lab-btn-secondary" onclick="LabModeApp.loadLandingView()">Back to Start</button>
                    </div>
                </div>
            `;
            
            $('#lab-mode-app').html(html);
            this.currentStep = 'history';
        },
        
        // View experiment from history
        viewExperimentFromHistory: function(experimentId) {
            this.showLoading('Loading experiment details...');
            
            // Get experiment data from server
            $.ajax({
                url: labMode.ajaxUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'mc_lab_get_experiment',
                    nonce: labMode.nonce,
                    experiment_id: experimentId
                },
                success: (response) => {
                    if (response.success && response.data) {
                        const experiment = response.data.experiment_data;
                        this.showRunningExperiment(experiment, experimentId);
                    } else {
                        this.showError('Failed to load experiment details');
                    }
                },
                error: () => {
                    this.showError('Network error while loading experiment');
                }
            });
        },
        
        // Show reflection form for experiment from history
        showReflectionFormFromHistory: function(experimentId) {
            this.showReflectionForm({ preventDefault: () => {}, target: { dataset: { experimentId: experimentId } } });
        }
    };

    // Initialize Lab Mode when called
    function initializeLabMode() {
        if ($('#lab-mode-app').length > 0 && !window.LabModeAppInitialized) {
            console.log('Initializing Lab Mode...');
            LabModeApp.init();
            return true;
        }
        return false;
    }
    
    // Make initialization function globally available
    window.initializeLabMode = initializeLabMode;
    
    // Auto-initialize when document is ready
    $(document).ready(function() {
        initializeLabMode();
        
        // Also try when Lab Mode tab is clicked
        $(document).on('click', '[data-tab="tab-lab"]', function() {
            setTimeout(initializeLabMode, 100);
        });
    });
    
    // Fallback initialization on window load
    $(window).on('load', function() {
        initializeLabMode();
    });

})(jQuery);
