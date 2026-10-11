// Szabályalapú ajánló: a meglévő szokások "párjai", a választott cél és a még üres kategóriák alapján.
const Suggest = {
  top(n = 6) {
    const s = Store.state;
    const active = Store.activeHabits();
    const takenIds = new Set(active.map(h => h.catalogId).filter(Boolean));
    const takenNames = new Set(active.map(h => h.name.toLowerCase()));
    const cats = new Set(active.map(h => h.category));
    const goal = s.settings.goal;

    const scored = CATALOG
      .filter(c => !takenIds.has(c.id) && !takenNames.has(c.name.toLowerCase()))
      .map((c, i) => {
        let score = 0;
        let reason = '';

        // Erős kapcsolat: egy meglévő szokásod "párja"; gyengébb: ennek a szokásnak a párja a tiéd.
        const ofHabit = h => h.catalogId && CATALOG_BY_ID[h.catalogId];
        const strong = active.find(h => ofHabit(h) && ofHabit(h).pairs.includes(c.id));
        const weak = !strong && active.find(h => ofHabit(h) && c.pairs.includes(h.catalogId));
        const pairedWith = strong || weak;
        if (pairedWith) {
          score += strong ? 5 : 2;
          reason = `Jól illik ehhez: ${pairedWith.icon} ${pairedWith.name}`;
        }
        if (goal && c.goals.includes(goal)) {
          score += 3;
          reason = reason || `A célodhoz illik: ${GOALS[goal].label}`;
        }
        // A kezdő kérdőív válaszai (ha kitöltötte).
        const qb = typeof Quiz !== 'undefined' ? Quiz.bonus(c) : null;
        if (qb) {
          score += qb.score;
          reason = reason || qb.reason;
        }
        if (active.length >= 3 && !cats.has(c.cat)) {
          score += 1;
          reason = reason || `Új terület: ${CATEGORIES[c.cat].label}`;
        }
        if (STARTERS.includes(c.id)) {
          score += active.length < 3 ? 2 : 0.5;
          reason = reason || 'Népszerű kezdő szokás';
        }
        return { item: c, score, reason: reason || 'Érdemes kipróbálni', i };
      });

    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return scored.slice(0, n);
  },
};
