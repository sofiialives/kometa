/**
 * Раз в 20 секунд по странице пролетает комета (картинка comet-left.png).
 * Привязана к месту страницы, где стартовала: если листать, она остаётся там и уезжает вместе с контентом.
 * Только transform + opacity; не летит в фоновой вкладке, во время вступительного видео и при reduced-motion.
 */
const EVERY = 20000;

export function initAmbientComet() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layer = document.createElement('div');
    layer.className = 'ambient-layer';
    layer.setAttribute('aria-hidden', 'true');
    const img = new Image();
    img.src = './assets/images/comet-left.png';
    img.alt = '';
    img.decoding = 'async';
    img.className = 'ambient-comet';
    layer.append(img);
    document.body.append(layer);

    const fly = () => {
        if (document.hidden || document.body.classList.contains('is-locked')) return;
        const doc = document.documentElement;
        const w = innerWidth;
        const h = innerHeight;
        const size = Math.max(200, Math.min(380, w * .26));          // ширина картинки
        const fromRight = Math.random() < .5;
        const dir = fromRight ? -1 : 1;
        // голова на картинке справа-снизу (летит вправо-вниз); для полёта влево зеркалим
        const sx = fromRight ? w + size * .1 : -size * 1.05;
        const sy = scrollY + h * (.05 + Math.random() * .3);
        const dx = dir * (w + size * 1.2);
        const dy = (w + size * 1.2) * .52;
        layer.style.height = `${doc.scrollHeight}px`;
        img.style.width = `${size}px`;
        img.style.display = 'block';
        const flip = fromRight ? ' scaleX(-1)' : '';
        const a = img.animate(
            [
                { transform: `translate(${sx}px,${sy}px)${flip}`, opacity: 0 },
                { transform: `translate(${sx + dx * .12}px,${sy + dy * .12}px)${flip}`, opacity: .95, offset: .12 },
                { transform: `translate(${sx + dx * .85}px,${sy + dy * .85}px)${flip}`, opacity: .95, offset: .82 },
                { transform: `translate(${sx + dx}px,${sy + dy}px)${flip}`, opacity: 0 }
            ],
            { duration: 3200, easing: 'cubic-bezier(.4,.05,.6,1)' }
        );
        a.onfinish = () => { img.style.display = 'none'; };
    };

    setInterval(fly, EVERY);
}
