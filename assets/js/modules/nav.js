/** Якоря: плавный переход через общий движок smooth-scroll (мягкий старт/финиш), без полоски фокуса. */
import { scrollToY } from './smooth-scroll.js';

export function scrollToTarget(target, { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
    scrollToY(target.getBoundingClientRect().top + window.scrollY, { instant: reduce });
}

export function initNav({ root = document } = {}) {
    const links = [...root.querySelectorAll('a[href^="#"]')];
    if (!links.length) return;

    links.forEach((link) => {
        const id = link.getAttribute('href').slice(1);
        if (!id) return;

        const target = document.getElementById(id);

        if (!target) {
            // раздела на странице нет (например, «Наш блог») — ведём на страницу 404, как с любым несуществующим адресом
            link.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.assign(new URL('404.html', document.baseURI).href);
            });
            return;
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            // без data-modal-cta: модалка сама закрывается и вызывает scrollToTarget
            if (link.hasAttribute('data-modal-cta')) return;
            scrollToTarget(target);
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            history.replaceState(null, '', '#' + id);
        });
    });
}

/** Неизвестный якорь в адресе (например, /#/blog) — это несуществующая страница: показываем 404. */
export function initUnknownHash() {
    const check = () => {
        let h = location.hash.slice(1);
        try { h = decodeURIComponent(h); } catch (_) { /* оставляем как есть */ }
        if (!h || h === 'top' || h.startsWith(':~:')) return;      // пустой, #top и «текстовые фрагменты» браузера — не роуты
        if (document.getElementById(h)) return;
        window.location.replace(new URL('404.html', document.baseURI).href);
    };
    check();
    window.addEventListener('hashchange', check);
}
