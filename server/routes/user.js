import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import { generateToken, verifyToken, userFromToken } from '../jwtConfig.js';
import redisClient from '../redisClient.js';
import config from '../config.json' assert { type: 'json' };

// User registration
router.post('/register', async (req, res) => {
    if(config.allowRegistration)
    {
        try {
            var { username, password } = req.body;
            username = username.toLowerCase();
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
                res.status(500).send({ error: 'Error creating user' });
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
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.isAdmin)
        {
            const userData = req.body;
            var userToUpdate = userData;
            var username = userToUpdate.username.toLowerCase();
            var password = userToUpdate.password;
            
            if(await redisClient.exists('user:' + username))
            {
                const hashedPassword = await bcrypt.hash(password, 10);

                var updatedUserData = await redisClient.get('user:' + username);
                updatedUserData = JSON.parse(updatedUserData);
                updatedUserData.password = hashedPassword;
                await redisClient.set('user:' + username, JSON.stringify(updatedUserData)); 
                
                res.send({ user: userToUpdate.username, status: 'User updated successfully' });
            }
            else
            {
                res.status(500).send({ error: 'User ' + username + ' does not exists !'});
            }
        }
        else
        {
            res.status(403).send({ error: 'You are not an administrator'});
        }
    } catch (error) {
        console.log("[ERROR] /user/updatepassword " + error);
        res.status(500).send({ error: 'Failed to update user password' });
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

router.delete('/delete', async(req, res) => {
    try
    {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.isAdmin)
        {
            const userData = req.body;
            var userToDelete = userData;
            var username = userToDelete.username.toLowerCase();
            if(user.username != username)
            {
                var deletedUserData = await redisClient.get('user:' + username);
                deletedUserData = JSON.parse(deletedUserData);
                if(!deletedUserData.isAdmin)
                {
                    await redisClient.del('user:' + username);
                    var toDeleteKeys = await redisClient.keys('usersolution:' + username + ':*');
                    for(var key of toDeleteKeys)
                    {
                        await redisClient.del(key);
                    }

                    res.send({ user: userToDelete.username, status: 'User deleted successfully' });
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
        }
        else
        {
            res.status(403).send({ error: 'You are not an administrator'});
        }
    } catch (error) {
        console.log("[ERROR] /user/delete " + error);
        res.status(500).send({ error: 'Failed to delete user' });
    }
});

export default router;