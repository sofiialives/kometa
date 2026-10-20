/**
 * Цифры 01/02/03 — тяжёлые стеклянные объекты: при появлении падают на карточку,
 * сплющиваются об неё и отскакивают 2–3 раза с затуханием. Цвет и прозрачность не трогаем —
 * только translate/scale (GPU). Страничные цифры играют один раз, цифры в модалках — при каждом открытии.
 */
const SEL = '.card__num, .case__num, .mcard__num';
const DOWN = 'cubic-bezier(.5,.02,.9,.6)';     // падение: ускорение под действием тяжести
const UP = 'cubic-bezier(.15,.55,.35,1)';      // подъём после удара: мягкое замедление
const BOUNCE = [
    { translate: '0 -120%', scale: '1 1', easing: DOWN },
    { translate: '0 0', scale: '1.05 .93', offset: .32, easing: UP },
    { translate: '0 -20%', scale: '.99 1.02', offset: .48, easing: DOWN },
    { translate: '0 0', scale: '1.025 .97', offset: .62, easing: UP },
    { translate: '0 -7%', scale: '1 1', offset: .74, easing: DOWN },
    { translate: '0 0', scale: '1.01 .99', offset: .84, easing: UP },
    { translate: '0 -2%', scale: '1 1', offset: .92, easing: DOWN },
    { translate: '0 0', scale: '1 1' }
];

export function initNumDrop() {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nums = [...document.querySelectorAll(SEL)];
    const done = new WeakSet();

    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            const el = en.target;
            const inModal = !!el.closest('.modal');
            if (!en.isIntersecting) return;               // уехала из кадра — ничего не сбрасываем: падает один раз за открытие
            if (done.has(el)) return;
            done.add(el);
            el.style.transformOrigin = '50% 100%';
            const play = () => {
                const a = el.animate(BOUNCE, { duration: 2600, fill: 'backwards' });
                el.style.visibility = '';
                a.onfinish = () => { el.style.transformOrigin = ''; };
            };
            // лист модалки ещё выезжает — ждём, пока доедет
            if (inModal) setTimeout(play, 380); else play();
            if (!inModal) io.unobserve(el);
        });
    }, { threshold: 0, rootMargin: '0px 0px -4% 0px' });

    // цифры в модалке снова «заряжаются» только после закрытия окна — при следующем открытии падают заново
    document.querySelectorAll('.modal').forEach((m) => {
        new MutationObserver(() => {
            if (m.classList.contains('is-open') && !m.hidden) return;
            m.querySelectorAll(SEL).forEach((el) => { done.delete(el); el.style.visibility = 'hidden'; });
        }).observe(m, { attributes: true, attributeFilter: ['class', 'hidden'] });
    });

    nums.forEach((el) => {
        const r = el.getBoundingClientRect();
        const onScreen = r.top < innerHeight * .92 && r.bottom > 0 && r.left < innerWidth && r.right > 0 && !el.closest('.modal');
        if (!onScreen) el.style.visibility = 'hidden';       // чтобы цифра не мигала на месте до начала падения
        io.observe(el);
    });

    // страховка: если наблюдатель не сработал — через 8 с показываем всё
    setTimeout(() => nums.forEach((el) => { if (!el.closest('.modal')) el.style.visibility = ''; }), 8000);
}
