# 🛍️ Premium Store Bot - Deno Deploy Version

Telegram bot for premium clothing store built with Deno and Grammy.

## 🚀 Quick Start

### Local Development

1. **Install Deno:**
   ```powershell
   winget install Deno.Deno
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your BOT_TOKEN, ADMIN_ID, DATABASE_URL
   ```

3. **Run bot:**
   ```bash
   deno task start
   ```

### Deploy to Deno Deploy

1. **Install Deno CLI:**
   ```bash
   winget install Deno.Deno
   ```

2. **Login to Deno:**
   ```bash
   deno login
   ```

3. **Deploy:**
   ```bash
   deno deploy --project=your-project-name bot.ts
   ```

4. **Set environment variables:**
   - Go to https://console.deno.com/your-project/~/settings
   - Add secrets: `BOT_TOKEN`, `ADMIN_ID`, `DATABASE_URL`, `WEBHOOK_URL`

5. **Set webhook:**
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-project.deno.dev/webhook/<BOT_TOKEN>"
   ```

## 📁 Project Structure

```
deno/
├── bot.ts          # Main bot entry point
├── config.ts       # Configuration and products
├── database.ts     # PostgreSQL (Neon.tech)
├── keyboards.ts    # Inline keyboards
├── deno.json       # Deno configuration
└── .env.example    # Environment template
```

## 🆓 Free Stack

| Component | Service | Cost |
|-----------|---------|------|
| Hosting | Deno Deploy | $0 (100k req/day) |
| Database | Neon.tech | $0 (0.5 GB) |

**Total: $0.00 forever** (no credit card required)

## 📦 Features

- ✅ Catalog with pagination
- ✅ Smart cart with [+/-] quantity
- ✅ Checkout & orders
- ✅ Manager support requests
- ✅ Admin panel
- ✅ No dead ends (fallback handlers)

## 🔧 Commands

| Command | Description |
|---------|-------------|
| /start | Start bot |
| /admin | Admin panel (admin only) |
| /cancel | Cancel action |

## 📝 Environment Variables

```env
BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_id
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname
ENVIRONMENT=production
WEBHOOK_URL=https://your-project.deno.dev
```

---

**Built with Deno & Grammy** 🦕
