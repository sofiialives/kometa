/**
 * Кастомный выпадающий список «Чем помочь проекту?» поверх нативного <select> (он остаётся в форме и отправляется как раньше).
 * Без JS работает обычный select. Клавиатура: ↑ ↓ Home End, Enter/Space — выбрать, Esc — закрыть, Tab — закрыть.
 * Подпись и иконка берутся из data-sub / data-icon у <option>.
 */
const ICONS = {
    chart: '<svg viewBox="0 0 19 21" width="19" height="21" fill="none" aria-hidden="true"><path d="M0.779297 19.3793H17.5793M3.1793 15.1793V10.3793M9.1793 15.1793V6.7793M15.1793 15.1793V3.1793M0.779297 7.9793L5.5793 4.3793L10.3793 5.5793L17.5793 0.779297" stroke-width="1.56" stroke-linecap="round" stroke-linejoin="round" stroke="#A8C7DF"/></svg>',
    design: '<svg viewBox="0 0 21 21" width="21" height="21" fill="none" aria-hidden="true"><path d="M5.5793 10.3793H10.3793M10.3793 10.3793H15.1793M10.3793 10.3793V5.5793M10.3793 10.3793V15.1793M10.3793 0.779297L19.9793 10.3793L10.3793 19.9793L0.779297 10.3793L10.3793 0.779297Z" stroke-width="1.56" stroke-linecap="round" stroke-linejoin="round" stroke="#A8C7DF"/></svg>',
    code: '<svg viewBox="0 0 21 21" width="21" height="21" fill="none" aria-hidden="true"><path d="M6.7793 4.3793L0.779297 10.3793L6.7793 16.3793M13.9793 4.3793L19.9793 10.3793L13.9793 16.3793M11.5793 0.779297L9.1793 19.9793" stroke-width="1.56" stroke-linecap="round" stroke-linejoin="round" stroke="#A8C7DF"/></svg>',
    spark: '<svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true"><path d="M10.9793 0.779297L13.4993 8.4593L21.1793 10.9793L13.4993 13.4993L10.9793 21.1793L8.4593 13.4993L0.779297 10.9793L8.4593 8.4593L10.9793 0.779297Z" stroke-width="1.56" stroke-linecap="round" stroke-linejoin="round" stroke="#A8C7DF"/></svg>'
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initSelect() {
    document.querySelectorAll('.field--select').forEach((field) => {
        const select = field.querySelector('select');
        if (!select || field.dataset.selReady) return;
        field.dataset.selReady = '1';

        const opts = [...select.options];
        const uid = `sel-${Math.random().toString(36).slice(2, 7)}`;
        const caption = field.dataset.caption || 'Чем помочь проекту?';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'field__control sel__btn';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', uid);
        btn.setAttribute('aria-label', 'Направление');

        const panel = document.createElement('div');
        panel.className = 'sel__panel';
        panel.hidden = true;
        panel.innerHTML = `
<p class="sel__cap" id="${uid}-cap">${esc(caption)}</p>
<ul class="sel__list" id="${uid}" role="listbox" aria-labelledby="${uid}-cap" tabindex="-1">
${opts.map((o, i) => `<li class="sel__item" role="option" id="${uid}-${i}" data-i="${i}" aria-selected="false">
    <span class="sel__ico">${ICONS[o.dataset.icon] || ''}</span>
    <span class="sel__txt"><span class="sel__title">${esc(o.textContent)}</span><span class="sel__sub">${esc(o.dataset.sub || '')}</span></span>
</li>`).join('')}
</ul>`;

        select.classList.add('sel__native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');
        field.classList.add('is-enhanced');
        select.before(btn);
        document.body.append(panel);          // вне формы: у формы своё размытие фона, и вложенное стекло панели не «видело» бы поля под собой

        const list = panel.querySelector('.sel__list');
        const items = [...list.children];
        let cur = Math.max(0, select.selectedIndex);     // выбранный
        let act = cur;                                    // подсвеченный (клавиатура / наведение)
        let closeTimer = 0;

        const paint = () => {
            btn.textContent = opts[cur]?.textContent || '';
            items.forEach((el, i) => {
                el.setAttribute('aria-selected', String(i === cur));
                el.classList.toggle('is-active', i === act);
            });
            list.setAttribute('aria-activedescendant', `${uid}-${act}`);
        };
        paint();

        const isOpen = () => !panel.hidden && panel.classList.contains('is-open');

        // панель лежит в body: ставим её под полем в координатах страницы (прокрутка её не сдвигает)
        const place = () => {
            const r = field.getBoundingClientRect();
            const gap = 16 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1);
            const k = window.matchMedia('(max-width: 1279.98px)').matches ? 8 : gap;
            panel.style.left = `${(r.left + scrollX).toFixed(1)}px`;
            panel.style.top = `${(r.bottom + scrollY + k).toFixed(1)}px`;
            panel.style.width = `${r.width.toFixed(1)}px`;
        };
        addEventListener('resize', () => { if (isOpen()) place(); });

        const open = () => {
            if (isOpen()) return;
            clearTimeout(closeTimer);
            act = cur;
            paint();
            panel.hidden = false;
            place();
            void panel.offsetWidth;                      // reflow → старт перехода
            field.classList.add('is-open');
            panel.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
            list.focus({ preventScroll: true });
            items[act]?.scrollIntoView({ block: 'nearest' });
        };

        const close = (focusBtn = true) => {
            if (!isOpen()) return;
            field.classList.remove('is-open');
            panel.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
            closeTimer = setTimeout(() => { panel.hidden = true; }, 320);
            if (focusBtn) btn.focus({ preventScroll: true });
        };

        const choose = (i) => {
            cur = act = i;
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            paint();
            close();
        };

        btn.addEventListener('click', () => (isOpen() ? close() : open()));
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
        });

        list.addEventListener('keydown', (e) => {
            const n = items.length;
            const move = (v) => { act = (v + n) % n; paint(); items[act].scrollIntoView({ block: 'nearest' }); };
            switch (e.key) {
                case 'ArrowDown': e.preventDefault(); move(act + 1); break;
                case 'ArrowUp': e.preventDefault(); move(act - 1); break;
                case 'Home': e.preventDefault(); move(0); break;
                case 'End': e.preventDefault(); move(n - 1); break;
                case 'Enter': case ' ': e.preventDefault(); choose(act); break;
                case 'Escape': e.preventDefault(); close(); break;
                case 'Tab': close(false); break;
                default:
            }
        });

        list.addEventListener('pointermove', (e) => {
            const it = e.target.closest('.sel__item');
            if (!it || e.pointerType === 'touch') return;
            const i = Number(it.dataset.i);
            if (i !== act) { act = i; paint(); }
        });
        list.addEventListener('click', (e) => {
            const it = e.target.closest('.sel__item');
            if (it) choose(Number(it.dataset.i));
        });

        document.addEventListener('pointerdown', (e) => { if (isOpen() && !field.contains(e.target) && !panel.contains(e.target)) close(false); });
        select.addEventListener('change', () => { cur = act = Math.max(0, select.selectedIndex); paint(); });   // форма могла сбросить значение
        select.form?.addEventListener('reset', () => setTimeout(() => { cur = act = Math.max(0, select.selectedIndex); paint(); }));
    });
}
