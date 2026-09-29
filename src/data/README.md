# Banque de questions

Chaque dossier est un **type de préparation** (un profil dans l’application) :

```
src/data/
  carte-sejour-pluriannuelle/
    profil.json   ← nom, description, « L’essentiel » par thème, dates à retenir
    questions.json  ← banque générale (révision, examen blanc, thèmes, erreurs…)
    pieges.json     ← questions pièges (piege=true automatique)
    situations.json ← mises en situation (situation=true automatique)
    lot-1.json      ← lots : utilisés uniquement dans Tester → Lots de questions
    lot-2.json
  carte-resident/
  naturalisation/
```

Les fichiers sont intégrés au build : pour ajouter des questions, il suffit d’ajouter un fichier `lot-N.json` (ou de compléter un lot existant) puis de relancer `npm run dev` / `npm run build`. Un nouveau dossier crée automatiquement un nouveau type de préparation. Les lots sont triés par nom de fichier et apparaissent dans **Tester → Lots de questions**.

## Format d’un lot

```json
{
  "titre": "Les bases de la République",
  "description": "Symboles, institutions et repères essentiels.",
  "questions": [
    {
      "id": "sp-1-01",
      "theme": "valeurs",
      "question": "Quelle est la devise de la République française ?",
      "reponses": ["Liberté, Égalité, Fraternité", "Travail, Famille, Patrie", "Unité, Progrès, Justice"],
      "bonne_reponse": "A",
      "explication": "La devise figure à l’article 2 de la Constitution.",
      "situation": false,
      "piege": false
    }
  ]
}
```

| Champ | Obligatoire | Description |
| --- | --- | --- |
| `id` | oui | Identifiant **unique dans la préparation** et **stable** : les statistiques, erreurs et favoris y sont rattachés. Ne pas le réutiliser pour une autre question. |
| `theme` | oui | `valeurs`, `institutions`, `droits`, `histoire` ou `societe` (les 5 thèmes officiels). |
| `question` | oui | Texte de la question. |
| `reponses` | oui | 2 à 6 réponses. |
| `bonne_reponse` | oui | Lettre de la bonne réponse (`"A"`, `"B"`…) ou son index à partir de 0. |
| `explication` | non | Affichée après la réponse (« À retenir »). |
| `situation` | non | `true` pour une question de mise en situation. |
| `piege` | non | `true` pour l’afficher dans « Questions pièges » et « Questions difficiles ». |

Une question invalide (thème inconnu, bonne réponse absente, identifiant en double…) est ignorée avec un avertissement dans la console du navigateur, et fait échouer `npm run validate:data`.

Réordonner les réponses d’une question est sans risque : l’application enregistre le texte de la réponse choisie, pas sa position.

## Examen blanc

L’examen suit la composition officielle (arrêté du 10 octobre 2025, art. 3) : sur 40 questions, 11 valeurs (dont **6 mises en situation**), 6 institutions, 11 droits et devoirs (dont **6 mises en situation**), 8 histoire-géographie-culture, 4 société. Les mises en situation sont les questions de `situations.json` (ou marquées `"situation": true`) des thèmes `valeurs` et `droits` ; celles des autres thèmes servent à la révision mais ne tombent pas à l’examen. Prévoir au moins 6 mises en situation en `valeurs` et 6 en `droits`, sinon des questions de connaissances les remplacent.

## Trois fichiers de banque + lots

- `questions.json`, `pieges.json`, `situations.json` forment la **banque**, utilisée par la révision, l’examen blanc, les thèmes, etc.
- Les `lot-N.json` apparaissent dans **Tester → Lots de questions**. Leurs nouvelles questions comptent dans la progression, la révision intelligente, les thèmes et les flashcards, mais **ne sont jamais tirées à l’examen blanc**. Une question d’un lot qui reprend l’`id` d’une question de la banque est la même question (c’est la version de la banque qui est utilisée).

## Contrôle automatique

`npm run validate:data` (lancé par la CI avant chaque déploiement) refuse : JSON invalide, thème inconnu, moins de 2 ou plus de 6 réponses, bonne réponse invalide, deux réponses identiques, identifiant en double dans la banque, **même énoncé sous deux identifiants** (réutiliser l’identifiant existant), identifiant de lot qui reprend la banque avec un autre énoncé. Il refuse aussi une bonne réponse sur la même lettre dans plus de 50 % des questions (signe d’un fichier modifié à partir d’une ancienne copie) et signale les explications manquantes et un déséquilibre au-delà de 40 %.

**Toujours modifier les fichiers à partir de la dernière version de `main`** (pas d’une copie gardée ailleurs) : sinon les corrections faites entre-temps sont perdues.

## Format compact (grandes banques)

Clés courtes acceptées en plus des clés longues : `t` (theme), `q` (question), `r` (reponses), `c` (bonne_reponse), `x` (explication), `p` (piege), `s` (situation). Un `theme` au niveau du fichier sert de valeur par défaut, et un `id` absent devient `<fichier>-<n>` (ne jamais réordonner ni supprimer : ajouter à la fin).

```json
{ "theme": "droits", "questions": [ { "q": "…", "r": ["…", "…", "…"], "c": "B", "x": "…" } ] }
```

Les fichiers sont des morceaux séparés du build (mis en cache hors ligne), ce qui permet plusieurs milliers de questions.
