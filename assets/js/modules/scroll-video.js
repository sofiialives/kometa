export function initScrollVideo({ video, scene, holder, hint, reduceMotion = false }) {
    if (!video || !scene || !holder) return;

    let started = false;
    let finished = false;

    const detach = () => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('keydown', onKey);
    };

    const finish = () => {
        if (finished) return;
        finished = true;
        try {
            video.pause();
        } catch (e) {}
        document.body.classList.remove('is-locked');
        holder.classList.add('is-done');
        if (hint) hint.classList.remove('is-visible');
        detach();
    };

    const start = () => {
        if (started || finished) return;
        started = true;
        holder.classList.add('is-playing', 'is-ready');
        if (hint) hint.classList.remove('is-visible');

        if (video.readyState === 0) video.load();

        const promise = video.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch((error) => {
                console.warn('[kometa] воспроизведение отклонено:', error && error.name);
                finish();
            });
        }
    };

    const atScene = () => {
        const rect = scene.getBoundingClientRect();
        return rect.top <= 2 && rect.bottom > window.innerHeight * 0.4;
    };

    function onWheel(event) {
        if (finished) return;
        if (!atScene()) return;
        if (event.deltaY <= 0) return;
        event.preventDefault();
        start();
    }

    let touchY = 0;

    const onTouchStart = (event) => {
        touchY = event.touches[0].clientY;
    };

    function onTouchMove(event) {
        if (finished) return;
        if (!atScene()) return;
        event.preventDefault();
        if (event.touches[0].clientY < touchY) start();
    }

    const KEYS = [32, 33, 34, 35, 36, 38, 40];

    function onKey(event) {
        if (finished) return;
        if (!atScene()) return;
        if (KEYS.indexOf(event.keyCode) === -1) return;
        event.preventDefault();
        start();
    }

    video.addEventListener('ended', finish);

    video.addEventListener('timeupdate', () => {
        if (!started || !video.duration) return;
        if (video.currentTime >= video.duration - 0.06) finish();
    });

    video.addEventListener('loadeddata', () => {
        holder.classList.add('is-ready');
    }, { once: true });

    video.addEventListener('error', () => {
        console.warn('[kometa] видео не загрузилось');
        holder.classList.add('is-ready');
    }, { once: true });

    const sync = () => {
        if (finished || started) return;

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

    if (reduceMotion) {
        video.addEventListener('loadeddata', () => {
            video.currentTime = Math.max((video.duration || 1) - 0.05, 0);
            finish();
        }, { once: true });
    }

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    sync();
    setTimeout(sync, 120);
}
