/**
 * Якоря: плавная прокрутка с iOS-подобным замедлением (вместо резкого нативного smooth).
 * Прерывается жестом пользователя (колесо/тач/клавиша).
 */
let rafId = 0;

const easeOut = (t) => 1 - Math.pow(1 - t, 3.4);

export function scrollToTarget(target, { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
    const startY = window.scrollY;
    const endY = Math.max(0, Math.round(target.getBoundingClientRect().top + startY));
    const dist = endY - startY;
    cancelAnimationFrame(rafId);

    if (reduce || Math.abs(dist) < 2) {
        window.scrollTo({ top: endY, behavior: 'instant' });
        return;
    }

    const duration = Math.min(1250, 520 + Math.abs(dist) * 0.11);
    const t0 = performance.now();
    const stop = () => {
        cancelAnimationFrame(rafId);
        ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((e) => window.removeEventListener(e, stop));
    };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((e) => window.addEventListener(e, stop, { passive: true }));

    const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        window.scrollTo({ top: startY + dist * easeOut(p), behavior: 'instant' });
        if (p < 1) rafId = requestAnimationFrame(step);
        else stop();
    };
    rafId = requestAnimationFrame(step);
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
