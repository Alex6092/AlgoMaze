// Hook de résolution ESM : remplace le paquet `redis` par le faux Redis en mémoire.
// Enregistré par dev-server.mjs (module.register) — le code applicatif reste inchangé.

const FAKE_REDIS_URL = new URL('./fakeRedis.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'redis') {
        return { url: FAKE_REDIS_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}
