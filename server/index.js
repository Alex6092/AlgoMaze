import { createClient } from 'redis';
import express from 'express';
const app = express();
const port = 3000;

const client = createClient({
    url: 'redis://default:rootme@192.168.1.49:6379'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
console.log("Redis - connecté");

//await client.set('level:1', 'testvalue');
//const value = await client.get('testkey');

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
    var result = await client.get("level:" + levelId);
    res.send(result);
});

app.listen(port, () => {
    console.log("AlgoMaze API running on port " + port);
});