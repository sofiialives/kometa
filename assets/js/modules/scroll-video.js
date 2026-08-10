export function initScrollVideo({ video, scene, holder, reduceMotion = false }) {
    if (!video || !scene || !holder) return;

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.pause();

    let duration = 0;
    let target = 0;
    let current = 0;
    let ticking = false;
    let raf = 0;
    let ready = false;

    const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

    const onMeta = () => {
        duration = video.duration || 0;
        ready = duration > 0;
        readScroll();
        current = target;
        if (ready) video.currentTime = current * duration;
        holder.classList.add('is-ready');
    };

    if (video.readyState >= 1) onMeta();
    else video.addEventListener('loadedmetadata', onMeta, { once: true });

    function readScroll() {
        const rect = scene.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        target = clamp(-rect.top / (total || 1));
        holder.classList.toggle('is-active', rect.bottom > 0 && rect.top < window.innerHeight);
    }

    const loop = () => {
        current += (target - current) * 0.12;

        if (ready && Math.abs(current - target) > 0.0002) {
            const t = clamp(current) * duration;
            if (Number.isFinite(t)) {
                try {
                    video.currentTime = t;
                } catch (e) {}
            }
            raf = requestAnimationFrame(loop);
        } else {
            if (ready) {
                const t = clamp(target) * duration;
                if (Number.isFinite(t)) {
                    try {
                        video.currentTime = t;
                    } catch (e) {}
                }
            }
            raf = 0;
        }
    };

    const kick = () => {
        if (!raf) raf = requestAnimationFrame(loop);
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            readScroll();
            kick();
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    if (reduceMotion) {
        video.addEventListener('loadeddata', () => {
            video.currentTime = video.duration || 0;
        }, { once: true });
        return;
    }

    readScroll();
    kick();
}
