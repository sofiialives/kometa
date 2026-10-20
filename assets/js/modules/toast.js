/**
 * Короткое сообщение внизу экрана (подтверждение отправки, «Секрет найден», «Скопировано»).
 * Обычная карточка, без «острова». WAAPI, safe-area учитывается, одно сообщение за раз.
 */
let box = null;
let card = null;
let txt = null;
let timer = 0;
let anim = null;

const ICON = {
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 6v7.5"/><path d="M12 18h.01"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M12 7v.01M12 11.5V17"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 4l2.2 5.1 5.5.5-4.2 3.7 1.3 5.4L12 15.8 7.2 18.7l1.3-5.4L4.3 9.6l5.5-.5z"/></svg>'
};

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function build() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<div class="toast__card"><span class="toast__ico" aria-hidden="true"></span><span class="toast__txt"></span></div>';
    document.body.append(box);
    card = box.firstElementChild;
    txt = box.querySelector('.toast__txt');
}

export function showToast(text, { kind = 'ok', ms = 2600 } = {}) {
    build();
    clearTimeout(timer);
    anim?.cancel();
    box.dataset.kind = kind;
    box.querySelector('.toast__ico').innerHTML = ICON[kind] || ICON.ok;
    txt.textContent = text;
    box.classList.add('is-on');
    if (!reduced()) {
        anim = card.animate(
            [{ opacity: 0, transform: 'translateY(-20px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
            { duration: 460, easing: 'cubic-bezier(.22,1.2,.4,1)', fill: 'both' }
        );
    }
    timer = setTimeout(hideToast, ms);
}

export function hideToast() {
    if (!box || !box.classList.contains('is-on')) return;
    const done = () => { box.classList.remove('is-on'); anim = null; };
    if (reduced()) { done(); return; }
    anim?.cancel();
    anim = card.animate(
        [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-12px) scale(.97)' }],
        { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
    );
    anim.onfinish = done;
}

/** Копирование по [data-copy] — тем же сообщением. */
export function initCopy() {
    document.addEventListener('click', async (e) => {
        const t = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
        if (!t) return;
        e.preventDefault();
        let ok = false;
        try { await navigator.clipboard.writeText(t.dataset.copy); ok = true; } catch (_) { ok = false; }
        showToast(ok ? 'Скопировано' : 'Не удалось скопировать', { kind: ok ? 'ok' : 'warn', ms: 1800 });
    });
}
