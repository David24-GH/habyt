// Dátumkezelés "YYYY-MM-DD" kulcsokkal (helyi idő szerint). A kulcsok szövegként is jól összehasonlíthatók.
const D = {
  key(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  parse(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  add(k, n) {
    const d = D.parse(k);
    d.setDate(d.getDate() + n);
    return D.key(d);
  },
  today() {
    return D.key(new Date());
  },
  // 0 = vasárnap ... 6 = szombat (mint a Date.getDay)
  dow(k) {
    return D.parse(k).getDay();
  },
};

// Az app teljes állapota localStorage-ban.
const Store = (() => {
  const KEY = 'habyt:v1';
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  const fresh = () => ({
    version: 1,
    habits: [],
    log: {},
    settings: { reminderTime: '20:00', goal: null, onboarded: false, notify: false, lastNotified: null },
  });

  function normalize(p) {
    const f = fresh();
    if (!p || typeof p !== 'object') return f;
    return {
      ...f,
      ...p,
      settings: { ...f.settings, ...(p.settings || {}) },
      habits: Array.isArray(p.habits) ? p.habits : [],
      log: p.log && typeof p.log === 'object' ? p.log : {},
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* üres vagy tiltott tároló */ }
    return fresh();
  }

  let state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* nem menthető */ }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const find = id => state.habits.find(h => h.id === id);

  return {
    get state() { return state; },
    save,
    find,

    addHabit({ name, icon, category, days, catalogId }) {
      const habit = {
        id: uid(),
        name: name.trim(),
        icon: icon || '⭐',
        category: category || 'egyeb',
        days: days && days.length ? [...days].sort() : ALL_DAYS.slice(),
        catalogId: catalogId || null,
        createdKey: D.today(),
        archivedKey: null,
      };
      state.habits.push(habit);
      save();
      return habit;
    },

    updateHabit(id, patch) {
      const h = find(id);
      if (!h) return;
      Object.assign(h, patch);
      save();
    },

    // Archiválás: a mai naptól már nem esedékes, de a múltja megmarad a statisztikában.
    archive(id) { this.updateHabit(id, { archivedKey: D.today() }); },
    restore(id) { this.updateHabit(id, { archivedKey: null }); },

    remove(id) {
      state.habits = state.habits.filter(h => h.id !== id);
      for (const k of Object.keys(state.log)) {
        state.log[k] = state.log[k].filter(x => x !== id);
        if (!state.log[k].length) delete state.log[k];
      }
      save();
    },

    isDone(k, id) {
      return (state.log[k] || []).includes(id);
    },

    isDue(h, k) {
      return k >= h.createdKey && (!h.archivedKey || k < h.archivedKey) && h.days.includes(D.dow(k));
    },

    // Ütemezés szerint kipipálható-e az adott nap (a létrehozás előtti napok is, utólagos pótláshoz).
    canLog(h, k) {
      return k <= D.today() && (!h.archivedKey || k < h.archivedKey) && h.days.includes(D.dow(k));
    },

    dueHabits(k) {
      return state.habits.filter(h => this.isDue(h, k));
    },

    activeHabits() {
      return state.habits.filter(h => !h.archivedKey);
    },

    toggle(k, id) {
      const h = find(id);
      if (!h) return false;
      const list = state.log[k] || [];
      const done = list.includes(id);
      if (done) {
        const next = list.filter(x => x !== id);
        if (next.length) state.log[k] = next; else delete state.log[k];
      } else {
        state.log[k] = [...list, id];
        // Utólagos pótlásnál a szokás "kezdete" visszacsúszik erre a napra.
        if (k < h.createdKey) h.createdKey = k;
      }
      save();
      return !done;
    },

    exportJSON() {
      return JSON.stringify(state, null, 2);
    },

    importJSON(text) {
      const p = JSON.parse(text);
      if (!p || !Array.isArray(p.habits) || typeof p.log !== 'object') throw new Error('invalid');
      state = normalize(p);
      save();
    },

    reset() {
      state = fresh();
      save();
    },
  };
})();
