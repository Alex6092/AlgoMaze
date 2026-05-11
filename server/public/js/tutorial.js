// Tutoriel interactif au premier login : overlay assombri + spotlight sur l'élément
// concerné + bulle explicative. Skippable à tout moment. Réactivable via le bouton "?"
// flottant. Marqué "vu" via localStorage (algomaze.tutorialDone).

(function() {
    const STORAGE_KEY = 'algomaze.tutorialDone';

    // Définition des étapes du tutoriel.
    // selector: élément à mettre en avant (null = popup centré sans spotlight).
    // placement: 'auto' | 'top' | 'bottom' | 'center' (défaut auto = bottom si place, sinon top).
    const STEPS = [
        {
            selector: null,
            placement: 'center',
            title: '👋 Bienvenue dans AlgoMaze !',
            body: 'Découvre en quelques étapes les outils que tu vas utiliser. Tu peux passer ce tutoriel à tout moment, et le retrouver via le bouton <b>?</b> en bas à gauche.'
        },
        {
            selector: '#maze',
            placement: 'auto',
            title: 'Le labyrinthe',
            body: 'C\'est ici que ton robot va se déplacer selon les instructions de ton code. Tu pourras visualiser chaque action en temps réel.'
        },
        {
            selector: '#level-list',
            placement: 'auto',
            title: 'Les niveaux',
            body: 'Tu progresses niveau par niveau dans le parcours. Le niveau en cours est surligné. Les niveaux supérieurs se débloquent en validant les précédents.'
        },
        {
            selector: '.consigne-container',
            placement: 'auto',
            title: 'La consigne',
            body: 'Lis attentivement : l\'objectif du niveau, et parfois des <b>contraintes pédagogiques</b> (par ex. « utilise une boucle while »). L\'IA évaluera la qualité de ta solution sur ces critères.'
        },
        {
            selector: '.code-editor-container',
            placement: 'auto',
            title: 'L\'éditeur de code',
            body: 'Écris ton programme en <b>JavaScript</b> ici. Tu vas utiliser les fonctions du jeu (<code>moveForward</code>, <code>turnLeft</code>, etc.) pour diriger le robot.'
        },
        {
            selector: '.editor-actions',
            placement: 'auto',
            title: 'Exécuter ou valider ?',
            body: 'Deux boutons importants :<br>▶ <b>Run</b> exécute ton code en local pour <i>tester</i> sans valider.<br>✓ <b>Submit</b> envoie la solution au serveur pour <i>valider</i> le niveau (et déclencher l\'évaluation IA).'
        },
        {
            selector: '.command-pills',
            placement: 'auto',
            title: 'Les fonctions du jeu',
            body: 'Voici les fonctions disponibles. Clique sur l\'une d\'elles pour l\'insérer directement dans ton code, ou tape-la à la main.'
        },
        {
            selector: null,
            placement: 'center',
            title: '🚀 À toi de jouer !',
            body: 'Tu as toutes les clés en main. Bon courage, et n\'hésite pas à relire ce tutoriel via le bouton <b>?</b> si besoin.'
        }
    ];

    let currentStep = 0;
    let overlayEl = null;
    let spotlightEl = null;
    let popupEl = null;
    let resizeHandler = null;

    function buildUI() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.className = 'tutorial-overlay';

        spotlightEl = document.createElement('div');
        spotlightEl.className = 'tutorial-spotlight';

        popupEl = document.createElement('div');
        popupEl.className = 'tutorial-popup';

        overlayEl.appendChild(spotlightEl);
        overlayEl.appendChild(popupEl);
        document.body.appendChild(overlayEl);

        // Délégation des clics sur le popup
        overlayEl.addEventListener('click', (e) => {
            const action = e.target.getAttribute && e.target.getAttribute('data-action');
            if (action === 'next')      showStep(currentStep + 1);
            else if (action === 'prev') showStep(currentStep - 1);
            else if (action === 'skip') skip();
        });

        // Recalcule les positions au scroll/resize
        resizeHandler = () => { if (overlayEl) showStep(currentStep); };
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('scroll', resizeHandler, true);

        // Échap pour skip
        document.addEventListener('keydown', onKey);
    }

    function teardown() {
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            window.removeEventListener('scroll', resizeHandler, true);
            resizeHandler = null;
        }
        document.removeEventListener('keydown', onKey);
        if (overlayEl) {
            overlayEl.remove();
            overlayEl = null;
            spotlightEl = null;
            popupEl = null;
        }
    }

    function onKey(e) {
        if (!overlayEl) return;
        if (e.key === 'Escape')           { e.preventDefault(); skip(); }
        else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); showStep(currentStep + 1); }
        else if (e.key === 'ArrowLeft')   { e.preventDefault(); showStep(currentStep - 1); }
    }

    function showStep(idx) {
        if (idx < 0) idx = 0;
        if (idx >= STEPS.length) { complete(); return; }
        currentStep = idx;
        const step = STEPS[idx];
        const target = step.selector ? document.querySelector(step.selector) : null;

        // Spotlight
        if (target) {
            const rect = target.getBoundingClientRect();
            const pad = 6;
            spotlightEl.style.display = 'block';
            spotlightEl.style.top    = (rect.top - pad) + 'px';
            spotlightEl.style.left   = (rect.left - pad) + 'px';
            spotlightEl.style.width  = (rect.width + 2 * pad) + 'px';
            spotlightEl.style.height = (rect.height + 2 * pad) + 'px';
        } else {
            spotlightEl.style.display = 'none';
        }

        // Popup
        const isLast = idx === STEPS.length - 1;
        const isFirst = idx === 0;
        popupEl.innerHTML = `
            <div class="tutorial-popup-step">${idx + 1} / ${STEPS.length}</div>
            <h3 class="tutorial-popup-title">${step.title}</h3>
            <div class="tutorial-popup-body">${step.body}</div>
            <div class="tutorial-popup-nav">
                <button class="btn btn-ghost btn-sm" type="button" data-action="skip">Passer</button>
                <div style="flex:1"></div>
                ${!isFirst ? '<button class="btn btn-secondary btn-sm" type="button" data-action="prev">← Précédent</button>' : ''}
                <button class="btn btn-primary btn-sm" type="button" data-action="next">${isLast ? 'Terminer' : 'Suivant →'}</button>
            </div>
        `;

        positionPopup(target, step.placement || 'auto');

        // Scroll l'élément en vue si nécessaire (sauf pour le popup centré).
        if (target && step.placement !== 'center') {
            const rect = target.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Re-positionne après le scroll
                setTimeout(() => { if (overlayEl) showStep(currentStep); }, 350);
            }
        }
    }

    function positionPopup(target, placement) {
        if (!target || placement === 'center') {
            popupEl.style.position = 'fixed';
            popupEl.style.left = '50%';
            popupEl.style.top = '50%';
            popupEl.style.transform = 'translate(-50%, -50%)';
            return;
        }
        const rect = target.getBoundingClientRect();
        const popupW = 420;
        const popupHEstimate = popupEl.offsetHeight || 200;
        const margin = 16;

        let top, left;
        // Tente en dessous, sinon au-dessus
        if (placement === 'top' || (placement === 'auto' && rect.bottom + popupHEstimate + margin > window.innerHeight)) {
            top = rect.top - popupHEstimate - margin;
        } else {
            top = rect.bottom + margin;
        }
        // Garde dans la fenêtre
        top = Math.max(margin, Math.min(top, window.innerHeight - popupHEstimate - margin));
        left = Math.max(margin, Math.min(rect.left, window.innerWidth - popupW - margin));

        popupEl.style.position = 'fixed';
        popupEl.style.top = top + 'px';
        popupEl.style.left = left + 'px';
        popupEl.style.transform = 'none';
    }

    function start() {
        currentStep = 0;
        buildUI();
        showStep(0);
    }

    function complete() {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
        teardown();
    }

    function skip() { complete(); }

    function hasBeenSeen() {
        try { return localStorage.getItem(STORAGE_KEY) === '1'; }
        catch (e) { return false; }
    }

    // Expose pour qu'un bouton "?" puisse le relancer.
    window.AppTutorial = {
        start,
        reset: () => { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
    };

    // Auto-démarrage au premier login, une fois la page prête.
    // On attend que le shell soit en place + un délai pour le chargement du niveau initial.
    function autoStartIfNeeded() {
        if (hasBeenSeen()) return;
        // Si la page n'a pas les éléments cibles (autre que /maze), on ne fait rien.
        if (!document.querySelector('#maze')) return;
        setTimeout(start, 600);
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(autoStartIfNeeded, 100);
    } else {
        document.addEventListener('DOMContentLoaded', autoStartIfNeeded);
    }
})();
