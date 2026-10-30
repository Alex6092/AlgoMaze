// Empreinte et similarité des solutions, pour réutiliser une évaluation IA existante
// au lieu de rappeler le modèle (anti-« relance jusqu'à Platine »).
//
// Le code est réduit à une forme canonique : sans commentaires, espaces ni points-virgules,
// var/const ramenés à let, avec les noms choisis par l'élève remplacés par v1, v2… dans l'ordre d'apparition.
// Les mots-clés JavaScript et les fonctions du jeu sont conservés : ce sont eux qui
// portent la structure évaluée (boucles, conditions, appels).

import crypto from 'node:crypto';

// Distance de Levenshtein avec normalisation O(min(m,n)) en mémoire.
export function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    // S'assurer que b est le plus court pour minimiser la mémoire.
    if (a.length < b.length) { const t = a; a = b; b = t; }
    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,         // insertion
                prev[j] + 1,              // deletion
                prev[j - 1] + cost        // substitution
            );
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
}

const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'do', 'else', 'false',
    'finally', 'for', 'function', 'if', 'in', 'let', 'new', 'null', 'of', 'return', 'switch',
    'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while',
    'Math', 'Number', 'parseInt', 'console', 'length'
]);

// Fonctions exposées par le jeu (bac à sable de tryRunUserCode et prompt d'évaluation).
const GAME_FUNCTIONS = new Set([
    'moveForward', 'turnLeft', 'turnRight', 'collectGem', 'toggleSwitch', 'isBlocked',
    'isBlockedLeft', 'isBlockedRight', 'canCollectGem', 'isOnSwitch', 'canActivateSwitch',
    'canDeactivateSwitch', 'isOnCellIn', 'getTeleportedToCell', 'checkTeleporter'
]);

const TOKEN = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|=>|\S/g;

// Liste des tokens canoniques du code.
export function canonicalTokens(code) {
    const names = new Map();
    const tokens = [];
    for (const [token] of String(code || '').matchAll(TOKEN)) {
        if (/^\s/.test(token) || token.startsWith('//') || token.startsWith('/*') || token === ';') continue;
        // var/let/const ne changent pas l'algorithme évalué.
        if (token === 'var' || token === 'const') {
            tokens.push('let');
            continue;
        }
        if (/^[A-Za-z_$]/.test(token) && !KEYWORDS.has(token) && !GAME_FUNCTIONS.has(token)) {
            if (!names.has(token)) names.set(token, 'v' + (names.size + 1));
            tokens.push(names.get(token));
        } else {
            tokens.push(token);
        }
    }
    return tokens;
}

export function canonicalize(code) {
    return canonicalTokens(code).join(' ');
}

export function fingerprint(code) {
    return crypto.createHash('sha256').update(canonicalize(code)).digest('hex');
}

// Similarité entre 0 et 1 de deux formes canoniques, mesurée sur les séquences de
// tokens (chaque token distinct devient un caractère) : renommer une variable ne
// compte pas, ajouter ou retirer une instruction compte pour quelques tokens.
export function similarity(canonicalA, canonicalB) {
    const a = canonicalA ? canonicalA.split(' ') : [];
    const b = canonicalB ? canonicalB.split(' ') : [];
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    const alphabet = new Map();
    const encode = (tokens) => tokens.map((t) => {
        if (!alphabet.has(t)) alphabet.set(t, String.fromCharCode(0xE000 + alphabet.size));
        return alphabet.get(t);
    }).join('');
    return 1 - levenshtein(encode(a), encode(b)) / max;
}
