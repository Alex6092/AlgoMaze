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

// Maîtrise globale = dimension limitante entre l'avancement (lastCompletedLevel / totalLevels)
// et la qualité (médiane XP / 200, où 200 = Platine = qualité max).
// Quatre paliers configurables via config.json (masteryThresholds, en %).
const MASTERY_LEVELS = {
    tresBonne:    { name: 'Très bonne maîtrise',  color: 'green' },
    satisfaisante:{ name: 'Maîtrise satisfaisante', color: 'blue' },
    fragile:      { name: 'Maîtrise fragile',     color: 'amber' },
    insuffisante: { name: 'Maîtrise insuffisante', color: 'red' }
};

export function computeMastery(lastCompletedLevel, medianXp) {
    const totalLevels = (config && config.totalLevels) || 42;
    const thresholds = (config && config.masteryThresholds) || { fragile: 20, satisfaisante: 40, tresBonne: 70 };

    const safeLevel = Math.max(0, parseInt(lastCompletedLevel, 10) || 0);
    const safeMedian = Math.max(0, parseFloat(medianXp) || 0);

    // Avancement : 100 % atteint = niveau totalLevels validé. Plafonné à 100 (les niveaux bonus
    // ne pénalisent pas et n'ajoutent pas non plus puisqu'ils sont au-delà).
    const progressPct = Math.max(0, Math.min(100, (safeLevel / totalLevels) * 100));

    // Qualité : Platine (200 XP médian) = 100 %, Or (100) = 50 %, Argent (50) = 25 %, etc.
    const qualityPct  = Math.max(0, Math.min(100, safeMedian / 2));

    // Score final = dimension limitante : il faut être bon ET avancé pour atteindre les paliers hauts.
    const score = Math.min(progressPct, qualityPct);

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
        qualityPct: Math.round(qualityPct)
    };
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
