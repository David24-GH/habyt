// Streakek és összesítések. A mai, még nem kipipált nap sosem nullázza a sorozatot.
const Stats = {
  habitStreak(h) {
    const today = D.today();
    let cur = 0;
    for (let k = today; k >= h.createdKey; k = D.add(k, -1)) {
      if (!Store.isDue(h, k)) continue;
      if (Store.isDone(k, h.id)) cur++;
      else if (k !== today) break;
    }
    return cur;
  },

  habitBest(h) {
    const today = D.today();
    let run = 0;
    let best = 0;
    for (let k = h.createdKey; k <= today; k = D.add(k, 1)) {
      if (!Store.isDue(h, k)) continue;
      if (Store.isDone(k, h.id)) best = Math.max(best, ++run);
      else if (k !== today) run = 0;
    }
    return best;
  },

  // Teljesítési arány az utolsó `days` napban (a mai napot nem számolja, mert az még tart).
  habitRate(h, days = 30) {
    let due = 0;
    let done = 0;
    let k = D.add(D.today(), -1);
    for (let i = 0; i < days; i++, k = D.add(k, -1)) {
      if (!Store.isDue(h, k)) continue;
      due++;
      if (Store.isDone(k, h.id)) done++;
    }
    return due ? done / due : null;
  },

  day(k) {
    const due = Store.dueHabits(k);
    const done = due.filter(h => Store.isDone(k, h.id)).length;
    return { due: due.length, done };
  },

  firstKey() {
    const keys = Store.state.habits.map(h => h.createdKey);
    return keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : D.today();
  },

  // "Tökéletes nap" = minden aznap esedékes szokás kész.
  perfectStreak() {
    const today = D.today();
    const first = this.firstKey();
    let cur = 0;
    for (let k = today; k >= first; k = D.add(k, -1)) {
      const { due, done } = this.day(k);
      if (!due) continue;
      if (done === due) cur++;
      else if (k !== today) break;
    }
    return cur;
  },

  perfectBest() {
    const today = D.today();
    let run = 0;
    let best = 0;
    for (let k = this.firstKey(); k <= today; k = D.add(k, 1)) {
      const { due, done } = this.day(k);
      if (!due) continue;
      if (done === due) best = Math.max(best, ++run);
      else if (k !== today) run = 0;
    }
    return best;
  },

  overallRate(days = 30) {
    let due = 0;
    let done = 0;
    let k = D.add(D.today(), -1);
    for (let i = 0; i < days; i++, k = D.add(k, -1)) {
      const d = this.day(k);
      due += d.due;
      done += d.done;
    }
    return due ? done / due : null;
  },

  totalChecks() {
    return Object.values(Store.state.log).reduce((sum, list) => sum + list.length, 0);
  },

  // Hőtérkép-szint 0–4 (vagy -1, ha aznap nem volt esedékes szokás).
  level(k) {
    const { due, done } = this.day(k);
    if (!due) return -1;
    const r = done / due;
    if (r === 0) return 0;
    if (r <= 0.34) return 1;
    if (r <= 0.67) return 2;
    if (r < 1) return 3;
    return 4;
  },
};
