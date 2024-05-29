import jwt from 'jsonwebtoken';
import redisClient from './redisClient.js';

const secretKey = "my_secret_key_jwt";

export const generateToken = (payload) => {
    return jwt.sign({ userId: payload }, secretKey, { expiresIn: '1h' });
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

export var userFromToken = async (token) => {
    const decoded = verifyToken(token);
    var uid = decoded.userId
    var user = JSON.parse(await redisClient.get('user:' + uid));
    return user;
}