/**
 * Стеклянная «линза» в навигации (как индикатор вкладки в Telegram / iOS):
 * держится под текущим разделом, при смене пункта летит к новому, на ходу вздувается
 * (выше/шире, светлее, цветные кромки по краям), затем пружинно оседает.
 * Работает в десктопной шапке и в мобильном меню — это один и тот же список ссылок.
 */
export function initNavGlass({ root = document } = {}) {
    const list = root.querySelector('.nav__list');
    if (!list) return;
    const links = [...list.querySelectorAll('a[href^="#"]')];
    const items = links
        .map((a) => ({ a, id: a.getAttribute('href').slice(1), el: document.getElementById(a.getAttribute('href').slice(1)) }))
        .filter((i) => i.el);
    if (!items.length) return;

    const glass = document.createElement('span');
    glass.className = 'nav__glass';
    glass.setAttribute('aria-hidden', 'true');
    list.prepend(glass);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = null;            // текущий пункт
    let lockUntil = 0;            // после клика не даём скролл-споту перебивать цель
    let raf = 0;
    let shown = false;

    // пружины по левому/верхнему краю, ширине и высоте + «вздутие» f
    const sp = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, f: 0 };
    const K = 420;
    const Z = .7;

    const target = () => {
        if (!active) return null;
        const l = list.getBoundingClientRect();
        const r = active.a.getBoundingClientRect();
        if (!r.width || !l.width) return null;
        const cs = getComputedStyle(glass);
        const px = parseFloat(cs.getPropertyValue('--px')) || 14;
        const py = parseFloat(cs.getPropertyValue('--py')) || 7;
        return { x: r.left - l.left - px, y: r.top - l.top - py, w: r.width + px * 2, h: r.height + py * 2 };
    };

    const apply = () => {
        glass.style.width = `${sp.w.toFixed(2)}px`;
        glass.style.height = `${sp.h.toFixed(2)}px`;
        glass.style.translate = `${sp.x.toFixed(2)}px ${sp.y.toFixed(2)}px`;
        glass.style.scale = `${(1 + .07 * sp.f).toFixed(4)} ${(1 + .26 * sp.f).toFixed(4)}`;
        glass.style.setProperty('--f', sp.f.toFixed(3));
    };

    let prev = 0;
    const tick = (now) => {
        const t = target();
        if (!t) { glass.classList.remove('is-on'); shown = false; raf = 0; return; }
        if (!shown) {                                   // первое появление — без полёта
            Object.assign(sp, { x: t.x, y: t.y, w: t.w, h: t.h, vx: 0, vy: 0, vw: 0, vh: 0, f: 0 });
            shown = true;
            apply();
            glass.classList.add('is-on');
        }
        let left = prev ? Math.min(.032, (now - prev) / 1000) : .008;
        prev = now;
        const c = 2 * Z * Math.sqrt(K);
        while (left > 0) {
            const h = Math.min(.004, left);
            left -= h;
            for (const [p, v, k] of [['x', 'vx', 'x'], ['y', 'vy', 'y'], ['w', 'vw', 'w'], ['h', 'vh', 'h']]) {
                sp[v] += (K * (t[k] - sp[p]) - c * sp[v]) * h;
                sp[p] += sp[v] * h;
            }
        }
        const speed = Math.hypot(sp.vx, sp.vy);
        const ft = reduce.matches ? 0 : Math.min(1, speed / 1100);
        sp.f += (ft - sp.f) * .22;
        apply();
        const rest = Math.abs(t.x - sp.x) < .1 && Math.abs(t.y - sp.y) < .1 && Math.abs(t.w - sp.w) < .1 && Math.abs(t.h - sp.h) < .1
            && speed < 2 && sp.f < .004;
        if (rest) { sp.f = 0; apply(); raf = 0; prev = 0; return; }
        raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } };

    const setActive = (item) => {
        if (item === active) return;
        active = item;
        links.forEach((a) => a.classList.toggle('is-current', !!item && a === item.a));
        if (!item) { glass.classList.remove('is-on'); shown = false; return; }
        run();
    };

    // скролл-спот: активен последний раздел, верх которого выше 40% окна
    const spy = () => {
        if (performance.now() < lockUntil) return;
        const line = innerHeight * .4;
        let cur = null;
        items.forEach((i) => { if (i.el.getBoundingClientRect().top <= line) cur = i; });
        setActive(cur);
    };
    let spyFrame = 0;
    window.addEventListener('scroll', () => {
        if (!spyFrame) spyFrame = requestAnimationFrame(() => { spyFrame = 0; spy(); });
    }, { passive: true });
    window.addEventListener('resize', () => { shown = false; run(); });

    links.forEach((a) => {
        a.addEventListener('click', () => {
            const item = items.find((i) => i.a === a);
            if (!item) return;
            lockUntil = performance.now() + 1400;
            setActive(item);
        });
    });
    // после окончания программного скролла возвращаем управление споту
    window.addEventListener('scrollend', () => { lockUntil = 0; spy(); });

    // меню на мобилке открывается/закрывается — перечитываем позицию (список анимируется входом)
    const header = document.querySelector('.header');
    if (header) new MutationObserver(() => { shown = false; run(); }).observe(header, { attributes: true, attributeFilter: ['class'] });

    spy();
    // пока ссылки анимируются при открытии меню, цель двигается — держим цикл ещё немного
    const keep = () => { if (header?.classList.contains('is-open')) run(); };
    setInterval(keep, 120);
}
