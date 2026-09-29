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

## Structure

- `src/App.jsx` — navigation (pile par onglet, retour Android, Échap), écrans, bottom sheets
- `src/data.js` — questions, thèmes, palettes clair/sombre
- `src/Icon.jsx` — icônes (Lucide)
- `src/install.js` — invite d’installation PWA (Android/desktop, instructions iOS)
- `src/storage.js` — réglages, erreurs et favoris sauvegardés sur l’appareil
