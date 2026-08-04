const FREEZE_AT = 0.015;
const ZOOM_SCALE = 1.45;
const SHIFT_X = 5;
const SHIFT_Y = 9;
const HERO_OUT = [0.05, 0.42];
const WELCOME_IN = [0.4, 0.75];
const BASE_X = -50;

const clamp = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const range = (value, from, to) => clamp((value - from) / (to - from));
const ease = (value) => value * value * (3 - 2 * value);

export function initIntro({ scene, earth, reduceMotion = false }) {
    if (!scene || !earth) return;

    const stageHero = scene.querySelector('[data-stage="hero"]');
    const stageWelcome = scene.querySelector('[data-stage="welcome"]');
    if (!stageHero || !stageWelcome) return;

    const baseY = () => (window.innerWidth <= 640 ? -70 : -56);

    let ticking = false;
    let frozen = false;
    let maxProgress = 0;

    const render = () => {
        ticking = false;

        const total = scene.offsetHeight - window.innerHeight;
        let progress = clamp(-scene.getBoundingClientRect().top / (total || 1));

        if (progress > maxProgress) maxProgress = progress;
        progress = maxProgress;

        const shouldFreeze = progress > FREEZE_AT;
        if (shouldFreeze !== frozen) {
            frozen = shouldFreeze;
            earth.classList.toggle('is-frozen', frozen);
        }

        const zoom = ease(progress);
        const scale = 1 + (ZOOM_SCALE - 1) * zoom;
        const x = BASE_X + SHIFT_X * zoom;
        const y = baseY() + SHIFT_Y * zoom;

        earth.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;

        const out = ease(range(progress, HERO_OUT[0], HERO_OUT[1]));
        const into = ease(range(progress, WELCOME_IN[0], WELCOME_IN[1]));

        stageHero.style.opacity = String(1 - out);
        stageHero.style.transform = `translateY(${-50 * out}px)`;
        stageHero.style.pointerEvents = out < 0.5 ? 'auto' : 'none';

        stageWelcome.style.opacity = String(into);
        stageWelcome.style.transform = `translateY(${50 * (1 - into)}px)`;
        stageWelcome.style.pointerEvents = into > 0.5 ? 'auto' : 'none';
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(render);
    };

    const inScene = () => {
        const rect = scene.getBoundingClientRect();
        return rect.top <= 0 && rect.bottom > window.innerHeight;
    };

    if (!reduceMotion) {
        let touchY = 0;

        window.addEventListener('wheel', (event) => {
            if (event.deltaY < 0 && inScene()) event.preventDefault();
        }, { passive: false });

        window.addEventListener('touchstart', (event) => {
            touchY = event.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchmove', (event) => {
            const delta = event.touches[0].clientY - touchY;
            touchY = event.touches[0].clientY;
            if (delta > 0 && inScene()) event.preventDefault();
        }, { passive: false });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const reset = () => {
        maxProgress = 0;
        window.scrollTo(0, 0);
        render();
    };

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    reset();
    window.addEventListener('load', reset);
    window.addEventListener('pageshow', reset);
    setTimeout(reset, 0);
    setTimeout(reset, 160);
    setTimeout(reset, 420);
}
