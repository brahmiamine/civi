// « Progression » tab.
import { THEMES } from '../../constants.js';
import { plural } from '../../utils.js';

export function progress(v, k) {
  const { app, bank, P, O, TS, row, weak } = k;
  v.largeTitle = 'Progression';
  v.progHero = { label: O.pct + ' %', w: O.pct + '%', sub: 'Maîtrise · ' + bank.short };
  const best = O.best;
  const weakGroup = !O.seen
    ? k.G('Mes points faibles', [row({ icon: 'info', title: 'Pas encore de données', sub: 'Réponds à quelques questions : tes points faibles seront calculés à partir de tes résultats.' })])
    : weak.length
      ? k.G('Mes points faibles', weak.map((t) => row({ icon: 'alert', iconBg: 'var(--warnTint)', iconColor: 'var(--warn)', title: t.name, sub: t.pct + ' % maîtrisé' + (t.acc != null ? ' · ' + t.acc + ' % de bonnes réponses' : ' · pas encore travaillé'), chev: true, onClick: () => app.pushTheme(t.id) })), { label: 'Travailler mes points faibles', onClick: () => app.startQuiz('weak') })
      : k.G('Mes points faibles', [row({ icon: 'check', iconBg: 'var(--successTint)', iconColor: 'var(--success)', title: 'Aucun point faible', sub: 'Tous les thèmes sont maîtrisés.' })]);
  v.groups = [
    k.G(null, [
      row({ title: 'Questions maîtrisées', stat: O.mastered + ' / ' + O.total }),
      row({ title: 'Questions déjà vues', stat: O.seen + ' / ' + O.total }),
      row({ title: 'Bonnes réponses', sub: O.attempts ? plural(O.attempts, 'réponse') + ' au total' : null, stat: O.accuracy != null ? O.accuracy + ' %' : '–' }),
      row({ title: 'Examens blancs réalisés', sub: O.exams ? plural(O.passed, 'réussi') : null, stat: String(O.exams) }),
      row({ title: 'Meilleur score à l’examen', stat: best ? best.score + ' / ' + best.total : '–' }),
      row({ title: 'Série de révision', stat: plural(O.streak, 'jour') }),
    ]),
    k.G('Progression par thème', THEMES.filter((t) => TS[t.id].total).map((t) => row({ title: t.name, sub: TS[t.id].acc != null ? TS[t.id].acc + ' % de bonnes réponses' : 'Pas encore travaillé', value: k.pct(t) + ' %', pct: k.pct(t) + '%', chev: true, onClick: () => app.pushTheme(t.id) }))),
    weakGroup,
    k.G(null, [row({ icon: 'clock', title: 'Historique', sub: plural(O.exams, 'examen blanc') + ' · ' + plural(P.history.length, 'test') + ' au total', chev: true, onClick: () => app.push({ s: 'history' }) })]),
  ];
}
