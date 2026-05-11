// Synchronise localStorage.token depuis le cookie token À CHAQUE chargement de page.
// IMPORTANT : on remplace toujours (pas seulement quand localStorage est vide), car
// le serveur peut avoir renouvelé le cookie via sliding refresh sur la requête de page
// (Set-Cookie envoyé mais non observable par le JS). Le cookie est donc la source
// de vérité la plus à jour ; on aligne localStorage dessus pour que les fetch Bearer
// utilisent le même token.
(function syncTokenFromCookie() {
    try {
        const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (m && m[1]) {
            localStorage.setItem('token', decodeURIComponent(m[1]));
        }
    } catch (e) { /* localStorage indisponible : on ignore */ }
})();

// Intercepteur fetch global :
//  - met à jour localStorage + cookie si le serveur a renouvelé le token (X-Refreshed-Token)
//  - sur réponse 401 d'une route protégée, redirige proprement vers /login
//    (la session a expiré au-delà de tout sliding récupérable)
(function() {
    if (typeof window === 'undefined' || !window.fetch) return;
    const originalFetch = window.fetch;
    // Routes publiques sur lesquelles une réponse 401 ne doit PAS déclencher de redirect
    // (par ex. /user/login retourne 401 sur mauvais mot de passe).
    const PUBLIC_PATHS = ['/user/login', '/user/register', '/login', '/register', '/sso/from-moodle'];
    let redirecting = false;

    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const refreshed = response.headers.get('X-Refreshed-Token');
            if (refreshed) {
                localStorage.setItem('token', refreshed);
                // Cookie : path=/ pour matcher le cookie posé côté serveur.
                document.cookie = 'token=' + refreshed + '; path=/; max-age=' + (4 * 3600 + 1800);
            }
        } catch (e) { /* opaque response, headers inaccessibles, on ignore */ }

        // Détection de session expirée sur les routes protégées.
        if (response.status === 401 && !redirecting) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            const path = url.replace(/^https?:\/\/[^/]+/, '');
            const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '?'));
            if (!isPublic) {
                redirecting = true;
                try { localStorage.removeItem('token'); } catch (e) {}
                document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                // Petit délai pour qu'une éventuelle notif puisse s'afficher avant le redirect.
                setTimeout(() => {
                    window.location.href = '/login?expired=1';
                }, 200);
            }
        }
        return response;
    };
})();
