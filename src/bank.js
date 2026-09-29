// Loads the question banks from src/data/.
// Each folder is a preparation type (profile): an optional profil.json plus one JSON file per lot of questions.
// Files are bundled at build time, so adding a lot only requires dropping a JSON file in the right folder.
import { THEMES, LET } from './constants.js';

const profileFiles = import.meta.glob('./data/*/profil.json', { eager: true, import: 'default' });
const lotFiles = import.meta.glob('./data/*/*.json', { eager: true, import: 'default' });

const THEME_IDS = new Set(THEMES.map((t) => t.id));
const byName = (a, b) => a.localeCompare(b, 'fr', { numeric: true });
const folderOf = (path) => path.split('/')[2];
const fileOf = (path) => path.split('/')[3].replace(/\.json$/, '');

// Accepts "B", "b", or a 0-based index.
function correctIndex(v, n) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v < n ? v : -1;
  if (typeof v === 'string') { const i = LET.indexOf(v.trim().toUpperCase()); return i < n ? i : -1; }
  return -1;
}

function normQuestion(raw, where) {
  const q = {
    id: raw.id != null ? String(raw.id) : null,
    t: raw.theme,
    q: raw.question,
    a: raw.reponses ?? raw.answers,
    x: raw.explication ?? raw.explanation ?? '',
    trap: !!(raw.piege ?? raw.trap),
    situation: !!raw.situation,
  };
  const problem =
    !q.id ? 'id manquant'
    : !THEME_IDS.has(q.t) ? 'thème inconnu « ' + q.t + ' »'
    : !q.q ? 'question manquante'
    : !Array.isArray(q.a) || q.a.length < 2 || q.a.length > LET.length ? 'il faut entre 2 et ' + LET.length + ' réponses'
    : null;
  if (problem) { console.warn('[Civi] Question ignorée (' + where + ') : ' + problem, raw); return null; }
  q.c = correctIndex(raw.bonne_reponse ?? raw.correct, q.a.length);
  if (q.c < 0) { console.warn('[Civi] Question ignorée (' + where + ') : bonne_reponse invalide', raw); return null; }
  return q;
}

function buildPreps() {
  const folders = new Set(Object.keys(lotFiles).map(folderOf));
  const preps = [];
  folders.forEach((id) => {
    const meta = profileFiles['./data/' + id + '/profil.json'] || {};
    const questions = [], byId = new Map(), lots = [];
    Object.keys(lotFiles)
      .filter((p) => folderOf(p) === id && fileOf(p) !== 'profil')
      .sort(byName)
      .forEach((path) => {
        const file = lotFiles[path], lotId = fileOf(path);
        const list = Array.isArray(file) ? file : file?.questions;
        if (!Array.isArray(list)) { console.warn('[Civi] Lot ignoré, pas de tableau « questions » : ' + path); return; }
        const qs = [];
        list.forEach((raw, i) => {
          const q = normQuestion(raw || {}, path + ' #' + (i + 1));
          if (!q) return;
          if (byId.has(q.id)) { console.warn('[Civi] Identifiant en double « ' + q.id + ' » ignoré dans ' + path); return; }
          q.lot = lotId; byId.set(q.id, q); questions.push(q); qs.push(q.id);
        });
        if (qs.length) lots.push({ id: lotId, title: file.titre ?? file.title ?? lotId, description: file.description ?? '', qs });
      });
    if (!questions.length) return;
    const facts = {};
    THEMES.forEach((t) => { facts[t.id] = meta.essentiel?.[t.id] ?? []; });
    const name = meta.nom ?? id;
    preps.push({
      id, name, short: meta.court ?? name, description: meta.description ?? '', order: meta.ordre ?? 99,
      initials: meta.initiales ?? name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
      facts, dates: meta.dates ?? [], lots, questions, byId,
    });
  });
  return preps.sort((a, b) => a.order - b.order || byName(a.name, b.name));
}

export const PREPS = buildPreps();
export const prepById = (id) => PREPS.find((p) => p.id === id) || PREPS[0];
export const hasPrep = (id) => PREPS.some((p) => p.id === id);
