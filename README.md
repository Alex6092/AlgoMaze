# AlgoMaze

Application web pédagogique pour apprendre l'algorithmique via des puzzles de labyrinthe. Les étudiants écrivent du JavaScript pour piloter un robot, collecter des gemmes, activer des interrupteurs et atteindre la sortie.

Une IA évalue ensuite la qualité de leur code (respect des contraintes pédagogiques, lisibilité), attribue un badge par niveau et calcule un rang global.

## Fonctionnalités

- 🧩 **Niveaux personnalisables** créés depuis un éditeur intégré (carte, consigne, contraintes pédagogiques).
- ✏️ **Éditeur de code** CodeMirror avec syntaxe JavaScript et fonctions de jeu pré-définies (`moveForward()`, `turnLeft()`, `collectGem()`, `toggleSwitch()`, `isBlocked()`, …).
- 🛡️ **Pré-check serveur** avant exécution locale : détecte les boucles infinies pour éviter de freezer le navigateur de l'étudiant et sauvegarde son code (historique horodaté des 10 dernières tentatives).
- 🤖 **Évaluation IA** asynchrone via LM Studio (sortie JSON structurée), notification temps réel par WebSocket.
- 🏅 **Badges** par niveau (Fer / Bronze / Argent / Or / Platine) et **rang global** calculé sur la médiane glissante des XP des derniers niveaux.
- 🎓 **SSO Moodle** : authentification automatique des étudiants depuis Moodle via une URL signée HMAC.
- 👨‍🏫 **Vues admin** : avancement des étudiants, consultation des solutions et feedbacks IA (par utilisateur ou par niveau), édition des niveaux.
- 🌗 **Thème clair / sombre** avec toggle, design responsive (admin utilisable sur mobile).

## Architecture

```
.
├── server/                       Backend Node.js + Express + Redis
│   ├── index.js                  Routes HTTP, Socket.IO, app shell
│   ├── routes/user.js            Auth, profil, gestion utilisateurs
│   ├── jwtConfig.js              JWT sliding session (1h, renouvelé à 50% du TTL)
│   ├── feedbackWorker.js         Worker queue Redis robuste (1 job IA à la fois)
│   ├── llmClient.js              Client LM Studio (response_format json_schema)
│   ├── badges.js                 Mapping score→badge, médiane→rang
│   ├── public/                   Assets statiques (CSS, JS, images)
│   └── *.html                    Pages : login, register, algomaze, level-editor, progress, solutions
└── moodle_plugin/algomazevalidation/   Plugin Moodle (activité + SSO)
```

**Stack** : Node.js 20+, Redis 7+, Express, Socket.IO, bcrypt, JWT, dotenv. CodeMirror et Quill côté front, vanilla CSS et JS (zéro framework). LM Studio (compatible API OpenAI) pour l'évaluation IA.

## Installation

### Prérequis

- Node.js ≥ 20
- Redis accessible
- (Optionnel) LM Studio avec un modèle compatible chargé pour l'évaluation IA

### Mise en route

```sh
cd server
npm install
cp .env.example .env
# édite server/.env avec tes valeurs réelles
node index.js
```

L'application est alors disponible sur http://localhost:3000.

### Variables d'environnement (`server/.env`)

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | Secret HMAC pour signer les JWT (chaîne aléatoire longue) |
| `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT` | Connexion Redis |
| `LMSTUDIO_URL` | URL de l'API LM Studio (ex. `http://localhost:1234/v1/chat/completions`) |
| `LMSTUDIO_MODEL` | Identifiant du modèle chargé dans LM Studio |
| `MOODLE_SHARED_SECRET` | Secret HMAC partagé avec le plugin Moodle pour le SSO |

Génère des secrets robustes avec :
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configuration applicative (`server/config.json`)

```json
{
    "allowRegistration": true,
    "maxSolutionHistory": 10,
    "slidingMedianWindow": 10
}
```

- `allowRegistration` : autorise la page `/register` (utile pour les comptes en immersion sans Moodle).
- `maxSolutionHistory` : nombre de tentatives conservées par étudiant et par niveau.
- `slidingMedianWindow` : nombre de niveaux pris en compte pour calculer le rang global.

## Plugin Moodle (SSO)

Le plugin `mod_algomazevalidation` permet d'intégrer AlgoMaze comme activité dans un cours Moodle, et redirige automatiquement l'étudiant vers AlgoMaze déjà authentifié.

1. Copier le dossier `moodle_plugin/algomazevalidation/` dans `<moodle>/mod/algomazevalidation/`.
2. Lancer la mise à jour Moodle (interface d'admin → notifications) pour installer / mettre à jour le plugin.
3. Aller dans *Administration du site → Plugins → Activités → Algomaze validation* et renseigner :
   - **URL de base AlgoMaze** : par exemple `https://algomaze.example.com` (sans `/` final).
   - **Secret partagé SSO** : la même valeur que `MOODLE_SHARED_SECRET` dans `server/.env`.
4. Ajouter une activité « Algomaze validation » dans un cours et indiquer le numéro de niveau cible.

À la première connexion, le compte AlgoMaze est créé automatiquement (mot de passe non utilisable). Les comptes existants avec le même username sont liés sans perte de progression.

## Comptes administrateurs

Un utilisateur est marqué `isAdmin: true` directement dans Redis :
```sh
redis-cli -h <host> -a <password>
> SET user:<username> '{"username":"<username>","password":"<bcrypt-hash>","lastCompletedLevel":0,"isAdmin":true}'
```

Les admins ont accès aux pages `/editor`, `/progress`, `/solutions`.

## Crédits

- Tilesets et sprites : [Kenney](https://kenney.nl/) — licence [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- Code initial du moteur de tilemap dérivé des [exemples MDN gamedev-js-tiles](https://github.com/mozdevs/gamedev-js-tiles).

## Licence

Code source publié sous [Mozilla Public License 2.0](LICENSE).
