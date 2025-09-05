(function() {
    // --- Setup ---
    const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data } = cdt_quiz_data;
    const { cats: CATS, questions: QUESTIONS, likert: LIKERT, dimensionDetails: DIMENSION_DETAILS } = data;
    const isLoggedIn = !!currentUser;
    const container = document.getElementById('cdt-quiz-container');
    if (!container) return;
    // New dev tools elements
    const devTools = document.getElementById('cdt-dev-tools');
    const autoBtn = document.getElementById('cdt-autofill-run');

    // --- Static Content for Results Page ---
    const DIMENSION_DETAILS_FALLBACK = {
        'ambiguity-tolerance': {
            title: 'Ambiguity Tolerance',
            helps: 'Life rarely gives us full clarity before we need to move forward. Your ability to tolerate ambiguity means you can keep walking even when the path is foggy. Instead of demanding every answer upfront, you remain open to possibility, allowing you to explore new ideas and adapt when situations change. This flexibility helps you stay creative when others get stuck waiting for certainty.',
            watchOut: 'Ambiguity tolerance is a gift, but it carries risks. If you lean too heavily on your comfort with the unknown, you may postpone decisions indefinitely, drift without direction, or leave others frustrated by your lack of clarity. Being open to possibilities is powerful — but sometimes people need you to commit.',
            growth: ['Experiment with decision deadlines: tell yourself, “I’ll gather options for 48 hours, then I’ll choose.”', 'Practice weighing possibilities instead of holding them all equal — rank what’s most likely or most aligned with your values.', 'Communicate your process when working with others: let them know you’re still exploring, so they don’t mistake patience for indecision.'],
            relational: { 'In Relationships': 'You can reassure anxious partners or friends by calmly saying, “It’s okay not to know yet.”', 'In Teams': 'You create space for brainstorming, ensuring ideas aren’t shut down too quickly.', 'As a Leader': 'You show that uncertainty isn’t weakness — it’s the birthplace of innovation.' },
            practices: { 'Reflection': '“Where in my life am I waiting for absolute certainty before acting? What would change if I moved forward with 70% clarity?”', 'Micro-Challenge': 'Next time two options compete, write down the pros/cons of each, set them aside, then return the next day and commit to one.', 'Reframe': '“Ambiguity is not the enemy. It’s the soil from which new growth emerges.”' }
        },
        'value-conflict-navigation': {
            title: 'Value Conflict Navigation',
            helps: 'Nothing tests us like a clash of values. When loyalty collides with honesty, or freedom with security, the resulting tension can feel paralyzing. Your score shows how well you handle these deeper conflicts. A higher tolerance means you can sit with competing values long enough to see their complexity and work toward wisdom instead of rushing to simple answers.',
            watchOut: 'If you tolerate value conflicts well, you may sometimes float between perspectives without taking a stand. If you struggle here, you might deny the tension altogether — pretending a choice is “easy” when it really isn’t. Either extreme can prevent integrity.',
            growth: ['Write out your top five values, then rank them. Which ones guide you when two collide?', 'When facing conflict, name the values on both sides — yours and others’.', 'Learn to choose one guiding value for the moment, while still honoring the one set aside.'],
            relational: { 'In Relationships': 'Helps you honor differences without dismissing what matters to the other.', 'In Teams': 'Makes you a mediator who can articulate why both sides feel strongly.', 'As a Leader': 'Builds credibility by showing that your choices align with clear values, not convenience.' },
            practices: { 'Reflection': '“When did two of my values clash this month? How did I respond?”', 'Micro-Challenge': 'The next time two values pull against each other, choose one path and reflect afterward on how it felt.', 'Reframe': '“Value conflicts don’t destroy my integrity; they refine it.”' }
        },
        'self-confrontation-capacity': {
            title: 'Self-Confrontation Capacity',
            helps: 'The hardest person to face is often ourselves. Your capacity for self-confrontation reflects how honestly you deal with your own blind spots, contradictions, and inconsistencies. High scores here mean you can admit mistakes, acknowledge hypocrisy, and grow from it. This honesty fosters humility, maturity, and deeper authenticity.',
            watchOut: 'If you resist self-confrontation, you may defend, deny, or rationalize. Growth stalls when you can’t admit weakness. On the other hand, if you lean too heavily into self-criticism, you may spiral into discouragement and lose hope. Healthy self-confrontation balances truth with grace.',
            growth: ['Write down one belief and one behavior that don’t match — reflect on why.', 'Ask a trusted friend or mentor for feedback in an area where you might be blind.', 'Celebrate even small steps of growth, not just your failures.'],
            relational: { 'In Relationships': 'Builds intimacy by saying, “I was wrong.”', 'In Teams': 'Creates trust through vulnerability and accountability.', 'As a Leader': 'Models courage by showing that authenticity matters more than image.' },
            practices: { 'Reflection': '“Which contradiction in my life bothers me most right now?”', 'Micro-Challenge': 'Share one inconsistency with someone you trust and reflect on their response.', 'Reframe': '“Owning my weakness is not failure — it’s the path to strength.”' }
        },
        'discomfort-regulation': {
            title: 'Discomfort Regulation',
            helps: 'Cognitive dissonance is more than a mental puzzle — it’s an emotional storm. Fear, anxiety, frustration, even shame can surge when beliefs and actions don’t align. Your ability to regulate emotions in these moments determines whether you react or respond. With regulation, you create space for curiosity, reflection, and growth rather than panic or withdrawal.',
            watchOut: 'If you score lower here, you may lash out, avoid people, or collapse into indecision when contradictions surface. If you score very high, you may over-regulate — hiding or dismissing your emotions instead of processing them. Balance comes from allowing the feeling but not being ruled by it.',
            growth: ['Learn to name emotions (“I feel anxious because this doesn’t fit”).', 'Use grounding practices (breathing, walking, journaling) when tension spikes.', 'Share your feelings with someone you trust instead of pushing them down.'],
            relational: { 'In Relationships': 'Brings calm in heated moments, protecting trust.', 'In Teams': 'Maintains stability when debates get intense.', 'As a Leader': 'Shows others that strong feelings can be acknowledged without derailing progress.' },
            practices: { 'Reflection': '“Which emotion shows up first when I face contradiction? How do I usually react?”', 'Micro-Challenge': 'Next time you feel tension, pause and name the feeling before speaking.', 'Reframe': '“Emotions are not roadblocks — they are signals pointing me to deeper truths.”' }
        },
        'growth-orientation': {
            title: 'Growth Orientation',
            helps: 'I see inner tension as a sign that I’m learning.',
            watchOut: 'I seek out ideas that challenge my assumptions.',
            growth: ['I view cognitive dissonance as a sign to pay attention—not shut down.', 'I grow the most when things feel difficult at first.', 'I like learning things that make me rethink old habits.'],
            relational: { 'In Relationships': 'I believe discomfort is part of becoming wiser.', 'In Teams': 'I’m drawn to experiences that stretch me.', 'As a Leader': 'I trust the process of learning, even when it feels messy.' },
            practices: { 'Reflection': 'I prefer honest feedback over praise.', 'Micro-Challenge': 'I believe real growth takes time and discomfort.', 'Reframe': 'I believe real growth takes time and discomfort.' }
        }
    };

    const ALL_DIMENSION_DETAILS = DIMENSION_DETAILS || DIMENSION_DETAILS_FALLBACK;

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
        const steps = container.querySelectorAll('.cdt-step');
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
            <div class="cdt-quiz-card">
              <h2 class="cdt-section-title">Cognitive Dissonance Tolerance Quiz</h2>
              <p>To begin, please select the option that best describes you:</p>
              <div class="cdt-age-options">
                <button type="button" class="cdt-quiz-button" data-age-group="teen">Teen / High School</button>
                <button type="button" class="cdt-quiz-button" data-age-group="graduate">Student / Recent Graduate</button>
                <button type="button" class="cdt-quiz-button" data-age-group="adult">Adult / Professional</button>
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
        if (devTools) devTools.style.display = 'block'; // Show dev tools
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
        if (devTools) devTools.style.display = 'none'; // Hide dev tools
        const { sortedScores, ageGroup } = quizState;
        const userFirstName = currentUser ? currentUser.firstName : 'Valued User';

        const topDimensionSlug = sortedScores[0][0];
        const bottomDimensionSlug = sortedScores[sortedScores.length - 1][0];
        const maxScore = (QUESTIONS[ageGroup]?.[topDimensionSlug]?.length || 10) * 5;

        // --- Helper Functions for Building HTML ---
        const bar = (score, max) => {
            const pct = Math.max(0, Math.min(100, (score / max) * 100));
            const col = pct >= 75 ? '#4CAF50' : (pct < 40 ? '#f44336' : '#ffc107');
            return `<div class="cdt-bar-wrapper"><div class="cdt-bar-inner" style="width:${pct}%;background-color:${col};"></div></div>`;
        };

        const createDetailCard = (slug, type) => {
            const details = ALL_DIMENSION_DETAILS[slug];
            if (!details) return '';

            const ageGroupDetails = details[quizState.ageGroup] || details['adult']; // Fallback to adult
            if (!ageGroupDetails) return '';

            const scoreData = sortedScores.find(s => s[0] === slug);
            const score = scoreData ? scoreData[1] : 0;
            const isHighScorer = score >= (maxScore * 0.6); // Consider scores >= 60% as high
            const title = (type === 'high') 
                ? `Your Greatest Strength: ${details.title}` 
                : `Your Greatest Opportunity for Growth: ${details.title}`;
            const watchOutText = ageGroupDetails.watchOut || (isHighScorer ? ageGroupDetails.watchOutHigh : ageGroupDetails.watchOutLow);

            return `
                <div class="cdt-dimension-card">
                    <h3 class="cdt-dimension-card-title">${title}</h3>
                    <div class="cdt-dimension-header">
                        <span class="cdt-dimension-title">Your Score</span>
                        <span class="cdt-dimension-score">${score} / ${maxScore}</span>
                    </div>
                    ${bar(score, maxScore)}
                    <div class="cdt-detail-section">
                        <p>${details.helps}</p>
                        <h4>Watch out for:</h4>
                        <p>${watchOutText}</p>
                        <h4>Areas for Growth:</h4>
                        <ul>${ageGroupDetails.growth.map(g => `<li>${g}</li>`).join('')}</ul>
                    </div>
                </div>
            `;
        };

        // --- Build HTML Sections ---
        const headerHtml = `
            <div class="cdt-results-header">
                <div class="cdt-results-header-icon">⚖️</div>
                <h1>Your Cognitive Dissonance Tolerance Results</h1>
                <h2>Results for ${userFirstName}</h2>
                <p class="cdt-results-metadata">Generated on: ${new Date().toLocaleDateString()}</p>
                <p class="cdt-results-summary">Your CDT profile reveals how you respond to inner conflict, contradictions, and uncertainty — and how you can grow from them.</p>
            </div>`;

        const overviewHtml = `
            <div class="cdt-results-section">
                <h3 class="cdt-section-title">Your Profile Overview</h3>
                <div class="cdt-overview-list">
                    ${sortedScores.map(([slug, score]) => {
                        const details = ALL_DIMENSION_DETAILS[slug] || {};
                        return `
                        <div class="cdt-overview-item">
                            <div class="cdt-overview-header">
                                <span class="cdt-dimension-title">${details.title || CATS[slug]}</span>
                                <span class="cdt-dimension-score">${score} / ${maxScore}</span>
                            </div>
                            ${bar(score, maxScore)}
                        </div>
                    `}).join('')}
                </div>
            </div>`;

        const dimensionsHtml = `
            <div class="cdt-detail-cards-container">
                ${createDetailCard(topDimensionSlug, 'high')}
                ${createDetailCard(bottomDimensionSlug, 'low')}
            </div>`;

        const nextStepsHtml = `
            <div class="cdt-results-section cdt-next-steps-section">
                <h3 class="cdt-section-title">What These Results Mean for Your Journey</h3>
                <p>These results are just the beginning. The Skill of Self-Discovery platform includes tools, prompts, and assessments to help you grow in resilience and authenticity.</p>
                <div class="cdt-results-actions">
                    <button type="button" class="cdt-quiz-button cdt-quiz-button-primary">📘 Guided Journal Prompts</button>
                </div>
            </div>`;

        let resultsHtml = `
            <div id="cdt-results-content">
                ${headerHtml}
                ${overviewHtml}
                ${dimensionsHtml}
                ${nextStepsHtml}
            </div>
            <div id="cdt-results-actions" class="cdt-results-actions"></div>`;
        container.innerHTML = resultsHtml;

        // --- Add Button Event Listeners ---
        const actionsContainer = $id('cdt-results-actions');
        const createActionButton = (text, classes, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = classes;
            btn.innerHTML = text; // Use innerHTML to support icons
            btn.addEventListener('click', onClick);
            return btn;
        };

        function getPdfHtml() {
            // Clone the results content to modify it for the PDF without affecting the screen.
            const resultsClone = $id('cdt-results-content').cloneNode(true);
            // Remove the "Next Steps" section from the clone.
            const nextStepsSection = resultsClone.querySelector('.cdt-next-steps-section');
            if (nextStepsSection) {
                nextStepsSection.remove();
            }
            const emojiRegex = /[\u{2696}\u{1F9E9}\u{1F4D4}\u{1F504}\u{1F5D1}]\u{FE0F}?/gu;
            return resultsClone.innerHTML.replace(emojiRegex, '').trim();
        }

        if (isLoggedIn) {
            saveResultsToServer(getPdfHtml());

            const downloadBtn = createActionButton('⬇️ Download PDF', 'cdt-quiz-button cdt-quiz-button-primary', (e) => {
                const btn = e.currentTarget;
                btn.textContent = 'Generating...';
                btn.disabled = true;

                const pdfHtml = getPdfHtml();

                const body = new URLSearchParams({ action: 'cdt_generate_pdf', _ajax_nonce: ajaxNonce, results_html: pdfHtml });
                fetch(ajaxUrl, { method: 'POST', body })
                    .then(response => response.ok ? response.blob() : Promise.reject('Network response was not ok.'))
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `cdt-quiz-results-${new Date().toISOString().slice(0,10)}.pdf`;
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
                        btn.innerHTML = '⬇️ Download PDF';
                        btn.disabled = false;
                    });
            });
            actionsContainer.appendChild(downloadBtn);

            const retakeBtn = createActionButton('🔄 Retake Quiz', 'cdt-quiz-button cdt-quiz-button-secondary', () => {
                if (confirm('Are you sure? Your saved results will be overwritten when you complete the new quiz.')) {
                    renderAgeGate();
                    window.scrollTo(0, 0);
                }
            });
            actionsContainer.appendChild(retakeBtn);

            const deleteBtn = createActionButton('🗑️ Delete Results', 'cdt-quiz-button cdt-quiz-button-danger', (e) => {
                if (!confirm('Are you sure you want to permanently delete your saved results? This cannot be undone.')) return;
                const btn = e.currentTarget;
                btn.textContent = 'Deleting...';
                btn.disabled = true;
                fetch(ajaxUrl, {
                    method: 'POST',
                    body: new URLSearchParams({ action: 'cdt_delete_user_results', _ajax_nonce: ajaxNonce })
                })
                .then(r => {
                    if (!r.ok) {
                        // If it's a 403, it's almost certainly a nonce issue.
                        if (r.status === 403) {
                            alert('Your security session has expired. Please refresh the page and try again.');
                        } else {
                            alert(`An unexpected server error occurred (Status: ${r.status}). Please try again later.`);
                        }
                        throw new Error(`Network response was not ok, status: ${r.status}`);
                    }
                    return r.json();
                })
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
                })
            });
            actionsContainer.appendChild(deleteBtn);
        }
    }

    function saveResultsToServer(resultsHtml = '') {
        if (!isLoggedIn) return;

        // Strip emojis for PDF generation
        const emojiRegex = /[\u{2696}\u{1F9E9}\u{1F4D4}\u{1F504}\u{1F5D1}]\u{FE0F}?/gu;
        const pdfHtml = resultsHtml.replace(emojiRegex, '').trim();

        const bodyParams = { 
            action: 'cdt_save_user_results', 
            _ajax_nonce: ajaxNonce, 
            user_id: currentUser.id, 
            results: JSON.stringify(quizState) 
        };

        if (resultsHtml) {
            bodyParams.results_html = pdfHtml;
        }

        fetch(ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams)
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