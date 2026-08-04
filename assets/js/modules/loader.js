const STORAGE_KEY = 'kometa:intro-shown';
const MIN_VISIBLE = 1400;
const MAX_VISIBLE = 4000;
const ONCE_PER_SESSION = false;

export function initLoader({ loader, reduceMotion = false }) {
    if (!loader) return;

    const seen = ONCE_PER_SESSION && sessionStorage.getItem(STORAGE_KEY) === '1';

    const hide = () => {
        if (loader.classList.contains('is-done')) return;
        loader.classList.add('is-done');
        loader.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('is-locked');
        sessionStorage.setItem(STORAGE_KEY, '1');
        setTimeout(() => {
            loader.hidden = true;
        }, 700);
    };

    if (seen || reduceMotion) {
        loader.hidden = true;
        document.body.classList.remove('is-locked');
        return;
    }

    const shownAt = performance.now();

    const finish = () => {
        const elapsed = performance.now() - shownAt;
        setTimeout(hide, Math.max(0, MIN_VISIBLE - elapsed));
    };

    if (document.readyState === 'complete') {
        finish();
    } else {
        window.addEventListener('load', finish, { once: true });
    }

    setTimeout(hide, MAX_VISIBLE);
}
