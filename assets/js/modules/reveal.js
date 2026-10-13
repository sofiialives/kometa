/* Появление секций по скроллу отключено: всё сразу на месте (плавный скролл без дёрганья). */
export function initReveal({ root = document } = {}) {
    root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
}
