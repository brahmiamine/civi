# Test Civique — Entraînement

Application mobile (PWA installable) d’entraînement au test civique français : quiz, révisions par thème, flashcards et examens blancs chronométrés. Modes clair et sombre (réglage « Système » par défaut).

Démo : https://brahmiamine.github.io/civi/

## Développement

```bash
npm install
npm run dev      # serveur local
npm run build    # build de production dans dist/
npm run preview  # sert dist/ sur http://localhost:4173/civi/
npm run icons    # régénère les icônes PWA dans public/
```

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml`, qui construit l’app et la publie sur GitHub Pages. Dans les réglages du dépôt, **Settings → Pages → Source** doit être sur **GitHub Actions**.

## Fonctionnement

- **Types de préparation = profils** : carte de séjour pluriannuelle, carte de résident, naturalisation. Chaque profil a ses propres questions, statistiques, historique, erreurs, favoris, objectif quotidien et test en cours. Changer de préparation (Profil → Type de préparation) recharge tout.
- **Statistiques réelles** : calculées à partir des réponses données (maîtrise par question et par thème, taux de bonnes réponses, série de jours, examens réussis, meilleur score).
- **Points faibles** : les thèmes les moins maîtrisés, puis les moins bien réussis.
- **Révision intelligente** : répétition espacée (les questions ratées reviennent tout de suite, les questions réussies de plus en plus tard), complétée par de nouvelles questions des thèmes les plus faibles. Sa longueur suit l’objectif quotidien.
- **Tests sauvegardés** : un quiz ou un examen en cours est enregistré à chaque réponse ; il est rouvert après une actualisation ou une fermeture du navigateur (le chrono reprend là où il s’était arrêté).
- **Lots de questions** : dans Tester, choisis un lot (fichier de `src/data/`) et lance-le en entraînement ou en conditions d’examen.
- **Rappels** : notifications locales (permission du navigateur), gérées par le service worker (`public/sw-reminders.js`). Elles fonctionnent quand l’application est ouverte ou en arrière-plan, et, une fois l’app installée sur Android/Chromium, via la synchronisation périodique. Masquées si le navigateur ne les prend pas en charge.

## Structure

- `src/App.jsx` — navigation (pile par onglet, retour Android, Échap), écrans, bottom sheets
- `src/data/` — banques de questions par type de préparation (voir `src/data/README.md`)
- `src/bank.js` — chargement et validation des fichiers de `src/data/`
- `src/stats.js` — statistiques, points faibles, révision intelligente, tirage de l’examen
- `src/storage.js` — sauvegarde sur l’appareil (réglages, un profil par préparation, test en cours)
- `src/notify.js`, `public/sw-reminders.js` — rappels
- `src/install.js` — installation PWA (invite Android/desktop, instructions iOS/Firefox/Safari)
- `src/constants.js` — thèmes, palettes clair/sombre
- `src/Icon.jsx` — icônes (Lucide)
- `public/screenshots/` — captures affichées dans la fenêtre d’installation
