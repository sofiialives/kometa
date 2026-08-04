const LAYERS = [
    { density: 0.000055, size: [0.4, 0.9], alpha: [0.12, 0.32], drift: 0.0016, twinkle: 0.0006 },
    { density: 0.000032, size: [0.7, 1.4], alpha: [0.22, 0.55], drift: 0.0042, twinkle: 0.0011 },
    { density: 0.000009, size: [1.1, 2.1], alpha: [0.4, 0.85], drift: 0.0085, twinkle: 0.0018 }
];

const COMET_MIN_DELAY = 5200;
const COMET_MAX_DELAY = 12000;

const random = (min, max) => min + Math.random() * (max - min);

export function initStarfield({ canvas, reduceMotion = false }) {
    if (!canvas || reduceMotion) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let stars = [];
    let comets = [];
    let frame = 0;
    let running = false;
    let lastTime = 0;
    let nextComet = performance.now() + random(1200, 3000);

    const build = () => {
        stars = [];
        LAYERS.forEach((layer, index) => {
            const count = Math.round(width * height * layer.density);
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

        ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        build();
    };

    const spawnComet = () => {
        const fromLeft = Math.random() > 0.35;
        const startY = random(-0.1, 0.55) * height;

        comets.push({
            x: fromLeft ? -120 : width + 120,
            y: startY,
            vx: (fromLeft ? 1 : -1) * random(0.42, 0.86),
            vy: random(0.16, 0.34),
            len: random(120, 260),
            size: random(1, 2.1),
            life: 0,
            max: random(2600, 4200)
        });
    };

    const drawComet = (comet) => {
        const fade = comet.life < 400
            ? comet.life / 400
            : comet.life > comet.max - 600
                ? Math.max(0, (comet.max - comet.life) / 600)
                : 1;

        const angle = Math.atan2(comet.vy, comet.vx);
        const tailX = comet.x - Math.cos(angle) * comet.len;
        const tailY = comet.y - Math.sin(angle) * comet.len;

        const gradient = context.createLinearGradient(comet.x, comet.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(255,255,255,${0.75 * fade})`);
        gradient.addColorStop(0.35, `rgba(190,225,255,${0.25 * fade})`);
        gradient.addColorStop(1, 'rgba(120,180,255,0)');

        context.strokeStyle = gradient;
        context.lineWidth = comet.size;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(comet.x, comet.y);
        context.lineTo(tailX, tailY);
        context.stroke();

        const glow = context.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, comet.size * 7);
        glow.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(comet.x, comet.y, comet.size * 7, 0, Math.PI * 2);
        context.fill();
    };

    const render = (time) => {
        if (!running) return;

        const delta = Math.min(time - lastTime || 16, 48);
        lastTime = time;

        context.clearRect(0, 0, width, height);

        stars.forEach((star) => {
            const layer = LAYERS[star.layer];
            star.x += layer.drift * delta;
            if (star.x > width + 2) star.x = -2;

            star.phase += layer.twinkle * delta;
            const alpha = star.a * (0.72 + Math.sin(star.phase) * 0.28);

            context.fillStyle = `rgba(255,255,255,${alpha})`;
            context.beginPath();
            context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            context.fill();
        });

        if (time > nextComet && comets.length < 2) {
            spawnComet();
            nextComet = time + random(COMET_MIN_DELAY, COMET_MAX_DELAY);
        }

        comets = comets.filter((comet) => {
            comet.x += comet.vx * delta;
            comet.y += comet.vy * delta;
            comet.life += delta;
            drawComet(comet);
            return comet.life < comet.max && comet.x > -400 && comet.x < width + 400;
        });

        frame = requestAnimationFrame(render);
    };

    const start = () => {
        if (running) return;
        running = true;
        lastTime = performance.now();
        nextComet = lastTime + random(800, 2200);
        frame = requestAnimationFrame(render);
    };

    const stop = () => {
        running = false;
        cancelAnimationFrame(frame);
    };

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 180);
    });

    document.addEventListener('visibilitychange', () => {
        document.hidden ? stop() : start();
    });

    resize();

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        }, { rootMargin: '160px' });
        observer.observe(canvas);
    } else {
        start();
    }
}
