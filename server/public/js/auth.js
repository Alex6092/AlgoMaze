// AlgoMaze — couche d'authentification côté client.
//
// Le serveur pose un cookie `token` (JWT) au login / SSO et le renouvelle (sliding
// refresh) soit via Set-Cookie sur les chargements de page, soit via l'en-tête
// X-Refreshed-Token sur les appels API. Ce script :
//
//  1) synchronise localStorage.token depuis le cookie À CHAQUE chargement de page, en
//     choisissant le meilleur candidat si plusieurs cookies `token` sont visibles
//     (cookie posé sur le domaine parent par une autre application, vieux cookie avec
//     un autre path…) : un JWT non expiré, le plus récent ;
//  2) installe un intercepteur fetch qui, sur les requêtes vers notre origine, envoie
//     toujours le token le plus frais en `Authorization: Bearer` (jamais un token
//     capturé au chargement de la page qui aurait expiré depuis), applique les
//     renouvellements (X-Refreshed-Token) et redirige vers /login sur 401.
//
// API exposée : window.AlgoAuth = { getToken, authHeaders, clearSession, syncTokenFromCookie }.

(function () {
    if (typeof window === 'undefined') return;

    var COOKIE_NAME = 'token';
    var COOKIE_MAX_AGE = 4 * 3600 + 1800; // aligné sur JWT_TTL_SECONDS côté serveur (4h30)

    function decodeJwtPayload(token) {
        try {
            var part = String(token).split('.')[1];
            if (!part) return null;
            var b64 = part.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            return JSON.parse(atob(b64));
        } catch (e) { return null; }
    }

    // Tous les cookies `token` visibles, dans l'ordre fourni par le navigateur.
    function cookieTokens() {
        var out = [];
        try {
            document.cookie.split(';').forEach(function (part) {
                var eq = part.indexOf('=');
                if (eq < 0) return;
                if (part.slice(0, eq).trim() !== COOKIE_NAME) return;
                var v = part.slice(eq + 1).trim();
                try { v = decodeURIComponent(v); } catch (e) { /* valeur brute */ }
                if (v) out.push(v);
            });
        } catch (e) { /* document.cookie inaccessible */ }
        return out;
    }

    // Meilleur candidat : un JWT bien formé, non expiré, avec l'expiration la plus lointaine.
    function pickBestToken(candidates) {
        var now = Math.floor(Date.now() / 1000);
        var best = null, bestExp = -1;
        (candidates || []).forEach(function (t) {
            var p = decodeJwtPayload(t);
            if (!p || typeof p.exp !== 'number' || p.exp <= now) return;
            if (p.exp > bestExp) { best = t; bestExp = p.exp; }
        });
        return best;
    }

    function readLocalToken() {
        try { return localStorage.getItem('token'); } catch (e) { return null; }
    }

    function writeLocalToken(token) {
        try {
            if (token) localStorage.setItem('token', token);
            else localStorage.removeItem('token');
        } catch (e) { /* localStorage indisponible : on ignore */ }
    }

    function cookieAttributes() {
        var attrs = '; path=/; SameSite=Lax';
        if (window.location && window.location.protocol === 'https:') attrs += '; Secure';
        return attrs;
    }

    function writeCookie(token) {
        try {
            document.cookie = COOKIE_NAME + '=' + token + cookieAttributes() + '; max-age=' + COOKIE_MAX_AGE;
        } catch (e) {}
    }

    function clearCookie() {
        try {
            document.cookie = COOKIE_NAME + '=' + cookieAttributes() + '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        } catch (e) {}
    }

    // Le cookie est la source de vérité la plus à jour (le serveur peut l'avoir renouvelé
    // via Set-Cookie sur la requête de page, ce qui n'est pas observable autrement).
    function syncTokenFromCookie() {
        var fromCookie = pickBestToken(cookieTokens());
        if (fromCookie) {
            writeLocalToken(fromCookie);
            return;
        }
        // Aucun cookie exploitable : un token périmé en localStorage ne doit pas être renvoyé.
        var local = readLocalToken();
        if (local && !pickBestToken([local])) writeLocalToken(null);
    }

    // Token le plus frais disponible (localStorage puis cookies), ou null.
    function getToken() {
        var local = readLocalToken();
        var best = pickBestToken([local].concat(cookieTokens()));
        if (best) return best;
        // Token non décodable (format inattendu) : on le laisse au serveur, qui tranchera.
        return local || null;
    }

    function authHeaders() {
        var t = getToken();
        return t ? { 'Authorization': 'Bearer ' + t } : {};
    }

    function clearSession() {
        writeLocalToken(null);
        clearCookie();
    }

    function isSameOrigin(url) {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch (e) { return false; }
    }

    window.AlgoAuth = {
        getToken: getToken,
        authHeaders: authHeaders,
        clearSession: clearSession,
        syncTokenFromCookie: syncTokenFromCookie
    };

    syncTokenFromCookie();

    if (!window.fetch) return;
    var originalFetch = window.fetch;
    // Routes publiques sur lesquelles une réponse 401 ne doit PAS déclencher de redirect
    // (par ex. /user/login retourne 401 sur mauvais mot de passe).
    var PUBLIC_PATHS = ['/user/login', '/user/register', '/login', '/register', '/sso/from-moodle'];
    var redirecting = false;

    window.fetch = async function (input, init) {
        var args = [input, init];
        try {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url && isSameOrigin(url)) {
                var token = getToken();
                if (input instanceof Request && init === undefined) {
                    var h = new Headers(input.headers);
                    if (token) h.set('Authorization', 'Bearer ' + token); else h.delete('Authorization');
                    args = [new Request(input, { headers: h })];
                } else {
                    var opts = Object.assign({}, init || {});
                    var headers = new Headers(opts.headers || (input instanceof Request ? input.headers : undefined));
                    if (token) headers.set('Authorization', 'Bearer ' + token); else headers.delete('Authorization');
                    opts.headers = headers;
                    if (opts.credentials === undefined) opts.credentials = 'same-origin';
                    args = [input, opts];
                }
            }
        } catch (e) { args = [input, init]; }

        var response = await originalFetch.apply(this, args);
        try {
            var refreshed = response.headers.get('X-Refreshed-Token');
            if (refreshed) {
                writeLocalToken(refreshed);
                writeCookie(refreshed);
            }
        } catch (e) { /* opaque response, headers inaccessibles, on ignore */ }

        // Détection de session expirée sur les routes protégées : le serveur a examiné
        // tous les tokens présentés (Bearer et cookies) et aucun n'est valide.
        if (response.status === 401 && !redirecting) {
            var reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            var path = reqUrl.replace(/^https?:\/\/[^/]+/, '');
            var isPublic = PUBLIC_PATHS.some(function (p) { return path === p || path.indexOf(p + '?') === 0; });
            if (!isPublic && isSameOrigin(reqUrl)) {
                redirecting = true;
                clearSession();
                // Petit délai pour qu'une éventuelle notif puisse s'afficher avant le redirect.
                setTimeout(function () {
                    window.location.href = '/login?expired=1';
                }, 200);
            }
        }
        return response;
    };
})();
