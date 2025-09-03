<?php

if ( ! defined( 'ABSPATH' ) ) exit;

// Data is now loaded "just-in-time" within the methods that need it for maximum reliability.

class MI_Quiz_Plugin_AI {
    const VERSION           = '9.7';
    const OPT_GROUP         = 'miq_settings';
    const OPT_BCC           = 'miq_bcc_emails';
    const OPT_ANTITHREAD    = 'miq_antithread';
    const TABLE_SUBSCRIBERS = 'miq_subscribers';
    const TRANSIENT_QUIZ_RESULTS_PREFIX = 'miq_quiz_results_';

    public function __construct() {
        // Register this quiz with the core platform to appear in the dashboard.
        if (class_exists('Micro_Coach_Core')) {
            Micro_Coach_Core::register_quiz('mi-quiz', [
                'title'            => 'Multiple Intelligences Quiz',
                'shortcode'        => 'mi_quiz',
                'results_meta_key' => 'miq_quiz_results',
                'order'            => 10, // Controls the display order in the dashboard.
                'description'      => 'Discover your unique blend of intelligences and unlock your full potential with a personalized action plan.',
            ]);
        }

        // Frontend & admin hooks
        add_shortcode('mi_quiz', [ $this, 'render_quiz' ]);
        if ( is_admin() ) {
            add_action('admin_menu',  [ $this, 'add_settings_pages' ]);
            add_action('admin_init',  [ $this, 'register_settings' ]);
        } else {
            add_action('wp_enqueue_scripts', [ $this, 'enqueue_assets' ]);
        }

        // AJAX hooks
        add_action('wp_ajax_miq_email_results',        [ $this, 'ajax_email_results' ]);
        add_action('wp_ajax_nopriv_miq_email_results', [ $this, 'ajax_email_results' ]);
        add_action('wp_ajax_nopriv_miq_magic_register',[ $this, 'ajax_magic_register' ]);
        add_action('wp_ajax_miq_delete_subs',          [ $this, 'ajax_delete_subs' ]);
        add_action('wp_ajax_miq_export_subs',          [ $this, 'ajax_export_subs' ]);
        add_action('wp_ajax_miq_save_user_results',    [ $this, 'ajax_save_user_results' ]);
        add_action('wp_ajax_miq_delete_user_results',  [ $this, 'ajax_delete_user_results' ]);
        add_action('wp_ajax_miq_generate_pdf',         [ $this, 'ajax_generate_pdf' ]);

        // Hook into WordPress user deletion to clean up our custom table.
        add_action('delete_user', [ $this, 'handle_user_deletion' ]);
    }

    /** Create/upgrade the subscribers table */
    public function ensure_tables(){
        global $wpdb;
        $table   = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $charset = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE IF NOT EXISTS `$table` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            created_at DATETIME NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name  VARCHAR(100) DEFAULT '',
            email      VARCHAR(190) NOT NULL,
            ip         VARCHAR(64)  DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY email (email),
            KEY created_at (created_at)
        ) $charset;";
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /** Activation hook */
    public static function activate() {
        (new self())->ensure_tables();
    }

    /** Admin: settings + subscribers pages */
    public function add_settings_pages() {
        // The subscribers page is now a submenu of the main Quiz Platform.
        add_submenu_page(
            'quiz-platform-settings',      // Parent slug
            'MI Quiz Subscribers',         // Page title
            'MI Quiz Subs',                // Menu title
            'manage_options',              // Capability
            'mi-quiz-subs',                // Menu slug
            [ $this,'render_subs_page' ]   // Function
        );
    }

    public function register_settings() {
        // Register settings with the core platform's group.
        register_setting( 'mc_quiz_platform_settings', self::OPT_BCC );
        register_setting( 'mc_quiz_platform_settings', self::OPT_ANTITHREAD );

        // Add a new section to the main Quiz Platform settings page.
        add_settings_section(
            'miq_main',                      // Section ID
            'MI Quiz Settings',              // Section Title
            function() {
                echo '<p>Settings specific to the Multiple Intelligences Quiz, such as email notifications.</p>';
            },
            'quiz-platform-settings'         // Page slug
        );

        add_settings_field(
            self::OPT_BCC, 'BCC Results Email', function(){
                $v = esc_attr( get_option(self::OPT_BCC,'') );
                echo '<input type="text" style="width:480px" name="'.esc_attr(self::OPT_BCC).'" value="'.$v.'" placeholder="admin@example.com, another@example.com">';
                echo '<p class="description">Admins to notify with a copy of results. Comma-separated.</p>';
            }, 'quiz-platform-settings', 'miq_main' );

        add_settings_field(
            self::OPT_ANTITHREAD, 'Reduce Inbox Threading', function(){
                $checked = get_option(self::OPT_ANTITHREAD,'1') ? 'checked' : '';
                echo '<label><input type="checkbox" name="'.esc_attr(self::OPT_ANTITHREAD).'" value="1" '.$checked.'> Add an invisible token to subjects so repeated sends don’t collapse into one thread.</label>';
            }, 'quiz-platform-settings', 'miq_main' );
    }

    public function render_subs_page(){
        global $wpdb; $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $rows = $wpdb->get_results("SELECT * FROM `$table` ORDER BY id DESC LIMIT 5000", ARRAY_A);
        $export_url = wp_nonce_url( admin_url('admin-ajax.php?action=miq_export_subs'), 'miq_nonce' );
        echo '<div class="wrap"><h1>MI Quiz Subscribers</h1>';
        echo '<p><a class="button button-secondary" href="'.esc_url($export_url).'">Download CSV</a></p>';
        if ( empty($rows) ) { echo '<p>No subscribers yet.</p></div>'; return; }
        echo '<div class="tablenav top"><div class="alignleft actions bulkactions">
                <button type="button" class="button" id="miq-select-all-btn">Select All</button>
                <button type="button" class="button" id="miq-deselect-all-btn">Deselect All</button>
                <button type="button" class="button button-primary" id="miq-del-selected">Delete Selected</button>
              </div></div>';
        echo '<table class="widefat striped"><thead><tr>
                <th class="miq-subs-checkbox-col"><input type="checkbox" id="miq-check-all"></th>
                <th>ID</th><th>Date</th><th>First</th><th>Last</th><th>Email</th><th>IP</th>
              </tr></thead><tbody>';
        foreach ($rows as $r){
            echo '<tr>'.
              '<th scope="row" class="check-column"><input type="checkbox" class="miq-row" value="'.intval($r['id']).'"></th>'.
              '<td>'.intval($r['id']).'</td>'.
              '<td>'.esc_html($r['created_at']).'</td>'.
              '<td>'.esc_html($r['first_name']).'</td>'.
              '<td>'.esc_html($r['last_name']).'</td>'.
              '<td>'.esc_html($r['email']).'</td>'.
              '<td>'.esc_html($r['ip']).'</td>'.
            '</tr>';
        }
        echo '</tbody></table></div>'; ?>
        <script>
        (function(){
          const $ = s => document.querySelector(s);
          const $$ = s => Array.from(document.querySelectorAll(s));
          const nonce = '<?php echo esc_js( wp_create_nonce('miq_nonce') ); ?>';
          const selectAllBtn = $('#miq-select-all-btn');
          const deselectAllBtn = $('#miq-deselect-all-btn');

          const setChecks = (checked) => {
            $$('.miq-row').forEach(cb => cb.checked = checked);
            $('#miq-check-all').checked = checked;
          };

          const all = $('#miq-check-all');
          all && all.addEventListener('change', () => setChecks(all.checked));
          selectAllBtn && selectAllBtn.addEventListener('click', () => setChecks(true));
          deselectAllBtn && deselectAllBtn.addEventListener('click', () => setChecks(false));
          const del = $('#miq-del-selected');
          del && del.addEventListener('click', ()=>{
            const ids = $$('.miq-row').filter(c=>c.checked).map(c=>c.value);
            if(!ids.length) return alert('Select rows first');
            if(!confirm('Delete selected subscribers?')) return;
            fetch(ajaxurl, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
              body: new URLSearchParams({action:'miq_delete_subs', _ajax_nonce:nonce, ids})
            }).then(r=>r.json()).then(j=>{
              if(j.success) location.reload(); else alert('Delete failed');
            });
          });
        })();
        </script>
        <?php
    }

    public function ajax_delete_subs(){
        if(!current_user_can('manage_options')) {
            wp_send_json_error('No permission');
        }
        check_ajax_referer('miq_nonce');

        // The 'ids' parameter from JS will be a comma-separated string.
        $ids_raw = isset($_POST['ids']) ? wp_unslash($_POST['ids']) : '';
        if (empty($ids_raw)) {
            wp_send_json_error('No IDs provided.');
        }

        // Explode the string into an array, then sanitize each ID to ensure they are integers.
        $ids = array_filter(array_map('intval', explode(',', $ids_raw)));
        if (empty($ids)) {
            wp_send_json_error('No valid IDs provided.');
        }

        global $wpdb; $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $res = $wpdb->query( $wpdb->prepare("DELETE FROM `$table` WHERE id IN ($placeholders)", $ids) );

        wp_send_json_success(['deleted' => (int)$res]);
    }

    public function ajax_export_subs(){
        if(!current_user_can('manage_options')) wp_die('No permission');
        check_admin_referer('miq_nonce');

        global $wpdb; $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $rows = $wpdb->get_results("SELECT id,created_at,first_name,last_name,email,ip FROM `$table` ORDER BY id DESC", ARRAY_A);

        $filename = 'miq-subscribers-' . date('Ymd-His') . '.csv';
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);

        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($out, ['id','created_at','first_name','last_name','email','ip']);
        foreach ($rows as $r) {
            fputcsv($out, [$r['id'], $r['created_at'], $r['first_name'], $r['last_name'], $r['email'], $r['ip']]);
        }
        fclose($out);
        exit;
    }

    /**
     * When a WordPress user is deleted, remove them from our subscriber list.
     * This is important for data privacy and hygiene.
     *
     * @param int $user_id The ID of the user being deleted.
     */
    public function handle_user_deletion($user_id) {
        // Get user object before it's deleted to retrieve the email.
        $user = get_userdata($user_id);
        if (!$user) {
            return;
        }

        $email = $user->user_email;

        global $wpdb;
        $wpdb->delete($wpdb->prefix . self::TABLE_SUBSCRIBERS, ['email' => $email], ['%s']);
    }

    public function ajax_magic_register() {
        check_ajax_referer('miq_nonce');

        $email      = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $first_name = isset($_POST['first_name']) ? sanitize_text_field($_POST['first_name']) : '';
        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';

        if (!is_email($email)) {
            wp_send_json_error('Please provide a valid email address.');
        }
        if (empty($first_name)) {
            wp_send_json_error('Please provide your first name.');
        }

        if (email_exists($email)) {
            $login_url = wp_login_url(get_permalink());
            wp_send_json_error(sprintf(
                'This email is already registered. <a href="%s">Please log in</a> to see your results.',
                esc_url($login_url)
            ));
        }

        $username_base = sanitize_user(explode('@', $email)[0], true);
        $username = $username_base;
        $i = 1;
        while (username_exists($username)) {
            $username = $username_base . $i;
            $i++;
        }

        $password = wp_generate_password(24, true, true);
        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            wp_send_json_error('Could not create an account. Please try again.');
        }

        wp_update_user(['ID' => $user_id, 'first_name' => $first_name, 'display_name' => $first_name]);
        wp_set_current_user($user_id, $username);
        wp_set_auth_cookie($user_id, true);

        global $wpdb; 
        $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $wpdb->query( $wpdb->prepare(
            "INSERT INTO `$table` (created_at, first_name, email, ip)
             VALUES (%s, %s, %s, %s)
             ON DUPLICATE KEY UPDATE 
                created_at = VALUES(created_at),
                first_name = VALUES(first_name),
                ip         = VALUES(ip)",
            current_time('mysql'), $first_name, $email, $_SERVER['REMOTE_ADDR'] ?? ''
        ));

        if (!empty($results_html)) {
            $body = '<html><body><h1>Here are your quiz results:</h1>'.$results_html.'<p>Thank you for taking the quiz!</p></body></html>';
            
            $subject_user = $this->maybe_antithread( sprintf('Your MI Quiz Results — %s', $first_name) );
            $headers_user = [
                'Content-Type: text/html; charset=UTF-8',
                sprintf('Reply-To: "%s" <%s>', $first_name, $email),
            ];
            wp_mail($email, $subject_user, $body, $headers_user);

            $admin_list_raw = array_filter(array_map('trim', explode(',', get_option(self::OPT_BCC, ''))));
            if (!empty($admin_list_raw)) {
                $subject_admin = $this->maybe_antithread( sprintf('[MI Quiz] Results for %s <%s>', $first_name, $email) );
                $headers_admin = [
                    'Content-Type: text/html; charset=UTF-8',
                    sprintf('Reply-To: "%s" <%s>', $first_name, $email),
                    'Bcc: ' . implode(', ', $admin_list_raw),
                ];
                wp_mail($admin_list_raw[0], $subject_admin, $body, $headers_admin);
            }
        }

        wp_send_json_success('Account created! Your results have been emailed. Loading them now...');
    }

    public function enqueue_assets() {
        global $post;
        if ( !is_a( $post, 'WP_Post' ) || !has_shortcode( $post->post_content, 'mi_quiz' ) ) {
            return;
        }

        wp_register_style('mi-quiz-css', plugins_url('css/mi-quiz.css', __FILE__), [], self::VERSION);
        wp_enqueue_style('mi-quiz-css');

        wp_register_script('mi-quiz-js', plugins_url('mi-quiz.js', __FILE__), [], self::VERSION, true);

        // --- Load data just-in-time ---
        $questions_file = __DIR__ . '/mi-questions.php';
        if ( file_exists( $questions_file ) ) {
            require $questions_file; // defines $mi_categories, $mi_questions, etc. in *this* function's scope
        }

        // Prefer local vars (from the require), fall back to $GLOBALS, else empty array.
        $cats   = isset($mi_categories)          ? $mi_categories          : ($GLOBALS['mi_categories'] ?? []);
        $q1     = isset($mi_questions)           ? $mi_questions           : ($GLOBALS['mi_questions'] ?? []);
        $q2     = isset($mi_part_two_questions)  ? $mi_part_two_questions  : ($GLOBALS['mi_part_two_questions'] ?? []);
        $career = isset($mi_career_suggestions)  ? $mi_career_suggestions  : ($GLOBALS['mi_career_suggestions'] ?? []);
        $lev    = isset($mi_leverage_tips)       ? $mi_leverage_tips       : ($GLOBALS['mi_leverage_tips'] ?? []);
        $grow   = isset($mi_growth_tips)         ? $mi_growth_tips         : ($GLOBALS['mi_growth_tips'] ?? []);

        $user_data = null;
        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $saved_results = get_user_meta($user->ID, 'miq_quiz_results', true);
            $user_data = [
                'id'           => $user->ID,
                'email'        => $user->user_email,
                'firstName'    => $user->first_name,
                'lastName'     => $user->last_name,
                'savedResults' => is_array($saved_results) && !empty($saved_results) ? $saved_results : null,
            ];
        }

        $localized_data = [
            'currentUser' => $user_data,
            'ajaxUrl'     => admin_url('admin-ajax.php'),
            'ajaxNonce'   => wp_create_nonce('miq_nonce'),
            'loginUrl'    => wp_login_url(get_permalink()),
            'data'        => [
                'cats'   => $cats,
                'q1'     => $q1,
                'q2'     => $q2,
                'career' => $career,
                'lev'    => $lev,
                'grow'   => $grow,
                'likert' => [1 => 'Not at all like me', 2 => 'Not really like me', 3 => 'Somewhat like me', 4 => 'Mostly like me', 5 => 'Very much like me'],
            ],
        ];

        wp_localize_script('mi-quiz-js', 'miq_quiz_data', $localized_data);
        wp_enqueue_script('mi-quiz-js');
    }

    private function maybe_antithread($subject){
        if ( ! get_option(self::OPT_ANTITHREAD, '1') ) return $subject;
        $zw = "\xE2\x80\x8B";
        return $subject . str_repeat($zw, wp_rand(1,3));
    }

    public function ajax_email_results() {
        check_ajax_referer('miq_nonce');

        $email        = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $first_name   = isset($_POST['first_name']) ? sanitize_text_field($_POST['first_name']) : '';
        $last_name    = isset($_POST['last_name']) ? sanitize_text_field($_POST['last_name']) : '';
        $last_name    = $last_name ?: '';
        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';

        if ( ! is_email($email) )   wp_send_json_error('Invalid email address.');
        if ( empty($first_name) )   wp_send_json_error('Please enter your first name.');
        if ( empty($results_html) ) wp_send_json_error('No results data to send.');

        $body = '<html><body><h1>Here are your quiz results:</h1>'.$results_html.'<p>Thank you for taking the quiz!</p></body></html>';
        
        $subject_user = $this->maybe_antithread( sprintf('Your MI Quiz Results — %s %s', $first_name, $last_name) );
        $headers_user = [
            'Content-Type: text/html; charset=UTF-8',
            sprintf('Reply-To: "%s %s" <%s>', $first_name, $last_name, $email),
        ];
        $sent_user = wp_mail($email, $subject_user, $body, $headers_user);

        $admin_list_raw = array_filter(array_map('trim', explode(',', get_option(self::OPT_BCC, ''))));
        $admin_list_raw = array_unique($admin_list_raw);

        $admin_to = '';
        foreach ($admin_list_raw as $addr) {
            if ( strcasecmp($addr, $email) !== 0 ) { $admin_to = $addr; break; }
        }
        if ( empty($admin_to) ) {
            $fallback = get_option('admin_email');
            if ( is_email($fallback) && strcasecmp($fallback, $email) !== 0 ) {
                $admin_to = $fallback;
            }
        }

        $bcc = array_values(array_filter($admin_list_raw, function($addr) use ($admin_to, $email){
            return strcasecmp($addr, $admin_to) !== 0 && strcasecmp($addr, $email) !== 0;
        }));

        if ( ! empty($admin_to) ) {
            $subject_admin = $this->maybe_antithread( sprintf('[MI Quiz] Results for %s %s <%s>', $first_name, $last_name, $email) );
            $headers_admin = [
                'Content-Type: text/html; charset=UTF-8',
                sprintf('Reply-To: "%s %s" <%s>', $first_name, $last_name, $email),
            ];
            if ( ! empty($bcc) ) {
                $headers_admin[] = 'Bcc: ' . implode(', ', $bcc);
            }
            wp_mail($admin_to, $subject_admin, $body, $headers_admin);
        }

        global $wpdb; 
        $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $wpdb->query( $wpdb->prepare(
            "INSERT INTO `$table` (created_at, first_name, last_name, email, ip)
             VALUES (%s, %s, %s, %s, %s)
             ON DUPLICATE KEY UPDATE 
                created_at = VALUES(created_at),
                first_name = VALUES(first_name),
                last_name  = VALUES(last_name),
                ip         = VALUES(ip)",
            current_time('mysql'), $first_name, $last_name, $email, $_SERVER['REMOTE_ADDR'] ?? ''
        ));

        if ($sent_user) wp_send_json_success('Your results have been sent! Check your inbox.');
        wp_send_json_error('The email could not be sent. Please try again later.');
    }

    /** Shortcode output (HTML only) */
    public function render_quiz() {
        // Assets are now enqueued conditionally in enqueue_assets(),
        // so these calls are no longer needed here.

        $questions_file_path = dirname(__FILE__) . '/mi-questions.php';
        if (!file_exists($questions_file_path)) {
            $error_message = '<strong>Quiz Error:</strong> The required questions file was not found at the expected location: <code>' . esc_html($questions_file_path) . '</code>. Please ensure the file exists.';
            return '<div style="border:2px solid red; padding:1em; background:#fbeaea; color: #000;">' . $error_message . '</div>';
        }

        ob_start(); ?>
        <div id="mi-quiz-container">
          <div id="mi-age-gate">
            <div class="mi-quiz-card">
              <h2 class="mi-section-title">Welcome!</h2>
              <p>To tailor the questions for you, please select the option that best describes you:</p>
              <div class="mi-age-options">
                <button type="button" class="mi-quiz-button" data-age-group="teen">Teen / High School</button>
                <button type="button" class="mi-quiz-button" data-age-group="graduate">Student / Recent Graduate</button>
                <button type="button" class="mi-quiz-button" data-age-group="adult">Adult / Professional</button>
              </div>
              <div class="mi-quiz-notice">
                <?php if (is_user_logged_in()): ?>
                    <p>Welcome back! At the end of the quiz, your results will be automatically emailed to your account address and saved to your profile.</p>
                <?php else: ?>
                    <p>Ready to unlock your potential? After the quiz, simply enter your name and email to create a free account, view your full results, and get your personalized action plan sent to your inbox.</p>
                <?php endif; ?>
              </div>
            </div>
          </div>

          <div id="mi-dev-tools" style="display:none;">
            <strong>Dev tools:</strong>
            <button type="button" id="mi-autofill-run" class="mi-quiz-button mi-quiz-button-small">Auto-Fill</button>
          </div>

          <form id="mi-quiz-form-part1" style="display:none;"></form>

          <div id="mi-quiz-intermission" style="display:none;">
            <h2 class="mi-section-title">Your Top Intelligences</h2>
            <p>Based on your answers, these are your top three intelligences:</p>
            <ul id="mi-top3-list"></ul>
            <p>Now, let's explore these three areas in more detail.</p>
            <button type="button" id="mi-start-part2" class="mi-quiz-button">Start Part 2</button>
          </div>

          <form id="mi-quiz-form-part2" style="display:none;"></form>
          <div id="mi-quiz-results" style="display:none;"></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function ajax_save_user_results() {
        check_ajax_referer('miq_nonce');

        $userId  = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
        $results = isset($_POST['results']) ? json_decode(stripslashes($_POST['results']), true) : [];

        if (!$userId || !is_array($results)) {
            wp_send_json_error('Invalid user ID or results data.');
        }

        update_user_meta($userId, 'miq_quiz_results', $results);

        wp_send_json_success('Results saved to user profile.');
    }

    public function ajax_generate_pdf() {
        check_ajax_referer('miq_nonce');

        if (!class_exists('Dompdf\Dompdf')) {
            wp_send_json_error('PDF library is not available.');
        }

        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';
        if (empty($results_html)) {
            wp_send_json_error('No results data provided.');
        }

        $full_html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
        $full_html .= '<link rel="stylesheet" type="text/css" href="' . esc_url(plugins_url('css/mi-quiz.css', __FILE__)) . '">';
        $full_html .= '</head><body>' . $results_html . '</body></html>';

        $options = new \Dompdf\Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);

        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($full_html);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        $dompdf->stream(
            'mi-quiz-results-' . date('Y-m-d') . '.pdf',
            ['Attachment' => true]
        );
        exit;
    }

    public function ajax_delete_user_results() {
        check_ajax_referer('miq_nonce');

        if ( ! is_user_logged_in() ) {
            wp_send_json_error('You must be logged in to delete results.');
        }

        $user_id = get_current_user_id();

        if ( delete_user_meta($user_id, 'miq_quiz_results') ) {
            wp_send_json_success('Your results have been deleted.');
        } else {
            // This can happen if meta didn't exist, which is not an error in this context.
            wp_send_json_success('No results found to delete, or they were already deleted.');
        }
    }
}

// This file is loaded by the core plugin, so we just need to instantiate the module.
new MI_Quiz_Plugin_AI();
