<?php
/*
Plugin Name: Micro-Coach Quiz Platform
Description: A modular platform for hosting various quizzes with AI-powered insights and advanced caching.
Version: 1.2.0
Author: Your Name
License: GPL2
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Network: false
*/

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * This is the main plugin file. It is responsible for loading all
 * components in the correct order.
 */

// Define constants
define('MC_QUIZ_PLATFORM_PATH', plugin_dir_path(__FILE__));
define('MC_QUIZ_PLATFORM_VERSION', '1.2.0');
define('MC_QUIZ_PLATFORM_DB_VERSION', '1.1');

// Include the Composer autoloader for PHP libraries like Dompdf.
if (file_exists(MC_QUIZ_PLATFORM_PATH . 'vendor/autoload.php')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'vendor/autoload.php';
}

// Load utility classes first
if (!class_exists('MC_Security')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-security.php';
}
if (!class_exists('MC_Cache')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-cache.php';
}
if (!class_exists('MC_DB_Migration')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-db-migration.php';
}
if (!class_exists('MC_Helpers')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-helpers.php';
}
if (!class_exists('MC_Funnel')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-funnel.php';
}
if (!class_exists('MC_User_Profile')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'includes/class-mc-user-profile.php';
}

// Include all the necessary class files.
// These files should ONLY define classes, not run any code themselves.
require_once MC_QUIZ_PLATFORM_PATH . 'micro-coach-core.php';
require_once MC_QUIZ_PLATFORM_PATH . 'micro-coach-ai.php';
require_once MC_QUIZ_PLATFORM_PATH . 'micro-coach-ai-lab.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/johari-mi-quiz/module.php';

// Load admin activation helper for Johari MI
if (is_admin()) {
    require_once MC_QUIZ_PLATFORM_PATH . 'admin-activate.php';
}

/**
 * The main function to initialize the entire quiz platform.
 * This ensures all classes are loaded before we try to use them.
 */
function mc_quiz_platform_init() {
    // Run database migrations if needed
    if (is_admin()) {
        MC_DB_Migration::maybe_migrate();
    }
    
    // Initialize user profile management
    MC_User_Profile::init();
    
    // Instantiate the core platform and AI services.
    new Micro_Coach_Core();
    new Micro_Coach_AI();
    new Micro_Coach_AI_Lab();

    // Instantiate each quiz module.
    new MI_Quiz_Plugin_AI();
    new CDT_Quiz_Plugin();
    new Bartle_Quiz_Plugin();
    new Johari_MI_Quiz_Module();
}
add_action('plugins_loaded', 'mc_quiz_platform_init');

/**
 * Activation hook for the entire platform.
 */
function mc_quiz_platform_activate() {
    // Run activation tasks for each module if they exist.
    if (method_exists('MI_Quiz_Plugin_AI', 'activate')) {
        MI_Quiz_Plugin_AI::activate();
    }
    if (method_exists('CDT_Quiz_Plugin', 'activate')) {
        CDT_Quiz_Plugin::activate();
    }
    if (method_exists('Bartle_Quiz_Plugin', 'activate')) {
        Bartle_Quiz_Plugin::activate();
    }
    if (method_exists('Johari_MI_Quiz_Module', 'activate')) {
        Johari_MI_Quiz_Module::activate();
    }
}
register_activation_hook(__FILE__, 'mc_quiz_platform_activate');

/**
 * Forces Elementor to render our quiz shortcodes inside its Shortcode widget.
 * Some themes/plugins interfere with Elementor's shortcode processing; this
 * filter ensures our shortcodes are executed reliably.
 *
 * @param string $widget_content The HTML content of the widget.
 * @param \Elementor\Widget_Base $widget The widget instance.
 * @return string The processed content.
 */
function mc_force_render_quiz_shortcodes_in_elementor($widget_content, $widget) {
    if (is_object($widget) && method_exists($widget, 'get_name') && 'shortcode' === $widget->get_name()) {
        $content = (string) $widget_content;
        $shortcodes = [
            'quiz_dashboard',
            'mi_quiz', 'mi-quiz',
            'cdt_quiz', 'cdt-quiz',
            'bartle_quiz', 'bartle-quiz',
            'johari_mi_quiz', 'johari-mi-quiz',
        ];
        foreach ($shortcodes as $sc) {
            if (has_shortcode($content, $sc)) {
                return do_shortcode($content);
            }
        }
    }
    return $widget_content;
}
add_filter('elementor/widget/render_content', 'mc_force_render_quiz_shortcodes_in_elementor', 11, 2);

