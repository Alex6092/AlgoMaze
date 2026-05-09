import jwt from 'jsonwebtoken';
import redisClient from './redisClient.js';

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
    throw new Error('JWT_SECRET manquant. Vérifiez votre fichier .env (voir .env.example).');
}

export const JWT_TTL_SECONDS = 3600; // 1h

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