# Древний Разлом — MOBA 5×5

Браузерная MOBA в духе Dota 2: выбор из 10 героев, 3 линии с кирпичными дорогами,
вышки Т1–Т4 и Древний Трон, волны крипов (3 мечника + 1 стрелок + 1 катапульта),
лесные лагеря нейтралов, лавка предметов, свитки телепорта на вышки,
прокачка до 25 уровня, серии убийств и Мастерская скинов.

## Режимы

- **Локальная игра** — ты + 4 бота Света против 5 ботов Тьмы
- **Сетевая игра** — P2P через PeerJS/WebRTC (без своего сервера, работает на GitHub Pages):
  создаёшь комнату → скидываешь другу код → играете вместе против ботов или друг против друга

## Публикация на GitHub Pages (репозиторий `gn-dot`)

Проект настроен на **авто-деплой через GitHub Actions** (`.github/workflows/deploy.yml`):
каждый push в `main` автоматически собирает игру и выкладывает её на Pages
с относительными путями (`--base=./`).

### Первый пуш с компьютера

```bash
git config --global user.name "grymovnikita-droid"
git config --global user.email "grymovnikita-droid@users.noreply.github.com"
git init
git add .
git commit -m "Initial commit: Ancient Rift — MOBA 5v5"
git branch -M main
git remote add origin https://github.com/grymovnikita-droid/gn-dot.git
git push -u origin main
```

При пуше Git сам спросит логин и токен (вставь токен вместо пароля;
вставлять токен в URL команды **не обязательно** и небезопасно).

### Включить Pages

1. Репозиторий → **Settings → Pages**
2. **Build and deployment → Source: GitHub Actions**
3. Через 1–2 минуты игра доступна: **https://grymovnikita-droid.github.io/gn-dot/**

Дальше любые изменения в коде улетают на сайт автоматически после `git push`.

## Разработка

```bash
npm install
npm run dev      # локальный сервер
npm run build    # сборка в dist/
```
