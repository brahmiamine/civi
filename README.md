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
npm run lint     # ESLint (noms inconnus, variables inutilisées, erreurs JSX)
npm run validate:data  # vérifie les banques de questions (src/data/)
npm test         # tests unitaires (logique de progression, stockage)
npm run e2e      # tests dans Chromium sur le build (npm run build avant)
npm run check    # lint + validate:data + test + build + e2e, comme la CI
```

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml`, qui valide les banques, lance les tests, construit l’app et la publie sur GitHub Pages (**Settings → Pages → Source** sur **GitHub Actions**). Les pull requests et les autres branches passent par `.github/workflows/ci.yml` : à rendre obligatoire dans **Settings → Branches** pour protéger `main`.

L’app peut aussi être publiée à la racine d’un domaine sur Cloudflare Workers (`wrangler.jsonc`, build avec le `BASE_PATH` par défaut `/`). Les en-têtes de sécurité (CSP, etc.) sont dans `public/_headers` : Cloudflare les applique ; pour GitHub Pages, qui ne sait pas envoyer d’en-têtes, la même CSP est ajoutée au build en balise `<meta>` (`vite.config.js`).

## Fonctionnement

- **Types de préparation = profils** : un dossier de `src/data/` par préparation (carte de résident ; carte de séjour pluriannuelle et naturalisation sont prêtes mais encore vides, donc masquées). Chaque profil a ses propres questions, statistiques, historique, erreurs, favoris, objectif quotidien et test en cours. Changer de préparation (Profil → Type de préparation) recharge tout.
- **Statistiques réelles** : calculées à partir des réponses données (maîtrise par question et par thème, taux de bonnes réponses, série de jours, examens réussis, meilleur score). Une question est **maîtrisée** après deux bonnes réponses d’affilée. Les flashcards sont une auto-évaluation : elles ne changent pas les statistiques (« À revoir » ajoute la carte à « Mes erreurs »).
- **Points faibles** : les thèmes les moins maîtrisés, puis les moins bien réussis.
- **Révision intelligente** : répétition espacée (les questions ratées reviennent tout de suite, les questions réussies de plus en plus tard ; une question ne monte d’une boîte que si elle était à revoir), complétée par de nouvelles questions des thèmes les plus faibles. Sa longueur suit l’objectif quotidien.
- **Tests sauvegardés** : un quiz ou un examen en cours est enregistré à chaque réponse (statistiques et « Mes erreurs » compris) ; il est rouvert après une actualisation ou une fermeture du navigateur. Pour un test chronométré, l’heure de fin est fixe comme à l’examen : le chrono continue quand on quitte le test ou ferme l’app, et un test sauvegardé dont le temps est écoulé est terminé et rangé dans l’historique.
- **Examen blanc** : composition officielle de l’[arrêté du 10 octobre 2025](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620) (art. 3) — 40 questions, dont 28 de connaissances et 12 mises en situation (6 en « Principes et valeurs », 6 en « Droits et devoirs ») ; répartition par thème 11 / 6 / 11 / 8 / 4, mise à l’échelle pour les examens plus courts (méthode du plus fort reste) ; 80 % de bonnes réponses pour réussir. Le résultat affiche aussi le score des mises en situation. S’il manque des mises en situation dans une préparation, des questions de connaissances du même thème les remplacent. Il ne tire que dans la banque (`questions`, `pieges`, `situations`), jamais les questions propres aux lots. Le meilleur score ne compare que les examens de la longueur la plus grande.
- **Quiz par thème et Questions difficiles** : 20 questions au plus, les moins maîtrisées d’abord.
- **Deux façons de passer un test** : avec la correction immédiate (entraînement), chaque réponse est validée, corrigée et enregistrée tout de suite ; avec la correction à la fin (examen blanc, lots en conditions d’examen, ou réglage « Afficher immédiatement la correction » désactivé), on passe librement d’une question à l’autre (**Précédente / Question suivante**), on peut changer ses réponses, et tout est enregistré quand on termine le test (une confirmation indique les questions sans réponse). Un examen abandonné n’est pas compté.
- **Lots de questions** : dans Tester, choisis un lot (fichier de `src/data/`) et lance-le en entraînement ou en conditions d’examen.
- **Sauvegarde** : Paramètres → Données → Exporter / Importer (fichier JSON de toutes les préparations). L’app demande aussi au navigateur de ne pas effacer ses données (`navigator.storage.persist()`). Des données enregistrées abîmées sont réparées au chargement ; en dernier recours, un écran d’erreur permet d’exporter puis de réinitialiser.
- **Mises à jour** : une nouvelle version n’est installée (rechargement) que sur l’écran principal d’un onglet, sans fenêtre ouverte (`src/update.js`).
- **Réponses enregistrées** : « Mes erreurs » et l’historique gardent le **texte** de la réponse choisie ; réordonner les réponses d’un fichier ne fausse donc rien. Un test en cours dont une question a changé garde ses réponses mais repart sans sélection.
- **Signalements et propositions** : envoyés via Web3Forms (e-mail) et Cloudinary (images, presets non signés). Limite côté app : 20 s entre deux envois, 10 par jour ; les images sont ré-encodées en JPEG et refusées si le navigateur ne peut pas les décoder. À configurer aussi côté services : domaine autorisé sur Web3Forms, formats/taille/dossier sur les presets Cloudinary.
- **Rappels** : notifications locales (permission du navigateur), gérées par le service worker (`public/sw-reminders.js`). Elles fonctionnent quand l’application est ouverte ou en arrière-plan, et, une fois l’app installée sur Android/Chromium, via la synchronisation périodique. Masquées si le navigateur ne les prend pas en charge.
- **Sessions d’examen** : l’accueil donne accès aux prochaines sessions CCI « Carte de résident ». Le déploiement exécute `scripts/scrape_cci_sessions.py` et publie le résultat dans `public/data/cci_sessions.json`. Le workflow est aussi planifié toutes les 4 heures ; si le site CCI est temporairement indisponible, il tente de conserver le dernier JSON déjà déployé.

## Structure

- `src/App.jsx` — coquille de l’app : état, navigation (pile par onglet, retour Android, Échap), minuteries et actions
- `src/quiz.js` — moteur des tests (création, réponses, fin de test, test expiré, reprise d’un test sauvegardé)
- `src/view/` — ce qu’affiche chaque écran : `index.js` choisit l’écran, `kit.js` fournit les briques communes (lignes, groupes, boutons, états vides, question), `screens/*.js` un fichier par zone (accueil et révision, tests, progression, étude, profil)
- `src/components/` — composants React réutilisables (`Screen.jsx` : cadre de l’app ; `Chrome.jsx` : barres, bouton collant, fenêtres ; `Lists.jsx`, `Study.jsx`, `Dashboard.jsx`, `ui.jsx`…)
- `src/sheets.js` — contenu des fenêtres du bas (choix, confirmations, signalement)
- `src/content.js` — textes de « À propos » (sources, confidentialité)
- `src/data/` — banques de questions par type de préparation (voir `src/data/README.md`)
- `src/bank.js` — chargement et validation des fichiers de `src/data/`
- `src/stats.js` — statistiques, points faibles, révision intelligente, tirage de l’examen
- `src/storage.js` — sauvegarde sur l’appareil (réglages, un profil par préparation, test en cours), normalisation, export/import
- `src/update.js` — installation des nouvelles versions au bon moment
- `src/roman.js` — écran « Chiffres romains » (Profil et Réviser)
- `scripts/validate-data.mjs`, `tests/` — contrôle des banques, tests unitaires (`*.test.js`) et tests navigateur (`e2e.mjs`)
- `src/notify.js`, `public/sw-reminders.js` — rappels
- `src/install.js` — installation PWA (invite Android/desktop, instructions iOS/Firefox/Safari)
- `src/constants.js` — thèmes, palettes clair/sombre
- `src/Icon.jsx` — icônes (Lucide)
- `public/screenshots/` — captures affichées dans la fenêtre d’installation
