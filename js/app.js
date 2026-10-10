(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']; // getDay() szerinti index
  const DAY_LONG = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const WEEK = [1, 2, 3, 4, 5, 6, 0]; // hétfővel kezdődő hét
  const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const MONTHS_SHORT = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  const QUICK_ICONS = ['💧', '🏃', '📖', '🧘', '💪', '😴', '🥗', '📝', '🎯', '💰', '🎸', '🌙', '🧹', '💻', '🙏', '⭐'];
  const ROUTES = ['ma', 'szokasok', 'statisztika', 'beallitasok'];

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

  function renderHeroCard() {
    const h = Hero.compute();
    return `
      <div class="card hero-card" id="hero-card">
        <div class="hero-figure">${Hero.svg(h.stage, h.mood)}</div>
        <div class="hero-info">
          <div class="hero-top">
            <strong class="hero-name">${esc(Hero.name())}</strong>
            <span class="hero-rank">${h.stageName}</span>
          </div>
          <div class="hero-level"><span>${h.level}. szint</span><span class="muted small">${h.into} / ${h.need} XP</span></div>
          <div class="xp-bar" role="progressbar" aria-label="Tapasztalat a következő szintig" aria-valuemin="0" aria-valuemax="${h.need}" aria-valuenow="${h.into}"><span style="width:${xpPct(h)}%"></span></div>
          <p class="hero-bubble">${esc(Hero.message(h))}</p>
        </div>
      </div>`;
  }

  function renderHeroPanel() {
    const h = Hero.compute();
    return `
      <div class="card hero-panel">
        <div class="hero-panel-main">
          <div class="hero-figure big">${Hero.svg(h.stage, h.mood)}</div>
          <div class="hero-info">
            <span class="eyebrow">Hősöd</span>
            <h2 class="hero-panel-name">${esc(Hero.name())}</h2>
            <div class="hero-top"><span class="hero-rank">${h.stageName}</span><span class="muted small">${h.level}. szint · ${h.xp} XP összesen</span></div>
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
        <p class="muted small hero-rules">+${Hero.XP_HABIT} XP minden teljesített szokásért · +${Hero.XP_PERFECT} XP tökéletes napért · −${Hero.XP_MISS} XP, ha egy napon semmit nem teljesítesz (az elért rangból nem esel vissza).</p>
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

  // Pipálás utáni visszajelzés: XP, szintlépés, rangfejlődés, tökéletes nap.
  function heroFeedback(before, perfectNow) {
    const after = Hero.compute();
    showXp(after.xp - before.xp);
    if (after.stage > before.stage) {
      showEvolution(after);
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
      <div class="card hero">
        <p>Válassz 1–3 szokást az induláshoz. Minden este ${esc(s.settings.reminderTime)}-kor itt pipálhatod ki, mit teljesítettél, a sorozataidat pedig a Statisztikában követheted.</p>
      </div>
      ${renderGoalCard()}
      <h2 class="section-title">Javasolt kezdésnek</h2>
      ${renderSuggestions(4)}
      <div class="center">
        <a class="btn btn-ghost" href="#szokasok">Teljes katalógus és saját szokás</a>
      </div>
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

      <h2 class="section-title">✨ Javasolt neked</h2>
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
        <div class="empty">Adj hozzá szokásokat, és itt látod majd a naptárat és a sorozataidat.</div>`;
      return;
    }
    const active = Store.activeHabits();
    if (!ui.calHabit || !Store.find(ui.calHabit)) ui.calHabit = (active[0] || habits[0]).id;

    el.innerHTML = `
      <header class="view-head"><div><span class="eyebrow">Visszatekintés</span><h1>Statisztika</h1></div></header>

      ${renderHeroPanel()}

      <div class="tiles">
        <div class="tile tile-hot"><span class="tile-label">Tökéletes napok sorozata</span><span class="tile-value">🔥 ${Stats.perfectStreak()}</span></div>
        <div class="tile"><span class="tile-label">Leghosszabb sorozat</span><span class="tile-value">🏆 ${Stats.perfectBest()}</span></div>
        <div class="tile"><span class="tile-label">Elmúlt 30 nap</span><span class="tile-value">${pct(Stats.overallRate(30))}</span></div>
        <div class="tile"><span class="tile-label">Összes pipa</span><span class="tile-value">${Stats.totalChecks()}</span></div>
      </div>

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

  // ---------- Beállítások ----------

  function renderSettings() {
    const el = $('#view-beallitasok');
    const s = Store.state.settings;
    const notifSupported = 'Notification' in window;
    const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    el.innerHTML = `
      <header class="view-head"><div><span class="eyebrow">Habyt</span><h1>Beállítások</h1></div></header>

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
        <h2>Hősöd</h2>
        <label class="setting-row">
          <span><strong>Név</strong><span class="muted small">Így szólít meg a Ma oldalon.</span></span>
          <input type="text" id="s-hero" maxlength="20" placeholder="Hős" value="${esc(s.heroName || '')}">
        </label>
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
        <p class="muted small">Az adataid csak ezen az eszközön tárolódnak. Mentéssel átviheted őket másik eszközre.</p>
        <div class="btn-row">
          <button class="btn btn-ghost" data-action="export">Mentés fájlba</button>
          <button class="btn btn-ghost" data-action="import">Betöltés fájlból</button>
          <button class="btn btn-danger" data-action="reset">Minden adat törlése</button>
        </div>
      </div>
    `;

    $('#s-time').addEventListener('change', e => {
      if (!e.target.value) return;
      s.reminderTime = e.target.value;
      s.lastNotified = null;
      Store.save();
      toast(`Esti check-in: ${s.reminderTime}`);
    });
    $('#s-hero').addEventListener('change', e => {
      s.heroName = e.target.value.trim();
      Store.save();
      toast(`A hősöd neve: ${Hero.name()}`);
    });
    $('#s-goal').addEventListener('change', e => {
      s.goal = e.target.value || null;
      s.onboarded = true;
      Store.save();
      toast('Cél mentve.');
    });
    $('#s-notify').addEventListener('change', async e => {
      if (!e.target.checked) { s.notify = false; Store.save(); return; }
      const perm = await Notification.requestPermission();
      s.notify = perm === 'granted';
      Store.save();
      e.target.checked = s.notify;
      toast(s.notify ? 'Értesítés bekapcsolva.' : 'Az értesítés nincs engedélyezve a böngészőben.');
    });
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
    s.lastNotified = today;
    Store.save();
    const opts = { body: `Még ${left} szokás vár kipipálásra ma.`, icon: 'icons/icon-192.png', tag: 'habyt-checkin' };
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(r => r.showNotification('Habyt – esti check-in 🌙', opts));
    } else {
      new Notification('Habyt – esti check-in 🌙', opts);
    }
  }

  // ---------- Útvonalak és események ----------

  const renderers = { ma: renderToday, szokasok: renderHabits, statisztika: renderStats, beallitasok: renderSettings };

  function render() {
    for (const r of ROUTES) $('#view-' + r).hidden = r !== ui.route;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === ui.route));
    renderers[ui.route]();
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
      const before = Hero.compute();
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
      Store.state.settings.goal = b.dataset.goal;
      Store.state.settings.onboarded = true;
      Store.save();
      toast(`Cél: ${GOALS[b.dataset.goal].label}`);
      render();
    },
    'cat-filter'(b) { ui.catFilter = b.dataset.cat; render(); },
    'cal-habit'(b) { ui.calHabit = b.dataset.id; render(); },
    'cal-prev'() { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = D.key(new Date(y, m - 2, 1)).slice(0, 7); render(); },
    'cal-next'() { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = D.key(new Date(y, m, 1)).slice(0, 7); render(); },
    'cal-toggle'(b) {
      const sc = $('#heatmap-scroll')?.scrollLeft;
      const y = window.scrollY;
      const before = Hero.compute();
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
    reset() {
      if (!confirm('Biztosan törlöd az összes szokást és eredményt? Ez nem vonható vissza.')) return;
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

  if (ui.checkin) location.hash = '#ma';
  onRoute();
  checkReminder();
})();
