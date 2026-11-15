# 12 недель

Трекер целей на 12-недельный цикл. Приложение для macOS хранит цели, пункты и
отметки в локальной SQLite. В App Store его публиковать не нужно.

## Запуск на своём Mac

```bash
npm install
npm run desktop
```

Готовое приложение, только `.app`, без `.dmg`:

```bash
npm run desktop:build
open "src-tauri/target/release/bundle/macos/12 недель.app"
```

Файл можно скопировать в «Программы». Данные лежат в
`~/Library/Application Support/com.peretc.twelveweek/tracker.db`.

Темы интерфейса: белая и чёрная.

## Сборка у того, кто скачал репозиторий

Нужны Node.js, Rust и Xcode Command Line Tools. После `npm install` та же
команда `npm run desktop:build` собирает `.app` локально. Подпись Apple и
App Store не используются: на чужом Mac систему нужно один раз разрешить
запуск через «Открыть» в контекстном меню, либо снять карантин командой
`xattr -cr` по пути к приложению.
