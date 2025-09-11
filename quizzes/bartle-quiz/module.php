<?php

if ( ! defined( 'ABSPATH' ) ) exit;

class Bartle_Quiz_Plugin {
    const VERSION = '1.0';
    const META_KEY = 'bartle_quiz_results';
    const SHORTCODE = 'bartle_quiz';
    
    // Enhanced flow feature flag - users completing Bartle after this date get new UX
    const ENHANCED_FLOW_START = 1704067200; // 2024-01-01 00:00 UTC

    public function __construct() {
        // 1. Register this quiz with the core platform.
        if (class_exists('Micro_Coach_Core')) {
            Micro_Coach_Core::register_quiz('bartle-quiz', [
                'title'            => 'Bartle Player Type Quiz',
                'shortcode'        => self::SHORTCODE,
                'results_meta_key' => self::META_KEY,
                'order'            => 50,
                'description'      => 'The Bartle Player Type Quiz is designed to uncover what truly motivates you when you engage with games, challenges, or even everyday learning.',
                'description_completed' => 'This assessment reveals your primary player type, offering insights into your core motivations.',
                'depends_on'       => 'cdt-quiz',
            ]);
        }

        // 2. Add the shortcode to display the quiz.
        add_shortcode(self::SHORTCODE, [ $this, 'render_quiz' ]);
        add_shortcode('bartle-quiz', [ $this, 'render_quiz' ]); // Add alias for convenience.

        // 3. Enqueue this quiz's specific assets.
        add_action('wp_enqueue_scripts', [ $this, 'enqueue_assets' ]);

        // 4. Add an AJAX endpoint to save results.
        add_action('wp_ajax_bartle_save_user_results', [ $this, 'ajax_save_user_results' ]);

        // 5. Add an AJAX endpoint to delete results for testing.
        add_action('wp_ajax_bartle_delete_user_results', [ $this, 'ajax_delete_user_results' ]);

        // 6. Add an AJAX endpoint for PDF generation.
        add_action('wp_ajax_bartle_generate_pdf', [ $this, 'ajax_generate_pdf' ]);
    }

    public static function activate() {
        // Nothing needed for this quiz.
    }

    public function enqueue_assets() {
        global $post;
        if ( !is_a( $post, 'WP_Post' ) || !has_shortcode( $post->post_content, self::SHORTCODE ) ) {
            return;
        }

        wp_enqueue_style('bartle-quiz-css', plugins_url('quiz.css', __FILE__), [], self::VERSION);
        wp_register_script('bartle-quiz-js', plugins_url('quiz.js', __FILE__), [], self::VERSION, true);

        // Load this quiz's questions.
        require __DIR__ . '/questions.php';

        $user_data = null;
        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $user_data = [
                'id'           => $user->ID,
                'firstName'    => $user->first_name,
                'savedResults' => get_user_meta($user->ID, self::META_KEY, true) ?: null,
            ];
        }

        $dashboard_url = $this->_find_page_by_shortcode('quiz_dashboard');

        // Pass data to our JavaScript file.
        wp_localize_script('bartle-quiz-js', 'bartle_quiz_data', [
            'currentUser' => $user_data,
            'ajaxUrl'     => admin_url('admin-ajax.php'),
            'ajaxNonce'   => wp_create_nonce('bartle_nonce'),
            'loginUrl'    => wp_login_url(get_permalink()),
            'dashboardUrl' => $dashboard_url,
            'data'        => [
                'cats'      => $bartle_categories ?? [],
                'questions' => $bartle_questions ?? [],
                'likert'    => [1=>'Not at all like me', 2=>'Not really like me', 3=>'Somewhat like me', 4=>'Mostly like me', 5=>'Very much like me'],
            ],
        ]);
        wp_enqueue_script('bartle-quiz-js');
    }

    public function render_quiz() {
        $dashboard_url = $this->_find_page_by_shortcode('quiz_dashboard');
        ob_start();
        ?>
        <div class="quiz-wrapper">
            <?php if ($dashboard_url): ?>
                <div class="back-bar">
                    <a href="<?php echo esc_url($dashboard_url); ?>" class="back-link">&larr; Return to Dashboard</a>
                </div>
            <?php endif; ?>
        <div id="bartle-dev-tools" style="display:none; padding: 0 2em 1em; text-align: right; margin-top: 1em;">
            <strong>Dev tools:</strong>
            <button type="button" id="bartle-autofill-run" class="bartle-quiz-button bartle-quiz-button-small">Auto-Fill</button>
        </div>
            <div id="bartle-quiz-container"><div class="bartle-quiz-card"><p>Loading Quiz...</p></div></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function ajax_save_user_results() {
        check_ajax_referer('bartle_nonce');
        $user_id = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
        $results = isset($_POST['results']) ? json_decode(stripslashes($_POST['results']), true) : [];

        if (!$user_id || !is_array($results) || !current_user_can('edit_user', $user_id)) {
            wp_send_json_error('Invalid data or permissions.');
        }

        // Sanitize results before saving
        $sanitized_results = [];
        $sanitized_results['completed_at'] = time(); // Add timestamp
        $sanitized_results['enhanced_flow'] = ( $sanitized_results['completed_at'] >= self::ENHANCED_FLOW_START );
        if (isset($results['ageGroup'])) {
            $sanitized_results['ageGroup'] = sanitize_text_field($results['ageGroup']);
        }
        if (isset($results['sortedScores']) && is_array($results['sortedScores'])) {
            $sanitized_results['sortedScores'] = array_map(function($item) {
                return [ sanitize_text_field($item[0]), intval($item[1]) ];
            }, $results['sortedScores']);
        }

        update_user_meta($user_id, self::META_KEY, $sanitized_results);
        
        // For testing: If this is enhanced flow, clear AI coach unlock status
        // so user can experience the progressive reveal again
        if ($sanitized_results['enhanced_flow']) {
            delete_user_meta($user_id, 'ai_coach_unlocked');
        }
        
        // Debug logging for admins
        if (current_user_can('manage_options')) {
            error_log('Bartle Quiz Saved - Enhanced Flow: ' . ($sanitized_results['enhanced_flow'] ? 'YES' : 'NO') . 
                      ', Timestamp: ' . $sanitized_results['completed_at'] . 
                      ', Cutoff: ' . self::ENHANCED_FLOW_START);
        }
        
        wp_send_json_success('Results saved.');
    }

    public function ajax_delete_user_results() {
        check_ajax_referer('bartle_nonce');

        if ( ! is_user_logged_in() ) {
            wp_send_json_error('You must be logged in to delete results.');
        }

        $user_id = get_current_user_id();

        if ( delete_user_meta($user_id, self::META_KEY) ) {
            wp_send_json_success('Your results have been deleted.');
        } else {
            wp_send_json_success('No results found to delete, or they were already deleted.');
        }
    }

    public function ajax_generate_pdf() {
        check_ajax_referer('bartle_nonce');

        if (!class_exists('Dompdf\Dompdf')) {
            wp_send_json_error('PDF library is not available.');
        }

        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';
        if (empty($results_html)) {
            wp_send_json_error('No results data provided.');
        }

        $full_html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
        $css_path = plugin_dir_path(__FILE__) . 'quiz.css';
        if (file_exists($css_path)) {
            $full_html .= '<style>' . file_get_contents($css_path) . '</style>';
        }
        $full_html .= '</head><body style="padding: 1em;">' . $results_html . '</body></html>';

        $options = new \Dompdf\Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($full_html);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        $dompdf->stream(
            'bartle-quiz-results-' . date('Y-m-d') . '.pdf',
            ['Attachment' => true]
        );
        exit;
    }

    /**
     * Finds the permalink of the first page that contains a given shortcode.
     */
    private function _find_page_by_shortcode($shortcode_tag) {
        if (empty($shortcode_tag)) return null;
        $transient_key = 'page_url_for_' . $shortcode_tag;
        if (false !== ($cached_url = get_transient($transient_key))) return $cached_url;

        $query = new WP_Query(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'posts_per_page' => -1, 's' => '[' . $shortcode_tag]);
        $url = null;
        if ($query->have_posts()) {
            foreach ($query->posts as $p) { if (has_shortcode($p->post_content, $shortcode_tag)) { $url = get_permalink($p->ID); break; } }
        }
        set_transient($transient_key, $url, DAY_IN_SECONDS);
        return $url;
    }
}