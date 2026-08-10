export function detectConnection() {
    const nav = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!nav) return { slow: false, saveData: false, type: 'unknown' };

    const type = nav.effectiveType || 'unknown';
    const saveData = Boolean(nav.saveData);
    const slow = saveData || type === 'slow-2g' || type === '2g';

    return { slow, saveData, type, downlink: nav.downlink };
}

export function initMediaProgress({ video, holder, bar, fill, hint, onReady }) {
    if (!video || !holder) {
        if (typeof onReady === 'function') onReady('no-video');
        return;
    }

    const net = detectConnection();

    const setProgress = (value) => {
        const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
        if (fill) fill.style.width = percent + '%';
        if (bar) bar.setAttribute('aria-valuenow', String(percent));
    };

    const say = (text) => {
        if (hint) hint.textContent = text;
    };

    let done = false;

    const finish = (reason) => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(watchdog);
        setProgress(1);
        say('');
        holder.classList.add('is-ready');
        if (typeof onReady === 'function') onReady(reason);
    };

    if (net.slow) {
        say('Медленное соединение — видео в облегчённом режиме');
        video.preload = 'metadata';
    } else {
        say('Загружаем видео');
    }

    setProgress(0.08);

    const poll = setInterval(() => {
        if (done || !video.duration || !video.buffered.length) return;
        const loaded = video.buffered.end(video.buffered.length - 1) / video.duration;
        setProgress(0.08 + loaded * 0.9);
        if (loaded > 0.985) finish('buffered');
    }, 180);

    video.addEventListener('canplaythrough', () => finish('canplaythrough'), { once: true });
    video.addEventListener('canplay', () => {
        setProgress(0.7);
        if (video.readyState >= 3) finish('canplay');
    });
    video.addEventListener('loadeddata', () => setProgress(0.45));
    video.addEventListener('error', () => finish('error'), { once: true });

    const watchdog = setTimeout(() => finish('timeout'), 8000);

    if (video.readyState >= 3) finish('ready');
}
