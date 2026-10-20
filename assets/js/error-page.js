const STAR_LAYERS = [
    { count: 90, size: [0.4, 1.0], alpha: [0.15, 0.4], speed: 0.004 },
    { count: 55, size: [0.8, 1.6], alpha: [0.3, 0.65], speed: 0.011 },
    { count: 18, size: [1.3, 2.4], alpha: [0.5, 0.95], speed: 0.02 }
];

const random = (min, max) => min + Math.random() * (max - min);

document.documentElement.classList.remove('no-js');

const canvas = document.querySelector('[data-space]');
const tilt = document.querySelector('[data-tilt]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let stars = [];
    let comets = [];
    let raf = 0;
    let last = performance.now();
    let nextComet = last + random(1200, 3200);

    const build = () => {
        stars = [];
        STAR_LAYERS.forEach((layer, index) => {
            const scale = (width * height) / (1440 * 900);
            const count = Math.round(layer.count * Math.max(scale, 0.4));
            for (let i = 0; i < count; i += 1) {
                stars.push({
                    layer: index,
                    x: Math.random() * width,
                    y: Math.random() * height,
                    r: random(layer.size[0], layer.size[1]),
                    a: random(layer.alpha[0], layer.alpha[1]),
                    phase: Math.random() * Math.PI * 2
                });
            }
        });
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        build();
    };

    const spawnComet = () => {
        const fromLeft = Math.random() > 0.4;
        comets.push({
            x: fromLeft ? -140 : width + 140,
            y: random(-0.05, 0.6) * height,
            vx: (fromLeft ? 1 : -1) * random(0.34, 0.62),
            vy: random(0.14, 0.3),
            len: random(140, 300),
            size: random(1.1, 2.2),
            life: 0,
            max: random(2800, 4600)
        });
    };

    const drawComet = (comet) => {
        const fade = comet.life < 420
            ? comet.life / 420
            : comet.life > comet.max - 700
                ? Math.max(0, (comet.max - comet.life) / 700)
                : 1;

        const angle = Math.atan2(comet.vy, comet.vx);
        const tailX = comet.x - Math.cos(angle) * comet.len;
        const tailY = comet.y - Math.sin(angle) * comet.len;

        const grad = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${0.8 * fade})`);
        grad.addColorStop(0.32, `rgba(160,214,255,${0.28 * fade})`);
        grad.addColorStop(1, 'rgba(75,188,252,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = comet.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(comet.x, comet.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        const glow = ctx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, comet.size * 8);
        glow.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, comet.size * 8, 0, Math.PI * 2);
        ctx.fill();
    };

    const frame = (now) => {
        const dt = Math.min(now - last || 16, 48);
        last = now;
        ctx.clearRect(0, 0, width, height);

        stars.forEach((star) => {
            const layer = STAR_LAYERS[star.layer];
            star.x += layer.speed * dt;
            if (star.x > width + 2) star.x = -2;
            star.phase += 0.0009 * dt;
            const alpha = star.a * (0.7 + Math.sin(star.phase) * 0.3);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        });

        if (now > nextComet && comets.length < 2) {
            spawnComet();
            nextComet = now + random(3600, 9000);
        }

        comets = comets.filter((comet) => {
            comet.x += comet.vx * dt;
            comet.y += comet.vy * dt;
            comet.life += dt;
            drawComet(comet);
            return comet.life < comet.max && comet.x > -420 && comet.x < width + 420;
        });

        raf = requestAnimationFrame(frame);
    };

    const start = () => {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    };

    const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
    };

    let timer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(resize, 180);
    });

    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    resize();

    if (reduceMotion) {
        ctx.clearRect(0, 0, width, height);
        stars.forEach((star) => {
            ctx.fillStyle = `rgba(255,255,255,${star.a})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        });
    } else {
        start();
    }
}

if (tilt && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    let ticking = false;

    window.addEventListener('pointermove', (event) => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const dx = (event.clientX / window.innerWidth - 0.5) * 2;
            const dy = (event.clientY / window.innerHeight - 0.5) * 2;
            tilt.style.setProperty('--tx', (dx * 14).toFixed(1) + 'px');
            tilt.style.setProperty('--ty', (dy * 10).toFixed(1) + 'px');
        });
    }, { passive: true });
}

/* ---------- мини-игра «комета уворачивается от астероидов» (как динозаврик в Chrome) ---------- */
(function kometaRunner() {
    const meta = document.querySelector('.error__meta');
    if (!meta) return;

    const W = 640;
    const H = 180;
    const GROUND = 150;
    const KEY = 'kometa-404-best';
    const box = document.createElement('section');
    box.className = 'game';
    box.setAttribute('aria-label', 'Мини-игра');
    box.innerHTML = '<canvas class="game__cv" tabindex="0" role="img" aria-label="Игра: комета уворачивается от астероидов. Пробел, стрелка вверх или касание — прыжок"></canvas>' +
        '<p class="game__hint" data-hint>Пробел, ↑ или тап — прыжок</p>' +
        '<p class="game__score"><span data-score>00000</span> · рекорд <span data-best>00000</span></p>';
    meta.before(box);

    const cv = box.querySelector('canvas');
    const hint = box.querySelector('[data-hint]');
    const scoreEl = box.querySelector('[data-score]');
    const bestEl = box.querySelector('[data-best]');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const pad = (n) => String(Math.floor(n)).padStart(5, '0');

    let best = 0;
    try { best = Number(localStorage.getItem(KEY)) || 0; } catch (e) { best = 0; }
    bestEl.textContent = pad(best);

    let state = 'idle';           // idle | run | dead
    let raf = 0;
    let last = 0;
    let score = 0;
    let t = 0;
    let comet;
    let rocks;
    let nextRock;
    let flash = 0;

    const reset = () => {
        comet = { x: 78, y: GROUND - 11, vy: 0, r: 11 };
        rocks = [];
        nextRock = 0.9;
        score = 0;
        t = 0;
    };

    const jump = () => {
        if (state === 'idle' || state === 'dead') {
            if (state === 'dead' && performance.now() - flash < 450) return;
            reset();
            state = 'run';
            hint.textContent = 'Пробел, ↑ или тап — прыжок';
            start();
            return;
        }
        if (comet.y >= GROUND - comet.r - 0.5) comet.vy = -800;
    };

    const spawn = () => {
        const r = 11 + Math.random() * 13;
        rocks.push({ x: W + r, r, a: Math.random() * 6, spin: (Math.random() - .5) * 3 });
        if (Math.random() < 0.28) rocks.push({ x: W + r + 54 + Math.random() * 26, r: 9 + Math.random() * 7, a: Math.random() * 6, spin: (Math.random() - .5) * 3 });
    };

    const drawRock = (k) => {
        const y = GROUND - k.r;
        ctx.save();
        ctx.translate(k.x, y);
        ctx.rotate(k.a);
        const g = ctx.createRadialGradient(-k.r * .3, -k.r * .35, k.r * .1, 0, 0, k.r);
        g.addColorStop(0, '#8b94a3');
        g.addColorStop(1, '#3a4150');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, k.r, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = 'rgba(20,24,32,.55)';
        [[.35, -.2, .26], [-.3, .3, .2], [.05, .45, .14]].forEach((c) => {
            ctx.beginPath();
            ctx.arc(c[0] * k.r, c[1] * k.r, c[2] * k.r, 0, 6.2832);
            ctx.fill();
        });
        ctx.restore();
    };

    const drawComet = () => {
        const ang = Math.max(-.5, Math.min(.5, comet.vy / 1600));
        ctx.save();
        ctx.translate(comet.x, comet.y);
        ctx.rotate(ang);
        const tail = ctx.createLinearGradient(0, 0, -70, 0);
        tail.addColorStop(0, 'rgba(159,220,255,.85)');
        tail.addColorStop(1, 'rgba(75,188,252,0)');
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(0, -comet.r * .8);
        ctx.lineTo(-70, 0);
        ctx.lineTo(0, comet.r * .8);
        ctx.closePath();
        ctx.fill();
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, comet.r * 2.4);
        glow.addColorStop(0, 'rgba(255,255,255,.9)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, comet.r * 2.4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, comet.r * .85, 0, 6.2832);
        ctx.fill();
        ctx.restore();
    };

    const draw = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = -(t * 260) % 24;
        ctx.beginPath();
        ctx.moveTo(0, GROUND + 4);
        ctx.lineTo(W, GROUND + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        if (comet) { rocks.forEach(drawRock); drawComet(); }
        else { comet = { x: 78, y: GROUND - 11, vy: 0, r: 11 }; rocks = []; drawComet(); }
        if (state === 'dead') {
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '600 22px ' + font;
            ctx.fillText('Столкновение!', W / 2, 74);
            ctx.font = '400 15px ' + font;
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            ctx.fillText('Тап или пробел — ещё раз', W / 2, 102);
        }
    };

    const frame = (now) => {
        raf = 0;
        const dt = Math.min(0.034, (now - last) / 1000);
        last = now;
        t += dt;
        const speed = Math.min(300 + score * 0.9, 640);
        comet.vy += 2300 * dt;
        comet.y += comet.vy * dt;
        if (comet.y > GROUND - comet.r) { comet.y = GROUND - comet.r; comet.vy = 0; }
        nextRock -= dt;
        if (nextRock <= 0) { spawn(); nextRock = Math.max(0.65, 1.7 - score / 700) + Math.random() * 0.9; }
        for (const k of rocks) { k.x -= speed * dt; k.a += k.spin * dt; }
        rocks = rocks.filter((k) => k.x > -40);
        score += dt * 11 * (speed / 300);
        scoreEl.textContent = pad(score);
        for (const k of rocks) {
            const dx = k.x - comet.x;
            const dy = (GROUND - k.r) - comet.y;
            if (Math.hypot(dx, dy) < (k.r + comet.r) * 0.82) {
                state = 'dead';
                flash = performance.now();
                if (score > best) {
                    best = Math.floor(score);
                    bestEl.textContent = pad(best);
                    try { localStorage.setItem(KEY, String(best)); } catch (e) { /* ok */ }
                }
                hint.textContent = 'Рекорд сохраняется в этом браузере';
                break;
            }
        }
        draw();
        if (state === 'run' && !document.hidden) raf = requestAnimationFrame(frame);
    };

    function start() {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden && state === 'run') start(); });

    window.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
        if (e.target instanceof Element && e.target.closest('a, button, input, textarea, select')) return;
        e.preventDefault();
        jump();
    });
    box.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    box.addEventListener('contextmenu', (e) => e.preventDefault());

    reset();
    comet = null;
    draw();
})();
