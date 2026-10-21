/**
 * Пасхалки:
 *  заголовок вкладки меняется, когда уходишь, и когда возвращаешься.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- заголовок вкладки ---------- */
function initTitle() {
    const original = document.title;
    let t = 0;
    document.addEventListener('visibilitychange', () => {
        clearTimeout(t);
        if (document.hidden) {
            document.title = 'Мы на орбите — ждём вашего возвращения';
        } else {
            document.title = 'Добро пожаловать';
            t = setTimeout(() => { document.title = original; }, 2600);
        }
    });
}

export function initEggs() {
    
    initTitle();
}
