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
                'description'      => 'Measure your ability to handle conflicting beliefs and discover how it impacts your decision-making and personal growth.',
                'description_completed' => 'This assessment measures your capacity to navigate conflicting values and ideas, a key skill for personal and professional growth.',
                'depends_on'       => 'mi-quiz',
            ]);
        }

        // 2. Add the shortcode to display the quiz.
        add_shortcode(self::SHORTCODE, [ $this, 'render_quiz' ]);
        add_shortcode('cdt-quiz', [ $this, 'render_quiz' ]); // Add alias for convenience.

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
        $dashboard_url = $this->_find_page_by_shortcode('quiz_dashboard');
        ob_start();
        ?>
        <div class="quiz-wrapper">
            <?php if ($dashboard_url): ?>
                <div class="back-bar">
                    <a href="<?php echo esc_url($dashboard_url); ?>" class="back-link">&larr; Return to Dashboard</a>
                </div>
            <?php endif; ?>
            <div id="cdt-quiz-container"><div class="cdt-quiz-card"><p>Loading Quiz...</p></div></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function ajax_save_user_results() {
        check_ajax_referer('cdt_nonce');
        $user_id = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
        $results = isset($_POST['results']) ? json_decode(stripslashes($_POST['results']), true) : [];
        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';

        if (!$user_id || !is_array($results) || !current_user_can('edit_user', $user_id)) {
            wp_send_json_error('Invalid data or permissions.');
        }

        // Sanitize results before saving
        $sanitized_results = [];
        $sanitized_results['completed_at'] = time(); // Add timestamp
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

    /**
     * Finds the permalink of the first page that contains a given shortcode.
     * A private copy of the core platform's method to avoid complex dependencies.
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

    /**
     * Adds an invisible character to email subjects to prevent threading.
     */
    private function maybe_antithread($subject){
        if ( ! get_option('miq_antithread', '1') ) return $subject;
        $zw = "\xE2\x80\x8B";
        return $subject . str_repeat($zw, wp_rand(1,3));
    }

    /**
     * Generates a PDF from HTML content and saves it to a temporary file.
     *
     * @param string $results_html The HTML content of the results.
     * @return string|null The full server path to the generated PDF, or null on failure.
     */
    private function _generate_pdf_for_attachment($results_html) {
        if (!class_exists('Dompdf\Dompdf') || empty($results_html)) {
            return null;
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

        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($full_html);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        $pdf_content = $dompdf->output();

        $upload_dir = wp_upload_dir();
        $temp_dir = trailingslashit($upload_dir['basedir']) . 'cdt-quiz-pdfs';
        if (!file_exists($temp_dir)) { wp_mkdir_p($temp_dir); }

        $filepath = trailingslashit($temp_dir) . 'cdt-results-' . wp_generate_password(12, false) . '.pdf';
        return file_put_contents($filepath, $pdf_content) ? $filepath : null;
    }
}