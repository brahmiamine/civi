// Bottom sheets (pickers, confirmations, report form): pure description of what <Sheet> renders for the current app state.
import { ic } from './Icon.jsx';
import { THEMES } from './constants.js';
import { PREPS } from './bank.js';
import { installHelp } from './install.js';
import { plural, examMinutes } from './utils.js';
import { BUG_REASONS, REPORT_REASONS } from './feedback.js';

export function sheetData(app) {
  const s = app.state, st = app.settings(), bank = app.bank(), P = app.prof(), TS = app.themeStatsOf(bank, P);
  const opt = (label, sub, sel, fn, icon) => ({ label, sub, onClick: fn, icon, check: sel ? ic('check', 20, 2) : null, color: sel ? 'var(--primaryText)' : 'var(--text)', weight: sel ? 600 : 500, bg: sel ? 'var(--tint)' : 'transparent' });
  const pick = (k, list) => list.map((o) => opt(o[1], o[2], st[k] === o[0], () => { app.setS(k, o[0]); app.closeSheet(); }));
  const n = bank.questions.length;
  switch (s.sheet) {
    case 'count': {
      const counts = [5, 10, 20, 40].filter((c) => c <= n);
      if (!counts.length || n < 40) counts.push(n);
      return { title: 'Quiz rapide', sub: 'Combien de questions ?', options: [...new Set(counts)].map((c) => opt(c === n ? 'Toutes les questions (' + c + ')' : c + ' questions', '≈ ' + Math.max(1, Math.round(c * 0.6)) + ' min', false, () => app.startQuiz('quick', c))) };
    }
    case 'theme': return { title: 'Quiz par thème', sub: 'Choisis un thème', options: THEMES.filter((t) => TS[t.id].total).map((t) => opt(t.name, TS[t.id].pct + ' % maîtrisé · ' + plural(TS[t.id].total, 'question'), false, () => app.startQuiz('theme', t.id), ic(t.icon))) };
    case 'quit': return { title: 'Quitter le test ?', sub: P.quiz?.timed ? 'Ta progression est sauvegardée, mais le chrono continue de tourner, comme à l’examen : reprends-le avant la fin du temps.' : 'Ta progression est sauvegardée sur cet appareil : tu pourras reprendre ce test plus tard, même après avoir fermé l’application.', confirm: { alt: { label: 'Sauvegarder et quitter', onClick: () => app.quitQuiz(true) }, ok: 'Abandonner le test', onOk: () => app.quitQuiz(false), cancel: 'Continuer le test' } };
    case 'replace': {
      const q = P.quiz; if (!q) return null;
      return { title: 'Un test est en cours', sub: q.title + ' · question ' + (q.idx + 1) + ' / ' + q.qs.length, options: [
        opt('Reprendre ce test', 'Là où tu t’étais arrêté', false, () => app.resumeQuiz(), ic('rotate')),
        opt('Commencer le nouveau test', 'Le test en cours sera abandonné', false, () => app.startQuiz(...app.pending, true), ic('zap')),
      ] };
    }
    case 'reset': return { title: 'Réinitialiser ma progression ?', sub: 'Les statistiques, l’historique, les erreurs, les favoris et le test en cours du profil « ' + bank.name + ' » seront effacés. Les autres préparations ne sont pas touchées. Cette action est définitive.', confirm: { ok: 'Réinitialiser', cancel: 'Annuler', onOk: () => app.resetProfile() } };
    case 'appearance': return { title: 'Apparence', options: pick('theme', [['system', 'Système', 'Suit le réglage du téléphone'], ['light', 'Clair'], ['dark', 'Sombre']]) };
    case 'text': return { title: 'Taille du texte', sub: 'S’applique aux questions et réponses.', options: pick('text', [['Petite', 'Petite'], ['Normale', 'Normale'], ['Grande', 'Grande']]) };
    case 'goal': return { title: 'Objectif quotidien', sub: 'C’est aussi la longueur d’une révision intelligente.', options: pick('goal', [[5, '5 questions', '≈ 3 min par jour'], [10, '10 questions', '≈ 6 min par jour'], [20, '20 questions', '≈ 12 min par jour'], [30, '30 questions', '≈ 18 min par jour']]) };
    case 'prep': return {
      title: app.firstRun ? 'Quelle préparation ?' : 'Type de préparation',
      sub: 'Chaque préparation est un profil séparé : ses propres questions, statistiques, historique, erreurs et favoris.',
      options: PREPS.map((b) => { const o = app.overviewOf(b, s.profiles[b.id]); return opt(b.name, o.pct + ' % · ' + plural(b.questions.length, 'question') + ' · ' + plural(b.lots.length, 'lot'), b.id === s.prep, () => app.switchPrep(b.id), ic('target')); }),
    };
    case 'time': return { title: 'Heure du rappel', options: pick('time', [['08:00', '08:00', 'Le matin'], ['12:30', '12:30', 'À midi'], ['19:00', '19:00', 'En soirée'], ['21:00', '21:00', 'Avant de dormir']]) };
    case 'examLength': return { title: 'Longueur de l’examen blanc', sub: 'L’examen officiel compte 40 questions en 45 minutes.', options: pick('examLength', [[40, '40 questions', 'Conditions réelles · 45 min'], [20, '20 questions', 'Entraînement court · ' + examMinutes(20) + ' min'], [10, '10 questions', 'Démo · ' + examMinutes(10) + ' min']]) };
    case 'report': {
      const q = app.reportQ, reason = s.reportReason, text = s.reportText || '', img = s.reportImg, sending = !!s.reportSending;
      const send = () => app.sendReport(q ? app.reportCtx(bank, q) : { prep: bank.name }, q);
      return {
        title: q ? 'Signaler cette question' : 'Signaler un bug', sub: 'Choisis le problème. Le signalement est envoyé sans compte à l’auteur de l’application, avec la version de l’app, le navigateur et la taille de l’écran.',
        options: (q ? REPORT_REASONS : BUG_REASONS).map((r) => opt(r, null, r === reason, () => app.setState({ reportReason: r }), ic('alert'))),
        form: {
          value: text, placeholder: q ? 'Précise le problème (facultatif)' : 'Décris ce qui s’est passé (facultatif)', onChange: (e) => app.setState({ reportText: e.target.value }),
          image: { preview: img?.preview, caption: img?.auto ? 'Capture de l’écran jointe — « Retirer » pour ne pas l’envoyer' : 'Capture jointe', label: 'Ajouter une capture d’écran', onPick: (f) => app.pickReportImage(f) },
          send: { label: sending ? 'Envoi…' : 'Envoyer le signalement', disabled: !reason || sending, onClick: send },
        },
      };
    }
    case 'installHelp': return { title: 'Installer l’application', sub: installHelp() };
  }
  return null;
}
