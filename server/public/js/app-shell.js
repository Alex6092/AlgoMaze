// AlgoMaze — App Shell
// 1) Applique le thème (clair/sombre) avant le rendu pour éviter le flash.
// 2) Injecte un header commun à toutes les pages authentifiées.
// 3) Gère le toggle thème, le menu mobile, la déconnexion et le rang du joueur.

(function applyThemeEarly() {
    try {
        const stored = localStorage.getItem('theme');
        const theme = stored === 'dark' || stored === 'light'
            ? stored
            : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
    } catch (e) {
        document.documentElement.dataset.theme = 'light';
    }
})();

window.AppShell = (function() {
    const STUDENT_LINKS = [
        { href: '/maze', label: 'Jeu',           match: ['/maze'] },
        { href: '/docs', label: 'Documentation', match: ['/docs'] }
    ];
    const ADMIN_LINKS = [
        { href: '/maze',      label: 'Jeu',                 match: ['/maze'] },
        { href: '/live',      label: 'Live',                match: ['/live'] },
        { href: '/progress',  label: 'Avancement',          match: ['/progress'] },
        { href: '/solutions', label: 'Solutions',           match: ['/solutions'] },
        { href: '/editor',    label: 'Éditeur de niveaux',  match: ['/editor'] },
        { href: '/docs',      label: 'Documentation',       match: ['/docs'] }
    ];

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem('theme', theme); } catch (e) {}
        const btn = document.querySelector('.theme-toggle');
        if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function toggleTheme() {
        const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    function navHtml(links, currentPath) {
        return links.map(link => {
            const active = link.match.some(p => currentPath === p || currentPath.startsWith(p + '/'));
            return `<a href="${link.href}" class="app-nav-link${active ? ' active' : ''}">${escapeHtml(link.label)}</a>`;
        }).join('');
    }

    function buildHeader(user) {
        const links = user && user.isAdmin ? ADMIN_LINKS : STUDENT_LINKS;
        const currentPath = window.location.pathname;
        const themeIcon = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙';
        const username = user ? user.username : '';

        return `
            <header class="app-header">
                <div class="app-header-inner">
                    <a href="/maze" class="app-brand">
                        <span class="app-brand-icon">🧩</span>
                        <span>AlgoMaze</span>
                    </a>
                    <nav class="app-nav" id="app-nav">
                        ${navHtml(links, currentPath)}
                    </nav>
                    <div class="app-header-actions">
                        <span class="player-progress" id="player-progress" style="display:none;"></span>
                        <span class="player-rank" id="player-rank" style="display:none;"></span>
                        <span class="mastery-badge" id="player-mastery" style="display:none;"></span>
                        <span class="muted" style="font-size:0.85rem;display:none;" id="app-username">${escapeHtml(username)}</span>
                        <button class="theme-toggle" type="button" title="Basculer le thème" aria-label="Basculer le thème">${themeIcon}</button>
                        <button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Déconnexion</button>
                        <button class="app-nav-toggle" type="button" aria-label="Menu" aria-expanded="false">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
                        </button>
                    </div>
                </div>
            </header>
        `;
    }

    function bindEvents() {
        const themeBtn = document.querySelector('.theme-toggle');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

        const navToggle = document.querySelector('.app-nav-toggle');
        const nav = document.getElementById('app-nav');
        if (navToggle && nav) {
            navToggle.addEventListener('click', () => {
                const open = nav.classList.toggle('open');
                navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }

    async function logout() {
        const token = localStorage.getItem('token');
        try {
            await fetch('/user/logout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + (token || '') },
                credentials: 'include'
            });
        } catch (e) { /* on ignore : on redirige quand même */ }
        try { localStorage.removeItem('token'); } catch (e) {}
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
    }

    async function fetchMe() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            const r = await fetch('/user/me', {
                headers: { 'Authorization': 'Bearer ' + token },
                credentials: 'include'
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) { return null; }
    }

    async function refreshRank() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const r = await fetch('/user/rank', {
                headers: { 'Authorization': 'Bearer ' + token },
                credentials: 'include'
            });
            if (!r.ok) return;
            const data = await r.json();

            // Pill avancement (Niv X/42) : visible dès qu'on a la donnée mastery.
            const progressEl = document.getElementById('player-progress');
            if (progressEl && data.mastery) {
                const m = data.mastery;
                progressEl.innerHTML = '<span>Niv.</span> <b>' + m.completedLevels + '</b><span>/' + m.totalLevels + '</span>';
                progressEl.title = 'Avancement dans le parcours : ' + m.progressPct + '%';
                progressEl.style.display = 'inline-flex';
            } else if (progressEl) {
                progressEl.style.display = 'none';
            }

            // Pill rang : visible uniquement quand l'étudiant a au moins une évaluation IA.
            const rankEl = document.getElementById('player-rank');
            if (rankEl) {
                if (data.sample > 0) {
                    rankEl.innerHTML = '<span>Rang :</span> <b>' + (data.rank || '?') + '</b>';
                    rankEl.title = 'Médiane ' + data.median + ' XP sur ' + data.sample + ' niveau' + (data.sample > 1 ? 'x' : '') + ' (qualité récente)';
                    rankEl.style.display = 'inline-flex';
                } else {
                    rankEl.style.display = 'none';
                }
            }

            // Pastille de maîtrise (compétence globale cumulée).
            const masteryEl = document.getElementById('player-mastery');
            if (masteryEl && data.mastery) {
                const m = data.mastery;
                masteryEl.className = 'mastery-badge ' + (m.color || 'red');
                masteryEl.textContent = m.name;
                masteryEl.title =
                    'Score : ' + m.score + '%   (' + m.totalXp + ' / ' + m.maxTotalXp + ' XP)\n' +
                    'Avancement : ' + m.completedLevels + '/' + m.totalLevels + ' niveaux (' + m.progressPct + '%)\n' +
                    'Qualité moyenne : ' + m.avgQualityPct + '%';
                masteryEl.style.display = 'inline-flex';
            } else if (masteryEl) {
                masteryEl.style.display = 'none';
            }
        } catch (e) { /* silent */ }
    }

    async function init() {
        const user = await fetchMe();
        const headerHtml = buildHeader(user);
        // Insère le header en tête du body (avant le contenu existant).
        document.body.insertAdjacentHTML('afterbegin', headerHtml);
        bindEvents();
        if (user && !user.isAdmin) {
            refreshRank();
        }
        startKeepAlive();
        document.dispatchEvent(new CustomEvent('app-shell-ready', { detail: { user } }));
    }

    // Keep-alive : ping périodique de /user/me pour déclencher le sliding refresh
    // côté serveur tant que l'onglet est visible. Évite l'expiration silencieuse du
    // token si l'étudiant lit un énoncé sans cliquer pendant plus longtemps que TTL/2.
    // Le ping ne tourne que si l'onglet est visible (pas de gaspillage en arrière-plan).
    const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 min — bien en dessous de TTL/2 (2h15)
    let _keepAliveTimer = null;
    function startKeepAlive() {
        if (_keepAliveTimer) return;
        const tick = async () => {
            if (document.visibilityState !== 'visible') return;
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                await fetch('/user/me', {
                    headers: { 'Authorization': 'Bearer ' + token },
                    credentials: 'include'
                });
                // L'intercepteur fetch global gère la mise à jour de token si refresh + le 401 si expiré.
            } catch (e) { /* silencieux : ce sera retenté au prochain tick */ }
        };
        _keepAliveTimer = setInterval(tick, KEEPALIVE_INTERVAL_MS);
        // Tick immédiat dès qu'on redevient visible (rattrape un long blur).
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') tick();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { setTheme, toggleTheme, refreshRank };
})();
