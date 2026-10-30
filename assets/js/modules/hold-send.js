/**
 * Отправка зажатием: кнопка «заряжается» кольцом и заливкой, пока её держат (1,5 с).
 * Отпустил после полного заряда — с кнопки улетает комета и появляется подтверждение.
 * Отпустил раньше — заряд плавно сбрасывается, случайной отправки не бывает.
 * Клавиатура: Enter/Space удерживаются так же. Pointer-capture — отпускание за пределами кнопки не теряется.
 */
import { showToast } from './toast.js?v=6';

const HOLD_MS = 1500;

export function initHoldSend() {
    const form = document.querySelector('[data-form]');
    const btn = form?.querySelector('.btn-send');
    if (!form || !btn) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const val = (n) => (form.elements[n]?.value || '').trim();
    let active = false;
    let charged = false;
    let busy = false;
    let t0 = 0;
    let raf = 0;
    let level = 0;
    let drainAnim = 0;

    const set = (v) => { level = v; btn.style.setProperty('--hold', v.toFixed(3)); };

    const loop = (now) => {
        raf = 0;
        if (!active) return;
        const k = Math.min(1, (now - t0) / HOLD_MS);
        set(0.5 - Math.cos(Math.PI * k) / 2);       // заряд идёт по синусоиде: плавный старт и финиш
        if (k >= 1 && !charged) {
            charged = true;
            btn.classList.add('is-charged');
            if (navigator.vibrate) navigator.vibrate(14);
        }
        if (k < 1) raf = requestAnimationFrame(loop);
    };

    const drain = () => {
        cancelAnimationFrame(drainAnim);
        btn.classList.remove('is-charged', 'is-holding');
        const from = level;
        const s = performance.now();
        const step = (now) => {
            const k = Math.min(1, (now - s) / 520);
            set(from * (1 - k * k * (3 - 2 * k)));
            if (k < 1) drainAnim = requestAnimationFrame(step);
        };
        if (from > 0) drainAnim = requestAnimationFrame(step);
    };

    const start = () => {
        if (busy || active) return;
        cancelAnimationFrame(drainAnim);
        active = true;
        charged = false;
        t0 = performance.now();
        set(0);
        btn.classList.add('is-holding');
        raf = requestAnimationFrame(loop);
    };

    const flyComet = () => {
        if (reduce.matches) return Promise.resolve();
        const r = btn.getBoundingClientRect();
        const c = document.createElement('div');
        c.className = 'send-comet';
        c.innerHTML = '<i></i>';
        c.style.left = `${r.left + r.width / 2}px`;
        c.style.top = `${r.top + r.height / 2}px`;
        document.body.append(c);
        const dx = innerWidth * .62;
        const dy = -Math.min(innerHeight * .8, 620);
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const a = c.animate(
            [
                { transform: `translate(-50%,-50%) rotate(${ang}deg) scale(.4)`, opacity: 0 },
                { transform: `translate(calc(-50% + ${dx * .06}px), calc(-50% + ${dy * .06}px)) rotate(${ang}deg) scale(1)`, opacity: 1, offset: .12 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${ang}deg) scale(1.1)`, opacity: 1, offset: .9 },
                { transform: `translate(calc(-50% + ${dx * 1.08}px), calc(-50% + ${dy * 1.08}px)) rotate(${ang}deg) scale(1.1)`, opacity: 0 }
            ],
            { duration: 1050, easing: 'cubic-bezier(.5,0,.75,.55)' }
        );
        return a.finished.catch(() => {}).then(() => c.remove());
    };

    const send = async () => {
        const endpoint = form.dataset.endpoint;
        if (!endpoint) {
            // endpoint не задан: заявка никуда не уходит, подтверждение показывается как демо (подключите form[data-endpoint])
            console.warn('[kometa] form[data-endpoint] не задан — заявка не отправлена на сервер');
            return;
        }
        const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
    };

    const fire = async () => {
        if (!val('name')) {
            drain();
            showToast('Укажите имя', { kind: 'warn' });
            form.elements.name.focus();
            return;
        }
        if (!val('telegram') && !val('phone')) {
            drain();
            showToast('Оставьте Telegram или телефон', { kind: 'warn' });
            form.elements.telegram.focus();
            return;
        }
        busy = true;
        btn.disabled = true;
        const request = send().then(() => true, () => false);
        const [ok] = await Promise.all([request, flyComet()]);
        busy = false;
        btn.disabled = false;
        drain();
        if (ok) {
            form.reset();
            showToast('Заявка отправлена', { kind: 'ok', ms: 3000 });
        } else {
            showToast('Не удалось отправить', { kind: 'warn', ms: 3200 });
        }
    };

    const release = () => {
        if (!active) return;
        active = false;
        cancelAnimationFrame(raf);
        raf = 0;
        if (charged) fire();
        else {
            drain();
            showToast('Удерживайте кнопку, чтобы отправить', { kind: 'hint', ms: 2200 });
        }
    };

    btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        start();
    });
    ['pointerup', 'pointercancel'].forEach((n) => btn.addEventListener(n, release));
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());

    btn.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); }
    });
    btn.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); release(); }
    });
    btn.addEventListener('blur', () => { if (active) { active = false; cancelAnimationFrame(raf); drain(); } });

    // клик и обычная отправка формы (Enter в поле) не отправляют заявку — только зажатие
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.detail === 0 && !busy) showToast('Чтобы отправить, удерживайте кнопку', { kind: 'hint', ms: 2400 });   // Enter в поле формы
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Чтобы отправить, удерживайте кнопку', { kind: 'hint', ms: 2400 });
    });
}
