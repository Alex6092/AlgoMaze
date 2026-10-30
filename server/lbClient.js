// Client du load balancer d'inférence (« Providence IA ») pour l'évaluation des
// solutions des étudiants. Les évaluations sont des jobs asynchrones : le load
// balancer met la demande en file, la distribue à un serveur compatible, puis
// rappelle AlgoMaze (callback signé) avec la réponse OpenAI complète.
// La sortie reste au format JSON structuré (json_schema) pour éviter un parsing fragile.

import crypto from 'node:crypto';

// À incrémenter dès que le prompt ou le schéma change : les évaluations mises en
// cache avec une autre version ne sont plus réutilisées.
export const PROMPT_VERSION = 1;

const FEEDBACK_JSON_SCHEMA = {
    name: 'evaluation',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            score: { type: 'integer', minimum: 0, maximum: 100, description: 'Note globale sur 100' },
            constraintsRespected: { type: 'boolean', description: 'Toutes les contraintes pédagogiques sont-elles respectées ?' },
            feedback: { type: 'string', description: 'Retour pédagogique adressé à l\'étudiant, en français, 2-4 phrases.' },
            criteria: {
                type: 'array',
                description: 'Détail des critères évalués.',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        met: { type: 'boolean' },
                        comment: { type: 'string' }
                    },
                    required: ['name', 'met', 'comment'],
                    additionalProperties: false
                }
            }
        },
        required: ['score', 'constraintsRespected', 'feedback', 'criteria'],
        additionalProperties: false
    }
};

const SYSTEM_PROMPT = `Tu es un évaluateur pédagogique d'algorithmique.
Tu reçois la consigne d'un exercice de labyrinthe, ses contraintes pédagogiques (par ex. "doit utiliser une boucle while et au moins une condition"), et le code soumis par un étudiant.
Le code utilise des fonctions du jeu (moveForward, turnLeft, collectGem, toggleSwitch, isBlocked, isBlockedLeft, isBlockedRight, canCollectGem, isOnSwitch, canActivateSwitch, canDeactivateSwitch).
Évalue : (1) si les contraintes sont respectées (par ex. l'étudiant utilise bien des boucles/conditions au lieu de tout coder en dur), (2) la qualité globale (lisibilité, optimisation), (3) un score sur 100.
Réponds en français avec un retour bienveillant et constructif. Sois honnête : si le code "passe" mais ne met pas en œuvre les contraintes (par exemple suite linéaire de moveForward sans boucle), constraintsRespected doit être false.
Réponds UNIQUEMENT au format JSON décrit par le schéma.`;

// Erreur du load balancer. `transient` : réessayer plus tard (quota, file pleine,
// réseau) ; sinon la demande ne passera pas en l'état (configuration, requête invalide).
export class LbError extends Error {
    constructor(message, { status = null, code = null, transient = false, retryAfterMs = null } = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.transient = transient;
        this.retryAfterMs = retryAfterMs;
    }
}

export function lbConfig() {
    return {
        url: (process.env.LB_URL || '').replace(/\/+$/, ''),
        apiKey: process.env.LB_API_KEY || '',
        callbackSecret: process.env.LB_CALLBACK_SECRET || '',
        callbackUrl: process.env.LB_CALLBACK_URL || '',
        model: process.env.LB_MODEL || '',
        maxTokens: parseInt(process.env.LB_MAX_TOKENS || '2048', 10) || 2048
    };
}

// Variables manquantes pour soumettre des évaluations (vide = configuration complète).
export function missingConfig() {
    const env = { LB_URL: 'url', LB_API_KEY: 'apiKey', LB_CALLBACK_SECRET: 'callbackSecret', LB_CALLBACK_URL: 'callbackUrl', LB_MODEL: 'model' };
    const c = lbConfig();
    return Object.keys(env).filter((name) => !c[env[name]]);
}

export function buildRequest({ instructions, constraints, code }) {
    const userPrompt = [
        'Consigne du niveau :',
        instructions || '(aucune)',
        '',
        'Contraintes pédagogiques à respecter :',
        constraints || '(aucune contrainte spécifique fournie — évalue alors la qualité générale du code)',
        '',
        'Code soumis par l\'étudiant :',
        '```javascript',
        code,
        '```'
    ].join('\n');

    return {
        model: lbConfig().model,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        response_format: {
            type: 'json_schema',
            json_schema: FEEDBACK_JSON_SCHEMA
        },
        // Sortie aussi stable que possible : une même solution ne doit pas obtenir
        // une meilleure note simplement en relançant l'évaluation.
        temperature: 0,
        seed: 42,
        max_tokens: lbConfig().maxTokens
    };
}

async function request(method, path, { body, headers = {} } = {}) {
    const c = lbConfig();
    if (!c.url || !c.apiKey) throw new LbError('LB_URL ou LB_API_KEY manquant dans .env');
    let response;
    try {
        response = await fetch(c.url + path, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}`, ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30000)
        });
    } catch (err) {
        const cause = err.cause && (err.cause.code || err.cause.message);
        throw new LbError(`Load balancer injoignable${cause ? ` (${cause})` : ''}`, { transient: true });
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* corps non JSON */ }
    if (!response.ok) {
        const error = (data && data.error) || {};
        const retryAfter = parseInt(response.headers.get('retry-after') || '', 10);
        throw new LbError(`Load balancer HTTP ${response.status}${error.code ? ` (${error.code})` : ''} : ${error.message || text.slice(0, 200)}`, {
            status: response.status,
            code: error.code || null,
            transient: response.status === 429 || response.status >= 500,
            retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : null
        });
    }
    return data;
}

// Soumet une évaluation. `jobId` est l'identifiant AlgoMaze du job : avec `attempt`,
// il forme la clé d'idempotence (renvoyer la demande après une coupure ne crée pas de
// doublon ; `attempt` n'augmente que si le load balancer a perdu le job) et identifie
// le job dans l'URL de callback. Retourne l'identifiant du job LB.
export async function submitEvaluation({ jobId, attempt = 0, username, instructions, constraints, code }) {
    const c = lbConfig();
    if (!c.model || !c.callbackUrl) throw new LbError('LB_MODEL ou LB_CALLBACK_URL manquant dans .env');
    const callbackURL = c.callbackUrl + (c.callbackUrl.includes('?') ? '&' : '?') + 'job=' + encodeURIComponent(jobId);
    const job = await request('POST', '/v1/jobs', {
        body: { ...buildRequest({ instructions, constraints, code }), callbackURL },
        headers: { 'X-End-User-ID': `algomaze-${username}`, 'Idempotency-Key': `algomaze-${jobId}-${attempt}` }
    });
    if (!job || !job.id) throw new LbError('Réponse du load balancer sans identifiant de job', { transient: true });
    return job.id;
}

export async function getJob(lbJobId) {
    return request('GET', `/v1/jobs/${encodeURIComponent(lbJobId)}`);
}

// Extrait l'évaluation de la réponse OpenAI renvoyée par le load balancer.
export function parseEvaluation(result) {
    const message = result && result.choices && result.choices[0] && result.choices[0].message;
    let content = message && message.content;
    if (!content) throw new Error('Réponse du modèle invalide (pas de content)');
    // Modèles « à raisonnement » : le JSON suit parfois un bloc <think>…</think>.
    content = String(content).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    try {
        return JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content);
    } catch (e) {
        throw new Error('Réponse du modèle non-JSON : ' + content.slice(0, 200));
    }
}

// Vérifie un callback du load balancer : HMAC-SHA256 de `timestamp + "." + corps brut`,
// horodatage à ±5 minutes pour limiter le rejeu.
export function verifySignature(rawBody, timestamp, signatureHeader, secret, now = Date.now()) {
    if (!secret || !timestamp || !signatureHeader) return false;
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
    const match = /^sha256=([0-9a-f]{64})$/.exec(String(signatureHeader));
    if (!match) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(match[1], 'hex'));
}
