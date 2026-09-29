import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRoman, romanOrdinal, centuryYears } from '../src/roman.js';

test('Roman numerals', () => {
  const cases = { 1: 'I', 3: 'III', 4: 'IV', 5: 'V', 9: 'IX', 14: 'XIV', 15: 'XV', 16: 'XVI', 18: 'XVIII', 19: 'XIX', 21: 'XXI', 40: 'XL', 90: 'XC', 400: 'CD', 1789: 'MDCCLXXXIX', 1958: 'MCMLVIII' };
  Object.entries(cases).forEach(([n, r]) => assert.equal(toRoman(+n), r));
  assert.equal(romanOrdinal(1), 'Ier');
  assert.equal(romanOrdinal(5), 'Ve');
  assert.deepEqual(centuryYears(15), [1401, 1500]);
  assert.deepEqual(centuryYears(21), [2001, 2100]);
});
