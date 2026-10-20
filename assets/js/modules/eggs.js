/**
 * Пасхалки:
 *  1) потянуть страницу за самый низ (колесо / палец, на iPhone — bounce) — из-под края выглядывает космонавт;
 *  2) заголовок вкладки меняется, когда уходишь, и когда возвращаешься.
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. космонавт из-под подвала ---------- */
function initPeek() {
    const el = document.createElement('div');
    el.className = 'peek';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="peek__body"><span class="peek__bubble">Это конец страницы — дальше только космос 🚀</span><img src="./assets/images/astronaut.png" width="1200" height="570" alt="" draggable="false"></div>';
    document.body.append(el);

    const R = 130;               // «натяжка» в px, при которой космонавт вылезает целиком
    let pull = 0;
    let p = 0;                   // 0..1 — высота выглядывания (сглаженная)
    let shown = false;           // вылез целиком: машет и держится недолго
    let hold = 0;
    let raf = 0;
    let last = 0;
    let lastWheel = 0;
    let lastScroll = performance.now();
    let pulling = false;
    let touchArmed = false;
    let ty = 0;

    const atBottom = () => scrollY >= document.documentElement.scrollHeight - innerHeight - 2;

    const render = () => {
        const e = p * p * (3 - 2 * p);
        el.style.setProperty('--p', e.toFixed(4));
        el.classList.toggle('is-wave', shown);
        el.classList.toggle('is-on', p > 0.004);
    };

    const hide = () => { shown = false; pull = 0; clearTimeout(hold); kick(); };

    const tick = (now) => {
        raf = 0;
        const dt = Math.min(48, now - last) || 16;
        last = now;
        if (!shown && p > .985 && pull >= R) {
            shown = true;
            if (navigator.vibrate) navigator.vibrate(10);
            clearTimeout(hold);
            hold = setTimeout(hide, 1700);            // недолго: показался, помахал и уходит
        }
        if (!shown && now - lastWheel > 140 && !touchArmed) pull = Math.max(0, pull - dt * .12);   // отпустили — плавно оседает
        const target = shown ? 1 : Math.min(1, pull / R);
        const k = target > p ? 160 : 260;             // вылезает чуть быстрее, прячется мягче
        p += (target - p) * (1 - Math.exp(-dt / k));
        if (Math.abs(target - p) < .001) p = target;
        render();
        if (p > 0 || pull > 0 || shown) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

    // страница доехала до низа и стоит — тогда следующий «потяг» считается пасхалкой (а не хвост того же скролла)
    addEventListener('scroll', () => {
        lastScroll = performance.now();
        if ((p > 0 || shown) && !atBottom() && document.documentElement.scrollHeight - innerHeight - scrollY > 6) hide();   // листаем назад — космонавт плавно уходит
    }, { passive: true });

    addEventListener('wheel', (e) => {
        const now = performance.now();
        const gap = now - lastWheel;
        lastWheel = now;
        if (e.deltaY < 0) { if (p > 0 || shown) hide(); pulling = false; return; }
        if (gap > 260) pulling = atBottom() && now - lastScroll > 350 && !document.body.classList.contains('is-locked');
        if (!pulling || !atBottom() || shown) return;
        pull = Math.min(R * 1.15, pull + e.deltaY * .5);
        kick();
    }, { passive: true });

    addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; touchArmed = atBottom() && performance.now() - lastScroll > 350; }, { passive: true });
    addEventListener('touchmove', (e) => {
        if (!touchArmed || shown) return;
        const dy = ty - e.touches[0].clientY;
        if (dy > 0 && atBottom()) {
            pull = Math.min(R * 1.15, Math.max(pull, dy * .9));
            kick();
        }
    }, { passive: true });
    addEventListener('touchend', () => { touchArmed = false; lastWheel = performance.now() - 200; kick(); }, { passive: true });
}

/* ---------- 3. заголовок вкладки ---------- */
function initTitle() {
    const original = document.title;
    let t = 0;
    document.addEventListener('visibilitychange', () => {
        clearTimeout(t);
        if (document.hidden) {
            document.title = 'Вернись, мы на орбите 🚀';
        } else {
            document.title = 'Ура, ты здесь';
            t = setTimeout(() => { document.title = original; }, 2600);
        }
    });
}

export function initEggs() {
    initPeek();
    initTitle();
}
