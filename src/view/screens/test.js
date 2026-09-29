// « Tester » tab and everything around a test: lots, mock exam intro, the test in progress, results, history.
import { ic } from '../../Icon.jsx';
import { THEMES, fmt } from '../../constants.js';
import { plural, fmtWhen, bestOf, examMinutes } from '../../utils.js';
import { isMastered, hardPool, passMark, secondsLeft } from '../../stats.js';
import { MAX_POOL_QUIZ, answeredCount } from '../../quiz.js';

export function test(v, k) {
  const { app, bank, P, O, row, ex, exMin } = k;
  v.largeTitle = 'Tester';
  v.testHero = { sub: ex + ' questions • ' + exMin + ' min', pass: 'Seuil de réussite : ' + passMark(ex) + ' / ' + ex, onStart: () => app.push({ s: 'examIntro' }) };
  const nHard = app.memo('hard', [bank, P.stats], () => hardPool(bank, P).length);
  if (P.quiz) v.groups.push(k.G('En cours', [k.resumeRow()]));
  v.groups.push(k.G('Entraînement libre', [
    row({ icon: 'zap', title: 'Quiz rapide', sub: '5 à ' + Math.min(40, O.total) + ' questions au hasard', chev: true, onClick: () => app.openSheet('count') }),
    row({ icon: 'book', title: 'Quiz par thème', sub: '5 thématiques officielles', chev: true, onClick: () => app.openSheet('theme') }),
    row({ icon: 'flame', title: 'Questions difficiles', sub: nHard ? Math.min(nHard, MAX_POOL_QUIZ) + ' questions parmi ' + nHard + ' · pièges et questions souvent ratées' : 'Aucune pour l’instant', chev: true, onClick: () => app.startQuiz('hard') }),
  ]));
  v.groups.push(k.G('Lots de questions', bank.lots.map((L) => {
    const best = bestOf(P.history.filter((h) => h.lot === L.id));
    return row({ icon: 'layers', title: L.title, sub: plural(L.qs.length, 'question') + ' · ' + (best ? 'meilleur score ' + best.score + ' / ' + best.total : 'jamais testé'), chev: true, onClick: () => app.push({ s: 'lot', id: L.id }) });
  })));
}

export function lot(v, k) {
  const { app, c, bank, P, row } = k;
  const L = bank.lots.find((l) => l.id === c.id);
  if (!L) { v.empty = k.emptyState('alert', 'Lot introuvable', 'Ce lot n’existe plus.'); return; }
  v.bar.title = L.title; v.intro = L.description || null;
  const runs = P.history.filter((h) => h.lot === L.id), best = bestOf(runs), counts = {};
  L.qs.forEach((id) => { const t = k.qById(id).t; counts[t] = (counts[t] || 0) + 1; });
  const mastered = L.qs.filter((id) => isMastered(P.stats[id])).length;
  const sc = (h) => (h ? h.score + ' / ' + h.total : '–');
  v.groups = [
    k.G('Contenu · ' + plural(L.qs.length, 'question'), THEMES.filter((t) => counts[t.id]).map((t) => row({ icon: t.icon, title: t.name, value: String(counts[t.id]) }))),
    k.G('Tes résultats', [row({ title: 'Questions maîtrisées', stat: mastered + ' / ' + L.qs.length }), row({ title: 'Tentatives', stat: String(runs.length) }), row({ title: 'Meilleur score', stat: sc(best) }), row({ title: 'Dernier score', stat: sc(runs[0]) })]),
    k.G('Autres façons de s’entraîner', [
      row({ icon: 'clock', title: 'En conditions d’examen', sub: 'Chronométré · ' + examMinutes(L.qs.length) + ' min · correction à la fin', chev: true, onClick: () => app.startQuiz('lot', { id: L.id, timed: true }) }),
      row({ icon: 'layers', title: 'Flashcards du lot', chev: true, onClick: () => app.pushFlash({ lot: L.id }) }),
    ]),
  ];
  v.sticky = k.primary('Lancer ce lot', () => app.startQuiz('lot', { id: L.id }));
}

export function examIntro(v, k) {
  const { app, st, P, row, ex, exMin } = k;
  v.intro = 'Mets-toi dans les conditions de l’examen officiel. La correction s’affiche à la fin.';
  v.groups = [k.G('Déroulement', [
    row({ icon: 'clipboard', title: ex + ' questions à choix multiples', sub: 'Réparties selon les 5 thèmes officiels' }),
    row({ icon: 'clock', title: exMin + ' minutes chronométrées' }),
    row({ icon: 'target', title: passMark(ex) + ' bonnes réponses pour réussir' }),
    row({ icon: 'chevL', title: 'Tu peux revenir en arrière', sub: 'Passe d’une question à l’autre et change tes réponses jusqu’à ce que tu termines le test' }),
    row({ icon: 'download', title: 'Progression sauvegardée', sub: 'Tu peux quitter et reprendre plus tard, mais le chrono continue de tourner, comme à l’examen' }),
    st.auto && row({ icon: 'rotate', title: 'Tes erreurs sont ajoutées à ta liste de révision' }),
  ].filter(Boolean))];
  if (P.quiz) v.groups.push(k.G('En cours', [k.resumeRow()]));
  v.sticky = k.primary('Commencer l’examen', () => app.startQuiz('exam'));
}

// The test in progress. Instant correction: pick, validate, see the correction, next.
// Correction at the end: pick (or not), move freely with « Précédente » / « Suivante », then « Terminer le test ».
export function quiz(v, k) {
  const { app, P } = k;
  const z = P.quiz; if (!z) return;
  const id = z.qs[z.idx], q = k.qById(id); if (!q) return;
  const n = z.qs.length, last = z.idx + 1 >= n, left = secondsLeft(z);
  v.bar = { ...k.back, title: 'Question ' + (z.idx + 1) + ' / ' + n, backLabel: 'Quitter le test', star: k.favBtn(q.id) };
  const timer = { timer: z.timed ? fmt(left) : null, timerColor: z.timed && left < 300 ? 'var(--warn)' : 'var(--text)', clock: ic('clock', 16, 2) };
  if (z.instant) {
    v.quizBar = { pct: ((z.idx + (z.validated ? 1 : 0)) / n) * 100 + '%', mode: z.title, ...timer };
    const ans = z.validated ? z.answers[z.answers.length - 1] : null;
    const states = q.a.map((_, i) => (z.validated ? (i === q.c ? 'correct' : i === ans.chosen ? 'wrong' : 'dim') : z.sel === i ? 'selected' : 'normal'));
    const explain = z.validated ? { text: q.x, bulb: ic('bulb', 16), verdict: ans.ok ? 'Bonne réponse' : 'Mauvaise réponse', vColor: ans.ok ? 'var(--success)' : 'var(--error)', vIcon: ic(ans.ok ? 'check' : 'x', 20, 2.5) } : null;
    v.qv = k.questionView(q, states, (i) => app.select(i), z.validated, explain, z.orders[id]);
    const label = z.validated ? (last ? 'Voir le résultat' : 'Question suivante') : 'Valider';
    const off = !z.validated && z.sel == null;
    v.sticky = k.primary(label, () => app.primaryQuiz(), { disabled: off, op: off ? 0.45 : 1 });
    return;
  }
  const done = answeredCount(z), chosen = z.picks[id] ?? null;
  v.quizBar = { pct: (done / n) * 100 + '%', mode: z.title + ' · ' + done + ' / ' + n + ' répondues', ...timer };
  v.qv = k.questionView(q, q.a.map((_, i) => (i === chosen ? 'selected' : 'normal')), (i) => app.select(i), false, null, z.orders[id]);
  v.sticky = k.primary(last ? 'Terminer le test' : 'Question suivante', () => app.primaryQuiz(), {
    dir: 'row',
    secondary: z.idx > 0 ? k.secondary('Précédente', 'chevL', () => app.prevQ()) : null,
  });
}

export function result(v, k) {
  const { app, c, P, row } = k;
  const L = P.history.find((h) => h.id === c.hid);
  if (!L) { v.empty = k.emptyState('alert', 'Test introuvable', 'Ce test ne fait plus partie de ton historique.'); return; }
  const need = passMark(L.total), missing = L.total - L.answered;
  if (c.fresh) v.bar = { show: true, title: 'Résultat', backIcon: ic('x', 24), backLabel: 'Fermer', onBack: () => app.back() };
  v.res = {
    title: L.title + (c.fresh ? '' : ' · ' + fmtWhen(L.at)), score: L.score, total: L.total, verdict: L.passed ? 'Réussi' : 'Pas encore',
    vIcon: ic(L.passed ? 'check' : 'x', 16, 2.5), vBg: L.passed ? 'var(--successTint)' : 'var(--errorTint)', vColor: L.passed ? 'var(--success)' : 'var(--error)',
    msg: (L.passed ? 'Bravo, tu atteins le seuil de réussite.' : 'Il faut ' + need + ' bonnes réponses sur ' + L.total + ' pour réussir.') + (missing ? ' ' + plural(missing, 'question') + ' sans réponse.' : ''),
    stats: [{ v: L.score, l: 'Bonnes réponses' }, { v: L.total - L.score, l: 'Erreurs' }, { v: L.used != null ? fmt(L.used) : Math.round((L.score / L.total) * 100) + ' %', l: L.used != null ? 'Temps' : 'Réussite' }]
      .map((x, i) => ({ ...x, sep: i ? '1px solid var(--divider)' : 'none' })),
  };
  v.groups = [k.G('Par thème', THEMES.filter((t) => L.themes[t.id]).map((t) => { const [ok, n] = L.themes[t.id]; return row({ title: t.name, value: ok + ' / ' + n, pct: Math.round((ok / n) * 100) + '%' }); }))];
  const nw = L.wrong.length, review = () => app.push({ s: 'review', hid: L.id });
  if (c.fresh) {
    const home2 = { label: 'Retour à l’accueil', onClick: () => app.goHome(), order: 2, h: '46px', border: 'none', color: 'var(--primaryText)' };
    v.sticky = nw ? k.primary('Revoir mes erreurs (' + nw + ')', review, { secondary: home2 }) : k.primary('Terminer', () => app.back(), { secondary: home2 });
  } else if (nw) v.sticky = k.primary('Revoir mes erreurs (' + nw + ')', review);
}

export function review(v, k) {
  const { c, P } = k;
  const H = P.history.find((h) => h.id === c.hid);
  if (!H) { v.empty = k.emptyState('alert', 'Test introuvable', 'Ce test ne fait plus partie de ton historique.'); return; }
  const list = H.wrong.filter((w) => k.qById(w.id));
  if (list.length) v.groups = [k.G(null, list.map((w) => k.qRow(w.id, k.answerSub(w.pick, 'Sans réponse'), 'review', w.pick)))];
  else v.empty = k.emptyState('check', 'Aucune erreur', 'Tu as tout bon.', { ok: true, sw: 2 });
}

export function history(v, k) {
  const { app, c, P, row } = k;
  const exams = P.history.filter((h) => h.mode === 'exam');
  const f = c.filter || (exams.length || !P.history.length ? 'exam' : 'all');
  const list = f === 'exam' ? exams : P.history;
  v.chips = k.chips([['exam', 'Examens blancs (' + exams.length + ')'], ['all', 'Tous les tests (' + P.history.length + ')']], f, (id) => app.setTop({ filter: id }));
  if (list.length) v.groups = [k.G(null, list.map((h) => row({ title: h.title, sub: fmtWhen(h.at) + (h.used != null ? ' · ' + fmt(h.used) : ''), stat: h.score + ' / ' + h.total, badge: k.verdictBadge(h.passed), chev: true, onClick: () => app.push({ s: 'result', hid: h.id }) })))];
  else v.empty = k.emptyState('clipboard', f === 'exam' ? 'Aucun examen blanc' : 'Aucun test terminé', 'Tes résultats apparaîtront ici après chaque test terminé.', { btn: 'Passer un examen blanc', onBtn: () => app.push({ s: 'examIntro' }) });
}
