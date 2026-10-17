/**
 * Параллакс звёздного фона по наклону телефона (только тач-устройства).
 * Слой звёзд (.sky::before) плывёт по горизонтали ±14px вслед за гироскопом, считая за ноль то положение,
 * в котором телефон держат при загрузке. Android — сразу; iOS — запрос разрешения по первому касанию.
 * Отказ/нет датчика — фон остаётся статичным. Движение — только transform (GPU), без перерисовки.
 */
export function initTiltStars() {
    const coarse = window.matchMedia('(pointer: coarse)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!coarse.matches || reduce.matches || !('DeviceOrientationEvent' in window)) return;

    const root = document.documentElement;
    const AMP = 14;            // px при наклоне ±18°
    const RANGE = 18;
    let base = null;
    let tx = 0;
    let target = 0;
    let raf = 0;
    let on = false;

    const tick = () => {
        tx += (target - tx) * .12;
        root.style.setProperty('--tilt-x', `${tx.toFixed(2)}px`);
        raf = Math.abs(target - tx) > .05 ? requestAnimationFrame(tick) : 0;
    };

    const onOrient = (e) => {
        if (e.gamma == null) return;
        // в альбомной ориентации ось другая — берём beta
        const land = Math.abs(window.orientation || 0) === 90 || (screen.orientation?.type || '').startsWith('landscape');
        const v = land ? e.beta : e.gamma;
        if (base === null) base = v;
        const d = Math.max(-RANGE, Math.min(RANGE, v - base));
        target = -(d / RANGE) * AMP;
        if (!raf) raf = requestAnimationFrame(tick);
    };

    const start = () => {
        if (on) return;
        on = true;
        window.addEventListener('deviceorientation', onOrient, { passive: true });
    };

    const needsPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!needsPermission) { start(); return; }

    // iOS: разрешение можно спросить только из жеста пользователя
    const ask = async () => {
        document.removeEventListener('pointerup', ask);
        try {
            const r = await DeviceOrientationEvent.requestPermission();
            if (r === 'granted') start();
        } catch (_) { /* отказ — остаётся статичный фон */ }
    };
    document.addEventListener('pointerup', ask, { once: true });
}
