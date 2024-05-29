import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import { generateToken, verifyToken, userFromToken } from '../jwtConfig.js';
import redisClient from '../redisClient.js';

// User registration
router.post('/register', async (req, res) => {
    try {
        var { username, password } = req.body;
        var exists = await redisClient.exists('user:' + username);
        if(!exists)
        {
            username = username.toLowerCase();
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
            res.status(500).send({ error: 'Error creating user' });
        }
    } catch (error) {
        console.log("[ERROR] /user/register " + error);
        res.status(500).send({ error: 'Error creating user' });
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        var { username, password } = req.body;
        username = username.toLowerCase();
        var exists = await redisClient.exists('user:' + username);
        if(exists)
        {
            const user = JSON.parse(await redisClient.get('user:' + username));
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).send({ error: 'Invalid credentials' });

            const token = generateToken(username);
            res.cookie('token', token, {
                httpOnly: false,
                secure: false
            });
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
        res.status(500).send({ error: 'Error logging in' + error });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({message: 'Logged out successfully'});
});

// Get user progress
router.get('/progress', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);
        res.send({progress: user.lastCompletedLevel});
    } catch (error) {
        console.log("[ERROR] /user/progress " + error);
        res.status(500).send({ error: 'Error retrieving progress' });
    }
});

export default router;