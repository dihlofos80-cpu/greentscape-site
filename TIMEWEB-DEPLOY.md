# Timeweb Cloud Deployment

## Подготовка к деплою

1. Убедись, что server.js использует process.env.PORT
2. package.json содержит корректные зависимости
3. .env файлы не загружать (config.json ок)

## Шаги в Timeweb Cloud

1. Регистрация на timeweb.cloud
2. Создать проект → Node.js
3. Настройки:
   - Node версия: 18.x или 20.x
   - Start command: node server.js
   - Build command: npm install

## Загрузка кода

### Вариант A: Git (рекомендуется)
- Инициализировать репо
- Подключить к Timeweb
- Push в репо → автодеплой

### Вариант B: ZIP-архив
- Заархивировать без node_modules
- Загрузить в панель Tim