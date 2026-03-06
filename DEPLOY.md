# 🚀 ИНСТРУКЦИЯ ПО ДЕПЛОЮ НА DENO DEPLOY

## Шаг 1: Установка Deno (локально для тестирования)

```powershell
winget install Deno.Deno
```

Или через Chocolatey:
```powershell
choco install deno
```

Проверка:
```bash
deno --version
```

---

## Шаг 2: Подготовка проекта

Файлы готовы в папке `deno/`:
- `bot.ts` — основной код
- `config.ts` — конфигурация
- `database.ts` — БД (Neon.tech)
- `keyboards.ts` — клавиатуры
- `deno.json` — конфигурация Deno

---

## Шаг 3: Деплой на Deno Deploy

### Вариант A: Через CLI (рекомендуется)

1. **Login:**
   ```bash
   deno login
   ```
   Откроется браузер для авторизации через GitHub.

2. **Deploy:**
   ```bash
   cd deno
   deno deploy bot.ts
   ```
   
   При первом деплое:
   - Вас попросят выбрать проект
   - Или создать новый: `premium-store-bot`

3. **Запомните URL:**
   ```
   https://premium-store-bot.deno.dev
   ```

### Вариант B: Через веб-интерфейс

1. Зайдите на https://dash.deno.com
2. Connect GitHub аккаунт
3. New Project → Выберите репозиторий
4. Entry point: `deno/bot.ts`

---

## Шаг 4: Настройка Environment Variables

Зайдите на: **https://console.deno.com/YOUR-PROJECT/~/settings**

Добавьте secrets:

```
BOT_TOKEN=8669157155:AAEuIJDfcsKj2acc3vCI57SUU-kZ2_9seh4
ADMIN_ID=6297262714
DATABASE_URL=postgresql://neondb_owner:npg_puiyaD37OGNC@ep-spring-pine-alrafn28-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
ENVIRONMENT=production
```

---

## Шаг 5: Настройка Webhook

### Узнайте ваш Deno URL:
```
https://YOUR-PROJECT.deno.dev
```

### Установите webhook:
```bash
curl "https://api.telegram.org/bot8669157155:AAF2ssbzpT9ks2XS6tu4STWjkBiEtu6dhyY/setWebhook?url=https://YOUR-PROJECT.deno.dev/webhook/8669157155:AAF2ssbzpT9ks2XS6tu4STWjkBiEtu6dhyY"
```

### Проверьте:
```bash
curl "https://api.telegram.org/bot8669157155:AAEuIJDfcsKj2acc3vCI57SUU-kZ2_9seh4/getWebhookInfo"
```

Ответ должен быть:
```json
{"ok":true,"result":{"url":"https://YOUR-PROJECT.deno.dev/webhook/...","has_custom_certificate":false,"pending_update_count":0}}
```

---

## Шаг 6: Тестирование

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Проверьте:
   - 🛍️ Каталог
   - Добавление в корзину
   - 🛒 Корзина (кнопки [+/-])
   - /admin (админка)

---

## 🔧 Troubleshooting

### Ошибка: "Bot token invalid"
- Проверьте `BOT_TOKEN` в secrets

### Ошибка: "Database connection failed"
- Проверьте `DATABASE_URL` в secrets
- Убедитесь что Neon.tech доступен

### Webhook не работает
- Проверьте URL: `https://PROJECT.deno.dev/webhook/TOKEN`
- Убедитесь что `ENVIRONMENT=production`

### Бот не отвечает
- Проверьте логи: https://console.deno.com/YOUR-PROJECT/~/logs

---

## 📊 Логи и мониторинг

- **Logs:** https://console.deno.com/YOUR-PROJECT/~/logs
- **Metrics:** https://console.deno.com/YOUR-PROJECT/~/metrics

---

## 🆘 Поддержка

- Deno Deploy Docs: https://docs.deno.com/deploy/
- Grammy Docs: https://grammy.dev/

---

**Готово! Бот онлайн! 🎉**
