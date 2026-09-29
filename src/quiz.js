// Quiz engine: pure functions (no React), used by App.jsx and tested in tests/quiz.test.js.
//
// Two kinds of tests:
// - instant correction (practice): each answer is validated, corrected on screen and recorded right away;
// - correction at the end (mock exam, timed lots, or the « correction immédiate » setting off): the learner moves freely
//   between the questions (previous / next) and may change an answer; the answers are kept in `picks`
//   and only recorded (stats, « Mes erreurs », history) when the test is finished — like handing in the paper.
import { MODE_T, thById, shuffle } from './constants.js';
import { examMinutes } from './utils.js';
import {
  recordAnswer, updateErrors, secondsLeft, pickSmart, pickWeak, hardPool, pickExam, pickPool, resultEntry, answersPrint,
} from './stats.js';

// Longest quiz for « Quiz par thème » and « Questions difficiles » (the least mastered questions first).
export const MAX_POOL_QUIZ = 20;

export function buildQuiz(bank, P, st, mode, arg, tab, now = Date.now()) {
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
  const instant = !timed && !!st.instant;
  return {
    mode, lot, title, qs, orders, idx: 0, sel: null, validated: false, answers: [], picks: instant ? undefined : {}, instant,
    timed, limit, timeLeft: limit, endsAt: timed ? now + limit * 1000 : 0, abs: true, fp: answersPrint(bank, qs), startedAt: now, open: true, tab,
  };
}

// Answer currently chosen for the question on screen (original answer index), or null.
export const chosenOf = (q, id = q.qs[q.idx]) => (q.instant ? (q.validated ? q.answers[q.answers.length - 1]?.chosen ?? null : q.sel) : q.picks[id] ?? null);

export const answeredCount = (q) => (q.instant ? q.answers.length : q.qs.filter((id) => q.picks[id] != null).length);

// Records one answer: stats, spaced repetition, daily goal and « Mes erreurs ».
export function recordOne(bank, p, id, chosen, opts, now = Date.now()) {
  const Q = bank.byId.get(id), ok = Q.c === chosen, pick = Q.a[chosen] ?? null;
  return { p: updateErrors(recordAnswer(p, id, ok, now), id, ok, pick, opts), answer: { id, chosen, pick, ok } };
}

// Finishes a test: records the answers not recorded yet (correction at the end) and adds the result to the history.
// opts: { auto } — the « révision automatique » setting.
export function finalize(bank, p, q, opts, now = Date.now()) {
  let answers = q.answers, next = p;
  if (!q.instant) {
    const done = new Set(q.recorded || []), o = { ...opts, errorsMode: q.mode === 'errors' };
    answers = q.qs.filter((id) => q.picks[id] != null).map((id) => {
      if (done.has(id)) { const Q = bank.byId.get(id), chosen = q.picks[id]; return { id, chosen, pick: Q.a[chosen] ?? null, ok: Q.c === chosen }; }
      const r = recordOne(bank, next, id, q.picks[id], o, now); next = r.p; return r.answer;
    });
  }
  const entry = resultEntry(bank, { ...q, answers }, now);
  return { ...next, quiz: null, history: [entry].concat(next.history).slice(0, 200) };
}

// A saved timed test whose deadline passed (app closed or test left) is finished and added to the history.
export function expireQuiz(bank, p, opts, now = Date.now()) {
  const q = p.quiz;
  if (!q || !q.timed || q.open || secondsLeft(q, now) > 0) return p;
  return finalize(bank, p, q, opts, now);
}

// Makes a saved profile consistent with the current question bank, then finishes a test whose time ran out.
export function cleanProfile(bank, p, opts, now = Date.now()) {
  const has = (id) => bank.byId.has(id);
  let quiz = p.quiz;
  if (quiz && !quiz.qs.every(has)) quiz = null;
  // Tests saved by older versions paused their timer while closed: give them a deadline from the time they had left.
  if (quiz && quiz.timed && !quiz.abs) quiz = { ...quiz, abs: true, endsAt: now + quiz.timeLeft * 1000 };
  // Tests saved by older versions recorded each answer as soon as it was given: they become free-navigation tests,
  // and the answers already recorded are not counted twice at the end.
  if (quiz && !quiz.instant && !quiz.picks) {
    const picks = {};
    quiz.answers.forEach((a) => { if (a.chosen != null) picks[a.id] = a.chosen; });
    quiz = { ...quiz, picks, recorded: quiz.answers.map((a) => a.id), sel: null };
  }
  // Answers of a question edited since the test was saved: positions (selection, shuffled order) are reset.
  const fp = quiz && answersPrint(bank, quiz.qs);
  if (quiz && quiz.fp !== fp) {
    const orders = {};
    quiz.qs.forEach((id) => { const o = quiz.orders[id], n = bank.byId.get(id).a.length; if (Array.isArray(o) && o.length === n && [...o].sort().every((v, i) => v === i)) orders[id] = o; });
    // (A test saved before fingerprints existed only gets one: its positions were already reset by that version.)
    const changed = quiz.fp != null;
    quiz = { ...quiz, fp, sel: null, orders, picks: quiz.instant || !changed ? quiz.picks : {}, answers: quiz.answers.map((a) => ({ ...a, chosen: changed ? null : a.chosen })) };
  }
  return expireQuiz(bank, { ...p, errors: p.errors.filter((e) => has(e.id)), favs: p.favs.filter(has), quiz }, opts, now);
}
