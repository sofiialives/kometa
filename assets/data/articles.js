/**
 * Статьи — единственное место, где их нужно править.
 * Из этого файла рисуются: блок «НАШИ СМИ» на главной (первые 3) и вся страница articles.html.
 *
 *  id       — уникальный ключ (по нему позже откроется модалка статьи)
 *  title    — заголовок карточки (32px, градиент)
 *  subtitle — подзаголовок (20px, белый)
 *  date     — «ДД.ММ.ГГ», показывается бейджем на картинке
 *  cat      — id рубрики из categories (по ней работают фильтры в сайдбаре)
 *  image    — путь к обложке 343×204 (@2x — 686×408)
 *  url      — необязательно: внешняя ссылка; пока пусто — карточка открывает модалку (событие article:open)
 */
/* categories: порядок и шевроны — как в макете. id — уникальный ключ строки, cat — рубрика статей (по ней фильтр).
   «\n» в label — перенос строки в сайдбаре на десктопе. */
export const categories = [
    { id: 'all', cat: 'all', label: 'Все статьи' },
    { id: 'strategy-1', cat: 'strategy', label: 'Стратегия\nи планирование', chevron: true },
    { id: 'seo-1', cat: 'seo', label: 'SEO и продвижение сайтов' },
    { id: 'tg-1', cat: 'tg', label: 'Telegram Ads', chevron: true },
    { id: 'ctx-1', cat: 'ctx', label: 'Контекстная реклама', chevron: true },
    { id: 'strategy-2', cat: 'strategy', label: 'Стратегия\nи планирование', chevron: true },
    { id: 'seo-2', cat: 'seo', label: 'SEO и продвижение сайтов' },
    { id: 'tg-2', cat: 'tg', label: 'Telegram Ads', chevron: true },
    { id: 'ctx-2', cat: 'ctx', label: 'Контекстная реклама', chevron: true },
    { id: 'strategy-3', cat: 'strategy', label: 'Стратегия\nи планирование' },
    { id: 'seo-3', cat: 'seo', label: 'SEO и продвижение сайтов', chevron: true },
    { id: 'tg-3', cat: 'tg', label: 'Telegram Ads', chevron: true },
    { id: 'ctx-3', cat: 'ctx', label: 'Контекстная реклама' }
];

const cover = './assets/images/articles/article-cover.jpg';
const cats = ['strategy', 'seo', 'tg', 'ctx', 'strategy', 'seo', 'tg', 'ctx', 'strategy', 'seo', 'tg', 'ctx'];

export const articles = cats.map((cat, i) => ({
    id: `article-${i + 1}`,
    title: 'Заголовок',
    subtitle: 'Подзаголовок',
    date: '29.10.26',
    cat,
    image: cover,
    url: ''
}));
