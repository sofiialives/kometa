/**
 * «Экипаж Комета» на мобилке и планшете: бесконечная карусель.
 * Главная карточка по центру, слева и справа — соседние (меньше и приглушены), снизу стрелки и точки.
 * Позицию каждой карточки задаёт CSS через --p (−1, 0, 1) и --a (модуль), здесь — индекс, классы, точки и свайп.
 * На десктопе карточки лежат сеткой 2×2, переменные там ничего не меняют.
 */
export function initCrewSlider({ root, list, prev, next }) {
    if (!root || !list || !prev || !next) return null;

    const cards = [...list.children];
    if (cards.length < 2) return null;
    const dots = [...root.querySelectorAll('[data-crew-dot]')];
    const n = cards.length;
    let index = 0;
    const lastRel = new Array(n).fill(null);

    // смещение карточки относительно текущей по кругу: −2…1 при n = 4
    const rel = (i) => {
        const half = Math.floor(n / 2);
        return ((i - index + n + half) % n) - half;
    };

    const render = () => {
        cards.forEach((card, i) => {
            const r = rel(i);
            const far = Math.abs(r) > 1;
            // карточка, перелетающая с одного края на другой, не должна проезжать через экран
            const jump = lastRel[i] !== null && Math.abs(r - lastRel[i]) > 2;
            if (jump) card.classList.add('is-jump');
            card.style.setProperty('--p', far ? Math.sign(r) * 2 : r);
            card.style.setProperty('--a', far ? 1 : Math.abs(r));
            card.classList.toggle('is-active', r === 0);
            card.classList.toggle('is-far', far);
            card.toggleAttribute('inert', r !== 0);
            if (jump) requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('is-jump')));
            lastRel[i] = r;
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

    // свайп: карточки идут за пальцем, на отпускании встают на место
    let x0 = null;
    let y0 = 0;
    let t0 = 0;
    let dragging = false;
    const step = () => cards[0].offsetWidth * 0.96;

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
        list.style.setProperty('--crew-drag', `${dx}px`);
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
        if (Math.abs(dx) > step() * 0.22 || speed > 0.45) go(dx < 0 ? 1 : -1);
        else render();
    };
    list.addEventListener('touchend', finish, { passive: true });
    list.addEventListener('touchcancel', finish, { passive: true });

    render();
    return { go };
}
