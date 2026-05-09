// Client LM Studio pour l'évaluation des solutions des étudiants.
// Demande au modèle une réponse au format JSON structuré (json_schema) pour garantir
// que la sortie soit exploitable par l'application sans parsing fragile.

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

export async function evaluateSolution({ instructions, constraints, code }) {
    const url = process.env.LMSTUDIO_URL;
    const model = process.env.LMSTUDIO_MODEL;
    if (!url || !model) {
        throw new Error('LMSTUDIO_URL ou LMSTUDIO_MODEL manquant dans .env');
    }

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

    const body = {
        model,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        response_format: {
            type: 'json_schema',
            json_schema: FEEDBACK_JSON_SCHEMA
        },
        temperature: 0.3
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`LM Studio HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) {
        throw new Error('Réponse LM Studio invalide (pas de content)');
    }
    try {
        return JSON.parse(content);
    } catch (e) {
        throw new Error('Réponse LM Studio non-JSON : ' + content.slice(0, 200));
    }
}
