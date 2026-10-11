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
// A szinkronhoz minden változás időbélyeget kap (habit.updatedAt, stamps, deleted, settingsAt kulcsonként),
// így két eszköz adatai összefésülhetők: ugyanannál az elemnél a későbbi módosítás nyer.
const Store = (() => {
  const KEY = 'habyt:v1';
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  // Ezek a beállítások eszközönként mások lehetnek, nem szinkronizálódnak.
  const LOCAL_SETTINGS = ['notify', 'lastNotified'];

  const fresh = () => ({
    version: 2,
    habits: [],
    log: {},
    stamps: {},   // "YYYY-MM-DD|habitId" -> utolsó pipálás/kivétel ideje (ms)
    deleted: {},  // törölt szokás id -> törlés ideje (ms)
    settings: { reminderTime: '20:00', goal: null, onboarded: false, notify: false, lastNotified: null },
    settingsAt: {}, // beállítás neve -> utolsó módosítás ideje (ms)
  });

  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);

  function normalize(p) {
    const f = fresh();
    if (!isObj(p)) return f;
    return {
      ...f,
      ...p,
      version: 2,
      settings: { ...f.settings, ...(isObj(p.settings) ? p.settings : {}) },
      habits: Array.isArray(p.habits) ? p.habits : [],
      log: isObj(p.log) ? p.log : {},
      stamps: isObj(p.stamps) ? p.stamps : {},
      deleted: isObj(p.deleted) ? p.deleted : {},
      settingsAt: isObj(p.settingsAt) ? p.settingsAt : {},
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
  const listeners = new Set();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* nem menthető */ }
  }

  // Felhasználói változás: mentés + értesítés (pl. a szinkronnak).
  function save() {
    persist();
    listeners.forEach(fn => fn());
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const find = id => state.habits.find(h => h.id === id);

  // A szerverre kerülő rész (eszközfüggő beállítások nélkül).
  function shareable(s = state) {
    const settings = { ...s.settings };
    LOCAL_SETTINGS.forEach(k => delete settings[k]);
    return { version: 2, habits: s.habits, log: s.log, stamps: s.stamps, deleted: s.deleted, settings, settingsAt: s.settingsAt };
  }

  // Sorrendfüggetlen szöveges alak összehasonlításhoz (a szerver átrendezheti a kulcsokat).
  function canonical(x) {
    const norm = v => {
      if (Array.isArray(v)) return v.map(norm);
      if (isObj(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = norm(v[k]); return o; }, {});
      return v;
    };
    const s = norm(x);
    if (Array.isArray(s.habits)) s.habits = [...s.habits].sort((a, b) => (a.id < b.id ? -1 : 1));
    if (isObj(s.log)) for (const k of Object.keys(s.log)) s.log[k] = [...s.log[k]].sort();
    return JSON.stringify(s);
  }

  function presence(s) {
    const set = new Set();
    for (const [k, list] of Object.entries(s.log)) for (const id of list) set.add(k + '|' + id);
    return set;
  }

  // Két állapot összefésülése. Az eszközfüggő beállítások a helyiből jönnek.
  function merge(local, remoteRaw) {
    const remote = normalize(remoteRaw);

    const deleted = { ...remote.deleted };
    for (const [id, t] of Object.entries(local.deleted)) deleted[id] = Math.max(deleted[id] || 0, t);

    const byId = new Map();
    for (const h of [...remote.habits, ...local.habits]) {
      const cur = byId.get(h.id);
      if (!cur || (h.updatedAt || 0) >= (cur.updatedAt || 0)) byId.set(h.id, h);
    }
    const order = [...local.habits.map(h => h.id), ...remote.habits.map(h => h.id).filter(id => !local.habits.some(h => h.id === id))];
    const habits = order
      .map(id => byId.get(id))
      .filter(h => !(deleted[h.id] && deleted[h.id] >= (h.updatedAt || 0)));
    const alive = new Set(habits.map(h => h.id));

    const lp = presence(local);
    const rp = presence(remote);
    const keys = new Set([...Object.keys(local.stamps), ...Object.keys(remote.stamps), ...lp, ...rp]);
    const stamps = {};
    const log = {};
    for (const key of [...keys].sort()) {
      const [k, id] = key.split('|');
      if (!alive.has(id)) continue;
      const ls = local.stamps[key] || 0;
      const rs = remote.stamps[key] || 0;
      const present = ls > rs ? lp.has(key) : rs > ls ? rp.has(key) : lp.has(key) || rp.has(key);
      if (ls || rs) stamps[key] = Math.max(ls, rs);
      if (present) (log[k] = log[k] || []).push(id);
    }

    // Beállításonként a később módosított érték nyer.
    // (Törlés után a hiányzó kulcs is "érték": nem hozza vissza a régebbi.)
    const settings = { ...local.settings };
    const settingsAt = { ...local.settingsAt };
    for (const k of new Set([...Object.keys(remote.settings), ...Object.keys(remote.settingsAt)])) {
      if (LOCAL_SETTINGS.includes(k)) continue;
      const rt = remote.settingsAt[k] || 0;
      const lt = local.settingsAt[k] || 0;
      if (!(rt > lt || (!lt && !(k in local.settings)))) continue;
      if (k in remote.settings) settings[k] = remote.settings[k]; else delete settings[k];
      if (rt) settingsAt[k] = rt;
    }
    LOCAL_SETTINGS.forEach(k => { settings[k] = local.settings[k]; });

    return { ...local, version: 2, habits, log, stamps, deleted, settings, settingsAt };
  }

  return {
    get state() { return state; },
    save,
    find,
    onChange(fn) { listeners.add(fn); },

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
        updatedAt: Date.now(),
      };
      state.habits.push(habit);
      save();
      return habit;
    },

    updateHabit(id, patch) {
      const h = find(id);
      if (!h) return;
      Object.assign(h, patch, { updatedAt: Date.now() });
      save();
    },

    // Archiválás: a mai naptól már nem esedékes, de a múltja megmarad a statisztikában.
    archive(id) { this.updateHabit(id, { archivedKey: D.today() }); },
    restore(id) { this.updateHabit(id, { archivedKey: null }); },

    remove(id) {
      state.habits = state.habits.filter(h => h.id !== id);
      state.deleted[id] = Date.now();
      for (const k of Object.keys(state.log)) {
        state.log[k] = state.log[k].filter(x => x !== id);
        if (!state.log[k].length) delete state.log[k];
      }
      for (const key of Object.keys(state.stamps)) if (key.endsWith('|' + id)) delete state.stamps[key];
      save();
    },

    // Közös (szinkronizált) beállítások módosítása.
    setShared(patch) {
      const now = Date.now();
      Object.assign(state.settings, patch);
      Object.keys(patch).forEach(k => { state.settingsAt[k] = now; });
      save();
    },

    // Csak ezen az eszközön érvényes beállítások.
    setLocal(patch) {
      Object.assign(state.settings, patch);
      persist();
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
      const now = Date.now();
      const list = state.log[k] || [];
      const done = list.includes(id);
      if (done) {
        const next = list.filter(x => x !== id);
        if (next.length) state.log[k] = next; else delete state.log[k];
      } else {
        state.log[k] = [...list, id];
        // Utólagos pótlásnál a szokás "kezdete" visszacsúszik erre a napra.
        if (k < h.createdKey) { h.createdKey = k; h.updatedAt = now; }
      }
      state.stamps[k + '|' + id] = now;
      save();
      return !done;
    },

    exportJSON() {
      return JSON.stringify(state, null, 2);
    },

    // Betöltés fájlból: minden betöltött elem "most módosult", így szinkronnál ez nyer.
    importJSON(text) {
      const p = JSON.parse(text);
      if (!p || !Array.isArray(p.habits) || !isObj(p.log)) throw new Error('invalid');
      const now = Date.now();
      const next = normalize(p);
      next.habits.forEach(h => { h.updatedAt = now; });
      for (const [k, list] of Object.entries(next.log)) for (const id of list) next.stamps[k + '|' + id] = now;
      next.settingsAt = Object.fromEntries(Object.keys(next.settings).map(k => [k, now]));
      LOCAL_SETTINGS.forEach(k => { next.settings[k] = state.settings[k]; });
      state = next;
      save();
    },

    // Minden törlése: a szokások törlésként szinkronizálódnak a többi eszközre is.
    reset() {
      const now = Date.now();
      const next = fresh();
      next.deleted = { ...state.deleted };
      state.habits.forEach(h => { next.deleted[h.id] = now; });
      next.settingsAt = Object.fromEntries(Object.keys({ ...state.settings, ...next.settings }).map(k => [k, now]));
      LOCAL_SETTINGS.forEach(k => { next.settings[k] = state.settings[k]; });
      state = next;
      save();
    },

    // Kijelentkezéskor: az eszközről eltűnnek a fiók adatai (a szerveren megmaradnak), nem szinkronizálódik törlésként.
    wipe() {
      state = fresh();
      persist();
    },

    // --- Szinkron ---
    shareable,
    canonical,
    merge,

    // Igaz, ha a helyi (közös) adat pontosan megegyezik a szerveren lévővel.
    matches(remote) {
      return !!remote && canonical(shareable()) === canonical(shareable(normalize(remote)));
    },

    // A szerverről jött adat összefésülése a helyivel. Igaz, ha a helyi adat megváltozott.
    mergeRemote(remote) {
      if (!remote) return false;
      const before = canonical(shareable());
      state = merge(state, remote);
      persist();
      return canonical(shareable()) !== before;
    },
  };
})();
