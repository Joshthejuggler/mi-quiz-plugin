<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Helper class for managing the quiz funnel configuration and state
 */
class MC_Funnel {
    const OPTION_KEY = 'mc_quiz_funnel_config';
    
    /**
     * Get the current funnel configuration with defaults
     * 
     * @return array Configuration array with steps, titles, and placeholder
     */
    public static function get_config() {
        $defaults = [
            'steps' => ['mi-quiz', 'cdt-quiz', 'bartle-quiz', 'johari-mi-quiz'],
            'titles' => [
                'mi-quiz' => 'Multiple Intelligences Assessment',
                'cdt-quiz' => 'Cognitive Dissonance Tolerance Quiz', 
                'bartle-quiz' => 'Player Type Discovery',
                'johari-mi-quiz' => 'Johari × MI'
            ],
            'placeholder' => [
                'title' => 'Advanced Self-Discovery Module',
                'description' => 'Coming soon - unlock deeper insights into your personal growth journey',
                'target' => '', // URL or page slug when ready
                'enabled' => false
            ]
        ];
        
        $config = get_option(self::OPTION_KEY, []);
        return wp_parse_args($config, $defaults);
    }
    
    /**
     * Save funnel configuration
     * 
     * @param array $config Configuration to save
     * @return bool Success/failure
     */
    public static function save_config($config) {
        $sanitized = self::sanitize_config($config);
        $result = update_option(self::OPTION_KEY, $sanitized);
        
        // Clear all user dashboard caches when config changes
        if ($result) {
            self::clear_all_dashboard_caches();
        }
        
        return $result;
    }
    
    /**
     * Get completion status for current user
     * 
     * @param int|null $user_id User ID, defaults to current user
     * @return array Completion status keyed by quiz slug
     */
    public static function get_completion_status($user_id = null) {
        if (!$user_id) {
            $user_id = get_current_user_id();
        }
        
        if (!$user_id) {
            return [];
        }
        
        // Use the existing completion logic from dashboard
        $registered_quizzes = Micro_Coach_Core::get_quizzes();
        $completion_status = [];
        
        foreach ($registered_quizzes as $quiz_id => $quiz_info) {
            $meta_key = $quiz_info['results_meta_key'] ?? '';
            if ($meta_key) {
                $results = get_user_meta($user_id, $meta_key, true);
                $completion_status[$quiz_id] = !empty($results);
            } else {
                $completion_status[$quiz_id] = false;
            }
        }
        
        return $completion_status;
    }
    
    /**
     * Get detailed status for the Johari quiz including intermediate states
     * 
     * @param int|null $user_id User ID, defaults to current user
     * @return array Status info with 'status', 'badge_text', 'description'
     */
    public static function get_johari_status($user_id = null) {
        if (!$user_id) {
            $user_id = get_current_user_id();
        }
        
        if (!$user_id) {
            return [
                'status' => 'available',
                'badge_text' => 'Available', 
                'description' => 'Start your self-assessment'
            ];
        }
        
        global $wpdb;
        $prefix = $wpdb->prefix;
        
        // Check if user has completed the final quiz (has results in user meta)
        $johari_results = get_user_meta($user_id, 'johari_mi_profile', true);
        if (!empty($johari_results)) {
            return [
                'status' => 'completed',
                'badge_text' => 'Completed',
                'description' => 'View your Johari Window with peer insights'
            ];
        }
        
        // Check if user has done self-assessment
        $self_table = $prefix . 'jmi_self';
        $self_exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$self_table` WHERE user_id = %d", $user_id
        ));
        
        if ($self_exists) {
            // Check how many peer feedback submissions they have
            $feedback_table = $prefix . 'jmi_peer_feedback';
            $peer_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT f.peer_user_id) 
                 FROM `$feedback_table` f 
                 INNER JOIN `$self_table` s ON f.self_id = s.id 
                 WHERE s.user_id = %d", 
                $user_id
            ));
            
            if ($peer_count >= 2) {
                return [
                    'status' => 'ready',
                    'badge_text' => 'Results Ready',
                    'description' => 'Click to view your Johari Window results'
                ];
            } else {
                return [
                    'status' => 'waiting',
                    'badge_text' => 'Awaiting Feedback',
                    'description' => "Need " . (2 - $peer_count) . " more peer feedback submissions"
                ];
            }
        }
        
        // User hasn't started the self-assessment yet
        return [
            'status' => 'available',
            'badge_text' => 'Available',
            'description' => 'Start your self-assessment'
        ];
    }
    
    /**
     * Get unlock status for each step based on completion
     * 
     * @param int|null $user_id User ID, defaults to current user
     * @return array Unlock status keyed by quiz slug
     */
    public static function get_unlock_status($user_id = null) {
        $config = self::get_config();
        $unlock_status = [];
        
        // All quizzes are now available in any order
        foreach ($config['steps'] as $step_slug) {
            $unlock_status[$step_slug] = true;
        }
        
        return $unlock_status;
    }
    
    /**
     * Get the URL for a quiz step
     * 
     * @param string $step_slug Quiz slug
     * @return string|null URL or null if not found
     */
    public static function get_step_url($step_slug) {
        // Use existing logic to find quiz pages
        $registered_quizzes = Micro_Coach_Core::get_quizzes();
        if (!isset($registered_quizzes[$step_slug])) {
            return null;
        }
        
        $shortcode = $registered_quizzes[$step_slug]['shortcode'] ?? '';
        if (!$shortcode) {
            return null;
        }
        
        // Use the same page finding logic from Micro_Coach_Core
        return self::find_page_by_shortcode($shortcode);
    }
    
    /**
     * Find a page containing a specific shortcode
     * 
     * @param string $shortcode Shortcode to search for
     * @return string|null Page URL or null if not found
     */
    private static function find_page_by_shortcode($shortcode) {
        $pages = get_pages([
            'meta_key' => '_wp_page_template',
            'hierarchical' => false,
            'number' => 100
        ]);
        
        // Also search all published pages
        $all_pages = get_posts([
            'post_type' => 'page',
            'post_status' => 'publish',
            'numberposts' => 100,
            'meta_query' => [
                'relation' => 'OR',
                [
                    'key' => '_wp_page_template',
                    'compare' => 'EXISTS'
                ],
                [
                    'key' => '_wp_page_template',
                    'compare' => 'NOT EXISTS'
                ]
            ]
        ]);
        
        $search_pages = array_merge($pages, $all_pages);
        
        foreach ($search_pages as $page) {
            if (has_shortcode($page->post_content, $shortcode)) {
                return get_permalink($page->ID);
            }
        }
        
        return null;
    }
    
    /**
     * Sanitize configuration input
     * 
     * @param array $config Raw configuration
     * @return array Sanitized configuration
     */
    private static function sanitize_config($config) {
        $registered_quizzes = Micro_Coach_Core::get_quizzes();
        $valid_slugs = array_keys($registered_quizzes);
        $valid_slugs[] = 'placeholder'; // Always allow placeholder
        
        $sanitized = [
            'steps' => [],
            'titles' => [],
            'placeholder' => [
                'title' => '',
                'description' => '',
                'target' => '',
                'enabled' => false
            ]
        ];
        
        // Sanitize steps - only allow valid quiz slugs and placeholder
        if (!empty($config['steps']) && is_array($config['steps'])) {
            foreach ($config['steps'] as $step) {
                $step = sanitize_key($step);
                if (in_array($step, $valid_slugs) && !in_array($step, $sanitized['steps'])) {
                    $sanitized['steps'][] = $step;
                }
            }
        }
        
        // Ensure we have at least the default steps if none provided
        if (empty($sanitized['steps'])) {
            $sanitized['steps'] = ['mi-quiz', 'cdt-quiz', 'bartle-quiz', 'johari-mi-quiz'];
        }
        
        // Sanitize titles
        if (!empty($config['titles']) && is_array($config['titles'])) {
            foreach ($config['titles'] as $slug => $title) {
                $slug = sanitize_key($slug);
                if (in_array($slug, $valid_slugs)) {
                    $sanitized['titles'][$slug] = sanitize_text_field($title);
                }
            }
        }
        
        // Sanitize placeholder config
        if (!empty($config['placeholder']) && is_array($config['placeholder'])) {
            $sanitized['placeholder']['title'] = sanitize_text_field($config['placeholder']['title'] ?? '');
            $sanitized['placeholder']['description'] = sanitize_textarea_field($config['placeholder']['description'] ?? '');
            $sanitized['placeholder']['target'] = esc_url_raw($config['placeholder']['target'] ?? '');
            $sanitized['placeholder']['enabled'] = !empty($config['placeholder']['enabled']);
        }
        
        return $sanitized;
    }
    
    /**
     * Clear dashboard caches for all users
     */
    private static function clear_all_dashboard_caches() {
        if (class_exists('MC_Cache')) {
            // Clear all dashboard caches - this is a bit brute force but ensures consistency
            global $wpdb;
            $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE 'mc_dashboard_data_%'");
        }
    }
    
    /**
     * Clear the funnel configuration cache and reset to defaults
     */
    public static function reset_to_defaults() {
        delete_option(self::OPTION_KEY);
        self::clear_all_dashboard_caches();
        return true;
    }
}