export function initCarousel({ track, progress }) {
    if (!track || !progress) return;

    const cards = [...track.children];
    let frame = 0;

    const update = () => {
        frame = 0;
        const max = track.scrollWidth - track.clientWidth;
        const value = max > 0 ? track.scrollLeft / max : 0;
        progress.style.setProperty('--progress', value.toFixed(3));

        const scrollable = max > 1;
        track.classList.toggle('has-current', scrollable);
        if (!scrollable) return;

        const origin = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).paddingLeft);
        let nearest = 0;
        let best = Infinity;

        cards.forEach((card, i) => {
            const d = Math.abs(card.getBoundingClientRect().left - origin);
            if (d < best) { best = d; nearest = i; }
        });

        cards.forEach((card, i) => card.classList.toggle('is-current', i === nearest));
    };

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
}
