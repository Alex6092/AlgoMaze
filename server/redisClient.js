import { createClient } from 'redis';
import config from './config.json' assert { type: 'json' };

const client = createClient({
    // Example : url: 'redis://default:rootme@192.168.65.207:6379'
    url: 'redis://' + config.redisUser + ':' + config.redisPassword + '@' + config.redisHost + ':' + config.redisPort
});

client.on('error', (err) => {
    console.error('Redis connection error:', err);
});

await client.connect();
console.log("Redis - connecté");

export default client;