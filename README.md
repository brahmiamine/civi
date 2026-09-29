# Test Civique — Entraînement

Application mobile (PWA installable) d’entraînement au test civique français : quiz, révisions par thème, flashcards et examens blancs chronométrés. Modes clair et sombre (réglage « Système » par défaut).

Démo : https://brahmiamine.github.io/civi/

## Développement

```bash
npm install
npm run dev      # serveur local
npm run build    # build de production dans dist/
npm run preview  # sert dist/ sur http://localhost:4173/
npm run icons    # régénère les icônes PWA dans public/ (à lancer après une modification de brand-icon.svg)
npm run validate:data  # vérifie les banques de questions (src/data/)
npm test         # tests unitaires (logique de progression, stockage)
npm run check    # validate:data + test + build, comme la CI
```

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml`, qui valide les banques, lance les tests, construit l’app et la publie sur GitHub Pages (**Settings → Pages → Source** sur **GitHub Actions**). Les pull requests et les autres branches passent par `.github/workflows/ci.yml` : à rendre obligatoire dans **Settings → Branches** pour protéger `main`.

L’app peut aussi être publiée à la racine d’un domaine sur Cloudflare Workers (`wrangler.jsonc`, build avec le `BASE_PATH` par défaut `/`). Les en-têtes de sécurité (CSP, etc.) sont dans `public/_headers` : Cloudflare les applique, GitHub Pages les ignore.

## Fonctionnement

- **Types de préparation = profils** : un dossier de `src/data/` par préparation (carte de résident ; carte de séjour pluriannuelle et naturalisation sont prêtes mais encore vides, donc masquées). Chaque profil a ses propres questions, statistiques, historique, erreurs, favoris, objectif quotidien et test en cours. Changer de préparation (Profil → Type de préparation) recharge tout.
- **Statistiques réelles** : calculées à partir des réponses données (maîtrise par question et par thème, taux de bonnes réponses, série de jours, examens réussis, meilleur score). Une question est **maîtrisée** après deux bonnes réponses d’affilée. Les flashcards sont une auto-évaluation : elles ne changent pas les statistiques (« À revoir » ajoute la carte à « Mes erreurs »).
- **Points faibles** : les thèmes les moins maîtrisés, puis les moins bien réussis.
- **Révision intelligente** : répétition espacée (les questions ratées reviennent tout de suite, les questions réussies de plus en plus tard ; une question ne monte d’une boîte que si elle était à revoir), complétée par de nouvelles questions des thèmes les plus faibles. Sa longueur suit l’objectif quotidien.
- **Tests sauvegardés** : un quiz ou un examen en cours est enregistré à chaque réponse (statistiques et « Mes erreurs » compris) ; il est rouvert après une actualisation ou une fermeture du navigateur. Pour un test chronométré, l’heure de fin est fixe comme à l’examen : le chrono continue quand on quitte le test ou ferme l’app.
- **Examen blanc** : répartition officielle par thème (méthode du plus fort reste pour les examens plus courts), 80 % de bonnes réponses pour réussir.
- **Lots de questions** : dans Tester, choisis un lot (fichier de `src/data/`) et lance-le en entraînement ou en conditions d’examen.
- **Sauvegarde** : Paramètres → Données → Exporter / Importer (fichier JSON de toutes les préparations). L’app demande aussi au navigateur de ne pas effacer ses données (`navigator.storage.persist()`). Des données enregistrées abîmées sont réparées au chargement ; en dernier recours, un écran d’erreur permet d’exporter puis de réinitialiser.
- **Mises à jour** : une nouvelle version n’est installée (rechargement) que lorsqu’aucun test, formulaire ou fenêtre n’est ouvert (`src/update.js`).
- **Signalements et propositions** : envoyés via Web3Forms (e-mail) et Cloudinary (images, presets non signés). Limite côté app : 20 s entre deux envois, 10 par jour ; les images sont ré-encodées en JPEG et refusées si le navigateur ne peut pas les décoder. À configurer aussi côté services : domaine autorisé sur Web3Forms, formats/taille/dossier sur les presets Cloudinary.
- **Rappels** : notifications locales (permission du navigateur), gérées par le service worker (`public/sw-reminders.js`). Elles fonctionnent quand l’application est ouverte ou en arrière-plan, et, une fois l’app installée sur Android/Chromium, via la synchronisation périodique. Masquées si le navigateur ne les prend pas en charge.

## Structure

- `src/App.jsx` — navigation (pile par onglet, retour Android, Échap), écrans, bottom sheets
- `src/data/` — banques de questions par type de préparation (voir `src/data/README.md`)
- `src/bank.js` — chargement et validation des fichiers de `src/data/`
- `src/stats.js` — statistiques, points faibles, révision intelligente, tirage de l’examen
- `src/storage.js` — sauvegarde sur l’appareil (réglages, un profil par préparation, test en cours), normalisation, export/import
- `src/update.js` — installation des nouvelles versions au bon moment
- `scripts/validate-data.mjs`, `tests/` — contrôle des banques et tests unitaires
- `src/notify.js`, `public/sw-reminders.js` — rappels
- `src/install.js` — installation PWA (invite Android/desktop, instructions iOS/Firefox/Safari)
- `src/constants.js` — thèmes, palettes clair/sombre
- `src/Icon.jsx` — icônes (Lucide)
- `public/screenshots/` — captures affichées dans la fenêtre d’installation
