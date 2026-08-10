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