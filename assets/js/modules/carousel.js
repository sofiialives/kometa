/**
 * Карусель направлений: вся анимация — только transform/opacity (GPU), без перекладки.
 * Карточка вёрстается в «главном» размере (257×317), боковые — scale 0.70/0.73;
 * соседи справа сдвигаются на накопленное «лишнее» место главной карточки.
 */
const EXTRA = 77;           // главная шире боковой: 257 − 180
const SIDE_SX = 180 / 257;
const SIDE_SY = 231 / 317;

export function initCarousel({ track, progress }) {
    if (!track || !progress) return;

    const cards = [...track.children];
    cards.forEach((_, i) => {
        const m = document.createElement('i');
        m.className = 'dir-snap';
        m.setAttribute('aria-hidden', 'true');
        m.style.setProperty('--i', i);
        track.appendChild(m);
    });
    const phone = window.matchMedia('(max-width: 1279.98px)');
    // Safari 26+/Chrome: масштаб/сдвиг/прозрачность карточек считает сам браузер на композиторе (CSS scroll-driven animations)
    const native = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
    track.classList.toggle('sdt', native);
    let frame = 0;
    let pitchPx = 192;

    const measure = () => {
        pitchPx = parseFloat(getComputedStyle(track).getPropertyValue('--pitch')) || 192;
    };

    const reset = () => {
        cards.forEach((card) => {
            card.style.removeProperty('transform');
            card.style.removeProperty('opacity');
        });
    };

    const update = () => {
        frame = 0;
        const max = track.scrollWidth - track.clientWidth;
        const value = max > 0 ? track.scrollLeft / max : 0;
        progress.style.setProperty('--progress', value.toFixed(3));

        if (!phone.matches) { reset(); return; }

        const scrollable = max > 1;
        track.classList.toggle('has-current', scrollable);
        const u = scrollable ? Math.min(Math.max(track.scrollLeft / pitchPx, 0), cards.length - 1) : 0;

        if (native) {
            let near = 0;
            let bestD = Infinity;
            cards.forEach((card, i) => { const d = Math.abs(u - i); if (d < bestD) { bestD = d; near = i; } });
            if (scrollable) cards.forEach((card, i) => card.classList.toggle('is-current', i === near));
            return;
        }

        let shift = 0;
        let nearest = 0;
        let best = Infinity;

        cards.forEach((card, i) => {
            const d = Math.abs(u - i);
            const t = scrollable || i === 0 ? Math.max(0, 1 - d) : 0;
            const sx = SIDE_SX + (1 - SIDE_SX) * t;
            const sy = SIDE_SY + (1 - SIDE_SY) * t;
            card.style.transform = `translate3d(${shift.toFixed(2)}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
            card.style.opacity = (.5 + .5 * t).toFixed(3);
            shift += EXTRA * t;
            if (d < best) { best = d; nearest = i; }
        });

        if (scrollable) cards.forEach((card, i) => card.classList.toggle('is-current', i === nearest));
    };

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { measure(); schedule(); });
    measure();
    update();
}
