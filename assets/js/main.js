import { initLoader } from './modules/loader.js?v=5';
import { initMediaProgress } from './modules/media-loader.js?v=5';
import { initScreens } from './modules/screens.js?v=5';
import { initScrollVideo } from './modules/scroll-video.js?v=5';
import { initNav, initUnknownHash } from './modules/nav.js?v=5';
import { initMenu } from './modules/menu.js?v=5';
import { initCarousel } from './modules/carousel.js?v=5';
import { initCrewSlider } from './modules/crew-slider.js?v=5';
import { initModals } from './modules/modals.js?v=5';
import { initGlassClose } from './modules/glass-close.js?v=5';
import { initNavGlass } from './modules/nav-glass.js?v=5';
import { initPressSpring } from './modules/press-spring.js?v=5';
import { initStarLight } from './modules/star-light.js?v=7';
import { initSmoothScroll } from './modules/smooth-scroll.js?v=5';

console.info('[kometa] build 7');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = window.matchMedia('(max-width: 1279.98px)').matches;
const root = document.documentElement;

root.classList.remove('no-js');
root.classList.add('js');

const $ = (selector) => document.querySelector(selector);

const loader = initLoader({ loader: $('[data-loader]') });
const videoEl = $('[data-scroll-video]');
const videoHolder = $('[data-video-holder]');

if (isPhone) {
    videoEl?.remove();
    loader?.release();
} else {
    const screens = initScreens({ root: $('[data-screens]') });

    if (videoEl) videoEl.preload = 'auto';

    const { restored } = initScrollVideo({
        video: videoEl,
        scene: $('[data-video-scene]'),
        holder: videoHolder,
        hint: $('[data-scroll-hint]'),
        screens,
        reduceMotion
    });

    if (restored) loader?.release();

    initMediaProgress({
        video: videoEl,
        holder: videoHolder,
        bar: $('[data-loader-bar]'),
        fill: $('[data-loader-fill]'),
        hint: $('[data-loader-hint]'),
        onReady: (reason) => {
            console.info('[kometa] видео готово:', reason);
            loader?.release();
            if (!reduceMotion && !restored) screens?.intro();
        }
    });

    if (videoEl && videoHolder) {
        const hideVideo = () => videoHolder.classList.add('is-finished');

        videoEl.addEventListener('ended', hideVideo);

        videoEl.addEventListener('timeupdate', () => {
            if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.08) hideVideo();
        });
    }
}

initStarLight();
initSmoothScroll();
initNav();
initUnknownHash();

initMenu({
    header: $('.header'),
    burger: $('[data-burger]'),
    nav: $('[data-nav]')
});

initCarousel({
    track: $('[data-carousel]'),
    progress: $('[data-carousel-progress]')
});

initCrewSlider({
    root: $('[data-crew]'),
    list: $('[data-crew-list]'),
    prev: $('[data-crew-prev]'),
    next: $('[data-crew-next]')
});

/* иконки у формы: «появились» — класс is-in (анимации парения идут всегда, не только пока блок в кадре) */
(function artIn() {
    const el = document.querySelector('.start__art');
    if (!el) return;
    el.classList.add('is-in');
})();

/* прелоад: после первой отрисовки, в простое, по одной подтягиваем и декодируем отложенные картинки — к моменту, когда до секции
   доскроллят, они уже в кэше и не декодируются посреди скролла (это и давало подлаги на входе в секцию) */
(function warmImages() {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    const start = () => {
        const imgs = [...document.querySelectorAll('img[loading="lazy"]')].filter((i) => !i.closest('.modal, [data-modal-root]'));
        const seen = new Set();
        const next = () => {
            const img = imgs.shift();
            if (!img) return;
            const url = img.currentSrc || img.src;
            if (seen.has(url)) { next(); return; }
            seen.add(url);
            img.loading = 'eager';
            (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => idle(next, { timeout: 1500 }));
        };
        idle(next, { timeout: 1500 });
    };
    if (document.readyState === 'complete') setTimeout(start, 1500);
    else window.addEventListener('load', () => setTimeout(start, 1500), { once: true });
})();

function initAstronaut() {
    const title = document.querySelector('[data-astro-title]');
    if (!title) return;

    const lines = [...title.querySelectorAll('.astronaut__line')];
    if (!lines.length) return;

    const STEP = 60;
    const LINE_PAUSE = 260;
    const ERASE_STEP = 35;
    const ERASE_LINE_PAUSE = 140;
    const HOLD = 2600;
    const RESTART = 700;

    const chars = [];
    let caret = null;

    lines.forEach((line, lineIndex) => {
        const text = line.textContent;
        line.textContent = '';

        [...text].forEach((char) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char === ' ' ? '\u00A0' : char;
            line.append(span);
            chars.push({ el: span, endOfLine: false });
        });

        if (chars.length) chars[chars.length - 1].endOfLine = lineIndex < lines.length - 1;

        if (lineIndex === lines.length - 1) {
            caret = document.createElement('span');
            caret.className = 'char astronaut__caret';
            caret.textContent = '\u00A0';
            line.append(caret);
        }
    });

    if (reduceMotion) {
        chars.forEach((c) => c.el.classList.add('is-typed'));
        if (caret) caret.style.display = 'none';
        return;
    }

    let timer = 0;
    let index = 0;
    let erasing = false;

    const clearAll = () => {
        chars.forEach((c) => c.el.classList.remove('is-typed'));
    };

    const step = () => {
        if (!erasing) {
            if (index >= chars.length) {
                erasing = true;
                index = chars.length - 1;
                timer = setTimeout(step, HOLD);
                return;
            }

            const current = chars[index];
            current.el.classList.add('is-typed');
            index += 1;

            timer = setTimeout(step, current.endOfLine ? LINE_PAUSE : STEP);
            return;
        }

        if (index < 0) {
            erasing = false;
            index = 0;
            timer = setTimeout(step, RESTART);
            return;
        }

        const current = chars[index];
        current.el.classList.remove('is-typed');
        index -= 1;

        timer = setTimeout(step, current.endOfLine ? ERASE_LINE_PAUSE : ERASE_STEP);
    };

    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (!timer) step();
                } else {
                    clearTimeout(timer);
                    timer = 0;
                    clearAll();
                    index = 0;
                    erasing = false;
                }
            });
        }, { threshold: 0.25 })
        : null;

    if (observer) observer.observe(title);
    else step();
}

initAstronaut();

initModals({ reduceMotion });
initGlassClose();
initNavGlass();
initPressSpring();

/* Фишки (форма, физика, пасхалки…) подключаются отдельно и необязательно:
   если какой-то файл не загрузился, остальной сайт (герой, карусели, модалки) продолжает работать. */
const optional = (path, run) => import(path).then(run).catch((err) => console.warn('[kometa] модуль не загружен:', path, err));

optional('./modules/toast.js?v=5', (m) => m.initCopy());
optional('./modules/form-send.js?v=5', (m) => m.initFormSend());
optional('./modules/live.js?v=5', (m) => m.initLive());
optional('./modules/eggs.js?v=5', (m) => m.initEggs());

// запрет копирования картинок/видео: перетаскивание и контекстное меню (текст копируется как раньше)
document.addEventListener('dragstart', (e) => {
    if (e.target instanceof Element && e.target.closest('img, picture, video, svg, a')) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
    if (e.target instanceof Element && e.target.closest('img, picture, video, canvas, svg')) e.preventDefault();
});
