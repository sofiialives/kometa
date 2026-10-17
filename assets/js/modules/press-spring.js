/**
 * Пружинное нажатие + световое пятно под пальцем (как стекло в visionOS / iOS).
 *  • Теги, карточки направлений, пункты меню и ссылки подвала при касании сжимаются до .96
 *    и возвращаются с лёгким «перелётом» (WAAPI на свойстве scale: не мешает transform/transition элемента).
 *  • На стеклянных элементах под пальцем проявляется мягкий блик (--gx/--gy), следует за пальцем.
 * Только pointer events + WAAPI: одинаково работает в iOS Safari и Chrome Android.
 * Кнопки с собственным «прессом» (крестики, стрелки, btn-*) из glass-close.js сжатие не получают — только блик.
 */
import { PRESS_SELECTOR } from './glass-close.js';

const SPRING = '.card, .tag, .footer__link';
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
            { duration: 150, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }
        );
    };

    const release = (c) => {
        clearTimeout(c.timer);
        c.glow?.classList.remove('is-on');
        if (!c.springEl || !c.pressed) { c.anim?.cancel(); return; }
        const from = currentScale(c.springEl);
        c.anim?.cancel();
        const a = c.springEl.animate(
            [{ scale: String(from) }, { scale: '1.022', offset: .5 }, { scale: '1' }],
            { duration: 440, easing: 'ease-out' }
        );
        a.onfinish = a.oncancel = () => { c.springEl.style.removeProperty('scale'); };
        c.anim = a;
    };

    const end = () => { if (cur) { release(cur); cur = null; } };

    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const t = e.target instanceof Element ? e.target : null;
        if (!t) return;
        end();
        const own = t.closest(PRESS_SELECTOR);                 // у кнопки свой пресс; сжимать карточку под ней не надо
        let springEl = own ? null : t.closest(SPRING);
        // inline-ссылка не масштабируется — сжимаем её блочного родителя
        if (springEl && getComputedStyle(springEl).display === 'inline') springEl = springEl.closest('li') || springEl.parentElement;
        const glowEl = t.closest(GLOW);
        if (!springEl && !glowEl) return;
        const c = { springEl, glowEl, glow: null, x0: e.clientX, y0: e.clientY, anim: null, timer: 0, pressed: false };
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
}
