/**
 * Стеклянный крестик — повтор поведения кнопки «закрыть» в Telegram (iOS), параметры сняты покадрово с видео:
 *  • зажатие: круг за ~0.12 с вырастает ×1.33 (с лёгким перелётом), заливка светлеет;
 *  • проводка: круг (и крестик вместе с ним) смещается лишь на ≤ 0.25 диаметра, насыщаясь, и деформируется:
 *    вытягивается вдоль движения (+15%) и сужается поперёк (−8%); сам крестик остаётся ровным;
 *  • отпускание: быстрый возврат (~0.12 с) с недолётом ниже исходного размера (~−10%), затем покой.
 * Если отпустить вне кнопки, закрытие не срабатывает. Работает на модалках, меню и бургере в открытом состоянии.
 */
// крестики и бургер: круг деформируется отдельным слоем (--sa/--sx/--sy), остальные кнопки — по осям
const LAYER = '.modal__close, .nav__close, .case__open';
const GENERIC = '.burger, .card__arrow, .btn-dream, .btn-request, .btn-send, .header__tg, .tg-corner, .crew__btn, .cmodal__nav';
const SELECTOR = `${LAYER}, ${GENERIC}`;
export const PRESS_SELECTOR = SELECTOR;   // эти кнопки уже имеют свой «пресс»: общий спринг их не трогает
const HOLD_SCALE = 1.33;
const GLYPH_SCALE = 1.04;    // крестик внутри растёт чуть больше круга
const MAX_OFF = .25;         // максимальное смещение, доля диаметра
const STRETCH = .15;         // вытяжка вдоль движения при максимальном смещении
const SQUEEZE = .08;         // сужение поперёк

export function initGlassClose() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const buttons = [...document.querySelectorAll(SELECTOR)];

    // большие кнопки не должны блокировать вертикальный скролл страницы: у них touch-action пропускает вертикаль
    const fitTouch = () => buttons.forEach((b) => {
        const r = b.getBoundingClientRect();
        b.style.touchAction = (r.width && Math.max(r.width, r.height) > 90) ? 'pan-y' : 'none';
    });
    fitTouch();
    window.addEventListener('resize', fitTouch);

    buttons.forEach((btn) => {
        const layered = btn.matches(LAYER);
        let baseT = 'none';
        let baseX = 0;                      // собственный translate кнопки (например, центрирование -50%/-50% у кнопки кейса)
        let baseY = 0;
        let hold = HOLD_SCALE;
        const readBase = () => {
            const cs = getComputedStyle(btn);
            baseT = cs.transform;
            const t = (cs.translate || 'none').split(/\s+/);
            const px = (v, size) => (v && v !== 'none' ? (v.endsWith('%') ? parseFloat(v) / 100 * size : parseFloat(v)) || 0 : 0);
            baseX = px(t[0], btn.offsetWidth);
            baseY = px(t[1] ?? '0', btn.offsetHeight);
        };
        readBase();
        // x, y — смещение; s — масштаб; движение к целям tx/ty/ts пружиной
        const st = { x: 0, y: 0, s: 1, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 1, kp: 520, zp: .92, ks: 900, zs: .62, raf: 0, last: 0, prev: 0 };
        let pid = null;
        let sx = 0;
        let sy = 0;
        let D = 40;
        let moved = false;
        let suppress = false;

        const offset = (d) => {
            const max = MAX_OFF * D;
            return max * Math.tanh(d / (max * 1.7));
        };

        const apply = () => {
            const m = Math.hypot(st.x, st.y);
            const q = Math.min(1, m / (MAX_OFF * D));
            const h = Math.max(0, Math.min(1.15, (st.s - 1) / (hold - 1)));
            btn.style.translate = `${(baseX + st.x).toFixed(2)}px ${(baseY + st.y).toFixed(2)}px`;
            if (layered) {
                btn.style.scale = st.s.toFixed(4);
            } else {
                // вытяжка по осям: вдоль движения тянем, поперёк сужаем
                const a = Math.atan2(st.y, st.x);
                const cx = Math.cos(a) ** 2;
                const cy = Math.sin(a) ** 2;
                const kx = 1 + STRETCH * q * cx - SQUEEZE * q * cy;
                const ky = 1 + STRETCH * q * cy - SQUEEZE * q * cx;
                btn.style.scale = `${(st.s * kx).toFixed(4)} ${(st.s * ky).toFixed(4)}`;
            }
            btn.style.setProperty('--h', h.toFixed(3));
            btn.style.setProperty('--q', q.toFixed(3));
            btn.style.setProperty('--sa', `${(Math.atan2(st.y, st.x) * 180 / Math.PI).toFixed(1)}deg`);
            btn.style.setProperty('--sx', (1 + STRETCH * q).toFixed(4));
            btn.style.setProperty('--sy', (1 - SQUEEZE * q).toFixed(4));
            btn.style.setProperty('--gs', (1 + (GLYPH_SCALE - 1) * Math.min(1, h)).toFixed(4));
        };

        const tick = (now) => {
            let left = st.prev ? Math.min(.032, (now - st.prev) / 1000) : .008;
            st.prev = now;
            while (left > 0) {
                const h = Math.min(.004, left);
                left -= h;
                const cp = 2 * st.zp * Math.sqrt(st.kp);
                const cs = 2 * st.zs * Math.sqrt(st.ks);
                st.vx += (st.kp * (st.tx - st.x) - cp * st.vx) * h; st.x += st.vx * h;
                st.vy += (st.kp * (st.ty - st.y) - cp * st.vy) * h; st.y += st.vy * h;
                st.vs += (st.ks * (st.ts - st.s) - cs * st.vs) * h; st.s += st.vs * h;
            }
            apply();
            const rest = pid === null && Math.abs(st.x) < .03 && Math.abs(st.y) < .03 && Math.abs(st.s - 1) < .0008
                && Math.abs(st.vx) < .05 && Math.abs(st.vy) < .05 && Math.abs(st.vs) < .01;
            if (rest) {
                st.raf = 0;
                st.x = st.y = st.vx = st.vy = st.vs = 0; st.s = 1;
                ['translate', 'scale', 'transform'].forEach((p) => btn.style.removeProperty(p));
                ['--h', '--q', '--sa', '--sx', '--sy', '--gs'].forEach((v) => btn.style.removeProperty(v));
                btn.classList.remove('is-held');
                return;
            }
            st.raf = requestAnimationFrame(tick);
        };
        const run = () => { if (!st.raf) { st.prev = 0; st.last = performance.now(); st.raf = requestAnimationFrame(tick); } };

        btn.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pid = e.pointerId;
            sx = e.clientX;
            sy = e.clientY;
            if (!btn.classList.contains('is-held')) readBase();
            const w = btn.offsetWidth || 40;
            const h = btn.offsetHeight || w;
            D = Math.min(w, h);
            hold = layered ? HOLD_SCALE : 1 + Math.min(.33, 26 / Math.max(w, h));
            btn.style.transform = baseT;               // перекрывает :active-трансформации, не ломая позицию кнопки
            moved = false;
            suppress = false;
            btn.classList.add('is-held');
            try { btn.setPointerCapture(pid); } catch (_) { /* noop */ }
            st.ks = 900; st.zs = .62;                 // нажатие: быстрый рост с лёгким перелётом
            st.tx = 0; st.ty = 0; st.ts = reduce.matches ? 1 : hold;
            run();
        });

        btn.addEventListener('pointermove', (e) => {
            if (e.pointerId !== pid) return;
            const dx = e.clientX - sx;
            const dy = e.clientY - sy;
            const d = Math.hypot(dx, dy);
            if (!moved && d > 4) moved = true;
            if (btn.closest('.is-dragging')) {            // жест забрала карусель — кнопка отпускается без клика
                suppress = true;
                try { btn.releasePointerCapture(pid); } catch (_) { /* noop */ }
                pid = null;
                st.tx = 0; st.ty = 0; st.ts = 1; st.ks = 1100; st.zs = .38;
                run();
                return;
            }
            if (reduce.matches || d < .01) return;
            const o = offset(d);
            st.tx = dx / d * o;
            st.ty = dy / d * o;
            run();
        });

        const release = (e, cancelled) => {
            if (e.pointerId !== pid) return;
            const r = btn.getBoundingClientRect();
            const cx = r.left + r.width / 2 - st.x;
            const cy = r.top + r.height / 2 - st.y;
            const inside = Math.hypot(e.clientX - cx, e.clientY - cy) <= D / 2 + 12;
            suppress = cancelled || (moved && !inside);
            try { btn.releasePointerCapture(pid); } catch (_) { /* noop */ }
            pid = null;
            st.tx = 0; st.ty = 0; st.ts = 1;
            st.ks = 1100; st.zs = .38;                // быстрый возврат с недолётом
            run();
        };
        btn.addEventListener('pointerup', (e) => release(e, false));
        btn.addEventListener('pointercancel', (e) => release(e, true));
        btn.addEventListener('lostpointercapture', () => {
            if (pid !== null) { pid = null; st.tx = 0; st.ty = 0; st.ts = 1; run(); }
        });

        // лист на мобилке закрывается свайпом вниз — пока тянем крестик, лист не трогаем
        btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        btn.addEventListener('contextmenu', (e) => e.preventDefault());

        btn.addEventListener('click', (e) => {
            if (suppress) { e.preventDefault(); e.stopImmediatePropagation(); suppress = false; }
        }, true);
    });
}
