/**
 * Мини-физика для «живых» плашек. Один rAF-цикл на весь сайт, спит, когда всё лежит на местах.
 *  • хватаешь мышью (сразу) или пальцем (долгое касание ≈ 160 мс — обычный скролл страницы не страдает);
 *  • бросок передаёт скорость, тела мягко сталкиваются и отскакивают от стен;
 *  • обычный режим: пружина возвращает тело домой; режим невесомости: пружины нет, тела дрейфуют по странице.
 *
 * Плавность и экономия:
 *  • вся геометрия (дом, размеры, рамки) измеряется ОДИН раз при старте цикла, пока все тела лежат на местах;
 *    внутри цикла нет ни одного чтения layout (getBoundingClientRect / getComputedStyle) — нет принудительных reflow;
 *  • шаг фиксированный (1/120 с) и не раздувается на медленных кадрах: слабый телефон не уходит в «спираль»;
 *  • столкновения мягкие (поправка позиции частями, без «щелчка»), мелкие отскоки гасятся — плашки не дрожат;
 *  • движение — только свойство `translate` (GPU), запись только для тел, которые реально двигаются.
 */
const bodies = [];
let raf = 0;
let last = 0;
let acc = 0;
let zeroG = false;
let grabbedCount = 0;
let running = false;
let onBusyChange = null;
let returning = false;         // идёт возврат из невесомости: столкновения и стены не мешают долететь

const K = 105;                 // жёсткость пружины
const ZETA = 0.52;             // затухание (<1 — мягкий «перелёт», но без долгого раскачивания)
const REST = 0.5;              // упругость сильных ударов
const MAX_V = 2400;            // px/с
const PAD = 4;                 // уменьшение коллайдера: наложенные по вёрстке плашки не «толкаются» в покое
const SLOP = 0.6;              // допустимое проникновение, px
const FIX = 1 / 120;           // фиксированный шаг
const HAS_POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

let docBox = { l: 0, t: 0, r: 0, b: 0 };
const boxCache = new Map();
let dirty = true;              // геометрию надо перемерить (ресайз, шрифты) — при следующем старте цикла

/* ---------- геометрия: только когда тела спят ---------- */
function readBase(el) {
    const t = getComputedStyle(el).translate;
    if (!t || t === 'none') return [0, 0];
    const p = t.split(' ').map(parseFloat);
    return [p[0] || 0, p[1] || 0];
}

function measure(b) {
    if (!b.awake) [b.bx, b.by] = readBase(b.el);
    const r = b.el.getBoundingClientRect();
    b.w = r.width;
    b.h = r.height;
    b.cx = r.left + r.width / 2 + scrollX - b.x;      // «домашний» центр в координатах страницы
    b.cy = r.top + r.height / 2 + scrollY - b.y;
    b.measured = true;
}

function measureAll() {
    const de = document.documentElement;
    docBox = { l: 0, t: 0, r: de.clientWidth, b: de.scrollHeight };
    boxCache.clear();
    for (const b of bodies) {
        measure(b);
        if (b.boundsEl && !boxCache.has(b.boundsEl)) {
            const r = b.boundsEl.getBoundingClientRect();
            boxCache.set(b.boundsEl, { l: r.left + scrollX + 2, t: r.top + scrollY + 2, r: r.right + scrollX - 2, b: r.bottom + scrollY - 2 });
        }
    }
    dirty = false;
}

/* ---------- тела ---------- */
function paint(b) {
    const x = Math.round((b.bx + b.x) * 100) / 100;
    const y = Math.round((b.by + b.y) * 100) / 100;
    if (x === b.lx && y === b.ly) return;
    b.lx = x;
    b.ly = y;
    b.el.style.translate = `${x}px ${y}px`;
}


/* ---------- «над всем»: плашка в невесомости переезжает в top layer (popover) — выше любых секций и их слоёв наложения ----------
 * Место в вёрстке занимает невидимый двойник, поэтому соседние плашки не съезжают; координаты — страничные (absolute от начала документа). */
function promote(b) {
    if (!HAS_POPOVER || b.top) return;
    const el = b.el;
    const ow = el.offsetWidth;
    const oh = el.offsetHeight;
    const ph = el.cloneNode(true);
    ph.removeAttribute('id');
    ph.classList.remove('is-live', 'is-phys', 'is-grabbed');
    ph.style.cssText = 'visibility:hidden;pointer-events:none;translate:none;';
    ph.setAttribute('aria-hidden', 'true');
    el.before(ph);
    el.setAttribute('popover', 'manual');
    el.classList.add('zg-top');
    el.style.width = `${ow}px`;
    el.style.height = `${oh}px`;
    try { el.showPopover(); } catch (_) {
        el.removeAttribute('popover');
        el.classList.remove('zg-top');
        el.style.width = el.style.height = '';
        ph.remove();
        return;
    }
    b.ph = ph;
    b.top = true;
    b.bx = b.cx - ow / 2;
    b.by = b.cy - oh / 2;
    b.lx = b.ly = null;
}

function demote(b) {
    if (!b.top) return;
    const el = b.el;
    try { el.hidePopover(); } catch (_) { /* уже закрыт */ }
    el.removeAttribute('popover');
    el.classList.remove('zg-top');
    el.style.width = el.style.height = '';
    b.ph?.remove();
    b.ph = null;
    b.top = false;
    b.bx = b.by = 0;
}

function sleep(b) {
    demote(b);
    b.x = b.y = b.vx = b.vy = 0;
    b.awake = false;
    b.age = 0;
    b.lx = b.ly = null;
    b.el.style.translate = '';
    b.el.style.zIndex = '';
    b.el.classList.remove('is-phys');
}

function wake(b) {
    if (b.awake) return;
    b.awake = true;
    b.age = 0;
    b.el.classList.add('is-phys');
}

function bounds(b) {
    if (zeroG || !b.boundsEl) return docBox;
    return boxCache.get(b.boundsEl) || docBox;
}

/* ---------- шаг симуляции ---------- */
function integrate(dt) {
    const c = 2 * Math.sqrt(K) * ZETA;
    for (const b of bodies) {
        if (!b.awake) continue;
        if (b.grabbed) {
            // тело тянется к пальцу плавной пружиной; столкновения остаются физичными
            let tx = b.px + scrollX - b.cx - b.ox;
            let ty = b.py + scrollY - b.cy - b.oy;
            const w = bounds(b);
            tx = Math.min(w.r - b.w / 2 - b.cx, Math.max(w.l + b.w / 2 - b.cx, tx));
            ty = Math.min(w.b - b.h / 2 - b.cy, Math.max(w.t + b.h / 2 - b.cy, ty));
            const k = 1 - Math.exp(-dt * 30);
            const nx = b.x + (tx - b.x) * k;
            const ny = b.y + (ty - b.y) * k;
            b.vx = (nx - b.x) / dt;
            b.vy = (ny - b.y) / dt;
            b.x = nx;
            b.y = ny;
            continue;
        }
        if (zeroG) {
            if (Math.hypot(b.vx, b.vy) < 14) {            // чтобы не замирало — лёгкий дрейф
                const a = b.seed = (b.seed || Math.random() * 6.28) + dt * 0.4;
                b.vx += Math.cos(a) * 40 * dt;
                b.vy += Math.sin(a) * 40 * dt;
            }
            const d = Math.exp(-dt * 0.12);
            b.vx *= d;
            b.vy *= d;
        } else {
            b.vx += (-K * b.x - c * b.vx) * dt;
            b.vy += (-K * b.y - c * b.vy) * dt;
        }
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }
}

function collide() {
    if (returning) return;
    for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
            const c = bodies[j];
            if (!a.awake && !c.awake) continue;
            if (zeroG) { if (!a.awake || !c.awake) continue; }
            else if (a.boundsEl !== c.boundsEl) continue;
            const dx = (c.cx + c.x) - (a.cx + a.x);
            if (dx > 520 || dx < -520) continue;               // дальнее отсечение
            const dy = (c.cy + c.y) - (a.cy + a.y);
            const pad = zeroG ? 0 : PAD;                        // в невесомости — точный контур, без «подушки»
            const ox = (a.w + c.w) / 2 - pad * 2 - Math.abs(dx);
            const oy = (a.h + c.h) / 2 - pad * 2 - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            // у плашек в вёрстке есть небольшие наложения «дома»: пока оба рядом с домом и никто не схвачен — это не столкновение
            if (!a.grabbed && !c.grabbed && Math.abs(a.x) + Math.abs(a.y) + Math.abs(c.x) + Math.abs(c.y) < 3) continue;
            // удар имеет смысл только сразу после броска/толчка. Через ~секунду свободные плашки, оказавшиеся друг в друге
            // (поменялись местами и пружины тянут их сквозь друг друга), проходят друг сквозь друга домой — без тупика
            if (!zeroG && !a.grabbed && !c.grabbed && a.age > 0.9 && c.age > 0.9) continue;
            if (!a.awake) wake(a);                              // задетое спящее тело просыпается и уезжает тоже
            if (!c.awake) wake(c);
            const horiz = ox < oy;
            const n = horiz ? Math.sign(dx || 1) : Math.sign(dy || 1);
            const pen = (horiz ? ox : oy) - (zeroG ? 0.15 : SLOP);
            const wa = a.grabbed ? 0 : 1;
            const wc = c.grabbed ? 0 : 1;
            const tot = wa + wc;
            if (!tot) continue;
            if (pen > 0) {                                      // позицию поправляем почти целиком, но без рывка на всю глубину
                const fix = pen * (zeroG ? 1 : 0.85);
                if (horiz) { a.x -= n * fix * wa / tot; c.x += n * fix * wc / tot; }
                else { a.y -= n * fix * wa / tot; c.y += n * fix * wc / tot; }
            }
            const va = horiz ? a.vx : a.vy;
            const vc = horiz ? c.vx : c.vy;
            const rel = (vc - va) * n;
            if (rel < 0) {
                const e = zeroG || -rel > 70 ? REST : 0;                 // слабые касания гасим без отскока — плашки не дрожат
                const j2 = -(1 + e) * rel / tot;
                if (horiz) { a.vx -= n * j2 * wa; c.vx += n * j2 * wc; }
                else { a.vy -= n * j2 * wa; c.vy += n * j2 * wc; }
            }
        }
    }
}

/** Стены и засыпание. Возвращает true, если кто-то ещё двигается. */
function settle(dt) {
    let any = false;
    for (const b of bodies) {
        if (!b.awake) continue;
        if (!b.grabbed) {
            const w = bounds(b);
            const hw = b.w / 2;
            const hh = b.h / 2;
            const px = b.cx + b.x;
            const py = b.cy + b.y;
            // тело вне своей рамки (возвращается из невесомости) — стены не трогаем
            const outside = !zeroG && (px < w.l || px > w.r || py < w.t || py > w.b || b.cx - hw < w.l - 1 || b.cx + hw > w.r + 1 || b.cy - hh < w.t - 1 || b.cy + hh > w.b + 1);
            if (!outside) {
                if (px - hw < w.l) { b.x += w.l - (px - hw); b.vx = Math.abs(b.vx) * REST; }
                else if (px + hw > w.r) { b.x -= (px + hw) - w.r; b.vx = -Math.abs(b.vx) * REST; }
                if (py - hh < w.t) { b.y += w.t - (py - hh); b.vy = Math.abs(b.vy) * REST; }
                else if (py + hh > w.b) { b.y -= (py + hh) - w.b; b.vy = -Math.abs(b.vy) * REST; }
            }
        }
        b.age = zeroG || b.grabbed ? 0 : b.age + dt;
        // лёг на место (порог крупнее прежнего — без долгого «дрожания» у нуля) или завис дольше 6 с
        if (!zeroG && !b.grabbed && ((Math.abs(b.x) + Math.abs(b.y) < 0.35 && Math.abs(b.vx) + Math.abs(b.vy) < 6) || b.age > 6)) {
            sleep(b);
            continue;
        }
        any = true;
    }
    return any;
}

function loop(now) {
    raf = 0;
    acc += Math.min(0.05, Math.max(0.001, (now - last) / 1000));   // длинный кадр не раздувает работу
    last = now;
    let steps = 0;
    let any = false;
    while (acc >= FIX && steps < 6) {
        integrate(FIX);
        collide();
        if (zeroG) collide();                                // два прохода: стопка плашек распрямляется без наползания
        any = settle(FIX);
        acc -= FIX;
        steps++;
    }
    if (steps === 6) acc = 0;
    for (const b of bodies) if (b.awake) paint(b);
    if (any || zeroG || grabbedCount) raf = requestAnimationFrame(loop);
    else { running = false; returning = false; onBusyChange?.(false); }
}

function ensureLoop() {
    if (raf) return;
    if (!running) {
        // старт цикла: все тела лежат на местах — единственный момент, когда читаем геометрию
        if (dirty || bodies.some((b) => !b.measured)) measureAll();
        running = true;
        onBusyChange?.(true);
    }
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(loop);
}

/** Регистрирует элемент как физическое тело. */
export function addBody(el, { group = '', boundsEl = null, hold = 160, zgOnly = false } = {}) {
    const b = {
        el, group, boundsEl, zgOnly, awake: false, grabbed: false, measured: false,
        x: 0, y: 0, vx: 0, vy: 0, bx: 0, by: 0, cx: 0, cy: 0, w: 0, h: 0, lx: null, ly: null, age: 0,
        px: 0, py: 0, ox: 0, oy: 0, samples: []
    };
    bodies.push(b);
    if (!zgOnly) el.classList.add('is-live');

    let pid = null;
    let timer = 0;
    let sx = 0;
    let sy = 0;

    const grab = (e) => {
        ensureLoop();                                   // сначала измерения (пока тело спит), потом всё остальное
        wake(b);
        b.grabbed = true;
        grabbedCount++;
        b.px = e.clientX;
        b.py = e.clientY;
        // точка хвата относительно центра тела — тело не «прыгает» под палец
        b.ox = (e.clientX + scrollX) - (b.cx + b.x);
        b.oy = (e.clientY + scrollY) - (b.cy + b.y);
        b.samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
        el.classList.add('is-grabbed');
        el.style.zIndex = '30';
        try { el.setPointerCapture(pid); } catch (_) { /* ok */ }
        if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(8);
    };

    const drop = () => {
        clearTimeout(timer);
        if (!b.grabbed) { pid = null; return; }
        b.grabbed = false;
        grabbedCount = Math.max(0, grabbedCount - 1);
        el.classList.remove('is-grabbed');
        // бросок: скорость по последним ~90 мс движения, чуть приглушённая
        const now = performance.now();
        const s = b.samples.filter((p) => now - p.t < 90);
        if (s.length >= 2) {
            const a = s[0];
            const z = s[s.length - 1];
            const dt = Math.max(16, z.t - a.t) / 1000;
            b.vx = Math.max(-MAX_V, Math.min(MAX_V, (z.x - a.x) / dt)) * 0.85;
            b.vy = Math.max(-MAX_V, Math.min(MAX_V, (z.y - a.y) / dt)) * 0.85;
        } else { b.vx *= 0.4; b.vy *= 0.4; }
        b.age = 0;
        pid = null;
        ensureLoop();
    };

    el.addEventListener('pointerdown', (e) => {
        if (pid !== null || (zgOnly && !zeroG)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pid = e.pointerId;
        sx = e.clientX;
        sy = e.clientY;
        if (e.pointerType === 'mouse') { grab(e); e.preventDefault(); }
        else timer = setTimeout(() => grab(e), hold);       // палец: сначала ждём — вдруг это скролл
    });

    el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pid) return;
        if (!b.grabbed) {
            if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(timer); pid = null; }   // палец поехал — это скролл
            return;
        }
        b.px = e.clientX;
        b.py = e.clientY;
        const t = performance.now();
        b.samples.push({ t, x: e.clientX, y: e.clientY });
        while (b.samples.length > 2 && t - b.samples[0].t > 140) b.samples.shift();
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => el.addEventListener(n, (e) => {
        if (e.pointerId !== undefined && pid !== null && e.pointerId !== pid) return;
        drop();
    }));

    // пока тело схвачено, касание не скроллит страницу. Слушатель — на самой плашке, а не на документе:
    // иначе каждый скролл по всей странице ждёт главный поток
    el.addEventListener('touchmove', (e) => { if (b.grabbed && e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('contextmenu', (e) => { if (b.grabbed || pid !== null) e.preventDefault(); });

    return b;
}

/** Невесомость: пружины выключены, стены — края страницы. */
export function setZeroG(on) {
    if (zeroG === on) return;
    ensureLoop();                                        // геометрия измеряется, пока тела спят
    for (const b of bodies) if (!b.measured) measure(b); // тела, добавленные, пока цикл уже шёл
    zeroG = on;
    returning = !on;
    for (const b of bodies) {
        if (b.zgOnly) b.el.classList.toggle('is-live', on);
        if (on) promote(b);
        wake(b);
        if (on) {
            const a = Math.random() * Math.PI * 2;
            const v = 30 + Math.random() * 50;
            b.vx += Math.cos(a) * v;
            b.vy += Math.sin(a) * v;
        }
    }
}

export const isZeroG = () => zeroG;
export const isBusy = (group) => bodies.some((b) => b.awake && (!group || b.group === group));
export const onBusy = (fn) => { onBusyChange = fn; };

export function initPhysics() {
    let rt = 0;
    const remeasure = () => { dirty = true; };
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(remeasure, 120); });
    addEventListener('orientationchange', remeasure);
    if (document.fonts?.ready) document.fonts.ready.then(remeasure);
    // вкладка ушла в фон во время хвата — отпускаем, чтобы тело не «залипло»
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) bodies.forEach((b) => { if (b.grabbed) { b.grabbed = false; grabbedCount = Math.max(0, grabbedCount - 1); b.el.classList.remove('is-grabbed'); } });
    });
}
