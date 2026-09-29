# Banque de questions

Chaque dossier est un **type de préparation** (un profil dans l’application) :

```
src/data/
  carte-sejour-pluriannuelle/
    profil.json   ← nom, description, « L’essentiel » par thème, dates à retenir
    lot-1.json    ← un lot de questions
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

Une question invalide (thème inconnu, bonne réponse absente, identifiant en double…) est ignorée avec un avertissement dans la console du navigateur.

## Examen blanc

L’examen tire les questions de toute la préparation en suivant la répartition officielle par thème (sur 40 questions : 11 valeurs, 6 institutions, 11 droits et devoirs, 8 histoire-géographie-culture, 4 société). Pour un examen complet sans doublon, prévoir au moins ce nombre de questions par thème.
