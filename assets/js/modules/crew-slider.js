export function initCrewSlider({ root, list, prev, next }) {
    if (!root || !list || !prev || !next) return null;

    const cards = [...list.children];
    if (cards.length < 2) return null;

    const mq = window.matchMedia('(max-width: 1023.98px)');
    let index = 0;

    const render = () => {
        cards.forEach((card, i) => {
            card.classList.toggle('is-active', i === index);
            card.classList.toggle('is-next', i === (index + 1) % cards.length);
        });
        root.setAttribute('aria-live', 'polite');
    };

    const clear = () => {
        cards.forEach((card) => card.classList.remove('is-active', 'is-next'));
    };

    const go = (step) => {
        index = (index + step + cards.length) % cards.length;
        render();
    };

    const apply = (mobile) => {
        if (mobile) render();
        else clear();
    };

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));

    let touchY = 0;

    root.addEventListener('touchstart', (event) => {
        touchY = event.changedTouches[0].clientY;
    }, { passive: true });

    root.addEventListener('touchend', (event) => {
        if (!mq.matches) return;
        const delta = event.changedTouches[0].clientY - touchY;
        if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
    }, { passive: true });

    mq.addEventListener('change', (event) => apply(event.matches));
    apply(mq.matches);

    return { go };
}
