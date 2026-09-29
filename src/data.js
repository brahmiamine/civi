export const THEMES = [
  { id: 'val', name: 'Principes et valeurs de la République', short: 'Valeurs', icon: 'scale', p: 81 },
  { id: 'inst', name: 'Système institutionnel et politique', short: 'Institutions', icon: 'landmark', p: 64 },
  { id: 'droits', name: 'Droits et devoirs', short: 'Droits', icon: 'users', p: 72 },
  { id: 'hist', name: 'Histoire, géographie et culture', short: 'Histoire', icon: 'scroll', p: 48 },
  { id: 'soc', name: 'Vivre dans la société française', short: 'Société', icon: 'map', p: 57 },
];

export const Q = [
  { id: 1, t: 'inst', q: 'Qui promulgue les lois en France ?', a: ['Le président de la République', 'Le Premier ministre', 'Le Parlement', 'Le Conseil constitutionnel'], c: 0, x: 'Le président de la République promulgue les lois dans les 15 jours qui suivent leur adoption définitive par le Parlement.' },
  { id: 2, t: 'val', q: 'Quelle est la devise de la République française ?', a: ['Liberté, Égalité, Fraternité', 'Travail, Famille, Patrie', 'Unité, Progrès, Justice', 'Paix, Liberté, Solidarité'], c: 0, x: 'Inscrite dans la Constitution de 1958, la devise figure sur les bâtiments publics.' },
  { id: 3, t: 'hist', q: 'En quelle année la Déclaration des droits de l’homme et du citoyen a-t-elle été adoptée ?', a: ['1789', '1848', '1905', '1958'], c: 0, x: 'Adoptée le 26 août 1789, elle fait partie des textes à valeur constitutionnelle.' },
  { id: 4, t: 'inst', q: 'Quelle est la durée du mandat du président de la République ?', a: ['4 ans', '5 ans', '6 ans', '7 ans'], c: 1, x: 'Depuis le référendum de 2000, le mandat est de 5 ans : c’est le quinquennat. Il est renouvelable une seule fois consécutivement.' },
  { id: 5, t: 'inst', q: 'Qui vote les lois en France ?', a: ['Le Gouvernement', 'Le Parlement', 'Le président de la République', 'Le Conseil d’État'], c: 1, x: 'Le Parlement, composé de l’Assemblée nationale et du Sénat, vote la loi.' },
  { id: 6, t: 'val', q: 'Que garantit le principe de laïcité ?', a: ['Une religion d’État', 'La liberté de conscience et la neutralité de l’État', 'L’interdiction de toute religion', 'Le financement des cultes par l’État'], c: 1, x: 'Depuis la loi de 1905, l’État est neutre : il garantit la liberté de croire ou de ne pas croire.' },
  { id: 7, t: 'hist', q: 'En quelle année les femmes ont-elles obtenu le droit de vote en France ?', a: ['1848', '1920', '1944', '1968'], c: 2, x: 'Le droit de vote des femmes date de l’ordonnance du 21 avril 1944. Elles votent pour la première fois en 1945.' },
  { id: 8, t: 'droits', q: 'À partir de quel âge l’instruction est-elle obligatoire ?', a: ['3 ans', '6 ans', '11 ans', '16 ans'], c: 0, x: 'Depuis 2019, l’instruction est obligatoire de 3 à 16 ans.' },
  { id: 9, t: 'soc', q: 'Quel numéro appeler pour joindre le SAMU ?', a: ['15', '17', '18', '114'], c: 0, x: '15 : SAMU. 17 : police. 18 : pompiers. 112 : numéro d’urgence européen.' },
  { id: 10, t: 'hist', q: 'Quel fleuve traverse Paris ?', a: ['La Loire', 'Le Rhône', 'La Seine', 'La Garonne'], c: 2, x: 'La Seine traverse Paris d’est en ouest sur environ 13 km.' },
  { id: 11, t: 'droits', q: 'Quel est l’âge minimum pour voter en France ?', a: ['16 ans', '18 ans', '21 ans', '25 ans'], c: 1, x: 'Tout citoyen français majeur, inscrit sur les listes électorales, peut voter à partir de 18 ans.' },
  { id: 12, t: 'val', q: 'Quel est l’hymne national de la France ?', a: ['La Marseillaise', 'Le Chant du départ', 'L’Internationale', 'La Carmagnole'], c: 0, x: 'Composée en 1792 par Rouget de Lisle, La Marseillaise est l’hymne national, inscrit dans la Constitution de 1958.' },
  { id: 13, t: 'droits', q: 'Le vote est-il obligatoire en France ?', a: ['Oui, pour toutes les élections', 'Non, c’est un droit et un devoir civique', 'Oui, sauf pour les moins de 25 ans', 'Seulement pour l’élection présidentielle'], c: 1, x: 'Voter n’est pas obligatoire, mais c’est un devoir civique.' },
  { id: 14, t: 'soc', q: 'Quel organisme rembourse une partie des frais de santé ?', a: ['La Sécurité sociale', 'La mairie', 'La préfecture', 'France Travail'], c: 0, x: 'La Sécurité sociale, créée en 1945, prend en charge une partie des dépenses de santé.' },
  { id: 15, t: 'soc', q: 'Quelle est la langue de la République ?', a: ['L’anglais', 'Le français', 'Le breton', 'Toutes les langues régionales'], c: 1, x: 'L’article 2 de la Constitution indique que la langue de la République est le français.' },
];

export const FACTS = {
  inst: ['La Ve République est fondée par la Constitution du 4 octobre 1958.', 'Le président est élu au suffrage universel direct pour 5 ans.', 'Le Parlement vote la loi : Assemblée nationale et Sénat.', 'Le Premier ministre dirige l’action du Gouvernement.'],
  val: ['Devise : Liberté, Égalité, Fraternité.', 'Symboles : drapeau tricolore, Marianne, La Marseillaise, le 14 juillet.', 'La laïcité garantit la liberté de conscience (loi de 1905).', 'La République est indivisible, laïque, démocratique et sociale.'],
  droits: ['Le droit de vote est ouvert aux citoyens français dès 18 ans.', 'L’instruction est obligatoire de 3 à 16 ans.', 'Respecter la loi et payer ses impôts sont des devoirs.', 'L’égalité entre les femmes et les hommes est garantie.'],
  hist: ['1789 : Révolution et Déclaration des droits de l’homme.', '1944 : droit de vote des femmes.', '1958 : naissance de la Ve République.', 'La France métropolitaine compte 13 régions.'],
  soc: ['15 SAMU, 17 police, 18 pompiers, 112 urgence européenne.', 'La Sécurité sociale protège face à la maladie et à la vieillesse.', 'Le français est la langue de la République.', 'L’école publique est gratuite et laïque.'],
};

export const DATES = [
  ['1789', 'Déclaration des droits de l’homme et du citoyen'],
  ['1848', 'Abolition de l’esclavage et suffrage universel masculin'],
  ['1905', 'Loi de séparation des Églises et de l’État'],
  ['1944', 'Droit de vote des femmes'],
  ['1958', 'Constitution de la Ve République'],
  ['1981', 'Abolition de la peine de mort'],
];

export const HISTORY = [
  ['24 sept.', 36, '38 min'], ['19 sept.', 31, '44 min'], ['15 sept.', 33, '41 min'], ['10 sept.', 29, '45 min'],
  ['6 sept.', 30, '43 min'], ['2 sept.', 27, '45 min'], ['29 août', 24, '45 min'],
];

export const TRAPS = [4, 6, 7, 9, 13];
export const INIT_ERR = [{ id: 4, chosen: 3 }, { id: 7, chosen: 0 }, { id: 9, chosen: 2 }];
export const LET = ['A', 'B', 'C', 'D'];
export const MODE_T = { exam: 'Examen blanc', quick: 'Quiz rapide', smart: 'Révision intelligente', hard: 'Questions difficiles', weak: 'Points faibles', errors: 'Mes erreurs' };
export const TABS = [['home', 'Accueil', 'home'], ['revise', 'Réviser', 'book'], ['test', 'Tester', 'clipboard'], ['progress', 'Progression', 'chart'], ['profile', 'Profil', 'user']];
export const EXAM_SECONDS = 45 * 60;

export const PAL = {
  light: { bg: '#F5F6F8', surface: '#FFFFFF', surface2: '#ECEEF2', segOn: '#FFFFFF', text: '#141821', text2: '#5B6272', line: 'rgba(20,24,33,.14)', divider: 'rgba(20,24,33,.08)', primary: '#2447A8', primaryText: '#1D3A8C', tint: '#E8EDF9', btn: '#2447A8', btnPressed: '#1B3783', onBtn: '#FFFFFF', onChip: '#FFFFFF', red: '#D42A3A', tcMid: '#D3D8E2', success: '#1B7F48', successTint: '#E1F2E8', error: '#C22835', errorFill: '#C22835', errorTint: '#FBE6E8', warn: '#A85A00', warnTint: '#FCEEDB', scrim: 'rgba(10,14,24,.42)', sheet: '#FFFFFF', toast: '#141821', onToast: '#FFFFFF', shadowS: '0 1px 2px rgba(20,24,33,.06)', shadowM: '0 8px 24px rgba(20,24,33,.08)' },
  dark: { bg: '#0D111A', surface: '#161C28', surface2: '#222A3B', segOn: '#34405A', text: '#ECEFF5', text2: '#A0A8BA', line: 'rgba(236,239,245,.16)', divider: 'rgba(236,239,245,.07)', primary: '#8AA5FF', primaryText: '#B1C3FF', tint: 'rgba(138,165,255,.14)', btn: '#3A62D8', btnPressed: '#2F52BA', onBtn: '#FFFFFF', onChip: '#0D111A', red: '#FF5C68', tcMid: '#ECEFF5', success: '#4FC489', successTint: 'rgba(79,196,137,.14)', error: '#FF7179', errorFill: '#D63844', errorTint: 'rgba(255,113,121,.14)', warn: '#F2A745', warnTint: 'rgba(242,167,69,.14)', scrim: 'rgba(0,0,0,.6)', sheet: '#1A2130', toast: '#ECEFF5', onToast: '#0D111A', shadowS: 'none', shadowM: '0 0 0 1px rgba(236,239,245,.06)' },
};

export const qById = (id) => Q.find((q) => q.id === id);
export const thById = (id) => THEMES.find((t) => t.id === id);
export const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const fmt = (t) => {
  t = Math.max(0, t);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
};
