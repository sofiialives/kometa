/** Мобильное меню: выпадающая панель с iOS-пружиной, закрытие по ×, фону, Esc; переход по ссылке меню не закрывает. */
export function initMenu({ header, burger, nav }) {
    if (!header || !burger || !nav) return null;

    const mq = window.matchMedia('(max-width: 1279.98px)');
    const closeBtn = nav.querySelector('[data-nav-close]');
    const scrim = header.querySelector('[data-nav-scrim]');

    const set = (open, { restoreFocus = true } = {}) => {
        const was = header.classList.contains('is-open');
        if (was === open) return;
        header.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        if (open) closeBtn?.focus({ preventScroll: true });
        else if (restoreFocus && mq.matches) burger.focus({ preventScroll: true });
    };

    const close = (opts) => set(false, opts);

    burger.addEventListener('click', () => set(!header.classList.contains('is-open')));
    closeBtn?.addEventListener('click', () => close());
    scrim?.addEventListener('click', () => close());

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
    });

    mq.addEventListener('change', (event) => {
        if (!event.matches) close({ restoreFocus: false });
    });

    return { close };
}
