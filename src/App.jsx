import { Component, createRef } from 'react';
import { ic } from './Icon.jsx';
import {
  THEMES, Q, FACTS, DATES, HISTORY, TRAPS, INIT_ERR, LET, MODE_T, TABS, PAL, EXAM_SECONDS,
  qById, thById, shuffle, fmt,
} from './data.js';
import { loadSaved, save } from './storage.js';
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall } from './install.js';

const DEFAULT_SETTINGS = {
  theme: 'system', prep: 'Carte de résident', goal: 10, auto: true, reminder: true, time: '19:00', streak: true,
  text: 'Normale', instant: true, shuffle: true, sound: false, vibration: true, examLength: 40,
};
const IDENTITY = [0, 1, 2, 3];
const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const BRAND_ICON = import.meta.env.BASE_URL + 'brand-icon.svg';

export default class App extends Component {
  constructor(p) {
    super(p);
    this.scrollRef = createRef();
    this.contentRef = createRef();
    this.cardRef = createRef();
    this.rootY = {};
    this.pendingY = null;
    this.sig = '';
    this.dragY = null;
    const saved = loadSaved();
    this.state = {
      tab: 'home', stacks: { home: [], revise: [], test: [], progress: [], profile: [] }, dir: 'tab', quiz: null,
      sheet: null, closing: false, drag: 0, dragging: false, toast: null, loading: null,
      favs: saved?.favs ?? [], errors: saved?.errors ?? INIT_ERR.slice(), last: null, skeleton: false, flip: false, fc: 0,
      reset: saved?.reset ?? false, systemDark: darkQuery ? darkQuery.matches : false, installable: canInstall(),
      settings: { ...DEFAULT_SETTINGS, ...(saved?.settings || {}) },
    };
    this.applyChrome();
  }

  componentDidMount() {
    this.sig = this.sigOf();
    this.onScheme = (e) => this.setState({ systemDark: e.matches });
    darkQuery?.addEventListener?.('change', this.onScheme);
    this.offInstall = onInstallChange(() => this.setState({ installable: canInstall() }));
    // Android / browser back button drives the in-app navigation stack.
    history.replaceState({ tc: 'root' }, '');
    history.pushState({ tc: 'guard' }, '');
    this.onPop = () => {
      const s = this.state;
      if (s.sheet || s.stacks[s.tab].length) {
        this.back();
        history.pushState({ tc: 'guard' }, '');
      } else if (s.tab !== 'home') {
        this.switchTab('home');
        history.pushState({ tc: 'guard' }, '');
      } else {
        history.back();
      }
    };
    window.addEventListener('popstate', this.onPop);
    this.onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); this.back(); } };
    window.addEventListener('keydown', this.onKey);
    this.applyChrome();
  }

  componentWillUnmount() {
    clearInterval(this.timer); clearTimeout(this.tt); clearTimeout(this.sk); clearTimeout(this.cs);
    darkQuery?.removeEventListener?.('change', this.onScheme);
    this.offInstall?.();
    window.removeEventListener('popstate', this.onPop);
    window.removeEventListener('keydown', this.onKey);
  }

  componentDidUpdate(_, ps) {
    const s = this.state;
    if (ps.settings !== s.settings || ps.errors !== s.errors || ps.favs !== s.favs || ps.reset !== s.reset) {
      save({ settings: s.settings, errors: s.errors, favs: s.favs, reset: s.reset });
    }
    if (ps.settings.theme !== s.settings.theme || ps.systemDark !== s.systemDark) this.applyChrome();
    if (this.pendingY != null && this.scrollRef.current) { this.scrollRef.current.scrollTop = this.pendingY; this.pendingY = null; }
    const sig = this.sigOf();
    if (sig !== this.sig) {
      const el = this.contentRef.current;
      if (el && el.animate) {
        const d = s.dir;
        const from = d === 'push' ? 'translateX(28px)' : d === 'pop' ? 'translateX(-24px)' : 'translateY(6px)';
        el.animate([{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: d === 'tab' ? 180 : 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      this.sig = sig;
    }
  }

  isDark() {
    const t = this.state.settings.theme;
    return t === 'system' ? this.state.systemDark : t === 'dark';
  }

  // Page background, browser chrome color and native form controls follow the app theme.
  applyChrome() {
    const P = this.isDark() ? PAL.dark : PAL.light;
    const root = document.documentElement;
    Object.keys(P).forEach((k) => root.style.setProperty('--' + k, P[k]));
    root.style.colorScheme = this.isDark() ? 'dark' : 'light';
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', P.bg));
  }

  sigOf() { const c = this.cur(); return this.state.tab + '/' + c.s + '/' + (c.id || ''); }
  cur() { const st = this.state.stacks[this.state.tab]; return st.length ? st[st.length - 1] : { s: this.state.tab }; }
  y() { const el = this.scrollRef.current; return el ? el.scrollTop : 0; }

  push(entry) {
    const { tab, stacks } = this.state; const st = stacks[tab].slice(); const y = this.y();
    if (st.length) st[st.length - 1] = { ...st[st.length - 1], y }; else this.rootY[tab] = y;
    st.push(entry); this.pendingY = 0;
    const extra = entry.s === 'flash' ? { fc: 0, flip: false } : {};
    this.setState({ stacks: { ...stacks, [tab]: st }, dir: 'push', ...extra });
  }
  setTop(patch) { const { tab, stacks } = this.state; const st = stacks[tab].slice(); if (!st.length) return; st[st.length - 1] = { ...st[st.length - 1], ...patch }; this.setState({ stacks: { ...stacks, [tab]: st } }); }
  replaceTop(entry) { const { tab, stacks } = this.state; const st = stacks[tab].slice(); st[st.length - 1] = entry; this.pendingY = 0; this.setState({ stacks: { ...stacks, [tab]: st }, dir: 'push' }); }
  back() {
    if (this.state.sheet) return this.closeSheet();
    const c = this.cur(); if (c.s === 'quiz') return this.openSheet('quit');
    const { tab, stacks } = this.state; const st = stacks[tab].slice(); if (!st.length) return;
    st.pop(); const top = st[st.length - 1]; this.pendingY = top ? (top.y || 0) : (this.rootY[tab] || 0);
    this.setState({ stacks: { ...stacks, [tab]: st }, dir: 'pop' });
  }
  switchTab(id) {
    const s = this.state; if (s.sheet) this.closeSheet();
    if (id === s.tab) {
      if (s.stacks[id].length) { this.pendingY = 0; this.setState({ stacks: { ...s.stacks, [id]: [] }, dir: 'pop' }); }
      else if (this.scrollRef.current) this.scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const st = s.stacks[s.tab].slice(); const y = this.y();
    if (st.length) st[st.length - 1] = { ...st[st.length - 1], y }; else this.rootY[s.tab] = y;
    const tgt = s.stacks[id]; const top = tgt[tgt.length - 1]; this.pendingY = top ? (top.y || 0) : (this.rootY[id] || 0);
    this.setState({ tab: id, stacks: { ...s.stacks, [s.tab]: st }, dir: 'tab' });
  }
  goHome() { const { tab, stacks } = this.state; const st = stacks[tab].slice(); st.pop(); this.pendingY = this.rootY.home = 0; this.setState({ stacks: { ...stacks, [tab]: st, home: [] }, tab: 'home', dir: 'tab' }); }
  pushTheme(id) { this.push({ s: 'theme', id }); this.setState({ skeleton: true }); clearTimeout(this.sk); this.sk = setTimeout(() => this.setState({ skeleton: false }), 480); }

  buildQuiz(mode, arg) {
    const st = this.state.settings;
    let pool = Q, n = 10;
    if (mode === 'theme') { pool = Q.filter((q) => q.t === arg); n = pool.length; }
    if (mode === 'hard') { pool = Q.filter((q) => TRAPS.includes(q.id)); n = pool.length; }
    if (mode === 'weak' || mode === 'smart') { pool = Q.filter((q) => ['hist', 'soc', 'inst'].includes(q.t)); n = mode === 'smart' ? 6 : pool.length; }
    if (mode === 'errors') { pool = Q.filter((q) => this.state.errors.some((e) => e.id === q.id)); n = pool.length; }
    if (mode === 'quick') n = arg;
    if (mode === 'exam') n = st.examLength;
    let qs = []; while (qs.length < n) qs = qs.concat(shuffle(pool)); qs = qs.slice(0, n).map((q) => q.id);
    const orders = {};
    if (st.shuffle) qs.forEach((id) => { if (!orders[id]) orders[id] = shuffle(IDENTITY); });
    const exam = mode === 'exam';
    return {
      mode, title: mode === 'theme' ? 'Quiz · ' + thById(arg).short : MODE_T[mode], qs, orders, idx: 0, sel: null, validated: false, answers: [],
      timed: exam, endsAt: exam ? Date.now() + EXAM_SECONDS * 1000 : 0, timeLeft: exam ? EXAM_SECONDS : 0, instant: !exam && st.instant,
    };
  }
  startQuiz(mode, arg, load) {
    if (this.state.loading) return;
    if (this.state.sheet) this.closeSheet();
    const go = () => {
      const q = this.buildQuiz(mode, arg);
      this.setState({ loading: null, quiz: q }); this.push({ s: 'quiz' });
      clearInterval(this.timer); if (q.timed) this.timer = setInterval(() => this.tick(), 1000);
    };
    if (load) { this.setState({ loading: load }); setTimeout(go, 550); } else go();
  }
  // Time is derived from a deadline so the countdown stays correct when the app is backgrounded.
  tick() {
    const q = this.state.quiz; if (!q || !q.timed) return clearInterval(this.timer);
    const left = Math.max(0, Math.ceil((q.endsAt - Date.now()) / 1000));
    if (left <= 0) return this.finish({ ...q, timeLeft: 0 });
    if (left !== q.timeLeft) this.setState({ quiz: { ...q, timeLeft: left } });
  }
  select(i) { const q = this.state.quiz; if (!q || q.validated) return; this.setState({ quiz: { ...q, sel: i } }); }
  primaryQuiz() {
    const q = this.state.quiz; if (!q) return; if (q.validated) return this.nextQ(); if (q.sel == null) return;
    const id = q.qs[q.idx]; const ok = qById(id).c === q.sel; const answers = q.answers.concat([{ id, chosen: q.sel, ok }]);
    this.feedback(ok, q.instant);
    if (q.instant) this.setState({ quiz: { ...q, answers, validated: true } });
    else { const nq = { ...q, answers }; if (q.idx + 1 >= q.qs.length) this.finish(nq); else this.setState({ quiz: { ...nq, idx: q.idx + 1, sel: null } }); }
  }
  feedback(ok, instant) {
    const st = this.state.settings;
    if (!instant) return;
    if (st.vibration && navigator.vibrate) navigator.vibrate(ok ? 18 : [30, 60, 30]);
    if (st.sound) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.audio = this.audio || new Ctx();
        const o = this.audio.createOscillator(), g = this.audio.createGain();
        o.frequency.value = ok ? 880 : 220; g.gain.value = 0.06;
        o.connect(g); g.connect(this.audio.destination); o.start(); o.stop(this.audio.currentTime + 0.12);
      } catch { /* audio unavailable */ }
    }
  }
  nextQ() { const q = this.state.quiz; if (q.idx + 1 >= q.qs.length) return this.finish(q); this.setState({ quiz: { ...q, idx: q.idx + 1, sel: null, validated: false } }); }
  finish(q) {
    clearInterval(this.timer);
    const score = q.answers.filter((a) => a.ok).length, total = q.qs.length; const seen = {};
    const wrong = q.answers.filter((a) => !a.ok && !seen[a.id] && (seen[a.id] = 1));
    let errs = this.state.errors.slice();
    if (q.mode === 'errors') errs = errs.filter((e) => !q.answers.some((a) => a.id === e.id && a.ok));
    wrong.forEach((w) => { if (!errs.some((e) => e.id === w.id)) errs.push({ id: w.id, chosen: w.chosen }); });
    this.setState({ quiz: null, errors: errs, last: { mode: q.mode, title: q.title, score, total, wrong, used: q.timed ? EXAM_SECONDS - q.timeLeft : null } });
    this.replaceTop({ s: 'result' });
  }
  quitQuiz() {
    clearInterval(this.timer); this.closeSheet();
    const { tab, stacks } = this.state; const st = stacks[tab].slice(); st.pop(); const top = st[st.length - 1];
    this.pendingY = top ? (top.y || 0) : (this.rootY[tab] || 0);
    this.setState({ quiz: null, stacks: { ...stacks, [tab]: st }, dir: 'pop' });
  }
  openSheet(t) { this.setState({ sheet: t, closing: false, drag: 0 }); }
  closeSheet() { if (!this.state.sheet) return; this.setState({ closing: true }); clearTimeout(this.cs); this.cs = setTimeout(() => this.setState({ sheet: null, closing: false, drag: 0 }), 210); }
  setS(k, v, msg) { this.setState((s) => ({ settings: { ...s.settings, [k]: v } })); this.toast(msg || 'Paramètre enregistré'); }
  toast(m) { clearTimeout(this.tt); this.setState({ toast: { m } }); this.tt = setTimeout(() => this.setState({ toast: null }), 1900); }
  toggleFav(id) { const f = this.state.favs; const has = f.includes(id); this.setState({ favs: has ? f.filter((x) => x !== id) : f.concat([id]) }); this.toast(has ? 'Retiré des favoris' : 'Ajouté aux favoris'); }
  async install() {
    if (isIOS()) return this.openSheet('installIOS');
    const outcome = await promptInstall();
    if (outcome === 'accepted') this.toast('Application installée');
    this.setState({ installable: canInstall() });
  }

  sheetData() {
    const s = this.state, st = s.settings, pctOf = (t) => (s.reset ? 0 : t.p);
    const opt = (label, sub, sel, fn, icon) => ({ label, sub, onClick: fn, icon, check: sel ? ic('check', 20, 2) : null, color: sel ? 'var(--primaryText)' : 'var(--text)', weight: sel ? 600 : 500, bg: sel ? 'var(--tint)' : 'transparent' });
    const pick = (k, list) => list.map((o) => opt(o[1], o[2], st[k] === o[0], () => { this.setS(k, o[0]); this.closeSheet(); }));
    switch (s.sheet) {
      case 'count': return { title: 'Quiz rapide', sub: 'Combien de questions ?', options: [[5, 3], [10, 6], [20, 12], [40, 24]].map(([n, m]) => opt(n + ' questions', '≈ ' + m + ' min', false, () => this.startQuiz('quick', n))) };
      case 'theme': return { title: 'Quiz par thème', sub: 'Choisis un thème', options: THEMES.map((t) => opt(t.name, pctOf(t) + ' % maîtrisé', false, () => this.startQuiz('theme', t.id), ic(t.icon))) };
      case 'quit': return { title: 'Quitter le test ?', sub: 'Votre progression actuelle sera perdue.', confirm: { ok: 'Quitter', cancel: 'Annuler', onOk: () => this.quitQuiz() } };
      case 'reset': return { title: 'Réinitialiser ma progression ?', sub: 'Tes statistiques, erreurs et favoris seront effacés. Cette action est définitive.', confirm: { ok: 'Réinitialiser', cancel: 'Annuler', onOk: () => { this.setState({ reset: true, errors: [], favs: [] }); this.closeSheet(); this.toast('Progression réinitialisée'); } } };
      case 'appearance': return { title: 'Apparence', options: pick('theme', [['system', 'Système', 'Suit le réglage du téléphone'], ['light', 'Clair'], ['dark', 'Sombre']]) };
      case 'text': return { title: 'Taille du texte', sub: 'S’applique aux questions et réponses.', options: pick('text', [['Petite', 'Petite'], ['Normale', 'Normale'], ['Grande', 'Grande']]) };
      case 'goal': return { title: 'Objectif quotidien', options: pick('goal', [[5, '5 questions', '≈ 3 min par jour'], [10, '10 questions', '≈ 6 min par jour'], [20, '20 questions', '≈ 12 min par jour'], [30, '30 questions', '≈ 18 min par jour']]) };
      case 'prep': return { title: 'Type de préparation', sub: 'Le contenu s’adapte à ton objectif.', options: pick('prep', [['Carte de séjour pluriannuelle', 'Carte de séjour pluriannuelle'], ['Carte de résident', 'Carte de résident'], ['Naturalisation', 'Naturalisation']]) };
      case 'time': return { title: 'Heure du rappel', options: pick('time', [['08:00', '08:00', 'Le matin'], ['12:30', '12:30', 'À midi'], ['19:00', '19:00', 'En soirée'], ['21:00', '21:00', 'Avant de dormir']]) };
      case 'examLength': return { title: 'Longueur de l’examen blanc', sub: 'L’examen officiel compte 40 questions.', options: pick('examLength', [[40, '40 questions', 'Conditions réelles'], [20, '20 questions', 'Entraînement court'], [10, '10 questions', 'Démo']]) };
      case 'installIOS': return { title: 'Installer l’application', sub: 'Dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ». L’app s’ouvrira en plein écran et fonctionnera hors connexion.' };
    }
    return null;
  }

  vals() {
    const s = this.state, st = s.settings, c = this.cur(), R = s.reset;
    const pct = (t) => (R ? 0 : t.p), chev = ic('chevR', 20), ex = st.examLength;
    const weak = THEMES.slice().sort((a, b) => a.p - b.p).slice(0, 3);
    const withSep = (rows) => rows.map((r, i) => ({ ...r, sep: i < rows.length - 1 ? '1px solid var(--divider)' : 'none' }));
    const G = (header, rows, action) => ({ header, rows: withSep(rows), action });
    const row = (o) => { const r = { color: 'var(--text)', iconBg: 'var(--tint)', iconColor: 'var(--primary)', op: 1, cursor: o.onClick ? 'pointer' : 'default', role: o.onClick ? 'button' : undefined, tab: o.onClick ? 0 : undefined, ...o }; if (typeof o.icon === 'string') r.icon = ic(o.icon); if (o.chev) r.chev = chev; return r; };
    const tagN = (l) => ({ label: l, bg: 'var(--surface2)', color: 'var(--text2)' });
    const sw = (k, sub) => { const on = !!st[k]; return { sw: { track: on ? 'var(--primary)' : 'var(--surface2)', x: on ? '20px' : '0px' }, role: 'switch', checked: on ? 'true' : 'false', tab: 0, cursor: 'pointer', onClick: () => this.setS(k, !on), sub }; };
    const nErr = s.errors.length, prep = R ? 0 : 72;
    const themeRow = (t) => row({ icon: t.icon, title: t.name, sub: pct(t) + ' % maîtrisé', pct: pct(t) + '%', chev: true, onClick: () => this.pushTheme(t.id) });
    const qRow = (id, chosen, from) => { const q = qById(id); return row({ tag: tagN(thById(q.t).short), title: q.q, sub: chosen != null ? 'Ta réponse : ' + q.a[chosen] : null, chev: true, onClick: () => this.push({ s: 'question', id, chosen, from }) }); };
    const back = { show: true, backIcon: ic('chevL', 26), backLabel: 'Retour', onBack: () => this.back() };
    let bar = { show: false }, largeTitle = null, home = null, testHero = null, progHero = null, profile = null, intro = null, fiche = null, flash = null, qv = null, res = null, chips = null, groups = [], empty = null, sticky = null, quizBar = null;
    const primary = (label, onClick, o) => Object.assign({ label, onClick, dir: 'column', op: 1 }, o || {});
    const fsQ = { Petite: '20px', Normale: '23px', Grande: '26px' }[st.text], fsA = { Petite: '15px', Normale: '16px', Grande: '18px' }[st.text];
    const buildQv = (q, states, onPick, disabled, explain, order = IDENTITY) => ({
      theme: thById(q.t).short, text: q.q, fs: fsQ, afs: fsA, explain,
      answers: order.map((orig, i) => {
        const k = states[orig]; const m = {
          normal: { bg: 'var(--surface)', border: '2px solid var(--divider)', badgeBg: 'var(--surface2)', badgeColor: 'var(--text)', op: 1 },
          selected: { bg: 'var(--tint)', border: '2px solid var(--primary)', badgeBg: 'var(--primary)', badgeColor: 'var(--onChip)', op: 1 },
          correct: { bg: 'var(--successTint)', border: '2px solid var(--success)', badgeBg: 'var(--success)', badgeColor: 'var(--onChip)', op: 1, note: 'Bonne réponse', noteColor: 'var(--success)', badge: ic('check', 20, 2.5) },
          wrong: { bg: 'var(--errorTint)', border: '2px solid var(--error)', badgeBg: 'var(--error)', badgeColor: 'var(--onChip)', op: 1, note: 'Ta réponse', noteColor: 'var(--error)', badge: ic('x', 20, 2.5) },
          dim: { bg: 'var(--surface)', border: '2px solid transparent', badgeBg: 'var(--surface2)', badgeColor: 'var(--text2)', op: 0.5 },
        }[k];
        const txt = q.a[orig];
        return { ...m, key: orig, badge: m.badge || LET[i], text: txt, disabled, checked: k === 'selected' ? 'true' : 'false', aria: LET[i] + '. ' + txt + (m.note ? ' — ' + m.note : ''), onClick: () => onPick(orig) };
      }),
    });
    const favBtn = (id) => { const f = s.favs.includes(id); return { icon: ic('star', 22, 1.5, f), color: f ? 'var(--primary)' : 'var(--text2)', label: f ? 'Retirer des favoris' : 'Ajouter aux favoris', pressed: f ? 'true' : 'false', onClick: () => this.toggleFav(id) }; };
    const T = { theme: 'Thème', errors: 'Mes erreurs', favs: 'Mes favoris', traps: 'Questions pièges', dates: 'Dates à retenir', flash: 'Flashcards', question: 'Question', examIntro: 'Examen blanc', review: 'Correction des erreurs', history: 'Historique des examens', settings: 'Paramètres', notifications: 'Notifications', about: 'À propos' };
    if (T[c.s]) bar = { ...back, title: T[c.s] };

    switch (c.s) {
      case 'home': {
        home = {
          prep: prep + ' %', prepW: prep + '%', goal: 'Objectif du jour : ' + (R ? 0 : 6) + ' / ' + st.goal + ' questions', loading: s.loading === 'cta', ctaLabel: s.loading === 'cta' ? 'Chargement…' : 'Continuer ma révision', ctaSub: 'Suggestion : Institutions · 3 questions', onCta: () => this.startQuiz('theme', 'inst', 'cta'),
          tiles: [
            { label: 'Examen blanc', sub: ex + ' questions • 45 min', icon: ic('clipboard'), onClick: () => this.push({ s: 'examIntro' }) },
            { label: 'Quiz rapide', sub: '5 à 40 questions', icon: ic('zap'), onClick: () => this.openSheet('count') },
            { label: 'Mes erreurs', sub: nErr ? nErr + ' à revoir' : 'Aucune erreur', icon: ic('rotate'), badge: nErr || null, onClick: () => this.push({ s: 'errors' }) },
            { label: 'Révision intelligente', sub: 'Selon tes points faibles', icon: ic('sparkles'), onClick: () => this.startQuiz('smart') },
          ],
        };
        groups = [G('À travailler aujourd’hui', weak.map(themeRow))]; break;
      }
      case 'revise':
        largeTitle = 'Réviser';
        groups = [G('Thèmes', THEMES.map(themeRow)), G('Révision rapide', [
          row({ icon: 'rotate', title: 'Mes erreurs', value: String(nErr), chev: true, onClick: () => this.push({ s: 'errors' }) }),
          row({ icon: 'star', title: 'Mes favoris', value: String(s.favs.length), chev: true, onClick: () => this.push({ s: 'favs' }) }),
          row({ icon: 'alert', title: 'Questions pièges', chev: true, onClick: () => this.push({ s: 'traps' }) }),
          row({ icon: 'calendar', title: 'Dates à retenir', chev: true, onClick: () => this.push({ s: 'dates' }) }),
          row({ icon: 'layers', title: 'Flashcards', chev: true, onClick: () => this.push({ s: 'flash' }) }),
        ])]; break;
      case 'test':
        largeTitle = 'Tester';
        testHero = { sub: ex + ' questions • 45 min', pass: 'Seuil de réussite : ' + Math.ceil(ex * 0.8) + ' / ' + ex, onStart: () => this.push({ s: 'examIntro' }) };
        groups = [G('Entraînement libre', [
          row({ icon: 'zap', title: 'Quiz rapide', sub: '5, 10, 20 ou 40 questions', chev: true, onClick: () => this.openSheet('count') }),
          row({ icon: 'book', title: 'Quiz par thème', sub: '5 thématiques officielles', chev: true, onClick: () => this.openSheet('theme') }),
          row({ icon: 'flame', title: 'Questions difficiles', sub: 'Les pièges les plus fréquents', chev: true, onClick: () => this.startQuiz('hard') }),
        ])]; break;
      case 'progress':
        largeTitle = 'Progression'; progHero = { label: (R ? 0 : 78) + ' %', w: (R ? 0 : 78) + '%' };
        groups = [
          G(null, [row({ title: 'Questions maîtrisées', stat: R ? '0 / 209' : '154 / 209' }), row({ title: 'Examens réalisés', stat: R ? '0' : '7' }), row({ title: 'Meilleur score', stat: R ? '–' : '36 / 40' })]),
          G('Progression par thème', THEMES.map((t) => row({ title: t.name, value: pct(t) + ' %', pct: pct(t) + '%', chev: true, onClick: () => this.pushTheme(t.id) }))),
          G('Mes points faibles', weak.map((t) => row({ icon: 'alert', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: t.name, sub: pct(t) + ' % maîtrisé', chev: true, onClick: () => this.pushTheme(t.id) })), { label: s.loading === 'weak' ? 'Chargement…' : 'Travailler mes points faibles', loading: s.loading === 'weak', onClick: () => this.startQuiz('weak', null, 'weak') }),
          G(null, [row({ icon: 'clock', title: 'Historique des examens', sub: '7 examens blancs', chev: true, onClick: () => this.push({ s: 'history' }) })]),
        ]; break;
      case 'profile': {
        largeTitle = 'Profil'; profile = { initials: 'AM', name: 'Amina M.', sub: st.prep + ' · ' + prep + ' % de préparation' };
        const rows = [
          row({ icon: 'sliders', title: 'Paramètres', chev: true, onClick: () => this.push({ s: 'settings' }) }),
          row({ icon: 'bell', title: 'Notifications', value: st.reminder ? st.time : 'Désactivées', chev: true, onClick: () => this.push({ s: 'notifications' }) }),
          row({ icon: 'sun', title: 'Apparence', value: { system: 'Système', light: 'Clair', dark: 'Sombre' }[st.theme], chev: true, onClick: () => this.openSheet('appearance') }),
          row({ icon: 'info', title: 'À propos', chev: true, onClick: () => this.push({ s: 'about' }) }),
        ];
        groups = [G(null, rows)];
        if (!isStandalone() && (s.installable || isIOS())) groups.push(G(null, [row({ icon: 'download', title: 'Installer l’application', sub: 'Accès depuis l’écran d’accueil, hors connexion', chev: true, onClick: () => this.install() })]));
        break;
      }
      case 'settings': {
        const seg = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => { const a = st.theme === v; return { label: l, checked: a ? 'true' : 'false', bg: a ? 'var(--segOn)' : 'transparent', color: a ? 'var(--text)' : 'var(--text2)', shadow: a ? '0 1px 3px rgba(0,0,0,.14)' : 'none', weight: a ? 600 : 500, onClick: (e) => { e.stopPropagation(); this.setS('theme', v); } }; });
        groups = [
          G('Préparation', [row({ title: 'Type de préparation', value: st.prep, chev: true, onClick: () => this.openSheet('prep') }), row({ title: 'Objectif quotidien', value: st.goal + ' questions', chev: true, onClick: () => this.openSheet('goal') }), row({ title: 'Révision automatique', ...sw('auto') })]),
          G('Notifications', [row({ title: 'Rappels', value: st.reminder ? 'Activés · ' + st.time : 'Désactivés', chev: true, onClick: () => this.push({ s: 'notifications' }) })]),
          G('Apparence', [row({ title: 'Thème', seg }), row({ title: 'Taille du texte', value: st.text, chev: true, onClick: () => this.openSheet('text') })]),
          G('Quiz', [row({ title: 'Afficher immédiatement la correction', ...sw('instant') }), row({ title: 'Mélanger les réponses', ...sw('shuffle') }), row({ title: 'Longueur de l’examen blanc', value: st.examLength + ' questions', chev: true, onClick: () => this.openSheet('examLength') }), row({ title: 'Son', ...sw('sound') }), row({ title: 'Vibration', ...sw('vibration') })]),
          G('Données', [row({ title: 'Réinitialiser ma progression', color: 'var(--error)', onClick: () => this.openSheet('reset') })]),
          G('À propos', [row({ title: 'Version de l’application', value: '2.4.0' }), row({ title: 'Sources officielles', chev: true, onClick: () => this.push({ s: 'about' }) }), row({ title: 'Confidentialité', chev: true, onClick: () => this.push({ s: 'about' }) })]),
        ]; break;
      }
      case 'notifications':
        groups = [
          G(null, [row({ title: 'Rappel quotidien', ...sw('reminder', 'Un rappel pour garder ton rythme') }), row({ title: 'Heure du rappel', value: st.time, chev: true, op: st.reminder ? 1 : 0.45, onClick: st.reminder ? () => this.openSheet('time') : undefined })]),
          G(null, [row({ title: 'Rappel de série', ...sw('streak', 'Si tu n’as pas révisé depuis 2 jours') })]),
        ]; break;
      case 'about':
        groups = [
          G(null, [row({ title: 'Version', value: '2.4.0' }), row({ title: 'Questions mises à jour', value: 'Sept. 2026' })]),
          G('Sources officielles', [row({ title: 'Livret du citoyen', sub: 'Ministère de l’Intérieur' }), row({ title: 'Service-Public.fr', sub: 'Démarches et droits' }), row({ title: 'Légifrance', sub: 'Constitution et lois' })]),
          G('Confidentialité', [row({ title: 'Tes données restent sur ton téléphone', sub: 'Aucun compte requis. Aucune donnée partagée.' })]),
        ]; break;
      case 'history':
        groups = [G(null, HISTORY.map(([d, sc, t]) => { const ok = sc >= 32; return row({ title: 'Examen blanc', sub: d + ' · ' + t, stat: sc + ' / 40', badge: { label: ok ? 'Réussi' : 'Échoué', icon: ic(ok ? 'check' : 'x', 14, 2.5), bg: ok ? 'var(--successTint)' : 'var(--errorTint)', color: ok ? 'var(--success)' : 'var(--error)' } }); }))]; break;
      case 'errors': {
        if (!nErr) { empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucune erreur à revoir', text: 'Continue comme ça.', btn: 'Faire un quiz', onBtn: () => this.openSheet('count') }; break; }
        const f = c.filter || 'all';
        chips = [{ id: 'all', label: 'Toutes' }].concat(THEMES.map((t) => ({ id: t.id, label: t.short }))).map((ch) => { const a = ch.id === f; return { key: ch.id, label: ch.label, pressed: a ? 'true' : 'false', bg: a ? 'var(--primary)' : 'var(--surface)', color: a ? 'var(--onChip)' : 'var(--text)', border: a ? 'transparent' : 'var(--line)', onClick: () => this.setTop({ filter: ch.id }) }; });
        const list = s.errors.filter((e) => f === 'all' || qById(e.id).t === f);
        if (list.length) groups = [G(null, list.map((e) => qRow(e.id, e.chosen, 'errors')))];
        else empty = { icon: ic('check', 32, 2), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Rien dans ce thème', text: 'Choisis un autre filtre.' };
        sticky = primary('Revoir en quiz (' + nErr + ')', () => this.startQuiz('errors')); break;
      }
      case 'favs':
        if (s.favs.length) groups = [G(null, s.favs.map((id) => qRow(id, null, 'favs')))];
        else empty = { icon: ic('star', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune question favorite', text: 'Ajoute une question avec l’icône étoile pendant tes révisions.' };
        break;
      case 'traps':
        intro = 'Les questions où les candidats se trompent le plus souvent.';
        groups = [G(null, TRAPS.map((id) => qRow(id, null, 'traps')))]; break;
      case 'dates':
        groups = [G(null, DATES.map(([y, t]) => row({ year: y, title: t })))]; break;
      case 'review': {
        const L = s.last;
        if (L && L.wrong.length) groups = [G(null, L.wrong.map((w) => qRow(w.id, w.chosen, 'review')))];
        else empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucune erreur', text: 'Tu as tout bon.' };
        break;
      }
      case 'examIntro':
        intro = 'Mets-toi dans les conditions de l’examen officiel. La correction s’affiche à la fin.';
        groups = [G('Déroulement', [row({ icon: 'clipboard', title: ex + ' questions à choix multiples' }), row({ icon: 'clock', title: '45 minutes chronométrées' }), row({ icon: 'target', title: Math.ceil(ex * 0.8) + ' bonnes réponses pour réussir' }), row({ icon: 'rotate', title: 'Tes erreurs sont ajoutées à ta liste de révision' })])];
        sticky = primary(s.loading === 'exam' ? 'Chargement…' : 'Commencer l’examen', () => this.startQuiz('exam', null, 'exam'), { loading: s.loading === 'exam', disabled: s.loading === 'exam' }); break;
      case 'theme': {
        const t = thById(c.id); bar.title = t.short; const n = Q.filter((q) => q.t === t.id).length;
        fiche = { loading: s.skeleton, ready: !s.skeleton, icon: ic(t.icon, 26), name: t.name, pct: pct(t) + '%', pctLabel: pct(t) + ' %', sub: 'Maîtrise · ' + n + ' questions', facts: withSep(FACTS[t.id].map((x, i) => ({ n: i + 1, text: x }))) };
        if (!s.skeleton) groups = [G('S’entraîner', [row({ icon: 'layers', title: 'Flashcards du thème', chev: true, onClick: () => this.push({ s: 'flash', theme: t.id }) }), row({ icon: 'alert', title: 'Questions pièges', chev: true, onClick: () => this.push({ s: 'traps' }) })])];
        sticky = primary(s.loading === 'theme' ? 'Chargement…' : 'Tester mes connaissances', () => this.startQuiz('theme', t.id, 'theme'), { loading: s.loading === 'theme', disabled: s.loading === 'theme' || s.skeleton, op: s.skeleton ? 0.45 : 1 }); break;
      }
      case 'flash': {
        const cards = c.theme ? Q.filter((q) => q.t === c.theme) : Q; const i = s.fc % cards.length; const q = cards[i];
        if (c.theme) bar.title = 'Flashcards · ' + thById(c.theme).short;
        flash = {
          theme: thById(q.t).short, counter: (i + 1) + ' / ' + cards.length, kicker: s.flip ? 'Réponse' : 'Question', kColor: s.flip ? 'var(--success)' : 'var(--primaryText)', text: s.flip ? q.a[q.c] : q.q, detail: s.flip ? q.x : null, hint: s.flip ? 'Touche pour revoir la question' : 'Touche pour voir la réponse', flipIcon: ic('rotate', 16),
          onFlip: () => { const el = this.cardRef.current; if (el && el.animate) el.animate([{ transform: 'scaleX(.96)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }); this.setState({ flip: !s.flip }); },
        };
        const next = (ok) => { this.setState({ fc: s.fc + 1, flip: false }); if (!ok && !s.errors.some((e) => e.id === q.id)) this.setState({ errors: s.errors.concat([{ id: q.id, chosen: (q.c + 1) % 4 }]) }); };
        sticky = primary('Je savais', () => next(true), { dir: 'row', icon: ic('check', 20, 2), secondary: { label: 'À revoir', icon: ic('x', 20, 2), onClick: () => next(false), order: 0, h: '54px', border: '1.5px solid var(--line)', color: 'var(--text)' } }); break;
      }
      case 'question': {
        const q = qById(c.id); bar.star = favBtn(q.id);
        const states = q.a.map((_, i) => (i === q.c ? 'correct' : i === c.chosen ? 'wrong' : 'dim'));
        qv = buildQv(q, states, () => {}, true, { text: q.x, bulb: ic('bulb', 16) });
        if (c.from === 'errors' && s.errors.some((e) => e.id === q.id)) sticky = primary('J’ai compris', () => { this.setState({ errors: s.errors.filter((e) => e.id !== q.id) }); this.toast('Retiré de mes erreurs'); this.back(); }, { icon: ic('check', 20, 2) });
        break;
      }
      case 'quiz': {
        const z = s.quiz; if (!z) break; const id = z.qs[z.idx]; const q = qById(id); const n = z.qs.length; const last = z.idx + 1 >= n;
        bar = { ...back, title: 'Question ' + (z.idx + 1) + ' / ' + n, backLabel: 'Quitter le test', star: favBtn(q.id) };
        quizBar = { pct: ((z.idx + (z.validated ? 1 : 0)) / n) * 100 + '%', mode: z.title, timer: z.timed ? fmt(z.timeLeft) : null, timerColor: z.timeLeft < 300 ? 'var(--warn)' : 'var(--text)', clock: ic('clock', 16, 2) };
        const ans = z.validated ? z.answers[z.answers.length - 1] : null;
        const states = q.a.map((_, i) => (z.validated ? (i === q.c ? 'correct' : i === ans.chosen ? 'wrong' : 'dim') : z.sel === i ? 'selected' : 'normal'));
        const explain = z.validated ? { text: q.x, bulb: ic('bulb', 16), verdict: ans.ok ? 'Bonne réponse' : 'Mauvaise réponse', vColor: ans.ok ? 'var(--success)' : 'var(--error)', vIcon: ic(ans.ok ? 'check' : 'x', 20, 2.5) } : null;
        qv = buildQv(q, states, (i) => this.select(i), z.validated, explain, z.orders[id] || IDENTITY);
        const label = z.validated ? (last ? 'Voir le résultat' : 'Question suivante') : z.instant ? 'Valider' : last ? 'Terminer l’examen' : 'Valider et continuer';
        sticky = primary(label, () => this.primaryQuiz(), { disabled: !z.validated && z.sel == null, op: !z.validated && z.sel == null ? 0.45 : 1 }); break;
      }
      case 'result': {
        const L = s.last; if (!L) break; const need = Math.ceil(L.total * 0.8); const ok = L.score >= need;
        bar = { show: true, title: 'Résultat', backIcon: ic('x', 24), backLabel: 'Fermer', onBack: () => this.back() };
        res = {
          title: L.title, score: L.score, total: L.total, verdict: ok ? 'Réussi' : 'Pas encore', vIcon: ic(ok ? 'check' : 'x', 16, 2.5), vBg: ok ? 'var(--successTint)' : 'var(--errorTint)', vColor: ok ? 'var(--success)' : 'var(--error)',
          msg: ok ? 'Bravo, tu atteins le seuil de réussite.' : 'Il faut ' + need + ' bonnes réponses sur ' + L.total + ' pour réussir.',
          stats: [{ v: L.score, l: 'Bonnes réponses' }, { v: L.total - L.score, l: 'Erreurs' }, { v: L.used != null ? fmt(L.used) : Math.round((L.score / L.total) * 100) + ' %', l: L.used != null ? 'Temps' : 'Réussite' }].map((x, i) => ({ ...x, sep: i ? '1px solid var(--divider)' : 'none' })),
        };
        const nw = L.wrong.length;
        const home2 = { label: 'Retour à l’accueil', onClick: () => this.goHome(), order: 2, h: '46px', border: 'none', color: 'var(--primaryText)' };
        sticky = nw ? primary('Revoir mes erreurs (' + nw + ')', () => this.push({ s: 'review' }), { secondary: home2 }) : primary('Terminer', () => this.back(), { secondary: home2 });
        break;
      }
    }
    const showNav = !(c.s === 'quiz' || c.s === 'result');
    const sd = s.sheet ? this.sheetData() : null;
    const sheet = sd ? { ...sd, scrimOp: s.closing ? 0 : 1, transform: s.closing ? 'translateY(100%)' : 'translateY(' + s.drag + 'px)', transition: s.dragging ? 'none' : 'transform .22s cubic-bezier(.2,.8,.2,1)' } : null;
    const tabs = TABS.map(([id, label, icn]) => { const a = s.tab === id; return { id, label, icon: ic(icn, 22, a ? 2 : 1.5), color: a ? 'var(--primaryText)' : 'var(--text2)', pill: a ? 'var(--tint)' : 'transparent', weight: a ? 600 : 500, current: a ? 'page' : undefined, onClick: () => this.switchTab(id) }; });
    const toastPx = (showNav ? 72 : 0) + (sticky ? (sticky.secondary && sticky.dir === 'column' ? 140 : 86) : 0) + 24;
    const toast = s.toast ? { m: s.toast.m, icon: ic('check', 18, 2.5), bottom: 'calc(' + toastPx + 'px + var(--safe-bottom))' } : null;
    return { bar, quizBar, largeTitle, home, testHero, progHero, profile, intro, fiche, flash, qv, res, chips, groups, empty, sticky, showNav, tabs, toast, sheet, safeBg: showNav ? 'var(--surface)' : 'var(--bg)' };
  }

  onSheetDown = (e) => { this.dragY = e.clientY; this.setState({ dragging: true }); if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); };
  onSheetMove = (e) => { if (this.dragY == null) return; this.setState({ drag: Math.max(0, e.clientY - this.dragY) }); };
  onSheetUp = () => { if (this.dragY == null) return; this.dragY = null; if (this.state.drag > 90) { this.setState({ dragging: false }); this.closeSheet(); } else this.setState({ drag: 0, dragging: false }); };

  render() {
    const v = this.vals();
    return (
      <div className="app">
        <div className="safe-top" />
        {v.bar.show && <TopBar bar={v.bar} />}
        {v.quizBar && <QuizBar b={v.quizBar} />}
        <div ref={this.scrollRef} className="scroller">
          <div ref={this.contentRef} style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 28 }}>
            {v.largeTitle && <h1 style={{ margin: 0, padding: '6px 20px 0', font: '600 32px/1.1 var(--font-heading)', letterSpacing: '-.01em' }}>{v.largeTitle}</h1>}
            {v.home && <Home h={v.home} />}
            {v.testHero && <TestHero t={v.testHero} />}
            {v.progHero && <ProgHero p={v.progHero} />}
            {v.profile && <Profile p={v.profile} />}
            {v.intro && <p style={{ margin: 0, padding: '8px 20px 0', fontSize: 16, lineHeight: 1.5, color: 'var(--text2)', textWrap: 'pretty' }}>{v.intro}</p>}
            {v.fiche && <Fiche f={v.fiche} />}
            {v.flash && <Flash f={v.flash} cardRef={this.cardRef} />}
            {v.qv && <QuestionView qv={v.qv} />}
            {v.res && <Result r={v.res} />}
            {v.chips && <Chips chips={v.chips} />}
            {v.groups.map((g, gi) => <Group key={gi} g={g} />)}
            {v.empty && <Empty e={v.empty} />}
          </div>
        </div>
        {v.sticky && <Sticky s={v.sticky} />}
        {v.showNav && <Nav tabs={v.tabs} />}
        <div className="safe-bottom" style={{ background: v.safeBg }} />
        {v.toast && (
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: v.toast.bottom, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div role="status" aria-live="polite" style={{ background: 'var(--toast)', color: 'var(--onToast)', padding: '12px 18px', borderRadius: 10, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.22)', animation: 'tcRise .2s ease' }}>{v.toast.icon}{v.toast.m}</div>
          </div>
        )}
        {v.sheet && <Sheet sheet={v.sheet} onClose={() => this.closeSheet()} onDown={this.onSheetDown} onMove={this.onSheetMove} onUp={this.onSheetUp} />}
      </div>
    );
  }
}

const Corners = () => (<><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>);
const Bar = ({ w, h = 8 }) => (
  <div role="progressbar" style={{ height: h, background: 'var(--surface2)', borderRadius: h / 2, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: w, background: 'var(--primary)', borderRadius: h / 2, transition: 'width .6s ease' }} />
  </div>
);
const btnPrimary = { border: 'none', borderRadius: 10, background: 'var(--btn)', color: 'var(--onBtn)', font: '600 17px/1 var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' };
const iconBtn = { width: 44, height: 44, flex: 'none', border: 'none', background: 'transparent', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' };
const h2s = { margin: 0, font: '600 21px/1.2 var(--font-heading)' };
const card = { background: 'var(--surface)', borderRadius: 10, boxShadow: 'var(--shadowS)' };

function TopBar({ bar }) {
  return (
    <div style={{ flex: 'none', height: 52, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 4px' }}>
      <button className="p-bg2" onClick={bar.onBack} aria-label={bar.backLabel} style={{ ...iconBtn, color: 'var(--text)' }}>{bar.backIcon}</button>
      <div style={{ flex: 1, minWidth: 0, font: '600 21px/1.2 var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bar.title}</div>
      {bar.star && <button className="p-star" onClick={bar.star.onClick} aria-label={bar.star.label} aria-pressed={bar.star.pressed} style={{ ...iconBtn, color: bar.star.color, transition: 'transform .15s' }}>{bar.star.icon}</button>}
    </div>
  );
}

function QuizBar({ b }) {
  return (
    <div style={{ flex: 'none', padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="progressbar" aria-label="Progression du test" style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: b.pct, background: 'var(--primary)', borderRadius: 2, transition: 'width .35s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22, fontSize: 14, color: 'var(--text2)' }}>
        <span>{b.mode}</span>
        {b.timer && <span aria-label="Temps restant" style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 18px/1 var(--font-heading)', color: b.timerColor, fontVariantNumeric: 'tabular-nums' }}>{b.clock}{b.timer}</span>}
      </div>
    </div>
  );
}

function Home({ h }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 13 }}>
        <img src={BRAND_ICON} alt="" aria-hidden="true" style={{ width: 52, height: 52, flex: 'none', objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(20,55,130,.12))' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>Civi · Test Civique</div>
          <h1 style={{ margin: 0, font: '600 32px/1.05 var(--font-heading)' }}>Bonjour 👋</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text2)' }}>Continue ta préparation</p>
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Corners />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ font: '600 64px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{h.prep}</span><span style={{ fontSize: 16, color: 'var(--text2)' }}>de préparation</span></div>
          <Bar w={h.prepW} />
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>{h.goal}</div>
          <button className="p-btn" onClick={h.onCta} disabled={h.loading} style={{ ...btnPrimary, marginTop: 4, height: 56 }}>{h.loading && <span className="spinner" />}{h.ctaLabel}</button>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>{h.ctaSub}</div>
        </div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={h2s}>Que veux-tu faire ?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {h.tiles.map((t) => (
            <button key={t.label} className="p-tile" onClick={t.onClick} style={{ position: 'relative', minHeight: 116, padding: 14, border: 'none', borderRadius: 10, background: 'var(--surface)', boxShadow: 'var(--shadowS)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{t.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>{t.label}</span><span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.3 }}>{t.sub}</span></span>
              {t.badge && <span style={{ position: 'absolute', top: 12, right: 12, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: 'var(--red)', color: '#fff', font: '600 13px/22px var(--font-body)', textAlign: 'center' }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestHero({ t }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Corners />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>Conditions réelles</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><h2 style={{ margin: 0, font: '600 30px/1.1 var(--font-heading)' }}>Examen blanc</h2><span style={{ fontSize: 16, color: 'var(--text2)' }}>{t.sub}</span></div>
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{t.pass}</span>
        <button className="p-btn" onClick={t.onStart} style={{ ...btnPrimary, height: 56 }}>Démarrer l'examen</button>
      </div>
    </div>
  );
}

function ProgHero({ p }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Corners />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ font: '600 64px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{p.label}</span><span style={{ fontSize: 16, color: 'var(--text2)' }}>Maîtrise globale</span></div>
        <Bar w={p.w} />
      </div>
    </div>
  );
}

function Profile({ p }) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ width: 64, height: 64, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primaryText)', font: '600 24px/1 var(--font-heading)' }}>{p.initials}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><span style={{ font: '600 22px/1.15 var(--font-heading)' }}>{p.name}</span><span style={{ fontSize: 14, color: 'var(--text2)' }}>{p.sub}</span></span>
    </div>
  );
}

function Fiche({ f }) {
  const sk = { background: 'var(--surface2)', borderRadius: 4 };
  return (
    <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {f.loading && (
        <div aria-label="Chargement" style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'tcShimmer 1.1s ease-in-out infinite' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span style={{ ...sk, width: 52, height: 52, borderRadius: 10 }} /><span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ ...sk, height: 20, width: '80%' }} /><span style={{ ...sk, height: 20, width: '50%' }} /></span></div>
          <span style={{ ...sk, height: 8 }} />
          <span style={{ ...sk, height: 22, width: '40%', marginTop: 8 }} />
          <span style={{ ...sk, height: 220, borderRadius: 10 }} />
        </div>
      )}
      {f.ready && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span style={{ width: 52, height: 52, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{f.icon}</span><h1 style={{ margin: 0, font: '600 26px/1.15 var(--font-heading)', textWrap: 'pretty' }}>{f.name}</h1></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}><span>{f.sub}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.pctLabel}</span></div>
            <Bar w={f.pct} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={h2s}>L'essentiel</h2>
            <div style={card}>
              {f.facts.map((x) => (
                <div key={x.n} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: x.sep }}><span style={{ flex: 'none', width: 16, font: '600 20px/1.3 var(--font-heading)', color: 'var(--primaryText)' }}>{x.n}</span><span style={{ fontSize: 16, lineHeight: 1.45, textWrap: 'pretty' }}>{x.text}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Flash({ f, cardRef }) {
  return (
    <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}><span>{f.theme}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{f.counter}</span></div>
      <button ref={cardRef} className="p-card" onClick={f.onFlip} aria-label="Retourner la carte" style={{ minHeight: 400, border: 'none', borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadowM)', padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16, textAlign: 'left', cursor: 'pointer', transition: 'transform .1s' }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: f.kColor }}>{f.kicker}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><span style={{ font: '600 27px/1.2 var(--font-heading)', textWrap: 'pretty' }}>{f.text}</span>{f.detail && <span style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text2)', textWrap: 'pretty' }}>{f.detail}</span>}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text2)' }}>{f.flipIcon}{f.hint}</span>
      </button>
    </div>
  );
}

function QuestionView({ qv }) {
  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text2)' }}>{qv.theme}</span>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: qv.fs, lineHeight: 1.2, textWrap: 'pretty' }}>{qv.text}</h2>
      <div role="radiogroup" aria-label="Réponses" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {qv.answers.map((a) => (
          <button key={a.key} className="p-answer" onClick={a.onClick} disabled={a.disabled} role="radio" aria-checked={a.checked} aria-label={a.aria} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '12px 14px', borderRadius: 10, border: a.border, background: a.bg, opacity: a.op, textAlign: 'left', cursor: a.disabled ? 'default' : 'pointer', transition: 'background .18s,border-color .18s,opacity .18s,transform .1s' }}>
            <span style={{ width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: a.badgeBg, color: a.badgeColor, font: '600 18px/1 var(--font-heading)', transition: 'background .18s' }}>{a.badge}</span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: qv.afs, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)' }}>{a.text}</span>{a.note && <span style={{ fontSize: 13, fontWeight: 600, color: a.noteColor }}>{a.note}</span>}</span>
          </button>
        ))}
      </div>
      {qv.explain && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, animation: 'tcRise .25s ease' }}>
          {qv.explain.verdict && <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 18px/1.2 var(--font-heading)', color: qv.explain.vColor }}>{qv.explain.vIcon}{qv.explain.verdict}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>{qv.explain.bulb}À retenir</span>
          <span style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>{qv.explain.text}</span>
        </div>
      )}
    </div>
  );
}

function Result({ r }) {
  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="blueprint" style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <Corners />
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{r.title}</span>
        <div style={{ font: '600 80px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{r.score}<span style={{ fontSize: 34, color: 'var(--text2)' }}> / {r.total}</span></div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: r.vBg, color: r.vColor, fontSize: 15, fontWeight: 600 }}>{r.vIcon}{r.verdict}</span>
        <span style={{ fontSize: 15, color: 'var(--text2)', textWrap: 'pretty', maxWidth: 260 }}>{r.msg}</span>
      </div>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
        {r.stats.map((st) => (
          <div key={st.l} style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderLeft: st.sep }}><span style={{ font: '600 26px/1 var(--font-heading)' }}>{st.v}</span><span style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>{st.l}</span></div>
        ))}
      </div>
    </div>
  );
}

function Chips({ chips }) {
  return (
    <div className="chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 20px 0' }}>
      {chips.map((ch) => (
        <button key={ch.key} className="p-chip" onClick={ch.onClick} aria-pressed={ch.pressed} style={{ flex: 'none', height: 38, padding: '0 16px', borderRadius: 19, border: '1px solid ' + ch.border, background: ch.bg, color: ch.color, fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'background .15s' }}>{ch.label}</button>
      ))}
    </div>
  );
}

function Group({ g }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
      {g.header && <h2 style={{ ...h2s, padding: '0 4px' }}>{g.header}</h2>}
      <div style={{ ...card, overflow: 'hidden' }}>
        {g.rows.map((r, i) => <Row key={i} r={r} />)}
      </div>
      {g.action && (
        <button className="p-outline" onClick={g.action.onClick} disabled={g.action.loading} style={{ height: 52, borderRadius: 10, border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primaryText)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
          {g.action.loading && <span className="spinner sm" />}{g.action.label}
        </button>
      )}
    </div>
  );
}

function Row({ r }) {
  const onKeyDown = r.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.onClick(e); } } : undefined;
  return (
    <div className="p-row" onClick={r.onClick} onKeyDown={onKeyDown} role={r.role} tabIndex={r.tab} aria-checked={r.role === 'switch' ? r.checked : undefined} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 58, padding: '10px 16px', borderBottom: r.sep, cursor: r.cursor, opacity: r.op, transition: 'background .12s' }}>
      {r.icon && <span style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: r.iconBg, color: r.iconColor }}>{r.icon}</span>}
      {r.year && <span style={{ width: 58, flex: 'none', font: '600 28px/1 var(--font-heading)', color: 'var(--primaryText)' }}>{r.year}</span>}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '3px 0' }}>
        {r.tag && <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: r.tag.bg, color: r.tag.color }}>{r.tag.label}</span>}
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, color: r.color, textWrap: 'pretty' }}>{r.title}</span>
        {r.sub && <span style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--text2)' }}>{r.sub}</span>}
        {r.pct && <span style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden', marginTop: 5 }}><span style={{ display: 'block', height: '100%', width: r.pct, background: 'var(--primary)', borderRadius: 2 }} /></span>}
      </span>
      {r.value && <span style={{ flex: 'none', fontSize: 15, color: 'var(--text2)' }}>{r.value}</span>}
      {r.stat && <span style={{ flex: 'none', font: '600 22px/1 var(--font-heading)' }}>{r.stat}</span>}
      {r.badge && <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: r.badge.bg, color: r.badge.color }}>{r.badge.icon}{r.badge.label}</span>}
      {r.seg && (
        <span role="radiogroup" aria-label="Thème" style={{ flex: 'none', display: 'flex', padding: 2, borderRadius: 8, background: 'var(--surface2)' }}>
          {r.seg.map((sg) => <button key={sg.label} onClick={sg.onClick} role="radio" aria-checked={sg.checked} style={{ height: 34, padding: '0 11px', border: 'none', borderRadius: 6, background: sg.bg, color: sg.color, boxShadow: sg.shadow, fontSize: 14, fontWeight: sg.weight, cursor: 'pointer', transition: 'background .15s' }}>{sg.label}</button>)}
        </span>
      )}
      {r.sw && <span aria-hidden="true" style={{ flex: 'none', width: 51, height: 31, borderRadius: 16, background: r.sw.track, padding: 2, transition: 'background .2s' }}><span style={{ display: 'block', width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.2)', transform: 'translateX(' + r.sw.x + ')', transition: 'transform .2s cubic-bezier(.3,.7,.3,1)' }} /></span>}
      {r.chev && <span style={{ flex: 'none', color: 'var(--text2)', opacity: 0.7 }}>{r.chev}</span>}
    </div>
  );
}

function Empty({ e }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '56px 32px 24px' }}>
      <span style={{ width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: e.iconBg, color: e.iconColor }}>{e.icon}</span>
      <div style={{ font: '600 23px/1.2 var(--font-heading)', marginTop: 4 }}>{e.title}</div>
      <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text2)', maxWidth: 270, textWrap: 'pretty' }}>{e.text}</div>
      {e.btn && <button className="p-empty" onClick={e.onBtn} style={{ marginTop: 12, height: 52, padding: '0 28px', borderRadius: 10, border: 'none', background: 'var(--btn)', color: 'var(--onBtn)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{e.btn}</button>}
    </div>
  );
}

function Sticky({ s }) {
  return (
    <div style={{ flex: 'none', padding: '12px 16px 10px', background: 'var(--bg)', borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: s.dir, gap: 8 }}>
      <button className="p-btn" onClick={s.onClick} disabled={s.disabled} aria-busy={s.loading ? 'true' : undefined} style={{ ...btnPrimary, order: 1, flex: 1, minHeight: 54, opacity: s.op }}>{s.loading && <span className="spinner" />}{s.icon}{s.label}</button>
      {s.secondary && <button className="p-secondary" onClick={s.secondary.onClick} style={{ order: s.secondary.order, flex: 1, minHeight: s.secondary.h, borderRadius: 10, border: s.secondary.border, background: 'transparent', color: s.secondary.color, font: '600 16px/1 var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>{s.secondary.icon}{s.secondary.label}</button>}
    </div>
  );
}

function Nav({ tabs }) {
  return (
    <nav aria-label="Navigation principale" style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--surface)', borderTop: '1px solid var(--divider)', padding: '6px 4px 0' }}>
      {tabs.map((t) => (
        <button key={t.id} className="p-tab" onClick={t.onClick} aria-label={t.label} aria-current={t.current} style={{ height: 58, border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: t.color, cursor: 'pointer', transition: 'transform .1s' }}>
          <span style={{ width: 56, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: t.pill, transition: 'background .2s' }}>{t.icon}</span>
          <span style={{ fontSize: 12, fontWeight: t.weight }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Sheet({ sheet, onClose, onDown, onMove, onUp }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', opacity: sheet.scrimOp, transition: 'opacity .2s', animation: 'tcFade .2s' }} />
      <div role="dialog" aria-modal="true" aria-label={sheet.title} style={{ position: 'relative', background: 'var(--sheet)', borderRadius: '16px 16px 0 0', paddingBottom: 'calc(14px + max(24px, var(--safe-bottom)))', transform: sheet.transform, transition: sheet.transition, animation: 'tcUp .28s cubic-bezier(.2,.8,.2,1)', maxHeight: '86%', display: 'flex', flexDirection: 'column' }}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none', cursor: 'grab', padding: '10px 20px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, background: 'var(--line)', marginBottom: 12 }} />
          <div style={{ font: '600 25px/1.15 var(--font-heading)' }}>{sheet.title}</div>
          {sheet.sub && <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text2)', textWrap: 'pretty' }}>{sheet.sub}</div>}
        </div>
        {sheet.options && (
          <div style={{ padding: '8px 12px 0', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {sheet.options.map((o) => (
              <button key={o.label} className="p-bg2" onClick={o.onClick} style={{ minHeight: 58, padding: '10px 12px', border: 'none', borderRadius: 10, background: o.bg, color: o.color, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
                {o.icon && <span style={{ flex: 'none', color: 'var(--primary)' }}>{o.icon}</span>}
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 17, fontWeight: o.weight }}>{o.label}</span>{o.sub && <span style={{ fontSize: 14, color: 'var(--text2)' }}>{o.sub}</span>}</span>
                {o.check && <span style={{ flex: 'none' }}>{o.check}</span>}
              </button>
            ))}
          </div>
        )}
        {sheet.confirm && (
          <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="p-danger" onClick={sheet.confirm.onOk} style={{ height: 54, border: 'none', borderRadius: 10, background: 'var(--errorFill)', color: '#fff', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.ok}</button>
            <button className="p-cancel" onClick={onClose} style={{ height: 52, border: 'none', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.cancel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
