import { initLoader } from './modules/loader.js';
import { initScrollVideo } from './modules/scroll-video.js';
import { initReveal } from './modules/reveal.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

initLoader({
    loader: document.querySelector('[data-loader]')
});

initScrollVideo({
    video: document.querySelector('[data-scroll-video]'),
    scene: document.querySelector('[data-video-scene]'),
    holder: document.querySelector('[data-video-holder]'),
    reduceMotion
});

initReveal({ reduceMotion });
