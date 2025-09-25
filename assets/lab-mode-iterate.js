/**
 * ExperimentIterationPanel - Interactive modal for refining experiments
 * Handles single-modifier iteration with AI to iteratively improve experiments
 */

(function($) {
    'use strict';

    window.IterationPanel = {
        isOpen: false,
        currentExperiment: null,
        originalExperiment: null,
        currentIndex: null,
        iterations: [],
        currentIteration: 0,
        userContext: null,
        isLoading: false,
        focusedElementBeforeOpen: null,
        focusableElements: null,
        firstFocusableElement: null,
        lastFocusableElement: null,

        /**
         * Open the iteration panel with an experiment
         * @param {Object} experiment - The experiment object to iterate on
         * @param {number} index - Index in the experiments array
         * @param {Object} context - User context (MI, CDT, role models, etc.)
         */
        open: function(experiment, index, context = null) {
            console.log('IterationPanel.open called', { experiment, index, context });
            
            if (this.isOpen) {
                console.warn('IterationPanel already open');
                return;
            }

            this.currentExperiment = $.extend(true, {}, experiment);
            this.originalExperiment = $.extend(true, {}, experiment);
            this.currentIndex = index;
            this.iterations = [$.extend(true, {}, experiment)];
            this.currentIteration = 0;
            this.userContext = context || this.getUserContext();
            this.debugHistory = []; // Initialize debug history
            this.isOpen = true;

            // Store current focus
            this.focusedElementBeforeOpen = document.activeElement;

            // Create modal if it doesn't exist
            if (!document.getElementById('iteration-modal')) {
                this.createModal();
            }

            // Populate and show modal
            this.populateModal();
            $('#iteration-modal').addClass('active').attr('aria-hidden', 'false');
            
            // Set up focus management
            this.setupFocusTrap();
            this.firstFocusableElement?.focus();

            // Prevent background scrolling
            $('body').addClass('modal-open');

            console.log('IterationPanel opened successfully');
        },

        /**
         * Close the iteration panel
         */
        close: function() {
            if (!this.isOpen) return;

            $('#iteration-modal').removeClass('active').attr('aria-hidden', 'true');
            $('body').removeClass('modal-open');
            
            // Restore focus
            if (this.focusedElementBeforeOpen) {
                this.focusedElementBeforeOpen.focus();
            }

            // Reset state
            this.isOpen = false;
            this.currentExperiment = null;
            this.originalExperiment = null;
            this.currentIndex = null;
            this.iterations = [];
            this.currentIteration = 0;
            this.userContext = null;
            this.debugHistory = [];
            this.isLoading = false;
            
            // Clear any debug panels or notifications
            $('.iteration-debug-panel').remove();
            $('.version-notification').remove();
            
            console.log('IterationPanel closed');
        },

        /**
         * Create the modal DOM structure
         */
        createModal: function() {
            const modalHTML = `
                <div id="iteration-modal" class="iteration-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="iteration-modal-title" tabindex="-1">
                    <div class="iteration-backdrop" role="presentation"></div>
                    <div class="iteration-dialog">
                        <div class="iteration-header">
                            <h2 id="iteration-modal-title">Refine Experiment</h2>
                            <button type="button" class="iteration-close-btn" aria-label="Close iteration panel">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="iteration-content">
                            <div class="iteration-columns">
                                <div class="iteration-left">
                                    <div class="iteration-current-experiment">
                                        <div class="iteration-breadcrumb">
                                            <span class="iteration-version">Version 1</span>
                                        </div>
                                        <div class="experiment-display">
                                            <!-- Current experiment content will be populated here -->
                                        </div>
                                        <div class="iteration-diff-notice" style="display: none;">
                                            <small class="iteration-calibration-notes"></small>
                                        </div>
                                    </div>
                                </div>
                                <div class="iteration-right">
                                    <div class="iteration-controls">
                                        <div class="iteration-section-header">
                                            <span class="iteration-section-label">Refine with One Change</span>
                                            <small class="iteration-section-subtitle">Each click sends exactly ONE modifier</small>
                                        </div>
                                        
                                        <!-- Custom Input Section -->
                                        <div class="iteration-custom-input">
                                            <div class="custom-input-header">
                                                <span class="modifier-emoji">✏️</span>
                                                <span class="modifier-label">Custom Request</span>
                                            </div>
                                            <div class="custom-input-body">
                                                <textarea 
                                                    id="iteration-custom-text" 
                                                    placeholder="Describe the specific change you want... (e.g., 'Add a team building element', 'Make it work for remote teams', 'Include measurable outcomes')"
                                                    rows="3"
                                                    maxlength="500"
                                                    aria-label="Custom modification request"
                                                ></textarea>
                                                <div class="custom-input-actions">
                                                    <div class="char-counter">
                                                        <span class="char-count">0</span>/500
                                                    </div>
                                                    <button type="button" class="iteration-modifier-btn iteration-custom-btn" data-mod-type="Custom" title="Apply your custom modification">
                                                        Apply Custom Change
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="iteration-divider">
                                            <span>Or choose a quick modifier</span>
                                        </div>
                                        
                                        <div class="iteration-modifier-groups">
                                            <!-- Modifier controls will be populated here -->
                                        </div>
                                        <div class="iteration-loading" style="display: none;">
                                            <div class="loading-spinner"></div>
                                            <span>AI is refining your experiment...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="iteration-footer">
                            <div class="iteration-footer-left">
                                <button type="button" class="lab-btn lab-btn-tertiary iteration-reset-btn">Reset to Original</button>
                            </div>
                            <div class="iteration-footer-right">
                                <button type="button" class="lab-btn lab-btn-secondary iteration-close-btn-footer">Close</button>
                                <button type="button" class="lab-btn lab-btn-primary iteration-save-btn">Apply Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            $('body').append(modalHTML);
            this.bindModalEvents();
        },

        /**
         * Bind modal-specific events
         */
        bindModalEvents: function() {
            // Close button events
            $(document).on('click', '.iteration-close-btn, .iteration-close-btn-footer', (e) => {
                e.preventDefault();
                this.close();
            });

            // Backdrop click to close
            $(document).on('click', '.iteration-backdrop', (e) => {
                e.preventDefault();
                this.close();
            });

            // ESC key to close
            $(document).on('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    e.preventDefault();
                    this.close();
                }
            });

            // Tab key focus management
            $(document).on('keydown', (e) => {
                if (e.key === 'Tab' && this.isOpen) {
                    this.handleTabKey(e);
                }
            });

            // Reset button
            $(document).on('click', '.iteration-reset-btn', (e) => {
                e.preventDefault();
                this.resetToOriginal();
            });

            // Save/Apply button
            $(document).on('click', '.iteration-save-btn', (e) => {
                e.preventDefault();
                this.saveAndApply();
            });

            // Modifier buttons (delegated)
            $(document).on('click', '.iteration-modifier-btn', (e) => {
                e.preventDefault();
                if (this.isLoading) return;
                
                const $btn = $(e.currentTarget);
                const modType = $btn.data('mod-type');
                const modValue = $btn.data('mod-value');
                
                // Handle custom input differently
                if (modType === 'Custom') {
                    this.handleCustomModifier();
                } else {
                    this.sendModifier({
                        kind: modType,
                        value: modValue
                    });
                }
            });
            
            // Character counter for custom input
            $(document).on('input', '#iteration-custom-text', (e) => {
                const text = $(e.target).val();
                const charCount = text.length;
                $('.char-count').text(charCount);
                
                // Enable/disable custom button based on input
                const $customBtn = $('.iteration-custom-btn');
                if (charCount > 0 && charCount <= 500) {
                    $customBtn.prop('disabled', false);
                } else {
                    $customBtn.prop('disabled', true);
                }
            });
            
            // Enter key in custom textarea to trigger submission
            $(document).on('keydown', '#iteration-custom-text', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.handleCustomModifier();
                }
            });
        },

        /**
         * Set up focus trap for accessibility
         */
        setupFocusTrap: function() {
            this.focusableElements = $('#iteration-modal').find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            this.firstFocusableElement = this.focusableElements.first()[0];
            this.lastFocusableElement = this.focusableElements.last()[0];
        },

        /**
         * Handle tab key for focus trapping
         */
        handleTabKey: function(e) {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === this.firstFocusableElement) {
                    e.preventDefault();
                    this.lastFocusableElement?.focus();
                }
            } else {
                // Tab
                if (document.activeElement === this.lastFocusableElement) {
                    e.preventDefault();
                    this.firstFocusableElement?.focus();
                }
            }
        },

        /**
         * Populate the modal with experiment data and controls
         */
        populateModal: function() {
            this.renderCurrentExperiment();
            this.renderModifierControls();
            this.updateBreadcrumb();
            this.initializeCustomInput();
        },

        /**
         * Render the current experiment in the left column
         */
        renderCurrentExperiment: function() {
            const exp = this.currentExperiment;
            const originalExp = this.originalExperiment;
            
            const experimentHTML = `
                <div class="experiment-card-display">
                    <div class="experiment-header">
                        <h3 class="experiment-title">${this.renderWithDiff('title', exp.title, originalExp.title)}</h3>
                        <span class="archetype-badge archetype-${exp.archetype?.toLowerCase() || 'discover'}">${exp.archetype || 'Discover'}</span>
                    </div>
                    
                    <div class="experiment-body">
                        <div class="experiment-rationale">
                            <h4>Why This Fits You:</h4>
                            <p>${this.renderWithDiff('rationale', exp.rationale || '', originalExp.rationale || '')}</p>
                        </div>
                        
                        <div class="experiment-steps">
                            <h4>Steps:</h4>
                            <ol>
                                ${(exp.steps || []).map((step, idx) => 
                                    `<li>${this.renderWithDiff(`steps[${idx}]`, step, (originalExp.steps || [])[idx] || '')}</li>`
                                ).join('')}
                            </ol>
                        </div>
                        
                        <div class="experiment-effort">
                            <div class="effort-display">
                                <span class="effort-time">${this.renderWithDiff('timeHours', exp.effort?.timeHours || 0, originalExp.effort?.timeHours || 0)}h</span>
                                <span class="effort-budget">$${this.renderWithDiff('budgetUSD', exp.effort?.budgetUSD || 0, originalExp.effort?.budgetUSD || 0)}</span>
                                <span class="risk-level risk-${(exp.riskLevel || 'medium').toLowerCase()}">${this.renderWithDiff('riskLevel', exp.riskLevel || 'Medium', originalExp.riskLevel || 'Medium')}</span>
                            </div>
                        </div>
                        
                        <div class="success-criteria">
                            <h4>Success Criteria:</h4>
                            <ul>
                                ${(exp.successCriteria || []).map((criteria, idx) => 
                                    `<li>${this.renderWithDiff(`successCriteria[${idx}]`, criteria, (originalExp.successCriteria || [])[idx] || '')}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            $('.experiment-display').html(experimentHTML);
        },

        /**
         * Render text with diff highlighting and HTML sanitization
         */
        renderWithDiff: function(field, current, original) {
            // Basic HTML sanitization - escape HTML entities
            const sanitizeCurrent = $('<div>').text(current).html();
            const sanitizeOriginal = $('<div>').text(original).html();
            
            if (sanitizeCurrent !== sanitizeOriginal) {
                return `<span class="diff-changed" data-field="${this.sanitizeAttr(field)}">${sanitizeCurrent}</span>`;
            }
            return sanitizeCurrent;
        },
        
        /**
         * Sanitize HTML attribute values
         */
        sanitizeAttr: function(value) {
            return $('<div>').attr('data-temp', value).attr('data-temp');
        },

        /**
         * Render modifier controls in the right column
         */
        renderModifierControls: function() {
            const context = this.userContext || {};
            
            const modifierGroupsHTML = `
                <!-- Cost Controls -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">💸</span>
                        <span class="modifier-label">Cost</span>
                    </div>
                    <div class="modifier-buttons">
                        <button class="iteration-modifier-btn" data-mod-type="Cost" data-mod-value="Cheaper" title="Reduce budgetUSD and/or use free resources">Cheaper</button>
                        <button class="iteration-modifier-btn" data-mod-type="Cost" data-mod-value="More Expensive" title="Allow paid tools or materials">More Expensive</button>
                        <button class="iteration-modifier-btn" data-mod-type="Cost" data-mod-value="Max Value" title="Optimize impact per dollar">Max Value</button>
                    </div>
                </div>

                <!-- Time Controls -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">⏱️</span>
                        <span class="modifier-label">Time</span>
                    </div>
                    <div class="modifier-buttons">
                        <button class="iteration-modifier-btn" data-mod-type="Time" data-mod-value="Faster" title="Complete in less time; simplify steps">Faster</button>
                        <button class="iteration-modifier-btn" data-mod-type="Time" data-mod-value="Slower" title="Allow more depth; extend time block">Slower</button>
                        <button class="iteration-modifier-btn" data-mod-type="Time" data-mod-value="Long-term" title="Convert to a repeatable multi-week plan">Long-term</button>
                    </div>
                </div>

                <!-- Role Models -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">⭐</span>
                        <span class="modifier-label">Role Models</span>
                    </div>
                    <div class="modifier-buttons">
                        ${this.renderRoleModelButtons()}
                    </div>
                </div>

                <!-- Style Controls -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">🎛️</span>
                        <span class="modifier-label">Style</span>
                    </div>
                    <div class="modifier-buttons">
                        <button class="iteration-modifier-btn" data-mod-type="Style" data-mod-value="More Creative">More Creative</button>
                        <button class="iteration-modifier-btn" data-mod-type="Style" data-mod-value="More Structured">More Structured</button>
                        <button class="iteration-modifier-btn" data-mod-type="Style" data-mod-value="More Social">More Social</button>
                    </div>
                </div>

                <!-- Constraints Controls -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">🧭</span>
                        <span class="modifier-label">Constraints</span>
                    </div>
                    <div class="modifier-buttons">
                        <button class="iteration-modifier-btn" data-mod-type="Constraint" data-mod-value="Safer">Safer</button>
                        <button class="iteration-modifier-btn" data-mod-type="Constraint" data-mod-value="Riskier">Riskier</button>
                        <button class="iteration-modifier-btn" data-mod-type="Constraint" data-mod-value="Solo">Solo</button>
                        <button class="iteration-modifier-btn" data-mod-type="Constraint" data-mod-value="Group">Group</button>
                    </div>
                </div>

                <!-- Curiosity Controls -->
                <div class="modifier-group">
                    <div class="modifier-group-header">
                        <span class="modifier-emoji">🎯</span>
                        <span class="modifier-label">Curiosity / Context</span>
                    </div>
                    <div class="modifier-buttons">
                        ${this.renderCuriosityButtons()}
                    </div>
                </div>
            `;

            $('.iteration-modifier-groups').html(modifierGroupsHTML);
        },

        /**
         * Render role model buttons based on user context
         */
        renderRoleModelButtons: function() {
            const roleModels = this.userContext?.roleModels || [];
            
            if (roleModels.length === 0) {
                return '<p class="modifier-empty">No role models configured</p>';
            }

            return roleModels.slice(0, 5).map(model => 
                `<button class="iteration-modifier-btn" data-mod-type="RoleModel" data-mod-value="${model}">${model}</button>`
            ).join('');
        },

        /**
         * Render curiosity buttons based on user context
         */
        renderCuriosityButtons: function() {
            const curiosities = this.userContext?.curiosities || [];
            
            if (curiosities.length === 0) {
                return '<p class="modifier-empty">No curiosities configured</p>';
            }

            return curiosities.slice(0, 4).map(curiosity => 
                `<button class="iteration-modifier-btn modifier-btn-chip" data-mod-type="Curiosity" data-mod-value="${curiosity}">${curiosity}</button>`
            ).join('');
        },

        /**
         * Update the version breadcrumb with clickable navigation
         */
        updateBreadcrumb: function() {
            const totalVersions = this.iterations.length;
            const currentVersion = this.currentIteration + 1;
            
            let breadcrumbHTML = '<div class="breadcrumb-versions">';
            for (let i = 0; i < totalVersions; i++) {
                const isActive = i === this.currentIteration;
                breadcrumbHTML += `<button type="button" class="version-link ${isActive ? 'active' : ''}" data-version="${i}" title="View version ${i + 1}">v${i + 1}</button>`;
                if (i < totalVersions - 1) {
                    breadcrumbHTML += '<span class="version-separator"> / </span>';
                }
            }
            breadcrumbHTML += '</div>';
            
            // Add debug toggle if multiple versions exist
            if (totalVersions > 1) {
                breadcrumbHTML += '<button type="button" class="debug-toggle-btn" title="Show AI request debug info">🐛 Debug</button>';
            }
            
            $('.iteration-breadcrumb').html(breadcrumbHTML);
            
            // Bind version navigation events
            $('.version-link').off('click').on('click', (e) => {
                const versionIndex = parseInt($(e.target).data('version'));
                this.navigateToVersion(versionIndex);
            });
            
            // Bind debug toggle event
            $('.debug-toggle-btn').off('click').on('click', () => {
                this.toggleDebugPanel();
            });
        },

        /**
         * Navigate to a specific version in the iteration history
         */
        navigateToVersion: function(versionIndex) {
            if (versionIndex < 0 || versionIndex >= this.iterations.length) {
                console.error('Invalid version index:', versionIndex);
                return;
            }
            
            console.log('Navigating to version:', versionIndex + 1);
            
            this.currentIteration = versionIndex;
            this.currentExperiment = $.extend(true, {}, this.iterations[versionIndex]);
            
            // Update UI
            this.populateModal();
            
            // Show a brief notification
            this.showVersionNotification(versionIndex + 1);
        },
        
        /**
         * Show notification when switching versions
         */
        showVersionNotification: function(versionNumber) {
            // Remove existing notification
            $('.version-notification').remove();
            
            const notification = `
                <div class="version-notification">
                    <span class="version-icon">↻</span>
                    Now viewing version ${versionNumber}
                </div>
            `;
            
            $('.iteration-breadcrumb').after(notification);
            
            // Auto-hide after 2 seconds
            setTimeout(() => {
                $('.version-notification').fadeOut(() => {
                    $('.version-notification').remove();
                });
            }, 2000);
        },
        
        /**
         * Toggle debug panel visibility
         */
        toggleDebugPanel: function() {
            const debugPanel = $('.iteration-debug-panel');
            
            if (debugPanel.length === 0) {
                // Create and show debug panel
                this.createDebugPanel();
            } else {
                // Toggle existing panel
                debugPanel.toggle();
                const isVisible = debugPanel.is(':visible');
                $('.debug-toggle-btn').text(isVisible ? '🐛 Hide Debug' : '🐛 Debug');
            }
        },
        
        /**
         * Create the debug panel showing AI request history
         */
        createDebugPanel: function() {
            const debugHistory = this.getDebugHistory();
            
            const debugHTML = `
                <div class="iteration-debug-panel">
                    <div class="debug-panel-header">
                        <h4>🐛 AI Request Debug History</h4>
                        <button type="button" class="debug-close-btn" title="Close debug panel">&times;</button>
                    </div>
                    <div class="debug-panel-content">
                        ${debugHistory.map((entry, index) => `
                            <div class="debug-entry" data-version="${index + 1}">
                                <div class="debug-entry-header">
                                    <h5>Version ${index + 1} → Version ${index + 2}</h5>
                                    <span class="debug-timestamp">${entry.timestamp}</span>
                                </div>
                                <div class="debug-entry-body">
                                    <div class="debug-section">
                                        <h6>Modifier Sent:</h6>
                                        <pre class="debug-code">${JSON.stringify(entry.modifier, null, 2)}</pre>
                                    </div>
                                    <div class="debug-section">
                                        <h6>System Prompt:</h6>
                                        <div class="debug-prompt">${this.truncateText(entry.systemPrompt, 300)}</div>
                                        ${entry.systemPrompt.length > 300 ? '<button class="debug-expand-btn" data-type="system" data-index="' + index + '">Show Full Prompt</button>' : ''}
                                    </div>
                                    <div class="debug-section">
                                        <h6>User Prompt Preview:</h6>
                                        <div class="debug-prompt">${this.truncateText(entry.userPrompt, 200)}</div>
                                        ${entry.userPrompt.length > 200 ? '<button class="debug-expand-btn" data-type="user" data-index="' + index + '">Show Full Prompt</button>' : ''}
                                    </div>
                                    <div class="debug-section">
                                        <h6>AI Response:</h6>
                                        <div class="debug-response">
                                            <strong>Changed Fields:</strong> ${entry.changedFields.join(', ')}<br>
                                            <strong>Calibration:</strong> ${entry.calibrationNotes || 'None'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            $('.iteration-breadcrumb').after(debugHTML);
            
            // Bind debug panel events
            $('.debug-close-btn').on('click', () => {
                $('.iteration-debug-panel').hide();
                $('.debug-toggle-btn').text('🐛 Debug');
            });
            
            // Bind expand button events
            $('.debug-expand-btn').on('click', (e) => {
                const $btn = $(e.target);
                const type = $btn.data('type');
                const index = $btn.data('index');
                const entry = debugHistory[index];
                const fullText = type === 'system' ? entry.systemPrompt : entry.userPrompt;
                
                $btn.prev('.debug-prompt').html(fullText);
                $btn.remove();
            });
            
            $('.debug-toggle-btn').text('🐛 Hide Debug');
        },
        
        /**
         * Get debug history for AI requests
         */
        getDebugHistory: function() {
            // Return stored debug entries from iterations
            return this.debugHistory || [];
        },
        
        /**
         * Truncate text for debug display
         */
        truncateText: function(text, maxLength) {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
        },
        
        /**
         * Store debug information for an AI request
         */
        storeDebugInfo: function(modifier, systemPrompt, userPrompt, response) {
            if (!this.debugHistory) {
                this.debugHistory = [];
            }
            
            this.debugHistory.push({
                timestamp: new Date().toLocaleTimeString(),
                modifier: modifier,
                systemPrompt: systemPrompt,
                userPrompt: userPrompt,
                changedFields: response.changedFields || [],
                calibrationNotes: response.calibrationNotes
            });
            
            console.log('Debug info stored:', this.debugHistory.length, 'entries');
        },
        
        /**
         * Initialize the custom input section
         */
        initializeCustomInput: function() {
            // Clear any previous input
            $('#iteration-custom-text').val('');
            $('.char-count').text('0');
            $('.iteration-custom-btn').prop('disabled', true);
        },
        
        /**
         * Handle custom text input modifier
         */
        handleCustomModifier: function() {
            const customText = $('#iteration-custom-text').val().trim();
            
            if (!customText) {
                this.showError('Please enter a custom modification request.');
                return;
            }
            
            if (customText.length > 500) {
                this.showError('Custom request is too long. Please keep it under 500 characters.');
                return;
            }
            
            // Clear the input after successful submission
            const modifier = {
                kind: 'Custom',
                value: customText
            };
            
            this.sendModifier(modifier);
            
            // Clear the textarea after sending
            $('#iteration-custom-text').val('');
            $('.char-count').text('0');
            $('.iteration-custom-btn').prop('disabled', true);
        },
        
        /**
         * Send a modifier to the backend for processing
         */
        sendModifier: function(modifier) {
            if (this.isLoading) {
                console.warn('Already processing a modifier');
                return;
            }

            console.log('Sending modifier:', modifier);
            
            this.isLoading = true;
            this.showLoading(true);
            $('.iteration-modifier-btn').prop('disabled', true);

            const requestData = {
                action: 'mc_lab_iterate',
                nonce: window.labMode?.nonce || '',
                currentExperiment: JSON.stringify(this.currentExperiment),
                modifier: JSON.stringify(modifier),
                userContext: JSON.stringify(this.userContext),
                includeDebug: true // Request debug info from backend
            };
            
            // Store modifier for debug purposes
            this.currentModifier = modifier;
            this.requestStartTime = Date.now();

            $.ajax({
                url: window.labMode?.ajaxUrl || '/wp-admin/admin-ajax.php',
                type: 'POST',
                dataType: 'json',
                data: requestData,
                timeout: 30000,
                success: (response) => {
                    this.handleIterateSuccess(response);
                },
                error: (xhr, status, error) => {
                    this.handleIterateError(xhr, status, error);
                },
                complete: () => {
                    this.isLoading = false;
                    this.showLoading(false);
                    $('.iteration-modifier-btn').prop('disabled', false);
                }
            });
        },

        /**
         * Handle successful iteration response
         */
        handleIterateSuccess: function(response) {
            if (response.success && response.data) {
                const { experiment: revisedExperiment, calibrationNotes, changedFields, debug } = response.data;
                
                // Store debug information if available
                if (debug && this.currentModifier) {
                    this.storeDebugInfo(
                        this.currentModifier,
                        debug.systemPrompt || 'System prompt not available',
                        debug.userPrompt || 'User prompt not available',
                        { changedFields, calibrationNotes }
                    );
                }
                
                // Add to iterations history
                this.iterations.push($.extend(true, {}, revisedExperiment));
                this.currentIteration = this.iterations.length - 1;
                this.currentExperiment = $.extend(true, {}, revisedExperiment);
                
                // Update UI
                this.populateModal();
                
                // Show calibration notes if available
                if (calibrationNotes) {
                    $('.iteration-calibration-notes').text(calibrationNotes);
                    $('.iteration-diff-notice').show();
                    
                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        $('.iteration-diff-notice').fadeOut();
                    }, 5000);
                }
                
                console.log('Iteration successful', { revisedExperiment, calibrationNotes, changedFields, debugStored: !!debug });
            } else {
                this.handleIterateError(null, 'error', response.data || 'Unknown error occurred');
            }
        },

        /**
         * Handle iteration error
         */
        handleIterateError: function(xhr, status, error) {
            console.error('Iteration failed:', { xhr, status, error });
            
            let errorMessage = 'Failed to iterate experiment. ';
            
            if (status === 'timeout') {
                errorMessage += 'The request timed out. Please try again.';
            } else if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
                errorMessage += xhr.responseJSON.data;
            } else {
                errorMessage += 'Please check your connection and try again.';
            }
            
            this.showError(errorMessage);
        },

        /**
         * Show loading state
         */
        showLoading: function(show) {
            if (show) {
                $('.iteration-loading').show();
                $('.iteration-modifier-groups').hide();
            } else {
                $('.iteration-loading').hide();
                $('.iteration-modifier-groups').show();
            }
        },

        /**
         * Show error message in the modal
         */
        showError: function(message) {
            // Remove any existing error
            $('.iteration-error').remove();
            
            const errorHTML = `
                <div class="iteration-error" role="alert">
                    <strong>Error:</strong> ${message}
                    <button type="button" class="error-dismiss" aria-label="Dismiss error">&times;</button>
                </div>
            `;
            
            $('.iteration-content').prepend(errorHTML);
            
            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                $('.iteration-error').fadeOut(() => {
                    $('.iteration-error').remove();
                });
            }, 10000);
            
            // Manual dismiss
            $(document).on('click', '.error-dismiss', () => {
                $('.iteration-error').fadeOut(() => {
                    $('.iteration-error').remove();
                });
            });
        },

        /**
         * Reset experiment to original state
         */
        resetToOriginal: function() {
            if (confirm('Reset to the original experiment? This will lose all iterations and debug history.')) {
                this.currentExperiment = $.extend(true, {}, this.originalExperiment);
                this.iterations = [$.extend(true, {}, this.originalExperiment)];
                this.currentIteration = 0;
                this.debugHistory = []; // Clear debug history
                
                this.populateModal();
                $('.iteration-diff-notice').hide();
                $('.iteration-debug-panel').remove(); // Remove debug panel
                
                console.log('Reset to original experiment');
            }
        },

        /**
         * Save changes and apply to the main experiment list
         */
        saveAndApply: function() {
            // Call back to LabModeApp to update the experiment
            if (window.LabModeApp && typeof window.LabModeApp.updateExperiment === 'function') {
                window.LabModeApp.updateExperiment(this.currentIndex, this.currentExperiment);
            } else {
                console.warn('LabModeApp.updateExperiment not available');
            }
            
            this.close();
            console.log('Applied changes and closed panel');
        },

        /**
         * Get user context from LabModeApp or build default
         */
        getUserContext: function() {
            if (window.LabModeApp) {
                const profileData = window.LabModeApp.profileData;
                const qualifiers = window.LabModeApp.qualifiers;
                
                return {
                    mi_top3: profileData?.mi_results?.slice(0, 3) || [],
                    cdt_bottom2: profileData?.cdt_results?.slice(-2) || [],
                    curiosities: qualifiers?.curiosity?.curiosities || [],
                    roleModels: qualifiers?.curiosity?.roleModels || [],
                    constraints: qualifiers?.curiosity?.constraints || {}
                };
            }
            
            return {
                mi_top3: [],
                cdt_bottom2: [],
                curiosities: [],
                roleModels: [],
                constraints: {}
            };
        }
    };

})(jQuery);