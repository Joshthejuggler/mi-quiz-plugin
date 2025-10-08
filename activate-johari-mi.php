<?php
/**
 * Script to activate Johari × MI Quiz module and create database tables
 * 
 * INSTRUCTIONS:
 * 1. Make sure your Local WP site is running
 * 2. Visit this file in your browser: http://mi-test-site.local/wp-content/plugins/mi-quiz-plugin-restore/activate-johari-mi.php
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

// Check admin privileges
if (!current_user_can('manage_options')) {
    die('You need administrator privileges to activate modules. Please log in to WordPress admin first.');
}

echo "<h1>Activating Johari × MI Quiz Module</h1>\n";

// Load the module
require_once __DIR__ . '/quizzes/johari-mi-quiz/module.php';

if (!class_exists('Johari_MI_Quiz_Module')) {
    echo "<p>❌ Error: Johari_MI_Quiz_Module class not found. Please check the module file.</p>\n";
    exit;
}

echo "<p>✅ Module class loaded successfully</p>\n";

try {
    // Call the activation method
    Johari_MI_Quiz_Module::activate();
    echo "<p>✅ Activation method called successfully</p>\n";
    
    // Check if tables were created
    global $wpdb;
    $tables = [
        'jmi_self' => $wpdb->prefix . 'jmi_self',
        'jmi_peer_links' => $wpdb->prefix . 'jmi_peer_links', 
        'jmi_peer_feedback' => $wpdb->prefix . 'jmi_peer_feedback',
        'jmi_aggregates' => $wpdb->prefix . 'jmi_aggregates'
    ];
    
    echo "<h2>Database Table Status</h2>\n";
    $all_created = true;
    
    foreach ($tables as $name => $table) {
        $exists = $wpdb->get_var("SHOW TABLES LIKE '$table'") === $table;
        if ($exists) {
            echo "<p>✅ Table <code>$table</code> exists</p>\n";
            
            // Show column count
            $cols = $wpdb->get_results("DESCRIBE $table");
            echo "<p>&nbsp;&nbsp;&nbsp;📊 Columns: " . count($cols) . "</p>\n";
        } else {
            echo "<p>❌ Table <code>$table</code> NOT found</p>\n";
            $all_created = false;
        }
    }
    
    if ($all_created) {
        echo "<p><strong>🎉 All database tables created successfully!</strong></p>\n";
    } else {
        echo "<p><strong>⚠️ Some tables were not created. Check WordPress debug logs.</strong></p>\n";
        
        // Show any WordPress database errors
        if ($wpdb->last_error) {
            echo "<p><strong>Database Error:</strong> " . esc_html($wpdb->last_error) . "</p>\n";
        }
    }
    
    // Test basic functionality
    echo "<h2>Module Registration Test</h2>\n";
    
    if (class_exists('Micro_Coach_Core')) {
        $registered_quizzes = Micro_Coach_Core::get_quizzes();
        if (isset($registered_quizzes['johari-mi-quiz'])) {
            echo "<p>✅ Module registered with platform successfully</p>\n";
            $quiz_info = $registered_quizzes['johari-mi-quiz'];
            echo "<p>&nbsp;&nbsp;&nbsp;📝 Title: " . esc_html($quiz_info['title']) . "</p>\n";
            echo "<p>&nbsp;&nbsp;&nbsp;🏷️ Shortcode: [" . esc_html($quiz_info['shortcode']) . "]</p>\n";
            echo "<p>&nbsp;&nbsp;&nbsp;🔢 Order: " . intval($quiz_info['order']) . "</p>\n";
        } else {
            echo "<p>❌ Module NOT registered with platform</p>\n";
            echo "<p>Available quizzes: " . implode(', ', array_keys($registered_quizzes)) . "</p>\n";
        }
    } else {
        echo "<p>⚠️ Micro_Coach_Core class not available</p>\n";
    }
    
} catch (Exception $e) {
    echo "<p>❌ Exception during activation: " . esc_html($e->getMessage()) . "</p>\n";
}

echo "<hr>\n";
echo "<h2>Next Steps</h2>\n"; 
echo "<ol>\n";
echo "<li><strong>Create Quiz Page:</strong> Run <a href='create-johari-mi-page.php'>create-johari-mi-page.php</a> to create a page with the quiz shortcode</li>\n";
echo "<li><strong>Clear Caches:</strong> If you use any caching plugins, clear them now</li>\n";
echo "<li><strong>Test Dashboard:</strong> Visit your quiz dashboard to see if the Johari × MI quiz appears</li>\n";
echo "<li><strong>Test Quiz:</strong> Try taking the quiz to ensure everything works</li>\n";
echo "</ol>\n";

// Show helpful debugging info
echo "<h2>Debug Information</h2>\n";
echo "<p><strong>WordPress Version:</strong> " . get_bloginfo('version') . "</p>\n";
echo "<p><strong>PHP Version:</strong> " . PHP_VERSION . "</p>\n";
echo "<p><strong>Database Prefix:</strong> " . $wpdb->prefix . "</p>\n";
echo "<p><strong>Plugin Path:</strong> " . plugin_dir_path(__FILE__) . "</p>\n";

if (defined('WP_DEBUG') && WP_DEBUG) {
    echo "<p><strong>WordPress Debug:</strong> Enabled ✅</p>\n";
} else {
    echo "<p><strong>WordPress Debug:</strong> Disabled (enable in wp-config.php for troubleshooting)</p>\n";
}

?>

<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
h1, h2, h3 { color: #333; }
p { margin: 15px 0; }
ul, ol { margin: 15px 0 15px 30px; }
a { color: #0073aa; text-decoration: none; }
a:hover { text-decoration: underline; }
hr { margin: 30px 0; border: none; border-top: 2px solid #eee; }
code { background: #f1f1f1; padding: 2px 4px; border-radius: 3px; font-family: Consolas, Monaco, monospace; }
</style>