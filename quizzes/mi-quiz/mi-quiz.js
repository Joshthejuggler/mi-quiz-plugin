(function(){
  const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data } = miq_quiz_data;
  const { cats: CATS, q1: Q1, q2: Q2, career: CAREER, lev: LEV, grow: GROW, likert: LIKERT } = data;
  const isLoggedIn = !!currentUser;

  const $id=(s)=>document.getElementById(s);
  const ageGate=$id('mi-age-gate'), form1=$id('mi-quiz-form-part1'), form2=$id('mi-quiz-form-part2'),
        inter=$id('mi-quiz-intermission'), resultsDiv=$id('mi-quiz-results'),
        devTools=$id('mi-dev-tools'), autoBtn=$id('mi-autofill-run');

  let age='adult', top3=[], detailed={}, top5=[], bottom3=[];

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

  function showLoginRegister(emailHtml) {
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

          const body = new URLSearchParams({ action: 'miq_magic_register', _ajax_nonce: ajaxNonce, email: email, first_name: firstName, results_html: emailHtml });

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

  const bar = (score,max=15)=>{
    const pct=Math.max(0,Math.min(100,(score/max)*100));
    const col=pct>=75?'#4CAF50':(pct<40?'#f44336':'#ffc107');
    return `<div class="bar-wrapper"><div class="bar-inner" style="width:${pct}%;background-color:${col};"></div></div>`;
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

    if (!isLoggedIn) {
        const resultsToStore = { detailed, top5, bottom3, top3, age };
        storeQuizResults(resultsToStore);
        const emailHtml = generateResultsHtml();
        showLoginRegister(emailHtml);
        return;
    }
    renderResults();
  }

  function generateResultsHtml() {
    const titleHtml = `
      <div class="pdf-title-page">
        <h1>Your Multiple Intelligences Results</h1>
        ${currentUser ? `<h2>For: ${currentUser.firstName}</h2>` : ''}
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
      </div>
    `;

    const names = top3.map(sl=>CATS[sl]||sl);
    const summary = names.length>=3 ? `Your detailed profile highlights a powerful combination of ${names[0]}, ${names[1]}, and ${names[2]}.` : 'Here is your detailed profile.';

    let top5Html = `<div class="mi-results-section bg-tertiary">
      <h2 class="mi-section-title">Your Top 5 Strengths</h2><ol>`;
    top5.forEach(it=>{
      const tips = (LEV?.[age]?.[it.slug]?.[it.name] || []);
      top5Html += `<li><div><strong>${it.name}</strong> (${it.score} / 15) — <em>${it.parent}</em></div>${bar(it.score)}`;
      if (tips.length){
        top5Html += `<div><strong class="leverage-title">How to leverage:</strong>
        <ul class="leverage-list">${tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`;
      }
      top5Html += `</li>`;
    });
    top5Html += `</ol></div>`;

    let careerHtml = `<div class="mi-results-section bg-tertiary">
      <h2 class="mi-section-title">Career & Hobby Suggestions</h2>`;
    top3.forEach(sl=>{
      const s = CAREER?.[age]?.[sl]; if(!s) return;
      careerHtml += `<div><h3 class="mi-subsection-title">For your ${CATS[sl]||sl}</h3>
        <p class="career-item"><strong>Potential Careers:</strong> ${(s.careers||[]).join(', ')}</p>
        <p class="hobby-item"><strong>Related Hobbies:</strong> ${(s.hobbies||[]).join(', ')}</p></div>`;
    });
    careerHtml += `</div>`;

    let growthHtml = `<div class="mi-results-section bg-tertiary">
      <h2 class="mi-section-title">Your Areas for Growth</h2><ol>`;
    bottom3.forEach(it=>{
      const tips = (GROW?.[age]?.[it.slug]?.[it.name]) || fallbackGrow(it.slug, it.name);
      growthHtml += `<li>
        <div><strong>${it.name}</strong> (${it.score} / 15) — <em>${it.parent}</em></div>${bar(it.score)}
        <div><strong class="growth-title">How to grow:</strong>
          <ul class="growth-list">${tips.map(t=>`<li>${t}</li>`).join('')}</ul>
        </div>
      </li>`;
    });
    growthHtml += `</ol></div>`;

    // Simplified detailed results - no accordions
    let detailedHtml = `<div class="mi-results-section bordered">
      <h2 class="mi-section-title">Your Detailed Intelligence Profile</h2>
      <p class="summary">${summary}</p>`;
    top3.forEach(sl=>{
      detailedHtml += `<h3 class="mi-subsection-title">${CATS[sl]||sl}</h3><div class="accordion-content-wrapper">`;
      Object.entries(detailed[sl]||{}).forEach(([sub,score])=>{
        detailedHtml += `<div class="detailed-score"><strong>${sub}:</strong> ${score} / 15 ${bar(score)}</div>`;
      });
      detailedHtml += `</div>`;
    });
    detailedHtml += `</div>`;
    
    return titleHtml + detailedHtml + top5Html + careerHtml + growthHtml;
  }

  function renderResults(isPostRegistration = false) {
    const resultsContent = generateResultsHtml();

    resultsDiv.innerHTML = `
        <div id="mi-results-content">${resultsContent}</div>
        <div id="mi-results-actions" class="results-actions-container"></div>
    `;

    const actionsContainer = $id('mi-results-actions');

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'mi-quiz-button';
    downloadBtn.textContent = 'Download PDF';
    downloadBtn.addEventListener('click', () => {
        downloadBtn.textContent = 'Generating...';
        downloadBtn.disabled = true;

        // This new approach sends the HTML to the server for reliable PDF generation.
        const resultsHtml = $id('mi-results-content').innerHTML;
        const body = new URLSearchParams({
            action: 'miq_generate_pdf',
            _ajax_nonce: ajaxNonce,
            results_html: resultsHtml
        });

        fetch(ajaxUrl, { method: 'POST', body })
            .then(response => {
                if (response.ok) return response.blob();
                throw new Error('Network response was not ok.');
            })
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
                downloadBtn.textContent = 'Download PDF';
                downloadBtn.disabled = false;
            });
    });
    actionsContainer.appendChild(downloadBtn);

    if (isLoggedIn && !isPostRegistration) {
        const content = generateResultsHtml();
        const body = new URLSearchParams({
            action: 'miq_email_results',
            _ajax_nonce: ajaxNonce,
            email: currentUser.email,
            first_name: currentUser.firstName || 'Quiz Taker',
            last_name: currentUser.lastName || '',
            results_html: content
        });
        fetch(ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    }

    if (currentUser) {
        const resultsData = { detailed, top5, bottom3, top3, age };
        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'miq_save_user_results',
                _ajax_nonce: ajaxNonce,
                user_id: currentUser.id,
                results: JSON.stringify(resultsData)
            })
        });
    }

    if (isLoggedIn) {
        const retakeBtn = document.createElement('button');
        retakeBtn.type = 'button';
        retakeBtn.className = 'mi-quiz-button';
        retakeBtn.textContent = 'Retake Quiz';
        retakeBtn.addEventListener('click', () => {
            if (confirm('Are you sure? Your saved results will be overwritten when you complete the new quiz.')) {
                resultsDiv.style.display = 'none';
                resultsDiv.innerHTML = '';
                ageGate.style.display = 'block';
                window.scrollTo(0, 0);
            }
        });
        actionsContainer.appendChild(retakeBtn);
    }

    devTools && (devTools.style.display='none');
    form2.style.display='none'; resultsDiv.style.display='block';
    window.scrollTo(0,0);
  }

  // On page load, check for any existing results to display
  if (currentUser) {
      const pendingResults = getStoredQuizResults();
      if (pendingResults) {
          age = pendingResults.age;
          top3 = pendingResults.top3;
          detailed = pendingResults.detailed;
          top5 = pendingResults.top5;
          bottom3 = pendingResults.bottom3;

          ageGate.style.display = 'none';
          renderResults(true);
          
          clearStoredQuizResults();
          return;
      }

      if (currentUser.savedResults) {
          age = currentUser.savedResults.age;
          top3 = currentUser.savedResults.top3;
          detailed = currentUser.savedResults.detailed;
          top5 = currentUser.savedResults.top5;
          bottom3 = currentUser.savedResults.bottom3;

          ageGate.style.display = 'none';
          renderResults();

          return;
      }
  }
})();
