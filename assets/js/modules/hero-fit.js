/**
 * Мобильный hero: подгоняет планету под высоту экрана.
 * Кадр макета 455×1026. Заголовок и комета прижаты к верху, карточка и стрелки — к низу;
 * на коротких экранах (SE) планета уменьшается и ставится между ними, на длинных — остаётся как в макете.
 */
export function initHeroFit() {
    const hero = document.querySelector('.hero-static');
    if (!hero) return;

    const fit = () => {
        if (getComputedStyle(hero).display === 'none') return;
        const W = hero.clientWidth;
        const H = hero.clientHeight;
        if (!W || !H) return;

        const hu = Math.min(W / 455, H / 700);
        const top = 212 * hu;               // ниже заголовка
        const bottom = H - 275 * hu;        // выше галочки карточки
        const avail = bottom - top;
        const k = Math.max(0.4, Math.min(1, avail / (427 * hu)));
        const diameter = 427 * hu * k;
        const sphereTop = top + (avail - diameter) * 0.7;

        hero.style.setProperty('--ek', k.toFixed(4));
        hero.style.setProperty('--ey', `${(sphereTop - 52.3 * hu * k).toFixed(2)}px`);
        hero.style.setProperty('--es', `${(sphereTop - 291 * hu).toFixed(2)}px`);
    };

    fit();
    window.addEventListener('resize', fit, { passive: true });
    window.addEventListener('orientationchange', fit, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(hero);
}
