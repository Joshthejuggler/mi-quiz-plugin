<?php
// Debug script to check and enable Lab Mode
require_once('../../../wp-load.php');

echo "=== Lab Mode Debug ===\n";

// Check current Lab Mode setting
$lab_enabled = get_option('mc_lab_mode_enabled', '0');
echo "Lab Mode currently enabled: " . ($lab_enabled === '1' ? 'YES' : 'NO') . " (value: $lab_enabled)\n";

// Enable Lab Mode if not already enabled
if ($lab_enabled !== '1') {
    update_option('mc_lab_mode_enabled', '1');
    echo "Lab Mode has been ENABLED\n";
} else {
    echo "Lab Mode was already enabled\n";
}

// Check if user has completed all assessments
$user_id = get_current_user_id();
if ($user_id) {
    echo "\n=== Assessment Status for User $user_id ===\n";
    
    $mi_results = get_user_meta($user_id, 'miq_quiz_results', true);
    $cdt_results = get_user_meta($user_id, 'cdt_quiz_results', true);
    $bartle_results = get_user_meta($user_id, 'bartle_quiz_results', true);
    
    echo "MI Quiz Results: " . (!empty($mi_results) ? 'COMPLETED' : 'NOT COMPLETED') . "\n";
    echo "CDT Quiz Results: " . (!empty($cdt_results) ? 'COMPLETED' : 'NOT COMPLETED') . "\n";
    echo "Bartle Quiz Results: " . (!empty($bartle_results) ? 'COMPLETED' : 'NOT COMPLETED') . "\n";
    
    $all_complete = !empty($mi_results) && !empty($cdt_results) && !empty($bartle_results);
    echo "All assessments complete: " . ($all_complete ? 'YES' : 'NO') . "\n";
    
    if ($all_complete) {
        echo "Lab Mode tab should be available!\n";
    } else {
        echo "Complete remaining assessments to access Lab Mode\n";
    }
} else {
    echo "No user logged in\n";
}

echo "\n=== Done ===\n";