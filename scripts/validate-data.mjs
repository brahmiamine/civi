// Checks the question banks of src/data/ before a build: `npm run validate:data`.
// Errors (exit code 1): invalid question, unknown theme, bad correct answer, duplicated id or duplicated question text,
// a lot reusing a bank id with a different wording, identical answers.
// Errors also: the right answer on the same letter in more than 50 % of the questions.
// Warnings: missing explanation, answer position bias above 40 %, empty preparation.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = new URL('../src/data/', import.meta.url).pathname;
const THEMES = ['valeurs', 'institutions', 'droits', 'histoire', 'societe'];
const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
const POOL = ['questions', 'pieges', 'situations'];
const errors = [], warnings = [];
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function correctIndex(v, n) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v < n ? v : -1;
  if (typeof v === 'string') { const i = LET.indexOf(v.trim().toUpperCase()); return i < n ? i : -1; }
  return -1;
}

const folders = readdirSync(DATA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
let total = 0;

for (const prep of folders) {
  const dir = join(DATA, prep);
  if (existsSync(join(dir, 'profil.json'))) {
    try { JSON.parse(readFileSync(join(dir, 'profil.json'), 'utf8')); } catch (e) { errors.push(prep + '/profil.json : JSON invalide (' + e.message + ')'); }
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'profil.json').map((f) => f.replace(/\.json$/, ''));
  files.sort((a, b) => (POOL.includes(b) - POOL.includes(a)) || a.localeCompare(b, 'fr', { numeric: true }));
  const byId = new Map(), byText = new Map(), letters = {};
  let count = 0;
  for (const name of files) {
    const where = prep + '/' + name + '.json';
    let file;
    try { file = JSON.parse(readFileSync(join(dir, name + '.json'), 'utf8')); } catch (e) { errors.push(where + ' : JSON invalide (' + e.message + ')'); continue; }
    const list = Array.isArray(file) ? file : file?.questions;
    if (!Array.isArray(list)) { errors.push(where + ' : pas de tableau « questions »'); continue; }
    list.forEach((raw, i) => {
      const at = where + ' #' + (i + 1);
      const id = raw?.id != null ? String(raw.id) : name + '-' + (i + 1);
      const t = raw?.theme ?? raw?.t ?? file.theme ?? file.t;
      const q = raw?.question ?? raw?.q;
      const a = raw?.reponses ?? raw?.answers ?? raw?.r;
      const x = raw?.explication ?? raw?.explanation ?? raw?.x;
      if (!THEMES.includes(t)) return errors.push(at + ' (' + id + ') : thème inconnu « ' + t + ' »');
      if (!q || typeof q !== 'string') return errors.push(at + ' (' + id + ') : question manquante');
      if (!Array.isArray(a) || a.length < 2 || a.length > LET.length || a.some((r) => typeof r !== 'string' || !r.trim())) return errors.push(at + ' (' + id + ') : il faut entre 2 et 6 réponses non vides');
      const c = correctIndex(raw.bonne_reponse ?? raw.correct ?? raw.c, a.length);
      if (c < 0) return errors.push(at + ' (' + id + ') : bonne_reponse invalide');
      if (new Set(a.map(norm)).size !== a.length) errors.push(at + ' (' + id + ') : deux réponses identiques');
      if (!x) warnings.push(at + ' (' + id + ') : pas d’explication');
      const prev = byId.get(id);
      if (prev) {
        if (POOL.includes(name)) errors.push(at + ' : identifiant « ' + id + ' » déjà utilisé dans ' + prev.where);
        else if (norm(prev.q) !== norm(q)) errors.push(at + ' : l’identifiant « ' + id + ' » reprend ' + prev.where + ' avec un autre énoncé');
        return;
      }
      const dup = byText.get(norm(q));
      if (dup) errors.push(at + ' (' + id + ') : même énoncé que « ' + dup.id + ' » (' + dup.where + ') — réutilise son identifiant');
      byId.set(id, { where: at, q }); byText.set(norm(q), { id, where: at });
      letters[a.length] = letters[a.length] || Array(a.length).fill(0);
      letters[a.length][c]++;
      count++;
    });
  }
  total += count;
  if (!count) { warnings.push(prep + ' : aucune question (préparation masquée dans l’application)'); continue; }
  Object.entries(letters).forEach(([n, row]) => {
    const sum = row.reduce((s, v) => s + v, 0), max = Math.max(...row);
    if (sum >= 20 && max / sum > 0.4) {
      // Above 50 % it is an error: it usually means a file was edited from an old copy (answers not balanced).
      (max / sum > 0.5 ? errors : warnings).push(prep + ' : la bonne réponse est « ' + LET[row.indexOf(max)] + ' » dans ' + Math.round((max / sum) * 100) + ' % des questions à ' + n + ' réponses (' + row.map((v, i) => LET[i] + '=' + v).join(' ') + '). Sans « Mélanger les réponses », c’est devinable.');
    }
  });
  console.log('✓ ' + prep + ' : ' + count + ' questions');
}

warnings.forEach((w) => console.warn('⚠ ' + w));
errors.forEach((e) => console.error('✗ ' + e));
console.log(total + ' questions, ' + errors.length + ' erreur(s), ' + warnings.length + ' avertissement(s)');
if (errors.length) process.exit(1);
