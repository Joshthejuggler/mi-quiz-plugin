(function() {
    // --- Setup ---
    const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data } = cdt_quiz_data;
    const { cats: CATS, questions: QUESTIONS, likert: LIKERT } = data;
    const isLoggedIn = !!currentUser;
    const container = document.getElementById('cdt-quiz-container');
    if (!container) return;

    let quizState = {
        scores: {},
        sortedScores: [],
        ageGroup: 'adult'
    };

    // --- Utility Functions ---
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
    const $id = (id) => document.getElementById(id);

    // --- Render Functions ---
    function renderAgeGate() {
        container.innerHTML = `
            <div class="cdt-quiz-card">
              <h2 class="cdt-section-title">Cognitive Dissonance Tolerance Quiz</h2>
              <p>To begin, please select the option that best describes you:</p>
              <div class="cdt-age-options">
                <button type="button" class="cdt-quiz-button" data-age-group="teen">12–18</button>
                <button type="button" class="cdt-quiz-button" data-age-group="graduate">18–24</button>
                <button type="button" class="cdt-quiz-button" data-age-group="adult">Working Professional</button>
              </div>
              <div class="cdt-quiz-notice">
                <p>${isLoggedIn ? 'Your results will be saved to your profile.' : `You can <a href="${loginUrl}">log in or create an account</a> to save your results.`}</p>
              </div>
            </div>`;

        container.querySelectorAll('.cdt-quiz-button[data-age-group]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                quizState.ageGroup = e.currentTarget.dataset.ageGroup;
                renderQuiz();
            });
        });
    }

    function renderQuiz() {
        const questionSet = QUESTIONS[quizState.ageGroup] || QUESTIONS['adult'];
        if (!questionSet) {
            container.innerHTML = `<div class="cdt-quiz-card"><p>Sorry, no questions could be found for your selected group.</p></div>`;
            return;
        }

        const items = [];
        Object.entries(questionSet).forEach(([slug, arr]) => {
            arr.forEach(q => items.push({ cat: slug, text: q.text, reverse: q.reverse }));
        });
        const questions = shuffle(items);

        let html = `
            <div class="cdt-progress-container"><div class="cdt-progress-bar"></div></div>
            <div class="cdt-steps-container">`;

        questions.forEach((q, i) => {
            let opts = '';
            for (let v = 1; v <= 5; v++) {
                opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
            }
            html += `<div class="cdt-step" data-step="${i}" data-cat="${q.cat}" data-reverse="${q.reverse}" style="display:none;">
                        <div class="cdt-quiz-card">
                            <p class="cdt-quiz-question-text">${q.text}</p>
                            <div class="cdt-quiz-likert-options">${opts}</div>
                        </div>
                     </div>`;
        });
        html += `</div><div class="cdt-quiz-footer"><button type="button" id="cdt-prev-btn" class="cdt-quiz-button" disabled>Previous</button></div>`;
        container.innerHTML = html;

        const steps = container.querySelectorAll('.cdt-step');
        const prevBtn = $id('cdt-prev-btn');
        const bar = container.querySelector('.cdt-progress-bar');
        let currentStep = 0;
        const totalSteps = steps.length;

        const showStep = (k) => {
            steps.forEach((s, j) => s.style.display = j === k ? 'block' : 'none');
            prevBtn.disabled = (k === 0);
            bar.style.width = ((k + 1) / totalSteps * 100) + '%';
            
            const allAnswered = Array.from(steps).every(s => s.querySelector('input:checked'));
            if (allAnswered) {
                calculateAndShowResults();
            }
        };

        prevBtn.addEventListener('click', () => { if (currentStep > 0) { currentStep--; showStep(currentStep); } });
        steps.forEach((s, k) => s.querySelectorAll('input[type=radio]').forEach(inp => inp.addEventListener('change', () => {
            setTimeout(() => { 
                if (k < totalSteps - 1) { 
                    currentStep = k + 1; 
                    showStep(currentStep); 
                } else { 
                    showStep(k); // Stay on last step to check if all are answered
                } 
            }, 150);
        })));

        showStep(0);
    }

    function calculateAndShowResults() {
        const scores = {};
        Object.keys(CATS).forEach(k => scores[k] = 0);
        
        container.querySelectorAll('.cdt-step').forEach(s => {
            const cat = s.getAttribute('data-cat');
            const isReverse = s.getAttribute('data-reverse') === 'true';
            const val = s.querySelector('input:checked')?.value;
            
            if (cat && val) {
                let score = parseInt(val, 10);
                if (isReverse) {
                    score = 6 - score; // Reverse score (1->5, 2->4, 3->3, 4->2, 5->1)
                }
                scores[cat] += score;
            }
        });

        quizState.scores = scores;
        quizState.sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

        renderResults();
    }

    function renderResults() {
        const { sortedScores } = quizState;
        const maxScore = 50; // 10 questions per category, max score 5 each.

        const bar = (score, max) => {
            const pct = Math.max(0, Math.min(100, (score / max) * 100));
            const col = pct >= 75 ? '#4CAF50' : (pct < 40 ? '#f44336' : '#ffc107');
            return `<div class="cdt-bar-wrapper"><div class="cdt-bar-inner" style="width:${pct}%;background-color:${col};"></div></div>`;
        };

        let resultsHtml = `
            <div class="cdt-quiz-card">
                <h2>Your Cognitive Dissonance Tolerance Profile</h2>
                <ul class="cdt-results-list">`;
        sortedScores.forEach(([slug, score]) => {
            resultsHtml += `
                <li class="cdt-result-item">
                    <div class="cdt-result-title">${CATS[slug]}</div>
                    <div class="cdt-result-score">${score} / ${maxScore}</div>
                    ${bar(score, maxScore)}
                </li>`;
        });
        resultsHtml += `</ul>
            <div id="cdt-results-actions" class="cdt-results-actions">
                <button type="button" id="cdt-retake-btn" class="cdt-quiz-button">Retake Quiz</button>
            </div>
        </div>`;
        container.innerHTML = resultsHtml;
        
        $id('cdt-retake-btn').addEventListener('click', () => {
            const msg = isLoggedIn 
                ? 'Are you sure? Your saved results will be overwritten when you complete the new quiz.' 
                : 'Are you sure you want to start over?';
            if (confirm(msg)) {
                renderAgeGate();
                window.scrollTo(0, 0);
            }
        });

        if (isLoggedIn) {
            saveResultsToServer();

            // Add the "Delete Results" button for logged-in users.
            const actionsContainer = $id('cdt-results-actions');
            if (actionsContainer) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'cdt-quiz-button cdt-quiz-button-secondary';
                deleteBtn.textContent = 'Delete My Results';
                actionsContainer.appendChild(deleteBtn);

                deleteBtn.addEventListener('click', () => {
                    if (!confirm('Are you sure you want to permanently delete your saved results? This cannot be undone.')) {
                        return;
                    }
                    
                    deleteBtn.textContent = 'Deleting...';
                    deleteBtn.disabled = true;

                    fetch(ajaxUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ 
                            action: 'cdt_delete_user_results', 
                            _ajax_nonce: ajaxNonce,
                        })
                    })
                    .then(r => r.json())
                    .then(j => {
                        if (j.success) {
                            currentUser.savedResults = null;
                            quizState = { scores: {}, sortedScores: [], ageGroup: 'adult' };
                            alert('Your results have been deleted.');
                            renderAgeGate();
                            window.scrollTo(0,0);
                        } else {
                            alert('Error: ' + (j.data || 'Could not delete results.'));
                            deleteBtn.textContent = 'Delete My Results';
                            deleteBtn.disabled = false;
                        }
                    });
                });
            }
        }
    }

    function saveResultsToServer() {
        if (!isLoggedIn) return;
        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ 
                action: 'cdt_save_user_results', 
                _ajax_nonce: ajaxNonce, 
                user_id: currentUser.id, 
                results: JSON.stringify(quizState) 
            })
        });
    }

    // --- Initial Load ---
    function init() {
        if (isLoggedIn && currentUser.savedResults && currentUser.savedResults.sortedScores) {
            quizState = currentUser.savedResults;
            renderResults();
        } else {
            renderAgeGate();
        }
    }

    init();
})();