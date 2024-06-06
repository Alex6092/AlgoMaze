import { createClient } from 'redis';
import vm from 'node:vm';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Direction, SwitchState } from './shared.js';
import userRouter from './routes/user.js';
import redisClient from './redisClient.js';
import { __dirname } from './utils.js';
import { generateToken, verifyToken, userFromToken } from './jwtConfig.js';
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', // Remplacez par votre domaine
    credentials: true
}));
app.use(cookieParser());
app.use(express.static('public'))
app.use('/user', userRouter);

// Middleware pour vérifier l'authentification
app.use((req, res, next) => {
    const token = req.cookies.token;
    const publicPaths = ['/login', '/user/login', '/', '/user/register']; // Ajoutez ici les routes publiques

    //console.log(`Requested path: ${req.path}`); // Log du chemin demandé
    //console.log(`Token: ${token}`); // Log du token

    if (publicPaths.includes(req.path)) {
        return next();
    }

    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;
            //console.log('Token valid, user authenticated');
            return next();
        } catch (err) {
            //console.log('Invalid token');
            res.clearCookie('token');
            return res.redirect('/login');
        }
    } else {
        //console.log('No token provided');
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

        sentence.sort();

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

            var result = false; 
            var nbVerify = 0;
            // Si il y a des tuiles aléatoires, on réalise plusieurs tests du code :
            do
            {
                result = checkAnswer(levelData, code);
                nbVerify++;
            } while(hasRandomTiles && nbVerify < 10 && result);
            

            // L'utilisateur a réussi le niveau :
            // On met à jour son progrès et on enregistre sa réponse.
            if(result)
            {
                if(levelId > user.lastCompletedLevel)
                {
                    user.lastCompletedLevel = levelId;
                    await redisClient.set('user:' + user.username, JSON.stringify(user));
                }
                await redisClient.set('usersolution:'+ user.username + ':level:' + levelId, code);
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

app.listen(port, () => {
    console.log("AlgoMaze API running on port " + port);
});

// Utils functions :
async function loadLevel(levelId)
{
    return await redisClient.get("level:" + levelId);
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
        var spawn = getRandomBinary();
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
                    context.character.y -= 1;
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

