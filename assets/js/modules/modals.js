/**
 * Модалки направлений: открытие по стрелке карточки, iOS-подобная анимация,
 * закрытие по крестику / фону / Esc / свайпу вниз (мобилка), фокус-ловушка,
 * блокировка скролла. «Обсудить детали» закрывает модалку и плавно ведёт к форме.
 */
import { scrollToTarget } from './nav.js?v=5';

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

    const close = ({ then, fling = false } = {}) => {
        const modal = active;
        if (!modal) return;
        active = null;
        modal.classList.remove('is-open');
        modal.classList.add('is-closing');
        if (fling) {
            modal.classList.add('is-flung');
            modal.style.setProperty('--drag', `${Math.round(innerHeight * 0.9)}px`);
        } else {
            modal.style.removeProperty('--drag');
        }
        modal.style.removeProperty('--fade');
        const done = () => {
            modal.hidden = true;
            modal.classList.remove('is-closing', 'is-flung', 'is-dragging');
            modal.style.removeProperty('--drag');
            document.body.classList.remove('is-locked');
            if (then) then();
            else lastTrigger?.focus({ preventScroll: true });
        };
        if (reduceMotion) done();
        else closeTimer = setTimeout(done, fling ? 300 : CLOSE_MS);
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

    /* шторка: лист идёт за пальцем, фон затухает; по отпусканию — улетает (быстрый жест / > 22% высоты) или пружинит назад */
    roots.forEach((modal) => {
        const frame = modal.querySelector('.modal__frame');
        if (frame && !frame.querySelector(':scope > .modal__grab')) {
            const g = document.createElement('span');
            g.className = 'modal__grab';
            g.setAttribute('aria-hidden', 'true');
            frame.prepend(g);
        }

        let sx = 0, sy = 0, dy = 0, mode = 0;           // mode: 0 — ждём, 1 — тянем, -1 — не наш жест
        let pts = [];
        const stage = modal.querySelector('.modal__stage, .cmodal__stage');

        modal.addEventListener('touchstart', (e) => {
            mode = 0;
            if (!mqPhone.matches || modal.scrollTop > 0 || e.touches.length !== 1 || !modal.classList.contains('is-open')) { mode = -1; return; }
            sx = e.touches[0].clientX; sy = e.touches[0].clientY; dy = 0;
            pts = [{ y: sy, t: performance.now() }];
        }, { passive: true });

        modal.addEventListener('touchmove', (e) => {
            if (mode < 0 || !pts.length) return;
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            dy = y - sy;
            if (mode === 0) {
                if (Math.abs(x - sx) < 8 && Math.abs(dy) < 8) return;
                if (dy <= 0 || Math.abs(dy) < Math.abs(x - sx) * 1.2 || modal.scrollTop > 0) { mode = -1; return; }
                mode = 1;
                modal.classList.add('is-dragging');
            }
            if (e.cancelable) e.preventDefault();
            const h = (stage?.offsetHeight || innerHeight);
            const off = dy > 0 ? dy : dy * .15;
            modal.style.setProperty('--drag', `${off.toFixed(1)}px`);
            modal.style.setProperty('--fade', Math.max(.15, 1 - Math.max(0, dy) / (h * .9)).toFixed(3));
            pts.push({ y, t: performance.now() });
            if (pts.length > 8) pts.shift();
        }, { passive: false });

        const end = (cancelled) => {
            const was = mode === 1;
            mode = 0;
            if (!was) return;
            const last = pts[pts.length - 1];
            const first = pts.find((p) => last.t - p.t <= 100) || pts[0];
            const v = (last.y - first.y) / Math.max(1, last.t - first.t);      // px/мс
            modal.classList.remove('is-dragging');
            const need = Math.min((stage?.offsetHeight || innerHeight) * .22, innerHeight * .25);
            if (!cancelled && (dy > need || (v > .4 && dy > 24))) close({ fling: true });
            else { modal.style.removeProperty('--drag'); modal.style.removeProperty('--fade'); }
        };
        modal.addEventListener('touchend', () => end(false));
        modal.addEventListener('touchcancel', () => end(true));
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
