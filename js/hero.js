// A hős: a teljesített szokásokból XP-t gyűjt, szintet lép és rangot vált.
// Az XP mindig a naplóból számolódik újra, így az utólagos pótlás is beleszámít.
const Hero = (() => {
  const XP_HABIT = 10;
  const XP_PERFECT = 20;
  const XP_MISS = 15;

  const STAGES = [
    { min: 1, name: 'Újonc', gear: 'Egy bot és nagy álmok.' },
    { min: 3, name: 'Kalandor', gear: 'Fakard, bőrmellény, piros fejpánt.' },
    { min: 6, name: 'Harcos', gear: 'Vaskard, láncing és kerek pajzs.' },
    { min: 10, name: 'Lovag', gear: 'Sisak, vértezet és címeres pajzs.' },
    { min: 15, name: 'Bajnok', gear: 'Fekete páncél, piros köpeny, izzó penge.' },
    { min: 22, name: 'Legenda', gear: 'Korona és lángoló kard.' },
  ];

  // Ennyi összes XP kell az L. szinthez (az 1. szint 0 XP-nél kezdődik).
  const levelStart = L => (L - 1) * 40 + 10 * (L - 1) * (L - 2);

  function levelOf(xp) {
    let L = 1;
    while (levelStart(L + 1) <= xp) L++;
    return L;
  }

  function stageOf(level) {
    let s = 0;
    STAGES.forEach((st, i) => { if (level >= st.min) s = i; });
    return s;
  }

  function name() {
    return (Store.state.settings.heroName || '').trim() || 'Hős';
  }

  function compute() {
    const today = D.today();
    let xp = 0;
    let stage = 0;
    let missRun = 0;
    let todayInfo = { due: 0, done: 0 };

    if (Store.state.habits.length) {
      for (let k = Stats.firstKey(); k <= today; k = D.add(k, 1)) {
        const { due, done } = Stats.day(k);
        if (k === today) todayInfo = { due, done };
        xp += done * XP_HABIT;
        if (due && done === due) xp += XP_PERFECT;
        if (k < today && due && !done) {
          // Kihagyott nap: XP-veszteség, de az elért rang alá nem esik.
          xp = Math.max(levelStart(STAGES[stage].min), xp - XP_MISS);
          missRun++;
        } else if (k < today && due) {
          missRun = 0;
        }
        stage = Math.max(stage, stageOf(levelOf(xp)));
      }
    }

    const level = levelOf(xp);
    const next = STAGES[stage + 1] || null;
    return {
      xp,
      level,
      stage,
      stageName: STAGES[stage].name,
      into: xp - levelStart(level),
      need: levelStart(level + 1) - levelStart(level),
      next,
      toNext: next ? levelStart(next.min) - xp : 0,
      missRun,
      today: todayInfo,
      mood: mood(todayInfo, missRun),
    };
  }

  function mood(t, missRun) {
    if (!Store.state.habits.length) return 'ready';
    if (t.due && t.done === t.due) return 'proud';
    if (t.done > 0) return 'determined';
    if (missRun > 0) return 'sad';
    return 'ready';
  }

  function message(h) {
    const left = h.today.due - h.today.done;
    switch (h.mood) {
      case 'proud': return 'Győzelem! Ma minden küldetést teljesítettünk. 🏆';
      case 'determined': return `Jó úton járunk! Még ${left} küldetés van hátra.`;
      case 'sad': return h.missRun > 1
        ? `${h.missRun} napja nem edzettünk… gyengülök. Ma visszaszerezzük az erőnket?`
        : 'Tegnap kimaradt az edzés… Ma pótoljuk, jó?';
      default: return h.today.due ? 'Készen állok a mai küldetésekre! ⚔️' : 'Ma pihenőnap. Gyűjtsünk erőt holnapra!';
    }
  }

  // ---------- Rajz (SVG) ----------

  let uid = 0;

  const SKINS = [
    { id: 'vilagos', name: 'Világos', color: '#f7dcc6' },
    { id: 'bezs', name: 'Bézs', color: '#f2c9a0' },
    { id: 'barack', name: 'Barackos', color: '#e2aa7e' },
    { id: 'oliva', name: 'Olíva', color: '#c68b5c' },
    { id: 'barna', name: 'Barna', color: '#9a6440' },
    { id: 'sotet', name: 'Sötétbarna', color: '#6b4428' },
  ];
  const DEFAULT_SKIN = 'bezs';

  function skinId() {
    const id = Store.state.settings.heroSkin;
    return SKINS.some(sk => sk.id === id) ? id : DEFAULT_SKIN;
  }

  const skinColor = () => SKINS.find(sk => sk.id === skinId()).color;
  const HAIR = '#2a1a14';
  const BODY = ['#8a6f55', '#6b4423', '#8b8f99', '#b9bec8', '#2a2a30', '#1c1c22'];
  const TRIM = [null, null, null, '#e11d2e', '#e11d2e', '#f5b941'];

  const GENDERS = [
    { id: 'm', symbol: '♂', name: 'Férfi' },
    { id: 'f', symbol: '♀', name: 'Nő' },
  ];
  const gender = () => (Store.state.settings.heroGender === 'f' ? 'f' : 'm');

  // Szempilla a női változathoz (a szem külső sarkán).
  const LASHES = {
    proud: '<path d="M48.5 47.5l-2.2-1.2M71.5 47.5l2.2-1.2" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>',
    sad: '<path d="M49.5 48l-2.4-.6M70.5 48l2.4-.6" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>',
    determined: '<path d="M49.4 47.6l-2.4-1M70.6 47.6l2.4-1" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>',
    ready: '<path d="M49.4 46.6l-2.4-1.4M70.6 46.6l2.4-1.4" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>',
  };

  function face(m, g) {
    const eyes = {
      proud: '<path d="M49 48q3-4 6 0M65 48q3-4 6 0" stroke="#1a1a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
      sad: '<path d="M48 43l7 2M72 43l-7 2" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/><circle cx="52" cy="49" r="2.4" fill="#1a1a1a"/><circle cx="68" cy="49" r="2.4" fill="#1a1a1a"/>',
      determined: '<path d="M48 43l7 2.5M72 43l-7 2.5" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/><circle cx="52" cy="48.5" r="2.6" fill="#1a1a1a"/><circle cx="68" cy="48.5" r="2.6" fill="#1a1a1a"/>',
      ready: '<circle cx="52" cy="48" r="2.7" fill="#1a1a1a"/><circle cx="68" cy="48" r="2.7" fill="#1a1a1a"/><circle cx="53" cy="47" r=".9" fill="#fff"/><circle cx="69" cy="47" r=".9" fill="#fff"/>',
    }[m];
    const mouth = {
      proud: '<path d="M53 55q7 8 14 0z" fill="#7f1d1d"/>',
      sad: '<path d="M54 59q6-5 12 0" stroke="#7f1d1d" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      determined: '<path d="M55 57h10" stroke="#7f1d1d" stroke-width="2.2" stroke-linecap="round"/>',
      ready: '<path d="M54 56q6 5 12 0" stroke="#7f1d1d" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    }[m];
    return `${eyes}${g === 'f' ? LASHES[m] : ''}${mouth}<circle cx="46" cy="54" r="3.2" fill="#e11d2e" opacity=".22"/><circle cx="74" cy="54" r="3.2" fill="#e11d2e" opacity=".22"/>`;
  }

  function weapon(s, id) {
    switch (s) {
      case 0: return '<path d="M35 114L27 66" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round"/>';
      case 1: return '<path d="M33 98V68l2-4 2 4v30z" fill="#c08a52"/><rect x="28" y="96" width="14" height="4" rx="2" fill="#6b4423"/>';
      case 2: return '<path d="M33 97V60l2.5-5 2.5 5v37z" fill="#cfd4dc"/><path d="M35.5 58v38" stroke="#fff" stroke-width=".8" opacity=".6"/><rect x="27" y="95" width="17" height="4" rx="2" fill="#6b6f78"/>';
      case 3: return '<path d="M32.5 97V50l3-6 3 6v47z" fill="#e2e6ec"/><path d="M35.5 48v48" stroke="#fff" stroke-width=".9" opacity=".7"/><rect x="25" y="95" width="21" height="4.5" rx="2" fill="#f5b941"/>';
      case 4: return `<path d="M32.5 97V46l3-7 3 7v51z" fill="#ff4d5e" filter="url(#glow${id})"/><path d="M35.5 44v52" stroke="#ffd1d6" stroke-width="1"/><rect x="25" y="95" width="21" height="4.5" rx="2" fill="#2a2a30" stroke="#e11d2e"/>`;
      default: return `<path d="M35.5 30c-5 6-1 9-5 14 3-1 4 1 2 5v48h6V49c-2-4-1-6 2-5-4-5 0-8-5-14z" fill="url(#flame${id})" filter="url(#glow${id})"/><rect x="25" y="95" width="21" height="4.5" rx="2" fill="#f5b941"/><circle cx="35.5" cy="97" r="2.6" fill="#e11d2e"/>`;
    }
  }

  function shield(s) {
    if (s < 2) return '';
    if (s === 2) return '<circle cx="86" cy="92" r="14" fill="#8a5a2b" stroke="#5a3a1b" stroke-width="3"/><circle cx="86" cy="92" r="4" fill="#b9bec8"/>';
    const fill = s === 3 ? '#d6dae2' : '#1c1c22';
    const rim = s === 5 ? '#f5b941' : s === 4 ? '#e11d2e' : '#8b8f99';
    const emblem = s === 3
      ? '<path d="M86 80v26M76 90h20" stroke="#e11d2e" stroke-width="4"/>'
      : s === 4
        ? '<path d="M86 82l6 9-6 13-6-13z" fill="#e11d2e"/>'
        : '<path d="M86 104c-7-3-8-10-4-15 0 3 2 4 3 3-1-4 1-8 5-10-1 4 4 6 3 11 2-1 2-3 2-4 3 6-2 13-9 15z" fill="#e11d2e"/>';
    return `<path d="M72 80h28v12c0 9-6 15-14 19-8-4-14-10-14-19z" fill="${fill}" stroke="${rim}" stroke-width="3" stroke-linejoin="round"/>${emblem}`;
  }

  // Hosszú haj a fej mögött (női változat); a sisakos rangoknál is kilátszik oldalt.
  const BACK_HAIR = `<path d="M38 40c-6 16-6 32-1 41 4 2 9 2 12-1l1-19h20l1 19c3 3 8 3 12 1 5-9 5-25-1-41z" fill="${HAIR}"/>`;

  function headgear(s, g) {
    const hair = g === 'f'
      ? `<path d="M37 47c-2-17 8-26 23-26s25 9 23 26c-3-6-8-10-14-12-5 5-14 9-24 10z" fill="${HAIR}"/><path d="M37 44c-2 8-1 14 2 19l3-1c-2-5-2-11-1-16zM83 44c2 8 1 14-2 19l-3-1c2-5 2-11 1-16z" fill="${HAIR}"/>`
      : `<path d="M37 47c-2-17 8-26 23-26s25 9 23 26l-5-9-5 6-4-9-5 7-5-8-5 7-4-8-5 9z" fill="${HAIR}"/>`;
    if (s === 0) return hair;
    if (s <= 2) return hair + '<rect x="38" y="35" width="44" height="5" rx="2.5" fill="#e11d2e"/><path d="M80 37l9 4-8 2z" fill="#e11d2e"/>';
    if (s === 3) return '<path d="M60 8c4 4 9 6 9 14-3-2-6-3-9-3z" fill="#e11d2e"/><path d="M36 50c0-18 10-29 24-29s24 11 24 29h-7V40H43v10z" fill="#c9ced6"/><rect x="58" y="38" width="4" height="13" rx="1.5" fill="#9aa0aa"/>';
    if (s === 4) return '<path d="M44 26c-6-6-8-14-6-20 3 6 7 9 12 11zM76 26c6-6 8-14 6-20-3 6-7 9-12 11z" fill="#2a2a30"/><path d="M36 50c0-18 10-29 24-29s24 11 24 29h-7V40H43v10z" fill="#2a2a30" stroke="#e11d2e" stroke-width="2"/><rect x="58" y="38" width="4" height="13" rx="1.5" fill="#e11d2e"/>';
    return hair + '<path d="M42 30l-2-14 9 7 6-11 5 10 5-10 6 11 9-7-2 14z" fill="#f5b941" stroke="#c98a1a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="60" cy="24" r="2.6" fill="#e11d2e"/>';
  }

  function svg(stage, m = 'ready', cls = '') {
    const id = ++uid;
    const s = Math.max(0, Math.min(5, stage));
    const body = BODY[s];
    const trim = TRIM[s];
    const skin = skinColor();
    const g = gender();
    const sparkles = m === 'proud'
      ? '<g class="hero-sparkle" fill="#ffd166"><path d="M14 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M104 28l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/><path d="M106 70l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/></g>'
      : '';
    return `
<svg class="hero-svg mood-${m} stage-${s} ${cls}" viewBox="0 0 120 140" role="img" aria-label="${STAGES[s].name}">
  <defs>
    <radialGradient id="aura${id}"><stop offset="0" stop-color="#e11d2e" stop-opacity=".55"/><stop offset="1" stop-color="#e11d2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="flame${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset=".45" stop-color="#ff7a3d"/><stop offset="1" stop-color="#e11d2e"/></linearGradient>
    <filter id="glow${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  ${s >= 4 ? `<circle cx="60" cy="74" r="${s === 5 ? 60 : 50}" fill="url(#aura${id})" class="hero-aura"/>` : ''}
  <ellipse cx="60" cy="131" rx="30" ry="5" fill="#000" opacity=".45"/>
  <g class="hero-body">
    ${s >= 4 ? `<path d="M41 66q19-8 38 0l13 60q-32 9-64 0z" fill="#b3182a"/>` : ''}
    ${g === 'f' ? BACK_HAIR : ''}
    <rect x="47" y="104" width="10" height="23" rx="4" fill="${s >= 3 ? '#9aa0aa' : '#3a2a20'}"/>
    <rect x="63" y="104" width="10" height="23" rx="4" fill="${s >= 3 ? '#9aa0aa' : '#3a2a20'}"/>
    ${s >= 1 ? `<rect x="45" y="119" width="14" height="9" rx="3" fill="${s >= 4 ? '#1c1c22' : '#4a2e1a'}"/><rect x="61" y="119" width="14" height="9" rx="3" fill="${s >= 4 ? '#1c1c22' : '#4a2e1a'}"/>` : ''}
    <path d="M42 70q18-9 36 0l4 38q-22 7-44 0z" fill="${body}"/>
    ${s === 0 ? '<rect x="64" y="86" width="8" height="7" rx="1" fill="#6e5641" transform="rotate(-8 68 89)"/>' : ''}
    ${s === 2 ? '<path d="M45 80h30M44 88h32M43 96h34" stroke="#6f737c" stroke-width="1.4" stroke-dasharray="2 2"/>' : ''}
    ${trim ? `<rect x="54" y="70" width="12" height="38" fill="${trim}" opacity="${s === 5 ? 1 : .95}"/>` : ''}
    ${s === 5 ? '<path d="M60 78l3 5-3 5-3-5z" fill="#1c1c22"/>' : ''}
    <rect x="40" y="96" width="40" height="6" rx="2" fill="#2a1a10"/>
    ${s >= 2 ? `<rect x="56" y="95" width="8" height="8" rx="1.5" fill="${s === 5 ? '#f5b941' : '#c9ced6'}"/>` : ''}
    <rect x="30" y="72" width="11" height="27" rx="5.5" fill="${s >= 3 ? body : skin}"/>
    <rect x="79" y="72" width="11" height="27" rx="5.5" fill="${s >= 3 ? body : skin}"/>
    ${s >= 4 ? `<path d="M29 75a9 8 0 0 1 18-4z" fill="${body}" stroke="${trim}" stroke-width="2" stroke-linejoin="round"/><path d="M91 75a9 8 0 0 0-18-4z" fill="${body}" stroke="${trim}" stroke-width="2" stroke-linejoin="round"/>` : ''}
    ${weapon(s, id)}
    <circle cx="35.5" cy="100" r="5.5" fill="${skin}"/>
    <circle cx="84.5" cy="100" r="5.5" fill="${skin}"/>
    ${shield(s)}
    <circle cx="37" cy="49" r="4" fill="${skin}"/><circle cx="83" cy="49" r="4" fill="${skin}"/>
    <circle cx="60" cy="47" r="22" fill="${skin}"/>
    ${face(m, g)}
    ${headgear(s, g)}
  </g>
  ${sparkles}
</svg>`;
  }

  return { STAGES, SKINS, GENDERS, gender, XP_HABIT, XP_PERFECT, XP_MISS, compute, levelStart, message, name, skinId, svg };
})();
