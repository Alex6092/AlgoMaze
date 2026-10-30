// Évaluations IA via le load balancer : soumission, callback signé, relève de
// secours, réessais et réutilisation des évaluations (anti-relance).
// Le load balancer est simulé par un serveur HTTP local ; Redis par test/fakeRedis.mjs.
//
//   cd server && npm test

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url));

const SECRET = 'callback-secret';
const lb = { posts: [], jobs: new Map(), failPosts: 0 };
const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== 'Bearer lb-key') return send(401, { error: { code: 'invalid_api_key' } });
    if (req.method === 'POST' && req.url === '/v1/jobs') {
        if (lb.failPosts > 0) {
            lb.failPosts--;
            return send(503, { error: { code: 'queue_full', message: 'File pleine' } }, { 'Retry-After': '30' });
        }
        const id = 'lb-' + (lb.posts.length + 1);
        lb.posts.push({ id, body: JSON.parse(raw), headers: req.headers });
        lb.jobs.set(id, { id, status: 'queued' });
        return send(202, { id, status: 'queued' });
    }
    const match = /^\/v1\/jobs\/([^/]+)$/.exec(req.url);
    if (req.method === 'GET' && match) {
        const job = lb.jobs.get(match[1]);
        return job ? send(200, job) : send(404, { error: { code: 'not_found' } });
    }
    send(404, {});
});

const emitted = [];
const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) };

let worker;
let redis;

const completion = (evaluation) => ({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(evaluation) }, finish_reason: 'stop' }]
});
const GOLD = { score: 80, constraintsRespected: true, feedback: 'Bien.', criteria: [] };
const PLATINUM = { score: 98, constraintsRespected: true, feedback: 'Parfait.', criteria: [] };

function signed(event, { secret = SECRET, ts = Math.floor(Date.now() / 1000) } = {}) {
    const body = JSON.stringify(event);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    return {
        body,
        headers: { 'x-event-id': event.id, 'x-callback-timestamp': String(ts), 'x-callback-signature': `sha256=${sig}` }
    };
}

// Fait aboutir le dernier job soumis par un callback signé du load balancer.
async function deliver(lbJob, evaluation, options) {
    const post = lb.posts.find((p) => p.id === lbJob);
    const jobId = new URL(post.body.callbackURL).searchParams.get('job');
    const event = { id: crypto.randomUUID(), type: 'job.succeeded', job_id: lbJob, status: 'succeeded', result: completion(evaluation), error: null };
    const { body, headers } = signed(event, options);
    return worker.handleCallback(jobId, Buffer.from(body), headers);
}

async function submitPending() {
    for (const jobId of await redis.lRange('feedback:queue:pending', 0, -1)) {
        await redis.lRem('feedback:queue:pending', 0, jobId);
        await worker.submitJob(jobId);
    }
}

const level = (n) => 100 + n;
const job = (username, levelId, code, extra = {}) =>
    ({ username, levelId, code, instructions: 'Avance', constraints: 'Utiliser une boucle', ...extra });
const CODE = 'var n = 0;\nwhile (!isBlocked()) { moveForward(); n++; }\nturnLeft();';

describe('évaluations IA via le load balancer', () => {
    before(async () => {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        Object.assign(process.env, {
            REDIS_USER: 'default', REDIS_PASSWORD: 'x', REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379',
            LB_URL: `http://127.0.0.1:${server.address().port}`,
            LB_API_KEY: 'lb-key',
            LB_CALLBACK_SECRET: SECRET,
            LB_CALLBACK_URL: 'https://algomaze.test/lb/callback',
            LB_MODEL: 'test-model'
        });
        worker = await import('../feedbackWorker.js');
        redis = (await import('../redisClient.js')).default;
        worker.setFeedbackIo(io);
    });
    after(() => {
        server.closeAllConnections();
        server.close();
    });

    it('vérifie la signature des callbacks (valide, falsifiée, périmée)', async () => {
        const { verifySignature } = await import('../lbClient.js');
        const { body, headers } = signed({ id: 'e1' });
        const ts = headers['x-callback-timestamp'];
        assert.equal(verifySignature(body, ts, headers['x-callback-signature'], SECRET), true);
        assert.equal(verifySignature(body + ' ', ts, headers['x-callback-signature'], SECRET), false);
        assert.equal(verifySignature(body, ts, headers['x-callback-signature'], 'autre'), false);
        assert.equal(verifySignature(body, ts, headers['x-callback-signature'], SECRET, (Number(ts) + 301) * 1000), false);
    });

    it('extrait l’évaluation, y compris après un bloc <think>', async () => {
        const { parseEvaluation } = await import('../lbClient.js');
        const content = '<think>réflexion</think>\n' + JSON.stringify(GOLD);
        assert.deepEqual(parseEvaluation({ choices: [{ message: { content } }] }), GOLD);
        assert.throws(() => parseEvaluation({ choices: [{ message: { content: 'pas de JSON' } }] }));
    });

    it('soumet un job asynchrone puis applique le résultat du callback une seule fois', async () => {
        assert.equal(await worker.enqueueFeedbackJob(job('alice', level(1), CODE)), true);
        assert.equal(await worker.getFeedbackStatus('alice', level(1)), 'pending');
        await submitPending();
        const post = lb.posts.at(-1);
        assert.equal(post.headers['x-end-user-id'], 'algomaze-alice');
        assert.match(post.headers['idempotency-key'], /^algomaze-.+-0$/);
        assert.equal(post.body.temperature, 0);
        assert.equal(post.body.model, 'test-model');
        assert.match(post.body.callbackURL, /^https:\/\/algomaze\.test\/lb\/callback\?job=/);

        assert.equal(await deliver(post.id, GOLD), 200);
        assert.equal(await worker.getFeedbackStatus('alice', level(1)), 'done');
        const result = await worker.getFeedbackResult('alice', level(1));
        assert.equal(result.score, 80);
        assert.equal(result.reused, undefined);
        assert.equal(await redis.get(`xp:alice:${level(1)}`) !== null, true);
        const ready = emitted.filter((e) => e.event === 'feedback:ready' && e.data.levelId === level(1));
        assert.equal(ready.length, 1);

        // Réessai du load balancer : accusé 2xx, aucun nouveau traitement.
        assert.equal(await deliver(post.id, PLATINUM), 200);
        assert.equal((await worker.getFeedbackResult('alice', level(1))).score, 80);
        assert.equal(emitted.filter((e) => e.event === 'feedback:ready' && e.data.levelId === level(1)).length, 1);
    });

    it('refuse un callback mal signé', async () => {
        await worker.enqueueFeedbackJob(job('bob', level(2), CODE));
        await submitPending();
        assert.equal(await deliver(lb.posts.at(-1).id, GOLD, { secret: 'mauvais' }), 401);
        assert.equal(await worker.getFeedbackStatus('bob', level(2)), 'pending');
    });

    it('réutilise l’évaluation d’une solution identique ou très proche sans rappeler l’IA', async () => {
        const posts = lb.posts.length;
        // Même élève, même solution réécrite : pas de nouvelle chance d'obtenir Platine.
        const renamed = 'let pas = 0\nwhile(!isBlocked()){ moveForward(); pas++ }\nturnLeft()';
        assert.equal(await worker.enqueueFeedbackJob(job('alice', level(1), renamed)), true);
        let result = await worker.getFeedbackResult('alice', level(1));
        assert.equal(result.reused.match, 'identical');
        assert.equal(result.score, 80);
        // Autre élève, solution identique après normalisation : même évaluation.
        await worker.enqueueFeedbackJob(job('carol', level(1), CODE));
        result = await worker.getFeedbackResult('carol', level(1));
        assert.equal(result.reused.match, 'identical');
        assert.equal(await worker.getFeedbackStatus('carol', level(1)), 'done');
        assert.equal(lb.posts.length, posts);
    });

    it('réutilise l’évaluation d’une retouche mineure du même élève, pas celle d’un autre', async () => {
        const base = `function avancer() {
    while (!isBlocked()) {
        if (canCollectGem()) { collectGem(); }
        moveForward();
    }
}
avancer();
turnLeft();
avancer();
turnLeft();
avancer();`;
        await worker.enqueueFeedbackJob(job('dave', level(3), base));
        await submitPending();
        await deliver(lb.posts.at(-1).id, GOLD);
        const posts = lb.posts.length;
        await worker.enqueueFeedbackJob(job('dave', level(3), base + '\nturnLeft();'));
        const result = await worker.getFeedbackResult('dave', level(3));
        assert.equal(result.reused.match, 'similar');
        assert.ok(result.reused.similarity >= 0.9);
        assert.equal(lb.posts.length, posts);
        // La proximité ne vaut que pour le même élève.
        await worker.enqueueFeedbackJob(job('erin', level(3), base + '\nturnLeft();'));
        assert.equal(await worker.getFeedbackStatus('erin', level(3)), 'pending');
        await submitPending();
        assert.equal(lb.posts.length, posts + 1);
    });

    it('régénération admin (force) : nouvel appel, puis le cache est remplacé', async () => {
        const posts = lb.posts.length;
        await worker.enqueueFeedbackJob(job('alice', level(1), CODE, { force: true }));
        await submitPending();
        assert.equal(lb.posts.length, posts + 1);
        await deliver(lb.posts.at(-1).id, PLATINUM);
        assert.equal((await worker.getFeedbackResult('alice', level(1))).score, 98);
        await worker.enqueueFeedbackJob(job('frank', level(1), CODE));
        assert.equal((await worker.getFeedbackResult('frank', level(1))).score, 98);
    });

    it('relève : récupère le résultat quand le callback n’arrive pas', async () => {
        await worker.enqueueFeedbackJob(job('gina', level(4), 'moveForward();'));
        await submitPending();
        const lbJob = lb.posts.at(-1).id;
        await worker.pollSubmitted({ staleMs: 0 });
        assert.equal(await worker.getFeedbackStatus('gina', level(4)), 'pending');
        lb.jobs.set(lbJob, { id: lbJob, status: 'succeeded', result: completion(GOLD), error: null });
        await worker.pollSubmitted({ staleMs: 0 });
        assert.equal(await worker.getFeedbackStatus('gina', level(4)), 'done');
        assert.equal((await redis.lRange('feedback:queue:submitted', 0, -1)).includes(lbJob), false);
    });

    it('relève : resoumet un job perdu par le load balancer avec une nouvelle clé', async () => {
        await worker.enqueueFeedbackJob(job('hugo', level(5), 'turnLeft();'));
        await submitPending();
        lb.jobs.delete(lb.posts.at(-1).id);
        await worker.pollSubmitted({ staleMs: 0 });
        await submitPending();
        assert.match(lb.posts.at(-1).headers['idempotency-key'], /-1$/);
    });

    it('file pleine (503) : soumission reprogrammée, sans échec', async () => {
        lb.failPosts = 1;
        const posts = lb.posts.length;
        await worker.enqueueFeedbackJob(job('ines', level(6), 'collectGem();'));
        await submitPending();
        assert.equal(await worker.getFeedbackStatus('ines', level(6)), 'pending');
        assert.equal(lb.posts.length, posts);
        await worker.pollSubmitted({ now: Date.now() });
        assert.equal((await redis.lRange('feedback:queue:pending', 0, -1)).length, 0);
        await worker.pollSubmitted({ now: Date.now() + 31000 });
        await submitPending();
        assert.equal(lb.posts.length, posts + 1);
    });
});
