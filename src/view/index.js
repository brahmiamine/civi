// Builds everything the app shows for its current state: the screen on top of the active tab (src/view/screens/),
// plus the parts common to every screen (top bar, tab bar, sheet, toast). Rendered by <Screen> (components/Screen.jsx).
import { ic } from '../Icon.jsx';
import { TABS } from '../constants.js';
import { sheetData } from '../sheets.js';
import { makeKit } from './kit.js';
import * as homeScreens from './screens/home.js';
import * as testScreens from './screens/test.js';
import * as progressScreens from './screens/progress.js';
import * as studyScreens from './screens/study.js';
import * as profileScreens from './screens/profile.js';

const SCREENS = { ...homeScreens, ...testScreens, ...progressScreens, ...studyScreens, ...profileScreens };

// Title of the top bar (with a back button) of the screens opened from a tab.
const TITLES = {
  propose: 'Proposer une question', theme: 'Thème', errors: 'Mes erreurs', favs: 'Mes favoris', traps: 'Questions pièges', dates: 'Dates à retenir',
  flash: 'Flashcards', question: 'Question', examIntro: 'Examen blanc', review: 'Correction des erreurs', history: 'Historique', roman: 'Chiffres romains',
  settings: 'Paramètres', notifications: 'Notifications', about: 'À propos', lot: 'Lot de questions', result: 'Résultat',
};

export function buildView(app) {
  const k = makeKit(app), { s, c } = k;
  const v = {
    bar: TITLES[c.s] ? { ...k.back, title: TITLES[c.s] } : { show: false },
    quizBar: null, largeTitle: null, home: null, testHero: null, progHero: null, profile: null, intro: null, fiche: null, flash: null,
    qv: null, propose: null, res: null, chips: null, groups: [], empty: null, sticky: null,
  };
  SCREENS[c.s]?.(v, k);
  v.showNav = !(c.s === 'quiz' || (c.s === 'result' && c.fresh));
  v.safeBg = v.showNav ? 'var(--surface)' : 'var(--bg)';
  const sd = s.sheet ? sheetData(app) : null;
  v.sheet = sd ? { ...sd, scrimOp: s.closing ? 0 : 1, transform: s.closing ? 'translateY(100%)' : 'translateY(' + s.drag + 'px)', transition: s.dragging ? 'none' : 'transform .22s cubic-bezier(.2,.8,.2,1)' } : null;
  v.tabs = TABS.map(([id, label, icn]) => {
    const a = s.tab === id;
    return { id, label, icon: ic(icn, 22, a ? 2 : 1.5), color: a ? 'var(--primaryText)' : 'var(--text2)', pill: a ? 'var(--tint)' : 'transparent', weight: a ? 600 : 500, current: a ? 'page' : undefined, onClick: () => app.switchTab(id) };
  });
  const sticky = v.sticky, toastPx = (v.showNav ? 72 : 0) + (sticky ? (sticky.secondary && sticky.dir === 'column' ? 140 : 86) : 0) + 24;
  v.toast = s.toast ? { m: s.toast.m, icon: ic(s.toast.icon, 18, 2.5), bottom: 'calc(' + toastPx + 'px + var(--safe-bottom))' } : null;
  return v;
}
