# КОМЕТА — Web3 Agency

Одностраничный сайт агентства. Первые две секции — 3D-глобус на Three.js: планета вращается вокруг оси, при скролле камера приближается. Третья секция статичная.

## Стек

Vanilla HTML / CSS / JavaScript (ES Modules) + Three.js. Без сборщика.

## Структура

```
.
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── favicon.ico
├── favicon-16.png
├── favicon-32.png
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
└── assets
    ├── css
    │   └── main.css
    ├── fonts
    │   ├── Nekst-Regular.woff2
    │   ├── Nekst-Medium.woff2
    │   ├── Nekst-Bold.woff2
    │   └── Radiotechnika.woff2
    ├── images
    │   ├── earth-map.webp        текстура Земли для глобуса (4096×2048)
    │   ├── earth-map-2k.webp     облегчённая версия (2048×1024)
    │   ├── earth.png / .webp     статичный фолбэк первой секции
    │   ├── earth_zoom.png/.webp  статичный фолбэк второй секции
    │   ├── stars.png / .webp     звёздный фон
    │   ├── comet-hero.png/.webp  комета в первой секции
    │   ├── comet-left / -right   кометы третьей секции
    │   ├── card-bg, card-outer-bg, personal-bg
    │   ├── circuit-top.svg, circuit-bottom.svg
    │   └── логотипы клиентов
    └── js
        ├── main.js               точка входа
        ├── modules
        │   ├── globe.js          3D-сцена: вращение и зум
        │   └── loader.js         прелоадер
        └── vendor
            └── three.module.js   Three.js 0.160
```

## Запуск

ES-модули требуют HTTP, через `file://` работать не будут.

```bash
npx serve .
```

Откроется на http://localhost:3000

## Глобус

Сцена живёт в `<div class="stage" data-globe-scene>`, который оборачивает первые две секции. Канвас лежит `position: fixed` под контентом и показывается только пока `.stage` в зоне видимости.

Настройки — в начале `assets/js/modules/globe.js`:

| Константа | Назначение |
| --- | --- |
| `SPIN_SPEED` | Скорость вращения вокруг оси |
| `CAM_START` | Дистанция камеры в начале первой секции |
| `CAM_END` | Дистанция в конце второй секции |
| `TILT` | Наклон оси планеты |
| `LIGHT_DIR` | Направление солнца |

Атмосферное свечение задаётся шейдером в том же файле: `uColor` — цвет, `uStrength` — сила, `uPower` — резкость края.

Если WebGL недоступен или JS отключён, класс `globe-ready` не появится и останутся статичные `earth.png` и `earth_zoom.png` — вёрстка не сломается.

## Перед деплоем

1. Заменить `https://kometa.agency/` на реальный домен в `index.html`, `robots.txt`, `sitemap.xml`.
2. Указать ссылку на Telegram вместо `https://t.me/`.
3. Повесить обработчик на кнопку «Оставить заявку».
4. Включить сжатие и кэширование статики на сервере.

## Деплой

Инструкция по GitHub Pages — в `DEPLOY.md`.
