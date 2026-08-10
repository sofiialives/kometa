export function initNav({ root = document } = {}) {
    const links = [...root.querySelectorAll('a[href^="#"]')];
    if (!links.length) return;

    links.forEach((link) => {
        const id = link.getAttribute('href').slice(1);
        if (!id) return;

        const target = document.getElementById(id);

        if (!target) {
            link.setAttribute('aria-disabled', 'true');
            link.dataset.pending = 'true';
            link.addEventListener('click', (event) => event.preventDefault());
            return;
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            history.replaceState(null, '', '#' + id);
        });
    });
}
