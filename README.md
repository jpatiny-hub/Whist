# Whist Scoreboard

Application web (PWA, installable sur téléphone) pour établir les contrats et calculer les
points d'une partie de whist à la couleur, avec gestion des joueurs récurrents et des
statistiques par joueur et par partie. Les règles et le barème de points suivent
[whisthub.com/fr/rules](https://www.whisthub.com/fr/rules), avec une règle maison décrite
plus bas pour le Trou.

## Fonctionnalités

- **Comptes partagés** : plusieurs personnes créent chacune un compte sur le même serveur
  pour saisir et consulter les parties — les données sont centralisées.
- **Joueurs récurrents** : une liste de joueurs réutilisable d'une soirée à l'autre ; on
  choisit 4 joueurs (les mêmes qu'hier, certains d'entre eux, ou de nouveaux) pour démarrer
  une partie.
- **Saisie des donnes** : contrat (Emballage, Solo, Abondance, Piccolo, Petite/Grande
  misère, Misère étalée, Trou, Grand chelem), atout, déclarant(s), plis remportés — avec
  aperçu des points calculés en direct avant validation.
- **Misères multiples** : plusieurs joueurs peuvent déclarer Petite misère / Grande misère /
  Misère étalée / Piccolo dans la même donne ; chaque déclaration est calculée
  indépendamment puis additionnée (comme sur whisthub).
- **Tours de passe** : enregistrables, doublent les points de la donne suivante (sans
  s'accumuler au-delà de ×2 en cas de passes consécutifs).
- **Tableau de scores et graphique** : totaux en direct et évolution des points donne par
  donne, par joueur.
- **Statistiques** :
  - Par partie : contrats déclarés par joueur, réussites/échecs.
  - Par joueur (toutes parties confondues) : parties jouées/gagnées, contrat favori,
    contrat le plus réussi, contrat le plus raté, partenaire favori, **némésis** (le joueur
    contre qui le déficit de points cumulés est le plus grand) et meilleure victime.
- **Référence des contrats** : échelle de force des contrats et barème complet des points
  gagnés/perdus, plis par plis.

## Règle personnalisée : le Trou

Règle standard whisthub : en cas de Trou (joueur forcé d'annoncer avec 3 ou 4 as), l'équipe
doit faire au moins 8 plis (ou 9 si l'atout imposé est changé).

**Dans cette application**, cette possibilité de 8 plis est supprimée : le Trou nécessite
**toujours au moins 9 plis** pour réussir. La réussite rapporte les points normaux (+16)
pour 9 à 12 plis, ou +30 en cas de capot (13 plis). Les points perdus en cas d'échec restent
inchangés (-16, quel que soit le nombre de plis manqués). Cette règle est implémentée dans
`server/src/rules/contracts.ts` (contrat `TROU`) et vérifiée par des tests dans
`server/src/rules/contracts.test.ts`.

## Architecture

Monorepo npm workspaces :

```
server/   API Express + TypeScript + Prisma (SQLite par défaut)
  src/rules/contracts.ts   moteur de calcul des points (pur, testé unitairement)
  src/routes/              auth, players, games, hands, stats, contracts
  prisma/schema.prisma     modèle de données
web/      PWA React + TypeScript + Vite
  src/pages, src/components, src/api
```

Le serveur est la seule source de vérité pour le calcul des points (le front-end n'affiche
qu'un aperçu via l'endpoint `/hands/preview`, jamais un calcul local) — impossible donc de
désynchroniser le score officiel de la partie.

## Développement local

Prérequis : Node.js 20+.

```bash
npm install

# Serveur (API sur http://localhost:4000)
cp server/.env.example server/.env   # génère un JWT_SECRET différent avant un vrai déploiement !
npm run --workspace server prisma:migrate
npm run dev:server

# App web (sur http://localhost:5173), dans un autre terminal
cp web/.env.example web/.env
npm run dev:web
```

Tests du moteur de règles (le cœur critique de l'app) :

```bash
npm run test:server
```

## Déploiement (accès centralisé pour plusieurs personnes)

L'app est conçue pour tourner comme **un seul service partagé** : chacun s'y connecte avec
son compte depuis son téléphone (via son navigateur, avec possibilité d'« ajouter à l'écran
d'accueil » pour un usage type application).

1. **Base de données** : SQLite convient pour un groupe d'amis (fichier unique, zéro
   configuration). Pour davantage de robustesse (sauvegardes, accès concurrent plus
   important), passer à PostgreSQL ne demande qu'un changement dans
   `server/prisma/schema.prisma` (`provider = "postgresql"`) et une variable
   `DATABASE_URL` pointant vers la base — aucun autre changement de code n'est nécessaire.
2. **Build & lancement** :
   ```bash
   npm run build --workspace web
   npm run --workspace server prisma:generate
   npm run build --workspace server
   npx prisma migrate deploy --schema server/prisma/schema.prisma
   node server/dist/index.js
   ```
   Le serveur sert alors à la fois l'API (`/api/...`) et l'application web construite
   (`web/dist`) sur le même port — une seule URL à partager avec le groupe.
3. **Docker** : `server/Dockerfile` construit cette image en une étape (`docker build -f
   server/Dockerfile .`). Fournir `DATABASE_URL`, `JWT_SECRET` et `CORS_ORIGIN` en variables
   d'environnement au conteneur. Le déployer ensuite sur la plateforme de son choix (VPS,
   Fly.io, Railway, etc.) puis partager l'URL publique à toutes les personnes qui doivent
   pouvoir saisir ou consulter les parties.
4. Pensez à générer un `JWT_SECRET` long et aléatoire pour la production (ne réutilisez pas
   celui de développement).
