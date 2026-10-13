/**
 * Якоря: нативный плавный скролл браузера (iOS/Android ведут его вне главного потока) —
 * без покадрового scrollTo из JS, который дёргается на телефонах.
 * Пока скролл идёт, на html висит .is-autoscroll (фоновые анимации на паузе).
 */
let idleTimer = 0;

function markAutoscroll() {
    const root = document.documentElement;
    root.classList.add('is-autoscroll');
    const done = () => {
        clearTimeout(idleTimer);
        root.classList.remove('is-autoscroll');
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('scrollend', done);
    };
    const onScroll = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(done, 140);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', done, { once: true });
    idleTimer = setTimeout(done, 400);
}

export function scrollToTarget(target, { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
    const endY = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY));
    if (reduce || Math.abs(endY - window.scrollY) < 2) {
        window.scrollTo({ top: endY, behavior: 'instant' });
        return;
    }
    markAutoscroll();
    window.scrollTo({ top: endY, behavior: 'smooth' });
}

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
            // без data-modal-cta: модалка сама закрывается и вызывает scrollToTarget
            if (link.hasAttribute('data-modal-cta')) return;
            scrollToTarget(target);
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            history.replaceState(null, '', '#' + id);
        });
    });
}
