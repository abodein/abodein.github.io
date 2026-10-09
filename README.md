# Antoine Bodein — site personnel

Site Quarto (CV, publications, enseignement), publié par GitHub Pages depuis `docs/`.

```bash
quarto render          # tout le site → docs/
quarto preview         # aperçu local
```

## Page Publications

Chaque article de [publications.qmd](publications.qmd) qui contient un lien
`https://doi.org/...` devient une carte cliquable : résumé à gauche, citations
(total + barplot par année) à droite, bouton **Cite** qui ouvre le BibTeX
(copie ou téléchargement `.bib`).

| Fichier | Rôle |
|---|---|
| [scripts/update_publications.R](scripts/update_publications.R) | Récupère métriques, résumés et BibTeX → `data/publications.json` |
| [data/publications.json](data/publications.json) | Données figées lues au rendu (profil Scholar + une entrée par DOI) |
| [publications.js](publications.js) | Cartes dépliables, barplot SVG, fenêtre BibTeX (injecté dans la page) |
| [styles.css](styles.css) | Styles `.pub-card`, `.pub-details`, `.bib-dialog` |

### Mettre à jour les métriques

```bash
Rscript scripts/update_publications.R             # citations Google Scholar
quarto render publications.qmd
git add data/ docs/ && git commit -m "publications: update metrics" && git push
```

- **Citations** (profil, h-index, i10, par article et par année) : Google Scholar
  via le package `scholar`. Les articles sont appariés aux DOI par leur titre.
  Si Scholar bloque la requête, les métriques précédentes sont conservées.
- **Résumés** : Crossref, sinon OpenAlex. **BibTeX** : `doi.org` (négociation de
  contenu). Mis en cache dans le JSON : seuls les nouveaux DOI sont interrogés.
  `--refresh` force le re-téléchargement.

### Ajouter une publication

1. Ajouter l'entrée dans `publications.qmd` avec son lien `https://doi.org/...`.
2. Lancer le script puis le rendu (ci-dessus).

Un titre qui ne correspond pas à Google Scholar s'affiche dans la sortie du
script (« pas de correspondance Scholar ») : la carte aura résumé et BibTeX,
sans citations. Une entrée sans DOI reste une carte simple.

Dépendances R : `scholar`, `jsonlite`, `httr`, `plotly`.
