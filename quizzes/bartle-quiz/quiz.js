(function() {
    // --- Setup ---
    const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data } = bartle_quiz_data;
    const { cats: CATS, questions: QUESTIONS, likert: LIKERT } = data;
    const isLoggedIn = !!currentUser;
    const container = document.getElementById('bartle-quiz-container');
    if (!container) return;
    // New dev tools elements
    const devTools = document.getElementById('bartle-dev-tools');
    const autoBtn = document.getElementById('bartle-autofill-run');

    let quizState = {
        scores: {},
        sortedScores: [],
        ageGroup: 'adult'
    };

    // --- Utility Functions ---
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
    const $id = (id) => document.getElementById(id);

    /**
     * Instantly fills out the quiz with random answers and shows the results.
     * This is a development tool for testing.
     */
    function autoFill() {
        const steps = container.querySelectorAll('.bartle-step');
        if (!steps.length) return;

        steps.forEach(step => {
            const pick = Math.floor(Math.random() * 5) + 1; // Random value from 1 to 5
            const radio = step.querySelector(`input[value="${pick}"]`);
            if (radio) {
                radio.checked = true;
            }
        });

        // After filling all, calculate and show results directly.
        calculateAndShowResults();
    }

    // --- Render Functions ---
    function renderAgeGate() {
        if (devTools) devTools.style.display = 'none'; // Hide dev tools
        container.innerHTML = `
            <div class="bartle-quiz-card">
              <h2 class="bartle-section-title">Bartle Player Type Quiz</h2>
              <div class="bartle-intro-text">
                <p>The Bartle Player Type Quiz is designed to uncover what truly motivates you when you engage with games, challenges, or even everyday learning. Originally created by game researcher Richard Bartle, the model has been widely used to understand different kinds of players — but the same framework also applies to work, school, and personal growth.</p>
                <p>Instead of just asking what you like, the quiz digs into what keeps you engaged, satisfied, and energized. Are you driven by curiosity, progress, connection, or competition?</p>
                
                <h4>The Four Player Types</h4>
                <ul>
                    <li><strong>Explorer (Discovery):</strong> Motivated by curiosity, learning, and uncovering hidden possibilities.</li>
                    <li><strong>Achiever (Achievement):</strong> Motivated by goals, progress, and measurable success.</li>
                    <li><strong>Socializer (Social):</strong> Motivated by relationships, teamwork, and shared growth.</li>
                    <li><strong>Strategist (Competition):</strong> Motivated by challenge, analysis, and proving oneself.</li>
                </ul>

                <h4>How the Quiz Works</h4>
                <ul>
                    <li>You’ll answer 40 statements (10 for each Player Type).</li>
                    <li>Each statement is rated on a 1–5 scale (from “Not at all like me” to “Very much like me”).</li>
                    <li>Your responses are scored to reveal not just your primary type, but also your secondary motivations.</li>
                </ul>

                <h4>Why This Matters in Skill of Self-Discovery</h4>
                <p>The Bartle Player Type quiz is the third layer in the Skill of Self-Discovery journey:</p>
                <ul>
                    <li><strong>MI (Multiple Intelligences)</strong> → how you learn.</li>
                    <li><strong>CDT (Cognitive Dissonance Tolerance)</strong> → how you handle conflict and uncertainty.</li>
                    <li><strong>Player Type</strong> → what motivates you to keep going.</li>
                </ul>
                <p>When you combine these, you get a fuller picture of your learning style, your resilience, and your drive.</p>
              </div>

              <h3 class="bartle-start-prompt">To begin, please select the option that best describes you:</h3>
              <div class="bartle-age-options">
                <button type="button" class="bartle-quiz-button" data-age-group="teen">Teen / High School</button>
                <button type="button" class="bartle-quiz-button" data-age-group="graduate">Student / Recent Graduate</button>
                <button type="button" class="bartle-quiz-button" data-age-group="adult">Adult / Professional</button>
              </div>
              <div class="bartle-quiz-notice">
                <p>${isLoggedIn ? 'Your results will be saved to your profile.' : `You can <a href="${loginUrl}">log in or create an account</a> to save your results.`}</p>
              </div>
            </div>`;

        container.querySelectorAll('.bartle-quiz-button[data-age-group]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                quizState.ageGroup = e.currentTarget.dataset.ageGroup;
                renderQuiz();
            });
        });
    }

    function renderQuiz() {
        if (devTools) devTools.style.display = 'block'; // Show dev tools
        const questionSet = QUESTIONS[quizState.ageGroup] || QUESTIONS['adult'];
        if (!questionSet) {
            container.innerHTML = `<div class="bartle-quiz-card"><p>Sorry, no questions could be found for your selected group.</p></div>`;
            return;
        }

        const items = [];
        Object.entries(questionSet).forEach(([slug, arr]) => {
            arr.forEach(q => items.push({ cat: slug, text: q.text, reverse: q.reverse }));
        });
        const questions = shuffle(items);

        let html = `
            <div class="bartle-progress-container"><div class="bartle-progress-bar"></div></div>
            <div class="bartle-steps-container">`;

        questions.forEach((q, i) => {
            let opts = '';
            for (let v = 1; v <= 5; v++) {
                opts += `<label class="bartle-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
            }
            html += `<div class="bartle-step" data-step="${i}" data-cat="${q.cat}" data-reverse="${q.reverse}" style="display:none;">
                        <div class="bartle-quiz-card">
                            <p class="bartle-quiz-question-text">${q.text}</p>
                            <div class="bartle-quiz-likert-options">${opts}</div>
                        </div>
                     </div>`;
        });
        html += `</div><div class="bartle-quiz-footer"><button type="button" id="bartle-prev-btn" class="bartle-quiz-button" disabled>Previous</button></div>`;
        container.innerHTML = html;

        const steps = container.querySelectorAll('.bartle-step');
        const prevBtn = $id('bartle-prev-btn');
        const bar = container.querySelector('.bartle-progress-bar');
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
        
        container.querySelectorAll('.bartle-step').forEach(s => {
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
        if (devTools) devTools.style.display = 'none'; // Hide dev tools
        const { sortedScores, ageGroup } = quizState;
        const maxScore = (QUESTIONS[ageGroup]?.[sortedScores[0]?.[0]]?.length || 10) * 5;
        const userFirstName = currentUser ? currentUser.firstName : 'Valued User';

        const bar = (score, max) => {
            const pct = Math.max(0, Math.min(100, (score / max) * 100));
            const col = pct >= 75 ? '#4CAF50' : (pct < 40 ? '#f44336' : '#ffc107');
            return `<div class="bartle-bar-wrapper"><div class="bartle-bar-inner" style="width:${pct}%;background-color:${col};"></div></div>`;
        };

        const headerHtml = `
            <div class="results-main-header">
                <div class="site-branding">
                    <img src="https://skillofselfdiscovery.com/wp-content/uploads/2025/09/Untitled-design-4.png" alt="Logo" class="site-logo">
                    <span class="site-title">Skill of Self-Discovery</span>
                </div>
            </div>
            <div class="bartle-results-header">
                <h1>Your Bartle Player Type Results</h1>
                <h2>Results for ${userFirstName}</h2>
                <p class="bartle-results-metadata">Generated on: ${new Date().toLocaleDateString()}</p>
                <p class="bartle-results-summary">This quiz uncovers what truly motivates you when you engage with games, challenges, or even everyday learning.</p>
            </div>`;

        const overviewHtml = `
            <div class="bartle-results-section">
                <h3 class="bartle-section-title">Your Profile Overview</h3>
                <div class="bartle-overview-list">
                    ${sortedScores.map(([slug, score]) => `
                        <div class="bartle-overview-item">
                            <div class="bartle-overview-header">
                                <span class="bartle-dimension-title">${CATS[slug]}</span>
                                <span class="bartle-dimension-score">${score} / ${maxScore}</span>
                            </div>
                            ${bar(score, maxScore)}
                        </div>
                    `).join('')}
                </div>
            </div>`;

        let resultsHtml = `
            <div id="bartle-results-content">
                ${headerHtml}
                ${overviewHtml}
            </div>
            <div id="bartle-results-actions" class="bartle-results-actions"></div>`;
        container.innerHTML = resultsHtml;

        const actionsContainer = $id('bartle-results-actions');
        const createActionButton = (text, classes, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = classes;
            btn.innerHTML = text;
            btn.addEventListener('click', onClick);
            return btn;
        };

        // Download PDF button (available for all users)
        const downloadBtn = createActionButton('⬇️ Download PDF', 'bartle-quiz-button bartle-quiz-button-primary', (e) => {
            const btn = e.currentTarget;
            btn.textContent = 'Generating...';
            btn.disabled = true;

            // Clone the results content and adjust for PDF without changing on-screen content
            const resultsNode = $id('bartle-results-content');
            if (!resultsNode) { btn.textContent = '⬇️ Download PDF'; btn.disabled = false; return; }
            const resultsClone = resultsNode.cloneNode(true);

            // Ensure logo renders at a consistent size in PDF
            const logoInClone = resultsClone.querySelector('.site-logo');
            if (logoInClone) {
                logoInClone.style.height = '60px';
                logoInClone.style.width = 'auto';
            }

            // Strip emojis for PDF reliability
            const emojiRegex = /[\u{1F9E0}\u{2705}\u{1F680}\u{26A1}\u{1F4CA}\u{1F9ED}\u{2B07}\u{1F504}\u{1F5D1}]\u{FE0F}?/gu;
            const pdfHtml = resultsClone.innerHTML.replace(emojiRegex, '').trim();

            const body = new URLSearchParams({ action: 'bartle_generate_pdf', _ajax_nonce: ajaxNonce, results_html: pdfHtml });
            fetch(ajaxUrl, { method: 'POST', body })
                .then(response => response.ok ? response.blob() : Promise.reject('Network response was not ok.'))
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `bartle-quiz-results-${new Date().toISOString().slice(0,10)}.pdf`;
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

        if (isLoggedIn) {
            saveResultsToServer();

            const retakeBtn = createActionButton('🔄 Retake Quiz', 'bartle-quiz-button bartle-quiz-button-secondary', () => {
                if (confirm('Are you sure? Your saved results will be overwritten when you complete the new quiz.')) {
                    renderAgeGate();
                    window.scrollTo(0, 0);
                }
            });
            actionsContainer.appendChild(retakeBtn);

            const deleteBtn = createActionButton('🗑️ Delete Results', 'bartle-quiz-button bartle-quiz-button-danger', (e) => {
                if (!confirm('Are you sure you want to permanently delete your saved results? This cannot be undone.')) return;
                const btn = e.currentTarget;
                btn.textContent = 'Deleting...';
                btn.disabled = true;
                fetch(ajaxUrl, {
                    method: 'POST',
                    body: new URLSearchParams({ action: 'bartle_delete_user_results', _ajax_nonce: ajaxNonce })
                })
                .then(r => r.json())
                .then(j => {
                    if (j.success) {
                        currentUser.savedResults = null;
                        quizState = { scores: {}, sortedScores: [], ageGroup: 'adult' };
                        alert('Your results have been deleted.');
                        renderAgeGate();
                        window.scrollTo(0, 0);
                    } else {
                        alert('Error: ' + (j.data || 'Could not delete results.'));
                        btn.innerHTML = '🗑️ Delete Results';
                        btn.disabled = false;
                    }
                });
            });
            actionsContainer.appendChild(deleteBtn);
        }
    }

    function saveResultsToServer() {
        if (!isLoggedIn) return;

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ 
                action: 'bartle_save_user_results', 
                _ajax_nonce: ajaxNonce, 
                user_id: currentUser.id, 
                results: JSON.stringify(quizState) 
            })
        });
    }

    // --- Initial Load ---
    function init() {
        if (autoBtn) {
            autoBtn.addEventListener('click', autoFill);
        }

        if (isLoggedIn && currentUser.savedResults && currentUser.savedResults.sortedScores) {
            quizState = currentUser.savedResults;
            renderResults();
        } else {
            renderAgeGate();
        }
    }

    init();
})();
