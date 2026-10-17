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

    // ---- листание: палец / мышь / колесо / тачпад — всегда ровно на 1 карточку, плавное доезжание по центру ----
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const easeOut = (x) => 1 - Math.pow(1 - x, 4);
    let anim = 0;
    let drag = null;
    let blockClick = false;
    let wheelLocked = false;
    let lastWheel = 0;
    let settleTimer = 0;

    const syncPager = () => track.classList.toggle('js-pager', phone.matches);
    syncPager();
    phone.addEventListener?.('change', syncPager);

    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const stopAnim = () => { if (anim) { cancelAnimationFrame(anim); anim = 0; } };
    const clampIdx = (i) => Math.max(0, Math.min(cards.length - 1, i));
    const goIdx = (i) => glideTo(Math.min(maxScroll(), clampIdx(i) * pitchPx));

    function glideTo(target) {
        stopAnim();
        const from = track.scrollLeft;
        const dist = target - from;
        if (Math.abs(dist) < 1 || reduce.matches) { track.scrollLeft = target; update(); return; }
        const dur = Math.min(1000, Math.max(620, 520 + Math.abs(dist) * 1.6));
        const t0 = performance.now();
        const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            track.scrollLeft = k < 1 ? from + dist * easeOut(k) : target;
            update();
            anim = k < 1 ? requestAnimationFrame(step) : 0;
        };
        anim = requestAnimationFrame(step);
    }

    // выбор карточки по окончании жеста: максимум одна вперёд/назад от стартовой
    const settle = (d, v, cancelled) => {
        const moved = d.startScroll - track.scrollLeft;               // <0 — ушли вперёд
        const startIdx = Math.round(d.startScroll / pitchPx);
        let idx = Math.round(track.scrollLeft / pitchPx);
        if (!cancelled && (Math.abs(v) > 0.25 || Math.abs(moved) > pitchPx * 0.16)) {
            idx = startIdx + (v > 0.05 || (Math.abs(v) <= 0.05 && moved < 0) ? 1 : -1);
        }
        goIdx(Math.max(startIdx - 1, Math.min(startIdx + 1, idx)));
    };

    const velocity = (pts) => {
        const last = pts[pts.length - 1];
        const first = pts.find((p) => last.t - p.t <= 90) || pts[0];
        return (first.x - last.x) / Math.max(1, last.t - first.t);     // px/мс, >0 — листаем вперёд
    };

    // ---- общий драйвер жеста (одинаков для пальца и мыши) ----
    const begin = (x, y) => {
        stopAnim();
        drag = { x0: x, y0: y, startScroll: track.scrollLeft, active: false, pts: [{ x, t: performance.now() }] };
    };
    const move = (x, y) => {
        if (!drag) return false;
        const dx = x - drag.x0;
        if (!drag.active) {
            if (Math.abs(dx) < 6 && Math.abs(y - drag.y0) < 6) return false;
            if (Math.abs(y - drag.y0) > Math.abs(dx)) { drag = null; return false; }   // вертикальный жест — это скролл страницы
            drag.active = true;
            blockClick = true;
            track.classList.add('is-dragging');
        }
        track.scrollLeft = Math.min(maxScroll(), Math.max(0, drag.startScroll - dx));
        update();
        drag.pts.push({ x, t: performance.now() });
        if (drag.pts.length > 12) drag.pts.shift();
        return true;
    };
    const end = (cancelled) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        track.classList.remove('is-dragging');
        if (!d.active) return;
        settle(d, cancelled ? 0 : velocity(d.pts), cancelled);
    };

    // палец: touch-события (работают везде одинаково, включая iOS Safari)
    track.addEventListener('touchstart', (e) => {
        blockClick = false;
        if (!phone.matches || e.touches.length !== 1) return;
        begin(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    track.addEventListener('touchmove', (e) => {
        if (!drag) return;
        if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    }, { passive: false });
    track.addEventListener('touchend', () => end(false));
    track.addEventListener('touchcancel', () => end(true));

    // мышь: pointer-события
    track.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || !phone.matches) return;
        blockClick = false;
        begin(e.clientX, e.clientY);
        try { track.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    });
    track.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); });
    track.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(false); });
    track.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') end(true); });
    track.addEventListener('dragstart', (e) => e.preventDefault());
    track.addEventListener('click', (e) => {
        if (blockClick) { e.preventDefault(); e.stopPropagation(); blockClick = false; }
    }, true);

    // колесо / тачпад: один жест = одна карточка; инерцию тачпада игнорируем, пока она не затихнет
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
        goIdx(Math.round(track.scrollLeft / pitchPx) + (delta > 0 ? 1 : -1));
    }, { passive: false });

    // страховка: любой другой способ сдвинуть (скроллбар, клавиатура, нативный инерционный скролл) — доезжаем до ближайшей карточки
    track.addEventListener('scroll', () => {
        if (!phone.matches || anim || drag) return;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            if (anim || drag || !phone.matches) return;
            const idx = clampIdx(Math.round(track.scrollLeft / pitchPx));
            if (Math.abs(track.scrollLeft - Math.min(maxScroll(), idx * pitchPx)) > 1) goIdx(idx);
        }, 140);
    }, { passive: true });
}
