// File de travail pour les évaluations IA des solutions des étudiants.
//
// La génération est déléguée au load balancer d'inférence (lbClient.js), qui gère
// la file d'attente, la capacité des serveurs et les réessais. AlgoMaze garde :
//   1. une file Redis de SOUMISSION (pending -> processing), robuste aux crashs :
//      un job laissé dans processing est remis en file au démarrage ;
//   2. la liste des jobs SOUMIS en attente de résultat. Le résultat arrive par le
//      callback signé du load balancer (handleCallback) ; une relève périodique
//      interroge le load balancer pour les callbacks perdus ;
//   3. le traitement du résultat (badge, saut de qualité, EFE, WebSocket).
//
// Anti-relance : une solution identique (après normalisation) à une solution déjà
// évaluée sur le même niveau, ou très proche d'une solution déjà évaluée du même
// élève, reçoit l'évaluation existante sans nouvel appel au modèle. Relancer
// l'évaluation ne permet donc plus de « tenter sa chance » pour un meilleur badge.

import { createClient } from 'redis';
import redisClient from './redisClient.js';
import config from './config.json' with { type: 'json' };
import { submitEvaluation, getJob, parseEvaluation, verifySignature, lbConfig, PROMPT_VERSION } from './lbClient.js';
import { canonicalize, fingerprint, similarity } from './solutionFingerprint.js';
import { badgeForScore, persistBadge, computeEfeCouleur } from './badges.js';
import { detectQualityJump } from './cheatDetection.js';
import { isEfeConfigured, pushNote, getOngoingDevoir, getCompetenceCode } from './efeClient.js';

const PENDING_KEY = 'feedback:queue:pending';
const PROCESSING_KEY = 'feedback:queue:processing';
const SUBMITTED_KEY = 'feedback:queue:submitted';

const statusKey = (username, levelId) => `feedback:status:${username}:${levelId}`;
const resultKey = (username, levelId) => `feedback:result:${username}:${levelId}`;
const jobKey = (jobId) => `feedback:job:${jobId}`;
const doneKey = (jobId) => `feedback:done:${jobId}`;

// Les caches d'évaluations dépendent du prompt et du modèle : en changer repart d'un cache vide.
const cacheScope = () => `v${PROMPT_VERSION}:${lbConfig().model}`;
const levelCacheKey = (levelId, fp) => `feedback:cache:${cacheScope()}:${levelId}:${fp}`;
const studentCacheKey = (username, levelId) => `feedback:evaluated:${cacheScope()}:${username}:${levelId}`;

const MAX_SUBMIT_ATTEMPTS = 5;
const STUDENT_CACHE_SIZE = 20;
const DONE_TTL_SECONDS = 7 * 86400;

let io = null;
const completing = new Set();

function reuseConfig() {
    const c = (config && config.aiReuse) || {};
    return { enabled: c.enabled !== false, similarity: c.similarity ?? 0.9 };
}

function newJobId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Stockage Redis de la dernière couleur poussée vers EFE pour chaque (utilisateur, devoir).
// Permet de ne PAS rappeler EFE si la couleur n'a pas changé depuis le dernier push,
// économisant des appels HTTP et respectant le besoin "appel uniquement quand
// le niveau de compétence évolue".
const lastEfeColorKey = (username, devoirKey) => `efe:last_color:${username}:${devoirKey}`;

// Pousse la note "progression globale" vers EFE pour un étudiant si toutes les
// conditions sont réunies : EFE configuré, compétence code défini, moodleId
// connu, ET la couleur calculée diffère de la dernière couleur poussée.
async function maybePushOngoingNote(username) {
    if (!isEfeConfigured()) return;
    const competenceCode = getCompetenceCode();
    if (!competenceCode) return; // EFE configuré mais pas de code de compétence : on ne sait pas quoi pousser.

    const userRaw = await redisClient.get('user:' + username);
    if (!userRaw) return;
    const user = JSON.parse(userRaw);
    if (!user.moodleId) return; // Pas de moodleId connu → impossible de cibler l'étudiant côté EFE.

    const { couleur } = await computeEfeCouleur(username, undefined); // undefined → totalLevels (parcours complet)
    const devoir = getOngoingDevoir();

    const lastColor = await redisClient.get(lastEfeColorKey(username, devoir.key));
    if (lastColor === couleur) return; // Pas de changement → pas d'appel API.

    const result = await pushNote({
        idMoodleEleve: user.moodleId,
        competenceCode,
        couleur,
        devoirKey: devoir.key,
        devoirLabel: devoir.label,
        commentaire: `Mise à jour automatique depuis AlgoMaze (couleur ${lastColor || 'initiale'} → ${couleur}).`
    });

    if (result.ok) {
        await redisClient.set(lastEfeColorKey(username, devoir.key), couleur);
        console.log(`[EFE] ${username} (moodleId=${user.moodleId}) : ${lastColor || '∅'} → ${couleur} [${result.action}]`);
    } else if (result.reason === 'http' && result.status === 403) {
        // L'étudiant n'appartient pas à l'établissement de la clé, ou n'existe pas dans EFE.
        // On logge mais on ne lève pas — on respecte le besoin "skip silencieux".
        console.warn(`[EFE] ${username} (moodleId=${user.moodleId}) : skip (élève inconnu côté EFE, HTTP ${result.status})`);
    } else {
        console.warn(`[EFE] ${username} (moodleId=${user.moodleId}) : push échec`, result);
    }
}

// ---------------------------------------------------------------------------
// Réutilisation des évaluations
// ---------------------------------------------------------------------------

// Cherche une évaluation déjà produite pour cette solution : identique (après
// normalisation) sur le niveau, ou très proche d'une solution du même élève.
export async function findReusableEvaluation(username, levelId, code) {
    const settings = reuseConfig();
    if (!settings.enabled) return null;
    const fp = fingerprint(code);
    const cached = await redisClient.get(levelCacheKey(levelId, fp));
    if (cached) return { evaluation: JSON.parse(cached), match: 'identical', fingerprint: fp, similarity: 1 };

    const canonical = canonicalize(code);
    let best = null;
    for (const entry of JSON.parse((await redisClient.get(studentCacheKey(username, levelId))) || '[]')) {
        const score = similarity(canonical, entry.canonical);
        if (score >= settings.similarity && (!best || score > best.similarity)) {
            best = { evaluation: entry.evaluation, match: 'similar', fingerprint: entry.fingerprint, similarity: score };
        }
    }
    if (best) best.similarity = Math.round(best.similarity * 1000) / 1000;
    return best;
}

async function rememberEvaluation(username, levelId, code, evaluation) {
    const fp = fingerprint(code);
    await redisClient.set(levelCacheKey(levelId, fp), JSON.stringify(evaluation));
    const key = studentCacheKey(username, levelId);
    const entries = JSON.parse((await redisClient.get(key)) || '[]').filter((e) => e.fingerprint !== fp);
    entries.unshift({ fingerprint: fp, canonical: canonicalize(code), evaluation });
    await redisClient.set(key, JSON.stringify(entries.slice(0, STUDENT_CACHE_SIZE)));
}

// ---------------------------------------------------------------------------
// Application d'un résultat
// ---------------------------------------------------------------------------

async function applyEvaluation(username, levelId, evaluation, extra = {}) {
    // Calcule le badge / XP pour ce niveau.
    const badge = badgeForScore(evaluation.score, evaluation.constraintsRespected);

    // Détection d'un saut de qualité anormal (ex. solution Bronze d'habitude
    // → soudain Platine sur un niveau dur). Calculé AVANT persistBadge pour
    // comparer aux XP existants.
    const jumpInfo = await detectQualityJump(username, levelId, badge.xp);

    await persistBadge(username, levelId, badge.name, badge.xp);

    // Remontée automatique vers EFE : on push uniquement si la couleur de
    // compétence change (ex : passage de jaune à bleu). Sinon, pas d'appel API
    // — la note côté EFE n'aurait rien à mettre à jour.
    try { await maybePushOngoingNote(username); }
    catch (e) { console.error(`[feedbackWorker] EFE push (ongoing) échec pour ${username}:`, e.message); }

    const enriched = {
        ...evaluation,
        ...extra,
        badge: badge.name,
        xp: badge.xp,
        evaluatedAt: Date.now(),
        qualityJump: jumpInfo
    };
    await redisClient.set(resultKey(username, levelId), JSON.stringify(enriched));
    await redisClient.set(statusKey(username, levelId), 'done');
    if (io) {
        io.to('user:' + username).emit('feedback:ready', { levelId, result: enriched });
    }
    return enriched;
}

async function forgetJob(jobId) {
    await redisClient.lRem(SUBMITTED_KEY, 0, jobId);
    await redisClient.lRem(PROCESSING_KEY, 0, jobId);
    await redisClient.del(jobKey(jobId));
}

async function failJob(job, message) {
    console.error(`[feedbackWorker] job ${job.jobId} échec :`, message);
    await redisClient.set(statusKey(job.username, job.levelId), 'error');
    await redisClient.set(resultKey(job.username, job.levelId), JSON.stringify({
        error: message,
        evaluatedAt: Date.now()
    }));
    if (io) {
        io.to('user:' + job.username).emit('feedback:error', { levelId: job.levelId, error: message });
    }
    await forgetJob(job.jobId);
}

// ---------------------------------------------------------------------------
// API du module
// ---------------------------------------------------------------------------

// Enfile un job d'évaluation. Si une évaluation est déjà en attente/en cours
// pour ce (user, level), refuse silencieusement (anti-spam).
// Si une évaluation réutilisable existe, elle est appliquée immédiatement, sans
// appel au modèle ; `force` (régénération par un admin) l'ignore et la remplace.
// Retourne true si enfilé ou évalué, false sinon.
export async function enqueueFeedbackJob({ username, levelId, code, instructions, constraints, force = false }) {
    const status = await redisClient.get(statusKey(username, levelId));
    if (status === 'pending') {
        return false;
    }

    if (!force) {
        const reusable = await findReusableEvaluation(username, levelId, code);
        if (reusable) {
            await applyEvaluation(username, levelId, reusable.evaluation, {
                reused: { match: reusable.match, similarity: reusable.similarity, fingerprint: reusable.fingerprint }
            });
            return true;
        }
    }

    const jobId = newJobId();
    const job = { jobId, username, levelId, code, instructions, constraints, queuedAt: Date.now(), submitAttempts: 0, resubmits: 0 };
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

async function loadJob(jobId) {
    const raw = await redisClient.get(jobKey(jobId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// Soumet un job au load balancer, puis le range parmi les jobs en attente de résultat.
// Une erreur passagère (quota, file pleine, réseau) le reprogramme ; les autres l'échouent.
export async function submitJob(jobId) {
    const job = await loadJob(jobId);
    if (!job) {
        await forgetJob(jobId);
        return;
    }
    try {
        job.lbJobId = await submitEvaluation({ ...job, attempt: job.resubmits || 0 });
        job.submittedAt = Date.now();
        job.retryAt = null;
    } catch (err) {
        job.submitAttempts = (job.submitAttempts || 0) + 1;
        if (!err.transient || job.submitAttempts >= MAX_SUBMIT_ATTEMPTS) {
            await failJob(job, err.message);
            return;
        }
        job.lbJobId = null;
        job.retryAt = Date.now() + (err.retryAfterMs || 60000);
        console.warn(`[feedbackWorker] job ${jobId} : ${err.message} — nouvel essai à ${new Date(job.retryAt).toISOString()}`);
    }
    await redisClient.set(jobKey(jobId), JSON.stringify(job));
    await redisClient.lRem(SUBMITTED_KEY, 0, jobId);
    await redisClient.rPush(SUBMITTED_KEY, jobId);
    await redisClient.lRem(PROCESSING_KEY, 0, jobId);
}

// Traite la fin d'un job du load balancer (callback ou relève). Idempotent : un
// callback répété ou une relève concurrente n'applique le résultat qu'une fois.
export async function completeJob(jobId, lbJob) {
    if (completing.has(jobId) || (await redisClient.get(doneKey(jobId)))) return 'duplicate';
    completing.add(jobId);
    try {
        const job = await loadJob(jobId);
        if (!job) return 'unknown';
        if (lbJob.status === 'succeeded') {
            let evaluation;
            try {
                evaluation = parseEvaluation(lbJob.result);
            } catch (err) {
                await failJob(job, err.message);
                return 'failed';
            }
            await rememberEvaluation(job.username, job.levelId, job.code, evaluation);
            await applyEvaluation(job.username, job.levelId, evaluation);
            await forgetJob(jobId);
        } else {
            const error = lbJob.error || {};
            await failJob(job, `Évaluation ${lbJob.status}${error.code ? ` (${error.code})` : ''} : ${error.message || 'échec de la génération'}`);
        }
        await redisClient.set(doneKey(jobId), '1', { EX: DONE_TTL_SECONDS });
        return 'done';
    } finally {
        completing.delete(jobId);
    }
}

// Callback signé du load balancer. Retourne le code HTTP à renvoyer.
export async function handleCallback(jobId, rawBody, headers) {
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    if (!verifySignature(raw, headers['x-callback-timestamp'], headers['x-callback-signature'], lbConfig().callbackSecret)) {
        return 401;
    }
    let event;
    try { event = JSON.parse(raw); } catch (e) { return 400; }
    if (!event || event.id !== headers['x-event-id'] || !event.job_id) return 400;
    if (!jobId) return 200; // Rien à rattacher : accusé de réception pour stopper les réessais.
    const job = await loadJob(jobId);
    // Le callback peut précéder l'enregistrement de l'identifiant LB (réponse au POST pas encore traitée).
    if (job && job.lbJobId && job.lbJobId !== event.job_id) return 400;
    await completeJob(jobId, { status: event.status, result: event.result, error: event.error });
    return 200;
}

// Relève de secours : reprogramme les soumissions différées et interroge le load
// balancer pour les jobs dont le callback tarde.
export async function pollSubmitted({ now = Date.now(), staleMs = 5 * 60000 } = {}) {
    for (const jobId of await redisClient.lRange(SUBMITTED_KEY, 0, -1)) {
        try {
            const job = await loadJob(jobId);
            if (!job) {
                await redisClient.lRem(SUBMITTED_KEY, 0, jobId);
                continue;
            }
            if (!job.lbJobId) {
                if ((job.retryAt || 0) <= now) {
                    await redisClient.lRem(SUBMITTED_KEY, 0, jobId);
                    await redisClient.rPush(PENDING_KEY, jobId);
                }
                continue;
            }
            if (now - (job.submittedAt || 0) < staleMs) continue;
            let lbJob;
            try {
                lbJob = await getJob(job.lbJobId);
            } catch (err) {
                if (err.status !== 404) throw err;
                lbJob = null;
            }
            if (!lbJob || lbJob.content_expired) {
                // Job inconnu ou résultat purgé côté load balancer : nouvelle soumission.
                job.lbJobId = null;
                job.resubmits = (job.resubmits || 0) + 1;
                await redisClient.set(jobKey(jobId), JSON.stringify(job));
                await redisClient.lRem(SUBMITTED_KEY, 0, jobId);
                await redisClient.rPush(PENDING_KEY, jobId);
            } else if (['succeeded', 'failed', 'cancelled', 'expired'].includes(lbJob.status)) {
                await completeJob(jobId, lbJob);
            }
        } catch (err) {
            console.error(`[feedbackWorker] relève du job ${jobId} :`, err.message);
        }
    }
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

export function setFeedbackIo(socketIo) {
    io = socketIo;
}

// Démarre le worker. Utilise un client Redis dédié pour la commande bloquante
// (sinon ça bloque toutes les autres opérations Redis). La boucle ne fait que
// soumettre : la génération elle-même attend dans la file du load balancer.
export async function startFeedbackWorker(socketIo) {
    io = socketIo;
    await recoverProcessingJobs();

    const blockingClient = createClient({
        url: 'redis://' + process.env.REDIS_USER + ':' + process.env.REDIS_PASSWORD
            + '@' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT
    });
    blockingClient.on('error', (err) => console.error('[feedbackWorker] Redis error:', err));
    await blockingClient.connect();
    console.log('[feedbackWorker] démarré');

    const pollMs = (parseInt(process.env.FEEDBACK_POLL_SECONDS || '120', 10) || 120) * 1000;
    setInterval(() => {
        pollSubmitted().catch((err) => console.error('[feedbackWorker] relève :', err.message));
    }, pollMs).unref();

    (async function loop() {
        while (true) {
            try {
                // Bloque indéfiniment jusqu'à ce qu'un job soit disponible.
                const jobId = await blockingClient.blMove(PENDING_KEY, PROCESSING_KEY, 'LEFT', 'RIGHT', 0);
                if (jobId) {
                    await submitJob(jobId);
                }
            } catch (err) {
                console.error('[feedbackWorker] loop error :', err);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    })();
}
