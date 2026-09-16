// Tests d'intégration de la couche d'authentification (SSO Moodle, cookies, Bearer).
// Lance le serveur avec le faux Redis sur un port dédié, puis l'interroge en HTTP.
//
//   cd server && npm test
//
// Aucune dépendance externe : node:test + fetch natif (Node ≥ 20).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3123;
const BASE = 'http://127.0.0.1:' + PORT;

// Lit les secrets de server/.env (le serveur enfant les lit aussi via dotenv).
function readEnv() {
    const out = {};
    try {
        for (const line of fs.readFileSync(path.join(serverDir, '.env'), 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) out[m[1]] = m[2];
        }
    } catch (e) { /* pas de .env */ }
    return out;
}
const ENV = readEnv();
const JWT_SECRET = process.env.JWT_SECRET || ENV.JWT_SECRET || 'test-jwt-secret';
const MOODLE_SECRET = process.env.MOODLE_SHARED_SECRET || ENV.MOODLE_SHARED_SECRET || 'test-moodle-secret';

let child;

// Les hooks before/after doivent vivre dans un describe() pour être attendus par le runner.
describe('authentification', () => {

async function waitForServer(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const r = await fetch(BASE + '/login', { redirect: 'manual' });
            if (r.status === 200) return;
        } catch (e) { /* pas encore prêt */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Le serveur de test ne répond pas sur ' + BASE);
}

before(async () => {
    child = spawn(process.execPath, [path.join(serverDir, 'test', 'dev-server.mjs')], {
        cwd: serverDir,
        env: {
            ...process.env,
            PORT: String(PORT),
            FAKE_REDIS_SEED: '1',
            JWT_SECRET,
            MOODLE_SHARED_SECRET: MOODLE_SECRET,
            REDIS_USER: 'default', REDIS_PASSWORD: 'x', REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379',
            LMSTUDIO_URL: 'http://127.0.0.1:9/', LMSTUDIO_MODEL: 'fake'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let logs = '';
    child.stdout.on('data', d => { logs += d; });
    child.stderr.on('data', d => { logs += d; });
    child.on('exit', code => { if (code) console.error('serveur de test terminé (code ' + code + ')\n' + logs); });
    await waitForServer();
});

after(() => {
    if (child) child.kill();
});

// ---------- helpers ----------

// Comme le plugin Moodle : le username est mis en minuscules AVANT la signature.
function signSso({ username, level, timestamp, moodleid }) {
    username = String(username).toLowerCase();
    const payload = moodleid != null
        ? `${username}:${level}:${timestamp}:${moodleid}`
        : `${username}:${level}:${timestamp}`;
    return crypto.createHmac('sha256', MOODLE_SECRET).update(payload).digest('hex');
}

function ssoUrl({ username = 'alice', level = 2, ageSeconds = 0, moodleid = 42, signature } = {}) {
    const timestamp = Math.floor(Date.now() / 1000) - ageSeconds;
    const sig = signature || signSso({ username, level, timestamp, moodleid });
    return `${BASE}/sso/from-moodle?username=${encodeURIComponent(username)}&level=${level}&timestamp=${timestamp}&moodleid=${moodleid}&signature=${sig}`;
}

function setCookies(response) {
    // Node fetch : getSetCookie() expose chaque Set-Cookie séparément.
    return typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
}

function tokenFromSetCookie(response) {
    for (const c of setCookies(response)) {
        const m = c.match(/^token=([^;]*)/);
        if (m && m[1]) return decodeURIComponent(m[1]);
    }
    return null;
}

async function loginAs(username, password) {
    const r = await fetch(BASE + '/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    assert.equal(r.status, 200, 'login ' + username);
    const data = await r.json();
    return data.token;
}

async function ssoLogin(opts) {
    const r = await fetch(ssoUrl(opts), { redirect: 'manual' });
    assert.equal(r.status, 302);
    const token = tokenFromSetCookie(r);
    assert.ok(token, 'Set-Cookie token attendu');
    return { token, location: r.headers.get('location') };
}

// ---------- SSO ----------

it('SSO valide : pose le cookie et redirige vers le niveau demandé', async () => {
    const { token, location } = await ssoLogin({ username: 'alice', level: 2 });
    assert.equal(location, '/maze?level=2');
    const me = await fetch(BASE + '/user/me', { headers: { Cookie: 'token=' + token } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).username, 'alice');
});

it('SSO : auto-provisionne un nouvel étudiant avec son moodleId', async () => {
    const { token } = await ssoLogin({ username: 'Bob.Martin', level: 1, moodleid: 77 });
    const me = await fetch(BASE + '/user/me', { headers: { Cookie: 'token=' + token } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).username, 'bob.martin');
});

it('SSO : lien trop ancien → page HTML 403 lisible', async () => {
    const r = await fetch(ssoUrl({ ageSeconds: 3600 }), { redirect: 'manual' });
    assert.equal(r.status, 403);
    assert.match(r.headers.get('content-type') || '', /text\/html/);
    assert.match(await r.text(), /Lien expiré/);
});

it('SSO : lien récent (dans la fenêtre par défaut de 10 min) accepté', async () => {
    const r = await fetch(ssoUrl({ ageSeconds: 300 }), { redirect: 'manual' });
    assert.equal(r.status, 302);
});

it('SSO : signature invalide → 403', async () => {
    const r = await fetch(ssoUrl({ signature: 'deadbeef' }), { redirect: 'manual' });
    assert.equal(r.status, 403);
    assert.match(await r.text(), /Signature invalide/);
});

it('SSO : paramètres manquants → 400', async () => {
    const r = await fetch(BASE + '/sso/from-moodle?username=alice', { redirect: 'manual' });
    assert.equal(r.status, 400);
});

it('SSO : username avec caractères réservés (":" ou jokers) refusé', async () => {
    const r = await fetch(ssoUrl({ username: 'evil:*' }), { redirect: 'manual' });
    assert.equal(r.status, 400);
});

// ---------- résolution des tokens ----------

it('page /maze : un cookie token étranger placé avant le bon n\'empêche pas l\'accès', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 1 });
    const r = await fetch(BASE + '/maze?level=1', {
        headers: { Cookie: 'token=foreign-token-from-other-app; token=' + token },
        redirect: 'manual'
    });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<canvas id="maze"/);
    // Le cookie valide ne doit PAS avoir été effacé.
    assert.ok(!setCookies(r).some(c => /^token=;/.test(c)), 'le cookie ne doit pas être effacé');
});

it('API : Bearer périmé + cookie valide → 200 (le cookie sert de secours)', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 1 });
    const r = await fetch(BASE + '/levels', {
        headers: { Authorization: 'Bearer stale.bearer.token', Cookie: 'token=' + token }
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /application\/json/);
    assert.deepEqual(await r.json(), [1, 2]);
});

it('API : cookie périmé + Bearer valide → 200', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 1 });
    const r = await fetch(BASE + '/user/me', {
        headers: { Authorization: 'Bearer ' + token, Cookie: 'token=stale.cookie.token' }
    });
    assert.equal(r.status, 200);
});

it('API : "Bearer null" (client sans localStorage) + cookie valide → 200', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 1 });
    const r = await fetch(BASE + '/user/badges', {
        headers: { Authorization: 'Bearer null', Cookie: 'token=' + token }
    });
    assert.equal(r.status, 200);
});

it('API : aucun token → 401 JSON (pas de redirection vers /login)', async () => {
    for (const p of ['/levels', '/level/1', '/user/me', '/user/rank', '/api/docs-config']) {
        const r = await fetch(BASE + p, { redirect: 'manual' });
        assert.equal(r.status, 401, p);
        assert.match(r.headers.get('content-type') || '', /application\/json/, p);
    }
});

it('API : tous les tokens présentés invalides → 401 "Session expired"', async () => {
    const r = await fetch(BASE + '/levels', {
        headers: { Authorization: 'Bearer bad', Cookie: 'token=bad1; token=bad2' }
    });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'Session expired');
});

it('pages : sans cookie → redirection /login ; cookie invalide → effacé + /login', async () => {
    const r1 = await fetch(BASE + '/maze', { redirect: 'manual' });
    assert.equal(r1.status, 302);
    assert.equal(r1.headers.get('location'), '/login');

    const r2 = await fetch(BASE + '/maze', { headers: { Cookie: 'token=garbage' }, redirect: 'manual' });
    assert.equal(r2.status, 302);
    assert.ok(setCookies(r2).some(c => /^token=;/.test(c)), 'cookie invalide effacé');
});

it('pages admin : étudiant → /maze ; admin → page servie', async () => {
    const student = await loginAs('alice', 'alice123');
    const r1 = await fetch(BASE + '/progress', { headers: { Cookie: 'token=' + student }, redirect: 'manual' });
    assert.equal(r1.status, 302);
    assert.equal(r1.headers.get('location'), '/maze');

    const admin = await loginAs('admin', 'admin123');
    const r2 = await fetch(BASE + '/progress', { headers: { Cookie: 'token=' + admin }, redirect: 'manual' });
    assert.equal(r2.status, 200);
});

it('réponses dynamiques jamais mises en cache', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 1 });
    const page = await fetch(BASE + '/maze', { headers: { Cookie: 'token=' + token } });
    assert.match(page.headers.get('cache-control') || '', /no-store/);
    const api = await fetch(BASE + '/levels', { headers: { Cookie: 'token=' + token } });
    assert.match(api.headers.get('cache-control') || '', /no-store/);
});

// ---------- login classique ----------

it('login : identifiants manquants → 400, mauvais mot de passe → 401, inconnu → 404', async () => {
    const post = (body) => fetch(BASE + '/user/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ username: 'alice', password: 'wrong' })).status, 401);
    assert.equal((await post({ username: 'nobody', password: 'x' })).status, 404);
});

it('login : succès → token + cookie ; logout → cookie effacé', async () => {
    const r = await fetch(BASE + '/user/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Alice', password: 'alice123' })
    });
    assert.equal(r.status, 200);
    const { token } = await r.json();
    assert.equal(tokenFromSetCookie(r), token);

    const out = await fetch(BASE + '/user/logout', { method: 'POST' });
    assert.ok(setCookies(out).some(c => /^token=;/.test(c)));
});

// ---------- validation des entrées ----------

it('niveaux : id invalide → 400, niveau inexistant → 404', async () => {
    const admin = await loginAs('admin', 'admin123');
    const h = { Cookie: 'token=' + admin };
    assert.equal((await fetch(BASE + '/level/abc', { headers: h })).status, 400);
    assert.equal((await fetch(BASE + '/level/999', { headers: h })).status, 404);
});

it('soumission : corps invalide → 400 ; solution valide → true + progression', async () => {
    const { token } = await ssoLogin({ username: 'alice', level: 2 });
    const h = { 'Content-Type': 'application/json', Cookie: 'token=' + token };
    const bad = await fetch(BASE + '/checkanswer', { method: 'POST', headers: h, body: JSON.stringify({ levelId: 'x', code: 3 }) });
    assert.equal(bad.status, 400);

    const ok = await fetch(BASE + '/checkanswer', {
        method: 'POST', headers: h,
        body: JSON.stringify({ levelId: '2', code: 'moveForward(); moveForward(); collectGem();' })
    });
    assert.equal(ok.status, 200);
    assert.equal(await ok.json(), true);

    // lastCompletedLevel est stocké en nombre même si le client envoie une chaîne.
    const me = await fetch(BASE + '/user/me', { headers: h });
    assert.equal((await me.json()).lastCompletedLevel, 2);
});

it('check_completion : body invalide → 400 ; comparaison numérique', async () => {
    const post = (body) => fetch(BASE + '/check_completion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({})).status, 400);
    const r = await post({ username: 'ALICE', levelnumber: 2 });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { completed: true });
    const r2 = await post({ username: 'alice', levelnumber: 10 });
    assert.deepEqual(await r2.json(), { completed: false });
});

it('inscription : username invalide → 400, doublon → 409', async () => {
    const post = (body) => fetch(BASE + '/user/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post({ username: 'bad name', password: 'x' })).status, 400);
    assert.equal((await post({ username: 'alice', password: 'x' })).status, 409);
    assert.equal((await post({ username: 'newbie', password: 'pw' })).status, 201);
});
});
