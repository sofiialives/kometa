/**
 * Карусель направлений (телефон/планшет): собственный «пейджер» без нативного скролла и scroll-snap.
 * Нативный снап на разных устройствах ведёт себя по-разному (iOS, Android, Firefox), поэтому положение — одно число `pos`
 * (в карточках), палец/мышь двигают его напрямую, на отпускание — критически затухающая пружина к целой карточке.
 * Вся визуальная часть — только transform/opacity (GPU), без чтения геометрии на кадр.
 * Карточка вёрстается в «главном» размере (257×317), боковые — scale 0.70/0.73;
 * соседи справа сдвигаются на накопленное «лишнее» место главной карточки.
 */
const EXTRA = 77;           // главная шире боковой: 257 − 180
const SIDE_SX = 180 / 257;
const SIDE_SY = 231 / 317;

export function initCarousel({ track, progress }) {
    if (!track || !progress) return;

    const cards = [...track.children].filter((n) => n.classList.contains('card'));
    const phone = window.matchMedia('(max-width: 1279.98px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    track.classList.remove('sdt');

    let pitchPx = 192;      // шаг между карточками
    let maxPos = cards.length - 1;
    let pos = 0;            // текущее положение в карточках (может на миг выходить за 0..maxPos — «резинка»)
    let vel = 0;            // скорость, карточек/с
    let target = 0;
    let anim = 0;
    let drag = null;
    let blockClick = false;
    let wheelLocked = false;
    let lastWheel = 0;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const curIdx = () => clamp(Math.round(pos), 0, Math.round(maxPos));

    const reset = () => {
        cards.forEach((card) => {
            card.style.removeProperty('transform');
            card.style.removeProperty('opacity');
            card.style.removeProperty('--o');
            card._tr = card._op = null;
            card.classList.remove('is-current');
        });
        track.classList.remove('has-current');
    };

    function render() {
        const value = maxPos > 0 ? clamp(pos / maxPos, 0, 1) : 0;
        progress.style.setProperty('--progress', value.toFixed(3));
        if (!phone.matches) return;

        const scrollable = maxPos > 0.01;
        track.classList.toggle('has-current', scrollable);
        const u = scrollable ? clamp(pos, 0, maxPos) : 0;
        const pan = scrollable ? -pos * pitchPx : 0;
        let shift = 0;
        let nearest = 0;
        let best = Infinity;
        cards.forEach((card, i) => {
            const d = Math.abs(u - i);
            const t = scrollable || i === 0 ? Math.max(0, 1 - d) : 0;
            const sx = SIDE_SX + (1 - SIDE_SX) * t;
            const sy = SIDE_SY + (1 - SIDE_SY) * t;
            const tr = `translate3d(${(shift + pan).toFixed(2)}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
            const op = (.5 + .5 * t).toFixed(2);
            if (card._tr !== tr) { card._tr = tr; card.style.transform = tr; }       // не пишем в DOM то, что не изменилось
            if (card._op !== op) { card._op = op; card.style.opacity = op; }          // прозрачность плавно вместе с масштабом, а не щелчком на середине
            shift += EXTRA * t;
            if (d < best) { best = d; nearest = i; }
        });
        if (scrollable) cards.forEach((card, i) => card.classList.toggle('is-current', i === nearest));
    }

    function measure() {
        pitchPx = parseFloat(getComputedStyle(track).getPropertyValue('--pitch')) || 192;
        if (!phone.matches) { maxPos = 0; return; }
        // сколько реально можно «пролистать»: измеряем при снятых трансформах и нулевом скролле
        const keep = cards.map((c) => c.style.transform);
        cards.forEach((c) => { c.style.transform = 'none'; c._tr = null; });
        track.scrollLeft = 0;
        const room = track.scrollWidth - track.clientWidth;
        cards.forEach((c, i) => { c.style.transform = keep[i]; c._tr = keep[i]; });
        maxPos = clamp(room / pitchPx, 0, cards.length - 1);
        if (room < 1) maxPos = 0;
        if (maxPos > cards.length - 1.001) maxPos = cards.length - 1;
        pos = clamp(pos, 0, maxPos);
        target = clamp(Math.round(pos), 0, Math.floor(maxPos + 1e-6));
    }

    // ---- анимация доезжания: критически затухающая пружина (без перелёта), стартует с текущей скоростью пальца ----
    const stopAnim = () => {
        if (anim) { cancelAnimationFrame(anim); anim = 0; }
        track.classList.remove('is-gliding');
    };

    function settleTo(idx, v0 = 0) {
        stopAnim();
        target = clamp(idx, 0, Math.floor(maxPos + 1e-6));
        if (reduce.matches) { pos = target; vel = 0; render(); return; }
        vel = v0;
        const W = 13;                                            // жёсткость: ~0.45 с до посадки
        let last = performance.now();
        track.classList.add('is-gliding');
        const step = (now) => {
            let dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
            last = now;
            while (dt > 0) {                                     // подшаги — устойчиво на медленных кадрах
                const h = Math.min(dt, 1 / 120);
                dt -= h;
                const x = pos - target;
                vel += (-W * W * x - 2 * W * vel) * h;
                pos += vel * h;
            }
            if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.02) {
                pos = target; vel = 0; anim = 0;
                track.classList.remove('is-gliding');
                render();
                return;
            }
            render();
            anim = requestAnimationFrame(step);
        };
        anim = requestAnimationFrame(step);
    }
    const goIdx = (i) => settleTo(i);

    // ---- жест: палец / мышь / перо. Вертикаль отдаём странице (touch-action: pan-y) ----
    const rubber = (p) => {
        if (p < 0) return p * 0.32;
        if (p > maxPos) return maxPos + (p - maxPos) * 0.32;
        return p;
    };

    track.addEventListener('pointerdown', (e) => {
        if (!phone.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (maxPos <= 0) { measure(); render(); if (maxPos <= 0) return; }   // секция могла быть скрыта в момент инициализации
        stopAnim();
        blockClick = false;
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: pos, mode: null, pts: [{ x: e.clientX, t: performance.now() }], start: curIdx() };
    });

    track.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        if (!drag.mode) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dx) > Math.abs(dy) * 1.1) {
                drag.mode = 'x';
                blockClick = true;
                track.classList.add('is-dragging');
                try { track.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            } else { drag = null; return; }                       // вертикальный жест — это скролл страницы
        }
        // «позиция до жеста» берём заново после перехвата, чтобы не было скачка на пороге
        pos = rubber(drag.pos0 - dx / pitchPx);
        const now = performance.now();
        drag.pts.push({ x: e.clientX, t: now });
        while (drag.pts.length > 2 && now - drag.pts[0].t > 120) drag.pts.shift();
        if (!anim) { if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (drag) drag.raf = 0; render(); }); }
        e.preventDefault?.();
    }, { passive: false });

    const endDrag = (cancelled) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (d.raf) cancelAnimationFrame(d.raf);
        track.classList.remove('is-dragging');
        if (d.mode !== 'x') return;
        const first = d.pts[0];
        const last = d.pts[d.pts.length - 1];
        const v = (first.x - last.x) / Math.max(16, last.t - first.t);      // px/мс, >0 — вперёд
        const vCards = (v * 1000) / pitchPx;                                  // карточек/с
        const moved = pos - d.pos0;
        let idx = Math.round(pos);
        if (!cancelled && (Math.abs(vCards) > 0.9 || Math.abs(moved) > 0.18)) {
            const dir = Math.abs(vCards) > 0.9 ? Math.sign(vCards) : Math.sign(moved);
            idx = d.start + dir;
        }
        idx = clamp(idx, d.start - 1, d.start + 1);
        settleTo(idx, clamp(vCards * 0.35, -6, 6));
    };
    track.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) endDrag(false); });
    track.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) endDrag(true); });
    track.addEventListener('dragstart', (e) => e.preventDefault());

    // ---- клик: после перетаскивания — не клик; по боковой карточке — в центр ----
    track.addEventListener('click', (e) => {
        if (blockClick) { e.preventDefault(); e.stopPropagation(); blockClick = false; return; }
        if (!phone.matches || maxPos <= 0) return;
        const card = e.target.closest('.card');
        if (!card) return;
        const i = cards.indexOf(card);
        if (i < 0 || i === curIdx()) return;
        e.preventDefault();
        e.stopPropagation();
        goIdx(i);
    }, true);

    // ---- клавиши, горизонтальное колесо/тачпад, фокус внутри карточки ----
    track.addEventListener('keydown', (e) => {
        if (!phone.matches || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault();
        goIdx(curIdx() + (e.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('wheel', (e) => {
        if (!phone.matches || maxPos <= 0) return;
        const ax = Math.abs(e.deltaX);
        const ay = Math.abs(e.deltaY);
        if (!(ax > ay || e.shiftKey)) return;                         // вертикальную прокрутку страницы не трогаем
        e.preventDefault();
        const delta = ax > ay ? e.deltaX : e.deltaY;
        const gap = e.timeStamp - lastWheel;
        lastWheel = e.timeStamp;
        if (wheelLocked && !anim && gap > 110) wheelLocked = false;
        if (wheelLocked || Math.abs(delta) < 3) return;
        wheelLocked = true;
        goIdx(curIdx() + (delta > 0 ? 1 : -1));
    }, { passive: false });
    // браузер сам «прокручивает к фокусу» (Tab) — переводим это в наш переход и возвращаем нативный скролл в ноль
    track.addEventListener('scroll', () => { if (track.scrollLeft !== 0) track.scrollLeft = 0; }, { passive: true });
    track.addEventListener('focusin', (e) => {
        if (!phone.matches || maxPos <= 0) return;
        const card = e.target.closest?.('.card');
        const i = card ? cards.indexOf(card) : -1;
        if (i >= 0 && i !== curIdx()) goIdx(i);
    });

    const syncPager = () => {
        track.classList.toggle('js-pager', phone.matches);
        stopAnim();
        if (!phone.matches) { pos = 0; vel = 0; reset(); } else { measure(); render(); }
    };
    phone.addEventListener?.('change', syncPager);
    let rt = 0;
    window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => { if (!anim && !drag) { measure(); pos = Math.round(pos); render(); } }, 120);
    });
    window.addEventListener('orientationchange', () => setTimeout(() => { measure(); render(); }, 200));

    // размеры секции меняются (появилась после интро, подгрузились шрифты, повернули экран) — перемеряем, когда карусель в покое
    if ('ResizeObserver' in window) {
        let ro = 0;
        new ResizeObserver(() => {
            clearTimeout(ro);
            ro = setTimeout(() => { if (!anim && !drag && phone.matches) { measure(); render(); } }, 80);
        }).observe(track);
    }

    syncPager();
}
