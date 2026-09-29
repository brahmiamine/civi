import { Component, createRef } from 'react';
import { ic } from './Icon.jsx';
import { THEMES, LET, MODE_T, TABS, PAL, EXAM_SECONDS, thById, shuffle, fmt } from './constants.js';
import { PREPS, prepById, hasPrep } from './bank.js';
import {
  emptyProfile, recordAnswer, isMastered, themeStats, overview, weakThemes, pickSmart, smartPlan, pickWeak, hardPool, pickExam,
  passMark, dayKey, lastActiveDay,
} from './stats.js';
import { loadSettings, saveSettings, loadProfile, saveProfile, saveQuiz } from './storage.js';
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall, installHelp } from './install.js';
import { notifSupported, notifPermission, askPermission, pushConfig, checkReminders, testNotification, onReminderMessage } from './notify.js';

// Device-wide settings; the preparation-specific ones live in each profile.
const DEVICE_DEFAULTS = {
  theme: 'system', text: 'Normale', instant: true, shuffle: true, sound: false, vibration: true,
  reminder: false, time: '19:00', streak: false, installDismissed: false,
};
const PROFILE_DEFAULTS = { goal: 10, auto: true, examLength: 40 };
const PROFILE_KEYS = Object.keys(PROFILE_DEFAULTS);
const DEFAULT_PREP = 'carte-resident';
const EMPTY_STACKS = () => ({ home: [], revise: [], test: [], progress: [], profile: [] });
const EMPTY_MSG = { weak: 'Aucun point faible détecté pour l’instant', hard: 'Aucune question difficile pour l’instant', errors: 'Aucune erreur à revoir' };
const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const BRAND_ICON = import.meta.env.BASE_URL + 'brand-icon.svg';
const APP_VERSION = __APP_VERSION__;

// The official exam gives 45 minutes for 40 questions; shorter tests get proportional time.
const examMinutes = (n) => Math.max(1, Math.round((EXAM_SECONDS / 60) * (n / 40)));
// « Signaler » sends the report by e-mail to the maintainer through Web3Forms (public key, it can only send to that inbox).
const WEB3FORMS_KEY = '8acd26cf-61e8-4f4c-9075-d0c2d884ba57';
const REPORT_REASONS = ['Réponse incorrecte', 'Énoncé ambigu', 'Faute ou coquille', 'Information périmée', 'Autre'];
// ctx: { prep, where, mode, chosen (original answer index or null), revealed }
function sendReport(ctx, q, reason, comment) {
  const L = (i) => LET[i] + '. ' + q.a[i];
  const chosen = ctx.chosen == null ? 'pas encore répondu' : L(ctx.chosen) + (ctx.chosen === q.c ? ' (juste)' : ' (fausse)');
  const lines = [
    '=== SIGNALEMENT ===', 'Motif : ' + reason, 'Commentaire : ' + (comment || '—'), '',
    '=== QUESTION ===', 'Identifiant : ' + q.id, 'Préparation : ' + ctx.prep, 'Fichier : ' + (q.lot || '—') + '.json',
    'Thème : ' + thById(q.t).name, 'Type : ' + ([q.situation && 'mise en situation', q.trap && 'piège'].filter(Boolean).join(', ') || 'classique'), '',
    'Énoncé :', q.q, '', 'Réponses :', ...q.a.map((_, i) => L(i) + (i === q.c ? '  ✅ bonne réponse' : '')), '',
    'À retenir :', q.x || '—', '',
    '=== CONTEXTE ===', 'Écran : ' + ctx.where + (ctx.mode ? ' (' + ctx.mode + ')' : ''), 'Réponse choisie : ' + chosen,
    'Correction affichée : ' + (ctx.revealed ? 'oui' : 'non'), 'Version : ' + APP_VERSION,
    'Date : ' + new Date().toLocaleString('fr-FR'), 'Appareil : ' + navigator.userAgent, 'Écran : ' + window.innerWidth + '×' + window.innerHeight,
  ];
  return fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'Civi · Signalement ' + q.id + ' · ' + reason, from_name: 'Civi · ' + ctx.prep, message: lines.join('\n') }),
  }).then((r) => r.json()).then((j) => { if (!j.success) throw new Error(j.message); });
}
const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');
const fmtWhen = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const bestOf = (list) => list.reduce((b, h) => (!b || h.score / h.total > b.score / b.total ? h : b), null);

// Drops references to questions that no longer exist in the bank (lot files edited or removed).
function cleanProfile(bank, p) {
  const has = (id) => bank.byId.has(id);
  let quiz = p.quiz;
  if (quiz && (!Array.isArray(quiz.qs) || !quiz.qs.length || !quiz.qs.every(has))) quiz = null;
  return { ...p, errors: p.errors.filter((e) => has(e.id)), favs: p.favs.filter(has), quiz };
}

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
    const saved = loadSettings();
    this.firstRun = !saved || !hasPrep(saved.prep);
    const { prep: savedPrep, ...device } = saved || {};
    const prep = hasPrep(savedPrep) ? savedPrep : (hasPrep(DEFAULT_PREP) ? DEFAULT_PREP : PREPS[0].id);
    const profiles = {};
    PREPS.forEach((b) => { profiles[b.id] = cleanProfile(b, loadProfile(b.id)); });
    // A quiz that was on screen when the page was closed or reloaded is reopened where it was.
    const stacks = EMPTY_STACKS();
    let tab = 'home';
    const q = profiles[prep].quiz;
    if (q && q.open) {
      tab = stacks[q.tab] ? q.tab : 'test';
      stacks[tab] = [{ s: 'quiz' }];
      profiles[prep] = { ...profiles[prep], quiz: { ...q, endsAt: q.timed ? Date.now() + q.timeLeft * 1000 : 0 } };
    }
    this.state = {
      tab, stacks, dir: 'tab', prep, profiles, device: { ...DEVICE_DEFAULTS, ...device },
      sheet: null, closing: false, drag: 0, dragging: false, toast: null, loading: null, skeleton: false, flip: false, fc: 0,
      systemDark: darkQuery ? darkQuery.matches : false, installable: canInstall(), notif: notifPermission(),
    };
    this.applyChrome();
  }

  componentDidMount() {
    this.sig = this.sigOf();
    this.onScheme = (e) => this.setState({ systemDark: e.matches });
    darkQuery?.addEventListener?.('change', this.onScheme);
    this.offInstall = onInstallChange(() => {
      const installable = canInstall();
      if (this.state.installable && !installable && isStandalone()) this.toast('Application installée');
      this.setState({ installable });
    });
    this.offReminder = onReminderMessage((m) => this.toast(m.title + ' — ' + m.body, 5000, 'bell'));
    // Shortcuts from the installed app icon (see manifest shortcuts).
    const go = new URLSearchParams(location.search).get('go');
    // Android / browser back button drives the in-app navigation stack.
    history.replaceState({ tc: 'root' }, '', location.pathname + location.hash);
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
    this.onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      this.setState({ notif: notifPermission() });
      this.tick();
      checkReminders();
    };
    document.addEventListener('visibilitychange', this.onVisible);
    this.applyChrome();
    saveSettings({ ...this.state.device, prep: this.state.prep });
    const q = this.prof().quiz;
    if (q && q.open) this.startTimer(q);
    else if (this.firstRun) this.openSheet('prep');
    else if (go === 'exam') this.push({ s: 'examIntro' });
    else if (go === 'smart') this.startQuiz('smart');
    else if (go === 'resume' && q) this.resumeQuiz();
    this.syncReminders();
    this.remTimer = setInterval(() => checkReminders(), 60 * 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer); clearInterval(this.remTimer); clearTimeout(this.tt); clearTimeout(this.sk); clearTimeout(this.cs); clearTimeout(this.rs);
    darkQuery?.removeEventListener?.('change', this.onScheme);
    this.offInstall?.();
    this.offReminder?.();
    window.removeEventListener('popstate', this.onPop);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  componentDidUpdate(_, ps) {
    const s = this.state;
    if (ps.device !== s.device || ps.prep !== s.prep) saveSettings({ ...s.device, prep: s.prep });
    if (ps.profiles !== s.profiles) {
      Object.keys(s.profiles).forEach((id) => {
        const a = ps.profiles[id], b = s.profiles[id];
        if (a === b) return;
        if (['stats', 'errors', 'favs', 'history', 'days', 'settings'].some((k) => a[k] !== b[k])) saveProfile(id, b);
        if (a.quiz !== b.quiz) saveQuiz(id, b.quiz);
      });
    }
    const pa = ps.profiles[s.prep], pb = s.profiles[s.prep];
    if (ps.device !== s.device || ps.prep !== s.prep || ps.notif !== s.notif || pa.days !== pb.days || pa.settings !== pb.settings) this.syncReminders();
    if (ps.device.theme !== s.device.theme || ps.systemDark !== s.systemDark) this.applyChrome();
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
    const t = this.state.device.theme;
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

  // Active preparation = the "signed-in" profile: its own questions, stats, history, errors, favourites and quiz.
  bank() { return prepById(this.state.prep); }
  prof() { return this.state.profiles[this.state.prep]; }
  // Values migrated from the first version (goal, exam length…) act as defaults for every profile.
  settings() { return { ...PROFILE_DEFAULTS, ...this.state.device, ...this.prof().settings }; }
  updP(fn) { this.setState((s) => ({ profiles: { ...s.profiles, [s.prep]: fn(s.profiles[s.prep]) } })); }
  setQuiz(q) { this.updP((p) => ({ ...p, quiz: q })); }

  sigOf() { const c = this.cur(); return this.state.prep + '/' + this.state.tab + '/' + c.s + '/' + (c.id || c.hid || ''); }
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

  // Switching preparation is like switching account: everything shown is reloaded from that profile.
  switchPrep(id) {
    this.closeSheet();
    this.firstRun = false;
    if (id === this.state.prep) return;
    clearInterval(this.timer);
    this.rootY = {}; this.pendingY = 0;
    this.setState((s) => {
      const old = s.profiles[s.prep];
      const profiles = old.quiz?.open ? { ...s.profiles, [s.prep]: { ...old, quiz: { ...old.quiz, open: false } } } : s.profiles;
      return { prep: id, profiles, stacks: EMPTY_STACKS(), fc: 0, flip: false, dir: 'tab' };
    });
    this.toast('Préparation : ' + prepById(id).name);
  }

  buildQuiz(mode, arg) {
    const st = this.settings(), bank = this.bank(), P = this.prof();
    const ids = (list) => list.map((q) => q.id);
    let qs = [], title = MODE_T[mode], timed = false, lot = null;
    if (mode === 'theme') { qs = ids(shuffle(bank.questions.filter((q) => q.t === arg))); title = 'Quiz · ' + thById(arg).short; }
    if (mode === 'hard') qs = ids(shuffle(hardPool(bank, P)));
    if (mode === 'weak') qs = pickWeak(bank, P, 10);
    if (mode === 'smart') qs = pickSmart(bank, P, Math.max(5, st.goal));
    if (mode === 'errors') qs = shuffle(P.errors.map((e) => e.id));
    if (mode === 'quick') qs = ids(shuffle(bank.questions).slice(0, arg));
    if (mode === 'exam') { qs = pickExam(bank, st.examLength); timed = true; }
    if (mode === 'lot') {
      const L = bank.lots.find((l) => l.id === arg.id);
      if (L) { qs = L.qs.slice(); lot = L.id; title = L.title + (arg.timed ? ' · examen' : ''); timed = !!arg.timed; }
    }
    if (!qs.length) return null;
    const orders = {};
    if (st.shuffle) qs.forEach((id) => { orders[id] = shuffle(bank.byId.get(id).a.map((_, i) => i)); });
    const limit = timed ? examMinutes(qs.length) * 60 : 0;
    return {
      mode, lot, title, qs, orders, idx: 0, sel: null, validated: false, answers: [], instant: !timed && st.instant,
      timed, limit, timeLeft: limit, endsAt: timed ? Date.now() + limit * 1000 : 0, startedAt: Date.now(), open: true, tab: this.state.tab,
    };
  }
  startQuiz(mode, arg, load, force) {
    if (this.state.loading) return;
    if (this.prof().quiz && !force) { this.pending = [mode, arg, load]; return this.openSheet('replace'); }
    if (this.state.sheet) this.closeSheet();
    const go = () => {
      const q = this.buildQuiz(mode, arg);
      this.setState({ loading: null });
      if (!q) return this.toast(EMPTY_MSG[mode] || 'Aucune question disponible');
      this.setQuiz(q); this.push({ s: 'quiz' }); this.startTimer(q);
    };
    if (load) { this.setState({ loading: load }); setTimeout(go, 550); } else go();
  }
  resumeQuiz() {
    const q = this.prof().quiz; if (!q) return;
    if (this.state.sheet) this.closeSheet();
    const nq = { ...q, open: true, tab: this.state.tab, endsAt: q.timed ? Date.now() + q.timeLeft * 1000 : 0 };
    this.setQuiz(nq); this.push({ s: 'quiz' }); this.startTimer(nq);
  }
  startTimer(q) { clearInterval(this.timer); if (q.timed) this.timer = setInterval(() => this.tick(), 1000); }
  // Time is derived from a deadline so the countdown stays correct when the app is backgrounded.
  // It is paused when the test is left (saved) or the page is closed, and resumes where it stopped.
  tick() {
    const q = this.prof().quiz; if (!q || !q.timed || !q.open) return clearInterval(this.timer);
    const left = Math.max(0, Math.ceil((q.endsAt - Date.now()) / 1000));
    if (left <= 0) return this.finish({ ...q, timeLeft: 0 });
    if (left !== q.timeLeft) this.updP((p) => (p.quiz ? { ...p, quiz: { ...p.quiz, timeLeft: left } } : p));
  }
  select(i) { const q = this.prof().quiz; if (!q || q.validated) return; this.setQuiz({ ...q, sel: i }); }
  primaryQuiz() {
    const q = this.prof().quiz; if (!q) return; if (q.validated) return this.nextQ(); if (q.sel == null) return;
    const id = q.qs[q.idx]; const ok = this.bank().byId.get(id).c === q.sel; const answers = q.answers.concat([{ id, chosen: q.sel, ok }]);
    this.feedback(ok, q.instant);
    if (q.instant) return this.updP((p) => ({ ...recordAnswer(p, id, ok), quiz: { ...q, answers, validated: true } }));
    const nq = { ...q, answers };
    if (q.idx + 1 >= q.qs.length) { this.updP((p) => recordAnswer(p, id, ok)); this.finish(nq); }
    else this.updP((p) => ({ ...recordAnswer(p, id, ok), quiz: { ...nq, idx: q.idx + 1, sel: null } }));
  }
  feedback(ok, instant) {
    const st = this.settings();
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
  nextQ() { const q = this.prof().quiz; if (q.idx + 1 >= q.qs.length) return this.finish(q); this.setQuiz({ ...q, idx: q.idx + 1, sel: null, validated: false }); }
  // Every finished test is kept in the profile history, with its wrong answers and per-theme score.
  finish(q) {
    clearInterval(this.timer); if (this.state.sheet) this.closeSheet();
    const bank = this.bank(), st = this.settings(), now = Date.now();
    const byId = new Map(q.answers.map((a) => [a.id, a]));
    const score = q.answers.filter((a) => a.ok).length, total = q.qs.length;
    const wrong = q.qs.filter((id) => !byId.get(id)?.ok).map((id) => ({ id, chosen: byId.has(id) ? byId.get(id).chosen : null }));
    const themes = {};
    q.qs.forEach((id) => { const t = bank.byId.get(id).t; const o = themes[t] || (themes[t] = [0, 0]); o[1]++; if (byId.get(id)?.ok) o[0]++; });
    const entry = {
      id: now, at: now, mode: q.mode, title: q.title, lot: q.lot || null, score, total, answered: q.answers.length,
      used: q.timed ? q.limit - q.timeLeft : null, passed: score >= passMark(total), wrong, themes,
    };
    this.updP((p) => {
      let errs = p.errors;
      if (q.mode === 'errors') errs = errs.filter((e) => !byId.get(e.id)?.ok);
      if (st.auto) {
        q.answers.filter((a) => !a.ok).forEach((a) => {
          errs = errs.some((e) => e.id === a.id) ? errs.map((e) => (e.id === a.id ? { id: a.id, chosen: a.chosen } : e)) : errs.concat([{ id: a.id, chosen: a.chosen }]);
        });
      }
      return { ...p, quiz: null, errors: errs, history: [entry].concat(p.history).slice(0, 200) };
    });
    this.replaceTop({ s: 'result', hid: entry.id, fresh: true });
  }
  quitQuiz(keep) {
    clearInterval(this.timer); this.closeSheet();
    const q = this.prof().quiz;
    this.setQuiz(keep && q ? { ...q, open: false } : null);
    const { tab, stacks } = this.state; const st = stacks[tab].slice(); st.pop(); const top = st[st.length - 1];
    this.pendingY = top ? (top.y || 0) : (this.rootY[tab] || 0);
    this.setState({ stacks: { ...stacks, [tab]: st }, dir: 'pop' });
    this.toast(keep ? 'Test sauvegardé : tu peux le reprendre' : 'Test abandonné');
  }
  openSheet(t) { this.setState({ sheet: t, closing: false, drag: 0 }); }
  closeSheet() { if (!this.state.sheet) return; this.setState({ closing: true }); clearTimeout(this.cs); this.cs = setTimeout(() => this.setState({ sheet: null, closing: false, drag: 0 }), 210); }
  setS(k, v, msg) {
    if (PROFILE_KEYS.includes(k)) this.updP((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));
    else this.setState((s) => ({ device: { ...s.device, [k]: v } }));
    if (msg !== false) this.toast(msg || 'Paramètre enregistré');
  }
  toast(m, ms = 1900, icon = 'check') { clearTimeout(this.tt); this.setState({ toast: { m, icon } }); this.tt = setTimeout(() => this.setState({ toast: null }), ms); }
  toggleFav(id) { const has = this.prof().favs.includes(id); this.updP((p) => ({ ...p, favs: has ? p.favs.filter((x) => x !== id) : p.favs.concat([id]) })); this.toast(has ? 'Retiré des favoris' : 'Ajouté aux favoris'); }
  resetProfile() {
    clearInterval(this.timer);
    this.updP((p) => ({ ...emptyProfile(), settings: p.settings }));
    this.closeSheet(); this.toast('Progression réinitialisée');
  }
  async install() {
    if (!this.state.installable) return this.openSheet('installHelp');
    const outcome = await promptInstall();
    if (outcome === 'accepted') this.toast('Installation en cours…');
    this.setState({ installable: canInstall() });
  }

  // Reminders need the browser permission; they are only switched on once it is granted.
  async toggleReminder(k) {
    const on = !(this.settings()[k] && this.state.notif === 'granted');
    if (on) {
      let perm = notifPermission();
      if (perm === 'default') perm = await askPermission();
      this.setState({ notif: perm });
      if (perm !== 'granted') return this.toast(perm === 'denied' ? 'Notifications bloquées dans le navigateur' : 'Autorisation non accordée', 3200, 'x');
    }
    this.setS(k, on, on ? 'Rappel activé' : 'Rappel désactivé');
  }
  syncReminders() {
    clearTimeout(this.rs);
    this.rs = setTimeout(() => {
      const st = this.settings(), P = this.prof(), today = dayKey(), granted = this.state.notif === 'granted';
      pushConfig({
        reminder: granted && st.reminder, streak: granted && st.streak, time: st.time, goal: st.goal, prep: this.bank().name,
        days: { [today]: P.days[today] || 0 }, lastActive: lastActiveDay(P.days),
      }).then(() => checkReminders());
    }, 300);
  }

  // Where the report comes from: quiz (answer picked or validated) or a question opened from errors, favourites, history…
  reportCtx(bank, q) {
    const c = this.cur(), z = this.prof().quiz, ctx = { prep: bank.name, where: 'question', mode: null, chosen: null, revealed: true };
    if (c.s === 'quiz' && z && z.qs[z.idx] === q.id) {
      const ans = z.validated ? z.answers[z.answers.length - 1] : null;
      return { ...ctx, where: 'test', mode: z.title, chosen: ans ? ans.chosen : z.sel ?? null, revealed: !!(z.validated && z.instant) };
    }
    return { ...ctx, where: c.from ? 'question (' + c.from + ')' : 'question', chosen: c.chosen ?? null };
  }

  sheetData() {
    const s = this.state, st = this.settings(), bank = this.bank(), P = this.prof(), TS = themeStats(bank, P);
    const opt = (label, sub, sel, fn, icon) => ({ label, sub, onClick: fn, icon, check: sel ? ic('check', 20, 2) : null, color: sel ? 'var(--primaryText)' : 'var(--text)', weight: sel ? 600 : 500, bg: sel ? 'var(--tint)' : 'transparent' });
    const pick = (k, list) => list.map((o) => opt(o[1], o[2], st[k] === o[0], () => { this.setS(k, o[0]); this.closeSheet(); }));
    const n = bank.questions.length;
    switch (s.sheet) {
      case 'count': {
        const counts = [5, 10, 20, 40].filter((c) => c <= n);
        if (!counts.length || n < 40) counts.push(n);
        return { title: 'Quiz rapide', sub: 'Combien de questions ?', options: [...new Set(counts)].map((c) => opt(c === n ? 'Toutes les questions (' + c + ')' : c + ' questions', '≈ ' + Math.max(1, Math.round(c * 0.6)) + ' min', false, () => this.startQuiz('quick', c))) };
      }
      case 'theme': return { title: 'Quiz par thème', sub: 'Choisis un thème', options: THEMES.filter((t) => TS[t.id].total).map((t) => opt(t.name, TS[t.id].pct + ' % maîtrisé · ' + plural(TS[t.id].total, 'question'), false, () => this.startQuiz('theme', t.id), ic(t.icon))) };
      case 'quit': return { title: 'Quitter le test ?', sub: 'Ta progression est sauvegardée sur cet appareil : tu pourras reprendre ce test plus tard, même après avoir fermé l’application.', confirm: { alt: { label: 'Sauvegarder et quitter', onClick: () => this.quitQuiz(true) }, ok: 'Abandonner le test', onOk: () => this.quitQuiz(false), cancel: 'Continuer le test' } };
      case 'replace': {
        const q = P.quiz; if (!q) return null;
        return { title: 'Un test est en cours', sub: q.title + ' · question ' + (q.idx + 1) + ' / ' + q.qs.length, options: [
          opt('Reprendre ce test', 'Là où tu t’étais arrêté', false, () => this.resumeQuiz(), ic('rotate')),
          opt('Commencer le nouveau test', 'Le test en cours sera abandonné', false, () => this.startQuiz(...this.pending, true), ic('zap')),
        ] };
      }
      case 'reset': return { title: 'Réinitialiser ma progression ?', sub: 'Les statistiques, l’historique, les erreurs, les favoris et le test en cours du profil « ' + bank.name + ' » seront effacés. Les autres préparations ne sont pas touchées. Cette action est définitive.', confirm: { ok: 'Réinitialiser', cancel: 'Annuler', onOk: () => this.resetProfile() } };
      case 'appearance': return { title: 'Apparence', options: pick('theme', [['system', 'Système', 'Suit le réglage du téléphone'], ['light', 'Clair'], ['dark', 'Sombre']]) };
      case 'text': return { title: 'Taille du texte', sub: 'S’applique aux questions et réponses.', options: pick('text', [['Petite', 'Petite'], ['Normale', 'Normale'], ['Grande', 'Grande']]) };
      case 'goal': return { title: 'Objectif quotidien', sub: 'C’est aussi la longueur d’une révision intelligente.', options: pick('goal', [[5, '5 questions', '≈ 3 min par jour'], [10, '10 questions', '≈ 6 min par jour'], [20, '20 questions', '≈ 12 min par jour'], [30, '30 questions', '≈ 18 min par jour']]) };
      case 'prep': return {
        title: this.firstRun ? 'Quelle préparation ?' : 'Type de préparation',
        sub: 'Chaque préparation est un profil séparé : ses propres questions, statistiques, historique, erreurs et favoris.',
        options: PREPS.map((b) => { const o = overview(b, s.profiles[b.id]); return opt(b.name, o.pct + ' % · ' + plural(b.questions.length, 'question') + ' · ' + plural(b.lots.length, 'lot'), b.id === s.prep, () => this.switchPrep(b.id), ic('target')); }),
      };
      case 'time': return { title: 'Heure du rappel', options: pick('time', [['08:00', '08:00', 'Le matin'], ['12:30', '12:30', 'À midi'], ['19:00', '19:00', 'En soirée'], ['21:00', '21:00', 'Avant de dormir']]) };
      case 'examLength': return { title: 'Longueur de l’examen blanc', sub: 'L’examen officiel compte 40 questions en 45 minutes.', options: pick('examLength', [[40, '40 questions', 'Conditions réelles · 45 min'], [20, '20 questions', 'Entraînement court · ' + examMinutes(20) + ' min'], [10, '10 questions', 'Démo · ' + examMinutes(10) + ' min']]) };
      case 'report': {
        const q = this.reportQ; if (!q) return null;
        const reason = s.reportReason, text = s.reportText || '';
        const send = () => {
          this.closeSheet();
          if (!navigator.onLine) return this.toast('Pas de connexion : réessaie plus tard');
          sendReport(this.reportCtx(bank, q), q, reason, text.trim().slice(0, 1000)).then(() => this.toast('Merci, signalement envoyé'), () => this.toast('Échec de l’envoi, réessaie plus tard'));
        };
        return {
          title: 'Signaler cette question', sub: 'Choisis le problème. Le signalement est envoyé anonymement à l’auteur de l’application.',
          options: REPORT_REASONS.map((r) => opt(r, null, r === reason, () => this.setState({ reportReason: r }), ic('alert'))),
          form: { value: text, placeholder: 'Précise le problème (facultatif)', onChange: (e) => this.setState({ reportText: e.target.value }), send: { label: 'Envoyer le signalement', disabled: !reason, onClick: send } },
        };
      }
      case 'installHelp': return { title: 'Installer l’application', sub: installHelp() };
    }
    return null;
  }

  vals() {
    const s = this.state, st = this.settings(), c = this.cur(), bank = this.bank(), P = this.prof();
    const O = overview(bank, P), TS = themeStats(bank, P), weak = weakThemes(bank, P);
    const qById = (id) => bank.byId.get(id);
    const pct = (t) => TS[t.id].pct, chev = ic('chevR', 20), ex = Math.min(st.examLength, O.total), exMin = examMinutes(ex);
    const withSep = (rows) => rows.map((r, i) => ({ ...r, sep: i < rows.length - 1 ? '1px solid var(--divider)' : 'none' }));
    const G = (header, rows, action) => ({ header, rows: withSep(rows), action });
    const row = (o) => { const r = { color: 'var(--text)', iconBg: 'var(--tint)', iconColor: 'var(--primary)', op: 1, cursor: o.onClick ? 'pointer' : 'default', role: o.onClick ? 'button' : undefined, tab: o.onClick ? 0 : undefined, ...o }; if (typeof o.icon === 'string') r.icon = ic(o.icon); if (o.chev) r.chev = chev; return r; };
    const tagN = (l) => ({ label: l, bg: 'var(--surface2)', color: 'var(--text2)' });
    const swRow = (on, onClick, sub) => ({ sw: { track: on ? 'var(--primary)' : 'var(--surface2)', x: on ? '20px' : '0px' }, role: 'switch', checked: on ? 'true' : 'false', tab: 0, cursor: 'pointer', onClick, sub });
    const sw = (k, sub) => swRow(!!st[k], () => this.setS(k, !st[k]), sub);
    const granted = s.notif === 'granted', canNotify = notifSupported();
    const remOn = granted && st.reminder;
    const nErr = P.errors.length, nTraps = bank.questions.filter((q) => q.trap).length;
    const themeSub = (t) => (TS[t.id].seen ? pct(t) + ' % maîtrisé · ' + TS[t.id].mastered + ' / ' + TS[t.id].total : plural(TS[t.id].total, 'question') + ' · pas encore commencé');
    const themeRow = (t) => row({ icon: t.icon, title: t.name, sub: themeSub(t), pct: pct(t) + '%', chev: true, onClick: () => this.pushTheme(t.id) });
    const qRow = (id, sub, from, chosen) => { const q = qById(id); return q && row({ tag: tagN(thById(q.t).short), title: q.q, sub, chev: true, onClick: () => this.push({ s: 'question', id, chosen, from }) }); };
    const answerSub = (q, chosen, none) => (chosen != null ? 'Ta réponse : ' + q.a[chosen] : none);
    const verdictBadge = (ok) => ({ label: ok ? 'Réussi' : 'Échoué', icon: ic(ok ? 'check' : 'x', 14, 2.5), bg: ok ? 'var(--successTint)' : 'var(--errorTint)', color: ok ? 'var(--success)' : 'var(--error)' });
    const back = { show: true, backIcon: ic('chevL', 26), backLabel: 'Retour', onBack: () => this.back() };
    let bar = { show: false }, largeTitle = null, home = null, testHero = null, progHero = null, profile = null, intro = null, fiche = null, flash = null, qv = null, res = null, chips = null, groups = [], empty = null, sticky = null, quizBar = null;
    const primary = (label, onClick, o) => Object.assign({ label, onClick, dir: 'column', op: 1 }, o || {});
    const fsQ = { Petite: '20px', Normale: '23px', Grande: '26px' }[st.text], fsA = { Petite: '15px', Normale: '16px', Grande: '18px' }[st.text];
    const buildQv = (q, states, onPick, disabled, explain, order = q.a.map((_, i) => i)) => ({
      theme: thById(q.t).short + (q.situation ? ' · Mise en situation' : ''), text: q.q, fs: fsQ, afs: fsA, explain, onReport: () => { this.reportQ = q; this.setState({ reportReason: null, reportText: '' }); this.openSheet('report'); },
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
    const favBtn = (id) => { const f = P.favs.includes(id); return { icon: ic('star', 22, 1.5, f), color: f ? 'var(--primary)' : 'var(--text2)', label: f ? 'Retirer des favoris' : 'Ajouter aux favoris', pressed: f ? 'true' : 'false', onClick: () => this.toggleFav(id) }; };
    const resumeRow = () => { const q = P.quiz; return row({ icon: 'clock', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: 'Reprendre : ' + q.title, sub: 'Question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(q.timeLeft) + ' restantes' : '') + ' · sauvegardé', chev: true, onClick: () => this.resumeQuiz() }); };
    const T = { theme: 'Thème', errors: 'Mes erreurs', favs: 'Mes favoris', traps: 'Questions pièges', dates: 'Dates à retenir', flash: 'Flashcards', question: 'Question', examIntro: 'Examen blanc', review: 'Correction des erreurs', history: 'Historique', settings: 'Paramètres', notifications: 'Notifications', about: 'À propos', lot: 'Lot de questions', result: 'Résultat' };
    if (T[c.s]) bar = { ...back, title: T[c.s] };

    switch (c.s) {
      case 'home': {
        const plan = smartPlan(bank, P, Math.max(5, st.goal)), q = P.quiz;
        const planSub = plan.dueNow && plan.freshNow ? plan.dueNow + ' à revoir · ' + plan.freshNow + (plan.freshNow > 1 ? ' nouvelles' : ' nouvelle') : plan.dueNow ? plural(plan.dueNow, 'question') + ' à revoir' : plan.freshNow ? plan.freshNow + (plan.freshNow > 1 ? ' nouvelles questions' : ' nouvelle question') : 'Tout est à jour · ' + plural(plan.size, 'question');
        const cta = q
          ? { label: 'Reprendre le test', sub: q.title + ' · question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(q.timeLeft) : ''), onClick: () => this.resumeQuiz() }
          : { label: O.seen ? 'Continuer ma révision' : 'Commencer ma préparation', sub: 'Révision intelligente : ' + planSub, onClick: () => this.startQuiz('smart', null, 'cta') };
        home = {
          prep: O.pct + ' %', prepW: O.pct + '%', prepName: bank.name, chev: ic('chevR', 16, 2), onPrep: () => this.openSheet('prep'),
          goal: 'Objectif du jour : ' + O.today + ' / ' + st.goal + ' questions' + (O.today >= st.goal ? ' ✓' : '') + (O.streak ? ' · Série : ' + plural(O.streak, 'jour') : ''),
          loading: s.loading === 'cta', ctaLabel: s.loading === 'cta' ? 'Chargement…' : cta.label, ctaSub: cta.sub, onCta: cta.onClick,
          install: !isStandalone() && (s.installable || isIOS()) && !st.installDismissed ? { icon: ic('download', 22), onInstall: () => this.install(), onDismiss: () => this.setS('installDismissed', true, false), close: ic('x', 18, 2) } : null,
          tiles: [
            { label: 'Examen blanc', sub: ex + ' questions • ' + exMin + ' min', icon: ic('clipboard'), onClick: () => this.push({ s: 'examIntro' }) },
            { label: 'Quiz rapide', sub: '5 à ' + Math.min(40, O.total) + ' questions', icon: ic('zap'), onClick: () => this.openSheet('count') },
            { label: 'Mes erreurs', sub: nErr ? nErr + ' à revoir' : 'Aucune erreur', icon: ic('rotate'), badge: nErr || null, onClick: () => this.push({ s: 'errors' }) },
            { label: 'Révision intelligente', sub: planSub, icon: ic('sparkles'), onClick: () => this.startQuiz('smart') },
          ],
        };
        if (weak.length) groups = [G('À travailler aujourd’hui', weak.map(themeRow))];
        break;
      }
      case 'revise':
        largeTitle = 'Réviser';
        groups = [G('Thèmes', THEMES.filter((t) => TS[t.id].total).map(themeRow)), G('Révision rapide', [
          row({ icon: 'rotate', title: 'Mes erreurs', value: String(nErr), chev: true, onClick: () => this.push({ s: 'errors' }) }),
          row({ icon: 'star', title: 'Mes favoris', value: String(P.favs.length), chev: true, onClick: () => this.push({ s: 'favs' }) }),
          row({ icon: 'alert', title: 'Questions pièges', value: String(nTraps), chev: true, onClick: () => this.push({ s: 'traps' }) }),
          row({ icon: 'calendar', title: 'Dates à retenir', chev: true, onClick: () => this.push({ s: 'dates' }) }),
          row({ icon: 'layers', title: 'Flashcards', chev: true, onClick: () => this.push({ s: 'flash' }) }),
        ])]; break;
      case 'test': {
        largeTitle = 'Tester';
        testHero = { sub: ex + ' questions • ' + exMin + ' min', pass: 'Seuil de réussite : ' + passMark(ex) + ' / ' + ex, onStart: () => this.push({ s: 'examIntro' }) };
        const nHard = hardPool(bank, P).length;
        if (P.quiz) groups.push(G('En cours', [resumeRow()]));
        groups.push(G('Entraînement libre', [
          row({ icon: 'zap', title: 'Quiz rapide', sub: '5 à ' + Math.min(40, O.total) + ' questions au hasard', chev: true, onClick: () => this.openSheet('count') }),
          row({ icon: 'book', title: 'Quiz par thème', sub: '5 thématiques officielles', chev: true, onClick: () => this.openSheet('theme') }),
          row({ icon: 'flame', title: 'Questions difficiles', sub: nHard ? plural(nHard, 'question') + ' · pièges et questions souvent ratées' : 'Aucune pour l’instant', chev: true, onClick: () => this.startQuiz('hard') }),
        ]));
        groups.push(G('Lots de questions', bank.lots.map((L) => {
          const runs = P.history.filter((h) => h.lot === L.id), best = bestOf(runs);
          return row({ icon: 'layers', title: L.title, sub: plural(L.qs.length, 'question') + ' · ' + (best ? 'meilleur score ' + best.score + ' / ' + best.total : 'jamais testé'), chev: true, onClick: () => this.push({ s: 'lot', id: L.id }) });
        })));
        break;
      }
      case 'lot': {
        const L = bank.lots.find((l) => l.id === c.id);
        if (!L) { empty = { icon: ic('alert', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Lot introuvable', text: 'Ce lot n’existe plus.' }; break; }
        bar.title = L.title; intro = L.description || null;
        const runs = P.history.filter((h) => h.lot === L.id), best = bestOf(runs), counts = {};
        L.qs.forEach((id) => { const t = qById(id).t; counts[t] = (counts[t] || 0) + 1; });
        const mastered = L.qs.filter((id) => isMastered(P.stats[id])).length;
        const sc = (h) => (h ? h.score + ' / ' + h.total : '–');
        groups = [
          G('Contenu · ' + plural(L.qs.length, 'question'), THEMES.filter((t) => counts[t.id]).map((t) => row({ icon: t.icon, title: t.name, value: String(counts[t.id]) }))),
          G('Tes résultats', [row({ title: 'Questions maîtrisées', stat: mastered + ' / ' + L.qs.length }), row({ title: 'Tentatives', stat: String(runs.length) }), row({ title: 'Meilleur score', stat: sc(best) }), row({ title: 'Dernier score', stat: sc(runs[0]) })]),
          G('Autres façons de s’entraîner', [
            row({ icon: 'clock', title: 'En conditions d’examen', sub: 'Chronométré · ' + examMinutes(L.qs.length) + ' min · correction à la fin', chev: true, onClick: () => this.startQuiz('lot', { id: L.id, timed: true }, 'lot') }),
            row({ icon: 'layers', title: 'Flashcards du lot', chev: true, onClick: () => this.push({ s: 'flash', lot: L.id }) }),
          ]),
        ];
        sticky = primary(s.loading === 'lot' ? 'Chargement…' : 'Lancer ce lot', () => this.startQuiz('lot', { id: L.id }, 'lot'), { loading: s.loading === 'lot', disabled: s.loading === 'lot' });
        break;
      }
      case 'progress': {
        largeTitle = 'Progression'; progHero = { label: O.pct + ' %', w: O.pct + '%', sub: 'Maîtrise · ' + bank.short };
        const best = O.best;
        groups = [
          G(null, [
            row({ title: 'Questions maîtrisées', stat: O.mastered + ' / ' + O.total }),
            row({ title: 'Questions déjà vues', stat: O.seen + ' / ' + O.total }),
            row({ title: 'Bonnes réponses', sub: O.attempts ? plural(O.attempts, 'réponse') + ' au total' : null, stat: O.accuracy != null ? O.accuracy + ' %' : '–' }),
            row({ title: 'Examens blancs réalisés', sub: O.exams ? plural(O.passed, 'réussi') : null, stat: String(O.exams) }),
            row({ title: 'Meilleur score à l’examen', stat: best ? best.score + ' / ' + best.total : '–' }),
            row({ title: 'Série de révision', stat: plural(O.streak, 'jour') }),
          ]),
          G('Progression par thème', THEMES.filter((t) => TS[t.id].total).map((t) => row({ title: t.name, sub: TS[t.id].acc != null ? TS[t.id].acc + ' % de bonnes réponses' : 'Pas encore travaillé', value: pct(t) + ' %', pct: pct(t) + '%', chev: true, onClick: () => this.pushTheme(t.id) }))),
          !O.seen
            ? G('Mes points faibles', [row({ icon: 'info', title: 'Pas encore de données', sub: 'Réponds à quelques questions : tes points faibles seront calculés à partir de tes résultats.' })])
            : weak.length
              ? G('Mes points faibles', weak.map((t) => row({ icon: 'alert', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: t.name, sub: t.pct + ' % maîtrisé' + (t.acc != null ? ' · ' + t.acc + ' % de bonnes réponses' : ' · pas encore travaillé'), chev: true, onClick: () => this.pushTheme(t.id) })), { label: s.loading === 'weak' ? 'Chargement…' : 'Travailler mes points faibles', loading: s.loading === 'weak', onClick: () => this.startQuiz('weak', null, 'weak') })
              : G('Mes points faibles', [row({ icon: 'check', iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucun point faible', sub: 'Tous les thèmes sont maîtrisés.' })]),
          G(null, [row({ icon: 'clock', title: 'Historique', sub: plural(O.exams, 'examen blanc') + ' · ' + plural(P.history.length, 'test') + ' au total', chev: true, onClick: () => this.push({ s: 'history' }) })]),
        ]; break;
      }
      case 'profile': {
        largeTitle = 'Profil'; profile = { initials: bank.initials, name: bank.name, sub: O.pct + ' % de préparation · ' + plural(O.total, 'question') };
        const rows = [
          row({ icon: 'target', title: 'Type de préparation', sub: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot'), value: bank.short, chev: true, onClick: () => this.openSheet('prep') }),
          row({ icon: 'sliders', title: 'Paramètres', chev: true, onClick: () => this.push({ s: 'settings' }) }),
          canNotify && row({ icon: 'bell', title: 'Notifications', value: remOn ? st.time : 'Désactivées', chev: true, onClick: () => this.push({ s: 'notifications' }) }),
          row({ icon: 'sun', title: 'Apparence', value: { system: 'Système', light: 'Clair', dark: 'Sombre' }[st.theme], chev: true, onClick: () => this.openSheet('appearance') }),
          row({ icon: 'info', title: 'À propos', chev: true, onClick: () => this.push({ s: 'about' }) }),
        ].filter(Boolean);
        groups = [G(null, rows)];
        if (!isStandalone()) groups.push(G(null, [row({ icon: 'download', title: 'Installer l’application', sub: 'Accès depuis l’écran d’accueil, plein écran et hors connexion', chev: true, onClick: () => this.install() })]));
        break;
      }
      case 'settings': {
        const seg = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => { const a = st.theme === v; return { label: l, checked: a ? 'true' : 'false', bg: a ? 'var(--segOn)' : 'transparent', color: a ? 'var(--text)' : 'var(--text2)', shadow: a ? '0 1px 3px rgba(0,0,0,.14)' : 'none', weight: a ? 600 : 500, onClick: (e) => { e.stopPropagation(); this.setS('theme', v); } }; });
        groups = [
          G('Préparation · ' + bank.short, [row({ title: 'Type de préparation', value: bank.short, chev: true, onClick: () => this.openSheet('prep') }), row({ title: 'Objectif quotidien', value: st.goal + ' questions', chev: true, onClick: () => this.openSheet('goal') }), row({ title: 'Révision automatique', ...sw('auto', 'Ajoute tes mauvaises réponses à « Mes erreurs »') }), row({ title: 'Longueur de l’examen blanc', value: st.examLength + ' questions', chev: true, onClick: () => this.openSheet('examLength') })]),
          canNotify && G('Notifications', [row({ title: 'Rappels', value: remOn ? 'Activés · ' + st.time : 'Désactivés', chev: true, onClick: () => this.push({ s: 'notifications' }) })]),
          G('Apparence', [row({ title: 'Thème', seg }), row({ title: 'Taille du texte', value: st.text, chev: true, onClick: () => this.openSheet('text') })]),
          G('Quiz', [row({ title: 'Afficher immédiatement la correction', ...sw('instant') }), row({ title: 'Mélanger les réponses', ...sw('shuffle') }), row({ title: 'Son', ...sw('sound') }), row({ title: 'Vibration', ...sw('vibration') })]),
          G('Données', [row({ title: 'Réinitialiser ma progression', sub: 'Profil « ' + bank.name + ' » uniquement', color: 'var(--error)', onClick: () => this.openSheet('reset') })]),
          G('À propos', [row({ title: 'Version de l’application', value: APP_VERSION }), row({ title: 'Sources officielles', chev: true, onClick: () => this.push({ s: 'about' }) }), row({ title: 'Confidentialité', chev: true, onClick: () => this.push({ s: 'about' }) })]),
        ].filter(Boolean); break;
      }
      case 'notifications': {
        if (!canNotify) { empty = { icon: ic('bell', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Notifications indisponibles', text: 'Ce navigateur ne permet pas les notifications. Sur iPhone, installe d’abord Civi sur l’écran d’accueil (iOS 16.4 ou plus).' }; break; }
        intro = s.notif === 'denied'
          ? 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis réactive les rappels ici.'
          : 'Les rappels s’affichent quand l’application est ouverte ou en arrière-plan. Sur Android, une fois l’application installée, ils peuvent aussi arriver quand elle est fermée.';
        groups = [
          G(null, [row({ title: 'Rappel quotidien', ...swRow(remOn, () => this.toggleReminder('reminder'), 'Si ton objectif du jour (' + st.goal + ' questions) n’est pas atteint') }), row({ title: 'Heure du rappel', value: st.time, chev: true, op: remOn ? 1 : 0.45, onClick: remOn ? () => this.openSheet('time') : undefined })]),
          G(null, [row({ title: 'Rappel de reprise', ...swRow(granted && st.streak, () => this.toggleReminder('streak'), 'Si tu n’as pas révisé depuis 2 jours') })]),
        ];
        if (granted) groups.push(G(null, [row({ icon: 'bell', title: 'Envoyer une notification de test', chev: true, onClick: () => { testNotification('Les rappels de Civi fonctionnent sur cet appareil.'); this.toast('Notification envoyée'); } })]));
        break;
      }
      case 'about':
        groups = [
          G(null, [row({ title: 'Version', value: APP_VERSION }), row({ title: 'Préparation', value: bank.short }), row({ title: 'Banque de questions', value: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot') })]),
          G('Sources officielles', [row({ title: 'Livret du citoyen', sub: 'Ministère de l’Intérieur' }), row({ title: 'Service-Public.fr', sub: 'Démarches et droits' }), row({ title: 'Légifrance', sub: 'Constitution et lois' })]),
          G('Confidentialité', [row({ title: 'Tes données restent sur ton téléphone', sub: 'Aucun compte requis. Aucune donnée partagée.' })]),
        ]; break;
      case 'history': {
        const exams = P.history.filter((h) => h.mode === 'exam');
        const f = c.filter || (exams.length || !P.history.length ? 'exam' : 'all');
        const list = f === 'exam' ? exams : P.history;
        chips = [['exam', 'Examens blancs (' + exams.length + ')'], ['all', 'Tous les tests (' + P.history.length + ')']].map(([id, label]) => { const a = id === f; return { key: id, label, pressed: a ? 'true' : 'false', bg: a ? 'var(--primary)' : 'var(--surface)', color: a ? 'var(--onChip)' : 'var(--text)', border: a ? 'transparent' : 'var(--line)', onClick: () => this.setTop({ filter: id }) }; });
        if (list.length) groups = [G(null, list.map((h) => row({ title: h.title, sub: fmtWhen(h.at) + (h.used != null ? ' · ' + fmt(h.used) : ''), stat: h.score + ' / ' + h.total, badge: verdictBadge(h.passed), chev: true, onClick: () => this.push({ s: 'result', hid: h.id }) })))];
        else empty = { icon: ic('clipboard', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: f === 'exam' ? 'Aucun examen blanc' : 'Aucun test terminé', text: 'Tes résultats apparaîtront ici après chaque test terminé.', btn: 'Passer un examen blanc', onBtn: () => this.push({ s: 'examIntro' }) };
        break;
      }
      case 'errors': {
        if (!nErr) { empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucune erreur à revoir', text: st.auto ? 'Continue comme ça.' : 'La révision automatique est désactivée : tes erreurs ne sont pas ajoutées ici.', btn: 'Faire un quiz', onBtn: () => this.openSheet('count') }; break; }
        const f = c.filter || 'all';
        chips = [{ id: 'all', label: 'Toutes' }].concat(THEMES.map((t) => ({ id: t.id, label: t.short }))).map((ch) => { const a = ch.id === f; return { key: ch.id, label: ch.label, pressed: a ? 'true' : 'false', bg: a ? 'var(--primary)' : 'var(--surface)', color: a ? 'var(--onChip)' : 'var(--text)', border: a ? 'transparent' : 'var(--line)', onClick: () => this.setTop({ filter: ch.id }) }; });
        const list = P.errors.filter((e) => f === 'all' || qById(e.id).t === f);
        if (list.length) groups = [G(null, list.map((e) => qRow(e.id, answerSub(qById(e.id), e.chosen, 'Marquée « À revoir »'), 'errors', e.chosen)))];
        else empty = { icon: ic('check', 32, 2), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Rien dans ce thème', text: 'Choisis un autre filtre.' };
        sticky = primary('Revoir en quiz (' + nErr + ')', () => this.startQuiz('errors')); break;
      }
      case 'favs':
        if (P.favs.length) groups = [G(null, P.favs.map((id) => qRow(id, null, 'favs')).filter(Boolean))];
        else empty = { icon: ic('star', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune question favorite', text: 'Ajoute une question avec l’icône étoile pendant tes révisions.' };
        break;
      case 'traps': {
        const traps = bank.questions.filter((q) => q.trap);
        intro = 'Les questions où les candidats se trompent le plus souvent.';
        if (traps.length) groups = [G(null, traps.map((q) => qRow(q.id, null, 'traps')))];
        else { intro = null; empty = { icon: ic('alert', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune question piège', text: 'Aucune question de cette préparation n’est marquée comme piège.' }; }
        break;
      }
      case 'dates':
        if (bank.dates.length) groups = [G(null, bank.dates.map(([y, t]) => row({ year: y, title: t })))];
        else empty = { icon: ic('calendar', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune date', text: 'Aucune date à retenir pour cette préparation.' };
        break;
      case 'review': {
        const H = P.history.find((h) => h.id === c.hid), list = H ? H.wrong.filter((w) => qById(w.id)) : [];
        if (list.length) groups = [G(null, list.map((w) => qRow(w.id, answerSub(qById(w.id), w.chosen, 'Sans réponse'), 'review', w.chosen)))];
        else empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucune erreur', text: 'Tu as tout bon.' };
        break;
      }
      case 'examIntro':
        intro = 'Mets-toi dans les conditions de l’examen officiel. La correction s’affiche à la fin.';
        groups = [G('Déroulement', [
          row({ icon: 'clipboard', title: ex + ' questions à choix multiples', sub: 'Réparties selon les 5 thèmes officiels' }),
          row({ icon: 'clock', title: exMin + ' minutes chronométrées' }),
          row({ icon: 'target', title: passMark(ex) + ' bonnes réponses pour réussir' }),
          row({ icon: 'download', title: 'Progression sauvegardée', sub: 'Tu peux quitter et reprendre plus tard, même après avoir fermé l’application' }),
          st.auto && row({ icon: 'rotate', title: 'Tes erreurs sont ajoutées à ta liste de révision' }),
        ].filter(Boolean))];
        if (P.quiz) groups.push(G('En cours', [resumeRow()]));
        sticky = primary(s.loading === 'exam' ? 'Chargement…' : 'Commencer l’examen', () => this.startQuiz('exam', null, 'exam'), { loading: s.loading === 'exam', disabled: s.loading === 'exam' }); break;
      case 'theme': {
        const t = thById(c.id); bar.title = t.short; const ts = TS[t.id];
        fiche = { loading: s.skeleton, ready: !s.skeleton, icon: ic(t.icon, 26), name: t.name, pct: pct(t) + '%', pctLabel: pct(t) + ' %', sub: 'Maîtrise · ' + ts.mastered + ' / ' + plural(ts.total, 'question') + (ts.acc != null ? ' · ' + ts.acc + ' % de réussite' : ''), facts: withSep(bank.facts[t.id].map((x, i) => ({ n: i + 1, text: x }))) };
        if (!s.skeleton) groups = [G('S’entraîner', [row({ icon: 'layers', title: 'Flashcards du thème', chev: true, onClick: () => this.push({ s: 'flash', theme: t.id }) }), row({ icon: 'alert', title: 'Questions pièges', chev: true, onClick: () => this.push({ s: 'traps' }) })])];
        sticky = primary(s.loading === 'theme' ? 'Chargement…' : 'Tester mes connaissances', () => this.startQuiz('theme', t.id, 'theme'), { loading: s.loading === 'theme', disabled: s.loading === 'theme' || s.skeleton || !ts.total, op: s.skeleton || !ts.total ? 0.45 : 1 }); break;
      }
      case 'flash': {
        const L = c.lot && bank.lots.find((l) => l.id === c.lot);
        const cards = c.theme ? bank.questions.filter((q) => q.t === c.theme) : L ? L.qs.map(qById) : bank.questions;
        if (c.theme) bar.title = 'Flashcards · ' + thById(c.theme).short;
        if (L) bar.title = 'Flashcards · ' + L.title;
        if (!cards.length) { empty = { icon: ic('layers', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune carte', text: 'Aucune question disponible ici.' }; break; }
        const i = s.fc % cards.length; const q = cards[i];
        flash = {
          theme: thById(q.t).short, counter: (i + 1) + ' / ' + cards.length, kicker: s.flip ? 'Réponse' : 'Question', kColor: s.flip ? 'var(--success)' : 'var(--primaryText)', text: s.flip ? q.a[q.c] : q.q, detail: s.flip ? q.x : null, hint: s.flip ? 'Touche pour revoir la question' : 'Touche pour voir la réponse', flipIcon: ic('rotate', 16),
          onFlip: () => { const el = this.cardRef.current; if (el && el.animate) el.animate([{ transform: 'scaleX(.96)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }); this.setState({ flip: !s.flip }); },
        };
        // Self-assessment counts as an answer: it feeds mastery, spaced repetition and the daily goal.
        const next = (ok) => {
          this.updP((p) => { const r = recordAnswer(p, q.id, ok); return ok || r.errors.some((e) => e.id === q.id) ? r : { ...r, errors: r.errors.concat([{ id: q.id, chosen: null }]) }; });
          this.setState({ fc: s.fc + 1, flip: false });
        };
        sticky = primary('Je savais', () => next(true), { dir: 'row', icon: ic('check', 20, 2), secondary: { label: 'À revoir', icon: ic('x', 20, 2), onClick: () => next(false), order: 0, h: '54px', border: '1.5px solid var(--line)', color: 'var(--text)' } }); break;
      }
      case 'question': {
        const q = qById(c.id); if (!q) break; bar.star = favBtn(q.id);
        const states = q.a.map((_, i) => (i === q.c ? 'correct' : i === c.chosen ? 'wrong' : 'dim'));
        qv = buildQv(q, states, () => {}, true, { text: q.x, bulb: ic('bulb', 16) });
        if (c.from === 'errors' && P.errors.some((e) => e.id === q.id)) sticky = primary('J’ai compris', () => { this.updP((p) => ({ ...p, errors: p.errors.filter((e) => e.id !== q.id) })); this.toast('Retiré de mes erreurs'); this.back(); }, { icon: ic('check', 20, 2) });
        break;
      }
      case 'quiz': {
        const z = P.quiz; if (!z) break; const id = z.qs[z.idx]; const q = qById(id); if (!q) break; const n = z.qs.length; const last = z.idx + 1 >= n;
        bar = { ...back, title: 'Question ' + (z.idx + 1) + ' / ' + n, backLabel: 'Quitter le test', star: favBtn(q.id) };
        quizBar = { pct: ((z.idx + (z.validated ? 1 : 0)) / n) * 100 + '%', mode: z.title, timer: z.timed ? fmt(z.timeLeft) : null, timerColor: z.timeLeft < 300 ? 'var(--warn)' : 'var(--text)', clock: ic('clock', 16, 2) };
        const ans = z.validated ? z.answers[z.answers.length - 1] : null;
        const states = q.a.map((_, i) => (z.validated ? (i === q.c ? 'correct' : i === ans.chosen ? 'wrong' : 'dim') : z.sel === i ? 'selected' : 'normal'));
        const explain = z.validated ? { text: q.x, bulb: ic('bulb', 16), verdict: ans.ok ? 'Bonne réponse' : 'Mauvaise réponse', vColor: ans.ok ? 'var(--success)' : 'var(--error)', vIcon: ic(ans.ok ? 'check' : 'x', 20, 2.5) } : null;
        qv = buildQv(q, states, (i) => this.select(i), z.validated, explain, z.orders[id]);
        const label = z.validated ? (last ? 'Voir le résultat' : 'Question suivante') : z.instant ? 'Valider' : last ? 'Terminer le test' : 'Valider et continuer';
        sticky = primary(label, () => this.primaryQuiz(), { disabled: !z.validated && z.sel == null, op: !z.validated && z.sel == null ? 0.45 : 1 }); break;
      }
      case 'result': {
        const L = P.history.find((h) => h.id === c.hid); if (!L) break; const need = passMark(L.total);
        if (c.fresh) bar = { show: true, title: 'Résultat', backIcon: ic('x', 24), backLabel: 'Fermer', onBack: () => this.back() };
        const missing = L.total - L.answered;
        res = {
          title: L.title + (c.fresh ? '' : ' · ' + fmtWhen(L.at)), score: L.score, total: L.total, verdict: L.passed ? 'Réussi' : 'Pas encore', vIcon: ic(L.passed ? 'check' : 'x', 16, 2.5), vBg: L.passed ? 'var(--successTint)' : 'var(--errorTint)', vColor: L.passed ? 'var(--success)' : 'var(--error)',
          msg: (L.passed ? 'Bravo, tu atteins le seuil de réussite.' : 'Il faut ' + need + ' bonnes réponses sur ' + L.total + ' pour réussir.') + (missing ? ' ' + plural(missing, 'question') + ' sans réponse.' : ''),
          stats: [{ v: L.score, l: 'Bonnes réponses' }, { v: L.total - L.score, l: 'Erreurs' }, { v: L.used != null ? fmt(L.used) : Math.round((L.score / L.total) * 100) + ' %', l: L.used != null ? 'Temps' : 'Réussite' }].map((x, i) => ({ ...x, sep: i ? '1px solid var(--divider)' : 'none' })),
        };
        groups = [G('Par thème', THEMES.filter((t) => L.themes[t.id]).map((t) => { const [ok, n] = L.themes[t.id]; return row({ title: t.name, value: ok + ' / ' + n, pct: Math.round((ok / n) * 100) + '%' }); }))];
        const nw = L.wrong.length;
        const review = () => this.push({ s: 'review', hid: L.id });
        if (c.fresh) {
          const home2 = { label: 'Retour à l’accueil', onClick: () => this.goHome(), order: 2, h: '46px', border: 'none', color: 'var(--primaryText)' };
          sticky = nw ? primary('Revoir mes erreurs (' + nw + ')', review, { secondary: home2 }) : primary('Terminer', () => this.back(), { secondary: home2 });
        } else if (nw) sticky = primary('Revoir mes erreurs (' + nw + ')', review);
        break;
      }
    }
    const showNav = !(c.s === 'quiz' || (c.s === 'result' && c.fresh));
    const sd = s.sheet ? this.sheetData() : null;
    const sheet = sd ? { ...sd, scrimOp: s.closing ? 0 : 1, transform: s.closing ? 'translateY(100%)' : 'translateY(' + s.drag + 'px)', transition: s.dragging ? 'none' : 'transform .22s cubic-bezier(.2,.8,.2,1)' } : null;
    const tabs = TABS.map(([id, label, icn]) => { const a = s.tab === id; return { id, label, icon: ic(icn, 22, a ? 2 : 1.5), color: a ? 'var(--primaryText)' : 'var(--text2)', pill: a ? 'var(--tint)' : 'transparent', weight: a ? 600 : 500, current: a ? 'page' : undefined, onClick: () => this.switchTab(id) }; });
    const toastPx = (showNav ? 72 : 0) + (sticky ? (sticky.secondary && sticky.dir === 'column' ? 140 : 86) : 0) + 24;
    const toast = s.toast ? { m: s.toast.m, icon: ic(s.toast.icon, 18, 2.5), bottom: 'calc(' + toastPx + 'px + var(--safe-bottom))' } : null;
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
          <button className="p-chip" onClick={h.onPrep} aria-label={'Préparation : ' + h.prepName + '. Changer'} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, margin: 0, padding: '2px 8px 2px 10px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{h.prepName}<span style={{ transform: 'rotate(90deg)', display: 'grid' }}>{h.chev}</span></button>
        </div>
      </div>
      {h.install && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px 12px 14px' }}>
            <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{h.install.icon}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 16, fontWeight: 600 }}>Installer Civi</span><span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.3 }}>Sur l’écran d’accueil, plein écran et hors connexion</span></span>
            <button className="p-btn" onClick={h.install.onInstall} style={{ ...btnPrimary, flex: 'none', height: 38, padding: '0 14px', fontSize: 15 }}>Installer</button>
            <button className="p-bg2" onClick={h.install.onDismiss} aria-label="Masquer" style={{ ...iconBtn, width: 36, height: 36, color: 'var(--text2)' }}>{h.install.close}</button>
          </div>
        </div>
      )}
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ font: '600 64px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{p.label}</span><span style={{ fontSize: 16, color: 'var(--text2)' }}>{p.sub}</span></div>
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
          {f.facts.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={h2s}>L'essentiel</h2>
            <div style={card}>
              {f.facts.map((x) => (
                <div key={x.n} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: x.sep }}><span style={{ flex: 'none', width: 16, font: '600 20px/1.3 var(--font-heading)', color: 'var(--primaryText)' }}>{x.n}</span><span style={{ fontSize: 16, lineHeight: 1.45, textWrap: 'pretty' }}>{x.text}</span></div>
              ))}
            </div>
          </div>}
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
      <button onClick={qv.onReport} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', border: 'none', background: 'none', font: 'inherit', fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{ic('alert', 16)}Signaler une erreur dans cette question</button>
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
        {sheet.form && (
          <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea value={sheet.form.value} onChange={sheet.form.onChange} placeholder={sheet.form.placeholder} maxLength={1000} rows={3} aria-label={sheet.form.placeholder} style={{ resize: 'none', padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', font: '400 16px/1.4 var(--font-body)' }} />
            <button className="p-btn" onClick={sheet.form.send.onClick} disabled={sheet.form.send.disabled} style={{ ...btnPrimary, height: 54, opacity: sheet.form.send.disabled ? 0.45 : 1, cursor: sheet.form.send.disabled ? 'default' : 'pointer' }}>{sheet.form.send.label}</button>
          </div>
        )}
        {sheet.confirm && (
          <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sheet.confirm.alt && <button className="p-btn" onClick={sheet.confirm.alt.onClick} style={{ ...btnPrimary, height: 54 }}>{sheet.confirm.alt.label}</button>}
            <button className="p-danger" onClick={sheet.confirm.onOk} style={{ height: 54, border: 'none', borderRadius: 10, background: 'var(--errorFill)', color: '#fff', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.ok}</button>
            <button className="p-cancel" onClick={onClose} style={{ height: 52, border: 'none', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.cancel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
