// Browser tests of the built app (`npm run build && npm run e2e`): the real screens, in Chromium, with the
// Content-Security-Policy of the build. Covers what unit tests cannot: navigation, timer, saving, backups, errors.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'silent' });
const URL = 'http://localhost:4174/';
const dir = mkdtempSync(join(tmpdir(), 'civi-e2e-'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage();
const sessionFixture = [
  {
    center_id: '980',
    center_name: 'ABC FORMATION',
    product: 'Examen civique mention Carte de résident',
    product_id: '22',
    address: "82 Avenue de Verdun - 95310 SAINT-OUEN L'AUMONE - France",
    postal_code: '95310',
    url_centre: '/inscription-candidat/centre-980/produit-22',
    sessions: [{ date: '2099-10-07', time: '', remaining_places: 9, session_id: '7147165' }],
  },
  {
    center_id: '200',
    center_name: 'CENTRE PARIS',
    product: 'Examen civique mention Carte de résident',
    product_id: '22',
    address: '10 rue de Paris - 75010 PARIS - France',
    postal_code: '75010',
    url_centre: '/inscription-candidat/centre-200/produit-22',
    sessions: [{ date: '2099-10-08', time: '09:00', remaining_places: 4, session_id: '7147166' }],
  },
];
let sessionApiFails = false;
await page.route('**/data/cci_sessions.json', async (route) => {
  if (sessionApiFails) return route.fulfill({ status: 503, body: 'indisponible' });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionFixture) });
});
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push('Exception : ' + e.message));

const QUIZ = 'civi:quiz:carte-resident', PROFILE = 'civi:profile:carte-resident';
const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), k);
const patchQuiz = (fn) => page.evaluate(([k, src]) => { const q = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(new Function('q', src)(q))); }, [QUIZ, fn]);
const ready = () => page.getByText('de préparation').waitFor({ timeout: 5000 });
let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log('✓ ' + name); } catch (e) { failed++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); }
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };

await page.goto(URL);
await step('l’accueil s’affiche', ready);

await step('sessions d’examen : centre/date, filtres, accordéon et erreur réseau', async () => {
  await page.getByRole('button', { name: /Sessions d’examen/ }).click();
  await page.getByRole('heading', { name: 'Trouver une session' }).waitFor();

  // Vue par centre par défaut + accordéon.
  expect((await page.getByRole('tab', { name: 'Par centre' }).getAttribute('aria-selected')) === 'true', 'la vue par centre n’est pas active par défaut');
  await page.getByText('ABC FORMATION').waitFor();
  await page.getByRole('button', { name: /ABC FORMATION/ }).click();
  await page.getByRole('link', { name: 'Google Maps' }).waitFor();
  await page.getByRole('link', { name: 'Citymapper' }).waitFor();

  // Département.
  await page.getByLabel('Filtrer par département').selectOption('75');
  expect(await page.getByText('CENTRE PARIS').count() === 1, 'centre paris absent après filtre');
  expect(await page.getByText('ABC FORMATION').count() === 0, 'filtre département non appliqué');
  await page.getByLabel('Filtrer par département').selectOption('');

  // Recherche texte.
  await page.getByLabel('Rechercher une ville ou un centre').fill('saint-ouen');
  expect(await page.getByText('ABC FORMATION').count() === 1, 'recherche adresse non appliquée');
  await page.getByLabel('Rechercher une ville ou un centre').fill('');

  // Filtre date.
  await page.getByLabel('Filtrer par date').fill('2099-10-07');
  expect(await page.getByText('ABC FORMATION').count() === 1, 'filtre date : centre attendu absent');
  expect(await page.getByText('CENTRE PARIS').count() === 0, 'filtre date non appliqué');
  await page.getByRole('button', { name: 'Effacer' }).click();

  // Vue par date.
  await page.getByRole('tab', { name: 'Par date' }).click();
  expect((await page.getByRole('tab', { name: 'Par date' }).getAttribute('aria-selected')) === 'true', 'la vue par date ne s’active pas');
  await page.getByText('CENTRE PARIS').waitFor();

  await page.getByRole('button', { name: 'Accueil' }).click();

  const expectedErrorStart = problems.length;
  sessionApiFails = true;
  await page.getByRole('button', { name: /Sessions d’examen/ }).click();
  await page.getByText('Impossible de charger les disponibilités pour le moment.').waitFor();
  sessionApiFails = false;
  // The mocked 503 is intentional; do not let that expected browser console message
  // fail the final "no unexpected console errors" assertion.
  problems.splice(expectedErrorStart);
  await page.getByRole('button', { name: 'Accueil' }).click();
});

await step('révision : les réponses et les erreurs sont enregistrées à chaque question', async () => {
  await page.getByRole('button', { name: /Commencer ma préparation/ }).click();
  let wrong = 0;
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Valider', exact: true }).click();
    if (await page.getByText('Mauvaise réponse').count()) wrong++;
    await page.getByRole('button', { name: 'Question suivante' }).click();
  }
  await page.getByRole('button', { name: 'Quitter le test' }).click();
  await page.getByRole('button', { name: 'Abandonner le test' }).click();
  const p = await ls(PROFILE);
  expect(Object.keys(p.stats).length === 3, 'statistiques : ' + Object.keys(p.stats).length);
  expect(p.errors.length === wrong, 'erreurs : ' + p.errors.length + ' pour ' + wrong + ' mauvaises réponses');
  expect(p.errors.every((e) => typeof e.pick === 'string'), 'la réponse choisie est enregistrée en texte');
});

await step('examen : 40 questions, chrono à heure de fin fixe, pas d’écriture chaque seconde', async () => {
  await page.getByRole('button', { name: 'Tester' }).click();
  await page.getByRole('button', { name: "Démarrer l'examen" }).click();
  await page.getByRole('button', { name: 'Commencer l’examen' }).click();
  await page.getByText('Question 1 / 40').waitFor({ timeout: 3000 });
  const q = await ls(QUIZ);
  // Questions that only exist in a lot (dates, famous French people) are not drawn in the mock exam.
  expect(q.qs.every((id) => !/^cr-(date|celebre)-/.test(id)), 'question de lot dans l’examen');
  // Official composition: 12 mises en situation out of 40.
  const nSit = q.qs.filter((id) => id.startsWith('cr-sit-')).length;
  expect(nSit === 12, nSit + ' mises en situation au lieu de 12');
  await patchQuiz('q.endsAt -= 10 * 60e3; return q;');
  await page.reload();
  const t = (await page.getByLabel('Temps restant').innerText()).trim();
  expect(/^3[45]:/.test(t), 'chrono après 10 min app fermée : ' + t);
  const a = await page.evaluate((k) => localStorage.getItem(k), QUIZ);
  await page.waitForTimeout(2200);
  expect(a === (await page.evaluate((k) => localStorage.getItem(k), QUIZ)), 'le test est réécrit sans action');
});

await step('examen quitté puis temps écoulé : terminé et ajouté à l’historique', async () => {
  await page.getByRole('button', { name: 'Quitter le test' }).click();
  await page.getByRole('button', { name: 'Sauvegarder et quitter' }).click();
  await patchQuiz('q.endsAt = Date.now() - 1000; return q;');
  await page.reload();
  await ready();
  expect((await ls(QUIZ)) === null, 'le test est toujours en cours');
  const p = await ls(PROFILE);
  expect(p.history[0]?.mode === 'exam' && p.history[0].total === 40, 'pas d’examen dans l’historique');
  expect(!(await page.getByText('Reprendre le test').count()), 'l’accueil propose encore de reprendre');
});

await step('examen ouvert au moment où le temps finit : écran de résultat', async () => {
  await page.getByRole('button', { name: 'Tester' }).click();
  await page.getByRole('button', { name: "Démarrer l'examen" }).click();
  await page.getByRole('button', { name: 'Commencer l’examen' }).click();
  await page.getByText('Question 1 / 40').waitFor();
  await patchQuiz('q.endsAt = Date.now() - 1000; return q;');
  await page.reload();
  await page.getByText('40 questions sans réponse').waitFor({ timeout: 3000 });
});

await step('signalement : fenêtre avec capture, focus dans la fenêtre, Échap la ferme', async () => {
  await page.getByRole('button', { name: /Revoir mes erreurs/ }).click();
  await page.locator('.p-row').first().click();
  await page.getByRole('button', { name: 'Signaler une erreur dans cette question' }).click();
  await page.getByRole('dialog', { name: 'Signaler cette question' }).waitFor({ timeout: 6000 });
  await page.getByText(/Capture de l’écran jointe/).waitFor({ timeout: 1000 });
  expect((await page.evaluate(() => document.activeElement?.getAttribute('role'))) === 'dialog', 'focus hors de la fenêtre');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 2000 });
});

await step('correction à la fin : revenir en arrière, changer sa réponse, terminer', async () => {
  await page.goto(URL); await ready();
  // Switch off the instant correction (Profil → Paramètres), then start a 5-question quick quiz.
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByText('Paramètres', { exact: true }).click();
  await page.getByRole('switch', { name: /Afficher immédiatement la correction/ }).click();
  await page.getByRole('button', { name: 'Tester' }).click();
  await page.getByText('Quiz rapide', { exact: true }).click();
  await page.getByRole('dialog').getByText('5 questions').click();
  await page.getByText('Question 1 / 5').waitFor({ timeout: 3000 });
  const statsBefore = JSON.stringify((await ls(PROFILE)).stats);
  expect(!(await page.getByRole('button', { name: 'Précédente' }).count()), 'bouton Précédente sur la 1re question');
  await page.getByRole('radio').nth(0).click();
  const firstPick = await page.getByRole('radio').nth(0).getAttribute('aria-label');
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await page.getByText('Question 2 / 5').waitFor();
  await page.getByRole('button', { name: 'Précédente' }).click();
  await page.getByText('Question 1 / 5').waitFor();
  expect((await page.getByRole('radio').nth(0).getAttribute('aria-checked')) === 'true', 'réponse de la question 1 perdue : ' + firstPick);
  await page.getByRole('radio').nth(1).click(); // change the answer
  expect((await page.getByRole('radio').nth(0).getAttribute('aria-checked')) === 'false', 'ancienne réponse encore cochée');
  for (let i = 1; i < 5; i++) await page.getByRole('button', { name: 'Question suivante' }).click();
  await page.getByText('Question 5 / 5').waitFor();
  expect(JSON.stringify((await ls(PROFILE)).stats) === statsBefore, 'réponses enregistrées avant la fin du test');
  await page.getByRole('button', { name: 'Terminer le test' }).click();
  await page.getByRole('dialog', { name: 'Terminer le test ?' }).getByText('4 questions sans réponse', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Revenir aux questions' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Terminer le test' }).click();
  await page.getByRole('button', { name: 'Terminer et voir le résultat' }).click();
  await page.getByText('4 questions sans réponse.', { exact: false }).waitFor({ timeout: 3000 });
  const p = await ls(PROFILE);
  expect(p.history[0].answered === 1 && p.history[0].total === 5, 'résultat : ' + JSON.stringify(p.history[0]));
  // Back to the default setting for the next steps.
  await page.goto(URL); await ready();
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByText('Paramètres', { exact: true }).click();
  await page.getByRole('switch', { name: /Afficher immédiatement la correction/ }).click();
});

await step('quiz par thème limité à 20 questions', async () => {
  await page.goto(URL); await ready();
  await page.getByRole('button', { name: 'Tester' }).click();
  await page.getByText('Quiz par thème').click();
  await page.getByRole('dialog').getByText('Système institutionnel et politique').click();
  await page.getByText('Question 1 / 20').waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: 'Quitter le test' }).click();
  await page.getByRole('button', { name: 'Abandonner le test' }).click();
});

await step('flashcards : paquet mélangé, sans effet sur les statistiques', async () => {
  const before = await ls(PROFILE);
  await page.getByRole('button', { name: 'Réviser' }).click();
  await page.getByText('Flashcards', { exact: true }).click();
  await page.getByText(/^1 \/ \d+$/).waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: 'Je savais' }).click();
  await page.getByText(/^2 \/ \d+$/).waitFor();
  const after = await ls(PROFILE);
  expect(JSON.stringify(before.stats) === JSON.stringify(after.stats) && JSON.stringify(before.days) === JSON.stringify(after.days), 'statistiques modifiées');
});

await step('chiffres romains : accessibles depuis Profil et Réviser', async () => {
  await page.goto(URL); await ready();
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByText('Chiffres romains').click();
  await page.getByText('XVIIIe', { exact: true }).waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: 'Réviser' }).click();
  await page.getByText('Chiffres romains').waitFor();
});

let backup;
const openProfileRoot = async () => {
  await page.getByRole('button', { name: 'Profil' }).click();
  if (!(await page.getByRole('heading', { name: 'Profil' }).count())) await page.getByRole('button', { name: 'Profil' }).click(); // tapping the active tab goes back to its root
};
await step('export de la progression', async () => {
  await openProfileRoot();
  await page.getByText('Paramètres', { exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Exporter ma progression').click()]);
  const j = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(j.format === 'civi-sauvegarde' && j.data[PROFILE], 'sauvegarde invalide');
  backup = join(dir, 'backup.json'); writeFileSync(backup, JSON.stringify(j));
});

await step('import d’une sauvegarde', async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL); await ready();
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByText('Paramètres', { exact: true }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Importer une sauvegarde').click()]);
  await Promise.all([page.waitForEvent('load'), chooser.setFiles(backup)]);
  await ready();
  expect((await ls(PROFILE)).history.length > 0, 'historique non restauré');
});

await step('données enregistrées abîmées : l’app s’ouvre quand même', async () => {
  await page.evaluate(([p, q]) => {
    localStorage.setItem(p, '{"errors":null,"favs":"x","stats":[],"history":{"a":1},"settings":{"goal":"abc"}}');
    localStorage.setItem(q, '{"qs":"oops"}');
    localStorage.setItem('civi:settings', '{"theme":"rose","text":5}');
  }, [PROFILE, QUIZ]);
  await page.reload();
  await ready();
  await page.getByText('Objectif du jour : 0 / 10 questions').waitFor({ timeout: 2000 });
  await page.evaluate(() => localStorage.setItem('civi:settings', '{not json'));
  await page.reload();
  await ready();
});

await step('aucune erreur dans la console ni blocage par la CSP', async () => expect(!problems.length, problems.join(' | ')));

await browser.close();
await server.close();
if (failed) { console.error(failed + ' test(s) en échec'); process.exit(1); }
console.log('Tous les tests navigateur passent');
