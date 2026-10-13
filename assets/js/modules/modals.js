/**
 * Модалки направлений: открытие по стрелке карточки, iOS-подобная анимация,
 * закрытие по крестику / фону / Esc / свайпу вниз (мобилка), фокус-ловушка,
 * блокировка скролла. «Обсудить детали» закрывает модалку и плавно ведёт к форме.
 */
import { scrollToTarget } from './nav.js';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CLOSE_MS = 340;

export function initModals({ reduceMotion = false } = {}) {
    const roots = [...document.querySelectorAll('[data-modal-root]')];
    if (!roots.length) return;

    const mqPhone = window.matchMedia('(max-width: 1279.98px)');
    let active = null;
    let lastTrigger = null;
    let closeTimer = 0;

    /* масштаб «дизайн-кадра» под окно: 1:1, пока помещается */
    const fit = (modal) => {
        const stage = modal.querySelector('.modal__stage');
        if (!stage) return;
        if (mqPhone.matches) { stage.style.removeProperty('--fit'); return; }
        const W = +stage.style.getPropertyValue('--W');
        const H = +stage.style.getPropertyValue('--H');
        const pad = 56;
        const k = Math.min(1, (innerWidth - pad) / W, (innerHeight - pad) / (H + 40));
        stage.style.setProperty('--fit', Math.max(.3, k).toFixed(4));
    };

    const open = (modal, trigger) => {
        if (active) return;
        active = modal;
        lastTrigger = trigger || null;
        clearTimeout(closeTimer);
        fit(modal);
        modal._cslide?.set(Number(trigger?.dataset.slide) || 0);
        modal.hidden = false;
        modal.scrollTop = 0;
        void modal.offsetWidth; // reflow → старт перехода
        document.body.classList.add('is-locked');
        modal.classList.remove('is-closing');
        modal.classList.add('is-open');
        const frame = modal.querySelector('.modal__frame');
        frame?.setAttribute('tabindex', '-1');
        frame?.focus({ preventScroll: true });
    };

    const close = ({ then } = {}) => {
        const modal = active;
        if (!modal) return;
        active = null;
        modal.classList.remove('is-open');
        modal.classList.add('is-closing');
        modal.style.removeProperty('--drag');
        const done = () => {
            modal.hidden = true;
            modal.classList.remove('is-closing');
            document.body.classList.remove('is-locked');
            if (then) then();
            else lastTrigger?.focus({ preventScroll: true });
        };
        if (reduceMotion) done();
        else closeTimer = setTimeout(done, CLOSE_MS);
    };

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-modal]');
        if (trigger) {
            const modal = document.getElementById(`modal-${trigger.dataset.modal}`);
            if (modal) { e.preventDefault(); open(modal, trigger); }
            return;
        }
        if (!active) return;
        if (e.target.closest('[data-modal-cta]')) {
            e.preventDefault();
            close({
                then: () => {
                    const target = document.getElementById('contacts');
                    if (target) scrollToTarget(target, { reduce: reduceMotion });
                }
            });
            return;
        }
        if (e.target.closest('[data-modal-close]')) close();
    });

    document.addEventListener('keydown', (e) => {
        if (!active) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        const items = [...active.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.addEventListener('resize', () => { if (active) fit(active); });

    roots.forEach((modal) => { if (modal.classList.contains('modal--case')) initCaseSlider(modal, { reduceMotion }); });

    /* свайп вниз закрывает лист на мобилке (только когда он прокручен к началу) */
    roots.forEach((modal) => {
        let startY = 0, dy = 0, dragging = false;
        modal.addEventListener('touchstart', (e) => {
            if (!mqPhone.matches || modal.scrollTop > 0 || e.touches.length !== 1) return;
            startY = e.touches[0].clientY; dy = 0; dragging = true;
        }, { passive: true });
        modal.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            dy = e.touches[0].clientY - startY;
            if (dy <= 0) { modal.style.removeProperty('--drag'); return; }
            modal.classList.add('is-dragging');
            modal.style.setProperty('--drag', `${dy * .7}px`);
        }, { passive: true });
        const end = () => {
            if (!dragging) return;
            dragging = false;
            modal.classList.remove('is-dragging');
            if (dy > 110) close(); else modal.style.removeProperty('--drag');
        };
        modal.addEventListener('touchend', end);
        modal.addEventListener('touchcancel', end);
    });
}


/* слайдер кейсов: плавная смена кадров в духе iOS, стрелки/точки/клавиши/свайп */
function initCaseSlider(modal, { reduceMotion }) {
    const slides = [...modal.querySelectorAll('[data-cslide]')];
    const dots = [...modal.querySelectorAll('[data-cdot]')];
    const card = modal.querySelector('[data-cmodal]');
    const n = slides.length;
    let cur = 0;
    let busy = 0;

    const mark = () => {
        slides.forEach((el, k) => el.setAttribute('aria-hidden', k === cur ? 'false' : 'true'));
        dots.forEach((el, k) => {
            el.classList.toggle('is-active', k === cur);
            if (k === cur) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
        });
    };

    const set = (k) => {
        cur = ((k % n) + n) % n;
        slides.forEach((el, i) => {
            el.classList.add('is-instant');
            el.classList.remove('is-prev', 'is-next');
            el.classList.toggle('is-current', i === cur);
            if (i !== cur) el.classList.add('is-next');
        });
        void card.offsetWidth;
        slides.forEach((el) => el.classList.remove('is-instant'));
        mark();
    };

    const go = (to, dir) => {
        to = ((to % n) + n) % n;
        if (to === cur) return;
        const from = slides[cur];
        const next = slides[to];
        if (reduceMotion) { set(to); return; }
        next.classList.add('is-instant');
        next.classList.remove('is-prev', 'is-next');
        next.classList.add(dir > 0 ? 'is-next' : 'is-prev');
        void next.offsetWidth;
        next.classList.remove('is-instant');
        from.classList.remove('is-current');
        from.classList.add(dir > 0 ? 'is-prev' : 'is-next');
        next.classList.remove('is-prev', 'is-next');
        next.classList.add('is-current');
        cur = to;
        mark();
        busy = performance.now();
    };

    const step = (d) => go(cur + d, d);

    modal._cslide = { set };
    set(0);

    modal.querySelector('[data-cprev]').addEventListener('click', () => step(-1));
    modal.querySelector('[data-cnext]').addEventListener('click', () => step(1));
    dots.forEach((el, k) => el.addEventListener('click', () => go(k, k > cur ? 1 : -1)));

    document.addEventListener('keydown', (e) => {
        if (modal.hidden || !modal.classList.contains('is-open')) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    });

    let sx = 0, sy = 0, tracking = false;
    card.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    card.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - sy) * 1.4) step(dx < 0 ? 1 : -1);
    });
}
