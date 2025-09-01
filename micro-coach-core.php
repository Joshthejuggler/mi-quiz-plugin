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

    public function __construct() {
        // Scan the 'quizzes' directory and load each module.
        $this->load_quiz_modules();

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