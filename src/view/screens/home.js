// Tab roots « Accueil » and « Réviser ». Each screen fills the view object `v` from the kit `k` (see ../kit.js).
import { ic } from '../../Icon.jsx';
import { THEMES, fmt } from '../../constants.js';
import { plural } from '../../utils.js';
import { smartPlan, secondsLeft } from '../../stats.js';
import { isIOS, isStandalone } from '../../install.js';

export function home(v, k) {
  const { app, s, st, bank, P, O, ex, exMin, nErr } = k;
  const plan = app.memo('plan', [bank, P.stats, st.goal, app.minute()], () => smartPlan(bank, P, Math.max(5, st.goal))), q = P.quiz;
  const fresh = (n) => n + (n > 1 ? ' nouvelles' : ' nouvelle');
  const planSub = plan.dueNow && plan.freshNow ? plan.dueNow + ' à revoir · ' + fresh(plan.freshNow)
    : plan.dueNow ? plural(plan.dueNow, 'question') + ' à revoir'
      : plan.freshNow ? fresh(plan.freshNow) + (plan.freshNow > 1 ? ' questions' : ' question')
        : 'Tout est à jour · ' + plural(plan.size, 'question');
  const cta = q
    ? { label: 'Reprendre le test', sub: q.title + ' · question ' + (q.idx + 1) + ' / ' + q.qs.length + (q.timed ? ' · ' + fmt(secondsLeft(q)) : ''), onClick: () => app.resumeQuiz() }
    : { label: O.seen ? 'Continuer ma révision' : 'Commencer ma préparation', sub: 'Révision intelligente : ' + planSub, onClick: () => app.startQuiz('smart') };
  v.home = {
    prep: O.pct + ' %', prepW: O.pct + '%', prepName: bank.name, chev: ic('chevR', 16, 2), onPrep: () => app.openSheet('prep'),
    goal: 'Objectif du jour : ' + O.today + ' / ' + st.goal + ' questions' + (O.today >= st.goal ? ' ✓' : '') + (O.streak ? ' · Série : ' + plural(O.streak, 'jour') : ''),
    ctaLabel: cta.label, ctaSub: cta.sub, onCta: cta.onClick,
    install: !isStandalone() && (s.installable || isIOS()) && !st.installDismissed ? { icon: ic('download', 22), onInstall: () => app.install(), onDismiss: () => app.setS('installDismissed', true, false), close: ic('x', 18, 2) } : null,
    tiles: [
      { label: 'Examen blanc', sub: ex + ' questions • ' + exMin + ' min', icon: ic('clipboard'), onClick: () => app.push({ s: 'examIntro' }) },
      { label: 'Quiz rapide', sub: '5 à ' + Math.min(40, O.total) + ' questions', icon: ic('zap'), onClick: () => app.openSheet('count') },
      { label: 'Mes erreurs', sub: nErr ? nErr + ' à revoir' : 'Aucune erreur', icon: ic('rotate'), badge: nErr || null, onClick: () => app.push({ s: 'errors' }) },
      { label: 'Révision intelligente', sub: planSub, icon: ic('sparkles'), onClick: () => app.startQuiz('smart') },
    ],
  };
  if (k.weak.length) v.groups = [k.G('À travailler aujourd’hui', k.weak.map(k.themeRow))];
}

export function revise(v, k) {
  const { app, bank, P, TS, row, nErr } = k;
  const nTraps = app.memo('traps', [bank], () => bank.questions.filter((q) => q.trap).length);
  v.largeTitle = 'Réviser';
  v.groups = [
    k.G('Thèmes', THEMES.filter((t) => TS[t.id].total).map(k.themeRow)),
    k.G('Révision rapide', [
      row({ icon: 'rotate', title: 'Mes erreurs', value: String(nErr), chev: true, onClick: () => app.push({ s: 'errors' }) }),
      row({ icon: 'star', title: 'Mes favoris', value: String(P.favs.length), chev: true, onClick: () => app.push({ s: 'favs' }) }),
      row({ icon: 'alert', title: 'Questions pièges', value: String(nTraps), chev: true, onClick: () => app.push({ s: 'traps' }) }),
      row({ icon: 'calendar', title: 'Dates à retenir', chev: true, onClick: () => app.push({ s: 'dates' }) }),
      row({ icon: 'layers', title: 'Flashcards', chev: true, onClick: () => app.pushFlash({}) }),
      row({ icon: 'scroll', title: 'Chiffres romains', sub: 'Ve République, XVe siècle, Louis XIV…', chev: true, onClick: () => app.push({ s: 'roman' }) }),
    ]),
  ];
}
