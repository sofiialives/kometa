/**
 * Статьи: рисует карточки из assets/data/articles.js.
 *  [data-articles-list]            — контейнер карточек; data-limit="3" — показать первые N (главная)
 *  [data-articles-filters]         — сайдбар фильтров (страница статей)
 *  [data-articles-search]          — поле поиска по заголовку/подзаголовку
 *  [data-articles-empty]           — «ничего не найдено»
 * Клик по карточке: если у статьи есть url — переход, иначе событие `article:open`
 * (detail: { id, article }) на document — к нему позже подключается модалка.
 */
import { articles, categories } from '../../data/articles.js?v=1';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cardHTML = (a) => `
<li class="acard-wrap" data-cat="${esc(a.cat)}">
    <a class="acard" href="${a.url ? esc(a.url) : '#' + esc(a.id)}" data-article-id="${esc(a.id)}">
        <span class="acard__media">
            <img src="${esc(a.image)}" width="343" height="204" alt="" loading="lazy" decoding="async">
            <time class="acard__date">${esc(a.date)}</time>
        </span>
        <span class="acard__title title-gradient">${esc(a.title)}</span>
        <span class="acard__sub">${esc(a.subtitle)}</span>
    </a>
</li>`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- кастомный скроллбар списка (десктоп): трек + бегунок, тянется мышью/пальцем ---------- */
function initScrollbar(list, track) {
    const thumb = track.querySelector('.ascroll__thumb');
    if (!thumb) return () => {};
    let drag = null;

    const update = () => {
        const sh = list.scrollHeight;
        const ch = list.clientHeight;
        const can = sh > ch + 1;
        track.hidden = !can;                                  // сначала показываем, иначе у скрытого трека нулевая высота
        if (!can || !track.clientHeight) return;
        const H = track.clientHeight - 4;                       // внутренняя высота трека (бордер 1 + отступ 1)
        const th = clamp((ch / sh) * H, 40, H);
        const maxTop = H - th;
        const top = sh - ch > 0 ? (list.scrollTop / (sh - ch)) * maxTop : 0;
        thumb.style.height = `${th.toFixed(1)}px`;
        thumb.style.transform = `translateY(${top.toFixed(1)}px)`;
    };

    list.addEventListener('scroll', update, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(list);
    window.addEventListener('resize', update);

    thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        thumb.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, top: list.scrollTop };
        track.classList.add('is-drag');
    });
    thumb.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const H = track.clientHeight - 4;
        const th = thumb.offsetHeight;
        const ratio = (list.scrollHeight - list.clientHeight) / Math.max(1, H - th);
        list.scrollTop = drag.top + (e.clientY - drag.y) * ratio;
    });
    const end = () => { drag = null; track.classList.remove('is-drag'); };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);

    track.addEventListener('pointerdown', (e) => {                // клик по треку — плавный переход к месту
        if (e.target !== track) return;
        const r = track.getBoundingClientRect();
        const k = (e.clientY - r.top) / r.height;
        list.scrollTo({ top: k * (list.scrollHeight - list.clientHeight), behavior: 'smooth' });
    });

    return update;
}

/* ---------- карусель карточек на телефоне: тот же «пейджер», что у направлений ----------
   положение — одно число pos (в карточках); палец двигает его напрямую, на отпускание —
   критически затухающая пружина к целой карточке; боковые карточки меньше и прозрачнее. */
function initPager(list, progress) {
    const phone = window.matchMedia('(max-width: 1279.98px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pos = 0;
    let vel = 0;
    let target = 0;
    let anim = 0;
    let pitch = 300;
    let drag = null;
    let blockClick = false;

    const cards = () => [...list.children];
    const maxPos = () => Math.max(0, cards().length - 1);

    const reset = () => {
        cards().forEach((c) => { c.style.transform = ''; c.style.opacity = ''; c.style.zIndex = ''; c._tr = c._op = null; });
        list.classList.remove('is-dragging');
    };

    const SIDE = 0.72;                                              // боковые карточки — как в «Наши направления» (≈0.7)
    const render = () => {
        const max = maxPos();
        progress?.style.setProperty('--progress', (max ? clamp(pos / max, 0, 1) : 0).toFixed(3));
        cards().forEach((c, i) => {
            const t = Math.max(0, 1 - Math.abs(pos - i));
            const tr = `translate3d(${((i - pos) * pitch).toFixed(2)}px,0,0) scale(${(SIDE + (1 - SIDE) * t).toFixed(4)})`;
            const op = (Math.round((0.5 + 0.5 * t) * 20) / 20).toFixed(2);
            if (c._tr !== tr) { c._tr = tr; c.style.transform = tr; }
            if (c._op !== op) { c._op = op; c.style.opacity = op; }
            c.style.zIndex = String(10 - Math.round(Math.abs(pos - i)));
        });
    };

    // шаг между центрами соседних карточек: половина главной + половина боковой + зазор 12 (как в направлениях)
    const measure = () => {
        const first = list.firstElementChild;
        if (!first) return;
        pitch = (first.offsetWidth * (1 + SIDE)) / 2 + 12;
    };

    const stop = () => { if (anim) { cancelAnimationFrame(anim); anim = 0; } };

    const settle = (idx, v0 = 0) => {
        stop();
        target = clamp(idx, 0, maxPos());
        if (reduce.matches) { pos = target; vel = 0; render(); return; }
        vel = v0;
        const W = 13;                                              // жёсткость: ~0.45 с до посадки
        let last = performance.now();
        const step = (now) => {
            let dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
            last = now;
            while (dt > 0) {
                const h = Math.min(dt, 1 / 120);
                dt -= h;
                vel += (-W * W * (pos - target) - 2 * W * vel) * h;
                pos += vel * h;
            }
            if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.02) { pos = target; vel = 0; anim = 0; render(); return; }
            render();
            anim = requestAnimationFrame(step);
        };
        anim = requestAnimationFrame(step);
    };

    const rubber = (p) => (p < 0 ? p * 0.32 : p > maxPos() ? maxPos() + (p - maxPos()) * 0.32 : p);

    list.addEventListener('pointerdown', (e) => {
        if (!phone.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
        stop();
        blockClick = false;
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: pos, mode: null, pts: [{ x: e.clientX, t: performance.now() }], start: Math.round(pos) };
    });

    list.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        if (!drag.mode) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dx) > Math.abs(dy) * 1.1) {
                drag.mode = 'x';
                blockClick = true;
                list.classList.add('is-dragging');
                try { list.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            } else { drag = null; return; }                         // вертикальный жест — скролл страницы
        }
        pos = rubber(drag.pos0 - dx / pitch);
        const now = performance.now();
        drag.pts.push({ x: e.clientX, t: now });
        while (drag.pts.length > 2 && now - drag.pts[0].t > 120) drag.pts.shift();
        if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (drag) drag.raf = 0; render(); });
    });

    const end = (cancelled) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (d.raf) cancelAnimationFrame(d.raf);
        list.classList.remove('is-dragging');
        if (d.mode !== 'x') return;
        const a = d.pts[0];
        const b = d.pts[d.pts.length - 1];
        const vCards = (((a.x - b.x) / Math.max(16, b.t - a.t)) * 1000) / pitch;
        const moved = pos - d.pos0;
        let idx = Math.round(pos);
        if (!cancelled && (Math.abs(vCards) > 0.9 || Math.abs(moved) > 0.18)) {
            idx = d.start + (Math.abs(vCards) > 0.9 ? Math.sign(vCards) : Math.sign(moved));
        }
        settle(clamp(idx, d.start - 1, d.start + 1), clamp(vCards * 0.35, -6, 6));
    };
    list.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) end(false); });
    list.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) end(true); });
    list.addEventListener('dragstart', (e) => e.preventDefault());

    // после перетаскивания — не клик; по боковой карточке — выводим её в центр
    list.addEventListener('click', (e) => {
        if (blockClick) { e.preventDefault(); e.stopPropagation(); blockClick = false; return; }
        if (!phone.matches) return;
        const wrap = e.target.closest('.acard-wrap');
        const i = wrap ? cards().indexOf(wrap) : -1;
        if (i < 0 || i === Math.round(pos)) return;
        e.preventDefault();
        e.stopPropagation();
        settle(i);
    }, true);

    list.addEventListener('keydown', (e) => {
        if (!phone.matches || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault();
        settle(Math.round(pos) + (e.key === 'ArrowRight' ? 1 : -1));
    });
    list.addEventListener('focusin', (e) => {
        if (!phone.matches) return;
        const i = cards().indexOf(e.target.closest?.('.acard-wrap'));
        if (i >= 0 && i !== Math.round(pos)) settle(i);
    });
    list.addEventListener('scroll', () => { if (list.scrollLeft) list.scrollLeft = 0; }, { passive: true });

    const sync = () => { stop(); if (phone.matches) { measure(); pos = clamp(Math.round(pos), 0, maxPos()); render(); } else { pos = 0; reset(); } };
    phone.addEventListener?.('change', sync);
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!anim && !drag && phone.matches) { measure(); render(); } }, 120); });
    sync();
}

export function initArticles() {
    const list = document.querySelector('[data-articles-list]');
    if (!list) return;

    const limit = Number(list.dataset.limit) || Infinity;
    const filters = document.querySelector('[data-articles-filters]');
    const search = document.querySelector('[data-articles-search]');
    const empty = document.querySelector('[data-articles-empty]');
    const state = { cat: 'all', q: '' };
    const track = document.querySelector('[data-ascroll]');
    let updateScroll = () => {};

    const render = () => {
        const q = state.q.trim().toLowerCase();
        const items = articles
            .filter((a) => state.cat === 'all' || a.cat === state.cat)
            .filter((a) => !q || `${a.title} ${a.subtitle}`.toLowerCase().includes(q))
            .slice(0, limit);
        list.innerHTML = items.map(cardHTML).join('');
        if (empty) empty.hidden = items.length > 0;
        updateScroll();
    };

    if (filters) {
        filters.innerHTML = categories.map((c) => `
<li class="afilter">
    <button class="afilter__btn" type="button" data-filter="${esc(c.cat)}" data-row="${esc(c.id)}" aria-pressed="false">
        <span class="afilter__text">${esc(c.label)}</span>${c.chevron ? '<svg class="afilter__chev" aria-hidden="true"><use href="#chevron-down"></use></svg>' : ''}
    </button>
</li>`).join('');
        filters.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            state.cat = btn.dataset.filter;
            filters.querySelectorAll('[data-filter]').forEach((b) => {
                const on = b === btn;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-pressed', String(on));
            });
            render();
        });
    }

    search?.addEventListener('input', () => {
        state.q = search.value;
        render();
    });

    list.addEventListener('click', (e) => {
        const card = e.target.closest('[data-article-id]');
        if (!card) return;
        const article = articles.find((a) => a.id === card.dataset.articleId);
        if (!article || article.url) return;
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('article:open', { detail: { id: article.id, article } }));
    });

    if (track) updateScroll = initScrollbar(list, track);
    render();
    if (list.hasAttribute('data-pager')) initPager(list, document.querySelector('[data-articles-progress]'));
}
