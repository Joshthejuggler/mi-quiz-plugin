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
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/module.php';
require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/module.php';

/**
 * The main function to initialize the entire quiz platform.
 * This ensures all classes are loaded before we try to use them.
 */
function mc_quiz_platform_init() {
    // Instantiate the core platform.
    new Micro_Coach_Core();

    // Instantiate each quiz module.
    new MI_Quiz_Plugin_AI();
    new CDT_Quiz_Plugin();
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
}
register_activation_hook(__FILE__, 'mc_quiz_platform_activate');

/**
 * Forces Elementor to render the quiz shortcodes.
 * This can bypass conflicts with themes or other plugins that interfere
 * with Elementor's standard shortcode processing.
 *
 * @param string $widget_content The HTML content of the widget.
 * @param \Elementor\Widget_Base $widget The widget instance.
 * @return string The processed content.
 */
function mc_force_render_quiz_shortcodes_in_elementor($widget_content, $widget) {
    // We only target the 'shortcode' widget to be efficient.
    if ('shortcode' === $widget->get_name()) {
        $has_quiz_shortcode = has_shortcode($widget_content, 'quiz_dashboard') 
            || has_shortcode($widget_content, 'mi_quiz') || has_shortcode($widget_content, 'mi-quiz') 
            || has_shortcode($widget_content, 'cdt_quiz') || has_shortcode($widget_content, 'cdt-quiz');

        if ($has_quiz_shortcode) {
            return do_shortcode($widget_content);
        }
    }
    return $widget_content;
}
add_filter('elementor/widget/render_content', 'mc_force_render_quiz_shortcodes_in_elementor', 11, 2);