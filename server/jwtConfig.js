import jwt from 'jsonwebtoken';
import redisClient from './redisClient.js';

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
    throw new Error('JWT_SECRET manquant. Vérifiez votre fichier .env (voir .env.example).');
}

export const JWT_TTL_SECONDS = 16200; // 4h30 — couvre une demi-journée de cours
export const TOKEN_COOKIE_NAME = 'token';

// Options communes pour les cookies "token" : align maxAge sur le TTL JWT pour que
// le cookie persiste à travers les redémarrages du navigateur (pas un cookie de session).
// `secure` est décidé par requête (voir cookieOptionsFor) : true dès que la requête est
// arrivée en HTTPS (directement, ou via X-Forwarded-Proto grâce à `trust proxy`).
export const TOKEN_COOKIE_OPTIONS = {
    httpOnly: false,     // accessible au JS côté client (auth.js copie le cookie en localStorage)
    secure: false,
    sameSite: 'lax',
    maxAge: JWT_TTL_SECONDS * 1000,
    path: '/'
};

export function cookieOptionsFor(req) {
    return { ...TOKEN_COOKIE_OPTIONS, secure: !!(req && req.secure) };
}

export function setTokenCookie(req, res, token) {
    res.cookie(TOKEN_COOKIE_NAME, token, cookieOptionsFor(req));
}

export function clearTokenCookie(res) {
    res.clearCookie(TOKEN_COOKIE_NAME, { path: '/' });
}

export const generateToken = (payload) => {
    return jwt.sign({ userId: payload }, secretKey, { expiresIn: JWT_TTL_SECONDS });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, secretKey);
    } catch (err) {
        throw new Error('Invalid token');
    }
};

export const decodeToken = (token) => {
    return jwt.decode(token);
};

// Si plus de la moitié du TTL est écoulée, renouvelle le token (sliding session).
// Retourne { token, refreshed }. Si le token est invalide, retourne { token: null, refreshed: false }.
export const slidingRefresh = (token) => {
    try {
        const decoded = jwt.verify(token, secretKey);
        const now = Math.floor(Date.now() / 1000);
        const total = decoded.exp - decoded.iat;
        const elapsed = now - decoded.iat;
        if (elapsed > total / 2) {
            const newToken = jwt.sign({ userId: decoded.userId }, secretKey, { expiresIn: JWT_TTL_SECONDS });
            return { token: newToken, refreshed: true };
        }
        return { token, refreshed: false };
    } catch (err) {
        return { token: null, refreshed: false };
    }
};

// Charge l'utilisateur Redis correspondant à un userId. Retourne null s'il n'existe pas.
export async function loadUser(userId) {
    if (!userId) return null;
    const raw = await redisClient.get('user:' + userId);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

export var userFromToken = async (token) => {
    const decoded = verifyToken(token);
    const user = await loadUser(decoded.userId);
    if (!user) throw new Error('Unknown user');
    return user;
}

// ---------------------------------------------------------------------------
// Résolution du token d'authentification.
//
// Un client peut présenter le token de deux façons : en-tête `Authorization: Bearer`
// (copie du cookie faite par auth.js en localStorage) et/ou cookie `token`. Le
// navigateur peut en outre envoyer PLUSIEURS cookies nommés `token` (par ex. un
// cookie posé sur le domaine parent par une autre application, ou un vieux cookie
// avec un autre path) — et cookie-parser ne conserve alors que le premier.
//
// Plutôt que de faire confiance aveuglément au premier candidat (un Bearer périmé
// en localStorage suffisait à faire échouer une session dont le cookie était
// pourtant valide), on collecte tous les candidats et on garde le token VALIDE le
// plus récent (exp maximal).
// ---------------------------------------------------------------------------

// Extrait tous les cookies `token` d'un en-tête Cookie brut, dans l'ordre d'envoi.
export function cookieTokenCandidates(cookieHeader) {
    if (!cookieHeader) return [];
    const out = [];
    for (const part of String(cookieHeader).split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() !== TOKEN_COOKIE_NAME) continue;
        let value = part.slice(eq + 1).trim();
        if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        try { value = decodeURIComponent(value); } catch (e) { /* valeur brute */ }
        if (value) out.push(value);
    }
    return out;
}

export function bearerTokenFromHeader(authorizationHeader) {
    if (!authorizationHeader || !/^Bearer\s+/i.test(authorizationHeader)) return null;
    const t = String(authorizationHeader).replace(/^Bearer\s+/i, '').trim();
    // "Bearer null" / "Bearer undefined" : un client sans token en localStorage.
    if (!t || t === 'null' || t === 'undefined') return null;
    return t;
}

export function tokenCandidatesFrom(authorizationHeader, cookieHeader) {
    const list = [];
    const bearer = bearerTokenFromHeader(authorizationHeader);
    if (bearer) list.push(bearer);
    for (const c of cookieTokenCandidates(cookieHeader)) {
        if (!list.includes(c)) list.push(c);
    }
    return list;
}

export function tokenCandidates(req) {
    const h = (req && req.headers) || {};
    return tokenCandidatesFrom(h.authorization, h.cookie);
}

// Retourne { token, decoded } pour le meilleur candidat valide (exp le plus lointain), sinon null.
export function resolveTokenFrom(authorizationHeader, cookieHeader) {
    let best = null;
    for (const token of tokenCandidatesFrom(authorizationHeader, cookieHeader)) {
        try {
            const decoded = jwt.verify(token, secretKey);
            if (!decoded || !decoded.userId) continue;
            if (!best || (decoded.exp || 0) > (best.decoded.exp || 0)) best = { token, decoded };
        } catch (e) { /* candidat invalide ou expiré : on passe au suivant */ }
    }
    return best;
}

export function resolveToken(req) {
    const h = (req && req.headers) || {};
    return resolveTokenFrom(h.authorization, h.cookie);
}

// Compat : token "utile" de la requête — le premier valide, sinon le premier présenté.
export function getTokenFromReq(req) {
    const resolved = resolveToken(req);
    if (resolved) return resolved.token;
    return tokenCandidates(req)[0] || null;
}

// Résout l'utilisateur courant pour une route API protégée.
// Renvoie {user, token} si OK, ou envoie une 401 et renvoie null sinon.
// Usage: `const ctx = await requireUser(req, res); if (!ctx) return;`
export async function requireUser(req, res) {
    // req.auth est posé par le middleware de session (index.js) ; on retombe sur une
    // résolution directe si la route est appelée hors de ce middleware.
    const auth = req.auth !== undefined ? req.auth : resolveToken(req);
    if (!auth) {
        const presented = tokenCandidates(req).length > 0;
        res.status(401).send({ error: presented ? 'Session expired' : 'Not authenticated' });
        return null;
    }
    const user = await loadUser(auth.decoded.userId);
    if (!user) {
        res.status(401).send({ error: 'Unknown user' });
        return null;
    }
    return { user, token: auth.token };
}

// Variante admin : 401 si pas authentifié, 403 si pas admin.
export async function requireAdmin(req, res) {
    const ctx = await requireUser(req, res);
    if (!ctx) return null;
    if (!ctx.user.isAdmin) {
        res.status(403).send({ error: 'You are not an administrator' });
        return null;
    }
    return ctx;
}
