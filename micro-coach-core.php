<?php
/*
Plugin Name: Micro-Coach Quiz Platform
Description: A modular platform for hosting various quizzes.
Version: 1.0
Author: Your Name
License: GPL2
*/

if ( ! defined( 'ABSPATH' ) ) exit;

// Include the Composer autoloader for PHP libraries like Dompdf.
if (file_exists(plugin_dir_path(__FILE__) . 'vendor/autoload.php')) {
    require_once plugin_dir_path(__FILE__) . 'vendor/autoload.php';
}

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
        // Scan the 'quizzes' directory and load each module.
        $this->load_quiz_modules();

        // Add the new shortcode for the quiz dashboard.
        add_shortcode('quiz_dashboard', [$this, 'render_quiz_dashboard']);

        if (is_admin()) {
            // Add admin settings page for the platform.
            add_action('admin_menu', [$this, 'add_settings_page'], 9);
            add_action('admin_init', [$this, 'register_settings']);
        }

        add_action('save_post', [$this, 'clear_shortcode_page_transients']);

        // Add an admin notice to show which modules were loaded.
        add_action('admin_notices', [$this, 'show_loaded_modules_notice']);
    }

    public function load_quiz_modules() {
        $quizzes_dir = plugin_dir_path(__FILE__) . 'quizzes/';

        // Look for any subdirectory within the 'quizzes' folder.
        foreach (glob($quizzes_dir . '*', GLOB_ONLYDIR) as $quiz_dir) {
            $module_file = $quiz_dir . '/module.php';
            if (file_exists($module_file)) {
                require_once $module_file;
                $this->loaded_modules[] = basename($quiz_dir);
            }
        }
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

        // Sort quizzes by the 'order' property.
        uasort($quizzes, function($a, $b) {
            return ($a['order'] ?? 99) <=> ($b['order'] ?? 99);
        });

        $user_id = get_current_user_id();
        $saved_descriptions = get_option(self::OPT_DESCRIPTIONS, []);
        wp_enqueue_style('dashicons');

        ob_start();
        ?>
        <style>
            /* General Layout & Spacing */
            .quiz-dashboard-list { 
                list-style: none; 
                padding: 0; 
                margin: 1em 0; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; 
                max-width: 700px; 
            }
            .quiz-dashboard-item { 
                background: #fff;
                border: 1px solid #e2e8f0; /* Softer border */
                border-radius: 12px;
                margin-bottom: 16px;
                padding: 16px 24px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); /* Softer shadow */
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            /* Header Section */
            .quiz-dashboard-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
            }
            .quiz-dashboard-item-title-group {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .quiz-dashboard-title { 
                font-size: 1.1em; 
                font-weight: 600;
                margin: 0;
                color: #1a202c;
            }
            .quiz-dashboard-status-badge {
                font-size: 0.75em;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 9999px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .quiz-dashboard-status-badge.completed { background-color: #e6f4ea; color: #34a853; }
            .quiz-dashboard-status-badge.locked { background-color: #f1f3f4; color: #5f6368; }

            /* Body / Content Section */
            .quiz-dashboard-item-body { padding-top: 12px; border-top: 1px solid #e2e8f0; }
            .quiz-dashboard-description { font-size: 0.9em; color: #4a5568; line-height: 1.5; margin: 0; }
            .quiz-dashboard-insight-panel { background-color: #f7fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-top: 12px; }
            .quiz-dashboard-insight-panel .panel-title { font-weight: 600; margin: 0 0 8px 0; font-size: 0.9em; color: #2d3748; }
            .quiz-dashboard-insight-panel p { font-size: 0.9em; color: #4a5568; line-height: 1.6; max-width: 70ch; margin: 0; }
            .insight-panel-prediction { border-left: 4px solid #ef4444; }
            .insight-panel-profile { border-left: 4px solid #4CAF50; }

            /* Chips for Top Intelligences */
            .quiz-dashboard-chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { background-color: #e2e8f0; color: #2d3748; padding: 4px 12px; border-radius: 16px; font-size: 0.85em; font-weight: 500; }

            /* Actions & Buttons */
            .quiz-dashboard-actions { flex-shrink: 0; }
            .quiz-dashboard-button { text-decoration: none; background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 9999px; font-weight: 600; font-size: 0.9em; transition: all 0.2s; white-space: nowrap; display: inline-block; border: 1px solid transparent; }
            .quiz-dashboard-button:hover { background: #dc2626; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
            .quiz-dashboard-button.is-disabled { background: #e2e8f0; color: #a0aec0; cursor: not-allowed; }
            .quiz-dashboard-button.is-disabled:hover { background: #e2e8f0; transform: none; box-shadow: none; }
        </style>
        <div class="quiz-dashboard">
            <ul class="quiz-dashboard-list">
                <?php
                // Pre-calculate completion status for all quizzes to check dependencies efficiently.
                $completion_status = [];
                if ($user_id) {
                    foreach ($quizzes as $id => $quiz) {
                        $completion_status[$id] = !empty($quiz['results_meta_key']) && !empty(get_user_meta($user_id, $quiz['results_meta_key'], true));
                    }
                }

                foreach ($quizzes as $id => $quiz):
                    $has_results = $completion_status[$id] ?? false;
                    $quiz_page_url = $this->find_page_by_shortcode($quiz['shortcode']);
                    if (!$quiz_page_url) continue; // Don't show if its page can't be found.

                    // Check dependencies.
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

                    $description = !empty($saved_descriptions[$id]) ? $saved_descriptions[$id] : $quiz['description'];
                    $prediction_paragraph = '';

                    // Dynamically set the CDT quiz description if the MI quiz is complete.
                    if ($id === 'cdt-quiz' && ($completion_status['mi-quiz'] ?? false)) {
                        $mi_prompts_file = plugin_dir_path(__FILE__) . 'quizzes/mi-quiz/mi-cdt-prompts.php';
                        if (file_exists($mi_prompts_file)) {
                            require $mi_prompts_file; // Use require instead of require_once to ensure it loads in this scope.
                            $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);

                            // Make this more robust: if top3 is missing but part1Scores exists, recalculate it.
                            if (is_array($mi_results)) {
                                if (empty($mi_results['top3']) && !empty($mi_results['part1Scores']) && is_array($mi_results['part1Scores'])) {
                                    $scores = $mi_results['part1Scores'];
                                    arsort($scores); // Sort scores descending, maintaining keys
                                    $mi_results['top3'] = array_keys(array_slice($scores, 0, 3, true));
                                }
                            }

                            // Check for top 3 results to generate the composite key.
                            if (!empty($mi_results['top3']) && count($mi_results['top3']) >= 3 && isset($mi_cdt_prompts)) {
                                $top3_keys = $mi_results['top3'];
                                sort($top3_keys); // Sort alphabetically to create a consistent key.
                                $prompt_key = implode('_', $top3_keys);

                                if (isset($mi_cdt_prompts[$prompt_key]['prompt'])) {
                                    $prediction_paragraph = $mi_cdt_prompts[$prompt_key]['prompt'];
                                }
                            }
                        }
                    }

                    // Prepare MI profile content if applicable
                    $mi_profile_content = '';
                    if ($has_results && $id === 'mi-quiz') {
                        $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                        $mi_questions_file = plugin_dir_path(__FILE__) . 'quizzes/mi-quiz/mi-questions.php';
                        if (file_exists($mi_questions_file)) {
                            require $mi_questions_file; // defines $mi_categories
                            if (!empty($mi_results['top3']) && isset($mi_categories)) {
                                $top3_names = array_map(function($slug) use ($mi_categories) {
                                    return $mi_categories[$slug] ?? ucfirst(str_replace('-', ' ', $slug));
                                }, $mi_results['top3']);
                                $mi_profile_content = $top3_names;
                            }
                        }
                    }

                    ?>
                    <li class="quiz-dashboard-item">
                        <div class="quiz-dashboard-item-header">
                            <div class="quiz-dashboard-item-title-group">
                                <h3 class="quiz-dashboard-title"><?php echo esc_html($quiz['title']); ?></h3>
                                <?php if ($has_results): ?>
                                    <span class="quiz-dashboard-status-badge completed">Completed</span>
                                <?php elseif (!$dependency_met): ?>
                                    <span class="quiz-dashboard-status-badge locked">Locked</span>
                                <?php endif; ?>
                            </div>
                            <div class="quiz-dashboard-actions">
                                <?php if ($dependency_met): ?>
                                    <a href="<?php echo esc_url($quiz_page_url); ?>" class="quiz-dashboard-button">
                                        <?php echo $has_results ? 'View Results' : 'Start Quiz'; ?>
                                    </a>
                                <?php else: ?>
                                    <span class="quiz-dashboard-button is-disabled" title="<?php printf(esc_attr__('Please complete "%s" first.'), esc_attr($dependency_title)); ?>">
                                        <?php _e('Locked'); ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>

                        <?php if ((!$has_results && (!empty($description) || !empty($prediction_paragraph))) || !empty($mi_profile_content)): ?>
                            <div class="quiz-dashboard-item-body">
                                <?php if (!$has_results): ?>
                                    <?php if (!empty($description)): ?>
                                        <p class="quiz-dashboard-description"><?php echo esc_html($description); ?></p>
                                    <?php endif; ?>
                                    <?php if (!empty($prediction_paragraph)): ?>
                                        <div class="quiz-dashboard-insight-panel insight-panel-prediction">
                                            <p class="panel-title">Your Personalized CDT Prediction</p>
                                            <p><?php echo esc_html($prediction_paragraph); ?></p>
                                        </div>
                                    <?php endif; ?>
                                <?php elseif (!empty($mi_profile_content)): ?>
                                    <div class="quiz-dashboard-insight-panel insight-panel-profile">
                                        <p class="panel-title">Your Top Intelligences</p>
                                        <div class="quiz-dashboard-chips">
                                            <?php foreach ($mi_profile_content as $name): ?>
                                                <span class="chip"><?php echo esc_html($name); ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
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
     * Displays an admin notice to confirm which modules have been loaded.
     * This is a helpful diagnostic tool.
     */
    public function show_loaded_modules_notice() {
        $quizzes_dir_path = plugin_dir_path(__FILE__) . 'quizzes/';
        if (empty($this->loaded_modules)) {
            echo '<div class="notice notice-error"><p><strong>Micro-Coach Quiz Platform Warning:</strong> No quiz modules were found. The platform looked in the following directory: <code>' . esc_html($quizzes_dir_path) . '</code>. Please ensure your quiz modules (e.g., a "mi-quiz" folder) are placed in their own subdirectories there.</p></div>';
        } else {
            $modules_list = esc_html(implode(', ', $this->loaded_modules));
            echo '<div class="notice notice-success is-dismissible"><p><strong>Micro-Coach Quiz Platform:</strong> Successfully loaded the following quiz modules: <strong>' . $modules_list . '</strong>.</p></div>';
        }
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

// Boot the platform.
add_action('plugins_loaded', function() { new Micro_Coach_Core(); });

/**
 * Activation hook for the entire platform.
 * It finds all modules and runs their static 'activate' method if it exists.
 */
function micro_coach_platform_activate() {
    $quizzes_dir = plugin_dir_path(__FILE__) . 'quizzes/';
    foreach (glob($quizzes_dir . '*', GLOB_ONLYDIR) as $quiz_dir) {
        $module_file = $quiz_dir . '/module.php';
        if (file_exists($module_file)) {
            // Get all declared classes before we load the module file.
            $before = get_declared_classes();
            require_once $module_file;
            // Get all declared classes after, and find the new one.
            $after = get_declared_classes();
            $new_classes = array_diff($after, $before);

            foreach ($new_classes as $class_name) {
                // If the new class has a static 'activate' method, run it.
                if (method_exists($class_name, 'activate')) {
                    call_user_func([$class_name, 'activate']);
                }
            }
        }
    }
}
register_activation_hook(__FILE__, 'micro_coach_platform_activate');