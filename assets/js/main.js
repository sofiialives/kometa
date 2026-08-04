import { initLoader } from './modules/loader.js';

document.documentElement.classList.remove('no-js');

initLoader({
    loader: document.querySelector('[data-loader]')
});
