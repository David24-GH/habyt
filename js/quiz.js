// Kezdő kérdőív: pár gyors kérdés alapján személyre szabott kezdő szokásokat ajánl.
// A válaszok a beállításokban maradnak (settings.quiz), így a későbbi ajánlások is figyelembe veszik őket.
const Quiz = (() => {
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  const QUESTIONS = [
    {
      id: 'areas', multi: 3,
      title: 'Miben szeretnél leginkább fejlődni?',
      hint: 'Legfeljebb 3 területet választhatsz.',
      options: [
        { id: 'egeszseg', icon: '🥗', label: 'Egészség, táplálkozás' },
        { id: 'sport', icon: '💪', label: 'Mozgás, erőnlét' },
        { id: 'tanulas', icon: '📚', label: 'Tanulás, tudás' },
        { id: 'mentalis', icon: '🧘', label: 'Lelki nyugalom' },
        { id: 'produktivitas', icon: '⚡', label: 'Hatékonyság, fókusz' },
        { id: 'kapcsolatok', icon: '🤝', label: 'Kapcsolatok' },
      ],
    },
    {
      id: 'goal',
      title: 'Mi most a legfontosabb célod?',
      options: Object.entries(GOALS).map(([id, g]) => ({ id, icon: g.icon, label: g.label })),
    },
    {
      id: 'pains', multi: 3,
      title: 'Milyen szokást szeretnél kialakítani vagy elhagyni?',
      hint: 'Jelöld be, ami igaz rád (legfeljebb 3).',
      options: [
        { id: 'faradt', icon: '😴', label: 'Fáradt vagyok, keveset alszom', habits: ['alvas', 'kepernyo-este', 'korai-keles'] },
        { id: 'ules', icon: '🪑', label: 'Sokat ülök, keveset mozgok', habits: ['seta', 'nyujtas', 'edzes'] },
        { id: 'stressz', icon: '😣', label: 'Sokat stresszelek', habits: ['meditacio', 'legzes', 'naplo'] },
        { id: 'telefon', icon: '📱', label: 'Túl sokat telefonozom', habits: ['social-limit', 'kepernyo-este'] },
        { id: 'halogatas', icon: '⏳', label: 'Halogatok, nehezen fókuszálok', habits: ['napi-terv', 'melymunka'] },
        { id: 'etkezes', icon: '🍔', label: 'Nem eszem elég egészségesen', habits: ['gyumolcs', 'viz', 'cukor'] },
        { id: 'szeretteim', icon: '❤️', label: 'Kevés idő jut a szeretteimre', habits: ['csalad', 'kozos-ido', 'baratok'] },
        { id: 'ujdolog', icon: '🎓', label: 'Szeretnék valami újat megtanulni', habits: ['nyelv', 'olvasas', 'kodolas'] },
        { id: 'rendetlen', icon: '🧺', label: 'Rendetlenség vesz körül', habits: ['rendrakas', 'agyazas'] },
        { id: 'penz', icon: '💸', label: 'Nem tudom, mire megy el a pénzem', habits: ['penz', 'napi-terv'] },
      ],
    },
    {
      id: 'time',
      title: 'Naponta mennyi időt szánnál az új szokásaidra?',
      options: [
        { id: 'rovid', icon: '⏱️', label: '5–10 perc', count: 2 },
        { id: 'kozepes', icon: '🕒', label: '15–30 perc', count: 3 },
        { id: 'hosszu', icon: '🕐', label: '30–60 perc', count: 4 },
        { id: 'sok', icon: '🔥', label: 'Több mint 1 óra', count: 5 },
      ],
    },
    {
      id: 'energy',
      title: 'Mikor vagy a legjobb formában?',
      options: [
        { id: 'reggel', icon: '🌅', label: 'Reggel', why: 'Reggeli formádhoz illik', habits: ['korai-keles', 'reggeli', 'agyazas', 'edzes', 'futas', 'napi-terv'] },
        { id: 'napkozben', icon: '☀️', label: 'Napközben', why: 'Napközben könnyen beilleszthető', habits: ['seta', 'melymunka', 'termeszet', 'bicikli', 'podcast'] },
        { id: 'este', icon: '🌙', label: 'Este', why: 'Esti levezetésnek ideális', habits: ['olvasas', 'naplo', 'halanaplo', 'esti-attekintes', 'joga', 'nyujtas'] },
      ],
    },
    {
      id: 'level',
      title: 'Mennyi tapasztalatod van a szokásépítésben?',
      options: [
        { id: 'kezdo', icon: '🌱', label: 'Most kezdem', desc: 'Kevesebb, könnyebb szokással indulunk.', delta: -1 },
        { id: 'probalt', icon: '🔁', label: 'Próbálkoztam már', delta: 0 },
        { id: 'rutinos', icon: '🏆', label: 'Rutinos vagyok', desc: 'Bírok egy kicsit nagyobb kihívást.', delta: 1 },
      ],
    },
    {
      id: 'days',
      title: 'Milyen gyakran szeretnéd csinálni őket?',
      hint: 'Később szokásonként is átállíthatod.',
      options: [
        { id: 'mindennap', icon: '📅', label: 'Minden nap', days: ALL_DAYS },
        { id: 'hetkoznap', icon: '💼', label: 'Hétköznapokon', days: [1, 2, 3, 4, 5] },
        { id: 'heti3', icon: '3️⃣', label: 'Heti 3 alkalommal (H, Sze, P)', days: [1, 3, 5] },
      ],
    },
  ];

  const Q = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const opt = (qid, id) => Q[qid].options.find(o => o.id === id);

  // Legfeljebb kb. 10 perces szokások: kevés időnél csak ezek jönnek szóba.
  const QUICK = new Set(['viz', 'vitamin', 'gyumolcs', 'cukor', 'alvas', 'kepernyo-este', 'reggeli', 'fekvotamasz', 'plank', 'nyujtas',
    'szavak', 'meditacio', 'naplo', 'halanaplo', 'legzes', 'social-limit', 'agyazas', 'napi-terv', 'esti-attekintes', 'penz',
    'csalad', 'baratok', 'kedvesseg', 'dicseret', 'korai-keles']);
  // Hosszabb, több időt kívánó szokások.
  const LONG = new Set(['edzes', 'futas', 'bicikli', 'melymunka', 'joga', 'kodolas', 'termeszet', 'seta', 'hangszer', 'kozos-ido']);

  // Egy katalógus-elem pontszáma és indoklása a válaszok alapján.
  function score(c, a) {
    let s = 0;
    const reasons = [];
    for (const pid of a.pains || []) {
      const p = opt('pains', pid);
      if (p && p.habits.includes(c.id)) {
        s += 6 - p.habits.indexOf(c.id) * 0.5;
        reasons.push(`Ezt jelölted: ${p.label.toLowerCase()}`);
      }
    }
    if ((a.areas || []).includes(c.cat)) {
      s += 3;
      reasons.push(`Ebben szeretnél fejlődni: ${opt('areas', c.cat).label.toLowerCase()}`);
    }
    if (a.goal && c.goals.includes(a.goal)) {
      s += 2;
      reasons.push(`A célodhoz illik: ${GOALS[a.goal].label.toLowerCase()}`);
    }
    const en = a.energy && opt('energy', a.energy);
    if (en && en.habits.includes(c.id)) {
      s += 1;
      reasons.push(en.why);
    }
    if (STARTERS.includes(c.id)) s += 0.5;
    if (a.time === 'rovid' && !QUICK.has(c.id)) s -= 100;
    if (a.time === 'kozepes' && LONG.has(c.id)) s -= 3;
    if (a.level === 'kezdo') s += QUICK.has(c.id) ? 1 : LONG.has(c.id) ? -1.5 : 0;
    return { score: s, reason: reasons[0] || 'Népszerű kezdő szokás' };
  }

  // Ajánlott kezdő csomag (picks) és további ötletek (extra).
  function recommend(a, taken = new Set()) {
    const ranked = CATALOG
      .filter(c => !taken.has(c.id))
      .map((c, i) => ({ item: c, i, ...score(c, a) }))
      .filter(r => r.score > -50)
      .sort((x, y) => y.score - x.score || x.i - y.i);

    const t = a.time ? opt('time', a.time).count : 3;
    const d = a.level ? opt('level', a.level).delta : 0;
    const count = Math.max(2, Math.min(5, t + d));

    const picks = [];
    const perCat = {};
    const take = r => {
      perCat[r.item.cat] = (perCat[r.item.cat] || 0) + 1;
      picks.push(r);
    };
    // Először minden megjelölt problémára jusson egy szokás (a sorrendjük szerint)…
    for (const pid of a.pains || []) {
      if (picks.length >= count) break;
      const p = opt('pains', pid);
      const best = p && ranked.find(r => !picks.includes(r) && p.habits.includes(r.item.id));
      if (best) take(best);
    }
    // …aztán pontszám szerint, változatosan: egy kategóriából legfeljebb 2.
    for (const r of ranked) {
      if (picks.length >= count) break;
      if (picks.includes(r) || (perCat[r.item.cat] || 0) >= 2) continue;
      take(r);
    }
    picks.sort((x, y) => y.score - x.score);
    const extra = ranked.filter(r => !picks.includes(r)).slice(0, 4);
    return { picks, extra, days: daysFor(a) };
  }

  function daysFor(a) {
    const o = a.days && opt('days', a.days);
    return o ? o.days.slice() : ALL_DAYS.slice();
  }

  // A kitöltött kérdőív hatása a későbbi ajánlásokra (Szokások oldal).
  function bonus(c) {
    const a = Store.state.settings.quiz;
    if (!a) return null;
    const p = (a.pains || []).map(id => opt('pains', id)).find(o => o && o.habits.includes(c.id));
    if (p) return { score: 3, reason: `A kérdőívben jelölted: ${p.label.toLowerCase()}` };
    if ((a.areas || []).includes(c.cat)) return { score: 1, reason: `Ebben szeretnél fejlődni: ${opt('areas', c.cat).label.toLowerCase()}` };
    return null;
  }

  return { QUESTIONS, recommend, bonus };
})();
