// Synchronise localStorage.token depuis le cookie token si manquant.
// Utile après un redirect SSO (Moodle) où seul le cookie est posé côté serveur :
// les requêtes Bearer côté front ont besoin du token dans localStorage.
(function syncTokenFromCookie() {
    try {
        if (!localStorage.getItem('token')) {
            const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
            if (m && m[1]) {
                localStorage.setItem('token', decodeURIComponent(m[1]));
            }
        }
    } catch (e) { /* localStorage indisponible : on ignore */ }
})();

// Sliding token interceptor.
// Si le serveur renvoie un header X-Refreshed-Token (sliding session),
// on met à jour le token stocké côté client (localStorage + cookie).
(function() {
    if (typeof window === 'undefined' || !window.fetch) return;
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const refreshed = response.headers.get('X-Refreshed-Token');
            if (refreshed) {
                localStorage.setItem('token', refreshed);
                document.cookie = 'token=' + refreshed + '; path=/';
            }
        } catch (e) {
            // Headers inaccessibles dans certains contextes (ex. opaque response) : on ignore.
        }
        return response;
    };
})();
