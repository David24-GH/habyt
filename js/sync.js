// Szinkron a Supabase-szel (bejelentkezés + egy sor felhasználónként a habyt_state táblában).
// Külső könyvtár nélkül, a Supabase REST felületén keresztül.
const Sync = (() => {
  const cfg = window.HABYT_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey);
  const base = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const SESSION_KEY = 'habyt:session';

  let session = loadSession();
  let status = session ? 'idle' : 'loggedout'; // idle | syncing | ok | offline | error | loggedout
  let lastSync = null;
  let lastError = '';
  let running = false;
  let again = false;
  let timer = null;
  let refreshing = null;
  const handlers = { status: new Set(), data: new Set(), auth: new Set() };
  const emit = (type, ...args) => handlers[type].forEach(fn => fn(...args));

  class ApiError extends Error {
    constructor(status, body) {
      super((body && (body.msg || body.message || body.error_description || body.error)) || 'HTTP ' + status);
      this.status = status;
      this.code = body && (body.code || body.error_code);
    }
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  }

  function setSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* nem menthető */ }
  }

  function fromToken(body) {
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      user: { id: body.user.id, email: body.user.email },
    };
  }

  function setStatus(s, err = '') {
    status = s;
    lastError = err;
    emit('status');
  }

  async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    const h = { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', ...headers };
    if (auth) {
      await ensureFresh();
      h.Authorization = 'Bearer ' + session.access_token;
    }
    const res = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  async function ensureFresh(force = false) {
    if (!session) throw new ApiError(401, { message: 'Nincs bejelentkezve' });
    if (!force && session.expires_at * 1000 - 60000 > Date.now()) return;
    if (!refreshing) {
      refreshing = request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: session.refresh_token },
      })
        .then(body => setSession(fromToken(body)))
        .catch(err => {
          // Lejárt vagy visszavont munkamenet: újra be kell jelentkezni.
          if (err.status === 400 || err.status === 401) { setSession(null); setStatus('loggedout'); emit('auth'); }
          throw err;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  // Adatkérés; ha lejárt a token, egyszer frissít és újrapróbálja.
  async function data(path, opts) {
    try {
      return await request(path, opts);
    } catch (err) {
      if (err.status !== 401) throw err;
      await ensureFresh(true);
      return request(path, opts);
    }
  }

  const table = () => `/rest/v1/habyt_state`;
  const mine = () => `?user_id=eq.${encodeURIComponent(session.user.id)}`;

  // Nyilvános összesítő a ranglétrához: a hős neve, kinézete, szintje, rangja és XP-je (email nincs benne).
  let published = '';
  async function publishProfile() {
    if (typeof Hero === 'undefined') return;
    const h = Hero.compute();
    const row = {
      user_id: session.user.id,
      hero_name: Hero.name().slice(0, 20),
      level: h.level,
      xp: Math.round(h.xp),
      stage: h.stageName,
      gender: Hero.gender(),
      skin: Hero.skinId(),
      visible: !Store.state.settings.leaderboardHidden,
    };
    const sig = JSON.stringify(row);
    if (sig === published) return;
    await data('/rest/v1/habyt_profiles?on_conflict=user_id', {
      method: 'POST',
      body: { ...row, updated_at: new Date().toISOString() },
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    published = sig;
  }

  // A legjobb 100 látható hős XP szerint (egyenlőségnél az előbb odaérő áll elöl).
  async function leaderboard() {
    await publishProfile();
    return data('/rest/v1/habyt_profiles?select=user_id,hero_name,level,xp,stage,gender,skin&visible=is.true&order=xp.desc,updated_at.asc&limit=100');
  }

  // Saját helyezés (a 100. utáni is); null, ha még nincs sor a szerveren.
  async function myRank() {
    await publishProfile();
    const rows = await data('/rest/v1/rpc/habyt_my_rank', { method: 'POST', body: {} });
    return (rows && rows[0]) || null;
  }

  async function syncNow() {
    if (!enabled || !session) return;
    if (running) { again = true; return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    running = true;
    setStatus('syncing');
    let changed = false;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const rows = await data(table() + mine() + '&select=data,rev');
        const remote = rows[0] || null;
        if (remote && Store.mergeRemote(remote.data)) changed = true;
        if (remote && Store.matches(remote.data)) break; // nincs mit feltölteni
        const snap = Store.shareable();

        if (!remote) {
          try {
            await data(table(), { method: 'POST', body: { user_id: session.user.id, data: snap, rev: 1 }, headers: { Prefer: 'return=minimal' } });
            break;
          } catch (err) {
            if (err.status === 409) continue; // közben a másik eszköz létrehozta: újra
            throw err;
          }
        }
        // Csak akkor írunk, ha azóta senki más nem írt (rev egyezik).
        const updated = await data(table() + mine() + `&rev=eq.${remote.rev}`, {
          method: 'PATCH',
          body: { data: snap, rev: remote.rev + 1, updated_at: new Date().toISOString() },
          headers: { Prefer: 'return=representation' },
        });
        if (updated && updated.length) break;
      }
      await publishProfile();
      lastSync = Date.now();
      setStatus('ok');
    } catch (err) {
      if (!session) return;
      if (!navigator.onLine) setStatus('offline');
      else setStatus('error', err instanceof TypeError ? 'a szerver most nem érhető el, később újrapróbálja.' : err.message);
    } finally {
      running = false;
      if (changed) emit('data');
      if (again) { again = false; schedule(300); }
    }
  }

  function schedule(ms = 1500) {
    if (!enabled || !session) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, ms);
  }

  async function signIn(email, password) {
    const body = await request('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
    setSession(fromToken(body));
    emit('auth');
    await syncNow();
  }

  // Igaz, ha rögtön be is jelentkezett; hamis, ha előbb meg kell erősíteni az emailt.
  async function signUp(email, password) {
    const redirect = location.origin + location.pathname;
    const body = await request('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), {
      method: 'POST', auth: false, body: { email, password },
    });
    if (body && body.access_token) {
      setSession(fromToken(body));
      emit('auth');
      await syncNow();
      return true;
    }
    return false;
  }

  async function signOut() {
    try { await request('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* offline is kijelentkezhet */ }
    setSession(null);
    lastSync = null;
    published = '';
    setStatus('loggedout');
    emit('auth');
  }

  // Az email-megerősítő link után a Supabase a token-adatokkal irányít vissza (#access_token=...).
  // Igaz, ha volt ilyen visszairányítás (sikeres vagy hibás); az eredményt üzenetben adja vissza.
  function consumeRedirect() {
    if (!enabled) return null;
    const h = location.hash.slice(1);
    if (!/(^|&)(access_token|error_description)=/.test(h)) return null;
    const p = new URLSearchParams(h);
    history.replaceState(null, '', location.pathname + location.search + '#beallitasok');
    if (p.get('error_description')) return { ok: false, message: p.get('error_description') };
    const token = {
      access_token: p.get('access_token'),
      refresh_token: p.get('refresh_token'),
      expires_at: Number(p.get('expires_at')) || 0,
      expires_in: Number(p.get('expires_in')) || 3600,
    };
    // A felhasználó adatait a tokennel kérjük le.
    return {
      ok: true,
      done: fetch(base + '/auth/v1/user', { headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + token.access_token } })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then(user => {
          setSession(fromToken({ ...token, user }));
          emit('auth');
          return syncNow();
        }),
    };
  }

  function start() {
    if (!enabled) return;
    Store.onChange(() => schedule());
    window.addEventListener('online', () => schedule(200));
    window.addEventListener('offline', () => { if (session) setStatus('offline'); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') schedule(200);
    });
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
    if (session) syncNow();
  }

  return {
    enabled,
    start,
    syncNow,
    signIn,
    signUp,
    signOut,
    consumeRedirect,
    leaderboard,
    myRank,
    get user() { return session ? session.user : null; },
    get status() { return status; },
    get lastSync() { return lastSync; },
    get lastError() { return lastError; },
    on(type, fn) { handlers[type].add(fn); },
  };
})();
