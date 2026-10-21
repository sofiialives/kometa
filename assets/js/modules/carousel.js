/**
 * Карусель направлений: вся анимация — только transform/opacity (GPU), без перекладки.
 * Карточка вёрстается в «главном» размере (257×317), боковые — scale 0.70/0.73;
 * соседи справа сдвигаются на накопленное «лишнее» место главной карточки.
 */
const EXTRA = 77;           // главная шире боковой: 257 − 180
const SIDE_SX = 180 / 257;
const SIDE_SY = 231 / 317;

export function initCarousel({ track, progress }) {
    if (!track || !progress) return;

    const cards = [...track.children];
    cards.forEach((_, i) => {
        const m = document.createElement('i');
        m.className = 'dir-snap';
        m.setAttribute('aria-hidden', 'true');
        m.style.setProperty('--i', i);
        track.appendChild(m);
    });
    const phone = window.matchMedia('(max-width: 1279.98px)');
    // Масштаб/сдвиг карточек считаем сами (чистая функция от scrollLeft): одинаково во всех браузерах,
    // состояние покоя всегда ровно по центру. CSS scroll-driven animations не используем.
    const native = false;
    track.classList.remove('sdt');
    let frame = 0;
    let pitchPx = 192;

    const measure = () => {
        pitchPx = parseFloat(getComputedStyle(track).getPropertyValue('--pitch')) || 192;
    };

    const reset = () => {
        cards.forEach((card) => {
            card.style.removeProperty('transform');
            card.style.removeProperty('opacity');
            card.style.removeProperty('--o');
        });
    };

    const update = () => {
        frame = 0;
        const max = track.scrollWidth - track.clientWidth;
        const value = max > 0 ? track.scrollLeft / max : 0;
        progress.style.setProperty('--progress', value.toFixed(3));

        if (!phone.matches) { reset(); return; }

        const scrollable = max > 1;
        track.classList.toggle('has-current', scrollable);
        const u = scrollable ? Math.min(Math.max(track.scrollLeft / pitchPx, 0), cards.length - 1) : 0;

        if (native) {
            let near = 0;
            let bestD = Infinity;
            cards.forEach((card, i) => { const d = Math.abs(u - i); if (d < bestD) { bestD = d; near = i; } });
            if (scrollable) cards.forEach((card, i) => card.classList.toggle('is-current', i === near));
            return;
        }

        let shift = 0;
        let nearest = 0;
        let best = Infinity;

        cards.forEach((card, i) => {
            const d = Math.abs(u - i);
            const t = scrollable || i === 0 ? Math.max(0, 1 - d) : 0;
            const sx = SIDE_SX + (1 - SIDE_SX) * t;
            const sy = SIDE_SY + (1 - SIDE_SY) * t;
            card.style.transform = `translate3d(${shift.toFixed(2)}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
            card.style.setProperty('--o', (.5 + .5 * t).toFixed(3));
            shift += EXTRA * t;
            if (d < best) { best = d; nearest = i; }
        });

        if (scrollable) cards.forEach((card, i) => card.classList.toggle('is-current', i === nearest));
    };

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { measure(); schedule(); });
    measure();
    update();

    // ---- листание (механика как в референсе, но плавнее) ----
    //  • тач: нативный scroll-snap (x mandatory + stop: always) — палец и инерция системные, одна карточка за жест;
    //  • мышь: перетаскивание (drag-to-scroll), снап на время жеста выключен, на отпускание — плавное доезжание к центру;
    //  • клик по боковой карточке — она плавно встаёт в центр; клавиши ← → листают;
    //  • программное доезжание — своя кривая по времени (мягкий старт и финиш), а не резкий browser smooth.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);   // easeInOutCubic
    let anim = 0;
    let drag = null;
    let blockClick = false;
    let wheelLocked = false;
    let lastWheel = 0;

    const syncPager = () => track.classList.toggle('js-pager', phone.matches);
    syncPager();
    phone.addEventListener?.('change', syncPager);

    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const clampIdx = (i) => Math.max(0, Math.min(cards.length - 1, i));
    const curIdx = () => clampIdx(Math.round(track.scrollLeft / pitchPx));
    const stopAnim = () => {
        if (anim) { cancelAnimationFrame(anim); anim = 0; }
        track.classList.remove('is-gliding');
    };

    function glideTo(target) {
        stopAnim();
        const from = track.scrollLeft;
        const dist = target - from;
        if (Math.abs(dist) < 1 || reduce.matches) { track.scrollLeft = target; update(); return; }
        const dur = Math.min(1050, Math.max(560, 480 + Math.abs(dist) * 1.7));
        const t0 = performance.now();
        track.classList.add('is-gliding');                          // на время анимации нативный снап не вмешивается
        const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            track.scrollLeft = k < 1 ? from + dist * ease(k) : target;
            if (k < 1) anim = requestAnimationFrame(step);
            else { anim = 0; track.classList.remove('is-gliding'); }
        };
        anim = requestAnimationFrame(step);
    }
    const goIdx = (i) => glideTo(Math.min(maxScroll(), clampIdx(i) * pitchPx));

    // ---- мышь: drag-to-scroll ----
    track.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || !phone.matches) return;
        stopAnim();
        blockClick = false;
        drag = { x0: e.clientX, startScroll: track.scrollLeft, active: false, pts: [{ x: e.clientX, t: performance.now() }], id: e.pointerId };
    });
    track.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x0;
        if (!drag.active) {
            if (Math.abs(dx) < 5) return;
            drag.active = true;
            blockClick = true;
            track.classList.add('is-dragging');
            try { track.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        }
        track.scrollLeft = drag.startScroll - dx;
        drag.pts.push({ x: e.clientX, t: performance.now() });
        if (drag.pts.length > 10) drag.pts.shift();
    });
    const endDrag = (cancelled) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        track.classList.remove('is-dragging');
        if (!d.active) return;
        const last = d.pts[d.pts.length - 1];
        const first = d.pts.find((p) => last.t - p.t <= 90) || d.pts[0];
        const v = (first.x - last.x) / Math.max(1, last.t - first.t);      // px/мс, >0 — листаем вперёд
        const start = clampIdx(Math.round(d.startScroll / pitchPx));
        let idx = curIdx();
        const moved = d.startScroll - track.scrollLeft;
        if (!cancelled && (Math.abs(v) > .25 || Math.abs(moved) > pitchPx * .16)) idx = start + (v > .05 || (Math.abs(v) <= .05 && moved < 0) ? 1 : -1);
        goIdx(Math.max(start - 1, Math.min(start + 1, idx)));
    };
    track.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) endDrag(false); });
    track.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) endDrag(true); });
    track.addEventListener('dragstart', (e) => e.preventDefault());

    // ---- клик: после перетаскивания — не клик; по боковой карточке — в центр ----
    track.addEventListener('click', (e) => {
        if (blockClick) { e.preventDefault(); e.stopPropagation(); blockClick = false; return; }
        if (!phone.matches) return;
        const card = e.target.closest('.card');
        if (!card) return;
        const i = cards.indexOf(card);
        if (i < 0 || i === curIdx()) return;
        e.preventDefault();
        e.stopPropagation();
        goIdx(i);
    }, true);

    // ---- клавиши и горизонтальное колесо/тачпад: одна карточка за жест ----
    track.addEventListener('keydown', (e) => {
        if (!phone.matches || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault();
        goIdx(curIdx() + (e.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('wheel', (e) => {
        if (!phone.matches) return;
        const ax = Math.abs(e.deltaX);
        const ay = Math.abs(e.deltaY);
        if (!(ax > ay || e.shiftKey)) return;                         // вертикальная прокрутка страницы не трогаем
        e.preventDefault();
        const delta = ax > ay ? e.deltaX : e.deltaY;
        const gap = e.timeStamp - lastWheel;
        lastWheel = e.timeStamp;
        if (wheelLocked && !anim && gap > 110) wheelLocked = false;
        if (wheelLocked || Math.abs(delta) < 3) return;
        wheelLocked = true;
        goIdx(curIdx() + (delta > 0 ? 1 : -1));
    }, { passive: false });

    // нативный жест пальцем начался — наша анимация (если шла) уступает
    track.addEventListener('touchstart', stopAnim, { passive: true });
}
