export function initReveal({ root = document, reduceMotion = false } = {}) {
    const items = [...root.querySelectorAll('[data-reveal]')];
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
        items.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const delay = Number(entry.target.dataset.revealDelay || 0);
            entry.target.style.setProperty('--reveal-delay', delay + 'ms');
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    items.forEach((el) => observer.observe(el));
}
