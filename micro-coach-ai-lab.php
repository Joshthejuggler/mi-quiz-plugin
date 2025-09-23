<?php
if (!defined('ABSPATH')) exit;

/**
 * AI Coach Lab Mode - Experimental workflow for data-rich, experiment-driven challenges.
 * 
 * This class provides a separate tab that guides users through:
 * Import assessment results → Add personal qualifiers → Generate tailored experiments → Execute → Reflect → Recalibrate
 */
class Micro_Coach_AI_Lab {
    
    // Database table names
    const TABLE_LAB_EXPERIMENTS = 'mc_lab_experiments';
    const TABLE_LAB_FEEDBACK = 'mc_lab_feedback';
    const TABLE_LAB_USER_PREFERENCES = 'mc_lab_user_preferences';
    
    // Feature flag option
    const OPT_LAB_MODE_ENABLED = 'mc_lab_mode_enabled';
    
    public function __construct() {
        // Always register admin settings (needed for the feature flag to appear)
        if (is_admin()) {
            add_action('admin_init', [$this, 'register_lab_mode_settings']);
        }
        
        // Only initialize Lab Mode features if enabled
        if (!$this->is_lab_mode_enabled()) {
            return;
        }
        
        // Initialize database tables on admin load
        add_action('admin_init', [$this, 'maybe_create_tables']);
        
        // Register AJAX endpoints for Lab Mode functionality (with permission checks)
        add_action('wp_ajax_mc_lab_get_profile_data', [$this, 'ajax_get_profile_data']);
        add_action('wp_ajax_mc_lab_save_qualifiers', [$this, 'ajax_save_qualifiers']);
        add_action('wp_ajax_mc_lab_generate_experiments', [$this, 'ajax_generate_experiments']);
        add_action('wp_ajax_mc_lab_start_experiment', [$this, 'ajax_start_experiment']);
        add_action('wp_ajax_mc_lab_submit_reflection', [$this, 'ajax_submit_reflection']);
        add_action('wp_ajax_mc_lab_get_history', [$this, 'ajax_get_history']);
        add_action('wp_ajax_mc_lab_recalibrate', [$this, 'ajax_recalibrate']);
        add_action('wp_ajax_mc_lab_debug_user_data', [$this, 'ajax_debug_user_data']);
        add_action('wp_ajax_mc_lab_test_save_qualifiers', [$this, 'ajax_test_save_qualifiers']);
        add_action('wp_ajax_mc_lab_generate_ai_variant', [$this, 'ajax_generate_ai_variant']);
        
        // Hook into the main dashboard to add Lab Mode tab
        add_filter('mc_dashboard_custom_tabs', [$this, 'add_lab_mode_tab']);
        add_action('mc_dashboard_custom_tab_content', [$this, 'render_lab_mode_content']);
    }
    
    /**
     * Check if current user has Lab Mode access
     */
    private function user_can_access_lab_mode() {
        return current_user_can('edit_posts') || current_user_can('manage_options');
    }
    
    /**
     * Check if Lab Mode is enabled via feature flag
     */
    private function is_lab_mode_enabled() {
        return get_option(self::OPT_LAB_MODE_ENABLED, '0') === '1';
    }
    
    /**
     * Create database tables for Lab Mode
     */
    public function maybe_create_tables() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        
        $experiments_table = $wpdb->prefix . self::TABLE_LAB_EXPERIMENTS;
        $feedback_table = $wpdb->prefix . self::TABLE_LAB_FEEDBACK;
        $preferences_table = $wpdb->prefix . self::TABLE_LAB_USER_PREFERENCES;
        
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        
        // Experiments table
        $sql1 = "CREATE TABLE IF NOT EXISTS `$experiments_table` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            experiment_data LONGTEXT NOT NULL,
            profile_data LONGTEXT NOT NULL,
            archetype ENUM('Discover', 'Build', 'Share') NOT NULL,
            status ENUM('Draft', 'Active', 'Completed', 'Archived') DEFAULT 'Draft',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY status (status),
            KEY archetype (archetype)
        ) $charset;";
        
        // Feedback table
        $sql2 = "CREATE TABLE IF NOT EXISTS `$feedback_table` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            experiment_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            difficulty TINYINT(1) NOT NULL,
            fit TINYINT(1) NOT NULL,
            learning TINYINT(1) NOT NULL,
            notes TEXT NULL,
            next_action ENUM('Repeat', 'Evolve', 'Archive') NOT NULL,
            evolve_notes TEXT NULL,
            submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY experiment_id (experiment_id),
            KEY user_id (user_id),
            FOREIGN KEY (experiment_id) REFERENCES `$experiments_table`(id) ON DELETE CASCADE
        ) $charset;";
        
        // User preferences table for recalibration
        $sql3 = "CREATE TABLE IF NOT EXISTS `$preferences_table` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            contexts LONGTEXT NOT NULL DEFAULT '{}',
            risk_bias DECIMAL(3,2) DEFAULT 0.00,
            solo_group_bias DECIMAL(3,2) DEFAULT 0.00,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY user_id (user_id)
        ) $charset;";
        
        dbDelta($sql1);
        dbDelta($sql2);
        dbDelta($sql3);
    }
    
    /**
     * Register Lab Mode settings in the admin
     */
    public function register_lab_mode_settings() {
        // Add feature flag setting
        register_setting(Micro_Coach_Core::OPT_GROUP, self::OPT_LAB_MODE_ENABLED, function($v) {
            return $v ? '1' : '0';
        });
        
        add_settings_field(
            self::OPT_LAB_MODE_ENABLED,
            'Lab Mode (Experimental)',
            function() {
                $enabled = get_option(self::OPT_LAB_MODE_ENABLED, '0') === '1' ? 'checked' : '';
                echo '<label><input type="checkbox" name="' . esc_attr(self::OPT_LAB_MODE_ENABLED) . '" value="1" ' . $enabled . '> Enable AI Coach Lab Mode - experimental workflow for data-rich challenges.</label>';
                echo '<p class="description">This adds a separate "Lab Mode" tab with profile-based experiment generation, feedback loops, and recalibration.</p>';
            },
            'quiz-platform-settings',
            'mc_quiz_ai_section'
        );
    }
    
    /**
     * Add Lab Mode tab to the dashboard (if all assessments are complete)
     */
    public function add_lab_mode_tab($tabs) {
        $user_id = get_current_user_id();
        if (!$user_id) return $tabs;
        
        // Check if all assessments are complete
        $quizzes = Micro_Coach_Core::get_quizzes();
        $all_complete = true;
        foreach ($quizzes as $quiz) {
            if (!empty($quiz['results_meta_key'])) {
                $results = get_user_meta($user_id, $quiz['results_meta_key'], true);
                if (empty($results)) {
                    $all_complete = false;
                    break;
                }
            }
        }
        
        if ($all_complete) {
            $tabs['tab-lab'] = '🧪 Lab Mode';
        }
        
        return $tabs;
    }
    
    /**
     * Render Lab Mode content in the dashboard
     */
    public function render_lab_mode_content() {
        $user_id = get_current_user_id();
        if (!$user_id) return;
        
        // Check if all assessments are complete (same check as tab visibility)
        $quizzes = Micro_Coach_Core::get_quizzes();
        $all_complete = true;
        foreach ($quizzes as $quiz) {
            if (!empty($quiz['results_meta_key'])) {
                $results = get_user_meta($user_id, $quiz['results_meta_key'], true);
                if (empty($results)) {
                    $all_complete = false;
                    break;
                }
            }
        }
        
        if (!$all_complete) return;
        
        // Enqueue Lab Mode assets
        $this->enqueue_lab_mode_assets();
        
        echo '<div id="tab-lab" class="tab-content">';
        echo '<div id="lab-mode-app">';
        echo '<div class="lab-mode-loading">';
        echo '<p>Loading Lab Mode...</p>';
        echo '<div class="loading-spinner"></div>';
        echo '</div>';
        echo '</div>';
        echo '</div>';
    }
    
    /**
     * Enqueue Lab Mode JavaScript and CSS
     */
    private function enqueue_lab_mode_assets() {
        wp_enqueue_script(
            'lab-mode-js',
            plugins_url('assets/lab-mode.js', __FILE__),
            ['jquery'],
            '1.0.0',
            true
        );
        
        wp_enqueue_style(
            'lab-mode-css',
            plugins_url('assets/lab-mode.css', __FILE__),
            [],
            '1.0.0'
        );
        
        // Localize script with AJAX URL and nonce
        wp_localize_script('lab-mode-js', 'labMode', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('mc_lab_nonce'),
            'userId' => get_current_user_id(),
            'restUrl' => rest_url('wp/v2/'),
        ]);
    }
    
    /**
     * AJAX: Get user profile data (assessments)
     */
    public function ajax_get_profile_data() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Gather assessment data
        $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
        $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
        $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
        
        // Load question files for category mappings
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php';
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/questions.php';
        
        $profile_data = [
            'mi_results' => $this->format_mi_results($mi_results, $mi_categories ?? []),
            'cdt_results' => $this->format_cdt_results($cdt_results, $cdt_categories ?? []),
            'bartle_results' => $this->format_bartle_results($bartle_results, $bartle_categories ?? []),
            'johari_results' => $this->format_johari_results($bartle_results), // Johari data is in Bartle results
        ];
        
        wp_send_json_success($profile_data);
    }
    
    /**
     * Format MI results for Lab Mode
     */
    private function format_mi_results($results, $categories) {
        if (empty($results) || empty($results['top3'])) {
            return null;
        }
        
        $formatted = [];
        foreach ($results['top3'] as $index => $mi_slug) {
            $score = $results['part1Scores'][$mi_slug] ?? 0;
            $formatted[] = [
                'key' => $mi_slug,
                'score' => (int) $score,
                'rank' => $index + 1,
                'label' => $categories[$mi_slug] ?? ucfirst(str_replace('-', ' ', $mi_slug))
            ];
        }
        
        return $formatted;
    }
    
    /**
     * Format CDT results for Lab Mode
     */
    private function format_cdt_results($results, $categories) {
        if (empty($results) || empty($results['sortedScores'])) {
            return null;
        }
        
        $formatted = [];
        foreach ($results['sortedScores'] as $index => $score_data) {
            $cdt_slug = $score_data[0];
            $score = $score_data[1];
            $formatted[] = [
                'key' => $cdt_slug,
                'score' => (int) $score,
                'rank' => $index + 1,
                'label' => $categories[$cdt_slug] ?? ucfirst(str_replace('-', ' ', $cdt_slug))
            ];
        }
        
        return $formatted;
    }
    
    /**
     * Format Bartle results for Lab Mode
     */
    private function format_bartle_results($results, $categories) {
        if (empty($results) || empty($results['sortedScores'])) {
            return null;
        }
        
        $primary_slug = $results['sortedScores'][0][0];
        $secondary_slug = isset($results['sortedScores'][1]) ? $results['sortedScores'][1][0] : null;
        
        return [
            'primary' => $primary_slug,
            'secondary' => $secondary_slug,
            'primary_label' => $categories[$primary_slug] ?? ucfirst($primary_slug),
            'secondary_label' => $secondary_slug ? ($categories[$secondary_slug] ?? ucfirst($secondary_slug)) : null
        ];
    }
    
    /**
     * Format Johari results (extracted from Bartle quiz)
     */
    private function format_johari_results($bartle_results) {
        // For now, return mock data - in real implementation this would come from actual Johari assessment
        return [
            'known' => ['reliable', 'curious'],
            'blind' => ['reserved'],
            'hidden' => ['ambitious'],
            'unknown' => []
        ];
    }
    
    /**
     * AJAX: Save user qualifiers
     */
    public function ajax_save_qualifiers() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            error_log('Lab Mode Debug - Save qualifiers: Insufficient permissions');
            wp_send_json_error('Insufficient permissions');
        }
        
        $raw_qualifiers = stripslashes($_POST['qualifiers'] ?? '');
        error_log('Lab Mode Debug - Raw qualifiers received: ' . $raw_qualifiers);
        
        $qualifiers_data = json_decode($raw_qualifiers, true);
        if (!$qualifiers_data) {
            error_log('Lab Mode Debug - Failed to decode qualifiers JSON');
            wp_send_json_error('Invalid qualifiers data - failed to parse JSON');
        }
        
        error_log('Lab Mode Debug - Decoded qualifiers: ' . print_r($qualifiers_data, true));
        
        // Save qualifiers to user meta
        $result = update_user_meta($user_id, 'mc_lab_qualifiers', $qualifiers_data);
        error_log('Lab Mode Debug - Update user meta result: ' . ($result ? 'success' : 'failed'));
        
        // Verify the save worked
        $saved_data = get_user_meta($user_id, 'mc_lab_qualifiers', true);
        error_log('Lab Mode Debug - Retrieved saved qualifiers: ' . print_r($saved_data, true));
        
        wp_send_json_success([
            'message' => 'Qualifiers saved',
            'saved_data_preview' => !empty($saved_data) ? array_keys($saved_data) : 'Empty'
        ]);
    }
    
    /**
     * AJAX: Generate experiments using AI
     */
    public function ajax_generate_experiments() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Get user profile and qualifiers
        $profile_data = $this->get_user_profile_data($user_id);
        $qualifiers = get_user_meta($user_id, 'mc_lab_qualifiers', true);
        
        // Debug logging
        error_log('Lab Mode Debug - Profile data: ' . (!empty($profile_data) ? 'found' : 'empty'));
        error_log('Lab Mode Debug - Qualifiers: ' . (!empty($qualifiers) ? 'found' : 'empty'));
        
        if (empty($profile_data) || empty($qualifiers)) {
            $error_msg = 'Missing: ';
            if (empty($profile_data)) $error_msg .= 'profile data ';
            if (empty($qualifiers)) $error_msg .= 'qualifiers ';
            
            wp_send_json_error($error_msg . '- ensure all assessments are complete and qualifiers are saved');
        }
        
        $using_mock = false;
        try {
            $experiments = $this->generate_experiments_with_ai($profile_data, $qualifiers);
            error_log('Lab Mode Debug - AI experiments generated successfully');
        } catch (Exception $ai_error) {
            error_log('Lab Mode Debug - AI failed, using mock experiments: ' . $ai_error->getMessage());
            
            // Use mock experiments for testing if AI fails
            $experiments = $this->get_mock_experiments($profile_data, $qualifiers);
            $using_mock = true;
            error_log('Lab Mode Debug - Using mock experiments instead');
        }
        
        try {
            
            // Save experiments to database
            global $wpdb;
            $table = $wpdb->prefix . self::TABLE_LAB_EXPERIMENTS;
            
            $experiment_ids = [];
            foreach ($experiments as $experiment) {
                $result = $wpdb->insert($table, [
                    'user_id' => $user_id,
                    'experiment_data' => wp_json_encode($experiment),
                    'profile_data' => wp_json_encode($profile_data),
                    'archetype' => $experiment['archetype'],
                    'status' => 'Draft'
                ]);
                
                if ($result) {
                    $experiment_ids[] = $wpdb->insert_id;
                }
            }
            
            wp_send_json_success([
                'experiments' => $experiments,
                'experiment_ids' => $experiment_ids,
                'using_mock' => $using_mock,
                'source' => $using_mock ? 'Mock Data (AI Failed)' : 'AI Generated'
            ]);
            
        } catch (Exception $e) {
            wp_send_json_error('Failed to generate experiments: ' . $e->getMessage());
        }
    }
    
    /**
     * Get complete user profile data for experiment generation
     */
    private function get_user_profile_data($user_id) {
        $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
        $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
        $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
        
        // Debug logging
        error_log('Lab Mode Debug - MI results: ' . (!empty($mi_results) ? 'found' : 'empty'));
        error_log('Lab Mode Debug - CDT results: ' . (!empty($cdt_results) ? 'found' : 'empty'));
        error_log('Lab Mode Debug - Bartle results: ' . (!empty($bartle_results) ? 'found' : 'empty'));
        
        if (empty($mi_results) || empty($cdt_results) || empty($bartle_results)) {
            error_log('Lab Mode Debug - Missing assessment data, returning null');
            return null;
        }
        
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php';
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/questions.php';
        
        return [
            'mi_top3' => $this->format_mi_results($mi_results, $mi_categories ?? []),
            'cdt' => $this->format_cdt_results($cdt_results, $cdt_categories ?? []),
            'johari' => $this->format_johari_results($bartle_results),
            'bartle' => $this->format_bartle_results($bartle_results, $bartle_categories ?? [])
        ];
    }
    
    /**
     * Get mock experiments for testing when AI fails
     */
    private function get_mock_experiments($profile_data, $qualifiers) {
        $mi_top = $profile_data['mi_top3'][0] ?? ['label' => 'Unknown'];
        $cdt_low = $profile_data['cdt'][0] ?? ['label' => 'Unknown'];
        $curiosity = $qualifiers['curiosity']['curiosities'][0] ?? 'learning';
        
        return [
            [
                'archetype' => 'Discover',
                'title' => "Scout {$curiosity} through {$mi_top['label']}",
                'rationale' => "This builds on your {$mi_top['label']} strength while gently exercising {$cdt_low['label']}.",
                'steps' => [
                    "Define a simple question: 'What don't I know about {$curiosity}?'",
                    "Collect 3 examples from online sources or role models",
                    "Take notes for 45 minutes using your {$mi_top['label']} approach",
                    "Identify one surprising insight or connection"
                ],
                'resources' => [
                    "Online articles about {$curiosity}",
                    "Note-taking tools that suit {$mi_top['label']}"
                ],
                'effort' => [
                    'timeHours' => 2,
                    'budgetUSD' => 0
                ],
                'riskLevel' => 'Low',
                'successCriteria' => [
                    "Spent at least 45 minutes actively exploring",
                    "Documented findings using preferred approach",
                    "Identified one surprising insight or connection"
                ],
                'linkedMI' => [$mi_top['key'] ?? 'unknown'],
                'linkedCDT' => [$cdt_low['key'] ?? 'unknown'],
                'tags' => ['discovery', $curiosity, 'MOCK_EXPERIMENT']
            ],
            [
                'archetype' => 'Build',
                'title' => "Create a small {$curiosity} project",
                'rationale' => "This leverages your {$mi_top['label']} for hands-on creation.",
                'steps' => [
                    "Set constraints: 2 hours, $0 budget, low risk",
                    "Create a first version using your {$mi_top['label']} strengths",
                    "Test with 1-2 people for feedback",
                    "Iterate based on what you learned"
                ],
                'resources' => [
                    "Basic tools for {$mi_top['label']}-based creation",
                    "1-2 people who can give feedback"
                ],
                'effort' => [
                    'timeHours' => 3,
                    'budgetUSD' => 10
                ],
                'riskLevel' => 'Medium',
                'successCriteria' => [
                    "Created a working prototype within time limit",
                    "Tested with at least one real person",
                    "Received and considered feedback"
                ],
                'linkedMI' => [$mi_top['key'] ?? 'unknown'],
                'linkedCDT' => [$cdt_low['key'] ?? 'unknown'],
                'tags' => ['building', $curiosity, 'MOCK_EXPERIMENT']
            ],
            [
                'archetype' => 'Share',
                'title' => "Share your {$curiosity} insights",
                'rationale' => "Sharing helps you practice communication while using your {$mi_top['label']} abilities.",
                'steps' => [
                    "Package your learning (1-page summary, demo, or 90-sec talk)",
                    "Share with friends/colleagues and ask 3 specific questions",
                    "Listen actively and take notes",
                    "Log 3 takeaways and decide next steps"
                ],
                'resources' => [
                    "Simple presentation tools",
                    "Friends or colleagues interested in {$curiosity}"
                ],
                'effort' => [
                    'timeHours' => 2,
                    'budgetUSD' => 0
                ],
                'riskLevel' => 'Low',
                'successCriteria' => [
                    "Shared with at least 2 people",
                    "Asked meaningful follow-up questions",
                    "Received specific feedback from audience"
                ],
                'linkedMI' => [$mi_top['key'] ?? 'unknown'],
                'linkedCDT' => [$cdt_low['key'] ?? 'unknown'],
                'tags' => ['sharing', $curiosity, 'MOCK_EXPERIMENT']
            ]
        ];
    }
    
    /**
     * Generate experiments using AI based on profile and qualifiers
     */
    private function generate_experiments_with_ai($profile_data, $qualifiers) {
        // Load deterministic content libraries
        $archetype_templates = $this->get_archetype_templates();
        $cdt_dataset = $this->get_cdt_dataset();
        
        // Build AI prompt
        $prompt = $this->build_experiment_generation_prompt($profile_data, $qualifiers, $archetype_templates, $cdt_dataset);
        
        // Call AI service (reuse existing Micro_Coach_AI infrastructure)
        if (!class_exists('Micro_Coach_AI')) {
            throw new Exception('Micro_Coach_AI class not available');
        }
        
        $api_key = Micro_Coach_AI::get_openai_api_key();
        if (empty($api_key)) {
            throw new Exception('OpenAI API key not configured');
        }
        
        $response = $this->call_openai_api($api_key, $prompt);
        
        // Debug logging
        error_log('Lab Mode Debug - AI API response: ' . print_r($response, true));
        
        if (!$response) {
            throw new Exception('Empty AI response');
        }
        
        if (!isset($response['experiments'])) {
            throw new Exception('AI response missing experiments field. Response keys: ' . implode(', ', array_keys($response ?: [])));
        }
        
        error_log('Lab Mode Debug - Experiments count: ' . count($response['experiments']));
        return $response['experiments'];
    }
    
    /**
     * Get archetype templates for experiment generation
     */
    private function get_archetype_templates() {
        $templates_file = MC_QUIZ_PLATFORM_PATH . 'assets/lab_libraries/archetype_templates.json';
        if (!file_exists($templates_file)) {
            return $this->get_fallback_archetype_templates();
        }
        
        $templates_json = file_get_contents($templates_file);
        $templates = json_decode($templates_json, true);
        
        if (!$templates) {
            return $this->get_fallback_archetype_templates();
        }
        
        return $templates;
    }
    
    /**
     * Fallback archetype templates if library file is missing
     */
    private function get_fallback_archetype_templates() {
        return [
            'Discover' => [
                'titlePatterns' => ['Scout {topic} through {method}'],
                'stepTemplates' => [[
                    'Define a simple question: "What don\'t I know about {topic}?"',
                    'Collect 3 examples from {roleModelsOrSources}.',
                    'Take notes for 45 minutes using {MI_mode} (e.g., sketch, audio, outline).'
                ]],
                'rationales' => ['This builds on your {MI_strengths} while gently exercising your {CDT_growth_area}.'],
                'successCriteria' => [[
                    'Spent at least {timeBlock} actively exploring',
                    'Documented findings using preferred {MI_mode}',
                    'Identified one surprising insight or connection'
                ]]
            ],
            'Build' => [
                'titlePatterns' => ['Prototype a {artifact} in {timeBlock}'],
                'stepTemplates' => [[
                    'Set constraints: time {timeBlock}, budget ${budget}, risk {riskLevel}.',
                    'Create a first version using your {MI_combo} strengths.',
                    'Invite 1–2 people for feedback focused on {successCriterion}.'
                ]],
                'rationales' => ['This leverages your {MI_strengths} for hands-on creation while practicing {CDT_skill}.'],
                'successCriteria' => [[
                    'Created a working prototype within {timeBlock}',
                    'Tested the creation with at least one real use case',
                    'Received and incorporated feedback from others'
                ]]
            ],
            'Share' => [
                'titlePatterns' => ['Share {result} with {audience}'],
                'stepTemplates' => [[
                    'Package your work (1-pager, demo, or 90-sec talk).',
                    'Share with {audience} and ask 3 specific questions.',
                    'Log 3 takeaways and decide: repeat, evolve, or archive.'
                ]],
                'rationales' => ['Sharing helps you practice {CDT_skill} while using your {MI_strengths} to communicate.'],
                'successCriteria' => [[
                    'Shared with at least {minimum_audience} people',
                    'Received specific feedback from at least 2 sharers',
                    'Asked follow-up questions to understand impact'
                ]]
            ]
        ];
    }
    
    /**
     * Get MI combinations for experiment personalization
     */
    private function get_mi_combinations() {
        $combinations_file = MC_QUIZ_PLATFORM_PATH . 'assets/lab_libraries/mi_combinations.json';
        if (!file_exists($combinations_file)) {
            return [];
        }
        
        $combinations_json = file_get_contents($combinations_file);
        $combinations = json_decode($combinations_json, true);
        
        return $combinations ?: [];
    }
    
    /**
     * Get CDT dataset for coaching insights
     */
    private function get_cdt_dataset() {
        require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/details.php';
        return $cdt_dimension_details ?? [];
    }
    
    /**
     * Build AI prompt for experiment generation
     */
    private function build_experiment_generation_prompt($profile_data, $qualifiers, $archetype_templates, $cdt_dataset) {
        // Enhanced system prompt with role model focus and better structure
        $system_prompt = 'Role: You generate personalized "minimum viable experiments" (MVEs) for self-discovery.\n\nTask: Produce diverse, safe, low-stakes MVEs the user can try within 7 days.\n\nDesign Rules:\n1. **Ground in MI strengths** – leverage at least one top MI (explicitly note which)\n2. **Address CDT growth edges** – integrate small nudges for bottom 2 dimensions\n3. **Role models as inspiration** – draw on style/philosophy/methods of at least one role model. Make this influence explicit (e.g., "In the spirit of Marie Kondo, simplify...")\n4. **Calibrate to constraints** – align with time, budget, risk preferences. Do not exceed ±1 without explanation\n5. **Incorporate curiosities** – use at least one curiosity area in each experiment\n\nOutput JSON with fields:\n- archetype (Build, Explore, Express, Connect, Reflect)\n- title\n- rationale (why this fits MI/CDT/role model/constraints)\n- steps (3-5 concrete, runnable steps)\n- effort (timeHours, budgetUSD, riskLevel)\n- successCriteria (2-3)\n- influences (object with: miUsed, cdtEdge, roleModelUsed, curiosityUsed)\n- calibrationNotes (if adjustments made)\n\nConstraints: Language must be warm, concrete, non-judgmental. All experiments safe, legal, age-appropriate, low-risk. Return ONLY valid JSON.';
        
        // Get role models from qualifiers
        $role_models = [];
        if (isset($qualifiers['curiosity']['roleModels']) && is_array($qualifiers['curiosity']['roleModels'])) {
            $role_models = array_filter($qualifiers['curiosity']['roleModels']);
        }
        
        // Build comprehensive user message
        $user_message = sprintf(
            "Profile JSON: {\n  \"user\": {\n    \"mi_top3\": %s,\n    \"cdt_bottom2\": %s,\n    \"curiosities\": %s,\n    \"roleModels\": %s\n  },\n  \"constraints\": {\n    \"timePerWeek\": %d,\n    \"budget\": %d,\n    \"risk\": %d,\n    \"soloToGroup\": %d\n  }\n}\n\nGenerate 3 personalized MVEs as JSON.",
            json_encode(array_map(function($mi) {
                return ['label' => $mi['label'], 'score' => $mi['score']];
            }, array_slice($profile_data['mi_top3'] ?: [], 0, 3))),
            json_encode(array_map(function($cdt) {
                return ['label' => $cdt['label'], 'score' => $cdt['score']];
            }, array_slice($profile_data['cdt'] ?: [], -2))),
            json_encode($qualifiers['curiosity']['curiosities'] ?: []),
            json_encode($role_models),
            $qualifiers['curiosity']['constraints']['timePerWeekHours'] ?? 3,
            $qualifiers['curiosity']['constraints']['budget'] ?? 50,
            $qualifiers['curiosity']['constraints']['risk'] ?? 50,
            $qualifiers['curiosity']['constraints']['soloToGroup'] ?? 50
        );
        
        return [
            'system' => $system_prompt,
            'user' => $user_message
        ];
    }
    
    /**
     * Call OpenAI API with the generated prompt
     */
    private function call_openai_api($api_key, $prompt_data) {
        $model = Micro_Coach_AI::get_selected_model();
        
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $prompt_data['system']],
                ['role' => 'user', 'content' => $prompt_data['user']]
            ],
            'temperature' => 0.7,
            'max_tokens' => 2000,
            'response_format' => ['type' => 'json_object']
        ];
        
        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout' => 60,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json'
            ],
            'body' => wp_json_encode($payload)
        ]);
        
        if (is_wp_error($response)) {
            error_log('Lab Mode Debug - API request error: ' . $response->get_error_message());
            throw new Exception('API request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        error_log('Lab Mode Debug - API response status: ' . $status_code);
        
        $body = wp_remote_retrieve_body($response);
        error_log('Lab Mode Debug - API response body: ' . substr($body, 0, 1000) . '...');
        
        $data = json_decode($body, true);
        
        if (!$data) {
            throw new Exception('Failed to decode API response JSON');
        }
        
        if (isset($data['error'])) {
            throw new Exception('API error: ' . $data['error']['message']);
        }
        
        if (!isset($data['choices'][0]['message']['content'])) {
            throw new Exception('Invalid API response structure. Keys: ' . implode(', ', array_keys($data)));
        }
        
        $content = $data['choices'][0]['message']['content'];
        error_log('Lab Mode Debug - AI content: ' . $content);
        
        $parsed_content = json_decode($content, true);
        if (!$parsed_content) {
            throw new Exception('Failed to decode AI response content as JSON: ' . $content);
        }
        
        return $parsed_content;
    }
    
    /**
     * AJAX: Start an experiment
     */
    public function ajax_start_experiment() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        $experiment_id = intval($_POST['experiment_id'] ?? 0);
        
        if (!$user_id || !$this->user_can_access_lab_mode() || !$experiment_id) {
            wp_send_json_error('Missing parameters or insufficient permissions');
        }
        
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_LAB_EXPERIMENTS;
        
        $result = $wpdb->update($table, [
            'status' => 'Active',
            'updated_at' => current_time('mysql')
        ], [
            'id' => $experiment_id,
            'user_id' => $user_id
        ]);
        
        if ($result === false) {
            wp_send_json_error('Failed to update experiment status');
        }
        
        wp_send_json_success(['message' => 'Experiment started']);
    }
    
    /**
     * AJAX: Submit reflection feedback
     */
    public function ajax_submit_reflection() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $reflection_data = json_decode(stripslashes($_POST['reflection'] ?? ''), true);
        if (!$reflection_data) {
            wp_send_json_error('Invalid reflection data');
        }
        
        // Save feedback to database
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_LAB_FEEDBACK;
        
        $result = $wpdb->insert($table, [
            'experiment_id' => intval($reflection_data['experiment_id']),
            'user_id' => $user_id,
            'difficulty' => intval($reflection_data['difficulty']),
            'fit' => intval($reflection_data['fit']),
            'learning' => intval($reflection_data['learning']),
            'notes' => sanitize_textarea_field($reflection_data['notes'] ?? ''),
            'next_action' => sanitize_text_field($reflection_data['next_action']),
            'evolve_notes' => sanitize_textarea_field($reflection_data['evolve_notes'] ?? '')
        ]);
        
        if ($result === false) {
            wp_send_json_error('Failed to save reflection');
        }
        
        // Update experiment status
        $experiments_table = $wpdb->prefix . self::TABLE_LAB_EXPERIMENTS;
        $wpdb->update($experiments_table, [
            'status' => 'Completed',
            'updated_at' => current_time('mysql')
        ], [
            'id' => intval($reflection_data['experiment_id']),
            'user_id' => $user_id
        ]);
        
        // Trigger recalibration
        $recalibration = $this->recalibrate_user_preferences($user_id, $reflection_data);
        
        wp_send_json_success([
            'message' => 'Reflection submitted',
            'recalibration' => $recalibration
        ]);
    }
    
    /**
     * Recalibrate user preferences based on feedback
     */
    private function recalibrate_user_preferences($user_id, $feedback) {
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_LAB_USER_PREFERENCES;
        
        // Get current preferences
        $current = $wpdb->get_row($wpdb->prepare("SELECT * FROM `$table` WHERE user_id = %d", $user_id), ARRAY_A);
        
        $contexts = !empty($current['contexts']) ? json_decode($current['contexts'], true) : [];
        $risk_bias = floatval($current['risk_bias'] ?? 0);
        $solo_group_bias = floatval($current['solo_group_bias'] ?? 0);
        
        // Apply recalibration logic based on feedback
        if ($feedback['fit'] <= 2) {
            // Decrease weight of contexts used
            // This would require experiment context data to implement fully
        }
        
        if ($feedback['learning'] >= 4 && $feedback['difficulty'] >= 3 && $feedback['difficulty'] <= 4) {
            // Mark as "sweet spot" - increase similar constraints
        }
        
        if ($feedback['difficulty'] >= 5) {
            // Reduce risk level
            $risk_bias = max(-1.0, $risk_bias - 0.2);
        }
        
        // Save updated preferences
        $wpdb->replace($table, [
            'user_id' => $user_id,
            'contexts' => wp_json_encode($contexts),
            'risk_bias' => $risk_bias,
            'solo_group_bias' => $solo_group_bias
        ]);
        
        return [
            'contexts' => $contexts,
            'risk_bias' => $risk_bias,
            'solo_group_bias' => $solo_group_bias,
            'summary' => $this->generate_recalibration_summary($feedback, $risk_bias)
        ];
    }
    
    /**
     * Generate human-readable recalibration summary
     */
    private function generate_recalibration_summary($feedback, $risk_bias) {
        $changes = [];
        
        if ($feedback['difficulty'] >= 5) {
            $changes[] = "reduce experiment complexity";
        }
        
        if ($feedback['fit'] <= 2) {
            $changes[] = "adjust context preferences";
        }
        
        if (empty($changes)) {
            return "Your preferences are well-calibrated. We'll continue with similar experiments.";
        }
        
        return "Based on your feedback, we'll " . implode(' and ', $changes) . " in future suggestions.";
    }
    
    /**
     * AJAX: Get experiment history
     */
    public function ajax_get_history() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_LAB_EXPERIMENTS;
        
        $experiments = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM `$table` WHERE user_id = %d ORDER BY created_at DESC",
            $user_id
        ), ARRAY_A);
        
        $formatted_experiments = array_map(function($exp) {
            $exp['experiment_data'] = json_decode($exp['experiment_data'], true);
            return $exp;
        }, $experiments);
        
        wp_send_json_success($formatted_experiments);
    }
    
    /**
     * AJAX: Trigger recalibration
     */
    public function ajax_recalibrate() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Get recent feedback to inform recalibration
        global $wpdb;
        $feedback_table = $wpdb->prefix . self::TABLE_LAB_FEEDBACK;
        
        $recent_feedback = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM `$feedback_table` WHERE user_id = %d ORDER BY submitted_at DESC LIMIT 5",
            $user_id
        ), ARRAY_A);
        
        if (empty($recent_feedback)) {
            wp_send_json_error('No feedback available for recalibration');
        }
        
        // Generate evolved experiments based on feedback patterns
        try {
            $profile_data = $this->get_user_profile_data($user_id);
            $qualifiers = get_user_meta($user_id, 'mc_lab_qualifiers', true);
            
            // Adjust qualifiers based on feedback
            $adjusted_qualifiers = $this->adjust_qualifiers_based_on_feedback($qualifiers, $recent_feedback);
            
            $evolved_experiments = $this->generate_experiments_with_ai($profile_data, $adjusted_qualifiers);
            
            wp_send_json_success([
                'experiments' => $evolved_experiments,
                'message' => 'Generated evolved experiments based on your recent feedback'
            ]);
            
        } catch (Exception $e) {
            wp_send_json_error('Failed to generate evolved experiments: ' . $e->getMessage());
        }
    }
    
    /**
     * AJAX: Test save qualifiers with dummy data
     */
    public function ajax_test_save_qualifiers() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Create test qualifiers data
        $test_qualifiers = [
            'mi_qualifiers' => [
                [
                    'key' => 'linguistic',
                    'enjoy' => ['Writing', 'Speaking'],
                    'doing' => ['Journaling', 'Meetings']
                ]
            ],
            'cdt_qualifiers' => [
                [
                    'key' => 'risk-comfort',
                    'trippingPoints' => ['Uncertainty'],
                    'helps' => ['Planning']
                ]
            ],
            'curiosity' => [
                'curiosities' => ['Test topic'],
                'constraints' => ['risk' => 50]
            ]
        ];
        
        // Save test qualifiers
        $result = update_user_meta($user_id, 'mc_lab_qualifiers', $test_qualifiers);
        
        // Verify save
        $saved = get_user_meta($user_id, 'mc_lab_qualifiers', true);
        
        wp_send_json_success([
            'test_data' => $test_qualifiers,
            'save_result' => $result,
            'retrieved_data' => $saved,
            'message' => 'Test qualifiers save completed'
        ]);
    }
    
    /**
     * AJAX: Debug user data for troubleshooting
     */
    public function ajax_debug_user_data() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Get all user assessment data
        $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
        $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
        $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
        $qualifiers = get_user_meta($user_id, 'mc_lab_qualifiers', true);
        
        // Check quiz completion status
        $quizzes = Micro_Coach_Core::get_quizzes();
        $quiz_status = [];
        foreach ($quizzes as $quiz) {
            if (!empty($quiz['results_meta_key'])) {
                $results = get_user_meta($user_id, $quiz['results_meta_key'], true);
                $quiz_status[$quiz['name']] = [
                    'meta_key' => $quiz['results_meta_key'],
                    'completed' => !empty($results),
                    'data_preview' => !empty($results) ? array_keys((array)$results) : 'No data'
                ];
            }
        }
        
        wp_send_json_success([
            'user_id' => $user_id,
            'quiz_status' => $quiz_status,
            'mi_results' => !empty($mi_results) ? array_keys($mi_results) : 'Empty',
            'cdt_results' => !empty($cdt_results) ? array_keys($cdt_results) : 'Empty', 
            'bartle_results' => !empty($bartle_results) ? array_keys($bartle_results) : 'Empty',
            'qualifiers' => !empty($qualifiers) ? array_keys($qualifiers) : 'Empty',
            'lab_mode_enabled' => $this->is_lab_mode_enabled(),
            'profile_data_result' => $this->get_user_profile_data($user_id) ? 'Valid' : 'Null'
        ]);
    }
    
    /**
     * Adjust user qualifiers based on feedback patterns
     */
    private function adjust_qualifiers_based_on_feedback($qualifiers, $feedback) {
        // Analyze feedback patterns
        $avg_difficulty = array_sum(array_column($feedback, 'difficulty')) / count($feedback);
        $avg_fit = array_sum(array_column($feedback, 'fit')) / count($feedback);
        
        // Adjust constraints based on patterns
        if (isset($qualifiers['constraints'])) {
            if ($avg_difficulty > 4) {
                // Reduce complexity
                $qualifiers['constraints']['risk'] = max(0, $qualifiers['constraints']['risk'] - 20);
                $qualifiers['constraints']['timePerWeekHours'] = max(1, $qualifiers['constraints']['timePerWeekHours'] - 1);
            }
            
            if ($avg_fit < 3) {
                // Adjust context preferences (would need more complex logic based on experiment contexts)
            }
        }
        
        return $qualifiers;
    }
    
    /**
     * AJAX: Generate AI-powered experiment variant
     */
    public function ajax_generate_ai_variant() {
        check_ajax_referer('mc_lab_nonce', 'nonce');
        
        $user_id = get_current_user_id();
        if (!$user_id || !$this->user_can_access_lab_mode()) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $original_experiment = json_decode(stripslashes($_POST['original_experiment'] ?? ''), true);
        $prompt_data = json_decode(stripslashes($_POST['prompt_data'] ?? ''), true);
        
        if (!$original_experiment || !$prompt_data) {
            wp_send_json_error('Invalid experiment or prompt data');
        }
        
        try {
            // Use the AI to generate a variant
            $variant = $this->generate_ai_variant($prompt_data, $original_experiment);
            
            wp_send_json_success([
                'variant' => $variant,
                'source' => 'AI Generated Variant'
            ]);
            
        } catch (Exception $e) {
            error_log('Lab Mode Debug - AI variant generation failed: ' . $e->getMessage());
            wp_send_json_error('AI variant generation failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Generate AI variant of an existing experiment
     */
    private function generate_ai_variant($prompt_data, $original_experiment) {
        if (!class_exists('Micro_Coach_AI')) {
            throw new Exception('Micro_Coach_AI class not available');
        }
        
        $api_key = Micro_Coach_AI::get_openai_api_key();
        if (empty($api_key)) {
            throw new Exception('OpenAI API key not configured');
        }
        
        $model = Micro_Coach_AI::get_selected_model();
        
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $prompt_data['system']],
                ['role' => 'user', 'content' => $prompt_data['user']]
            ],
            'temperature' => 0.8, // Higher creativity for variants
            'max_tokens' => 1500,
            'response_format' => ['type' => 'json_object']
        ];
        
        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout' => 60,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json'
            ],
            'body' => wp_json_encode($payload)
        ]);
        
        if (is_wp_error($response)) {
            throw new Exception('API request failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            throw new Exception('API returned status: ' . $status_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!$data || isset($data['error'])) {
            throw new Exception('API error: ' . ($data['error']['message'] ?? 'Unknown error'));
        }
        
        if (!isset($data['choices'][0]['message']['content'])) {
            throw new Exception('Invalid API response structure');
        }
        
        $content = $data['choices'][0]['message']['content'];
        $variant = json_decode($content, true);
        
        if (!$variant) {
            throw new Exception('Failed to decode AI variant response as JSON');
        }
        
        // Ensure required fields are present
        if (!isset($variant['title']) || !isset($variant['steps']) || !isset($variant['successCriteria'])) {
            // If the AI response is not properly structured, return the original with modifications
            $variant = [
                ...$original_experiment,
                'title' => $variant['title'] ?? $original_experiment['title'] . ' (AI Variant)',
                'rationale' => $variant['rationale'] ?? 'An AI-generated variant of your original experiment.',
                'steps' => $variant['steps'] ?? $original_experiment['steps'],
                'successCriteria' => $variant['successCriteria'] ?? $original_experiment['successCriteria'],
                '_aiGenerated' => true
            ];
        }
        
        return $variant;
    }
}

// Initialize Lab Mode if the class exists and Lab Mode is enabled
if (class_exists('Micro_Coach_Core')) {
    new Micro_Coach_AI_Lab();
}
