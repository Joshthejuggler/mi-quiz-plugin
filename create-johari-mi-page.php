<?php
/**
 * Script to create a Johari × MI Quiz page
 * 
 * INSTRUCTIONS:
 * 1. Make sure your Local WP site is running
 * 2. Visit this file in your browser: http://mi-test-site.local/wp-content/plugins/mi-quiz-plugin-restore/create-johari-mi-page.php
 * 3. Or run via WP-CLI: wp eval-file create-johari-mi-page.php
 */

// Load WordPress
if (!defined('ABSPATH')) {
    $wp_load_paths = [
        __DIR__ . '/../../../wp-load.php',
        __DIR__ . '/../../wp-load.php',
        __DIR__ . '/../wp-load.php',
        __DIR__ . '/wp-load.php'
    ];
    
    $loaded = false;
    foreach ($wp_load_paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            $loaded = true;
            break;
        }
    }
    
    if (!$loaded) {
        die('Could not load WordPress. Please ensure your Local WP site is running.');
    }
}

// Check if user can create pages (admin access required)
if (!current_user_can('edit_pages')) {
    die('You need administrator privileges to create pages. Please log in to WordPress admin first.');
}

echo "<h1>Creating Johari × MI Quiz Page</h1>\n";

// Check if page already exists
$existing = get_posts([
    'post_type' => 'page',
    'post_status' => 'publish',
    'meta_key' => '_contains_johari_mi_quiz',
    'meta_value' => '1',
    'numberposts' => 1
]);

if ($existing) {
    echo "<p>✅ Johari × MI Quiz page already exists: <a href='" . get_permalink($existing[0]->ID) . "'>" . $existing[0]->post_title . "</a></p>\n";
    exit;
}

// Create the page
$page_data = [
    'post_title'    => 'Johari × MI Assessment',
    'post_content'  => '[johari_mi_quiz]

<h2>About This Assessment</h2>
<p>The Johari × MI assessment combines the powerful insights of the Johari Window with Multiple Intelligence theory to provide a comprehensive peer-feedback experience.</p>

<h3>How It Works</h3>
<ol>
<li><strong>Self-Assessment:</strong> Select 6-10 adjectives that best describe you from our MI-based categories</li>
<li><strong>Peer Feedback:</strong> Share your unique link with 2-5 trusted friends, family, or colleagues</li>
<li><strong>Results:</strong> Discover your Johari Window with adjectives organized into four quadrants:
    <ul>
    <li><strong>Open:</strong> Strengths known to both you and others</li>
    <li><strong>Blind:</strong> Blind spots others see but you don\'t</li>
    <li><strong>Hidden:</strong> Private strengths you know but others don\'t</li>
    <li><strong>Unknown:</strong> Unexplored potential unknown to both</li>
    </ul>
</li>
</ol>

<h3>Multiple Intelligence Domains</h3>
<p>All adjectives are mapped to Howard Gardner\'s 8 Multiple Intelligence domains:</p>
<ul>
<li><strong>Linguistic:</strong> Word-smart</li>
<li><strong>Logical-Mathematical:</strong> Number-smart</li>
<li><strong>Spatial-Visual:</strong> Picture-smart</li>
<li><strong>Bodily-Kinesthetic:</strong> Body-smart</li>
<li><strong>Musical:</strong> Music-smart</li>
<li><strong>Interpersonal:</strong> People-smart</li>
<li><strong>Intrapersonal:</strong> Self-smart</li>
<li><strong>Naturalistic:</strong> Nature-smart</li>
</ul>',
    'post_status'   => 'publish',
    'post_type'     => 'page',
    'post_author'   => get_current_user_id(),
    'comment_status' => 'closed',
    'ping_status'   => 'closed'
];

$page_id = wp_insert_post($page_data);

if (is_wp_error($page_id)) {
    echo "<p>❌ Error creating page: " . $page_id->get_error_message() . "</p>\n";
    exit;
}

// Add meta to help with caching
update_post_meta($page_id, '_contains_johari_mi_quiz', '1');
update_post_meta($page_id, '_mc_contains_shortcode_johari_mi_quiz', 1);

$page_url = get_permalink($page_id);

echo "<p>✅ <strong>Success!</strong> Johari × MI Quiz page created successfully!</p>\n";
echo "<p>📝 <strong>Page ID:</strong> $page_id</p>\n";
echo "<p>🔗 <strong>Page URL:</strong> <a href='$page_url' target='_blank'>$page_url</a></p>\n";
echo "<p>📋 <strong>Page Title:</strong> " . get_the_title($page_id) . "</p>\n";

// Clear any cached URLs for this shortcode
if (class_exists('MC_Helpers')) {
    MC_Helpers::clear_shortcode_page_cache('johari_mi_quiz');
    echo "<p>🧹 Cleared shortcode cache</p>\n";
}

echo "<hr>\n";
echo "<h2>Next Steps</h2>\n";
echo "<ol>\n";
echo "<li>Visit your quiz dashboard to see the new quiz available</li>\n";
echo "<li>Or visit the quiz page directly: <a href='$page_url' target='_blank'>$page_url</a></li>\n";
echo "<li>You can customize the page content by editing it in WordPress admin if needed</li>\n";
echo "</ol>\n";

echo "<p><strong>Note:</strong> The quiz requires at least 2 peer responses before results are available, so you'll want to share the peer link with trusted contacts.</p>\n";

?>

<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
h1, h2, h3 { color: #333; }
p { margin: 15px 0; }
ul, ol { margin: 15px 0 15px 30px; }
a { color: #0073aa; text-decoration: none; }
a:hover { text-decoration: underline; }
hr { margin: 30px 0; border: none; border-top: 2px solid #eee; }
</style>