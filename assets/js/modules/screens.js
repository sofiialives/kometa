const WIDE_DURATION = 780;

export function initScreens({ root }) {
    if (!root) return null;

    const hero = root.querySelector('[data-screen="hero"]');
    const welcome = root.querySelector('[data-screen="welcome"]');
    if (!hero || !welcome) return null;

    const items = (screen) => [...screen.querySelectorAll('.anim')];
    const wides = (screen) => [...screen.querySelectorAll('.anim--wide')];

    const textWidth = (el) => {
        const style = getComputedStyle(el);
        const probe = document.createElement('span');

        probe.textContent = el.textContent || '';
        probe.style.cssText = 'position:absolute;left:-99999px;top:0;white-space:nowrap;' +
            'letter-spacing:normal;visibility:hidden;pointer-events:none;' +
            `font-family:${style.fontFamily};font-size:${style.fontSize};` +
            `font-weight:${style.fontWeight};text-transform:${style.textTransform}`;

        document.body.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width;
    };

    const playWide = (el) => {
        const natural = textWidth(el);
        if (!natural) return;

        const scale = window.innerWidth / natural;
        const delay = Number(el.dataset.in || 0);

        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transformOrigin = 'center center';
        el.style.transform = `scaleX(${scale.toFixed(3)})`;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    el.style.transition =
                        `opacity 260ms linear,` +
                        `transform ${WIDE_DURATION}ms cubic-bezier(.2,.62,.28,1)`;
                    el.style.opacity = '1';
                    el.style.transform = 'scaleX(1)';
                }, delay);
            });
        });
    };

const resetWide = (el) => {
        el.style.transition = 'none';
        el.style.opacity = '';
        el.style.transform = '';
        el.style.transformOrigin = '';
    };

    const play = (screen, mode) => {
        wides(screen).forEach((el) => {
            if (mode === 'in') playWide(el);
            else resetWide(el);
        });

        items(screen).forEach((el) => {
            if (el.classList.contains('anim--wide')) return;

            const delay = mode === 'in' ? (el.dataset.in || 0) : (el.dataset.out || 0);
            el.style.setProperty('--d', delay + 'ms');
            el.classList.remove('anim--in', 'anim--out');
            void el.offsetWidth;
            el.classList.add(mode === 'in' ? 'anim--in' : 'anim--out');
        });
    };

    const reset = (screen) => {
        items(screen).forEach((el) => {
            el.classList.remove('anim--in', 'anim--out');
            el.style.removeProperty('--d');
        });
    };

    return {
        intro() {
            play(hero, 'in');
        },
        switch() {
            if (root.classList.contains('is-switched')) return;
            root.classList.add('is-switched');
            play(hero, 'out');
            play(welcome, 'in');
        },
        showAll() {
            root.classList.add('is-switched');
            reset(hero);
            reset(welcome);
            [...items(hero), ...items(welcome)].forEach((el) => {
                el.style.opacity = '1';
                el.style.transform = '';
            });
        }
    };
}