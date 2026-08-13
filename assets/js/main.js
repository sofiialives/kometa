import { initLoader } from './modules/loader.js';
import { initMediaProgress } from './modules/media-loader.js';
import { initScreens } from './modules/screens.js';
import { initScrollVideo } from './modules/scroll-video.js';
import { initReveal } from './modules/reveal.js';
import { initNav } from './modules/nav.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

root.classList.remove('no-js');
root.classList.add('js');

const $ = (selector) => document.querySelector(selector);

const loader = initLoader({ loader: $('[data-loader]') });

const screens = initScreens({ root: $('[data-screens]') });

initScrollVideo({
    video: $('[data-scroll-video]'),
    scene: $('[data-video-scene]'),
    holder: $('[data-video-holder]'),
    hint: $('[data-scroll-hint]'),
    screens,
    reduceMotion
});

initMediaProgress({
    video: $('[data-scroll-video]'),
    holder: $('[data-video-holder]'),
    bar: $('[data-loader-bar]'),
    fill: $('[data-loader-fill]'),
    hint: $('[data-loader-hint]'),
    onReady: (reason) => {
        console.info('[kometa] видео готово:', reason);
        loader?.release();
        if (!reduceMotion) screens?.intro();
    }
});

initReveal({ reduceMotion });
initNav();

const videoEl = document.querySelector('[data-scroll-video]');
const videoHolder = document.querySelector('[data-video-holder]');

if (videoEl && videoHolder) {
    const hideVideo = () => videoHolder.classList.add('is-finished');

    videoEl.addEventListener('ended', hideVideo);

    videoEl.addEventListener('timeupdate', () => {
        if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.08) hideVideo();
    });
}

function initAstronaut() {
    const title = document.querySelector('[data-astro-title]');
    if (!title) return;

    const lines = [...title.querySelectorAll('.astronaut__line')];
    if (!lines.length) return;

    const STEP = 60;
    const LINE_PAUSE = 260;
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

    const clearAll = () => {
        chars.forEach((c) => c.el.classList.remove('is-typed'));
    };

    const step = () => {
        if (index >= chars.length) {
            timer = setTimeout(() => {
                clearAll();
                index = 0;
                timer = setTimeout(step, RESTART);
            }, HOLD);
            return;
        }

        const current = chars[index];
        current.el.classList.add('is-typed');
        index += 1;

        timer = setTimeout(step, current.endOfLine ? LINE_PAUSE : STEP);
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
                }
            });
        }, { threshold: 0.25 })
        : null;

    if (observer) observer.observe(title);
    else step();
}

initAstronaut();