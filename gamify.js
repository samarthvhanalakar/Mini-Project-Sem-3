(() => {
  'use strict';
  // Reads the same localStorage data app.js writes, so app.js needs no edits.
  const XP_PER_LEVEL = 150;
  const TITLES = ['Newcomer', 'Curious Mind', 'Sharp Thinker', 'Scholar', 'Master', 'Legend'];
  const BADGES = [
    { id: 'first', icon: '🌱', name: 'First step', hint: 'Finish 1 quiz', test: s => s.quizzes >= 1 },
    { id: 'five', icon: '🚀', name: 'On a roll', hint: 'Finish 5 quizzes', test: s => s.quizzes >= 5 },
    { id: 'perfect', icon: '💎', name: 'Flawless', hint: 'Score 100%', test: s => s.perfect },
    { id: 'streak', icon: '🔥', name: 'Hot streak', hint: '3 days in a row', test: s => s.streak >= 3 },
    { id: 'century', icon: '🎯', name: 'Century', hint: 'Answer 100 questions', test: s => s.answered >= 100 },
    { id: 'explorer', icon: '🧭', name: 'Explorer', hint: 'Practise 2 subjects', test: s => s.banks >= 2 }
  ];
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function computeStats() {
    const user = read('studysphere.user');
    if (!user || user.role === 'teacher') return null;
    const list = (read('studysphere.attempts') || []).filter(a => a.userEmail === user.email);
    const days = new Set(list.map(a => dayKey(new Date(a.completedAt))));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    const xp = list.reduce((sum, a) => sum + a.correct * 10 + 20 + (a.score === 100 ? 50 : 0), 0);
    return {
      email: user.email, xp, streak, quizzes: list.length,
      answered: list.reduce((n, a) => n + a.answers.filter(x => x.selectedKey).length, 0),
      perfect: list.some(a => a.score === 100),
      banks: new Set(list.flatMap(a => a.answers.map(x => x.bankId || a.bankId))).size
    };
  }

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#20735b', '#f2b84b', '#ef7f5f', '#62a584', '#7aa7e8'];
    for (let i = 0; i < 46; i += 1) {
      const piece = document.createElement('i');
      piece.className = 'confetti';
      piece.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--x:${Math.random() * 160 - 80}px;--r:${Math.random() * 720}deg;--d:${1.6 + Math.random() * 1.4}s;animation-delay:${Math.random() * 0.3}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 3500);
    }
  }

  function render() {
    const s = computeStats();
    const view = document.getElementById('view-dashboard');
    let card = document.getElementById('gamifyCard');
    if (!s || !view) { card?.remove(); return; }
    if (!card) {
      card = document.createElement('section');
      card.id = 'gamifyCard';
      card.className = 'game-card';
      view.querySelector('.page-heading').after(card);
    }
    const level = Math.floor(s.xp / XP_PER_LEVEL) + 1;
    const into = s.xp % XP_PER_LEVEL;
    const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
    card.innerHTML = `
      <div class="game-level"><span class="level-orb">${level}</span>
        <div><strong>${title}</strong><small>Level ${level} · ${s.xp} XP total</small></div>
        <span class="streak-chip ${s.streak ? 'on' : ''}">🔥 ${s.streak} day streak</span></div>
      <div class="xp-track" role="progressbar" aria-valuenow="${into}" aria-valuemax="${XP_PER_LEVEL}"><div class="xp-fill" style="width:${into / XP_PER_LEVEL * 100}%"></div></div>
      <p class="xp-note">${XP_PER_LEVEL - into} XP to level ${level + 1}. Earn 10 XP per correct answer, 20 per finished quiz, 50 for a perfect score.</p>
      <div class="badge-row">${BADGES.map(b => `<div class="badge ${b.test(s) ? 'earned' : ''}" title="${b.hint}"><span>${b.icon}</span><small>${b.name}</small></div>`).join('')}</div>`;
    const key = `studysphere.lastLevel.${s.email}`;
    const last = Number(localStorage.getItem(key));
    if (last && level > last) { confetti(); toast(`Level up! You are now ${title}.`); }
    localStorage.setItem(key, String(level));
  }

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3200);
  }

  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); };

  function init() {
    const watch = (id, opts) => { const el = document.getElementById(id); if (el) new MutationObserver(schedule).observe(el, opts); };
    watch('statQuizzes', { childList: true });
    watch('appShell', { attributes: true, attributeFilter: ['hidden'] });
    const result = document.getElementById('quizResult');
    if (result) new MutationObserver(() => {
      if (result.hidden) return;
      const score = parseInt(result.querySelector('.result-ring')?.textContent, 10);
      if (score >= 80) confetti();
    }).observe(result, { attributes: true, attributeFilter: ['hidden'] });
    schedule();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();