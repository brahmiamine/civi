// Application shell: state, navigation (one stack per tab, Android back button, Escape), timers and actions.
// What each screen shows is described in src/view/ (one file per area) and rendered by components/Screen.jsx.
import { Component, createRef } from 'react';
import { PAL, LET, shuffle } from './constants.js';
import { EMPTY_PROPOSAL, sendProposal, sendReport, checkImage, rateLimited, noteSent } from './feedback.js';
import { setUpdateGuard, applyUpdate } from './update.js';
import { Screen } from './components/Screen.jsx';
import { buildView } from './view/index.js';
import { captureScreen } from './screenshot.js';
import { PREPS, prepById, hasPrep } from './bank.js';
import { emptyProfile, secondsLeft, themeStats, overview, dayKey, lastActiveDay } from './stats.js';
import { buildQuiz, recordOne, finalize, expireQuiz, cleanProfile, chosenOf } from './quiz.js';
import { loadSettings, saveSettings, loadProfile, saveProfile, saveQuiz, persistStorage, importData } from './storage.js';
import { canInstall, isStandalone, onInstallChange, promptInstall } from './install.js';
import { notifPermission, askPermission, pushConfig, checkReminders, onReminderMessage } from './notify.js';

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
const TEXT_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

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
      const loaded = loadProfile(b.id), p = cleanProfile(b, loaded, { auto: { ...PROFILE_DEFAULTS, ...device, ...loaded.settings }.auto });
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
    const bank = this.bank(), opts = { auto: this.settings().auto };
    this.updP((p) => expireQuiz(bank, p, opts));
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
  flipCard() {
    const el = this.cardRef.current;
    if (el && el.animate) el.animate([{ transform: 'scaleX(.96)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' });
    this.setState((s) => ({ flip: !s.flip }));
  }
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

  startQuiz(mode, arg, force) {
    if (this.prof().quiz && !force) { this.pending = [mode, arg]; return this.openSheet('replace'); }
    if (this.state.sheet) this.closeSheet();
    const q = buildQuiz(this.bank(), this.prof(), this.settings(), mode, arg, this.state.tab);
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
  // Instant correction: the answer is selected, then validated. Correction at the end: the pick is kept right away
  // (the learner can come back and change it until the test is finished).
  select(i) {
    const q = this.prof().quiz; if (!q || q.validated) return;
    this.setQuiz(q.instant ? { ...q, sel: i } : { ...q, picks: { ...q.picks, [q.qs[q.idx]]: i } });
  }
  primaryQuiz() {
    const q = this.prof().quiz; if (!q) return;
    if (!q.instant) return q.idx + 1 >= q.qs.length ? this.openSheet('finish') : this.setQuiz({ ...q, idx: q.idx + 1 });
    if (q.validated) return this.nextQ(); if (q.sel == null) return;
    // Instant correction: stats and « Mes erreurs » are updated at each answer, so nothing is lost if the test is abandoned.
    const bank = this.bank(), id = q.qs[q.idx], opts = { auto: this.settings().auto, errorsMode: q.mode === 'errors' };
    const Q = bank.byId.get(id), answer = { id, chosen: q.sel, pick: Q.a[q.sel] ?? null, ok: Q.c === q.sel };
    this.feedback(answer.ok, true);
    this.updP((p) => ({ ...recordOne(bank, p, id, q.sel, opts).p, quiz: { ...q, answers: q.answers.concat([answer]), validated: true } }));
  }
  prevQ() { const q = this.prof().quiz; if (q && !q.instant && q.idx > 0) this.setQuiz({ ...q, idx: q.idx - 1 }); }
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
  nextQ() { const q = this.prof().quiz; if (!q) return; if (q.idx + 1 >= q.qs.length) return this.finish(q); this.setQuiz({ ...q, idx: q.idx + 1, sel: null, validated: false }); }
  // Every finished test is kept in the profile history, with its wrong answers and per-theme score.
  // Every finished test is kept in the profile history, with its wrong answers and per-theme score.
  finish(q) {
    if (!q) return;
    clearInterval(this.timer); if (this.state.sheet) this.closeSheet();
    const bank = this.bank(), opts = { auto: this.settings().auto }, now = Date.now();
    this.updP((p) => finalize(bank, p, q, opts, now));
    this.replaceTop({ s: 'result', hid: now, fresh: true });
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
      const chosen = chosenOf(z);
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

  vals() { return buildView(this); }

  onSheetDown = (e) => { this.dragY = e.clientY; this.setState({ dragging: true }); if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); };
  onSheetMove = (e) => { if (this.dragY == null) return; this.setState({ drag: Math.max(0, e.clientY - this.dragY) }); };
  onSheetUp = () => { if (this.dragY == null) return; this.dragY = null; if (this.state.drag > 90) { this.setState({ dragging: false }); this.closeSheet(); } else this.setState({ drag: 0, dragging: false }); };

  render() {
    const sheetHandlers = { onClose: () => this.closeSheet(), onDown: this.onSheetDown, onMove: this.onSheetMove, onUp: this.onSheetUp };
    return <Screen v={this.vals()} scrollRef={this.scrollRef} contentRef={this.contentRef} cardRef={this.cardRef} sheetHandlers={sheetHandlers} />;
  }
}
