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
server/   API Express + TypeScript + Prisma (PostgreSQL)
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

Prérequis : Node.js 20+, et une base PostgreSQL accessible (le plus simple : une base
[Neon](https://neon.tech) gratuite — voir l'étape 1 de la section Déploiement ci-dessous pour
en créer une en 2 minutes ; une même base Neon peut très bien servir à la fois pour tester en
local et pour la vraie utilisation).

```bash
npm install

# Serveur (API sur http://localhost:4000)
cp server/.env.example server/.env
# → édite server/.env : colle ta chaîne de connexion Neon dans DATABASE_URL,
#   et remplace JWT_SECRET par une valeur aléatoire à toi.
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

### Usage quotidien en local (un seul terminal, sans rechargement automatique)

Pratique pour simplement utiliser l'app (pas pour développer dessus) : construit tout puis
lance un unique processus qui sert l'API et l'app web sur `http://localhost:4000`.

```bash
npm run build
npm start
```

Sous Windows, double-cliquer sur `start.bat` fait la même chose (`start-dev.bat` relance
plutôt les deux serveurs de développement avec rechargement automatique, dans deux fenêtres).
Sous Mac/Linux, `./start.sh` et `./start-dev.sh` sont les équivalents.

⚠️ Cela reste un serveur qui tourne **sur cet ordinateur** : il faut que l'ordinateur reste
allumé et le terminal ouvert pour que l'app soit accessible, y compris pour toi seul. Pour que
d'autres personnes y accèdent en continu sans dépendre de ton PC, il faut un vrai déploiement
(section suivante).

## Déploiement (accès centralisé pour plusieurs personnes, en continu)

Architecture retenue, entièrement gratuite et sans dépendre d'un PC personnel allumé :

- **[Neon](https://neon.tech)** — base de données PostgreSQL gratuite et permanente (les
  données ne s'effacent jamais, contrairement aux disques gratuits de la plupart des
  hébergeurs d'application).
- **[Render](https://render.com)** — héberge l'API (le dossier `server/`). Plan gratuit
  possible ; seul inconvénient, le service se met en veille après 15 min d'inactivité et met
  30-60s à redémarrer au premier accès suivant (aucun impact sur les données, qui restent sur
  Neon).
- **[Netlify](https://netlify.com)** — héberge l'application web (le dossier `web/`), servie
  telle qu'elle est construite (`web/dist`) avec la redirection SPA de `web/public/_redirects`.

### 1. Créer la base de données (Neon)

1. Crée un compte sur [neon.tech](https://neon.tech) (connexion via GitHub la plus simple).
2. Crée un nouveau projet (ex. nom `whist`).
3. Copie la **chaîne de connexion** affichée (commence par `postgresql://...`) — c'est ton
   `DATABASE_URL`.

### 2. Déployer l'API (Render)

1. Crée un compte sur [render.com](https://render.com) (connexion via GitHub).
2. « New » → « Web Service » → connecte le dépôt GitHub `jpatiny-hub/Whist`.
3. Configure :
   - **Root Directory** : `server`
   - **Runtime** : Node
   - **Build Command** : `npm install && npx prisma migrate deploy && npx prisma generate`
   - **Start Command** : `npm start`
4. Dans « Environment », ajoute les variables :
   - `DATABASE_URL` = la chaîne de connexion Neon copiée à l'étape précédente
   - `JWT_SECRET` = une longue chaîne aléatoire (jamais celle du développement local)
   - `CORS_ORIGIN` = `http://localhost:5173` pour l'instant (on la corrigera à l'étape 4)
5. Déploie, puis note l'URL publique donnée par Render (ex.
   `https://whist-api-xxxx.onrender.com`).

### 3. Déployer l'application web (Netlify)

1. Crée un compte sur [netlify.com](https://netlify.com) (connexion via GitHub).
2. « Add new site » → « Import an existing project » → connecte le même dépôt GitHub.
3. Configure :
   - **Base directory** : `web`
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
4. Dans les variables d'environnement du site, ajoute `VITE_API_URL` =
   `<URL Render de l'étape 2>/api` (ex. `https://whist-api-xxxx.onrender.com/api`).
5. Déploie, puis note l'URL Netlify donnée (ex. `https://whist-scoreboard.netlify.app`).

### 4. Autoriser le frontend sur l'API

Retourne sur Render → variables d'environnement du service → mets à jour `CORS_ORIGIN` avec
l'URL Netlify obtenue à l'étape 3 (ex. `https://whist-scoreboard.netlify.app`), puis
redéploie le service. C'est cette URL Netlify que tu partages avec ton groupe.

### Mises à jour ultérieures

Render et Netlify sont tous les deux connectés au dépôt GitHub : un `git push` sur la branche
déployée déclenche automatiquement un nouveau build et déploiement des deux côtés — plus
besoin d'intervenir manuellement une fois que c'est configuré.

### Alternative : tout sur un seul serveur (VPS, Fly.io...)

Pour héberger l'API et l'application web ensemble sur un seul serveur qui reste allumé en
permanence (au lieu du trio Neon/Render/Netlify), `server/Dockerfile` construit une image
unique qui sert les deux (`docker build -f server/Dockerfile .`), avec les mêmes variables
d'environnement `DATABASE_URL`, `JWT_SECRET` et `CORS_ORIGIN`.
