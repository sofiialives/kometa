/**
 * Появление блоков при скролле (blur-in + подъём 16px, один раз) и «слот-машина» цифр 01/02/03.
 * Всё на WAAPI/IntersectionObserver; блоки, уже видимые при загрузке, не прячутся.
 * Блюр — только у заголовков (дёшево); у крупных блоков — прозрачность и подъём.
 */
const REVEAL = '.directions__title, .crew__title, .section-title';
const BLUR = '.directions__title, .crew__title, .section-title';
const NUMS = '.card__num, .case__num, .mcard__num';

export function initRevealFx() {
    if (!('IntersectionObserver' in window)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    // ---------- появление ----------
    const vh = innerHeight;
    const targets = [...document.querySelectorAll(REVEAL)].filter((el) => !el.closest('.modal, .hero-static, [data-screens]'));
    const hidden = new Set();
    targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * .92 && r.bottom > 0) return;          // уже на экране — оставляем
        el.style.opacity = '0';
        hidden.add(el);
    });

    const show = (el) => {
        hidden.delete(el);
        const blur = el.matches(BLUR);
        const from = { opacity: 0, translate: '0 16px' };
        const to = { opacity: 1, translate: '0 0' };
        if (blur) { from.filter = 'blur(8px)'; to.filter = 'blur(0px)'; }
        el.style.opacity = '';
        const a = el.animate([from, to], { duration: 1100, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        a.onfinish = () => a.cancel();
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);
            if (hidden.has(en.target)) show(en.target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -22% 0px' });
    hidden.forEach((el) => io.observe(el));

    // страховка: если что-то так и не сработало — показываем всё через 6 с после загрузки
    setTimeout(() => hidden.forEach((el) => { el.style.opacity = ''; }), 6000);

    // ---------- цифры ----------
    const roll = (el) => {
        const final = el.dataset.final || el.textContent.trim();
        el.dataset.final = final;
        if (!/^\d{2}$/.test(final)) return;
        el.dataset.rolling = '1';
        const t0 = performance.now();
        const D = 1300;
        let last = 0;
        const step = (now) => {
            const k = Math.min(1, (now - t0) / D);
            if (k >= 1) { el.textContent = final; delete el.dataset.rolling; return; }
            if (now - last > 60) {
                last = now;
                const tens = k > .62 ? final[0] : String(Math.floor(Math.random() * 10));
                el.textContent = tens + (k > .86 ? final[1] : String(Math.floor(Math.random() * 10)));
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const seen = new WeakSet();
    const nio = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            const el = en.target;
            const inModal = !!el.closest('.modal');
            if (en.isIntersecting) {
                if (el.dataset.rolling) return;
                if (seen.has(el) && !inModal) return;
                seen.add(el);
                // в модалке ждём, пока лист доедет (≈.6 с), иначе анимацию не видно
                if (inModal) { el.dataset.final = el.dataset.final || el.textContent.trim(); el.textContent = '00'; }
                if (inModal) setTimeout(() => { if (el.closest('.modal')?.classList.contains('is-open')) roll(el); }, 560);
                else roll(el);
            } else if (inModal) {
                seen.delete(el);
            }
        });
    }, { threshold: 0.9, rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll(NUMS).forEach((el) => nio.observe(el));
}
