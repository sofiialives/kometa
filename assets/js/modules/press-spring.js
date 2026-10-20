/**
 * Пружинное нажатие + световое пятно под пальцем (как стекло в visionOS / iOS).
 *  • Теги, карточки направлений, пункты меню и ссылки подвала при касании сжимаются до .96
 *    и возвращаются с лёгким «перелётом» (WAAPI на свойстве scale: не мешает transform/transition элемента).
 *  • На стеклянных элементах под пальцем проявляется мягкий блик (--gx/--gy), следует за пальцем.
 * Только pointer events + WAAPI: одинаково работает в iOS Safari и Chrome Android.
 * Кнопки с собственным «прессом» (крестики, стрелки, btn-*) из glass-close.js сжатие не получают — только блик.
 */
import { PRESS_SELECTOR } from './glass-close.js';

const SPRING = '.tag, .footer__link';        // карточки направлений не сжимаем: у них свой transform в карусели, сжатие давало рывок
const GLOW = '.card, .tag, .btn-send, .btn-dream, .btn-request';
const PRESS_TO = .96;
const CANCEL_MOVE = 10;

export function initPressSpring() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cur = null;    // { el, glow, x0, y0, anim, timer, pressed }

    const currentScale = (el) => {
        const s = getComputedStyle(el).scale;
        const v = parseFloat(s);
        return Number.isFinite(v) ? v : 1;
    };

    const glowOf = (el) => {
        let g = el.querySelector(':scope > .fx-glow');
        if (!g) {
            g = document.createElement('span');
            g.className = 'fx-glow';
            g.setAttribute('aria-hidden', 'true');
            el.append(g);
        }
        return g;
    };

    const place = (c, x, y) => {
        if (!c.glow) return;
        const r = c.glowEl.getBoundingClientRect();
        c.glow.style.setProperty('--gx', `${(x - r.left).toFixed(1)}px`);
        c.glow.style.setProperty('--gy', `${(y - r.top).toFixed(1)}px`);
    };

    const press = (c) => {
        if (!c.springEl || reduce.matches || c.pressed) return;
        c.pressed = true;
        c.anim?.cancel();
        c.anim = c.springEl.animate(
            [{ scale: String(currentScale(c.springEl)) }, { scale: String(PRESS_TO) }],
            { duration: c.mouse ? 210 : 150, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }
        );
    };

    const release = (c) => {
        clearTimeout(c.timer);
        c.glow?.classList.remove('is-on');
        if (!c.springEl || !c.pressed) { c.anim?.cancel(); return; }
        const el = c.springEl;
        const from = currentScale(el);
        c.anim?.cancel();
        const a = el.animate(
            [{ scale: String(from) }, { scale: '1.022', offset: .5 }, { scale: '1' }],
            { duration: c.mouse ? 620 : 440, easing: 'cubic-bezier(.25,.9,.3,1)' }
        );
        a.onfinish = a.oncancel = () => { el.style.removeProperty('scale'); };
        c.anim = a;
    };

    const end = () => { if (cur) { release(cur); cur = null; } };

    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const t = e.target instanceof Element ? e.target : null;
        if (!t || t.closest('.is-live')) return;          // живые плашки двигает физика — пресс-пружина и блик им только мешают
        end();
        const own = t.closest(PRESS_SELECTOR);                 // у кнопки свой пресс; сжимать карточку под ней не надо
        let springEl = own ? null : t.closest(SPRING);
        // inline-ссылка не масштабируется — сжимаем её блочного родителя
        if (springEl && getComputedStyle(springEl).display === 'inline') springEl = springEl.closest('li') || springEl.parentElement;
        const glowEl = t.closest(GLOW);
        if (!springEl && !glowEl) return;
        const c = { mouse: e.pointerType === 'mouse', springEl, glowEl, glow: null, x0: e.clientX, y0: e.clientY, anim: null, timer: 0, pressed: false };
        if (glowEl) {
            c.glow = glowOf(glowEl);
            const gr = glowEl.getBoundingClientRect();
            c.glow.style.setProperty('--gr', `${Math.max(56, Math.min(150, Math.min(gr.width, gr.height) * .9)).toFixed(0)}px`);
            place(c, e.clientX, e.clientY);
            c.glow.classList.add('is-on');
        }
        c.timer = setTimeout(() => press(c), 45);            // чтобы начало скролла не мигало сжатием
        cur = c;
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        if (!cur) return;
        if (Math.hypot(e.clientX - cur.x0, e.clientY - cur.y0) > CANCEL_MOVE && !cur.glowEl?.matches('.btn-send, .btn-dream, .btn-request')) {
            // палец уехал — это скролл/свайп карусели, не нажатие
            if (cur.springEl) { release(cur); cur.springEl = null; }
        }
        place(cur, e.clientX, e.clientY);
    }, { passive: true });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => document.addEventListener(n, end, { passive: true }));
    window.addEventListener('blur', end);

    initHover(glowOf);
}

/**
 * Наведение мышью (только десктоп): мягкий блик плавно «плывёт» за курсором с инерцией (lerp в rAF),
 * при уходе так же плавно гаснет. Касания не затрагивает — на телефоне всё как раньше.
 */
function initHover(glowOf) {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let h = null;           // { el, glow, x, y, tx, ty, r }
    let raf = 0;

    const loop = () => {
        raf = 0;
        if (!h) return;
        h.x += (h.tx - h.x) * .2;
        h.y += (h.ty - h.y) * .2;
        h.glow.style.setProperty('--gx', `${h.x.toFixed(1)}px`);
        h.glow.style.setProperty('--gy', `${h.y.toFixed(1)}px`);
        if (Math.abs(h.tx - h.x) + Math.abs(h.ty - h.y) > .3) raf = requestAnimationFrame(loop);
    };

    const leave = () => {
        if (!h) return;
        h.glow.classList.remove('is-hover');
        h = null;
    };

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const t = e.target instanceof Element && !e.target.closest('.is-live') ? e.target.closest(GLOW) : null;
        if (t !== h?.el) {
            leave();
            if (!t || t.disabled) return;
            const glow = glowOf(t);
            const r = t.getBoundingClientRect();
            glow.style.setProperty('--gr', `${Math.max(56, Math.min(150, Math.min(r.width, r.height) * .9)).toFixed(0)}px`);
            h = { el: t, glow, x: e.clientX - r.left, y: e.clientY - r.top, tx: 0, ty: 0 };
            glow.style.setProperty('--gx', `${h.x.toFixed(1)}px`);
            glow.style.setProperty('--gy', `${h.y.toFixed(1)}px`);
            glow.classList.add('is-hover');
        }
        if (!h) return;
        const r = h.el.getBoundingClientRect();
        h.tx = e.clientX - r.left;
        h.ty = e.clientY - r.top;
        if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
}
