<?php
if (!defined('ABSPATH')) exit;

class Johari_MI_Quiz_Module {
    const VERSION = '0.1.0';
    const SLUG    = 'johari-mi-quiz';
    const OPT_BCC = 'jmi_bcc_emails';
    const OPT_ANTITHREAD = 'jmi_antithread';

    // DB table suffixes
    const TABLE_SELF = 'jmi_self';
    const TABLE_LINKS = 'jmi_peer_links';
    const TABLE_FEEDBACK = 'jmi_peer_feedback';
    const TABLE_AGG = 'jmi_aggregates';

    public function __construct() {
        if (class_exists('Micro_Coach_Core')) {
            Micro_Coach_Core::register_quiz(self::SLUG, [
                'title'            => 'Johari × MI',
                'shortcode'        => 'johari_mi_quiz',
                'results_meta_key' => 'johari_mi_profile',
                'order'            => 40,
                'description'      => 'Peer-feedback on MI adjectives organized into the Johari Window (Open/Blind/Hidden/Unknown).',
                'description_completed' => 'View your Johari Window with MI domain insights and peer agreement.',
            ]);
        }

        add_shortcode('johari_mi_quiz', [$this, 'render_quiz']);
        add_shortcode('johari-mi-quiz', [$this, 'render_quiz']);

        if (is_admin()) {
            add_action('admin_menu', [$this, 'add_settings_pages']);
            add_action('admin_init', [$this, 'register_settings']);
        } else {
            add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        }

        // AJAX endpoints
        add_action('wp_ajax_miq_jmi_save_self',        [$this, 'ajax_save_self']);
        add_action('wp_ajax_nopriv_miq_jmi_save_self', [$this, 'ajax_save_self']);

        // Peer submission now requires login (no nopriv)
        add_action('wp_ajax_miq_jmi_peer_submit',        [$this, 'ajax_peer_submit']);

        add_action('wp_ajax_miq_jmi_generate_results',        [$this, 'ajax_generate_results']);
        add_action('wp_ajax_nopriv_miq_jmi_generate_results', [$this, 'ajax_generate_results']);

        add_action('wp_ajax_jmi_generate_pdf', [$this, 'ajax_generate_pdf']);
        add_action('wp_ajax_nopriv_jmi_generate_pdf', [$this, 'ajax_generate_pdf']);
        add_action('wp_ajax_jmi_get_user_data', [$this, 'ajax_get_user_data']);
        add_action('wp_ajax_nopriv_jmi_get_user_data', [$this, 'ajax_get_user_data']);
        
        // Login status check (both logged in and logged out users)
        add_action('wp_ajax_miq_jmi_check_login',        [$this, 'ajax_check_login']);
        add_action('wp_ajax_nopriv_miq_jmi_check_login', [$this, 'ajax_check_login']);

        add_action('delete_user', [$this, 'handle_user_deletion']);
        
        // Admin AJAX endpoints
        add_action('wp_ajax_jmi_export_subs', [$this, 'ajax_export_subs']);
        add_action('wp_ajax_jmi_delete_subs', [$this, 'ajax_delete_subs']);
        
        // Security & cleanup hooks
        add_action('jmi_cleanup_expired_links', [$this, 'cleanup_expired_links']);
        if (!wp_next_scheduled('jmi_cleanup_expired_links')) {
            wp_schedule_event(time(), 'daily', 'jmi_cleanup_expired_links');
        }
        
        // Ensure proper redirects after login/registration for peer links
        add_filter('login_redirect', [$this, 'preserve_jmi_login_redirect'], 10, 3);
        add_filter('registration_redirect', [$this, 'preserve_jmi_registration_redirect']);
        
        // Handle auto-login after peer assessment registration
        add_action('wp_loaded', [$this, 'handle_peer_registration_login']);
        
        // Hook into user deletion to clean up assessment data
        add_action('delete_user', [$this, 'handle_user_deletion']);
        
        // Ensure database tables exist
        $this->ensure_tables();
    }

    private function table($suffix) {
        global $wpdb; return $wpdb->prefix . $suffix;
    }

    public function ensure_tables() {
        global $wpdb; $charset = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $sql_self = "CREATE TABLE IF NOT EXISTS `".$this->table(self::TABLE_SELF)."` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NULL,
            uuid CHAR(36) NOT NULL,
            adjectives LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uuid (uuid),
            KEY user_id (user_id)
        ) $charset;";

        $sql_links = "CREATE TABLE IF NOT EXISTS `".$this->table(self::TABLE_LINKS)."` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            self_id BIGINT UNSIGNED NOT NULL,
            uuid CHAR(36) NOT NULL,
            created_at DATETIME NOT NULL,
            expires_at DATETIME NULL,
            max_peers TINYINT UNSIGNED NOT NULL DEFAULT 5,
            visited INT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY uuid (uuid),
            KEY self_id (self_id)
        ) $charset;";

        $sql_feedback = "CREATE TABLE IF NOT EXISTS `".$this->table(self::TABLE_FEEDBACK)."` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            self_id BIGINT UNSIGNED NOT NULL,
            link_id BIGINT UNSIGNED NOT NULL,
            peer_user_id BIGINT UNSIGNED NOT NULL,
            adjectives LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            ip VARCHAR(64) NULL,
            PRIMARY KEY (id),
            KEY self_id (self_id),
            KEY link_id (link_id),
            KEY peer_user_id (peer_user_id),
            UNIQUE KEY no_duplicate_peer (self_id, peer_user_id)
        ) $charset;";

        $sql_agg = "CREATE TABLE IF NOT EXISTS `".$this->table(self::TABLE_AGG)."` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            self_id BIGINT UNSIGNED NOT NULL,
            open LONGTEXT NULL,
            blind LONGTEXT NULL,
            hidden LONGTEXT NULL,
            unknown LONGTEXT NULL,
            domain_summary LONGTEXT NULL,
            last_recalc DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY self_id (self_id)
        ) $charset;";

        dbDelta($sql_self);
        dbDelta($sql_links);
        dbDelta($sql_feedback);
        dbDelta($sql_agg);
    }

    public function add_settings_pages() {
        add_submenu_page(
            'quiz-platform-settings',
            'Johari × MI Peers',
            'Johari × MI Subs',
            'manage_options',
            'johari-mi-subs',
            [$this, 'render_admin_page']
        );
    }

    public function register_settings() {
        register_setting('mc_quiz_platform_settings', self::OPT_BCC);
        register_setting('mc_quiz_platform_settings', self::OPT_ANTITHREAD);
        add_settings_section('jmi_main', 'Johari × MI Settings', function(){
            echo '<p>Peer-feedback settings for the Johari × MI assessment.</p>';
        }, 'quiz-platform-settings');
        add_settings_field(self::OPT_BCC, 'BCC Results Email', function(){
            $v = esc_attr(get_option(self::OPT_BCC, ''));
            echo '<input type="text" style="width:480px" name="'.esc_attr(self::OPT_BCC).'" value="'.$v.'" placeholder="admin@example.com, another@example.com">';
            echo '<p class="description">Admins to notify with a copy of results. Comma-separated.</p>';
        }, 'quiz-platform-settings', 'jmi_main');
    }

    public function enqueue_assets() {
        global $post;
        if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'johari_mi_quiz')) return;

        wp_register_style('jmi-css', plugins_url('css/johari-mi-quiz.css', __FILE__), [], self::VERSION);
        wp_enqueue_style('jmi-css');

        wp_register_script('jmi-js', plugins_url('johari-mi-quiz.js', __FILE__), [], self::VERSION, true);

        // Load adjective data
        $adjectives_file = __DIR__ . '/jmi-adjectives.php';
        $adjective_data = [];
        if (file_exists($adjectives_file)) {
            $adjective_data = require $adjectives_file;
        }

        $user_data = null;
        
        // Debug logging
        error_log('JMI Quiz Debug - is_user_logged_in(): ' . (is_user_logged_in() ? 'true' : 'false'));
        if (is_user_logged_in()) {
            error_log('JMI Quiz Debug - Current user ID: ' . get_current_user_id());
        }
        
        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $johari_profile = get_user_meta($user->ID, 'johari_mi_profile', true);
            $self_uuid = get_user_meta($user->ID, 'jmi_self_uuid', true);
            
            // Check if user has a recent assessment in awaiting-peers state
            $existing_state = null;
            $peer_link_uuid = null;
            if ($self_uuid) {
                global $wpdb;
                $self_table = $this->table(self::TABLE_SELF);
                $feedback_table = $this->table(self::TABLE_FEEDBACK);
                $links_table = $this->table(self::TABLE_LINKS);
                
                $self_row = $wpdb->get_row($wpdb->prepare(
                    "SELECT * FROM `$self_table` WHERE uuid = %s AND user_id = %d", $self_uuid, $user->ID
                ));
                
                if ($self_row) {
                    $peer_count = $wpdb->get_var($wpdb->prepare(
                        "SELECT COUNT(*) FROM `$feedback_table` WHERE self_id = %d", $self_row->id
                    ));
                    
                    // Get the peer link UUID
                    $peer_link_uuid = $wpdb->get_var($wpdb->prepare(
                        "SELECT uuid FROM `$links_table` WHERE self_id = %d AND expires_at > NOW()", $self_row->id
                    ));
                    
                    if ($peer_count >= 2) {
                        $existing_state = 'results-ready';
                    } else {
                        $existing_state = 'awaiting-peers';
                    }
                }
            }
            
            $user_data = [
                'id'        => $user->ID,
                'email'     => $user->user_email,
                'firstName' => $user->first_name,
                'lastName'  => $user->last_name,
                'johari'    => is_array($johari_profile) ? $johari_profile : null,
                'selfUuid'  => $self_uuid,
                'peerLinkUuid' => $peer_link_uuid,
                'existingState' => $existing_state,
            ];
        }

        $localized = [
            'currentUser' => $user_data,
            'ajaxUrl'     => admin_url('admin-ajax.php'),
            'ajaxNonce'   => wp_create_nonce('jmi_nonce'),
            'data'        => $adjective_data,
        ];
        wp_localize_script('jmi-js', 'jmi_quiz_data', $localized);
        wp_enqueue_script('jmi-js');
    }

    public function render_quiz() {
        ob_start(); ?>
        <div class="quiz-wrapper">
          <div id="jmi-container">
            <div class="mi-quiz-card">
              <h2 class="mi-section-title">Johari × MI</h2>
              <p>Select adjectives that describe you. Then invite peers to do the same. We’ll map results to the Johari Window and MI domains.</p>
            </div>
            <div id="jmi-self"></div>
            <div id="jmi-share"></div>
            <div id="jmi-results" style="display:none;"></div>
          </div>
        </div>
        <?php return ob_get_clean();
    }

    private function maybe_antithread($subject){
        if (!get_option(self::OPT_ANTITHREAD, '1')) return $subject;
        $zw = "\xE2\x80\x8B"; return $subject . str_repeat($zw, wp_rand(1,3));
    }
    
    private function generate_uuid() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
    
    private function maybe_notify_owner($self_id, $peer_count) {
        global $wpdb;
        $self_table = $this->table(self::TABLE_SELF);
        $self_row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM `$self_table` WHERE id = %d", $self_id
        ));
        
        if (!$self_row || !$self_row->user_id) {
            return; // No user to notify
        }
        
        $user = get_userdata($self_row->user_id);
        if (!$user) {
            return;
        }
        
        // Only send notification when reaching exactly 2 peers (first threshold)
        if ($peer_count == 2) {
            $subject = $this->maybe_antithread('Your Johari × MI results are ready!');
            $message = "Hi {$user->first_name},\n\nGreat news! You've received feedback from {$peer_count} peers for your Johari × MI assessment. Your results are now ready to view.\n\nView your results: " . get_permalink() . "\n\nThanks!";
            
            wp_mail($user->user_email, $subject, $message);
        }
    }
    
    private function calculate_johari_window($self_id) {
        global $wpdb;
        
        // Check for cached results
        $agg_table = $this->table(self::TABLE_AGG);
        $cached = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM `$agg_table` WHERE self_id = %d AND last_recalc > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            $self_id
        ));
        
        if ($cached) {
            return [
                'open' => json_decode($cached->open, true),
                'blind' => json_decode($cached->blind, true),
                'hidden' => json_decode($cached->hidden, true), 
                'unknown' => json_decode($cached->unknown, true),
                'domain_summary' => json_decode($cached->domain_summary, true)
            ];
        }
        
        // Load adjective data
        $adjective_data = require __DIR__ . '/jmi-adjectives.php';
        $all_adjectives = $adjective_data['all_adjectives'];
        $adjective_map = $adjective_data['adjective_map'];
        
        // Get self-assessment
        $self_table = $this->table(self::TABLE_SELF);
        $self_row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM `$self_table` WHERE id = %d", $self_id
        ));
        
        if (!$self_row) {
            return false;
        }
        
        $self_adjectives = json_decode($self_row->adjectives, true);
        
        // Get peer feedback and aggregate
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        $peer_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT adjectives FROM `$feedback_table` WHERE self_id = %d", $self_id
        ));
        
        // Count how many peers selected each adjective
        $peer_counts = [];
        foreach ($peer_rows as $row) {
            $peer_adjectives = json_decode($row->adjectives, true);
            foreach ($peer_adjectives as $adj) {
                $peer_counts[$adj] = ($peer_counts[$adj] ?? 0) + 1;
            }
        }
        
        // Apply Johari Window logic
        $open = [];    // In self AND peer selections
        $blind = [];   // In peer selections but NOT in self
        $hidden = [];  // In self but NOT in peer selections
        $unknown = []; // In neither self nor peer selections
        
        foreach ($all_adjectives as $adjective) {
            $in_self = in_array($adjective, $self_adjectives);
            $in_peers = isset($peer_counts[$adjective]) && $peer_counts[$adjective] > 0;
            
            if ($in_self && $in_peers) {
                $open[] = $adjective;
            } elseif (!$in_self && $in_peers) {
                $blind[] = $adjective;
            } elseif ($in_self && !$in_peers) {
                $hidden[] = $adjective;
            } else {
                $unknown[] = $adjective;
            }
        }
        
        // Calculate domain summary
        $domain_summary = [];
        foreach ($adjective_map as $domain => $domain_adjectives) {
            $domain_summary[$domain] = [
                'open' => count(array_intersect($open, $domain_adjectives)),
                'blind' => count(array_intersect($blind, $domain_adjectives)),
                'hidden' => count(array_intersect($hidden, $domain_adjectives)),
                'unknown' => count(array_intersect($unknown, $domain_adjectives))
            ];
        }
        
        $results = [
            'open' => $open,
            'blind' => $blind, 
            'hidden' => $hidden,
            'unknown' => $unknown,
            'domain_summary' => $domain_summary,
            'generated_at' => current_time('mysql')
        ];
        
        // Cache the results
        $wpdb->replace($agg_table, [
            'self_id' => $self_id,
            'open' => json_encode($open),
            'blind' => json_encode($blind),
            'hidden' => json_encode($hidden),
            'unknown' => json_encode($unknown),
            'domain_summary' => json_encode($domain_summary),
            'last_recalc' => current_time('mysql')
        ]);
        
        return $results;
    }
    
    public function render_admin_page() {
        global $wpdb;
        
        // Get all self-assessments with user info
        $self_table = $this->table(self::TABLE_SELF);
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        
        $query = "
            SELECT s.*, u.user_email, u.display_name,
                   COUNT(f.id) as peer_count
            FROM `$self_table` s
            LEFT JOIN {$wpdb->users} u ON s.user_id = u.ID
            LEFT JOIN `$feedback_table` f ON s.id = f.self_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT 100
        ";
        
        $rows = $wpdb->get_results($query, ARRAY_A);
        $export_url = wp_nonce_url(admin_url('admin-ajax.php?action=jmi_export_subs'), 'jmi_admin_nonce');
        
        echo '<div class="wrap"><h1>Johari × MI Assessments</h1>';
        echo '<p><a class="button button-secondary" href="'.esc_url($export_url).'">Download CSV</a></p>';
        
        if (empty($rows)) {
            echo '<p>No assessments yet.</p></div>';
            return;
        }
        
        echo '<div class="tablenav top"><div class="alignleft actions bulkactions">
                <button type="button" class="button" id="jmi-select-all-btn">Select All</button>
                <button type="button" class="button" id="jmi-deselect-all-btn">Deselect All</button>
                <button type="button" class="button button-primary" id="jmi-del-selected">Delete Selected</button>
              </div></div>';
              
        echo '<table class="widefat striped"><thead><tr>
                <th class="jmi-subs-checkbox-col"><input type="checkbox" id="jmi-check-all"></th>
                <th>ID</th><th>Date</th><th>User</th><th>Email</th><th>Peer Count</th><th>Status</th>
              </tr></thead><tbody>';
              
        foreach ($rows as $r) {
            $status = (int)$r['peer_count'] >= 2 ? '<span style="color: green;">✓ Complete</span>' : '<span style="color: orange;">⏳ Awaiting Peers</span>';
            echo '<tr>'.
              '<th scope="row" class="check-column"><input type="checkbox" class="jmi-row" value="'.intval($r['id']).'"></th>'.
              '<td>'.intval($r['id']).'</td>'.
              '<td>'.esc_html($r['created_at']).'</td>'.
              '<td>'.esc_html($r['display_name'] ?: 'Guest').'</td>'.
              '<td>'.esc_html($r['user_email'] ?: 'N/A').'</td>'.
              '<td>'.intval($r['peer_count']).'</td>'.
              '<td>'.$status.'</td>'.
            '</tr>';
        }
        echo '</tbody></table></div>';
        ?>
        <script>
        (function(){
          const $ = s => document.querySelector(s);
          const $$ = s => Array.from(document.querySelectorAll(s));
          const nonce = '<?php echo esc_js(wp_create_nonce('jmi_admin_nonce')); ?>';
          const selectAllBtn = $('#jmi-select-all-btn');
          const deselectAllBtn = $('#jmi-deselect-all-btn');

          const setChecks = (checked) => {
            $$('.jmi-row').forEach(cb => cb.checked = checked);
            $('#jmi-check-all').checked = checked;
          };

          const all = $('#jmi-check-all');
          all && all.addEventListener('change', () => setChecks(all.checked));
          selectAllBtn && selectAllBtn.addEventListener('click', () => setChecks(true));
          deselectAllBtn && deselectAllBtn.addEventListener('click', () => setChecks(false));
          
          const del = $('#jmi-del-selected');
          del && del.addEventListener('click', ()=>{
            const ids = $$('.jmi-row').filter(c=>c.checked).map(c=>c.value);
            if(!ids.length) return alert('Select rows first');
            if(!confirm('Delete selected assessments and all associated peer feedback?')) return;
            
            fetch(ajaxurl, {
              method:'POST', 
              headers:{'Content-Type':'application/x-www-form-urlencoded'},
              body: new URLSearchParams({action:'jmi_delete_subs', _ajax_nonce:nonce, ids: ids.join(',')})
            }).then(r=>r.json()).then(j=>{
              if(j.success) location.reload(); else alert('Delete failed: ' + (j.data || 'Unknown error'));
            });
          });
        })();
        </script>
        <?php
    }

    // --- AJAX endpoints ---
    public function ajax_save_self(){
        check_ajax_referer('jmi_nonce');
        
        $adjectives_raw = isset($_POST['adjectives']) ? wp_unslash($_POST['adjectives']) : '';
        $adjectives = json_decode($adjectives_raw, true);
        
        // Validate adjectives
        if (!is_array($adjectives) || count($adjectives) < 6 || count($adjectives) > 10) {
            wp_send_json_error('Please select 6-10 adjectives.');
        }
        
        // Load valid adjectives to verify selection
        $adjective_data = require __DIR__ . '/jmi-adjectives.php';
        $all_valid = $adjective_data['all_adjectives'];
        
        foreach ($adjectives as $adj) {
            if (!in_array($adj, $all_valid)) {
                wp_send_json_error('Invalid adjective selected.');
            }
        }
        
        global $wpdb;
        $user_id = is_user_logged_in() ? get_current_user_id() : null;
        $uuid = $this->generate_uuid();
        $now = current_time('mysql');
        
        // Insert or update self-assessment
        $self_table = $this->table(self::TABLE_SELF);
        $result = $wpdb->insert($self_table, [
            'user_id' => $user_id,
            'uuid' => $uuid,
            'adjectives' => json_encode($adjectives),
            'created_at' => $now
        ]);
        
        if (!$result) {
            wp_send_json_error('Could not save assessment.');
        }
        
        $self_id = $wpdb->insert_id;
        
        // Create peer link
        $link_uuid = $this->generate_uuid();
        $expires_at = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $links_table = $this->table(self::TABLE_LINKS);
        $wpdb->insert($links_table, [
            'self_id' => $self_id,
            'uuid' => $link_uuid,
            'created_at' => $now,
            'expires_at' => $expires_at,
            'max_peers' => 5,
            'visited' => 0
        ]);
        
        // Save to user meta if logged in
        if ($user_id) {
            update_user_meta($user_id, 'jmi_self_uuid', $uuid);
        }
        
        // Get the current page URL properly
        $current_page_id = get_queried_object_id();
        if ($current_page_id) {
            $base_url = get_permalink($current_page_id);
        } else {
            $base_url = get_permalink();
        }
        $share_url = add_query_arg('jmi', $link_uuid, $base_url);
        
        wp_send_json_success([
            'uuid' => $uuid,
            'share_url' => $share_url,
            'self_id' => $self_id
        ]);
    }
    public function ajax_peer_submit(){
        check_ajax_referer('jmi_nonce');
        
        // Require login for peer feedback
        if (!is_user_logged_in()) {
            wp_send_json_error('You must be logged in to provide peer feedback.');
        }
        
        $uuid = isset($_POST['uuid']) ? sanitize_text_field($_POST['uuid']) : '';
        $adjectives_raw = isset($_POST['adjectives']) ? wp_unslash($_POST['adjectives']) : '';
        $adjectives = json_decode($adjectives_raw, true);
        
        // Validate inputs
        if (empty($uuid)) {
            wp_send_json_error('Invalid link.');
        }
        
        if (!is_array($adjectives) || count($adjectives) < 6 || count($adjectives) > 10) {
            wp_send_json_error('Please select 6-10 adjectives.');
        }
        
        // Load valid adjectives
        $adjective_data = require __DIR__ . '/jmi-adjectives.php';
        $all_valid = $adjective_data['all_adjectives'];
        
        foreach ($adjectives as $adj) {
            if (!in_array($adj, $all_valid)) {
                wp_send_json_error('Invalid adjective selected.');
            }
        }
        
        global $wpdb;
        
        // Find the peer link
        $links_table = $this->table(self::TABLE_LINKS);
        $link = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM `$links_table` WHERE uuid = %s AND expires_at > NOW()", $uuid
        ));
        
        if (!$link) {
            wp_send_json_error('This link has expired or is invalid.');
        }
        
        // Check if max peers reached
        if ($link->visited >= $link->max_peers) {
            wp_send_json_error('Maximum number of peer assessments reached.');
        }
        
        // Check for duplicate submissions from same user
        $peer_user_id = get_current_user_id();
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$feedback_table` WHERE self_id = %d AND peer_user_id = %d", 
            $link->self_id, $peer_user_id
        ));
        
        if ($existing > 0) {
            wp_send_json_error('You have already submitted feedback for this assessment.');
        }
        
        // Save peer feedback
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $result = $wpdb->insert($feedback_table, [
            'self_id' => $link->self_id,
            'link_id' => $link->id,
            'peer_user_id' => $peer_user_id,
            'adjectives' => json_encode($adjectives),
            'created_at' => current_time('mysql'),
            'ip' => $ip
        ]);
        
        if (!$result) {
            wp_send_json_error('Could not save feedback.');
        }
        
        // Update visited count
        $wpdb->update($links_table, 
            ['visited' => $link->visited + 1], 
            ['id' => $link->id],
            ['%d'], ['%d']
        );
        
        // Check if we've reached the minimum threshold (2 peers)
        $new_count = $link->visited + 1;
        if ($new_count >= 2) {
            $this->maybe_notify_owner($link->self_id, $new_count);
        }
        
        wp_send_json_success([
            'message' => 'Feedback submitted successfully',
            'peer_count' => $new_count
        ]);
    }
    public function ajax_generate_results(){
        check_ajax_referer('jmi_nonce');
        
        $uuid = isset($_POST['uuid']) ? sanitize_text_field($_POST['uuid']) : '';
        
        if (empty($uuid)) {
            wp_send_json_error('Invalid request.');
        }
        
        global $wpdb;
        
        // Find self-assessment by UUID (could be self UUID or link UUID)
        $self_table = $this->table(self::TABLE_SELF);
        $links_table = $this->table(self::TABLE_LINKS);
        
        $self_row = $wpdb->get_row($wpdb->prepare(
            "SELECT s.* FROM `$self_table` s WHERE s.uuid = %s", $uuid
        ));
        
        // If not found, try finding by link UUID
        if (!$self_row) {
            $link_row = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM `$links_table` WHERE uuid = %s", $uuid
            ));
            if ($link_row) {
                $self_row = $wpdb->get_row($wpdb->prepare(
                    "SELECT * FROM `$self_table` WHERE id = %d", $link_row->self_id
                ));
            }
        }
        
        if (!$self_row) {
            wp_send_json_error('Assessment not found.');
        }
        
        // Get peer feedback count
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        $peer_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$feedback_table` WHERE self_id = %d", $self_row->id
        ));
        
        if ($peer_count < 2) {
            wp_send_json_error('Not enough peer feedback yet. Need at least 2 peers.');
        }
        
        // Generate or retrieve cached results
        $results = $this->calculate_johari_window($self_row->id);
        
        if (!$results) {
            wp_send_json_error('Could not generate results.');
        }
        
        // Save to user profile if user is logged in
        if ($self_row->user_id) {
            update_user_meta($self_row->user_id, 'johari_mi_profile', $results);
        }
        
        wp_send_json_success($results);
    }
    
    public function ajax_check_login(){
        check_ajax_referer('jmi_nonce');
        
        $is_logged_in = is_user_logged_in();
        $user_id = $is_logged_in ? get_current_user_id() : null;
        $user_email = $is_logged_in ? wp_get_current_user()->user_email : null;
        
        wp_send_json_success([
            'logged_in' => $is_logged_in,
            'user_id' => $user_id,
            'user_email' => $user_email,
            'timestamp' => current_time('mysql')
        ]);
    }
    public function ajax_generate_pdf(){
        check_ajax_referer('jmi_nonce');
        
        if (!class_exists('Dompdf\\Dompdf')) {
            wp_send_json_error('PDF library is not available.');
        }
        
        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';
        if (empty($results_html)) {
            wp_send_json_error('No results data provided.');
        }
        
        // Create branding header
        $branding_html = '<div style="text-align:center; padding: 20px 0; border-bottom: 1px solid #ddd;">';
        $branding_html .= '<h1 style="color: #1a202c; margin: 0;">Johari × MI Assessment Results</h1>';
        $branding_html .= '<p style="margin: 0; color: #666;">Generated on ' . date('F j, Y') . '</p>';
        $branding_html .= '</div>';
        
        $full_html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
        
        // Embed CSS
        $css_path = __DIR__ . '/css/johari-mi-quiz.css';
        if (file_exists($css_path)) {
            $css = file_get_contents($css_path);
            // Remove imports and problematic rules for PDF
            $css = preg_replace('/@import[^;]+;/', '', $css);
            $css = preg_replace('/@media[^{]*{[^{}]*({[^{}]*}[^{}]*)*}/', '', $css);
            $full_html .= '<style>' . $css . '</style>';
        }
        
        $full_html .= '</head><body style="padding: 1em; font-family: sans-serif;">';
        $full_html .= $branding_html . $results_html;
        $full_html .= '</body></html>';
        
        $options = new \Dompdf\Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        
        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($full_html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        
        $dompdf->stream(
            'johari-mi-results-' . date('Y-m-d') . '.pdf',
            ['Attachment' => true]
        );
        exit;
    }
    
    public function ajax_export_subs(){
        if (!current_user_can('manage_options')) wp_die('No permission');
        check_admin_referer('jmi_admin_nonce');
        
        global $wpdb;
        $self_table = $this->table(self::TABLE_SELF);
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        
        $query = "
            SELECT s.id, s.created_at, s.user_id, u.user_email, u.display_name,
                   COUNT(f.id) as peer_count, s.adjectives
            FROM `$self_table` s
            LEFT JOIN {$wpdb->users} u ON s.user_id = u.ID
            LEFT JOIN `$feedback_table` f ON s.id = f.self_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
        ";
        
        $rows = $wpdb->get_results($query, ARRAY_A);
        
        $filename = 'johari-mi-assessments-' . date('Ymd-His') . '.csv';
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);
        
        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
        fputcsv($out, ['ID', 'Created At', 'User ID', 'Email', 'Display Name', 'Peer Count', 'Status', 'Self Adjectives']);
        
        foreach ($rows as $r) {
            $status = (int)$r['peer_count'] >= 2 ? 'Complete' : 'Awaiting Peers';
            $adjectives = json_decode($r['adjectives'], true);
            $adjectives_str = is_array($adjectives) ? implode(', ', $adjectives) : '';
            
            fputcsv($out, [
                $r['id'],
                $r['created_at'],
                $r['user_id'],
                $r['user_email'],
                $r['display_name'],
                $r['peer_count'],
                $status,
                $adjectives_str
            ]);
        }
        
        fclose($out);
        exit;
    }
    
    public function ajax_delete_subs(){
        if (!current_user_can('manage_options')) {
            wp_send_json_error('No permission');
        }
        check_ajax_referer('jmi_admin_nonce');
        
        $ids_raw = isset($_POST['ids']) ? wp_unslash($_POST['ids']) : '';
        if (empty($ids_raw)) {
            wp_send_json_error('No IDs provided.');
        }
        
        $ids = array_filter(array_map('intval', explode(',', $ids_raw)));
        if (empty($ids)) {
            wp_send_json_error('No valid IDs provided.');
        }
        
        global $wpdb;
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        
        // Delete from all related tables
        $deleted = 0;
        $deleted += $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_FEEDBACK)."` WHERE self_id IN ($placeholders)", $ids));
        $deleted += $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_LINKS)."` WHERE self_id IN ($placeholders)", $ids));
        $deleted += $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_AGG)."` WHERE self_id IN ($placeholders)", $ids));
        $deleted += $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_SELF)."` WHERE id IN ($placeholders)", $ids));
        
        wp_send_json_success(['deleted' => $deleted]);
    }
    
    public function cleanup_expired_links() {
        global $wpdb;
        
        $links_table = $this->table(self::TABLE_LINKS);
        $feedback_table = $this->table(self::TABLE_FEEDBACK);
        $agg_table = $this->table(self::TABLE_AGG);
        $self_table = $this->table(self::TABLE_SELF);
        
        // Find expired links (older than 30 days)
        $expired_links = $wpdb->get_col($wpdb->prepare(
            "SELECT self_id FROM `$links_table` WHERE expires_at < %s",
            date('Y-m-d H:i:s', strtotime('-30 days'))
        ));
        
        if (!empty($expired_links)) {
            $placeholders = implode(',', array_fill(0, count($expired_links), '%d'));
            
            // Delete all related data for expired assessments
            $wpdb->query($wpdb->prepare("DELETE FROM `$feedback_table` WHERE self_id IN ($placeholders)", $expired_links));
            $wpdb->query($wpdb->prepare("DELETE FROM `$links_table` WHERE self_id IN ($placeholders)", $expired_links));
            $wpdb->query($wpdb->prepare("DELETE FROM `$agg_table` WHERE self_id IN ($placeholders)", $expired_links));
            $wpdb->query($wpdb->prepare("DELETE FROM `$self_table` WHERE id IN ($placeholders)", $expired_links));
            
            error_log('Johari MI Quiz: Cleaned up ' . count($expired_links) . ' expired assessments.');
        }
        
        // Also clean up any orphaned records
        $wpdb->query("
            DELETE f FROM `$feedback_table` f 
            LEFT JOIN `$self_table` s ON f.self_id = s.id 
            WHERE s.id IS NULL
        ");
        
        $wpdb->query("
            DELETE l FROM `$links_table` l 
            LEFT JOIN `$self_table` s ON l.self_id = s.id 
            WHERE s.id IS NULL
        ");
        
        $wpdb->query("
            DELETE a FROM `$agg_table` a 
            LEFT JOIN `$self_table` s ON a.self_id = s.id 
            WHERE s.id IS NULL
        ");
    }

    public function handle_user_deletion($user_id){
        global $wpdb;
        $self_table = $this->table(self::TABLE_SELF);
        $rows = $wpdb->get_results($wpdb->prepare("SELECT id FROM `$self_table` WHERE user_id = %d", $user_id), ARRAY_A);
        if ($rows) {
            $self_ids = array_map('intval', wp_list_pluck($rows, 'id'));
            $ids_sql = implode(',', array_fill(0, count($self_ids), '%d'));
            $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_FEEDBACK)."` WHERE self_id IN ($ids_sql)", $self_ids));
            $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_LINKS)."` WHERE self_id IN ($ids_sql)", $self_ids));
            $wpdb->query($wpdb->prepare("DELETE FROM `".$this->table(self::TABLE_AGG)."` WHERE self_id IN ($ids_sql)", $self_ids));
            $wpdb->query($wpdb->prepare("DELETE FROM `$self_table` WHERE user_id = %d", $user_id));
        }
    }
    
    public function preserve_jmi_login_redirect($redirect_to, $request, $user) {
        // If redirect URL contains jmi parameter, preserve it
        if (isset($_REQUEST['redirect_to'])) {
            $redirect_url = sanitize_url($_REQUEST['redirect_to']);
            if (strpos($redirect_url, 'jmi=') !== false) {
                return $redirect_url;
            }
        }
        return $redirect_to;
    }
    
    public function preserve_jmi_registration_redirect($redirect_to) {
        // If redirect URL contains jmi parameter, preserve it
        if (isset($_REQUEST['redirect_to'])) {
            $redirect_url = sanitize_url($_REQUEST['redirect_to']);
            if (strpos($redirect_url, 'jmi=') !== false) {
                return $redirect_url;
            }
        }
        return $redirect_to;
    }
    
    public function handle_peer_registration_login() {
        // Only process on peer assessment pages
        if (!isset($_GET['jmi']) || is_user_logged_in()) {
            return;
        }
        
        // Check if we have registration success indicators
        $has_registration_success = (
            isset($_GET['checkemail']) && $_GET['checkemail'] === 'registered'
        ) || (
            isset($_GET['registration']) && $_GET['registration'] === 'complete'
        ) || (
            // Check for WordPress registration redirect parameters
            isset($_GET['redirect_to']) && strpos($_GET['redirect_to'], 'jmi=') !== false
        );
        
        if (!$has_registration_success) {
            return;
        }
        
        // Look for a recently created user by checking the most recent user creation
        // This is a heuristic approach since we don't have direct access to the new user ID
        global $wpdb;
        
        // Get the most recently registered user (within the last 2 minutes)
        $recent_user = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->users} 
             WHERE user_registered > %s 
             ORDER BY user_registered DESC 
             LIMIT 1",
            date('Y-m-d H:i:s', strtotime('-2 minutes'))
        ));
        
        if (!$recent_user) {
            return;
        }
        
        // Additional safety check: verify this appears to be a peer assessment registration
        // by checking if the referrer or session data suggests it came from our peer page
        $referrer = wp_get_referer();
        if (!$referrer || strpos($referrer, 'jmi=') === false) {
            return;
        }
        
        // Log the auto-login attempt
        error_log('JMI: Attempting auto-login for peer assessment registration - User ID: ' . $recent_user->ID);
        
        // Auto-login the user
        wp_set_current_user($recent_user->ID);
        wp_set_auth_cookie($recent_user->ID, true);
        
        // Redirect to clean URL to prevent re-processing
        $current_url = remove_query_arg(['checkemail', 'registration', 'redirect_to']);
        
        error_log('JMI: Auto-login successful, redirecting to: ' . $current_url);
        wp_redirect($current_url);
        exit;
    }
    
    public function ajax_get_user_data() {
        // Security check
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'jmi_nonce')) {
            wp_send_json_error('Invalid nonce.');
        }
        
        // Debug logging
        error_log('JMI AJAX get_user_data - is_user_logged_in(): ' . (is_user_logged_in() ? 'true' : 'false'));
        
        if (!is_user_logged_in()) {
            wp_send_json_success([
                'currentUser' => null,
                'isLoggedIn' => false
            ]);
        }
        
        $user = wp_get_current_user();
        error_log('JMI AJAX get_user_data - Current user ID: ' . $user->ID);
        
        $johari_profile = get_user_meta($user->ID, 'johari_mi_profile', true);
        $self_uuid = get_user_meta($user->ID, 'jmi_self_uuid', true);
        
        // Check if user has a recent assessment in awaiting-peers state
        $existing_state = null;
        $peer_link_uuid = null;
        if ($self_uuid) {
            global $wpdb;
            $self_table = $this->table(self::TABLE_SELF);
            $feedback_table = $this->table(self::TABLE_FEEDBACK);
            $links_table = $this->table(self::TABLE_LINKS);
            
            $self_row = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM `$self_table` WHERE uuid = %s AND user_id = %d", $self_uuid, $user->ID
            ));
            
            if ($self_row) {
                $peer_count = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM `$feedback_table` WHERE self_id = %d", $self_row->id
                ));
                
                // Get the peer link UUID
                $peer_link_uuid = $wpdb->get_var($wpdb->prepare(
                    "SELECT uuid FROM `$links_table` WHERE self_id = %d AND expires_at > NOW()", $self_row->id
                ));
                
                if ($peer_count >= 2) {
                    $existing_state = 'results-ready';
                } else {
                    $existing_state = 'awaiting-peers';
                }
            }
        }
        
        $user_data = [
            'id'        => $user->ID,
            'email'     => $user->user_email,
            'firstName' => $user->first_name,
            'lastName'  => $user->last_name,
            'johari'    => is_array($johari_profile) ? $johari_profile : null,
            'selfUuid'  => $self_uuid,
            'peerLinkUuid' => $peer_link_uuid,
            'existingState' => $existing_state,
        ];
        
        error_log('JMI AJAX get_user_data - User data: ' . json_encode($user_data));
        
        wp_send_json_success([
            'currentUser' => $user_data,
            'isLoggedIn' => true
        ]);
    }
}
