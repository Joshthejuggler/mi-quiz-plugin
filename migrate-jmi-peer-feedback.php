<?php
/**
 * Database migration for Johari MI Quiz - Add peer_user_id column
 * 
 * Run this once to update the existing jmi_peer_feedback table structure
 * Visit: http://mi-test-site.local/wp-content/plugins/mi-quiz-plugin-restore/migrate-jmi-peer-feedback.php
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

// Check admin access
if (!current_user_can('manage_options')) {
    die('You need administrator privileges to run database migrations. Please log in to WordPress admin first.');
}

echo "<h1>Johari MI Quiz - Database Migration</h1>\n";

global $wpdb;
$table_name = $wpdb->prefix . 'jmi_peer_feedback';

// Check if table exists
$table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name));

if (!$table_exists) {
    echo "<p>❌ Table $table_name does not exist. Please activate the Johari MI Quiz plugin first.</p>";
    exit;
}

// Check if peer_user_id column already exists
$column_exists = $wpdb->get_var($wpdb->prepare(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'peer_user_id'",
    DB_NAME, $table_name
));

if ($column_exists) {
    echo "<p>✅ Column 'peer_user_id' already exists in $table_name</p>";
} else {
    echo "<p>🔄 Adding 'peer_user_id' column to $table_name...</p>";
    
    // Add the column
    $result = $wpdb->query("ALTER TABLE `$table_name` ADD COLUMN `peer_user_id` BIGINT UNSIGNED NULL AFTER `link_id`");
    
    if ($result === false) {
        echo "<p>❌ Failed to add peer_user_id column: " . $wpdb->last_error . "</p>";
        exit;
    } else {
        echo "<p>✅ Successfully added peer_user_id column</p>";
    }
}

// Add index on peer_user_id if it doesn't exist
$indexes = $wpdb->get_results("SHOW INDEX FROM `$table_name`");
$peer_user_index_exists = false;
foreach ($indexes as $index) {
    if ($index->Column_name === 'peer_user_id' && $index->Key_name === 'peer_user_id') {
        $peer_user_index_exists = true;
        break;
    }
}

if (!$peer_user_index_exists && $column_exists) {
    echo "<p>🔄 Adding index on peer_user_id column...</p>";
    $result = $wpdb->query("ALTER TABLE `$table_name` ADD INDEX `peer_user_id` (`peer_user_id`)");
    if ($result === false) {
        echo "<p>⚠️ Warning: Could not add index on peer_user_id: " . $wpdb->last_error . "</p>";
    } else {
        echo "<p>✅ Successfully added index on peer_user_id</p>";
    }
} elseif ($peer_user_index_exists) {
    echo "<p>✅ Index on peer_user_id already exists</p>";
}

// Add unique constraint to prevent duplicate peer feedback
$unique_indexes = $wpdb->get_results("SHOW INDEX FROM `$table_name` WHERE Key_name = 'no_duplicate_peer'");
if (empty($unique_indexes)) {
    echo "<p>🔄 Adding unique constraint to prevent duplicate peer feedback...</p>";
    $result = $wpdb->query("ALTER TABLE `$table_name` ADD UNIQUE KEY `no_duplicate_peer` (`self_id`, `peer_user_id`)");
    if ($result === false) {
        echo "<p>⚠️ Warning: Could not add unique constraint (this is normal if there are existing duplicate entries): " . $wpdb->last_error . "</p>";
    } else {
        echo "<p>✅ Successfully added unique constraint</p>";
    }
} else {
    echo "<p>✅ Unique constraint already exists</p>";
}

// Show current table structure
echo "<h2>Current Table Structure:</h2>";
$columns = $wpdb->get_results("DESCRIBE `$table_name`");
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";
foreach ($columns as $column) {
    echo "<tr>";
    echo "<td>" . esc_html($column->Field) . "</td>";
    echo "<td>" . esc_html($column->Type) . "</td>";
    echo "<td>" . esc_html($column->Null) . "</td>";
    echo "<td>" . esc_html($column->Key) . "</td>";
    echo "<td>" . esc_html($column->Default ?? 'NULL') . "</td>";
    echo "<td>" . esc_html($column->Extra) . "</td>";
    echo "</tr>";
}
echo "</table>";

// Show row count
$row_count = $wpdb->get_var("SELECT COUNT(*) FROM `$table_name`");
echo "<p><strong>Current row count:</strong> $row_count</p>";

echo "<hr>";
echo "<p>✅ <strong>Migration Complete!</strong> The Johari MI Quiz peer feedback system now requires user registration.</p>";

?>

<style>
body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
    max-width: 800px; 
    margin: 40px auto; 
    padding: 20px; 
    line-height: 1.6; 
}
h1, h2 { color: #333; }
table { border-collapse: collapse; width: 100%; margin: 15px 0; }
th { background: #f5f5f5; }
td, th { text-align: left; padding: 8px; border: 1px solid #ddd; }
</style>