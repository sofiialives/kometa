const SWITCH_DELAY = 120;
const UNLOCK_DELAY = 2130;
const KEY = 'kometa:scrollY';

const readSaved = () => {
    try { return Number(sessionStorage.getItem(KEY)) || 0; } catch (_) { return 0; }
};

export function initScrollVideo({ video, scene, holder, hint, screens, reduceMotion = false }) {
    if (!video || !scene || !holder) return { restored: false };

    let started = false;
    let unlocked = false;
    let switchTimer = 0;
    let unlockTimer = 0;

    const detach = () => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('keydown', onKey);
    };

    const showWelcome = () => {
        clearTimeout(switchTimer);
        screens?.switch();
    };

    const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        clearTimeout(unlockTimer);
        document.body.classList.remove('is-locked');
        if (hint) hint.classList.remove('is-visible');
        detach();
    };

    const start = () => {
        if (started) return;
        started = true;
        holder.classList.add('is-playing');
        if (hint) hint.classList.remove('is-visible');

        if (video.readyState === 0) video.load();

        const promise = video.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch((error) => {
                console.warn('[kometa] воспроизведение отклонено:', error && error.name);
                showWelcome();
                unlock();
            });
        }

        switchTimer = setTimeout(showWelcome, SWITCH_DELAY);
        unlockTimer = setTimeout(unlock, UNLOCK_DELAY);
    };

    const atScene = () => {
        const rect = scene.getBoundingClientRect();
        return rect.top <= 2 && rect.bottom > window.innerHeight * 0.4;
    };

    function onWheel(event) {
        if (unlocked || !atScene()) return;
        if (event.deltaY <= 0) return;
        event.preventDefault();
        start();
    }

    let touchY = 0;

    const onTouchStart = (event) => {
        touchY = event.touches[0].clientY;
        if (!unlocked && atScene()) start();
    };

    function onTouchMove(event) {
        if (unlocked || !atScene()) return;
        event.preventDefault();
        start();
    }

    const KEYS = [32, 33, 34, 35, 36, 38, 40];

    function onKey(event) {
        if (unlocked || !atScene()) return;
        if (KEYS.indexOf(event.keyCode) === -1) return;
        event.preventDefault();
        start();
    }

    video.addEventListener('ended', () => {
        showWelcome();
        unlock();
    });

    video.addEventListener('loadeddata', () => {
        holder.classList.add('is-ready');
    }, { once: true });

    video.addEventListener('error', () => {
        console.warn('[kometa] видео не загрузилось');
        holder.classList.add('is-ready');
        showWelcome();
        unlock();
    }, { once: true });

    const sync = () => {
        const rect = scene.getBoundingClientRect();
        holder.classList.toggle('is-past', rect.bottom <= 0);

        if (unlocked || started) return;

        if (atScene()) {
            document.body.classList.add('is-locked');
            if (hint) hint.classList.add('is-visible');
        } else {
            document.body.classList.remove('is-locked');
            if (hint) hint.classList.remove('is-visible');
        }
    };

    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);

    holder.addEventListener('click', start);
    scene.addEventListener('click', start);

    // запоминаем место на странице: после перезагрузки остаёмся там же, а не возвращаемся на Hero
    let saveRaf = 0;
    const save = () => {
        saveRaf = 0;
        try { sessionStorage.setItem(KEY, String(Math.round(window.scrollY))); } catch (_) { /* ok */ }
    };
    window.addEventListener('scroll', () => { if (!saveRaf) saveRaf = requestAnimationFrame(save); }, { passive: true });
    window.addEventListener('pagehide', save);

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    // Hero уже проигран, если перезагрузка случилась ниже него: ролик не нужен, второй экран показываем сразу
    const saved = readSaved();
    const heroEnd = scene.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.4;
    const restored = !reduceMotion && saved > 0 && saved > heroEnd;

    if (reduceMotion) {
        screens?.showAll();
        unlock();
        return { restored: false };
    }

    if (restored) {
        started = true;
        holder.classList.add('is-ready', 'is-finished', 'is-past');
        screens?.switch();
        unlock();
        let moved = false;
        const stop = () => { moved = true; };
        ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((n) => window.addEventListener(n, stop, { once: true, passive: true }));
        const back = () => { if (!moved && Math.abs(window.scrollY - saved) > 2) window.scrollTo(0, saved); };
        back();
        window.addEventListener('load', back, { once: true });
        setTimeout(back, 300);
        setTimeout(back, 1200);
        return { restored: true };
    }

    window.scrollTo(0, 0);
    sync();
    setTimeout(sync, 120);
    return { restored: false };
}
