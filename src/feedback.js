// User feedback without a backend: e-mails go through Web3Forms, images through a Cloudinary unsigned preset.
// Both keys are public by design (they can only send mail to the owner / upload into restricted folders).
import { LET, APP_VERSION, thById } from './constants.js';

const WEB3FORMS_KEY = '8acd26cf-61e8-4f4c-9075-d0c2d884ba57';
export const BUG_REASONS = ['L’application plante ou se bloque', 'Problème d’affichage', 'Mauvais calcul (score, progression…)', 'Autre'];
export const REPORT_REASONS = ['Réponse incorrecte', 'Énoncé ambigu', 'Faute ou coquille', 'Information périmée', 'Autre'];
const context = () => ['Version : ' + APP_VERSION, 'Date : ' + new Date().toLocaleString('fr-FR'), 'Appareil : ' + navigator.userAgent, 'Écran : ' + window.innerWidth + '×' + window.innerHeight];
async function sendMail(subject, fromName, lines) {
  const j = await fetch('https://api.web3forms.com/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, from_name: fromName, message: lines.join('\n') }),
  }).then((r) => r.json());
  if (!j.success) throw new Error(j.message);
}
// Returns an error message for the toast, or null when the file can be sent.
// This is only a convenience check: the real limits (formats, size) are set on the Cloudinary upload presets.
export const checkImage = (file) => (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type) ? 'Choisis une photo (JPEG, PNG, WebP)' : file.size > 15e6 ? 'Image trop lourde (15 Mo max)' : null);

// Client-side brake against repeated sends: at least 20 s between two sends, 10 per day at most.
const RATE_KEY = 'civi-rate';
const sentTimes = () => {
  try { const v = JSON.parse(localStorage.getItem(RATE_KEY) || '[]'); return Array.isArray(v) ? v.filter((t) => typeof t === 'number' && Date.now() - t < 864e5) : []; } catch { return []; }
};
export function rateLimited() {
  const t = sentTimes();
  if (t.length && Date.now() - Math.max(...t) < 20e3) return 'Patiente quelques secondes avant un nouvel envoi';
  if (t.length >= 10) return 'Limite de 10 envois par jour atteinte';
  return null;
}
export function noteSent() {
  try { localStorage.setItem(RATE_KEY, JSON.stringify(sentTimes().concat([Date.now()]))); } catch { /* storage unavailable */ }
}

// ctx: { prep, where, mode, chosen (original answer index or null), revealed }. q is null for a general bug report.
export async function sendReport(ctx, q, reason, comment, img) {
  const imageUrl = img ? await uploadImage(img, CLOUDINARY.reportPreset) : null;
  const L = (i) => LET[i] + '. ' + q.a[i];
  const lines = ['=== SIGNALEMENT ===', 'Motif : ' + reason, 'Commentaire : ' + (comment || '—'), 'Capture : ' + (imageUrl || 'aucune'), ''];
  if (q) {
    const chosen = ctx.chosen == null ? 'pas encore répondu' : L(ctx.chosen) + (ctx.chosen === q.c ? ' (juste)' : ' (fausse)') + (ctx.shown && ctx.shown !== LET[ctx.chosen] ? ' — affichée en ' + ctx.shown + ' (réponses mélangées)' : '');
    lines.push(
      '=== QUESTION ===', 'Identifiant : ' + q.id, 'Préparation : ' + ctx.prep, 'Fichier : ' + (q.lot || '—') + '.json',
      'Thème : ' + thById(q.t).name, 'Type : ' + ([q.situation && 'mise en situation', q.trap && 'piège'].filter(Boolean).join(', ') || 'classique'), '',
      'Énoncé :', q.q, '', 'Réponses :', ...q.a.map((_, i) => L(i) + (i === q.c ? '  ✅ bonne réponse' : '')), '',
      'À retenir :', q.x || '—', '', '=== CONTEXTE ===', 'Écran : ' + ctx.where + (ctx.mode ? ' (' + ctx.mode + ')' : ''), 'Réponse choisie : ' + chosen,
      'Correction affichée : ' + (ctx.revealed ? 'oui' : 'non'),
    );
  } else lines.push('=== CONTEXTE ===', 'Préparation : ' + ctx.prep);
  lines.push(...context());
  const subject = 'Civi · ' + (q ? 'Signalement ' + q.id : 'Bug') + ' · ' + reason + (imageUrl ? ' · avec capture' : '');
  return sendMail(subject, 'Civi · ' + ctx.prep, lines);
}
// « Proposer une question » : optional image goes to Cloudinary (unsigned preset, folder civi-propositions), then the whole proposal is e-mailed via Web3Forms.
const CLOUDINARY = { cloud: 'dapzqelui', preset: 'civi_propositions', reportPreset: 'civi_signales' };
export const EMPTY_PROPOSAL = () => ({ kind: 'text', prep: null, theme: '', q: '', a: ['', '', '', ''], c: null, x: '', note: '', img: null, preview: null, sending: false });
// Shrinks photos before upload (max 1600 px, JPEG) to stay fast on mobile data and small on the free plan.
// Every upload is re-encoded this way: a file the browser cannot decode as an image is refused, never sent as is.
function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
async function uploadImage(file, preset) {
  const fd = new FormData(); fd.append('file', await shrinkImage(file)); fd.append('upload_preset', preset);
  const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY.cloud + '/image/upload', { method: 'POST', body: fd }).then((x) => x.json());
  if (!r.secure_url) throw new Error(r.error?.message || 'upload');
  return r.secure_url;
}
export async function sendProposal(p, prepName) {
  if (p.kind === 'image') p = { ...p, q: '', a: [], c: null, x: '' };
  else p = { ...p, img: null };
  const imageUrl = p.img ? await uploadImage(p.img, CLOUDINARY.preset) : null;
  const answers = p.a.map((t, i) => [t.trim(), i]).filter(([t]) => t);
  const lines = [
    '=== PROPOSITION DE QUESTION (' + (p.kind === 'image' ? 'image seulement' : 'question écrite') + ') ===', 'Préparation : ' + prepName, 'Thème : ' + (p.theme ? thById(p.theme).name : '—'), '',
    'Énoncé :', p.q.trim() || '—', '', 'Réponses :', ...(answers.length ? answers.map(([t, i]) => LET[i] + '. ' + t + (i === p.c ? '  ✅ bonne réponse' : '')) : ['—']), '',
    'À retenir :', p.x.trim() || '—', '', 'Commentaire :', p.note.trim() || '—', '', 'Image : ' + (imageUrl || 'aucune'), '',
    '=== CONTEXTE ===', ...context(),
  ];
  return sendMail('Civi · Proposition de question · ' + prepName + (imageUrl ? ' · avec image' : ''), 'Civi · ' + prepName, lines);
}
