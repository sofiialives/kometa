export function initMenu({ header, burger, nav }) {
    if (!header || !burger || !nav) return null;

    const mq = window.matchMedia('(max-width: 1023.98px)');

    const set = (open) => {
        header.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        document.body.classList.toggle('is-locked', open);
    };

    const close = () => set(false);

    burger.addEventListener('click', () => set(!header.classList.contains('is-open')));

    nav.addEventListener('click', (event) => {
        if (event.target.closest('a')) close();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
    });

    mq.addEventListener('change', (event) => {
        if (!event.matches) close();
    });

    return { close };
}
