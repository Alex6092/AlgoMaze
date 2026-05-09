// Système de badges et de rang global pour AlgoMaze.
// Un badge est attribué à chaque niveau validé en fonction du score IA.
// Le rang global est calculé comme la médiane glissante des XP des N derniers niveaux.

import redisClient from './redisClient.js';

// Ordre de meilleur à pire pour faciliter le find().
const BADGE_THRESHOLDS = [
    { name: 'Platine', minScore: 80, xp: 200 },
    { name: 'Or',      minScore: 60, xp: 100 },
    { name: 'Argent',  minScore: 40, xp: 50 },
    { name: 'Bronze',  minScore: 20, xp: 25 },
    { name: 'Fer',     minScore: 0,  xp: 10 }
];

const RANK_THRESHOLDS = [
    { name: 'Légende',  minMedian: 150 },
    { name: 'Maître',   minMedian: 100 },
    { name: 'Expert',   minMedian: 60 },
    { name: 'Initié',   minMedian: 30 },
    { name: 'Apprenti', minMedian: 0 }
];

// Plafond appliqué quand les contraintes pédagogiques ne sont PAS respectées :
// l'étudiant a une solution fonctionnelle mais qui ne met pas en œuvre les concepts attendus.
const NON_COMPLIANT_CAP = 'Bronze';

export function badgeForScore(score, constraintsRespected) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    let badge = BADGE_THRESHOLDS.find(b => safeScore >= b.minScore) || BADGE_THRESHOLDS[BADGE_THRESHOLDS.length - 1];
    if (!constraintsRespected) {
        const cap = BADGE_THRESHOLDS.find(b => b.name === NON_COMPLIANT_CAP);
        if (cap && badge.xp > cap.xp) badge = cap;
    }
    return { name: badge.name, xp: badge.xp };
}

export function rankForMedian(med) {
    return (RANK_THRESHOLDS.find(r => med >= r.minMedian) || RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]).name;
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const badgeKey = (username, levelId) => `badge:${username}:${levelId}`;
const xpKey    = (username, levelId) => `xp:${username}:${levelId}`;

export async function persistBadge(username, levelId, badgeName, xp) {
    await redisClient.set(badgeKey(username, levelId), badgeName);
    await redisClient.set(xpKey(username, levelId), String(xp));
}

export async function getUserBadges(username) {
    const keys = await redisClient.keys(`badge:${username}:*`);
    const result = {};
    for (const key of keys) {
        const levelId = parseInt(key.substring((`badge:${username}:`).length));
        const badge = await redisClient.get(key);
        const xpRaw = await redisClient.get(xpKey(username, levelId));
        result[levelId] = { badge, xp: xpRaw ? parseInt(xpRaw) : 0 };
    }
    return result;
}

// Médiane glissante des XP sur les N derniers niveaux validés (par ordre décroissant de levelId).
export async function computeUserRank(username, windowSize) {
    const keys = await redisClient.keys(`xp:${username}:*`);
    if (!keys.length) return { rank: 'Apprenti', median: 0, sample: 0 };
    const entries = [];
    for (const key of keys) {
        const levelId = parseInt(key.substring((`xp:${username}:`).length));
        const v = parseInt(await redisClient.get(key));
        if (!isNaN(v) && !isNaN(levelId)) entries.push({ levelId, xp: v });
    }
    entries.sort((a, b) => b.levelId - a.levelId);
    const recent = entries.slice(0, Math.max(1, windowSize));
    const med = median(recent.map(e => e.xp));
    return { rank: rankForMedian(med), median: med, sample: recent.length };
}
