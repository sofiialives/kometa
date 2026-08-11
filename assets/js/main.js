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