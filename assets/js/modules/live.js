/**
 * «Живые» плашки «Персонального решения» + режим невесомости (только десктоп с мышью).
 * Невесомость: все теги страницы дрейфуют по всей странице, их можно хватать и бросать; при возврате физика отключается — плашки сразу и чётко встают на места, их можно хватать и бросать;
 * выключил — всё пружиной возвращается на место (рамки не обрезают, пока тела не легли).
 */
import { addBody, initPhysics, setZeroG, isZeroG, onBusy } from './physics.js';

export function initLive() {
    initPhysics();
    const root = document.documentElement;
    const personal = document.querySelector('.personal');
    const astro = document.querySelector('.astronaut');
    if (personal) personal.querySelectorAll('.tag').forEach((el) => addBody(el, { group: 'tags', boundsEl: personal }));

    onBusy((busy) => {
        // пока плашки двигаются, парящий космонавт за стеклом замирает: его кадры не перерисовывают размытый фон
        astro?.classList.toggle('is-frozen', busy);
        personal?.classList.toggle('is-busy', busy);
        if (!busy) { root.classList.remove('zg-return'); if (!isZeroG()) lift(false); }
    });

    // кнопку создаём всегда, а показывает её CSS только на широком экране с мышью/трекпадом (any-pointer: fine) —
    // так она появляется и после закрытия DevTools/изменения размера окна
    const desktop = window.matchMedia('(min-width: 1280px) and (any-hover: hover) and (any-pointer: fine)');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zg-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Режим невесомости');
    btn.dataset.tip = 'Режим невесомости';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)"/></svg>';
    document.body.append(btn);

    let extraAdded = false;
    const addExtras = () => {
        if (extraAdded) return;
        extraAdded = true;
        const W = document.documentElement.clientWidth;
        const seen = new Set();
        const take = (el, group) => {
            if (seen.has(el) || el.closest('.modal, .hero-static, [data-screens]')) return;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4 || r.left + r.width / 2 < 0 || r.left + r.width / 2 > W) return;
            seen.add(el);
            addBody(el, { group, zgOnly: true });
        };
        // теги направлений и любые другие плашки-теги (теги «Персонального решения» уже живые)
        document.querySelectorAll('.tag').forEach((el) => { if (!personal?.contains(el)) take(el, 'tags'); });
    };

    // плашки в невесомости летят по всей странице — всегда поверх соседних секций:
    // поднимаем предков каждой плашки (они образуют свои слои наложения), пока режим включён
    let lifted = [];
    const lift = (on) => {
        lifted.forEach((n) => n.classList.remove('zg-lift'));
        lifted = [];
        if (!on) return;
        const set = new Set();
        document.querySelectorAll('.tag').forEach((tag) => {
            for (let n = tag.parentElement; n && n !== document.body && n !== root; n = n.parentElement) set.add(n);
        });
        set.forEach((n) => n.classList.add('zg-lift'));
        lifted = [...set];
    };

    const set = (on) => {
        if (on === isZeroG()) return;
        btn.setAttribute('aria-pressed', String(on));
        if (on) {
            addExtras();
            root.classList.remove('zg-return');
            root.classList.add('zg-on');
        } else {
            root.classList.remove('zg-on');
            root.classList.add('zg-return');
        }
        if (on && !('showPopover' in HTMLElement.prototype)) lift(true);   // запасной вариант для старых браузеров
        setZeroG(on);
    };

    btn.addEventListener('click', () => set(!isZeroG()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isZeroG()) set(false); });
    desktop.addEventListener('change', (e) => { if (!e.matches) set(false); });
}
