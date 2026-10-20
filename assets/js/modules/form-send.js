/**
 * Обычная отправка заявки: клик по кнопке или Enter в поле. Проверяет имя и контакт,
 * отправляет на form[data-endpoint] (если задан) и показывает сообщение сверху.
 */
import { showToast } from './toast.js';

export function initFormSend() {
    const form = document.querySelector('[data-form]');
    const btn = form?.querySelector('.btn-send');
    if (!form || !btn) return;

    const val = (n) => (form.elements[n]?.value || '').trim();
    let busy = false;

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        if (!val('name')) {
            showToast('Укажите имя', { kind: 'warn' });
            form.elements.name.focus();
            return;
        }
        if (!val('telegram') && !val('phone')) {
            showToast('Оставьте Telegram или телефон', { kind: 'warn' });
            form.elements.telegram?.focus();
            return;
        }
        busy = true;
        btn.disabled = true;
        const ok = await send().then(() => true, () => false);
        busy = false;
        btn.disabled = false;
        if (ok) {
            form.reset();
            showToast('Заявка отправлена', { kind: 'ok', ms: 3000 });
        } else {
            showToast('Не удалось отправить', { kind: 'warn', ms: 3200 });
        }
    });
}
