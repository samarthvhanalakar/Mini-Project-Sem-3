(() => {
  'use strict';

  // TO ADD A NEW QUESTION FILE: add one line here, put the .json next to index.html
  const BANKS = [
  { id: 'logic', name: 'Fundamentals of Logic', short: 'Logic', url: './StudySphere_Fundamentals_of_Logic_MCQ_Bank.json' },
  { id: 'relations', name: 'Relations and Functions', short: 'Relations', url: './StudySphere_Relations_and_Functions_MCQ_Bank.json' },
  { id: 'posets', name: 'Posets and Lattices', short: 'Posets', url: './StudySphere_Posets_and_Lattices_MCQ_Bank.json.json' },
  { id: 'counting', name: 'Fundamental Principle of Counting', short: 'Counting', url: './counting_mcq_bank.json' },
     { id: 'groups', name: 'Groups', short: 'Groups', url: './StudySphere_Groups_MCQ_Bank.json' }
];
    const DIAGNOSTIC_TOPICS = [
      { id: 'logic', label: 'Fundamental of logic', bankId: 'logic' },
      { id: 'relations', label: 'Relations and Functions', bankId: 'relations' },
      { id: 'posets', label: 'Posets and Lattice', bankId: 'posets' },
      { id: 'counting', label: 'Fundamental Principle of Counting', bankId: 'counting' },
      { id: 'groups', label: 'Groups', bankId: 'groups' }
    ];
    const BOOKS = [
      {
        id: 'haggard-discrete-mathematics',
        title: 'Discrete Mathematics for Computer Science',
        author: 'Gary Haggard, John Schlipf, Sue Whitesides',
        fileName: 'DiscMaths for CompSci.pdf',
        path: './assets/books/DiscMaths for CompSci.pdf',
        topics: ['logic', 'relations', 'posets', 'counting']
      },
      {
        id: 'sreenivasulu-discrete-mathematical-structures',
        title: 'Discrete Mathematical Structures (Course Notes)',
        author: 'Dr. A. Sreenivasulu',
        fileName: 'Discrete-Mathematical-Structures-min.pdf',
        path: './assets/books/Discrete-Mathematical-Structures-min.pdf',
        topics: ['logic', 'relations', 'posets', 'counting', 'groups']
      },
      {
        id: 'kolman-discrete-mathematical-structures',
        title: 'Discrete Mathematical Structures (3rd Edition)',
        author: 'Bernard Kolman, Robert C. Busby, Sharon Cutler Ross',
        fileName: 'Discrete_Mathematical_Structures-Kolman.pdf',
        path: './assets/books/Discrete_Mathematical_Structures-Kolman.pdf',
        topics: ['logic', 'relations', 'posets', 'counting', 'groups']
      }
    ];
    const SUBJECT = { id: 'dsgt', name: 'DSGT' };
  const KEYS = { user: 'studysphere.user', accounts: 'studysphere.accounts', attempts: 'studysphere.attempts', questionEdits: 'studysphere.questionEdits', resources: 'studysphere.resources', preferences: 'studysphere.preferences' };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  let questionBanks = [];
  let questions = [];
  let attemptState = null;
  let resourceFilter = 'dsgt';
  const bookAvailability = new Map();
  let toastTimer;
  let quizTimer = null;
  let authMode = 'signin';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readStore = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  };
  const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  async function hashPassword(password) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const user = () => readStore(KEYS.user, null);
  const attempts = () => readStore(KEYS.attempts, []).filter(attempt => attempt.userEmail === user()?.email);
  const edits = () => readStore(KEYS.questionEdits, {});
  const resources = () => readStore(KEYS.resources, []).filter(resource => resource.userEmail === user()?.email);
  const preferencesKey = () => `${KEYS.preferences}.${user()?.email || 'guest'}`;
  const bankName = id => id === SUBJECT.id ? SUBJECT.name : (BANKS.find(bank => bank.id === id)?.name || 'StudySphere question');
  const bankShort = id => BANKS.find(bank => bank.id === id)?.short || 'Other';

  function normalizeQuestion(raw, bank) {
    let options;
    let correctIndex;
    if (Array.isArray(raw.options)) {
      options = raw.options.map((text, index) => ({ key: LETTERS[index], text: String(text) }));
      correctIndex = Number(raw.answer_index);
    } else {
      const optionMap = raw.options && typeof raw.options === 'object' ? raw.options : {};
      options = Object.entries(optionMap).map(([key, text]) => ({ key, text: String(text) }));
      correctIndex = options.findIndex(option => option.key === raw.correct_answer);
    }
    const saved = edits()[raw.id] || {};
    const sourceCorrect = options[correctIndex];
    return {
      id: raw.id,
      bankId: bank.id,
      subject: bank.name,
      level: raw.level || 'Unspecified',
      topic: raw.topic || 'General',
      question: saved.question ?? raw.question ?? '',
      options: saved.options ?? options,
      correctKey: saved.correctKey ?? sourceCorrect?.key ?? '',
      explanation: saved.explanation ?? raw.explanation ?? '',
           skill: raw.skill || '',
      image: raw.image || '',
      status: saved.status || 'approved'
    };
  }

  async function loadQuestionBanks() {
    const results = await Promise.all(BANKS.map(async bank => {
      try {
        const response = await fetch(bank.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.questions;
        if (!Array.isArray(list)) throw new Error('expected an array or { questions: [...] }');
        return { bank: { ...bank, questions: list.map(item => normalizeQuestion(item, bank)) } };
      } catch (error) {
        return { bank, error: `${bank.name}: ${error.message}` };
      }
    }));
    questionBanks = results.filter(result => result.bank.questions).map(result => result.bank);
    questions = questionBanks.flatMap(bank => bank.questions);
    if (!questionBanks.length) throw new Error(results.map(result => result.error).join('; ') || 'No question banks are available.');
    return results.filter(result => result.error).map(result => result.error);
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === 'register';
    $('#authTitle').textContent = registering ? 'Start your journey.' : 'Welcome back.';
    $('#authSubmit').textContent = registering ? 'Create account' : 'Sign in';
    $('#authSwitchPrompt').textContent = registering ? 'Already have an account?' : 'New to StudySphere?';
    $('#authSwitch').textContent = registering ? 'Sign in' : 'Create an account';
    $('#authName').hidden = !registering;
    $('#authName').required = registering;
    $('#roleField').hidden = !registering;
    $('#authPassword').autocomplete = registering ? 'new-password' : 'current-password';
    $('#authMessage').textContent = '';
  }

  function showAuth() {
    $('#appShell').hidden = true;
    $('#authScreen').hidden = false;
    setAuthMode('signin');
  }

  function startApp() {
    const current = user();
    if (!current) return showAuth();
    $('#authScreen').hidden = true;
    $('#appShell').hidden = false;
    $('#profileName').textContent = current.name;
    $('#profileRole').textContent = current.role === 'teacher' ? 'Teacher account' : 'Student account';
    $('#avatarInitials').textContent = current.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    $$('.teacher-only').forEach(item => { item.hidden = current.role !== 'teacher'; });
    $$('.student-only').forEach(item => { item.hidden = current.role === 'teacher'; });
    $('#welcomeTitle').textContent = `${greeting()}, ${current.name.split(/\s+/)[0]}.`;
    $('#welcomeEyebrow').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
    $('#todayLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
    renderSubjectOptions();
    refreshAll();
    navigate(location.hash.slice(1) || 'dashboard');
  }

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }

  function navigate(view) {
    const allowed = ['dashboard', 'diagnostic', 'performance', 'plan', 'resources', 'teacher', 'review'];
    if (!allowed.includes(view) || (['teacher', 'review'].includes(view) && user()?.role !== 'teacher')) view = 'dashboard';
    if (user()?.role === 'teacher' && !['teacher', 'review'].includes(view)) view = 'teacher';
    $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    const labels = { dashboard: 'Dashboard', diagnostic: 'Diagnostic Room', performance: 'Performance', plan: 'Study plan', resources: 'Resources', teacher: 'Teacher overview', review: 'Question review' };
    $('#pageName').textContent = labels[view];
    $('#sidebar').classList.remove('open');
    if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    if (view === 'dashboard' || view === 'performance' || view === 'teacher' || view === 'review') refreshAll();
    if (view === 'plan') renderSyllabus();
    if (view === 'resources') renderResources();
  }

  function renderSubjectOptions() {
    const bankOptions = BANKS.map(bank => `<option value="${bank.id}">${escapeHtml(bank.name)}</option>`).join('');
    $('#diagnosticSubject').innerHTML = `<option value="${SUBJECT.id}">${escapeHtml(SUBJECT.name)}</option>`;
    $('#syllabusSubject').innerHTML = bankOptions;
    $('#resourceSubject').innerHTML = bankOptions;
    updateDiagnosticTopics();
  }

  function approvedQuestions() {
    return questions.filter(question => question.status === 'approved');
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function updateDiagnosticTopics() {
    const currentTopic = $('#diagnosticTopic').value;
    $('#diagnosticTopic').innerHTML = DIAGNOSTIC_TOPICS.map(topic => `<option value="${topic.id}">${escapeHtml(topic.label)}</option>`).join('');
    $('#diagnosticTopic').value = DIAGNOSTIC_TOPICS.some(topic => topic.id === currentTopic) ? currentTopic : DIAGNOSTIC_TOPICS[0].id;
    updateDiagnosticAvailability();
  }

  function updateDiagnosticAvailability() {
    const mapping = DIAGNOSTIC_TOPICS.find(topic => topic.id === $('#diagnosticTopic').value);
    const bank = questionBanks.find(item => item.id === mapping?.bankId);
    if (!bank) {
      const configuredBank = BANKS.find(item => item.id === mapping?.bankId);
      $('#diagnosticAvailability').textContent = `Question bank could not be loaded: ${configuredBank?.url || 'unknown JSON file'}. Choose another topic or reload after restoring the file.`;
      $('#startDiagnostic').disabled = true;
      $('#diagnosticSetupMessage').textContent = '';
      return;
    }
    const candidates = approvedQuestions().filter(question => question.bankId === mapping.bankId);
    const counts = ['Easy', 'Medium', 'Hard'].map(level => ({ level, count: candidates.filter(question => question.level === level).length }));
    const text = counts.map(({ level, count }) => `${level}: ${count}`).join(' · ');
    const shortages = counts.filter(item => item.count < 5);
    $('#diagnosticAvailability').textContent = shortages.length
      ? `Cannot start: need 5 unique questions per level. ${text} approved questions available.`
      : `${text} approved questions available; this assessment will use 5 of each level.`;
    $('#startDiagnostic').disabled = shortages.length > 0;
    $('#diagnosticSetupMessage').textContent = '';
  }

  function renderTopicBars(container, data, emptyTitle = 'No practice data yet') {
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><strong>${emptyTitle}</strong>Complete a quiz to see your topic accuracy.</div>`;
      return;
    }
    container.innerHTML = data.map(topic => `<div class="topic-row"><span class="topic-name" title="${escapeHtml(topic.name)}">${escapeHtml(topic.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${topic.accuracy}%"></div></div><span class="topic-percent">${topic.accuracy}%</span></div>`).join('');
  }

  function topicStats() {
    const tally = new Map();
    attempts().forEach(attempt => attempt.answers.forEach(answer => {
      if (!answer.selectedKey) return;
      const bk = answer.bankId || attempt.bankId;
      const key = `${bk}|${answer.topic}`;
      const value = tally.get(key) || { name: answer.topic, bankId: bk, correct: 0, total: 0 };
      value.total += 1;
      if (answer.selectedKey === answer.correctKey) value.correct += 1;
      tally.set(key, value);
    }));
    return [...tally.values()].map(value => ({ ...value, accuracy: Math.round(value.correct / value.total * 100) }));
  }

  function refreshAll() {
    const done = attempts();
    const answered = done.flatMap(attempt => attempt.answers).filter(answer => answer.selectedKey);
    const correct = answered.filter(answer => answer.selectedKey === answer.correctKey).length;
    const accuracy = answered.length ? Math.round(correct / answered.length * 100) : null;
    $('#statQuizzes').textContent = done.length;
    $('#statAccuracy').textContent = accuracy === null ? '—' : `${accuracy}%`;
    $('#statAnswered').textContent = answered.length;
    $('#perfQuizzes').textContent = done.length;
    $('#perfAccuracy').textContent = accuracy === null ? '—' : `${accuracy}%`;
    const stats = topicStats().sort((a, b) => a.accuracy - b.accuracy);
    const strong = stats.filter(topic => topic.accuracy >= 80);
    const weak = stats.filter(topic => topic.accuracy < 60);
    $('#strongCount').textContent = strong.length;
    $('#weakCount').textContent = weak.length;
    renderTopicBars($('#dashboardTopics'), stats.slice(0, 5));
    renderTopicBars($('#performanceTopics'), stats);
    renderAttempts($('#recentAttempts'), done.slice(0, 4));
    renderAttempts($('#allAttempts'), done);
    const focus = stats[0];
    $('#dashboardFocus').innerHTML = focus ? `<p class="eyebrow">A GOOD PLACE TO BEGIN</p><p class="focus-topic">${escapeHtml(focus.name)}</p><p class="focus-meta">${escapeHtml(bankName(focus.bankId))}<br>${focus.accuracy}% accuracy across ${focus.total} answered question${focus.total === 1 ? '' : 's'}</p>` : '<div class="empty-state"><strong>Your next focus is waiting.</strong>Complete a diagnostic assessment and your topic insights will appear here.</div>';
    renderTeacherSummary();
    renderReviewList();
  }

  function renderAttempts(target, values) {
    if (!values.length) {
      target.innerHTML = '<div class="panel empty-state"><strong>No completed attempts yet</strong>Your submitted quizzes will appear here.</div>';
      return;
    }
    target.innerHTML = values.map(attempt => {
      const date = new Date(attempt.completedAt);
      const label = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
      const total = attempt.answers.length;
      return `<div class="attempt-row"><div class="attempt-main"><strong>${escapeHtml(bankName(attempt.bankId))}</strong><small>${total} questions · ${attempt.correct} correct · ${escapeHtml(attempt.level || 'Mixed difficulty')}</small></div><span class="attempt-score">${attempt.score}%</span><span class="attempt-date">${label}</span></div>`;
    }).join('');
  }

  function startDiagnostic() {
    const mapping = DIAGNOSTIC_TOPICS.find(topic => topic.id === $('#diagnosticTopic').value);
    const bank = questionBanks.find(item => item.id === mapping?.bankId);
    if (!mapping || !bank) {
      updateDiagnosticAvailability();
      return;
    }
    const topic = mapping.label;
    const source = approvedQuestions().filter(question => question.bankId === mapping.bankId);
    const levels = ['Easy', 'Medium', 'Hard'];
    const unique = [...new Map(source.map(question => [question.question.trim().toLocaleLowerCase().replace(/\s+/g, ' ') || `${question.bankId}:${question.id}`, question])).values()];
    const byLevel = levels.map(level => ({ level, candidates: unique.filter(question => question.level === level) }));
    const shortages = byLevel.filter(group => group.candidates.length < 5);
    if (shortages.length) {
      $('#diagnosticSetupMessage').textContent = `This selection needs 5 unique questions at each level. Not enough ${shortages.map(group => `${group.level} (${group.candidates.length}/5)`).join(', ')} questions are available. Choose another topic.`;
      return;
    }
    const items = shuffle(byLevel.flatMap(group => shuffle(group.candidates).slice(0, 5).map(question => ({ ...question, options: shuffle(question.options) }))));
    stopQuizTimer();
    attemptState = { mode: 'diagnostic', bankId: SUBJECT.id, topic, level: 'Mixed difficulty', items, answers: Array(items.length).fill(null), index: 0, startedAt: Date.now(), elapsedSeconds: 0 };
    $('#diagnosticSetupMessage').textContent = '';
    $('#diagnosticSetup').hidden = true;
    $('#quizResult').hidden = true;
    $('#quizStage').hidden = false;
    quizTimer = setInterval(updateQuizTimer, 1000);
    renderQuizQuestion();
    $('#quizStage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function elapsedSeconds() {
    if (!attemptState?.startedAt) return attemptState?.elapsedSeconds || 0;
    return Math.max(0, Math.floor((Date.now() - attemptState.startedAt) / 1000));
  }

  function formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  function updateQuizTimer() {
    const timer = $('#quizTimer');
    if (timer && attemptState?.mode === 'diagnostic') timer.textContent = formatElapsedTime(elapsedSeconds());
  }

  function stopQuizTimer() {
    if (quizTimer !== null) clearInterval(quizTimer);
    quizTimer = null;
  }

  function quitDiagnostic() {
    stopQuizTimer();
    attemptState = null;
    $('#quizStage').hidden = true;
    $('#quizResult').hidden = true;
    $('#diagnosticSetup').hidden = false;
    $('#quizStage').innerHTML = '';
  }

  function renderQuizQuestion() {
    if (!attemptState) return;
    const { items, answers, index } = attemptState;
    const question = items[index];
    const answeredCount = answers.filter(answer => answer !== null).length;
    const percent = Math.round(answeredCount / items.length * 100);
    $('#quizStage').innerHTML = `<div class="quiz-topline"><span>Question ${index + 1} of ${items.length}</span><span>${answeredCount} answered</span><span class="diagnostic-timer">Elapsed <strong id="quizTimer">${formatElapsedTime(elapsedSeconds())}</strong></span><button class="button button-quit" data-quiz-action="quit">Quit Quiz</button></div><div class="quiz-progress" role="progressbar" aria-label="Answered questions" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${answeredCount}"><div style="width:${percent}%"></div></div><article class="panel quiz-card"><div class="quiz-meta"><span class="tag">${escapeHtml(question.topic)}</span><span class="tag difficulty">${escapeHtml(question.level)}</span></div><h2 class="quiz-question">${escapeHtml(question.question)}</h2>${question.image ? `<img class="question-image" src="${escapeHtml(question.image)}" alt="Diagram for this question">` : ''}<div class="answer-list">${question.options.map(option => `<button class="answer-option ${answers[index] === option.key ? 'selected' : ''}" data-answer="${escapeHtml(option.key)}"><span class="option-letter">${escapeHtml(option.key)}</span><span>${escapeHtml(option.text)}</span></button>`).join('')}</div><div class="quiz-controls"><button class="button button-outline" data-quiz-action="previous" ${index === 0 ? 'disabled' : ''}>← Previous</button><div class="right-controls">${index < items.length - 1 ? '<button class="button button-primary" data-quiz-action="next">Next question →</button>' : ''}<button class="button button-primary" data-quiz-action="submit">Submit Assessment</button></div></div><div class="question-status-legend"><span class="answered-key">Answered</span><span class="unanswered-key">Unanswered</span></div><div class="question-dots">${items.map((_, dotIndex) => `<button class="question-dot ${dotIndex === index ? 'current' : ''} ${answers[dotIndex] !== null ? 'answered' : ''}" data-jump="${dotIndex}" aria-label="Go to question ${dotIndex + 1}, ${answers[dotIndex] !== null ? 'answered' : 'unanswered'}">${dotIndex + 1}</button>`).join('')}</div></article>`;
  }

  function submitQuiz() {
    const state = attemptState;
    if (!state) return;
    const omitted = state.answers.filter(answer => answer === null).length;
    if (omitted && !window.confirm(`You have ${omitted} unanswered question${omitted === 1 ? '' : 's'}. Submit this assessment anyway?`)) return;
    const duration = elapsedSeconds();
    stopQuizTimer();
    const detail = state.items.map((question, index) => ({ id: question.id, bankId: question.bankId, topic: question.topic, level: question.level, skill: question.skill, question: question.question, options: question.options, correctKey: question.correctKey, selectedKey: state.answers[index], explanation: question.explanation, image: question.image }));
    const correct = detail.filter(answer => answer.selectedKey && answer.selectedKey === answer.correctKey).length;
    const attempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userEmail: user().email,
      bankId: state.bankId,
      mode: state.mode,
      topic: state.topic || '',
      level: state.level,
      elapsedSeconds: duration,
      completedAt: new Date().toISOString(),
      score: Math.round(correct / detail.length * 100),
      correct,
      answers: detail
    };
    const history = attempts();
    history.unshift(attempt);
    writeStore(KEYS.attempts, history);
    attemptState = null;
    renderResult(attempt);
    refreshAll();
  }

  function renderResult(attempt) {
    renderDiagnosticResult(attempt);
  }

  function renderDiagnosticResult(attempt) {
    const total = attempt.answers.length;
    const levelResults = ['Easy', 'Medium', 'Hard'].map(level => {
      const answers = attempt.answers.filter(answer => answer.level === level);
      const correct = answers.filter(answer => answer.selectedKey && answer.selectedKey === answer.correctKey).length;
      return { level, correct, total: answers.length };
    });
    const topicResults = [...new Map(attempt.answers.map(answer => [answer.topic, { name: answer.topic, total: 0, correct: 0 }])).values()];
    topicResults.forEach(topic => {
      const answers = attempt.answers.filter(answer => answer.topic === topic.name);
      topic.total = answers.length;
      topic.correct = answers.filter(answer => answer.selectedKey && answer.selectedKey === answer.correctKey).length;
      topic.accuracy = Math.round(topic.correct / topic.total * 100);
    });
    const strongTopics = topicResults.filter(topic => topic.accuracy >= 80);
    const weakTopics = topicResults.filter(topic => topic.accuracy < 60);
    const recommendation = weakTopics.length
      ? `Prioritize review of ${weakTopics.map(topic => `${topic.name} (${topic.correct}/${topic.total})`).join(', ')}. Revisit the explanations below, then practise this topic again.`
      : strongTopics.length === topicResults.length
        ? 'Your results are strong across the assessed topics. Keep your recall fresh with a mixed practice set.'
        : `Continue practising ${topicResults.filter(topic => topic.accuracy >= 60 && topic.accuracy < 80).map(topic => `${topic.name} (${topic.correct}/${topic.total})`).join(', ')} to build consistency.`;
    $('#quizStage').hidden = true;
    $('#quizResult').hidden = false;
    $('#quizResult').innerHTML = `<div class="result-hero"><div class="result-ring">${attempt.score}%</div><div><p class="eyebrow">DIAGNOSTIC COMPLETE</p><h2>${attempt.correct} out of ${total} correct</h2><p class="muted">Time taken: ${formatElapsedTime(attempt.elapsedSeconds || 0)} · Results are saved to your performance history.</p></div></div><div class="difficulty-results">${levelResults.map(result => `<div class="difficulty-result"><span>${result.level}</span><strong>${result.correct} / 5</strong></div>`).join('')}</div><article class="diagnostic-insight"><p class="eyebrow">TOPIC ANALYSIS</p><div class="diagnostic-topic-results">${topicResults.map(topic => `<div><span>${escapeHtml(topic.name)}</span><strong>${topic.correct}/${topic.total} · ${topic.accuracy}%</strong><small class="${topic.accuracy >= 80 ? 'insight-strong' : topic.accuracy < 60 ? 'insight-weak' : ''}">${topic.accuracy >= 80 ? 'Strong' : topic.accuracy < 60 ? 'Needs attention' : 'Developing'}</small></div>`).join('')}</div><p class="diagnostic-recommendation"><strong>Recommended focus:</strong> ${escapeHtml(recommendation)}</p></article><div class="result-actions"><button class="button button-primary" id="diagnosticAgain">New diagnostic</button><button class="button button-outline" data-go="plan">Open study plan</button><button class="button button-outline" data-go="performance">View performance</button></div><div class="section-heading" style="margin-top:27px"><div><p class="eyebrow">ANSWER REVIEW</p><h2>Learn from each answer</h2></div></div>${attempt.answers.map((answer, index) => {
      const selected = answer.options.find(option => option.key === answer.selectedKey);
      const correctOption = answer.options.find(option => option.key === answer.correctKey);
      const isCorrect = answer.selectedKey === answer.correctKey;
      return `<div class="review-answer"><h3>${answer.image ? `<img class="question-image" src="${escapeHtml(answer.image)}" alt="Diagram">` : ''}${index + 1}. ${escapeHtml(answer.question)}</h3><p class="${isCorrect ? 'review-correct' : 'review-wrong'}">${isCorrect ? 'Correct' : answer.selectedKey ? 'Not quite' : 'Not answered'}${selected ? ` · Your answer: ${escapeHtml(selected.text)}` : ''}</p>${!isCorrect && correctOption ? `<p>Correct answer: ${escapeHtml(correctOption.text)}</p>` : ''}<p>${escapeHtml(answer.explanation)}</p></div>`;
    }).join('')}`;
    $('#quizResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSyllabus() {
    const bankId = $('#syllabusSubject').value || BANKS[0].id;
    const topics = [...new Set(approvedQuestions().filter(question => question.bankId === bankId).map(question => question.topic))].sort((a, b) => a.localeCompare(b));
    const saved = readStore(preferencesKey(), {});
    const checked = saved.syllabusBank === bankId ? saved.syllabusTopics || [] : topics;
    $('#syllabusTopics').innerHTML = topics.map(topic => `<label class="check-topic"><input type="checkbox" value="${escapeHtml(topic)}" ${checked.includes(topic) ? 'checked' : ''}><span>${escapeHtml(topic)}</span></label>`).join('') || '<p class="muted">No approved topics are available for this subject.</p>';
    const dateInput = $('#examDate');
    if (!dateInput.value) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      dateInput.value = defaultDate.toISOString().slice(0, 10);
    }
    if (!$('#studyPlanOutput').dataset.generated) showPlanEmpty();
  }

  function showPlanEmpty() {
    $('#studyPlanOutput').innerHTML = '<div class="empty-state"><strong>Your plan starts with a date.</strong>Select your exam, time and syllabus topics, then generate a schedule shaped by your quiz performance.</div>';
  }

  function generateStudyPlan(event) {
    event.preventDefault();
    const examDate = new Date(`${$('#examDate').value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rawDaysAvailable = Math.ceil((examDate - today) / 86400000);
    if (!Number.isFinite(rawDaysAvailable) || rawDaysAvailable < 0) {
      showToast('Choose today or a future exam date.');
      return;
    }
    const daysAvailable = Math.max(1, rawDaysAvailable);
    const hours = Math.min(12, Math.max(1, Number($('#studyHours').value)));
    const bankId = $('#syllabusSubject').value;
    const selectedTopics = $$('#syllabusTopics input:checked').map(input => input.value);
    if (!selectedTopics.length) {
      showToast('Select at least one syllabus topic.');
      return;
    }
    writeStore(preferencesKey(), { syllabusBank: bankId, syllabusTopics: selectedTopics, hours, examDate: $('#examDate').value });
    const stats = topicStats();
    const ranked = selectedTopics.map(name => {
      const stat = stats.find(value => value.bankId === bankId && value.name === name);
      return { name, accuracy: stat?.accuracy ?? null, questions: stat?.total ?? 0 };
    }).sort((a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1));
    const availableTopics = [...new Set(approvedQuestions().filter(question => question.bankId === bankId).map(question => question.topic))];
    const days = Math.min(daysAvailable, Math.max(1, Math.ceil(ranked.length / Math.max(1, Math.floor(hours / 0.5)))));
    const sessionCount = Math.min(ranked.length, Math.max(days, Math.floor(daysAvailable * hours / 1.5)));
    const sessions = Array.from({ length: sessionCount }, (_, index) => ranked[index % ranked.length]);
    const byDay = Array.from({ length: days }, () => []);
    sessions.forEach((session, index) => byDay[index % days].push(session));
    const dates = byDay.map((_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() + Math.min(index, daysAvailable - 1));
      return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
    });
    const examLabel = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(examDate);
    $('#studyPlanOutput').dataset.generated = 'true';
    $('#studyPlanOutput').innerHTML = `<div class="plan-summary">${daysAvailable} day${daysAvailable === 1 ? '' : 's'} until ${escapeHtml(examLabel)} · ${hours} hour${hours === 1 ? '' : 's'} available daily · ${selectedTopics.length} selected topic${selectedTopics.length === 1 ? '' : 's'}. Lowest-accuracy topics are scheduled first; topics without quiz data are prioritized.</div>${byDay.map((day, index) => `<div class="plan-day"><strong>${escapeHtml(dates[index])} · ${hours} hour${hours === 1 ? '' : 's'}</strong>${day.map(topic => `<p><b>${escapeHtml(topic.name)}</b> ${topic.accuracy === null ? '· Start with a baseline practice set.' : `· ${topic.accuracy}% accuracy; review explanations, then retry.`} Suggested: ${escapeHtml(Math.round(hours * 60 / Math.max(day.length, 1)))} min focused study${availableTopics.includes(topic.name) ? ` + a short ${escapeHtml(topic.name)} quiz` : ''}.</p>`).join('')}</div>`).join('')}`;
  }

  function renderResources() {
    const searchTerm = $('#resourceSearch').value.trim().toLowerCase();
    const matchesSearch = value => value.toLowerCase().includes(searchTerm);
    const books = BOOKS.filter(book =>
      (resourceFilter === 'dsgt' || book.topics.includes(resourceFilter)) &&
      (!searchTerm || matchesSearch(`${book.title} ${book.author} ${book.fileName}`))
    );
    const links = resources().filter(resource =>
      (resourceFilter === 'dsgt' || resource.bankId === resourceFilter) &&
      (!searchTerm || matchesSearch(`${resource.title} ${resource.notes || ''} ${bankName(resource.bankId)}`))
    );
    const topicLabel = DIAGNOSTIC_TOPICS.find(topic => topic.id === resourceFilter)?.label;
    let bookMessage = '';
    if (!books.length) {
      const message = resourceFilter !== 'dsgt' && topicLabel
        ? `No books are currently available for ${topicLabel}.`
        : searchTerm
          ? 'No books match your search.'
          : 'No books are currently available.';
      bookMessage = `<div class="panel empty-state resource-empty"><strong>${escapeHtml(message)}</strong></div>`;
    }
    const bookCards = books.map(book => {
      const availability = bookAvailability.get(book.id);
      const available = availability?.status === 'available';
      const statusMessage = availability?.status === 'error'
        ? availability.message
        : available ? 'PDF ready' : 'Checking PDF availability…';
      const topics = book.topics.map(id => DIAGNOSTIC_TOPICS.find(topic => topic.id === id)?.label).filter(Boolean);
      return `<article class="resource-card book-card"><span class="resource-type">PDF book</span><h3>${escapeHtml(book.title)}</h3><p class="book-author">By ${escapeHtml(book.author)}</p><p class="resource-filename">${escapeHtml(book.fileName)}</p><div class="book-topics">${topics.map(topic => `<span class="book-topic">${escapeHtml(topic)}</span>`).join('')}</div><p class="book-file-status${available ? ' is-ready' : availability?.status === 'error' ? ' is-error' : ''}" role="status">${escapeHtml(statusMessage)}</p><div class="book-actions"><a class="button button-primary${available ? '' : ' is-disabled'}" ${available ? `href="${escapeHtml(book.path)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true"'}>View PDF</a><a class="button button-outline${available ? '' : ' is-disabled'}" ${available ? `href="${escapeHtml(book.path)}" download="${escapeHtml(book.title)}.pdf"` : 'aria-disabled="true"'}>Download PDF</a></div></article>`;
    }).join('');
    const linkCards = links.map(resource => `<article class="resource-card"><span class="resource-type">${escapeHtml(bankName(resource.bankId))}</span><h3>${escapeHtml(resource.title)}</h3><p>${escapeHtml(resource.notes || 'Added to your personal study shelf.')}</p><a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a></article>`).join('');
    $('#resourceList').innerHTML = `${bookMessage}${bookCards}${linkCards}${!bookCards && !linkCards && !bookMessage ? '<div class="panel empty-state"><strong>Your study shelf is clear.</strong>Add a useful link to keep it close at hand.</div>' : ''}`;
    books.forEach(checkBookAvailability);
  }

  async function checkBookAvailability(book) {
    if (bookAvailability.has(book.id)) return;
    bookAvailability.set(book.id, { status: 'checking' });
    try {
      const response = await fetch(book.path, { method: 'HEAD', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bookAvailability.set(book.id, { status: 'available' });
    } catch (error) {
      console.error(`StudySphere could not access ${book.fileName}:`, error);
      bookAvailability.set(book.id, {
        status: 'error',
        message: `PDF unavailable. Check that ${book.fileName} is present in assets/books and reload.`
      });
    }
    renderResources();
  }

  function renderTeacherSummary() {
    const approved = questions.filter(question => question.status === 'approved').length;
    const pending = questions.filter(question => question.status === 'pending').length;
    const rejected = questions.filter(question => question.status === 'rejected').length;
    $('#teacherApproved').textContent = approved;
    $('#teacherPending').textContent = pending;
    $('#teacherRejected').textContent = rejected;
    $('#pendingCount').textContent = pending;
  }

  function renderReviewList() {
    if (!$('#reviewList')) return;
    const filter = $('#reviewFilter')?.value || 'pending';
    const list = questions.filter(question => filter === 'all' || question.status === filter);
    if (!list.length) {
      $('#reviewList').innerHTML = `<div class="panel empty-state"><strong>${filter === 'pending' ? 'Review queue is clear.' : `No ${filter} questions.`}</strong>${filter === 'pending' ? 'New questions submitted for review will appear here.' : 'Choose another status to view questions.'}</div>`;
      return;
    }
    $('#reviewList').innerHTML = list.map(question => `<article class="review-card"><div><span class="tag">${escapeHtml(bankName(question.bankId))}</span> <span class="tag">${escapeHtml(question.topic)}</span> <span class="review-status ${question.status}">${escapeHtml(question.status)}</span><h3>${escapeHtml(question.question)}</h3><p>${escapeHtml(question.level)} · ${question.options.length} options</p></div><div class="review-card-actions"><button class="small-button" data-edit-question="${escapeHtml(question.id)}">Edit</button>${question.status !== 'approved' ? `<button class="small-button approve" data-question-status="${escapeHtml(question.id)}" data-status="approved">Approve</button>` : ''}${question.status !== 'rejected' ? `<button class="small-button reject" data-question-status="${escapeHtml(question.id)}" data-status="rejected">Reject</button>` : ''}${question.status === 'rejected' ? `<button class="small-button" data-question-status="${escapeHtml(question.id)}" data-status="pending">Restore to queue</button>` : ''}</div></article>`).join('');
  }

  function setQuestionStatus(id, status) {
    const next = { ...edits(), [id]: { ...(edits()[id] || {}), status } };
    writeStore(KEYS.questionEdits, next);
    questions = questionBanks.flatMap(bank => bank.questions.map(question => ({ ...question, ...(next[question.id] || {}) })));
    refreshAll();
    showToast(status === 'approved' ? 'Question approved for student practice.' : status === 'rejected' ? 'Question rejected.' : 'Question returned to the review queue.');
  }

  function openQuestionEditor(id) {
    const question = questions.find(item => item.id === id);
    if (!question) return;
    $('#editQuestionId').value = question.id;
    $('#editQuestionText').value = question.question;
    $('#editExplanation').value = question.explanation;
    $('#editOptions').innerHTML = question.options.map(option => `<div class="edit-option-row"><input type="radio" name="correctOption" value="${escapeHtml(option.key)}" aria-label="Mark ${escapeHtml(option.key)} correct" ${question.correctKey === option.key ? 'checked' : ''}><span>${escapeHtml(option.key)}</span><input type="text" data-option-key="${escapeHtml(option.key)}" value="${escapeHtml(option.text)}" required aria-label="Option ${escapeHtml(option.key)}"></div>`).join('');
    $('#questionDialog').showModal();
  }

  function saveQuestionEdit(event) {
    event.preventDefault();
    const id = $('#editQuestionId').value;
    const previous = edits()[id] || {};
    const options = $$('#editOptions input[data-option-key]').map(input => ({ key: input.dataset.optionKey, text: input.value.trim() }));
    const correctKey = $('input[name="correctOption"]:checked')?.value;
    if (!correctKey || options.some(option => !option.text)) {
      showToast('Choose the correct answer and fill every option.');
      return;
    }
    const nextEdits = { ...edits(), [id]: { ...previous, question: $('#editQuestionText').value.trim(), explanation: $('#editExplanation').value.trim(), options, correctKey } };
    writeStore(KEYS.questionEdits, nextEdits);
    questions = questionBanks.flatMap(bank => bank.questions.map(question => ({ ...question, ...(nextEdits[question.id] || {}) })));
    $('#questionDialog').close();
    refreshAll();
    showToast('Question changes saved in this browser.');
  }

  function openResourceDialog() {
    $('#resourceForm').reset();
    $('#resourceMessage').textContent = '';
    $('#resourceDialog').showModal();
  }

  function saveResource(event) {
    event.preventDefault();
    const title = $('#resourceTitle').value.trim();
    const url = $('#resourceUrl').value.trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use a web link beginning with http or https.');
    } catch {
      $('#resourceMessage').textContent = 'Enter a valid http or https link.';
      return;
    }
    const next = [{ id: `resource-${Date.now()}`, userEmail: user().email, title, url, bankId: $('#resourceSubject').value, notes: $('#resourceNotes').value.trim(), addedAt: new Date().toISOString() }, ...readStore(KEYS.resources, [])];
    writeStore(KEYS.resources, next);
    $('#resourceDialog').close();
    renderResources();
    showToast('Resource added to your study shelf.');
  }

  function bindEvents() {
    $('#authSwitch').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'register' : 'signin'));
    $('#authForm').addEventListener('submit', async event => {
      event.preventDefault();
      const email = $('#authEmail').value.trim().toLowerCase();
      const password = $('#authPassword').value;
      if (authMode === 'register') {
        const name = $('#authName').value.trim();
        if (name.length < 2) { $('#authMessage').textContent = 'Enter your name to continue.'; return; }
        const accounts = readStore(KEYS.accounts, []);
        if (accounts.some(account => account.email === email)) {
          $('#authMessage').textContent = 'An account with this email already exists. Sign in instead.';
          return;
        }
        const account = { name, email, passwordHash: await hashPassword(password), role: $('#authRole').value };
        writeStore(KEYS.accounts, [...accounts, account]);
        writeStore(KEYS.user, account);
        startApp();
        showToast('Your local demo account is ready.');
      } else {
        const stored = readStore(KEYS.accounts, []).find(account => account.email === email);
        if (!stored || stored.passwordHash !== await hashPassword(password)) {
          $('#authMessage').textContent = 'Account not found or details do not match. Create an account to begin.';
          return;
        }
        writeStore(KEYS.user, stored);
        startApp();
      }
    });
    $('#signOut').addEventListener('click', () => { localStorage.removeItem(KEYS.user); showAuth(); });
    $('#profileButton').addEventListener('click', () => showToast('Account details are stored only in this browser.'));
    $('#mainNav').addEventListener('click', event => { const item = event.target.closest('[data-view]'); if (item) navigate(item.dataset.view); });
    document.addEventListener('click', event => {
      const go = event.target.closest('[data-go]');
      if (go) navigate(go.dataset.go);
      const diagnosticAgain = event.target.closest('#diagnosticAgain');
      if (diagnosticAgain) { quitDiagnostic(); $('#diagnosticSetup').scrollIntoView({ behavior: 'smooth' }); }
      const answer = event.target.closest('[data-answer]');
      if (answer && attemptState) { attemptState.answers[attemptState.index] = answer.dataset.answer; renderQuizQuestion(); }
      const action = event.target.closest('[data-quiz-action]');
      if (action && attemptState) {
        if (action.dataset.quizAction === 'previous') attemptState.index = Math.max(0, attemptState.index - 1);
        if (action.dataset.quizAction === 'next') attemptState.index = Math.min(attemptState.items.length - 1, attemptState.index + 1);
        if (action.dataset.quizAction === 'submit') submitQuiz();
        if (action.dataset.quizAction === 'quit') $('#quitAssessmentDialog').showModal();
        if (!['submit', 'quit'].includes(action.dataset.quizAction)) renderQuizQuestion();
      }
      const jump = event.target.closest('[data-jump]');
      if (jump && attemptState) { attemptState.index = Number(jump.dataset.jump); renderQuizQuestion(); }
      const status = event.target.closest('[data-question-status]');
      if (status) setQuestionStatus(status.dataset.questionStatus, status.dataset.status);
      const editButton = event.target.closest('[data-edit-question]');
      if (editButton) openQuestionEditor(editButton.dataset.editQuestion);
    });
    $('#startDiagnostic').addEventListener('click', startDiagnostic);
    $('#diagnosticTopic').addEventListener('change', updateDiagnosticAvailability);
    $('#continueAssessment').addEventListener('click', () => $('#quitAssessmentDialog').close());
    $('#confirmQuit').addEventListener('click', () => {
      $('#quitAssessmentDialog').close();
      quitDiagnostic();
    });
    $('#syllabusSubject').addEventListener('change', renderSyllabus);
    $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#planForm').addEventListener('submit', generateStudyPlan);
    $('#addResourceButton').addEventListener('click', openResourceDialog);
    $('#resourceForm').addEventListener('submit', saveResource);
    $('#questionEditForm').addEventListener('submit', saveQuestionEdit);
    $('#reviewFilter').addEventListener('change', renderReviewList);
    $$('.filter-pill').forEach(button => button.addEventListener('click', () => {
      resourceFilter = button.dataset.resourceFilter;
      $$('.filter-pill').forEach(pill => {
        const active = pill === button;
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-pressed', String(active));
      });
      renderResources();
    }));
    $('#resourceSearch').addEventListener('input', renderResources);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#sidebar').classList.remove('open'); });
  }

  async function initialize() {
    bindEvents();
    try {
      const bankErrors = await loadQuestionBanks();
      startApp();
      if (bankErrors.length) showToast(`Some question banks could not load: ${bankErrors.join('; ')}`);
    } catch (error) {
      $('#authScreen').hidden = false;
      $('#appShell').hidden = true;
      $('#authMessage').textContent = `Question bank could not load: ${error.message}. Start this project using a local web server, then reload.`;
      console.error('StudySphere question bank loading failed:', error);
    }
  }

  initialize();
})();