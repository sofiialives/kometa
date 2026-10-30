/**
 * Бесконечная лента клиентов с инерцией.
 *  • сама едет влево; палец/мышь хватает ленту, бросок раскручивает её, трение плавно возвращает к базовой скорости;
 *  • скролл страницы подталкивает ленту (импульс по скорости скролла) — как колесо в Telegram-стикерах;
 *  • работает только пока секция в зоне видимости; на тач-устройствах вертикальный скролл не перехватывается.
 * Движение — один translate3d на трек, элементы клонируются так, чтобы лента была бесшовной.
 */
import { isZeroG, isBusy } from './physics.js?v=6';

const BASE = -46;          // px/с, базовая скорость (влево)
const MAX = 700;           // потолок скорости от толчка (px/с): лента остаётся плавной, не «улетает»
const FLING = 2600;        // потолок для броска рукой

export function initMarquee() {
    const root = document.querySelector('[data-marquee]');
    const track = root?.querySelector('[data-marquee-track]');
    if (!root || !track) return null;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const originals = [...track.children];
    let setW = 0;
    let x = 0;
    let v = reduce.matches ? 0 : BASE;
    let raf = 0;
    let last = 0;
    let visible = false;
    let dragging = false;
    let pid = null;
    let samples = [];
    let sy = scrollY;

    const build = () => {
        [...track.children].slice(originals.length).forEach((n) => n.remove());
        setW = originals.reduce((s, el) => s + el.getBoundingClientRect().width + parseFloat(getComputedStyle(el).marginRight || 0), 0);
        const need = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(1, setW)) + 1);
        for (let i = 1; i < need; i++) {
            originals.forEach((el) => {
                const c = el.cloneNode(true);
                c.setAttribute('aria-hidden', 'true');
                track.append(c);
            });
        }
    };

    const wrap = () => { if (setW) { x %= setW; if (x > 0) x -= setW; } };
    const paint = () => { track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; };

    const frame = (now) => {
        raf = 0;
        if (!visible) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!dragging && !isZeroG() && !isBusy('logos')) {
            // трение: скорость плавно стремится к базовой
            const base = reduce.matches ? 0 : BASE;
            v += (base - v) * (1 - Math.exp(-dt / 1.6));
            x += v * dt;
            wrap();
            paint();
        }
        raf = requestAnimationFrame(frame);
    };

    const run = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) { if (!dragging) v = reduce.matches ? 0 : BASE * .2; run(); }   // выезжает плавно: скорость набирается от почти нуля
    }, { rootMargin: '120px' }).observe(root);
    // мягкое появление блока при первом показе
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { root.classList.add('is-in'); o.disconnect(); } }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' }).observe(root);

    // импульс от скролла страницы
    addEventListener('scroll', () => {
        const dy = scrollY - sy;
        sy = scrollY;
        if (!visible || dragging || isZeroG() || reduce.matches) return;
        v = Math.max(-MAX, Math.min(MAX, v - Math.max(-60, Math.min(60, dy)) * 3.2));   // скролл лишь слегка подталкивает ленту
    }, { passive: true });

    // хват
    root.addEventListener('pointerdown', (e) => {
        if (isZeroG() || pid !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
        pid = e.pointerId;
        dragging = true;
        samples = [{ t: performance.now(), x: e.clientX }];
        root.classList.add('is-dragging');
        try { root.setPointerCapture(pid); } catch (_) { /* ok */ }
    });
    root.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== pid) return;
        const prev = samples[samples.length - 1];
        x += e.clientX - prev.x;
        wrap();
        paint();
        const t = performance.now();
        samples.push({ t, x: e.clientX });
        while (samples.length > 2 && t - samples[0].t > 120) samples.shift();
    });
    const release = (e) => {
        if (!dragging || (e && e.pointerId !== undefined && e.pointerId !== pid)) return;
        dragging = false;
        pid = null;
        root.classList.remove('is-dragging');
        const now = performance.now();
        const s = samples.filter((p) => now - p.t < 100);
        if (s.length >= 2) {
            const dt = Math.max(16, s[s.length - 1].t - s[0].t) / 1000;
            v = Math.max(-FLING, Math.min(FLING, (s[s.length - 1].x - s[0].x) / dt));
        }
        last = performance.now();
        run();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => root.addEventListener(n, release));
    root.addEventListener('dragstart', (e) => e.preventDefault());

    build();
    paint();
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); wrap(); paint(); }, 150); });

    return { items: () => [...track.children] };
}
