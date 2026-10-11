(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']; // getDay() szerinti index
  const DAY_LONG = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const WEEK = [1, 2, 3, 4, 5, 6, 0]; // hétfővel kezdődő hét
  const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const MONTHS_SHORT = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  const QUICK_ICONS = ['💧', '🏃', '📖', '🧘', '💪', '😴', '🥗', '📝', '🎯', '💰', '🎸', '🌙', '🧹', '💻', '🙏', '⭐'];
  const ROUTES = ['ma', 'szokasok', 'statisztika', 'profil', 'beallitasok'];

  const params = new URLSearchParams(location.search);
  const ui = {
    route: 'ma',
    dayKey: D.today(),
    checkin: params.get('checkin') === '1',
    catFilter: 'all',
    calHabit: null,
    calMonth: D.today().slice(0, 7),
    editId: null,
    preset: null,
    // Első megnyitáskor regisztráció; ha ezen az eszközön már volt fiók, bejelentkezés.
    authMode: lastEmail() ? 'signin' : 'signup', // signin | signup | forgot
    authEmail: lastEmail(),
    authPending: false,
  };
  let installPrompt = null;

  // ---------- Segédfüggvények ----------

  const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const reminderMin = () => {
    const [h, m] = (Store.state.settings.reminderTime || '20:00').split(':').map(Number);
    return h * 60 + m;
  };
  const pct = r => (r == null ? '–' : Math.round(r * 100) + '%');

  function daysLabel(days) {
    const s = [...days].sort().join(',');
    if (days.length === 7) return 'Minden nap';
    if (s === '1,2,3,4,5') return 'Hétköznap';
    if (s === '0,6') return 'Hétvégén';
    return WEEK.filter(d => days.includes(d)).map(d => DAY_SHORT[d]).join(', ');
  }

  function dayTitle(k) {
    const d = D.parse(k);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}., ${DAY_LONG[d.getDay()]}`;
  }

  function dayEyebrow(k) {
    const today = D.today();
    if (k === today) return 'Ma';
    if (k === D.add(today, -1)) return 'Tegnap';
    return String(D.parse(k).getFullYear());
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function celebrate(msg) {
    if (msg) toast(msg);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#e11d2e', '#ff4d5e', '#f5f5f5', '#7f1d1d'];
    for (let i = 0; i < 48; i++) {
      const s = document.createElement('span');
      s.style.setProperty('--x', (Math.random() * 2 - 1) * 46 + 'vw');
      s.style.setProperty('--y', -(30 + Math.random() * 50) + 'vh');
      s.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
      s.style.setProperty('--d', 0.9 + Math.random() * 0.7 + 's');
      s.style.background = colors[i % colors.length];
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1800);
  }

  const checkSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg>';

  // ---------- Ma ----------

  function renderToday() {
    const el = $('#view-ma');
    const s = Store.state;
    const today = D.today();
    const k = ui.dayKey;
    const isToday = k === today;

    if (!s.habits.length) {
      el.innerHTML = renderWelcome();
      return;
    }

    const due = Store.dueHabits(k);
    const done = due.filter(h => Store.isDone(k, h.id)).length;
    const ratio = due.length ? done / due.length : 0;
    const evening = isToday && due.length > 0 && done < due.length && (ui.checkin || minutesNow() >= reminderMin());
    const rest = Store.activeHabits().filter(h => h.createdKey <= k && !h.days.includes(D.dow(k))).length;
    const C = 2 * Math.PI * 34;

    let status;
    if (!due.length) status = 'Erre a napra nincs beosztott szokás.';
    else if (done === due.length) status = isToday ? 'Tökéletes nap! 🔥' : 'Minden kész volt ezen a napon.';
    else status = `Még ${due.length - done} van hátra`;

    el.innerHTML = `
      <header class="view-head">
        <div class="day-nav">
          <button class="icon-btn" data-action="day-prev" aria-label="Előző nap">‹</button>
          <div class="day-label">
            <span class="eyebrow">${dayEyebrow(k)}</span>
            <h1>${dayTitle(k)}</h1>
          </div>
          <button class="icon-btn" data-action="day-next" aria-label="Következő nap" ${isToday ? 'disabled' : ''}>›</button>
        </div>
        ${isToday ? '' : '<button class="btn btn-ghost btn-sm" data-action="day-today">Vissza a mai naphoz</button>'}
      </header>

      ${evening ? `
        <div class="checkin-banner">
          <div class="checkin-moon" aria-hidden="true">🌙</div>
          <div>
            <strong>Esti check-in</strong>
            <p>Hogy ment a mai nap? Pipáld ki, amit teljesítettél.</p>
          </div>
        </div>` : ''}

      ${isToday ? renderHeroCard() : ''}

      <div class="card progress-card">
        <svg class="ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" class="ring-bg"/>
          <circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ratio)}"/>
        </svg>
        <div class="progress-text">
          <div class="progress-num"><strong>${done}</strong> / ${due.length}</div>
          <div class="muted">${status}</div>
        </div>
        <div class="progress-streak" title="Tökéletes napok sorozata">
          <span class="flame">🔥</span>
          <strong>${Stats.perfectStreak()}</strong>
          <span class="muted small">napos sorozat</span>
        </div>
      </div>

      <div class="habit-list">
        ${due.map(h => {
          const isDone = Store.isDone(k, h.id);
          const streak = Stats.habitStreak(h);
          return `
            <button class="habit ${isDone ? 'is-done' : ''}" data-action="toggle" data-id="${h.id}" aria-pressed="${isDone}">
              <span class="habit-icon">${esc(h.icon)}</span>
              <span class="habit-body">
                <span class="habit-name">${esc(h.name)}</span>
                <span class="habit-meta">${streak ? `🔥 ${streak} napos sorozat` : esc(CATEGORIES[h.category]?.label || '')}</span>
              </span>
              <span class="check">${checkSvg}</span>
            </button>`;
        }).join('')}
      </div>

      ${!due.length ? '<div class="empty">Pihenőnap 😌 Nézz körül a <a href="#szokasok">szokásaid</a> között.</div>' : ''}
      ${rest && due.length ? `<p class="muted small center">+${rest} szokás ezen a napon nincs beosztva.</p>` : ''}
    `;
  }

  // ---------- Hős ----------

  const xpPct = h => Math.round((h.into / h.need) * 100);

  function featuredRow(size, withSlots) {
    const { earned } = Badges.compute();
    const ids = Badges.featured(earned);
    const medals = ids.map(id => Badges.medal(Badges.BY_ID[id], size)).join('');
    const slots = withSlots ? '<span class="medal-slot" aria-hidden="true">+</span>'.repeat(3 - ids.length) : '';
    return { html: medals + slots, count: ids.length };
  }

  function renderHeroCard() {
    const h = Hero.compute();
    const fr = featuredRow('sm', false);
    return `
      <div class="card hero-card" id="hero-card">
        <a class="hero-figure" href="#profil" aria-label="Profil megnyitása">${Hero.svg(h.stage, h.mood)}</a>
        <div class="hero-info">
          <div class="hero-top">
            <strong class="hero-name">${esc(Hero.name())}</strong>
            <span class="hero-rank">${h.stageName}</span>
            ${fr.count ? `<a class="featured-row" href="#profil" aria-label="Kiemelt badge-ek">${fr.html}</a>` : ''}
          </div>
          <div class="hero-level"><span>${h.level}. szint</span><span class="muted small">${h.into} / ${h.need} XP</span></div>
          <div class="xp-bar" role="progressbar" aria-label="Tapasztalat a következő szintig" aria-valuemin="0" aria-valuemax="${h.need}" aria-valuenow="${h.into}"><span style="width:${xpPct(h)}%"></span></div>
          <p class="hero-bubble">${esc(Hero.message(h))}</p>
        </div>
      </div>`;
  }

  function renderHeroPanel() {
    const h = Hero.compute();
    const fr = featuredRow('md', true);
    return `
      <div class="card hero-panel">
        <div class="hero-panel-main">
          <div class="hero-figure big">${Hero.svg(h.stage, h.mood)}</div>
          <div class="hero-info">
            <h2 class="hero-panel-name">${esc(Hero.name())}</h2>
            <div class="hero-top"><span class="hero-rank">${h.stageName}</span><span class="muted small">${h.level}. szint · ${h.xp} XP összesen</span></div>
            <div class="featured-panel" title="Kiemelt badge-ek – a gyűjteményben választhatod ki őket">${fr.html}</div>
            <div class="xp-bar"><span style="width:${xpPct(h)}%"></span></div>
            <p class="muted small">${h.into} / ${h.need} XP a ${h.level + 1}. szintig</p>
            <p class="hero-next">${h.next
              ? `Következő rang: <strong>${h.next.name}</strong> a ${h.next.min}. szinten – még ${h.toNext} XP.`
              : 'Elérted a legmagasabb rangot. Legenda vagy! 👑'}</p>
          </div>
        </div>
        <div class="hero-road">
          ${Hero.STAGES.map((st, i) => `
            <div class="road-step ${i <= h.stage ? 'is-unlocked' : 'is-locked'} ${i === h.stage ? 'is-current' : ''}">
              ${Hero.svg(i, 'ready', 'mini')}
              <span class="road-name">${st.name}</span>
              <span class="road-lvl">${i <= h.stage ? (i === h.stage ? 'Most' : '✓') : `🔒 ${st.min}. szint`}</span>
            </div>`).join('')}
        </div>
        <p class="muted small hero-rules">+${Hero.XP_HABIT} XP minden teljesített szokásért · +${Hero.XP_PERFECT} XP tökéletes napért · −${Hero.XP_MISS} XP, ha egy napon semmit nem teljesítesz (az elért rangból nem esel vissza) · minden badge extra XP-t ad a nehézségétől függően.</p>
      </div>`;
  }

  function showXp(diff) {
    if (!diff) return;
    const card = $('#hero-card');
    const label = (diff > 0 ? '+' : '−') + Math.abs(diff) + ' XP';
    if (!card) return;
    const f = document.createElement('span');
    f.className = 'xp-float ' + (diff > 0 ? 'up' : 'down');
    f.textContent = label;
    card.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  function showEvolution(h) {
    const st = Hero.STAGES[h.stage];
    $('#evolve-figure').innerHTML = Hero.svg(h.stage, 'proud');
    $('#evolve-title').textContent = `${Hero.name()} mostantól: ${st.name}!`;
    $('#evolve-text').textContent = `${h.level}. szint · Új felszerelés: ${st.gear}`;
    $('#evolve-dialog').showModal();
  }

  function showBadge(b) {
    $('#badge-figure').innerHTML = Badges.medal(b, 'xl');
    $('#badge-tier').innerHTML = `${Badges.TIERS[b.tier]} badge · <span class="xp-reward">+${b.xp} XP</span>`;
    $('#badge-title').textContent = b.name;
    $('#badge-text').textContent = b.desc;
    const full = Badges.featured(Badges.compute().earned).length >= 3;
    const btn = $('#badge-feature');
    btn.dataset.id = b.id;
    btn.textContent = full ? 'Megnézem a profilon' : 'Kiemelem a profilomon';
    $('#badge-dialog').showModal();
  }

  const snapshot = () => ({ hero: Hero.compute(), earned: Badges.compute().earned });

  // Pipálás utáni visszajelzés: XP, szintlépés, rangfejlődés, új badge, tökéletes nap.
  function heroFeedback(prev, perfectNow) {
    const before = prev.hero;
    const after = Hero.compute();
    const { earned } = Badges.compute();
    const fresh = [...earned].filter(id => !prev.earned.has(id) && Badges.unseen(earned).includes(id));
    if (fresh.length) Badges.markSeen(fresh);
    updateNavDot();
    showXp(after.xp - before.xp);
    if (after.stage > before.stage) {
      showEvolution(after);
      celebrate(fresh.length ? `🏅 Új badge: ${Badges.BY_ID[fresh[0]].name}!` : null);
    } else if (fresh.length) {
      showBadge(Badges.BY_ID[fresh[fresh.length - 1]]);
      celebrate(null);
    } else if (after.level > before.level) {
      celebrate(perfectNow ? `Tökéletes nap! 🔥 Szintlépés: ${after.level}. szint ⬆️` : `Szintlépés! ${after.level}. szint ⬆️`);
      $('#hero-card')?.classList.add('level-up');
    } else if (perfectNow) {
      celebrate('Tökéletes nap! 🔥 Minden szokás kész.');
    }
  }

  function renderWelcome() {
    const s = Store.state;
    return `
      <header class="view-head">
        <div>
          <span class="eyebrow">Üdv a Habytban</span>
          <h1>Építsünk szokásokat.</h1>
        </div>
      </header>
      <div class="card hero-card hero-intro">
        <div class="hero-figure">${Hero.svg(0, 'ready')}</div>
        <div class="hero-info">
          <strong class="hero-name">${esc(Hero.name())}, az Újonc</strong>
          <p class="hero-bubble">Szia! Én vagyok a hősöd. Minden teljesített szokásod erősebbé tesz: szintet lépek, és egyszer talán Legenda leszek! ⚔️</p>
        </div>
      </div>
      <div class="card quiz-cta">
        <div class="quiz-cta-icon" aria-hidden="true">🧭</div>
        <div>
          <strong>Nem tudod, hol kezdd?</strong>
          <p class="muted small">Válaszolj 7 gyors kérdésre (kb. 2–3 perc), és összerakom a neked való kezdő szokásokat.</p>
        </div>
        <button class="btn btn-primary" data-action="open-quiz">${s.settings.quiz ? 'Újra kitöltöm' : 'Kitöltöm'}</button>
      </div>
      <div class="card hero">
        <p>Vagy válassz magad 1–3 szokást az induláshoz. Minden este ${esc(s.settings.reminderTime)}-kor itt pipálhatod ki, mit teljesítettél, a sorozataidat pedig a Statisztikában követheted.</p>
      </div>
      ${renderGoalCard()}
      <h2 class="section-title">Javasolt kezdésnek</h2>
      ${renderSuggestions(4)}
      <div class="center">
        <a class="btn btn-ghost" href="#szokasok">Teljes katalógus és saját szokás</a>
      </div>
      ${Sync.enabled && !Sync.user ? '<p class="muted small center">Már használod a Habytot másik eszközön? <a href="#beallitasok">Jelentkezz be</a>, és megjönnek a szokásaid.</p>' : ''}
    `;
  }

  // ---------- Szokások ----------

  function renderGoalCard() {
    const goal = Store.state.settings.goal;
    if (Store.state.settings.onboarded && goal) return '';
    return `
      <div class="card goal-card">
        <h2>Mi a fő célod?</h2>
        <p class="muted">Ez alapján javaslok neked szokásokat.</p>
        <div class="chips">
          ${Object.entries(GOALS).map(([id, g]) => `
            <button class="chip ${goal === id ? 'is-on' : ''}" data-action="set-goal" data-goal="${id}">${g.icon} ${g.label}</button>`).join('')}
        </div>
      </div>`;
  }

  function renderSuggestions(n) {
    const list = Suggest.top(n);
    if (!list.length) return '<p class="muted">Minden javasolt szokást felvettél már. 💪</p>';
    return `<div class="suggest-grid">
      ${list.map(({ item, reason }) => `
        <div class="suggest">
          <span class="habit-icon">${item.icon}</span>
          <div class="suggest-body">
            <div class="suggest-name">${esc(item.name)}</div>
            <div class="suggest-reason">${esc(reason)}</div>
          </div>
          <button class="btn btn-primary btn-sm" data-action="add-catalog" data-cid="${item.id}" aria-label="${esc(item.name)} hozzáadása">+ Hozzáad</button>
        </div>`).join('')}
    </div>`;
  }

  // ---------- Kezdő kérdőív ----------

  const quizDlg = $('#quiz-dialog');
  const quiz = { step: 0, answers: {}, result: null, chosen: new Set() };

  function openQuiz() {
    quiz.step = 0;
    quiz.answers = {};
    quiz.result = null;
    renderQuiz();
    if (!quizDlg.open) quizDlg.showModal();
  }

  // Regisztráció után: ha még nincs szokása és nem töltötte ki, rögtön jön a kérdőív.
  function maybeStartQuiz() {
    if (!Store.state.settings.quizDone && !Store.activeHabits().length) openQuiz();
  }

  function renderQuiz() {
    const qs = Quiz.QUESTIONS;
    const body = $('#quiz-body');

    if (quiz.step < qs.length) {
      const q = qs[quiz.step];
      const val = quiz.answers[q.id];
      const on = id => (q.multi ? (val || []).includes(id) : val === id);
      const ok = q.multi ? (val || []).length > 0 : !!val;
      body.innerHTML = `
        <div class="quiz-top">
          <span class="eyebrow">Kezdő kérdőív · ${quiz.step + 1} / ${qs.length}</span>
          <button type="button" class="link-btn" data-quiz="skip">Kihagyom</button>
        </div>
        <div class="xp-bar thin quiz-progress"><span style="width:${Math.round((quiz.step / qs.length) * 100)}%"></span></div>
        <h2>${q.title}</h2>
        ${q.hint ? `<p class="muted small quiz-hint">${q.hint}</p>` : ''}
        <div class="quiz-options ${q.options.length > 4 ? 'is-grid' : ''}" role="group" aria-label="${q.title}">
          ${q.options.map(o => `
            <button type="button" class="quiz-opt" data-quiz="pick" data-id="${o.id}" aria-pressed="${on(o.id)}">
              <span class="quiz-icon" aria-hidden="true">${o.icon}</span>
              <span class="quiz-label">${o.label}${o.desc ? `<small>${o.desc}</small>` : ''}</span>
            </button>`).join('')}
        </div>
        <div class="quiz-nav">
          <button type="button" class="btn btn-ghost" data-quiz="back" ${quiz.step ? '' : 'disabled'}>Vissza</button>
          <button type="button" class="btn btn-primary" data-quiz="next" ${ok ? '' : 'disabled'}>${quiz.step === qs.length - 1 ? 'Mutasd az ajánlást' : 'Tovább'}</button>
        </div>`;
      return;
    }

    // Eredmény: az ajánlott csomag előre kijelölve, alatta további ötletek.
    if (!quiz.result) {
      const taken = new Set(Store.activeHabits().map(h => h.catalogId).filter(Boolean));
      quiz.result = Quiz.recommend(quiz.answers, taken);
      quiz.chosen = new Set(quiz.result.picks.map(r => r.item.id));
    }
    const { picks, extra, days } = quiz.result;
    const row = r => `
      <button type="button" class="quiz-pick" data-quiz="choose" data-id="${r.item.id}" aria-pressed="${quiz.chosen.has(r.item.id)}">
        <span class="habit-icon">${r.item.icon}</span>
        <span class="quiz-pick-body"><strong>${esc(r.item.name)}</strong><small>${esc(r.reason)}</small></span>
        <span class="check">${checkSvg}</span>
      </button>`;
    body.innerHTML = `
      <div class="quiz-top"><span class="eyebrow">Kész! · A kezdő csomagod</span></div>
      <div class="xp-bar thin quiz-progress"><span style="width:100%"></span></div>
      <div class="quiz-result-head">
        <div class="hero-figure">${Hero.svg(0, 'proud')}</div>
        <p class="hero-bubble">A válaszaid alapján ezekkel érdemes kezdenünk! Kevesebb szokással könnyebb kitartani, később bármikor bővítheted. Koppints egy szokásra a ki- vagy bekapcsoláshoz.</p>
      </div>
      <div class="quiz-picks">${picks.map(row).join('')}</div>
      ${extra.length ? `<p class="muted small quiz-sub">További ötletek</p><div class="quiz-picks">${extra.map(row).join('')}</div>` : ''}
      <p class="muted small">Gyakoriság: <strong>${daysLabel(days)}</strong>. Minden este ${esc(Store.state.settings.reminderTime)}-kor itt pipálhatod ki őket.</p>
      <div class="quiz-nav">
        <button type="button" class="btn btn-ghost" data-quiz="back">Vissza</button>
        <button type="button" class="btn btn-primary" data-quiz="finish" ${quiz.chosen.size ? '' : 'disabled'}>Hozzáadom (${quiz.chosen.size})</button>
      </div>`;
  }

  function finishQuiz() {
    const { days } = quiz.result;
    const ids = [...quiz.result.picks, ...quiz.result.extra].map(r => r.item.id).filter(id => quiz.chosen.has(id));
    for (const id of ids) {
      const c = CATALOG_BY_ID[id];
      const old = Store.state.habits.find(h => h.catalogId === id && h.archivedKey);
      if (old) Store.updateHabit(old.id, { archivedKey: null, days });
      else Store.addHabit({ name: c.name, icon: c.icon, category: c.cat, days, catalogId: c.id });
    }
    Store.setShared({ quiz: quiz.answers, quizDone: true, goal: quiz.answers.goal || Store.state.settings.goal, onboarded: true });
    quizDlg.close();
    location.hash = '#ma';
    render();
    celebrate(`${ids.length} szokás hozzáadva. Hajrá, ${Hero.name()}! ⚔️`);
  }

  quizDlg.addEventListener('click', e => {
    const b = e.target.closest('[data-quiz]');
    if (!b || b.disabled) return;
    const q = Quiz.QUESTIONS[quiz.step];
    switch (b.dataset.quiz) {
      case 'pick': {
        if (q.multi) {
          const list = quiz.answers[q.id] || [];
          const id = b.dataset.id;
          if (list.includes(id)) quiz.answers[q.id] = list.filter(x => x !== id);
          else if (list.length >= q.multi) {
            // A kérdőív a toast fölött van, ezért a figyelmeztetés a kérdés alatt villan fel.
            const hint = $('#quiz-body .quiz-hint');
            if (hint) { hint.classList.remove('is-warn'); void hint.offsetWidth; hint.classList.add('is-warn'); }
            return;
          }
          else quiz.answers[q.id] = [...list, id];
          renderQuiz();
        } else {
          // Egyválasztós kérdésnél rögtön továbblép.
          quiz.answers[q.id] = b.dataset.id;
          quiz.result = null;
          renderQuiz();
          setTimeout(() => { if (quizDlg.open && Quiz.QUESTIONS[quiz.step] === q) { quiz.step++; renderQuiz(); } }, 260);
        }
        quiz.result = null;
        break;
      }
      case 'next': quiz.step++; renderQuiz(); break;
      case 'back': quiz.step = Math.max(0, quiz.step - 1); renderQuiz(); break;
      case 'choose': {
        const id = b.dataset.id;
        if (quiz.chosen.has(id)) quiz.chosen.delete(id); else quiz.chosen.add(id);
        renderQuiz();
        break;
      }
      case 'finish': finishQuiz(); break;
      case 'skip':
        quizDlg.close();
        break;
    }
  });

  // Bezárás (Kihagyom vagy Esc): többé nem ugrik fel magától, de a Ma és a Szokások oldalról elindítható.
  quizDlg.addEventListener('close', () => {
    if (!Store.state.settings.quizDone) Store.setShared({ quizDone: true });
    render();
  });

  function renderHabits() {
    const el = $('#view-szokasok');
    const active = Store.activeHabits();
    const archived = Store.state.habits.filter(h => h.archivedKey);
    const takenIds = new Set(active.map(h => h.catalogId));
    const cats = Object.keys(CATEGORIES).filter(c => c !== 'egyeb');
    const catalog = CATALOG.filter(c => ui.catFilter === 'all' || c.cat === ui.catFilter);

    el.innerHTML = `
      <header class="view-head row-between">
        <div>
          <span class="eyebrow">${active.length} aktív szokás</span>
          <h1>Szokásaim</h1>
        </div>
        <button class="btn btn-primary" data-action="open-new">+ Új szokás</button>
      </header>

      ${renderGoalCard()}

      ${active.length ? `
        <div class="card list-card">
          ${active.map(h => `
            <div class="row">
              <span class="habit-icon">${esc(h.icon)}</span>
              <div class="row-body">
                <div class="row-title">${esc(h.name)}</div>
                <div class="row-meta">${esc(CATEGORIES[h.category]?.label || 'Egyéb')} · ${daysLabel(h.days)}</div>
              </div>
              <span class="pill" title="Jelenlegi sorozat">🔥 ${Stats.habitStreak(h)}</span>
              <button class="icon-btn" data-action="edit" data-id="${h.id}" aria-label="${esc(h.name)} szerkesztése">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
              </button>
            </div>`).join('')}
        </div>` : '<div class="empty">Még nincs szokásod. Válassz a javaslatok közül, vagy hozz létre sajátot!</div>'}

      ${archived.length ? `
        <details class="archived">
          <summary>Archivált szokások (${archived.length})</summary>
          <div class="card list-card">
            ${archived.map(h => `
              <div class="row is-archived">
                <span class="habit-icon">${esc(h.icon)}</span>
                <div class="row-body"><div class="row-title">${esc(h.name)}</div></div>
                <button class="btn btn-ghost btn-sm" data-action="restore" data-id="${h.id}">Visszaállítás</button>
              </div>`).join('')}
          </div>
        </details>` : ''}

      <div class="section-title row-between">
        <h2>✨ Javasolt neked</h2>
        <button class="link-btn" data-action="open-quiz">🧭 ${Store.state.settings.quiz ? 'Kérdőív újra' : 'Kérdőív kitöltése'}</button>
      </div>
      ${renderSuggestions(6)}

      <h2 class="section-title">Katalógus</h2>
      <div class="chips scroll-x">
        <button class="chip ${ui.catFilter === 'all' ? 'is-on' : ''}" data-action="cat-filter" data-cat="all">Mind</button>
        ${cats.map(c => `<button class="chip ${ui.catFilter === c ? 'is-on' : ''}" data-action="cat-filter" data-cat="${c}">${CATEGORIES[c].icon} ${CATEGORIES[c].label}</button>`).join('')}
      </div>
      <div class="catalog-grid">
        ${catalog.map(c => {
          const added = takenIds.has(c.id);
          return `
            <button class="catalog-item ${added ? 'is-added' : ''}" data-action="add-catalog" data-cid="${c.id}" ${added ? 'disabled' : ''}>
              <span class="habit-icon">${c.icon}</span>
              <span class="catalog-name">${esc(c.name)}</span>
              <span class="catalog-add">${added ? '✓' : '+'}</span>
            </button>`;
        }).join('')}
      </div>
    `;
  }

  // ---------- Szokás űrlap ----------

  const dlg = $('#habit-dialog');

  function setDays(days) {
    $('#f-days').innerHTML = WEEK.map(d => `
      <button type="button" class="day-toggle" data-day="${d}" aria-pressed="${days.includes(d)}" aria-label="${DAY_LONG[d]}">${DAY_SHORT[d]}</button>`).join('');
  }

  function formDays() {
    return [...$('#f-days').querySelectorAll('[aria-pressed="true"]')].map(b => Number(b.dataset.day));
  }

  function openHabitDialog(id) {
    const h = id ? Store.find(id) : null;
    ui.editId = h ? h.id : null;
    $('#dlg-title').textContent = h ? 'Szokás szerkesztése' : 'Új szokás';
    $('#f-name').value = h ? h.name : '';
    $('#f-icon').value = h ? h.icon : '⭐';
    $('#f-cat').innerHTML = Object.entries(CATEGORIES).map(([cid, c]) =>
      `<option value="${cid}" ${(h ? h.category : 'egyeb') === cid ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('');
    setDays(h ? h.days : [0, 1, 2, 3, 4, 5, 6]);
    $('#f-icon-quick').innerHTML = QUICK_ICONS.map(i => `<button type="button" class="icon-opt" data-icon="${i}">${i}</button>`).join('');
    $('#f-error').textContent = '';
    $('#f-archive').hidden = !h;
    $('#f-delete').hidden = !h;
    dlg.showModal();
    if (!h) $('#f-name').focus();
  }

  $('#f-days').addEventListener('click', e => {
    const b = e.target.closest('.day-toggle');
    if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
  });
  dlg.querySelector('.day-presets').addEventListener('click', e => {
    const p = e.target.dataset.preset;
    if (p) setDays(p === 'all' ? [0, 1, 2, 3, 4, 5, 6] : p === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 6]);
  });
  $('#f-icon-quick').addEventListener('click', e => {
    const i = e.target.dataset.icon;
    if (i) $('#f-icon').value = i;
  });
  $('#f-cancel').addEventListener('click', () => dlg.close());
  $('#f-archive').addEventListener('click', () => {
    Store.archive(ui.editId);
    dlg.close();
    toast('Archiválva. A korábbi eredményei megmaradnak.');
    render();
  });
  $('#f-delete').addEventListener('click', () => {
    const h = Store.find(ui.editId);
    if (!h || !confirm(`Biztosan törlöd: „${h.name}”? Az összes eddigi pipája is elvész.`)) return;
    Store.remove(h.id);
    dlg.close();
    toast('Szokás törölve.');
    render();
  });
  $('#habit-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#f-name').value.trim();
    const days = formDays();
    if (!name) { $('#f-error').textContent = 'Adj nevet a szokásnak.'; return; }
    if (!days.length) { $('#f-error').textContent = 'Válassz legalább egy napot.'; return; }
    const data = { name, icon: $('#f-icon').value.trim() || '⭐', category: $('#f-cat').value, days };
    if (ui.editId) {
      Store.updateHabit(ui.editId, { ...data, days: [...days].sort() });
      toast('Mentve.');
    } else {
      Store.addHabit(data);
      toast(`Hozzáadva: ${data.icon} ${name}`);
    }
    dlg.close();
    render();
  });

  // ---------- Statisztika ----------

  function renderStats() {
    const el = $('#view-statisztika');
    const habits = Store.state.habits;
    if (!habits.length) {
      el.innerHTML = `
        <header class="view-head"><div><span class="eyebrow">Statisztika</span><h1>Még nincs adat</h1></div></header>
        <div class="empty">Adj hozzá szokásokat, és itt látod majd a naptárat és a sorozataidat.</div>
        ${renderLeaderboard()}`;
      loadBoard();
      return;
    }
    const active = Store.activeHabits();
    if (!ui.calHabit || !Store.find(ui.calHabit)) ui.calHabit = (active[0] || habits[0]).id;

    el.innerHTML = `
      <header class="view-head"><div><span class="eyebrow">Visszatekintés</span><h1>Statisztika</h1></div></header>

      <div class="tiles">
        <div class="tile tile-hot"><span class="tile-label">Tökéletes napok sorozata</span><span class="tile-value">🔥 ${Stats.perfectStreak()}</span></div>
        <div class="tile"><span class="tile-label">Leghosszabb sorozat</span><span class="tile-value">🏆 ${Stats.perfectBest()}</span></div>
        <div class="tile"><span class="tile-label">Elmúlt 30 nap</span><span class="tile-value">${pct(Stats.overallRate(30))}</span></div>
        <div class="tile"><span class="tile-label">Összes pipa</span><span class="tile-value">${Stats.totalChecks()}</span></div>
      </div>

      ${renderLeaderboard()}

      <div class="card">
        <div class="card-head">
          <h2>Az elmúlt év</h2>
          <div class="legend"><span>Kevesebb</span>${[0, 1, 2, 3, 4].map(l => `<i class="lv${l}"></i>`).join('')}<span>Több</span></div>
        </div>
        <div class="heatmap-scroll" id="heatmap-scroll">${renderHeatmap()}</div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Havi naptár</h2></div>
        <div class="chips scroll-x">
          ${habits.map(h => `<button class="chip ${ui.calHabit === h.id ? 'is-on' : ''}" data-action="cal-habit" data-id="${h.id}">${esc(h.icon)} ${esc(h.name)}</button>`).join('')}
        </div>
        ${renderMonth(Store.find(ui.calHabit))}
      </div>

      <div class="card list-card">
        <div class="card-head"><h2>Sorozatok szokásonként</h2></div>
        ${[...active].sort((a, b) => Stats.habitStreak(b) - Stats.habitStreak(a)).map(h => `
          <div class="row">
            <span class="habit-icon">${esc(h.icon)}</span>
            <div class="row-body">
              <div class="row-title">${esc(h.name)}</div>
              <div class="row-meta">Elmúlt 30 nap: ${pct(Stats.habitRate(h, 30))}</div>
            </div>
            <span class="pill pill-hot" title="Jelenlegi sorozat">🔥 ${Stats.habitStreak(h)}</span>
            <span class="pill" title="Leghosszabb sorozat">🏆 ${Stats.habitBest(h)}</span>
          </div>`).join('') || '<p class="muted">Nincs aktív szokás.</p>'}
      </div>
    `;
    const sc = $('#heatmap-scroll');
    sc.scrollLeft = sc.scrollWidth;
    loadBoard();
  }

  function renderHeatmap() {
    const today = D.today();
    const offset = (D.dow(today) + 6) % 7; // hány nap telt el hétfő óta
    const start = D.add(today, -offset - 52 * 7);
    let months = '';
    let cells = '';
    let lastMonth = -1;
    for (let w = 0; w < 53; w++) {
      const monday = D.add(start, w * 7);
      const m = D.parse(monday).getMonth();
      months += `<span style="grid-column:${w + 1}">${m !== lastMonth ? MONTHS_SHORT[m] : ''}</span>`;
      lastMonth = m;
      for (let d = 0; d < 7; d++) {
        const k = D.add(monday, d);
        if (k > today) { cells += '<span class="hm-cell is-future"></span>'; continue; }
        const lv = Stats.level(k);
        const { due, done } = Stats.day(k);
        const dt = D.parse(k);
        const label = `${dt.getFullYear()}. ${MONTHS_SHORT[dt.getMonth()]}. ${dt.getDate()}. – ${due ? `${done}/${due} kész` : 'nincs szokás'}`;
        cells += `<button class="hm-cell ${lv < 0 ? 'lv-none' : 'lv' + lv} ${k === today ? 'is-today' : ''}" data-action="heat-day" data-key="${k}" title="${label}" aria-label="${label}"></button>`;
      }
    }
    return `
      <div class="heatmap">
        <div class="hm-days"><span>H</span><span></span><span>Sze</span><span></span><span>P</span><span></span><span>V</span></div>
        <div class="hm-main">
          <div class="hm-months">${months}</div>
          <div class="hm-grid">${cells}</div>
        </div>
      </div>`;
  }

  function renderMonth(h) {
    const today = D.today();
    const [y, m] = ui.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysIn = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const isCurrent = ui.calMonth >= today.slice(0, 7);
    let due = 0;
    let done = 0;
    let cells = '<span class="cal-blank"></span>'.repeat(lead);

    for (let day = 1; day <= daysIn; day++) {
      const k = D.key(new Date(y, m - 1, day));
      const isDone = Store.isDone(k, h.id);
      const isDue = Store.isDue(h, k);
      const can = Store.canLog(h, k);
      const cls = ['cal-day'];
      if (isDone) cls.push('is-done');
      else if (isDue && k < today) cls.push('is-missed');
      if (!h.days.includes(D.dow(k))) cls.push('is-rest');
      if (k > today) cls.push('is-future');
      if (k === today) cls.push('is-today');
      if (isDue && k <= today && (k < today || isDone)) { due++; if (isDone) done++; }
      cells += can
        ? `<button class="${cls.join(' ')}" data-action="cal-toggle" data-key="${k}" aria-pressed="${isDone}" aria-label="${MONTHS[m - 1]} ${day}.">${day}</button>`
        : `<span class="${cls.join(' ')}">${day}</span>`;
    }

    return `
      <div class="cal-head">
        <button class="icon-btn" data-action="cal-prev" aria-label="Előző hónap">‹</button>
        <strong>${y}. ${MONTHS[m - 1]}</strong>
        <button class="icon-btn" data-action="cal-next" aria-label="Következő hónap" ${isCurrent ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid">
        ${WEEK.map(d => `<span class="cal-dow">${DAY_SHORT[d]}</span>`).join('')}
        ${cells}
      </div>
      <p class="muted small cal-foot">${due ? `Ebben a hónapban: <strong>${done}/${due}</strong> (${pct(done / due)}) · ` : ''}Kattints egy napra a pipa utólagos módosításához.</p>`;
  }

  // ---------- Ranglétra ----------

  // A szerverről jött adatot röviden gyorsítótárazzuk, hogy ne kérjük le minden újrarajzolásnál.
  const BOARD_TTL = 60000;
  const board = { rows: null, at: 0, loading: false, error: '' };
  const myRank = { info: null, at: 0, loading: false, error: '' };
  const fmtXp = n => Number(n).toLocaleString('hu-HU');
  const stageIndex = name => Math.max(0, Hero.STAGES.findIndex(s => s.name === name));
  const boardReady = () => Sync.enabled && Sync.user;

  function fetchCached(cache, load, after, force) {
    if (!boardReady() || cache.loading) return;
    if (!force && cache.at && Date.now() - cache.at < BOARD_TTL) return;
    cache.loading = true;
    load()
      .then(res => { cache.error = ''; after(res); })
      .catch(err => { cache.error = err instanceof TypeError || !navigator.onLine ? 'Nincs kapcsolat a szerverrel.' : 'Nem sikerült betölteni.'; })
      .finally(() => {
        cache.at = Date.now();
        cache.loading = false;
        const box = $('#leaderboard');
        if (box) box.innerHTML = leaderboardBody();
        const rk = $('#my-rank');
        if (rk) rk.innerHTML = rankBody();
      });
  }

  const loadBoard = force => fetchCached(board, Sync.leaderboard, rows => { board.rows = rows || []; }, force);
  const loadRank = force => fetchCached(myRank, Sync.myRank, info => { myRank.info = info; }, force);

  function resetBoard() {
    board.rows = null; board.at = 0; board.error = '';
    myRank.info = null; myRank.at = 0; myRank.error = '';
  }

  // Holtversenynél ugyanaz a helyezés jár (1, 2, 2, 4 …).
  function withRanks(rows) {
    return rows.map((r, i) => ({ ...r, rank: i && r.xp === rows[i - 1].xp ? null : i + 1 }))
      .map((r, i, a) => { if (r.rank === null) r.rank = a[i - 1].rank; return r; });
  }

  function renderLeaderboard() {
    if (!Sync.enabled) return '';
    return `
      <div class="card leaderboard-card">
        <div class="card-head">
          <h2>🏆 Ranglétra</h2>
          ${Sync.user ? '<button class="icon-btn" data-action="board-refresh" aria-label="Ranglétra frissítése" title="Frissítés">↻</button>' : ''}
        </div>
        <div id="leaderboard">${leaderboardBody()}</div>
      </div>`;
  }

  function leaderboardBody() {
    if (!Sync.user) return '<p class="muted">Jelentkezz be a <a href="#beallitasok">Beállításokban</a>, és mérd össze a hősödet a többiekkel!</p>';
    if (!board.rows) return board.error ? `<p class="muted">${board.error}</p>` : '<p class="muted">Ranglétra betöltése…</p>';
    if (!board.rows.length) return '<p class="muted">Még senki sincs a ranglétrán. Légy te az első!</p>';

    const me = Sync.user.id;
    const rows = withRanks(board.rows);
    const top = rows.slice(0, 3);
    const rest = rows.slice(3);
    const spot = (r, place) => !r ? `<div class="podium-spot place-${place} is-empty"><div class="podium-block"><span class="podium-rank">${place}</span></div></div>` : `
      <div class="podium-spot place-${place} ${r.user_id === me ? 'is-me' : ''}">
        <span class="podium-bubble"><span>${esc(r.hero_name)}</span></span>
        <div class="podium-hero">${Hero.svg(stageIndex(r.stage), place === 1 ? 'proud' : 'ready', '', { gender: r.gender, skin: r.skin })}</div>
        <div class="podium-block">
          <span class="podium-rank">${r.rank}</span>
          <span class="podium-meta">Lv ${r.level} · ${esc(r.stage)}</span>
          <span class="podium-xp">${fmtXp(r.xp)} XP</span>
        </div>
      </div>`;

    return `
      <div class="podium">${spot(top[1], 2)}${spot(top[0], 1)}${spot(top[2], 3)}</div>
      ${rest.length ? `
        <div class="ladder" role="list">
          ${rest.map(r => `
            <div class="ladder-row ${r.user_id === me ? 'is-me' : ''}" role="listitem">
              <span class="ladder-rank">${r.rank}.</span>
              <span class="ladder-name">${esc(r.hero_name)}${r.user_id === me ? ' <span class="you-tag">Te</span>' : ''}<span class="ladder-stage">${esc(r.stage)}</span></span>
              <span class="ladder-lv">Lv ${r.level}</span>
              <span class="ladder-xp">${fmtXp(r.xp)} XP</span>
            </div>`).join('')}
        </div>` : ''}
      ${Store.state.settings.leaderboardHidden ? '<p class="muted small ladder-note">A hősöd most rejtve van. A <a href="#beallitasok">Beállításokban</a> kapcsolhatod be.</p>' : ''}
      <p class="muted small ladder-note">Az első 100 hős látszik. A saját helyezésedet a <a href="#profil">Profilodon</a> találod.</p>`;
  }

  function rankBody() {
    if (!Sync.user) return '<p class="muted small">🏆 <a href="#beallitasok">Jelentkezz be</a>, és megtudod, hányadik vagy a ranglétrán.</p>';
    if (Store.state.settings.leaderboardHidden) return '<p class="muted small">🏆 Rejtve vagy a ranglétrán. A <a href="#beallitasok">Beállításokban</a> kapcsolhatod be.</p>';
    if (!myRank.info) return `<p class="muted small">🏆 ${myRank.error || 'Helyezés betöltése…'}</p>`;
    const { rank, total } = myRank.info;
    return `
      <div class="rank-line">
        <span class="rank-place">🏆 <strong>${rank}.</strong> helyezés</span>
        <span class="muted small">${fmtXp(total)} hős közül</span>
        <a class="rank-link" href="#statisztika">Ranglétra →</a>
      </div>`;
  }

  // ---------- Profil ----------

  function fmtDate(k) {
    const d = D.parse(k);
    return `${d.getFullYear()}. ${MONTHS_SHORT[d.getMonth()]}. ${d.getDate()}.`;
  }

  function renderProfile() {
    const el = $('#view-profil');
    const { badges, tracks, earned } = Badges.compute();
    const featured = Badges.featured(earned);
    const fresh = new Set(Badges.unseen(earned));

    // Előbb a folyamatban lévők (haladás szerint), aztán a még el nem kezdettek, végül a teljesen kész sorozatok.
    const active = tracks.filter(t => t.next && t.hasHabits).sort((a, b) => b.current / b.next.target - a.current / a.next.target);
    const idle = tracks.filter(t => t.next && !t.hasHabits);
    const done = tracks.filter(t => !t.next);

    const challengeRow = t => {
      const b = t.next;
      const cur = Math.min(t.current, b.target);
      const unit = t.kind === 'checks' ? 'pipa' : 'nap';
      return `
        <div class="challenge ${t.hasHabits ? '' : 'is-idle'}">
          ${Badges.medal(b, 'md', 'is-locked')}
          <div class="challenge-body">
            <div class="challenge-top"><strong>${b.name}</strong><span class="muted small">${t.name} · ${Badges.TIERS[b.tier]}</span><span class="xp-reward">+${b.xp} XP</span></div>
            <div class="challenge-desc">${b.desc}</div>
            ${t.hasHabits ? `
              <div class="xp-bar thin"><span style="width:${Math.round((cur / b.target) * 100)}%"></span></div>
              <div class="challenge-meta"><span>${cur} / ${b.target} ${unit}</span>${t.kind !== 'checks' && t.best > t.current ? `<span>Legjobb: ${t.best} nap</span>` : ''}</div>`
            : `<div class="challenge-meta"><a href="#szokasok">Adj hozzá ${t.name.toLowerCase()} szokást</a> a kezdéshez.</div>`}
          </div>
          <span class="challenge-step">${t.earnedCount}/${t.steps.length}</span>
        </div>`;
    };

    el.innerHTML = `
      <header class="view-head"><div><span class="eyebrow">Hősöd és eredményeid</span><h1>Profil</h1></div></header>

      ${renderHeroPanel()}
      ${Sync.enabled ? `<div class="card rank-card" id="my-rank">${rankBody()}</div>` : ''}
      <p class="muted small profile-custom-link">A hősöd nevét, nemét és bőrszínét a <a href="#beallitasok">Beállításokban</a> szabhatod testre.</p>

      <h2 class="section-title">⚔️ Kihívások</h2>
      <p class="muted small section-sub">Automatikusan futnak: érd el a sorozatot, és megkapod a badge-et. Egy megszerzett badge-et nem veszíthetsz el.</p>
      <div class="card list-card challenges">
        ${active.map(challengeRow).join('') || '<p class="muted">Adj hozzá szokásokat, és indulnak a kihívások!</p>'}
        ${idle.length ? `<details class="idle-challenges"><summary>Még nem elkezdett kihívások (${idle.length})</summary>${idle.map(challengeRow).join('')}</details>` : ''}
        ${done.length ? `<p class="muted small done-tracks">✓ Teljesen kész: ${done.map(t => t.name).join(', ')}</p>` : ''}
      </div>

      <div class="section-title row-between">
        <h2>🏅 Badge-gyűjtemény</h2>
        <span class="muted small">${earned.size} / ${badges.length} megszerezve</span>
      </div>
      <p class="muted small section-sub">Koppints egy megszerzett badge-re a kiemeléshez (legfeljebb 3). A kiemeltek a hősöd mellett látszanak.</p>
      <div class="badge-grid">
        ${badges.map(b => {
          const isFeat = featured.includes(b.id);
          return b.earned ? `
            <button class="badge-item is-earned ${isFeat ? 'is-featured' : ''}" data-action="feature-badge" data-id="${b.id}" aria-pressed="${isFeat}">
              ${fresh.has(b.id) ? '<span class="badge-new">ÚJ</span>' : ''}
              ${isFeat ? '<span class="badge-pin" aria-hidden="true">★</span>' : ''}
              ${Badges.medal(b, 'lg')}
              <span class="badge-name">${b.name}</span>
              <span class="badge-xp">+${b.xp} XP ✓</span>
              <span class="badge-sub">${fmtDate(b.earnedAt)}</span>
            </button>` : `
            <div class="badge-item" title="${b.desc}">
              ${Badges.medal(b, 'lg', 'is-locked')}
              <span class="badge-name">${b.name}</span>
              <span class="badge-xp">+${b.xp} XP</span>
              <span class="badge-sub">🔒 ${b.desc}</span>
            </div>`;
        }).join('')}
      </div>
    `;

    loadRank();

    // Az itt megmutatott új badge-ek innentől "látottak".
    if (fresh.size) { Badges.markSeen([...fresh]); updateNavDot(); }
  }

  function toggleFeatured(id) {
    const s = Store.state.settings;
    const { earned } = Badges.compute();
    if (!earned.has(id)) return false;
    let list = Badges.featured(earned);
    if (list.includes(id)) {
      list = list.filter(x => x !== id);
      toast('Kiemelés levéve.');
    } else if (list.length >= 3) {
      toast('Legfeljebb 3 badge emelhető ki. Előbb vegyél le egyet.');
      return false;
    } else {
      list.push(id);
      toast(`Kiemelve: ${Badges.BY_ID[id].icon} ${Badges.BY_ID[id].name}`);
    }
    Store.setShared({ featuredBadges: list });
    return true;
  }

  function updateNavDot() {
    const n = Badges.unseen(Badges.compute().earned).length;
    $('.nav a[data-route="profil"]')?.classList.toggle('has-dot', n > 0);
  }

  // ---------- Beállítások ----------

  function renderSettings() {
    const el = $('#view-beallitasok');
    const s = Store.state.settings;
    const notifSupported = 'Notification' in window;
    const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    el.innerHTML = `
      <header class="view-head"><div><span class="eyebrow">Habyt</span><h1>Beállítások</h1></div></header>

      ${renderSyncCard()}

      <div class="card settings">
        <h2>Esti check-in</h2>
        <label class="setting-row">
          <span><strong>Időpont</strong><span class="muted small">Ettől kezdve az app esti check-in módban nyílik meg.</span></span>
          <input type="time" id="s-time" value="${esc(s.reminderTime)}">
        </label>
        <label class="setting-row">
          <span><strong>Értesítés</strong><span class="muted small">${notifSupported ? 'Jelez a check-in idején, ha az app meg van nyitva.' : 'Ez a böngésző nem támogatja az értesítéseket.'}</span></span>
          <input type="checkbox" class="switch" id="s-notify" ${s.notify ? 'checked' : ''} ${notifSupported ? '' : 'disabled'}>
        </label>
        <p class="muted small">PC-n az automatikus megnyitáshoz futtasd egyszer az <code>install-reminder.ps1</code> szkriptet (lásd README).</p>
      </div>

      <div class="card settings">
        <h2>Hős testreszabása</h2>
        <div class="hero-custom">
          <div class="hero-figure" id="skin-preview">${Hero.svg(Hero.compute().stage, 'ready')}</div>
          <div class="hero-custom-fields">
            <label class="setting-row">
              <span><strong>Név</strong><span class="muted small">${Sync.user ? 'Egyedi név: így látnak a ranglétrán is.' : 'Így szólít meg a Ma oldalon.'}</span></span>
              <input type="text" id="s-hero" maxlength="20" placeholder="Hős" value="${esc(s.heroName || '')}">
            </label>
            <div class="setting-row">
              <span><strong>Nem</strong></span>
              <div class="gender-toggle" role="radiogroup" aria-label="A hős neme">
                ${Hero.GENDERS.map(gd => `
                  <button type="button" class="gender-btn" role="radio" data-action="set-gender" data-gender="${gd.id}"
                    aria-checked="${Hero.gender() === gd.id}" aria-label="${gd.name}" title="${gd.name}">${gd.symbol}</button>`).join('')}
              </div>
            </div>
            <div class="setting-row skin-row">
              <span><strong>Bőrszín</strong></span>
              <div class="skin-swatches" role="radiogroup" aria-label="Bőrszín">
                ${Hero.SKINS.map(sk => `
                  <button type="button" class="skin-swatch" role="radio" data-action="set-skin" data-skin="${sk.id}"
                    aria-checked="${Hero.skinId() === sk.id}" aria-label="${sk.name}" title="${sk.name}" style="--skin:${sk.color}"></button>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <p class="muted small">A kiemelt badge-eidet a <a href="#profil">Profil</a> oldalon választhatod ki.</p>
      </div>

      <div class="card settings">
        <h2>Cél</h2>
        <label class="setting-row">
          <span><strong>Fő célod</strong><span class="muted small">Ez alapján kapsz szokásjavaslatokat.</span></span>
          <select id="s-goal">
            <option value="">Nincs megadva</option>
            ${Object.entries(GOALS).map(([id, g]) => `<option value="${id}" ${s.goal === id ? 'selected' : ''}>${g.icon} ${g.label}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="card settings">
        <h2>Telepítés</h2>
        ${isStandalone ? '<p class="muted">Az app telepítve van. ✓</p>' : `
          ${installPrompt ? '<button class="btn btn-primary" data-action="install">Habyt telepítése</button>' : ''}
          <p class="muted small">${isIOS
            ? 'iPhone-on: Safari → Megosztás gomb → „Főképernyőhöz adás”.'
            : 'Chrome / Edge: a címsor jobb oldalán lévő „Telepítés” ikonnal, telefonon a menüben „Alkalmazás telepítése”.'}</p>`}
      </div>

      <div class="card settings">
        <h2>Adatok</h2>
        <p class="muted small">${Sync.user
          ? 'Az adataid ezen az eszközön és a fiókodban is megvannak. Biztonsági mentést fájlba is készíthetsz.'
          : 'Bejelentkezés nélkül az adataid csak ezen az eszközön tárolódnak. Mentéssel fájlban is átviheted őket.'}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" data-action="export">Mentés fájlba</button>
          <button class="btn btn-ghost" data-action="import">Betöltés fájlból</button>
          <button class="btn btn-danger" data-action="reset">Minden adat törlése</button>
        </div>
      </div>
    `;

    $('#s-time').addEventListener('change', e => {
      if (!e.target.value) return;
      Store.setLocal({ lastNotified: null });
      Store.setShared({ reminderTime: e.target.value });
      toast(`Esti check-in: ${e.target.value}`);
    });
    $('#s-hero').addEventListener('change', async e => {
      const input = e.target;
      const name = input.value.trim();
      const prev = Store.state.settings.heroName || '';
      if (!Sync.user) {
        Store.setShared({ heroName: name });
        toast(`A hősöd neve: ${Hero.name()}`);
        return;
      }
      // Bejelentkezve a név egyedi: előbb a szerveren foglaljuk le.
      if (name.length < 2) { input.value = prev; toast('A hősöd neve legalább 2 karakter legyen.'); return; }
      input.disabled = true;
      try {
        await Sync.renameHero(name);
        Store.setShared({ heroName: name });
        toast(`A hősöd neve: ${Hero.name()}`);
      } catch (err) {
        input.value = prev;
        toast(err.code === 'taken' ? `A(z) „${name}” hősnév már foglalt. Válassz másikat!` : 'Nem sikerült menteni a nevet. Van internet?');
      } finally {
        input.disabled = false;
      }
    });
    $('#s-goal').addEventListener('change', e => {
      Store.setShared({ goal: e.target.value || null, onboarded: true });
      toast('Cél mentve.');
    });
    $('#s-notify').addEventListener('change', async e => {
      if (!e.target.checked) { Store.setLocal({ notify: false }); return; }
      const perm = await Notification.requestPermission();
      Store.setLocal({ notify: perm === 'granted' });
      e.target.checked = perm === 'granted';
      toast(perm === 'granted' ? 'Értesítés bekapcsolva.' : 'Az értesítés nincs engedélyezve a böngészőben.');
    });

    const leader = $('#s-leader');
    if (leader) leader.addEventListener('change', e => {
      Store.setShared({ leaderboardHidden: !e.target.checked });
      toast(e.target.checked ? 'A hősöd megjelenik a ranglétrán.' : 'A hősöd rejtve marad a ranglétrán.');
    });
  }

  function bindAuthForm() {
    const form = $('#sync-form');
    if (form) {
      const pass2 = $('#sync-pass2');
      // Regisztrációnál már gépelés közben jelezzük, ha a két jelszó eltér.
      if (pass2) pass2.addEventListener('input', () => {
        $('#sync-error').textContent = pass2.value && pass2.value !== $('#sync-pass').value.slice(0, pass2.value.length) ? 'A két jelszó nem egyezik.' : '';
      });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const mode = form.dataset.mode;
        const email = $('#sync-email').value.trim();
        const err = $('#sync-error');
        const info = $('#sync-info');
        const fail = msg => { err.textContent = msg; };
        err.textContent = '';
        info.textContent = '';
        ui.authEmail = email;
        if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Adj meg egy érvényes email-címet.');

        const password = mode === 'forgot' ? '' : $('#sync-pass').value;
        const name = mode === 'signup' ? $('#sync-name').value.trim() : '';
        if (mode === 'signin' && !password) return fail('Add meg a jelszavad.');
        if (mode === 'signup') {
          if (name.length < 2 || name.length > 20) return fail('A hősöd neve 2–20 karakter legyen.');
          if (password.length < 6) return fail('A jelszó legalább 6 karakter legyen.');
          if (password !== $('#sync-pass2').value) return fail('A két jelszó nem egyezik. Írd be újra mindkettőt.');
        }

        form.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
        try {
          if (mode === 'signin') {
            await Sync.signIn(email, password);
            rememberEmail(email);
            toast('Bejelentkezve, szinkronizálva. ✓');
            maybeStartQuiz();
          } else if (mode === 'forgot') {
            await Sync.requestReset(email);
            info.textContent = `Ha van fiók ezzel a címmel (${email}), küldtünk rá egy levelet. A benne lévő linkkel új jelszót adhatsz meg.`;
          } else {
            if (!(await Sync.nameAvailable(name))) return fail(`A(z) „${name}” hősnév már foglalt. Válassz másikat!`);
            const signedIn = await Sync.signUp(email, password, name);
            Store.setShared({ heroName: name });
            rememberEmail(email);
            if (signedIn) { toast('Fiók létrehozva, szinkronizálva. ✓'); maybeStartQuiz(); }
            else info.textContent = `Küldtünk egy megerősítő emailt ide: ${email}. Kattints a benne lévő linkre, és utána már be is leszel jelentkezve.`;
          }
        } catch (ex) {
          fail(authMessage(ex));
        } finally {
          if (form.isConnected) form.querySelectorAll('button, input').forEach(b => { b.disabled = false; });
        }
      });
    }
  }

  function authMessage(ex) {
    const m = String(ex.message || '').toLowerCase();
    if (!navigator.onLine) return 'Nincs internetkapcsolat.';
    if (ex instanceof TypeError) return 'Nem sikerült elérni a szervert. Próbáld újra kicsit később.';
    if (m.includes('invalid login')) return 'Hibás email vagy jelszó.';
    if (m.includes('not confirmed')) return 'Előbb erősítsd meg az emailedet a kapott levélben lévő linkkel.';
    if (m.includes('already registered') || m.includes('already exists')) return 'Ezzel az emaillel már van fiók. Jelentkezz be.';
    if (m.includes('database error saving new user')) return 'Ez a hősnév közben foglalt lett. Válassz másikat!';
    if (m.includes('different from the old')) return 'Az új jelszó nem lehet ugyanaz, mint a régi.';
    if (m.includes('password')) return 'A jelszó túl gyenge (legalább 6 karakter kell).';
    if (m.includes('email') && m.includes('invalid')) return 'Érvénytelen email-cím.';
    if (m.includes('rate limit') || ex.status === 429) return 'Túl sok próbálkozás, várj egy kicsit.';
    return 'Hiba történt: ' + ex.message;
  }

  function syncStatusText() {
    const t = Sync.lastSync ? new Date(Sync.lastSync).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : null;
    switch (Sync.status) {
      case 'syncing': return { cls: 'busy', text: 'Szinkronizálás…' };
      case 'ok': return { cls: 'ok', text: `Szinkronizálva${t ? ' · ' + t : ''}` };
      case 'offline': return { cls: 'warn', text: 'Nincs internet – amint lesz, szinkronizál.' };
      case 'error': return { cls: 'err', text: 'Hiba: ' + Sync.lastError };
      default: return { cls: '', text: 'Várakozás…' };
    }
  }

  function renderSyncCard() {
    if (!Sync.enabled) {
      return `
        <div class="card settings">
          <h2>Szinkronizálás</h2>
          <p class="muted small">A szinkronizálás még nincs beállítva ezen a verzión.</p>
        </div>`;
    }
    if (Sync.user) {
      const st = syncStatusText();
      return `
        <div class="card settings sync-card">
          <h2>Szinkronizálás</h2>
          <p class="sync-user">Bejelentkezve: <strong>${esc(Sync.user.email)}</strong></p>
          <p class="sync-status ${st.cls}" id="sync-status"><span class="dot"></span><span>${esc(st.text)}</span></p>
          <p class="muted small">A szokásaid, pipáid és a hősöd automatikusan szinkronizálódnak minden eszközön, ahol ezzel a fiókkal bejelentkezel.</p>
          <label class="setting-row">
            <span><strong>Megjelenés a ranglétrán</strong><span class="muted small">Csak a hősöd neve, szintje és rangja látszik, az email-címed nem.</span></span>
            <input type="checkbox" class="switch" id="s-leader" ${Store.state.settings.leaderboardHidden ? '' : 'checked'}>
          </label>
          <div class="btn-row">
            <button class="btn btn-ghost" data-action="sync-now">Szinkronizálás most</button>
            <button class="btn btn-ghost" data-action="sign-out">Kijelentkezés</button>
          </div>
        </div>`;
    }
    return '';
  }

  // ---------- Belépés (regisztráció / bejelentkezés / elfelejtett jelszó) ----------

  // Bejelentkezés nélkül az app nem használható: ilyenkor ez a teljes képernyős belépőoldal látszik.
  const gated = () => Sync.enabled && !Sync.user;

  function lastEmail() {
    try { return localStorage.getItem('habyt:lastEmail') || ''; } catch (e) { return ''; }
  }
  function rememberEmail(email) {
    try { localStorage.setItem('habyt:lastEmail', email); } catch (e) { /* nem menthető */ }
  }

  function renderGate() {
    const gate = $('#auth-gate');
    if (ui.authPending) {
      gate.innerHTML = `
        <div class="gate-inner">
          <div class="gate-brand"><img src="icons/icon.svg" alt="" width="40" height="40"><span>Habyt</span></div>
          <div class="gate-hero">${Hero.svg(0, 'ready')}</div>
          <h1>Bejelentkezés folyamatban…</h1>
        </div>`;
      return;
    }
    const m = ui.authMode;
    const head = {
      signup: ['Kezdd el a kalandot!', 'Hozd létre a hősödet: minden teljesített szokással erősebb lesz. Versenyezz a ranglétrán, és a haladásod a gépen és a telefonon is veled van.'],
      signin: ['Üdv újra, hős!', 'Jelentkezz be, és folytasd, ahol abbahagytad.'],
      forgot: ['Elfelejtett jelszó', 'Add meg a fiókod email-címét, és küldünk egy linket, amivel új jelszót adhatsz meg.'],
    }[m];
    gate.innerHTML = `
      <div class="gate-inner">
        <div class="gate-brand"><img src="icons/icon.svg" alt="" width="40" height="40"><span>Habyt</span></div>
        <div class="gate-hero">${Hero.svg(m === 'signup' ? 2 : 3, 'proud')}</div>
        <h1>${head[0]}</h1>
        <p class="muted gate-sub">${head[1]}</p>
        <div class="card gate-card">${authForm()}</div>
        ${m === 'forgot' ? '' : '<p class="muted small gate-note">🔒 Belépve maradsz ezen az eszközön, nem kell minden megnyitáskor újra bejelentkezned.</p>'}
      </div>`;
    bindAuthForm();
  }

  function authForm() {
    const m = ui.authMode;
    const ownName = (Store.state.settings.heroName || '').trim();
    const email = `<input id="sync-email" type="email" placeholder="Email-cím" autocomplete="email" required aria-label="Email-cím" value="${esc(ui.authEmail)}">`;
    const link = (mode, text) => `<button type="button" class="link-btn" data-action="auth-mode" data-mode="${mode}">${text}</button>`;
    const forms = {
      signin: `
        ${email}
        <input id="sync-pass" type="password" placeholder="Jelszó" autocomplete="current-password" required aria-label="Jelszó">
        <p id="sync-error" class="form-error" role="alert"></p>
        <p id="sync-info" class="sync-info" role="status"></p>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Bejelentkezés</button>${link('forgot', 'Elfelejtettem a jelszavam')}</div>
        <p class="muted small auth-switch">Még nincs fiókod? ${link('signup', 'Regisztrálj')}</p>`,
      signup: `
        <input id="sync-name" type="text" maxlength="20" placeholder="A hősöd neve (egyedi, pl. Villám)" autocomplete="nickname" required aria-label="A hősöd neve" value="${ownName && ownName !== 'Hős' ? esc(ownName) : ''}">
        ${email}
        <input id="sync-pass" type="password" placeholder="Jelszó (legalább 6 karakter)" autocomplete="new-password" required aria-label="Jelszó">
        <input id="sync-pass2" type="password" placeholder="Jelszó még egyszer" autocomplete="new-password" required aria-label="Jelszó még egyszer">
        <p id="sync-error" class="form-error" role="alert"></p>
        <p id="sync-info" class="sync-info" role="status"></p>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Regisztráció</button></div>
        <p class="muted small auth-switch">Van már fiókod? ${link('signin', 'Jelentkezz be')}</p>`,
      forgot: `
        <p class="muted small">Add meg a fiókod email-címét, és küldünk egy linket, amivel új jelszót adhatsz meg.</p>
        ${email}
        <p id="sync-error" class="form-error" role="alert"></p>
        <p id="sync-info" class="sync-info" role="status"></p>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Új jelszó kérése</button></div>
        <p class="muted small auth-switch">${link('signin', '← Vissza a bejelentkezéshez')}</p>`,
    };
    return `<form id="sync-form" class="sync-form" data-mode="${m}" novalidate>${forms[m]}</form>`;
  }

  function updateSyncStatus() {
    const el = $('#sync-status');
    if (!el) { if (ui.route === 'beallitasok' && Sync.user) render(); return; }
    const st = syncStatusText();
    el.className = 'sync-status ' + st.cls;
    el.lastElementChild.textContent = st.text;
  }

  // ---------- Esti értesítés (amíg az app nyitva van) ----------

  function checkReminder() {
    const s = Store.state.settings;
    if (!s.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = D.today();
    if (s.lastNotified === today || minutesNow() < reminderMin()) return;
    const due = Store.dueHabits(today);
    const left = due.filter(h => !Store.isDone(today, h.id)).length;
    if (!left) return;
    Store.setLocal({ lastNotified: today });
    const opts = { body: `Még ${left} szokás vár kipipálásra ma.`, icon: 'icons/icon-192.png', tag: 'habyt-checkin' };
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(r => r.showNotification('Habyt – esti check-in 🌙', opts));
    } else {
      new Notification('Habyt – esti check-in 🌙', opts);
    }
  }

  // ---------- Útvonalak és események ----------

  const renderers = { ma: renderToday, szokasok: renderHabits, statisztika: renderStats, profil: renderProfile, beallitasok: renderSettings };

  function render() {
    const locked = gated();
    $('#auth-gate').hidden = !locked;
    $('#app').hidden = locked;
    if (locked) { renderGate(); return; }
    for (const r of ROUTES) $('#view-' + r).hidden = r !== ui.route;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === ui.route));
    renderers[ui.route]();
    updateNavDot();
  }

  // Újrarajzolás a görgetési pozíció megtartásával.
  function rerenderInPlace() {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function onRoute() {
    const r = location.hash.slice(1);
    ui.route = ROUTES.includes(r) ? r : 'ma';
    render();
    window.scrollTo(0, 0);
  }

  function addFromCatalog(cid) {
    const c = CATALOG_BY_ID[cid];
    if (!c || Store.activeHabits().some(h => h.catalogId === cid)) return;
    const old = Store.state.habits.find(h => h.catalogId === cid && h.archivedKey);
    if (old) Store.restore(old.id);
    else Store.addHabit({ name: c.name, icon: c.icon, category: c.cat, catalogId: c.id });
    toast(`Hozzáadva: ${c.icon} ${c.name}`);
    render();
  }

  const actions = {
    toggle(b) {
      const k = ui.dayKey;
      const due = Store.dueHabits(k);
      const wasPerfect = due.length && due.every(h => Store.isDone(k, h.id));
      const before = snapshot();
      Store.toggle(k, b.dataset.id);
      const isPerfect = due.every(h => Store.isDone(k, h.id));
      render();
      heroFeedback(before, !wasPerfect && isPerfect);
    },
    'day-prev'() { ui.dayKey = D.add(ui.dayKey, -1); render(); },
    'day-next'() { if (ui.dayKey < D.today()) { ui.dayKey = D.add(ui.dayKey, 1); render(); } },
    'day-today'() { ui.dayKey = D.today(); render(); },
    'open-new'() { openHabitDialog(null); },
    edit(b) { openHabitDialog(b.dataset.id); },
    restore(b) { Store.restore(b.dataset.id); toast('Visszaállítva.'); render(); },
    'add-catalog'(b) { addFromCatalog(b.dataset.cid); },
    'set-goal'(b) {
      Store.setShared({ goal: b.dataset.goal, onboarded: true });
      toast(`Cél: ${GOALS[b.dataset.goal].label}`);
      render();
    },
    'set-skin'(b) {
      Store.setShared({ heroSkin: b.dataset.skin });
      rerenderInPlace();
      $('#skin-preview').innerHTML = Hero.svg(Hero.compute().stage, 'proud');
    },
    'set-gender'(b) {
      Store.setShared({ heroGender: b.dataset.gender });
      rerenderInPlace();
      $('#skin-preview').innerHTML = Hero.svg(Hero.compute().stage, 'proud');
    },
    'feature-badge'(b) {
      if (toggleFeatured(b.dataset.id)) rerenderInPlace();
    },
    'board-refresh'() { loadBoard(true); },
    'open-quiz'() { openQuiz(); },
    'auth-mode'(b) {
      const em = $('#sync-email');
      if (em) ui.authEmail = em.value.trim();
      ui.authMode = b.dataset.mode;
      rerenderInPlace();
      const first = $('#sync-form input');
      if (first) first.focus();
    },
    'cat-filter'(b) { ui.catFilter = b.dataset.cat; render(); },
    'cal-habit'(b) { ui.calHabit = b.dataset.id; render(); },
    'cal-prev'() { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = D.key(new Date(y, m - 2, 1)).slice(0, 7); render(); },
    'cal-next'() { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = D.key(new Date(y, m, 1)).slice(0, 7); render(); },
    'cal-toggle'(b) {
      const sc = $('#heatmap-scroll')?.scrollLeft;
      const y = window.scrollY;
      const before = snapshot();
      Store.toggle(b.dataset.key, ui.calHabit);
      render();
      window.scrollTo(0, y);
      if (sc != null) $('#heatmap-scroll').scrollLeft = sc;
      heroFeedback(before, false);
    },
    'heat-day'(b) {
      ui.dayKey = b.dataset.key;
      if (location.hash === '#ma') onRoute(); else location.hash = '#ma';
    },
    install() {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.finally(() => { installPrompt = null; render(); });
    },
    export() {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `habyt-mentes-${D.today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import() { $('#import-file').click(); },
    'sync-now'() { Sync.syncNow(); },
    async 'sign-out'(b) {
      if (!navigator.onLine) { toast('A kijelentkezéshez internet kell, hogy előbb minden elmentődjön a fiókodba.'); return; }
      if (!confirm('Kijelentkezel? Az adataid a fiókodban megmaradnak, de az app használatához újra be kell jelentkezned.')) return;
      b.disabled = true;
      await Sync.signOut();
      ui.authMode = 'signin';
      ui.authEmail = lastEmail();
      ui.dayKey = D.today();
      location.hash = '#ma';
      render();
      toast('Kijelentkezve.');
    },
    reset() {
      const where = Sync.user ? ' Az összes szinkronizált eszközödről is törlődik.' : '';
      if (!confirm('Biztosan törlöd az összes szokást és eredményt? Ez nem vonható vissza.' + where)) return;
      Store.reset();
      ui.dayKey = D.today();
      toast('Minden adat törölve.');
      render();
    },
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const fn = actions[b.dataset.action];
    if (fn) fn(b);
  });

  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('A betöltés felülírja a jelenlegi adatokat. Folytatod?')) return;
      Store.importJSON(text);
      toast('Adatok betöltve.');
      render();
    } catch (err) {
      toast('Ez nem érvényes Habyt mentésfájl.');
    }
  });

  $('#badge-feature').addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    $('#badge-dialog').close();
    if (Badges.featured(Badges.compute().earned).length >= 3) location.hash = '#profil';
    else if (toggleFeatured(id)) render();
  });

  window.addEventListener('hashchange', onRoute);
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    if (ui.route === 'beallitasok') render();
  });

  // Ha éjfél után nyitva marad az app, váltson át az új napra.
  let lastToday = D.today();
  setInterval(() => {
    const t = D.today();
    if (t !== lastToday) {
      if (ui.dayKey === lastToday) ui.dayKey = t;
      lastToday = t;
      render();
    }
    checkReminder();
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && D.today() !== lastToday) {
      ui.dayKey = lastToday = D.today();
      render();
    }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Szinkron: más eszközről érkezett változásnál újrarajzolás.
  Sync.on('data', () => render());
  Sync.on('auth', () => { resetBoard(); render(); });
  // Saját XP vagy beállítás változott: a következő megnyitáskor frissüljön a ranglétra.
  Store.onChange(() => { board.at = 0; myRank.at = 0; });
  Sync.on('status', updateSyncStatus);

  const redirect = Sync.consumeRedirect();
  if (redirect && !redirect.ok) toast('A megerősítés nem sikerült: ' + redirect.message);
  if (redirect && redirect.ok) {
    ui.authPending = true;
    redirect.done
      .finally(() => { ui.authPending = false; render(); })
      .then(() => {
        if (redirect.recovery) { $('#password-dialog').showModal(); $('#pw-new').focus(); }
        else { toast('Email megerősítve, bejelentkezve. ✓'); maybeStartQuiz(); }
      })
      .catch(() => toast('A bejelentkezés nem sikerült, próbáld újra.'));
  }

  // Jelszó-visszaállítás: az emailben kapott link után új jelszó (kétszer megadva).
  $('#pw-cancel').addEventListener('click', () => $('#password-dialog').close());
  $('#password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#pw-new').value;
    const err = $('#pw-error');
    err.textContent = '';
    if (pw.length < 6) { err.textContent = 'A jelszó legalább 6 karakter legyen.'; return; }
    if (pw !== $('#pw-new2').value) { err.textContent = 'A két jelszó nem egyezik. Írd be újra mindkettőt.'; return; }
    $('#pw-save').disabled = true;
    try {
      await Sync.updatePassword(pw);
      $('#password-dialog').close();
      e.target.reset();
      toast('Új jelszó elmentve. ✓');
    } catch (ex) {
      err.textContent = authMessage(ex);
    } finally {
      $('#pw-save').disabled = false;
    }
  });

  if (ui.checkin) location.hash = '#ma';
  onRoute();
  checkReminder();
  Sync.start();
})();
