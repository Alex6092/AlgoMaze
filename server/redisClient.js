import { createClient } from 'redis';

const { REDIS_USER, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT } = process.env;
if (!REDIS_USER || !REDIS_PASSWORD || !REDIS_HOST || !REDIS_PORT) {
    throw new Error('Variables Redis manquantes (REDIS_USER, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT). Vérifiez votre .env.');
}

const client = createClient({
    // Example : url: 'redis://user:password@host:6379'
    url: 'redis://' + REDIS_USER + ':' + REDIS_PASSWORD + '@' + REDIS_HOST + ':' + REDIS_PORT
});

client.on('error', (err) => {
    console.error('Redis connection error:', err);
});

await client.connect();
console.log("Redis - connecté");

export default client;