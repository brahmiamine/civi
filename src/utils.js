import { EXAM_SECONDS } from './constants.js';

// The official exam gives 45 minutes for 40 questions; shorter tests get proportional time.
export const examMinutes = (n) => Math.max(1, Math.round((EXAM_SECONDS / 60) * (n / 40)));
export const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');
export const fmtWhen = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
export const bestOf = (list) => list.reduce((b, h) => (!b || h.score / h.total > b.score / b.total ? h : b), null);

