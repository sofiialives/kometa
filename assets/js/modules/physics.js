/**
 * Мини-физика для «живых» плашек и логотипов. Один rAF-цикл на весь сайт, спит, когда всё лежит на местах.
 *  • хватаешь мышью (сразу) или пальцем (долгое касание ≈ 160 мс — обычный скролл страницы не страдает);
 *  • бросок передаёт скорость, тела сталкиваются (AABB-отталкивание с упругостью) и отскакивают от стен;
 *  • обычный режим: пружина возвращает тело на место; режим невесомости: пружины нет, тела дрейфуют по всей странице.
 * Движение — только свойство `translate` (GPU), позиции читаются при захвате/смене режима, а не каждый кадр.
 */
const bodies = [];
let raf = 0;
let last = 0;
let zeroG = false;
let grabbedCount = 0;
let onBusyChange = null;

const K = 90;                  // жёсткость пружины
const ZETA = 0.34;             // затухание пружины (<1 — с «перелётом»)
const REST = 0.58;             // упругость столкновений
const MAX_V = 2600;            // px/с
const PAD = 4;                 // уменьшение коллайдера, чтобы наложенные по вёрстке плашки не «толкались» в покое

let docBox = { l: 0, t: 0, r: 0, b: 0 };
const boxCache = new Map();
let returning = false;         // идёт возврат из невесомости: столкновения и стены не мешают долететь

/** Границы читаем один раз за кадр (а не на каждый шаг/тело) — иначе принудительные reflow дают лаги. */
function refreshBounds() {
    const de = document.documentElement;
    docBox = { l: 0, t: 0, r: de.clientWidth, b: de.scrollHeight };
    boxCache.clear();
    for (const b of bodies) {
        if (!b.awake || !b.boundsEl || boxCache.has(b.boundsEl)) continue;
        const r = b.boundsEl.getBoundingClientRect();
        boxCache.set(b.boundsEl, { l: r.left + scrollX + 2, t: r.top + scrollY + 2, r: r.right + scrollX - 2, b: r.bottom + scrollY - 2 });
    }
}

function readBase(el) {
    const t = getComputedStyle(el).translate;
    if (!t || t === 'none') return [0, 0];
    const p = t.split(' ').map(parseFloat);
    return [p[0] || 0, p[1] || 0];
}

function measure(b) {
    // «домашний» центр в координатах страницы: текущий rect минус смещение физики
    const r = b.el.getBoundingClientRect();
    b.w = r.width;
    b.h = r.height;
    b.cx = r.left + r.width / 2 + scrollX - b.x;
    b.cy = r.top + r.height / 2 + scrollY - b.y;
}

function paint(b) {
    b.el.style.translate = `${(b.bx + b.x).toFixed(2)}px ${(b.by + b.y).toFixed(2)}px`;
}

function sleep(b) {
    b.x = b.y = b.vx = b.vy = 0;
    b.awake = false;
    b.el.style.translate = '';
    b.el.style.zIndex = '';
    b.el.classList.remove('is-phys');
}

function wake(b) {
    if (!b.awake) {
        [b.bx, b.by] = readBase(b.el);
        measure(b);
        b.awake = true;
        b.el.classList.add('is-phys');
    }
    ensureLoop();
}

function bounds(b) {
    if (zeroG || !b.boundsEl) return docBox;
    return boxCache.get(b.boundsEl) || docBox;
}

/** Измеряем «домашний» прямоугольник спящего тела (один раз за запуск цикла). */
function probe(b) {
    if (b.measured) return;
    b.measured = true;
    [b.bx, b.by] = readBase(b.el);
    measure(b);
}

function step(dt) {
    const w2 = 2 * Math.sqrt(K) * ZETA;
    for (const b of bodies) {
        if (!b.awake) continue;
        if (b.grabbed) {
            // тело тянется к пальцу жёсткой пружиной — столкновения остаются физичными
            let tx = b.px + scrollX - b.cx - b.ox;
            let ty = b.py + scrollY - b.cy - b.oy;
            const w = bounds(b);                                   // палец может уйти дальше рамки — тело остаётся внутри
            tx = Math.min(w.r - b.w / 2 - b.cx, Math.max(w.l + b.w / 2 - b.cx, tx));
            ty = Math.min(w.b - b.h / 2 - b.cy, Math.max(w.t + b.h / 2 - b.cy, ty));
            const nx = b.x + (tx - b.x) * Math.min(1, dt * 28);
            const ny = b.y + (ty - b.y) * Math.min(1, dt * 28);
            b.vx = (nx - b.x) / dt;
            b.vy = (ny - b.y) / dt;
            b.x = nx;
            b.y = ny;
            continue;
        }
        if (zeroG) {
            const sp = Math.hypot(b.vx, b.vy);
            if (sp < 14) {            // чтобы не замирало — лёгкий дрейф
                const a = b.seed = (b.seed || Math.random() * 6.28) + dt * 0.4;
                b.vx += Math.cos(a) * 40 * dt;
                b.vy += Math.sin(a) * 40 * dt;
            }
            const d = Math.exp(-dt * 0.12);
            b.vx *= d;
            b.vy *= d;
        } else {
            // пружина домой; издалека (после невесомости) ограничиваем скорость, чтобы не «стреляло»
            b.vx += (-K * b.x - w2 * b.vx) * dt;
            b.vy += (-K * b.y - w2 * b.vy) * dt;
        }
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }

    // столкновения (в том числе со «спящими» телами: задетое тело просыпается и тоже улетает)
    for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
            const c = bodies[j];
            if (!a.awake && !c.awake) continue;
            if (a.boundsEl !== c.boundsEl && !zeroG) continue;
            if (zeroG && (!a.awake || !c.awake)) continue;
            if (!a.awake) probe(a);
            if (!c.awake) probe(c);
            if (!zeroG && Math.abs(a.x) + Math.abs(a.y) + Math.abs(c.x) + Math.abs(c.y) < 3) continue;
            if (returning) continue;
            if (!a.awake || !c.awake) {                          // спящее тело: просыпаемся только при реальном касании
                const sa = a.awake ? c : a;
                const sb = a.awake ? a : c;
                const ddx = Math.abs((sa.cx) - (sb.cx + sb.x));
                const ddy = Math.abs((sa.cy) - (sb.cy + sb.y));
                if (ddx >= (sa.w + sb.w) / 2 - PAD * 2 || ddy >= (sa.h + sb.h) / 2 - PAD * 2) continue;
                wake(sa);
            }
            const dx = (c.cx + c.x) - (a.cx + a.x);
            if (dx > 520 || dx < -520) continue;                 // дальнее отсечение: далёкие тела не проверяем
            const dy = (c.cy + c.y) - (a.cy + a.y);
            const ox = (a.w + c.w) / 2 - PAD * 2 - Math.abs(dx);
            const oy = (a.h + c.h) / 2 - PAD * 2 - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            const horiz = ox < oy;
            const n = horiz ? Math.sign(dx || 1) : Math.sign(dy || 1);
            const pen = horiz ? ox : oy;
            const wa = a.grabbed ? 0 : 1;
            const wc = c.grabbed ? 0 : 1;
            const tot = wa + wc || 1;
            if (horiz) { a.x -= n * pen * wa / tot; c.x += n * pen * wc / tot; }
            else { a.y -= n * pen * wa / tot; c.y += n * pen * wc / tot; }
            const va = horiz ? a.vx : a.vy;
            const vc = horiz ? c.vx : c.vy;
            const rel = (vc - va) * n;
            if (rel < 0) {
                const j2 = -(1 + REST) * rel / tot;
                if (horiz) { a.vx -= n * j2 * wa; c.vx += n * j2 * wc; }
                else { a.vy -= n * j2 * wa; c.vy += n * j2 * wc; }
            }
        }
    }

    // стены и сон
    let any = false;
    for (const b of bodies) {
        if (!b.awake) continue;
        if (!b.grabbed) {
            const w = bounds(b);
            const hw = b.w / 2;
            const hh = b.h / 2;
            const px = b.cx + b.x;
            const py = b.cy + b.y;
            // тело вне своей рамки (возвращается из невесомости) — стены не трогаем, пусть долетит пружиной
            const outside = !zeroG && (px < w.l || px > w.r || py < w.t || py > w.b || b.cx - hw < w.l - 1 || b.cx + hw > w.r + 1 || b.cy - hh < w.t - 1 || b.cy + hh > w.b + 1);
            if (outside) { /* пропуск */ }
            else if (px - hw < w.l) { b.x += w.l - (px - hw); b.vx = Math.abs(b.vx) * REST; }
            else if (px + hw > w.r) { b.x -= (px + hw) - w.r; b.vx = -Math.abs(b.vx) * REST; }
            if (outside) { /* пропуск */ }
            else if (py - hh < w.t) { b.y += w.t - (py - hh); b.vy = Math.abs(b.vy) * REST; }
            else if (py + hh > w.b) { b.y -= (py + hh) - w.b; b.vy = -Math.abs(b.vy) * REST; }
        }
        // страховка: если за 10 с пружина так и не уложила тело (редкие застревания) — возвращаем на место принудительно
        b.age = zeroG || b.grabbed ? 0 : (b.age || 0) + dt;
        if (!zeroG && !b.grabbed && ((Math.abs(b.x) + Math.abs(b.y) < 0.08 && Math.abs(b.vx) + Math.abs(b.vy) < 3) || b.age > 10)) {
            sleep(b);
            continue;
        }
        paint(b);
        any = true;
    }
    return any;
}

function loop(now) {
    raf = 0;
    const dt = Math.min(1 / 6, Math.max(0.001, (now - last) / 1000));   // на медленных кадрах симуляция не «тормозит» — просто шагов больше
    last = now;
    const n = Math.max(2, Math.ceil(dt * 120));
    refreshBounds();
    let any = false;
    for (let i = 0; i < n; i++) any = step(dt / n);
    if (any || zeroG || grabbedCount) raf = requestAnimationFrame(loop);
    else { returning = false; onBusyChange?.(false); }
}

function ensureLoop() {
    if (raf) return;
    for (const b of bodies) b.measured = false;
    last = performance.now();
    onBusyChange?.(true);
    raf = requestAnimationFrame(loop);
}

/** Регистрирует элемент как физическое тело. */
export function addBody(el, { group = '', boundsEl = null, hold = 160, zgOnly = false } = {}) {
    const b = {
        el, group, boundsEl, zgOnly, awake: false, grabbed: false,
        x: 0, y: 0, vx: 0, vy: 0, bx: 0, by: 0, cx: 0, cy: 0, w: 0, h: 0,
        px: 0, py: 0, ox: 0, oy: 0, samples: []
    };
    bodies.push(b);
    if (!zgOnly) el.classList.add('is-live');

    let pid = null;
    let timer = 0;
    let sx = 0;
    let sy = 0;

    const grab = (e) => {
        wake(b);
        measure(b);
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
        ensureLoop();
    };

    const drop = () => {
        clearTimeout(timer);
        if (!b.grabbed) { pid = null; return; }
        b.grabbed = false;
        grabbedCount = Math.max(0, grabbedCount - 1);
        el.classList.remove('is-grabbed');
        // бросок: скорость по последним ~90 мс движения
        const now = performance.now();
        const s = b.samples.filter((p) => now - p.t < 90);
        if (s.length >= 2) {
            const a = s[0];
            const z = s[s.length - 1];
            const dt = Math.max(16, z.t - a.t) / 1000;
            b.vx = Math.max(-MAX_V, Math.min(MAX_V, (z.x - a.x) / dt));
            b.vy = Math.max(-MAX_V, Math.min(MAX_V, (z.y - a.y) / dt));
        } else { b.vx *= 0.4; b.vy *= 0.4; }
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
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('contextmenu', (e) => { if (b.grabbed || pid !== null) e.preventDefault(); });

    return b;
}

/** Невесомость: пружины выключены, стены — края страницы. */
export function setZeroG(on) {
    if (zeroG === on) return;
    zeroG = on;
    returning = !on;
    for (const b of bodies) {
        if (b.zgOnly) b.el.classList.toggle('is-live', on);
        if (!b.awake) wake(b);
        if (on) {
            const a = Math.random() * Math.PI * 2;
            const v = 30 + Math.random() * 50;
            b.vx += Math.cos(a) * v;
            b.vy += Math.sin(a) * v;
        }
    }
    ensureLoop();
}

export const isZeroG = () => zeroG;
export const isBusy = (group) => bodies.some((b) => b.awake && (!group || b.group === group));
export const onBusy = (fn) => { onBusyChange = fn; };

/** Пока что-то схвачено, касание не должно скроллить страницу. */
export function initPhysics() {
    document.addEventListener('touchmove', (e) => { if (grabbedCount && e.cancelable) e.preventDefault(); }, { passive: false });
    let rt = 0;
    addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => bodies.forEach((b) => { if (b.awake) measure(b); }), 120);
    });
}
