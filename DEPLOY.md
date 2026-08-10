# Деплой на GitHub Pages

## 1. Установить Git (если ещё нет)

```bash
git --version
```

Если команда не найдена — macOS предложит установить Command Line Tools, соглашайтесь.

## 2. Создать репозиторий на GitHub

Зайдите на github.com → New repository. Имя, например, `kometa`. Тип Public. Ничего не добавляйте (ни README, ни .gitignore) — репозиторий должен быть пустым.

## 3. Загрузить проект

В терминале, находясь в папке проекта:

```bash
cd путь/к/kometa

git init
git add .
git commit -m "KOMETA website"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/kometa.git
git push -u origin main
```

При первом push GitHub попросит логин и токен. Обычный пароль не подойдёт — нужен Personal Access Token: Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, отметить область `repo`. Токен вводится вместо пароля.

## 4. Включить Pages

В репозитории: Settings → Pages → Source: Deploy from a branch → Branch: `main`, папка `/ (root)` → Save.

Через 1–2 минуты сайт будет доступен по адресу:

```
https://ВАШ_ЛОГИН.github.io/kometa/
```

## 5. Обновление сайта

```bash
git add .
git commit -m "Описание правки"
git push
```

Изменения появятся через минуту.

## Локальный запуск

```bash
npx serve .
```

Откроется на http://localhost:3000. Проверить 404: откройте http://localhost:3000/qwerty

Открывать `index.html` двойным кликом нельзя — ES-модули требуют HTTP-сервера.

## Свой домен

Settings → Pages → Custom domain. После подключения замените `https://kometa.agency/` на реальный адрес в файлах `index.html` (canonical, og:url, JSON-LD), `robots.txt` и `sitemap.xml`.
