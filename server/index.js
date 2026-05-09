import 'dotenv/config';
import { createClient } from 'redis';
import vm from 'node:vm';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { Direction, SwitchState } from './shared.js';
import userRouter from './routes/user.js';
import redisClient from './redisClient.js';
import { __dirname } from './utils.js';
import { generateToken, verifyToken, userFromToken, slidingRefresh } from './jwtConfig.js';
import config from './config.json' assert { type: 'json' };
import { enqueueFeedbackJob, getFeedbackStatus, getFeedbackResult, startFeedbackWorker } from './feedbackWorker.js';
import { computeUserRank, getUserBadges } from './badges.js';
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', // Remplacez par votre domaine
    credentials: true,
    exposedHeaders: ['X-Refreshed-Token']
}));
app.use(cookieParser());
app.use(express.static('public'))

// Sliding refresh pour les requêtes API authentifiées via Bearer token.
// Si plus de la moitié du TTL est écoulée, on régénère le token et on l'expose
// au client via le header X-Refreshed-Token (le client met à jour son storage).
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const result = slidingRefresh(token);
        if (result.refreshed) {
            res.setHeader('X-Refreshed-Token', result.token);
        }
    }
    next();
});

app.use('/user', userRouter);

// Middleware pour vérifier l'authentification (cookie pour les pages HTML)
app.use((req, res, next) => {
    const token = req.cookies.token;
    const publicPaths = ['/login', '/register', '/user/login', '/', '/user/register', '/check_completion']; // Ajoutez ici les routes publiques

    if (publicPaths.includes(req.path)) {
        return next();
    }

    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;


            // Sliding refresh sur le cookie : on renouvelle si plus de la moitié du TTL est écoulée.
            const refreshResult = slidingRefresh(token);
            if (refreshResult.refreshed) {
                res.cookie('token', refreshResult.token, { httpOnly: false, secure: false });
                res.setHeader('X-Refreshed-Token', refreshResult.token);
            }

            // Disable result caching:
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store'); // pour certains CDN
            //console.log('Token valid, user authenticated');

            return next();
        } catch (err) {
            res.clearCookie('token');
            return res.redirect('/login');
        }
    } else {
        return res.redirect('/login');
    }
});

const port = 3000;

// Routes publiques
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});

// Routes protégées :

app.get('/maze', (req, res) => {
    res.sendFile(__dirname + '/algomaze.html');
});

app.get('/editor', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;

            var user = JSON.parse(await redisClient.get('user:' + decoded.userId));
            if(user.isAdmin)
                res.sendFile(__dirname + '/level-editor.html');
            else
                res.redirect('/maze');
        }
        catch(error)
        {
            res.status(500).send({error: "Unexpected error"});
        }
    }
    else
        res.status(403).send({error: "Not authenticated"});
});

app.get('/progress', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;

            var user = JSON.parse(await redisClient.get('user:' + decoded.userId));
            if(user.isAdmin)
                res.sendFile(__dirname + '/progress.html');
            else
                res.redirect('/maze');
        }
        catch(error)
        {
            res.status(500).send({error: "Unexpected error"});
        }
    }
    else
        res.status(403).send({error: "Not authenticated"});
});

app.get('/solutions', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = verifyToken(token);
            const user = JSON.parse(await redisClient.get('user:' + decoded.userId));
            if (user.isAdmin)
                res.sendFile(__dirname + '/solutions.html');
            else
                res.redirect('/maze');
        }
        catch(error) {
            res.status(500).send({ error: "Unexpected error" });
        }
    }
    else
        res.status(403).send({ error: "Not authenticated" });
});

// API :
app.get('/levels', async (req, res) => {
    try
    {
        const token = req.headers.authorization.split(" ")[1];
        var user = await userFromToken(token);

        // Request levels list from redis :
        var result = await redisClient.keys("level:*");

        var sentence = [];
        for(var level of result)
        {   
            var levelAsInt = parseInt(level.substring(6));
            if(user.lastCompletedLevel >= levelAsInt - 1 || user.isAdmin)
            {    
                sentence.push(levelAsInt);
            }
        }

        sentence.sort(function(a, b){return a-b});

        res.send(JSON.stringify(sentence));
    }
    catch(error)
    {
        console.log("[ERROR] /levels/ " + error);
        res.status(500).send({ error : error});
    }
});

app.get('/level/:uid', async (req, res) => {
    try
    {
        var levelId = req.params.uid;
        const token = req.headers.authorization.split(" ")[1];
        var user = await userFromToken(token);
        if(user.lastCompletedLevel >= levelId - 1 || user.isAdmin)
        {   
            var result = await loadLevel(levelId);
            res.send(result);
        }
        else
        {
            res.status(403).send({ error: 'You have not reached this level'});
        }
    }
    catch(error)
    {
        console.log("[ERROR] /level/:uid " + error);
        res.send({error: error});
    }
});

app.get('/level/:uid/usersolution', async (req, res) => {
    try {
        var levelId = req.params.uid;
        const token = req.headers.authorization.split(" ")[1];
        var user = await userFromToken(token);

        if(user.lastCompletedLevel >= levelId - 1 || user.isAdmin)
        {
            var solution = "// Votre solution ici ...";
            var stored = await redisClient.get('usersolution:'+ user.username + ':level:' + levelId);
            if(stored != null && stored.length > 0)
                solution = stored;

            res.send(solution);
        }
        else
        {
            res.status(403).send({ error: 'You have not reached this level'});
        }
    }
    catch(error)
    {
        console.log("[ERROR] /level/:uid/usersolution " + error);
        res.status(500).send({error: error});
    }
});

app.post('/checkanswer', async (req, res) => {

    try {
        const { levelId, code } = req.body;
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.lastCompletedLevel >= levelId - 1 || user.isAdmin)
        {
            var levelData = JSON.parse(await loadLevel(levelId));
            var hasRandomTiles = levelData.randomTile != null && levelData.randomTile.length > 0;

            var runOutcome = { ok: false, timeout: false, error: null };
            var nbVerify = 0;
            // Si il y a des tuiles aléatoires, on réalise plusieurs tests du code :
            do
            {
                runOutcome = tryRunUserCode(levelData, code);
                nbVerify++;
            } while(hasRandomTiles && nbVerify < 10 && runOutcome.ok);

            var result = runOutcome.ok;

            // Sauvegarde systématique de la dernière tentative (valide ou non) et de l'historique.
            await redisClient.set('usersolution:'+ user.username + ':level:' + levelId, code);
            await saveSolutionToHistory(user.username, levelId, code, result, 'check');

            if(result && levelId > user.lastCompletedLevel)
            {
                user.lastCompletedLevel = levelId;
                await redisClient.set('user:' + user.username, JSON.stringify(user));
            }

            // Si la solution est valide, enfile une évaluation IA en arrière-plan.
            // Le client sera notifié via WebSocket quand le feedback est prêt.
            if (result) {
                try {
                    await enqueueFeedbackJob({
                        username: user.username,
                        levelId,
                        code,
                        instructions: levelData.instructions || '',
                        constraints: levelData.constraints || ''
                    });
                } catch (e) {
                    console.error('[checkanswer] enqueue feedback failed:', e.message);
                }
            }

            res.send(result);
        }
        else
        {
            res.status(403).send({ error: 'You have not reached this level'});
        }
    } catch (error) {
        console.log("[ERROR] /checkanswer " + error);
        res.status(500).send({ error: 'Error checking answer ...' });
    }
});

// Pré-check serveur avant exécution locale dans le navigateur.
// Sert à détecter les boucles infinies (timeout) et à sauvegarder le code de l'étudiant
// avant qu'il ne lance l'exécution dans son navigateur (qui pourrait freezer).
// Retourne { ok, timeout, error }.
app.post('/precheck', async (req, res) => {
    try {
        const { levelId, code } = req.body;
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.lastCompletedLevel >= levelId - 1 || user.isAdmin)
        {
            const levelData = JSON.parse(await loadLevel(levelId));
            const outcome = tryRunUserCode(levelData, code);

            // Sauvegarde la dernière version du code + entrée dans l'historique.
            await redisClient.set('usersolution:'+ user.username + ':level:' + levelId, code);
            await saveSolutionToHistory(user.username, levelId, code, outcome.ok, 'run');

            res.send(outcome);
        }
        else
        {
            res.status(403).send({ error: 'You have not reached this level'});
        }
    } catch (error) {
        console.log("[ERROR] /precheck " + error);
        res.status(500).send({ error: 'Erreur serveur lors du pré-check' });
    }
});

app.post('/savelevel/:uid', async (req, res) => {
    try
    {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.isAdmin)
        {
            const levelData = req.body;
            var levelId = req.params.uid;

            levelId = await saveLevel(levelData, levelId);
            res.send({ levelId: levelId, status: 'Level saved successfully' });
        }
        else
        {
            res.status(403).send({ error: 'You are not an administrator'});
        }
    } catch (error) {
        console.log("[ERROR] /savelevel/:uid " + error);
        res.status(500).send({ error: 'Failed to save level' });
    }
});

app.post('/savelevel', async (req, res) => {
    
    try
    {
        const levelData = req.body;
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.isAdmin)
        {
            let levelId = await saveLevel(levelData, -1);
            res.send({ levelId: levelId, status: 'Level saved successfully' });
        }
        else
        {
            res.status(403).send({ error: 'You are not an administrator'});
        }
    } catch (error) {
        console.log("[ERROR] /savelevel " + error);
        res.status(500).send({ error: 'Failed to save level' });
    }
});

// Progression des utilisateurs :
app.get('/userprogressreport', async (req, res) => {
    try
    {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);

        if(user.isAdmin)
        {
            var userKeys = await redisClient.keys("user:*");

            var result = [];
            for(var userKey of userKeys)
            {
                var userData = await redisClient.get(userKey);
                userData = JSON.parse(userData);
                result.push({
                    username: userData.username,
                    lastCompletedLevel: userData.lastCompletedLevel
                });
            }

            result.sort(function(a, b) { return a.username.localeCompare(b.username) });

            res.status(200).send(result);
        }
        else
        {
            res.status(403).send({ error: 'You are not an administrator'});
        }
    } catch (error) {
        console.log("[ERROR] /userprogressreport " + error);
        res.status(500).send({ error: 'Failed to get user progress data' });
    }
});

// Vue admin : toutes les solutions d'un utilisateur (par niveau), avec feedback IA si disponible.
app.get('/admin/solutions/user/:username', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const adminUser = await userFromToken(token);
        if (!adminUser.isAdmin) {
            return res.status(403).send({ error: 'You are not an administrator' });
        }

        const username = req.params.username.toLowerCase();
        const solutionKeys = await redisClient.keys('usersolution:' + username + ':level:*');
        const result = [];
        for (const key of solutionKeys) {
            const levelId = parseInt(key.substring(('usersolution:' + username + ':level:').length));
            const code = await redisClient.get(key);
            const historyRaw = await redisClient.lRange('solutionhistory:' + username + ':level:' + levelId, 0, -1);
            const history = historyRaw.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(x => x);
            const feedbackStatus = await getFeedbackStatus(username, levelId);
            const feedbackResult = await getFeedbackResult(username, levelId);
            result.push({ levelId, code, history, feedbackStatus, feedbackResult });
        }
        result.sort((a, b) => a.levelId - b.levelId);
        res.send(result);
    } catch (error) {
        console.log("[ERROR] /admin/solutions/user/:username " + error);
        res.status(500).send({ error: 'Failed to fetch solutions' });
    }
});

// Vue admin : toutes les solutions soumises pour un niveau donné (par utilisateur), avec feedback IA si disponible.
app.get('/admin/solutions/level/:levelId', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const adminUser = await userFromToken(token);
        if (!adminUser.isAdmin) {
            return res.status(403).send({ error: 'You are not an administrator' });
        }

        const levelId = parseInt(req.params.levelId);
        const solutionKeys = await redisClient.keys('usersolution:*:level:' + levelId);
        const result = [];
        for (const key of solutionKeys) {
            // Format de clé : usersolution:<username>:level:<id>
            const parts = key.split(':');
            const username = parts[1];
            const code = await redisClient.get(key);
            const historyRaw = await redisClient.lRange('solutionhistory:' + username + ':level:' + levelId, 0, -1);
            const history = historyRaw.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(x => x);
            const feedbackStatus = await getFeedbackStatus(username, levelId);
            const feedbackResult = await getFeedbackResult(username, levelId);
            result.push({ username, code, history, feedbackStatus, feedbackResult });
        }
        result.sort((a, b) => a.username.localeCompare(b.username));
        res.send(result);
    } catch (error) {
        console.log("[ERROR] /admin/solutions/level/:levelId " + error);
        res.status(500).send({ error: 'Failed to fetch solutions' });
    }
});

app.post('/check_completion', async (req, res) => {
    try
    {
        const checkData = req.body;
        var user = checkData.username.toLowerCase();
        var level = checkData.levelnumber;

        if(await redisClient.exists('user:' + user))
        {
            var storedUser = await redisClient.get('user:' + user);
            storedUser = JSON.parse(storedUser);
            var result = storedUser.lastCompletedLevel >= level;
            res.status(200).send({ completed: result });
        }
        else
        {
            res.status(200).send({ completed: false });
        }
    } catch (error) {
        console.log("[ERROR] /check_completion " + error);
        res.status(500).send({ error: 'Failed to get user progress check' });
    }
});

// Rang global de l'utilisateur courant : médiane glissante des XP des derniers niveaux.
app.get('/user/rank', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);
        const windowSize = (config && config.slidingMedianWindow) || 10;
        const rank = await computeUserRank(user.username, windowSize);
        res.send(rank);
    } catch (error) {
        console.log("[ERROR] /user/rank " + error);
        res.status(500).send({ error: 'Failed to compute rank' });
    }
});

// Tous les badges de l'utilisateur courant, par niveau.
app.get('/user/badges', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);
        const badges = await getUserBadges(user.username);
        res.send(badges);
    } catch (error) {
        console.log("[ERROR] /user/badges " + error);
        res.status(500).send({ error: 'Failed to fetch badges' });
    }
});

// Récupère le feedback IA stocké pour (utilisateur courant, niveau).
// Utilisé au chargement d'un niveau pour afficher un éventuel feedback existant.
app.get('/feedback/:levelId', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const user = await userFromToken(token);
        const levelId = parseInt(req.params.levelId);
        const status = await getFeedbackStatus(user.username, levelId);
        const result = await getFeedbackResult(user.username, levelId);
        res.send({ status, result });
    } catch (error) {
        console.log("[ERROR] /feedback/:levelId " + error);
        res.status(500).send({ error: 'Failed to fetch feedback' });
    }
});

// Vue admin : feedback IA stocké pour un (user, level).
app.get('/admin/feedback/:username/:levelId', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const adminUser = await userFromToken(token);
        if (!adminUser.isAdmin) {
            return res.status(403).send({ error: 'You are not an administrator' });
        }
        const username = req.params.username.toLowerCase();
        const levelId = parseInt(req.params.levelId);
        const status = await getFeedbackStatus(username, levelId);
        const result = await getFeedbackResult(username, levelId);
        res.send({ status, result });
    } catch (error) {
        console.log("[ERROR] /admin/feedback/:username/:levelId " + error);
        res.status(500).send({ error: 'Failed to fetch feedback' });
    }
});

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: { origin: 'http://localhost:3000', credentials: true }
});

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token) return next(new Error('No token'));
        const user = await userFromToken(token);
        socket.data.username = user.username;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    // Chaque utilisateur a sa propre room — on émet vers user:<username>.
    socket.join('user:' + socket.data.username);
});

httpServer.listen(port, () => {
    console.log("AlgoMaze API running on port " + port);
});

await startFeedbackWorker(io);

// Utils functions :
async function loadLevel(levelId)
{
    return await redisClient.get("level:" + levelId);
}

// Exécute checkAnswer en isolant les erreurs : distingue un timeout (boucle infinie probable)
// d'une autre erreur d'exécution.
function tryRunUserCode(levelData, code)
{
    try {
        const ok = checkAnswer(levelData, code);
        return { ok, timeout: false, error: null };
    } catch (err) {
        const isTimeout = err && (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || /timed out/i.test(err.message || ''));
        return {
            ok: false,
            timeout: isTimeout,
            error: isTimeout ? 'Le code a dépassé le temps maximal d\'exécution (boucle infinie probable).' : (err.message || String(err))
        };
    }
}

// Pousse une entrée dans l'historique horodaté du code de l'utilisateur pour un niveau donné.
// On garde au plus config.maxSolutionHistory entrées (les plus récentes en tête de liste).
async function saveSolutionToHistory(username, levelId, code, valid, runType)
{
    const key = `solutionhistory:${username}:level:${levelId}`;
    const entry = JSON.stringify({
        code,
        timestamp: Date.now(),
        valid: !!valid,
        runType // 'run' (précheck) ou 'check' (validation)
    });
    await redisClient.lPush(key, entry);
    const maxHistory = (config && config.maxSolutionHistory) || 10;
    await redisClient.lTrim(key, 0, maxHistory - 1);
}

async function saveLevel(data, lvlId)
{
    var levelId = lvlId;
    var updateLvlId = false;
    if(levelId == -1)
    {
        levelId = await redisClient.get('levelid'); // Générer un ID unique pour le niveau
        levelId++;
        updateLvlId = true;
    }

    await redisClient.set(`level:${levelId}`, JSON.stringify(data));
    if(updateLvlId)
        await redisClient.set('levelid', levelId);

    return levelId;
}

function getRandomBinary() {
    return Math.round(Math.random());
}

function initializeGemsAndSwitches(context) {
    // Initialize level gem :
    context.gems = [];
    for(var gem of context.data.gems)
    {
        context.gems.push({
            x: gem.x / context.data.tsize,
            y: gem.y / context.data.tsize,
            collected: false
        });
    }

    context.switches = [];
    // Initialize level switches :
    for(var _switch of context.data.switches)
    {
        context.switches.push({
            x: _switch.x / context.data.tsize,
            y: _switch.y / context.data.tsize,
            state: _switch.state
        });
    }

    for(var i = 0; i < context.data.randomTile.length; i++)
    {
        var tile = context.data.randomTile[i];
        var spawn = getRandomBinary() || getRandomBinary();
        if(spawn)
        {
            var type = getRandomBinary();
            if(type)
            {
                // Spawn gemme
                context.gems.push({
                    x: tile.x / context.data.tsize,
                    y: tile.y / context.data.tsize,
                    collected: false
                });
            }
            else
            {
                // Spawn interrupteur
                var open = getRandomBinary();
                context.switches.push({
                    x: tile.x / context.data.tsize,
                    y: tile.y / context.data.tsize,
                    state: open
                });
            }
        }
    }
}

// Maze logic :
function checkAnswer(levelData, code)
{
    var context = {
        data: levelData,
        character: {},
        characterDirection: "",
        gems: [],
        switches: [],
        teleport1: [],
        teleport2: [],
        teleport3: [],
        teleport4: [],
        randomTile: [],
        success: true,
        getTile: (layer, col, row) => {
            return context.data.layers[layer][row * context.data.cols + col];
        },
        isSolidTileAtXY: (x, y) => {
            var col = x;
            var row = y;

            if(col < 0 || col >= context.data.cols || row < 0 || row >= context.data.rows)
                return true;
    
            // tiles 3 and 5 are solid -- the rest are walkable
            // loop through all layers and return TRUE if any tile is solid
            return context.data.layers.reduce(function (res, layer, index) {
                var tile = context.getTile(index, col, row);
                var isSolid = tile === 3 || tile === 5 || (tile === 0 && layer == 0);
                return res || isSolid;
            }.bind(this), false);
        },
        moveForward: () => {
            var direction = context.characterDirection;
            if(direction == Direction.Down)
            {
                context.character.y += 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    context.character.y -= 1;
                    context.success = false;
                }
            }
            else if(direction == Direction.Up)
            {
                context.character.y -= 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    context.character.y += 1;
                    context.success = false;
                }
            }
            else if(direction == Direction.Left)
            {
                context.character.x -= 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    context.character.x += 1;
                    context.success = false;
                }
            }
            else if(direction == Direction.Right)
            {
                context.character.x += 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    context.character.x -= 1;
                    context.success = false;
                }
            }

            if(context.character.x >= context.data.cols)
            {
                context.character.x = context.data.cols - 1;
                context.success = false;
            }
            else if(context.character.x < 0)
            {
                context.character.x = 0;
                context.success = false;
            }

            if(context.character.y >= context.data.rows)
            {
                context.character.y = context.data.rows - 1;
                context.success = false;
            }
            else if(context.character.y < 0)
            {
                context.character.y = 0;
                context.success = false;
            }

            context.checkTeleporter();
        },
        turnLeft: () => {
            var direction = context.characterDirection;
            if(direction == Direction.Down)
            {
                direction = Direction.Right;
            }
            else if(direction == Direction.Right)
            {
                direction = Direction.Up;
            }
            else if(direction == Direction.Up)
            {
                direction = Direction.Left;
            }
            else if(direction == Direction.Left)
            {
                direction = Direction.Down;
            }
            context.characterDirection = direction;
        },
        collectGem: () => {
            var position = context.character;

            for(var gem of context.gems)
            {
                if(position.x == gem.x && position.y == gem.y && !gem.collected)
                    gem.collected = true;
            }
        },
        toggleSwitch: () => {
            var position = context.character;

            for(var _switch of context.switches)
            {
                if(position.x == _switch.x && position.y == _switch.y)
                {
                    _switch.state = !_switch.state;
                }
            }
        },
        canCollectGem: () => {
            var position = context.character;
            var result = false;
            for(var gem of context.gems) {
                if(position.x == gem.x && position.y == gem.y && !gem.collected)
                {
                    result = true;
                    break;
                }
            }
            return result;
        },
        isOnSwitch: () => {
            var position = context.character;
            var result = false;
            for(var _switch of context.switches) {
                if(_switch.x == position.x && _switch.y == position.y)
                {
                    result = true;
                    break;
                }
            }
            return result;
        },
        canActivateSwitch: () => {
            var position = context.character;
            var result = false;
            for(var _switch of context.switches) {
                if(_switch.x == position.x && _switch.y == position.y)
                {
                    result = !_switch.state;
                    break;
                }
            }
            return result;
        },
        canDeactivateSwitch: () => {
            var position = context.character;
            var result = false;
            for(var _switch of context.switches) {
                if(_switch.x == position.x && _switch.y == position.y)
                {
                    result = _switch.state;
                    break;
                }
            }
            return result;
        },
        isOnCellIn: (x, y, cells) => {
            var result = false;
            for(var cell of cells)
            {
                if(cell.x == x && cell.y == y)
                {
                    result = true;
                    break;
                }
            }

            return result;
        },
        getTeleportedToCell: (xSrc, ySrc, cells) => {
            if(cells[0].x == xSrc && cells[0].y == ySrc)
                {
                    return cells[1];
                }
            
                return cells[0];
        },
        checkTeleporter: () => {
            var x = context.character.x;
            var y = context.character.y;

            var targetCell = null;
            if(context.isOnCellIn(x, y, context.teleport1))
            {
                targetCell = context.getTeleportedToCell(x, y, context.teleport1);
            }
            if(context.isOnCellIn(x, y, context.teleport2))
            {
                targetCell = context.getTeleportedToCell(x, y, context.teleport2);
            }
            if(context.isOnCellIn(x, y, context.teleport3))
            {
                targetCell = context.getTeleportedToCell(x, y, context.teleport3);
            }
            if(context.isOnCellIn(x, y, context.teleport4))
            {
                targetCell = context.getTeleportedToCell(x, y, context.teleport4);
            }


            if(targetCell != null)
            {
                context.character.x = targetCell.x;
                context.character.y = targetCell.y;
            }
        },
        isBlocked: () => {
            var direction = context.characterDirection;
            var result = false;
            if(direction == Direction.Down)
            {
                context.character.y += 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    result = true;
                }

                context.character.y -= 1;
            }
            else if(direction == Direction.Up)
            {
                context.character.y -= 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    result = true;
                }

                context.character.y += 1;
            }
            else if(direction == Direction.Left)
            {
                context.character.x -= 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    result = true;
                }

                context.character.x += 1;
            }
            else if(direction == Direction.Right)
            {
                context.character.x += 1;

                if(context.isSolidTileAtXY(context.character.x, context.character.y))
                {
                    result = true;
                }

                context.character.x -= 1;
            }

            return result;
        },
        isBlockedLeft: () => {
            var result = false;
            context.turnLeft();
            result = context.isBlocked();
            context.turnLeft();
            context.turnLeft();
            context.turnLeft();
            return result;
        },
        isBlockedRight: () => {
            var result = false;
            context.turnLeft();
            context.turnLeft();
            context.turnLeft();
            result = context.isBlocked();
            context.turnLeft();
            return result;
        }
    };

    context.character.x = context.data.startPosition.x / context.data.tsize;
    context.character.y = context.data.startPosition.y / context.data.tsize;
    context.characterDirection = context.data.startDirection;

    // Manage random tiles :
    context.data.randomTile = context.data.randomTile == null ? [] : context.data.randomTile;

    initializeGemsAndSwitches(context);

    // Initialize level teleporters :
    context.data.teleport1 = context.data.teleport1 == null ? [] : context.data.teleport1;
    context.data.teleport2 = context.data.teleport2 == null ? [] : context.data.teleport2;
    context.data.teleport3 = context.data.teleport3 == null ? [] : context.data.teleport3;
    context.data.teleport4 = context.data.teleport4 == null ? [] : context.data.teleport4;

    for(var teleport of context.data.teleport1)
    {
        context.teleport1.push({
            x: teleport.x / context.data.tsize,
            y: teleport.y / context.data.tsize
        });
    }
    for(var teleport of context.data.teleport2)
    {
        context.teleport2.push({
            x: teleport.x / context.data.tsize,
            y: teleport.y / context.data.tsize
        });
    }
    for(var teleport of context.data.teleport3)
    {
        context.teleport3.push({
            x: teleport.x / context.data.tsize,
            y: teleport.y / context.data.tsize
        });
    }
    for(var teleport of context.data.teleport4)
    {
        context.teleport4.push({
            x: teleport.x / context.data.tsize,
            y: teleport.y / context.data.tsize
        });
    }
    
    vm.runInNewContext(code, context, { timeout: 500 });

    if(context.success)
    {
        var success = true;

        for(var gem of context.gems)
        {
            if(!gem.collected)
            {
                success = false;
                break;
            }
        }

        if(success)
        {
            for(var _switch of context.switches)
            {
                if(!_switch.state)
                {
                    success = false;
                    break;
                }
            }
        }

        return success;
    }
    
    return false;
}

