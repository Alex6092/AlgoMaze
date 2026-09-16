// Jeu de données minimal pour les tests locaux (utilisé quand FAKE_REDIS_SEED=1) :
//  - 3 niveaux jouables (le même labyrinthe simple, solution : moveForward() x2)
//  - un étudiant `alice` (mot de passe : alice123, niveau 1 déjà validé)
//  - un admin `admin` (mot de passe : admin123)

import bcrypt from 'bcrypt';

const LEVEL = {
    cols: 12, rows: 12, tsize: 64,
    layers: [[
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
    ], new Array(144).fill(0)],
    switches: [],
    gems: [{ x: 128, y: 256 }],
    teleport1: [], teleport2: [], teleport3: [], teleport4: [],
    randomTile: [],
    startPosition: { x: 128, y: 128 },
    startDirection: 'Down',
    instructions: '<p>Avance de deux cases et ramasse la gemme.</p>',
    constraints: ''
};

export async function seed(client) {
    const nbLevels = 3;
    for (let i = 1; i <= nbLevels; i++) {
        await client.set('level:' + i, JSON.stringify({ ...LEVEL, instructions: `<p>Niveau ${i} : avance de deux cases et ramasse la gemme.</p>` }));
    }
    await client.set('levelid', String(nbLevels));

    const alice = {
        username: 'alice',
        password: await bcrypt.hash('alice123', 4),
        lastCompletedLevel: 1,
        isAdmin: false
    };
    await client.set('user:alice', JSON.stringify(alice));

    const admin = {
        username: 'admin',
        password: await bcrypt.hash('admin123', 4),
        lastCompletedLevel: 0,
        isAdmin: true
    };
    await client.set('user:admin', JSON.stringify(admin));
    console.log('[fakeRedis] données de test chargées (alice/alice123, admin/admin123, 3 niveaux)');
}
