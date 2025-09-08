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
    // Instantiate the core platform.
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
            || has_<?php
            if ( ! defined( 'ABSPATH' ) ) exit;
            
            /**
             * Handles all AI-related features for the Micro-Coach platform.
             */
            class Micro_Coach_AI {
                // Stores the OpenAI (or compatible) API key for AI features
                const OPT_OPENAI_API_KEY = 'mc_openai_api_key';
            
                public function __construct() {
                    if (is_admin()) {
                        // Add admin settings fields to the main platform settings page.
                        add_action('admin_init', [$this, 'register_settings']);
                        // Add the "Test Connection" button to the settings page.
                        add_action('mc_platform_settings_page_bottom', [, 'render_test_connection_section']);
                    }
            
                    // AJAX: AI Coach idea generation
                    add_action('wp_ajax_mc_ai_generate_mves', [, 'ajax_ai_generate_mves']);
                    // AJAX: Test API key
                    add_action('wp_ajax_mc_ai_test_key', [, 'ajax_ai_test_key']);
                }
            
                /**
                 * Registers AI-related settings.
                 */
                public function register_settings() {
                    // AI Integration section (OpenAI API key)
                    add_settings_section(
                        'mc_quiz_ai_section',
                        'AI Integration',
                        function () {
                            echo '<p>Configure credentials used to generate Minimum Viable Experiences (MVEs) and other AI-assisted features. Keys are stored as WordPress options.</p>';
                        },
                        'quiz-platform-settings' // This page is registered by Micro_Coach_Core
                    );
            
                    // Register and render the OpenAI API key field
                    register_setting(Micro_Coach_Core::OPT_GROUP, self::OPT_OPENAI_API_KEY, function () {
                        // Keep it lean; accept plain text and trim
                        return trim(sanitize_text_field());
                    });
                    add_settings_field(
                        self::OPT_OPENAI_API_KEY,
                        'OpenAI API Key',
                        function () {
                             = esc_attr(get_option(self::OPT_OPENAI_API_KEY, ''));
                            echo '<input type="password" name="' . esc_attr(self::OPT_OPENAI_API_KEY) . '" value="' .  . '" style="width: 480px;" placeholder="sk-..." autocomplete="new-password">';
                            echo '<p class="description">Paste a server-side key (e.g., <code>sk-XXXX</code>). This key is never sent to the browser by this setting alone.</p>';
                        },
                        'quiz-platform-settings',
                        'mc_quiz_ai_section'
                    );
                }
            
                /**
                 * Renders the "Test Connection" section on the settings page.
                 */
                public function render_test_connection_section() {
                    ?>
                    <hr>
                    <h2>AI Integration – Test Connection</h2>
                    <p>Verify your API key by sending a quick test to the AI endpoint.</p>
                    <p>
                        <button class="button button-primary" id="mc-ai-test-btn">Test AI</button>
                        <span id="mc-ai-test-status" style="margin-left: 8px;"></span>
                    </p>
                    <script>
                    (function(){
                        const btn   = document.getElementById('mc-ai-test-btn');
                        const label = document.getElementById('mc-ai-test-status');
                        if (!btn) return;
                        btn.addEventListener('click', function(e){
                            e.preventDefault();
                            btn.disabled = true; label.textContent = 'Testing…';
                            fetch('<?php echo esc_url_raw(admin_url('admin-ajax.php')); ?>', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({action:'mc_ai_test_key'}) })
                                .then(r=>r.json())
                                .then(j=>{
                                    if (j && j.success) { label.textContent = 'OK: ' + (j.data.model||'connected'); }
                                    else { label.textContent = 'Failed: ' + (j?.data?.message || 'unknown'); }
                                })
                                .catch(err=>{ label.textContent = 'Error: ' + (err?.message||'network'); })
                                .finally(()=>{ btn.disabled = false; });
                        });
                    })();
                    </script>
                    <?php
                }
            
                /**
                 * Returns the configured OpenAI-compatible API key (if set).
                 * Consumers should call this to authenticate server-side requests.
                 */
                public static function get_openai_api_key() {
                     = get_option(self::OPT_OPENAI_API_KEY, '');
                    return is_string() ? trim() : '';
                }
            
                /**
                 * Admin AJAX: simple connectivity test for the AI key.
                 */
                public function ajax_ai_test_key() {
                    if (!current_user_can('manage_options')) {
                        wp_send_json_error(['message'=>'Insufficient permissions'], 403);
                    }
                     = self::get_openai_api_key();
                    if (empty()) {
                        wp_send_json_error(['message'=>'No API key configured']);
                    }
                     = 'You are a healthcheck. Reply with a JSON object {"ok":true} only.';
                     = wp_remote_post('https://api.openai.com/v1/chat/completions', [
                        'timeout' => 15,
                        'headers' => [
                            'Authorization' => 'Bearer ' . ,
                            'Content-Type'  => 'application/json',
                        ],
                        'body' => wp_json_encode([
                            'model' => 'gpt-4o-mini',
                            'messages' => [ ['role'=>'system','content'=>], ['role'=>'user','content'=>'ping'] ],
                            'temperature' => 0,
                        ]),
                    ]);
                    if (is_wp_error()) {
                        wp_send_json_error(['message'=>'WP Error: '.->get_error_message()]);
                    }
                     = wp_remote_retrieve_response_code();
                     = json_decode(wp_remote_retrieve_body(), true);
                    if ( >= 200 &&  < 300) {
                         = ['model'] ?? (['choices'][0]['model'] ?? 'connected');
                        wp_send_json_success(['model'=>]);
                    }
                    wp_send_json_error(['message'=>'HTTP '..' — '.substr(wp_remote_retrieve_body(),0,200)]);
                }
            
                /**
                 * AJAX: Generate MVEs (Minimum Viable Experiences) based on profile + filters.
                 * Returns JSON with two arrays: shortlist and more (placeholders if API not configured).
                 */
                public function ajax_ai_generate_mves() {
                    if (!is_user_logged_in()) {
                        wp_send_json_error(['message' => 'Please sign in to use the AI coach.'], 401);
                    }
            
                     = get_current_user_id();
            
                    // Gather filters (0..4)
                        = max(0, min(4, intval(['cost'] ?? 0)));
                        = max(0, min(4, intval(['time'] ?? 1)));
                      = max(0, min(4, intval(['energy'] ?? 1)));
                     = max(0, min(4, intval(['variety'] ?? 2)));
                         = max(4, min(24, intval(['quantity'] ?? 12)));
            
                     = [
                        'Curiosity'   => !empty(['lens_curiosity']),
                        'Role Models' => !empty(['lens_rolemodels']),
                        'Opposites'   => !empty(['lens_opposites']),
                        'Adjacency'   => !empty(['lens_adjacency']),
                    ];
            
                    // Build profile snapshot (no PII)
                      = get_user_meta(, 'miq_quiz_results', true) ?: [];
                     = get_user_meta(, 'cdt_quiz_results', true) ?: [];
                      = get_user_meta(, 'bartle_quiz_results', true) ?: [];
            
                    // MI top3 with 0..100 scores
                      = ['part1Scores'] ?? [];
                       = ['top3'] ?? [];
                     = [];
                    foreach ((array) as ) {
                         = isset([]) ? round(([] / 40) * 100) : 0;
                        [] = ['slug' => , 'score' => ];
                    }
            
                    // CDT five subscales 0..100
                     = ['sortedScores'] ?? [];
                     = [];
                    foreach ((array) as ) {
                        if (!is_array() || count() < 2) continue;
                        [[0]] = round(([1] / 50) * 100);
                    }
                     = [0][0] ?? null;
                     = end()[0] ?? null;
            
                    // Player Type
                     = ['sortedScores'] ?? [];
                       = [0][0] ?? '';
                     = isset([0][1]) ? round(([0][1] / 50) * 100) : 0;
                     = [1][0] ?? '';
                     = isset([1][1]) ? round(([1][1] / 50) * 100) : 0;
            
                    // Try to use OpenAI if configured; else produce a few placeholder ideas
                     = [];
                     = false;  = '';
                     = self::get_openai_api_key();
                    if (!empty()) {
                        // Construct a compact payload for the model
                         = [
                            'user' => [
                                'id' => (string),
                                'mi_top3' => ,
                                'cdt' => ,
                                'cdt_top' => ,
                                'cdt_edge' => ,
                                'player_type' => [ 'primary' => [, ], 'secondary' => [, ] ],
                            ],
                            'filters' => [
                                'cost' => , 'time' => , 'energy' => , 'variety' => ,
                                'lenses' => array_keys(array_filter()), 'quantity' => ,
                            ],
                        ];
            
                        // JSON-mode prompt: require a single JSON object {"ideas": [...]} only.
                         = 'You are an AI coach that turns assessment profiles into safe, low‑stakes Minimum Viable Experiences (MVEs). '
                                .'Always and only return a single JSON object with this top-level shape: {"ideas": [...]}. '
                                .'Do not include prose, markdown, or backticks. Each idea must be runnable within 7 days.';
                         = 'Profile+filters JSON (no PII): ' . wp_json_encode() . "\n\n" .
                                'Each ideas[] item must have: '
                                .'title (<=60), lens (Curiosity|Role Models|Opposites|Adjacency), micro_description (<=140), '
                                .'why_this_fits_you, estimated_cost/time/energy/variety (ints 0..4), prompt_to_start, '
                                .'steps (3-5 strings), safety_notes (string), signal_to_watch_for (string), '
                                .'reflection_questions (2-3 strings), tags (array of short tokens). '
                                .'Return: {"ideas": [...]}';
            
                         = [
                            'timeout' => 45, // increase timeout to reduce curl 28 timeouts
                            'redirection' => 3,
                            'httpversion' => '1.1',
                            'headers' => [
                                'Authorization' => 'Bearer ' . ,
                                'Content-Type'  => 'application/json',
                                'Accept'        => 'application/json',
                            ],
                            'body' => wp_json_encode([
                                'model' => 'gpt-4o-mini',
                                'messages' => [
                                    ['role' => 'system', 'content' => ],
                                    ['role' => 'user',   'content' => ],
                                ],
                                'temperature' => 0.7,
                                'response_format' => [ 'type' => 'json_object' ],
                            ]),
                        ];
            
                        // First attempt
                         = wp_remote_post('https://api.openai.com/v1/chat/completions', );
                        // Simple retry on timeout or 5xx
                        if (
                            (is_wp_error() && false !== stripos(->get_error_message(), 'timed out')) ||
                            (!is_wp_error() && (int)wp_remote_retrieve_response_code() >= 500)
                        ) {
                            error_log('MC AI: retry after timeout/5xx');
                            // bump timeout a bit for the retry
                            ['timeout'] = 60;
                             = wp_remote_post('https://api.openai.com/v1/chat/completions', );
                        }
            
                        if (!is_wp_error() && ( = wp_remote_retrieve_response_code()) >= 200 &&  < 300) {
                             = json_decode(wp_remote_retrieve_body(), true);
                             = ['choices'][0]['message']['content'] ?? '';
                            // Primary parse
                             = json_decode(, true);
                            // Secondary: try trimming to nearest JSON braces if needed
                            if (!is_array()) {
                                 = strpos(, '{');  = strrpos(, '}');
                                if ( !== false &&  !== false &&  > ) {
                                     = substr(, ,  -  + 1);
                                     = json_decode(, true);
                                }
                            }
                            if (is_array()) {
                                if (isset(['ideas']) && is_array(['ideas'])) {
                                     = ['ideas'];
                                } elseif (isset([0]) && is_array([0])) {
                                    // Model returned a bare array; accept it
                                     = ;
                                } else {
                                     = true;  = 'json_object_missing_ideas';
                                    error_log('MC AI: json_object_missing_ideas — first 400 chars: ' . substr(, 0, 400));
                                }
                            } else {
                                 = true;  = 'parse_error';
                                error_log('MC AI: parse_error — first 400 chars: ' . substr(, 0, 400));
                            }
                        } else {
                             = true;  = is_wp_error() ? ('wp_error: ' . ->get_error_message()) : ('http_' . wp_remote_retrieve_response_code());
                             = is_wp_error() ? '' : substr(wp_remote_retrieve_body(), 0, 400);
                            error_log('MC AI: API error — ' .  . ' body: ' . );
                        }
                    }
            
                    // Fallback proof‑of‑concept generator (heuristic ideas tied to profile)
                    if (empty()) {
                        if (!) {  = true;  = empty() ? 'no_api_key' : 'poc_generated'; }
            
                        // Friendly names
                         = [
                            'linguistic' => 'Linguistic', 'logical-mathematical' => 'Logical–Mathematical', 'spatial'=>'Spatial',
                            'bodily-kinesthetic'=>'Bodily–Kinesthetic', 'musical'=>'Musical', 'interpersonal'=>'Interpersonal',
                            'intrapersonal'=>'Intrapersonal', 'naturalistic'=>'Naturalistic'
                        ];
                         = [
                            'ambiguity-tolerance'=>'Ambiguity Tolerance','value-conflict-navigation'=>'Value Conflict Navigation',
                            'self-confrontation-capacity'=>'Self‑Confrontation Capacity','discomfort-regulation'=>'Discomfort Regulation',
                            'conflict-resolution-tolerance'=>'Conflict Resolution Tolerance'
                        ];
                         =  ? ucfirst() : '';
                         = [0]['slug'] ?? '';  = [] ?? ( ?: 'Strength');
                         = [1]['slug'] ?? '';  = [] ?? ( ?: 'Skill');
                         = [] ?? ( ?: 'CDT Strength');
                         = [] ?? ( ?: 'Growth Edge');
            
                         = array_keys(array_filter()) ?: ['Curiosity','Role Models','Opposites','Adjacency'];
            
                        // Helper: clamp est within ±1 of filters for a comfortable fit
                         = function(){ return max(0, min(4, )); };
            
                        // Templates per lens
                         = function(, ) use (,,,,,,,,,){
                             = .' – ';
                             = '';
                              = '';
                             = ['learning'];
                            switch(){
                                case 'Curiosity':
                                     .= 'Micro‑scout in '.;
                                     = 'Explore one tiny corner of '..'—20 minutes, one focused question.';
                                      = 'Builds on your '..' strength while keeping stakes low ('..').';
                                     = ['learning','solo'];
                                    break;
                                case 'Role Models':
                                     .= 'Shadow a mini role model';
                                     = 'Observe someone skilled for one session; debrief for 10 minutes after.';
                                      = 'Fits your '..' motivation and reinforces '..'.';
                                     = ['social','leadership'];
                                    break;
                                case 'Opposites':
                                     .= 'Opposite‑day in '.;
                                     = 'Try the reverse of your usual approach once; capture one insight.';
                                      = 'Gentle stretch toward '..' without heavy risk.';
                                     = ['creative'];
                                    break;
                                case 'Adjacency':
                                default:
                                     .= 'Adjacent step near '.;
                                     = 'Add a tiny adjacent skill next to '..' for one session.';
                                      = 'Stays near strengths while opening new options ('..').';
                                     = ['learning','experimentation'];
                                    break;
                            }
                            return [
                                'title' => ,
                                'lens'  => ,
                                'micro_description' => ,
                                'why_this_fits_you' => ,
                                'estimated_cost' => (), 'estimated_time' => (), 'estimated_energy' => (), 'estimated_variety' => (),
                                'prompt_to_start' => 'Block 20 minutes on your calendar and set a phone reminder.',
                                'steps' => ['Choose one target','Prepare 10 minutes','Run for 15–30 minutes','Capture one learning'],
                                'safety_notes' => '',
                                'signal_to_watch_for' => 'Did it energize you? What would you repeat?',
                                'reflection_questions' => ['What surprised you?','What would you tweak next time?'],
                                'tags' => ,
                            ];
                        };
            
                        // Generate ideas rotating lenses
                         = [];
                        for (=0; <; ++){
                             = [ % count()];
                            [] = (, );
                        }
            
                        // Deterministic fit scoring
                         = ['time'=>0.35,'energy'=>0.35,'cost'=>0.2,'variety'=>0.1];
                        foreach ( as &){
                             = abs(['estimated_time']-)*['time'] + abs(['estimated_energy']-)*['energy'] + abs(['estimated_cost']-)*['cost'] + abs(['estimated_variety']-)*['variety'];
                            ['fit_score'] = max(0, round(100 - 25*));
                        }
                        unset();
                        usort(, function(,){ return (['fit_score'] ?? 0) <=> (['fit_score'] ?? 0); });
            
                         = ;
                    }
            
                    // Simple partition: shortlist 6, more next 6
                     = array_slice(, 0, 6);
                          = array_slice(, 6, 12);
                    wp_send_json_success([
                        'shortlist' => ,
                        'more'      => ,
                        'used_fallback' => ,
                        'fallback_reason' => ,
                    ]);
                }
            
                /**
                 * Renders the AI Coach tab content for the dashboard.
                 */
                public function render_ai_coach_tab() {
                    // This method contains the HTML and JS for the AI Coach tab.
                    // It's moved from Micro_Coach_Core::render_quiz_dashboard().
                    ?>
                    <?php  = !empty(self::get_openai_api_key()); ?>
                    <?php if (!): ?>
                        <div class="ai-alert">
                            <strong>Heads up:</strong> The AI key isn’t configured. Go to Quiz Platform → Settings → AI Integration to add your API key.
                        </div>
                    <?php endif; ?>
                    <div id="ai-banner" class="ai-banner" style="display:none;"></div>
                    <div class="ai-filters">
                        <div class="ai-fheader">
                            <span class="f-icn">🧩</span>
                            <div>
                                <h3 class="ai-title">Choose your filters</h3>
                                <p class="ai-sub">to shape your filters to shape experiments you’ll see next.</p>
                            </div>
                        </div>
                        <div class="ai-filter">
                            <div class="ai-filter-row"><span class="f-icn">💰</span><div class="f-title">Cost</div><div class="f-right" id="ai-cost-label">Free</div></div>
                            <div class="f-sub">How much are you willing to spend?</div>
                            <input type="range" min="0" max="4" step="1" value="0" id="ai-cost">
                        </div>
                        <div class="ai-filter">
                            <div class="ai-filter-row"><span class="f-icn">⏳</span><div class="f-title">Time</div><div class="f-right" id="ai-time-label">15–30m</div></div>
                            <div class="f-sub">How much time can you commit?</div>
                            <input type="range" min="0" max="4" step="1" value="1" id="ai-time">
                        </div>
                        <div class="ai-filter">
                            <div class="ai-filter-row"><span class="f-icn">⚡️</span><div class="f-title">Energy</div><div class="f-right" id="ai-energy-label">Low‑focus</div></div>
                            <div class="f-sub">How much effort do you want to put in?</div>
                            <input type="range" min="0" max="4" step="1" value="1" id="ai-energy">
                        </div>
                        <div class="ai-filter">
                            <div class="ai-filter-row"><span class="f-icn">🎲</span><div class="f-title">Variety</div><div class="f-right" id="ai-variety-label">Near routine</div></div>
                            <div class="f-sub">How different from your routine should it be?</div>
                            <input type="range" min="0" max="4" step="1" value="2" id="ai-variety">
                        </div>
                        <div class="ai-lenses">
                            <label><input type="checkbox" id="lens-curiosity" checked> Curiosity</label>
                            <label><input type="checkbox" id="lens-rolemodels" checked> Role Models</label>
                            <label><input type="checkbox" id="lens-opposites" checked> Opposites</label>
                            <label><input type="checkbox" id="lens-adjacency" checked> Adjacency</label>
                        </div>
                        <div class="ai-actions">
                            <button class="quiz-dashboard-button" id="ai-apply">Show experiments that fit my settings</button>
                            <button class="linklike" id="ai-reset" type="button">Reset</button>
                        </div>
                    </div>
                    <div class="ai-results">
                        <h4 class="ai-section">Shortlist</h4>
                        <div class="ai-results-grid" id="ai-shortlist">
                            <!-- Populated by AI → placeholder cards -->
                            <div class="ai-card skeleton"></div>
                            <div class="ai-card skeleton"></div>
                            <div class="ai-card skeleton"></div>
                            <div class="ai-card skeleton"></div>
                            <div class="ai-card skeleton"></div>
                            <div class="ai-card skeleton"></div>
                        </div>
                        <h4 class="ai-section">More options</h4>
                        <div class="ai-results-grid" id="ai-more"></div>
                    </div>
            
                    <!-- Drawer for idea details -->
                    <div id="ai-drawer" class="ai-drawer" aria-hidden="true">
                        <div class="ai-drawer-backdrop" id="ai-drawer-backdrop" tabindex="-1" aria-hidden="true"></div>
                        <aside class="ai-drawer-panel" role="dialog" aria-labelledby="ai-drawer-title">
                            <button type="button" class="ai-drawer-close" id="ai-drawer-close" aria-label="Close">×</button>
                            <header class="ai-drawer-header">
                                <h3 id="ai-drawer-title" class="ai-drawer-title">Idea</h3>
                                <span id="ai-drawer-lens" class="ai-drawer-lens"></span>
                            </header>
                            <p id="ai-drawer-micro" class="ai-drawer-micro"></p>
                            <section class="ai-drawer-section">
                                <h4>Why this fits you</h4>
                                <p id="ai-drawer-why"></p>
                            </section>
                            <section class="ai-drawer-section">
                                <h4>Prompt to start</h4>
                                <p id="ai-drawer-prompt" class="ai-drawer-prompt"></p>
                            </section>
                            <section class="ai-drawer-section">
                                <h4>Steps</h4>
                                <ul id="ai-drawer-steps" class="ai-drawer-steps"></ul>
                            </section>
                            <section class="ai-drawer-section">
                                <h4>What to watch for</h4>
                                <p id="ai-drawer-signal"></p>
                            </section>
                            <section class="ai-drawer-section">
                                <h4>Reflection</h4>
                                <ul id="ai-drawer-reflect" class="ai-drawer-reflect"></ul>
                            </section>
                            <section class="ai-drawer-section" id="ai-drawer-safety-wrap" style="display:none;">
                                <h4>Safety notes</h4>
                                <p id="ai-drawer-safety"></p>
                            </section>
                            <footer class="ai-drawer-footer">
                                <div id="ai-drawer-chips" class="ai-drawer-chips"></div>
                            </footer>
                        </aside>
                    </div>
                    <?php
                }
            }shortcode($widget_content, 'cdt_quiz') || has_shortcode($widget_content, 'cdt-quiz')
            || has_shortcode($widget_content, 'bartle_quiz') || has_shortcode($widget_content, 'bartle-quiz');

        if ($has_quiz_shortcode) {
            return do_shortcode($widget_content);
        }
    }
    return $widget_content;
}
add_filter('elementor/widget/render_content', 'mc_force_render_quiz_shortcodes_in_elementor', 11, 2);