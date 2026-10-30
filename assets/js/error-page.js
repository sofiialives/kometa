/**
 * Страница 404: звёздный фон, мобильное меню шапки и мини-игра «робот перепрыгивает преграды».
 * Игра — на DOM + transform (SVG из макета как есть), один rAF-цикл только пока идёт забег.
 * Игровые единицы (g): на десктопе 1 g = 1 du (масштаб макета 1920), на телефоне 1 g = 1px.
 */
import { initMenu } from './modules/menu.js?v=5';

document.documentElement.classList.remove('no-js');

/* ---------- шапка: бургер на планшете/телефоне ---------- */
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

/* ---------- мини-игра ---------- */
(() => {
    const root = document.querySelector('[data-game]');
    if (!root) return;

    const field = root.querySelector('[data-field]');
    const probe = root.querySelector('[data-probe]');
    const groundEl = root.querySelector('[data-ground]');
    const robotEl = root.querySelector('[data-robot]');
    const scoreEl = root.querySelector('[data-score]');
    const bestEl = root.querySelector('[data-best]');
    const msgIdle = root.querySelector('[data-msg="idle"]');
    const msgDead = root.querySelector('[data-msg="dead"]');
    const finalEl = root.querySelector('[data-final]');
    const finalBestEl = root.querySelector('[data-final-best]');
    const retryBtn = root.querySelector('[data-retry]');

    const KEY = 'kometa-404-best';
    const GROUND_TOP = 45;           // верх платформ в поле
    const FOOT = 44.4;               // низ ног робота / оснований преград в их SVG
    const ROBOT_X = 40;
    const GRAVITY = 1900;
    const JUMP_V = 600;
    const TILE = 64;
    const SRC = { spike: './assets/images/game/spike.svg', reactor: './assets/images/game/reactor.svg' };

    const pad = (n) => String(Math.floor(n)).padStart(5, '0');
    let best = 0;
    try { best = Number(localStorage.getItem(KEY)) || 0; } catch (e) { best = 0; }
    bestEl.textContent = pad(best);

    let g = 1;            // px в одной игровой единице
    let W = 570;          // ширина поля в единицах
    let state = 'idle';   // idle | run | dead
    let raf = 0;
    let last = 0;
    let score = 0;
    let dist = 0;
    let speed = 260;
    let y = 0;            // смещение робота вверх от земли (единицы), 0 = на платформе
    let vy = 0;
    let nextGap = 0;
    let deadAt = 0;
    let obstacles = [];
    let overT = 0;

    const measure = () => {
        g = probe.getBoundingClientRect().width || 1;
        W = field.clientWidth / g;
    };

    const baseY = GROUND_TOP - FOOT;

    const place = (el, x, yy) => { el.style.transform = `translate3d(${(x * g).toFixed(2)}px,${(yy * g).toFixed(2)}px,0)`; };

    const makeObstacle = (kind, x) => {
        const el = new Image();
        el.className = 'game__obstacle';
        el.alt = '';
        el.draggable = false;
        el.width = 47;
        el.height = 47;
        el.src = SRC[kind];
        field.append(el);
        const o = { el, kind, x };
        place(el, x, baseY);
        return o;
    };

    const clearObstacles = () => { obstacles.forEach((o) => o.el.remove()); obstacles = []; };

    const render = () => {
        place(robotEl, ROBOT_X, baseY - y);
        if (state === 'dead') robotEl.style.transform += ' rotate(-14deg)';
        obstacles.forEach((o) => place(o.el, o.x, baseY));
        groundEl.style.transform = `translate3d(${(-(dist % TILE) * g).toFixed(2)}px,0,0)`;
    };

    const idleScene = () => {
        clearObstacles();
        y = 0; vy = 0; dist = 0;
        robotEl.classList.remove('is-dead');
        obstacles.push(makeObstacle('spike', Math.round(W * 0.5) - 22));
        obstacles.push(makeObstacle('reactor', Math.round(W) - 64));
        render();
    };

    const showMsg = (which) => {
        msgIdle.hidden = which !== 'idle';
        msgDead.hidden = which !== 'dead';
    };

    const start = () => {
        measure();
        clearTimeout(overT);
        root.classList.remove('is-over');
        clearObstacles();
        robotEl.classList.remove('is-dead');
        showMsg('idle');
        state = 'run';
        score = 0; dist = 0; speed = 260; y = 0; vy = 0;
        nextGap = W * 0.9;                 // первая преграда выезжает не сразу
        scoreEl.textContent = pad(0);
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    };

    const die = () => {
        state = 'dead';
        deadAt = performance.now();
        robotEl.classList.add('is-dead');
        if (score > best) {
            best = score;
            bestEl.textContent = pad(best);
            try { localStorage.setItem(KEY, String(Math.floor(best))); } catch (e) { /* без хранилища играем как есть */ }
        }
        finalEl.textContent = pad(score);
        finalBestEl.textContent = pad(best);
        render();
        cancelAnimationFrame(raf);
        raf = 0;
        // кадр столкновения виден долю секунды, затем поле очищается и появляется итог
        clearTimeout(overT);
        overT = setTimeout(() => { if (state !== 'dead') return; showMsg('dead'); root.classList.add('is-over'); }, 380);
    };

    const spawn = () => {
        const kind = Math.random() < 0.5 ? 'spike' : 'reactor';
        obstacles.push(makeObstacle(kind, W + 10));
        if (Math.random() < 0.22) obstacles.push(makeObstacle(kind === 'spike' ? 'reactor' : 'spike', W + 10 + 52 + Math.random() * 14));
        nextGap = speed * (0.85 + Math.random() * 0.8) + 100;
    };

    const hits = (o) => {
        // хитбоксы чуть меньше картинок — игра прощает касания краёв
        const rx0 = ROBOT_X + 10; const rx1 = ROBOT_X + 36;
        const ry0 = baseY - y + 8; const ry1 = baseY - y + FOOT - 1;
        const ox0 = o.x + 11; const ox1 = o.x + 36;
        const oy0 = baseY + 9; const oy1 = baseY + FOOT;
        return rx1 > ox0 && rx0 < ox1 && ry1 > oy0 && ry0 < oy1;
    };

    function tick(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        speed = Math.min(260 + score * 0.32, 560);
        dist += speed * dt;
        score += (speed * dt) / 20;
        scoreEl.textContent = pad(score);

        if (y > 0 || vy < 0) {
            vy += GRAVITY * dt;
            y -= vy * dt;
            if (y <= 0) { y = 0; vy = 0; }
        }

        nextGap -= speed * dt;
        if (nextGap <= 0) spawn();

        for (let i = obstacles.length - 1; i >= 0; i -= 1) {
            const o = obstacles[i];
            o.x -= speed * dt;
            if (o.x < -60) { o.el.remove(); obstacles.splice(i, 1); }
        }

        render();

        if (obstacles.some(hits)) { die(); return; }
        raf = requestAnimationFrame(tick);
    }

    const jump = () => {
        if (state === 'idle') { start(); return; }
        if (state === 'dead') {
            if (performance.now() - deadAt < 450) return;
            start();
            return;
        }
        if (y === 0) vy = -JUMP_V;
    };

    /* управление */
    addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.code;
        if (k !== 'Space' && k !== 'ArrowUp' && k !== 'KeyW') return;
        const t = e.target;
        if (t instanceof HTMLElement && t.closest('a, input, textarea, select, [role="dialog"]')) return;
        if (t instanceof HTMLElement && t.closest('button') && k === 'Space') return;   // пробел на кнопке — её собственный клик
        e.preventDefault();
        if (e.repeat && state !== 'run') return;
        jump();
    });

    root.addEventListener('pointerdown', (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('button, a')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        jump();
    });

    retryBtn.addEventListener('click', () => {
        if (state === 'dead' && performance.now() - deadAt >= 450) start();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
        else if (state === 'run' && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });

    let rt = 0;
    addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
            measure();
            if (state === 'idle') idleScene();
            else render();
        }, 120);
    });

    const init = () => { measure(); idleScene(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
    init();
})();
