import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceMeters,
  recommendationLabel,
  recommendationScore,
} from '../src/sessionRanking.js';

test('distance directe haversine', () => {
  const paris = { lat: 48.8566, lon: 2.3522 };
  const nearby = { lat: 48.8666, lon: 2.3522 };
  const d = haversineDistanceMeters(paris, nearby);
  assert.ok(d > 1000 && d < 1200);
});

test('score de recommandation reprend la pondération de distance', () => {
  const journey = { preferenceCost: 20 };
  const near = recommendationScore(journey, 1000);
  const far = recommendationScore(journey, 20000);
  assert.ok(near > far);
});

test('libellés du score', () => {
  assert.equal(recommendationLabel(85), 'Excellent');
  assert.equal(recommendationLabel(70), 'Très bon');
  assert.equal(recommendationLabel(55), 'Bon');
  assert.equal(recommendationLabel(40), 'Correct');
});
