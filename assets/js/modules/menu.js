const MOBILE_QUERY = '(max-width: 1100px)';

export function initMenu({ toggle, nav, body = document.body }) {
    if (!toggle || !nav) return;

    const mq = window.matchMedia(MOBILE_QUERY);
    let lastFocused = null;

    const isOpen = () => nav.classList.contains('is-open');

    const focusables = () =>
        [...nav.querySelectorAll('a[href], button:not([disabled])')]
            .filter((el) => el.offsetParent !== null);

    const close = ({ restoreFocus = false } = {}) => {
        if (!isOpen()) return;
        nav.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        body.classList.remove('is-locked');
        if (restoreFocus && lastFocused) lastFocused.focus();
    };

    const open = () => {
        lastFocused = document.activeElement;
        nav.classList.add('is-open');
        toggle.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        body.classList.add('is-locked');
        focusables()[0]?.focus();
    };

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        isOpen() ? close() : open();
    });

    nav.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) close();
    });

    document.addEventListener('click', (event) => {
        if (!isOpen()) return;
        if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
    });

    document.addEventListener('keydown', (event) => {
        if (!isOpen()) return;

        if (event.key === 'Escape') {
            close({ restoreFocus: true });
            return;
        }

        if (event.key !== 'Tab') return;

        const items = focusables();
        if (!items.length) return;

        const first = items[0];
        const last = items[items.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    mq.addEventListener('change', (event) => {
        if (!event.matches) close();
    });
}
