/**
 * Quiz Funnel JavaScript
 * Handles click interactions, tooltips, and progress updates
 */
(function($) {
    'use strict';
    
    // Ensure jQuery is available
    if (typeof $ === 'undefined') {
        console.error('MC Funnel: jQuery is not available');
        return;
    }
    
    // Global funnel object
    window.McFunnel = {
        data: null,
        
        init: function() {
            // Check if we have data
            if (typeof mc_funnel_data === 'undefined') {
                console.warn('MC Funnel: No data found');
                return;
            }
            
            this.data = mc_funnel_data;
            this.bindEvents();
            this.updateStepStates();
            this.setupAccessibility();
            
            // Listen for quiz completion events to refresh
            $(document).on('mc-quiz-completed', this.handleQuizCompletion.bind(this));
        },
        
        bindEvents: function() {
            const self = this;
            
            // Handle step clicks
            $('.mc-funnel-step').on('click', function(e) {
                e.preventDefault();
                self.handleStepClick($(this));
            });
            
            // Handle keyboard navigation
            $('.mc-funnel-step').on('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    self.handleStepClick($(this));
                }
            });
            
            // Handle hover effects for tooltips
            $('.mc-funnel-step.locked').on('mouseenter', function() {
                self.showTooltip($(this));
            }).on('mouseleave', function() {
                self.hideTooltip($(this));
            });
        },
        
        handleStepClick: function($step) {
            const slug = $step.data('slug');
            const url = $step.data('url');
            
            // Check if step is available
            if (!$step.hasClass('available')) {
                this.showLockedMessage($step);
                return;
            }
            
            // Check if we have a URL to navigate to
            if (!url) {
                console.warn('MC Funnel: No URL found for step', slug);
                this.showErrorMessage('This step is not yet configured.');
                return;
            }
            
            // Add loading state
            $step.addClass('navigating');
            
            // Navigate to the quiz
            window.location.href = url;
        },
        
        showLockedMessage: function($step) {
            const slug = $step.data('slug');
            const index = $step.data('index');
            
            let message;
            if (slug === 'placeholder') {
                message = 'This module is coming soon! Complete all assessments first.';
            } else {
                const prevIndex = index - 1;
                message = `Complete Step ${prevIndex} first to unlock this assessment.`;
            }
            
            this.showNotification(message, 'info');
        },
        
        showErrorMessage: function(message) {
            this.showNotification(message, 'error');
        },
        
        showNotification: function(message, type = 'info') {
            // Remove any existing notifications
            $('.mc-funnel-notification').remove();
            
            const $notification = $(`
                <div class="mc-funnel-notification mc-funnel-notification--${type}">
                    <span class="mc-funnel-notification__icon">${type === 'error' ? '⚠️' : 'ℹ️'}</span>
                    <span class="mc-funnel-notification__message">${message}</span>
                    <button class="mc-funnel-notification__close" type="button" aria-label="Close">&times;</button>
                </div>
            `);
            
            $('.mc-funnel-container').prepend($notification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                $notification.fadeOut(() => $notification.remove());
            }, 5000);
            
            // Handle close button
            $notification.find('.mc-funnel-notification__close').on('click', function() {
                $notification.fadeOut(() => $notification.remove());
            });
        },
        
        showTooltip: function($step) {
            const slug = $step.data('slug');
            const index = $step.data('index');
            
            let tooltipText;
            if (slug === 'placeholder') {
                tooltipText = 'Complete all assessments to unlock this feature';
            } else {
                const prevIndex = index - 1;
                tooltipText = `Complete Step ${prevIndex} to unlock`;
            }
            
            // Remove existing tooltips
            $('.mc-funnel-tooltip').remove();
            
            const $tooltip = $(`
                <div class="mc-funnel-tooltip">
                    ${tooltipText}
                    <div class="mc-funnel-tooltip__arrow"></div>
                </div>
            `);
            
            $('body').append($tooltip);
            
            // Position tooltip
            const stepRect = $step[0].getBoundingClientRect();
            const tooltipWidth = $tooltip.outerWidth();
            const tooltipHeight = $tooltip.outerHeight();
            
            const left = stepRect.left + (stepRect.width / 2) - (tooltipWidth / 2);
            const top = stepRect.top - tooltipHeight - 10;
            
            $tooltip.css({
                position: 'fixed',
                left: Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10)),
                top: Math.max(10, top),
                zIndex: 1000
            });
            
            $tooltip.fadeIn(200);
        },
        
        hideTooltip: function($step) {
            $('.mc-funnel-tooltip').fadeOut(200, function() {
                $(this).remove();
            });
        },
        
        updateStepStates: function() {
            // This method can be called to refresh step states after quiz completion
            const self = this;
            
            $('.mc-funnel-step').each(function() {
                const $step = $(this);
                const slug = $step.data('slug');
                
                // Skip Johari quiz - it has enhanced server-side status that shouldn't be overridden
                if (slug === 'johari-mi-quiz') {
                    return; // Keep the server-rendered status for Johari
                }
                
                const isCompleted = self.data.completion[slug] || false;
                const isUnlocked = self.data.unlock[slug] || false;
                
                // Update classes
                $step.removeClass('completed available locked');
                
                if (isCompleted) {
                    $step.addClass('completed');
                } else if (isUnlocked) {
                    $step.addClass('available');
                } else {
                    $step.addClass('locked');
                }
                
                // Update icon
                const $icon = $step.find('.mc-funnel-step-icon span');
                if (isCompleted) {
                    $icon.removeClass('number lock').addClass('checkmark').html('✓');
                } else if (isUnlocked) {
                    $icon.removeClass('checkmark lock').addClass('number').html($step.data('index'));
                } else {
                    $icon.removeClass('checkmark number').addClass('lock').html('🔒');
                }
                
                // Update status badge
                const $badge = $step.find('.status-badge');
                $badge.removeClass('completed available locked');
                
                if (isCompleted) {
                    $badge.addClass('completed').text('Completed');
                } else if (isUnlocked) {
                    $badge.addClass('available').text('Available');
                } else {
                    $badge.addClass('locked').text('Locked');
                }
            });
        },
        
        setupAccessibility: function() {
            // Add proper ARIA attributes and keyboard support
            $('.mc-funnel-step').each(function() {
                const $step = $(this);
                const slug = $step.data('slug');
                const isUnlocked = $step.hasClass('available');
                
                // Make focusable if available
                if (isUnlocked) {
                    $step.attr('tabindex', '0');
                    $step.attr('role', 'button');
                    $step.attr('aria-label', `Start ${$step.find('.mc-funnel-step-title').text()}`);
                } else {
                    $step.attr('tabindex', '-1');
                    $step.attr('aria-disabled', 'true');
                    $step.attr('aria-label', `${$step.find('.mc-funnel-step-title').text()} - Locked`);
                }
            });
            
            // Add live region for status updates
            if (!$('#mc-funnel-status').length) {
                $('body').append('<div id="mc-funnel-status" aria-live="polite" aria-atomic="true" style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"></div>');
            }
        },
        
        handleQuizCompletion: function(event, data) {
            // Refresh funnel state when a quiz is completed
            console.log('MC Funnel: Quiz completed, refreshing state', data);
            
            // You could make an AJAX call here to get updated state
            // For now, we'll just refresh the page or update locally
            this.announceCompletion(data);
            
            // Optionally refresh the page to get updated state
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        },
        
        announceCompletion: function(data) {
            const message = `Congratulations! You've completed ${data.quizTitle || 'an assessment'}. The next step is now available.`;
            $('#mc-funnel-status').text(message);
            this.showNotification(message, 'success');
        },
        
        updateJohariStatus: function() {
            // Only update via AJAX if user_id is 0 (not properly detected server-side)
            // Otherwise, keep the server-rendered enhanced status
            if (!this.data || this.data.user_id != 0) {
                return; // Server-side status is accurate, no need for AJAX
            }
            
            const $johariStep = $('.mc-funnel-step[data-slug="johari-mi-quiz"]');
            if (!$johariStep.length) return;
            
            // Only call AJAX if user wasn't detected server-side but might be logged in client-side
            $.post(this.data.ajax_url, {
                action: 'get_johari_status'
            })
            .done((response) => {
                if (response.success && response.data.johari_status) {
                    this.applyJohariStatus($johariStep, response.data.johari_status);
                }
            })
            .fail(() => {
                console.log('Could not get Johari status via AJAX - user may not be logged in');
            });
        },
        
        applyJohariStatus: function($step, status) {
            // Update step classes
            $step.removeClass('available locked completed johari-waiting johari-ready johari-completed');
            $step.addClass('johari-' + status.status);
            
            // Update icon
            const $icon = $step.find('.mc-funnel-step-icon span');
            $icon.removeClass('number lock checkmark waiting ready');
            
            if (status.status === 'completed') {
                $icon.addClass('checkmark').html('✓');
            } else if (status.status === 'waiting') {
                $icon.addClass('waiting').html('⏳');
            } else if (status.status === 'ready') {
                $icon.addClass('ready').html('🎯');
            } else {
                $icon.addClass('number').html($step.data('index'));
            }
            
            // Update status badge
            const $badge = $step.find('.status-badge');
            $badge.removeClass('available locked completed waiting ready')
                  .addClass(status.status)
                  .text(status.badge_text);
            
            // Update description
            const $description = $step.find('.mc-funnel-step-description p');
            if ($description.length) {
                $description.text(status.description);
            }
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        McFunnel.init();
        McFunnel.updateJohariStatus();
        
        // Add CSS for notifications and tooltips
    if (!$('#mc-funnel-dynamic-styles').length) {
        $('<style id="mc-funnel-dynamic-styles">').html(`
            .mc-funnel-notification {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                position: relative;
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .mc-funnel-notification--info {
                border-left: 4px solid #3b82f6;
                background-color: #eff6ff;
            }
            
            .mc-funnel-notification--error {
                border-left: 4px solid #ef4444;
                background-color: #fef2f2;
            }
            
            .mc-funnel-notification--success {
                border-left: 4px solid #22c55e;
                background-color: #f0fdf4;
            }
            
            .mc-funnel-notification__message {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .mc-funnel-notification__close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #64748b;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .mc-funnel-notification__close:hover {
                color: #374151;
            }
            
            .mc-funnel-tooltip {
                background: #1f2937;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                max-width: 200px;
                text-align: center;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                display: none;
            }
            
            .mc-funnel-tooltip__arrow {
                position: absolute;
                bottom: -6px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid #1f2937;
            }
            
            .mc-funnel-step.navigating {
                opacity: 0.7;
                pointer-events: none;
            }
            
            .mc-funnel-step.navigating:after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
                border: 2px solid #3b82f6;
                border-top: 2px solid transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
        `).appendTo('head');
    }
    });
    
})(jQuery);
