import jwt from 'jsonwebtoken';
import redisClient from './redisClient.js';

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
    throw new Error('JWT_SECRET manquant. Vérifiez votre fichier .env (voir .env.example).');
}

export const JWT_TTL_SECONDS = 16200; // 4h30 — couvre une demi-journée de cours
// Options communes pour les cookies "token" : align maxAge sur le TTL JWT pour que
// le cookie persiste à travers les redémarrages du navigateur (pas un cookie de session).
export const TOKEN_COOKIE_OPTIONS = {
    httpOnly: false,     // accessible au JS côté client (interceptor auth.js)
    secure: false,       // sera 'true' si on déploie derrière HTTPS strict
    sameSite: 'lax',
    maxAge: JWT_TTL_SECONDS * 1000,
    path: '/'
};

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

export var userFromToken = async (token) => {
    const decoded = verifyToken(token);
    var uid = decoded.userId
    var user = JSON.parse(await redisClient.get('user:' + uid));
    return user;
}

// Récupère le token d'auth depuis l'en-tête Authorization (Bearer) OU à défaut depuis le cookie.
// Cookie en fallback : permet aux routes API de fonctionner même quand le client a un Bearer
// stale (ex. après un reload où le cookie a été refresh côté serveur mais pas le localStorage).
export function getTokenFromReq(req) {
    const auth = req.headers && req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        const t = auth.substring(7);
        if (t) return t;
    }
    return (req.cookies && req.cookies.token) || null;
}

// Résout l'utilisateur courant pour une route API protégée.
// Renvoie {user, token} si OK, ou envoie une 401 et renvoie null sinon.
// Usage: `const ctx = await requireUser(req, res); if (!ctx) return;`
export async function requireUser(req, res) {
    const token = getTokenFromReq(req);
    if (!token) {
        res.status(401).send({ error: 'Not authenticated' });
        return null;
    }
    try {
        const user = await userFromToken(token);
        return { user, token };
    } catch (e) {
        res.status(401).send({ error: 'Session expired' });
        return null;
    }
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