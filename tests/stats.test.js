// Unit tests of the learning logic (node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProfile, recordAnswer, isMastered, updateErrors, secondsLeft, streakDays, dayKey, examSplit, pickExam, overview, passMark,
} from '../src/stats.js';
import { normProfile } from '../src/storage.js';

const DAY = 864e5;
const T0 = new Date(2026, 0, 10, 10).getTime();

function bank(perTheme = 20) {
  const questions = [];
  ['valeurs', 'institutions', 'droits', 'histoire', 'societe'].forEach((t) => {
    for (let i = 0; i < perTheme; i++) questions.push({ id: t + i, t, q: '?', a: ['a', 'b', 'c', 'd'], c: 0 });
  });
  return { id: 'b', questions, byId: new Map(questions.map((q) => [q.id, q])), lots: [] };
}

test('one right answer is not mastery, two in a row are', () => {
  let p = recordAnswer(emptyProfile(), 'x', true, T0);
  assert.equal(isMastered(p.stats.x), false);
  p = recordAnswer(p, 'x', true, T0 + 2 * DAY);
  assert.equal(isMastered(p.stats.x), true);
  p = recordAnswer(p, 'x', false, T0 + 10 * DAY);
  assert.equal(isMastered(p.stats.x), false);
});

test('a right answer only moves up a box when the question was due', () => {
  let p = recordAnswer(emptyProfile(), 'x', true, T0);
  assert.equal(p.stats.x.b, 1);
  const due = p.stats.x.d;
  p = recordAnswer(p, 'x', true, T0 + 60e3); // same day, not due yet
  assert.equal(p.stats.x.b, 1);
  assert.equal(p.stats.x.d, due);
  p = recordAnswer(p, 'x', true, due + 1); // due: moves up
  assert.equal(p.stats.x.b, 2);
  p = recordAnswer(p, 'x', false, due + 2); // wrong: back to box 0, due now
  assert.equal(p.stats.x.b, 0);
  assert.equal(p.stats.x.d, due + 2);
});

test('answers count towards the day they were given', () => {
  const p = recordAnswer(recordAnswer(emptyProfile(), 'x', true, T0), 'y', false, T0);
  assert.equal(p.days[dayKey(new Date(T0))], 2);
});

test('« Mes erreurs » follows the answers', () => {
  let p = recordAnswer(emptyProfile(), 'x', false, T0);
  p = updateErrors(p, 'x', false, 2, { auto: true, errorsMode: false });
  assert.deepEqual(p.errors, [{ id: 'x', chosen: 2 }]);
  // Automatic revision off: nothing is added.
  assert.deepEqual(updateErrors(emptyProfile(), 'y', false, 1, { auto: false, errorsMode: false }).errors, []);
  // A single right answer outside « Mes erreurs » keeps it; answering it right in « Mes erreurs » removes it.
  let r = recordAnswer(p, 'x', true, T0 + 1);
  assert.equal(updateErrors(r, 'x', true, 0, { auto: true, errorsMode: false }).errors.length, 1);
  assert.equal(updateErrors(r, 'x', true, 0, { auto: true, errorsMode: true }).errors.length, 0);
  // Once mastered, it leaves the list from any mode.
  r = recordAnswer(r, 'x', true, T0 + 2);
  assert.equal(updateErrors(r, 'x', true, 0, { auto: true, errorsMode: false }).errors.length, 0);
});

test('the exam deadline is absolute', () => {
  const q = { timed: true, endsAt: T0 + 90e3 };
  assert.equal(secondsLeft(q, T0), 90);
  assert.equal(secondsLeft(q, T0 + 89_500), 1);
  assert.equal(secondsLeft(q, T0 + 3 * 3600e3), 0);
  assert.equal(secondsLeft({ timed: false }, T0), 0);
});

test('streak counts calendar days, across the daylight saving change', () => {
  // 29 March 2026: clocks go forward in France. Checked just after midnight the next day.
  const days = { '2026-03-28': 3, '2026-03-29': 5, '2026-03-30': 1 };
  assert.equal(streakDays(days, new Date(2026, 2, 30, 0, 30)), 3);
  // Today not started yet: yesterday's streak is still alive.
  assert.equal(streakDays(days, new Date(2026, 2, 31, 8)), 3);
  assert.equal(streakDays(days, new Date(2026, 3, 2, 8)), 0);
});

test('the exam split always has the requested size and the official proportions', () => {
  for (let n = 1; n <= 60; n++) assert.equal(Object.values(examSplit(n)).reduce((a, b) => a + b, 0), n);
  assert.deepEqual(examSplit(40), { valeurs: 11, institutions: 6, droits: 11, histoire: 8, societe: 4 });
  const b = bank();
  const ids = pickExam(b, 40);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  const count = (t) => ids.filter((id) => b.byId.get(id).t === t).length;
  assert.equal(count('valeurs'), 11);
  assert.equal(count('societe'), 4);
  assert.equal(passMark(40), 32);
});

test('overview counts only mastered questions in the preparation %', () => {
  const b = bank(2);
  let p = recordAnswer(emptyProfile(), 'valeurs0', true, T0);
  assert.equal(overview(b, p, T0).mastered, 0);
  p = recordAnswer(p, 'valeurs0', true, T0 + 2 * DAY);
  const o = overview(b, p, T0 + 2 * DAY);
  assert.equal(o.mastered, 1);
  assert.equal(o.pct, 10);
});

test('corrupted saved data is normalised instead of crashing', () => {
  const p = normProfile({ stats: { a: { n: 2, ok: 5 }, b: 'x' }, errors: null, favs: [1, 'q'], history: [{ id: 1, score: 3, total: 4 }, { nope: true }], days: { '2026-01-01': 2, bad: 3 } }, { qs: [], idx: 0 });
  assert.deepEqual(p.stats, { a: { n: 2, ok: 2, s: 0, b: 0, t: 0, d: 0 } });
  assert.deepEqual(p.errors, []);
  assert.deepEqual(p.favs, ['q']);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.history[0].wrong, []);
  assert.deepEqual(p.days, { '2026-01-01': 2 });
  assert.equal(p.quiz, null);
  assert.deepEqual(normProfile(null, null), emptyProfile());
});
