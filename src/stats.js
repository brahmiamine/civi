// Progress computed from what the learner actually answered, per profile.
// stats[id] = { n: attempts, ok: correct answers, s: current streak of correct answers, b: Leitner box, t: last answer, d: next review }
import { THEMES, EXAM_DIST, PASS_RATE, shuffle } from './constants.js';

const DAY = 24 * 60 * 60 * 1000;
// Spaced repetition: days before a question comes back, by box.
const BOX_DAYS = [0, 1, 3, 7, 14, 30];

export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const passMark = (total) => Math.ceil(total * PASS_RATE);

export const emptyProfile = () => ({ stats: {}, errors: [], favs: [], history: [], days: {}, settings: {}, quiz: null });

// A right answer only moves the question up a box when it was due: answering it again the same day
// does not push it weeks away. A wrong answer always sends it back to box 0 (due again right away).
export function recordAnswer(p, id, ok, now = Date.now()) {
  const prev = p.stats[id] || { n: 0, ok: 0, s: 0, b: 0 };
  const due = !prev.n || !(prev.d > now);
  const b = !ok ? 0 : due ? Math.min(prev.b + 1, BOX_DAYS.length - 1) : prev.b;
  const d = ok && !due ? prev.d : now + BOX_DAYS[b] * DAY;
  const st = { n: prev.n + 1, ok: prev.ok + (ok ? 1 : 0), s: ok ? prev.s + 1 : 0, b, t: now, d };
  const k = dayKey(new Date(now));
  return { ...p, stats: { ...p.stats, [id]: st }, days: { ...p.days, [k]: (p.days[k] || 0) + 1 } };
}

// Mastered: right at least twice in a row (a single right answer can be a lucky guess).
export const isMastered = (st) => !!st && st.s >= 2;

// « Mes erreurs » after an answer: a wrong answer is added (when automatic revision is on),
// a question leaves the list once it is mastered, or as soon as it is answered right in « Mes erreurs » mode.
// `pick` is the text of the chosen answer (not its position, which changes when the answers of a question are reordered).
export function updateErrors(p, id, ok, pick, { auto, errorsMode }) {
  const has = p.errors.some((e) => e.id === id);
  if (!ok) {
    if (!auto && !has) return p;
    return { ...p, errors: has ? p.errors.map((e) => (e.id === id ? { id, pick } : e)) : p.errors.concat([{ id, pick }]) };
  }
  if (has && (errorsMode || isMastered(p.stats[id]))) return { ...p, errors: p.errors.filter((e) => e.id !== id) };
  return p;
}

// Seconds left in a timed quiz: the deadline is absolute, so time keeps running when the app is closed.
export const secondsLeft = (q, now = Date.now()) => (q && q.timed ? Math.max(0, Math.ceil((q.endsAt - now) / 1000)) : 0);

export function themeStats(bank, p) {
  const out = {};
  THEMES.forEach((t) => { out[t.id] = { total: 0, mastered: 0, seen: 0, n: 0, ok: 0 }; });
  bank.questions.forEach((q) => {
    const o = out[q.t], st = p.stats[q.id]; o.total++;
    if (st) { o.seen++; o.n += st.n; o.ok += st.ok; if (isMastered(st)) o.mastered++; }
  });
  Object.values(out).forEach((o) => {
    o.pct = o.total ? Math.round((o.mastered / o.total) * 100) : 0;
    o.acc = o.n ? Math.round((o.ok / o.n) * 100) : null;
  });
  return out;
}

// Calendar days (not 24 h steps), so daylight saving changes never skip or repeat a day.
export function streakDays(days, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  let n = 0;
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1); // today not started yet: the streak is still alive
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const lastActiveDay = (days) => Object.keys(days).filter((k) => days[k] > 0).sort().pop() || null;
export const daysSince = (key, now = new Date()) => (key ? dayNum(dayKey(now)) - dayNum(key) : Infinity);

export function overview(bank, p, now = Date.now()) {
  let mastered = 0, seen = 0, n = 0, ok = 0, due = 0;
  bank.questions.forEach((q) => {
    const st = p.stats[q.id]; if (!st) return;
    seen++; n += st.n; ok += st.ok; if (isMastered(st)) mastered++; if (st.d <= now) due++;
  });
  const total = bank.questions.length;
  const exams = p.history.filter((h) => h.mode === 'exam');
  // Best score among the longest exams taken (a 10/10 short demo must not beat a 38/40 full exam).
  const full = exams.reduce((m, h) => Math.max(m, h.total), 0);
  const best = exams.filter((h) => h.total === full).reduce((b, h) => (!b || h.score > b.score ? h : b), null);
  return {
    total, mastered, seen, unseen: total - seen, due, attempts: n, correct: ok,
    pct: total ? Math.round((mastered / total) * 100) : 0,
    accuracy: n ? Math.round((ok / n) * 100) : null,
    exams: exams.length, passed: exams.filter((h) => h.passed).length, best, lastExam: exams[0] || null,
    today: p.days[dayKey(new Date(now))] || 0, streak: streakDays(p.days, new Date(now)),
  };
}

// Weakest themes first: lowest mastery, then lowest accuracy. Fully mastered themes are never "weak".
export function weakThemes(bank, p, k = 3) {
  const ts = themeStats(bank, p);
  return THEMES.filter((t) => ts[t.id].total && ts[t.id].pct < 100)
    .sort((a, b) => ts[a.id].pct - ts[b.id].pct || (ts[a.id].acc ?? 101) - (ts[b.id].acc ?? 101))
    .slice(0, k)
    .map((t) => ({ ...t, ...ts[t.id] }));
}

// Smart revision: questions due for review (spaced repetition) first, then new questions from the weakest themes,
// then the questions seen the longest time ago.
export function pickSmart(bank, p, n, now = Date.now()) {
  const ts = themeStats(bank, p), S = p.stats;
  const due = bank.questions.filter((q) => S[q.id] && S[q.id].d <= now).sort((a, b) => S[a.id].b - S[b.id].b || S[a.id].d - S[b.id].d);
  const fresh = shuffle(bank.questions.filter((q) => !S[q.id])).sort((a, b) => ts[a.t].pct - ts[b.t].pct);
  const later = bank.questions.filter((q) => S[q.id] && S[q.id].d > now).sort((a, b) => S[a.id].t - S[b.id].t);
  const nDue = Math.min(due.length, Math.max(1, Math.ceil(n * 0.7)));
  let pick = due.slice(0, nDue);
  pick = pick.concat(fresh.slice(0, n - pick.length));
  pick = pick.concat(due.slice(nDue, nDue + n - pick.length));
  pick = pick.concat(later.slice(0, n - pick.length));
  return shuffle(pick).map((q) => q.id);
}

export function smartPlan(bank, p, n, now = Date.now()) {
  const S = p.stats; let due = 0, fresh = 0;
  bank.questions.forEach((q) => { if (!S[q.id]) fresh++; else if (S[q.id].d <= now) due++; });
  const d = Math.min(due, Math.max(1, Math.ceil(n * 0.7)));
  const f = Math.min(fresh, n - d);
  return { due, fresh, dueNow: d, freshNow: f, size: Math.min(n, bank.questions.length) };
}

// Weak points: unmastered questions of the weakest themes, missed ones first.
export function pickWeak(bank, p, n = 10) {
  const themes = weakThemes(bank, p).map((t) => t.id), S = p.stats;
  const acc = (q) => (S[q.id] ? S[q.id].ok / S[q.id].n : 0.5);
  const pool = bank.questions.filter((q) => themes.includes(q.t) && !isMastered(S[q.id]));
  return shuffle(pool).sort((a, b) => acc(a) - acc(b)).slice(0, n).map((q) => q.id);
}

// Picks at most n questions of a pool for a quiz: questions not mastered yet first, the most missed first, random otherwise.
export function pickPool(pool, p, n) {
  const S = p.stats, acc = (q) => (S[q.id] ? S[q.id].ok / S[q.id].n : 0.5);
  return shuffle(pool).sort((a, b) => isMastered(S[a.id]) - isMastered(S[b.id]) || acc(a) - acc(b)).slice(0, n).map((q) => q.id);
}

// Questions that can be drawn for the mock exam: the bank, without the questions that only exist in a lot.
export const examPool = (bank) => bank.questions.filter((q) => !q.lotOnly);

// Hard questions: those flagged as traps plus those the learner misses most often.
export function hardPool(bank, p) {
  const S = p.stats;
  return bank.questions.filter((q) => q.trap || (S[q.id] && S[q.id].n > S[q.id].ok && S[q.id].ok / S[q.id].n < 0.6));
}

// Number of questions per theme for an exam of n questions: the official split scaled with the largest remainder
// method, so the counts always add up to n and stay as close as possible to the official proportions.
export function examSplit(n) {
  const total = Object.values(EXAM_DIST).reduce((a, b) => a + b, 0);
  const raw = THEMES.map((t) => ({ id: t.id, x: (EXAM_DIST[t.id] * n) / total }));
  const out = {}; let used = 0;
  raw.forEach((r) => { out[r.id] = Math.floor(r.x); used += out[r.id]; });
  raw.slice().sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x))).slice(0, n - used).forEach((r) => { out[r.id]++; });
  return out;
}

// Exam: follows the official split by theme, scaled to the requested length; gaps are filled from other themes.
export function pickExam(bank, n) {
  const pool = examPool(bank);
  n = Math.min(n, pool.length);
  const split = examSplit(n);
  const by = {}; THEMES.forEach((t) => { by[t.id] = shuffle(pool.filter((q) => q.t === t.id)); });
  let pick = [];
  THEMES.forEach((t) => { pick = pick.concat(by[t.id].splice(0, split[t.id])); });
  const rest = shuffle(THEMES.flatMap((t) => by[t.id]));
  pick = pick.concat(rest.slice(0, n - pick.length));
  return shuffle(pick).map((q) => q.id);
}

// History entry of a finished test (also used when a saved timed test runs out of time while the app is closed).
export function resultEntry(bank, q, now = Date.now()) {
  const byId = new Map(q.answers.map((a) => [a.id, a]));
  const score = q.answers.filter((a) => a.ok).length, total = q.qs.length;
  const wrong = q.qs.filter((id) => !byId.get(id)?.ok).map((id) => ({ id, pick: byId.get(id)?.pick ?? null }));
  const themes = {};
  q.qs.forEach((id) => { const t = bank.byId.get(id).t; const o = themes[t] || (themes[t] = [0, 0]); o[1]++; if (byId.get(id)?.ok) o[0]++; });
  const used = q.timed ? Math.max(0, Math.min(q.limit, Math.round((Math.min(now, q.endsAt) - (q.endsAt - q.limit * 1000)) / 1000))) : null;
  return { id: now, at: now, mode: q.mode, title: q.title, lot: q.lot || null, score, total, answered: q.answers.length, used, passed: score >= passMark(total), wrong, themes };
}

// Fingerprint of the answers of the questions of a saved test: if a question file changed since, the saved positions
// (selected answer, shuffled order) no longer match and are reset.
export function answersPrint(bank, qs) {
  let h = 0;
  const str = qs.map((id) => { const q = bank.byId.get(id); return q ? q.a.join('\u0001') + '\u0002' + q.c : '?'; }).join('\u0003');
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}
