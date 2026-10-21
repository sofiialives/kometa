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

/* ---------- плавное колесо/тачпад (Lenis, MIT) ----------
 * Включается на всех устройствах: колесо/тачпад на компьютере и палец на телефоне (syncTouch). Свой rAF-цикл запускается только пока идёт скролл, а при просадке
 * кадров движок сам отключается и страница возвращается к нативному скроллу (страховка от лагов). */
let lenis = null;
let lraf = 0;
let idle = 0;
const slow = { n: 0, sum: 0, last: 0 };
const TOUCH_SMOOTH = true;                                   // плавный скролл пальцем на телефоне; false — нативный
const forced = /[?&]smooth=force/.test(location.search);   // для замеров: без страховки

function lenisLoop(t) {
    lraf = 0;
    if (!lenis) return;
    if (slow.last) {
        const d = t - slow.last;
        if (lenis.isScrolling && !forced) {
            slow.sum += Math.min(d, 200); slow.n++;
            if (slow.n >= 30) {
                if (slow.sum / slow.n > 24) { destroyLenis(); return; }   // < ~35 fps: плавность хуже нативной → отключаемся
                slow.n = 0; slow.sum = 0;
            }
        }
    }
    slow.last = t;
    lenis.raf(t);
    idle = lenis.isScrolling ? 0 : idle + 1;
    if (idle < 4) { if (!lraf) lraf = requestAnimationFrame(lenisLoop); }   // 'scroll' из lenis.raf мог уже запросить кадр
    else slow.last = 0;
}

function kick() {
    if (lenis && !lraf) lraf = requestAnimationFrame(lenisLoop);
}

function destroyLenis() {
    if (!lenis) return;
    cancelAnimationFrame(lraf);
    lraf = 0;
    lenis.destroy();
    lenis = null;
    window.removeEventListener('wheel', kick, true);
    window.removeEventListener('touchstart', kick, true);
    window.removeEventListener('touchmove', kick, true);
    root.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'is-scrolling');
}

const preventNode = (node) =>
    document.body.classList.contains('is-locked') ||
    !!node.closest?.('.modal, [data-modal-root], textarea, select, [data-lenis-prevent], .js-pager, .cards.js-pager');

async function startLenis() {
    try {
        const { default: Lenis } = await import('../vendor/lenis.mjs');
        lenis = new Lenis({
            autoRaf: false,
            smoothWheel: true,
            syncTouch: TOUCH_SMOOTH,         // палец на телефоне — тоже через Lenis (false — вернуть нативный скролл пальцем)
            syncTouchLerp: 0.085,
            touchInertiaExponent: 2.4,
            lerp: 0.085,
            wheelMultiplier: 1,
            anchors: false,
            prevent: preventNode,
            // жест уже перехвачен другим модулем (сцена Hero, карусель) — Lenis его не трогает
            virtualScroll: (d) => !d.event.defaultPrevented,
        });
        window.addEventListener('wheel', kick, { passive: true, capture: true });
        window.addEventListener('touchstart', kick, { passive: true, capture: true });
        window.addEventListener('touchmove', kick, { passive: true, capture: true });
        let calm = 0;
        lenis.on('scroll', () => {
            kick();
            // пока идёт плавный скролл, фоновые бесконечные анимации на паузе: главный поток занят только прокруткой
            if (!calm) root.classList.add('is-scrolling');
            clearTimeout(calm);
            calm = setTimeout(() => { calm = 0; root.classList.remove('is-scrolling'); }, 180);
        });
    } catch (e) {
        console.warn('[kometa] smooth scroll недоступен, остаётся нативный', e);
    }
}

export function initSmoothScroll() {
    if (reduceMq.matches) return;

    const interrupt = (e) => {
        if (!mode) return;
        if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
        stop();
    };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, interrupt, { passive: true, capture: true }));

    startLenis();
}
