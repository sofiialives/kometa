/**
 * Страница статей: звёздный фон, мобильное меню шапки, список/фильтры/поиск статей.
 */
import { initMenu } from './modules/menu.js?v=5';
import { initArticles } from './modules/articles.js?v=4';
import { initPressSpring } from './modules/press-spring.js?v=6';

document.documentElement.classList.remove('no-js');

initMenu({
    header: document.querySelector('[data-header]'),
    burger: document.querySelector('[data-burger]'),
    nav: document.querySelector('[data-nav]')
});

/* ---------- звёзды: один раз нарисованы, без анимации (лёгкая страница) ---------- */
(() => {
    const canvas = document.querySelector('[data-space]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const layers = [
        { count: 150, r: [0.4, 0.9], a: [0.12, 0.38] },
        { count: 70, r: [0.8, 1.4], a: [0.28, 0.6] },
        { count: 14, r: [1.3, 2.1], a: [0.5, 0.9] }
    ];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const draw = () => {
        const w = innerWidth;
        const h = innerHeight;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const k = Math.max((w * h) / (1440 * 900), 0.45);
        layers.forEach((l) => {
            const n = Math.round(l.count * k);
            for (let i = 0; i < n; i += 1) {
                ctx.fillStyle = `rgba(255,255,255,${rnd(l.a[0], l.a[1]).toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(Math.random() * w, Math.random() * h, rnd(l.r[0], l.r[1]), 0, 6.2832);
                ctx.fill();
            }
        });
    };
    let t = 0;
    let lastW = 0;
    draw();
    lastW = innerWidth;
    addEventListener('resize', () => {
        // на телефоне resize приходит от адресной строки — перерисовываем только при смене ширины
        if (innerWidth === lastW) return;
        lastW = innerWidth;
        clearTimeout(t);
        t = setTimeout(draw, 200);
    });
})();


initArticles();
initPressSpring();
