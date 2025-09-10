(function() {
    // --- Debugging: Log the raw data received from PHP ---
    console.log('CDT Quiz Data Received:', typeof cdt_quiz_data !== 'undefined' ? cdt_quiz_data : 'Error: cdt_quiz_data is not defined.');
    if (typeof cdt_quiz_data === 'undefined') { return; }

    // --- Setup ---
    const { currentUser, ajaxUrl, ajaxNonce, loginUrl, data, nextStepUrl, nextStepTitle, predictionData } = cdt_quiz_data;
    const { cats: CATS, questions: QUESTIONS, likert: LIKERT, dimensionDetails: DIMENSION_DETAILS } = data || {};
    const isLoggedIn = !!currentUser;
    const isAdmin = !!(currentUser && currentUser.isAdmin);
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
            helps: 'Growth is often uncomfortable before it is rewarding. Your score reflects how willing you are to lean into friction — feedback, challenge, and uncertainty — as a path to learning and maturity.',
            watchOut: 'If you score high, be careful not to chase discomfort for its own sake or ignore the need for rest. If you score low, you may avoid hard but necessary experiences that would grow you.',
            growth: ['Invite constructive feedback on one project this week.', 'Schedule a small “stretch task” you would typically avoid.', 'Reflect on moments when discomfort preceded a breakthrough.'],
            relational: { 'In Relationships': 'You welcome honest, respectful feedback without becoming defensive.', 'In Teams': 'You take on stretch roles and encourage learning from mistakes.', 'As a Leader': 'You model that progress includes missteps and iteration.' },
            practices: { 'Reflection': '“Where am I resisting growth because it feels uncomfortable?”', 'Micro-Challenge': 'Choose a small, high-friction task and complete it today.', 'Reframe': '“Discomfort can be a sign of growth, not failure.”' }
        }
    };

    const ALL_DIMENSION_DETAILS = DIMENSION_DETAILS || DIMENSION_DETAILS_FALLBACK;

    let quizState = {
        scores: {},
        sortedScores: [],
        ageGroup: 'adult',
        autoFilled: false,
        reviewPrompted: false
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
            const type = step.getAttribute('data-type');
            let radios = Array.from(step.querySelectorAll('input[type=radio]'));
            if (!radios.length) return;
            if (type === 'scenario' || type === 'forced') {
                // Options use index values and carry data-score. Pick any.
                const r = radios[Math.floor(Math.random() * radios.length)];
                r.checked = true;
            } else {
                // Likert 1..5
                const pick = Math.floor(Math.random() * 5) + 1;
                const radio = step.querySelector(`input[value="${pick}"]`) || radios[0];
                if (radio) radio.checked = true;
            }
        });

        // After filling all, calculate and show results directly.
        quizState.autoFilled = true;
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

        // Build a normalized list of items, supporting both legacy and typed schema.
        const items = [];
        Object.entries(questionSet).forEach(([slug, arr]) => {
            arr.forEach(q => {
                if (q && (q.type || q.options || q.pair)) {
                    // New typed schema
                    items.push({
                        cat: slug,
                        type: q.type || 'likert',
                        text: q.text || '',
                        options: Array.isArray(q.options) ? q.options : null,
                        pair: q.pair || null,
                        // By default, all items except contradiction pair affect max score; scoring logic will handle exact max.
                        affectsMax: (q.type !== 'pair')
                    });
                } else {
                    // Legacy schema (Likert with reverse flag)
                    items.push({ cat: slug, type: 'likert', text: q.text, reverse: !!q.reverse, affectsMax: true });
                }
            });
        });
        const questions = shuffle(items);
        // Build lookup of pair keys to their question texts for admin notes.
        const pairMap = {};
        questions.forEach(q => {
            if (q && q.type === 'pair' && q.pair) {
                if (!pairMap[q.pair]) pairMap[q.pair] = [];
                pairMap[q.pair].push(q.text || '');
            }
        });

        let html = `
            <div class="cdt-progress-container"><div class="cdt-progress-bar"></div></div>
            <div class="cdt-steps-container">`;

        // Helper to generate an admin-friendly scoring note per question
        const adminNoteFor = (qNorm) => {
            if (!isAdmin || !qNorm) return '';
            const type = qNorm.type || 'likert';
            if (type === 'scenario') {
                const optionLines = (qNorm.options || []).map(o => `${o.text} = ${o.score} points`).join('; ');
                return `<div class="cdt-admin-note">Scoring: Scenario-based. Options award 0–3 points (higher = more dissonance tolerance). The first scenario in this category is multiplied by your confidence (1–5 → 0.25, 0.5, 0.75, 1.0, 1.25). Option mapping: ${optionLines}.</div>`;
            }
            if (type === 'forced') {
                const scores = (qNorm.options || []).map(o => `${o.text} = ${o.score}`).join('; ');
                return `<div class="cdt-admin-note">Scoring: Forced-choice. CDT-aligned option = 3 points; the other = 0 points. Mapping: ${scores}.</div>`;
            }
            if (type === 'virtue') {
                return `<div class="cdt-admin-note">Scoring: Virtue trap. Likert (1–5) is reverse-scored to 0–4 (Agree strongly = 0, Disagree strongly = 4). Higher = greater CDT alignment.</div>`;
            }
            if (type === 'pair') {
                const pairKeyRaw = qNorm.pair || '';
                const pairKey = pairKeyRaw ? `(${pairKeyRaw})` : '';
                const others = (pairMap[pairKeyRaw] || []).filter(t => t && t !== qNorm.text);
                const pairedText = others.length ? ` Paired with: “${others.join('” / “')}”.` : '';
                return `<div class="cdt-admin-note">Scoring: Contradiction pair ${pairKey}. This item adds no base points. If both paired statements are rated high (≥ 4), deduct 2 points once from this category.${pairedText}</div>`;
            }
            if (type === 'others') {
                return `<div class="cdt-admin-note">Scoring: How others see me. Likert (1–5) scored as-is (1–5 points).</div>`;
            }
            if (type === 'confidence') {
                return `<div class="cdt-admin-note">Scoring: Confidence prompt. Provides a multiplier only (1–5 → 0.25×, 0.5×, 0.75×, 1.0×, 1.25×) applied to the first scenario-based question in this category.</div>`;
            }
            // Legacy likert
            if (qNorm.type === 'likert') {
                return `<div class="cdt-admin-note">Scoring: Likert (1–5)${qNorm.reverse ? ', reverse-scored to 1–5 → 5–1' : ''}.</div>`;
            }
            return '';
        };

        questions.forEach((q, i) => {
            const stepAttrs = [`data-step="${i}"`, `data-cat="${q.cat}"`, `data-type="${q.type || 'likert'}"`, `data-affects-max="${q.affectsMax ? 'true' : 'false'}"`];
            if (q.pair) stepAttrs.push(`data-pair="${q.pair}"`);

            let innerHtml = '';
            if (q.type === 'scenario' && Array.isArray(q.options)) {
                // Options have explicit per-option scores
                // Use four-equal layout so tiles look balanced
                innerHtml += `<div class="cdt-quiz-likert-options cdt-four-equal">`;
                q.options.forEach((opt, idx) => {
                    innerHtml += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${idx}" data-score="${parseInt(opt.score,10)||0}" required><span>${opt.text}</span></label>`;
                });
                innerHtml += `</div>`;
                // Encode a hint for max computation
                stepAttrs.push('data-max-base="3"');
            } else if (q.type === 'forced' && Array.isArray(q.options)) {
                // Two-option forced choice: mark container for equalized layout
                innerHtml += `<div class="cdt-quiz-likert-options cdt-two-equal">`;
                q.options.forEach((opt, idx) => {
                    innerHtml += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${idx}" data-score="${parseInt(opt.score,10)||0}" required><span>${opt.text}</span></label>`;
                });
                innerHtml += `</div>`;
                stepAttrs.push('data-max-base="3"');
            } else if (q.type === 'virtue') {
                // Likert 1-5, reverse mapped to 0-4 (Agree -> 0, Disagree -> 4)
                let opts = '';
                for (let v = 1; v <= 5; v++) {
                    opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
                }
                innerHtml += `<div class="cdt-quiz-likert-options">${opts}</div>`;
                stepAttrs.push('data-reverse-scale="0_4"');
                stepAttrs.push('data-max-base="4"');
            } else if (q.type === 'pair') {
                // Likert 1-5, contributes no base score; used for inconsistency penalty
                let opts = '';
                for (let v = 1; v <= 5; v++) {
                    opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
                }
                innerHtml += `<div class="cdt-quiz-likert-options">${opts}</div>`;
                stepAttrs.push('data-max-base="0"');
            } else if (q.type === 'others') {
                // Likert 1-5, scored as-is (1..5)
                let opts = '';
                for (let v = 1; v <= 5; v++) {
                    opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
                }
                innerHtml += `<div class="cdt-quiz-likert-options">${opts}</div>`;
                stepAttrs.push('data-max-base="5"');
            } else if (q.type === 'confidence') {
                // Likert 1-5, mapped to multiplier [0.25, 0.5, 0.75, 1.0, 1.25]
                let opts = '';
                for (let v = 1; v <= 5; v++) {
                    opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
                }
                innerHtml += `<div class="cdt-quiz-likert-options">${opts}</div>`;
                stepAttrs.push('data-max-base="0"');
            } else {
                // Legacy likert (or default)
                let opts = '';
                for (let v = 1; v <= 5; v++) {
                    opts += `<label class="cdt-quiz-option-wrapper"><input type="radio" name="q_${i}" value="${v}" required><span>${LIKERT[v]}</span></label>`;
                }
                innerHtml += `<div class="cdt-quiz-likert-options">${opts}</div>`;
                if (q.reverse) stepAttrs.push('data-reverse="true"');
                stepAttrs.push('data-max-base="5"');
            }

            const adminNote = adminNoteFor(q);
            const adminAwardBlock = isAdmin ? `<div class="cdt-admin-award" data-admin-award></div>` : '';
            html += `<div class="cdt-step" ${stepAttrs.join(' ')} style="display:none;">
                        <div class="cdt-quiz-card">
                            <p class="cdt-quiz-question-text">${q.text}</p>
                            ${innerHtml}
                            ${adminNote}
                            ${adminAwardBlock}
                        </div>
                     </div>`;
        });
        html += `</div><div class="cdt-quiz-footer">
            <button type="button" id="cdt-prev-btn" class="cdt-quiz-button" disabled>Previous</button>
            <button type="button" id="cdt-next-btn" class="cdt-quiz-button cdt-quiz-button-primary" disabled>Next</button>
        </div>`;
        container.innerHTML = html;

        const steps = container.querySelectorAll('.cdt-step');
        const prevBtn = $id('cdt-prev-btn');
        const nextBtn = $id('cdt-next-btn');
        const bar = container.querySelector('.cdt-progress-bar');
        let currentStep = 0;
        const totalSteps = steps.length;

        const computeAdminAwardForStep = (stepEl) => {
            if (!isAdmin || !stepEl) return;
            const target = stepEl.querySelector('[data-admin-award]');
            if (!target) return;
            const type = stepEl.getAttribute('data-type') || 'likert';
            const input = stepEl.querySelector('input:checked');
            if (!input) { target.innerHTML = ''; return; }
            const rawVal = parseInt(input.value, 10);
            let baseScore = 0;
            let label = '';
            if (type === 'scenario' || type === 'forced') {
                const optScore = parseInt(input.getAttribute('data-score'), 10);
                baseScore = isNaN(optScore) ? 0 : optScore;
                
                // For scenarios, check if this might get a confidence multiplier
                if (type === 'scenario') {
                    const cat = stepEl.getAttribute('data-cat');
                    // Find confidence multiplier for this category
                    let confidenceMultiplier = null;
                    const allSteps = container.querySelectorAll('.cdt-step');
                    Array.from(allSteps).forEach(s => {
                        if (s.getAttribute('data-cat') === cat && s.getAttribute('data-type') === 'confidence') {
                            const confInput = s.querySelector('input:checked');
                            if (confInput) {
                                const confVal = parseInt(confInput.value, 10);
                                const map = {1:0.25,2:0.5,3:0.75,4:1.0,5:1.25};
                                confidenceMultiplier = map[confVal] || 1.0;
                            }
                        }
                    });
                    
                    // Count how many scenarios in this category have been answered so far
                    let scenariosSoFar = 0;
                    Array.from(allSteps).forEach(s => {
                        if (s.getAttribute('data-cat') === cat && 
                            s.getAttribute('data-type') === 'scenario' && 
                            s.querySelector('input:checked')) {
                            scenariosSoFar++;
                        }
                    });
                    
                    if (confidenceMultiplier !== null && scenariosSoFar === 1) {
                        // This is the first scenario in this category, so it gets the multiplier
                        const multipliedScore = baseScore * confidenceMultiplier;
                        const categoryName = CATS[cat] || cat || 'this category';
                        label = `<strong>Awarded: ${multipliedScore.toFixed(2)} pts</strong> (${baseScore} × ${confidenceMultiplier} confidence multiplier for ${categoryName})`;
                    } else if (confidenceMultiplier !== null && scenariosSoFar > 1) {
                        // This is a subsequent scenario, no multiplier
                        label = `<strong>Awarded: ${baseScore} pts</strong> (no multiplier - only first scenario in category gets confidence boost)`;
                    } else {
                        // No confidence set yet or unknown
                        label = `<strong>Awarded: ${baseScore} pts</strong> (may be modified by confidence multiplier)`;
                    }
                } else {
                    label = `<strong>Awarded: ${baseScore} pts</strong>`;
                }
            } else if (type === 'virtue') {
                baseScore = Math.max(0, 5 - rawVal); // 0..4
                label = `<strong>Awarded: ${baseScore} pts</strong> (reverse Likert)`;
            } else if (type === 'others') {
                baseScore = rawVal; // 1..5
                label = `<strong>Awarded: ${baseScore} pts</strong>`;
            } else if (type === 'pair') {
                const pairKey = stepEl.getAttribute('data-pair');
                const cat = stepEl.getAttribute('data-cat');
                const categoryName = CATS[cat] || cat || 'this category';
                
                // Find the paired item(s) and their current answers
                const allSteps = container.querySelectorAll('.cdt-step');
                const pairItems = [];
                let pairedAnswers = [];
                
                Array.from(allSteps).forEach(s => {
                    if (s.getAttribute('data-pair') === pairKey && s !== stepEl) {
                        const pairText = s.querySelector('.cdt-quiz-question-text')?.textContent || 'Unknown question';
                        pairItems.push(pairText.substring(0, 60) + (pairText.length > 60 ? '...' : ''));
                        
                        const pairInput = s.querySelector('input:checked');
                        if (pairInput) {
                            pairedAnswers.push(parseInt(pairInput.value, 10));
                        }
                    }
                });
                
                // Determine penalty status and points awarded
                let penaltyStatus = '';
                let pointsAwarded = '0 pts';
                const currentAnswer = rawVal;
                const allAnswers = [...pairedAnswers, currentAnswer];
                const highAnswers = allAnswers.filter(v => v >= 4);
                
                if (pairedAnswers.length === 0) {
                    penaltyStatus = ' - <em>waiting for paired item</em>';
                } else if (pairedAnswers.length > 0) {
                    if (highAnswers.length >= 2) {
                        pointsAwarded = '-2 pts';
                        penaltyStatus = ` - <span style="color: #d63384;"><strong>PENALTY TRIGGERED!</strong> Both items rated ≥4</span>`;
                    } else if (currentAnswer >= 4 && pairedAnswers.some(v => v >= 4)) {
                        pointsAwarded = '-2 pts';
                        penaltyStatus = ` - <span style="color: #d63384;"><strong>PENALTY TRIGGERED!</strong> Both items rated ≥4</span>`;
                    } else if (currentAnswer >= 4) {
                        penaltyStatus = ` - <span style="color: #fd7e14;">High rating (${currentAnswer}), penalty if pair also rated ≥4</span>`;
                    } else {
                        penaltyStatus = ' - <span style="color: #198754;">No penalty (at least one item < 4)</span>';
                    }
                }
                
                const pairInfo = pairItems.length > 0 ? `<br><small>Paired with: "${pairItems.join('", "')}"</small>` : '';
                label = `<strong>Awarded: ${pointsAwarded}</strong> (contradiction pair ${pairKey})${penaltyStatus}${pairInfo}`;
            } else if (type === 'confidence') {
                const map = {1:0.25,2:0.5,3:0.75,4:1.0,5:1.25};
                const multiplier = map[rawVal] || 1.0;
                const cat = stepEl.getAttribute('data-cat');
                const categoryName = CATS[cat] || cat || 'this category';
                label = `<strong>Awarded: ${multiplier}× multiplier for scenarios in ${categoryName}</strong>`;
            } else {
                const isReverse = stepEl.getAttribute('data-reverse') === 'true';
                baseScore = isReverse ? (6 - rawVal) : rawVal;
                label = `<strong>Awarded: ${baseScore} pts</strong>${isReverse ? ' (reverse Likert)' : ''}`;
            }
            target.innerHTML = label;
        };

        const updateNavState = () => {
            const hasAnswer = !!steps[currentStep].querySelector('input:checked');
            prevBtn.disabled = (currentStep === 0);
            nextBtn.disabled = !hasAnswer;
            // Update label to Finish on last step for clarity
            nextBtn.textContent = (currentStep >= totalSteps - 1) ? 'Finish' : 'Next';
        };

        const showStep = (k) => {
            steps.forEach((s, j) => s.style.display = j === k ? 'block' : 'none');
            currentStep = k;
            bar.style.width = ((k + 1) / totalSteps * 100) + '%';
            updateNavState();
            computeAdminAwardForStep(steps[k]);
        };

        prevBtn.addEventListener('click', () => { if (currentStep > 0) { showStep(currentStep - 1); } });
        nextBtn.addEventListener('click', () => {
            if (currentStep < totalSteps - 1) {
                showStep(currentStep + 1);
                return;
            }
            // Last step: ensure all questions are answered
            const allAnswered = Array.from(steps).every(s => s.querySelector('input:checked'));
            if (!allAnswered) {
                // jump to first unanswered
                const idx = steps.findIndex(s => !s.querySelector('input:checked'));
                if (idx >= 0) showStep(idx);
                return;
            }
            if (isAdmin && !quizState.autoFilled) {
                const proceed = confirm('All questions answered. Finish and see results now? Click Cancel to review.');
                if (!proceed) return;
            }
            calculateAndShowResults();
        });

        steps.forEach((s) => s.querySelectorAll('input[type=radio]').forEach(inp => inp.addEventListener('change', () => {
            computeAdminAwardForStep(s);
            updateNavState();
        })));

        showStep(0);
    }

    function calculateAndShowResults() {
        const scores = {};
        const maxByCat = {};
        const scenarioCount = {};
        const forcedCount = {};
        const virtueCount = {};
        const othersCount = {};
        const pairAnswers = {}; // { pairKey: { cat, vals: [v1, v2, ...] } }
        const confidenceByCat = {}; // { cat: multiplier }
        const appliedScenarioMultiplier = {}; // { cat: boolean }

        Object.keys(CATS).forEach(k => { scores[k] = 0; maxByCat[k] = 0; scenarioCount[k] = 0; forcedCount[k] = 0; virtueCount[k] = 0; othersCount[k] = 0; appliedScenarioMultiplier[k] = false; });

        const steps = Array.from(container.querySelectorAll('.cdt-step'));

        // Pass 1: collect confidence answers first so multipliers are available regardless of order
        steps.forEach(s => {
            const cat = s.getAttribute('data-cat');
            const type = s.getAttribute('data-type') || 'likert';
            if (!cat || type !== 'confidence') return;
            const input = s.querySelector('input:checked');
            if (!input) return;
            const rawVal = parseInt(input.value, 10);
            const map = {1:0.25,2:0.5,3:0.75,4:1.0,5:1.25};
            confidenceByCat[cat] = map[rawVal] || 1.0;
        });

        // Pass 2: compute base scores and gather counts/pairs
        steps.forEach(s => {
            const cat = s.getAttribute('data-cat');
            const type = s.getAttribute('data-type') || 'likert';
            if (!cat) return;
            const input = s.querySelector('input:checked');
            if (!input) return;
            const rawVal = parseInt(input.value, 10);

            if (type === 'pair') {
                const pairKey = s.getAttribute('data-pair');
                if (pairKey) {
                    if (!pairAnswers[pairKey]) pairAnswers[pairKey] = { cat, vals: [] };
                    pairAnswers[pairKey].vals.push(rawVal);
                }
                return; // no base score
            }

            let baseScore = 0;
            if (type === 'scenario' || type === 'forced') {
                const optScore = parseInt(input.getAttribute('data-score'), 10);
                baseScore = isNaN(optScore) ? 0 : optScore;
                if (type === 'scenario') scenarioCount[cat] = (scenarioCount[cat] || 0) + 1;
                if (type === 'forced') forcedCount[cat] = (forcedCount[cat] || 0) + 1;
            } else if (type === 'virtue') {
                baseScore = Math.max(0, 5 - rawVal); // 0..4
                virtueCount[cat] = (virtueCount[cat] || 0) + 1;
            } else if (type === 'others') {
                baseScore = rawVal; // 1..5
                othersCount[cat] = (othersCount[cat] || 0) + 1;
            } else if (type === 'confidence') {
                // already handled in pass 1
                return;
            } else {
                // Legacy likert
                const isReverse = s.getAttribute('data-reverse') === 'true';
                baseScore = isReverse ? (6 - rawVal) : rawVal;
            }

            // Apply confidence multiplier to the first scenario-based question per category
            if (type === 'scenario' && !appliedScenarioMultiplier[cat]) {
                const mult = confidenceByCat[cat] || 1.0;
                baseScore = baseScore * mult;
                appliedScenarioMultiplier[cat] = true;
            }

            scores[cat] += baseScore;
        });

        // Compute max per category based on counts and multiplier max for first scenario
        Object.keys(CATS).forEach(cat => {
            let max = 0;
            if ((scenarioCount[cat] || 0) > 0) {
                // One scenario can be boosted by max confidence (1.25)
                max += 3 * 1.25 + (scenarioCount[cat] - 1) * 3;
            }
            max += (forcedCount[cat] || 0) * 3;
            max += (virtueCount[cat] || 0) * 4; // virtue mapped 0..4
            max += (othersCount[cat] || 0) * 5;
            // Legacy items in this cat (if any) are not tracked; approximate by scanning DOM for legacy in this cat
            const legacySteps = steps.filter(s => s.getAttribute('data-cat') === cat && !['scenario','forced','virtue','others','pair','confidence'].includes(s.getAttribute('data-type')));
            max += legacySteps.length * 5;
            maxByCat[cat] = max;
        });

        // Apply contradiction-pair penalties: if both answers in a pair are high (>=4), deduct 2 from that category
        Object.keys(pairAnswers).forEach(k => {
            const entry = pairAnswers[k];
            const vals = entry.vals || [];
            if (vals.length >= 2) {
                const high = vals.filter(v => v >= 4).length;
                if (high >= 2) {
                    scores[entry.cat] = Math.max(0, (scores[entry.cat] || 0) - 2);
                }
            }
        });

        quizState.scores = scores;
        quizState.maxByCat = maxByCat;
        quizState.sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

        renderResults();
    }

    function renderResults() {
        if (devTools) devTools.style.display = 'none'; // Hide dev tools
        const { sortedScores, ageGroup } = quizState;
        const userFirstName = currentUser ? currentUser.firstName : 'Valued User';

        const topDimensionSlug = sortedScores[0][0];
        const bottomDimensionSlug = sortedScores[sortedScores.length - 1][0];
        const maxScore = (quizState.maxByCat && quizState.maxByCat[topDimensionSlug]) ? quizState.maxByCat[topDimensionSlug] : ((QUESTIONS[ageGroup]?.[topDimensionSlug]?.length || 10) * 5);

        // --- Helper Functions for Building HTML ---
        const bar = (score, max) => {
            const pct = Math.max(0, Math.min(100, (score / max) * 100));
            const col = pct >= 75 ? '#4CAF50' : (pct < 40 ? '#f44336' : '#ffc107');
            return `<div class="cdt-bar-wrapper"><div class="cdt-bar-inner" style="width:${pct}%;background-color:${col};"></div></div>`;
        };

        const createDetailCard = (slug, type) => {
            const details = ALL_DIMENSION_DETAILS[slug];
            if (!details) return '';

            const ageGroupKey = quizState.ageGroup === 'graduate' ? 'graduate' : (quizState.ageGroup === 'teen' ? 'teen' : 'adult');
            const ageGroupDetails = details[ageGroupKey] || details['adult']; // Fallback to adult
            if (!ageGroupDetails) return '';

            const scoreData = sortedScores.find(s => s[0] === slug);
            const score = scoreData ? scoreData[1] : 0;
            const localMax = (quizState.maxByCat && quizState.maxByCat[slug]) ? quizState.maxByCat[slug] : maxScore;
            const isHighScorer = score >= (localMax * 0.6); // Consider scores >= 60% as high
            
            const title = (type === 'high') 
                ? `Your Greatest Strength: ${details.title}` 
                : `Your Greatest Opportunity for Growth: ${details.title}`;
            
            const watchOutText = isHighScorer ? ageGroupDetails.watchOutHigh : ageGroupDetails.watchOutLow;
            const growthTipsHtml = `<h4>Areas for Growth:</h4><ul>${ageGroupDetails.growth.map(g => `<li>${g}</li>`).join('')}</ul>`;

            return `
                <div class="cdt-dimension-card">
                    <h3 class="cdt-dimension-card-title">${title}</h3>
                    <div class="cdt-dimension-header">
                        <span class="cdt-dimension-title">Your Score</span>
                        <span class="cdt-dimension-score">${score} / ${localMax}</span>
                    </div>
                    ${bar(score, localMax)}
                    <div class="cdt-detail-section">
                        <h4>Why this matters:</h4>
                        <p>${details.helps}</p>
                        <h4>${isHighScorer ? 'The Pitfall of this Strength:' : 'The Challenge of this Area:'}</h4>
                        <p>${watchOutText || ''}</p>
                        ${!isHighScorer ? growthTipsHtml : ''}
                    </div>
                </div>
            `;
        };

        // --- Build HTML Sections ---
        const headerHtml = `
            <div class="results-main-header">
                <div class="site-branding">
                    <img src="https://skillofselfdiscovery.com/wp-content/uploads/2025/09/Untitled-design-4.png" alt="Logo" class="site-logo">
                    <span class="site-title">Skill of Self-Discovery</span>
                </div>
            </div>
            <div class="cdt-results-header">
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
                                <span class="cdt-dimension-score">${score} / ${(quizState.maxByCat && quizState.maxByCat[slug]) ? quizState.maxByCat[slug] : maxScore}</span>
                            </div>
                            ${bar(score, (quizState.maxByCat && quizState.maxByCat[slug]) ? quizState.maxByCat[slug] : maxScore)}
                        </div>
                    `}).join('')}
                </div>
            </div>`;

        const dimensionsHtml = `
            <div class="cdt-detail-cards-container">
                ${createDetailCard(topDimensionSlug, 'high')}
                ${createDetailCard(bottomDimensionSlug, 'low')}
            </div>`;

        let nextStepsHtml = '';
        if (nextStepUrl) {
            nextStepsHtml = `
                <div class="cdt-results-section cdt-next-steps-section">
                    <h3 class="cdt-section-title">Your Next Step: Discover Your Player Type</h3>
                    <p>You've explored how you handle inner conflict. Now, discover what truly motivates you. The Bartle Player Type quiz reveals your primary drivers in challenges, learning, and collaboration.</p>
                    <div class="cdt-results-actions">
                        <a href="${nextStepUrl}" class="cdt-quiz-button cdt-quiz-button-primary">${nextStepTitle}</a>
                    </div>
                </div>`;
        }

        let predictionHtml = '';
        if (predictionData && predictionData.templates && predictionData.miResults && predictionData.cdtResults) {
            const { miResults, cdtResults, templates, miCategories, cdtCategories } = predictionData;
            
            const bartleScores = { explorer: 0, achiever: 0, socializer: 0, strategist: 0 };
            const miMap = {
                'logical-mathematical': ['achiever', 'strategist'], 'linguistic': ['socializer'],
                'spatial': ['explorer'], 'bodily-kinesthetic': ['achiever'],
                'musical': ['explorer', 'socializer'], 'interpersonal': ['socializer', 'strategist'],
                'intrapersonal': ['explorer'], 'naturalistic': ['explorer'],
            };
            const cdtMap = {
                'ambiguity-tolerance': ['explorer'],
                'value-conflict-navigation': ['socializer'],
                'self-confrontation-capacity': ['achiever'],
                'discomfort-regulation': ['achiever', 'strategist'],
                'growth-orientation': ['explorer']
            };

            if (miResults.top3 && miResults.top3.length) {
                let points = 3;
                miResults.top3.forEach(miSlug => {
                    if (miMap[miSlug]) {
                        miMap[miSlug].forEach(bartleType => { bartleScores[bartleType] += points; });
                    }
                    points--;
                });
            }

            if (cdtResults.sortedScores && cdtResults.sortedScores.length) {
                const cdtSlug = cdtResults.sortedScores[0][0];
                if (cdtMap[cdtSlug]) {
                    cdtMap[cdtSlug].forEach(bartleType => { bartleScores[bartleType] += 3; });
                }
            }

            const sortedBartle = Object.entries(bartleScores).sort((a, b) => b[1] - a[1]);
            const predictedType = sortedBartle.length ? sortedBartle[0][0] : null;

            if (predictedType && templates[predictedType]) {
                const template = templates[predictedType][Math.floor(Math.random() * templates[predictedType].length)];
                const miNames = miResults.top3.map(slug => miCategories[slug] || '');
                const miStrengthsStr = 'a combination of ' + miNames.filter(n => n).join(', ');
                const cdtSlug = cdtResults.sortedScores[0][0];
                const cdtStrengthsStr = 'a high capacity for ' + (cdtCategories[cdtSlug] || 'navigating challenges');
                const predictionParagraph = template.replace('{mi_strengths}', miStrengthsStr).replace('{cdt_strengths}', cdtStrengthsStr);

                predictionHtml = `<div class="cdt-results-section cdt-prediction-section"><h3 class="cdt-section-title">Your Personalized Bartle Prediction</h3><p>${predictionParagraph}</p></div>`;
            }
        }

        // --- Admin Scoring Breakdown Table ---
        let adminBreakdownHtml = '';
        if (isAdmin || quizState.autoFilled) {
            const createAdminBreakdownTable = () => {
                const steps = Array.from(container.querySelectorAll('.cdt-step'));
                const scoreRows = [];
                const penalties = {};
                const confidenceMultipliers = {};
                const appliedScenarioMultipliers = {};
                
                // First pass: collect confidence multipliers
                steps.forEach(s => {
                    const cat = s.getAttribute('data-cat');
                    const type = s.getAttribute('data-type') || 'likert';
                    if (cat && type === 'confidence') {
                        const input = s.querySelector('input:checked');
                        if (input) {
                            const rawVal = parseInt(input.value, 10);
                            const map = {1:0.25,2:0.5,3:0.75,4:1.0,5:1.25};
                            confidenceMultipliers[cat] = map[rawVal] || 1.0;
                        }
                    }
                });
                
                // Second pass: process all questions
                steps.forEach(s => {
                    const cat = s.getAttribute('data-cat');
                    const type = s.getAttribute('data-type') || 'likert';
                    const questionText = s.querySelector('.cdt-quiz-question-text')?.textContent || 'Unknown question';
                    const categoryName = CATS[cat] || cat || 'Unknown';
                    const input = s.querySelector('input:checked');
                    
                    if (!input) return;
                    
                    const rawVal = parseInt(input.value, 10);
                    let score = 0;
                    let reason = '';
                    
                    if (type === 'scenario' || type === 'forced') {
                        const optScore = parseInt(input.getAttribute('data-score'), 10);
                        score = isNaN(optScore) ? 0 : optScore;
                        
                        if (type === 'scenario' && !appliedScenarioMultipliers[cat]) {
                            const mult = confidenceMultipliers[cat] || 1.0;
                            score = score * mult;
                            reason = `${type} (${optScore} × ${mult} confidence multiplier)`;
                            appliedScenarioMultipliers[cat] = true;
                        } else if (type === 'scenario') {
                            reason = `${type} (no multiplier - only first scenario gets confidence boost)`;
                        } else {
                            reason = type;
                        }
                    } else if (type === 'virtue') {
                        score = Math.max(0, 5 - rawVal);
                        reason = `virtue (Likert ${rawVal} → ${score}, reverse scored)`;
                    } else if (type === 'others') {
                        score = rawVal;
                        reason = `others (Likert ${rawVal} as-is)`;
                    } else if (type === 'pair') {
                        score = 0;
                        reason = 'contradiction pair (no base score)';
                        // We'll handle penalties separately
                    } else if (type === 'confidence') {
                        score = 0;
                        const mult = confidenceMultipliers[cat] || 1.0;
                        reason = `confidence (${mult}× multiplier for scenarios)`;
                    } else {
                        // Legacy likert
                        const isReverse = s.getAttribute('data-reverse') === 'true';
                        score = isReverse ? (6 - rawVal) : rawVal;
                        reason = `likert${isReverse ? ' (reverse)' : ''}`;
                    }
                    
                    scoreRows.push({
                        question: questionText.length > 80 ? questionText.substring(0, 80) + '...' : questionText,
                        category: categoryName,
                        score: score.toFixed(2),
                        reason: reason
                    });
                });
                
                // Handle contradiction penalties
                const pairAnswers = {};
                steps.forEach(s => {
                    const type = s.getAttribute('data-type');
                    const pairKey = s.getAttribute('data-pair');
                    const cat = s.getAttribute('data-cat');
                    if (type === 'pair' && pairKey && cat) {
                        const input = s.querySelector('input:checked');
                        if (input) {
                            const rawVal = parseInt(input.value, 10);
                            if (!pairAnswers[pairKey]) pairAnswers[pairKey] = { cat, vals: [] };
                            pairAnswers[pairKey].vals.push(rawVal);
                        }
                    }
                });
                
                Object.keys(pairAnswers).forEach(pairKey => {
                    const entry = pairAnswers[pairKey];
                    const vals = entry.vals || [];
                    if (vals.length >= 2) {
                        const high = vals.filter(v => v >= 4).length;
                        if (high >= 2) {
                            const categoryName = CATS[entry.cat] || entry.cat || 'Unknown';
                            scoreRows.push({
                                question: `Contradiction penalty for pair ${pairKey}`,
                                category: categoryName,
                                score: '-2.00',
                                reason: `both items rated ≥4 (${vals.join(', ')})`
                            });
                        }
                    }
                });
                
                // Calculate totals by category
                const categoryTotals = {};
                scoreRows.forEach(row => {
                    if (!categoryTotals[row.category]) categoryTotals[row.category] = 0;
                    categoryTotals[row.category] += parseFloat(row.score);
                });
                
                const grandTotal = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
                
                let tableHtml = `
                    <div class="cdt-results-section cdt-admin-breakdown">
                        <h3 class="cdt-section-title">Admin: Detailed Scoring Breakdown</h3>
                        <table class="cdt-admin-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left; width: 40%;">Question</th>
                                    <th style="text-align: left; width: 20%;">Category</th>
                                    <th style="text-align: center; width: 15%;">Score</th>
                                    <th style="text-align: left; width: 25%;">Reason</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                scoreRows.forEach(row => {
                    const scoreColor = parseFloat(row.score) < 0 ? 'color: #d63384;' : '';
                    tableHtml += `
                        <tr>
                            <td style="font-size: 0.9em;">${row.question}</td>
                            <td style="font-size: 0.9em;">${row.category}</td>
                            <td style="text-align: center; ${scoreColor} font-weight: bold;">${row.score}</td>
                            <td style="font-size: 0.9em; color: #666;">${row.reason}</td>
                        </tr>`;
                });
                
                // Add category subtotals
                tableHtml += '<tr style="border-top: 2px solid #ddd; font-weight: bold;"><td colspan="4" style="padding-top: 15px; font-size: 1.1em;">Category Totals:</td></tr>';
                Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
                    tableHtml += `
                        <tr style="background-color: #f8f9fa;">
                            <td colspan="2" style="font-weight: bold; padding-left: 20px;">${cat}</td>
                            <td style="text-align: center; font-weight: bold;">${total.toFixed(2)}</td>
                            <td></td>
                        </tr>`;
                });
                
                // Add grand total
                tableHtml += `
                    <tr style="border-top: 3px solid #333; background-color: #e9ecef;">
                        <td colspan="2" style="font-weight: bold; font-size: 1.1em;">GRAND TOTAL</td>
                        <td style="text-align: center; font-weight: bold; font-size: 1.2em;">${grandTotal.toFixed(2)}</td>
                        <td></td>
                    </tr>`;
                
                tableHtml += `
                            </tbody>
                        </table>
                        <style>
                            .cdt-admin-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.95em; }
                            .cdt-admin-table th, .cdt-admin-table td { padding: 8px 12px; border: 1px solid #ddd; }
                            .cdt-admin-table th { background-color: #f1f3f4; font-weight: 600; }
                            .cdt-admin-table tr:nth-child(even) { background-color: #fafafa; }
                            .cdt-admin-breakdown { margin-top: 30px; }
                        </style>
                    </div>`;
                
                return tableHtml;
            };
            
            adminBreakdownHtml = createAdminBreakdownTable();
        }

        let resultsHtml = `
            <div id="cdt-results-content">
                ${headerHtml}
                ${overviewHtml}
                ${dimensionsHtml}
                ${predictionHtml}
                ${nextStepsHtml}
                ${adminBreakdownHtml}
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

            // Make logo bigger for PDF
            const logoInClone = resultsClone.querySelector('.site-logo');
            if (logoInClone) {
                logoInClone.style.height = '60px';
                logoInClone.style.width = 'auto';
            }

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
        try {
            if (autoBtn) {
                autoBtn.addEventListener('click', autoFill);
            }

            if (isLoggedIn && currentUser.savedResults && currentUser.savedResults.sortedScores) {
                quizState = currentUser.savedResults;
                renderResults();
            } else {
                renderAgeGate();
            }
        } catch (e) {
            console.error("An error occurred during CDT quiz initialization:", e);
            if (container) {
                container.innerHTML = `<div class="cdt-quiz-card"><p style="color:red;"><strong>Error:</strong> The quiz could not be loaded. Please check the browser console for details.</p></div>`;
            }
        }
    }

    init();
})();
