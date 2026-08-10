const MIN_VISIBLE = 900;
const MAX_VISIBLE = 10000;

export function initLoader({ loader }) {
    if (!loader) return null;

    const shownAt = performance.now();
    let hidden = false;

    const hide = () => {
        if (hidden) return;
        hidden = true;
        loader.classList.add('is-done');
        loader.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('is-locked');
        setTimeout(() => {
            loader.hidden = true;
        }, 600);
    };

    const safety = setTimeout(hide, MAX_VISIBLE);

    return {
        release() {
            clearTimeout(safety);
            const elapsed = performance.now() - shownAt;
            setTimeout(hide, Math.max(0, MIN_VISIBLE - elapsed));
        },
        hide
    };
}
