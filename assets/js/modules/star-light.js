/**
 * Свет звезды на текстах: CSS-анимация (starPath) двигает источник света вдоль левого края, а тут мы лишь сообщаем
 * каждому тексту его положение в окне (--ox/--oy), чтобы градиент знал, где находится звезда относительно букв.
 * Считаем по offsetLeft/offsetTop — без учёта transform, поэтому анимации появления не сдвигают результат.
 */
export function initStarLight() {
    const mq = window.matchMedia('(min-width: 1280px) and (prefers-reduced-motion: no-preference)');
    const targets = [...document.querySelectorAll('.hero__title, .welcome__title, .welcome__subtitle, .welcome__text')];
    if (!targets.length) return;

    const place = () => {
        if (!mq.matches) return;
        targets.forEach((el) => {
            let x = 0; let y = 0;
            for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
            el.style.setProperty('--ox', x + 'px');
            el.style.setProperty('--oy', y + 'px');
        });
    };

    place();
    addEventListener('resize', place, { passive: true });
    addEventListener('load', place);
    mq.addEventListener?.('change', place);
    document.fonts?.ready.then(place);
}
