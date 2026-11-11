/**
 * «Экипаж Комета» на мобилке и планшете: горизонтальная карусель.
 * Главная карточка + следующая сбоку (полупрозрачная), снизу стрелки и точки.
 * Сдвиг ленты ведёт CSS (--crew-i), здесь — только индекс, активные классы, точки и свайп.
 * На десктопе карточки лежат сеткой 2×2, класс is-active там ничего не меняет.
 */
export function initCrewSlider({ root, list, prev, next }) {
    if (!root || !list || !prev || !next) return null;

    const cards = [...list.children];
    if (cards.length < 2) return null;
    const dots = [...root.querySelectorAll('[data-crew-dot]')];
    const n = cards.length;
    let index = 0;

    const render = () => {
        list.style.setProperty('--crew-i', index);
        cards.forEach((card, i) => {
            card.classList.toggle('is-active', i === index);
            card.classList.toggle('is-before', i < index);
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('is-active', i === index);
            dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
        root.setAttribute('aria-live', 'polite');
    };

    const go = (step) => {
        index = (index + step + n) % n;
        render();
    };

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => { index = i; render(); }));

    // свайп: лента идёт за пальцем, на отпускании прилипает к ближайшей карточке; на краях не зацикливаем
    let x0 = null;
    let y0 = 0;
    let t0 = 0;
    let dragging = false;
    const step = () => (cards[1].offsetLeft - cards[0].offsetLeft) || cards[0].offsetWidth;

    list.addEventListener('touchstart', (e) => {
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
        t0 = e.timeStamp;
        dragging = false;
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
        if (x0 === null) return;
        const dx = e.touches[0].clientX - x0;
        const dy = e.touches[0].clientY - y0;
        if (!dragging) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
            dragging = true;
            list.classList.add('is-dragging');
        }
        // на краях — упругое сопротивление
        const atEdge = (index === 0 && dx > 0) || (index === n - 1 && dx < 0);
        list.style.setProperty('--crew-drag', `${atEdge ? dx * 0.3 : dx}px`);
    }, { passive: true });

    const finish = (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const speed = Math.abs(dx) / Math.max(1, e.timeStamp - t0);
        x0 = null;
        if (!dragging) return;
        dragging = false;
        list.classList.remove('is-dragging');
        list.style.removeProperty('--crew-drag');
        if (Math.abs(dx) > step() * 0.22 || speed > 0.45) {
            const to = Math.min(n - 1, Math.max(0, index + (dx < 0 ? 1 : -1)));
            index = to;
        }
        render();
    };
    list.addEventListener('touchend', finish, { passive: true });
    list.addEventListener('touchcancel', finish, { passive: true });

    render();
    return { go };
}
