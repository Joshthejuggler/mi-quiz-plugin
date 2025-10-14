<?php
// Johari × MI Adjective Mapping
// Based on the 8 Multiple Intelligence domains with 7 adjectives each

$jmi_adjective_map = [
    'Linguistic' => [
        'Articulate',
        'Persuasive',
        'Expressive',
        'Eloquent',
        'Poetic',
        'Witty',
        'Storyteller'
    ],
    'Logical-Mathematical' => [
        'Analytical',
        'Precise',
        'Rational',
        'Curious',
        'Systematic',
        'Problem Solver',
        'Objective'
    ],
    'Spatial-Visual' => [
        'Imaginative',
        'Observant',
        'Visual',
        'Detailed',
        'Aesthetic',
        'Inventive',
        'Conceptual'
    ],
    'Bodily-Kinesthetic' => [
        'Energetic',
        'Graceful',
        'Practical',
        'Grounded',
        'Hands On',
        'Coordinated',
        'Adaptive'
    ],
    'Musical-Rhythmic' => [
        'Harmonious',
        'Sensitive',
        'Tuneful',
        'Attuned',
        'Creative',
        'Rhythmic',
        'Flow Driven'
    ],
    'Interpersonal' => [
        'Empathetic',
        'Diplomatic',
        'Approachable',
        'Social',
        'Cooperative',
        'Encouraging',
        'Perceptive'
    ],
    'Intrapersonal' => [
        'Reflective',
        'Authentic',
        'Self Aware',
        'Honest',
        'Composed',
        'Insightful',
        'Purpose Driven'
    ],
    'Naturalistic' => [
        'Attentive to Nature',
        'Patient',
        'Pattern Seeking',
        'Calm',
        'Balanced',
        'Methodical',
        'Connected'
    ]
];

// Color mapping for MI domains (matching existing MI quiz palette)
$jmi_domain_colors = [
    'Linguistic'            => '#14b8a6', // Teal
    'Logical-Mathematical'  => '#3b82f6', // Blue  
    'Spatial-Visual'        => '#8b5cf6', // Purple
    'Bodily-Kinesthetic'    => '#f97316', // Orange
    'Musical-Rhythmic'      => '#ec4899', // Pink
    'Interpersonal'         => '#10b981', // Green
    'Intrapersonal'         => '#6366f1', // Indigo
    'Naturalistic'          => '#84cc16'  // Lime
];

// Johari quadrant colors
$jmi_quadrant_colors = [
    'open'    => '#10b981', // Green - strengths known to self and others
    'blind'   => '#ef4444', // Red - blind spots others see but self doesn't
    'hidden'  => '#f59e0b', // Yellow - private strengths self knows but others don't
    'unknown' => '#6b7280'  // Gray - unknown to both self and others
];

// Create a flat list of all adjectives for calculations
$jmi_all_adjectives = [];
foreach ($jmi_adjective_map as $domain => $domain_adjectives) {
    $jmi_all_adjectives = array_merge($jmi_all_adjectives, $domain_adjectives);
}

// Return the data for use by the module
return [
    'adjective_map'     => $jmi_adjective_map,
    'domain_colors'     => $jmi_domain_colors,
    'quadrant_colors'   => $jmi_quadrant_colors,
    'all_adjectives'    => $jmi_all_adjectives
];