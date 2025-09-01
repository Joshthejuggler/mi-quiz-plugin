<?php

if ( ! defined( 'ABSPATH' ) ) exit;

class CDT_Quiz_Plugin {
    const VERSION = '1.0';
    const META_KEY = 'cdt_quiz_results';
    const SHORTCODE = 'cdt_quiz';

    public function __construct() {
        // 1. Register this quiz with the core platform.
        if (class_exists('Micro_Coach_Core')) {
            Micro_Coach_Core::register_quiz('cdt-quiz', [
                'title'            => 'Cognitive Dissonance Tolerance',
                'shortcode'        => self::SHORTCODE,
                'results_meta_key' => self::META_KEY,
                'order'            => 30,
            ]);
        }

        // 2. Add the shortcode to display the quiz.
        add_shortcode(self::SHORTCODE, [ $this, 'render_quiz' ]);

        // 3. Enqueue this quiz's specific assets.
        add_action('wp_enqueue_scripts', [ $this, 'enqueue_assets' ]);

        // 4. Add an AJAX endpoint to save results.
        add_action('wp_ajax_cdt_save_user_results', [ $this, 'ajax_save_user_results' ]);

        // 5. Add an AJAX endpoint to delete results for testing.
        add_action('wp_ajax_cdt_delete_user_results', [ $this, 'ajax_delete_user_results' ]);
    }

    public static function activate() {
        // Nothing needed for this quiz.
    }

    public function enqueue_assets() {
        global $post;
        if ( !is_a( $post, 'WP_Post' ) || !has_shortcode( $post->post_content, self::SHORTCODE ) ) {
            return;
        }

        wp_enqueue_style('cdt-quiz-css', plugins_url('quiz.css', __FILE__), [], self::VERSION);
        wp_register_script('cdt-quiz-js', plugins_url('quiz.js', __FILE__), [], self::VERSION, true);

        // Load this quiz's questions.
        require __DIR__ . '/questions.php';

        $user_data = null;
        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $user_data = [
                'id'           => $user->ID,
                'savedResults' => get_user_meta($user->ID, self::META_KEY, true) ?: null,
            ];
        }

        // Pass data to our JavaScript file.
        wp_localize_script('cdt-quiz-js', 'cdt_quiz_data', [
            'currentUser' => $user_data,
            'ajaxUrl'     => admin_url('admin-ajax.php'),
            'ajaxNonce'   => wp_create_nonce('cdt_nonce'),
            'loginUrl'    => wp_login_url(get_permalink()),
            'data'        => [
                'cats'      => $cdt_categories ?? [],
                'questions' => $cdt_questions ?? [],
                'likert'    => [1=>'Not at all like me', 2=>'Not really like me', 3=>'Somewhat like me', 4=>'Mostly like me', 5=>'Very much like me'],
            ],
        ]);
        wp_enqueue_script('cdt-quiz-js');
    }

    public function render_quiz() {
        return '<div id="cdt-quiz-container"><div class="cdt-quiz-card"><p>Loading Quiz...</p></div></div>';
    }

    public function ajax_save_user_results() {
        check_ajax_referer('cdt_nonce');
        $user_id = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
        $results = isset($_POST['results']) ? json_decode(stripslashes($_POST['results']), true) : [];

        if (!$user_id || !is_array($results) || !current_user_can('edit_user', $user_id)) {
            wp_send_json_error('Invalid data or permissions.');
        }

        // Sanitize results before saving
        $sanitized_results = [];
        if (isset($results['ageGroup'])) {
            $sanitized_results['ageGroup'] = sanitize_text_field($results['ageGroup']);
        }
        if (isset($results['sortedScores']) && is_array($results['sortedScores'])) {
            $sanitized_results['sortedScores'] = array_map(function($item) {
                return [ sanitize_text_field($item[0]), intval($item[1]) ];
            }, $results['sortedScores']);
        }

        update_user_meta($user_id, self::META_KEY, $sanitized_results);
        wp_send_json_success('Results saved.');
    }

    public function ajax_delete_user_results() {
        check_ajax_referer('cdt_nonce');

        if ( ! is_user_logged_in() ) {
            wp_send_json_error('You must be logged in to delete results.');
        }

        $user_id = get_current_user_id();

        if ( delete_user_meta($user_id, self::META_KEY) ) {
            wp_send_json_success('Your results have been deleted.');
        } else {
            // This can happen if meta didn't exist, which is not an error in this context.
            // We can treat it as a success.
            wp_send_json_success('No results found to delete, or they were already deleted.');
        }
    }
}

new CDT_Quiz_Plugin();