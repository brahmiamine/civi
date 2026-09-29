// « Profil » tab: settings, notifications, about, question proposals.
import { THEMES, LET, APP_VERSION } from '../../constants.js';
import { plural } from '../../utils.js';
import { PREPS } from '../../bank.js';
import { isStandalone } from '../../install.js';
import { exportData } from '../../storage.js';
import { testNotification } from '../../notify.js';
import { SOURCES, PRIVACY } from '../../content.js';

export function profile(v, k) {
  const { app, st, bank, O, row } = k;
  v.largeTitle = 'Profil';
  v.profile = { initials: bank.initials, name: bank.name, sub: O.pct + ' % de préparation · ' + plural(O.total, 'question') };
  v.groups = [k.G(null, [
    row({ icon: 'target', title: 'Type de préparation', sub: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot'), value: bank.short, chev: true, onClick: () => app.openSheet('prep') }),
    row({ icon: 'scroll', title: 'Chiffres romains', sub: 'Ve République, XVe siècle, Louis XIV… : savoir les lire', chev: true, onClick: () => app.push({ s: 'roman' }) }),
    row({ icon: 'alert', title: 'Signaler un bug', sub: 'Avec une capture d’écran si besoin', chev: true, onClick: () => app.openReport(null) }),
    row({ icon: 'sparkles', title: 'Proposer une question', sub: 'Texte ou photo, envoyé à l’auteur', chev: true, onClick: () => app.openPropose() }),
    row({ icon: 'sliders', title: 'Paramètres', chev: true, onClick: () => app.push({ s: 'settings' }) }),
    k.canNotify && row({ icon: 'bell', title: 'Notifications', value: k.remOn ? st.time : 'Désactivées', chev: true, onClick: () => app.push({ s: 'notifications' }) }),
    row({ icon: 'sun', title: 'Apparence', value: { system: 'Système', light: 'Clair', dark: 'Sombre' }[st.theme], chev: true, onClick: () => app.openSheet('appearance') }),
    row({ icon: 'info', title: 'À propos', chev: true, onClick: () => app.push({ s: 'about' }) }),
  ].filter(Boolean))];
  if (!isStandalone()) v.groups.push(k.G(null, [row({ icon: 'download', title: 'Installer l’application', sub: 'Accès depuis l’écran d’accueil, plein écran et hors connexion', chev: true, onClick: () => app.install() })]));
}

export function settings(v, k) {
  const { app, st, bank, row, sw } = k;
  const seg = [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([val, label]) => ({ label, checked: st.theme === val, onClick: (e) => { e.stopPropagation(); app.setS('theme', val); } }));
  v.groups = [
    k.G('Préparation · ' + bank.short, [
      row({ title: 'Type de préparation', value: bank.short, chev: true, onClick: () => app.openSheet('prep') }),
      row({ title: 'Objectif quotidien', value: st.goal + ' questions', chev: true, onClick: () => app.openSheet('goal') }),
      row({ title: 'Révision automatique', ...sw('auto', 'Ajoute tes mauvaises réponses à « Mes erreurs »') }),
      row({ title: 'Longueur de l’examen blanc', value: st.examLength + ' questions', chev: true, onClick: () => app.openSheet('examLength') }),
    ]),
    k.canNotify && k.G('Notifications', [row({ title: 'Rappels', value: k.remOn ? 'Activés · ' + st.time : 'Désactivés', chev: true, onClick: () => app.push({ s: 'notifications' }) })]),
    k.G('Apparence', [row({ title: 'Thème', seg }), row({ title: 'Taille du texte', value: st.text, chev: true, onClick: () => app.openSheet('text') })]),
    k.G('Quiz', [
      row({ title: 'Afficher immédiatement la correction', ...sw('instant', 'Sinon, correction à la fin et retour possible aux questions précédentes') }),
      row({ title: 'Mélanger les réponses', ...sw('shuffle') }), row({ title: 'Son', ...sw('sound') }), row({ title: 'Vibration', ...sw('vibration') }),
    ]),
    k.G('Données', [
      row({ title: 'Exporter ma progression', sub: 'Fichier de sauvegarde de toutes les préparations', chev: true, onClick: () => { exportData(APP_VERSION); app.toast('Sauvegarde téléchargée'); } }),
      row({ title: 'Importer une sauvegarde', sub: 'Remplace la progression de cet appareil', chev: true, onClick: () => app.pickBackup() }),
      row({ title: 'Réinitialiser ma progression', sub: 'Profil « ' + bank.name + ' » uniquement', color: 'var(--error)', onClick: () => app.openSheet('reset') }),
    ]),
    k.G(null, [row({ title: 'À propos, sources et confidentialité', value: APP_VERSION, chev: true, onClick: () => app.push({ s: 'about' }) })]),
  ].filter(Boolean);
}

export function notifications(v, k) {
  const { app, s, st, row, granted, remOn } = k;
  if (!k.canNotify) { v.empty = k.emptyState('bell', 'Notifications indisponibles', 'Ce navigateur ne permet pas les notifications. Sur iPhone, installe d’abord Civi sur l’écran d’accueil (iOS 16.4 ou plus).'); return; }
  v.intro = s.notif === 'denied'
    ? 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis réactive les rappels ici.'
    : 'Les rappels s’affichent quand l’application est ouverte ou en arrière-plan. Sur Android, une fois l’application installée, ils peuvent aussi arriver quand elle est fermée, à une heure approximative (c’est le téléphone qui décide). Sur iPhone, ils n’arrivent que lorsque l’application est ouverte.';
  v.groups = [
    k.G(null, [
      row({ title: 'Rappel quotidien', ...k.swRow(remOn, () => app.toggleReminder('reminder'), 'Si ton objectif du jour (' + st.goal + ' questions) n’est pas atteint') }),
      row({ title: 'Heure du rappel', value: st.time, chev: true, op: remOn ? 1 : 0.45, onClick: remOn ? () => app.openSheet('time') : undefined }),
    ]),
    k.G(null, [row({ title: 'Rappel de reprise', ...k.swRow(granted && st.streak, () => app.toggleReminder('streak'), 'Si tu n’as pas révisé depuis 2 jours') })]),
  ];
  if (granted) v.groups.push(k.G(null, [row({ icon: 'bell', title: 'Envoyer une notification de test', chev: true, onClick: () => { testNotification('Les rappels de Civi fonctionnent sur cet appareil.'); app.toast('Notification envoyée'); } })]));
}

export function about(v, k) {
  const { bank, O, row } = k;
  v.groups = [
    k.G(null, [row({ title: 'Version', value: APP_VERSION }), row({ title: 'Préparation', value: bank.short }), row({ title: 'Banque de questions', value: plural(O.total, 'question') + ' · ' + plural(bank.lots.length, 'lot') })]),
    k.G('Sources officielles', SOURCES.map(([title, sub, url]) => row({ icon: 'info', title, sub, chev: true, onClick: () => window.open(url, '_blank', 'noopener') }))),
    k.G('Confidentialité', PRIVACY.map(([title, sub]) => row({ title, sub }))),
  ];
}

export function propose(v, k) {
  const { app, s } = k;
  const p = s.pf; if (!p) return;
  const filled = p.a.filter((t) => t.trim()).length;
  const complete = p.q.trim() && filled >= 2 && p.c != null && p.a[p.c]?.trim();
  const ok = p.kind === 'image' ? !!p.img : complete;
  v.propose = {
    p, preps: PREPS.map((b) => ({ id: b.id, name: b.name })), themes: THEMES.map((t) => ({ id: t.id, name: t.name })), LET,
    set: (patch) => app.setPf(patch), setA: (i, val) => app.setPf({ a: p.a.map((t, j) => (j === i ? val : t)) }), pick: (f) => app.pickImage(f),
  };
  v.intro = p.kind === 'image' ? 'Envoie une photo ou une capture d’une question (livret, document officiel…). Elle sera vérifiée avant d’être ajoutée.' : 'Écris la question, ses réponses et coche la bonne. Elle sera vérifiée avant d’être ajoutée.';
  v.sticky = k.primary(p.sending ? 'Envoi…' : 'Envoyer la proposition', () => app.submitPropose(), { disabled: !ok || p.sending, op: !ok || p.sending ? 0.45 : 1 });
}
