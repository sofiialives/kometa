# КОМЕТА — Web3 Agency

Одностраничный сайт агентства: скролл-сцена с планетой, звёздное небо на canvas, карточки направлений.

## Стек

Vanilla HTML / CSS / JavaScript (ES Modules). Без сборщика и зависимостей.

## Структура

```
.
├── index.html
├── 404.html
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── assets
    ├── css/main.css
    ├── fonts/
    ├── images/
    └── js
        ├── main.js
        └── modules
            ├── intro.js
            ├── loader.js
            ├── menu.js
            ├── modal.js
            ├── network.js
            ├── reveal.js
            └── starfield.js
```

## Запуск

ES-модули требуют HTTP, через `file://` работать не будут.

```bash
npx serve .
# или
python3 -m http.server 5500
```

## Модули

| Модуль | Задача |
| --- | --- |
| `intro.js` | Скролл-сцена: зум планеты, смена экранов, блокировка обратной прокрутки |
| `starfield.js` | Звёзды на canvas: 3 слоя параллакса, мерцание, пролетающие кометы |
| `menu.js` | Бургер-меню: focus trap, Escape, клик вне зоны |
| `modal.js` | Модалка заявки: валидация, состояния loading/success/error |
| `reveal.js` | Появление блоков по IntersectionObserver |
| `loader.js` | Прелоадер-созвездие, один раз за сессию |
| `network.js` | Индикатор потери соединения |

## Настройка

Токены дизайн-системы — в `:root` файла `assets/css/main.css`: цвета, типографическая шкала (`--step-*`), отступы, радиусы, длительности анимаций, `--side` и `--content` для сетки.

Параметры сцены — константы в начале `assets/js/modules/intro.js`.
Плотность звёзд и частота комет — массив `LAYERS` и `COMET_*` в `assets/js/modules/starfield.js`.

## Перед деплоем

1. Заменить `https://kometa.agency/` на реальный домен в `index.html`, `robots.txt`, `sitemap.xml`.
2. Указать ссылку на Telegram вместо `https://t.me/`.
3. Подключить приём заявок: функция `send()` в `assets/js/modules/modal.js` сейчас имитирует запрос.
4. Включить сжатие (Brotli/gzip) и кэширование статики на сервере.

## Доступность

Семантические теги, `aria-*` на интерактивных элементах, skip-link, видимый фокус, focus trap в меню и модалке, полная поддержка `prefers-reduced-motion`.

## Производительность

Изображения в WebP с PNG-фолбэком, `loading="lazy"` вне первого экрана, `width`/`height` против CLS, preload основного шрифта, `font-display: swap`, canvas останавливается вне вьюпорта и при скрытой вкладке, `devicePixelRatio` ограничен двойкой.
