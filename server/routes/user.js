import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import { generateToken, setTokenCookie, clearTokenCookie, requireUser, requireAdmin } from '../jwtConfig.js';
import { isValidUsername, normalizeUsername, escapeKeyPattern } from '../usernames.js';
import { loginLimiter } from '../rateLimit.js';
import { recordEvent as recordPresenceEvent } from '../presence.js';
import redisClient from '../redisClient.js';
import config from '../config.json' assert { type: 'json' };

const PASSWORD_MAX_LENGTH = 200;

function isValidPassword(password) {
    return typeof password === 'string' && password.length > 0 && password.length <= PASSWORD_MAX_LENGTH;
}

// User registration
router.post('/register', async (req, res) => {
    if(config.allowRegistration)
    {
        try {
            const body = req.body || {};
            const username = normalizeUsername(body.username);
            const password = body.password;
            if (!isValidUsername(username) || !/^[a-z0-9._@+-]+$/.test(username)) {
                return res.status(400).send({ error: 'Nom d\'utilisateur invalide (lettres, chiffres, . _ @ + - uniquement).' });
            }
            if (!isValidPassword(password)) {
                return res.status(400).send({ error: 'Mot de passe invalide.' });
            }
            var exists = await redisClient.exists('user:' + username);
            if(!exists)
            {
                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = {
                    username: username,
                    password: hashedPassword,
                    lastCompletedLevel: 0,
                    isAdmin: false
                };
                await redisClient.set('user:' + username, JSON.stringify(newUser));
                res.status(201).send({ message: 'User created successfully' });
            }
            else
            {
                res.status(409).send({ error: 'Ce nom d\'utilisateur est déjà pris.' });
            }
        } catch (error) {
            console.log("[ERROR] /user/register " + error);
            res.status(500).send({ error: 'Error creating user' });
        }
    }
    else
    {
        res.status(403).send({ error: 'Registration is not allowed at the moment, contact the system administrator.' });
    }
});

router.put('/updatepassword', async (req, res) => {
    try
    {
        const ctx = await requireAdmin(req, res);
        if (!ctx) return;
        const body = req.body || {};
        const username = normalizeUsername(body.username);
        const password = body.password;
        if (!isValidUsername(username)) return res.status(400).send({ error: 'Invalid username' });
        if (!isValidPassword(password)) return res.status(400).send({ error: 'Invalid password' });

        if(await redisClient.exists('user:' + username))
        {
            const hashedPassword = await bcrypt.hash(password, 10);

            var updatedUserData = await redisClient.get('user:' + username);
            updatedUserData = JSON.parse(updatedUserData);
            updatedUserData.password = hashedPassword;
            await redisClient.set('user:' + username, JSON.stringify(updatedUserData));

            res.send({ user: username, status: 'User updated successfully' });
        }
        else
        {
            res.status(404).send({ error: 'User ' + username + ' does not exist !'});
        }
    } catch (error) {
        console.log("[ERROR] /user/updatepassword " + error);
        res.status(500).send({ error: 'Failed to update user password' });
    }
});

// User login (rate-limité pour bloquer le brute-force par couple IP+username)
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const body = req.body || {};
        const username = normalizeUsername(body.username);
        const password = body.password;
        if (!isValidUsername(username) || !isValidPassword(password)) {
            return res.status(400).send({ error: 'Identifiants requis' });
        }
        var exists = await redisClient.exists('user:' + username);
        if(exists)
        {
            const user = JSON.parse(await redisClient.get('user:' + username));
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).send({ error: 'Invalid credentials' });

            const token = generateToken(username);
            setTokenCookie(req, res, token);
            res.send({ token });
        }
        else
        {
            return res.status(404).send({ error: 'User not found' });
        }
    }
    catch (error)
    {
        console.log("[ERROR] /user/login " + error);
        res.status(500).send({ error: 'Error logging in' });
    }
});

router.post('/logout', (req, res) => {
    clearTokenCookie(res);
    res.json({message: 'Logged out successfully'});
});

// Récupère le profil de l'utilisateur courant (utilisé par l'app shell pour conditionnellement afficher la nav admin).
router.get('/me', async (req, res) => {
    try {
        const ctx = await requireUser(req, res);
        if (!ctx) return;
        const { user } = ctx;
        // Heartbeat pour la vue live admin : rafraîchit lastSeenAt.
        if (!user.isAdmin) {
            recordPresenceEvent(user.username, { type: 'heartbeat' });
        }
        res.send({
            username: user.username,
            isAdmin: !!user.isAdmin,
            lastCompletedLevel: user.lastCompletedLevel || 0
        });
    } catch (error) {
        console.log("[ERROR] /user/me " + error);
        res.status(500).send({ error: 'Error retrieving profile' });
    }
});

// Get user progress
router.get('/progress', async (req, res) => {
    try {
        const ctx = await requireUser(req, res);
        if (!ctx) return;
        res.send({ progress: ctx.user.lastCompletedLevel });
    } catch (error) {
        console.log("[ERROR] /user/progress " + error);
        res.status(500).send({ error: 'Error retrieving progress' });
    }
});

router.delete('/delete', async(req, res) => {
    try
    {
        const ctx = await requireAdmin(req, res);
        if (!ctx) return;
        const user = ctx.user;
        const body = req.body || {};
        const username = normalizeUsername(body.username);
        if (!isValidUsername(username)) return res.status(400).send({ error: 'Invalid username' });
        if(user.username != username)
        {
            var deletedUserData = await redisClient.get('user:' + username);
            if (!deletedUserData) {
                return res.status(404).send({ error: 'User ' + username + ' does not exist !' });
            }
            deletedUserData = JSON.parse(deletedUserData);
            if(!deletedUserData.isAdmin)
            {
                // Nettoyage complet de toutes les clés Redis liées à cet utilisateur.
                // Inclut : compte, solutions, historique, feedbacks IA, signaux comportementaux,
                // badges, XP. Si on rate des clés, un compte recréé avec le même username
                // hériterait silencieusement des données de l'ancien.
                const u = escapeKeyPattern(username);
                const patterns = [
                    'user:' + username,
                    'usersolution:' + u + ':*',
                    'solutionhistory:' + u + ':*',
                    'feedback:status:' + u + ':*',
                    'feedback:result:' + u + ':*',
                    'signals:' + u + ':*',
                    'badge:' + u + ':*',
                    'xp:' + u + ':*',
                    'efe:last_color:' + u + ':*'
                ];
                let totalDeleted = 0;
                for (const pattern of patterns) {
                    if (pattern.includes('*')) {
                        const keys = await redisClient.keys(pattern);
                        for (const key of keys) {
                            await redisClient.del(key);
                            totalDeleted++;
                        }
                    } else {
                        const existed = await redisClient.del(pattern);
                        totalDeleted += existed;
                    }
                }
                console.log('[user/delete] ' + username + ' purged : ' + totalDeleted + ' clé(s) Redis supprimée(s)');

                res.send({ user: username, status: 'User deleted successfully', keysRemoved: totalDeleted });
            }
            else
            {
                res.status(403).send({ error: 'You cannot delete an admin !'});
            }
        }
        else
        {
            res.status(403).send({ error: 'You cannot delete yourself !'});
        }
    } catch (error) {
        console.log("[ERROR] /user/delete " + error);
        res.status(500).send({ error: 'Failed to delete user' });
    }
});

export default router;
