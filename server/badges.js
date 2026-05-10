// Système de badges et de rang global pour AlgoMaze.
// Un badge est attribué à chaque niveau validé en fonction du score IA.
// Le rang global est calculé comme la médiane glissante des XP des N derniers niveaux.

import redisClient from './redisClient.js';
import config from './config.json' assert { type: 'json' };

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

// Persiste le badge et les XP en gardant le BEST EVER : si l'étudiant refait
// un niveau et obtient un score moins bon, on n'écrase pas son meilleur résultat.
// Cela garantit que la maîtrise globale (cumulée) ne peut que monter ou stagner,
// jamais baisser à cause d'une mauvaise tentative.
export async function persistBadge(username, levelId, badgeName, xp) {
    const existingXpRaw = await redisClient.get(xpKey(username, levelId));
    const existingXp = existingXpRaw ? parseInt(existingXpRaw) : 0;
    const newXp = parseInt(xp) || 0;
    if (newXp > existingXp) {
        await redisClient.set(badgeKey(username, levelId), badgeName);
        await redisClient.set(xpKey(username, levelId), String(newXp));
    }
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

// Maîtrise globale = somme des XP gagnés sur tous les niveaux validés, divisée par
// le maximum théorique (totalLevels × 200 pour du tout-Platine).
// Cette formule cumule naturellement avancement ET qualité :
//   - faire un niveau de plus = ajouter des XP = score qui monte
//   - faire un niveau en Platine au lieu d'Or = ajouter plus d'XP = score qui monte plus
// Pas de "sweet spot" : continuer ne pénalise jamais, et il faut combiner complétion
// et qualité pour atteindre les paliers hauts.
const MASTERY_LEVELS = {
    tresBonne:    { name: 'Très bonne maîtrise',  color: 'green' },
    satisfaisante:{ name: 'Maîtrise satisfaisante', color: 'blue' },
    fragile:      { name: 'Maîtrise fragile',     color: 'amber' },
    insuffisante: { name: 'Maîtrise insuffisante', color: 'red' }
};

const MAX_XP_PER_LEVEL = 200; // = XP d'un badge Platine

export function computeMastery(lastCompletedLevel, totalEarnedXp) {
    const totalLevels = (config && config.totalLevels) || 42;
    const thresholds = (config && config.masteryThresholds) || { fragile: 20, satisfaisante: 40, tresBonne: 70 };

    const safeLevel = Math.max(0, parseInt(lastCompletedLevel, 10) || 0);
    const safeXp = Math.max(0, parseInt(totalEarnedXp, 10) || 0);

    const maxTotalXp = totalLevels * MAX_XP_PER_LEVEL;
    const score = Math.max(0, Math.min(100, (safeXp / maxTotalXp) * 100));

    // Métriques annexes pour l'affichage / le tooltip.
    const progressPct = Math.max(0, Math.min(100, (safeLevel / totalLevels) * 100));
    const avgQualityPct = safeLevel > 0
        ? Math.max(0, Math.min(100, (safeXp / safeLevel) / MAX_XP_PER_LEVEL * 100))
        : 0;

    let level;
    if (score >= thresholds.tresBonne)            level = MASTERY_LEVELS.tresBonne;
    else if (score >= thresholds.satisfaisante)   level = MASTERY_LEVELS.satisfaisante;
    else if (score >= thresholds.fragile)         level = MASTERY_LEVELS.fragile;
    else                                          level = MASTERY_LEVELS.insuffisante;

    return {
        name: level.name,
        color: level.color,
        score: Math.round(score),
        progressPct: Math.round(progressPct),
        avgQualityPct: Math.round(avgQualityPct),
        completedLevels: safeLevel,
        totalLevels: totalLevels,
        totalXp: safeXp,
        maxTotalXp: maxTotalXp
    };
}

// Somme des XP cumulés sur tous les niveaux validés.
export async function computeUserTotalXp(username) {
    const keys = await redisClient.keys(`xp:${username}:*`);
    let total = 0;
    for (const key of keys) {
        const v = parseInt(await redisClient.get(key));
        if (!isNaN(v)) total += v;
    }
    return total;
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
