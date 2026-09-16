// Lance le serveur AlgoMaze avec un faux Redis en mémoire (aucune dépendance externe).
// Usage : node test/dev-server.mjs   (lit server/.env comme le serveur réel)
//
// - `redis` est remplacé par test/fakeRedis.mjs via un hook de résolution ESM ;
// - FAKE_REDIS_SEED=1 charge un jeu de données minimal (voir test/seed.mjs).

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(serverDir);
process.env.FAKE_REDIS_SEED = process.env.FAKE_REDIS_SEED || '1';

register(new URL('./loader.mjs', import.meta.url));

await import(pathToFileURL(path.join(serverDir, 'index.js')).href);
