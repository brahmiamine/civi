// Everything is saved on the device, in separate keys so that frequent writes (a running quiz) stay small:
//   civi:settings        device-wide settings + the active preparation
//   civi:profile:<prep>  stats, errors, favourites, history, daily activity and preferences of one preparation
//   civi:quiz:<prep>     the quiz/exam in progress for that preparation
// Whatever is read back is normalised: a corrupted or outdated value must never crash the app.
import { emptyProfile } from './stats.js';

const PREFIX = 'civi:';
const SETTINGS = 'civi:settings';
const PROFILE = 'civi:profile:';
const QUIZ = 'civi:quiz:';
const LEGACY = 'test-civique:v1';
const LEGACY_PREP = { 'Carte de séjour pluriannuelle': 'carte-sejour-pluriannuelle', 'Carte de résident': 'carte-resident', Naturalisation: 'naturalisation' };
const EXPORT_FORMAT = 'civi-sauvegarde';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — the app keeps working in memory */
  }
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const obj = (v) => (isObj(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const idx = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

function normStats(v) {
  const out = {};
  Object.entries(obj(v)).forEach(([id, s]) => {
    if (!isObj(s) || !isNum(s.n) || !isNum(s.ok)) return;
    out[id] = { n: s.n, ok: Math.min(s.ok, s.n), s: isNum(s.s) ? s.s : 0, b: isNum(s.b) ? s.b : 0, t: isNum(s.t) ? s.t : 0, d: isNum(s.d) ? s.d : 0 };
  });
  return out;
}

function normHistory(v) {
  return arr(v).filter((h) => isObj(h) && isNum(h.id) && isNum(h.score) && isNum(h.total) && h.total > 0).map((h) => ({
    ...h,
    at: isNum(h.at) ? h.at : h.id,
    title: typeof h.title === 'string' ? h.title : 'Test',
    answered: isNum(h.answered) ? h.answered : h.total,
    used: isNum(h.used) ? h.used : null,
    passed: !!h.passed,
    wrong: arr(h.wrong).filter((w) => isObj(w) && typeof w.id === 'string').map((w) => ({ id: w.id, chosen: idx(w.chosen) })),
    themes: obj(h.themes),
  }));
}

function normDays(v) {
  const out = {};
  Object.entries(obj(v)).forEach(([k, n]) => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isNum(n)) out[k] = n; });
  return out;
}

// A quiz is only kept if it is complete enough to be displayed and resumed.
function normQuiz(q) {
  if (!isObj(q) || !Array.isArray(q.qs) || !q.qs.length || !q.qs.every((id) => typeof id === 'string')) return null;
  if (!Number.isInteger(q.idx) || q.idx < 0 || q.idx >= q.qs.length) return null;
  const answers = arr(q.answers).filter((a) => isObj(a) && typeof a.id === 'string');
  if (q.validated && !answers.length) return null;
  return {
    ...q, answers, orders: obj(q.orders), sel: idx(q.sel), validated: !!q.validated, timed: !!q.timed,
    title: typeof q.title === 'string' ? q.title : 'Test', limit: isNum(q.limit) ? q.limit : 0,
    timeLeft: isNum(q.timeLeft) ? q.timeLeft : 0, endsAt: isNum(q.endsAt) ? q.endsAt : 0,
  };
}

export function normProfile(p, quiz) {
  p = obj(p);
  return {
    ...emptyProfile(),
    stats: normStats(p.stats),
    errors: arr(p.errors).filter((e) => isObj(e) && typeof e.id === 'string').map((e) => ({ id: e.id, chosen: idx(e.chosen) })),
    favs: arr(p.favs).filter((id) => typeof id === 'string'),
    history: normHistory(p.history),
    days: normDays(p.days),
    settings: obj(p.settings),
    quiz: normQuiz(quiz),
  };
}

// Returns null on first launch.
export function loadSettings() {
  const s = read(SETTINGS);
  if (isObj(s)) return s;
  const old = read(LEGACY);
  if (!isObj(old?.settings)) return null;
  // The first version stored demo errors against another question bank: only the settings are kept.
  const { prep, ...rest } = old.settings;
  return { ...rest, prep: LEGACY_PREP[prep] };
}

export const saveSettings = (s) => write(SETTINGS, s);

export const loadProfile = (id) => normProfile(read(PROFILE + id), read(QUIZ + id));

export function saveProfile(id, p) {
  const { quiz, ...data } = p;
  write(PROFILE + id, data);
}

export const saveQuiz = (id, quiz) => write(QUIZ + id, quiz);

// Asks the browser not to evict the saved progress (Safari may otherwise clear it after 7 days without a visit).
export function persistStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* not supported */
  }
}

function civiKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k); }
  } catch {
    /* storage unavailable */
  }
  return keys;
}

// Backup of every preparation (settings, profiles, tests in progress) as a JSON file.
export function exportData(version) {
  const data = {};
  civiKeys().forEach((k) => { const v = read(k); if (v != null) data[k] = v; });
  const json = JSON.stringify({ format: EXPORT_FORMAT, version, at: new Date().toISOString(), data }, null, 1);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'civi-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Replaces the saved data with a backup. Throws a user-facing message when the file is not a Civi backup.
export async function importData(file) {
  let j;
  try {
    j = JSON.parse(await file.text());
  } catch {
    throw new Error('Fichier illisible');
  }
  if (!isObj(j) || j.format !== EXPORT_FORMAT || !isObj(j.data)) throw new Error('Ce fichier n’est pas une sauvegarde Civi');
  const entries = Object.entries(j.data).filter(([k, v]) => k.startsWith(PREFIX) && v != null);
  if (!entries.length) throw new Error('Sauvegarde vide');
  clearData();
  entries.forEach(([k, v]) => write(k, v));
}

export function clearData() {
  civiKeys().forEach((k) => write(k, null));
}
