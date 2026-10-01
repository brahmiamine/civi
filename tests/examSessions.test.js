import test from 'node:test';
import assert from 'node:assert/strict';
import { centerRegistrationUrl, departmentCode, flattenSessions, normalizeCenters, todayIso } from '../src/examSessions.js';

test('todayIso uses local calendar date', () => {
  assert.equal(todayIso(new Date(2026, 9, 1, 23, 30)), '2026-10-01');
});

test('departmentCode supports metropolitan and overseas postal codes', () => {
  assert.equal(departmentCode('95310'), '95');
  assert.equal(departmentCode('97100'), '971');
  assert.equal(departmentCode('bad'), '');
});

test('normalizeCenters removes past sessions and sorts upcoming sessions', () => {
  const data = [{
    center_id: '980',
    center_name: 'ABC FORMATION',
    postal_code: '95310',
    sessions: [
      { date: '2026-09-30', time: '', remaining_places: 2, session_id: 'old' },
      { date: '2026-10-16', time: '', remaining_places: 14, session_id: 'b' },
      { date: '2026-10-07', time: '', remaining_places: 9, session_id: 'a' },
    ],
  }];
  const centers = normalizeCenters(data, new Date(2026, 9, 1, 10));
  assert.deepEqual(centers[0].sessions.map((s) => s.session_id), ['a', 'b']);
  assert.deepEqual(flattenSessions(centers).map((s) => s.session_id), ['a', 'b']);
});

test('centerRegistrationUrl resolves relative CCI links', () => {
  assert.equal(
    centerRegistrationUrl('/inscription-candidat/centre-980/produit-22'),
    'https://francais.cci-paris-idf.fr/inscription-candidat/centre-980/produit-22',
  );
});
