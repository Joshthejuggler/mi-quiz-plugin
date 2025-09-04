(function(){
  const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data, cdtQuizUrl } = miq_quiz_data;
  const { cats: CATS, q1: Q1, q2: Q2, career: CAREER, lev: LEV, grow: GROW, likert: LIKERT, cdtPrompts } = data;
  const isLoggedIn = !!currentUser;

  const $id=(s)=>document.getElementById(s);
  const ageGate=$id('mi-age-gate'), form1=$id('mi-quiz-form-part1'), form2=$id('mi-quiz-form-part2'),
        inter=$id('mi-quiz-intermission'), resultsDiv=$id('mi-quiz-results'),
        devTools=$id('mi-dev-tools'), autoBtn=$id('mi-autofill-run');

  let age='adult', top3=[], detailed={}, top5=[], bottom3=[], part1Scores={};

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  function build(form, items, onDone){
    if(!items.length){ alert('No questions available.'); return; }
    let h = `
      <div class="mi-progress-wrapper">
        <div class="mi-progress-container">
          <div class="mi-progress-bar"></div>
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

  function autoFill(form, both = false) {
    const steps=form.querySelectorAll('.mi-step'), submit=form.querySelector('.mi-submit-final');

    // --- New logic for more random results ---
    let biasMap = {};
    if (form === form1) {
        const categories = shuffle(Object.keys(CATS));
        // Create a clear separation of scores to ensure random top/bottom 3
        categories.forEach((cat, index) => {
            if (index < 3) {
                biasMap[cat] = 'high'; // These will be the top 3
            } else if (index < 6) {
                biasMap[cat] = 'low'; // These will be in the bottom
            } else {
                biasMap[cat] = 'mid'; // The rest are in the middle
            }
        });
    }
    // --- End new logic ---

    let k=0; (function tick(){
      if(k>=steps.length){ submit?.click(); if(both && form===form1){ setTimeout(()=>{ $id('mi-start-part2')?.click(); setTimeout(()=>autoFill(form2,false),200); },200);} return; }
      
      let pick;
      const step = steps[k];
      const category = step.dataset.cat;

      if (form === form1 && biasMap[category]) {
          const bias = biasMap[category];
          if (bias === 'high') { pick = Math.floor(Math.random() * 2) + 4; } // 4 or 5
          else if (bias === 'low') { pick = Math.floor(Math.random() * 2) + 1; } // 1 or 2
          else { pick = Math.floor(Math.random() * 2) + 3; } // 3 or 4
      } else {
          // Original random logic for part 2 or if something goes wrong
          pick = Math.floor(Math.random() * 5) + 1;
      }

      const radio = step.querySelector('input[value="'+pick+'"]');
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      k++; setTimeout(tick,16);
    })();
  }
  autoBtn && autoBtn.addEventListener('click', ()=>autoFill(form1,true));
 
  // Use a predictable key for localStorage to hold results for a user who needs to log in.
  const PENDING_RESULTS_KEY = 'miq_pending_results';
  function storeQuizResults(results) {
      localStorage.setItem(PENDING_RESULTS_KEY, JSON.stringify(results));
  }
  function getStoredQuizResults() {
      const storedData = localStorage.getItem(PENDING_RESULTS_KEY);
      try { return storedData ? JSON.parse(storedData) : null; } catch (e) { return null; }
  }
  function clearStoredQuizResults() {
      localStorage.removeItem(PENDING_RESULTS_KEY);
  }

  function showLoginRegister(emailHtml, resultsData) {
      resultsDiv.innerHTML = `
          <div class="mi-results-section bg-secondary">
              <h2 class="mi-section-title">Get Your Full Results & Action Plan</h2>
              <p>Enter your name and email to create your free account. We'll instantly email you a copy of your results and show them on the next screen.</p>
              <form id="mi-magic-register-form">
                  <div class="mi-form-field">
                      <label for="mi_reg_first_name">First Name</label>
                      <input type="text" id="mi_reg_first_name" required>
                  </div>
                  <div class="mi-form-field">
                      <label for="mi_reg_email">Email Address</label>
                      <input type="email" id="mi_reg_email" required>
                  </div>
                  <div class="form-submit-wrapper">
                      <button type="button" id="mi_magic_register_btn" class="mi-quiz-button">Email My Results & Create Account</button>
                  </div>
                  <p id="mi_reg_status" class="form-status"></p>
              </form>
              <p class="form-secondary-action">Already have an account? <a href="${loginUrl}">Log in here</a>.</p>
          </div>`;
      form2.style.display = 'none';
      resultsDiv.style.display = 'block';

      const regBtn = $id('mi_magic_register_btn');
      const statusEl = $id('mi_reg_status');
      $id('mi-magic-register-form').addEventListener('submit', e => e.preventDefault());
      regBtn.addEventListener('click', () => {
          const email = $id('mi_reg_email').value.trim();
          const firstName = $id('mi_reg_first_name').value.trim();

          if (!firstName) { statusEl.innerHTML = 'Please enter your first name.'; statusEl.style.color = 'red'; return; }
          if (!email || !/\S+@\S+\.\S+/.test(email)) { statusEl.innerHTML = 'Please enter a valid email address.'; statusEl.style.color = 'red'; return; }

          statusEl.innerHTML = 'Creating your account...';
          statusEl.style.color = 'inherit';
          regBtn.disabled = true;

          const body = new URLSearchParams({ 
              action: 'miq_magic_register', 
              _ajax_nonce: ajaxNonce, 
              email: email, 
              first_name: firstName, 
              results_html: emailHtml,
              results_data: JSON.stringify(resultsData) // Send the raw data
          });

          fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
          .then(r => r.json())
          .then(j => {
              if (j.success) {
                  statusEl.innerHTML = j.data;
                  statusEl.style.color = 'green';
                  setTimeout(() => window.location.reload(), 1500);
              } else {
                  let errorMsg = 'An unknown error occurred. Please try again.';
                  if (j.data) {
                      errorMsg = typeof j.data === 'string' ? j.data : (j.data.message || JSON.stringify(j.data));
                  }
                  statusEl.innerHTML = 'Error: ' + errorMsg;
                  statusEl.style.color = 'red';
                  regBtn.disabled = false;
              }
          }).catch(() => {
              statusEl.innerHTML = 'An unexpected error occurred. Please try again.';
              statusEl.style.color = 'red';
              regBtn.disabled = false;
          });
      });
  }
  
  // Age → start Part 1
  ageGate.querySelectorAll('.mi-quiz-button').forEach(btn=>{
    btn.addEventListener('click', e=>{
      age = e.currentTarget.dataset.ageGroup || 'adult';
      ageGate.style.display='none';
      if (devTools) devTools.style.display = 'block';
      form1.style.display='block';

      build(form1, part1Items(), steps=>{
        const scores={}; Object.keys(CATS).forEach(k=>scores[k]=0);
        steps.forEach(s=>{
          const cat=s.getAttribute('data-cat'), v=s.querySelector('input[type=radio]:checked')?.value;
          if(cat && v) scores[cat]=(scores[cat]||0)+parseInt(v,10);
        });
        part1Scores = scores;
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
    window.scrollTo(0,0)
  });

  const bar = (score, max=15, slug='default') => {
    const pct=Math.max(0,Math.min(100,(score/max)*100));
    const slugClass = slug ? `bar-${slug.replace('bodily-','').split('-')[0]}` : '';
    return `<div class="bar-wrapper"><div class="bar-inner ${slugClass}" style="width:${pct}%;"></div></div>`;
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
    detailed={};
    const src = Q2[age] || Q2['adult'] || {};
    top3.forEach(sl=>{ detailed[sl]={}; Object.keys(src[sl]||{}).forEach(sub=> detailed[sl][sub]=0); });
    (p2Steps||[]).forEach(s=>{
      const cat=s.getAttribute('data-cat'), sub=s.getAttribute('data-subcat');
      const v=s.querySelector('input[type=radio]:checked')?.value;
      if(v && detailed[cat] && sub in detailed[cat]) detailed[cat][sub]+=parseInt(v,10);
    });

    const subs=[];
    Object.entries(detailed).forEach(([slug,obj])=>{
      const parent=CATS[slug]||slug; Object.entries(obj).forEach(([name,score])=>subs.push({name,score,parent,slug}));
    });
    subs.sort((a,b)=>b.score-a.score);
    top5=subs.slice(0,5); bottom3=subs.slice(-3).reverse();

    const resultsData = { detailed, top5, bottom3, top3, age, part1Scores };

    if (!isLoggedIn) {
        const emailHtml = generateResultsHtml();
        showLoginRegister(emailHtml, resultsData);
        return;
    }

    // For logged-in users, save and email immediately.
    // 1. Save to DB
    const saveBody = new URLSearchParams({ action: 'miq_save_user_results', _ajax_nonce: ajaxNonce, user_id: currentUser.id, results: JSON.stringify(resultsData) });
    fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: saveBody });

    // 2. Email results
    const emailHtml = generateResultsHtml();
    const emailBody = new URLSearchParams({ action: 'miq_email_results', _ajax_nonce: ajaxNonce, email: currentUser.email, first_name: currentUser.firstName || 'Quiz Taker', last_name: currentUser.lastName || '', results_html: emailHtml });
    fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: emailBody });

    // 3. Render the results on screen
    renderResults();
  }

  function generateResultsHtml() {
    const userFirstName = currentUser ? currentUser.firstName : 'Valued User';
    const titleHtml = `
      <div class="mi-results-header">
        <div class="mi-results-header-icon">🧠</div>
        <h1>Your Multiple Intelligences Results</h1>
        <h2>Results for ${userFirstName}</h2>
        <p class="mi-results-metadata">Generated on: ${new Date().toLocaleDateString()}</p>
      </div>
    `;

    const names = top3.map(sl=>CATS[sl]||sl);
    const summary = names.length>=3 ? `Your detailed profile highlights a powerful combination of ${names[0]}, ${names[1]}, and ${names[2]}.` : 'Here is your detailed profile.';

    let top5Html = `<div class="mi-results-section bg-secondary">
      <h2 class="mi-section-title">✅ Your Top 5 Strengths</h2>
      <div class="mi-strengths-grid">`;
    top5.forEach(it=>{
      const tips = (LEV?.[age]?.[it.slug]?.[it.name] || []);
      top5Html += `<div class="mi-strength-card">
        <h4>${it.name}</h4>
        <p><em>Part of ${it.parent}</em></p>
        <strong class="leverage-title">To leverage this:</strong>
        <ul class="leverage-list">${tips.map(t=>`<li>${t}</li>`).join('')}</ul>
      </div>`;
    });
    top5Html += `</div></div>`;

    let careerHtml = `<div class="mi-results-section">
      <h2 class="mi-section-title">🚀 Career & Hobby Suggestions</h2>
      <div class="mi-career-grid">`;
    top3.forEach(sl=>{
      const s = CAREER?.[age]?.[sl]; if(!s) return;
      const slugClass = sl.replace('bodily-','').split('-')[0];
      careerHtml += `<div class="mi-career-card">
        <div class="mi-career-card-header" style="background-color: var(--mi-color-${slugClass});">
          <h4>For your ${CATS[sl]||sl}</h4>
        </div>
        <div class="mi-career-card-body">
          <p><strong>Potential Careers:</strong></p>
          <ul>${(s.careers||[]).map(c=>`<li>${c}</li>`).join('')}</ul>
          <p><strong>Related Hobbies:</strong></p>
          <ul>${(s.hobbies||[]).map(h=>`<li>${h}</li>`).join('')}</ul>
        </div>
      </div>`;
    });
    careerHtml += `</div></div>`;

    let growthHtml = `<div class="mi-results-section bg-secondary">
      <h2 class="mi-section-title">⚡️ Your Areas for Growth</h2>
      <div class="mi-strengths-grid">`;
    bottom3.forEach(it=>{
      const tips = (GROW?.[age]?.[it.slug]?.[it.name]) || fallbackGrow(it.slug, it.name);
      growthHtml += `<div class="mi-strength-card">
        <h4>${it.name}</h4>
        <p><em>Part of ${it.parent}</em></p>
        <strong class="growth-title">How to grow:</strong>
        <ul class="growth-list">${tips.map(t=>`<li>${t}</li>`).join('')}</ul>
      </div>`;
    });
    growthHtml += `</div></div>`;

    // Simplified detailed results - no accordions
    let detailedHtml = `<div class="mi-results-section">
      <h2 class="mi-section-title">📊 Your Detailed Intelligence Profile</h2>
      <p class="summary">${summary}</p>`;
    top3.forEach(sl=>{
      const slugClass = sl.replace('bodily-','').split('-')[0];
      detailedHtml += `<h3 class="mi-subsection-title" style="border-left-color: var(--mi-color-${slugClass});">${CATS[sl]||sl}</h3>
      <div class="mi-detailed-grid">`;
      Object.entries(detailed[sl]||{}).forEach(([sub,score])=>{
        detailedHtml += `<div class="detailed-score"><strong>${sub}:</strong> ${score} / 15 ${bar(score, 15, sl)}</div>`;
      });
      detailedHtml += `</div>`;
    });
    detailedHtml += `</div>`;
    
    return titleHtml + detailedHtml + top5Html + careerHtml + growthHtml;
  }

  function renderResults() {
    resultsDiv.innerHTML = `
        <div id="mi-results-content">${generateResultsHtml()}</div>
        <div id="mi-results-actions" class="results-actions-container"></div>
    `;

    const actionsContainer = $id('mi-results-actions');

    // Helper to create buttons, reducing code repetition.
    function createActionButton(text, classes, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = classes;
        btn.textContent = text;
        btn.addEventListener('click', onClick);
        return btn;
    }

    // --- Create and Append Buttons ---

    // Download PDF Button
    const downloadBtn = createActionButton('⬇️ Download PDF', 'mi-quiz-button mi-quiz-button-primary', (e) => {
        const btn = e.currentTarget;
        btn.textContent = 'Generating...';
        btn.disabled = true;

        // Clone the results content and strip emojis for the PDF version to prevent rendering issues.
        const emojiRegex = /[\u{1F9E0}\u{2705}\u{1F680}\u{26A1}\u{1F4CA}\u{1F9ED}\u{2B07}\u{1F504}\u{1F5D1}]\u{FE0F}?/gu;
        const pdfHtml = $id('mi-results-content').innerHTML.replace(emojiRegex, '').trim();

        const body = new URLSearchParams({ action: 'miq_generate_pdf', _ajax_nonce: ajaxNonce, results_html: pdfHtml });
        fetch(ajaxUrl, { method: 'POST', body })
            .then(response => response.ok ? response.blob() : Promise.reject('Network response was not ok.'))
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `mi-quiz-results-${new Date().toISOString().slice(0,10)}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            })
            .catch(error => {
                console.error('PDF Download Error:', error);
                alert('Sorry, there was an error generating the PDF.');
            })
            .finally(() => {
                btn.textContent = '⬇️ Download PDF';
                btn.disabled = false;
            });
    });
    actionsContainer.appendChild(downloadBtn);

    // --- Add Logged-In User Buttons ---
    if (isLoggedIn) {
        // Retake Quiz Button
        const retakeBtn = createActionButton('🔄 Retake Quiz', 'mi-quiz-button mi-quiz-button-secondary', () => {
            if (confirm('Are you sure? Your saved results will be overwritten when you complete the new quiz.')) {
                resultsDiv.style.display = 'none';
                resultsDiv.innerHTML = '';
                ageGate.style.display = 'block';
                window.scrollTo(0, 0);
            }
        });
        actionsContainer.appendChild(retakeBtn);

        // Delete Results Button
        const deleteBtn = createActionButton('🗑️ Delete My Results', 'mi-quiz-button mi-quiz-button-danger', (e) => {
            if (!confirm('Are you sure you want to permanently delete your saved results? This cannot be undone.')) return;
            
            const btn = e.currentTarget;
            btn.textContent = 'Deleting...';
            btn.disabled = true;

            const body = new URLSearchParams({ action: 'miq_delete_user_results', _ajax_nonce: ajaxNonce });
            fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
                .then(r => r.json())
                .then(j => {
                    if (j.success) {
                        currentUser.savedResults = null;
                        top3 = []; detailed = {}; top5 = []; bottom3 = [];
                        alert('Your results have been deleted.');
                        resultsDiv.style.display = 'none';
                        resultsDiv.innerHTML = '';
                        ageGate.style.display = 'block';
                        window.scrollTo(0,0);
                    } else {
                        alert('Error: ' + (j.data || 'Could not delete results.'));
                        btn.textContent = '🗑️ Delete My Results';
                        btn.disabled = false;
                    }
                });
        });
        actionsContainer.appendChild(deleteBtn);
    }

    // --- Add CDT Prompt Section (after buttons) ---
    if (cdtPrompts && cdtQuizUrl && top3 && top3.length >= 3) {
        const sortedTop3 = [...top3].sort();
        const promptKey = sortedTop3.join('_');
        const promptData = cdtPrompts[promptKey];

        if (promptData && promptData.prompt) {
            const cdtPromptHtml = `
                <div class="mi-results-section cdt-prompt-section">
                    <h2 class="mi-section-title">🧭 Your Next Step: The Skill of Self-Discovery</h2>
                    <p>${promptData.prompt}</p>
                    <div style="text-align: center; margin-top: 1.5em;">
                        <a href="${cdtQuizUrl}" class="mi-quiz-button mi-quiz-button-primary mi-quiz-button-next-step">Take the CDT Quiz Now</a>
                    </div>
                </div>
            `;
            // Append this section to the main results container, so it appears after the action buttons.
            resultsDiv.insertAdjacentHTML('beforeend', cdtPromptHtml);
        }
    }


    // --- Finalize Display ---
    devTools && (devTools.style.display='none');
    form2.style.display='none'; resultsDiv.style.display='block';
    window.scrollTo(0,0);
  }

  // On page load, check for any existing results to display
  if (currentUser) {
      if (currentUser.savedResults) {
          const r = currentUser.savedResults;
          age = r.age || 'adult';
          top3 = r.top3 || [];
          detailed = r.detailed || {};
          top5 = r.top5 || [];
          bottom3 = r.bottom3 || [];
          part1Scores = r.part1Scores || {};

          ageGate.style.display = 'none';
          renderResults();

          return;
      }
  }
})();
