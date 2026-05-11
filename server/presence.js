// État de présence en mémoire pour la vue live enseignant.
// Pour chaque étudiant connecté ou récemment actif, on stocke un objet de présence
// que le serveur émet aux clients admin via Socket.IO (room 'admins').
//
// Ce module ne stocke RIEN en Redis : c'est volontaire. Les données ne sont utiles
// qu'en temps réel (pendant un cours) ; elles sont reconstituées au redémarrage à
// partir des connexions Socket.IO entrantes.

import redisClient from './redisClient.js';
import { computeUserRank, computeUserTotalXp, computeMastery } from './badges.js';
import config from './config.json' assert { type: 'json' };

const presence = new Map(); // username -> state
let _io = null;

// Référence vers l'instance Socket.IO, injectée après init.
export function setIo(io) {
    _io = io;
}

// Récupère ou crée l'entrée de présence pour un utilisateur.
function ensureEntry(username) {
    let cur = presence.get(username);
    if (!cur) {
        cur = {
            username,
            online: false,
            connectedAt: null,
            disconnectedAt: null,
            lastSeenAt: Date.now(),
            currentLevel: null,
            levelStartedAt: null,
            lastEvent: null,
            lastCheckResult: null,
            failedAttemptsOnLevel: 0,
            mastery: null,
            signals: null
        };
        presence.set(username, cur);
    }
    return cur;
}

// Enregistre un événement de présence et le propage aux admins.
// type : 'connect' | 'disconnect' | 'view-level' | 'precheck' | 'check' | 'heartbeat'
export async function recordEvent(username, evt) {
    if (!username) return;
    const cur = ensureEntry(username);
    const now = Date.now();
    cur.lastSeenAt = now;

    switch (evt.type) {
        case 'connect':
            cur.online = true;
            cur.connectedAt = now;
            cur.disconnectedAt = null;
            // Charge l'info de maîtrise au démarrage (une seule fois par connexion).
            try { cur.mastery = await loadMastery(username); } catch (e) {}
            break;

        case 'disconnect':
            cur.online = false;
            cur.disconnectedAt = now;
            break;

        case 'view-level':
            if (cur.currentLevel !== evt.levelId) {
                cur.currentLevel = evt.levelId;
                cur.levelStartedAt = now;
                cur.failedAttemptsOnLevel = 0;
            }
            cur.lastEvent = 'view-level';
            break;

        case 'precheck':
            if (cur.currentLevel !== evt.levelId) {
                cur.currentLevel = evt.levelId;
                cur.levelStartedAt = now;
                cur.failedAttemptsOnLevel = 0;
            }
            cur.lastEvent = 'precheck';
            if (evt.signals) cur.signals = evt.signals;
            break;

        case 'check':
            if (cur.currentLevel !== evt.levelId) {
                cur.currentLevel = evt.levelId;
                cur.levelStartedAt = now;
                cur.failedAttemptsOnLevel = 0;
            }
            cur.lastEvent = 'check';
            cur.lastCheckResult = !!evt.result;
            if (evt.result) {
                cur.failedAttemptsOnLevel = 0;
                // Sur validation, on rafraîchit la maîtrise (l'XP a pu augmenter).
                try { cur.mastery = await loadMastery(username); } catch (e) {}
            } else {
                cur.failedAttemptsOnLevel = (cur.failedAttemptsOnLevel || 0) + 1;
            }
            if (evt.signals) cur.signals = evt.signals;
            break;

        case 'heartbeat':
            // Ne modifie que lastSeenAt (déjà fait).
            break;
    }

    if (_io) {
        _io.to('admins').emit('presence:update', cur);
    }
}

// Snapshot complet (pour la connexion initiale d'un admin).
export function getSnapshot() {
    return Array.from(presence.values());
}

// Calcule la maîtrise actuelle d'un utilisateur depuis Redis.
async function loadMastery(username) {
    try {
        const userRaw = await redisClient.get('user:' + username);
        if (!userRaw) return null;
        const u = JSON.parse(userRaw);
        const totalXp = await computeUserTotalXp(username);
        const m = computeMastery(u.lastCompletedLevel || 0, totalXp);
        return { name: m.name, color: m.color, score: m.score, level: u.lastCompletedLevel || 0 };
    } catch (e) {
        return null;
    }
}

// Nettoyage périodique : supprime les utilisateurs déconnectés depuis plus de 30 min.
const CLEANUP_INTERVAL_MS = 60 * 1000;
const STALE_AFTER_MS = 30 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [username, state] of presence.entries()) {
        if (!state.online && state.disconnectedAt && (now - state.disconnectedAt > STALE_AFTER_MS)) {
            presence.delete(username);
            if (_io) _io.to('admins').emit('presence:remove', { username });
        }
    }
}, CLEANUP_INTERVAL_MS);
