import { createClient } from 'redis';

const client = createClient({
    //url: 'redis://default:rootme@192.168.65.207:6379'
    url: 'redis://default:rootme@192.168.1.49:6379'
});

client.on('error', (err) => {
    console.error('Redis connection error:', err);
});

await client.connect();
console.log("Redis - connecté");

export default client;