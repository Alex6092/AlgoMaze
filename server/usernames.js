// Validation / normalisation des identifiants utilisateurs.
//
// Les usernames servent de segment dans les clés Redis (`user:<username>`,
// `usersolution:<username>:level:<id>`, …) et dans des motifs KEYS. On interdit donc
// le séparateur ":" (qui casserait le découpage des clés) et les jokers de motif
// ("*", "?", "[", "]"), ainsi que les espaces et caractères de contrôle.
//
// Moodle produit par défaut des identifiants en minuscules composés de lettres, chiffres,
// ".", "-", "_" et "@" ; on reste volontairement plus permissif (unicode accepté) pour ne
// pas rejeter des comptes existants.

export const USERNAME_MAX_LENGTH = 100;

export function normalizeUsername(raw) {
    return String(raw == null ? '' : raw).trim().toLowerCase();
}

export function isValidUsername(username) {
    if (typeof username !== 'string') return false;
    if (username.length === 0 || username.length > USERNAME_MAX_LENGTH) return false;
    // eslint-disable-next-line no-control-regex
    if (/[\s:*?\[\]\x00-\x1f\x7f]/.test(username)) return false;
    return true;
}

// Échappe les jokers de motif KEYS pour un segment inséré tel quel dans un pattern.
export function escapeKeyPattern(segment) {
    return String(segment).replace(/[\\*?\[\]]/g, '\\$&');
}
