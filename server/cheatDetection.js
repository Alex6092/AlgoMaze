// Détection d'anomalies comportementales (anti-triche).
// Volontairement non agressif : on FLAG, on n'accuse pas. Les flags servent à attirer
// l'attention de l'enseignant qui décide ensuite (idéalement par dialogue avec l'étudiant).

import redisClient from './redisClient.js';
import config from './config.json' assert { type: 'json' };

function cfg() {
    return (config && config.cheatDetection) || {};
}

// Médiane d'un tableau numérique non vide.
function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// 1) Saut de qualité anormal
// ---------------------------------------------------------------------------
// Compare une nouvelle XP à la médiane des XP déjà obtenues par l'utilisateur sur
// d'autres niveaux. Si l'écart dépasse le seuil configuré, on flag.
// Ne flag pas si on n'a pas assez de données (qualityJumpMinSample).
export async function detectQualityJump(username, levelId, newXp) {
    const c = cfg();
    const minSample = c.qualityJumpMinSample ?? 3;
    const delta = c.qualityJumpDelta ?? 30;

    const keys = await redisClient.keys(`xp:${username}:*`);
    const otherXps = [];
    const myKey = `xp:${username}:${levelId}`;
    for (const key of keys) {
        if (key === myKey) continue;
        const v = parseInt(await redisClient.get(key));
        if (!isNaN(v)) otherXps.push(v);
    }
    if (otherXps.length < minSample) {
        return { jump: false, reason: 'insufficient_sample', sample: otherXps.length };
    }
    const baseline = median(otherXps);
    const observed = parseInt(newXp) || 0;
    const ecart = observed - baseline;
    return {
        jump: ecart >= delta,
        delta: ecart,
        baselineMedian: baseline,
        observed,
        sample: otherXps.length,
        threshold: delta
    };
}

// ---------------------------------------------------------------------------
// 2) Interprétation des signaux comportementaux
// ---------------------------------------------------------------------------
// Prend les signaux bruts d'une session et la longueur du code soumis.
// Retourne un objet { flags, suspectCount } où flags est un dict signal→bool/number.
export function interpretSignals(signals, codeLength) {
    if (!signals) return { flags: {}, suspectCount: 0 };
    const c = cfg();
    const len = Math.max(1, parseInt(codeLength) || 1);
    const pasteRatio = (signals.pasteChars || 0) / len;

    const flags = {
        paste:    pasteRatio >= (c.pasteRatioThreshold ?? 0.7),
        away:     (signals.awaySeconds || 0) >= (c.awaySecondsThreshold ?? 60),
        focus:    (signals.focusLossCount || 0) >= (c.focusLossThreshold ?? 5),
        capture:  (signals.printScreenCount || 0) >= (c.printScreenThreshold ?? 1)
    };
    const suspectCount = Object.values(flags).filter(v => v).length;
    return { flags, suspectCount, pasteRatio: Math.round(pasteRatio * 100) / 100 };
}

// ---------------------------------------------------------------------------
// 3) Similarité inter-élèves
// ---------------------------------------------------------------------------
// Distance de Levenshtein avec normalisation O(min(m,n)) en mémoire.
function levenshtein(a, b) {
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

// Similarité normalisée entre 0 (rien en commun) et 1 (identique).
function similarity(a, b) {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
    const sa = norm(a), sb = norm(b);
    if (!sa.length && !sb.length) return 1;
    const maxLen = Math.max(sa.length, sb.length);
    if (maxLen === 0) return 1;
    const dist = levenshtein(sa, sb);
    return 1 - dist / maxLen;
}

// Pour un niveau donné, calcule la similarité par paire entre toutes les solutions
// soumises, établit une baseline (médiane des similarités), et retourne les paires
// qui dépassent la baseline d'une marge configurée.
// Sur un niveau très contraint (toutes les solutions se ressemblent), la baseline
// est haute → peu de flags. Sur un niveau ouvert, deux solutions identiques
// se distinguent et sont flagées.
export async function analyzeLevelSimilarity(levelId) {
    const c = cfg();
    const minPairs = c.similarityMinPairs ?? 3;
    const threshold = c.similarityThreshold ?? 0.85;
    const margin = c.similarityBaselineMargin ?? 0.15;

    const keys = await redisClient.keys(`usersolution:*:level:${levelId}`);
    const solutions = [];
    for (const key of keys) {
        // usersolution:<username>:level:<id>
        const username = key.split(':')[1];
        const code = await redisClient.get(key);
        if (code && code.trim().length > 0) {
            solutions.push({ username, code });
        }
    }

    if (solutions.length < 2) {
        return { levelId, sampleSize: solutions.length, baseline: null, suspectPairs: [] };
    }

    // Calcul de toutes les paires.
    const pairs = [];
    for (let i = 0; i < solutions.length; i++) {
        for (let j = i + 1; j < solutions.length; j++) {
            const sim = similarity(solutions[i].code, solutions[j].code);
            pairs.push({
                userA: solutions[i].username,
                userB: solutions[j].username,
                similarity: Math.round(sim * 1000) / 1000
            });
        }
    }

    const baseline = median(pairs.map(p => p.similarity));
    const cutoff = Math.max(threshold, baseline + margin);

    // Si on n'a pas assez de paires, on n'établit pas de baseline fiable :
    // on garde juste un seuil absolu pour ne pas rater une copie évidente.
    const effectiveCutoff = pairs.length >= minPairs ? cutoff : threshold;

    const suspect = pairs
        .filter(p => p.similarity >= effectiveCutoff)
        .sort((a, b) => b.similarity - a.similarity);

    return {
        levelId,
        sampleSize: solutions.length,
        baseline: Math.round(baseline * 1000) / 1000,
        cutoff: Math.round(effectiveCutoff * 1000) / 1000,
        suspectPairs: suspect
    };
}
