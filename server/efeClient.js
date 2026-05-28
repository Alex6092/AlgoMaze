// Client pour l'API EFE (Évaluation par Compétences).
// Documentation officielle : voir infoApiExterne du projet ProjetCompetence.
//
// L'auth se fait via un header `X-Moodle-Key`. L'endpoint /note est idempotent
// sur le triplet (élève, code compétence, devoir_key) : un même devoir_key
// envoyé plusieurs fois met à jour la note au lieu de créer un doublon.
//
// Si l'env EFE_API_BASE_URL ou EFE_API_KEY est absent, le client est désactivé
// et toutes les fonctions retournent un résultat "disabled" sans erreur.

export function isEfeConfigured() {
    return Boolean(process.env.EFE_API_BASE_URL && process.env.EFE_API_KEY);
}

export function getOngoingDevoir() {
    return {
        key: process.env.EFE_DEVOIR_KEY || 'algomaze_progress_ongoing',
        label: process.env.EFE_DEVOIR_LABEL || 'AlgoMaze — Progression globale'
    };
}

export function getCompetenceCode() {
    return process.env.EFE_COMPETENCE_CODE || null;
}

// Pousse (création ou mise à jour) une note de compétence pour un étudiant.
// `idMoodleEleve` est l'ID Moodle de l'étudiant, récupéré au SSO.
// `couleur` doit être l'une de : vert / bleu / jaune / rouge / gris.
// Retourne { ok: true, action: 'created' | 'updated' } ou { ok: false, reason, status?, body? }.
export async function pushNote({ idMoodleEleve, competenceCode, couleur, devoirKey, devoirLabel, commentaire }) {
    if (!isEfeConfigured()) {
        return { ok: false, reason: 'disabled' };
    }
    if (!idMoodleEleve || !competenceCode || !couleur || !devoirKey) {
        return { ok: false, reason: 'missing-fields' };
    }

    const url = process.env.EFE_API_BASE_URL.replace(/\/+$/, '') + '/note';
    const body = {
        id_moodle_eleve: idMoodleEleve,
        competence_code: competenceCode,
        couleur,
        devoir_key: devoirKey
    };
    if (devoirLabel) body.devoir_label = devoirLabel;
    if (commentaire) body.commentaire = commentaire;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Moodle-Key': process.env.EFE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            // 5s : la doc EFE recommande de ne pas retry sur 4xx, et un retry
            // sur 500 est géré côté appelant si besoin. On évite que la file
            // d'évaluation ne reste bloquée si EFE est indisponible.
            signal: AbortSignal.timeout(5000)
        });
    } catch (e) {
        return { ok: false, reason: 'network', error: e.message };
    }

    let data = null;
    try { data = await response.json(); } catch (e) { /* ignore */ }

    if (!response.ok) {
        return { ok: false, reason: 'http', status: response.status, body: data };
    }
    return { ok: true, action: (data && data.action) || 'unknown', noteId: data && data.note_id };
}

// Optionnel : ping pour vérifier que la clé est valide et l'API joignable.
// Retourne { ok: true, source } ou { ok: false, ... }.
export async function ping() {
    if (!isEfeConfigured()) return { ok: false, reason: 'disabled' };
    const url = process.env.EFE_API_BASE_URL.replace(/\/+$/, '') + '/ping';
    try {
        const r = await fetch(url, {
            method: 'GET',
            headers: { 'X-Moodle-Key': process.env.EFE_API_KEY },
            signal: AbortSignal.timeout(5000)
        });
        const data = await r.json().catch(() => null);
        if (!r.ok) return { ok: false, reason: 'http', status: r.status, body: data };
        return { ok: true, source: data && data.source };
    } catch (e) {
        return { ok: false, reason: 'network', error: e.message };
    }
}
