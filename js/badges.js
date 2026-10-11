// Kihívások és badge-ek. Automatikusan futnak: a naplóból számolódnak, így az utólagos pótlás is számít.
// Egy badge akkor jár, ha a sorozat valaha elérte a célt (egy későbbi megszakadás nem veszi el).
const Badges = (() => {
  const TIERS = {
    bronz: 'Bronz',
    ezust: 'Ezüst',
    arany: 'Arany',
    legenda: 'Legendás',
  };

  // Kategóriánként 3 fokozat: 7 / 30 / 100 napos sorozat egy ilyen kategóriájú szokással.
  const CATEGORY_BADGES = {
    egeszseg: [['Jó szokás', '🥗'], ['Életerő', '❤️'], ['Vitalitás mestere', '🌿']],
    sport: [['Bemelegítés', '👟'], ['Vasakarat', '💪'], ['Olimpikon', '🏅']],
    tanulas: [['Tanonc', '📖'], ['Tudós', '🎓'], ['Bölcs bagoly', '🦉']],
    mentalis: [['Nyugalom', '🌙'], ['Belső béke', '🧘'], ['Zen mester', '☯️']],
    produktivitas: [['Szorgos', '⚡'], ['Gépezet', '⚙️'], ['Időúr', '⏳']],
    kapcsolatok: [['Jó barát', '🤝'], ['Szívélyes', '💝'], ['Közösség hőse', '🌟']],
  };
  const CAT_TARGETS = [7, 30, 100];
  const CAT_TIERS = ['bronz', 'ezust', 'arany'];
  // XP-jutalom a nehézség szerint. A tökéletes napos sorozat nehezebb (minden szokás kell), ezért többet ér.
  const CAT_XP = [50, 200, 750];

  const TRACKS = [
    {
      id: 'start', kind: 'checks', name: 'Kezdet',
      steps: [{ id: 'elso-lepes', target: 1, name: 'Első lépés', icon: '🌱', tier: 'bronz', xp: 10, desc: 'Pipáld ki az első szokásodat.' }],
    },
    {
      id: 'perfect', kind: 'perfect', name: 'Tökéletes napok',
      steps: [
        { id: 'perfect-3', target: 3, name: 'Hármas találat', icon: '🎯', tier: 'bronz', xp: 30 },
        { id: 'perfect-7', target: 7, name: 'Tökéletes hét', icon: '🔥', tier: 'ezust', xp: 100 },
        { id: 'perfect-30', target: 30, name: 'Hibátlan hónap', icon: '💎', tier: 'arany', xp: 400 },
        { id: 'perfect-100', target: 100, name: 'Legendás sorozat', icon: '👑', tier: 'legenda', xp: 1500 },
      ].map(s => ({ ...s, desc: `${s.target} tökéletes nap egymás után (minden szokás kész).` })),
    },
    ...Object.entries(CATEGORY_BADGES).map(([cat, names]) => ({
      id: 'cat-' + cat, kind: 'category', cat, name: CATEGORIES[cat].label,
      steps: names.map(([name, icon], i) => ({
        id: `${cat}-${CAT_TARGETS[i]}`,
        target: CAT_TARGETS[i],
        name,
        icon,
        tier: CAT_TIERS[i],
        xp: CAT_XP[i],
        desc: `${CAT_TARGETS[i]} napos sorozat egy ${CATEGORIES[cat].label.toLowerCase()} kategóriájú szokással.`,
      })),
    })),
  ];

  const ALL = TRACKS.flatMap(t => t.steps.map(s => ({ ...s, track: t.id })));
  const BY_ID = Object.fromEntries(ALL.map(b => [b.id, b]));

  // Végigmegy a napokon, és feljegyzi, mikor érte el először a sorozat az egyes célokat.
  function scan(from, isDue, isDone, targets) {
    const today = D.today();
    const reached = {};
    let run = 0;
    let best = 0;
    for (let k = from; k <= today; k = D.add(k, 1)) {
      if (!isDue(k)) continue;
      if (isDone(k)) {
        run++;
        best = Math.max(best, run);
        for (const t of targets) if (run >= t && !reached[t]) reached[t] = k;
      } else if (k !== today) {
        run = 0;
      }
    }
    return { best, reached };
  }

  function earlier(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a < b ? a : b;
  }

  function trackProgress(t) {
    const habits = Store.state.habits;
    const targets = t.steps.map(s => s.target);

    if (t.kind === 'checks') {
      let total = 0;
      const reached = {};
      for (const k of Object.keys(Store.state.log).sort()) {
        total += Store.state.log[k].length;
        for (const n of targets) if (total >= n && !reached[n]) reached[n] = k;
      }
      return { current: total, best: total, reached, hasHabits: habits.length > 0 };
    }

    if (t.kind === 'perfect') {
      if (!habits.length) return { current: 0, best: 0, reached: {}, hasHabits: false };
      const r = scan(Stats.firstKey(), k => Stats.day(k).due > 0, k => { const d = Stats.day(k); return d.done === d.due; }, targets);
      return { current: Stats.perfectStreak(), best: r.best, reached: r.reached, hasHabits: true };
    }

    // Kategória: a kategória legjobb szokása számít.
    const inCat = habits.filter(h => h.category === t.cat);
    const out = { current: 0, best: 0, reached: {}, hasHabits: inCat.some(h => !h.archivedKey) };
    for (const h of inCat) {
      const r = scan(h.createdKey, k => Store.isDue(h, k), k => Store.isDone(k, h.id), targets);
      out.best = Math.max(out.best, r.best);
      for (const n of targets) out.reached[n] = earlier(out.reached[n], r.reached[n]);
      if (!h.archivedKey) out.current = Math.max(out.current, Stats.habitStreak(h));
    }
    return out;
  }

  // A badge-ek nehézségi sorrendben (könnyűtől a nehézig): az XP-jutalom tükrözi a nehézséget.
  function compute() {
    const badges = [];
    const tracks = [];
    for (const t of TRACKS) {
      const p = trackProgress(t);
      const items = t.steps.map(s => ({ ...s, track: t.id, earned: !!p.reached[s.target], earnedAt: p.reached[s.target] || null }));
      badges.push(...items);
      tracks.push({ ...t, ...p, next: items.find(b => !b.earned) || null, earnedCount: items.filter(b => b.earned).length });
    }
    badges.sort((a, b) => a.xp - b.xp);
    const earned = new Set(badges.filter(b => b.earned).map(b => b.id));
    return { badges, tracks, earned };
  }

  // Badge-ekért kapott XP napra bontva (a megszerzés napján jár), a hős XP-jéhez.
  function xpByDay() {
    const out = {};
    for (const b of compute().badges) if (b.earned) out[b.earnedAt] = (out[b.earnedAt] || 0) + b.xp;
    return out;
  }

  // Kiemelt badge-ek (legfeljebb 3), csak a ténylegesen megszerzettek.
  function featured(earned) {
    const list = Store.state.settings.featuredBadges || [];
    return list.filter(id => BY_ID[id] && earned.has(id)).slice(0, 3);
  }

  function unseen(earned) {
    const seen = new Set(Store.state.settings.badgesSeen || []);
    return [...earned].filter(id => !seen.has(id));
  }

  function markSeen(ids) {
    const s = Store.state.settings;
    const seen = new Set(s.badgesSeen || []);
    ids.forEach(id => seen.add(id));
    s.badgesSeen = [...seen];
    Store.save();
  }

  // Érem-ábra: a fokozat színes kerete, középen az ikon.
  function medal(b, size = 'md', extra = '') {
    return `<span class="medal tier-${b.tier} size-${size} ${extra}" title="${b.name}"><span class="medal-icon">${b.icon}</span></span>`;
  }

  return { TIERS, TRACKS, ALL, BY_ID, compute, xpByDay, featured, unseen, markSeen, medal };
})();
