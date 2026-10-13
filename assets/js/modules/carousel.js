export function initCarousel({ track, progress }) {
    if (!track || !progress) return;

    const cards = [...track.children];
    let frame = 0;

    const pitch = () => parseFloat(getComputedStyle(track).getPropertyValue('--pitch')) || 192;

    const update = () => {
        frame = 0;
        const max = track.scrollWidth - track.clientWidth;
        const value = max > 0 ? track.scrollLeft / max : 0;
        progress.style.setProperty('--progress', value.toFixed(3));

        const scrollable = max > 1;
        track.classList.toggle('has-current', scrollable);

        // позиция в «карточках»: 0 — первая у линии, 1 — вторая и т.д.
        const u = scrollable ? Math.min(Math.max(track.scrollLeft / pitch(), 0), cards.length - 1) : 0;

        let nearest = 0;
        let best = Infinity;

        cards.forEach((card, i) => {
            const d = Math.abs(u - i);
            // непрерывная степень «главности» карточки: плавное увеличение/уменьшение
            card.style.setProperty('--t', Math.max(0, 1 - d).toFixed(3));
            if (d < best) { best = d; nearest = i; }
        });

        if (!scrollable) return;
        cards.forEach((card, i) => card.classList.toggle('is-current', i === nearest));
    };

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
}
