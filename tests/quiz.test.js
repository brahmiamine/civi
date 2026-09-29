// Unit tests of the quiz engine (src/quiz.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuiz, finalize, expireQuiz, cleanProfile, answeredCount, chosenOf } from '../src/quiz.js';
import { emptyProfile, answersPrint } from '../src/stats.js';

const T0 = new Date(2026, 0, 10, 10).getTime();
function bank(perTheme = 12) {
  const questions = [];
  ['valeurs', 'institutions', 'droits', 'histoire', 'societe'].forEach((t) => {
    for (let i = 0; i < perTheme; i++) questions.push({ id: t + i, t, q: '?', a: ['a', 'b', 'c', 'd'], c: 0 });
  });
  return { id: 'b', questions, byId: new Map(questions.map((q) => [q.id, q])), lots: [{ id: 'lot-1', title: 'Lot', qs: ['valeurs0', 'droits0', 'histoire0'] }] };
}
const ST = { goal: 10, examLength: 40, shuffle: false, instant: true, auto: true };

test('the mock exam is corrected at the end, practice quizzes right away', () => {
  const b = bank(), P = emptyProfile();
  const exam = buildQuiz(b, P, ST, 'exam', null, 'test', T0);
  assert.equal(exam.instant, false);
  assert.deepEqual(exam.picks, {});
  assert.equal(exam.qs.length, 40);
  assert.equal(exam.endsAt, T0 + 45 * 60e3);
  assert.equal(buildQuiz(b, P, ST, 'quick', 5, 'test', T0).instant, true);
  assert.equal(buildQuiz(b, P, { ...ST, instant: false }, 'quick', 5, 'test', T0).instant, false);
});

test('answers can be changed before the end; they are recorded only when the test is finished', () => {
  const b = bank(), P = emptyProfile();
  let q = buildQuiz(b, P, ST, 'lot', { id: 'lot-1', timed: true }, 'test', T0);
  q = { ...q, picks: { valeurs0: 2 } };
  assert.equal(answeredCount(q), 1);
  q = { ...q, picks: { valeurs0: 0, droits0: 1 }, idx: 1 }; // came back to question 1 and changed the answer
  assert.equal(chosenOf(q), 1);
  const p = finalize(b, P, q, { auto: true }, T0 + 60e3);
  assert.equal(p.quiz, null);
  assert.deepEqual(Object.keys(p.stats).sort(), ['droits0', 'valeurs0']); // unanswered question not counted as seen
  assert.equal(p.stats.valeurs0.ok, 1);
  assert.deepEqual(p.errors, [{ id: 'droits0', pick: 'b' }]);
  const h = p.history[0];
  assert.equal(h.score, 1); assert.equal(h.total, 3); assert.equal(h.answered, 2); assert.equal(h.used, 60);
  assert.deepEqual(h.wrong, [{ id: 'droits0', pick: 'b' }, { id: 'histoire0', pick: null }]);
});

test('a saved exam whose time is over is finished and added to the history', () => {
  const b = bank(), P = emptyProfile();
  const q = { ...buildQuiz(b, P, ST, 'exam', null, 'test', T0), open: false, picks: {} };
  q.picks[q.qs[0]] = 0;
  const p = { ...P, quiz: q };
  assert.equal(expireQuiz(b, p, { auto: true }, T0 + 60e3), p); // still running
  const done = expireQuiz(b, p, { auto: true }, T0 + 46 * 60e3);
  assert.equal(done.quiz, null);
  assert.equal(done.history[0].answered, 1);
  assert.equal(done.history[0].score, 1);
  assert.equal(done.history[0].used, 45 * 60);
  assert.equal(done.stats[q.qs[0]].n, 1);
});

test('an exam saved by the previous version keeps its answers without counting them twice', () => {
  const b = bank(), qs = ['valeurs0', 'droits0', 'histoire0'];
  const old = {
    mode: 'exam', title: 'Examen', qs, orders: {}, idx: 2, sel: null, validated: false, instant: false, timed: true, limit: 300, timeLeft: 200,
    endsAt: T0 + 200e3, abs: true, fp: answersPrint(b, qs), open: false, answers: [{ id: 'valeurs0', chosen: 0, pick: 'a', ok: true }, { id: 'droits0', chosen: 2, pick: 'c', ok: false }],
  };
  // The previous version already recorded these two answers.
  const P = { ...emptyProfile(), stats: { valeurs0: { n: 1, ok: 1, s: 1, b: 1, t: T0, d: T0 + 864e5 }, droits0: { n: 1, ok: 0, s: 0, b: 0, t: T0, d: T0 } }, quiz: old };
  const p = cleanProfile(b, P, { auto: true }, T0);
  assert.deepEqual(p.quiz.picks, { valeurs0: 0, droits0: 2 });
  const q = { ...p.quiz, picks: { ...p.quiz.picks, histoire0: 0 } };
  const f = finalize(b, p, q, { auto: true }, T0 + 1000);
  assert.equal(f.stats.valeurs0.n, 1);
  assert.equal(f.stats.droits0.n, 1);
  assert.equal(f.stats.histoire0.n, 1);
  assert.equal(f.history[0].score, 2);
});

test('a test whose questions were edited keeps going without its old selections', () => {
  const b = bank(), P = emptyProfile();
  const q = { ...buildQuiz(b, P, { ...ST, shuffle: true }, 'exam', null, 'test', T0), picks: {} };
  q.picks[q.qs[0]] = 3;
  const edited = b.byId.get(q.qs[0]); edited.a = ['d', 'c', 'b', 'a']; edited.c = 3;
  const p = cleanProfile(b, { ...P, quiz: q }, { auto: true }, T0);
  assert.deepEqual(p.quiz.picks, {});
  assert.equal(p.quiz.fp, answersPrint(b, q.qs));
  assert.equal(Object.keys(p.quiz.orders).length, 40); // shuffled orders are still valid permutations
});
