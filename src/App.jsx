import { Component, createRef } from 'react';
import { ic } from './Icon.jsx';
import { THEMES, LET, MODE_T, TABS, PAL, APP_VERSION, thById, shuffle, fmt } from './constants.js';
import { plural, fmtWhen, bestOf, examMinutes } from './utils.js';
import { EMPTY_PROPOSAL, sendProposal, sendReport, checkImage, rateLimited, noteSent } from './feedback.js';
import { setUpdateGuard, applyUpdate } from './update.js';
import { TopBar, QuizBar, Sticky, Nav, Sheet } from './components/Chrome.jsx';
import { Home, TestHero, ProgHero, Profile } from './components/Dashboard.jsx';
import { Fiche, Flash, QuestionView, Result } from './components/Study.jsx';
import { Chips, Group, Empty } from './components/Lists.jsx';
import { ProposeForm } from './components/ProposeForm.jsx';
import { sheetData } from './sheets.js';
import { SYMBOLS, RULES, EXAMPLES, CENTURIES, toRoman, romanOrdinal, centuryYears } from './roman.js';
import { captureScreen } from './screenshot.js';
import { PREPS, prepById, hasPrep } from './bank.js';
import {
  emptyProfile, recordAnswer, updateErrors, secondsLeft, isMastered, themeStats, overview, weakThemes, pickSmart, smartPlan, pickWeak, hardPool, pickExam,
  pickPool, examPool, resultEntry, answersPrint, passMark, dayKey, lastActiveDay,
} from './stats.js';
import { loadSettings, saveSettings, loadProfile, saveProfile, saveQuiz, persistStorage, exportData, importData } from './storage.js';
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall } from './install.js';
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
// Longest quiz for « Quiz par thème » and « Questions difficiles » (the least mastered questions first).
const MAX_POOL_QUIZ = 20;
const TEXT_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;
const SOURCES = [
  ['Ministère de l’Intérieur', 'Livret du citoyen et formation civique', 'https://www.interieur.gouv.fr'],
  ['Service-Public.fr', 'Démarches et droits', 'https://www.service-public.fr'],
  ['Légifrance', 'Constitution du 4 octobre 1958', 'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006071194'],
];
const PRIVACY = [
  ['Tes données restent sur cet appareil', 'Progression, statistiques et réglages sont enregistrés dans ce navigateur. Aucun compte, aucune publicité, aucune mesure d’audience.'],
  ['Signalements et propositions', 'Envoyés seulement si tu le décides, sans compte : ton message, la question concernée, la version de l’application, le navigateur et la taille de l’écran. Ils sont transmis par e-mail via Web3Forms ; les images (capture ou photo) sont hébergées par Cloudinary.'],
  ['Conservation et suppression', 'Les envois sont gardés le temps de traiter la demande. Pour en faire supprimer un, utilise « Signaler un bug » en le précisant.'],
  ['Sauvegarde', 'Exporte ta progression depuis Paramètres → Données pour la conserver ou la transférer sur un autre appareil.'],
];

// Drops references to questions that no longer exist in the bank (lot files edited or removed).
function cleanProfile(bank, p) {
  const has = (id) => bank.byId.has(id);
  let quiz = p.quiz;
  if (quiz && !quiz.qs.every(has)) quiz = null;
  // Tests saved by older versions paused their timer while closed: give them a deadline from the time they had left.
  if (quiz && quiz.timed && !quiz.abs) quiz = { ...quiz, abs: true, endsAt: Date.now() + quiz.timeLeft * 1000 };
  // Answers of a question edited since the test was saved: positions (selection, shuffled order) are reset.
  const fp = quiz && answersPrint(bank, quiz.qs);
  if (quiz && quiz.fp !== fp) {
    const orders = {};
    quiz.qs.forEach((id) => { const o = quiz.orders[id], n = bank.byId.get(id).a.length; if (Array.isArray(o) && o.length === n && [...o].sort().every((v, i) => v === i)) orders[id] = o; });
    quiz = { ...quiz, fp, sel: null, orders, answers: quiz.answers.map((a) => ({ ...a, chosen: null })) };
  }
  return expireQuiz(bank, { ...p, errors: p.errors.filter((e) => has(e.id)), favs: p.favs.filter(has), quiz });
}

// A saved timed test whose deadline passed (app closed or test left) is finished and added to the history.
function expireQuiz(bank, p, now = Date.now()) {
  const q = p.quiz;
  if (!q || !q.timed || q.open || secondsLeft(q, now) > 0) return p;
  return { ...p, quiz: null, history: [resultEntry(bank, q, now)].concat(p.history).slice(0, 200) };
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
    // The preparation picker is only shown at first launch when there is a choice to make.
    this.firstRun = (!saved || !hasPrep(saved.prep)) && PREPS.length > 1;
    const { prep: savedPrep, ...device } = saved || {};
    const prep = hasPrep(savedPrep) ? savedPrep : (hasPrep(DEFAULT_PREP) ? DEFAULT_PREP : PREPS[0].id);
    const profiles = {};
    PREPS.forEach((b) => {
      const loaded = loadProfile(b.id), p = cleanProfile(b, loaded);
      profiles[b.id] = p;
      if (p.history !== loaded.history) { saveProfile(b.id, p); saveQuiz(b.id, p.quiz); }
    });
    // A quiz that was on screen when the page was closed or reloaded is reopened where it was.
    const stacks = EMPTY_STACKS();
    let tab = 'home';
    const q = profiles[prep].quiz;
    if (q && q.open) {
      tab = stacks[q.tab] ? q.tab : 'test';
      stacks[tab] = [{ s: 'quiz' }];
    }
    this.state = {
      tab, stacks, dir: 'tab', prep, profiles, device: { ...DEVICE_DEFAULTS, ...device }, clock: 0,
      sheet: null, closing: false, drag: 0, dragging: false, toast: null, flip: false, fc: 0,
      systemDark: darkQuery ? darkQuery.matches : false, installable: canInstall(), notif: notifPermission(),
    };
    this.applyChrome();
  }

  componentDidMount() {
    this.sig = this.sigOf();
    persistStorage();
    // A new version of the app is only installed (page reload) on the main screen of a tab, with no sheet open:
    // never during a test, a form, a result just displayed, flashcards or a correction being read.
    setUpdateGuard(() => !!this.state.sheet || this.state.stacks[this.state.tab].length > 0);
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
    // Escape goes back, except while typing (it would close the form and lose the text).
    this.onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (TEXT_TAGS.test(e.target?.tagName || '') && e.target.value) return e.target.blur();
      e.preventDefault(); this.back();
    };
    window.addEventListener('keydown', this.onKey);
    this.onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      this.setState({ notif: notifPermission() });
      this.expireSaved();
      this.tick();
      checkReminders();
      applyUpdate();
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
    this.remTimer = setInterval(() => { checkReminders(); this.expireSaved(); }, 60 * 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer); clearInterval(this.remTimer); clearTimeout(this.tt); clearTimeout(this.cs); clearTimeout(this.rs);
    setUpdateGuard(null);
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
    if (ps.sheet !== s.sheet || ps.stacks !== s.stacks) applyUpdate();
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
  expireSaved() {
    const P = this.prof(), q = P.quiz;
    if (!q || !q.timed || q.open || secondsLeft(q) > 0) return;
    const bank = this.bank();
    this.updP((p) => expireQuiz(bank, p));
    this.toast('Temps écoulé : « ' + q.title + ' » est terminé', 3500, 'clock');
  }
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
    if (c.s === 'propose' && this.state.pf) { if (this.state.pf.preview) URL.revokeObjectURL(this.state.pf.preview); this.setState({ pf: null }); }
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
  pushTheme(id) { this.push({ s: 'theme', id }); }
  // Flashcards are shown in a random order; the order is kept on the screen entry so it survives re-renders.
  pushFlash(o) {
    const bank = this.bank(), L = o.lot && bank.lots.find((l) => l.id === o.lot);
    const ids = o.theme ? bank.questions.filter((q) => q.t === o.theme).map((q) => q.id) : L ? L.qs : bank.questions.map((q) => q.id);
    this.push({ s: 'flash', ...o, order: shuffle(ids) });
  }

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
    if (mode === 'theme') { qs = pickPool(bank.questions.filter((q) => q.t === arg), P, MAX_POOL_QUIZ); title = 'Quiz · ' + thById(arg).short; }
    if (mode === 'hard') qs = pickPool(hardPool(bank, P), P, MAX_POOL_QUIZ);
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
      timed, limit, timeLeft: limit, endsAt: timed ? Date.now() + limit * 1000 : 0, abs: true, fp: answersPrint(bank, qs), startedAt: Date.now(), open: true, tab: this.state.tab,
    };
  }
  startQuiz(mode, arg, force) {
    if (this.prof().quiz && !force) { this.pending = [mode, arg]; return this.openSheet('replace'); }
    if (this.state.sheet) this.closeSheet();
    const q = this.buildQuiz(mode, arg);
    if (!q) return this.toast(EMPTY_MSG[mode] || 'Aucune question disponible');
    this.setQuiz(q); this.push({ s: 'quiz' }); this.startTimer(q);
  }
  resumeQuiz() {
    const q = this.prof().quiz; if (!q) return;
    if (this.state.sheet) this.closeSheet();
    const nq = { ...q, open: true, tab: this.state.tab };
    this.setQuiz(nq); this.push({ s: 'quiz' }); this.startTimer(nq);
  }
  startTimer(q) {
    clearInterval(this.timer);
    if (!q.timed) return;
    this.timer = setInterval(() => this.tick(), 1000);
    setTimeout(() => this.tick(), 0); // a deadline that passed while the app was closed ends the test right away
  }
  // The deadline is absolute, like in the real exam: the time keeps running when the test is left or the app closed.
  // Only the display is refreshed every second; the saved test does not change (no storage write per second).
  tick() {
    const q = this.prof().quiz; if (!q || !q.timed || !q.open) return clearInterval(this.timer);
    const left = secondsLeft(q);
    if (left <= 0) return this.finish(q);
    if (left !== this.state.clock) this.setState({ clock: left });
  }
  select(i) { const q = this.prof().quiz; if (!q || q.validated) return; this.setQuiz({ ...q, sel: i }); }
  primaryQuiz() {
    const q = this.prof().quiz; if (!q) return; if (q.validated) return this.nextQ(); if (q.sel == null) return;
    const id = q.qs[q.idx], Q = this.bank().byId.get(id), ok = Q.c === q.sel, pick = Q.a[q.sel] ?? null;
    const answers = q.answers.concat([{ id, chosen: q.sel, pick, ok }]);
    this.feedback(ok, q.instant);
    // Stats and « Mes erreurs » are updated at each answer, so nothing is lost if the test is abandoned.
    const opts = { auto: this.settings().auto, errorsMode: q.mode === 'errors' };
    const rec = (p) => updateErrors(recordAnswer(p, id, ok), id, ok, pick, opts);
    if (q.instant) return this.updP((p) => ({ ...rec(p), quiz: { ...q, answers, validated: true } }));
    const nq = { ...q, answers };
    if (q.idx + 1 >= q.qs.length) { this.updP(rec); this.finish(nq); }
    else this.updP((p) => ({ ...rec(p), quiz: { ...nq, idx: q.idx + 1, sel: null } }));
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
    const entry = resultEntry(this.bank(), q);
    this.updP((p) => ({ ...p, quiz: null, history: [entry].concat(p.history).slice(0, 200) }));
    this.replaceTop({ s: 'result', hid: entry.id, fresh: true });
  }
  quitQuiz(keep) {
    clearInterval(this.timer); this.closeSheet();
    const q = this.prof().quiz;
    this.setQuiz(keep && q ? { ...q, open: false } : null);
    const { tab, stacks } = this.state; const st = stacks[tab].slice(); st.pop(); const top = st[st.length - 1];
    this.pendingY = top ? (top.y || 0) : (this.rootY[tab] || 0);
    this.setState({ stacks: { ...stacks, [tab]: st }, dir: 'pop' });
    this.toast(keep ? (q?.timed ? 'Test sauvegardé : le chrono continue' : 'Test sauvegardé : tu peux le reprendre') : 'Test abandonné');
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
    // Other tabs may show results or questions of the erased history: they go back to their root screen.
    this.setState((s) => ({ stacks: { ...EMPTY_STACKS(), [s.tab]: s.stacks[s.tab] } }));
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
    const c = this.cur(), z = this.prof().quiz, ctx = { prep: bank.name, where: 'question', mode: null, chosen: null, shown: null, revealed: true };
    if (c.s === 'quiz' && z && z.qs[z.idx] === q.id) {
      const ans = z.validated ? z.answers[z.answers.length - 1] : null, chosen = ans ? ans.chosen : z.sel ?? null;
      // With shuffled answers, the letter on screen differs from the letter in the file.
      const order = z.orders[q.id], pos = order && chosen != null ? order.indexOf(chosen) : -1;
      return { ...ctx, where: 'test', mode: z.title, chosen, shown: pos >= 0 ? LET[pos] : null, revealed: !!(z.validated && z.instant) };
    }
    const i = c.pick != null ? q.a.indexOf(c.pick) : -1;
    return { ...ctx, where: c.from ? 'question (' + c.from + ')' : 'question', chosen: i >= 0 ? i : null };
  }

  // A question report attaches a screenshot of the current screen, taken before the sheet covers it.
  // It can be removed before sending (« Retirer »).
  async openReport(q) {
    if (this.reportBusy) return;
    this.reportBusy = true; this.reportQ = q; if (this.state.reportImg) URL.revokeObjectURL(this.state.reportImg.preview);
    let reportImg = null;
    if (q) {
      this.toast('Capture de l’écran…', 3500, 'info');
      const blob = await Promise.race([captureScreen().catch(() => null), new Promise((r) => setTimeout(() => r(null), 3000))]);
      if (blob) reportImg = { file: blob, preview: URL.createObjectURL(blob), auto: true };
      clearTimeout(this.tt); this.setState({ toast: null });
    }
    this.reportBusy = false;
    this.setState({ reportReason: null, reportText: '', reportImg, reportSending: false }); this.openSheet('report');
  }
  // The sheet stays open while sending, so the text is not lost if it fails.
  sendReport(ctx, q) {
    const s = this.state; if (s.reportSending) return;
    const bad = rateLimited(); if (bad) return this.toast(bad, 3200, 'x');
    if (!navigator.onLine) return this.toast('Pas de connexion : réessaie plus tard', 2600, 'x');
    this.setState({ reportSending: true });
    sendReport(ctx, q, s.reportReason, (s.reportText || '').trim().slice(0, 1000), s.reportImg?.file).then(() => {
      noteSent(); this.setState({ reportSending: false }); this.closeSheet(); this.toast('Merci, signalement envoyé');
    }, () => { this.setState({ reportSending: false }); this.toast('Échec de l’envoi, réessaie plus tard', 3200, 'x'); });
  }
  pickBackup() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files && input.files[0]; if (!f) return;
      importData(f).then(() => location.reload(), (e) => this.toast(e.message || 'Import impossible', 3200, 'x'));
    };
    input.click();
  }
  pickReportImage(file) {
    const old = this.state.reportImg; if (old) URL.revokeObjectURL(old.preview);
    if (!file) return this.setState({ reportImg: null });
    const bad = checkImage(file); if (bad) return this.toast(bad);
    this.setState({ reportImg: { file, preview: URL.createObjectURL(file) } });
  }
  openPropose() { this.setState({ pf: { ...EMPTY_PROPOSAL(), prep: this.state.prep } }); this.push({ s: 'propose' }); }
  setPf(patch) { this.setState((s) => ({ pf: { ...s.pf, ...patch } })); }
  pickImage(file) {
    const old = this.state.pf.preview; if (old) URL.revokeObjectURL(old);
    if (!file) return this.setPf({ img: null, preview: null });
    const bad = checkImage(file); if (bad) return this.toast(bad);
    this.setPf({ img: file, preview: URL.createObjectURL(file) });
  }
  submitPropose() {
    const p = this.state.pf; if (!p || p.sending) return;
    const bad = rateLimited(); if (bad) return this.toast(bad, 3200, 'x');
    if (!navigator.onLine) return this.toast('Pas de connexion : réessaie plus tard');
    this.setPf({ sending: true });
    sendProposal(p, prepById(p.prep).name).then(() => {
      noteSent();
      if (p.preview) URL.revokeObjectURL(p.preview);
      this.toast('Merci, proposition envoyée'); this.setState({ pf: null }); this.back();
    }, () => { this.setPf({ sending: false }); this.toast('Échec de l’envoi, réessaie plus tard'); });
  }

  sheetData() { return sheetData(this); }

  // The statistics only change when the answers do: they are not recomputed on each render
  // (the exam timer and sheet drags re-render several times per second). Time-dependent values are refreshed every minute.
  memo(key, deps, fn) {
    const m = this.memos || (this.memos = {}), e = m[key];
    if (e && e.deps.length === deps.length && e.deps.every((d, i) => d === deps[i])) return e.v;
    const v = fn(); m[key] = { deps, v }; return v;
  }
  minute() { return Math.floor(Date.now() / 60000); }
  themeStatsOf(bank, P) { return this.memo('ts:' + bank.id, [bank, P.stats], () => themeStats(bank, P)); }
  overviewOf(bank, P) { return this.memo('ov:' + bank.id, [bank, P.stats, P.history, P.days, this.minute()], () => overview(bank, P)); }

  vals() {
    const s = this.state, st = this.settings(), c = this.cur(), bank = this.bank(), P = this.prof();
    const O = this.overviewOf(bank, P), TS = this.themeStatsOf(bank, P), weak = this.memo('weak', [bank, P.stats], () => weakThemes(bank, P));
    const qById = (id) => bank.byId.get(id);
    const pct = (t) => TS[t.id].pct, chev = ic('chevR', 20), ex = Math.min(st.examLength, this.memo('examPool', [bank], () => examPool(bank).length)), exMin = examMinutes(ex);
    const withSep = (rows) => rows.map((r, i) => ({ ...r, sep: i < rows.length - 1 ? '1px solid var(--divider)' : 'none' }));
    const G = (header, rows, action) => ({ header, rows: withSep(rows), action });
    const row = (o) => { const r = { color: 'var(--text)', iconBg: 'var(--tint)', iconColor: 'var(--primary)', op: 1, cursor: o.onClick ? 'pointer' : 'default', role: o.onClick ? 'button' : undefined, tab: o.onClick ? 0 : undefined, ...o }; if (typeof o.icon === 'string') r.icon = ic(o.icon); if (o.chev) r.chev = chev; return r; };
    const tagN = (l) => ({ label: l, bg: 'var(--surface2)', color: 'var(--text2)' });
    const swRow = (on, onClick, sub) => ({ sw: { track: on ? 'var(--primary)' : 'var(--surface2)', x: on ? '20px' : '0px' }, role: 'switch', checked: on ? 'true' : 'false', tab: 0, cursor: 'pointer', onClick, sub });
    const sw = (k, sub) => swRow(!!st[k], () => this.setS(k, !st[k], false), sub);
    const granted = s.notif === 'granted', canNotify = notifSupported();
    const remOn = granted && st.reminder;
    const nErr = P.errors.length, nTraps = this.memo('traps', [bank], () => bank.questions.filter((q) => q.trap).length);
    const themeSub = (t) => (TS[t.id].seen ? pct(t) + ' % maîtrisé · ' + TS[t.id].mastered + ' / ' + TS[t.id].total : plural(TS[t.id].total, 'question') + ' · pas encore commencé');
    const themeRow = (t) => row({ icon: t.icon, title: t.name, sub: themeSub(t), pct: pct(t) + '%', chev: true, onClick: () => this.pushTheme(t.id) });
    const qRow = (id, sub, from, pick) => { const q = qById(id); return q && row({ tag: tagN(thById(q.t).short), title: q.q, sub, chev: true, onClick: () => this.push({ s: 'question', id, pick, from }) }); };
    const answerSub = (pick, none) => (pick != null ? 'Ta réponse : ' + pick : none);
    const verdictBadge = (ok) => ({ label: ok ? 'Réussi' : 'Échoué', icon: ic(ok ? 'check' : 'x', 14, 2.5), bg: ok ? 'var(--successTint)' : 'var(--errorTint)', color: ok ? 'var(--success)' : 'var(--error)' });
    const back = { show: true, backIcon: ic('chevL', 26), backLabel: 'Retour', onBack: () => this.back() };
    let propose = null, bar = { show: false }, largeTitle = null, home = null, testHero = null, progHero = null, profile = null, intro = null, fiche = null, flash = null, qv = null, res = null, chips = null, groups = [], empty = null, sticky = null, quizBar = null;
    const primary = (label, onClick, o) => Object.assign({ label, onClick, dir: 'column', op: 1 }, o || {});
    const fsQ = { Petite: '20px', Normale: '23px', Grande: '26px' }[st.text], fsA = { Petite: '15px', Normale: '16px', Grande: '18px' }[st.text];
    const buildQv = (q, states, onPick, disabled, explain, order = q.a.map((_, i) => i)) => ({
      theme: thById(q.t).short + (q.situation ? ' · Mise en situation' : ''), text: q.q, fs: fsQ, afs: fsA, explain, onReport: () => this.openReport(q),
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
    const resumeRow = () => { const q = P.quiz; return row({ icon: 'clock', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: 'Reprendre : ' + q.title, sub: 'Question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(secondsLeft(q)) + ' restantes' : '') + ' · sauvegardé', chev: true, onClick: () => this.resumeQuiz() }); };
    const T = { propose: 'Proposer une question', theme: 'Thème', errors: 'Mes erreurs', favs: 'Mes favoris', traps: 'Questions pièges', dates: 'Dates à retenir', flash: 'Flashcards', question: 'Question', examIntro: 'Examen blanc', review: 'Correction des erreurs', history: 'Historique', roman: 'Chiffres romains', settings: 'Paramètres', notifications: 'Notifications', about: 'À propos', lot: 'Lot de questions', result: 'Résultat' };
    if (T[c.s]) bar = { ...back, title: T[c.s] };

    switch (c.s) {
      case 'home': {
        const plan = this.memo('plan', [bank, P.stats, st.goal, this.minute()], () => smartPlan(bank, P, Math.max(5, st.goal))), q = P.quiz;
        const planSub = plan.dueNow && plan.freshNow ? plan.dueNow + ' à revoir · ' + plan.freshNow + (plan.freshNow > 1 ? ' nouvelles' : ' nouvelle') : plan.dueNow ? plural(plan.dueNow, 'question') + ' à revoir' : plan.freshNow ? plan.freshNow + (plan.freshNow > 1 ? ' nouvelles questions' : ' nouvelle question') : 'Tout est à jour · ' + plural(plan.size, 'question');
        const cta = q
          ? { label: 'Reprendre le test', sub: q.title + ' · question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(secondsLeft(q)) : ''), onClick: () => this.resumeQuiz() }
          : { label: O.seen ? 'Continuer ma révision' : 'Commencer ma préparation', sub: 'Révision intelligente : ' + planSub, onClick: () => this.startQuiz('smart') };
        home = {
          prep: O.pct + ' %', prepW: O.pct + '%', prepName: bank.name, chev: ic('chevR', 16, 2), onPrep: () => this.openSheet('prep'),
          goal: 'Objectif du jour : ' + O.today + ' / ' + st.goal + ' questions' + (O.today >= st.goal ? ' ✓' : '') + (O.streak ? ' · Série : ' + plural(O.streak, 'jour') : ''),
          ctaLabel: cta.label, ctaSub: cta.sub, onCta: cta.onClick,
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
          row({ icon: 'layers', title: 'Flashcards', chev: true, onClick: () => this.pushFlash({}) }),
          row({ icon: 'scroll', title: 'Chiffres romains', sub: 'Ve République, XVe siècle, Louis XIV…', chev: true, onClick: () => this.push({ s: 'roman' }) }),
        ])]; break;
      case 'test': {
        largeTitle = 'Tester';
        testHero = { sub: ex + ' questions • ' + exMin + ' min', pass: 'Seuil de réussite : ' + passMark(ex) + ' / ' + ex, onStart: () => this.push({ s: 'examIntro' }) };
        const nHard = this.memo('hard', [bank, P.stats], () => hardPool(bank, P).length);
        if (P.quiz) groups.push(G('En cours', [resumeRow()]));
        groups.push(G('Entraînement libre', [
          row({ icon: 'zap', title: 'Quiz rapide', sub: '5 à ' + Math.min(40, O.total) + ' questions au hasard', chev: true, onClick: () => this.openSheet('count') }),
          row({ icon: 'book', title: 'Quiz par thème', sub: '5 thématiques officielles', chev: true, onClick: () => this.openSheet('theme') }),
          row({ icon: 'flame', title: 'Questions difficiles', sub: nHard ? Math.min(nHard, MAX_POOL_QUIZ) + ' questions parmi ' + nHard + ' · pièges et questions souvent ratées' : 'Aucune pour l’instant', chev: true, onClick: () => this.startQuiz('hard') }),
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
            row({ icon: 'clock', title: 'En conditions d’examen', sub: 'Chronométré · ' + examMinutes(L.qs.length) + ' min · correction à la fin', chev: true, onClick: () => this.startQuiz('lot', { id: L.id, timed: true }) }),
            row({ icon: 'layers', title: 'Flashcards du lot', chev: true, onClick: () => this.pushFlash({ lot: L.id }) }),
          ]),
        ];
        sticky = primary('Lancer ce lot', () => this.startQuiz('lot', { id: L.id }));
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
              ? G('Mes points faibles', weak.map((t) => row({ icon: 'alert', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: t.name, sub: t.pct + ' % maîtrisé' + (t.acc != null ? ' · ' + t.acc + ' % de bonnes réponses' : ' · pas encore travaillé'), chev: true, onClick: () => this.pushTheme(t.id) })), { label: 'Travailler mes points faibles', onClick: () => this.startQuiz('weak') })
              : G('Mes points faibles', [row({ icon: 'check', iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucun point faible', sub: 'Tous les thèmes sont maîtrisés.' })]),
          G(null, [row({ icon: 'clock', title: 'Historique', sub: plural(O.exams, 'examen blanc') + ' · ' + plural(P.history.length, 'test') + ' au total', chev: true, onClick: () => this.push({ s: 'history' }) })]),
        ]; break;
      }
      case 'profile': {
        largeTitle = 'Profil'; profile = { initials: bank.initials, name: bank.name, sub: O.pct + ' % de préparation · ' + plural(O.total, 'question') };
        const rows = [
          row({ icon: 'target', title: 'Type de préparation', sub: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot'), value: bank.short, chev: true, onClick: () => this.openSheet('prep') }),
          row({ icon: 'scroll', title: 'Chiffres romains', sub: 'Ve République, XVe siècle, Louis XIV… : savoir les lire', chev: true, onClick: () => this.push({ s: 'roman' }) }),
          row({ icon: 'alert', title: 'Signaler un bug', sub: 'Avec une capture d’écran si besoin', chev: true, onClick: () => this.openReport(null) }),
          row({ icon: 'sparkles', title: 'Proposer une question', sub: 'Texte ou photo, envoyé à l’auteur', chev: true, onClick: () => this.openPropose() }),
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
        const seg = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => { const a = st.theme === v; return { label: l, checked: a, onClick: (e) => { e.stopPropagation(); this.setS('theme', v); } }; });
        groups = [
          G('Préparation · ' + bank.short, [row({ title: 'Type de préparation', value: bank.short, chev: true, onClick: () => this.openSheet('prep') }), row({ title: 'Objectif quotidien', value: st.goal + ' questions', chev: true, onClick: () => this.openSheet('goal') }), row({ title: 'Révision automatique', ...sw('auto', 'Ajoute tes mauvaises réponses à « Mes erreurs »') }), row({ title: 'Longueur de l’examen blanc', value: st.examLength + ' questions', chev: true, onClick: () => this.openSheet('examLength') })]),
          canNotify && G('Notifications', [row({ title: 'Rappels', value: remOn ? 'Activés · ' + st.time : 'Désactivés', chev: true, onClick: () => this.push({ s: 'notifications' }) })]),
          G('Apparence', [row({ title: 'Thème', seg }), row({ title: 'Taille du texte', value: st.text, chev: true, onClick: () => this.openSheet('text') })]),
          G('Quiz', [row({ title: 'Afficher immédiatement la correction', ...sw('instant') }), row({ title: 'Mélanger les réponses', ...sw('shuffle') }), row({ title: 'Son', ...sw('sound') }), row({ title: 'Vibration', ...sw('vibration') })]),
          G('Données', [
            row({ title: 'Exporter ma progression', sub: 'Fichier de sauvegarde de toutes les préparations', chev: true, onClick: () => { exportData(APP_VERSION); this.toast('Sauvegarde téléchargée'); } }),
            row({ title: 'Importer une sauvegarde', sub: 'Remplace la progression de cet appareil', chev: true, onClick: () => this.pickBackup() }),
            row({ title: 'Réinitialiser ma progression', sub: 'Profil « ' + bank.name + ' » uniquement', color: 'var(--error)', onClick: () => this.openSheet('reset') }),
          ]),
          G(null, [row({ title: 'À propos, sources et confidentialité', value: APP_VERSION, chev: true, onClick: () => this.push({ s: 'about' }) })]),
        ].filter(Boolean); break;
      }
      case 'notifications': {
        if (!canNotify) { empty = { icon: ic('bell', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Notifications indisponibles', text: 'Ce navigateur ne permet pas les notifications. Sur iPhone, installe d’abord Civi sur l’écran d’accueil (iOS 16.4 ou plus).' }; break; }
        intro = s.notif === 'denied'
          ? 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis réactive les rappels ici.'
          : 'Les rappels s’affichent quand l’application est ouverte ou en arrière-plan. Sur Android, une fois l’application installée, ils peuvent aussi arriver quand elle est fermée, à une heure approximative (c’est le téléphone qui décide). Sur iPhone, ils n’arrivent que lorsque l’application est ouverte.';
        groups = [
          G(null, [row({ title: 'Rappel quotidien', ...swRow(remOn, () => this.toggleReminder('reminder'), 'Si ton objectif du jour (' + st.goal + ' questions) n’est pas atteint') }), row({ title: 'Heure du rappel', value: st.time, chev: true, op: remOn ? 1 : 0.45, onClick: remOn ? () => this.openSheet('time') : undefined })]),
          G(null, [row({ title: 'Rappel de reprise', ...swRow(granted && st.streak, () => this.toggleReminder('streak'), 'Si tu n’as pas révisé depuis 2 jours') })]),
        ];
        if (granted) groups.push(G(null, [row({ icon: 'bell', title: 'Envoyer une notification de test', chev: true, onClick: () => { testNotification('Les rappels de Civi fonctionnent sur cet appareil.'); this.toast('Notification envoyée'); } })]));
        break;
      }
      case 'propose': {
        const p = s.pf; if (!p) break;
        const filled = p.a.filter((t) => t.trim()).length;
        const complete = p.q.trim() && filled >= 2 && p.c != null && p.a[p.c]?.trim();
        const ok = p.kind === 'image' ? !!p.img : complete;
        propose = {
          p, preps: PREPS.map((b) => ({ id: b.id, name: b.name })), themes: THEMES.map((t) => ({ id: t.id, name: t.name })), LET,
          set: (patch) => this.setPf(patch), setA: (i, v) => this.setPf({ a: p.a.map((t, j) => (j === i ? v : t)) }), pick: (f) => this.pickImage(f),
        };
        intro = p.kind === 'image' ? 'Envoie une photo ou une capture d’une question (livret, document officiel…). Elle sera vérifiée avant d’être ajoutée.' : 'Écris la question, ses réponses et coche la bonne. Elle sera vérifiée avant d’être ajoutée.';
        sticky = primary(p.sending ? 'Envoi…' : 'Envoyer la proposition', () => this.submitPropose(), { disabled: !ok || p.sending, op: !ok || p.sending ? 0.45 : 1 });
        break;
      }
      case 'about':
        groups = [
          G(null, [row({ title: 'Version', value: APP_VERSION }), row({ title: 'Préparation', value: bank.short }), row({ title: 'Banque de questions', value: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot') })]),
          G('Sources officielles', SOURCES.map(([title, sub, url]) => row({ icon: 'info', title, sub, chev: true, onClick: () => window.open(url, '_blank', 'noopener') }))),
          G('Confidentialité', PRIVACY.map(([title, sub]) => row({ title, sub }))),
        ]; break;
      case 'roman': {
        intro = 'Le test utilise souvent les chiffres romains : Ve République, XVIIIe siècle, Louis XIV… Voici tout ce qu’il faut savoir pour les lire sans erreur.';
        const wide = (o) => row({ ...o, yearW: 72, yearFs: 24 });
        groups = [
          G('Les 7 symboles', SYMBOLS.map(([sym, n, word]) => row({ year: sym, title: String(n), sub: word }))),
          G('Les règles', RULES.map(([title, sub]) => row({ icon: 'info', title, sub }))),
          G('À connaître pour le test', EXAMPLES.map(([n, before, after, sub]) => wide({ year: toRoman(n) + (after === 'er' ? 'er' : ''), title: before + toRoman(n) + after, sub }))),
          G('Les siècles', [row({ icon: 'bulb', title: 'Trouver le siècle d’une année', sub: 'Chiffre des centaines + 1 : 1789 → 17 + 1 = 18 → XVIIIe siècle. Attention : 1900 est encore au XIXe siècle.' })]
            .concat(CENTURIES.map(([n, sub]) => { const [a, b] = centuryYears(n); return wide({ year: romanOrdinal(n), title: n + 'e siècle · ' + a + ' à ' + b, sub }); }))),
        ];
        break;
      }
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
        if (list.length) groups = [G(null, list.map((e) => qRow(e.id, answerSub(e.pick, 'Marquée « À revoir »'), 'errors', e.pick)))];
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
        if (!H) { empty = { icon: ic('alert', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Test introuvable', text: 'Ce test ne fait plus partie de ton historique.' }; break; }
        if (list.length) groups = [G(null, list.map((w) => qRow(w.id, answerSub(w.pick, 'Sans réponse'), 'review', w.pick)))];
        else empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucune erreur', text: 'Tu as tout bon.' };
        break;
      }
      case 'examIntro':
        intro = 'Mets-toi dans les conditions de l’examen officiel. La correction s’affiche à la fin.';
        groups = [G('Déroulement', [
          row({ icon: 'clipboard', title: ex + ' questions à choix multiples', sub: 'Réparties selon les 5 thèmes officiels' }),
          row({ icon: 'clock', title: exMin + ' minutes chronométrées' }),
          row({ icon: 'target', title: passMark(ex) + ' bonnes réponses pour réussir' }),
          row({ icon: 'download', title: 'Progression sauvegardée', sub: 'Tu peux quitter et reprendre plus tard, mais le chrono continue de tourner, comme à l’examen' }),
          st.auto && row({ icon: 'rotate', title: 'Tes erreurs sont ajoutées à ta liste de révision' }),
        ].filter(Boolean))];
        if (P.quiz) groups.push(G('En cours', [resumeRow()]));
        sticky = primary('Commencer l’examen', () => this.startQuiz('exam')); break;
      case 'theme': {
        const t = thById(c.id); bar.title = t.short; const ts = TS[t.id];
        fiche = { loading: false, ready: true, icon: ic(t.icon, 26), name: t.name, pct: pct(t) + '%', pctLabel: pct(t) + ' %', sub: 'Maîtrise · ' + ts.mastered + ' / ' + plural(ts.total, 'question') + (ts.acc != null ? ' · ' + ts.acc + ' % de réussite' : ''), facts: withSep(bank.facts[t.id].map((x, i) => ({ n: i + 1, text: x }))) };
        groups = [G('S’entraîner', [row({ icon: 'layers', title: 'Flashcards du thème', chev: true, onClick: () => this.pushFlash({ theme: t.id }) }), row({ icon: 'alert', title: 'Questions pièges', chev: true, onClick: () => this.push({ s: 'traps' }) })])];
        sticky = primary('Tester mes connaissances', () => this.startQuiz('theme', t.id), { disabled: !ts.total, op: !ts.total ? 0.45 : 1 }); break;
      }
      case 'flash': {
        const L = c.lot && bank.lots.find((l) => l.id === c.lot);
        const cards = (c.order || []).map(qById).filter(Boolean);
        if (c.theme) bar.title = 'Flashcards · ' + thById(c.theme).short;
        if (L) bar.title = 'Flashcards · ' + L.title;
        if (!cards.length) { empty = { icon: ic('layers', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Aucune carte', text: 'Aucune question disponible ici.' }; break; }
        if (s.fc >= cards.length) {
          empty = { icon: ic('check', 32, 2), iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Paquet terminé', text: plural(cards.length, 'carte') + ' revue' + (cards.length > 1 ? 's' : '') + '.', btn: 'Recommencer (nouvel ordre)', onBtn: () => { this.setTop({ order: shuffle(c.order) }); this.setState({ fc: 0, flip: false }); } };
          break;
        }
        const i = s.fc; const q = cards[i];
        flash = {
          theme: thById(q.t).short, counter: (i + 1) + ' / ' + cards.length, kicker: s.flip ? 'Réponse' : 'Question', kColor: s.flip ? 'var(--success)' : 'var(--primaryText)', text: s.flip ? q.a[q.c] : q.q, detail: s.flip ? q.x : null, hint: s.flip ? 'Touche pour revoir la question' : 'Touche pour voir la réponse', flipIcon: ic('rotate', 16),
          onFlip: () => { const el = this.cardRef.current; if (el && el.animate) el.animate([{ transform: 'scaleX(.96)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }); this.setState({ flip: !s.flip }); },
        };
        // Self-assessment is not an answer: it does not change mastery, spaced repetition or the daily goal.
        // « À revoir » adds the card to « Mes erreurs » when automatic revision is on.
        const next = (ok) => {
          if (!ok && st.auto && !P.errors.some((e) => e.id === q.id)) this.updP((p) => ({ ...p, errors: p.errors.concat([{ id: q.id, pick: null }]) }));
          this.setState({ fc: s.fc + 1, flip: false });
        };
        sticky = primary('Je savais', () => next(true), { dir: 'row', icon: ic('check', 20, 2), secondary: { label: 'À revoir', icon: ic('x', 20, 2), onClick: () => next(false), order: 0, h: '54px', border: '1.5px solid var(--line)', color: 'var(--text)' } }); break;
      }
      case 'question': {
        const q = qById(c.id); if (!q) break; bar.star = favBtn(q.id);
        const chosen = c.pick != null ? q.a.indexOf(c.pick) : -1;
        const states = q.a.map((_, i) => (i === q.c ? 'correct' : i === chosen ? 'wrong' : 'dim'));
        qv = buildQv(q, states, () => {}, true, { text: q.x, bulb: ic('bulb', 16) });
        if (c.from === 'errors' && P.errors.some((e) => e.id === q.id)) sticky = primary('J’ai compris', () => { this.updP((p) => ({ ...p, errors: p.errors.filter((e) => e.id !== q.id) })); this.toast('Retiré de mes erreurs'); this.back(); }, { icon: ic('check', 20, 2) });
        break;
      }
      case 'quiz': {
        const z = P.quiz; if (!z) break; const id = z.qs[z.idx]; const q = qById(id); if (!q) break; const n = z.qs.length; const last = z.idx + 1 >= n;
        bar = { ...back, title: 'Question ' + (z.idx + 1) + ' / ' + n, backLabel: 'Quitter le test', star: favBtn(q.id) };
        quizBar = { pct: ((z.idx + (z.validated ? 1 : 0)) / n) * 100 + '%', mode: z.title, timer: z.timed ? fmt(secondsLeft(z)) : null, timerColor: z.timed && secondsLeft(z) < 300 ? 'var(--warn)' : 'var(--text)', clock: ic('clock', 16, 2) };
        const ans = z.validated ? z.answers[z.answers.length - 1] : null;
        const states = q.a.map((_, i) => (z.validated ? (i === q.c ? 'correct' : i === ans.chosen ? 'wrong' : 'dim') : z.sel === i ? 'selected' : 'normal'));
        const explain = z.validated ? { text: q.x, bulb: ic('bulb', 16), verdict: ans.ok ? 'Bonne réponse' : 'Mauvaise réponse', vColor: ans.ok ? 'var(--success)' : 'var(--error)', vIcon: ic(ans.ok ? 'check' : 'x', 20, 2.5) } : null;
        qv = buildQv(q, states, (i) => this.select(i), z.validated, explain, z.orders[id]);
        const label = z.validated ? (last ? 'Voir le résultat' : 'Question suivante') : z.instant ? 'Valider' : last ? 'Terminer le test' : 'Valider et continuer';
        sticky = primary(label, () => this.primaryQuiz(), { disabled: !z.validated && z.sel == null, op: !z.validated && z.sel == null ? 0.45 : 1 }); break;
      }
      case 'result': {
        const L = P.history.find((h) => h.id === c.hid);
        if (!L) { empty = { icon: ic('alert', 32), iconBg: 'var(--surface2)', iconColor: 'var(--text2)', title: 'Test introuvable', text: 'Ce test ne fait plus partie de ton historique.' }; break; }
        const need = passMark(L.total);
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
    return { propose, bar, quizBar, largeTitle, home, testHero, progHero, profile, intro, fiche, flash, qv, res, chips, groups, empty, sticky, showNav, tabs, toast, sheet, safeBg: showNav ? 'var(--surface)' : 'var(--bg)' };
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
            {v.propose && <ProposeForm f={v.propose} />}
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
