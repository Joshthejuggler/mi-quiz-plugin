<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * The main Core class for the quiz platform.
 * Its job is to load shared services and discover/load all available quiz modules.
 */
class Micro_Coach_Core {
    private $loaded_modules = [];
    private static $registered_quizzes = [];
    const OPT_GROUP = 'mc_quiz_platform_settings';
    const OPT_DESCRIPTIONS = 'mc_quiz_descriptions';

    public function __construct() {
        // Add the new shortcode for the quiz dashboard.
        add_shortcode('quiz_dashboard', [$this, 'render_quiz_dashboard']);

        if (is_admin()) {
            // Add admin settings page for the platform.
            add_action('admin_menu', [$this, 'add_settings_page'], 9);
            add_action('admin_init', [$this, 'register_settings']);
        }

        add_action('save_post', [$this, 'clear_shortcode_page_transients']);
    }

    /**
     * Allows quiz modules to register themselves with the core platform.
     * @param string $id A unique ID for the quiz (e.g., 'mi-quiz').
     * @param array $args An array of quiz metadata.
     */
    public static function register_quiz($id, $args) {
        $defaults = [
            'title'            => 'Untitled Quiz',
            'shortcode'        => '',
            'results_meta_key' => '',
            'order'            => 99,
            'description'      => '',
            'description_completed' => '',
            'depends_on'       => null,
        ];
        self::$registered_quizzes[$id] = wp_parse_args($args, $defaults);
    }

    /**
     * Returns the array of all registered quizzes.
     * @return array
     */
    public static function get_quizzes() {
        return self::$registered_quizzes;
    }

    /**
     * Adds the main settings page for the quiz platform.
     */
    public function add_settings_page() {
        add_menu_page(
            'Quiz Platform Settings',
            'Quiz Platform',
            'manage_options',
            'quiz-platform-settings',
            [$this, 'render_settings_page'],
            'dashicons-forms',
            58 // Position it near other quiz menus.
        );

        add_submenu_page(
            'quiz-platform-settings',
            'Quiz Platform Settings',
            'Settings',
            'manage_options',
            'quiz-platform-settings', // Use parent slug for the main settings page
            [$this, 'render_settings_page']
        );
    }

    /**
     * Registers settings for the quiz platform, like descriptions.
     */
    public function register_settings() {
        register_setting(self::OPT_GROUP, self::OPT_DESCRIPTIONS, [$this, 'sanitize_descriptions']);
        add_settings_section('mc_quiz_descriptions_section', 'Quiz Descriptions', null, 'quiz-platform-settings');

        $quizzes = self::get_quizzes();
        uasort($quizzes, function($a, $b) {
            return ($a['order'] ?? 99) <=> ($b['order'] ?? 99);
        });

        $descriptions = get_option(self::OPT_DESCRIPTIONS, []);

        foreach ($quizzes as $id => $quiz) {
            add_settings_field(
                'mc_quiz_desc_' . $id,
                $quiz['title'],
                function() use ($id, $quiz, $descriptions) {
                    $value = isset($descriptions[$id]) ? esc_textarea($descriptions[$id]) : '';
                    echo '<textarea name="' . self::OPT_DESCRIPTIONS . '[' . esc_attr($id) . ']" rows="3" style="width: 90%; max-width: 500px;">' . $value . '</textarea>';
                    echo '<p class="description">This text will be shown on the dashboard if the user has not yet taken this quiz. Default: <em>' . esc_html($quiz['description']) . '</em></p>';
                },
                'quiz-platform-settings',
                'mc_quiz_descriptions_section'
            );
        }
    }

    public function sanitize_descriptions($input) {
        $sanitized = [];
        if (is_array($input)) {
            foreach ($input as $id => $desc) {
                $sanitized[sanitize_key($id)] = sanitize_textarea_field(stripslashes($desc));
            }
        }
        return $sanitized;
    }

    public function render_settings_page() {
        ?><div class="wrap"><h1>Quiz Platform Settings</h1>
        <form method="post" action="options.php"><?php
            settings_fields(self::OPT_GROUP);
            do_settings_sections('quiz-platform-settings');
            submit_button();
        ?></form></div><?php
    }

    /**
     * Renders the [quiz_dashboard] shortcode content.
     */
    public function render_quiz_dashboard() {
        $quizzes = self::get_quizzes();
        if (empty($quizzes)) {
            return current_user_can('manage_options') ? '<p><em>Quiz Dashboard: No quizzes have been registered.</em></p>' : '';
        }

        $user_id = get_current_user_id();
        $saved_descriptions = get_option(self::OPT_DESCRIPTIONS, []);
        wp_enqueue_style('dashicons');
 
        ob_start();
 
        if ( $user_id ) { // Logged-in user view
            // --- Calculate Progress & Next Step ---
            $u = wp_get_current_user();
            if ( ! empty( $u->first_name ) ) {
                $first = $u->first_name;
            } elseif ( ! empty( $u->display_name ) ) {
                $first = $u->display_name;
            } else {
                $first = "Friend";
            }
            $greetings = [
                "Welcome back, {$first} — what will you discover today?",
                "Good to see you, {$first}. Your journey continues.",
                "Hi {$first}, ready for another step in self-discovery?",
                "{$first}, small steps lead to big insights."
            ];
            $greeting = $greetings[ array_rand( $greetings ) ];
 
            // --- Build Activity Feed & Latest Insight ---
            $activity_feed = [];
            foreach ($quizzes as $id => $quiz) {
                if (!empty($quiz['results_meta_key'])) {
                    $results = get_user_meta($user_id, $quiz['results_meta_key'], true);
                    if (!empty($results) && is_array($results) && isset($results['completed_at'])) {
                        $activity_feed[] = [
                            'quiz_id'    => $id,
                            'quiz_title' => $quiz['title'],
                            'timestamp'  => $results['completed_at'],
                            'results'    => $results,
                        ];
                    }
                }
            }

            // Add account creation to the feed
            $user_data = get_userdata($user_id);
            $activity_feed[] = [
                'quiz_id'    => 'account_creation',
                'quiz_title' => 'Created your account',
                'timestamp'  => strtotime($user_data->user_registered),
                'results'    => [],
            ];

            // Sort the feed by timestamp descending
            usort($activity_feed, function($a, $b) {
                return $b['timestamp'] <=> $a['timestamp'];
            });

            $latest_insight_html = '<p class="placeholder-text"><em>Complete an assessment to see your first insight here!</em></p>';
            $latest_activity = null;
            // Find the most recent *quiz* activity for the insight panel
            foreach ($activity_feed as $activity) {
                if ($activity['quiz_id'] !== 'account_creation') {
                    $latest_activity = $activity;
                    break;
                }
            }

            // --- Calculate completion status for sorting and progress ---
            $completion_status = [];
            foreach ($quizzes as $id => $quiz) {
                $completion_status[$id] = !empty($quiz['results_meta_key']) && !empty(get_user_meta($user_id, $quiz['results_meta_key'], true));
            }

            // --- Sort Quizzes for Display ---
            // Add ID to each quiz for sorting purposes
            foreach ($quizzes as $id => &$quiz) {
                $quiz['id'] = $id;
            }
            unset($quiz); // Unset reference

            // Sort by completion status first, then by order.
            uasort($quizzes, function($a, $b) use ($completion_status) {
                $completed_a = $completion_status[$a['id']] ?? false;
                $completed_b = $completion_status[$b['id']] ?? false;

                if ($completed_a === $completed_b) {
                    return ($a['order'] ?? 99) <=> ($b['order'] ?? 99); // Secondary sort: by order
                }

                return $completed_a <=> $completed_b; // Primary sort: incomplete (false) before complete (true)
            });

            $total_quizzes = count($quizzes);
            $completed_quizzes = count(array_filter($completion_status));
            $progress_pct = ($total_quizzes > 0) ? round(($completed_quizzes / $total_quizzes) * 100) : 0;
 
            $next_step_url = '';
            $next_step_title = 'All Complete!';
            if ($progress_pct < 100) {
                foreach ($quizzes as $id => $quiz) {
                    $dependency_met = true;
                    if (!empty($quiz['depends_on']) && !($completion_status[$quiz['depends_on']] ?? false)) {
                        $dependency_met = false;
                    }
                    if ($dependency_met && !($completion_status[$id] ?? false)) {
                        $next_step_url = $this->find_page_by_shortcode($quiz['shortcode']);
                        $next_step_title = 'Next Step: ' . $quiz['title'];
                        break;
                    }
                }
            }
            ?>
            <div class="quiz-dashboard-container">
                <!-- Hero / Greeting Row -->
                <div class="quiz-dashboard-hero">
                    <div class="quiz-dashboard-hero-greeting">
                        <h2 class="greeting-title"><?php echo esc_html($greeting); ?></h2>
                        <p class="greeting-subtitle">Your journey of self-discovery is a marathon, not a sprint. Each step reveals something new.</p>
                    </div>
                    <div class="quiz-dashboard-hero-progress-card">
                        <div class="progress-card-header">
                            <h3 class="progress-card-title">Your Progress</h3>
                            <span class="progress-card-percent"><?php echo esc_html($progress_pct); ?>%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: <?php echo esc_attr($progress_pct); ?>%;"></div>
                        </div>
                        <?php if ($next_step_url): ?>
                            <a href="<?php echo esc_url($next_step_url); ?>" class="quiz-dashboard-button progress-card-next-step-btn"><?php echo esc_html($next_step_title); ?></a>
                        <?php else: ?>
                            <span class="quiz-dashboard-button is-disabled progress-card-next-step-btn"><?php echo esc_html($next_step_title); ?></span>
                        <?php endif; ?>
                    </div>
                </div>
 
                <!-- Your Path Section -->
                <h2 class="quiz-dashboard-section-title">Your Path</h2>
                <div class="quiz-dashboard-grid">
                    <?php
                    foreach ($quizzes as $id => $quiz):
                        $has_results = $completion_status[$id] ?? false;
                        $quiz_page_url = $this->find_page_by_shortcode($quiz['shortcode']);
                        if (!$quiz_page_url) continue;
 
                        $dependency_met = true;
                        $dependency_title = '';
                        if (!empty($quiz['depends_on'])) {
                            $dependency_id = $quiz['depends_on'];
                            if (isset($quizzes[$dependency_id])) {
                                $dependency_title = $quizzes[$dependency_id]['title'];
                                if (!($completion_status[$dependency_id] ?? false)) {
                                    $dependency_met = false;
                                }
                            }
                        }

                        if ($has_results && !empty($quiz['description_completed'])) {
                            $description = $quiz['description_completed'];
                        } else {
                            // The admin-editable description should only apply to the initial state.
                            $description = !empty($saved_descriptions[$id]) ? $saved_descriptions[$id] : $quiz['description'];
                        }

                        $prediction_paragraph = '';
                        if ($id === 'cdt-quiz' && ($completion_status['mi-quiz'] ?? false)) {
                            $mi_prompts_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-cdt-prompts.php';
                            if (file_exists($mi_prompts_file)) {
                                require $mi_prompts_file;
                                $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);

                                if (is_array($mi_results) && empty($mi_results['top3']) && !empty($mi_results['part1Scores']) && is_array($mi_results['part1Scores'])) {
                                    $scores = $mi_results['part1Scores'];
                                    arsort($scores);
                                    $mi_results['top3'] = array_keys(array_slice($scores, 0, 3, true));
                                }

                                if (!empty($mi_results['top3']) && count($mi_results['top3']) >= 3 && isset($mi_cdt_prompts)) {
                                    $top3_keys = $mi_results['top3'];
                                    sort($top3_keys);
                                    $prompt_key = implode('_', $top3_keys);

                                    if (isset($mi_cdt_prompts[$prompt_key]['prompt'])) {
                                        $prediction_paragraph = $mi_cdt_prompts[$prompt_key]['prompt'];
                                    }
                                }
                            }
                        }

                        $mi_profile_content = '';
                        if ($has_results && $id === 'mi-quiz') {
                            $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                            $mi_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
                            if (file_exists($mi_questions_file)) {
                                require_once $mi_questions_file;
                                if (!empty($mi_results['top3']) && isset($mi_categories)) {
                                    $top3_names = array_map(function($slug) use ($mi_categories) {
                                        return $mi_categories[$slug] ?? ucfirst(str_replace('-', ' ', $slug));
                                    }, $mi_results['top3']);
                                    $mi_profile_content = $top3_names;
                                }
                            }
                        }
                        ?>
                        <div class="quiz-dashboard-item <?php if (!$dependency_met) echo 'is-locked'; ?>">
                            <div class="quiz-dashboard-item-header">
                                <h3 class="quiz-dashboard-title"><?php echo esc_html($quiz['title']); ?></h3>
                                <?php if ($has_results): ?>
                                    <span class="quiz-dashboard-status-badge completed">Completed</span>
                                <?php elseif (!$dependency_met): ?>
                                    <span class="quiz-dashboard-status-badge locked">Locked</span>
                                <?php else: ?>
                                    <span class="quiz-dashboard-status-badge not-started">Not Started</span>
                                <?php endif; ?>
                            </div>
                            <div class="quiz-dashboard-item-body">
                                <p class="quiz-dashboard-description"><?php echo esc_html($description); ?></p>

                                <?php if (!empty($mi_profile_content)): ?>
                                    <div class="quiz-dashboard-insight-panel insight-panel-profile">
                                        <h4 class="insight-panel-title">Your Top Intelligences</h4>
                                        <div class="quiz-dashboard-chips">
                                            <?php foreach ($mi_profile_content as $name): ?>
                                                <span class="chip"><?php echo esc_html($name); ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($prediction_paragraph)): ?>
                                    <div class="quiz-dashboard-insight-panel insight-panel-prediction">
                                        <h4 class="insight-panel-title">Your Personalized CDT Prediction</h4>
                                        <p><?php echo wp_kses_post($prediction_paragraph); ?></p>
                                    </div>
                                <?php endif; ?>
                            </div>
                            <div class="quiz-dashboard-actions">
                                <?php if ($dependency_met): ?>
                                    <a href="<?php echo esc_url($quiz_page_url); ?>" class="quiz-dashboard-button <?php if ($has_results) echo 'quiz-dashboard-button-secondary'; ?>">
                                        <?php echo $has_results ? 'View Results' : 'Start Quiz'; ?>
                                    </a>
                                <?php else: ?>
                                    <span class="quiz-dashboard-button is-disabled" title="<?php printf(esc_attr__('Please complete "%s" first.'), esc_attr($dependency_title)); ?>">
                                        <?php _e('Locked'); ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
 
                <!-- Insights & Activity Section (Placeholders) -->
                <h2 class="quiz-dashboard-section-title">Insights &amp; Activity</h2>
                <div class="quiz-dashboard-lower-grid">
                    <div class="insight-panel">
                        <h3 class="panel-title">Latest Insight</h3>
                        <?php
                        if ($latest_activity) {
                            // Load data files needed for insights
                            $mi_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
                            if (file_exists($mi_questions_file)) { require_once $mi_questions_file; }
                            $cdt_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php';
                            if (file_exists($cdt_questions_file)) { require_once $cdt_questions_file; }
                            $cdt_details_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/details.php';
                            if (file_exists($cdt_details_file)) { require_once $cdt_details_file; }

                            switch ($latest_activity['quiz_id']) {
                                case 'mi-quiz':
                                    // The top sub-skill is the first item in the 'top5' array.
                                    if (!empty($latest_activity['results']['top5'][0])) {
                                        $top_sub_skill = $latest_activity['results']['top5'][0];
                                        $age_group = $latest_activity['results']['age'] ?? 'adult';
                                        
                                        $sub_skill_name = $top_sub_skill['name'];
                                        $parent_slug = $top_sub_skill['slug'];
                                        
                                        $leverage_tip = '';
                                        if (isset($mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name]) && is_array($mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name])) {
                                            $tips = $mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name];
                                            $leverage_tip = $tips[array_rand($tips)]; // Pick a random tip
                                        }

                                        $latest_insight_html = '<p>Your top MI strength is <strong>' . esc_html($sub_skill_name) . '</strong>. This is a key part of your ' . esc_html($top_sub_skill['parent']) . '.</p>';
                                        if ($leverage_tip) {
                                            $latest_insight_html .= '<p class="insight-leverage-tip"><strong>To leverage this:</strong> ' . esc_html($leverage_tip) . '</p>';
                                        }

                                        // Add growth area
                                        if (!empty($latest_activity['results']['bottom3'][0])) {
                                            $lowest_sub_skill = $latest_activity['results']['bottom3'][0];
                                            $sub_skill_name = $lowest_sub_skill['name'];
                                            $parent_slug = $lowest_sub_skill['slug'];

                                            $growth_tip = '';
                                            if (isset($mi_growth_tips[$age_group][$parent_slug][$sub_skill_name]) && is_array($mi_growth_tips[$age_group][$parent_slug][$sub_skill_name])) {
                                                $tips = $mi_growth_tips[$age_group][$parent_slug][$sub_skill_name];
                                                $growth_tip = $tips[array_rand($tips)];
                                            }

                                            if ($growth_tip) {
                                                $latest_insight_html .= '<p class="insight-growth-tip"><strong>An area for growth:</strong> In ' . esc_html($sub_skill_name) . ', try to ' . esc_html(lcfirst($growth_tip)) . '</p>';
                                            }
                                        }
                                    }
                                    break;
                                case 'cdt-quiz':
                                    if (!empty($latest_activity['results']['sortedScores'][0]) && isset($cdt_categories)) {
                                        $top_cdt_slug = $latest_activity['results']['sortedScores'][0][0];
                                        $top_cdt_name = $cdt_categories[$top_cdt_slug] ?? 'Unknown';
                                        $latest_insight_html = '<p>Your CDT Quiz results indicate a high capacity for <strong>' . esc_html($top_cdt_name) . '</strong>. This is a key skill for navigating complex challenges.</p>';

                                        // Add growth area
                                        $sorted_scores = $latest_activity['results']['sortedScores'];
                                        if (!empty($sorted_scores) && isset($cdt_dimension_details)) {
                                            $lowest_cdt_slug = end($sorted_scores)[0];
                                            $age_group = $latest_activity['results']['ageGroup'] ?? 'adult';
                                            
                                            if (isset($cdt_dimension_details[$lowest_cdt_slug])) {
                                                $details = $cdt_dimension_details[$lowest_cdt_slug];
                                                $age_details = $details[$age_group] ?? $details['adult'];
                                                
                                                if (!empty($age_details['growth']) && is_array($age_details['growth'])) {
                                                    $growth_tip = $age_details['growth'][array_rand($age_details['growth'])];
                                                    $lowest_cdt_name = $details['title'] ?? $cdt_categories[$lowest_cdt_slug] ?? 'Unknown';
                                                    $latest_insight_html .= '<p class="insight-growth-tip"><strong>An area for growth:</strong> In ' . esc_html($lowest_cdt_name) . ', try to ' . esc_html(lcfirst($growth_tip)) . '</p>';
                                                }
                                            }
                                        }
                                    }
                                    break;
                            }
                        }
                        echo $latest_insight_html;
                        ?>
                    </div>
                    <div class="activity-panel">
                        <h3 class="panel-title">Recent Activity</h3>
                        <ul class="activity-list">
                            <?php foreach (array_slice($activity_feed, 0, 5) as $activity): ?>
                                <li><span class="activity-date"><?php echo esc_html(human_time_diff($activity['timestamp'])); ?> ago:</span> <?php echo esc_html($activity['quiz_title']); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>
 
                <!-- Resources Section (Placeholder) -->
                <div class="quiz-dashboard-resources">
                    <a href="#" class="resource-link"><span class="dashicons dashicons-editor-help"></span> Help Center</a>
                    <a href="#" class="resource-link"><span class="dashicons dashicons-info"></span> FAQs</a>
                    <a href="#" class="resource-link"><span class="dashicons dashicons-email-alt"></span> Contact Us</a>
                </div>
            </div>
 
        <?php } else { // Logged-out user view
            // Find the URL for the primary starting quiz.
            $mi_quiz_url = $this->find_page_by_shortcode('mi_quiz');
            ?>
            <style>
                .quiz-dashboard-auth-prompt {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px 32px;
                    text-align: center;
                    max-width: 500px;
                    margin: 2em auto;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
                }
                .quiz-dashboard-auth-prompt h2 {
                    font-size: 1.5em;
                    margin-top: 0;
                    color: #1a202c;
                }
                .quiz-dashboard-auth-prompt p {
                    font-size: 1em;
                    color: #4a5568;
                    margin-bottom: 1.5em;
                }
                .quiz-dashboard-auth-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .quiz-dashboard-auth-prompt .quiz-dashboard-button-secondary {
                    background: #f1f3f4;
                    color: #2d3748;
                    border: 1px solid #e2e8f0;
                }
                .quiz-dashboard-auth-prompt .quiz-dashboard-button-secondary:hover {
                    background: #e2e8f0;
                    color: #1a202c;
                }
                .quiz-dashboard-admin-notice {
                    margin-top: 1.5em;
                    padding: 0.75em;
                    background-color: #fffbe6;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    font-size: 0.9em;
                    text-align: left;
                    color: #92400e;
                }
            </style>
            <div class="quiz-dashboard-auth-prompt">
                <h2>Welcome to Skill of Self-Discovery</h2>
                <p>Explore guided assessments and AI-powered tools that help you understand your strengths, navigate challenges, and grow with intention. Please select an option below to start your journey or view your progress.</p>
                <div class="quiz-dashboard-auth-actions">
                    <?php if ($mi_quiz_url): ?>
                        <a href="<?php echo esc_url($mi_quiz_url); ?>" class="quiz-dashboard-button">Start Your Journey (Free)</a>
                    <?php else: ?>
                        <span class="quiz-dashboard-button is-disabled" title="The starting quiz has not been set up yet.">Start Your Journey (Free)</span>
                    <?php endif; ?>
                    <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="quiz-dashboard-button quiz-dashboard-button-secondary">Returning User? Log In</a>
                </div>
                <?php if ( ! $mi_quiz_url && current_user_can('manage_options') ): ?>
                    <div class="quiz-dashboard-admin-notice">
                        <strong>Admin Notice:</strong> The "Start Your Journey" button is disabled because no published page contains the <code>[mi_quiz]</code> shortcode. Please create a page for the MI Quiz and add its shortcode.
                    </div>
                <?php endif; ?>
            </div>
        <?php } ?>
 
        <style>
            .quiz-dashboard-container { max-width: 900px; margin: 2em auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
            .quiz-dashboard-hero { display: flex; align-items: stretch; gap: 24px; margin-bottom: 2em; }
            .quiz-dashboard-hero-greeting { flex-grow: 1; }
            .greeting-title { font-size: 1.8em; font-weight: 600; color: #1a202c; margin: 0 0 0.25em 0; }
            .greeting-subtitle { font-size: 1em; color: #4a5568; margin: 0; }
            .quiz-dashboard-hero-progress-card { flex-basis: 320px; flex-shrink: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }
            .progress-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
            .progress-card-title { font-size: 1em; font-weight: 600; margin: 0; color: #2d3748; }
            .progress-card-percent { font-size: 0.9em; font-weight: 600; color: #4a5568; }
            .progress-bar-container { width: 100%; background: #e2e8f0; border-radius: 99px; height: 8px; overflow: hidden; margin-bottom: 20px; }
            .progress-bar-fill { background: #4CAF50; height: 100%; transition: width 0.5s ease-in-out; }
            .progress-card-next-step-btn { margin-top: auto; }
 
            .quiz-dashboard-section-title { margin-top: 2.5em; margin-bottom: 1em; font-size: 1.5em; font-weight: 600; color: #1a202c; padding-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; }
 
            .quiz-dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 2.5em; }
            .quiz-dashboard-list { 
                list-style: none; 
                padding: 0; 
                margin: 1em 0; 
            }
            .quiz-dashboard-item { 
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
                display: flex;
                flex-direction: column;
                transition: all 0.2s ease-in-out;
            }
            .quiz-dashboard-item:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07), 0 4px 6px -4px rgba(0,0,0,0.07); }
            .quiz-dashboard-item.is-locked { opacity: 0.6; background: #f8fafc; pointer-events: none; }
            .quiz-dashboard-item.is-locked .quiz-dashboard-actions .quiz-dashboard-button { pointer-events: auto; } /* Allow tooltip on button */
 
            .quiz-dashboard-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            .quiz-dashboard-item-body { border-top: 1px solid #e2e8f0; padding-top: 12px; flex-grow: 1; }
            .quiz-dashboard-actions { margin-top: 16px; }
 
            .quiz-dashboard-title { 
                font-size: 1.1em; 
                font-weight: 600;
                margin: 0;
                color: #1a202c;
            }
            .quiz-dashboard-status-badge { font-size: 0.75em; font-weight: 600; padding: 4px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
            .quiz-dashboard-status-badge.completed { background-color: #e6f4ea; color: #34a853; }
            .quiz-dashboard-status-badge.locked { background-color: #f1f3f4; color: #5f6368; }
            .quiz-dashboard-status-badge.not-started { background-color: #eef2ff; color: #4f46e5; }
 
            .quiz-dashboard-description { font-size: 0.9em; color: #4a5568; line-height: 1.5; margin: 0; }
 
            .quiz-dashboard-button { text-decoration: none; background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 9999px; font-weight: 600; font-size: 0.9em; transition: all 0.2s; white-space: nowrap; display: inline-block; border: 1px solid transparent; }
            .quiz-dashboard-button:hover { background: #dc2626; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
            .quiz-dashboard-button.is-disabled { background: #e2e8f0; color: #a0aec0; cursor: not-allowed; }
            .quiz-dashboard-button.is-disabled:hover { background: #e2e8f0; transform: none; box-shadow: none; }
            .quiz-dashboard-button.quiz-dashboard-button-secondary {
                background: #f1f3f4;
                color: #2d3748;
                border: 1px solid #e2e8f0;
            }
            .quiz-dashboard-button.quiz-dashboard-button-secondary:hover {
                background: #e2e8f0;
                color: #1a202c;
                transform: none;
                box-shadow: none;
            }
            .quiz-dashboard-insight-panel { background-color: #f7fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-top: 12px; }
            .quiz-dashboard-insight-panel .insight-panel-title { font-weight: 600; margin: 0 0 8px 0; font-size: 0.9em; color: #2d3748; }
            .quiz-dashboard-insight-panel p { font-size: 0.9em; color: #4a5568; line-height: 1.6; max-width: 70ch; margin: 0; }
            .insight-panel-prediction { border-left: 4px solid #ef4444; }
            .insight-panel-profile { border-left: 4px solid #4CAF50; }
            .quiz-dashboard-chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { background-color: #e2e8f0; color: #2d3748; padding: 4px 12px; border-radius: 16px; font-size: 0.85em; font-weight: 500; }
 
            .quiz-dashboard-lower-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
            .panel-title { font-size: 1.1em; font-weight: 600; margin: 0 0 1em 0; color: #1a202c; }
            .insight-panel, .activity-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); transition: all 0.2s ease-in-out; }
            .insight-leverage-tip { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px dashed #e2e8f0; }
            .insight-growth-tip { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px dashed #f59e0b; }
            .placeholder-text { color: #64748b; font-style: italic; }
            .activity-list { list-style: none; padding: 0; margin: 0; }
            .activity-list li { padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-size: 0.9em; color: #4a5568; }
            .activity-list li:last-child { border-bottom: none; }
            .activity-date { font-weight: 500; color: #2d3748; margin-right: 8px; }
 
            .quiz-dashboard-resources { display: flex; gap: 24px; justify-content: center; margin-top: 2.5em; padding-top: 1.5em; border-top: 1px solid #e2e8f0; }
            .resource-link { color: #4a5568; text-decoration: none; font-size: 0.9em; display: flex; align-items: center; gap: 6px; }
            .resource-link:hover { color: #1a202c; }
 
            @media (max-width: 768px) {
                .quiz-dashboard-hero { flex-direction: column; }
                .quiz-dashboard-grid { grid-template-columns: 1fr; }
                .quiz-dashboard-lower-grid { grid-template-columns: 1fr; }
            }
        </style>
        <?php
        return ob_get_clean();
    }

    /**
     * Finds the permalink of the first page that contains a given shortcode.
     * Results are cached in a transient to improve performance.
     */
    private function find_page_by_shortcode($shortcode_tag) {
        if (empty($shortcode_tag)) return null;
        $transient_key = 'page_url_for_' . $shortcode_tag;
        if (false !== ($cached_url = get_transient($transient_key))) return $cached_url;

        $query = new WP_Query(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'posts_per_page' => -1, 's' => '[' . $shortcode_tag]);
        $url = null;
        if ($query->have_posts()) {
            foreach ($query->posts as $p) { if (has_shortcode($p->post_content, $shortcode_tag)) { $url = get_permalink($p->ID); break; } }
        }
        set_transient($transient_key, $url, DAY_IN_SECONDS); // Cache for 1 day.
        return $url;
    }

    /**
     * Clears page URL transients when a post is saved to keep the dashboard links fresh.
     */
    public function clear_shortcode_page_transients() {
        $quizzes = self::get_quizzes();
        foreach ($quizzes as $quiz) {
            if (!empty($quiz['shortcode'])) delete_transient('page_url_for_' . $quiz['shortcode']);
        }
    }
}