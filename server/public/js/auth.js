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
