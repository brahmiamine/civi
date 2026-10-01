// Transport ranking for CCI exam centres.
// Adapted from brahmiamine/distance: GeoPF geocoding + Transitous routing,
// with the same weighting for duration, walking, transfers and direct distance.

const GEOCODING_URL = 'https://data.geopf.fr/geocodage/search';
const PLAN_URL = 'https://api.transitous.org/api/v6/plan';

const DEFAULT_MODES = ['SUBWAY', 'TRAM', 'BUS', 'SUBURBAN', 'RAIL', 'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'LONG_DISTANCE', 'HIGHSPEED_RAIL', 'NIGHT_RAIL'];
const TRANSIT_MODES = new Set([
  'TRANSIT', 'TRAM', 'SUBWAY', 'FERRY', 'AIRPLANE', 'BUS', 'COACH', 'RAIL',
  'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL',
  'REGIONAL_RAIL', 'SUBURBAN', 'FUNICULAR', 'AERIAL_LIFT', 'METRO',
]);

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function legDistance(leg) {
  const distance = Number(leg?.distance);
  if (Number.isFinite(distance) && distance >= 0) return distance;
  return numberOrZero(leg?.duration) * 1.35;
}

export function haversineDistanceMeters(a, b) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const radius = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function geocodeCenter(address) {
  const params = new URLSearchParams({
    q: address,
    limit: '1',
    returntruegeometry: 'false',
  });
  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`Géocodage indisponible (${response.status})`);
  const data = await response.json();
  const feature = data?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!feature || !Array.isArray(coordinates)) throw new Error('Adresse introuvable');
  const [lon, lat] = coordinates;
  return {
    label: feature.properties?.label || address,
    lat,
    lon,
  };
}

function summarize(itinerary) {
  const legs = Array.isArray(itinerary?.legs) ? itinerary.legs : [];
  const durationSeconds = numberOrZero(itinerary?.duration);
  if (!durationSeconds || !legs.length) return null;

  const transitLegs = legs.filter((leg) => leg.mode && TRANSIT_MODES.has(leg.mode));
  if (!transitLegs.length) return null;

  const walkLegs = legs.filter((leg) => leg.mode === 'WALK');
  const walkingSeconds = walkLegs.reduce((sum, leg) => sum + numberOrZero(leg.duration), 0);
  const walkingMeters = walkLegs.reduce((sum, leg) => sum + legDistance(leg), 0);

  const first = legs[0];
  const last = legs[legs.length - 1];
  const startWalkSeconds = first?.mode === 'WALK' ? numberOrZero(first.duration) : 0;
  const endWalkSeconds = last?.mode === 'WALK' ? numberOrZero(last.duration) : 0;
  const startWalkMeters = first?.mode === 'WALK' ? legDistance(first) : 0;
  const endWalkMeters = last?.mode === 'WALK' ? legDistance(last) : 0;

  const walkingMinutes = walkingSeconds / 60;
  const startWalkMinutes = startWalkSeconds / 60;
  const endWalkMinutes = endWalkSeconds / 60;
  const transferWalkMinutes = Math.max(0, walkingMinutes - startWalkMinutes - endWalkMinutes);
  const durationMinutes = durationSeconds / 60;
  const transfers = Math.max(0, Math.round(numberOrZero(itinerary.transfers)));
  const transportCount = transitLegs.length;
  const lines = transitLegs
    .map((leg) => leg.routeShortName || leg.displayName || leg.mode || '')
    .filter(Boolean)
    .filter((line, index, all) => index === 0 || line !== all[index - 1]);

  const preferenceCost =
    durationMinutes * 0.45 +
    (startWalkMinutes + endWalkMinutes) * 1.8 +
    transferWalkMinutes * 1.2 +
    transfers * 12 +
    Math.max(0, transportCount - 1) * 5;

  return {
    durationMinutes,
    transfers,
    transportCount,
    walkingMinutes,
    walkingMeters,
    startWalkMinutes,
    startWalkMeters,
    endWalkMinutes,
    endWalkMeters,
    transferWalkMinutes,
    lines,
    preferenceCost,
  };
}

export async function findRecommendedJourney(origin, destination) {
  const params = new URLSearchParams({
    fromPlace: `${origin.lat},${origin.lon}`,
    toPlace: `${destination.lat},${destination.lon}`,
    transitModes: DEFAULT_MODES.join(','),
    preTransitModes: 'WALK',
    postTransitModes: 'WALK',
    directModes: '',
    maxTransfers: '4',
    maxPreTransitTime: '1200',
    maxPostTransitTime: '1200',
    timetableView: 'true',
    numItineraries: '5',
    maxItineraries: '8',
    detailedLegs: 'false',
    detailedTransfers: 'false',
    joinInterlinedLegs: 'true',
  });

  const response = await fetch(`${PLAN_URL}?${params.toString()}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Calcul transport indisponible (${response.status})`);

  const data = await response.json();
  const choices = (Array.isArray(data?.itineraries) ? data.itineraries : [])
    .map(summarize)
    .filter(Boolean)
    .sort((a, b) => a.preferenceCost - b.preferenceCost);

  if (!choices.length) throw new Error('Aucun itinéraire en transport trouvé actuellement.');
  return choices[0];
}

export function recommendationScore(journey, directDistanceMeters) {
  const distancePenalty = (directDistanceMeters / 1000) * 0.35;
  const rankingCost = journey.preferenceCost + distancePenalty;
  return Math.max(1, Math.round(100 - rankingCost * 0.72));
}

export function recommendationLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Très bon';
  if (score >= 50) return 'Bon';
  return 'Correct';
}

export function formatTravelMinutes(value) {
  return Math.max(0, Math.round(value)) + ' min';
}

export function formatTravelDistance(value) {
  return value < 1000 ? Math.round(value) + ' m' : (value / 1000).toFixed(1) + ' km';
}
