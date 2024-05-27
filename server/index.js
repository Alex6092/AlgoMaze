import { createClient } from 'redis';
import vm from 'node:vm';
import express from 'express';
import cors from 'cors';
import { Direction, SwitchState } from '../shared.js';
const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;



// Redis :
const client = createClient({
    url: 'redis://default:rootme@192.168.1.49:6379'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
console.log("Redis - connecté");

// API :
app.get('/levels', async (req, res) => {
    // Request levels list from redis :
    var result = await client.keys("level:*");

    var sentence = [];
    for(var level of result)
    {   
        sentence.push(level.substring(6));
    }

    res.send(JSON.stringify(sentence));
});

app.get('/level/:uid', async (req, res) => {
    var levelId = req.params.uid;
    var result = await loadLevel(levelId);
    res.send(result);
});

app.post('/checkanswer', async (req, res) => {
    const { levelId, code } = req.body;

    try
    {
        const result = await checkAnswer("1", code);
        res.send(result);
    }
    catch(error)
    {
        res.status(500).send({ error: error.message });
    }
});

app.post('/savelevel/:uid', async (req, res) => {
    console.log("/savelevel/:uid");
    const levelData = req.body;
    var levelId = req.params.uid;
    try
    {
        levelId = await saveLevel(levelData, levelId);
        res.send({ levelId: levelId, status: 'Level saved successfully' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to save level' });
    }
});

app.post('/savelevel', async (req, res) => {
    console.log("/savelevel");
    const levelData = req.body;
    console.log(levelData);
    try
    {
        let levelId = await saveLevel(levelData, -1);
        res.send({ levelId: levelId, status: 'Level saved successfully' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to save level' });
    }
});

app.listen(port, () => {
    console.log("AlgoMaze API running on port " + port);
});

// Utils functions :
async function loadLevel(levelId)
{
    return await client.get("level:" + levelId);
}

async function saveLevel(data, lvlId)
{
    var levelId = lvlId;
    /*
    var data =  {
        cols: 12,
        rows: 12,
        tsize: 64,
        layers: [[
            3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
            3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 3,
            3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
            3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
            3, 3, 3, 1, 1, 2, 3, 3, 3, 3, 3, 3
        ], [
            4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
            4, 4, 4, 0, 5, 4, 4, 4, 4, 4, 4, 4,
            4, 4, 4, 0, 0, 3, 3, 3, 3, 3, 3, 3
        ]],
    
        switches: [ { x: 128, y: 192, state: false }, { x: 256, y: 192, state: true} ],
        gems: [ { x: 128, y: 64 }],
        startPosition: { x: 128, y: 128 },
        startDirection: Direction.Down,
        instructions: "Votre robot doit allumer tous les interrupteurs et collecter l'ensemble des gemmes pour réussir ce niveau.<br/>Pour contrôler le robot, vous disposez des instructions suivantes :<br/>- moveForward() : Permet de faire avancer le robot dans la direction dans laquelle il regarde.<br/>- turnLeft() : Permet de faire tourner le robot d'un quart de tour sur lui même dans le sens inverse des aiguilles d'une montre.<br/>- toggleSwitch() : Permet d'inverser l'état d'un interrupteur. <br/>- collectGem() : Permet de récupérer une gemme.<br/><br/>Pour intéragir avec un interrupteur ou une gemme, le robot doit se trouver sur la case de l'élément interactif."
    };

    await client.set("level:1", JSON.stringify(data));
    */

    var updateLvlId = false;
    if(levelId == -1)
    {
        levelId = await client.get('levelid'); // Générer un ID unique pour le niveau
        levelId++;
        updateLvlId = true;
    }
 
    console.log(data);
    console.log(levelId);
    await client.set(`level:${levelId}`, JSON.stringify(data));
    if(updateLvlId)
        await client.set('levelid', levelId);

    return levelId;
}

// Maze logic :
async function checkAnswer(levelId, code)
{
    var context = {
        data: JSON.parse(await loadLevel(levelId)),
        character: {},
        characterDirection: "",
        gems: [],
        switches: [],
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
                var isSolid = tile === 3 || tile === 5;
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
            //console.log("New character X = " + context.character.x);
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
        }
    };

    context.character.x = context.data.startPosition.x / context.data.tsize;
    context.character.y = context.data.startPosition.y / context.data.tsize;
    context.characterDirection = context.data.startDirection;

    // Initialize level gem :
    for(var gem of context.data.gems)
    {
        context.gems.push({
            x: gem.x / context.data.tsize,
            y: gem.y / context.data.tsize,
            collected: false
        });
    }

    // Initialize level switches :
    for(var _switch of context.data.switches)
    {
        context.switches.push({
            x: _switch.x / context.data.tsize,
            y: _switch.y / context.data.tsize,
            state: _switch.state
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