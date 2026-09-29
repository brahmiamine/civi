// Shared context and building blocks of the screens (src/view/screens/): the data of the active preparation,
// and helpers that describe rows, groups, buttons, empty states… in the shape the components expect.
import { ic } from '../Icon.jsx';
import { LET, thById, fmt } from '../constants.js';
import { plural, examMinutes } from '../utils.js';
import { weakThemes, examPool, secondsLeft } from '../stats.js';
import { notifSupported } from '../notify.js';

const SEP = '1px solid var(--divider)';
const ANSWER_STYLES = {
  normal: { bg: 'var(--surface)', border: '2px solid var(--divider)', badgeBg: 'var(--surface2)', badgeColor: 'var(--text)', op: 1 },
  selected: { bg: 'var(--tint)', border: '2px solid var(--primary)', badgeBg: 'var(--primary)', badgeColor: 'var(--onChip)', op: 1 },
  correct: { bg: 'var(--successTint)', border: '2px solid var(--success)', badgeBg: 'var(--success)', badgeColor: 'var(--onChip)', op: 1, note: 'Bonne réponse', noteColor: 'var(--success)', check: true },
  wrong: { bg: 'var(--errorTint)', border: '2px solid var(--error)', badgeBg: 'var(--error)', badgeColor: 'var(--onChip)', op: 1, note: 'Ta réponse', noteColor: 'var(--error)', cross: true },
  dim: { bg: 'var(--surface)', border: '2px solid transparent', badgeBg: 'var(--surface2)', badgeColor: 'var(--text2)', op: 0.5 },
};

export function makeKit(app) {
  const s = app.state, st = app.settings(), c = app.cur(), bank = app.bank(), P = app.prof();
  const O = app.overviewOf(bank, P), TS = app.themeStatsOf(bank, P), weak = app.memo('weak', [bank, P.stats], () => weakThemes(bank, P));
  const ex = Math.min(st.examLength, app.memo('examPool', [bank], () => examPool(bank).length));
  const k = { app, s, st, c, bank, P, O, TS, weak, ex, exMin: examMinutes(ex) };
  k.qById = (id) => bank.byId.get(id);
  k.pct = (t) => TS[t.id].pct;
  k.nErr = P.errors.length;
  k.granted = s.notif === 'granted';
  k.canNotify = notifSupported();
  k.remOn = k.granted && st.reminder;

  // Lists
  k.withSep = (rows) => rows.map((r, i) => ({ ...r, sep: i < rows.length - 1 ? SEP : 'none' }));
  k.G = (header, rows, action) => ({ header, rows: k.withSep(rows), action });
  k.row = (o) => {
    const r = { color: 'var(--text)', iconBg: 'var(--tint)', iconColor: 'var(--primary)', op: 1, cursor: o.onClick ? 'pointer' : 'default', role: o.onClick ? 'button' : undefined, tab: o.onClick ? 0 : undefined, ...o };
    if (typeof o.icon === 'string') r.icon = ic(o.icon);
    if (o.chev) r.chev = ic('chevR', 20);
    return r;
  };
  k.tagN = (label) => ({ label, bg: 'var(--surface2)', color: 'var(--text2)' });
  k.swRow = (on, onClick, sub) => ({ sw: { track: on ? 'var(--primary)' : 'var(--surface2)', x: on ? '20px' : '0px' }, role: 'switch', checked: on ? 'true' : 'false', tab: 0, cursor: 'pointer', onClick, sub });
  k.sw = (key, sub) => k.swRow(!!st[key], () => app.setS(key, !st[key], false), sub);
  // Filter chips: items = [[id, label]].
  k.chips = (items, active, onPick) => items.map(([id, label]) => {
    const a = id === active;
    return { key: id, label, pressed: a ? 'true' : 'false', bg: a ? 'var(--primary)' : 'var(--surface)', color: a ? 'var(--onChip)' : 'var(--text)', border: a ? 'transparent' : 'var(--line)', onClick: () => onPick(id) };
  });
  // Empty state. o: { ok (green check style), sw (icon stroke), btn, onBtn }.
  k.emptyState = (icon, title, text, o = {}) => ({
    icon: ic(icon, 32, o.sw), iconBg: o.ok ? 'var(--successTint)' : 'var(--surface2)', iconColor: o.ok ? 'var(--success)' : 'var(--text2)', title, text, btn: o.btn, onBtn: o.onBtn,
  });
  k.verdictBadge = (ok) => ({ label: ok ? 'Réussi' : 'Échoué', icon: ic(ok ? 'check' : 'x', 14, 2.5), bg: ok ? 'var(--successTint)' : 'var(--errorTint)', color: ok ? 'var(--success)' : 'var(--error)' });

  // Buttons and bars
  k.back = { show: true, backIcon: ic('chevL', 26), backLabel: 'Retour', onBack: () => app.back() };
  k.primary = (label, onClick, o) => Object.assign({ label, onClick, dir: 'column', op: 1 }, o || {});
  // Secondary button next to the main one (sticky bar in a row).
  k.secondary = (label, icon, onClick) => ({ label, icon: icon && ic(icon, 20, 2), onClick, order: 0, h: '54px', border: '1.5px solid var(--line)', color: 'var(--text)' });
  k.favBtn = (id) => {
    const f = P.favs.includes(id);
    return { icon: ic('star', 22, 1.5, f), color: f ? 'var(--primary)' : 'var(--text2)', label: f ? 'Retirer des favoris' : 'Ajouter aux favoris', pressed: f ? 'true' : 'false', onClick: () => app.toggleFav(id) };
  };

  // Rows that open something
  k.themeSub = (t) => (TS[t.id].seen ? k.pct(t) + ' % maîtrisé · ' + TS[t.id].mastered + ' / ' + TS[t.id].total : plural(TS[t.id].total, 'question') + ' · pas encore commencé');
  k.themeRow = (t) => k.row({ icon: t.icon, title: t.name, sub: k.themeSub(t), pct: k.pct(t) + '%', chev: true, onClick: () => app.pushTheme(t.id) });
  k.qRow = (id, sub, from, pick) => {
    const q = k.qById(id);
    return q && k.row({ tag: k.tagN(thById(q.t).short), title: q.q, sub, chev: true, onClick: () => app.push({ s: 'question', id, pick, from }) });
  };
  k.answerSub = (pick, none) => (pick != null ? 'Ta réponse : ' + pick : none);
  k.resumeRow = () => {
    const q = P.quiz;
    return k.row({ icon: 'clock', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: 'Reprendre : ' + q.title, sub: 'Question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(secondsLeft(q)) + ' restantes' : '') + ' · sauvegardé', chev: true, onClick: () => app.resumeQuiz() });
  };

  // A question with its answers. states[i] ∈ normal | selected | correct | wrong | dim (by original answer index);
  // order = display order of the original indices (shuffled answers).
  const fsQ = { Petite: '20px', Normale: '23px', Grande: '26px' }[st.text], fsA = { Petite: '15px', Normale: '16px', Grande: '18px' }[st.text];
  k.questionView = (q, states, onPick, disabled, explain, order = q.a.map((_, i) => i)) => ({
    theme: thById(q.t).short + (q.situation ? ' · Mise en situation' : ''), text: q.q, fs: fsQ, afs: fsA, explain, onReport: () => app.openReport(q),
    answers: order.map((orig, i) => {
      const m = ANSWER_STYLES[states[orig]], txt = q.a[orig];
      const badge = m.check ? ic('check', 20, 2.5) : m.cross ? ic('x', 20, 2.5) : LET[i];
      return { ...m, key: orig, badge, text: txt, disabled, checked: states[orig] === 'selected' ? 'true' : 'false', aria: LET[i] + '. ' + txt + (m.note ? ' — ' + m.note : ''), onClick: () => onPick(orig) };
    }),
  });
  return k;
}
