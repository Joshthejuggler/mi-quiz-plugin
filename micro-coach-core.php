<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * The main Core class for the quiz platform.
 * Its job is to load shared services and discover/load all available quiz modules.
 */
class Micro_Coach_Core {
    private $loaded_modules = [];
    private static $registered_quizzes = [];
    const OPT_GROUP = 'mc_quiz_platform_settings';
    const OPT_DESCRIPTIONS = 'mc_quiz_descriptions';

    public function __construct() {
        // Add the new shortcode for the quiz dashboard.
        add_shortcode('quiz_dashboard', [$this, 'render_quiz_dashboard']);

        if (is_admin()) {
            // Add admin settings page for the platform.
            add_action('admin_menu', [$this, 'add_settings_page'], 9);
            add_action('admin_init', [$this, 'register_settings']);
        }

        add_action('save_post', [$this, 'clear_shortcode_page_transients']);
    }

    /**
     * Allows quiz modules to register themselves with the core platform.
     * @param string $id A unique ID for the quiz (e.g., 'mi-quiz').
     * @param array $args An array of quiz metadata.
     */
    public static function register_quiz($id, $args) {
        $defaults = [
            'title'            => 'Untitled Quiz',
            'shortcode'        => '',
            'results_meta_key' => '',
            'order'            => 99,
            'description'      => '',
            'description_completed' => '',
            'depends_on'       => null,
        ];
        self::$registered_quizzes[$id] = wp_parse_args($args, $defaults);
    }

    /**
     * Returns the array of all registered quizzes.
     * @return array
     */
    public static function get_quizzes() {
        return self::$registered_quizzes;
    }

    /**
     * Adds the main settings page for the quiz platform.
     */
    public function add_settings_page() {
        add_menu_page(
            'Quiz Platform Settings',
            'Quiz Platform',
            'manage_options',
            'quiz-platform-settings',
            [$this, 'render_settings_page'],
            'dashicons-forms',
            58 // Position it near other quiz menus.
        );

        add_submenu_page(
            'quiz-platform-settings',
            'Quiz Platform Settings',
            'Settings',
            'manage_options',
            'quiz-platform-settings', // Use parent slug for the main settings page
            [$this, 'render_settings_page']
        );
    }

    /**
     * Registers settings for the quiz platform, like descriptions.
     */
    public function register_settings() {
        // Intentionally left minimal: remove the "Quiz Descriptions" section
        // and fields from the admin UI per request. Other modules (e.g., AI)
        // still add their own settings/sections to this page.
    }

    public function sanitize_descriptions($input) {
        $sanitized = [];
        if (is_array($input)) {
            foreach ($input as $id => $desc) {
                $sanitized[sanitize_key($id)] = sanitize_textarea_field(stripslashes($desc));
            }
        }
        return $sanitized;
    }

    public function render_settings_page() {
        ?><div class="wrap"><h1>Quiz Platform Settings</h1>
        <form method="post" action="options.php"><?php
            settings_fields(self::OPT_GROUP);
            do_settings_sections('quiz-platform-settings');
            submit_button();
        ?></form><?php
        // Allow other components (like the AI module) to add content here.
        do_action('mc_platform_settings_page_bottom');
        ?></div><?php
    }

    /**
     * Renders the [quiz_dashboard] shortcode content.
     */
    public function render_quiz_dashboard() {
        $quizzes = self::get_quizzes();
        if (empty($quizzes)) {
            return current_user_can('manage_options') ? '<p><em>Quiz Dashboard: No quizzes have been registered.</em></p>' : '';
        }

        $user_id = get_current_user_id();
        $saved_descriptions = get_option(self::OPT_DESCRIPTIONS, []);
        wp_enqueue_style('dashicons');
 
        ob_start();
 
        if ( $user_id ) { // Logged-in user view
            // --- Calculate Progress & Next Step ---
            $u = wp_get_current_user();
            if ( ! empty( $u->first_name ) ) {
                $first = $u->first_name;
            } elseif ( ! empty( $u->display_name ) ) {
                $first = $u->display_name;
            } else {
                $first = "Friend";
            }
            $greetings = [
                "Welcome back, {$first} — what will you discover today?",
                "Good to see you, {$first}. Your journey continues.",
                "Hi {$first}, ready for another step in self-discovery?",
                "{$first}, small steps lead to big insights."
            ];
            $greeting = $greetings[ array_rand( $greetings ) ];
 
            // --- Build Activity Feed & Latest Insight ---
            $activity_feed = [];
            foreach ($quizzes as $id => $quiz) {
                if (!empty($quiz['results_meta_key'])) {
                    $results = get_user_meta($user_id, $quiz['results_meta_key'], true);
                    if (!empty($results) && is_array($results) && isset($results['completed_at'])) {
                        $activity_feed[] = [
                            'quiz_id'    => $id,
                            'quiz_title' => $quiz['title'],
                            'timestamp'  => $results['completed_at'],
                            'results'    => $results,
                        ];
                    }
                }
            }

            // Add account creation to the feed
            $user_data = get_userdata($user_id);
            $activity_feed[] = [
                'quiz_id'    => 'account_creation',
                'quiz_title' => 'Created your account',
                'timestamp'  => strtotime($user_data->user_registered),
                'results'    => [],
            ];

            // Sort the feed by timestamp descending
            usort($activity_feed, function($a, $b) {
                return $b['timestamp'] <=> $a['timestamp'];
            });

            $latest_insight_html = '<p class="placeholder-text"><em>Complete an assessment to see your first insight here!</em></p>';
            $latest_activity = null;
            // Find the most recent *quiz* activity for the insight panel
            foreach ($activity_feed as $activity) {
                if ($activity['quiz_id'] !== 'account_creation') {
                    $latest_activity = $activity;
                    break;
                }
            }

            // --- Calculate completion status for sorting and progress ---
            $completion_status = [];
            foreach ($quizzes as $id => $quiz) {
                $completion_status[$id] = !empty($quiz['results_meta_key']) && !empty(get_user_meta($user_id, $quiz['results_meta_key'], true));
            }

            // --- Sort Quizzes for Display ---
            // Add ID to each quiz for sorting purposes
            foreach ($quizzes as $id => &$quiz) {
                $quiz['id'] = $id;
            }
            unset($quiz); // Unset reference

            // Sort by completion status first, then by order.
            uasort($quizzes, function($a, $b) use ($completion_status) {
                $completed_a = $completion_status[$a['id']] ?? false;
                $completed_b = $completion_status[$b['id']] ?? false;

                if ($completed_a === $completed_b) {
                    return ($a['order'] ?? 99) <=> ($b['order'] ?? 99); // Secondary sort: by order
                }

                return $completed_a <=> $completed_b; // Primary sort: incomplete (false) before complete (true)
            });

            $total_quizzes = count($quizzes);
            $completed_quizzes = count(array_filter($completion_status));
            $progress_pct = ($total_quizzes > 0) ? round(($completed_quizzes / $total_quizzes) * 100) : 0;
 
            $next_step_url = '';
            $next_step_title = 'All Quizzes Complete!';
            if ($progress_pct >= 100) {
                $composite_url = $this->find_page_by_shortcode('composite_profile');
                if ($composite_url) {
                    $next_step_url = $composite_url;
                    $next_step_title = 'View Self-Discovery Profile';
                }
            }
            if ($progress_pct < 100) {
                foreach ($quizzes as $id => $quiz) {
                    $dependency_met = true;
                    if (!empty($quiz['depends_on']) && !($completion_status[$quiz['depends_on']] ?? false)) {
                        $dependency_met = false;
                    }
                    if ($dependency_met && !($completion_status[$id] ?? false)) {
                        $next_step_url = $this->find_page_by_shortcode($quiz['shortcode']);
                        $next_step_title = 'Next Step: ' . $quiz['title'];
                        break;
                    }
                }
            }
            ?>
            <div class="quiz-dashboard-container">
                <div class="dashboard-header">
                    <div class="site-branding">
                        <img src="https://skillofselfdiscovery.com/wp-content/uploads/2025/09/Untitled-design-4.png" alt="Logo" class="site-logo">
                        <span class="site-title">Skill of Self-Discovery</span>
                    </div>
                    <!-- User menu can be added here -->
                </div>
                <!-- Hero / Greeting Row -->
                <div class="quiz-dashboard-hero">
                    <div class="quiz-dashboard-hero-greeting">
                        <h2 class="greeting-title"><?php echo esc_html($greeting); ?></h2>
                        <p class="greeting-subtitle">Your journey of self-discovery is a marathon, not a sprint. Each step reveals something new.</p>
                    </div>
                    <div class="quiz-dashboard-hero-progress-card">
                        <div class="progress-card-header">
                            <h3 class="progress-card-title">Your Progress</h3>
                            <span class="progress-card-percent"><?php echo esc_html($progress_pct); ?>%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: <?php echo esc_attr($progress_pct); ?>%;"></div>
                        </div>
                        <?php if ($next_step_url && $next_step_url !== '#'): ?>
                            <a href="<?php echo esc_url($next_step_url); ?>" class="quiz-dashboard-button progress-card-next-step-btn"><?php echo esc_html($next_step_title); ?></a>
                        <?php else: ?>
                            <span class="quiz-dashboard-button is-disabled progress-card-next-step-btn"><?php echo esc_html($next_step_title); ?></span>
                        <?php endif; ?>
                    </div>
                </div>
 
                <?php if ($user_id && $completed_quizzes === $total_quizzes && $total_quizzes > 0): 
                    // --- All quizzes are complete, render the tabbed interface ---
                    require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
                    require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php';
                    require_once MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/questions.php';

                    $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                    $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
                    $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);

                    // --- Process Data for Identity Card ---
                    $mi_top3_names = array_map(function($slug) use ($mi_categories) { return $mi_categories[$slug] ?? ucfirst(str_replace('-', ' ', $slug)); }, $mi_results['top3'] ?? []);
                    $cdt_scores_by_slug = array_column($cdt_results['sortedScores'] ?? [], 1, 0);
                    $cdt_slug_map = ['ambiguity-tolerance', 'value-conflict-navigation', 'self-confrontation-capacity', 'discomfort-regulation', 'conflict-resolution-tolerance'];
                    $bartle_scores_by_slug = array_column($bartle_results['sortedScores'] ?? [], 1, 0);
                    $primary_bartle_slug = $bartle_results['sortedScores'][0][0] ?? '';
                    $secondary_bartle_slug = $bartle_results['sortedScores'][1][0] ?? '';
                    $primary_bartle_pct = round(($bartle_scores_by_slug[$primary_bartle_slug] ?? 0) / 50 * 100);
                    $secondary_bartle_pct = round(($bartle_scores_by_slug[$secondary_bartle_slug] ?? 0) / 50 * 100);

                    // CDT top and bottom
                    $cdt_sorted = $cdt_results['sortedScores'] ?? [];
                    $cdt_top_slug = !empty($cdt_sorted[0][0]) ? $cdt_sorted[0][0] : null;
                    $cdt_bottom_slug = null;
                    if (!empty($cdt_sorted)) { $last = end($cdt_sorted); if (!empty($last[0])) { $cdt_bottom_slug = $last[0]; } }

                    // --- Build radar chart data ---
                    $chart_labels = [ 'Linguistic', 'Logical', 'Spatial', 'Bodily', 'Musical', 'Interpersonal', 'Intrapersonal', 'Naturalistic', 'Ambiguity', 'Value Conflict', 'Self-Confront', 'Discomfort Reg', 'Growth', 'Explorer', 'Achiever', 'Socializer', 'Strategist' ];
                    $mi_chart_data = array_fill(0, 17, null);
                    $mi_slug_map = ['linguistic', 'logical-mathematical', 'spatial', 'bodily-kinesthetic', 'musical', 'interpersonal', 'intrapersonal', 'naturalistic'];
                    foreach ($mi_slug_map as $i => $slug) { $mi_chart_data[$i] = round(($mi_results['part1Scores'][$slug] ?? 0) / 40 * 100); }
                    $cdt_chart_data = array_fill(0, 17, null);
                    $cdt_slug_map = ['ambiguity-tolerance', 'value-conflict-navigation', 'self-confrontation-capacity', 'discomfort-regulation', 'conflict-resolution-tolerance'];
                    foreach ($cdt_slug_map as $i => $slug) { $cdt_chart_data[8 + $i] = round((($cdt_scores_by_slug[$slug] ?? 0) / 50) * 100); }
                    $pt_chart_data = array_fill(0, 17, null);
                    $pt_slug_map = ['explorer', 'achiever', 'socializer', 'strategist'];
                    foreach ($pt_slug_map as $i => $slug) { $pt_chart_data[13 + $i] = round((($bartle_scores_by_slug[$slug] ?? 0) / 50) * 100); }

                    // Build result page URLs for deep links
                    $mi_url     = $this->find_page_by_shortcode('mi_quiz') ?: $this->find_page_by_shortcode('mi-quiz');
                    $cdt_url    = $this->find_page_by_shortcode('cdt_quiz') ?: $this->find_page_by_shortcode('cdt-quiz');
                    $bartle_url = $this->find_page_by_shortcode('bartle_quiz') ?: $this->find_page_by_shortcode('bartle-quiz');

                    // --- Process Data for Radar Chart ---
                    $chart_labels = [ 'Linguistic', 'Logical', 'Spatial', 'Bodily', 'Musical', 'Interpersonal', 'Intrapersonal', 'Naturalistic', 'Ambiguity', 'Value Conflict', 'Self-Confront', 'Discomfort Reg', 'Growth', 'Explorer', 'Achiever', 'Socializer', 'Strategist' ];
                    $mi_chart_data = array_fill(0, 17, null);
                    $mi_slug_map = ['linguistic', 'logical-mathematical', 'spatial', 'bodily-kinesthetic', 'musical', 'interpersonal', 'intrapersonal', 'naturalistic'];
                    foreach ($mi_slug_map as $i => $slug) { $mi_chart_data[$i] = round(($mi_results['part1Scores'][$slug] ?? 0) / 40 * 100); }
                    $cdt_chart_data = array_fill(0, 17, null);
                    foreach ($cdt_slug_map as $i => $slug) { $cdt_chart_data[8 + $i] = round(($cdt_scores_by_slug[$slug] ?? 0) / 50 * 100); }
                    $pt_chart_data = array_fill(0, 17, null);
                    $pt_slug_map = ['explorer', 'achiever', 'socializer', 'strategist'];
                    foreach ($pt_slug_map as $i => $slug) { $pt_chart_data[13 + $i] = round(($bartle_scores_by_slug[$slug] ?? 0) / 50 * 100); }
                ?>
                    <div class="dashboard-tabs">
                        <button class="tab-link active" data-tab="tab-composite">🧩 Your Self-Discovery Profile</button>
                        <button class="tab-link" data-tab="tab-path">📊 Detailed Results</button>
                        <button class="tab-link" data-tab="tab-ai">🤖 AI Coach</button>
                    </div>
                    <div class="tab-content-wrapper">
                        <div id="tab-composite" class="tab-content active">
                            <?php
                                // Prepare dynamic values for the card
                                $pt_slug = $primary_bartle_slug ?: '';
                                $pt_title = ucfirst($pt_slug);
                                $pt_theme_class = $pt_slug ? 'pt--' . sanitize_html_class($pt_slug) : '';
                                $pt_pct = (int) $primary_bartle_pct;
                                $pt_emoji = '🎯';
                                if ($pt_slug === 'explorer') $pt_emoji = '🧭';
                                elseif ($pt_slug === 'achiever') $pt_emoji = '🏆';
                                elseif ($pt_slug === 'socializer') $pt_emoji = '🤝';
                                elseif ($pt_slug === 'strategist') $pt_emoji = '♟️';

                                // MI top 3 with percents and icons
                                $mi_top3 = [];
                                if (!empty($mi_results['top3']) && !empty($mi_results['part1Scores'])) {
                                    foreach ($mi_results['top3'] as $mi_slug) {
                                        $label = $mi_categories[$mi_slug] ?? ucfirst(str_replace('-', ' ', $mi_slug));
                                        $score = (int) ($mi_results['part1Scores'][$mi_slug] ?? 0);
                                        $pct   = max(0, min(100, round(($score / 40) * 100)));
                                        // Icon mapping
                                        $icon = '⭐'; $l = $label; $ll = strtolower($l);
                                        if (strpos($ll,'linguistic') !== false) $icon = '📚';
                                        elseif (strpos($ll,'logical') !== false) $icon = '🧩';
                                        elseif (strpos($ll,'spatial') !== false) $icon = '🧭';
                                        elseif (strpos($ll,'bodily') !== false) $icon = '🏃';
                                        elseif (strpos($ll,'musical') !== false) $icon = '🎵';
                                        elseif (strpos($ll,'interpersonal') !== false) $icon = '🤝';
                                        elseif (strpos($ll,'intrapersonal') !== false) $icon = '🧠';
                                        elseif (strpos($ll,'naturalistic') !== false) $icon = '🌿';
                                        $mi_top3[] = compact('label','pct','icon');
                                    }
                                }

                                // CDT top/bottom
                                $cdt_top = null; $cdt_bottom = null;
                                if (!empty($cdt_top_slug)) {
                                    $t_pct = max(0, min(100, round((($cdt_scores_by_slug[$cdt_top_slug] ?? 0) / 50) * 100)));
                                    $cdt_top = [ 'label' => $cdt_categories[$cdt_top_slug] ?? ucfirst(str_replace('-', ' ', $cdt_top_slug)), 'pct' => $t_pct ];
                                }
                                if (!empty($cdt_bottom_slug)) {
                                    $b_pct = max(0, min(100, round((($cdt_scores_by_slug[$cdt_bottom_slug] ?? 0) / 50) * 100)));
                                    $cdt_bottom = [ 'label' => $cdt_categories[$cdt_bottom_slug] ?? ucfirst(str_replace('-', ' ', $cdt_bottom_slug)), 'pct' => $b_pct ];
                                }
                            ?>

                            <!-- Self-Discovery Player Card -->
                            <article class="sosd-playercard <?php echo esc_attr($pt_theme_class); ?>" data-player-type="<?php echo esc_attr($pt_title); ?>" aria-label="Self-Discovery Player Card: <?php echo esc_attr($pt_title); ?>" style="--pct:<?php echo $pt_pct; ?>">
                              <div class="pc-mainhead">Self-Discovery Profile Card</div>
                              <header class="pc-head pc-head--center">
                                <h2 class="pc-title">Player Type</h2>
                              </header>
                              <p class="pc-caption" style="text-align:center; margin:6px 0 10px;">Why I’m motivated to engage at all</p>

                              <?php
                                $sec_slug  = $secondary_bartle_slug ?: '';
                                $sec_title = $sec_slug ? ucfirst($sec_slug) : '';
                                $sec_pct   = (int) ($secondary_bartle_pct ?? 0);
                                $sec_emoji = '🎯';
                                if ($sec_slug === 'explorer') $sec_emoji = '🧭';
                                elseif ($sec_slug === 'achiever') $sec_emoji = '🏆';
                                elseif ($sec_slug === 'socializer') $sec_emoji = '🤝';
                                elseif ($sec_slug === 'strategist') $sec_emoji = '♟️';

                                // Player Type caption (dynamic)
                                $pt_phrases = [
                                  'explorer'   => 'Explorers stay motivated by curiosity, discovery, and learning through new experiences.',
                                  'achiever'   => 'Achievers thrive by setting goals and measuring progress — momentum and milestones keep them moving.',
                                  'socializer' => 'Socializers gain energy from collaboration, relationships, and shared growth.',
                                  'strategist' => 'Strategists find motivation in analysis, challenge, and mastering complex systems.'
                                ];
                                $pt_caption = '';
                                if ($pt_slug) {
                                  $pt_caption = 'Your dominant player type shows how you stay motivated. ' . ($pt_phrases[$pt_slug] ?? 'Your primary style reveals what keeps you engaged and moving forward.') ;
                                  if ($sec_slug) {
                                    $pt_caption .= ' Your secondary type adds nuance — ' . ($pt_phrases[$sec_slug] ?? 'it complements your primary style') . '.';
                                  }
                                }
                              ?>
                              <section class="pc-pt">
                                <div class="pc-pt-grid">
                                  <div class="pt-col primary">
                                    <div class="pc-emblem" role="img" aria-label="<?php echo esc_attr($pt_title); ?> emblem" style="--pct:<?php echo $pt_pct; ?>">
                                      <div class="pc-emblem-ring"></div>
                                      <div class="pc-emoji" aria-hidden="true"><?php echo esc_html($pt_emoji); ?></div>
                                      <span class="pc-pct pc-pct--overlay"><?php echo $pt_pct; ?>%</span>
                                    </div>
                                    <div class="pt-name"><?php echo esc_html($pt_title); ?></div>
                                  </div>
                                  <?php if ($sec_slug): ?>
                                  <div class="pt-col secondary">
                                    <div class="pc-emblem" role="img" aria-label="<?php echo esc_attr($sec_title); ?> emblem" style="--pct:<?php echo $sec_pct; ?>">
                                      <div class="pc-emblem-ring"></div>
                                      <div class="pc-emoji" aria-hidden="true"><?php echo esc_html($sec_emoji); ?></div>
                                      <span class="pc-pct pc-pct--overlay"><?php echo $sec_pct; ?>%</span>
                                    </div>
                                    <div class="pt-name"><?php echo esc_html($sec_title); ?></div>
                                  </div>
                                  <?php endif; ?>
                                </div>
                                <?php if (!empty($pt_caption)): ?>
                                  <p class="pc-caption"><?php echo esc_html($pt_caption); ?></p>
                                <?php endif; ?>
                              </section>

                              <section class="pc-mi">
                                <h3 class="pc-kicker">Top Multiple Intelligences</h3>
                                <p class="pc-caption" style="text-align:center; margin:4px 0 10px;">What I’m naturally good at</p>
                                <ul class="pc-mi-grid">
                                  <?php foreach ($mi_top3 as $mi): ?>
                                  <li class="mi" style="--val:<?php echo (int) $mi['pct']; ?>">
                                    <span class="mi-gauge" data-val="<?php echo (int) $mi['pct']; ?>"></span>
                                    <span class="mi-icon" aria-hidden="true"><?php echo esc_html($mi['icon']); ?></span>
                                    <span class="mi-label"><?php echo esc_html($mi['label']); ?></span>
                                    <span class="mi-val"><?php echo (int) $mi['pct']; ?></span>
                                  </li>
                                  <?php endforeach; ?>
                                </ul>
                                <?php
                                  // MI caption based on top 2–3
                                  $mi_phrase = [
                                    'Linguistic' => 'strength with language and clear expression',
                                    'Logical' => 'analytical thinking and structured problem‑solving',
                                    'Spatial' => 'seeing patterns and thinking visually',
                                    'Bodily' => 'learning through action and movement',
                                    'Musical' => 'rhythm, pattern, and sound‑based learning',
                                    'Interpersonal' => 'learning through relationships and collaboration',
                                    'Intrapersonal' => 'self‑reflection and inner motivation',
                                    'Naturalistic' => 'noticing patterns in nature and systems'
                                  ];
                                  $mi_labels = array_map(function($m){ return $m['label']; }, $mi_top3);
                                  $mi_caption = '';
                                  if (!empty($mi_labels)) {
                                    $topA = $mi_labels[0] ?? '';
                                    $topB = $mi_labels[1] ?? '';
                                    $topC = $mi_labels[2] ?? '';
                                    $descA = $mi_phrase[explode(' ', $topA)[0]] ?? 'your natural way of learning';
                                    $descB = $mi_phrase[explode(' ', $topB)[0]] ?? '';
                                    $descC = $mi_phrase[explode(' ', $topC)[0]] ?? '';
                                    $mi_caption = 'These are your strongest ways of learning and expressing intelligence. ';
                                    if ($topA && $topB) {
                                      $mi_caption .= $topA . ' and ' . $topB . ' suggest ' . $descA . ($descB ? ' and ' . $descB : '') . ', ';
                                    } elseif ($topA) {
                                      $mi_caption .= $topA . ' suggests ' . $descA . ', ';
                                    }
                                    if ($topC) {
                                      $mi_caption .= 'while ' . $topC . ' adds ' . ($descC ?: 'additional strength') . '.';
                                    } else {
                                      $mi_caption = rtrim($mi_caption, ', ') . '.';
                                    }
                                  }
                                ?>
                                <?php if (!empty($mi_caption)): ?>
                                  <p class="pc-caption"><?php echo esc_html($mi_caption); ?></p>
                                <?php endif; ?>
                              </section>

                              <section class="pc-cdt">
                                <h3 class="pc-kicker">CDT Highlights</h3>
                                <p class="pc-caption" style="text-align:center; margin:4px 0 10px;">How I handle discomfort or internal conflict</p>
                                <div class="pc-cdt-grid">
                                  <?php if ($cdt_top): ?>
                                  <div class="cdt-chip good">
                                    <span class="cdt-tag">Strongest</span>
                                    <span class="cdt-name"><?php echo esc_html($cdt_top['label']); ?></span>
                                    <span class="cdt-meter" style="--val:<?php echo (int) $cdt_top['pct']; ?>"></span>
                                    <span class="cdt-val"><?php echo (int) $cdt_top['pct']; ?></span>
                                  </div>
                                  <?php endif; ?>
                                  <?php if ($cdt_bottom): ?>
                                  <div class="cdt-chip edge">
                                    <span class="cdt-tag">Growth Edge</span>
                                    <span class="cdt-name"><?php echo esc_html($cdt_bottom['label']); ?></span>
                                    <span class="cdt-meter" style="--val:<?php echo (int) $cdt_bottom['pct']; ?>"></span>
                                    <span class="cdt-val"><?php echo (int) $cdt_bottom['pct']; ?></span>
                                  </div>
                                  <?php endif; ?>
                                </div>
                                <?php
                                  // CDT caption mapping
                                  $cdt_phrase = [
                                    'Ambiguity Tolerance' => 'you can stay open and flexible when outcomes are unclear.',
                                    'Value Conflict Navigation' => 'you work through differences in values without shutting down.',
                                    'Self-Confrontation Capacity' => 'you reflect and adjust when actions and values diverge.',
                                    'Discomfort Regulation' => 'you remain steady when conversations get tense.',
                                    'Conflict Resolution Tolerance' => 'you stay engaged through conflict to reach resolution.'
                                  ];
                                  $cdt_caption = '';
                                  if ($cdt_top || $cdt_bottom) {
                                    if ($cdt_top) {
                                      $nm = $cdt_top['label'];
                                      $cdt_caption .= 'Your strongest area, ' . $nm . ', suggests ' . ($cdt_phrase[$nm] ?? 'a reliable strength under pressure') . ' ';
                                    }
                                    if ($cdt_bottom) {
                                      $nm = $cdt_bottom['label'];
                                      $cdt_caption .= 'Your growth edge, ' . $nm . ', points to where focused practice can help.';
                                    }
                                  }
                                ?>
                                <?php if (!empty($cdt_caption)): ?>
                                  <p class="pc-caption"><?php echo esc_html($cdt_caption); ?></p>
                                <?php endif; ?>
                              </section>
                              <!-- Radar Overview inside the card -->
                              <section class="pc-spider">
                                <header class="pc-spider-head">
                                  <h3 class="pc-kicker pc-spider-title">How It All Fits</h3>
                                </header>
                                <div class="pc-spider-canvas">
                                  <canvas id="compositeRadar" aria-label="Combined Profile Radar" role="img"></canvas>
                                </div>
                                <p class="pc-caption pc-spider-desc">How my profile looks as one picture.</p>
                              </section>
                            </article>

                            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                            <script>
                              (function(){
                                const el = document.getElementById('compositeRadar');
                                if (!el || typeof Chart === 'undefined') return;
                                const chartLabels = <?php echo json_encode(array_map(function($l) { return explode(' ', $l)[0]; }, $chart_labels)); ?>;
                                const dataMI = <?php echo json_encode($mi_chart_data); ?>;
                                const dataCDT = <?php echo json_encode($cdt_chart_data); ?>;
                                const dataPT = <?php echo json_encode($pt_chart_data); ?>;
                                const miHighlight = new Array(17).fill(null);
                                const cdtHighlight = new Array(17).fill(null);
                                const ptHighlight = new Array(17).fill(null);
                                const miTopIdx = dataMI.slice(0,8).map((v,i)=>({v,i})).sort((a,b)=>(b.v||0)-(a.v||0)).slice(0,3).map(o=>o.i);
                                miTopIdx.forEach(i=> miHighlight[i] = dataMI[i]);
                                const cdtSlice = dataCDT.slice(8,13).map((v,i)=>({v,i:i+8})).sort((a,b)=>(b.v||0)-(a.v||0));
                                if (cdtSlice.length && cdtSlice[0].v != null) cdtHighlight[cdtSlice[0].i] = dataCDT[cdtSlice[0].i];
                                for (let i=13;i<=16;i++) ptHighlight[i] = dataPT[i];
                                const zonesBg = { id:'zonesBg', beforeDraw(chart){ const {ctx, scales:{r}}=chart; if(!r) return; const band=(a,b,c)=>{ const inner=r.getDistanceFromCenterForValue(a), outer=r.getDistanceFromCenterForValue(b); ctx.save(); ctx.fillStyle=c; ctx.beginPath(); ctx.arc(r.xCenter,r.yCenter,outer,0,2*Math.PI); ctx.arc(r.xCenter,r.yCenter,inner,0,2*Math.PI,true); ctx.closePath(); ctx.fill(); ctx.restore();}; band(70,100,'rgba(16,185,129,0.06)'); band(40,70,'rgba(245,158,11,0.06)'); band(0,40,'rgba(239,68,68,0.05)'); } };
                                new Chart(el, {
                                  type:'radar',
                                  data:{ labels: chartLabels, datasets:[
                                    { label:'MI', data:dataMI, fill:true, borderWidth:1, pointRadius:0, backgroundColor:'rgba(54,162,235,0.08)', borderColor:'rgba(54,162,235,0.5)' },
                                    { label:'CDT', data:dataCDT, fill:true, borderWidth:1, pointRadius:0, backgroundColor:'rgba(255,99,132,0.08)', borderColor:'rgba(255,99,132,0.5)' },
                                    { label:'Player', data:dataPT, fill:true, borderWidth:1, pointRadius:0, backgroundColor:'rgba(75,192,192,0.08)', borderColor:'rgba(75,192,192,0.5)' },
                                    { label:'Top MI', data:miHighlight, fill:true, borderWidth:3, pointRadius:2, backgroundColor:'rgba(54,162,235,0.25)', borderColor:'rgb(54,162,235)' },
                                    { label:'Top CDT', data:cdtHighlight, fill:true, borderWidth:3, pointRadius:2, backgroundColor:'rgba(255,99,132,0.25)', borderColor:'rgb(255,99,132)' },
                                    { label:'Player (hi)', data:ptHighlight, fill:true, borderWidth:3, pointRadius:2, backgroundColor:'rgba(75,192,192,0.20)', borderColor:'rgb(75,192,192)' }
                                  ]},
                                  options:{ responsive:true, maintainAspectRatio:false, layout:{ padding:{left:0,right:0} }, elements:{ line:{ tension:0.2 } }, scales:{ r:{ suggestedMin:0, suggestedMax:100, ticks:{ stepSize:25, backdropColor:'transparent' }, grid:{ color:'rgba(100,116,139,0.15)' }, angleLines:{ color:'rgba(100,116,139,0.15)' }, pointLabels:{ font:{ size:14 } } } }, plugins:{ legend:{ position:'bottom', align:'center', labels:{ filter:i=> ['MI','CDT','Player'].includes(i.text) } } } },
                                  plugins:[zonesBg]
                                });
                              })();
                            </script>

                            <div class="composite-cta profile-links" style="text-align:center"><em>
                              <?php if ($mi_url): ?><a class="inline-link" href="<?php echo esc_url($mi_url); ?>">View MI results</a> · <?php endif; ?>
                              <?php if ($cdt_url): ?><a class="inline-link" href="<?php echo esc_url($cdt_url); ?>">View CDT results</a> · <?php endif; ?>
                              <?php if ($bartle_url): ?><a class="inline-link" href="<?php echo esc_url($bartle_url); ?>">View Player Type results</a><?php endif; ?>
                            </em></div>
                        </div>
                        <div id="tab-path" class="tab-content">
                            <div class="quiz-dashboard-grid">
                                <?php
                                foreach ($quizzes as $id => $quiz):
                                    $has_results = $completion_status[$id] ?? false;
                                    $quiz_page_url = $this->find_page_by_shortcode($quiz['shortcode']);
                                    $dependency_met = true;
                                    $dependency_title = '';
                                    if (!empty($quiz['depends_on'])) {
                                        $dependency_id = $quiz['depends_on'];
                                        if (isset($quizzes[$dependency_id])) {
                                            $dependency_title = $quizzes[$dependency_id]['title'];
                                            if (!($completion_status[$dependency_id] ?? false)) { $dependency_met = false; }
                                        }
                                    }
                                    $description = ($has_results && !empty($quiz['description_completed'])) ? $quiz['description_completed'] : (!empty($saved_descriptions[$id]) ? $saved_descriptions[$id] : $quiz['description']);
                                    
                                    $mi_profile_content = '';
                                    if ($has_results && $id === 'mi-quiz') {
                                        $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                                        if (!empty($mi_results['top3']) && isset($mi_categories)) {
                                            $mi_profile_content = array_map(function($slug) use ($mi_categories) { return $mi_categories[$slug] ?? ucfirst(str_replace('-', ' ', $slug)); }, $mi_results['top3']);
                                        }
                                    }
                                    $bartle_profile_content = ''; $bartle_profile_description = '';
                                    if ($has_results && $id === 'bartle-quiz') {
                                        $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
                                        if (!empty($bartle_results['sortedScores'][0]) && isset($bartle_categories) && isset($bartle_descriptions)) {
                                            $top_slug = $bartle_results['sortedScores'][0][0];
                                            $bartle_profile_content = $bartle_categories[$top_slug] ?? ucfirst(str_replace('-', ' ', $top_slug));
                                            $bartle_profile_description = $bartle_descriptions[$top_slug] ?? '';
                                        }
                                    }
                                ?>
                                <div class="quiz-dashboard-item <?php if (!$dependency_met) echo 'is-locked'; ?>">
                                    <div class="quiz-dashboard-item-header">
                                        <h3 class="quiz-dashboard-title"><?php echo esc_html($quiz['title']); ?></h3>
                                        <span class="quiz-dashboard-status-badge completed">Completed</span>
                                    </div>
                                    <div class="quiz-dashboard-item-body">
                                        <p class="quiz-dashboard-description"><?php echo esc_html($description); ?></p>
                                        <?php if (!empty($mi_profile_content)): ?>
                                            <div class="quiz-dashboard-insight-panel insight-panel-profile"><h4 class="insight-panel-title">Your Top Intelligences</h4><div class="quiz-dashboard-chips"><?php foreach ($mi_profile_content as $name): ?><span class="chip"><?php echo esc_html($name); ?></span><?php endforeach; ?></div></div>
                                        <?php endif; ?>
                                        <?php if (!empty($bartle_profile_content)): ?>
                                            <div class="quiz-dashboard-insight-panel insight-panel-profile"><h4 class="insight-panel-title">Your Primary Player Type</h4><div class="quiz-dashboard-chips"><span class="chip"><?php echo esc_html($bartle_profile_content); ?></span></div><?php if (!empty($bartle_profile_description)): ?><p style="margin-top: 8px;"><?php echo esc_html($bartle_profile_description); ?></p><?php endif; ?></div>
                                        <?php endif; ?>
                                    </div>
                                    <div class="quiz-dashboard-actions">
                                        <a href="<?php echo esc_url($quiz_page_url); ?>" class="quiz-dashboard-button quiz-dashboard-button-secondary">View Results</a>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <!-- AI Coach Tab -->
                        <div id="tab-ai" class="tab-content">
                            <?php 
                                if (class_exists('Micro_Coach_AI')) {
                                    (new Micro_Coach_AI())->render_ai_coach_tab();
                                }
                            ?>
                        </div>
                    </div>
                <?php else: ?>
                    <!-- Your Path Section (for users who have NOT completed all quizzes) -->
                    <h2 class="quiz-dashboard-section-title">Your Path</h2>
                    <div class="quiz-dashboard-grid">
                        <?php
                        foreach ($quizzes as $id => $quiz):
                            $has_results = $completion_status[$id] ?? false;
                            $quiz_page_url = $this->find_page_by_shortcode($quiz['shortcode']);
                            $dependency_met = true;
                            $dependency_title = '';
                            if (!empty($quiz['depends_on'])) {
                                $dependency_id = $quiz['depends_on'];
                                if (isset($quizzes[$dependency_id])) {
                                    $dependency_title = $quizzes[$dependency_id]['title'];
                                    if (!($completion_status[$dependency_id] ?? false)) { $dependency_met = false; }
                                }
                            }
                            $description = ($has_results && !empty($quiz['description_completed'])) ? $quiz['description_completed'] : (!empty($saved_descriptions[$id]) ? $saved_descriptions[$id] : $quiz['description']);
                            $prediction_paragraph = '';
                            if ($id === 'cdt-quiz' && ($completion_status['mi-quiz'] ?? false)) {
                                $mi_prompts_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-cdt-prompts.php';
                                if (file_exists($mi_prompts_file)) {
                                    require $mi_prompts_file;
                                    $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                                    if (is_array($mi_results) && empty($mi_results['top3']) && !empty($mi_results['part1Scores']) && is_array($mi_results['part1Scores'])) {
                                        $scores = $mi_results['part1Scores']; arsort($scores); $mi_results['top3'] = array_keys(array_slice($scores, 0, 3, true));
                                    }
                                    if (!empty($mi_results['top3']) && count($mi_results['top3']) >= 3 && isset($mi_cdt_prompts)) {
                                        $top3_keys = $mi_results['top3']; sort($top3_keys); $prompt_key = implode('_', $top3_keys);
                                        if (isset($mi_cdt_prompts[$prompt_key]['prompt'])) { $prediction_paragraph = $mi_cdt_prompts[$prompt_key]['prompt']; }
                                    }
                                }
                            }
                            $bartle_prediction_paragraph = '';
                            if ($id === 'bartle-quiz' && ($completion_status['mi-quiz'] ?? false) && ($completion_status['cdt-quiz'] ?? false)) {
                                $bartle_predictions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/predictions.php';
                                if (file_exists($bartle_predictions_file)) {
                                    require $bartle_predictions_file;
                                    $mi_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php'; if (file_exists($mi_questions_file)) { require_once $mi_questions_file; }
                                    $cdt_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php'; if (file_exists($cdt_questions_file)) { require_once $cdt_questions_file; }
                                    $mi_results = get_user_meta($user_id, 'miq_quiz_results', true); $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
                                    if (is_array($mi_results) && is_array($cdt_results) && isset($player_type_templates)) {
                                        $bartle_scores = ['explorer' => 0, 'achiever' => 0, 'socializer' => 0, 'strategist' => 0];
                                        $mi_map = [ 'logical-mathematical' => ['achiever', 'strategist'], 'linguistic' => ['socializer'], 'spatial' => ['explorer'], 'bodily-kinesthetic' => ['achiever'], 'musical' => ['explorer', 'socializer'], 'interpersonal' => ['socializer', 'strategist'], 'intrapersonal' => ['explorer'], 'naturalistic' => ['explorer'], ];
                                        $cdt_map = [ 'ambiguity-tolerance' => ['explorer'], 'value-conflict-navigation' => ['socializer'], 'self-confrontation-capacity' => ['achiever'], 'discomfort-regulation' => ['achiever', 'strategist'], 'conflict-resolution-tolerance' => ['strategist'], ];
                                        if (!empty($mi_results['top3'])) { $points = 3; foreach ($mi_results['top3'] as $mi_slug) { if (isset($mi_map[$mi_slug])) { foreach ($mi_map[$mi_slug] as $bartle_type) { $bartle_scores[$bartle_type] += $points; } } $points--; } }
                                        if (!empty($cdt_results['sortedScores'][0])) { $cdt_slug = $cdt_results['sortedScores'][0][0]; if (isset($cdt_map[$cdt_slug])) { foreach ($cdt_map[$cdt_slug] as $bartle_type) { $bartle_scores[$bartle_type] += 3; } } }
                                        arsort($bartle_scores); $predicted_type = key($bartle_scores);
                                        if (isset($player_type_templates[$predicted_type])) {
                                            $template = $player_type_templates[$predicted_type][array_rand($player_type_templates[$predicted_type])];
                                            $mi_names = array_map(function($slug) use ($mi_categories) { return $mi_categories[$slug] ?? ''; }, $mi_results['top3']);
                                            $mi_strengths_str = 'a combination of ' . implode(', ', array_filter($mi_names));
                                            $cdt_slug = $cdt_results['sortedScores'][0][0];
                                            $cdt_strengths_str = 'a high capacity for ' . ($cdt_categories[$cdt_slug] ?? 'navigating challenges');
                                            $bartle_prediction_paragraph = str_replace(['{mi_strengths}', '{cdt_strengths}'], [$mi_strengths_str, $cdt_strengths_str], $template);
                                        }
                                    }
                                }
                            }
                            $mi_profile_content = '';
                            if ($has_results && $id === 'mi-quiz') {
                                $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
                                $mi_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
                                if (file_exists($mi_questions_file)) {
                                    require_once $mi_questions_file;
                                    if (!empty($mi_results['top3']) && isset($mi_categories)) { $mi_profile_content = array_map(function($slug) use ($mi_categories) { return $mi_categories[$slug] ?? ucfirst(str_replace('-', ' ', $slug)); }, $mi_results['top3']); }
                                }
                            }
                            $bartle_profile_content = ''; $bartle_profile_description = '';
                            if ($has_results && $id === 'bartle-quiz') {
                                $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
                                $bartle_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/bartle-quiz/questions.php';
                                if (file_exists($bartle_questions_file)) {
                                    require_once $bartle_questions_file;
                                    if (!empty($bartle_results['sortedScores'][0]) && isset($bartle_categories) && isset($bartle_descriptions)) {
                                        $top_slug = $bartle_results['sortedScores'][0][0];
                                        $bartle_profile_content = $bartle_categories[$top_slug] ?? ucfirst(str_replace('-', ' ', $top_slug));
                                        $bartle_profile_description = $bartle_descriptions[$top_slug] ?? '';
                                    }
                                }
                            }
                            ?>
                            <div class="quiz-dashboard-item <?php if (!$dependency_met) echo 'is-locked'; ?>">
                                <div class="quiz-dashboard-item-header">
                                    <h3 class="quiz-dashboard-title"><?php echo esc_html($quiz['title']); ?></h3>
                                    <?php if ($has_results): ?><span class="quiz-dashboard-status-badge completed">Completed</span>
                                    <?php elseif (!$dependency_met): ?><span class="quiz-dashboard-status-badge locked">Locked</span>
                                    <?php else: ?><span class="quiz-dashboard-status-badge not-started">Not Started</span><?php endif; ?>
                                </div>
                                <div class="quiz-dashboard-item-body">
                                    <p class="quiz-dashboard-description"><?php echo esc_html($description); ?></p>
                                    <?php if (!empty($mi_profile_content)): ?>
                                        <div class="quiz-dashboard-insight-panel insight-panel-profile"><h4 class="insight-panel-title">Your Top Intelligences</h4><div class="quiz-dashboard-chips"><?php foreach ($mi_profile_content as $name): ?><span class="chip"><?php echo esc_html($name); ?></span><?php endforeach; ?></div></div>
                                    <?php endif; ?>
                                    <?php if (!empty($bartle_profile_content)): ?>
                                        <div class="quiz-dashboard-insight-panel insight-panel-profile"><h4 class="insight-panel-title">Your Primary Player Type</h4><div class="quiz-dashboard-chips"><span class="chip"><?php echo esc_html($bartle_profile_content); ?></span></div><?php if (!empty($bartle_profile_description)): ?><p style="margin-top: 8px;"><?php echo esc_html($bartle_profile_description); ?></p><?php endif; ?></div>
                                    <?php endif; ?>
                                    <?php if (!empty($bartle_prediction_paragraph)): ?>
                                        <div class="quiz-dashboard-insight-panel insight-panel-prediction"><h4 class="insight-panel-title">Your Personalized Bartle Prediction</h4><p><?php echo wp_kses_post($bartle_prediction_paragraph); ?></p></div>
                                    <?php endif; ?>
                                    <?php if (!empty($prediction_paragraph)): ?>
                                        <div class="quiz-dashboard-insight-panel insight-panel-prediction"><h4 class="insight-panel-title">Your Personalized CDT Prediction</h4><p><?php echo wp_kses_post($prediction_paragraph); ?></p></div>
                                    <?php endif; ?>
                                </div>
                                <div class="quiz-dashboard-actions">
                                    <?php if ($dependency_met): ?>
                                        <?php if ($quiz_page_url): ?>
                                            <a href="<?php echo esc_url($quiz_page_url); ?>" class="quiz-dashboard-button <?php if ($has_results) echo 'quiz-dashboard-button-secondary'; ?>"><?php echo $has_results ? 'View Results' : 'Start Quiz'; ?></a>
                                        <?php else: ?>
                                            <span class="quiz-dashboard-button is-disabled" title="<?php printf(esc_attr__('Admin: Please create a page with the shortcode [%s] for this quiz.'), esc_attr($quiz['shortcode'])); ?>"><?php _e('Not Linked'); ?></span>
                                        <?php endif; ?>
                                    <?php else: ?>
                                        <span class="quiz-dashboard-button is-disabled" title="<?php printf(esc_attr__('Please complete "%s" first.'), esc_attr($dependency_title)); ?>"><?php _e('Locked'); ?></span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
 
                <!-- Insights & Activity Section (Placeholders) -->
                <h2 class="quiz-dashboard-section-title">Insights &amp; Activity</h2>
                <div class="quiz-dashboard-lower-grid">
                    <div class="insight-panel">
                        <h3 class="panel-title">Latest Insight</h3>
                        <?php
                        if ($latest_activity) {
                            // Load data files needed for insights
                            $mi_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/mi-quiz/mi-questions.php';
                            if (file_exists($mi_questions_file)) { require_once $mi_questions_file; }
                            $cdt_questions_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/questions.php';
                            if (file_exists($cdt_questions_file)) { require_once $cdt_questions_file; }
                            $cdt_details_file = MC_QUIZ_PLATFORM_PATH . 'quizzes/cdt-quiz/details.php';
                            if (file_exists($cdt_details_file)) { require_once $cdt_details_file; }

                            switch ($latest_activity['quiz_id']) {
                                case 'mi-quiz':
                                    // The top sub-skill is the first item in the 'top5' array.
                                    if (!empty($latest_activity['results']['top5'][0])) {
                                        $top_sub_skill = $latest_activity['results']['top5'][0];
                                        $age_group = $latest_activity['results']['age'] ?? 'adult';
                                        
                                        $sub_skill_name = $top_sub_skill['name'];
                                        $parent_slug = $top_sub_skill['slug'];
                                        
                                        $leverage_tip = '';
                                        if (isset($mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name]) && is_array($mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name])) {
                                            $tips = $mi_leverage_tips[$age_group][$parent_slug][$sub_skill_name];
                                            $leverage_tip = $tips[array_rand($tips)]; // Pick a random tip
                                        }

                                        $latest_insight_html = '<p>Your top MI strength is <strong>' . esc_html($sub_skill_name) . '</strong>. This is a key part of your ' . esc_html($top_sub_skill['parent']) . '.</p>';
                                        if ($leverage_tip) {
                                            $latest_insight_html .= '<p class="insight-leverage-tip"><strong>To leverage this:</strong> ' . esc_html($leverage_tip) . '</p>';
                                        }

                                        // Add growth area
                                        if (!empty($latest_activity['results']['bottom3'][0])) {
                                            $lowest_sub_skill = $latest_activity['results']['bottom3'][0];
                                            $sub_skill_name = $lowest_sub_skill['name'];
                                            $parent_slug = $lowest_sub_skill['slug'];

                                            $growth_tip = '';
                                            if (isset($mi_growth_tips[$age_group][$parent_slug][$sub_skill_name]) && is_array($mi_growth_tips[$age_group][$parent_slug][$sub_skill_name])) {
                                                $tips = $mi_growth_tips[$age_group][$parent_slug][$sub_skill_name];
                                                $growth_tip = $tips[array_rand($tips)];
                                            }

                                            if ($growth_tip) {
                                                $latest_insight_html .= '<p class="insight-growth-tip"><strong>An area for growth:</strong> In ' . esc_html($sub_skill_name) . ', try to ' . esc_html(lcfirst($growth_tip)) . '</p>';
                                            }
                                        }
                                    }
                                    break;
                                case 'cdt-quiz':
                                    if (!empty($latest_activity['results']['sortedScores'][0]) && isset($cdt_categories)) {
                                        $top_cdt_slug = $latest_activity['results']['sortedScores'][0][0];
                                        $top_cdt_name = $cdt_categories[$top_cdt_slug] ?? 'Unknown';
                                        $latest_insight_html = '<p>Your CDT Quiz results indicate a high capacity for <strong>' . esc_html($top_cdt_name) . '</strong>. This is a key skill for navigating complex challenges.</p>';

                                        // Add growth area
                                        $sorted_scores = $latest_activity['results']['sortedScores'];
                                        if (!empty($sorted_scores) && isset($cdt_dimension_details)) {
                                            $lowest_cdt_slug = end($sorted_scores)[0];
                                            $age_group = $latest_activity['results']['ageGroup'] ?? 'adult';
                                            
                                            if (isset($cdt_dimension_details[$lowest_cdt_slug])) {
                                                $details = $cdt_dimension_details[$lowest_cdt_slug];
                                                $age_details = $details[$age_group] ?? $details['adult'];
                                                
                                                if (!empty($age_details['growth']) && is_array($age_details['growth'])) {
                                                    $growth_tip = $age_details['growth'][array_rand($age_details['growth'])];
                                                    $lowest_cdt_name = $details['title'] ?? $cdt_categories[$lowest_cdt_slug] ?? 'Unknown';
                                                    $latest_insight_html .= '<p class="insight-growth-tip"><strong>An area for growth:</strong> In ' . esc_html($lowest_cdt_name) . ', try to ' . esc_html(lcfirst($growth_tip)) . '</p>';
                                                }
                                            }
                                        }
                                    }
                                    break;
                            }
                        }
                        echo $latest_insight_html;
                        ?>
                    </div>
                    <div class="activity-panel">
                        <h3 class="panel-title">Recent Activity</h3>
                        <ul class="activity-list">
                            <?php foreach (array_slice($activity_feed, 0, 5) as $activity): ?>
                                <li><span class="activity-date"><?php echo esc_html(human_time_diff($activity['timestamp'])); ?> ago:</span> <?php echo esc_html($activity['quiz_title']); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>
 
                <!-- Resources Section (Placeholder) -->
                <div class="quiz-dashboard-resources">
                    <a href="#" class="resource-link"><span class="dashicons dashicons-editor-help"></span> Help Center</a>
                    <a href="#" class="resource-link"><span class="dashicons dashicons-info"></span> FAQs</a>
                    <a href="#" class="resource-link"><span class="dashicons dashicons-email-alt"></span> Contact Us</a>
                </div>
            </div>
 
        <?php } else { // Logged-out user view
            // Find the URL for the primary starting quiz.
            $mi_quiz_url = $this->find_page_by_shortcode('mi_quiz');
            ?>
            <style>
                .quiz-dashboard-auth-wrapper { max-width: 900px; margin: 2em auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
                .dashboard-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5em; margin-bottom: 1.5em; border-bottom: 1px solid #e2e8f0; }
                .site-branding { display: flex; align-items: center; gap: 20px; text-decoration: none; }
                .site-logo { max-height: 100px; width: auto; height: auto; max-width: 100%; }
                .site-title { font-size: 1.8em; font-weight: 600; color: #1a202c; line-height: 1.2; }

                .quiz-dashboard-auth-prompt {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px 32px;
                    text-align: center;
                    max-width: 500px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
                }
                .quiz-dashboard-auth-prompt h2 {
                    font-size: 1.5em;
                    margin-top: 0;
                    color: #1a202c;
                }
                .quiz-dashboard-auth-prompt p {
                    font-size: 1em;
                    color: #4a5568;
                    margin-bottom: 1.5em;
                }
                .quiz-dashboard-auth-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .quiz-dashboard-auth-prompt .quiz-dashboard-button-secondary {
                    background: #f1f3f4;
                    color: #2d3748;
                    border: 1px solid #e2e8f0;
                }
                .quiz-dashboard-auth-prompt .quiz-dashboard-button-secondary:hover {
                    background: #e2e8f0;
                    color: #1a202c;
                }
                @media (max-width: 600px) {
                    .quiz-dashboard-auth-actions {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .dashboard-header {
                        justify-content: center;
                    }
                    .site-branding {
                        flex-direction: column;
                        gap: 10px;
                    }
                }
                .quiz-dashboard-admin-notice {
                    margin-top: 1.5em;
                    padding: 0.75em;
                    background-color: #fffbe6;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    font-size: 0.9em;
                    text-align: left;
                    color: #92400e;
                }
            </style>
            <div class="quiz-dashboard-auth-wrapper">
                <div class="dashboard-header">
                    <div class="site-branding">
                        <img src="https://skillofselfdiscovery.com/wp-content/uploads/2025/09/Untitled-design-4.png" alt="Logo" class="site-logo">
                        <span class="site-title">Skill of Self-Discovery</span>
                    </div>
                </div>
                <div class="quiz-dashboard-auth-prompt">
                    <h2>Welcome to Skill of Self-Discovery</h2>
                    <p>Explore guided assessments and AI-powered tools that help you understand your strengths, navigate challenges, and grow with intention. Please select an option below to start your journey or view your progress.</p>
                    <div class="quiz-dashboard-auth-actions">
                        <?php if ($mi_quiz_url): ?>
                            <a href="<?php echo esc_url($mi_quiz_url); ?>" class="quiz-dashboard-button">Start Your Journey (Free)</a>
                        <?php else: ?>
                            <span class="quiz-dashboard-button is-disabled" title="The starting quiz has not been set up yet.">Start Your Journey (Free)</span>
                        <?php endif; ?>
                        <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="quiz-dashboard-button quiz-dashboard-button-secondary">Returning User? Log In</a>
                    </div>
                    <?php if ( ! $mi_quiz_url && current_user_can('manage_options') ): ?>
                        <div class="quiz-dashboard-admin-notice">
                            <strong>Admin Notice:</strong> The "Start Your Journey" button is disabled because no published page contains the <code>[mi_quiz]</code> shortcode. Please create a page for the MI Quiz and add its shortcode.
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        <?php } ?>
 
        <script>
            // Simple tabs controller for the dashboard tabs
            document.addEventListener('DOMContentLoaded', function() {
                const tabContainer = document.querySelector('.dashboard-tabs');
                if (!tabContainer) return;
                const tabLinks = tabContainer.querySelectorAll('.tab-link');
                const tabContents = document.querySelectorAll('.tab-content-wrapper .tab-content');
                tabLinks.forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const tabId = this.dataset.tab;
                        tabLinks.forEach(l => l.classList.remove('active'));
                        tabContents.forEach(c => c.classList.remove('active'));
                        this.classList.add('active');
                        const activeContent = document.getElementById(tabId);
                        if (activeContent) activeContent.classList.add('active');
                    });
                });
                // Optional: CTA link to switch to details tab
                const cta = document.getElementById('go-to-details-tab');
                if (cta) {
                    cta.addEventListener('click', function(e){
                        e.preventDefault();
                        const detailsBtn = tabContainer.querySelector('.tab-link[data-tab="tab-path"]');
                        if (detailsBtn) detailsBtn.click();
                    });
                }
            });
        </script>
        <style>
            /* ===== Self-Discovery Player Card (Baseball Card) ===== */
            :root{
              --pc-surface:#ffffff;
              --pc-text:#0f172a;
              --pc-muted:#6b7280;
              --pc-line:#e5e7eb;
              --pc-accent:#7aa2ff;
              --pc-good:#28c596;
              --pc-edge:#ff7a7a;
              --pc-shadow: 0 14px 40px rgba(2,6,23,.10), 0 4px 10px rgba(2,6,23,.06);
            }
            @media (prefers-color-scheme: dark){
              :root{ --pc-surface:#0f1220; --pc-text:#e6e9f2; --pc-muted:#9aa3b2; --pc-line:#26304a; --pc-shadow: 0 18px 44px rgba(0,0,0,.55); }
            }
            .sosd-playercard{ width:min(720px, 98%); margin:14px auto; background:var(--pc-surface); color:var(--pc-text); border:1px solid var(--pc-line); border-radius:20px; box-shadow:var(--pc-shadow); padding:14px 16px 18px; text-align:center; position:relative; overflow:hidden; }
            .pc-head{ display:grid; grid-template-columns:1fr auto 1fr; align-items:end; gap:8px; margin-bottom:2px; }
            .pc-rank{ justify-self:start; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--pc-muted); }
            .pc-title{ margin:0; font-size:clamp(26px,4vw,34px); line-height:1.1; }
            .pc-pct{ font-weight:800; padding:6px 10px; border-radius:999px; background: color-mix(in oklab, var(--pc-accent) 16%, transparent); border:1px solid color-mix(in oklab, var(--pc-accent) 40%, var(--pc-line)); }
            .pc-emblem{ --pct:72; width:min(260px, 70vw); aspect-ratio:1; margin:8px auto 10px; position:relative; display:grid; place-items:center; }
            .pc-emblem::after{ content:""; position:absolute; inset:-10px; border-radius:50%; background: conic-gradient(var(--pc-accent) calc(var(--pct,0)*1%), transparent 0), radial-gradient(circle at 50% 50%, transparent 64%, rgba(0,0,0,.05) 65%, transparent 66%); mask: radial-gradient(circle at 50% 50%, transparent 60%, #000 61%); }
            .pc-emblem-ring{ position:absolute; inset:0; border-radius:50%; background: radial-gradient(closest-side, color-mix(in oklab, var(--pc-accent) 18%, transparent), transparent 70%), conic-gradient(from 0turn, color-mix(in oklab, var(--pc-accent) 12%, transparent), transparent); border:1px solid var(--pc-line); box-shadow: inset 0 0 60px color-mix(in oklab, var(--pc-accent) 14%, transparent); }
            .pc-emoji{ font-size:clamp(56px, 9vw, 84px); filter: drop-shadow(0 6px 16px rgba(0,0,0,.12)); }
            .pc-pct--overlay{ position:absolute; top:4px; right:4px; font-size:13px; backdrop-filter: blur(2px); }
            .pc-kicker{ margin:4px 0 8px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--pc-muted); }
            .pc-mi-grid{ list-style:none; padding:0; margin:0; display:grid; gap:10px; grid-template-columns:repeat(3, 1fr); }
            @media (max-width:560px){ .pc-mi-grid{ grid-template-columns:1fr; } }
            .mi{ background:linear-gradient(180deg, color-mix(in oklab, var(--pc-accent) 8%, transparent), transparent); border:1px solid var(--pc-line); border-radius:14px; padding:12px 10px 10px; display:grid; grid-template-columns:52px 1fr auto; grid-template-rows:auto auto; gap:6px 8px; align-items:center; }
            .mi-gauge{ grid-row:1 / span 2; width:46px; aspect-ratio:1; border-radius:50%; position:relative; display:grid; place-items:center; font-weight:900; color:#0f172a; background: conic-gradient(color-mix(in oklab, var(--pc-accent) 35%, transparent) calc(var(--val,0)*1%), rgba(127,141,170,.12) 0), radial-gradient(circle at 50% 50%, #fff 52%, transparent 53%); border:1px solid var(--pc-line); }
            .mi-gauge::after{ content: attr(data-val); font-size:14px; }
            .mi-icon{ font-size:20px; }
            .mi-label{ font-weight:700; text-align:left; }
            .mi-val{ font-weight:800; justify-self:end; }
            .pc-cdt{ margin-top:10px; }
            .pc-cdt-grid{ display:grid; gap:10px; grid-template-columns:1fr 1fr; }
            @media (max-width:560px){ .pc-cdt-grid{ grid-template-columns:1fr; } }
            .cdt-chip{ display:grid; grid-template-columns:auto 1fr auto; grid-template-rows:auto auto; align-items:center; gap:6px 8px; border:1px solid var(--pc-line); border-radius:12px; padding:10px 12px; background:#f8fafc; }
            @media (prefers-color-scheme: dark){ .cdt-chip{ background:#121627; } }
            .cdt-tag{ font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:var(--pc-muted); grid-column:1 / span 1; padding:2px 6px; border-radius:999px; }
            .cdt-chip.good .cdt-tag{ background: color-mix(in oklab, var(--pc-good) 20%, transparent); color:#065f46; }
            .cdt-chip.edge .cdt-tag{ background: color-mix(in oklab, var(--pc-edge) 20%, transparent); color:#7f1d1d; }
            .cdt-name{ font-weight:800; grid-column:2 / span 1; text-align:left; }
            .cdt-val{ font-weight:800; grid-column:3 / span 1; }
            .cdt-meter{ grid-column:1 / span 3; height:8px; border-radius:999px; background:#e5e7eb; position:relative; overflow:hidden; }
            .cdt-meter::after{ content:""; position:absolute; inset:0 0 0 0; width: calc(var(--val,0) * 1%); background: var(--pc-good); }
            .cdt-chip.edge .cdt-meter::after{ background: var(--pc-edge); }
            .sosd-playercard.pt--explorer   { --pc-accent:#42c6ff; }
            .sosd-playercard.pt--achiever   { --pc-accent:#7aa2ff; }
            .sosd-playercard.pt--socializer { --pc-accent:#60d394; }
            .sosd-playercard.pt--strategist { --pc-accent:#ff9f43; }

            /* === SOSD Card Cleanup Patch === */
            /* 1) Global rhythm & container breathing */
            .sosd-playercard{
              padding: 20px 22px 22px;
              border-radius: 18px;
              box-shadow: 0 10px 28px rgba(2,6,23,.08), 0 2px 6px rgba(2,6,23,.06);
            }
            .sosd-playercard .pc-title{ margin: 6px 0 4px; }
            .sosd-playercard .pc-emblem{ margin: 8px auto 18px; }

            .pc-kicker{
              margin: 14px 0 10px;
              letter-spacing: .14em;
            }

            /* optional: subtle divider between sections */
            .sosd-playercard .pc-mi,
            .sosd-playercard .pc-cdt{
              position: relative;
              padding-top: 6px;
            }
            .sosd-playercard .pc-mi::before,
            .sosd-playercard .pc-cdt::before{
              content:"";
              position:absolute; left:0; right:0; top:-6px;
              height:1px; background: rgba(15,23,42,.06);
            }

            /* 2) MI tiles — remove redundancy & rebalance */
            .sosd-playercard .pc-mi-grid{ gap: 14px; }
            .sosd-playercard .mi{ grid-template-columns: 44px 1fr auto; padding: 12px 14px; }
            /* keep the score INSIDE the dial; hide the extra number below */
            .sosd-playercard .mi-val{ display:none; }
            .sosd-playercard .mi-gauge{
              width: 40px;
              color: #0f172a;
              background:
                conic-gradient(color-mix(in oklab, var(--pc-accent) 60%, #cbd5e1) calc(var(--val,0)*1%), #e8edf4 0),
                radial-gradient(circle at 50% 50%, #fff 58%, transparent 59%);
              border: 1px solid #e6e9f2;
            }
            .sosd-playercard .mi-gauge::after{ font-size: 12px; }
            .sosd-playercard .mi-label{ line-height: 1.2; }

            /* 3) CDT chips — more contrast, steady spacing */
            .sosd-playercard .pc-cdt-grid{ gap: 14px; align-items: stretch; }
            .sosd-playercard .cdt-chip{ padding: 12px; background: #f9fafb; border: 1px solid #e6e9f2; display:grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto auto; row-gap:6px; column-gap:8px; min-height: 110px; }
            /* Bottom tag: centered title (row 1), meter+score (row 2), tag footer (row 3) */
            .sosd-playercard .cdt-name{ grid-column:1 / span 2; font-size:16px; font-weight:800; margin:0; text-align:center; grid-row:1; }
            .sosd-playercard .cdt-meter{ grid-column:1 / span 1; align-self:center; grid-row:2; }
            .sosd-playercard .cdt-val{ grid-column:2 / span 1; align-self:center; justify-self:end; padding-left:8px; font-weight:800; font-variant-numeric: tabular-nums; grid-row:2; }
            .sosd-playercard .cdt-tag{ grid-column:1 / span 2; align-self:center; justify-self:center; margin-top:6px; grid-row:3; }
            /* badges: tint only the tag; keep rest light */
            .sosd-playercard .cdt-chip.good .cdt-tag{
              background:#e8f8f2; color:#0f5132; padding:2px 8px; border-radius:999px; font-weight:800; font-size:11px;
            }
            .sosd-playercard .cdt-chip.edge .cdt-tag{
              background:#ffe9ea; color:#7f1d1d; padding:2px 8px; border-radius:999px; font-weight:800; font-size:11px;
            }
            .sosd-playercard .cdt-tag::before{ margin-right:4px; }
            .sosd-playercard .cdt-chip.good .cdt-tag::before{ content:"▲"; }
            .sosd-playercard .cdt-chip.edge .cdt-tag::before{ content:"▽"; }
            /* meters: same track; only fill color varies */
            .sosd-playercard .cdt-meter{ height: 10px; border-radius: 999px; background: #e2e8f0; position: relative; overflow: hidden; }
            .sosd-playercard .cdt-chip.good .cdt-meter::after{ content:""; position:absolute; inset:0; width: calc(var(--val,0)*1%); background: #10b981; }
            .sosd-playercard .cdt-chip.edge .cdt-meter::after{ content:""; position:absolute; inset:0; width: calc(var(--val,0)*1%); background: #ef4444; }

            /* 4) Emblem % pill positioning (keep inside ring) and soften ring */
            .sosd-playercard .pc-emblem{ position: relative; }
            .sosd-playercard .pc-emblem .pc-pct{
              position: absolute; right: 16px; top: 12px;
              padding: 6px 10px; border-radius: 999px; font-weight: 800;
              background: color-mix(in oklab, var(--pc-accent) 18%, #fff);
              border: 1px solid color-mix(in oklab, var(--pc-accent) 40%, #e6e9f2);
            }
            .sosd-playercard .pc-emblem::after{
              inset: -8px;
              background:
                conic-gradient(var(--pc-accent) calc(var(--pct,0)*1%), transparent 0),
                radial-gradient(circle at 50% 50%, transparent 66%, rgba(0,0,0,.04) 67%, transparent 68%);
              mask: radial-gradient(circle at 50% 50%, transparent 62%, #000 63%);
            }

            /* 5) Link row — extra spacing so the card can breathe */
            .sosd-playercard + .profile-links,
            .sosd-playercard ~ .profile-links{ margin-top: 10px; }

            /* Player Type section grid and labels */
            .sosd-playercard .pc-head.pc-head--center{ display:flex; align-items:center; justify-content:center; gap:8px; }
            .sosd-playercard .pc-pt-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items:start; margin: 8px 0 18px; }
            @media (max-width:560px){ .sosd-playercard .pc-pt-grid{ grid-template-columns:1fr; } }
            .sosd-playercard .pt-name{ font-weight:800; margin-top:6px; }
            .sosd-playercard .pc-mi{ margin-top: 12px; margin-bottom: 18px; padding-top: 12px; }
            .sosd-playercard .pc-caption{ font-size:13px; color:#6b7280; line-height:1.4; margin:8px 0 0; }

            /* Unified section headings and main banner */
            .sosd-playercard .pc-mainhead{
              background: #f7fafc; color:#0f172a; border:1px solid #e2e8f0; border-radius: 10px;
              padding: 10px 14px; text-align:center; font-weight:800; font-size:32px; margin-bottom:12px;
            }
            .sosd-playercard .pc-title,
            .sosd-playercard .pc-kicker{
              font-size: 18px; font-weight: 800; letter-spacing: 0; text-transform: none; color:#0f172a;
            }
            .sosd-playercard .pc-kicker{ margin: 12px 0 10px; }

            /* De-emphasize secondary player type visually */
            .sosd-playercard .pt-col.secondary .pc-emblem::after{ opacity: .75; filter: saturate(.85) brightness(1.02); }
            .sosd-playercard .pt-col.secondary .pc-emoji{ opacity:.8; filter: saturate(.85); }
            .sosd-playercard .pt-col.secondary .pc-emblem .pc-pct{
              background: color-mix(in oklab, var(--pc-accent) 10%, #fff);
              border: 1px solid color-mix(in oklab, var(--pc-accent) 25%, #e6e9f2);
              color:#334155;
            }
            .sosd-playercard .pt-col.secondary .pt-name{ color:#475569; font-weight:700; }

            /* ===== Self-Discovery Player Card refinements (scoped) ===== */
            /* Anchor % inside the emblem */
            .sosd-playercard .pc-head { grid-template-columns: 1fr auto 1fr; }
            .sosd-playercard .pc-pct{ position:absolute; right:10px; top:10px; z-index:2; }
            .sosd-playercard .pc-emblem{ position:relative; margin-top:6px; }
            .sosd-playercard .pc-emblem .pc-pct{
              position:absolute; right:12px; top:12px;
              background: color-mix(in oklab, var(--pc-accent) 16%, #fff);
              border:1px solid color-mix(in oklab, var(--pc-accent) 40%, var(--pc-line));
              color: var(--pc-text); padding:6px 10px; border-radius:999px; font-weight:800;
            }

            /* Tighten vertical rhythm */
            .sosd-playercard{ padding-top:14px; border-radius:16px; box-shadow: 0 10px 28px rgba(2,6,23,.08), 0 2px 6px rgba(2,6,23,.06); }
            .sosd-playercard .pc-title{ margin:6px 0 0; }
            .sosd-playercard .pc-emblem{ margin:6px auto 12px; width:min(260px, 70vw); }

            /* MI tile tweaks: smaller, softer dial; bolder number */
            .sosd-playercard .mi{ grid-template-columns: 42px 1fr auto; padding:10px 12px; }
            .sosd-playercard .mi-gauge{
              width:38px;
              background:
                conic-gradient(color-mix(in oklab, var(--pc-accent) 65%, #cbd5e1) calc(var(--val,0)*1%), #e5e7eb 0),
                radial-gradient(circle at 50% 50%, #fff 58%, transparent 59%);
              color:#0f172a; font-weight:800;
            }
            .sosd-playercard .mi-gauge::after{ font-size:11px; }
            .sosd-playercard .mi-label{ line-height:1.2; font-weight:700; color:#0f172a; }
            .sosd-playercard .mi-val{ font-weight:800; font-size:15px; }

            /* CDT chip contrast: clearer strongest vs edge */
            .sosd-playercard .pc-cdt-grid{ align-items:stretch; }
            .sosd-playercard .cdt-chip{ background:#f9fafb; border:1px solid #e6e9f2; }
            .sosd-playercard .cdt-chip.good .cdt-tag{
              background: #e8f8f2; color:#0f5132; padding:4px 8px; border-radius:999px; font-weight:800;
            }
            .sosd-playercard .cdt-chip.edge .cdt-tag{
              background: #ffe9ea; color:#7f1d1d; padding:4px 8px; border-radius:999px; font-weight:800;
            }
            .sosd-playercard .cdt-tag::before{ margin-right:4px; }
            .sosd-playercard .cdt-chip.good .cdt-tag::before{ content:"▲"; }
            .sosd-playercard .cdt-chip.edge .cdt-tag::before{ content:"▽"; }
            .sosd-playercard .cdt-meter{ height:8px; background:#eceff3; border-radius:999px; overflow:hidden; position:relative; }
            .sosd-playercard .cdt-chip.good .cdt-meter::after{ content:""; position:absolute; inset:0; width:calc(var(--val,0)*1%); background:#28c596; }
            .sosd-playercard .cdt-chip.edge .cdt-meter::after{ content:""; position:absolute; inset:0; width:calc(var(--val,0)*1%); background:#ff7a7a; }

            /* Ring thickness + softness */
            .sosd-playercard .pc-emblem::after{
              inset:-8px;
              background:
                conic-gradient(var(--pc-accent) calc(var(--pct,0)*1%), transparent 0),
                radial-gradient(circle at 50% 50%, transparent 66%, rgba(0,0,0,.04) 67%, transparent 68%);
              mask: radial-gradient(circle at 50% 50%, transparent 62%, #000 63%);
            }
            .quiz-dashboard-container { max-width: 900px; margin: 2em auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
            .dashboard-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5em; margin-bottom: 1.5em; border-bottom: 1px solid #e2e8f0; }
            .site-branding {
                display: flex;
                align-items: center;
                gap: 20px;
                text-decoration: none;
            }
            .site-logo { max-height: 100px; width: auto; height: auto; max-width: 100%; }
            .site-title { font-size: 1.8em; font-weight: 600; color: #1a202c; line-height: 1.2; }
            .quiz-dashboard-hero { display: flex; align-items: stretch; gap: 24px; margin-bottom: 2em; }
            .quiz-dashboard-hero-greeting { flex-grow: 1; }
            .greeting-title { font-size: 1.8em; font-weight: 600; color: #1a202c; margin: 0 0 0.25em 0; }
            .greeting-subtitle { font-size: 1em; color: #4a5568; margin: 0; }
            .quiz-dashboard-hero-progress-card { flex-basis: 320px; flex-shrink: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }
            .progress-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
            .progress-card-title { font-size: 1em; font-weight: 600; margin: 0; color: #2d3748; }
            .progress-card-percent { font-size: 0.9em; font-weight: 600; color: #4a5568; }
            .progress-bar-container { width: 100%; background: #e2e8f0; border-radius: 99px; height: 8px; overflow: hidden; margin-bottom: 20px; }
            .progress-bar-fill { background: #4CAF50; height: 100%; transition: width 0.5s ease-in-out; }
            .progress-card-next-step-btn { margin-top: auto; }
 
            .quiz-dashboard-section-title { margin-top: 2.5em; margin-bottom: 1em; font-size: 1.5em; font-weight: 600; color: #1a202c; padding-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; }

            /* Tabs + Composite card styles */
            .dashboard-tabs{ position: sticky; top: 0; z-index: 5; background: #fff; display:flex; gap:8px; flex-wrap:wrap; border-bottom:1px solid #e2e8f0; padding: 8px 0; margin-bottom: 1em; }
            .tab-link{ background: #f8fafc; color: #51607a; border:1px solid transparent; border-radius: 8px; padding:8px 14px; font-weight:600; font-size: 15px; line-height: 1.2; cursor:pointer; user-select:none; transition: all .2s ease; }
            .tab-link.active{ color:#fff; background:#1e40af; }
            .tab-content{ display:none; }
            .tab-content.active{ display:block; }

            .identity-card { padding: clamp(12px, 1.6vw, 20px); }
            .identity-card .card-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 8px; }
            .identity-card .card-header h2{ font-size: clamp(18px, 2vw, 22px); margin:0; }
            .block{ padding: 14px 0; border-top: 1px solid #e2e8f0; }
            .block:first-of-type{ border-top: 0; }
            .block-title{ font-size: 14px; letter-spacing:.02em; text-transform:uppercase; color: #51607a; margin:0 0 10px; }
            .badges{ display:flex; flex-wrap:wrap; gap:6px; }
            .badge{ display:inline-flex; align-items:center; gap:6px; background: #edf1fb; color: #1b2437; border:1px solid #e6e9f2; padding: 5px 9px; border-radius: 999px; font-weight:600; }
            .badge::before{ content:""; width:8px; height:8px; border-radius:50%; background: #7aa2ff; }
            .bars{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
            .bar{ display:grid; grid-template-columns: 1fr auto; grid-template-rows: auto 6px; gap: 6px 10px; align-items:center; }
            .bar .label{ grid-column:1 / span 1; font-weight:600; color: #111826; }
            .bar .value{ grid-column:2 / span 1; color: #51607a; font-variant-numeric: tabular-nums; }
            .bar .meter{ grid-column:1 / span 2; height:6px; background: #f1f3f4; border:1px solid #e6e9f2; border-radius:999px; position:relative; overflow:hidden; }
            .bar .fill{ --clr: #ffcc66; position:absolute; inset:0 auto 0 0; width: calc(var(--val,0) * 1%); border-radius:999px; background: var(--clr); }
            .bar[data-band="lower"] .fill{ --clr: #ff7a7a; }
            .bar[data-band="moderate"] .fill{ --clr: #ffcc66; }
            .bar[data-band="higher"] .fill{ --clr: #33d69f; }
            .player-card{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; align-items:center; }
            .player-card .primary, .player-card .secondary{ display:flex; align-items:center; justify-content:space-between; background: #f7f8fb; border:1px solid #e6e9f2; border-radius: 12px; padding:10px 12px; }
            .player-card .secondary{ background: transparent; }
            .pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; border:1px solid #e6e9f2; background: #edf1fb; font-weight:700; color: #1b2437; }
            .pill-primary{ border-color: #a3bffa; background: #dbeafe; }
            .pct{ font-weight:800; letter-spacing:.02em; color: #111826; }
            .pct.subtle{ color: #51607a; }
            .microcopy{ font-size: 13px; color: #51607a; margin: 8px 0 0; }
            .profile-grid { display:grid; grid-template-columns: 1fr; gap: clamp(16px, 3vw, 32px); background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
            .chart-panel { min-height: 420px; background:#fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.04); display:flex; align-items:center; justify-content:center; }
            /* In-card radar spacing and centering */
            .sosd-playercard .pc-spider{ margin: 24px 0 10px; padding-top: 16px; position: relative; }
            .sosd-playercard .pc-spider::before{ content:""; position:absolute; left:0; right:0; top:0; height:1px; background: rgba(15,23,42,.06); }
            .sosd-playercard .pc-spider-head{ text-align:center; margin: 0; }
            .sosd-playercard .pc-spider-title{ margin: 0 0 6px; }
            .sosd-playercard .pc-spider-canvas{ max-width: 720px; width:100%; height:360px; margin: 10px auto 0; display:flex; align-items:center; justify-content:center; }
            .sosd-playercard .pc-spider-desc{ margin: 12px auto 0; max-width: 60ch; text-align:center; }
            #compositeRadar { width: 100% !important; height: 100% !important; display:block; }
            .composite-head { margin: 0 0 12px 0; }
            .composite-title { margin: 0 0 4px 0; font-size: 1.35em; font-weight: 700; color:#111826; }
            .composite-subtitle { margin: 0; font-size: .95em; color:#51607a; }
            .composite-cta { margin-top: 12px; color:#51607a; font-size: .95em; }
            /* === AI Coach tab styles === */
            .ai-alert{ background:#fff7ed; border:1px solid #fed7aa; color:#7c2d12; padding:10px 12px; border-radius:8px; margin-bottom:12px; }
            .ai-filters{ background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:16px; box-shadow: 0 6px 14px rgba(15,23,42,.06); }
            .ai-banner{ background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a; padding:10px 12px; border-radius:8px; margin-bottom:12px; }
            .ai-section-sub{ margin:4px 0 10px; color:#475569; font-size:13px; }
            .ai-debug{ background:#fff7ed; border:1px solid #fed7aa; color:#7c2d12; padding:10px 12px; border-radius:8px; margin:12px 0; }
            .ai-debug summary{ cursor:pointer; font-weight:600; }
            .ai-debug pre{ white-space:pre-wrap; overflow:auto; max-height:260px; background:#fff; border:1px solid #eee; padding:8px; border-radius:6px; }
            .ai-fheader{ display:flex; gap:10px; align-items:flex-start; margin-bottom:6px; }
            .ai-title{ margin:0 0 2px; font-size:1.1em; font-weight:800; }
            .ai-sub{ margin:0 0 10px; color:#64748b; }
            .ai-filter{ padding:10px 0; border-top:1px solid #e8eef5; }
            .ai-filter:first-of-type{ border-top:0; }
            .ai-filter-row{ display:grid; grid-template-columns: 24px 1fr auto; align-items:center; gap:8px; }
            .f-icn{ font-size:18px; }
            .f-title{ font-weight:700; color:#0f172a; }
            .f-right{ font-size:12px; color:#64748b; }
            .f-sub{ color:#64748b; font-size:12px; margin:2px 0 6px; }
            .ai-filter input[type=range]{ width:100%; accent-color:#1e40af; }
            .ai-lenses{ display:flex; gap:16px; flex-wrap:wrap; margin-top:12px; }
            .ai-actions{ display:flex; gap:12px; align-items:center; margin-top:12px; }
            .ai-actions .linklike{ background:none; border:none; color:#1e40af; cursor:pointer; padding:0; }
            .ai-section{ margin: 12px 0 8px; font-weight:700; }
            .ai-results-grid{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px; }
            @media (max-width: 768px){ .ai-results-grid{ grid-template-columns: 1fr; } .ai-sliders{ grid-template-columns: 1fr 1fr; } }
            .ai-card{ position:relative; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; min-height:120px; box-shadow:0 2px 6px rgba(0,0,0,0.04); }
            /* Show the arrow only once real ideas render (not on skeletons) */
            .ai-card:not(.skeleton)::after{ content:'\2197'; /* ↗ */ position:absolute; right:10px; bottom:8px; font-size:18px; color:#334155; opacity:0.9; transition: color .15s ease, transform .15s ease; }
            .ai-card:hover:not(.skeleton)::after{ color:#111827; transform: translateY(-2px); }
            .ai-card.skeleton{ background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
            @keyframes shimmer { 0% { background-position: -400px 0;} 100%{ background-position: 400px 0; } }

            /* Drawer styles */
            .ai-drawer{ position: fixed; inset: 0; z-index: 1000; display:none; }
            .ai-drawer.open{ display:block; }
            .ai-drawer-backdrop{ position: absolute; inset: 0; background: rgba(15,23,42,0.35); }
            /* Centered modal instead of side drawer */
            .ai-drawer-panel{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:min(720px, 92vw); max-height:86vh; overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 12px 28px rgba(0,0,0,0.18); padding: 18px 18px 24px; }
            .ai-drawer-close{ position: absolute; top: 8px; right: 10px; border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
            .ai-drawer-title{ margin:0 0 4px; }
            .ai-drawer-lens{ display:inline-block; background:#eef2f7; border-radius:999px; padding:2px 10px; font-size:12px; color:#334155; }
            .ai-drawer-micro{ color:#475569; }
            .ai-drawer-section{ margin-top: 12px; }
            .ai-drawer-section h4{ margin:0 0 6px; font-size: 0.95em; }
            .ai-drawer-steps{ padding-left: 16px; }
            .ai-drawer-reflect{ padding-left: 16px; }
            .ai-drawer-prompt{ background:#eef2ff; border:1px solid #c7d2fe; color:#1e3a8a; padding:8px 10px; border-radius:8px; }
            .ai-drawer-footer{ margin-top: 12px; }
            .ai-drawer-chips .chip{ margin-right:6px; background:#eef2f7; border-radius:999px; padding:2px 8px; font-size:12px; display:inline-block; }
            .bars-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .badge-icn { margin-right: 6px; }
            .mi-badges { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
            .mi-badges .badge { width: 100%; justify-content: center; }
            .inline-link { color:#1e40af; text-decoration:none; }
            .inline-link:hover { text-decoration:underline; }
            .ring { --val: 0; --size: 44px; --track: #e5e7eb; --fill: #1e40af; width: var(--size); height: var(--size); display:inline-grid; place-items:center; border-radius: 50%; background: conic-gradient(var(--fill) calc(var(--val) * 1%), var(--track) 0); position: relative; }
            .ring::before { content:""; position:absolute; inset: 4px; background: #fff; border-radius: 50%; }
            .ring .ring-label { position: relative; font-size: 0.8em; font-weight: 700; color: #111826; }
            .ring-subtle { --fill: #64748b; }

            /* MI tiles: badge-style vertical layout (Emoji → Label → Gauge) */
            .sosd-playercard .pc-mi-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
            @media (max-width: 560px){ .sosd-playercard .pc-mi-grid{ grid-template-columns: 1fr; } }
            .sosd-playercard .pc-mi-grid .mi{
                display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
                padding: 18px 14px; border:1px solid #e6e9f2; border-radius: 16px; background:#fff;
                box-shadow: 0 6px 14px rgba(15,23,42,.06);
                transition: transform .15s ease, box-shadow .15s ease; cursor: default;
            }
            .sosd-playercard .pc-mi-grid .mi:hover{ transform: translateY(-2px); box-shadow: 0 12px 24px rgba(15,23,42,.10); }
            .sosd-playercard .pc-mi-grid .mi-icon{ order:1; font-size: 72px; line-height:1; margin: 0 0 6px; }
            .sosd-playercard .pc-mi-grid .mi-label{ order:2; font-weight:800; text-align:center; margin:0 0 6px; line-height:1.25; min-height:2.6em; display:flex; align-items:center; justify-content:center; }
            .sosd-playercard .pc-mi-grid .mi-gauge{
                order:3; width:60px; aspect-ratio:1; border-radius:50%; display:grid; place-items:center; font-weight:900; color:#0a1325;
                /* Lighter ring + larger white core for maximum contrast */
                background:
                    conic-gradient(color-mix(in oklab, var(--mi-accent, #1e40af) 42%, #e7ecf3) calc(var(--val,0)*1%), #f2f5f9 0),
                    radial-gradient(circle at 50% 50%, #ffffff 64%, transparent 65%);
                border:1px solid #d6dbe3; position:relative; overflow:hidden;
            }
            /* Extra white core to ensure legibility over the ring in all themes */
            .sosd-playercard .pc-mi-grid .mi-gauge::before{
                content:""; position:absolute; inset:18%; background:#fff; border-radius:50%; z-index:0;
            }
            .sosd-playercard .pc-mi-grid .mi-gauge::after{
                content: attr(data-val);
                font-size: clamp(14px, 2.6vw, 18px);
                font-weight: 900;
                z-index:1;
                /* Soft outline using multiple shadows to pop on any color */
                text-shadow:
                    0 1px 0 #fff,
                    0 -1px 0 #fff,
                    1px 0 0 #fff,
                    -1px 0 0 #fff,
                    0 0 2px rgba(255,255,255,0.7);
            }
            .sosd-playercard .pc-mi-grid .mi-val{ display:none; }
            /* Per-intelligence accents (optional) */
            .sosd-playercard .pc-mi-grid .mi--interpersonal{ --mi-accent:#3b82f6; }
            .sosd-playercard .pc-mi-grid .mi--intrapersonal{ --mi-accent:#8b5cf6; }
            .sosd-playercard .pc-mi-grid .mi--bodily-kinesthetic{ --mi-accent:#22c55e; }
            .sosd-playercard .pc-mi-grid .mi--linguistic{ --mi-accent:#0ea5e9; }
            .sosd-playercard .pc-mi-grid .mi--logical-mathematical{ --mi-accent:#f59e0b; }
            .sosd-playercard .pc-mi-grid .mi--spatial{ --mi-accent:#06b6d4; }
            .sosd-playercard .pc-mi-grid .mi--musical{ --mi-accent:#e11d48; }
            .sosd-playercard .pc-mi-grid .mi--naturalistic{ --mi-accent:#10b981; }
            @media (max-width: 768px) {
                .profile-grid { grid-template-columns: 1fr; }
                .chart-panel { min-height: 360px; }
            }

            .quiz-dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 2.5em; }
            .quiz-dashboard-list { 
                list-style: none; 
                padding: 0; 
                margin: 1em 0; 
            }
            .quiz-dashboard-item { 
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
                display: flex;
                flex-direction: column;
                transition: all 0.2s ease-in-out;
            }
            .quiz-dashboard-item:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07), 0 4px 6px -4px rgba(0,0,0,0.07); }
            .quiz-dashboard-item.is-locked { opacity: 0.6; background: #f8fafc; pointer-events: none; }
            .quiz-dashboard-item.is-locked .quiz-dashboard-actions .quiz-dashboard-button { pointer-events: auto; } /* Allow tooltip on button */
 
            .quiz-dashboard-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            .quiz-dashboard-item-body { border-top: 1px solid #e2e8f0; padding-top: 12px; flex-grow: 1; }
            .quiz-dashboard-actions { margin-top: 16px; }
 
            .quiz-dashboard-title { 
                font-size: 1.1em; 
                font-weight: 600;
                margin: 0;
                color: #1a202c;
            }
            .quiz-dashboard-status-badge { font-size: 0.75em; font-weight: 600; padding: 4px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
            .quiz-dashboard-status-badge.completed { background-color: #e6f4ea; color: #34a853; }
            .quiz-dashboard-status-badge.locked { background-color: #f1f3f4; color: #5f6368; }
            .quiz-dashboard-status-badge.not-started { background-color: #eef2ff; color: #4f46e5; }
 
            .quiz-dashboard-description { font-size: 0.9em; color: #4a5568; line-height: 1.5; margin: 0; }
 
            .quiz-dashboard-button { text-decoration: none; background: #1e40af; color: #fff; padding: 8px 16px; border-radius: 9999px; font-weight: 600; font-size: 0.9em; transition: all 0.2s; white-space: nowrap; display: inline-block; border: 1px solid transparent; }
            .quiz-dashboard-button:hover { background: #1c358a; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
            .quiz-dashboard-button.is-disabled { background: #e2e8f0; color: #a0aec0; cursor: not-allowed; }
            .quiz-dashboard-button.is-disabled:hover { background: #e2e8f0; transform: none; box-shadow: none; }
            .quiz-dashboard-button.quiz-dashboard-button-secondary {
                background: #f1f3f4;
                color: #2d3748;
                border: 1px solid #e2e8f0;
            }
            .quiz-dashboard-button.quiz-dashboard-button-secondary:hover {
                background: #e2e8f0;
                color: #1a202c;
                transform: none;
                box-shadow: none;
            }
            .quiz-dashboard-insight-panel { background-color: #f7fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-top: 12px; }
            .quiz-dashboard-insight-panel .insight-panel-title { font-weight: 600; margin: 0 0 8px 0; font-size: 0.9em; color: #2d3748; }
            .quiz-dashboard-insight-panel p { font-size: 0.9em; color: #4a5568; line-height: 1.6; max-width: 70ch; margin: 0; }
            .insight-panel-prediction { border-left: 4px solid #1e40af; }
            .insight-panel-profile { border-left: 4px solid #4CAF50; }
            .quiz-dashboard-chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { background-color: #e2e8f0; color: #2d3748; padding: 4px 12px; border-radius: 16px; font-size: 0.85em; font-weight: 500; }
 
            .quiz-dashboard-lower-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
            .panel-title { font-size: 1.1em; font-weight: 600; margin: 0 0 1em 0; color: #1a202c; }
            .insight-panel, .activity-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); transition: all 0.2s ease-in-out; }
            .insight-leverage-tip { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px dashed #e2e8f0; }
            .insight-growth-tip { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px dashed #f59e0b; }
            .placeholder-text { color: #64748b; font-style: italic; }
            .activity-list { list-style: none; padding: 0; margin: 0; }
            .activity-list li { padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-size: 0.9em; color: #4a5568; }
            .activity-list li:last-child { border-bottom: none; }
            .activity-date { font-weight: 500; color: #2d3748; margin-right: 8px; }
 
            .quiz-dashboard-resources { display: flex; gap: 24px; justify-content: center; margin-top: 2.5em; padding-top: 1.5em; border-top: 1px solid #e2e8f0; }
            .resource-link { color: #4a5568; text-decoration: none; font-size: 0.9em; display: flex; align-items: center; gap: 6px; }
            .resource-link:hover { color: #1a202c; }
 
            @media (max-width: 768px) {
                .quiz-dashboard-hero { flex-direction: column; }
                .quiz-dashboard-grid { grid-template-columns: 1fr; }
                .quiz-dashboard-lower-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 600px) {
                .dashboard-header {
                    justify-content: center;
                }
                .site-branding {
                    flex-direction: column;
                    gap: 10px;
                }
            }
        </style>
        <script>
        document.addEventListener('DOMContentLoaded', function(){
            const tabContainer = document.querySelector('.dashboard-tabs');
            if (!tabContainer) return;
            const tabLinks = tabContainer.querySelectorAll('.tab-link');
            const tabContents = document.querySelectorAll('.tab-content-wrapper .tab-content');
            tabLinks.forEach(link => {
                link.addEventListener('click', function(e){
                    e.preventDefault();
                    const tabId = this.dataset.tab;
                    tabLinks.forEach(l => l.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    const activeContent = document.getElementById(tabId);
                    if (activeContent) activeContent.classList.add('active');
                });
            });

            // AI Coach handlers
            const ajaxUrl = '<?php echo esc_url_raw(admin_url('admin-ajax.php')); ?>';
            // Dynamic labels for filters
            const labelMaps = {
                cost: ['Free','Low','Medium','Higher','High'],
                time: ['15–30m','1–2h','Half‑day','Full day','Multi‑week'],
                energy: ['Low‑focus','Moderate','Focused','High‑effort','Very high'],
                variety: ['Near routine','Somewhat new','New context','Very new','Totally different']
            };
            function bindSlider(id, labelId, map){
                const s=document.getElementById(id), l=document.getElementById(labelId);
                if (!s||!l) return; const upd=()=>{ const v=parseInt(s.value||0,10); l.textContent = map[Math.max(0,Math.min(4,v))]||'';};
                s.addEventListener('input',upd); upd();
            }
            bindSlider('ai-cost','ai-cost-label', labelMaps.cost);
            bindSlider('ai-time','ai-time-label', labelMaps.time);
            bindSlider('ai-energy','ai-energy-label', labelMaps.energy);
            bindSlider('ai-variety','ai-variety-label', labelMaps.variety);
            const applyBtn = document.getElementById('ai-apply');
            const resetBtn = document.getElementById('ai-reset');
            const shortlistEl = document.getElementById('ai-shortlist');
            const moreWrap = document.getElementById('ai-more-wrap');
            const moreEl = document.getElementById('ai-more');

            function renderSkeleton(el, n=6){ if (!el) return; el.innerHTML=''; for (let i=0;i<n;i++){ const d=document.createElement('div'); d.className='ai-card skeleton'; el.appendChild(d);} }
            function chip(label, val){ const s=document.createElement('span'); s.className='chip'; s.textContent=label+': '+val; s.style.marginRight='6px'; s.style.fontSize='12px'; s.style.background='#eef2f7'; s.style.borderRadius='999px'; s.style.padding='2px 8px'; return s; }
            let aiDefaults = { cost:0, time:1, energy:1, variety:2 };
            function toInt01(v, def){ const n = Number(v); const ok = Number.isFinite(n); const clamped = Math.max(0, Math.min(4, ok?n:def)); return clamped; }
            function renderIdeas(el, ideas){
                if (!el) return; el.innerHTML='';
                const drawer = document.getElementById('ai-drawer');
                const closeBtn = document.getElementById('ai-drawer-close');
                const backdrop = document.getElementById('ai-drawer-backdrop');
                const set = (id, v)=>{ const n=document.getElementById(id); if (n) n.textContent = v || ''; };
                const setList = (id, arr)=>{ const n=document.getElementById(id); if (!n) return; n.innerHTML=''; (arr||[]).forEach(x=>{ const li=document.createElement('li'); li.textContent = x; n.appendChild(li); }); };
                const setChips = (id, tags)=>{ const n=document.getElementById(id); if (!n) return; n.innerHTML=''; (tags||[]).forEach(t=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=t; n.appendChild(s); }); };
                function openDrawer(item){ if (!drawer) return; drawer.classList.add('open');
                    set('ai-drawer-title', item.title||'Idea');
                    set('ai-drawer-lens', item.lens||'');
                    set('ai-drawer-micro', item.micro_description||'');
                    set('ai-drawer-why', item.why_this_fits_you||'');
                    set('ai-drawer-prompt', item.prompt_to_start||'');
                    setList('ai-drawer-steps', item.steps||[]);
                    set('ai-drawer-signal', item.signal_to_watch_for||'');
                    setList('ai-drawer-reflect', item.reflection_questions||[]);
                    const safetyWrap = document.getElementById('ai-drawer-safety-wrap');
                    if (safetyWrap) safetyWrap.style.display = item.safety_notes ? 'block' : 'none';
                    set('ai-drawer-safety', item.safety_notes||'');
                    setChips('ai-drawer-chips', item.tags||[]);
                }
                function closeDrawer(){ if (drawer) drawer.classList.remove('open'); }
                if (closeBtn) closeBtn.onclick = closeDrawer; if (backdrop) backdrop.onclick = closeDrawer; window.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeDrawer(); });

                ideas.forEach(item=>{
                    const c=document.createElement('div'); c.className='ai-card';
                    c.tabIndex=0; c.style.cursor='pointer';
                    const h=document.createElement('h5'); h.textContent=item.title||'Idea'; h.style.margin='0 0 6px';
                    const b=document.createElement('div'); b.style.margin='0 0 8px';
                    const lensTxt = item.lens ? ('• '+item.lens+' • ') : ''; b.textContent = lensTxt + (item.micro_description||'');
                    const chips=document.createElement('div');
                    const ec = toInt01(item.estimated_cost, aiDefaults.cost); const et = toInt01(item.estimated_time, aiDefaults.time);
                    const ee = toInt01(item.estimated_energy, aiDefaults.energy); const ev = toInt01(item.estimated_variety, aiDefaults.variety);
                    chips.appendChild(chip('C', ec)); chips.appendChild(chip('T', et)); chips.appendChild(chip('E', ee)); chips.appendChild(chip('V', ev));
                    c.appendChild(h); c.appendChild(b); c.appendChild(chips);
                    c.addEventListener('click', ()=> openDrawer(item));
                    c.addEventListener('keypress', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); openDrawer(item);} });
                    el.appendChild(c);
                });
            }

            if (applyBtn){
                applyBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    renderSkeleton(shortlistEl, 6);
                    if (moreWrap) { moreWrap.style.display='none'; }
                    applyBtn.disabled = true; applyBtn.textContent = 'Generating…';
                    aiDefaults = {
                        cost: parseInt(document.getElementById('ai-cost')?.value||0,10),
                        time: parseInt(document.getElementById('ai-time')?.value||1,10),
                        energy: parseInt(document.getElementById('ai-energy')?.value||1,10),
                        variety: parseInt(document.getElementById('ai-variety')?.value||2,10),
                    };
                    const body = new URLSearchParams({
                        action: 'mc_ai_generate_mves',
                        cost: aiDefaults.cost,
                        time: aiDefaults.time,
                        energy: aiDefaults.energy,
                        variety: aiDefaults.variety,
                        quantity: 12,
                        lens_curiosity: document.getElementById('lens-curiosity')?.checked?1:0,
                        lens_rolemodels: document.getElementById('lens-rolemodels')?.checked?1:0,
                        lens_opposites: document.getElementById('lens-opposites')?.checked?1:0,
                        lens_adjacency: document.getElementById('lens-adjacency')?.checked?1:0,
                    });
                    // Optional admin-only model override
                    const modelSel = document.getElementById('ai-model');
                    if (modelSel && modelSel.value) body.append('model', modelSel.value);
                    fetch(ajaxUrl, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body })
                        .then(r=>r.json())
                        .then(j=>{
                            const banner = document.getElementById('ai-banner');
                            if (j && j.success && j.data){
                                renderIdeas(shortlistEl, j.data.shortlist||[]);
                                const more = j.data.more||[];
                                if (Array.isArray(more) && more.length){ if (moreWrap) moreWrap.style.display='block'; renderIdeas(moreEl, more); } else { if (moreWrap) moreWrap.style.display='none'; if (moreEl) moreEl.innerHTML=''; }
                                if (banner) {
                                    if (j.data.used_fallback) {
                                        banner.style.display='block';
                                        const reason = j.data.fallback_reason || 'unknown';
                                        banner.textContent = 'Using placeholders — ' + reason.replace(/_/g,' ');
                                    } else { banner.style.display='none'; banner.textContent=''; }
                                }
                                // Debug render (admins only)
                                const dbgEl = document.getElementById('ai-debug');
                                if (dbgEl) {
                                    if (j.data.debug) {
                                        const d = j.data.debug;
                                        const pt = d?.response?.usage?.prompt_tokens ?? '';
                                        const ct = d?.response?.usage?.completion_tokens ?? '';
                                        const usd = d?.response?.cost_estimate_usd ?? '';
                                        const mdl = d?.model ?? '';
                                        function esc(s){ return String(s||'').replace(/[&<]/g, c=> c==='&'?'&amp;':'&lt;'); }
                                        let html = `<div><strong>Debug:</strong> ${esc(mdl)} · prompt ${esc(pt)} · completion ${esc(ct)} · $${esc(usd)}</div>`;
                                        html += '<details style="margin-top:6px;"><summary>View request & response</summary>'+
                                                `<div><h4 style=\"margin:8px 0 4px\">System</h4><pre>${esc(d?.request?.system)}</pre>`+
                                                `<h4 style=\"margin:8px 0 4px\">User</h4><pre>${esc(d?.request?.user)}</pre>`+
                                                `<h4 style=\"margin:8px 0 4px\">Response snippet</h4><pre>${esc(d?.response?.raw_snippet)}</pre></div>`+
                                                '</details>';
                                        dbgEl.innerHTML = html; dbgEl.style.display='block';
                                    } else { dbgEl.style.display='none'; dbgEl.innerHTML=''; }
                                }
                            }
                            else {
                                if (shortlistEl) shortlistEl.innerHTML = '<div class="ai-card">We could not generate ideas just now.</div>';
                                if (moreEl) moreEl.innerHTML = '';
                                if (moreWrap) moreWrap.style.display='none';
                                if (banner) { banner.style.display='block'; banner.textContent='Request failed — please try again.'; }
                            }
                        })
                        .catch(()=>{ shortlistEl.innerHTML = '<div class="ai-card">Network error. Please try again.</div>'; if (moreEl) moreEl.innerHTML=''; if (moreWrap) moreWrap.style.display='none'; })
                        .finally(()=>{ applyBtn.disabled = false; applyBtn.textContent = 'Show experiments that fit my settings'; });
                });
            }

            if (resetBtn){
                resetBtn.addEventListener('click', function(){
                    const set = (id,val)=>{ const el=document.getElementById(id); if (el) el.value=val; };
                    set('ai-cost',0); set('ai-time',1); set('ai-energy',1); set('ai-variety',2);
                    ['lens-curiosity','lens-rolemodels','lens-opposites','lens-adjacency'].forEach(id=>{ const el=document.getElementById(id); if (el) el.checked=true; });
                });
            }
        });
        </script>
        <?php
        return ob_get_clean();
    }

    /**
     * Finds the permalink of the first page that contains a given shortcode.
     * Results are cached in a transient to improve performance.
     */
    private function find_page_by_shortcode($shortcode_tag) {
        if (empty($shortcode_tag)) return null;
        $transient_key = 'page_url_for_' . $shortcode_tag;
        if (false !== ($cached_url = get_transient($transient_key))) return $cached_url;

        $query = new WP_Query(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'posts_per_page' => -1, 's' => '[' . $shortcode_tag]);
        $url = null;
        if ($query->have_posts()) {
            foreach ($query->posts as $p) { if (has_shortcode($p->post_content, $shortcode_tag)) { $url = get_permalink($p->ID); break; } }
        }
        set_transient($transient_key, $url, DAY_IN_SECONDS); // Cache for 1 day.
        return $url;
    }

    /**
     * Clears page URL transients when a post is saved to keep the dashboard links fresh.
     */
    public function clear_shortcode_page_transients() {
        $quizzes = self::get_quizzes();
        foreach ($quizzes as $quiz) {
            if (!empty($quiz['shortcode'])) delete_transient('page_url_for_' . $quiz['shortcode']);
        }
    }

}
