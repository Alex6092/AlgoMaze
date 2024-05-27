import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import redisClient from '../redisClient.js';

const SECRET_KEY = "my_secret_key_jwt";

// User registration
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        var exists = await redisClient.exists('user:' + username);
        if(!exists)
        {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = { 
                username: username, 
                password: hashedPassword, 
                lastCompletedLevel: 0
            };
            await redisClient.set('user:' + username, JSON.stringify(newUser));
            res.status(201).send({ message: 'User created successfully' });
        }
        else 
        {
            res.status(500).send({ error: 'Error creating user' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Error creating user' });
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        var exists = await redisClient.exists('user:' + username);
        if(exists)
        {
            const user = JSON.parse(await redisClient.get('user:' + username));
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).send({ error: 'Invalid credentials' });

            const token = jwt.sign({ userId: user.username }, SECRET_KEY, { expiresIn: '1h' });
            res.send({ token });
        }
        else
        {
            return res.status(404).send({ error: 'User not found' });
        }
    } 
    catch (error) 
    {
        res.status(500).send({ error: 'Error logging in' + error });
    }
});

// Get user progress
router.get('/progress', async (req, res) => {
    const token = req.headers.authorization.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        var uid = decoded.userId
        const user = JSON.parse(await redisClient.get('user:' + uid));
        res.send({progress: user.lastCompletedLevel});
    } catch (error) {
        res.status(500).send({ error: 'Error retrieving progress' });
    }
});

export default router;