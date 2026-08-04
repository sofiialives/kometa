export function initNetworkStatus({ banner }) {
    if (!banner) return;

    const update = () => {
        banner.classList.toggle('is-visible', !navigator.onLine);
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}
