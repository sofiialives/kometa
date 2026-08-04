const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initModal({ modal, openers = [], form, body = document.body }) {
    if (!modal) return;

    const dialog = modal.querySelector('[data-modal-dialog]');
    const closers = [...modal.querySelectorAll('[data-modal-close]')];
    const status = modal.querySelector('[data-form-status]');
    const submit = form?.querySelector('[data-form-submit]');
    let lastFocused = null;

    const items = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    const open = () => {
        lastFocused = document.activeElement;
        modal.classList.add('is-open');
        modal.removeAttribute('aria-hidden');
        body.classList.add('is-locked');
        items()[0]?.focus();
    };

    const close = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        body.classList.remove('is-locked');
        lastFocused?.focus();
    };

    openers.forEach((opener) => opener.addEventListener('click', open));
    closers.forEach((closer) => closer.addEventListener('click', close));

    modal.addEventListener('mousedown', (event) => {
        if (event.target === modal) close();
    });

    document.addEventListener('keydown', (event) => {
        if (!modal.classList.contains('is-open')) return;

        if (event.key === 'Escape') {
            close();
            return;
        }

        if (event.key !== 'Tab') return;

        const list = items();
        if (!list.length) return;

        const first = list[0];
        const last = list[list.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    if (!form) return;

    const setFieldError = (field, message) => {
        const errorBox = form.querySelector(`[data-error-for="${field.name}"]`);
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
        if (errorBox) errorBox.textContent = message;
        return !message;
    };

    const validate = () => {
        const name = form.elements.name;
        const contact = form.elements.contact;
        let valid = true;

        valid = setFieldError(name, name.value.trim().length < 2 ? 'Укажите имя — минимум 2 символа' : '') && valid;

        const contactValue = contact.value.trim();
        const isEmail = EMAIL_RE.test(contactValue);
        const isPhone = /^[+\d][\d\s\-()]{8,}$/.test(contactValue);
        valid = setFieldError(contact, !isEmail && !isPhone ? 'Введите email или телефон' : '') && valid;

        return valid;
    };

    const setState = (state, message = '') => {
        if (submit) {
            submit.dataset.state = state === 'loading' ? 'loading' : 'idle';
            submit.disabled = state === 'loading';
        }
        if (status) {
            status.dataset.state = state;
            status.textContent = message;
        }
    };

    const send = (payload) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!navigator.onLine) {
                reject(new Error('offline'));
                return;
            }
            resolve(payload);
        }, 900);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validate()) {
            setState('error', 'Проверьте выделенные поля');
            return;
        }

        setState('loading', 'Отправляем заявку…');

        try {
            await send(Object.fromEntries(new FormData(form)));
            setState('success', 'Заявка отправлена. Мы свяжемся в течение дня.');
            form.reset();
        } catch {
            setState('error', 'Не удалось отправить.');
            if (status && !status.querySelector('button')) {
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'form__retry';
                retry.textContent = 'Повторить';
                retry.addEventListener('click', () => form.requestSubmit());
                status.append(' ', retry);
            }
        }
    });

    form.addEventListener('input', (event) => {
        const field = event.target;
        if (field.getAttribute('aria-invalid') === 'true') setFieldError(field, '');
    });
}
