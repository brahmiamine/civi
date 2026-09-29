// Loads the question banks from src/data/.
// Each folder is a preparation type (profile): an optional profil.json plus one JSON file per lot of questions.
// Files are bundled at build time, so adding a lot only requires dropping a JSON file in the right folder.
import { THEMES, LET } from './constants.js';

const profileFiles = import.meta.glob('./data/*/profil.json', { eager: true, import: 'default' });
// Question files are separate chunks (lazy loaders); they are all fetched once at startup and cached offline by the service worker.
const lotLoaders = import.meta.glob(['./data/*/*.json', '!./data/*/profil.json'], { import: 'default' });
const lotFiles = Object.fromEntries(await Promise.all(Object.entries(lotLoaders).map(async ([path, load]) => [path, await load()])));

// Bank files (read first). Questions that only appear in a lot-*.json also join the bank, so that everything
// the learner answers counts in the progress and the revisions — but they are kept out of the mock exam.
const POOL = { questions: {}, pieges: { piege: true }, situations: { situation: true } };

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

// Long keys (theme, question, reponses…) and compact ones (t, q, r, c, x, p, s) are both accepted.
// `defaults` comes from the file (theme, piege, situation); a missing id becomes « <fichier>-<n> ».
function normQuestion(raw, where, defaults = {}, autoId = null) {
  const q = {
    id: raw.id != null ? String(raw.id) : autoId,
    t: raw.theme ?? raw.t ?? defaults.theme,
    q: raw.question ?? raw.q,
    a: raw.reponses ?? raw.answers ?? raw.r,
    x: raw.explication ?? raw.explanation ?? raw.x ?? '',
    trap: !!(raw.piege ?? raw.trap ?? raw.p ?? defaults.piege),
    situation: !!(raw.situation ?? raw.s ?? defaults.situation),
  };
  const problem =
    !q.id ? 'id manquant'
    : !THEME_IDS.has(q.t) ? 'thème inconnu « ' + q.t + ' »'
    : !q.q ? 'question manquante'
    : !Array.isArray(q.a) || q.a.length < 2 || q.a.length > LET.length ? 'il faut entre 2 et ' + LET.length + ' réponses'
    : null;
  if (problem) { console.warn('[Civi] Question ignorée (' + where + ') : ' + problem, raw); return null; }
  q.c = correctIndex(raw.bonne_reponse ?? raw.correct ?? raw.c, q.a.length);
  if (q.c < 0) { console.warn('[Civi] Question ignorée (' + where + ') : bonne_reponse invalide', raw); return null; }
  return q;
}

function buildPreps() {
  const folders = new Set(Object.keys(lotFiles).map(folderOf));
  const preps = [];
  folders.forEach((id) => {
    const meta = profileFiles['./data/' + id + '/profil.json'] || {};
    const questions = [], byId = new Map(), lots = [];
    const paths = Object.keys(lotFiles).filter((p) => folderOf(p) === id && fileOf(p) !== 'profil').sort(byName);
    const listOf = (file) => (Array.isArray(file) ? file : file?.questions);
    // Bank files first (banque, pièges, situations), then the lots, which reuse a question when its id already exists.
    const load = (path, file, defaults, inPool) => {
      const list = listOf(file), name = fileOf(path), qs = [];
      if (!Array.isArray(list)) { console.warn('[Civi] Fichier ignoré, pas de tableau « questions » : ' + path); return qs; }
      const fileDefaults = { ...defaults, theme: file.theme ?? file.t };
      list.forEach((raw, i) => {
        const q = normQuestion(raw || {}, path + ' #' + (i + 1), fileDefaults, name + '-' + (i + 1));
        if (!q) return;
        if (byId.has(q.id)) {
          if (inPool) { console.warn('[Civi] Identifiant en double « ' + q.id + ' » ignoré dans ' + path); return; }
          qs.push(q.id); return;
        }
        q.lot = name; byId.set(q.id, q); qs.push(q.id); questions.push(q);
        if (!inPool) q.lotOnly = true; // counts in the progress and revisions, but is never drawn in the mock exam
      });
      return qs;
    };
    paths.filter((p) => POOL[fileOf(p)]).forEach((p) => load(p, lotFiles[p], POOL[fileOf(p)], true));
    paths.filter((p) => !POOL[fileOf(p)]).forEach((path) => {
      const file = lotFiles[path], qs = load(path, file, {}, false);
      if (qs.length) lots.push({ id: fileOf(path), title: file.titre ?? file.title ?? fileOf(path), description: file.description ?? '', qs });
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
