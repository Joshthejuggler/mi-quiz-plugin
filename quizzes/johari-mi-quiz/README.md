# Johari × MI Quiz Module

A peer-feedback assessment tool that combines the Johari Window model with Multiple Intelligence theory.

## Overview

The Johari × MI quiz allows users to:
1. **Self-assess**: Select 6-10 adjectives that describe themselves from 8 MI domain categories
2. **Invite peers**: Share a link for 2-5 trusted contacts to provide anonymous feedback
3. **View results**: See adjectives organized into Johari Window quadrants (Open/Blind/Hidden/Unknown)
4. **Domain analysis**: Understand results through MI domain breakdowns and visualizations

## Installation

1. The module is automatically loaded as part of the main quiz platform
2. Database tables are created on activation
3. Add the shortcode `[johari_mi_quiz]` to any page or post

## Database Schema

### Tables Created

- **`{prefix}_jmi_self`**: Stores self-assessments
  - `id`, `user_id`, `uuid`, `adjectives` (JSON), `created_at`, `updated_at`

- **`{prefix}_jmi_peer_links`**: Manages peer sharing links  
  - `id`, `self_id`, `uuid`, `created_at`, `expires_at`, `max_peers`, `visited`

- **`{prefix}_jmi_peer_feedback`**: Stores peer responses
  - `id`, `self_id`, `link_id`, `adjectives` (JSON), `created_at`, `ip`

- **`{prefix}_jmi_aggregates`**: Cached Johari Window results
  - `id`, `self_id`, `open`, `blind`, `hidden`, `unknown`, `domain_summary`, `last_recalc`

## Shortcodes

- **`[johari_mi_quiz]`** - Main quiz interface
- **`[johari-mi-quiz]`** - Alternative hyphenated version

## AJAX Endpoints

### Public Endpoints
- `miq_jmi_save_self` - Save self-assessment and generate sharing link
- `miq_jmi_peer_submit` - Submit peer feedback anonymously  
- `miq_jmi_generate_results` - Calculate and retrieve Johari Window results
- `miq_jmi_generate_pdf` - Export results as PDF

### Admin Endpoints  
- `jmi_export_subs` - Export assessments data as CSV
- `jmi_delete_subs` - Bulk delete selected assessments

## Johari Window Algorithm

The system calculates four quadrants:

- **Open**: Adjectives selected by both self and peers
- **Blind**: Selected by peers but not self (blind spots)  
- **Hidden**: Selected by self but not peers (private strengths)
- **Unknown**: Not selected by anyone (unexplored potential)

## MI Domain Mapping

Each adjective is mapped to one of 8 Multiple Intelligence domains:

1. **Linguistic**: Articulate, Expressive, Persuasive, Eloquent, Verbal, Communicative, Storyteller
2. **Logical-Mathematical**: Analytical, Logical, Systematic, Objective, Precise, Curious, Problem-Solving
3. **Spatial-Visual**: Imaginative, Inventive, Observant, Aesthetic, Detailed, Conceptual, Visual
4. **Bodily-Kinesthetic**: Energetic, Graceful, Coordinated, Hands-On, Grounded, Active, Practical
5. **Musical**: Rhythmic, Harmonious, Attuned, Expressive, Melodic, Sensitive, Creative
6. **Interpersonal**: Empathetic, Collaborative, Friendly, Supportive, Sociable, Encouraging, Persuasive
7. **Intrapersonal**: Reflective, Self-Aware, Thoughtful, Authentic, Insightful, Mindful, Intuitive
8. **Naturalistic**: Observant, Grounded, Curious, Eco-Aware, Connected, Nurturing, Practical

## User Profile Integration

Results are stored in WordPress user meta as `johari_mi_profile`:

```json
{
  "open": ["Articulate", "Analytical"],
  "blind": ["Graceful", "Imaginative"], 
  "hidden": ["Reflective"],
  "unknown": ["Grounded", "Observant"],
  "domain_summary": {
    "Linguistic": {"open": 3, "blind": 1, "hidden": 2, "unknown": 0},
    "Spatial-Visual": {"open": 1, "blind": 2, "hidden": 0, "unknown": 1}
  },
  "generated_at": "2025-01-07 15:30:00"
}
```

## Security Features

- **CSRF Protection**: All AJAX requests require nonce verification
- **UUID Tokens**: 128-bit UUIDs for sharing links and data integrity
- **IP Rate Limiting**: One submission per IP per assessment link  
- **Data Expiration**: Automatic cleanup of expired assessments (30 days)
- **GDPR Compliance**: Complete data removal on user deletion

## Admin Features

- View all assessments with completion status
- Export assessment data as CSV
- Bulk delete assessments and related data
- Email BCC settings for result notifications

## Customization

### Adding New Adjectives

Edit `/jmi-adjectives.php`:

```php
$jmi_adjective_map['Domain Name'] = [
    'New Adjective 1',
    'New Adjective 2',
    // ... up to 7 adjectives per domain
];
```

### Modifying Colors

Update domain colors in the same file:

```php
$jmi_domain_colors['Domain Name'] = '#hexcolor';
```

## Performance Notes

- Results are cached for 1 hour to optimize repeated requests
- Daily cron job cleans up expired data
- Database queries use prepared statements and proper indexing

## Integration with AI Experiment Generator

The module exposes `user.johari_mi` data to the AI system for generating personalized learning experiments based on:

- **Blind spots** - Areas for growth and awareness
- **Hidden strengths** - Private talents to develop confidence  
- **Open areas** - Known strengths to leverage further
- **Unknown potential** - Areas for creative exploration

## Version History

- **0.1.0** - Initial implementation with full Johari Window functionality
- Integrated with existing MI Quiz Platform architecture
- Responsive design with accessibility features
- PDF export and email delivery capabilities