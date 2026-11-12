/**
 * Мобильный hero: планета по центру между низом хедера и низом экрана.
 * Кадр макета 455×986 (пропорции iPhone 15/16) масштабируется одним коэффициентом hu (считает CSS),
 * здесь — только то, что зависит от высоты хедера: положение планеты, нижних звёзд и заголовка.
 */
export function initHeroFit() {
    const hero = document.querySelector('.hero-static');
    if (!hero) return;
    const header = document.querySelector('.header');

    const fit = () => {
        if (getComputedStyle(hero).display === 'none') return;
        const W = hero.clientWidth;
        const H = hero.clientHeight;
        if (!W || !H) return;

        const hu = Math.min(W / 455, H / 986);
        const hb = header ? header.offsetHeight : 0;             // низ хедера
        const center = (hb + H) / 2;                             // середина свободной области
        const sphereTop = center - 213.5 * hu;                   // диаметр сферы 427hu

        hero.style.setProperty('--ey', `${(sphereTop - 52.3 * hu).toFixed(2)}px`);
        hero.style.setProperty('--es', `${(sphereTop - 291 * hu).toFixed(2)}px`);
        hero.style.setProperty('--ty', `${(hb + 46.1 * hu).toFixed(2)}px`);   // заголовок: 46.1hu ниже хедера (как на iPhone 15)
    };

    fit();
    window.addEventListener('resize', fit, { passive: true });
    window.addEventListener('orientationchange', fit, { passive: true });
    if ('ResizeObserver' in window) {
        new ResizeObserver(fit).observe(hero);
        if (header) new ResizeObserver(fit).observe(header);
    }
}
