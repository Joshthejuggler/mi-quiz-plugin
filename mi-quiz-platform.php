<?php
/*
Plugin Name: Micro-Coach Quiz Platform
Description: A modular platform for hosting various quizzes.
Version: 1.1
Author: Your Name
License: GPL2
*/

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * This is the main plugin file. It is responsible for loading all
 * components in the correct order.
 */

// Define a constant for the plugin directory path for easy reuse.
define('MC_QUIZ_PLATFORM_PATH', plugin_dir_path(__FILE__));

// Include the Composer autoloader for PHP libraries like Dompdf.
if (file_exists(MC_QUIZ_PLATFORM_PATH . 'vendor/autoload.php')) {
    require_once MC_QUIZ_PLATFORM_PATH . 'vendor/autoload.php';
}

// 1. Include all the necessary class files.
// These files should ONLY define classes, not run any code themselves.
require_once MC_QUIZ_PLATFORM_PATH . 'micro-coach-core.php';
require_once MC_QUIZ_PLATFORM_PATH . 'micro-coach-ai.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/module.php';

/**
 * The main function to initialize the entire quiz platform.
 * This ensures all classes are loaded before we try to use them.
 */
function mc_quiz_platform_init() {
    // Instantiate the core platform and AI services.
    new Micro_Coach_Core();
    new Micro_Coach_AI();

    // Instantiate each quiz module.
    new MI_Quiz_Plugin_AI();
    new CDT_Quiz_Plugin();
    new Bartle_Quiz_Plugin();
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

