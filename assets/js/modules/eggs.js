/**
 * Пасхалки:
 *  1) 7 быстрых нажатий на логотип — он рассыпается на частицы и собирается обратно, сообщение «Секрет найден»;
 *  2) потянуть страницу за самый низ (колесо / палец, на iPhone — bounce) — из-под края выглядывает космонавт;
 *  3) заголовок вкладки меняется, когда уходишь, и когда возвращаешься.
 */
import { showToast } from './toast.js';
import { scrollToY } from './smooth-scroll.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. логотип ---------- */
function initLogo() {
    const link = document.querySelector('.logo');
    const img = link?.querySelector('img');
    if (!link || !img) return;
    let taps = 0;
    let timer = 0;
    let busy = false;

    const dissolve = () => {
        if (busy) return;
        busy = true;
        const r = img.getBoundingClientRect();
        const W = Math.round(r.width);
        const H = Math.round(r.height);
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const octx = off.getContext('2d', { willReadFrequently: true });
        let data;
        try {
            octx.drawImage(img, 0, 0, W, H);
            data = octx.getImageData(0, 0, W, H).data;
        } catch (_) { data = null; }              // canvas «испорчен» (file://) — просто сообщение
        if (!data || reduced()) {
            showToast('Секрет найден', { kind: 'star', ms: 2800 });
            busy = false;
            return;
        }
        const step = W > 160 ? 3 : 2;
        const parts = [];
        for (let y = 0; y < H; y += step) {
            for (let x = 0; x < W; x += step) {
                const i = (y * W + x) * 4;
                if (data[i + 3] < 60) continue;
                const a = Math.random() * 6.283;
                const sp = 90 + Math.random() * 300;
                parts.push({ hx: x, hy: y, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, c: `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${(data[i + 3] / 255).toFixed(2)})` });
            }
        }
        const pad = 160;
        const cv = document.createElement('canvas');
        const dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = (W + pad * 2) * dpr;
        cv.height = (H + pad * 2) * dpr;
        cv.style.cssText = `position:fixed;left:${r.left - pad}px;top:${r.top - pad}px;width:${W + pad * 2}px;height:${H + pad * 2}px;z-index:1250;pointer-events:none`;
        document.body.append(cv);
        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
        img.style.visibility = 'hidden';

        const t0 = performance.now();
        let last = t0;
        const frame = (now) => {
            const dt = Math.min(0.033, (now - last) / 1000);
            last = now;
            const t = now - t0;
            ctx.clearRect(0, 0, cv.width, cv.height);
            let settled = 0;
            for (const p of parts) {
                if (t < 650) {                         // взрыв с затуханием
                    p.vx *= Math.exp(-dt * 2.2);
                    p.vy *= Math.exp(-dt * 2.2);
                } else {                               // сборка пружиной
                    p.vx += ((p.hx - p.x) * 70 - p.vx * 9.5) * dt;
                    p.vy += ((p.hy - p.y) * 70 - p.vy * 9.5) * dt;
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (t >= 650 && Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) < .6 && Math.abs(p.vx) + Math.abs(p.vy) < 14) settled++;
                ctx.fillStyle = p.c;
                ctx.fillRect(pad + p.x, pad + p.y, step, step);
            }
            if (settled < parts.length * .985 && t < 3200) { requestAnimationFrame(frame); return; }
            cv.remove();
            img.style.visibility = '';
            busy = false;
        };
        requestAnimationFrame(frame);
        setTimeout(() => showToast('Секрет найден', { kind: 'star', ms: 2800 }), 900);
    };

    link.addEventListener('click', (e) => {
        e.preventDefault();
        taps++;
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (taps < 7) scrollToY(0);                  // обычный клик по логотипу — мягко наверх
            taps = 0;
        }, 650);
        if (taps >= 7) { taps = 0; clearTimeout(timer); dissolve(); }
    });
}

/* ---------- 2. космонавт из-под подвала ---------- */
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
    initLogo();
    initPeek();
    initTitle();
}
