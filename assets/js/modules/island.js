/**
 * Плашка-«остров» сверху (как Dynamic Island): расширяется из капсулы, держится, сворачивается.
 * Используется для формы («Заявка отправлена», ошибки заполнения) и для копирования ([data-copy]).
 * Работает на WAAPI + position:fixed (safe-area учитывается), одинаково в iOS Safari и Chrome Android.
 */
let el = null;
let txt = null;
let ico = null;
let hideTimer = 0;
let anim = null;

const build = () => {
    if (el) return;
    el = document.createElement('div');
    el.className = 'island';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="island__pill"><span class="island__ico" aria-hidden="true"><svg class="i-ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><svg class="i-warn" viewBox="0 0 24 24"><path d="M12 6v7.5"/><path d="M12 18h.01"/></svg></span><span class="island__txt"></span></div>';
    document.body.append(el);
    txt = el.querySelector('.island__txt');
    ico = el.querySelector('.island__ico');
};

export function showIsland(text, { kind = 'ok', ms = 2400 } = {}) {
    build();
    const pill = el.querySelector('.island__pill');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(hideTimer);
    anim?.cancel();

    el.dataset.kind = kind;
    txt.textContent = text;
    el.classList.add('is-on');
    pill.style.width = 'auto';
    const full = pill.getBoundingClientRect().width;
    const from = Math.min(full, 96);

    if (reduce) {
        pill.style.width = '';
        pill.style.opacity = '1';
    } else {
        anim = pill.animate(
            [
                { width: `${from}px`, opacity: 0, transform: 'translateY(-10px) scale(.86)' },
                { width: `${full}px`, opacity: 1, transform: 'translateY(0) scale(1)' }
            ],
            { duration: 560, easing: 'cubic-bezier(.3,1.35,.5,1)', fill: 'both' }
        );
        txt.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 360, delay: 120, easing: 'ease-out', fill: 'backwards' });
    }

    hideTimer = setTimeout(hideIsland, ms);
}

export function hideIsland() {
    if (!el || !el.classList.contains('is-on')) return;
    const pill = el.querySelector('.island__pill');
    const done = () => { el.classList.remove('is-on'); pill.style.width = ''; anim = null; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { anim?.cancel(); done(); return; }
    const w = pill.getBoundingClientRect().width;
    anim?.cancel();
    anim = pill.animate(
        [
            { width: `${w}px`, opacity: 1, transform: 'translateY(0) scale(1)' },
            { width: `${Math.min(w, 96)}px`, opacity: 0, transform: 'translateY(-8px) scale(.9)' }
        ],
        { duration: 340, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
    );
    anim.onfinish = done;
}

const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.append(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_e) { ok = false; }
        ta.remove();
        return ok;
    }
};

export function initIsland() {
    // любой элемент с data-copy="текст" копирует текст и показывает плашку
    document.addEventListener('click', async (e) => {
        const t = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
        if (!t) return;
        e.preventDefault();
        const ok = await copyText(t.dataset.copy);
        showIsland(ok ? 'Скопировано' : 'Не удалось скопировать', { kind: ok ? 'ok' : 'warn', ms: 1800 });
    });

    const form = document.querySelector('[data-form]');
    if (!form) return;
    const val = (n) => (form.elements[n]?.value || '').trim();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!val('name')) {
            showIsland('Укажите имя', { kind: 'warn' });
            form.elements.name.focus({ preventScroll: false });
            return;
        }
        if (!val('telegram') && !val('phone')) {
            showIsland('Оставьте Telegram или телефон', { kind: 'warn' });
            form.elements.telegram.focus({ preventScroll: false });
            return;
        }
        const btn = form.querySelector('[type="submit"]');
        const endpoint = form.dataset.endpoint;
        if (btn) btn.disabled = true;
        try {
            if (endpoint) {
                const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error(String(res.status));
            } else {
                // endpoint не задан: заявка никуда не уходит, плашка показывается как демо (подключите form[data-endpoint])
                console.warn('[kometa] form[data-endpoint] не задан — заявка не отправлена на сервер');
            }
            showIsland('Заявка отправлена', { kind: 'ok', ms: 2800 });
            form.reset();
        } catch (err) {
            showIsland('Не удалось отправить', { kind: 'warn', ms: 3000 });
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}
