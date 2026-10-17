/**
 * «Экипаж Комета» на мобилке: главная карточка + следующая ниже (полупрозрачная).
 * Смена — не «кадр за кадром», а плавное перетекание (FLIP, пружинная кривая как в iOS):
 * следующая поднимается и вырастает в главную, главная уходит вверх и растворяется,
 * новая «следующая» всплывает снизу. Назад — зеркально. Только кнопками-стрелками, жесты по карточкам не листают.
 */
const EASE = 'cubic-bezier(.32, .72, 0, 1)';
const DUR = 560;

export function initCrewSlider({ root, list, prev, next }) {
    if (!root || !list || !prev || !next) return null;

    const cards = [...list.children];
    if (cards.length < 2) return null;

    const mq = window.matchMedia('(max-width: 1279.98px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let busy = false;

    const setClasses = () => {
        cards.forEach((card, i) => {
            card.classList.toggle('is-active', i === index);
            card.classList.toggle('is-next', i === (index + 1) % cards.length);
        });
        root.setAttribute('aria-live', 'polite');
    };

    const clear = () => {
        cards.forEach((card) => card.classList.remove('is-active', 'is-next'));
        root.querySelectorAll('.is-leaving').forEach((n) => n.remove());
    };

    const rectOf = (el) => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null);

    const flip = (el, from, to, extra = {}) => {
        if (!el || !from || !to) return null;
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const sx = from.width / to.width;
        const sy = from.height / to.height;
        return el.animate([
            { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: extra.from ?? 1 },
            { transformOrigin: '0 0', transform: 'none', opacity: extra.to ?? 1 }
        ], { duration: DUR, easing: EASE });
    };

    const ghost = (card, rect, keyframes) => {
        const base = root.getBoundingClientRect();
        const g = card.cloneNode(true);
        g.classList.add('is-leaving');
        g.style.left = `${rect.left - base.left}px`;
        g.style.top = `${rect.top - base.top}px`;
        g.style.width = `${rect.width}px`;
        g.style.height = `${rect.height}px`;
        root.append(g);
        const a = g.animate(keyframes, { duration: DUR * 0.8, easing: EASE, fill: 'forwards' });
        a.onfinish = a.oncancel = () => g.remove();
    };

    const go = (step) => {
        if (!mq.matches || busy) return;
        const n = cards.length;
        const oldActive = cards[index];
        const oldNext = cards[(index + 1) % n];
        const rA = rectOf(oldActive);
        const rN = rectOf(oldNext);

        index = (index + step + n) % n;
        const newActive = cards[index];
        const newNext = cards[(index + 1) % n];

        if (reduce.matches || !rA) { setClasses(); return; }

        // уходящие карточки — призраки в прежних местах
        if (step > 0) {
            ghost(oldActive, rA, [
                { transform: 'none', opacity: 1 },
                { transform: 'translateY(-36px) scale(.94)', opacity: 0 }
            ]);
        } else if (rN) {
            ghost(oldNext, rN, [
                { transform: 'none', opacity: .5 },
                { transform: 'translateY(36px) scale(.94)', opacity: 0 }
            ]);
        }

        setClasses();

        const nA = rectOf(newActive);
        const nN = rectOf(newNext);
        busy = true;
        const anims = [];

        if (step > 0) {
            anims.push(flip(newActive, rN, nA, { from: .5, to: 1 }));                       // следующая → главная
            anims.push(newNext.animate([                                                     // новая «следующая» всплывает снизу
                { transform: 'translateY(40px) scale(.94)', opacity: 0 },
                { transform: 'none', opacity: .5 }
            ], { duration: DUR, easing: EASE }));
        } else {
            anims.push(newActive.animate([                                                   // новая главная приходит сверху
                { transform: 'translateY(-40px) scale(.94)', opacity: 0 },
                { transform: 'none', opacity: 1 }
            ], { duration: DUR, easing: EASE }));
            anims.push(flip(newNext, rA, nN, { from: 1, to: .5 }));                          // бывшая главная → следующая
        }

        Promise.allSettled(anims.filter(Boolean).map((a) => a.finished)).then(() => { busy = false; });
    };

    const apply = (mobile) => {
        if (mobile) setClasses();
        else clear();
    };

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));

    // смена карточек — только стрелками: свайп/прокрутка пальцем по карточкам ничего не переключает

    mq.addEventListener('change', (event) => apply(event.matches));
    apply(mq.matches);

    return { go };
}
