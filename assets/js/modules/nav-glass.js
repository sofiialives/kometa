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

    // «зажатие» стёклышка пальцем/мышью (как у крестика): растёт, смещается за пальцем ≤ MAX и тянется вдоль движения
    const HOLD = 1.12;
    const MAXX = 16;
    const MAXY = 9;
    let pressLink = null;            // ссылка под пальцем: текст двигается вместе со стёклышком
    const lscale = () => 1 + (hp.s - 1) * .6;
    const clearPress = () => {
        if (pressLink) { pressLink.style.removeProperty('translate'); pressLink.style.removeProperty('scale'); pressLink = null; }
        Object.assign(hp, { s: 1, vs: 0, ox: 0, oy: 0, vx: 0, vy: 0, ts: 1, tx: 0, ty: 0 });
    };
    const hp = { s: 1, vs: 0, ox: 0, oy: 0, vx: 0, vy: 0, ts: 1, tx: 0, ty: 0, ks: 900, zs: .62 };

    const target = () => {
        if (!active) return null;
        const l = list.getBoundingClientRect();
        let r = active.a.getBoundingClientRect();
        if (pressLink === active.a) {                  // убираем собственное смещение/масштаб текста, иначе стёклышко погонится за ним
            const s = lscale();
            const w = r.width / s;
            const h = r.height / s;
            const cx = r.left + r.width / 2 - hp.ox;
            const cy = r.top + r.height / 2 - hp.oy;
            r = { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
        }
        if (!r.width || !l.width) return null;
        const cs = getComputedStyle(glass);
        const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;   // масштаб десктопа (1 на планшете/телефоне)
        const px = (parseFloat(cs.getPropertyValue('--px')) || 14) * k;
        const py = (parseFloat(cs.getPropertyValue('--py')) || 7) * k;
        return { x: r.left - l.left - px, y: r.top - l.top - py, w: r.width + px * 2, h: r.height + py * 2 };
    };

    const apply = () => {
        glass.style.width = `${sp.w.toFixed(2)}px`;
        glass.style.height = `${sp.h.toFixed(2)}px`;
        const q = Math.min(1, Math.hypot(hp.ox / MAXX, hp.oy / MAXY));
        const a = Math.atan2(hp.oy, hp.ox);
        const cx = Math.cos(a) ** 2;
        const cy = Math.sin(a) ** 2;
        const hold = Math.max(0, Math.min(1.2, (hp.s - 1) / (HOLD - 1)));
        glass.style.translate = `${(sp.x + hp.ox).toFixed(2)}px ${(sp.y + hp.oy).toFixed(2)}px`;
        glass.style.scale = `${((1 + .07 * sp.f) * hp.s * (1 + .10 * q * cx - .05 * q * cy)).toFixed(4)} ${((1 + .26 * sp.f) * hp.s * (1 + .10 * q * cy - .05 * q * cx)).toFixed(4)}`;
        glass.style.setProperty('--f', Math.max(sp.f, Math.min(1, hold * .8)).toFixed(3));
        if (pressLink) {
            pressLink.style.translate = `${hp.ox.toFixed(2)}px ${hp.oy.toFixed(2)}px`;
            pressLink.style.scale = lscale().toFixed(4);
        }
    };

    let prev = 0;
    const tick = (now) => {
        const t = target();
        if (!t) { glass.classList.remove('is-on'); shown = false; raf = 0; if (!held) clearPress(); return; }
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
        {
            let hl = Math.min(.032, (now - (prev || now)) / 1000) || .008;
            const cs = 2 * hp.zs * Math.sqrt(hp.ks);
            const co = 2 * .92 * Math.sqrt(520);
            while (hl > 0) {
                const h2 = Math.min(.004, hl);
                hl -= h2;
                hp.vs += (hp.ks * (hp.ts - hp.s) - cs * hp.vs) * h2; hp.s += hp.vs * h2;
                hp.vx += (520 * (hp.tx - hp.ox) - co * hp.vx) * h2; hp.ox += hp.vx * h2;
                hp.vy += (520 * (hp.ty - hp.oy) - co * hp.vy) * h2; hp.oy += hp.vy * h2;
            }
        }
        const speed = Math.hypot(sp.vx, sp.vy);
        const ft = reduce.matches ? 0 : Math.min(1, speed / 1100);
        sp.f += (ft - sp.f) * .22;
        apply();
        const rest = Math.abs(t.x - sp.x) < .1 && Math.abs(t.y - sp.y) < .1 && Math.abs(t.w - sp.w) < .1 && Math.abs(t.h - sp.h) < .1
            && speed < 2 && sp.f < .004
            && !held && Math.abs(hp.s - 1) < .001 && Math.abs(hp.ox) < .05 && Math.abs(hp.oy) < .05 && Math.abs(hp.vs) < .01;
        if (rest) { sp.f = 0; clearPress(); apply(); raf = 0; prev = 0; return; }
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
            lockUntil = performance.now() + 3000;          // держим выбранный пункт, пока идёт переход (снимет kometa:scrollend)
            setActive(item);
        });
    });
    // зажатие: стёклышко летит под палец, растёт и тянется за ним; текст остаётся на месте.
    // одинаково для мыши и пальца: стёклышко сразу летит под палец, растёт и тянется за ним.
    let held = null;
    let hpid = null;
    let hx = 0;
    let hy = 0;
    let armed = null;                 // { item, timer } — ждём подтверждения намерения (только касание)
    const engage = (item) => {
        if (pressLink && pressLink !== item.a) { pressLink.style.removeProperty('translate'); pressLink.style.removeProperty('scale'); }
        pressLink = item.a;
        held = item;
        lockUntil = performance.now() + 3000;
        setActive(item);                             // стёклышко летит под палец / курсор
        hp.ks = 900; hp.zs = .62;
        hp.ts = reduce.matches ? 1 : HOLD;
        hp.tx = 0; hp.ty = 0;
        run();
    };
    const disarm = () => { if (armed) { clearTimeout(armed.timer); armed = null; } };
    links.forEach((a) => {
        const item = items.find((i) => i.a === a);
        if (!item) return;
        a.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            hpid = e.pointerId;
            hx = sx0 = e.clientX;
            hy = sy0 = e.clientY;
            startLink = a;
            switched = false;
            disarm();
            moved = false;
            try { a.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }   // тянуть можно за пределы ссылки
            engage(item);
        });
        a.addEventListener('pointermove', (e) => {
            if (e.pointerId !== hpid || !held) return;
            if (Math.hypot(e.clientX - sx0, e.clientY - sy0) > 4) moved = true;
            if (reduce.matches) return;
            // тянем стёклышко на другой пункт: оно перелетает под палец, выбор — при отпускании
            const hit = hitItem(e.clientX, e.clientY);
            if (hit && hit !== held) {
                switched = true;
                hx = e.clientX;
                hy = e.clientY;
                engage(hit);
                return;
            }
            const dx = e.clientX - hx;
            const dy = e.clientY - hy;
            hp.tx = MAXX * Math.tanh(dx / (MAXX * 1.1));
            hp.ty = MAXY * Math.tanh(dy / (MAXY * 1.1));
            run();
        });
    });
    let moved = false;
    let sx0 = 0;
    let sy0 = 0;
    let startLink = null;
    let switched = false;
    let swallow = null;                // ссылка, чей ближайший клик поглощаем (отпустили не над ней)
    const hitItem = (x, y) => items.find((i) => {
        const r = i.a.getBoundingClientRect();
        return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 4 && y <= r.bottom + 4;
    });
    links.forEach((a) => {
        a.addEventListener('click', (e) => {
            if (swallow !== a) return;
            swallow = null;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
    });
    const letGo = (e, cancelled) => {
        if (e.pointerId !== hpid) return;
        disarm();
        if (!held) return;
        const r = held.a.getBoundingClientRect();
        const inside = e.clientX > r.left - 14 && e.clientX < r.right + 14 && e.clientY > r.top - 14 && e.clientY < r.bottom + 14;
        const chosen = !cancelled && switched && inside ? held : null;   // перетащили на другой пункт и отпустили над ним
        if (!cancelled && startLink && (chosen || (moved && !inside))) {
            swallow = startLink;                                          // родной клик по исходной ссылке не нужен
            setTimeout(() => { if (swallow === startLink) swallow = null; }, 400);
        }
        if (!cancelled && moved && !inside) setTimeout(() => { lockUntil = 0; spy(); }, 800);
        held = null;
        hpid = null;
        hp.ks = 1100; hp.zs = .38;                 // быстрый возврат с недолётом, как у крестика
        hp.ts = 1; hp.tx = 0; hp.ty = 0;
        setTimeout(() => { if (!held) { clearPress(); apply(); } }, 1800);   // страховка: текст обязательно возвращается на место
        if (cancelled && lockUntil) { setTimeout(() => { lockUntil = 0; spy(); }, 800); }   // жест забрал скролл — стёклышко возвращается к текущему разделу
        run();
        if (chosen) setTimeout(() => chosen.a.click(), 0);
    };
    window.addEventListener('pointerup', (e) => letGo(e, false));
    window.addEventListener('pointercancel', (e) => letGo(e, true));

    // после окончания программного скролла возвращаем управление споту
    window.addEventListener('kometa:scrollend', () => { lockUntil = 0; spy(); });

    // меню на мобилке открывается/закрывается — перечитываем позицию (список анимируется входом)
    const header = document.querySelector('.header');
    if (header) new MutationObserver(() => { shown = false; run(); }).observe(header, { attributes: true, attributeFilter: ['class'] });

    spy();
    // пока ссылки анимируются при открытии меню, цель двигается — держим цикл ещё немного
    const keep = () => { if (header?.classList.contains('is-open')) run(); };
    setInterval(keep, 120);
}
