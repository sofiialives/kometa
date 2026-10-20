/**
 * Плавные переходы по якорям (один rAF-цикл, по времени, а не по кадрам — одинаково на 60/120 Гц):
 *  • scrollToY(y) — мягкий старт и финиш (smootherstep), длительность зависит от расстояния;
 *  • обычный скролл колесом/тачпадом/пальцем остаётся нативным (идёт в compositor-потоке, без лагов);
 *  • любое действие пользователя (колесо, касание, клавиши) мгновенно прерывает переход.
 * На html висит .is-autoscroll, пока идёт переход (фоновые анимации на паузе → кадры не рвутся).
 */
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;

let raf = 0;
let mode = '';            // '' | 'tween'
let tween = null;

const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
const clamp = (v) => Math.min(maxY(), Math.max(0, v));
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function stop(silent = false) {
    if (!raf && !mode) return;
    cancelAnimationFrame(raf);
    raf = 0;
    mode = '';
    tween = null;
    root.classList.remove('is-autoscroll');
    if (!silent) window.dispatchEvent(new Event('kometa:scrollend'));      // переход закончился (или прерван пользователем)
}

function frame(now) {
    raf = 0;
    if (mode === 'tween') {
        const k = Math.min(1, (now - tween.t0) / tween.dur);
        window.scrollTo(0, tween.from + (tween.to - tween.from) * smoother(k));
        if (k < 1) { raf = requestAnimationFrame(frame); return; }
        stop();
        return;
    }
}

/** Плавный переход к вертикальной позиции. */
export function scrollToY(y, { instant = reduceMq.matches } = {}) {
    const to = Math.round(clamp(y));
    const from = window.scrollY;
    stop(true);
    if (instant || Math.abs(to - from) < 2) { window.scrollTo(0, to); return; }
    const dist = Math.abs(to - from);
    const dur = Math.min(1500, 620 + Math.min(dist, 5000) * 0.17);
    mode = 'tween';
    tween = { from, to, t0: performance.now(), dur };
    root.classList.add('is-autoscroll');
    raf = requestAnimationFrame(frame);
}

export const cancelScroll = () => stop();
export const isTweening = () => mode === 'tween';

export function initSmoothScroll() {
    // Колесо/тачпад/клавиши НЕ перехватываем: браузер сам плавно скроллит их в отдельном потоке (compositor),
    // и так не бывает лагов даже на тяжёлой странице. Движок отвечает только за переходы по якорям.
    if (reduceMq.matches) return;

    const interrupt = (e) => {
        if (!mode) return;
        if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
        stop();
    };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, interrupt, { passive: true, capture: true }));
}
