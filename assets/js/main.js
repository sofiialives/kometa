import { initMenu } from './modules/menu.js';
import { initIntro } from './modules/intro.js';
import { initReveal } from './modules/reveal.js';
import { initStarfield } from './modules/starfield.js';
import { initLoader } from './modules/loader.js';
import { initModal } from './modules/modal.js';
import { initNetworkStatus } from './modules/network.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.remove('no-js');

initLoader({
    loader: document.querySelector('[data-loader]'),
    reduceMotion
});

initMenu({
    toggle: document.querySelector('[data-menu-toggle]'),
    nav: document.querySelector('[data-menu]')
});

initIntro({
    scene: document.querySelector('[data-intro]'),
    earth: document.querySelector('[data-intro-earth]'),
    reduceMotion
});

document.querySelectorAll('[data-starfield]').forEach((canvas) => {
    initStarfield({ canvas, reduceMotion });
});

initReveal({ reduceMotion });

initModal({
    modal: document.querySelector('[data-modal]'),
    openers: [...document.querySelectorAll('[data-modal-open]')],
    form: document.querySelector('[data-form]')
});

initNetworkStatus({
    banner: document.querySelector('[data-offline]')
});
