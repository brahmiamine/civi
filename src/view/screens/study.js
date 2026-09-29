// Revision screens: theme sheet, flashcards, a single question, « Mes erreurs », favourites, traps, dates, Roman numerals.
import { ic } from '../../Icon.jsx';
import { THEMES, thById, shuffle } from '../../constants.js';
import { plural } from '../../utils.js';
import { SYMBOLS, RULES, EXAMPLES, CENTURIES, toRoman, romanOrdinal, centuryYears } from '../../roman.js';

export function theme(v, k) {
  const { app, c, bank, TS, row } = k;
  const t = thById(c.id), ts = TS[t.id];
  v.bar.title = t.short;
  v.fiche = {
    loading: false, ready: true, icon: ic(t.icon, 26), name: t.name, pct: k.pct(t) + '%', pctLabel: k.pct(t) + ' %',
    sub: 'Maîtrise · ' + ts.mastered + ' / ' + plural(ts.total, 'question') + (ts.acc != null ? ' · ' + ts.acc + ' % de réussite' : ''),
    facts: k.withSep(bank.facts[t.id].map((x, i) => ({ n: i + 1, text: x }))),
  };
  v.groups = [k.G('S’entraîner', [
    row({ icon: 'layers', title: 'Flashcards du thème', chev: true, onClick: () => app.pushFlash({ theme: t.id }) }),
    row({ icon: 'alert', title: 'Questions pièges', chev: true, onClick: () => app.push({ s: 'traps' }) }),
  ])];
  v.sticky = k.primary('Tester mes connaissances', () => app.startQuiz('theme', t.id), { disabled: !ts.total, op: !ts.total ? 0.45 : 1 });
}

export function flash(v, k) {
  const { app, s, st, c, bank, P } = k;
  const L = c.lot && bank.lots.find((l) => l.id === c.lot);
  const cards = (c.order || []).map(k.qById).filter(Boolean);
  if (c.theme) v.bar.title = 'Flashcards · ' + thById(c.theme).short;
  if (L) v.bar.title = 'Flashcards · ' + L.title;
  if (!cards.length) { v.empty = k.emptyState('layers', 'Aucune carte', 'Aucune question disponible ici.'); return; }
  if (s.fc >= cards.length) {
    v.empty = k.emptyState('check', 'Paquet terminé', plural(cards.length, 'carte') + ' revue' + (cards.length > 1 ? 's' : '') + '.', {
      ok: true, sw: 2, btn: 'Recommencer (nouvel ordre)', onBtn: () => { app.setTop({ order: shuffle(c.order) }); app.setState({ fc: 0, flip: false }); },
    });
    return;
  }
  const q = cards[s.fc];
  v.flash = {
    theme: thById(q.t).short, counter: (s.fc + 1) + ' / ' + cards.length, kicker: s.flip ? 'Réponse' : 'Question', kColor: s.flip ? 'var(--success)' : 'var(--primaryText)',
    text: s.flip ? q.a[q.c] : q.q, detail: s.flip ? q.x : null, hint: s.flip ? 'Touche pour revoir la question' : 'Touche pour voir la réponse', flipIcon: ic('rotate', 16),
    onFlip: () => app.flipCard(),
  };
  // Self-assessment is not an answer: it does not change mastery, spaced repetition or the daily goal.
  // « À revoir » adds the card to « Mes erreurs » when automatic revision is on.
  const next = (ok) => {
    if (!ok && st.auto && !P.errors.some((e) => e.id === q.id)) app.updP((p) => ({ ...p, errors: p.errors.concat([{ id: q.id, pick: null }]) }));
    app.setState({ fc: s.fc + 1, flip: false });
  };
  v.sticky = k.primary('Je savais', () => next(true), { dir: 'row', icon: ic('check', 20, 2), secondary: k.secondary('À revoir', 'x', () => next(false)) });
}

export function question(v, k) {
  const { app, c, P } = k;
  const q = k.qById(c.id); if (!q) return;
  v.bar.star = k.favBtn(q.id);
  const chosen = c.pick != null ? q.a.indexOf(c.pick) : -1;
  v.qv = k.questionView(q, q.a.map((_, i) => (i === q.c ? 'correct' : i === chosen ? 'wrong' : 'dim')), () => {}, true, { text: q.x, bulb: ic('bulb', 16) });
  if (c.from === 'errors' && P.errors.some((e) => e.id === q.id)) {
    v.sticky = k.primary('J’ai compris', () => { app.updP((p) => ({ ...p, errors: p.errors.filter((e) => e.id !== q.id) })); app.toast('Retiré de mes erreurs'); app.back(); }, { icon: ic('check', 20, 2) });
  }
}

export function errors(v, k) {
  const { app, st, c, P, nErr } = k;
  if (!nErr) {
    v.empty = k.emptyState('check', 'Aucune erreur à revoir', st.auto ? 'Continue comme ça.' : 'La révision automatique est désactivée : tes erreurs ne sont pas ajoutées ici.', { ok: true, sw: 2, btn: 'Faire un quiz', onBtn: () => app.openSheet('count') });
    return;
  }
  const f = c.filter || 'all';
  v.chips = k.chips([['all', 'Toutes']].concat(THEMES.map((t) => [t.id, t.short])), f, (id) => app.setTop({ filter: id }));
  const list = P.errors.filter((e) => f === 'all' || k.qById(e.id).t === f);
  if (list.length) v.groups = [k.G(null, list.map((e) => k.qRow(e.id, k.answerSub(e.pick, 'Marquée « À revoir »'), 'errors', e.pick)))];
  else v.empty = k.emptyState('check', 'Rien dans ce thème', 'Choisis un autre filtre.', { sw: 2 });
  v.sticky = k.primary('Revoir en quiz (' + nErr + ')', () => app.startQuiz('errors'));
}

export function favs(v, k) {
  const { P } = k;
  if (P.favs.length) v.groups = [k.G(null, P.favs.map((id) => k.qRow(id, null, 'favs')).filter(Boolean))];
  else v.empty = k.emptyState('star', 'Aucune question favorite', 'Ajoute une question avec l’icône étoile pendant tes révisions.');
}

export function traps(v, k) {
  const list = k.bank.questions.filter((q) => q.trap);
  if (!list.length) { v.empty = k.emptyState('alert', 'Aucune question piège', 'Aucune question de cette préparation n’est marquée comme piège.'); return; }
  v.intro = 'Les questions où les candidats se trompent le plus souvent.';
  v.groups = [k.G(null, list.map((q) => k.qRow(q.id, null, 'traps')))];
}

export function dates(v, k) {
  const { bank, row } = k;
  if (bank.dates.length) v.groups = [k.G(null, bank.dates.map(([y, t]) => row({ year: y, title: t })))];
  else v.empty = k.emptyState('calendar', 'Aucune date', 'Aucune date à retenir pour cette préparation.');
}

export function roman(v, k) {
  const { row } = k;
  v.intro = 'Le test utilise souvent les chiffres romains : Ve République, XVIIIe siècle, Louis XIV… Voici tout ce qu’il faut savoir pour les lire sans erreur.';
  const wide = (o) => row({ ...o, yearW: 72, yearFs: 24 });
  v.groups = [
    k.G('Les 7 symboles', SYMBOLS.map(([sym, n, word]) => row({ year: sym, title: String(n), sub: word }))),
    k.G('Les règles', RULES.map(([title, sub]) => row({ icon: 'info', title, sub }))),
    k.G('À connaître pour le test', EXAMPLES.map(([n, before, after, sub]) => wide({ year: toRoman(n) + (after === 'er' ? 'er' : ''), title: before + toRoman(n) + after, sub }))),
    k.G('Les siècles', [row({ icon: 'bulb', title: 'Trouver le siècle d’une année', sub: 'Chiffre des centaines + 1 : 1789 → 17 + 1 = 18 → XVIIIe siècle. Attention : 1900 est encore au XIXe siècle.' })]
      .concat(CENTURIES.map(([n, sub]) => { const [a, b] = centuryYears(n); return wide({ year: romanOrdinal(n), title: n + 'e siècle · ' + a + ' à ' + b, sub }); }))),
  ];
}
