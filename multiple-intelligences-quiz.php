<?php
/*
Plugin Name: Multiple Intelligences Quiz (Micro-Coach)
Description: Two-part MI quiz with age-group selection, results email, subscriber capture (first/last/email/date), and CSV export. Uses questions from mi-questions.php.
Version: 9.4
Author: Your Name
License: GPL2
*/

if ( ! defined( 'ABSPATH' ) ) exit;

// Your data file with $mi_categories, $mi_questions, $mi_part_two_questions, $mi_career_suggestions, $mi_leverage_tips, $mi_growth_tips
require_once plugin_dir_path(__FILE__) . 'mi-questions.php';

class MI_Quiz_Plugin_AI {
    const VERSION           = '9.4';
    const OPT_GROUP         = 'miq_settings';
    const OPT_BCC           = 'miq_bcc_emails';
    const OPT_ANTITHREAD    = 'miq_antithread'; // add invisible token to subject to reduce threading
    const TABLE_SUBSCRIBERS = 'miq_subscribers';

    // data
    private $categories = [];
    private $questions = [];
    private $part_two_questions = [];
    private $career_suggestions = [];
    private $leverage_tips = [];
    private $growth_tips = [];

    public function __construct() {
        // Pull arrays from the included data file
        $this->categories         = $GLOBALS['mi_categories'] ?? [];
        $this->questions          = $GLOBALS['mi_questions'] ?? [];
        $this->part_two_questions = $GLOBALS['mi_part_two_questions'] ?? [];
        $this->career_suggestions = $GLOBALS['mi_career_suggestions'] ?? [];
        $this->leverage_tips      = $GLOBALS['mi_leverage_tips'] ?? [];
        $this->growth_tips        = $GLOBALS['mi_growth_tips'] ?? [];

        // Frontend & admin
        add_shortcode('mi_quiz', [ $this, 'render_quiz' ]);
        if ( is_admin() ) {
            add_action('admin_menu',  [ $this, 'add_settings_pages' ]);
            add_action('admin_init',  [ $this, 'register_settings' ]);
        } else {
            add_action('wp_enqueue_scripts', [ $this, 'enqueue_assets' ]);
        }

        // Ajax
        add_action('wp_ajax_miq_email_results',        [ $this, 'ajax_email_results' ]);
        add_action('wp_ajax_nopriv_miq_email_results', [ $this, 'ajax_email_results' ]);
        add_action('wp_ajax_miq_delete_subs',          [ $this, 'ajax_delete_subs' ]);
        add_action('wp_ajax_miq_export_subs',          [ $this, 'ajax_export_subs' ]);

        // Ensure table exists (also runs on activation below)
        add_action('init', [ $this, 'ensure_tables' ]);
    }

    /** Create/upgrade the subscribers table */
    public function ensure_tables(){
        global $wpdb;
        $table   = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $charset = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE IF NOT EXISTS `$table` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            created_at DATETIME NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name  VARCHAR(100) DEFAULT '',
            email      VARCHAR(190) NOT NULL,
            ip         VARCHAR(64)  DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY email (email),
            KEY created_at (created_at)
        ) $charset;";
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /** Activation hook */
    public static function activate() {
        (new self())->ensure_tables();
    }

    /** Admin: settings + subscribers pages */
    public function add_settings_pages() {
        add_options_page('MI Quiz Settings','MI Quiz','manage_options','mi-quiz-settings',[ $this,'render_settings_page' ]);
        add_menu_page('MI Quiz Subscribers','MI Quiz Subs','manage_options','mi-quiz-subs',[ $this,'render_subs_page' ],'dashicons-email',59);
    }

    public function register_settings() {
        register_setting( self::OPT_GROUP, self::OPT_BCC );
        register_setting( self::OPT_GROUP, self::OPT_ANTITHREAD );
        add_settings_section( 'miq_main', 'Main Settings', '__return_false', 'mi-quiz-settings' );

        add_settings_field( self::OPT_BCC, 'BCC Results Email', function(){
            $v = esc_attr( get_option(self::OPT_BCC,'') );
            echo '<input type="text" style="width:480px" name="'.esc_attr(self::OPT_BCC).'" value="'.$v.'" placeholder="admin@example.com, another@example.com">';
            echo '<p class="description">Admins to notify with a copy of results. Comma-separated.</p>';
        }, 'mi-quiz-settings', 'miq_main' );

        add_settings_field( self::OPT_ANTITHREAD, 'Reduce Inbox Threading', function(){
            $checked = get_option(self::OPT_ANTITHREAD,'1') ? 'checked' : '';
            echo '<label><input type="checkbox" name="'.esc_attr(self::OPT_ANTITHREAD).'" value="1" '.$checked.'> Add an invisible token to subjects so repeated sends don’t collapse into one thread.</label>';
        }, 'mi-quiz-settings', 'miq_main' );
    }

    public function render_settings_page(){
        ?><div class="wrap"><h1>MI Quiz Settings</h1>
        <form method="post" action="options.php"><?php
            settings_fields(self::OPT_GROUP);
            do_settings_sections('mi-quiz-settings');
            submit_button();
        ?></form></div><?php
    }

    public function render_subs_page(){
        global $wpdb; $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $rows = $wpdb->get_results("SELECT * FROM `$table` ORDER BY id DESC LIMIT 5000", ARRAY_A);
        $export_url = wp_nonce_url( admin_url('admin-ajax.php?action=miq_export_subs'), 'miq_nonce' );
        echo '<div class="wrap"><h1>Subscribers</h1>';
        echo '<p><a class="button button-secondary" href="'.esc_url($export_url).'">Download CSV</a></p>';
        if ( empty($rows) ) { echo '<p>No subscribers yet.</p></div>'; return; }
        echo '<p><button class="button button-primary" id="miq-del-selected">Delete Selected</button></p>';
        echo '<table class="widefat striped"><thead><tr>
                <th style="width:28px"><input type="checkbox" id="miq-check-all"></th>
                <th>ID</th><th>Date</th><th>First</th><th>Last</th><th>Email</th><th>IP</th>
              </tr></thead><tbody>';
        foreach ($rows as $r){
            echo '<tr>'.
              '<td><input type="checkbox" class="miq-row" value="'.intval($r['id']).'"></td>'.
              '<td>'.intval($r['id']).'</td>'.
              '<td>'.esc_html($r['created_at']).'</td>'.
              '<td>'.esc_html($r['first_name']).'</td>'.
              '<td>'.esc_html($r['last_name']).'</td>'.
              '<td>'.esc_html($r['email']).'</td>'.
              '<td>'.esc_html($r['ip']).'</td>'.
            '</tr>';
        }
        echo '</tbody></table></div>'; ?>
        <script>
        (function(){
          const $ = s => document.querySelector(s);
          const $$ = s => Array.from(document.querySelectorAll(s));
          const nonce = '<?php echo esc_js( wp_create_nonce('miq_nonce') ); ?>';
          const all = $('#miq-check-all');
          all && all.addEventListener('change', ()=> $$('.miq-row').forEach(cb=> cb.checked = all.checked));
          const del = $('#miq-del-selected');
          del && del.addEventListener('click', ()=>{
            const ids = $$('.miq-row').filter(c=>c.checked).map(c=>c.value);
            if(!ids.length) return alert('Select rows first');
            if(!confirm('Delete selected subscribers?')) return;
            fetch(ajaxurl, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
              body: new URLSearchParams({action:'miq_delete_subs', _ajax_nonce:nonce, ids})
            }).then(r=>r.json()).then(j=>{
              if(j.success) location.reload(); else alert('Delete failed');
            });
          });
        })();
        </script>
        <?php
    }

    public function ajax_delete_subs(){
        if(!current_user_can('manage_options')) wp_send_json_error('No permission');
        check_ajax_referer('miq_nonce');
        $ids = array_filter(array_map('intval',(array)($_POST['ids']??[])));
        if(empty($ids)) wp_send_json_error('No IDs');
        global $wpdb; $table=$wpdb->prefix.self::TABLE_SUBSCRIBERS;
        $in = implode(',', array_fill(0, count($ids), '%d'));
        $res = $wpdb->query( $wpdb->prepare("DELETE FROM `$table` WHERE id IN ($in)", $ids) );
        wp_send_json_success(['deleted'=>(int)$res]);
    }

    /** CSV export */
    public function ajax_export_subs(){
        if(!current_user_can('manage_options')) wp_die('No permission');
        check_admin_referer('miq_nonce');

        global $wpdb; $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $rows = $wpdb->get_results("SELECT id,created_at,first_name,last_name,email,ip FROM `$table` ORDER BY id DESC", ARRAY_A);

        $filename = 'miq-subscribers-' . date('Ymd-His') . '.csv';
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);

        $out = fopen('php://output', 'w');
        // BOM for Excel UTF-8
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($out, ['id','created_at','first_name','last_name','email','ip']);
        foreach ($rows as $r) {
            fputcsv($out, [$r['id'], $r['created_at'], $r['first_name'], $r['last_name'], $r['email'], $r['ip']]);
        }
        fclose($out);
        exit;
    }

    public function enqueue_assets(){
        wp_register_style( 'mi-quiz-css', plugins_url('css/mi-quiz.css', __FILE__), [], self::VERSION );
        wp_enqueue_style( 'mi-quiz-css' );
    }

    /** Helper: add an invisible anti-thread token if enabled (ZWSPs) */
    private function maybe_antithread($subject){
        // DEFAULT ON now (matches the checked box on first load)
        if ( ! get_option(self::OPT_ANTITHREAD, '1') ) return $subject;
        $zw = "\xE2\x80\x8B"; // U+200B zero-width space
        return $subject . str_repeat($zw, wp_rand(1,3));
    }

    /** Email results + record subscriber */
    public function ajax_email_results() {
        check_ajax_referer('miq_nonce');

        $email        = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $first_name   = isset($_POST['first_name']) ? sanitize_text_field($_POST['first_name']) : '';
        $last_name    = isset($_POST['last_name']) ? sanitize_text_field($_POST['last_name']) : '';
        $results_html = isset($_POST['results_html']) ? wp_kses_post(wp_unslash($_POST['results_html'])) : '';

        if ( ! is_email($email) )   wp_send_json_error('Invalid email address.');
        if ( empty($first_name) )   wp_send_json_error('Please enter your first name.');
        if ( empty($results_html) ) wp_send_json_error('No results data to send.');

        $body = '<html><body><h1>Here are your quiz results:</h1>'.$results_html.'<p>Thank you for taking the quiz!</p></body></html>';

        // 1) Send to participant — clean subject, no timestamp/number
        $subject_user = $this->maybe_antithread( sprintf('Your MI Quiz Results — %s %s', $first_name, $last_name) );
        $headers_user = [
            'Content-Type: text/html; charset=UTF-8',
            sprintf('Reply-To: "%s %s" <%s>', $first_name, $last_name, $email),
        ];
        $sent_user = wp_mail($email, $subject_user, $body, $headers_user);

        // 2) Admin copy: choose a TO that is NOT the participant, dedupe BCCs, add Reply-To
        $admin_list_raw = array_filter(array_map('trim', explode(',', get_option(self::OPT_BCC, ''))));
        $admin_list_raw = array_unique($admin_list_raw);

        // Pick a "to" that isn't the participant; fall back to site admin email
        $admin_to = '';
        foreach ($admin_list_raw as $addr) {
            if ( strcasecmp($addr, $email) !== 0 ) { $admin_to = $addr; break; }
        }
        if ( empty($admin_to) ) {
            $fallback = get_option('admin_email');
            if ( is_email($fallback) && strcasecmp($fallback, $email) !== 0 ) {
                $admin_to = $fallback;
            }
        }

        // BCC = remaining admins, excluding the chosen TO and the participant
        $bcc = array_values(array_filter($admin_list_raw, function($addr) use ($admin_to, $email){
            return strcasecmp($addr, $admin_to) !== 0 && strcasecmp($addr, $email) !== 0;
        }));

        if ( ! empty($admin_to) ) {
            $subject_admin = $this->maybe_antithread( sprintf('[MI Quiz] Results for %s %s <%s>', $first_name, $last_name, $email) );
            $headers_admin = [
                'Content-Type: text/html; charset=UTF-8',
                sprintf('Reply-To: "%s %s" <%s>', $first_name, $last_name, $email),
            ];
            if ( ! empty($bcc) ) {
                $headers_admin[] = 'Bcc: ' . implode(', ', $bcc);
            }
            wp_mail($admin_to, $subject_admin, $body, $headers_admin);
        }

        // 3) Record/refresh subscriber (upsert by email)
        global $wpdb; 
        $table = $wpdb->prefix . self::TABLE_SUBSCRIBERS;
        $wpdb->query( $wpdb->prepare(
            "INSERT INTO `$table` (created_at, first_name, last_name, email, ip)
             VALUES (%s, %s, %s, %s, %s)
             ON DUPLICATE KEY UPDATE 
                created_at = VALUES(created_at),
                first_name = VALUES(first_name),
                last_name  = VALUES(last_name),
                ip         = VALUES(ip)",
            current_time('mysql'), $first_name, $last_name, $email, $_SERVER['REMOTE_ADDR'] ?? ''
        ));

        if ($sent_user) wp_send_json_success('Your results have been sent! Check your inbox.');
        wp_send_json_error('The email could not be sent. Please try again later.');
    }

    /** Shortcode output (HTML + inline compact JS) */
    public function render_quiz() {
        ob_start(); ?>
        <div id="mi-quiz-container">
          <div id="mi-age-gate">
            <div class="mi-quiz-card">
              <h2 class="mi-section-title" style="margin-top:0;">Welcome!</h2>
              <p>To tailor the questions for you, please select the option that best describes you:</p>
              <div class="mi-age-options">
                <button type="button" class="mi-quiz-button" data-age-group="teen">Teen / High School</button>
                <button type="button" class="mi-quiz-button" data-age-group="graduate">Student / Recent Graduate</button>
                <button type="button" class="mi-quiz-button" data-age-group="adult">Adult / Professional</button>
              </div>
            </div>
          </div>

          <?php if ( current_user_can('administrator') ): ?>
          <div style="border:1px dashed #bbb;padding:.75em;border-radius:8px;background:#fffdf7;margin:12px 0; display:none;" id="mi-dev-tools">
            <strong>Dev tools:</strong>
            <button type="button" id="mi-autofill-run" class="mi-quiz-button" style="margin-left:10px; padding: 5px 10px; font-size: 0.8em;">Auto-Fill</button>
          </div>
          <?php endif; ?>

          <form id="mi-quiz-form-part1" style="display:none;"></form>

          <div id="mi-quiz-intermission" style="display:none;text-align:center;padding:1.5em;border:1px solid #ddd;border-radius:8px;">
            <h2 class="mi-section-title">Your Top Intelligences</h2>
            <p>Based on your answers, these are your top three intelligences:</p>
            <ul id="mi-top3-list" style="list-style-type:none;padding:0;margin:1em 0; font-weight: bold;"></ul>
            <p>Now, let's explore these three areas in more detail.</p>
            <button type="button" id="mi-start-part2" class="mi-quiz-button">Start Part 2</button>
          </div>

          <form id="mi-quiz-form-part2" style="display:none;"></form>
          <div id="mi-quiz-results" style="margin-top:2em;display:none;"></div>
        </div>

        <script>
        (function(){
          const ajaxUrl   = '<?php echo esc_js(admin_url("admin-ajax.php")); ?>';
          const ajaxNonce = '<?php echo esc_js(wp_create_nonce("miq_nonce")); ?>';

          const $id=(s)=>document.getElementById(s);
          const ageGate=$id('mi-age-gate'), form1=$id('mi-quiz-form-part1'), form2=$id('mi-quiz-form-part2'),
                inter=$id('mi-quiz-intermission'), resultsDiv=$id('mi-quiz-results'),
                devTools=$id('mi-dev-tools'), autoBtn=$id('mi-autofill-run');

          const CATS   = <?php echo wp_json_encode($this->categories); ?> || {};
          const Q1     = <?php echo wp_json_encode($this->questions); ?> || {};
          const Q2     = <?php echo wp_json_encode($this->part_two_questions); ?> || {};
          const CAREER = <?php echo wp_json_encode($this->career_suggestions); ?> || {};
          const LEV    = <?php echo wp_json_encode($this->leverage_tips); ?> || {};
          const GROW   = <?php echo wp_json_encode($this->growth_tips); ?> || {};
          const LIKERT = {1:'Not at all like me',2:'Not really like me',3:'Somewhat like me',4:'Mostly like me',5:'Very much like me'};

          let age='adult', top3=[], detailed={}, top5=[], bottom3=[];

          function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

          function build(form, items, onDone){
            if(!items.length){ alert('No questions available.'); return; }
            let h = `
              <div class="mi-progress-wrapper" style="display:flex;align-items:center;gap:1em;margin-bottom:1em;">
                <div class="mi-progress-container" style="flex:1;background:#e0e0e0;border-radius:4px;overflow:hidden;">
                  <div class="mi-progress-bar" style="height:8px;background:#4CAF50;width:0%;transition:width .2s;"></div>
                </div><div class="mi-progress-counter"></div></div>
              <div class="mi-steps-container">`;
            items.forEach((q,i)=>{
              const qid=form.id+'_q_'+i;
              let opts=''; for(let v=1; v<=5; v++){
                opts += `<label class="mi-quiz-option-wrapper"><input type="radio" name="${qid}" value="${v}" required><span class="likert-num">${v}</span><span class="likert-text">${LIKERT[v]}</span></label>`;
              }
              h += `<div class="mi-step" data-step="${i}" data-cat="${q.cat||''}" data-subcat="${q.subcat||''}" style="display:none;">
                      <div class="mi-quiz-card">
                        <p class="mi-quiz-question-text">${q.text||''}</p>
                        <div class="mi-quiz-likert-options">${opts}</div>
                      </div>
                    </div>`;
            });
            h += `</div><div class="mi-quiz-footer"><button type="button" class="mi-prev mi-quiz-button" disabled>Previous</button>
                  <button type="button" class="mi-submit-final mi-quiz-button" style="display:none;">Next</button></div>`;
            form.innerHTML = h;

            const steps=form.querySelectorAll('.mi-step'), prev=form.querySelector('.mi-prev'),
                  next=form.querySelector('.mi-submit-final'), bar=form.querySelector('.mi-progress-bar'),
                  ctr=form.querySelector('.mi-progress-counter');
            let i=0, n=steps.length;
            const show=(k)=>{ steps.forEach((s,j)=>s.style.display = j===k?'block':'none');
              prev.disabled=(k===0); if(next) next.style.display=(k===n-1)?'inline-block':'none';
              bar.style.width=((k+1)/n*100)+'%'; ctr.textContent=(n-k)+' questions remaining'; };
            prev.addEventListener('click', ()=>{ if(i>0){ i--; show(i);} });
            steps.forEach((s,k)=> s.querySelectorAll('input[type=radio]').forEach(inp=> inp.addEventListener('change', ()=>{ setTimeout(()=>{ if(k<n-1){ i=k+1; show(i);} },120); })));
            next && next.addEventListener('click', ()=>onDone(steps));
            show(0);
          }

          function part1Items(){
            const src = Q1[age] || Q1['adult'] || {};
            const out = []; Object.entries(src).forEach(([slug, arr])=> Array.isArray(arr) && arr.forEach(text => out.push({cat:slug, text})));
            return shuffle(out);
          }
          function part2Items(){
            const src = Q2[age] || Q2['adult'] || {};
            const out = [];
            top3.forEach(sl=>{
              const groups = src[sl] || {};
              Object.entries(groups).forEach(([sub, arr])=> Array.isArray(arr) && arr.forEach(text => out.push({cat:sl, subcat:sub, text})));
            });
            return shuffle(out);
          }

          function autoFill(form, both=false){
            const steps=form.querySelectorAll('.mi-step'), submit=form.querySelector('.mi-submit-final');
            let k=0; (function tick(){
              if(k>=steps.length){ submit?.click(); if(both && form===form1){ setTimeout(()=>{ $id('mi-start-part2')?.click(); setTimeout(()=>autoFill(form2,false),200); },200);} return; }
              const pick = Math.floor(Math.random()*5)+1, radio = steps[k].querySelector('input[value="'+pick+'"]');
              if(radio){ radio.checked=true; radio.dispatchEvent(new Event('change',{bubbles:true})); }
              k++; setTimeout(tick,16);
            })();
          }
          autoBtn && autoBtn.addEventListener('click', ()=>autoFill(form1,true));

          // Age → start Part 1
          ageGate.querySelectorAll('.mi-quiz-button').forEach(btn=>{
            btn.addEventListener('click', e=>{
              age = e.currentTarget.dataset.ageGroup || 'adult';
              ageGate.style.display='none';
              if (devTools) devTools.style.display = '<?php echo current_user_can('administrator') ? 'block' : 'none'; ?>';
              form1.style.display='block';

              build(form1, part1Items(), steps=>{
                const scores={}; Object.keys(CATS).forEach(k=>scores[k]=0);
                steps.forEach(s=>{
                  const cat=s.getAttribute('data-cat'), v=s.querySelector('input[type=radio]:checked')?.value;
                  if(cat && v) scores[cat]=(scores[cat]||0)+parseInt(v,10);
                });
                top3 = Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
                $id('mi-top3-list').innerHTML = top3.map(sl=>`<li>${CATS[sl]||sl}</li>`).join('');
                form1.style.display='none'; devTools && (devTools.style.display='none'); inter.style.display='block';
              });

              const sbtn=form1.querySelector('.mi-submit-final'); if(sbtn){ sbtn.id='mi-submit-part1'; sbtn.textContent='Submit Part 1'; }
            });
          });

          // Start Part 2
          $id('mi-start-part2').addEventListener('click', ()=>{
            inter.style.display='none';
            const items = part2Items();
            if(!items.length){ showResults([]); return; }
            devTools && (devTools.style.display='block'); form2.style.display='block';
            build(form2, items, showResults);
            const sbtn=form2.querySelector('.mi-submit-final'); if(sbtn) sbtn.textContent='Show My Results';
          });

          const bar = (score,max=15)=>{
            const pct=Math.max(0,Math.min(100,(score/max)*100));
            const col=pct>=75?'#4CAF50':(pct<40?'#f44336':'#ffc107');
            return `<div style="height:8px;background:#e0e0e0;border-radius:4px;margin-top:4px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${col};"></div></div>`;
          };

          function fallbackGrow(slug, sub){
            const parent=CATS[slug]||slug;
            return [
              `Practice ${sub.toLowerCase()} in short, daily reps (5–10 minutes).`,
              `Pair with someone strong in ${parent} for feedback on ${sub.toLowerCase()}.`,
              `Pick one tiny weekly challenge to stretch your ${sub.toLowerCase()} and track it.`
            ];
          }

          function showResults(p2Steps){
            // Build detailed scores
            detailed={};
            const src = Q2[age] || Q2['adult'] || {};
            top3.forEach(sl=>{ detailed[sl]={}; Object.keys(src[sl]||{}).forEach(sub=> detailed[sl][sub]=0); });
            (p2Steps||[]).forEach(s=>{
              const cat=s.getAttribute('data-cat'), sub=s.getAttribute('data-subcat');
              const v=s.querySelector('input[type=radio]:checked')?.value;
              if(v && detailed[cat] && sub in detailed[cat]) detailed[cat][sub]+=parseInt(v,10);
            });

            // Flatten → top5 / bottom3
            const subs=[];
            Object.entries(detailed).forEach(([slug,obj])=>{
              const parent=CATS[slug]||slug; Object.entries(obj).forEach(([name,score])=>subs.push({name,score,parent,slug}));
            });
            subs.sort((a,b)=>b.score-a.score);
            top5=subs.slice(0,5); bottom3=subs.slice(-3).reverse();

            const names = top3.map(sl=>CATS[sl]||sl);
            const summary = names.length>=3 ? `Your detailed profile highlights a powerful combination of ${names[0]}, ${names[1]}, and ${names[2]}.` : 'Here is your detailed profile.';

            let top5Html = `<div class="mi-results-section" style="padding:1.5em;background:#f9f9f9;border-radius:8px;">
              <h2 class="mi-section-title">Your Top 5 Strengths</h2><ol style="padding-left:2em;margin-top:1em;">`;
            top5.forEach(it=>{
              const tips = (LEV?.[age]?.[it.slug]?.[it.name] || []);
              top5Html += `<li style="margin-bottom:1.25em;"><div><strong>${it.name}</strong> (${it.score} / 15) — <em style="color:#555;">${it.parent}</em></div>${bar(it.score)}`;
              if (tips.length){
                top5Html += `<div style="margin-top:.5em;padding-left:1em;"><strong style="font-size:.9em;color:#333;">How to leverage:</strong>
                <ul style="margin:.25em 0 0 1em;font-size:.9em;color:#555;">${tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`;
              }
              top5Html += `</li>`;
            });
            top5Html += `</ol></div>`;

            let careerHtml = `<div class="mi-results-section" style="padding:1.5em;background:#f9f9f9;border-radius:8px;">
              <h2 class="mi-section-title">Career & Hobby Suggestions</h2>`;
            top3.forEach(sl=>{
              const s = CAREER?.[age]?.[sl]; if(!s) return;
              careerHtml += `<div><h3 class="mi-subsection-title">For your ${CATS[sl]||sl}</h3>
                <p style="margin:0 0 .25em 1em;"><strong>Potential Careers:</strong> ${(s.careers||[]).join(', ')}</p>
                <p style="margin:0 0 1.25em 1em;"><strong>Related Hobbies:</strong> ${(s.hobbies||[]).join(', ')}</p></div>`;
            });
            careerHtml += `</div>`;

            let growthHtml = `<div class="mi-results-section" style="padding:1.5em;background:#f9f9f9;border-radius:8px;">
              <h2 class="mi-section-title">Your Areas for Growth</h2><ol style="padding-left:2em;margin-top:1em;">`;
            bottom3.forEach(it=>{
              const tips = (GROW?.[age]?.[it.slug]?.[it.name]) || fallbackGrow(it.slug, it.name);
              growthHtml += `<li style="margin-bottom:1.25em;">
                <div><strong>${it.name}</strong> (${it.score} / 15) — <em style="color:#555;">${it.parent}</em></div>${bar(it.score)}
                <div style="margin-top:.5em;padding-left:1em;"><strong style="font-size:.9em;color:#333;">How to grow:</strong>
                  <ul style="margin:.25em 0 0 1em;font-size:.9em;color:#555;">${tips.map(t=>`<li>${t}</li>`).join('')}</ul>
                </div>
              </li>`;
            });
            growthHtml += `</ol></div>`;

            let detailedHtml = `<div class="mi-results-section" style="border:1px solid #eee;border-radius:8px;padding:1.5em;">
              <h2 class="mi-section-title">Your Detailed Intelligence Profile</h2>
              <p style="font-size:1.1em;text-align:center;margin-bottom:1em;">${summary}</p>`;
            top3.forEach(sl=>{
              detailedHtml += `<button type="button" class="mi-quiz-accordion-header">${CATS[sl]||sl}</button>
                <div class="mi-quiz-accordion-panel"><div style="padding:1em 0;">`;
              Object.entries(detailed[sl]||{}).forEach(([sub,score])=>{
                detailedHtml += `<div style="margin-left:1em;margin-bottom:1em;"><strong>${sub}:</strong> ${score} / 15 ${bar(score)}</div>`;
              });
              detailedHtml += `</div></div>`;
            });
            detailedHtml += `</div>`;

            let emailForm = `<div class="mi-results-section" style="padding:1.5em;background:#f0f4f8;border-radius:8px;">
              <h2 class="mi-section-title">Get a Copy of Your Results</h2>
              <p>Enter your details below to email a copy of your results to your inbox.</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:1em;">
                <input type="text"  id="mi_first_name"    placeholder="First Name*" required style="grid-column:1/2;padding:10px;border:1px solid #ccc;border-radius:5px;">
                <input type="text"  id="mi_last_name"     placeholder="Last Name"   style="grid-column:2/3;padding:10px;border:1px solid #ccc;border-radius:5px;">
                <input type="email" id="mi_email_address" placeholder="Email Address*" required style="grid-column:1/3;padding:10px;border:1px solid #ccc;border-radius:5px;">
              </div>
              <p style="font-size:.8em;text-align:center;color:#666;margin-top:1em;">By submitting, you agree to receive email communications from us, including our newsletter. You can unsubscribe at any time.</p>
              <div style="text-align:center;margin-top:1em;"><button type="button" id="mi_send_email_btn" class="mi-quiz-button">Send My Results</button></div>
              <p id="mi_email_status" style="margin-top:1em;text-align:center;"></p>
            </div>`;

            resultsDiv.innerHTML = detailedHtml + top5Html + careerHtml + growthHtml + emailForm;

            // accordions
            resultsDiv.querySelectorAll('.mi-quiz-accordion-header').forEach(acc=>{
              acc.addEventListener('click', function(){
                this.classList.toggle('active');
                const p=this.nextElementSibling; p.style.maxHeight = p.style.maxHeight? null : (p.scrollHeight+'px');
              });
            });
            const first = resultsDiv.querySelector('.mi-quiz-accordion-header'); first && setTimeout(()=>first.click(),100);

            devTools && (devTools.style.display='none');
            form2.style.display='none'; resultsDiv.style.display='block';

            // email send + subscribe
            const send=$id('mi_send_email_btn'), status=$id('mi_email_status');
            send && send.addEventListener('click', ()=>{
              const email=$id('mi_email_address').value.trim(),
                    first=$id('mi_first_name').value.trim(),
                    last =$id('mi_last_name').value.trim();
              if(!first){ status.textContent='Please enter your first name.'; status.style.color='red'; return; }
              if(!email || !/\S+@\S+\.\S+/.test(email)){ status.textContent='Please enter a valid email address.'; status.style.color='red'; return; }
              status.textContent='Sending...'; status.style.color='inherit';
              const content = detailedHtml + top5Html + careerHtml + growthHtml;
              const body = new URLSearchParams({ action:'miq_email_results', _ajax_nonce:ajaxNonce, email, first_name:first, last_name:last, results_html:content });
              fetch(ajaxUrl,{ method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body })
                .then(r=>r.json()).then(j=>{
                  if(j.success){ status.textContent=j.data; status.style.color='green'; }
                  else { status.textContent='Error: '+j.data; status.style.color='red'; }
                }).catch(()=>{ status.textContent='An unexpected error occurred.'; status.style.color='red'; });
            });
          }
        })();
        </script>
        <?php
        return ob_get_clean();
    }
}

// Boot + activation
add_action( 'plugins_loaded', static function(){ new MI_Quiz_Plugin_AI(); } );
register_activation_hook( __FILE__, [ 'MI_Quiz_Plugin_AI', 'activate' ] );
