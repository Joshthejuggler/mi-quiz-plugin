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

    public function __construct() {
        // Scan the 'quizzes' directory and load each module.
        $this->load_quiz_modules();

        // Add the new shortcode for the quiz dashboard.
        add_shortcode('quiz_dashboard', [$this, 'render_quiz_dashboard']);

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
        wp_enqueue_style('dashicons');

        ob_start();
        ?>
        <style>
            .quiz-dashboard-list { list-style: none; padding: 0; margin: 1em 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; max-width: 700px; }
            .quiz-dashboard-item { display: flex; align-items: baseline; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; background: #fff; gap: 15px; }
            .quiz-dashboard-status { flex-shrink: 0; width: 24px; text-align: center; }
            .quiz-dashboard-status .dashicons-yes-alt { color: #4CAF50; font-size: 24px; /* Adjusted for better baseline alignment */ }
            .quiz-dashboard-title { flex-grow: 1; font-size: 1.1em; font-weight: 500; }
            .quiz-dashboard-actions { flex-shrink: 0; }
            .quiz-dashboard-button { text-decoration: none; background: #ef4444; color: #fff; padding: 8px 16px; border-radius: 5px; font-weight: bold; font-size: 0.9em; transition: background 0.2s; white-space: nowrap; }
            .quiz-dashboard-button:hover { background: #dc2626; color: #fff; }
        </style>
        <div class="quiz-dashboard">
            <ul class="quiz-dashboard-list">
                <?php foreach ($quizzes as $id => $quiz): ?>
                    <?php
                    $has_results = $user_id && !empty($quiz['results_meta_key']) && !empty(get_user_meta($user_id, $quiz['results_meta_key'], true));
                    $quiz_page_url = $this->find_page_by_shortcode($quiz['shortcode']);
                    if (!$quiz_page_url) continue; // Don't show if its page can't be found.
                    ?>
                    <li class="quiz-dashboard-item">
                        <div class="quiz-dashboard-status">
                            <?php if ($has_results): ?>
                                <span class="dashicons dashicons-yes-alt" title="Completed"></span>
                            <?php endif; ?>
                        </div>
                        <div class="quiz-dashboard-title"><?php echo esc_html($quiz['title']); ?></div>
                        <div class="quiz-dashboard-actions">
                            <a href="<?php echo esc_url($quiz_page_url); ?>" class="quiz-dashboard-button">
                                <?php echo $has_results ? 'View Results' : 'Start Quiz'; ?>
                            </a>
                        </div>
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