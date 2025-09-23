(function(){
  console.log('MI Quiz JS loaded - Version 9.8.1');
  const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data, cdtQuizUrl } = miq_quiz_data;
  const { cats: CATS, q1: Q1, q2: Q2, career: CAREER, lev: LEV, grow: GROW, skills: SKILLS, pairs: PAIRS, likert: LIKERT, cdtPrompts } = data;
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

  // Helper function to create skills key from top 3 intelligences
  function createSkillsKey(intelligences) {
    if (!intelligences || intelligences.length < 3) return null;
    
    // Map the slugs to the proper names for skills key
    const nameMap = {
      'logical-mathematical': 'Logical-Mathematical',
      'linguistic': 'Linguistic',
      'spatial': 'Visual-Spatial',
      'bodily-kinesthetic': 'Bodily-Kinesthetic',
      'musical': 'Musical',
      'interpersonal': 'Interpersonal',
      'intrapersonal': 'Intrapersonal',
      'naturalistic': 'Naturalistic'
    };
    
    // Sort the intelligences alphabetically to match the skills data structure
    const sortedNames = intelligences.map(slug => nameMap[slug] || slug).sort();
    return sortedNames.join('+');
  }

  // Helper functions for triad and pair scenarios
  function getTriadScenario(intelligence1, intelligence2, intelligence3) {
    // For now, triads are not implemented in the data structure
    // We could synthesize from the existing skills data if needed
    return null;
  }

  function getPairScenario(intelligence1, intelligence2) {
    if (!PAIRS) return null;
    
    // Convert slugs to capitalized names for the pair key
    const nameMap = {
      'logical-mathematical': 'Logical-Mathematical',
      'linguistic': 'Linguistic', 
      'spatial': 'Visual-Spatial',
      'bodily-kinesthetic': 'Bodily-Kinesthetic',
      'musical': 'Musical',
      'interpersonal': 'Interpersonal',
      'intrapersonal': 'Intrapersonal',
      'naturalistic': 'Naturalistic'
    };
    
    const name1 = nameMap[intelligence1] || intelligence1;
    const name2 = nameMap[intelligence2] || intelligence2;
    const pairKey = [name1, name2].sort().join('+');
    
    const statements = PAIRS[pairKey];
    return statements ? { statements } : null;
  }

  function getRandomStatements(statements, count = 2) {
    if (!statements || !Array.isArray(statements) || statements.length === 0) return [];
    const shuffled = [...statements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, statements.length));
  }

  function calculatePercentile(score, maxScore) {
    // Simple percentile calculation - could be enhanced with actual distribution data
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 90;
    if (percentage >= 70) return 75;
    if (percentage >= 60) return 60;
    if (percentage >= 50) return 50;
    if (percentage >= 40) return 35;
    if (percentage >= 30) return 25;
    if (percentage >= 20) return 15;
    return 10;
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
      <div class="results-main-header">
          <div class="site-branding">
              <img src="https://skillofselfdiscovery.com/wp-content/uploads/2025/09/Untitled-design-4.png" alt="Logo" class="site-logo">
              <span class="site-title">Skill of Self-Discovery</span>
          </div>
      </div>
      <div class="mi-results-header">
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

    // Generate amalgamated career/hobby suggestions
    let careerHtml = `<div class="mi-results-section">
      <h2 class="mi-section-title">🚀 Potential Applications</h2>
      <div class="mi-career-grid">`;
    top3.forEach(sl=>{
      const s = CAREER?.[age]?.[sl]; if(!s) return;
      const slugClass = sl.replace('bodily-','').split('-')[0];
      // Amalgamate careers and hobbies into one list
      const allSuggestions = [...(s.careers||[]), ...(s.hobbies||[])];
      careerHtml += `<div class="mi-career-card">
        <div class="mi-career-card-header" style="background-color: var(--mi-color-${slugClass});">
          <h4>For your ${CATS[sl]||sl}</h4>
        </div>
        <div class="mi-career-card-body">
          <ul>${allSuggestions.map(c=>`<li>${c}</li>`).join('')}</ul>
        </div>
      </div>`;
    });
    careerHtml += `</div></div>`;

    // Generate scenarios based on pair combinations
    let scenariosHtml = '';
    
    if (top3.length >= 3) {
      const [top1, top2, top3_intelligence] = top3;
      
      // Get the third intelligence score and calculate its percentile
      const thirdScore = part1Scores[top3_intelligence] || 0;
      const maxPossibleScore = 25; // Assuming 5 questions per intelligence with max score 5
      const thirdPercentile = calculatePercentile(thirdScore, maxPossibleScore);
      
      // Start with triad scenario using existing skills data as fallback
      const skillsKey = createSkillsKey(top3);
      const potentialSkills = SKILLS?.[age]?.[skillsKey];
      let hasTriadContent = false;
      
      if (potentialSkills && potentialSkills.length > 0) {
        // Use existing skills as triad scenario
        const selectedSkills = getRandomStatements(potentialSkills, 2);
        scenariosHtml += `<div class="mi-results-section bg-secondary">
          <h2 class="mi-section-title">✨ Your Unique Combination</h2>
          <p class="mi-scenarios-intro">Your powerful blend of ${names.join(', ')} creates unique possibilities:</p>
          <div class="mi-scenario-card triad-scenario">
            <h3 class="mi-scenario-title">Your Three-Way Strengths</h3>
            <div class="mi-scenario-statements">
              ${selectedSkills.map(skill => `<p class="mi-scenario-statement">• ${skill}</p>`).join('')}
            </div>
          </div>`;
        hasTriadContent = true;
      }
      
      // Conditional pair scenarios based on third score threshold
      const pairScenarios = [];
      
      if (thirdPercentile < 20) {
        // Third score is low - show supporting pairs, prioritizing top1+top2
        const top1Top2Pair = getPairScenario(top1, top2);
        if (top1Top2Pair) {
          pairScenarios.push({
            scenario: top1Top2Pair,
            intelligences: [top1, top2]
          });
        }
        
        // Optionally add one more pair if available
        const top1Top3Pair = getPairScenario(top1, top3_intelligence);
        const top2Top3Pair = getPairScenario(top2, top3_intelligence);
        
        if (top1Top3Pair && pairScenarios.length < 2) {
          pairScenarios.push({
            scenario: top1Top3Pair,
            intelligences: [top1, top3_intelligence]
          });
        } else if (top2Top3Pair && pairScenarios.length < 2) {
          pairScenarios.push({
            scenario: top2Top3Pair,
            intelligences: [top2, top3_intelligence]
          });
        }
      } else {
        // Third score is strong - show 1-2 pairs from all possible combinations
        const allPairs = [
          { scenario: getPairScenario(top1, top2), intelligences: [top1, top2] },
          { scenario: getPairScenario(top1, top3_intelligence), intelligences: [top1, top3_intelligence] },
          { scenario: getPairScenario(top2, top3_intelligence), intelligences: [top2, top3_intelligence] }
        ].filter(pair => pair.scenario); // Only include pairs that exist in our data
        
        // Randomly select 1-2 pairs
        const selectedPairs = allPairs.sort(() => Math.random() - 0.5).slice(0, Math.min(2, allPairs.length));
        pairScenarios.push(...selectedPairs);
      }
      
      // Render pair scenarios
      if (pairScenarios.length > 0) {
        if (!hasTriadContent) {
          scenariosHtml += `<div class="mi-results-section bg-secondary">
            <h2 class="mi-section-title">✨ Your Intelligence Combinations</h2>
            <p class="mi-scenarios-intro">Your intelligence combinations create these special strengths:</p>`;
        } else {
          scenariosHtml += `<div class="mi-pair-scenarios">
            <h3 class="mi-pairs-title">Supporting Pair Strengths</h3>`;
        }
        
        pairScenarios.forEach(({ scenario, intelligences }) => {
          const pairStatements = getRandomStatements(scenario.statements, Math.random() < 0.5 ? 1 : 2);
          const pairNames = intelligences.map(sl => CATS[sl] || sl);
          
          scenariosHtml += `<div class="mi-scenario-card pair-scenario">
            <h4 class="mi-scenario-subtitle">${pairNames.join(' + ')}</h4>
            <div class="mi-scenario-statements">
              ${pairStatements.map(statement => `<p class="mi-scenario-statement">• ${statement}</p>`).join('')}
            </div>
          </div>`;
        });
        
        scenariosHtml += `</div>`;
      }
      
      if (hasTriadContent || pairScenarios.length > 0) {
        scenariosHtml += `</div>`;
      }
    }
    
    // Fallback to traditional skills if no scenarios available
    if (!scenariosHtml) {
      const skillsKey = createSkillsKey(top3);
      const potentialSkills = SKILLS?.[age]?.[skillsKey];
      if (potentialSkills && potentialSkills.length > 0) {
        scenariosHtml = `<div class="mi-results-section bg-secondary">
          <h2 class="mi-section-title">✨ Your Unique Potential</h2>
          <p class="mi-skills-intro">Based on your unique combination of ${top3.map(sl=>CATS[sl]||sl).join(', ')}, here are some things you might excel at:</p>
          <div class="mi-skills-grid">
            ${potentialSkills.map(skill => `<div class="mi-skill-card">${skill}</div>`).join('')}
          </div>
        </div>`;
      }
    }

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
    
    return titleHtml + detailedHtml + top5Html + careerHtml + scenariosHtml;
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

        // Clone the results content to modify it for the PDF without affecting the screen.
        const resultsClone = $id('mi-results-content').cloneNode(true);
        const logoInClone = resultsClone.querySelector('.site-logo');
        if (logoInClone) {
            logoInClone.style.height = '60px';
            logoInClone.style.width = 'auto';
        }
        
        // Strip emojis for the PDF version to prevent rendering issues.
        const emojiRegex = /[\u{1F9E0}\u{2705}\u{1F680}\u{26A1}\u{1F4CA}\u{1F9ED}\u{2B07}\u{1F504}\u{1F5D1}]\u{FE0F}?/gu;
        const pdfHtml = resultsClone.innerHTML.replace(emojiRegex, '').trim();

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

    // Lab Mode Button (for all users)
    const labModeBtn = createActionButton('🧪 Lab Mode', 'mi-quiz-button mi-quiz-button-primary', () => {
        console.log('Lab Mode button clicked!');
        try {
            initializeLabMode();
        } catch (error) {
            console.error('Error initializing Lab Mode:', error);
        }
    });
    actionsContainer.appendChild(labModeBtn);

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

  // ===== LAB MODE FUNCTIONALITY =====
  function initializeLabMode() {
    console.log('initializeLabMode called');
    resultsDiv.style.display = 'none';
    const labMode = $id('mi-lab-mode');
    console.log('Lab mode element:', labMode);
    
    if (!labMode) {
      console.error('Lab mode element not found!');
      return;
    }
    
    labMode.style.display = 'block';
    window.scrollTo(0, 0);
    
    // Initialize CDT challenges
    initializeCDTChallenges();
    
    // Setup quick-select buttons
    setupQuickSelectButtons();
    
    // Setup form handlers
    setupLabFormHandlers();
  }

  function getCDTChallengeOptions() {
    return {
      'Self-Confrontation Capacity': [
        "I struggle to acknowledge when I'm wrong or have made a mistake",
        "I find it difficult to receive constructive criticism without getting defensive",
        "I avoid examining my own biases and assumptions about situations"
      ],
      'Value Conflict Navigation': [
        "I find it hard to work with people whose values differ significantly from mine",
        "I struggle to find common ground when facing opposing viewpoints",
        "I tend to avoid or shut down conversations that involve conflicting beliefs"
      ],
      'Intellectual Humility': [
        "I find it difficult to admit when I don't know something",
        "I struggle to change my mind even when presented with compelling evidence",
        "I have trouble asking for help or guidance from others"
      ],
      'Perspective Integration': [
        "I struggle to see situations from multiple viewpoints simultaneously",
        "I find it hard to synthesize different approaches into a cohesive solution",
        "I tend to stick to one perspective rather than considering alternatives"
      ]
    };
  }

  function getCuriosityExamples() {
    return [
      "How to improve my communication skills",
      "Understanding different learning styles",
      "Exploring creative problem-solving techniques",
      "Developing leadership abilities",
      "Learning about emotional intelligence",
      "Understanding team dynamics",
      "Exploring innovative technologies",
      "Developing critical thinking skills",
      "Understanding cultural differences",
      "Learning about sustainable practices"
    ];
  }

  function getRoleModelExamples() {
    return [
      "Maya Angelou",
      "Steve Jobs",
      "Marie Curie",
      "Nelson Mandela",
      "Oprah Winfrey",
      "Leonardo da Vinci",
      "Albert Einstein",
      "Rosa Parks",
      "Bill Gates",
      "Michelle Obama",
      "Elon Musk",
      "Jane Goodall",
      "Martin Luther King Jr.",
      "Frida Kahlo",
      "Richard Feynman"
    ];
  }

  function getContextTagExamples() {
    return [
      "creative, analytical, social",
      "hands-on, collaborative, structured",
      "independent, research-focused, innovative",
      "team-oriented, practical, goal-driven",
      "artistic, intuitive, experimental",
      "logical, systematic, detail-oriented",
      "interpersonal, empathetic, communication-focused",
      "technical, problem-solving, methodical",
      "entrepreneurial, risk-taking, adaptive",
      "reflective, philosophical, conceptual"
    ];
  }

  function initializeCDTChallenges() {
    console.log('Initializing CDT Challenges...');
    const container = $id('mi-cdt-challenges-container');
    console.log('Container found:', container);
    
    if (!container) {
      console.error('CDT challenges container not found!');
      return;
    }
    
    const challengeOptions = getCDTChallengeOptions();
    console.log('Challenge options:', challengeOptions);
    
    // For demo purposes, show Self-Confrontation and Value Conflict as the "lowest 2"
    const dimensions = ['Self-Confrontation Capacity', 'Value Conflict Navigation'];
    
    let html = '';
    dimensions.forEach(dimension => {
      const options = challengeOptions[dimension] || [];
      const dimensionId = dimension.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      html += `
        <div class="mi-cdt-dimension">
          <h4 class="mi-cdt-dimension-title">${dimension}</h4>
          <div class="mi-cdt-options">
      `;
      
      options.forEach((option, index) => {
        html += `
          <label class="mi-cdt-option">
            <input type="radio" name="cdt_${dimensionId}" value="${option}" required>
            <div class="mi-cdt-option-content">
              <span class="mi-cdt-option-text">${option}</span>
            </div>
          </label>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    console.log('Generated HTML:', html);
    container.innerHTML = html;
    console.log('CDT Challenges initialized successfully');
  }

  function setupQuickSelectButtons() {
    const quickSelectButtons = document.querySelectorAll('.mi-quick-select-btn');
    
    quickSelectButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const exampleType = btn.dataset.examples;
        let examples = [];
        
        switch (exampleType) {
          case 'curiosity':
            examples = getCuriosityExamples();
            break;
          case 'roleModel':
            examples = getRoleModelExamples();
            break;
          case 'contextTag':
            examples = getContextTagExamples();
            break;
        }
        
        if (examples.length > 0) {
          const randomExample = examples[Math.floor(Math.random() * examples.length)];
          const inputGroup = btn.closest('.mi-input-group');
          const input = inputGroup.querySelector('input');
          
          if (exampleType === 'contextTag') {
            // For context tags, replace the entire input value
            input.value = randomExample;
          } else if (exampleType === 'curiosity' || exampleType === 'roleModel') {
            // For curiosity and role models, find the next empty field
            const allInputs = document.querySelectorAll(`input[id*="${exampleType === 'curiosity' ? 'curiosity' : 'role-model'}"]`);
            let targetInput = null;
            
            for (let i = 0; i < allInputs.length; i++) {
              if (!allInputs[i].value.trim()) {
                targetInput = allInputs[i];
                break;
              }
            }
            
            if (targetInput) {
              targetInput.value = randomExample;
            } else {
              // If all fields are filled, replace the clicked one
              input.value = randomExample;
            }
          }
        }
      });
    });
  }

  function setupLabFormHandlers() {
    const generateBtn = $id('mi-generate-experiments');
    const modifyBtn = $id('mi-modify-constraints');
    const startOverBtn = $id('mi-start-over');
    const backBtn = $id('mi-back-to-experiments');
    
    generateBtn.addEventListener('click', generateExperiments);
    modifyBtn.addEventListener('click', returnToForm);
    startOverBtn.addEventListener('click', startOver);
    backBtn.addEventListener('click', backToExperiments);
  }

  function generateExperiments() {
    // Validate form
    const validation = validateLabForm();
    if (!validation.valid) {
      showValidationMessage(validation.message, 'error');
      return;
    }
    
    // Collect form data
    const formData = collectLabFormData();
    
    // Generate experiments based on user's top 3 intelligences and form data
    const experiments = createExperiments(formData);
    
    // Display experiments
    displayExperiments(experiments);
  }

  function validateLabForm() {
    const curiosities = [1, 2, 3].map(i => $id(`mi-curiosity-${i}`).value.trim()).filter(v => v);
    const roleModels = [1, 2, 3].map(i => $id(`mi-role-model-${i}`).value.trim()).filter(v => v);
    const cdtInputs = document.querySelectorAll('input[name^="cdt_"]:checked');
    
    if (curiosities.length < 2) {
      return { valid: false, message: 'Please fill in at least 2 curiosity areas.' };
    }
    
    if (roleModels.length < 2) {
      return { valid: false, message: 'Please fill in at least 2 role models.' };
    }
    
    if (cdtInputs.length < 2) {
      return { valid: false, message: 'Please select a challenge for each CDT dimension.' };
    }
    
    return { valid: true };
  }

  function showValidationMessage(message, type) {
    const msgEl = $id('mi-form-validation-message');
    msgEl.textContent = message;
    msgEl.className = `form-validation-message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 5000);
  }

  function collectLabFormData() {
    return {
      curiosities: [1, 2, 3].map(i => $id(`mi-curiosity-${i}`).value.trim()).filter(v => v),
      roleModels: [1, 2, 3].map(i => $id(`mi-role-model-${i}`).value.trim()).filter(v => v),
      contextTags: $id('mi-context-tags').value.trim(),
      cdtChallenges: Array.from(document.querySelectorAll('input[name^="cdt_"]:checked')).map(input => ({
        dimension: input.name.replace('cdt_', '').replace(/-/g, ' '),
        challenge: input.value
      }))
    };
  }

  function createExperiments(formData) {
    const experiments = [];
    const templates = getExperimentTemplates();
    
    // Create experiments based on top 3 intelligences
    top3.forEach((intelligence, index) => {
      const template = templates[intelligence] || templates.default;
      const experiment = generateExperimentFromTemplate(template, formData, intelligence, index);
      experiments.push(experiment);
    });
    
    return experiments;
  }

  function getExperimentTemplates() {
    return {
      'linguistic': {
        title: 'Linguistic Expression Experiment',
        archetype: 'communication',
        baseSteps: [
          'Choose a curiosity topic and write about it for 15 minutes',
          'Research perspectives from role models on this topic',
          'Create a presentation or article synthesizing your learning'
        ]
      },
      'logical-mathematical': {
        title: 'Analytical Problem-Solving Experiment', 
        archetype: 'analysis',
        baseSteps: [
          'Identify a complex problem related to your curiosities',
          'Break it down using systematic analysis methods',
          'Apply logical frameworks inspired by your role models'
        ]
      },
      'spatial': {
        title: 'Visual Learning Design Experiment',
        archetype: 'visual',
        baseSteps: [
          'Create visual representations of your curiosity topics',
          'Design mind maps connecting role model insights',
          'Build a visual learning portfolio'
        ]
      },
      'bodily-kinesthetic': {
        title: 'Hands-On Learning Experiment',
        archetype: 'kinesthetic', 
        baseSteps: [
          'Design physical activities related to your curiosities',
          'Practice skills demonstrated by your role models',
          'Create tangible projects that demonstrate learning'
        ]
      },
      'musical': {
        title: 'Rhythmic Learning Pattern Experiment',
        archetype: 'musical',
        baseSteps: [
          'Explore curiosities through musical or rhythmic patterns',
          'Study the creative processes of musical role models', 
          'Compose or arrange content in musical formats'
        ]
      },
      'interpersonal': {
        title: 'Collaborative Intelligence Experiment',
        archetype: 'social',
        baseSteps: [
          'Engage others in discussions about your curiosities',
          'Learn from role models through community connections',
          'Facilitate group learning experiences'
        ]
      },
      'intrapersonal': {
        title: 'Self-Directed Discovery Experiment',
        archetype: 'introspective',
        baseSteps: [
          'Conduct deep self-reflection on your curiosities',
          'Journal about role model qualities you want to develop',
          'Design personal growth challenges'
        ]
      },
      'naturalist': {
        title: 'Pattern Recognition Experiment',
        archetype: 'naturalist',
        baseSteps: [
          'Observe patterns in your areas of curiosity',
          'Study how role models recognize and work with patterns',
          'Classify and organize learning insights'
        ]
      },
      'existential': {
        title: 'Meaning-Making Experiment',
        archetype: 'philosophical',
        baseSteps: [
          'Explore the deeper meaning behind your curiosities',
          'Reflect on the life philosophies of your role models',
          'Develop personal frameworks for understanding'
        ]
      },
      default: {
        title: 'Multi-Intelligence Learning Experiment',
        archetype: 'integrated',
        baseSteps: [
          'Approach curiosities from multiple intelligence perspectives',
          'Synthesize diverse role model approaches',
          'Create integrated learning experiences'
        ]
      }
    };
  }

  function generateExperimentFromTemplate(template, formData, intelligence, index) {
    const curiosity = formData.curiosities[index % formData.curiosities.length];
    const roleModel = formData.roleModels[index % formData.roleModels.length];
    const intelligenceName = CATS[intelligence] || intelligence;
    
    // Personalize the title
    const personalizedTitle = template.title.replace('Experiment', `Experiment: ${curiosity.substring(0, 30)}...`);
    
    // Generate personalized steps
    const personalizedSteps = template.baseSteps.map(step => {
      return step
        .replace('curiosity topics', `"${curiosity}"`)
        .replace('your curiosities', `"${curiosity}"`)
        .replace('role models', roleModel)
        .replace('your role models', roleModel);
    });
    
    return {
      id: `exp-${Date.now()}-${index}`,
      title: personalizedTitle,
      intelligence: intelligenceName,
      archetype: template.archetype,
      rationale: `This experiment leverages your ${intelligenceName} intelligence to explore ${curiosity} by learning from ${roleModel}'s approach.`,
      steps: personalizedSteps,
      successCriteria: [
        'Clear insights gained about the chosen topic',
        'Application of role model principles',
        'Measurable skill development'
      ],
      effort: Math.floor(Math.random() * 3) + 2, // 2-4 hours
      risk: Math.floor(Math.random() * 3) + 1,   // Low-Medium risk
      contexts: formData.contextTags.split(',').map(tag => tag.trim()).filter(tag => tag)
    };
  }

  function displayExperiments(experiments) {
    const formContainer = $id('mi-lab-form-container');
    const experimentsContainer = $id('mi-experiments-container');
    const experimentsList = $id('mi-experiments-list');
    
    formContainer.style.display = 'none';
    experimentsContainer.style.display = 'block';
    
    let html = '';
    experiments.forEach(experiment => {
      html += `
        <div class="mi-experiment-card" data-experiment-id="${experiment.id}">
          <div class="mi-experiment-header">
            <h4 class="mi-experiment-title">${experiment.title}</h4>
            <span class="mi-experiment-intelligence">${experiment.intelligence}</span>
          </div>
          <div class="mi-experiment-body">
            <p class="mi-experiment-rationale">${experiment.rationale}</p>
            <div class="mi-experiment-meta">
              <span class="mi-experiment-effort">⏱ ${experiment.effort}h</span>
              <span class="mi-experiment-risk">Risk: ${['Low', 'Medium', 'High'][experiment.risk - 1]}</span>
            </div>
          </div>
          <div class="mi-experiment-actions">
            <button type="button" class="mi-quiz-button mi-quiz-button-small mi-start-experiment" data-experiment-id="${experiment.id}">Start Experiment</button>
            <button type="button" class="mi-quiz-button mi-quiz-button-small mi-quiz-button-secondary mi-regenerate-variant" data-experiment-id="${experiment.id}">Regenerate Variant</button>
          </div>
        </div>
      `;
    });
    
    experimentsList.innerHTML = html;
    
    // Setup experiment action handlers
    setupExperimentHandlers(experiments);
  }

  function setupExperimentHandlers(experiments) {
    // Start experiment buttons
    document.querySelectorAll('.mi-start-experiment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const experimentId = e.target.dataset.experimentId;
        const experiment = experiments.find(exp => exp.id === experimentId);
        if (experiment) {
          displayRunningExperiment(experiment);
        }
      });
    });
    
    // Regenerate variant buttons
    document.querySelectorAll('.mi-regenerate-variant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const experimentId = e.target.dataset.experimentId;
        const experiment = experiments.find(exp => exp.id === experimentId);
        if (experiment) {
          regenerateVariant(experiment, experiments);
        }
      });
    });
  }

  function displayRunningExperiment(experiment) {
    const experimentsContainer = $id('mi-experiments-container');
    const runningContainer = $id('mi-running-experiment');
    const title = $id('mi-running-experiment-title');
    const content = $id('mi-running-experiment-content');
    
    experimentsContainer.style.display = 'none';
    runningContainer.style.display = 'block';
    
    title.textContent = experiment.title;
    
    let html = `
      <div class="mi-running-experiment-content">
        <div class="mi-experiment-section">
          <h4>Rationale</h4>
          <p>${experiment.rationale}</p>
        </div>
        
        <div class="mi-experiment-section">
          <h4>Steps to Follow</h4>
          <ol class="mi-experiment-steps">
    `;
    
    experiment.steps.forEach(step => {
      html += `<li>${step}</li>`;
    });
    
    html += `
          </ol>
        </div>
        
        <div class="mi-experiment-section">
          <h4>Success Criteria</h4>
          <ul class="mi-experiment-criteria">
    `;
    
    experiment.successCriteria.forEach(criteria => {
      html += `<li>${criteria}</li>`;
    });
    
    html += `
          </ul>
        </div>
        
        <div class="mi-experiment-section">
          <h4>Experiment Details</h4>
          <div class="mi-experiment-details">
            <p><strong>Estimated Time:</strong> ${experiment.effort} hours</p>
            <p><strong>Risk Level:</strong> ${['Low', 'Medium', 'High'][experiment.risk - 1]}</p>
            <p><strong>Intelligence Focus:</strong> ${experiment.intelligence}</p>
            ${experiment.contexts.length > 0 ? `<p><strong>Context Tags:</strong> ${experiment.contexts.join(', ')}</p>` : ''}
          </div>
        </div>
      </div>
    `;
    
    content.innerHTML = html;
  }

  function regenerateVariant(originalExperiment, experiments) {
    const formData = collectLabFormData();
    const template = getExperimentTemplates()[originalExperiment.intelligence] || getExperimentTemplates().default;
    
    // Generate a new variant
    const variant = generateLocalVariant(template, formData, originalExperiment);
    
    // Replace the original experiment in the array
    const index = experiments.findIndex(exp => exp.id === originalExperiment.id);
    if (index !== -1) {
      experiments[index] = variant;
    }
    
    // Update the display
    displayExperiments(experiments);
  }

  function generateLocalVariant(template, formData, originalExperiment) {
    // Create a variant with the same archetype but different details
    const variantTemplates = getVariantTemplates();
    const archetypeVariants = variantTemplates[template.archetype] || [];
    const variantTemplate = archetypeVariants[Math.floor(Math.random() * archetypeVariants.length)] || template;
    
    // Use different curiosity/role model for variation
    const curiosityIndex = Math.floor(Math.random() * formData.curiosities.length);
    const roleModelIndex = Math.floor(Math.random() * formData.roleModels.length);
    
    const curiosity = formData.curiosities[curiosityIndex];
    const roleModel = formData.roleModels[roleModelIndex];
    
    return {
      id: `exp-${Date.now()}-variant`,
      title: variantTemplate.title.replace('Experiment', `Experiment: ${curiosity.substring(0, 30)}...`),
      intelligence: originalExperiment.intelligence,
      archetype: template.archetype,
      rationale: `This experiment leverages your ${originalExperiment.intelligence} intelligence to explore ${curiosity} by learning from ${roleModel}'s approach.`,
      steps: variantTemplate.baseSteps.map(step => {
        return step
          .replace('curiosity topics', `"${curiosity}"`)
          .replace('your curiosities', `"${curiosity}"`)
          .replace('role models', roleModel)
          .replace('your role models', roleModel);
      }),
      successCriteria: variantTemplate.successCriteria || originalExperiment.successCriteria,
      effort: Math.floor(Math.random() * 3) + 2,
      risk: Math.floor(Math.random() * 3) + 1,
      contexts: formData.contextTags.split(',').map(tag => tag.trim()).filter(tag => tag)
    };
  }

  function getVariantTemplates() {
    return {
      'communication': [
        {
          title: 'Storytelling Mastery Experiment',
          baseSteps: [
            'Craft compelling narratives around your curiosities',
            'Study the storytelling techniques of your role models',
            'Practice presenting complex ideas through stories'
          ],
          successCriteria: ['Engaging narrative created', 'Story structure mastered', 'Audience engagement achieved']
        },
        {
          title: 'Dialogue Facilitation Experiment',
          baseSteps: [
            'Initiate meaningful conversations about your curiosities',
            'Practice active listening techniques used by role models',
            'Facilitate group discussions on important topics'
          ],
          successCriteria: ['Productive dialogues facilitated', 'Listening skills improved', 'Group engagement enhanced']
        }
      ],
      'analysis': [
        {
          title: 'Systems Thinking Challenge',
          baseSteps: [
            'Map the interconnections within your curiosity areas',
            'Apply systems analysis methods from role models',
            'Identify leverage points for maximum impact'
          ],
          successCriteria: ['System map created', 'Leverage points identified', 'Strategic insights gained']
        }
      ],
      'visual': [
        {
          title: 'Infographic Design Challenge',
          baseSteps: [
            'Transform curiosity insights into visual formats',
            'Study the visual communication style of role models',
            'Create compelling infographics for complex topics'
          ],
          successCriteria: ['Clear visual communication', 'Design principles applied', 'Information effectively conveyed']
        }
      ]
    };
  }

  function returnToForm() {
    const formContainer = $id('mi-lab-form-container');
    const experimentsContainer = $id('mi-experiments-container');
    
    experimentsContainer.style.display = 'none';
    formContainer.style.display = 'block';
  }

  function startOver() {
    if (confirm('Are you sure you want to start over? This will clear all your current inputs.')) {
      // Reset form
      const form = $id('mi-lab-form');
      form.reset();
      
      // Clear CDT selections
      document.querySelectorAll('input[name^="cdt_"]').forEach(input => {
        input.checked = false;
      });
      
      // Show form, hide experiments
      returnToForm();
    }
  }

  function backToExperiments() {
    const experimentsContainer = $id('mi-experiments-container');
    const runningContainer = $id('mi-running-experiment');
    
    runningContainer.style.display = 'none';
    experimentsContainer.style.display = 'block';
  }

})();
