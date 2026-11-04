/* Ленивая подгрузка биомов: картинка ставится, когда блок подходит к экрану (запас ~1,5 экрана),
   предварительно декодируется (без подлага при скролле) и снимается, когда уходит далеко — в памяти одновременно ~3 штуки. */
export function initBiomes() {
    const root = document.querySelector('[data-biomes]');
    if (!root || !('IntersectionObserver' in window)) return;

    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;

    const wide = () => window.matchMedia('(min-width: 1280px)').matches;
    const url = (n) => `./assets/images/biomes/biome-${n}${wide() ? '' : '-m'}.jpg?v=3`;
    const cache = new Map();   // ключ: номер + вариант (широкий/вертикальный)

    const load = (el) => {
        const n = el.dataset.biome + (wide() ? 'w' : 'm');
        el.classList.add('is-src');
        if (cache.get(n)) { el.classList.add('is-on'); return; }
        const img = new Image();
        img.src = url(el.dataset.biome);
        const done = () => { cache.set(n, true); if (el.classList.contains('is-src')) el.classList.add('is-on'); };
        (img.decode ? img.decode() : Promise.reject()).then(done, () => { img.onload = done; if (img.complete) done(); });
    };

    const drop = (el) => el.classList.remove('is-on', 'is-src');

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? load(e.target) : drop(e.target)));
    }, { rootMargin: '150% 0px 150% 0px' });

    root.querySelectorAll('.biome').forEach((el) => io.observe(el));
}
