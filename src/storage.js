// Everything is saved on the device, in separate keys so that frequent writes (a running quiz) stay small:
//   civi:settings        device-wide settings + the active preparation
//   civi:profile:<prep>  stats, errors, favourites, history, daily activity and preferences of one preparation
//   civi:quiz:<prep>     the quiz/exam in progress for that preparation
import { emptyProfile } from './stats.js';

const SETTINGS = 'civi:settings';
const PROFILE = 'civi:profile:';
const QUIZ = 'civi:quiz:';
const LEGACY = 'test-civique:v1';
const LEGACY_PREP = { 'Carte de séjour pluriannuelle': 'carte-sejour-pluriannuelle', 'Carte de résident': 'carte-resident', Naturalisation: 'naturalisation' };

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

// Returns null on first launch.
export function loadSettings() {
  const s = read(SETTINGS);
  if (s) return s;
  const old = read(LEGACY);
  if (!old?.settings) return null;
  // The first version stored demo errors against another question bank: only the settings are kept.
  const { prep, ...rest } = old.settings;
  return { ...rest, prep: LEGACY_PREP[prep] };
}

export const saveSettings = (s) => write(SETTINGS, s);

export function loadProfile(id) {
  const p = read(PROFILE + id) || {};
  const base = emptyProfile();
  return { ...base, ...p, stats: p.stats || {}, days: p.days || {}, settings: p.settings || {}, quiz: read(QUIZ + id) };
}

export function saveProfile(id, p) {
  const { quiz, ...data } = p;
  write(PROFILE + id, data);
}

export const saveQuiz = (id, quiz) => write(QUIZ + id, quiz);
