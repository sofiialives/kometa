const SWITCH_DELAY = 120;
const UNLOCK_DELAY = 2130;
const PLAY_TIMEOUT = 9000;   // если ролик так и не пошёл (совсем плохая сеть) — не держим человека взаперти
const KEY = 'kometa:scrollY';

const readSaved = () => {
    // перезагрузка всегда начинается с главной (Hero): позицию не восстанавливаем, старую запись чистим
    try { sessionStorage.removeItem(KEY); } catch (_) { /* ok */ }
    return 0;
};

export function initScrollVideo({ video, scene, holder, hint, screens, reduceMotion = false }) {
    if (!video || !scene || !holder) return { restored: false };

    let started = false;
    let unlocked = false;
    let switchTimer = 0;
    let unlockTimer = 0;
    let giveUpTimer = 0;
    let phase = false;   // true, когда ролик реально пошёл («playing»)

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
        clearTimeout(giveUpTimer);
        document.body.classList.remove('is-locked');
        if (hint) hint.classList.remove('is-visible');
        detach();
    };

    const start = () => {
        if (started) return;
        started = true;
        holder.classList.add('is-playing');
        if (hint) hint.classList.remove('is-visible');

        // load() не зовём, если загрузка уже идёт: он её обрывает (это и ломало ролик после нескольких перезагрузок подряд)
        if (video.networkState === 3 /* NO_SOURCE */ || video.networkState === 0 /* EMPTY */) video.load();

        const tryPlay = (retry) => {
            const promise = video.play();
            if (promise && typeof promise.catch === 'function') {
                promise.catch((error) => {
                    // AbortError: загрузку перезапустили/прервали — один раз повторяем, как только появятся данные
                    if (retry && error && error.name === 'AbortError') {
                        video.addEventListener('canplay', () => tryPlay(false), { once: true });
                        return;
                    }
                    console.warn('[kometa] воспроизведение отклонено:', error && error.name);
                    showWelcome();
                    unlock();
                });
            }
        };
        tryPlay(true);

        // экран и разблокировка отсчитываются от момента, когда кадры пошли, а не от первого скролла:
        // иначе при недогруженном файле таймер успевал разблокировать страницу раньше видео
        const onPlaying = () => {
            if (phase) return;
            phase = true;
            switchTimer = setTimeout(showWelcome, SWITCH_DELAY);
            unlockTimer = setTimeout(unlock, UNLOCK_DELAY);
        };
        if (!video.paused && video.readyState >= 3) onPlaying();
        else video.addEventListener('playing', onPlaying, { once: true });

        giveUpTimer = setTimeout(() => {
            if (phase || unlocked) return;
            console.warn('[kometa] видео не стартовало за', PLAY_TIMEOUT, 'мс');
            showWelcome();
            unlock();
        }, PLAY_TIMEOUT);
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
    // (позицию скролла больше не запоминаем — после перезагрузки сайт открывается с главной)

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
