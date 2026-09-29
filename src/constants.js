// Les 5 thématiques officielles de l’examen civique. Les fichiers de src/data/ utilisent ces identifiants.
export const THEMES = [
  { id: 'valeurs', name: 'Principes et valeurs de la République', short: 'Valeurs', icon: 'scale' },
  { id: 'institutions', name: 'Système institutionnel et politique', short: 'Institutions', icon: 'landmark' },
  { id: 'droits', name: 'Droits et devoirs', short: 'Droits', icon: 'users' },
  { id: 'histoire', name: 'Histoire, géographie et culture', short: 'Histoire', icon: 'scroll' },
  { id: 'societe', name: 'Vivre dans la société française', short: 'Société', icon: 'map' },
];

// Répartition officielle des 40 questions de l’examen par thème (mises à l’échelle pour les examens plus courts).
export const EXAM_DIST = { valeurs: 11, institutions: 6, droits: 11, histoire: 8, societe: 4 };
export const PASS_RATE = 0.8;

export const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
export const MODE_T = { exam: 'Examen blanc', quick: 'Quiz rapide', smart: 'Révision intelligente', hard: 'Questions difficiles', weak: 'Points faibles', errors: 'Mes erreurs', lot: 'Lot de questions' };
export const TABS = [['home', 'Accueil', 'home'], ['revise', 'Réviser', 'book'], ['test', 'Tester', 'clipboard'], ['progress', 'Progression', 'chart'], ['profile', 'Profil', 'user']];
export const EXAM_SECONDS = 45 * 60;

export const PAL = {
  light: { bg: '#F5F6F8', surface: '#FFFFFF', surface2: '#ECEEF2', segOn: '#FFFFFF', text: '#141821', text2: '#5B6272', line: 'rgba(20,24,33,.14)', divider: 'rgba(20,24,33,.08)', primary: '#2447A8', primaryText: '#1D3A8C', tint: '#E8EDF9', btn: '#2447A8', btnPressed: '#1B3783', onBtn: '#FFFFFF', onChip: '#FFFFFF', red: '#D42A3A', tcMid: '#D3D8E2', success: '#1B7F48', successTint: '#E1F2E8', error: '#C22835', errorFill: '#C22835', errorTint: '#FBE6E8', warn: '#A85A00', warnTint: '#FCEEDB', scrim: 'rgba(10,14,24,.42)', sheet: '#FFFFFF', toast: '#141821', onToast: '#FFFFFF', shadowS: '0 1px 2px rgba(20,24,33,.06)', shadowM: '0 8px 24px rgba(20,24,33,.08)' },
  dark: { bg: '#0D111A', surface: '#161C28', surface2: '#222A3B', segOn: '#34405A', text: '#ECEFF5', text2: '#A0A8BA', line: 'rgba(236,239,245,.16)', divider: 'rgba(236,239,245,.07)', primary: '#8AA5FF', primaryText: '#B1C3FF', tint: 'rgba(138,165,255,.14)', btn: '#3A62D8', btnPressed: '#2F52BA', onBtn: '#FFFFFF', onChip: '#0D111A', red: '#FF5C68', tcMid: '#ECEFF5', success: '#4FC489', successTint: 'rgba(79,196,137,.14)', error: '#FF7179', errorFill: '#D63844', errorTint: 'rgba(255,113,121,.14)', warn: '#F2A745', warnTint: 'rgba(242,167,69,.14)', scrim: 'rgba(0,0,0,.6)', sheet: '#1A2130', toast: '#ECEFF5', onToast: '#0D111A', shadowS: 'none', shadowM: '0 0 0 1px rgba(236,239,245,.06)' },
};

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

// Guarded so that the pure modules (stats, bank checks) can also run under Node for the tests.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const BRAND_ICON = (import.meta.env?.BASE_URL ?? '/') + 'brand-icon.svg';
