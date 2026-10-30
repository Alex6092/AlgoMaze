// Empreinte et similarité des solutions (anti-relance des évaluations IA).
//
//   cd server && npm test

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, fingerprint, similarity } from '../solutionFingerprint.js';

const loop = `// Avance jusqu'au mur
var n = 0;
while (!isBlocked()) { moveForward(); n++; }
turnLeft();`;

const sim = (a, b) => similarity(canonicalize(a), canonicalize(b));

describe('empreinte des solutions', () => {
    it('ignore commentaires, espaces, points-virgules, noms de variables et var/let/const', () => {
        const renamed = 'let compteur=0\nwhile(!isBlocked()){moveForward()\n  compteur++}\n/* fin */ turnLeft()';
        assert.equal(fingerprint(loop), fingerprint(renamed));
    });

    it('conserve les fonctions du jeu et la structure', () => {
        assert.match(canonicalize(loop), /while \( ! isBlocked \( \) \) \{ moveForward/);
        assert.notEqual(fingerprint(loop), fingerprint(loop.replace('while', 'if')));
    });

    it('distingue une boucle d’une suite d’instructions codées en dur', () => {
        const hardcoded = 'moveForward();\nmoveForward();\nmoveForward();\nturnLeft();';
        assert.notEqual(fingerprint(loop), fingerprint(hardcoded));
        assert.ok(sim(loop, hardcoded) < 0.9);
    });

    it('juge très proche une retouche mineure', () => {
        const longer = `function avancer() {
    while (!isBlocked()) {
        if (canCollectGem()) { collectGem(); }
        moveForward();
    }
}
avancer();
turnLeft();
avancer();
turnLeft();
avancer();`;
        const touched = longer.replace('turnLeft();\navancer();\nturnLeft();', 'turnLeft();\navancer();\nturnLeft();\n');
        assert.equal(sim(longer, touched), 1);
        const extra = longer + '\nturnLeft();';
        const score = sim(longer, extra);
        assert.ok(score >= 0.9 && score < 1, `similarité ${score}`);
    });
});
