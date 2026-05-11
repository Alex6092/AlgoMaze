// Limiteurs de taux pour les routes sensibles aux abus :
// - /user/login : brute-force de mot de passe
// - /checkanswer / /precheck : spam de soumission (et donc de charge LLM via la queue)
//
// Particularité : les lycéens partagent souvent une seule IP publique (NAT école).
// Limiter par IP seule sur /user/login bloquerait toute une classe. On combine
// donc l'IP et le username pour les routes non authentifiées, et on bascule sur
// l'username extrait du JWT pour les routes authentifiées.

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { decodeToken } from './jwtConfig.js';

// Récupère le username sans vérifier la signature : c'est suffisant pour
// bucketiser les requêtes du rate-limiter (un token forgé crée juste un
// bucket à part, sans impact).
function userKeyFromToken(req) {
    const auth = req.headers && req.headers.authorization;
    const token = (auth && auth.startsWith('Bearer '))
        ? auth.substring(7)
        : (req.cookies && req.cookies.token);
    if (!token) return null;
    try {
        const decoded = decodeToken(token);
        if (decoded && decoded.userId) return decoded.userId;
    } catch (e) {}
    return null;
}

// /user/login : 5 tentatives par fenêtre de 5 min, identifiées par IP + username.
// Un étudiant qui tape mal son mot de passe ne bloque pas ses camarades sur la
// même IP. Mais 6 tentatives sur le même couple (IP, username) → blocage.
export const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const u = (req.body && req.body.username ? String(req.body.username) : '').toLowerCase();
        // ipKeyGenerator normalise les IPv6 sur /64 pour éviter qu'un attaquant
        // saute le quota en changeant un suffixe IPv6.
        return 'login:' + ipKeyGenerator(req) + ':' + u;
    },
    message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' }
});

// /checkanswer : 20 par minute par utilisateur authentifié.
// Largement au-dessus de l'usage normal (un étudiant clique rarement plus de 5
// fois en 60 sec) et empêche un script de saturer la queue IA.
export const checkAnswerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => 'check:' + (userKeyFromToken(req) || ipKeyGenerator(req)),
    message: { error: 'Trop de soumissions consécutives. Patiente quelques secondes.' }
});

// /precheck : 60 par minute par utilisateur — plus permissif, car le bouton "Run"
// est utilisé fréquemment pour tester sa solution. Une seconde de cooldown moyen
// reste raisonnable pour un usage humain.
export const precheckLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => 'precheck:' + (userKeyFromToken(req) || ipKeyGenerator(req)),
    message: { error: 'Trop d\'exécutions consécutives. Patiente un instant.' }
});
