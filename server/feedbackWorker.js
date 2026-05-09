// File de travail pour les évaluations IA des solutions des étudiants.
// Utilise Redis comme broker avec un pattern robuste (pending -> processing) :
// si le serveur crashe pendant un traitement, le job est récupéré au prochain démarrage.
// Un seul worker tourne globalement (file traitée séquentiellement) pour ne pas
// saturer le LLM.

import { createClient } from 'redis';
import redisClient from './redisClient.js';
import { evaluateSolution } from './llmClient.js';
import { badgeForScore, persistBadge } from './badges.js';

const PENDING_KEY = 'feedback:queue:pending';
const PROCESSING_KEY = 'feedback:queue:processing';

const statusKey = (username, levelId) => `feedback:status:${username}:${levelId}`;
const resultKey = (username, levelId) => `feedback:result:${username}:${levelId}`;
const jobKey = (jobId) => `feedback:job:${jobId}`;

function newJobId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Enfile un job d'évaluation. Si une évaluation est déjà en attente/en cours
// pour ce (user, level), refuse silencieusement (anti-spam).
// Retourne true si enfilé, false sinon.
export async function enqueueFeedbackJob({ username, levelId, code, instructions, constraints }) {
    const status = await redisClient.get(statusKey(username, levelId));
    if (status === 'pending') {
        return false;
    }

    const jobId = newJobId();
    const job = { jobId, username, levelId, code, instructions, constraints, queuedAt: Date.now() };
    await redisClient.set(jobKey(jobId), JSON.stringify(job));
    await redisClient.set(statusKey(username, levelId), 'pending');
    await redisClient.rPush(PENDING_KEY, jobId);
    return true;
}

export async function getFeedbackStatus(username, levelId) {
    return await redisClient.get(statusKey(username, levelId));
}

export async function getFeedbackResult(username, levelId) {
    const raw = await redisClient.get(resultKey(username, levelId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// Récupère les jobs laissés dans "processing" suite à un crash et les remet en "pending".
async function recoverProcessingJobs() {
    let recovered = 0;
    while (true) {
        // Déplacement atomique : prend le 1er de processing, le remet en tête de pending.
        const jobId = await redisClient.lMove(PROCESSING_KEY, PENDING_KEY, 'LEFT', 'LEFT');
        if (!jobId) break;
        recovered++;
    }
    if (recovered > 0) {
        console.log(`[feedbackWorker] ${recovered} job(s) récupéré(s) depuis processing.`);
    }
}

async function processJob(jobId, io) {
    const raw = await redisClient.get(jobKey(jobId));
    if (!raw) {
        // Job manquant — on nettoie processing et on passe.
        await redisClient.lRem(PROCESSING_KEY, 1, jobId);
        return;
    }
    let job;
    try {
        job = JSON.parse(raw);
    } catch (e) {
        await redisClient.lRem(PROCESSING_KEY, 1, jobId);
        await redisClient.del(jobKey(jobId));
        return;
    }

    const { username, levelId, code, instructions, constraints } = job;
    try {
        const result = await evaluateSolution({ instructions, constraints, code });

        // Calcule et persiste le badge / XP pour ce niveau.
        const badge = badgeForScore(result.score, result.constraintsRespected);
        await persistBadge(username, levelId, badge.name, badge.xp);

        const enriched = { ...result, badge: badge.name, xp: badge.xp, evaluatedAt: Date.now() };
        await redisClient.set(resultKey(username, levelId), JSON.stringify(enriched));
        await redisClient.set(statusKey(username, levelId), 'done');
        if (io) {
            io.to('user:' + username).emit('feedback:ready', { levelId, result: enriched });
        }
    } catch (err) {
        // err.cause contient le vrai motif réseau pour les "fetch failed"
        // (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, …).
        const causeCode = err.cause && (err.cause.code || err.cause.message);
        const fullMessage = causeCode ? `${err.message} (cause: ${causeCode})` : err.message;
        console.error(`[feedbackWorker] job ${jobId} échec :`, fullMessage);
        if (err.cause) console.error('[feedbackWorker] cause :', err.cause);
        await redisClient.set(statusKey(username, levelId), 'error');
        await redisClient.set(resultKey(username, levelId), JSON.stringify({
            error: fullMessage,
            evaluatedAt: Date.now()
        }));
        if (io) {
            io.to('user:' + username).emit('feedback:error', { levelId, error: fullMessage });
        }
    } finally {
        await redisClient.lRem(PROCESSING_KEY, 1, jobId);
        await redisClient.del(jobKey(jobId));
    }
}

// Démarre le worker. Utilise un client Redis dédié pour la commande bloquante
// (sinon ça bloque toutes les autres opérations Redis).
export async function startFeedbackWorker(io) {
    await recoverProcessingJobs();

    const blockingClient = createClient({
        url: 'redis://' + process.env.REDIS_USER + ':' + process.env.REDIS_PASSWORD
            + '@' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT
    });
    blockingClient.on('error', (err) => console.error('[feedbackWorker] Redis error:', err));
    await blockingClient.connect();
    console.log('[feedbackWorker] démarré');

    (async function loop() {
        while (true) {
            try {
                // Bloque indéfiniment jusqu'à ce qu'un job soit disponible.
                const jobId = await blockingClient.blMove(PENDING_KEY, PROCESSING_KEY, 'LEFT', 'RIGHT', 0);
                if (jobId) {
                    await processJob(jobId, io);
                }
            } catch (err) {
                console.error('[feedbackWorker] loop error :', err);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    })();
}
