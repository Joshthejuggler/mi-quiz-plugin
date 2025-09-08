<?php
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
            add_action('mc_platform_settings_page_bottom', [$this, 'render_test_connection_section']);
        }

        // AJAX: AI Coach idea generation
        add_action('wp_ajax_mc_ai_generate_mves', [$this, 'ajax_ai_generate_mves']);
        // AJAX: Test API key
        add_action('wp_ajax_mc_ai_test_key', [$this, 'ajax_ai_test_key']);
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
        register_setting(Micro_Coach_Core::OPT_GROUP, self::OPT_OPENAI_API_KEY, function ($v) {
            // Keep it lean; accept plain text and trim
            return trim(sanitize_text_field($v));
        });
        add_settings_field(
            self::OPT_OPENAI_API_KEY,
            'OpenAI API Key',
            function () {
                $val = esc_attr(get_option(self::OPT_OPENAI_API_KEY, ''));
                echo '<input type="password" name="' . esc_attr(self::OPT_OPENAI_API_KEY) . '" value="' . $val . '" style="width: 480px;" placeholder="sk-..." autocomplete="new-password">';
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
        $key = get_option(self::OPT_OPENAI_API_KEY, '');
        return is_string($key) ? trim($key) : '';
    }

    /**
     * Admin AJAX: simple connectivity test for the AI key.
     */
    public function ajax_ai_test_key() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message'=>'Insufficient permissions'], 403);
        }
        $api_key = self::get_openai_api_key();
        if (empty($api_key)) {
            wp_send_json_error(['message'=>'No API key configured']);
        }
        $system = 'You are a healthcheck. Reply with a JSON object {"ok":true} only.';
        $resp = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout' => 15,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode([
                'model' => 'gpt-4o-mini',
                'messages' => [ ['role'=>'system','content'=>$system], ['role'=>'user','content'=>'ping'] ],
                'temperature' => 0,
            ]),
        ]);
        if (is_wp_error($resp)) {
            wp_send_json_error(['message'=>'WP Error: '.$resp->get_error_message()]);
        }
        $code = wp_remote_retrieve_response_code($resp);
        $body = json_decode(wp_remote_retrieve_body($resp), true);
        if ($code >= 200 && $code < 300) {
            $model = $body['model'] ?? ($body['choices'][0]['model'] ?? 'connected');
            wp_send_json_success(['model'=>$model]);
        }
        wp_send_json_error(['message'=>'HTTP '.$code.' — '.substr(wp_remote_retrieve_body($resp),0,200)]);
    }

    /**
     * AJAX: Generate MVEs (Minimum Viable Experiences) based on profile + filters.
     * Returns JSON with two arrays: shortlist and more (placeholders if API not configured).
     */
    public function ajax_ai_generate_mves() {
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Please sign in to use the AI coach.'], 401);
        }

        $user_id = get_current_user_id();

        // Gather filters (0..4)
        $cost    = max(0, min(4, intval($_POST['cost'] ?? 0)));
        $time    = max(0, min(4, intval($_POST['time'] ?? 1)));
        $energy  = max(0, min(4, intval($_POST['energy'] ?? 1)));
        $variety = max(0, min(4, intval($_POST['variety'] ?? 2)));
        $qty     = max(4, min(24, intval($_POST['quantity'] ?? 12)));

        $lenses = [
            'Curiosity'   => !empty($_POST['lens_curiosity']),
            'Role Models' => !empty($_POST['lens_rolemodels']),
            'Opposites'   => !empty($_POST['lens_opposites']),
            'Adjacency'   => !empty($_POST['lens_adjacency']),
        ];

        // Build profile snapshot (no PII)
        $mi_results  = get_user_meta($user_id, 'miq_quiz_results', true) ?: [];
        $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true) ?: [];
        $pt_results  = get_user_meta($user_id, 'bartle_quiz_results', true) ?: [];

        // MI top3 with 0..100 scores
        $mi_part1  = $mi_results['part1Scores'] ?? [];
        $mi_top3   = $mi_results['top3'] ?? [];
        $mi_profile = [];
        foreach ((array)$mi_top3 as $slug) {
            $score = isset($mi_part1[$slug]) ? round(($mi_part1[$slug] / 40) * 100) : 0;
            $mi_profile[] = ['slug' => $slug, 'score' => $score];
        }

        // CDT five subscales 0..100
        $cdt_sorted = $cdt_results['sortedScores'] ?? [];
        $cdt_scores = [];
        foreach ((array)$cdt_sorted as $pair) {
            if (!is_array($pair) || count($pair) < 2) continue;
            $cdt_scores[$pair[0]] = round(($pair[1] / 50) * 100);
        }
        $cdt_top = $cdt_sorted[0][0] ?? null;
        $cdt_bottom = end($cdt_sorted)[0] ?? null;

        // Player Type
        $pt_sorted = $pt_results['sortedScores'] ?? [];
        $primary_pt   = $pt_sorted[0][0] ?? '';
        $primary_pt_p = isset($pt_sorted[0][1]) ? round(($pt_sorted[0][1] / 50) * 100) : 0;
        $secondary_pt = $pt_sorted[1][0] ?? '';
        $secondary_pt_p = isset($pt_sorted[1][1]) ? round(($pt_sorted[1][1] / 50) * 100) : 0;

        // Try to use OpenAI if configured; else produce a few placeholder ideas
        $ideas = [];
        $used_fallback = false; $fallback_reason = '';
        $api_key = self::get_openai_api_key();
        if (!empty($api_key)) {
            // Construct a compact payload for the model
            $payload = [
                'user' => [
                    'id' => (string)$user_id,
                    'mi_top3' => $mi_profile,
                    'cdt' => $cdt_scores,
                    'cdt_top' => $cdt_top,
                    'cdt_edge' => $cdt_bottom,
                    'player_type' => [ 'primary' => [$primary_pt, $primary_pt_p], 'secondary' => [$secondary_pt, $secondary_pt_p] ],
                ],
                'filters' => [
                    'cost' => $cost, 'time' => $time, 'energy' => $energy, 'variety' => $variety,
                    'lenses' => array_keys(array_filter($lenses)), 'quantity' => $qty,
                ],
            ];

            // JSON-mode prompt: require a single JSON object {"ideas": [...]} only.
            $system = 'You are an AI coach that turns assessment profiles into safe, low‑stakes Minimum Viable Experiences (MVEs). '
                    .'Always and only return a single JSON object with this top-level shape: {"ideas": [...]}. '
                    .'Do not include prose, markdown, or backticks. Each idea must be runnable within 7 days.';
            $user = 'Profile+filters JSON (no PII): ' . wp_json_encode($payload) . "\n\n" .
                    'Each ideas[] item must have: '
                    .'title (<=60), lens (Curiosity|Role Models|Opposites|Adjacency), micro_description (<=140), '
                    .'why_this_fits_you, estimated_cost/time/energy/variety (ints 0..4), prompt_to_start, '
                    .'steps (3-5 strings), safety_notes (string), signal_to_watch_for (string), '
                    .'reflection_questions (2-3 strings), tags (array of short tokens). '
                    .'Return: {"ideas": [...]}';

            $http_args = [
                'timeout' => 45, // increase timeout to reduce curl 28 timeouts
                'redirection' => 3,
                'httpversion' => '1.1',
                'headers' => [
                    'Authorization' => 'Bearer ' . $api_key,
                    'Content-Type'  => 'application/json',
                    'Accept'        => 'application/json',
                ],
                'body' => wp_json_encode([
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user',   'content' => $user],
                    ],
                    'temperature' => 0.7,
                    'response_format' => [ 'type' => 'json_object' ],
                ]),
            ];

            // First attempt
            $resp = wp_remote_post('https://api.openai.com/v1/chat/completions', $http_args);
            // Simple retry on timeout or 5xx
            if (
                (is_wp_error($resp) && false !== stripos($resp->get_error_message(), 'timed out')) ||
                (!is_wp_error($resp) && (int)wp_remote_retrieve_response_code($resp) >= 500)
            ) {
                error_log('MC AI: retry after timeout/5xx');
                // bump timeout a bit for the retry
                $http_args['timeout'] = 60;
                $resp = wp_remote_post('https://api.openai.com/v1/chat/completions', $http_args);
            }

            if (!is_wp_error($resp) && ($code = wp_remote_retrieve_response_code($resp)) >= 200 && $code < 300) {
                $body = json_decode(wp_remote_retrieve_body($resp), true);
                $content = $body['choices'][0]['message']['content'] ?? '';
                // Primary parse
                $parsed = json_decode($content, true);
                // Secondary: try trimming to nearest JSON braces if needed
                if (!is_array($parsed)) {
                    $start = strpos($content, '{'); $end = strrpos($content, '}');
                    if ($start !== false && $end !== false && $end > $start) {
                        $content2 = substr($content, $start, $end - $start + 1);
                        $parsed = json_decode($content2, true);
                    }
                }
                if (is_array($parsed)) {
                    if (isset($parsed['ideas']) && is_array($parsed['ideas'])) {
                        $ideas = $parsed['ideas'];
                    } elseif (isset($parsed[0]) && is_array($parsed[0])) {
                        // Model returned a bare array; accept it
                        $ideas = $parsed;
                    } else {
                        $used_fallback = true; $fallback_reason = 'json_object_missing_ideas';
                        error_log('MC AI: json_object_missing_ideas — first 400 chars: ' . substr($content, 0, 400));
                    }
                } else {
                    $used_fallback = true; $fallback_reason = 'parse_error';
                    error_log('MC AI: parse_error — first 400 chars: ' . substr($content, 0, 400));
                }
            } else {
                $used_fallback = true; $fallback_reason = is_wp_error($resp) ? ('wp_error: ' . $resp->get_error_message()) : ('http_' . wp_remote_retrieve_response_code($resp));
                $snippet = is_wp_error($resp) ? '' : substr(wp_remote_retrieve_body($resp), 0, 400);
                error_log('MC AI: API error — ' . $fallback_reason . ' body: ' . $snippet);
            }
        }

        // Fallback proof‑of‑concept generator (heuristic ideas tied to profile)
        if (empty($ideas)) {
            if (!$used_fallback) { $used_fallback = true; $fallback_reason = empty($api_key) ? 'no_api_key' : 'poc_generated'; }

            // Friendly names
            $mi_names = [
                'linguistic' => 'Linguistic', 'logical-mathematical' => 'Logical–Mathematical', 'spatial'=>'Spatial',
                'bodily-kinesthetic'=>'Bodily–Kinesthetic', 'musical'=>'Musical', 'interpersonal'=>'Interpersonal',
                'intrapersonal'=>'Intrapersonal', 'naturalistic'=>'Naturalistic'
            ];
            $cdt_names = [
                'ambiguity-tolerance'=>'Ambiguity Tolerance','value-conflict-navigation'=>'Value Conflict Navigation',
                'self-confrontation-capacity'=>'Self‑Confrontation Capacity','discomfort-regulation'=>'Discomfort Regulation',
                'conflict-resolution-tolerance'=>'Conflict Resolution Tolerance'
            ];
            $pt_primary_name = $primary_pt ? ucfirst($primary_pt) : '';
            $mi_top1 = $mi_profile[0]['slug'] ?? ''; $mi_top1_name = $mi_names[$mi_top1] ?? ($mi_top1 ?: 'Strength');
            $mi_top2 = $mi_profile[1]['slug'] ?? ''; $mi_top2_name = $mi_names[$mi_top2] ?? ($mi_top2 ?: 'Skill');
            $cdt_top_name = $cdt_names[$cdt_top] ?? ($cdt_top ?: 'CDT Strength');
            $cdt_edge_name = $cdt_names[$cdt_bottom] ?? ($cdt_bottom ?: 'Growth Edge');

            $selected_lenses = array_keys(array_filter($lenses)) ?: ['Curiosity','Role Models','Opposites','Adjacency'];

            // Helper: clamp est within ±1 of filters for a comfortable fit
            $est = function($target){ return max(0, min(4, $target)); };

            // Templates per lens
            $make = function($lens, $idx) use ($mi_top1_name,$mi_top2_name,$pt_primary_name,$cdt_top_name,$cdt_edge_name,$est,$cost,$time,$energy,$variety){
                $title = $lens.' – ';
                $desc = '';
                $why  = '';
                $tags = ['learning'];
                switch($lens){
                    case 'Curiosity':
                        $title .= 'Micro‑scout in '.$mi_top1_name;
                        $desc = 'Explore one tiny corner of '.$mi_top1_name.'—20 minutes, one focused question.';
                        $why  = 'Builds on your '.$mi_top1_name.' strength while keeping stakes low ('.$cdt_top_name.').';
                        $tags = ['learning','solo'];
                        break;
                    case 'Role Models':
                        $title .= 'Shadow a mini role model';
                        $desc = 'Observe someone skilled for one session; debrief for 10 minutes after.';
                        $why  = 'Fits your '.$pt_primary_name.' motivation and reinforces '.$mi_top2_name.'.';
                        $tags = ['social','leadership'];
                        break;
                    case 'Opposites':
                        $title .= 'Opposite‑day in '.$mi_top1_name;
                        $desc = 'Try the reverse of your usual approach once; capture one insight.';
                        $why  = 'Gentle stretch toward '.$cdt_edge_name.' without heavy risk.';
                        $tags = ['creative'];
                        break;
                    case 'Adjacency':
                    default:
                        $title .= 'Adjacent step near '.$mi_top2_name;
                        $desc = 'Add a tiny adjacent skill next to '.$mi_top2_name.' for one session.';
                        $why  = 'Stays near strengths while opening new options ('.$cdt_top_name.').';
                        $tags = ['learning','experimentation'];
                        break;
                }
                return [
                    'title' => $title,
                    'lens'  => $lens,
                    'micro_description' => $desc,
                    'why_this_fits_you' => $why,
                    'estimated_cost' => $est($cost), 'estimated_time' => $est($time), 'estimated_energy' => $est($energy), 'estimated_variety' => $est($variety),
                    'prompt_to_start' => 'Block 20 minutes on your calendar and set a phone reminder.',
                    'steps' => ['Choose one target','Prepare 10 minutes','Run for 15–30 minutes','Capture one learning'],
                    'safety_notes' => '',
                    'signal_to_watch_for' => 'Did it energize you? What would you repeat?',
                    'reflection_questions' => ['What surprised you?','What would you tweak next time?'],
                    'tags' => $tags,
                ];
            };

            // Generate ideas rotating lenses
            $pool = [];
            for ($i=0; $i<$qty; $i++){
                $lens = $selected_lenses[$i % count($selected_lenses)];
                $pool[] = $make($lens, $i);
            }

            // Deterministic fit scoring
            $w = ['time'=>0.35,'energy'=>0.35,'cost'=>0.2,'variety'=>0.1];
            foreach ($pool as &$it){
                $dist = abs($it['estimated_time']-$time)*$w['time'] + abs($it['estimated_energy']-$energy)*$w['energy'] + abs($it['estimated_cost']-$cost)*$w['cost'] + abs($it['estimated_variety']-$variety)*$w['variety'];
                $it['fit_score'] = max(0, round(100 - 25*$dist));
            }
            unset($it);
            usort($pool, function($a,$b){ return ($b['fit_score'] ?? 0) <=> ($a['fit_score'] ?? 0); });

            $ideas = $pool;
        }

        // Simple partition: shortlist 6, more next 6
        $shortlist = array_slice($ideas, 0, 6);
        $more      = array_slice($ideas, 6, 12);
        wp_send_json_success([
            'shortlist' => $shortlist,
            'more'      => $more,
            'used_fallback' => $used_fallback,
            'fallback_reason' => $fallback_reason,
        ]);
    }

    /**
     * Renders the AI Coach tab content for the dashboard.
     */
    public function render_ai_coach_tab() {
        // This method contains the HTML and JS for the AI Coach tab.
        // It's moved from Micro_Coach_Core::render_quiz_dashboard().
        ?>
        <?php $api_key_set = !empty(self::get_openai_api_key()); ?>
        <?php if (!$api_key_set): ?>
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
}